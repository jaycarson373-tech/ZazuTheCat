import {
  BUYBACK_EXECUTED_TOPIC,
  CANONICAL_BURN_ADDRESS,
  CREATOR_FEES_FORWARDED_TOPIC,
  DIRECT_ZAZU_BURNED_TOPIC,
  PONS_FEE_COLLECTOR_SELECTORS,
} from "./buyback-vault";
import {
  decodeTopicAddress,
  decodeUint,
  formatUnits,
  isAddress,
  normalizeAddress,
  readAddress,
  readUint,
  rpc,
  splitDataWords,
  transactionExplorerUrl,
  type RpcLog,
} from "./rpc";

const DEFAULT_BLOCK_SPAN = 25_000n;
const DEFAULT_CONFIRMATION_DEPTH = 2n;
const MAX_SCAN_CHUNKS = 24;
const MAX_UINT256 = (1n << 256n) - 1n;
const REQUIRED_CLAIM_INTERVAL = 900n;

export type ActivityKind =
  | "claim_flush"
  | "fee_flush"
  | "fees_forwarded"
  | "direct_burn"
  | "buyback"
  | "buyback_burn";

type RawActivity = {
  kind: ActivityKind;
  blockNumber: bigint;
  logIndex: bigint;
  transactionHash: string;
  timestamp: bigint | null;
  inputAsset?: string;
  amountIn?: bigint;
  wrappedNativeAmount?: bigint;
  zazuAmount?: bigint;
  destination?: string;
  executionId?: bigint;
};

export type CollectorProofState =
  | "ready"
  | "missing"
  | "invalid"
  | "no_code"
  | "unavailable"
  | "not_configured"
  | "token_mismatch"
  | "vault_mismatch"
  | "cadence_mismatch";

export type CollectorProofStatus = {
  ready: boolean;
  state: CollectorProofState;
  address: string | null;
  error: string | null;
};

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  blockNumber: string;
  logIndex: string;
  transactionHash: string;
  explorerUrl: string;
  timestamp: string | null;
  inputAsset: string | null;
  inputSymbol: string | null;
  amountInRaw: string | null;
  amountInFormatted: string | null;
  wrappedNativeAmountRaw: string | null;
  wrappedNativeAmountFormatted: string | null;
  zazuAmountRaw: string | null;
  zazuAmountFormatted: string | null;
  tokenSymbol: string;
  destination: string | null;
  executionId: string | null;
};

export type ActivityCursor = {
  blockNumber: bigint;
  logIndex: bigint;
};

type RpcTransaction = { input?: string } | null;
type RpcBlock = { timestamp?: string } | null;

function positionIsBefore(activity: RawActivity, cursor: ActivityCursor): boolean {
  return activity.blockNumber < cursor.blockNumber ||
    (activity.blockNumber === cursor.blockNumber && activity.logIndex < cursor.logIndex);
}

function compareNewestFirst(left: RawActivity, right: RawActivity): number {
  if (left.blockNumber !== right.blockNumber) {
    return left.blockNumber > right.blockNumber ? -1 : 1;
  }
  if (left.logIndex !== right.logIndex) {
    return left.logIndex > right.logIndex ? -1 : 1;
  }
  return left.transactionHash.localeCompare(right.transactionHash);
}

export function parseActivityCursor(value: string | null): ActivityCursor | null {
  if (value === null || value === "") return null;
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) throw new Error("cursor must use the blockNumber:logIndex format");
  const blockNumber = BigInt(match[1]);
  const logIndex = BigInt(match[2]);
  if (blockNumber > MAX_UINT256 || logIndex > MAX_UINT256) {
    throw new Error("cursor values are too large");
  }
  return { blockNumber, logIndex };
}

export function encodeActivityCursor(cursor: ActivityCursor): string {
  return `${cursor.blockNumber}:${cursor.logIndex}`;
}

export function classifyCollectorCall(input: string | undefined): ActivityKind {
  const selector = input?.slice(0, 10).toLowerCase();
  if (selector === PONS_FEE_COLLECTOR_SELECTORS.claimAndFlush) return "claim_flush";
  if (selector === PONS_FEE_COLLECTOR_SELECTORS.flush) return "fee_flush";
  return "fees_forwarded";
}

export function isMeaningfulActivity(item: RawActivity): boolean {
  if (item.kind !== "fees_forwarded") return true;
  return (item.wrappedNativeAmount ?? 0n) > 0n || (item.zazuAmount ?? 0n) > 0n;
}

export function decodeActivityLog(log: RpcLog): RawActivity {
  const topic = log.topics[0]?.toLowerCase();
  const transactionHash = normalizeAddress(log.transactionHash);
  const blockNumber = decodeUint(log.blockNumber);
  const logIndex = decodeUint(log.logIndex);
  const words = splitDataWords(log.data);

  if (topic === BUYBACK_EXECUTED_TOPIC) {
    if (log.topics.length < 4 || words.length !== 3) {
      throw new Error("BuybackExecuted event contained unexpected data");
    }
    const destination = decodeTopicAddress(log.topics[3]);
    return {
      kind: destination === CANONICAL_BURN_ADDRESS ? "buyback_burn" : "buyback",
      blockNumber,
      logIndex,
      transactionHash,
      timestamp: decodeUint(words[2]),
      executionId: decodeUint(log.topics[1]),
      inputAsset: decodeTopicAddress(log.topics[2]),
      amountIn: decodeUint(words[0]),
      zazuAmount: decodeUint(words[1]),
      destination,
    };
  }

  if (topic === DIRECT_ZAZU_BURNED_TOPIC) {
    if (log.topics.length < 2 || words.length !== 2) {
      throw new Error("DirectZazuBurned event contained unexpected data");
    }
    return {
      kind: "direct_burn",
      blockNumber,
      logIndex,
      transactionHash,
      timestamp: decodeUint(words[1]),
      zazuAmount: decodeUint(words[0]),
      destination: decodeTopicAddress(log.topics[1]),
    };
  }

  if (topic === CREATOR_FEES_FORWARDED_TOPIC) {
    if (log.topics.length !== 1 || words.length !== 2) {
      throw new Error("CreatorFeesForwarded event contained unexpected data");
    }
    return {
      kind: "fees_forwarded",
      blockNumber,
      logIndex,
      transactionHash,
      timestamp: null,
      wrappedNativeAmount: decodeUint(words[0]),
      zazuAmount: decodeUint(words[1]),
    };
  }

  throw new Error("RPC returned an unsupported activity event");
}

export function configuredFeeCollectorAddress(): {
  address: string | null;
  error: string | null;
} {
  const candidate = process.env.PONS_FEE_COLLECTOR_ADDRESS?.trim() || "";
  if (!candidate) return { address: null, error: null };
  if (!isAddress(candidate)) {
    return {
      address: null,
      error: "PONS_FEE_COLLECTOR_ADDRESS must be a 20-byte EVM address.",
    };
  }
  return { address: normalizeAddress(candidate), error: null };
}

export function assessCollectorProof(input: {
  address: string | null;
  addressError?: string | null;
  code?: string | null;
  configured?: bigint | null;
  zazuToken?: string | null;
  buybackVault?: string | null;
  minimumClaimInterval?: bigint | null;
  expectedZazuToken: string;
  expectedBuybackVault: string;
  readError?: boolean;
}): CollectorProofStatus {
  const address = input.address;
  if (!address) {
    return input.addressError
      ? {
          ready: false,
          state: "invalid",
          address: null,
          error: "CLAIM RECEIPTS INCOMPLETE: THE FEE COLLECTOR ADDRESS IS INVALID.",
        }
      : {
          ready: false,
          state: "missing",
          address: null,
          error: "CLAIM RECEIPTS INCOMPLETE: THE FEE COLLECTOR ADDRESS IS MISSING.",
        };
  }
  if (input.code === "0x" || input.code === "0x0") {
    return {
      ready: false,
      state: "no_code",
      address,
      error: "CLAIM RECEIPTS INCOMPLETE: THE FEE COLLECTOR ADDRESS HAS NO CONTRACT CODE.",
    };
  }
  if (input.readError) {
    return {
      ready: false,
      state: "unavailable",
      address,
      error: "CLAIM RECEIPTS INCOMPLETE: THE FEE COLLECTOR COULD NOT BE VERIFIED.",
    };
  }
  if (input.configured !== 1n) {
    return {
      ready: false,
      state: "not_configured",
      address,
      error: "CLAIM RECEIPTS INCOMPLETE: THE FEE COLLECTOR IS NOT CONFIGURED.",
    };
  }
  if (input.zazuToken !== normalizeAddress(input.expectedZazuToken)) {
    return {
      ready: false,
      state: "token_mismatch",
      address,
      error: "CLAIM RECEIPTS INCOMPLETE: THE FEE COLLECTOR TOKEN DOES NOT MATCH THE VAULT.",
    };
  }
  if (input.buybackVault !== normalizeAddress(input.expectedBuybackVault)) {
    return {
      ready: false,
      state: "vault_mismatch",
      address,
      error: "CLAIM RECEIPTS INCOMPLETE: THE FEE COLLECTOR POINTS TO A DIFFERENT VAULT.",
    };
  }
  if (input.minimumClaimInterval !== REQUIRED_CLAIM_INTERVAL) {
    return {
      ready: false,
      state: "cadence_mismatch",
      address,
      error: "CLAIM RECEIPTS INCOMPLETE: THE FEE COLLECTOR CADENCE IS NOT 900 SECONDS.",
    };
  }
  return { ready: true, state: "ready", address, error: null };
}

export async function readCollectorProofStatus(options: {
  expectedZazuToken: string;
  expectedBuybackVault: string;
}): Promise<CollectorProofStatus> {
  const configuredAddress = configuredFeeCollectorAddress();
  if (!configuredAddress.address) {
    return assessCollectorProof({
      address: null,
      addressError: configuredAddress.error,
      expectedZazuToken: options.expectedZazuToken,
      expectedBuybackVault: options.expectedBuybackVault,
    });
  }

  const address = configuredAddress.address;
  let code: string;
  try {
    code = await rpc<string>("eth_getCode", [address, "latest"]);
  } catch {
    return assessCollectorProof({
      address,
      expectedZazuToken: options.expectedZazuToken,
      expectedBuybackVault: options.expectedBuybackVault,
      readError: true,
    });
  }
  if (code === "0x" || code === "0x0") {
    return assessCollectorProof({
      address,
      code,
      expectedZazuToken: options.expectedZazuToken,
      expectedBuybackVault: options.expectedBuybackVault,
    });
  }

  try {
    const [configured, zazuToken, buybackVault, minimumClaimInterval] =
      await Promise.all([
        readUint(address, PONS_FEE_COLLECTOR_SELECTORS.configured),
        readAddress(address, PONS_FEE_COLLECTOR_SELECTORS.zazuToken),
        readAddress(address, PONS_FEE_COLLECTOR_SELECTORS.buybackVault),
        readUint(address, PONS_FEE_COLLECTOR_SELECTORS.minimumClaimInterval),
      ]);
    return assessCollectorProof({
      address,
      code,
      configured,
      zazuToken,
      buybackVault,
      minimumClaimInterval,
      expectedZazuToken: options.expectedZazuToken,
      expectedBuybackVault: options.expectedBuybackVault,
    });
  } catch {
    return assessCollectorProof({
      address,
      code,
      expectedZazuToken: options.expectedZazuToken,
      expectedBuybackVault: options.expectedBuybackVault,
      readError: true,
    });
  }
}

function configuredBlockSpan(): bigint {
  const value = process.env.ACTIVITY_LOG_BLOCK_SPAN?.trim();
  if (!value) return DEFAULT_BLOCK_SPAN;
  if (!/^\d+$/.test(value)) {
    throw new Error("ACTIVITY_LOG_BLOCK_SPAN must be a positive integer");
  }
  const span = BigInt(value);
  if (span < 1n || span > 100_000n) {
    throw new Error("ACTIVITY_LOG_BLOCK_SPAN must be between 1 and 100000");
  }
  return span;
}

export function configuredConfirmationDepth(): bigint {
  const value = process.env.ACTIVITY_CONFIRMATION_DEPTH?.trim();
  if (!value) return DEFAULT_CONFIRMATION_DEPTH;
  if (!/^\d+$/.test(value)) {
    throw new Error("ACTIVITY_CONFIRMATION_DEPTH must be a non-negative integer");
  }
  const depth = BigInt(value);
  if (depth > 128n) {
    throw new Error("ACTIVITY_CONFIRMATION_DEPTH must be between 0 and 128");
  }
  return depth;
}

export function safeActivityBlock(latestBlock: bigint, confirmationDepth: bigint): bigint {
  if (latestBlock < 0n || confirmationDepth < 0n) {
    throw new Error("Block numbers and confirmation depth cannot be negative");
  }
  return latestBlock > confirmationDepth ? latestBlock - confirmationDepth : 0n;
}

async function readLogs(options: {
  address: string;
  fromBlock: bigint;
  toBlock: bigint;
  topics: string[];
}): Promise<RpcLog[]> {
  return rpc<RpcLog[]>("eth_getLogs", [
    {
      address: options.address,
      fromBlock: `0x${options.fromBlock.toString(16)}`,
      toBlock: `0x${options.toBlock.toString(16)}`,
      topics: [options.topics.length === 1 ? options.topics[0] : options.topics],
    },
  ]);
}

export async function readActivityPage(options: {
  vaultAddress: string;
  feeCollectorAddress: string | null;
  startBlock: bigint;
  cursor: ActivityCursor | null;
  limit: number;
  inputSymbol: string;
  inputDecimals: number;
  tokenSymbol: string;
  tokenDecimals: number;
}): Promise<{
  items: ActivityItem[];
  nextCursor: string | null;
  scannedToBlock: string;
  safeBlock: string;
  confirmationDepth: string;
}> {
  const chainHead = decodeUint(await rpc<string>("eth_blockNumber", []));
  const confirmationDepth = configuredConfirmationDepth();
  const safeBlock = safeActivityBlock(chainHead, confirmationDepth);
  if (options.startBlock > safeBlock) {
    return {
      items: [],
      nextCursor: null,
      scannedToBlock: safeBlock.toString(),
      safeBlock: safeBlock.toString(),
      confirmationDepth: confirmationDepth.toString(),
    };
  }

  const blockSpan = configuredBlockSpan();
  const initialCursor = options.cursor;
  let scanTo = initialCursor && initialCursor.blockNumber < safeBlock
    ? initialCursor.blockNumber
    : safeBlock;
  const raw: RawActivity[] = [];
  let chunks = 0;

  while (
    scanTo >= options.startBlock &&
    raw.length <= options.limit &&
    chunks < MAX_SCAN_CHUNKS
  ) {
    const tentativeFrom = scanTo >= blockSpan - 1n ? scanTo - blockSpan + 1n : 0n;
    const scanFrom = tentativeFrom > options.startBlock
      ? tentativeFrom
      : options.startBlock;
    const [vaultLogs, collectorLogs] = await Promise.all([
      readLogs({
        address: options.vaultAddress,
        fromBlock: scanFrom,
        toBlock: scanTo,
        topics: [BUYBACK_EXECUTED_TOPIC, DIRECT_ZAZU_BURNED_TOPIC],
      }),
      options.feeCollectorAddress
        ? readLogs({
            address: options.feeCollectorAddress,
            fromBlock: scanFrom,
            toBlock: scanTo,
            topics: [CREATOR_FEES_FORWARDED_TOPIC],
          })
        : Promise.resolve([]),
    ]);

    const decoded = [...vaultLogs, ...collectorLogs]
      .map(decodeActivityLog)
      .filter(isMeaningfulActivity)
      .filter((item) => !initialCursor || positionIsBefore(item, initialCursor));
    raw.push(...decoded);
    raw.sort(compareNewestFirst);
    scanTo = scanFrom - 1n;
    chunks += 1;
  }

  raw.sort(compareNewestFirst);
  const candidates = raw.slice(0, options.limit + 1);
  const page = candidates.slice(0, options.limit);
  const transactionTimestamps = new Map<string, bigint>();
  for (const item of page) {
    if (item.timestamp !== null) {
      transactionTimestamps.set(item.transactionHash, item.timestamp);
    }
  }

  const collectorTransactions = [...new Set(
    page.filter((item) => item.kind === "fees_forwarded").map((item) => item.transactionHash),
  )];
  const missingTimestampBlocks = [...new Set(
    page
      .filter(
        (item) => item.timestamp === null && !transactionTimestamps.has(item.transactionHash),
      )
      .map((item) => item.blockNumber.toString()),
  )];
  const [transactionResults, blockResults] = await Promise.all([
    Promise.all(
      collectorTransactions.map(async (hash) => {
        const transaction = await rpc<RpcTransaction>("eth_getTransactionByHash", [hash])
          .catch(() => null);
        return [hash, transaction?.input] as const;
      }),
    ),
    Promise.all(
      missingTimestampBlocks.map(async (blockNumber) => {
        const block = await rpc<RpcBlock>("eth_getBlockByNumber", [
          `0x${BigInt(blockNumber).toString(16)}`,
          false,
        ]).catch(() => null);
        const timestamp = block?.timestamp ? decodeUint(block.timestamp) : null;
        return [blockNumber, timestamp] as const;
      }),
    ),
  ]);
  const transactionInputs = new Map(transactionResults);
  const blockTimestamps = new Map(blockResults);

  const items = page.map((item): ActivityItem => {
    const kind = item.kind === "fees_forwarded"
      ? classifyCollectorCall(transactionInputs.get(item.transactionHash))
      : item.kind;
    const timestamp = item.timestamp ??
      transactionTimestamps.get(item.transactionHash) ??
      blockTimestamps.get(item.blockNumber.toString()) ??
      null;
    return {
      id: `${item.transactionHash}:${item.logIndex}`,
      kind,
      blockNumber: item.blockNumber.toString(),
      logIndex: item.logIndex.toString(),
      transactionHash: item.transactionHash,
      explorerUrl: transactionExplorerUrl(item.transactionHash),
      timestamp: timestamp?.toString() ?? null,
      inputAsset: item.inputAsset ?? null,
      inputSymbol: item.amountIn !== undefined ? options.inputSymbol : null,
      amountInRaw: item.amountIn?.toString() ?? null,
      amountInFormatted: item.amountIn !== undefined
        ? formatUnits(item.amountIn, options.inputDecimals)
        : null,
      wrappedNativeAmountRaw: item.wrappedNativeAmount?.toString() ?? null,
      wrappedNativeAmountFormatted: item.wrappedNativeAmount !== undefined
        ? formatUnits(item.wrappedNativeAmount, options.inputDecimals)
        : null,
      zazuAmountRaw: item.zazuAmount?.toString() ?? null,
      zazuAmountFormatted: item.zazuAmount !== undefined
        ? formatUnits(item.zazuAmount, options.tokenDecimals)
        : null,
      tokenSymbol: options.tokenSymbol,
      destination: item.destination ?? null,
      executionId: item.executionId?.toString() ?? null,
    };
  });

  let nextCursor: string | null = null;
  if (candidates.length > options.limit && page.length > 0) {
    const last = page[page.length - 1];
    nextCursor = encodeActivityCursor({
      blockNumber: last.blockNumber,
      logIndex: last.logIndex,
    });
  } else if (scanTo >= options.startBlock) {
    nextCursor = encodeActivityCursor({
      blockNumber: scanTo + 1n,
      logIndex: 0n,
    });
  }

  return {
    items,
    nextCursor,
    scannedToBlock: (scanTo >= 0n ? scanTo + 1n : 0n).toString(),
    safeBlock: safeBlock.toString(),
    confirmationDepth: confirmationDepth.toString(),
  };
}

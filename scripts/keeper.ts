import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  getAddress,
  http,
  parseEventLogs,
  zeroAddress,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { setTimeout as sleep } from "node:timers/promises";
import { selectAdaptiveBuySize } from "../keeper/adaptive-buy-size";
import { buybackVaultAbi, erc20ReadAbi, ponsFeeCollectorAbi } from "../keeper/abi";
import { cadenceWindow, REQUIRED_INTERVAL_SECONDS } from "../keeper/cadence";
import { loadKeeperConfig, type KeeperConfig } from "../keeper/config";
import { assertCreatorFeeReceiptProof } from "../keeper/creator-fee-proof";
import { transitionAfterCreatorFeeClaim } from "../keeper/cycle-orchestration";
import { acquireProcessLock } from "../keeper/lock";
import { describeError, KeeperLogger } from "../keeper/logger";
import {
  assertReconciledSignerNonce,
  type SignerNoncePhase,
} from "../keeper/manual-nonce";
import { QuoteServiceError, requestDexQuote } from "../keeper/quote";

const BASIS_POINTS = 10_000n;
const GAS_LIMIT_BUFFER_BPS = 12_000n;

type PublicClient = ReturnType<typeof createPublicClient>;

interface VaultState {
  zazuToken: Address;
  dexRouter: Address;
  wrappedNativeToken: Address;
  feeToken: Address;
  buybackDestination: Address;
  keeper: Address;
  minimumExecutionAmount: bigint;
  maximumExecutionAmount: bigint;
  maximumSlippageBps: bigint;
  minimumInterval: bigint;
  lastExecutionTime: bigint;
  availableTreasuryBalance: bigint;
  paused: boolean;
}

class ConfigurationMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationMismatchError";
  }
}

class KeeperHaltError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeeperHaltError";
  }
}

type BoundedFeeParameters =
  | {
      kind: "eip1559";
      maxFeePerGas: bigint;
      maxPriorityFeePerGas: bigint;
    }
  | {
      kind: "legacy";
      gasPrice: bigint;
    };

function addressesEqual(left: Address, right: Address): boolean {
  return getAddress(left) === getAddress(right);
}

function minimum(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

function containsRevert(error: unknown): boolean {
  let current: unknown = error;
  const visited = new Set<unknown>();
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const named = current as { name?: unknown; message?: unknown; cause?: unknown };
    const text = `${String(named.name ?? "")} ${String(named.message ?? "")}`.toLowerCase();
    if (text.includes("revert") || text.includes("execution reverted")) return true;
    current = named.cause;
  }
  return false;
}

function isRetryableRpcFailure(error: unknown): boolean {
  if (containsRevert(error)) return false;

  let current: unknown = error;
  const visited = new Set<unknown>();
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const named = current as { name?: unknown; message?: unknown; cause?: unknown };
    const text = `${String(named.name ?? "")} ${String(named.message ?? "")}`.toLowerCase();
    if (
      text.includes("httprequesterror") ||
      text.includes("timeouterror") ||
      text.includes("socket") ||
      text.includes("network") ||
      text.includes("fetch failed") ||
      text.includes("econnreset") ||
      text.includes("econnrefused") ||
      text.includes("enotfound") ||
      text.includes("rate limit") ||
      text.includes("status: 429") ||
      /status:\s*5\d\d/.test(text)
    ) {
      return true;
    }
    current = named.cause;
  }
  return false;
}

async function withRpcBackoff<T>(
  operation: string,
  config: KeeperConfig,
  logger: KeeperLogger,
  action: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= config.rpcRetryAttempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      const canRetry =
        attempt < config.rpcRetryAttempts && isRetryableRpcFailure(error);
      if (!canRetry) throw error;

      const exponential = config.rpcRetryBaseDelayMs * 2 ** (attempt - 1);
      const capped = Math.min(exponential, config.rpcRetryMaximumDelayMs);
      const delayMs = Math.floor(capped * (0.8 + Math.random() * 0.4));
      await logger.write("warn", "rpc_retry", {
        operation,
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        ...describeError(error),
      });
      await sleep(delayMs);
    }
  }

  throw new Error(`RPC retry loop ended unexpectedly for ${operation}`);
}

async function reconcileSignerNonce(options: {
  publicClient: PublicClient;
  config: KeeperConfig;
  logger: KeeperLogger;
  keeperAddress: Address;
  expectedNonce?: number;
  phase: SignerNoncePhase;
}): Promise<number> {
  const { publicClient, config, logger, keeperAddress, expectedNonce, phase } = options;
  const [latestNonce, pendingNonce] = await Promise.all([
    withRpcBackoff(`read_${phase}_latest_nonce`, config, logger, () =>
      publicClient.getTransactionCount({ address: keeperAddress, blockTag: "latest" }),
    ),
    withRpcBackoff(`read_${phase}_pending_nonce`, config, logger, () =>
      publicClient.getTransactionCount({ address: keeperAddress, blockTag: "pending" }),
    ),
  ]);

  try {
    assertReconciledSignerNonce({
      expectedNonce,
      latestNonce,
      pendingNonce,
      phase,
      executionMode: config.executionMode,
    });
  } catch (error) {
    throw new KeeperHaltError((error as Error).message);
  }

  await logger.write("info", "signer_nonce_guard_passed", {
    phase,
    executionMode: config.executionMode,
    keeper: keeperAddress,
    latestNonce,
    pendingNonce,
  });
  return latestNonce;
}

async function readVaultState(
  publicClient: PublicClient,
  config: KeeperConfig,
  logger: KeeperLogger,
): Promise<VaultState> {
  return withRpcBackoff("read_vault_configuration", config, logger, async () => {
    const contract = { address: config.vaultAddress, abi: buybackVaultAbi } as const;
    const [
      zazuToken,
      dexRouter,
      wrappedNativeToken,
      feeToken,
      buybackDestination,
      keeper,
      minimumExecutionAmount,
      maximumExecutionAmount,
      maximumSlippageBps,
      minimumInterval,
      lastExecutionTime,
      availableTreasuryBalance,
      paused,
    ] = await Promise.all([
      publicClient.readContract({ ...contract, functionName: "zazuToken" }),
      publicClient.readContract({ ...contract, functionName: "dexRouter" }),
      publicClient.readContract({ ...contract, functionName: "wrappedNativeToken" }),
      publicClient.readContract({ ...contract, functionName: "feeToken" }),
      publicClient.readContract({ ...contract, functionName: "buybackDestination" }),
      publicClient.readContract({ ...contract, functionName: "keeper" }),
      publicClient.readContract({ ...contract, functionName: "minimumExecutionAmount" }),
      publicClient.readContract({ ...contract, functionName: "maximumExecutionAmount" }),
      publicClient.readContract({ ...contract, functionName: "maximumSlippageBps" }),
      publicClient.readContract({ ...contract, functionName: "minimumInterval" }),
      publicClient.readContract({ ...contract, functionName: "lastExecutionTime" }),
      publicClient.readContract({ ...contract, functionName: "availableTreasuryBalance" }),
      publicClient.readContract({ ...contract, functionName: "paused" }),
    ]);

    return {
      zazuToken,
      dexRouter,
      wrappedNativeToken,
      feeToken,
      buybackDestination,
      keeper,
      minimumExecutionAmount,
      maximumExecutionAmount,
      maximumSlippageBps,
      minimumInterval,
      lastExecutionTime,
      availableTreasuryBalance,
      paused,
    };
  });
}

function validateVaultConfiguration(
  state: VaultState,
  config: KeeperConfig,
  expectedKeeper: Address,
): void {
  const addressPins: Array<[string, Address, Address]> = [
    ["zazuToken", state.zazuToken, config.expectedZazuToken],
    ["dexRouter", state.dexRouter, config.expectedDexRouter],
    ["wrappedNativeToken", state.wrappedNativeToken, config.expectedWrappedNative],
    ["buybackDestination", state.buybackDestination, config.expectedDestination],
    ["keeper", state.keeper, expectedKeeper],
  ];
  addressPins.push(["feeToken", state.feeToken, config.expectedFeeToken]);

  for (const [field, actual, expected] of addressPins) {
    if (!addressesEqual(actual, expected)) {
      throw new ConfigurationMismatchError(
        `${field} is ${actual}, but the fail-closed environment pin is ${expected}`,
      );
    }
  }

  if (addressesEqual(state.zazuToken, zeroAddress)) {
    throw new ConfigurationMismatchError("zazuToken cannot be the zero address");
  }
  if (addressesEqual(state.dexRouter, zeroAddress)) {
    throw new ConfigurationMismatchError("dexRouter cannot be the zero address");
  }
  if (addressesEqual(state.buybackDestination, zeroAddress)) {
    throw new ConfigurationMismatchError("buybackDestination cannot be the zero address");
  }
  if (state.minimumExecutionAmount !== config.expectedMinimumAmount) {
    throw new ConfigurationMismatchError("minimumExecutionAmount differs from MIN_EXECUTION_AMOUNT");
  }
  if (state.maximumExecutionAmount !== config.expectedMaximumAmount) {
    throw new ConfigurationMismatchError("maximumExecutionAmount differs from MAX_EXECUTION_AMOUNT");
  }
  if (state.maximumSlippageBps !== config.expectedMaximumSlippageBps) {
    throw new ConfigurationMismatchError("maximumSlippageBps differs from MAX_SLIPPAGE_BPS");
  }
  if (state.minimumInterval !== REQUIRED_INTERVAL_SECONDS) {
    throw new ConfigurationMismatchError(
      `minimumInterval must be exactly ${REQUIRED_INTERVAL_SECONDS} seconds`,
    );
  }
  if (
    state.minimumExecutionAmount <= 0n ||
    state.maximumExecutionAmount < state.minimumExecutionAmount
  ) {
    throw new ConfigurationMismatchError("vault execution limits are invalid");
  }
  if (state.maximumSlippageBps >= BASIS_POINTS) {
    throw new ConfigurationMismatchError("vault slippage limit must be below 10000 bps");
  }
}

async function readDecimals(
  publicClient: PublicClient,
  config: KeeperConfig,
  logger: KeeperLogger,
  token: Address,
): Promise<number> {
  if (addressesEqual(token, zeroAddress)) return 18;
  return withRpcBackoff("read_token_decimals", config, logger, () =>
    publicClient.readContract({
      address: token,
      abi: erc20ReadAbi,
      functionName: "decimals",
    }),
  );
}

function effectivePrice(
  amountIn: bigint,
  inputDecimals: number,
  zazuReceived: bigint,
  zazuDecimals: number,
): string {
  if (zazuReceived === 0n) return "0";
  const scale = 10n ** 18n;
  const numerator = amountIn * 10n ** BigInt(zazuDecimals) * scale;
  const denominator = zazuReceived * 10n ** BigInt(inputDecimals);
  return formatUnits(numerator / denominator, 18);
}

async function processCreatorFees(options: {
  config: KeeperConfig;
  publicClient: PublicClient;
  walletClient?: ReturnType<typeof createWalletClient>;
  signerAccount?: ReturnType<typeof privateKeyToAccount>;
  keeperAddress: Address;
  logger: KeeperLogger;
  latestBlock: { baseFeePerGas: bigint | null; timestamp: bigint };
  cycleStartedAt: string;
  manualNonce?: number;
  shutdownSignal?: AbortSignal;
}): Promise<boolean> {
  const { config, publicClient, logger, keeperAddress, latestBlock, cycleStartedAt } = options;
  const collector = { address: config.feeCollectorAddress, abi: ponsFeeCollectorAbi } as const;
  const [
    configured,
    wrappedNativeToken,
    ponsLocker,
    zazuToken,
    buybackVault,
    minimumClaimInterval,
    lastClaimTime,
  ] = await withRpcBackoff("read_fee_collector_configuration", config, logger, () =>
    Promise.all([
      publicClient.readContract({ ...collector, functionName: "configured" }),
      publicClient.readContract({ ...collector, functionName: "wrappedNativeToken" }),
      publicClient.readContract({ ...collector, functionName: "ponsLocker" }),
      publicClient.readContract({ ...collector, functionName: "zazuToken" }),
      publicClient.readContract({ ...collector, functionName: "buybackVault" }),
      publicClient.readContract({ ...collector, functionName: "minimumClaimInterval" }),
      publicClient.readContract({ ...collector, functionName: "lastClaimTime" }),
    ]),
  );

  if (!configured) throw new ConfigurationMismatchError("pons fee collector is not configured");
  const collectorPins: Array<[string, Address, Address]> = [
    ["collector.wrappedNativeToken", wrappedNativeToken, config.expectedWrappedNative],
    ["collector.ponsLocker", ponsLocker, config.expectedPonsLocker],
    ["collector.zazuToken", zazuToken, config.expectedZazuToken],
    ["collector.buybackVault", buybackVault, config.vaultAddress],
  ];
  for (const [field, actual, expected] of collectorPins) {
    if (!addressesEqual(actual, expected)) {
      throw new ConfigurationMismatchError(`${field} is ${actual}, expected ${expected}`);
    }
  }
  if (minimumClaimInterval !== REQUIRED_INTERVAL_SECONDS) {
    throw new ConfigurationMismatchError(
      `collector.minimumClaimInterval must be exactly ${REQUIRED_INTERVAL_SECONDS} seconds`,
    );
  }

  const chainTimestamp = latestBlock.timestamp;
  const claimCadence = cadenceWindow({
    chainTimestamp,
    lastActionTime: lastClaimTime,
    interval: minimumClaimInterval,
  });
  if (!claimCadence.eligible) {
    await logger.write("info", "creator_fee_flush_skipped", {
      reason: "claim_interval_not_elapsed",
      cycleStartedAt,
      chainTimestamp,
      nextClaimTime: claimCadence.nextEligibleTime,
      secondsRemaining: claimCadence.secondsRemaining,
    });
    return false;
  }

  const flush = {
    ...collector,
    functionName: "claimAndFlush" as const,
    account: keeperAddress,
  };
  const simulation = await withRpcBackoff("simulate_creator_fee_claim_and_flush", config, logger, () =>
    publicClient.simulateContract(flush),
  );
  const [wethBalance, zazuBalance] = simulation.result;
  if (wethBalance === 0n && zazuBalance === 0n) return false;

  const [estimatedGas, feeParameters] = await Promise.all([
    withRpcBackoff("estimate_creator_fee_flush_gas", config, logger, () =>
      publicClient.estimateContractGas(flush),
    ),
    withRpcBackoff("estimate_creator_fee_flush_fees", config, logger, async () => {
      if (latestBlock.baseFeePerGas !== null) {
        const fees = await publicClient.estimateFeesPerGas({ chain: undefined, type: "eip1559" });
        return {
          kind: "eip1559" as const,
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        };
      }
      const fees = await publicClient.estimateFeesPerGas({ chain: undefined, type: "legacy" });
      return { kind: "legacy" as const, gasPrice: fees.gasPrice };
    }),
  ]);
  const gasLimit = (estimatedGas * GAS_LIMIT_BUFFER_BPS + BASIS_POINTS - 1n) / BASIS_POINTS;
  const boundedFeePerGas =
    feeParameters.kind === "eip1559" ? feeParameters.maxFeePerGas : feeParameters.gasPrice;
  const maximumTransactionFee = gasLimit * boundedFeePerGas;
  if (gasLimit > config.maximumGasUnits || maximumTransactionFee > config.maximumGasCostWei) {
    await logger.write("warn", "creator_fee_flush_skipped", {
      reason: "gas_limit_exceeded",
      cycleStartedAt,
      wethBalance,
      zazuBalance,
      gasLimit,
      maximumTransactionFee,
    });
    return false;
  }

  const keeperGasBalance = await withRpcBackoff(
    "read_creator_fee_flush_gas_balance",
    config,
    logger,
    () => publicClient.getBalance({ address: keeperAddress }),
  );
  if (keeperGasBalance < maximumTransactionFee) {
    await logger.write("warn", "creator_fee_flush_skipped", {
      reason: "keeper_gas_balance_insufficient",
      cycleStartedAt,
      keeperGasBalance,
      maximumTransactionFee,
    });
    return false;
  }

  if (config.dryRun) {
    await logger.write("info", "creator_fee_flush_dry_run", {
      cycleStartedAt,
      wethBalance,
      zazuBalance,
      gasLimit,
      maximumTransactionFee,
    });
    return false;
  }
  if (!options.walletClient || !options.signerAccount) {
    throw new Error("Live creator-fee forwarding requires a configured signer");
  }
  if (options.shutdownSignal?.aborted) {
    await logger.write("info", "submission_skipped_for_shutdown", {
      phase: "creator_fee_flush",
      cycleStartedAt,
    });
    return false;
  }
  const submissionNonce = await reconcileSignerNonce({
    publicClient,
    config,
    logger,
    keeperAddress,
    expectedNonce: options.manualNonce,
    phase: "creator_fee_flush",
  });
  if (options.shutdownSignal?.aborted) {
    await logger.write("info", "submission_skipped_for_shutdown", {
      phase: "creator_fee_flush",
      cycleStartedAt,
    });
    return false;
  }

  let transactionHash: `0x${string}`;
  try {
    const request = {
      ...collector,
      functionName: "claimAndFlush" as const,
      account: options.signerAccount,
      chain: options.walletClient.chain,
      gas: gasLimit,
      nonce: submissionNonce,
    };
    transactionHash = feeParameters.kind === "eip1559"
      ? await options.walletClient.writeContract({
          ...request,
          maxFeePerGas: feeParameters.maxFeePerGas,
          maxPriorityFeePerGas: feeParameters.maxPriorityFeePerGas,
        })
      : await options.walletClient.writeContract({ ...request, gasPrice: feeParameters.gasPrice });
  } catch (error) {
    await logger.write("error", "creator_fee_flush_submission_uncertain", {
      cycleStartedAt,
      retryAttempted: false,
      ...describeError(error),
    });
    throw new KeeperHaltError(
      "Creator-fee forwarding submission is uncertain. Reconcile the signer nonce before restarting.",
    );
  }

  let receipt;
  try {
    receipt = await withRpcBackoff("wait_for_creator_fee_flush", config, logger, () =>
      publicClient.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations: config.confirmations,
        timeout: config.receiptTimeoutMs,
      }),
    );
  } catch (error) {
    await logger.write("error", "creator_fee_flush_confirmation_uncertain", {
      cycleStartedAt,
      transactionHash,
      retryTransaction: false,
      ...describeError(error),
    });
    throw new KeeperHaltError(
      `Creator-fee forwarding confirmation is uncertain for ${transactionHash}. Reconcile it before restarting.`,
    );
  }
  if (receipt.status !== "success") {
    throw new KeeperHaltError(`Creator-fee forwarding reverted in ${transactionHash}`);
  }

  let confirmedWethAmount = 0n;
  let confirmedZazuAmount = 0n;
  try {
    const forwardedEvents = parseEventLogs({
      abi: ponsFeeCollectorAbi,
      eventName: "CreatorFeesForwarded",
      logs: receipt.logs,
      strict: true,
    })
      .filter((event) => addressesEqual(event.address, config.feeCollectorAddress))
      .map((event) => ({
        wrappedNativeAmount: event.args.wrappedNativeAmount,
        zazuAmount: event.args.zazuAmount,
      }));
    const directBurnEvents = parseEventLogs({
      abi: buybackVaultAbi,
      eventName: "DirectZazuBurned",
      logs: receipt.logs,
      strict: true,
    })
      .filter((event) => addressesEqual(event.address, config.vaultAddress))
      .map((event) => ({
        amount: event.args.amount,
        destination: event.args.destination,
      }));
    const confirmed = assertCreatorFeeReceiptProof({
      expectedBurnDestination: config.expectedDestination,
      forwardedEvents,
      directBurnEvents,
    });
    confirmedWethAmount = confirmed.wrappedNativeAmount;
    confirmedZazuAmount = confirmed.zazuAmount;
  } catch (error) {
    await logger.write("error", "creator_fee_proof_mismatch", {
      cycleStartedAt,
      transactionHash,
      blockNumber: receipt.blockNumber,
      simulatedWethAmount: wethBalance,
      simulatedZazuAmount: zazuBalance,
      retryTransaction: false,
      ...describeError(error),
    });
    throw new KeeperHaltError(
      `Confirmed creator-fee transaction ${transactionHash} did not emit the expected forwarding and burn proof`,
    );
  }
  await logger.write("info", "creator_fees_forwarded", {
    cycleStartedAt,
    transactionHash,
    wethBalance: confirmedWethAmount,
    zazuBalance: confirmedZazuAmount,
    simulatedWethBalance: wethBalance,
    simulatedZazuBalance: zazuBalance,
    blockNumber: receipt.blockNumber,
    executionMode: config.executionMode,
    nonce: submissionNonce,
    manualReason: config.manualReason,
  });
  return true;
}

async function runCycle(options: {
  config: KeeperConfig;
  publicClient: PublicClient;
  walletClient?: ReturnType<typeof createWalletClient>;
  signerAccount?: ReturnType<typeof privateKeyToAccount>;
  keeperAddress: Address;
  logger: KeeperLogger;
  manualNonce?: number;
  shutdownSignal?: AbortSignal;
}): Promise<void> {
  const { config, publicClient, logger, keeperAddress } = options;
  const cycleStartedAt = new Date().toISOString();
  let nextManualNonce = options.manualNonce;

  let [state, latestBlock] = await Promise.all([
    readVaultState(publicClient, config, logger),
    withRpcBackoff("read_latest_block", config, logger, () =>
      publicClient.getBlock({ blockTag: "latest" }),
    ),
  ]);
  validateVaultConfiguration(state, config, keeperAddress);

  if (state.paused) {
    await logger.write("info", "cycle_skipped", { reason: "vault_paused", cycleStartedAt });
    return;
  }

  // Do not collect creator fees on every one-minute poll. Both the vault and
  // collector enforce a 15-minute cadence onchain; this early gate avoids a
  // pointless claim simulation until the buyback window is open.
  const initialChainTimestamp = latestBlock.timestamp;
  const initialCadence = cadenceWindow({
    chainTimestamp: initialChainTimestamp,
    lastActionTime: state.lastExecutionTime,
    interval: state.minimumInterval,
  });
  if (!initialCadence.eligible) {
    await logger.write("info", "cycle_skipped", {
      reason: "interval_not_elapsed",
      cycleStartedAt,
      chainTimestamp: initialChainTimestamp,
      nextEligibleTime: initialCadence.nextEligibleTime,
      secondsRemaining: initialCadence.secondsRemaining,
    });
    return;
  }

  const creatorFeesForwarded = await processCreatorFees({
    ...options,
    latestBlock,
    cycleStartedAt,
    manualNonce: nextManualNonce,
  });
  if (options.shutdownSignal?.aborted) {
    await logger.write("info", "cycle_stopped_before_submission", { cycleStartedAt });
    return;
  }
  const claimTransition = transitionAfterCreatorFeeClaim({
    creatorFeesForwarded,
    expectedNonce: nextManualNonce,
  });
  nextManualNonce = claimTransition.nextExpectedNonce;
  if (claimTransition.refreshVaultState) {
    [state, latestBlock] = await Promise.all([
      readVaultState(publicClient, config, logger),
      withRpcBackoff("refresh_latest_block_after_fee_flush", config, logger, () =>
        publicClient.getBlock({ blockTag: "latest" }),
      ),
    ]);
    validateVaultConfiguration(state, config, keeperAddress);
  }

  if (state.paused) {
    await logger.write("info", "cycle_skipped", { reason: "vault_paused", cycleStartedAt });
    return;
  }

  const chainTimestamp = latestBlock.timestamp;
  const buybackCadence = cadenceWindow({
    chainTimestamp,
    lastActionTime: state.lastExecutionTime,
    interval: state.minimumInterval,
  });
  if (!buybackCadence.eligible) {
    await logger.write("info", "cycle_skipped", {
      reason: "interval_not_elapsed",
      cycleStartedAt,
      chainTimestamp,
      nextEligibleTime: buybackCadence.nextEligibleTime,
      secondsRemaining: buybackCadence.secondsRemaining,
    });
    return;
  }

  // Direct ERC-20 creator-fee transfers are intentionally valid. The vault
  // accounts their balance delta inside executeBuyback before enforcing spend.
  const treasuryBalance = state.availableTreasuryBalance;
  if (treasuryBalance < state.minimumExecutionAmount) {
    await logger.write("info", "cycle_skipped", {
      reason: "treasury_below_minimum",
      cycleStartedAt,
      treasuryBalance,
      minimumExecutionAmount: state.minimumExecutionAmount,
    });
    return;
  }

  const requestedAmountIn = minimum(treasuryBalance, state.maximumExecutionAmount);
  let amountIn = requestedAmountIn;
  let quote;
  try {
    const sizing = await selectAdaptiveBuySize({
      requestedAmountIn,
      minimumAmountIn: state.minimumExecutionAmount,
      maximumPriceImpactBps: config.maximumPriceImpactBps,
      getQuote: (candidateAmountIn) =>
        requestDexQuote({
          apiUrl: config.quoteApiUrl,
          apiKey: config.quoteApiKey,
          timeoutMs: config.quoteTimeoutMs,
          request: {
            chainId: config.chainId,
            vault: config.vaultAddress,
            router: state.dexRouter,
            wrappedNativeToken: state.wrappedNativeToken,
            inputToken: state.feeToken,
            outputToken: state.zazuToken,
            recipient: config.vaultAddress,
            amountIn: candidateAmountIn,
            maximumSlippageBps: Number(state.maximumSlippageBps),
          },
        }),
    });

    for (let index = 0; index < sizing.attempts.length - 1; index += 1) {
      const attempt = sizing.attempts[index];
      const nextAttempt = sizing.attempts[index + 1];
      await logger.write("info", "buy_size_reduced", {
        cycleStartedAt,
        quoteId: attempt.quote.quoteId,
        previousAmountIn: attempt.amountIn,
        nextAmountIn: nextAttempt.amountIn,
        priceImpactBps: attempt.quote.priceImpactBps,
        maximumPriceImpactBps: config.maximumPriceImpactBps,
      });
    }

    if (!sizing.safe) {
      const minimumAttempt = sizing.attempts[sizing.attempts.length - 1];
      await logger.write("warn", "cycle_skipped", {
        reason: "minimum_buy_still_above_price_impact_limit",
        cycleStartedAt,
        quoteId: minimumAttempt.quote.quoteId,
        requestedAmountIn,
        minimumAmountIn: minimumAttempt.amountIn,
        priceImpactBps: minimumAttempt.quote.priceImpactBps,
        maximumPriceImpactBps: config.maximumPriceImpactBps,
        quotedSizes: sizing.attempts.map((attempt) => attempt.amountIn),
      });
      return;
    }

    amountIn = sizing.amountIn;
    quote = sizing.quote;
  } catch (error) {
    await logger.write("warn", "cycle_skipped", {
      reason: error instanceof QuoteServiceError ? "invalid_or_unavailable_quote" : "quote_error",
      cycleStartedAt,
      retryableOnNextCycle: error instanceof QuoteServiceError && error.retryable,
      ...describeError(error),
    });
    return;
  }

  if (
    BigInt(quote.expiresAt) <
    chainTimestamp + BigInt(config.quoteValidityBufferSeconds)
  ) {
    await logger.write("warn", "cycle_skipped", {
      reason: "quote_expired_or_too_close_to_expiry",
      cycleStartedAt,
      quoteId: quote.quoteId,
      quoteExpiresAt: quote.expiresAt,
      chainTimestamp,
    });
    return;
  }

  const minimumZazuOut =
    (quote.quotedOutput * (BASIS_POINTS - state.maximumSlippageBps)) / BASIS_POINTS;
  if (minimumZazuOut <= 0n) {
    await logger.write("warn", "cycle_skipped", {
      reason: "minimum_output_rounds_to_zero",
      cycleStartedAt,
      quotedOutput: quote.quotedOutput,
      maximumSlippageBps: state.maximumSlippageBps,
    });
    return;
  }

  const execution = {
    address: config.vaultAddress,
    abi: buybackVaultAbi,
    functionName: "executeBuyback" as const,
    args: [amountIn, minimumZazuOut, quote.routerData] as const,
    account: keeperAddress,
  };

  try {
    await withRpcBackoff("simulate_buyback", config, logger, () =>
      publicClient.simulateContract(execution),
    );
  } catch (error) {
    await logger.write("warn", "cycle_skipped", {
      reason: containsRevert(error) ? "simulation_reverted" : "simulation_failed",
      cycleStartedAt,
      quoteId: quote.quoteId,
      ...describeError(error),
    });
    return;
  }

  let estimatedGas: bigint;
  let feeParameters: BoundedFeeParameters;
  try {
    [estimatedGas, feeParameters] = await Promise.all([
      withRpcBackoff("estimate_buyback_gas", config, logger, () =>
        publicClient.estimateContractGas(execution),
      ),
      withRpcBackoff("estimate_fees_per_gas", config, logger, async () => {
        if (latestBlock.baseFeePerGas !== null) {
          const fees = await publicClient.estimateFeesPerGas({
            chain: undefined,
            type: "eip1559",
          });
          if (
            fees.maxFeePerGas <= 0n ||
            fees.maxPriorityFeePerGas < 0n ||
            fees.maxPriorityFeePerGas > fees.maxFeePerGas
          ) {
            throw new Error("RPC returned invalid EIP-1559 fee parameters");
          }
          return {
            kind: "eip1559" as const,
            maxFeePerGas: fees.maxFeePerGas,
            maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
          };
        }

        const fees = await publicClient.estimateFeesPerGas({
          chain: undefined,
          type: "legacy",
        });
        if (fees.gasPrice <= 0n) {
          throw new Error("RPC returned an invalid legacy gas price");
        }
        return { kind: "legacy" as const, gasPrice: fees.gasPrice };
      }),
    ]);
  } catch (error) {
    await logger.write("warn", "cycle_skipped", {
      reason: "gas_estimation_failed",
      cycleStartedAt,
      ...describeError(error),
    });
    return;
  }

  // Submit with a 20% gas buffer, but only when the complete buffered limit is
  // still within the operator's hard ceiling. Never silently clamp the limit.
  const gasLimit =
    (estimatedGas * GAS_LIMIT_BUFFER_BPS + BASIS_POINTS - 1n) / BASIS_POINTS;
  if (gasLimit > config.maximumGasUnits) {
    await logger.write("warn", "cycle_skipped", {
      reason: "buffered_gas_limit_above_ceiling",
      cycleStartedAt,
      estimatedGas,
      gasLimit,
      maximumGasUnits: config.maximumGasUnits,
    });
    return;
  }

  const boundedFeePerGas =
    feeParameters.kind === "eip1559"
      ? feeParameters.maxFeePerGas
      : feeParameters.gasPrice;
  const maximumTransactionFee = gasLimit * boundedFeePerGas;
  if (maximumTransactionFee > config.maximumGasCostWei) {
    await logger.write("warn", "cycle_skipped", {
      reason: "gas_cost_above_limit",
      cycleStartedAt,
      gasLimit,
      boundedFeePerGas,
      maximumTransactionFee,
      maximumGasCostWei: config.maximumGasCostWei,
    });
    return;
  }

  const keeperGasBalance = await withRpcBackoff("read_keeper_gas_balance", config, logger, () =>
    publicClient.getBalance({ address: keeperAddress }),
  );
  if (keeperGasBalance < maximumTransactionFee) {
    await logger.write("warn", "cycle_skipped", {
      reason: "keeper_gas_balance_insufficient",
      cycleStartedAt,
      keeperGasBalance,
      maximumTransactionFee,
    });
    return;
  }

  const preSubmitBlock = await withRpcBackoff(
    "recheck_chain_time_before_submit",
    config,
    logger,
    () => publicClient.getBlock({ blockTag: "latest" }),
  );
  if (
    BigInt(quote.expiresAt) <
    preSubmitBlock.timestamp + BigInt(config.quoteValidityBufferSeconds)
  ) {
    await logger.write("warn", "cycle_skipped", {
      reason: "quote_expired_before_submit",
      cycleStartedAt,
      quoteId: quote.quoteId,
      quoteExpiresAt: quote.expiresAt,
      chainTimestamp: preSubmitBlock.timestamp,
    });
    return;
  }

  if (config.dryRun) {
    await logger.write("info", "dry_run_simulation_succeeded", {
      cycleStartedAt,
      quoteId: quote.quoteId,
      treasuryBalance,
      amountIn,
      quotedZazuOutput: quote.quotedOutput,
      minimumZazuOut,
      priceImpactBps: quote.priceImpactBps,
      estimatedGas,
      gasLimit,
      feeModel: feeParameters.kind,
      boundedFeePerGas,
      maximumTransactionFee,
      destination: state.buybackDestination,
    });
    return;
  }

  if (!options.walletClient || !options.signerAccount) {
    throw new Error("Live execution requires a configured signer");
  }
  if (options.shutdownSignal?.aborted) {
    await logger.write("info", "submission_skipped_for_shutdown", {
      phase: "buyback",
      cycleStartedAt,
    });
    return;
  }
  const submissionNonce = await reconcileSignerNonce({
    publicClient,
    config,
    logger,
    keeperAddress,
    expectedNonce: nextManualNonce,
    phase: "buyback",
  });
  if (options.shutdownSignal?.aborted) {
    await logger.write("info", "submission_skipped_for_shutdown", {
      phase: "buyback",
      cycleStartedAt,
    });
    return;
  }

  let transactionHash: `0x${string}`;
  try {
    // Submission is attempted exactly once. An RPC timeout here is treated as an
    // uncertain submission and is never retried automatically.
    const request = {
      address: config.vaultAddress,
      abi: buybackVaultAbi,
      functionName: "executeBuyback" as const,
      args: [amountIn, minimumZazuOut, quote.routerData] as const,
      account: options.signerAccount,
      chain: options.walletClient.chain,
      gas: gasLimit,
      nonce: submissionNonce,
    };
    transactionHash =
      feeParameters.kind === "eip1559"
        ? await options.walletClient.writeContract({
            ...request,
            maxFeePerGas: feeParameters.maxFeePerGas,
            maxPriorityFeePerGas: feeParameters.maxPriorityFeePerGas,
          })
        : await options.walletClient.writeContract({
            ...request,
            gasPrice: feeParameters.gasPrice,
          });
  } catch (error) {
    await logger.write("error", "transaction_submission_failed_or_uncertain", {
      cycleStartedAt,
      quoteId: quote.quoteId,
      retryAttempted: false,
      ...describeError(error),
    });
    throw new KeeperHaltError(
      "Transaction submission failed or is uncertain. Reconcile the signer nonce and transaction pool before restarting the keeper.",
    );
  }

  await logger.write("info", "transaction_submitted", {
    cycleStartedAt,
    transactionHash,
    quoteId: quote.quoteId,
    amountIn,
    minimumZazuOut,
    gasLimit,
    feeModel: feeParameters.kind,
    boundedFeePerGas,
    maximumTransactionFee,
    executionMode: config.executionMode,
    nonce: submissionNonce,
    manualReason: config.manualReason,
  });

  let receipt;
  try {
    // Receipt polling may be retried because it never resubmits the transaction.
    receipt = await withRpcBackoff("wait_for_receipt", config, logger, () =>
      publicClient.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations: config.confirmations,
        timeout: config.receiptTimeoutMs,
      }),
    );
  } catch (error) {
    await logger.write("error", "confirmation_wait_failed", {
      cycleStartedAt,
      transactionHash,
      retryTransaction: false,
      ...describeError(error),
    });
    throw new KeeperHaltError(
      `Confirmation status for ${transactionHash} is uncertain. Reconcile the transaction before restarting the keeper.`,
    );
  }

  if (receipt.status !== "success") {
    await logger.write("error", "buyback_reverted", {
      cycleStartedAt,
      transactionHash,
      blockNumber: receipt.blockNumber,
      retryTransaction: false,
    });
    throw new KeeperHaltError(`Buyback reverted in ${transactionHash}`);
  }

  const events = parseEventLogs({
    abi: buybackVaultAbi,
    eventName: "BuybackExecuted",
    logs: receipt.logs,
    strict: true,
  }).filter((event) => addressesEqual(event.address, config.vaultAddress));
  const executed = events.at(-1);
  if (!executed) {
    await logger.write("error", "buyback_event_missing", {
      cycleStartedAt,
      transactionHash,
      blockNumber: receipt.blockNumber,
      retryTransaction: false,
    });
    throw new KeeperHaltError(
      `Confirmed transaction ${transactionHash} did not emit BuybackExecuted`,
    );
  }

  const [inputDecimals, zazuDecimals] = await Promise.all([
    readDecimals(publicClient, config, logger, state.feeToken),
    readDecimals(publicClient, config, logger, state.zazuToken),
  ]);
  const {
    executionId,
    inputAsset,
    amountIn: eventAmountIn,
    zazuReceived,
    destination,
    timestamp,
  } = executed.args;
  if (
    eventAmountIn !== amountIn ||
    !addressesEqual(inputAsset, state.feeToken) ||
    !addressesEqual(destination, state.buybackDestination)
  ) {
    await logger.write("error", "buyback_event_mismatch", {
      cycleStartedAt,
      transactionHash,
      requestedAmountIn: amountIn,
      eventAmountIn,
      expectedInputAsset: state.feeToken,
      eventInputAsset: inputAsset,
      expectedDestination: state.buybackDestination,
      eventDestination: destination,
      retryTransaction: false,
    });
    throw new KeeperHaltError(
      `Confirmed transaction ${transactionHash} emitted mismatched buyback proof`,
    );
  }
  await logger.write("info", "buyback_confirmed", {
    cycleStartedAt,
    transactionHash,
    blockNumber: receipt.blockNumber,
    executionId,
    timestamp,
    inputAsset,
    amountSpent: eventAmountIn,
    amountSpentFormatted: formatUnits(eventAmountIn, inputDecimals),
    zazuReceived,
    zazuReceivedFormatted: formatUnits(zazuReceived, zazuDecimals),
    effectiveInputPerZazu: effectivePrice(
      eventAmountIn,
      inputDecimals,
      zazuReceived,
      zazuDecimals,
    ),
    destination,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
    executionMode: config.executionMode,
    nonce: submissionNonce,
    manualReason: config.manualReason,
  });
}

async function main(): Promise<void> {
  const config = loadKeeperConfig();
  const logger = new KeeperLogger(config.logFile);
  const chain = defineChain({
    id: config.chainId,
    name: "Robinhood Chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
  const transport = http(config.rpcUrl, { retryCount: 0, timeout: 15_000 });
  const publicClient = createPublicClient({ chain, transport });
  const signerAccount = config.privateKey
    ? privateKeyToAccount(config.privateKey)
    : undefined;
  const keeperAddress = signerAccount?.address ?? config.keeperAddress!;
  const walletClient = signerAccount
    ? createWalletClient({ account: signerAccount, chain, transport })
    : undefined;

  const lock = await acquireProcessLock(config.lockFile, config.lockStaleMs);
  const shutdownController = new AbortController();
  let stopping = false;
  const requestShutdown = () => {
    stopping = true;
    shutdownController.abort();
  };
  process.once("SIGINT", requestShutdown);
  process.once("SIGTERM", requestShutdown);

  try {
    const actualChainId = await withRpcBackoff("verify_chain_id", config, logger, () =>
      publicClient.getChainId(),
    );
    if (actualChainId !== config.chainId) {
      throw new ConfigurationMismatchError(
        `RPC reports chain ${actualChainId}, expected ${config.chainId}`,
      );
    }
    const bytecode = await withRpcBackoff("verify_vault_contract", config, logger, () =>
      publicClient.getCode({ address: config.vaultAddress }),
    );
    if (!bytecode || bytecode === "0x") {
      throw new ConfigurationMismatchError(
        `No contract bytecode found at ${config.vaultAddress}`,
      );
    }
    const collectorBytecode = await withRpcBackoff(
      "verify_fee_collector_contract",
      config,
      logger,
      () => publicClient.getCode({ address: config.feeCollectorAddress }),
    );
    if (!collectorBytecode || collectorBytecode === "0x") {
      throw new ConfigurationMismatchError(
        `No contract bytecode found at ${config.feeCollectorAddress}`,
      );
    }

    const startupNonce =
      !config.dryRun && config.executionMode === "automatic"
        ? await reconcileSignerNonce({
            publicClient,
            config,
            logger,
            keeperAddress,
            phase: "startup",
          })
        : undefined;

    await logger.write("info", "keeper_started", {
      chainId: config.chainId,
      vault: config.vaultAddress,
      feeCollector: config.feeCollectorAddress,
      keeper: keeperAddress,
      dryRun: config.dryRun,
      runOnce: config.runOnce,
      executionMode: config.executionMode,
      startupNonce,
      manualExpectedNonce: config.manualExpectedNonce,
      manualReason: config.manualReason,
      pollIntervalMs: config.pollIntervalMs,
    });

    do {
      try {
        await runCycle({
          config,
          publicClient,
          walletClient,
          signerAccount,
          keeperAddress,
          logger,
          manualNonce: config.manualExpectedNonce,
          shutdownSignal: shutdownController.signal,
        });
      } catch (error) {
        if (error instanceof KeeperHaltError) throw error;
        await logger.write("error", "cycle_failed_safely", {
          retryTransaction: false,
          ...describeError(error),
        });
        if (config.runOnce) throw error;
      }

      if (config.runOnce || stopping) break;
      try {
        await sleep(config.pollIntervalMs, undefined, { signal: shutdownController.signal });
      } catch (error) {
        if ((error as Error).name !== "AbortError") throw error;
      }
    } while (!stopping);
  } finally {
    await lock.release();
    await logger.write("info", "keeper_stopped");
  }
}

await main().catch((error) => {
  const message = JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    event: "keeper_fatal_error",
    ...describeError(error),
  });
  console.error(message);
  process.exitCode = 1;
});

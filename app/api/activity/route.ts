import {
  parseActivityCursor,
  readActivityPage,
  readCollectorProofStatus,
} from "@/lib/onchain/activity";
import {
  BUYBACK_VAULT_SELECTORS,
  ZERO_ADDRESS,
} from "@/lib/onchain/buyback-vault";
import { configuredBuybackStartBlock } from "@/lib/onchain/buybacks";
import {
  configuredExpectedChainId,
  configuredExpectedTokenAddress,
  configuredVaultAddress,
  decodeUint,
  readAddress,
  readTokenMetadata,
  rpc,
} from "@/lib/onchain/rpc";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;
const RESPONSE_HEADERS = {
  "cache-control": "public, s-maxage=15, stale-while-revalidate=45",
};

function readLimit(value: string | null): number | null {
  if (value === null || value === "") return DEFAULT_LIMIT;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= MAX_LIMIT
    ? parsed
    : null;
}

function unconfiguredResponse(error?: string) {
  return Response.json(
    {
      configured: false,
      collectorConfigured: false,
      collectorStatus: "unavailable",
      proofComplete: false,
      incompleteReason: error || "ONCHAIN RECEIPTS INCOMPLETE: THE VAULT IS NOT AVAILABLE.",
      items: [],
      nextCursor: null,
      updatedAt: new Date().toISOString(),
      ...(error ? { error } : {}),
    },
    { headers: RESPONSE_HEADERS },
  );
}

export async function GET(request: Request) {
  const vault = configuredVaultAddress();
  if (!vault.address) return unconfiguredResponse(vault.error ?? undefined);
  if (vault.address === ZERO_ADDRESS) {
    return unconfiguredResponse("BUYBACK_VAULT_ADDRESS cannot be the zero address.");
  }
  const expectedToken = configuredExpectedTokenAddress();
  if (!expectedToken.address) {
    return unconfiguredResponse(expectedToken.error ?? undefined);
  }
  const expectedChain = configuredExpectedChainId();
  if (expectedChain.chainId === null) {
    return unconfiguredResponse(expectedChain.error ?? undefined);
  }

  const url = new URL(request.url);
  const limit = readLimit(url.searchParams.get("limit"));
  if (limit === null) {
    return Response.json(
      { error: `limit must be an integer from 1 through ${MAX_LIMIT}` },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }
  let cursor;
  try {
    cursor = parseActivityCursor(url.searchParams.get("cursor"));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid cursor" },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  try {
    const startBlock = decodeUint(configuredBuybackStartBlock());
    const [chainIdHex, zazuToken, feeToken] = await Promise.all([
      rpc<string>("eth_chainId", []),
      readAddress(vault.address, BUYBACK_VAULT_SELECTORS.zazuToken),
      readAddress(vault.address, BUYBACK_VAULT_SELECTORS.feeToken),
    ]);
    const chainId = decodeUint(chainIdHex);
    if (chainId !== expectedChain.chainId) {
      throw new Error(
        `RPC chain ID ${chainId} does not match configured CHAIN_ID ${expectedChain.chainId}.`,
      );
    }
    if (zazuToken !== expectedToken.address) {
      throw new Error("Vault ZAZU token does not match configured ZAZU_TOKEN_ADDRESS.");
    }
    if (feeToken === ZERO_ADDRESS) {
      throw new Error("The pons v1 activity feed expects the vault fee asset to be WETH.");
    }

    const [inputMetadata, tokenMetadata] = await Promise.all([
      readTokenMetadata(feeToken),
      readTokenMetadata(zazuToken),
    ]);
    const collectorProof = await readCollectorProofStatus({
      expectedZazuToken: zazuToken,
      expectedBuybackVault: vault.address,
    });
    const activity = await readActivityPage({
      vaultAddress: vault.address,
      feeCollectorAddress: collectorProof.ready ? collectorProof.address : null,
      startBlock,
      cursor,
      limit,
      inputSymbol: inputMetadata.symbol,
      inputDecimals: inputMetadata.decimals,
      tokenSymbol: tokenMetadata.symbol,
      tokenDecimals: tokenMetadata.decimals,
    });

    return Response.json(
      {
        configured: true,
        collectorConfigured: collectorProof.ready,
        collectorStatus: collectorProof.state,
        collectorAddress: collectorProof.address,
        proofComplete: collectorProof.ready,
        incompleteReason: collectorProof.error,
        vaultAddress: vault.address,
        tokenAddress: zazuToken,
        ...activity,
        updatedAt: new Date().toISOString(),
      },
      { headers: RESPONSE_HEADERS },
    );
  } catch (error) {
    return Response.json(
      {
        configured: true,
        collectorConfigured: false,
        collectorStatus: "unavailable",
        proofComplete: false,
        incompleteReason: "ONCHAIN RECEIPTS INCOMPLETE: THE ACTIVITY FEED COULD NOT BE VERIFIED.",
        items: [],
        nextCursor: null,
        error: error instanceof Error
          ? error.message
          : "Unable to read on-chain activity.",
        updatedAt: new Date().toISOString(),
      },
      { status: 502, headers: RESPONSE_HEADERS },
    );
  }
}

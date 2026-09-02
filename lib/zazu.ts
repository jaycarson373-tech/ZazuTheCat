const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const zeroAddress = "0x0000000000000000000000000000000000000000";

function safeAddress(value: string | undefined) {
  const candidate = value?.trim() ?? "";
  return addressPattern.test(candidate) && candidate.toLowerCase() !== zeroAddress
    ? candidate
    : "";
}

function safeUrl(value: string | undefined) {
  const candidate = value?.trim() ?? "";
  if (!candidate) return "";

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

const tokenAddress = safeAddress(process.env.NEXT_PUBLIC_ZAZU_ADDRESS);
const nftContractAddress = safeAddress(process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS);
const vaultAddress = safeAddress(
  process.env.NEXT_PUBLIC_BUYBACK_VAULT_ADDRESS ||
    process.env.NEXT_PUBLIC_BURN_EXECUTOR_ADDRESS,
);
const explorerBase =
  safeUrl(process.env.NEXT_PUBLIC_EXPLORER_URL) ||
  "https://robinhoodchain.blockscout.com/";
const configuredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 4663);
const chainId = Number.isSafeInteger(configuredChainId) && configuredChainId > 0
  ? configuredChainId
  : 4663;

export const ZAZU = {
  tokenAddress,
  vaultAddress,
  chainId,
  nftSupply: 1212,
  nftMintPriceEth: "0.003",
  nftMaxPerTransaction: 12,
  nftContractAddress,
  nftRpcUrl:
    safeUrl(process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL) ||
    "https://rpc.mainnet.chain.robinhood.com/",
  xUrl: safeUrl(process.env.NEXT_PUBLIC_X_URL),
  instagramUrl: "https://www.instagram.com/zazubabyman/",
  tiktokUrl: "https://www.tiktok.com/@zazubabyman_",
  linktreeUrl: "https://linktr.ee/zazu_cat",
  ponsUrl:
    safeUrl(process.env.NEXT_PUBLIC_PONS_URL) ||
    "https://pons.family/launchpad",
  dexUrl: safeUrl(process.env.NEXT_PUBLIC_DEX_URL),
  explorerBase,
  tokenExplorerUrl: tokenAddress
    ? new URL(`/token/${tokenAddress}`, explorerBase).toString()
    : explorerBase,
  vaultExplorerUrl: vaultAddress
    ? new URL(`/address/${vaultAddress}`, explorerBase).toString()
    : explorerBase,
  nftContractExplorerUrl: nftContractAddress
    ? new URL(`/address/${nftContractAddress}`, explorerBase).toString()
    : explorerBase,
};

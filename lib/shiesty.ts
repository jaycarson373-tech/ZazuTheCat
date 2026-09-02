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

const tokenAddress = safeAddress(process.env.NEXT_PUBLIC_SHIESTY_ADDRESS);
const explorerBase =
  safeUrl(process.env.NEXT_PUBLIC_EXPLORER_URL) ||
  "https://robinhoodchain.blockscout.com/";
const configuredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 4663);
const chainId = Number.isSafeInteger(configuredChainId) && configuredChainId > 0
  ? configuredChainId
  : 4663;

export const SHIESTY = {
  tokenAddress,
  chainId,
  xUrl: safeUrl(process.env.NEXT_PUBLIC_X_URL),
  ponsUrl:
    safeUrl(process.env.NEXT_PUBLIC_PONS_URL) ||
    "https://pons.family/launchpad",
  dexUrl: safeUrl(process.env.NEXT_PUBLIC_DEX_URL),
  explorerBase,
  tokenExplorerUrl: tokenAddress
    ? new URL(`/token/${tokenAddress}`, explorerBase).toString()
    : explorerBase,
};

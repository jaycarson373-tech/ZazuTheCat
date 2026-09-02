"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  decodeFunctionResult,
  encodeFunctionData,
  parseAbi,
  parseEther,
  toHex,
  type Address,
  type Hex,
} from "viem";

const mintAbi = parseAbi([
  "function mint(uint256 quantity) payable",
  "function totalMinted() view returns (uint256)",
  "function saleActive() view returns (bool)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function MINT_PRICE() view returns (uint256)",
  "function maxPerTransaction() view returns (uint256)",
  "function maxPerWallet() view returns (uint256)",
  "function mintedByWallet(address minter) view returns (uint256)",
]);

type EthereumRequest = {
  method: string;
  params?: readonly unknown[] | object;
};

type EthereumProvider = {
  request: (request: EthereumRequest) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type MintStatus = "idle" | "connecting" | "submitting" | "confirming" | "success" | "error";

function compactAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: number; message?: string; shortMessage?: string };
    if (candidate.code === 4001) return "Transaction cancelled in your wallet.";
    if (candidate.shortMessage) return candidate.shortMessage;
    if (candidate.message) {
      const clean = candidate.message.split("\n")[0];
      return clean.length > 150 ? `${clean.slice(0, 147)}...` : clean;
    }
  }
  return "The transaction could not be completed. Check your wallet and try again.";
}

async function rpcBatch<T>(
  rpcUrl: string,
  calls: Array<{ method: string; params: unknown[] }>,
): Promise<T[]> {
  const requests = calls.map((call, index) => ({
    jsonrpc: "2.0",
    id: index + 1,
    method: call.method,
    params: call.params,
  }));
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requests),
  });
  if (!response.ok) throw new Error(`RPC request failed with status ${response.status}`);

  const payload = (await response.json()) as Array<{
    id: number;
    result?: T;
    error?: { message?: string };
  }>;
  if (!Array.isArray(payload)) throw new Error("RPC did not return a batch response");

  const responses = new Map(payload.map((item) => [item.id, item]));
  return requests.map((request) => {
    const item = responses.get(request.id);
    if (item?.error) throw new Error(item.error.message || "RPC request failed");
    if (item?.result === undefined) throw new Error("RPC response did not include a result");
    return item.result;
  });
}

async function waitForReceipt(provider: EthereumProvider, txHash: Hex) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { status?: Hex } | null;
    if (receipt) return receipt;
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
  }
  throw new Error("The transaction is still pending. Use the explorer link to follow it.");
}

export function NftMintSection({
  contractAddress,
  explorerBase,
  mintPriceEth,
  rpcUrl,
  supply,
  maxPerTransaction,
}: {
  contractAddress: string;
  explorerBase: string;
  mintPriceEth: string;
  rpcUrl: string;
  supply: number;
  maxPerTransaction: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const [minted, setMinted] = useState<number | null>(null);
  const [saleActive, setSaleActive] = useState<boolean | null>(null);
  const [contractValidated, setContractValidated] = useState<boolean | null>(null);
  const [transactionLimit, setTransactionLimit] = useState(maxPerTransaction);
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState<MintStatus>("idle");
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState("");

  const isConfigured = /^0x[a-fA-F0-9]{40}$/.test(contractAddress);
  const sold = minted ?? 0;
  const remaining = Math.max(supply - sold, 0);
  const soldPercent = Math.min((sold / supply) * 100, 100);
  const totalPrice = useMemo(
    () => (Number(mintPriceEth) * quantity).toFixed(3),
    [mintPriceEth, quantity],
  );
  const mintPriceWei = useMemo(() => parseEther(mintPriceEth), [mintPriceEth]);
  const explorer = explorerBase.replace(/\/$/, "");

  const refreshCollection = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const [
        code,
        mintedResult,
        activeResult,
        supplyResult,
        priceResult,
        transactionLimitResult,
        walletLimitResult,
      ] = await rpcBatch<Hex>(rpcUrl, [
        { method: "eth_getCode", params: [contractAddress, "latest"] },
        {
          method: "eth_call",
          params: [{
            to: contractAddress,
            data: encodeFunctionData({ abi: mintAbi, functionName: "totalMinted" }),
          }, "latest"],
        },
        {
          method: "eth_call",
          params: [{
            to: contractAddress,
            data: encodeFunctionData({ abi: mintAbi, functionName: "saleActive" }),
          }, "latest"],
        },
        {
          method: "eth_call",
          params: [{
            to: contractAddress,
            data: encodeFunctionData({ abi: mintAbi, functionName: "MAX_SUPPLY" }),
          }, "latest"],
        },
        {
          method: "eth_call",
          params: [{
            to: contractAddress,
            data: encodeFunctionData({ abi: mintAbi, functionName: "MINT_PRICE" }),
          }, "latest"],
        },
        {
          method: "eth_call",
          params: [{
            to: contractAddress,
            data: encodeFunctionData({ abi: mintAbi, functionName: "maxPerTransaction" }),
          }, "latest"],
        },
        {
          method: "eth_call",
          params: [{
            to: contractAddress,
            data: encodeFunctionData({ abi: mintAbi, functionName: "maxPerWallet" }),
          }, "latest"],
        },
      ]);
      if (code === "0x") throw new Error("Mint address has no contract code");
      const total = decodeFunctionResult({
        abi: mintAbi,
        functionName: "totalMinted",
        data: mintedResult,
      });
      const active = decodeFunctionResult({
        abi: mintAbi,
        functionName: "saleActive",
        data: activeResult,
      });
      const onchainSupply = decodeFunctionResult({
        abi: mintAbi,
        functionName: "MAX_SUPPLY",
        data: supplyResult,
      });
      const onchainPrice = decodeFunctionResult({
        abi: mintAbi,
        functionName: "MINT_PRICE",
        data: priceResult,
      });
      const onchainTransactionLimit = decodeFunctionResult({
        abi: mintAbi,
        functionName: "maxPerTransaction",
        data: transactionLimitResult,
      });
      const onchainWalletLimit = decodeFunctionResult({
        abi: mintAbi,
        functionName: "maxPerWallet",
        data: walletLimitResult,
      });
      if (
        onchainSupply !== BigInt(supply) || onchainPrice !== mintPriceWei
          || total > onchainSupply || onchainTransactionLimit === 0n
          || onchainTransactionLimit > onchainWalletLimit || onchainWalletLimit > onchainSupply
      ) throw new Error("Mint contract settings do not match the site");
      setMinted(Number(total));
      setSaleActive(active);
      setTransactionLimit(Number(onchainTransactionLimit));
      setQuantity((value) => Math.min(value, Number(onchainTransactionLimit)));
      setContractValidated(true);
    } catch {
      setMinted(null);
      setSaleActive(null);
      setContractValidated(false);
    }
  }, [contractAddress, isConfigured, mintPriceWei, rpcUrl, supply]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refreshCollection(), 0);
    const refreshInterval = window.setInterval(() => void refreshCollection(), 15_000);
    if (window.ethereum) {
      void window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
        const first = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
        setAccount(first);
      }).catch(() => setAccount(""));
    }
    return () => {
      window.clearTimeout(refreshTimer);
      window.clearInterval(refreshInterval);
    };
  }, [refreshCollection]);

  async function connectAndSwitchNetwork() {
    const provider = window.ethereum;
    if (!provider) throw new Error("Install an EVM wallet such as MetaMask to mint.");

    setStatus("connecting");
    setMessage("Connecting wallet...");
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const connected = accounts[0];
    if (!connected || !/^0x[a-fA-F0-9]{40}$/.test(connected)) {
      throw new Error("No valid wallet account was returned.");
    }

    const expectedChain = toHex(4_663);
    const currentChain = (await provider.request({ method: "eth_chainId" })) as string;
    if (currentChain.toLowerCase() !== expectedChain.toLowerCase()) {
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: expectedChain }],
        });
      } catch (switchError) {
        const code = (switchError as { code?: number }).code;
        if (code !== 4902) throw switchError;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: expectedChain,
              chainName: "Robinhood Chain",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: [rpcUrl],
              blockExplorerUrls: [explorer],
            },
          ],
        });
      }
    }

    const confirmedChain = (await provider.request({ method: "eth_chainId" })) as string;
    if (confirmedChain.toLowerCase() !== expectedChain.toLowerCase()) {
      throw new Error("Wallet is not connected to Robinhood Chain.");
    }

    setAccount(connected);
    return { provider, connected };
  }

  async function mint() {
    if (!isConfigured) return;
    setMessage("");
    setTxHash("");

    try {
      const { provider, connected } = await connectAndSwitchNetwork();

      const [
        code,
        mintedResult,
        activeResult,
        supplyResult,
        priceResult,
        transactionLimitResult,
        walletLimitResult,
        walletMintedResult,
      ] = await Promise.all([
        provider.request({ method: "eth_getCode", params: [contractAddress, "latest"] }) as Promise<Hex>,
        provider.request({
          method: "eth_call",
          params: [{ to: contractAddress, data: encodeFunctionData({ abi: mintAbi, functionName: "totalMinted" }) }, "latest"],
        }) as Promise<Hex>,
        provider.request({
          method: "eth_call",
          params: [{ to: contractAddress, data: encodeFunctionData({ abi: mintAbi, functionName: "saleActive" }) }, "latest"],
        }) as Promise<Hex>,
        provider.request({
          method: "eth_call",
          params: [{ to: contractAddress, data: encodeFunctionData({ abi: mintAbi, functionName: "MAX_SUPPLY" }) }, "latest"],
        }) as Promise<Hex>,
        provider.request({
          method: "eth_call",
          params: [{ to: contractAddress, data: encodeFunctionData({ abi: mintAbi, functionName: "MINT_PRICE" }) }, "latest"],
        }) as Promise<Hex>,
        provider.request({
          method: "eth_call",
          params: [{ to: contractAddress, data: encodeFunctionData({ abi: mintAbi, functionName: "maxPerTransaction" }) }, "latest"],
        }) as Promise<Hex>,
        provider.request({
          method: "eth_call",
          params: [{ to: contractAddress, data: encodeFunctionData({ abi: mintAbi, functionName: "maxPerWallet" }) }, "latest"],
        }) as Promise<Hex>,
        provider.request({
          method: "eth_call",
          params: [{
            to: contractAddress,
            data: encodeFunctionData({
              abi: mintAbi,
              functionName: "mintedByWallet",
              args: [connected as Address],
            }),
          }, "latest"],
        }) as Promise<Hex>,
      ]);
      if (code === "0x") throw new Error("The configured mint address has no contract code.");
      const liveMinted = decodeFunctionResult({ abi: mintAbi, functionName: "totalMinted", data: mintedResult });
      const liveSaleActive = decodeFunctionResult({ abi: mintAbi, functionName: "saleActive", data: activeResult });
      const liveSupply = decodeFunctionResult({ abi: mintAbi, functionName: "MAX_SUPPLY", data: supplyResult });
      const livePrice = decodeFunctionResult({ abi: mintAbi, functionName: "MINT_PRICE", data: priceResult });
      const liveTransactionLimit = decodeFunctionResult({ abi: mintAbi, functionName: "maxPerTransaction", data: transactionLimitResult });
      const liveWalletLimit = decodeFunctionResult({ abi: mintAbi, functionName: "maxPerWallet", data: walletLimitResult });
      const liveWalletMinted = decodeFunctionResult({ abi: mintAbi, functionName: "mintedByWallet", data: walletMintedResult });
      if (liveSupply !== BigInt(supply) || livePrice !== mintPriceWei) {
        throw new Error("Mint contract settings do not match the verified Zazu collection.");
      }
      if (!liveSaleActive) throw new Error("The mint is currently closed.");
      if (liveMinted + BigInt(quantity) > liveSupply) throw new Error("Not enough Zazus remain for this mint.");
      if (BigInt(quantity) > liveTransactionLimit) throw new Error(`Maximum ${liveTransactionLimit.toString()} Zazus per transaction.`);
      if (liveWalletMinted + BigInt(quantity) > liveWalletLimit) throw new Error(`This wallet has reached its ${liveWalletLimit.toString()} Zazu mint limit.`);

      setStatus("submitting");
      setMessage("Confirm the mint in your wallet.");
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: connected,
            to: contractAddress,
            data: encodeFunctionData({
              abi: mintAbi,
              functionName: "mint",
              args: [BigInt(quantity)],
            }),
            value: toHex(mintPriceWei * BigInt(quantity)),
          },
        ],
      })) as Hex;

      setTxHash(hash);
      setStatus("confirming");
      setMessage("Mint submitted. Waiting for confirmation...");
      const receipt = await waitForReceipt(provider, hash);
      if (receipt.status !== "0x1") throw new Error("The mint transaction reverted.");

      setStatus("success");
      setMessage(`${quantity} Zazu${quantity === 1 ? "" : "s"} minted. Welcome to the archive.`);
      await refreshCollection();
    } catch (error) {
      setStatus("error");
      setMessage(errorMessage(error));
    }
  }

  const buttonDisabled =
    !isConfigured || contractValidated !== true || status === "connecting" || status === "submitting"
    || status === "confirming" || saleActive !== true || remaining === 0;

  const buttonLabel = contractValidated === null
    ? "CHECKING MINT..."
      : contractValidated === false
        ? "MINT STATUS UNAVAILABLE"
        : remaining === 0
          ? "SOLD OUT"
          : saleActive === false
            ? "MINT CLOSED"
            : status === "connecting"
              ? "CONNECTING..."
              : status === "submitting"
                ? "CHECK WALLET..."
                : status === "confirming"
                  ? "CONFIRMING..."
                  : `MINT ${quantity} ZAZU${quantity === 1 ? "" : "S"}`;

  return (
    <section className="mint-section" id="mint" data-reveal>
      <div className="section-shell">
        <div className="section-kicker"><span>01</span><p>THE ZAZU 1212</p></div>

        <div className="mint-layout">
          <div className="mint-window">
            <div className="window-title">
              <span>ZAZU_COLLECTION_PREVIEW.PNG</span>
              <span>_ □ ×</span>
            </div>
            <div className="mint-contact-sheet">
              <Image
                src="/zazu-40-grid.png"
                alt="A preview sheet of Zazu collection artwork"
                width={1586}
                height={992}
                loading="lazy"
                sizes="(max-width: 820px) 94vw, 56vw"
              />
              <span className="mint-preview-label">40 ARCHIVE PREVIEWS</span>
            </div>
          </div>

          <div className="mint-panel">
            <p className="eyebrow"><i /> FIXED SUPPLY. ONCHAIN MINT.</p>
            <h2>{supply.toLocaleString("en-US")} ZAZUS.<br />ONE ARCHIVE.</h2>
            <p className="mint-copy">
              A fixed collection of {supply.toLocaleString("en-US")} Zazu Cat collectibles on Robinhood Chain. Mint directly from your wallet at {mintPriceEth} ETH each.
            </p>

            <div className="mint-facts" aria-label="Collection facts">
              <div><span>SUPPLY</span><strong>{supply.toLocaleString("en-US")}</strong></div>
              <div><span>PRICE</span><strong>{mintPriceEth} ETH</strong></div>
              <div><span>CHAIN</span><strong>ROBINHOOD</strong></div>
            </div>

            {isConfigured ? (
              <>
                <div className="mint-progress" aria-label={minted === null ? "Live mint total loading" : `${sold.toLocaleString("en-US")} of ${supply.toLocaleString("en-US")} minted`}>
                  <div><span>MINTED</span><strong>{minted === null ? "..." : sold.toLocaleString("en-US")} / {supply.toLocaleString("en-US")}</strong></div>
                  <div className="mint-progress-track"><span style={{ width: `${soldPercent}%` }} /></div>
                  <small>{minted === null ? (contractValidated === false ? "LIVE TOTAL UNAVAILABLE" : "LIVE TOTAL LOADING") : `${remaining.toLocaleString("en-US")} REMAINING`}</small>
                </div>

                <div className="mint-controls">
                  <div className="mint-quantity" aria-label="Mint quantity">
                    <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1}>−</button>
                    <strong>{quantity}</strong>
                    <button type="button" onClick={() => setQuantity((value) => Math.min(transactionLimit, remaining || transactionLimit, value + 1))} disabled={quantity >= transactionLimit || quantity >= remaining}>+</button>
                  </div>
                  <div className="mint-total"><span>TOTAL</span><strong>{totalPrice} ETH</strong></div>
                </div>

                <button className="mint-submit" type="button" onClick={() => void mint()} disabled={buttonDisabled}>
                  {buttonLabel}
                </button>

                <div className={`mint-message mint-message-${status}`} aria-live="polite">
                  {account ? <span>WALLET {compactAddress(account)}</span> : null}
                  {message ? <p>{message}</p> : null}
                  {txHash ? <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer">VIEW TRANSACTION ↗</a> : null}
                  {!txHash && contractValidated ? <a href={`${explorer}/address/${contractAddress}`} target="_blank" rel="noreferrer">VERIFY CONTRACT ↗</a> : null}
                </div>
              </>
            ) : (
              <a className="mint-submit" href="#elements">EXPLORE THE ZAZU FILES ↓</a>
            )}
          </div>
        </div>

        <div className="mint-edition-strip" aria-hidden="true">
          <span>001</span><span>303</span><span>606</span><span>909</span><span>1212</span>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LatestRequestGuard } from "@/lib/latest-request";

type StatsResponse = {
  configured?: boolean;
  error?: string;
  vaultAddress?: string | null;
  vaultExplorerUrl?: string | null;
  totalInputSpentFormatted?: string | null;
  totalZazuBoughtFormatted?: string | null;
  totalZazuBurnedFormatted?: string | null;
  totalExecutions?: number | string | null;
  destination?: string | null;
  treasury?: { symbol?: string } | null;
};

type ActivityKind =
  | "claim_flush"
  | "fee_flush"
  | "fees_forwarded"
  | "direct_burn"
  | "buyback"
  | "buyback_burn";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  timestamp: string | null;
  transactionHash: string;
  explorerUrl: string;
  inputSymbol: string | null;
  amountInFormatted: string | null;
  wrappedNativeAmountFormatted: string | null;
  zazuAmountFormatted: string | null;
  tokenSymbol: string;
  destination: string | null;
  executionId: string | null;
};

type ActivityResponse = {
  configured?: boolean;
  collectorConfigured?: boolean;
  collectorStatus?: string;
  proofComplete?: boolean;
  incompleteReason?: string | null;
  items?: ActivityItem[];
  nextCursor?: string | null;
  error?: string;
};

const ZERO_STATS: StatsResponse = {
  configured: false,
  totalInputSpentFormatted: "0",
  totalZazuBoughtFormatted: "0",
  totalZazuBurnedFormatted: "0",
  totalExecutions: 0,
  treasury: { symbol: "WETH" },
};

function formatDecimal(value: string | null | undefined, digits = 2) {
  const candidate = String(value ?? "0").trim();
  if (!/^\d+(?:\.\d+)?$/.test(candidate)) return "0";
  const [integer = "0", decimal = ""] = candidate.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = decimal.slice(0, digits).replace(/0+$/, "");
  return `${grouped}${fraction ? `.${fraction}` : ""}`;
}

function shortHex(value: string | null | undefined) {
  if (!value || !/^0x[0-9a-fA-F]{40,64}$/.test(value)) return "ONCHAIN";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatDate(timestamp: string | null | undefined) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return "BLOCK CONFIRMED";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(seconds * 1000));
}

function kindLabel(kind: ActivityKind) {
  if (kind === "claim_flush") return "CLAIM + FLUSH";
  if (kind === "fee_flush") return "FEE FLUSH";
  if (kind === "direct_burn") return "DIRECT TOKEN BURN";
  if (kind === "buyback_burn") return "MARKET BUY + BURN";
  if (kind === "buyback") return "MARKET BUY";
  return "FEES FORWARDED";
}

function flowLabel(item: ActivityItem) {
  if (item.kind === "claim_flush" || item.kind === "fee_flush" || item.kind === "fees_forwarded") {
    return `${formatDecimal(item.wrappedNativeAmountFormatted, 6)} WETH TO VAULT`;
  }
  if (item.kind === "direct_burn") return "TOKEN-SIDE FEES";
  return `${formatDecimal(item.amountInFormatted, 6)} ${item.inputSymbol || "WETH"} SPENT`;
}

function outputLabel(item: ActivityItem) {
  const amount = formatDecimal(item.zazuAmountFormatted, 2);
  if (item.kind === "claim_flush" || item.kind === "fee_flush" || item.kind === "fees_forwarded") {
    return `${amount} ${item.tokenSymbol} FORWARDED`;
  }
  return item.kind === "buyback"
    ? `${amount} ${item.tokenSymbol} SENT`
    : `${amount} ${item.tokenSymbol} BURNED`;
}

export function OnchainActivity({ siteConfigured }: { siteConfigured: boolean }) {
  const [stats, setStats] = useState<StatsResponse>(ZERO_STATS);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(siteConfigured);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [collectorProof, setCollectorProof] = useState({
    checked: !siteConfigured,
    vaultConfigured: false,
    complete: false,
    status: "checking",
    reason: "",
  });
  const latestRequest = useRef<LatestRequestGuard | null>(null);
  const olderRequest = useRef<AbortController | null>(null);
  if (latestRequest.current === null) latestRequest.current = new LatestRequestGuard();

  const loadLatest = useCallback(async () => {
    olderRequest.current?.abort();
    olderRequest.current = null;
    setLoadingOlder(false);
    const guard = latestRequest.current!;
    const request = guard.begin();
    try {
      const [statsResponse, activityResponse] = await Promise.all([
        fetch("/api/stats", { signal: request.signal }),
        fetch("/api/activity?limit=12", { signal: request.signal }),
      ]);
      const nextStats = (await statsResponse.json()) as StatsResponse;
      const activity = (await activityResponse.json()) as ActivityResponse;
      if (!guard.isCurrent(request.sequence)) return;
      if (statsResponse.ok) setStats(nextStats);
      if (activityResponse.ok) {
        // Replace the scanned window on every refresh. Append-only merging can
        // preserve an event that disappeared after a chain reorganization.
        setItems(activity.items ?? []);
        setNextCursor(activity.nextCursor ?? null);
      }
      setCollectorProof({
        checked: true,
        vaultConfigured: activity.configured === true,
        complete: activity.proofComplete === true,
        status: activity.collectorStatus || "unavailable",
        reason:
          activity.incompleteReason ||
          (activity.proofComplete
            ? ""
            : "CLAIM RECEIPTS INCOMPLETE: THE COLLECTOR SOURCE IS NOT VERIFIED."),
      });
      const message =
        (nextStats.configured ? nextStats.error : "") ||
        (activity.configured ? activity.error : "") ||
        "";
      setError(message);
    } catch (caught) {
      if (!guard.isCurrent(request.sequence)) return;
      if ((caught as { name?: string }).name === "AbortError") return;
      setError("CHAIN READ TEMPORARILY UNAVAILABLE. LAST VERIFIED VALUES RETAINED.");
    } finally {
      if (guard.isCurrent(request.sequence)) setLoading(false);
    }
  }, []);

  const loadOlder = useCallback(async () => {
    if (typeof nextCursor !== "string" || loadingOlder) return;
    olderRequest.current?.abort();
    const controller = new AbortController();
    olderRequest.current = controller;
    setLoadingOlder(true);
    try {
      const response = await fetch(
        `/api/activity?limit=12&cursor=${encodeURIComponent(nextCursor)}`,
        { signal: controller.signal },
      );
      const activity = (await response.json()) as ActivityResponse;
      if (olderRequest.current !== controller) return;
      if (!response.ok) throw new Error(activity.error || "Unable to read activity");
      setItems((current) => {
        const merged = [...current, ...(activity.items ?? [])];
        return [...new Map(merged.map((item) => [item.id, item])).values()];
      });
      setNextCursor(activity.nextCursor ?? null);
    } catch (caught) {
      if (olderRequest.current !== controller) return;
      if ((caught as { name?: string }).name === "AbortError") return;
      setError("OLDER ACTIVITY IS TEMPORARILY UNAVAILABLE.");
    } finally {
      if (olderRequest.current === controller) {
        olderRequest.current = null;
        setLoadingOlder(false);
      }
    }
  }, [loadingOlder, nextCursor]);

  useEffect(() => {
    if (!siteConfigured) return;
    const initial = window.setTimeout(() => void loadLatest(), 0);
    const poll = window.setInterval(loadLatest, 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(poll);
      latestRequest.current?.stop();
      olderRequest.current?.abort();
    };
  }, [loadLatest, siteConfigured]);

  const status = useMemo(() => {
    if (loading) return "SYNCING CHAIN";
    if (error) return "LAST VERIFIED STATE";
    if (!collectorProof.vaultConfigured) return "ONCHAIN RECEIPTS";
    if (collectorProof.checked && !collectorProof.complete) return "PARTIAL ONCHAIN FEED";
    return collectorProof.complete ? "VERIFIED V1 FEED" : "VERIFYING V1 FEED";
  }, [collectorProof.checked, collectorProof.complete, collectorProof.vaultConfigured, error, loading]);
  const asset = stats.treasury?.symbol || "WETH";
  const latest = items[0];

  return (
    <div className="burn-terminal">
      <div className="terminal-bar">
        <span className={error ? "terminal-waiting" : collectorProof.complete ? "terminal-live" : ""}>
          <i /> {status}
        </span>
        <span>SAFE BLOCK EVENTS + CALLDATA</span>
        <span>AUTO REFRESH: 30 SEC</span>
      </div>

      <div className="terminal-grid">
        <article className="metric metric-green">
          <span>TOTAL ZAZU BURNED</span>
          <strong>{formatDecimal(stats.totalZazuBurnedFormatted)}</strong>
          <small>Vault burn accounting total.</small>
        </article>
        <article className="metric metric-gray">
          <span>TOTAL ZAZU BOUGHT</span>
          <strong>{formatDecimal(stats.totalZazuBoughtFormatted)}</strong>
          <small>Vault market purchase total.</small>
        </article>
        <article className="metric metric-blue">
          <span>FEES DEPLOYED</span>
          <strong>{formatDecimal(stats.totalInputSpentFormatted, 6)}</strong>
          <small>{asset} used for onchain buybacks.</small>
        </article>
        <article className="metric metric-red">
          <span>BUYBACKS</span>
          <strong>{formatDecimal(String(stats.totalExecutions ?? 0), 0)}</strong>
          <small>Vault execution counter.</small>
        </article>
      </div>

      <div className="terminal-detail-grid activity-source-grid">
        <div><span>CLAIM SOURCE</span><strong>{collectorProof.vaultConfigured ? (collectorProof.checked ? (collectorProof.complete ? "VERIFIED COLLECTOR" : "SOURCE INCOMPLETE") : "VERIFYING SOURCE") : "PONS FEE COLLECTOR"}</strong></div>
        <div><span>BURN SOURCE</span><strong>BUYBACK VAULT</strong></div>
        <div><span>LATEST EVENT</span><strong>{latest ? formatDate(latest.timestamp) : "NO EVENTS YET"}</strong></div>
        <div><span>DESTINATION</span><strong>{shortHex(stats.destination)}</strong></div>
      </div>

      {stats.vaultExplorerUrl ? (
        <div className="proof-row">
          <div><span>BUYBACK VAULT</span><code>{shortHex(stats.vaultAddress)}</code></div>
          <a href={stats.vaultExplorerUrl} target="_blank" rel="noreferrer">OPEN EXPLORER ↗</a>
        </div>
      ) : null}

      {error ? <p className="terminal-error">{error}</p> : null}
      {collectorProof.vaultConfigured && collectorProof.checked && !collectorProof.complete ? (
        <p className="terminal-incomplete" role="status">
          {collectorProof.reason} VAULT BUY AND BURN RECEIPTS REMAIN VISIBLE.
        </p>
      ) : null}

      <div className="history-head">
        <div>
          <span>{collectorProof.vaultConfigured ? (collectorProof.checked ? (collectorProof.complete ? "COMPLETE V1 TRAIL" : "V1 TRAIL INCOMPLETE") : "VERIFYING V1 TRAIL") : "ONCHAIN RECEIPTS"}</span><h3>ONCHAIN ACTIVITY</h3>
          <div className="activity-legend" aria-label="Activity types">
            <b className="activity-kind activity-kind-claim_flush">CLAIM + FLUSH</b>
            <b className="activity-kind activity-kind-direct_burn">DIRECT TOKEN BURN</b>
            <b className="activity-kind activity-kind-buyback_burn">MARKET BUY + BURN</b>
          </div>
        </div>
        <p>Claims, fee forwarding, direct token burns, and market buybacks are reconstructed from confirmed contract events.</p>
      </div>

      <div className="history-table" role="region" aria-label="Onchain activity" tabIndex={0}>
        <div className="history-row history-labels" aria-hidden="true">
          <span>STEP</span><span>TIME</span><span>VALUE FLOW</span><span>ZAZU FLOW</span><span>PROOF</span>
        </div>
        {items.length ? items.map((item) => (
          <div className="history-row" key={item.id}>
            <span><b className={`activity-kind activity-kind-${item.kind}`}>{kindLabel(item.kind)}</b></span>
            <span>{formatDate(item.timestamp)}</span>
            <span>{flowLabel(item)}</span>
            <span>{outputLabel(item)}</span>
            <span><a href={item.explorerUrl} target="_blank" rel="noreferrer" aria-label={`Open ${kindLabel(item.kind)} transaction`}>TX ↗</a></span>
          </div>
        )) : (
          <div className="history-empty">
            <strong>{loading ? "READING CONTRACT EVENTS" : "NO ACTIVITY RECORDED"}</strong>
            <span>Confirmed fee and burn events appear here automatically.</span>
          </div>
        )}
      </div>

      {typeof nextCursor === "string" ? (
        <button className="load-history" disabled={loadingOlder} onClick={() => void loadOlder()} type="button">
          {loadingOlder ? "READING CHAIN..." : "LOAD OLDER ACTIVITY"}
        </button>
      ) : null}

      {latest ? (
        <a className="latest-proof" href={latest.explorerUrl} target="_blank" rel="noreferrer">
          LATEST VERIFIED TX <code>{shortHex(latest.transactionHash)}</code> ↗
        </a>
      ) : null}
    </div>
  );
}

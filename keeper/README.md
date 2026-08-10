# ZAZU keeper

The keeper is a fail-closed TypeScript service. It checks the vault once per minute, but it waits for the vault's 15-minute window before attempting creator-fee collection. The collector independently enforces the same 15-minute claim interval onchain and accepts `claimAndFlush()` only from the vault's current keeper, so a later quote failure cannot cause tiny creator-fee claims on every poll. A buyback is submitted only after every treasury, quote, price-impact, gas, and simulation check passes. If the maximum permitted buy would exceed the price-impact ceiling, the keeper automatically quotes progressively smaller bounded amounts and executes the first safe size. The configured minimum buy is always the final candidate.

It does not contain a router address or private key. Production addresses are environment pins. If the vault configuration differs from those pins, the cycle stops safely.

## Run

Install `viem` as a runtime dependency and `tsx` as a development dependency. Copy `keeper/.env.example` to a secure path outside the repository, fill every required field, then start the service with Node 22 or newer:

```sh
node --env-file=/secure/path/zazu-keeper.env --import=tsx scripts/keeper.ts
```

Use `KEEPER_DRY_RUN=true` with `KEEPER_ADDRESS` and no private key to exercise reads, quoting, limits, and simulation without submitting a transaction. Use `npm run keeper:manual` for a live one-cycle execution; setting `KEEPER_RUN_ONCE=true` by itself cannot submit transactions. Live automatic startup requires the signer wallet's `latest` and `pending` nonces to match. The keeper repeats that reconciliation immediately before every claim or buyback and submits the reconciled nonce explicitly. A pending transaction therefore halts a restart instead of allowing another transaction to be queued behind it.

## Manual recovery

`npm run keeper:manual` is the guarded backup when the automatic Railway worker is unavailable. It always forces one cycle and defaults to dry-run mode. It uses the same configuration pins, adaptive sizing, quote expiry, price-impact limit, slippage floor, gas ceilings, simulation, receipt checks, and vault cooldown as automation.

The file lock is local to one container. It cannot coordinate an automatic Railway container with a separate manual job. Before a live manual run:

1. Scale the automatic worker to zero and wait for the old process to emit `keeper_stopped`.
2. Confirm no other replica, deployment, or manual job is running.
3. Reconcile every submitted transaction. The signer `latest` and `pending` nonces must match.
4. Record `/api/stats` and `/api/buybacks?page=1&pageSize=20` before the run.
5. Run the manual command once in dry-run mode with `KEEPER_ADDRESS` and no signing key available to that process.
6. Use a separate one-off job with restart policy set to Never for the live run.

Dry-run command:

```sh
KEEPER_DRY_RUN=true npm run keeper:manual
```

For a live run, set `KEEPER_DRY_RUN=false`, set `KEEPER_MANUAL_EXPECTED_NONCE` to the matching `latest` and `pending` signer nonce, and provide a chain-and-vault-bound acknowledgement plus an incident reason:

```sh
KEEPER_DRY_RUN=false \
KEEPER_MANUAL_ACK="AUTOMATION_STOPPED:4663:0xYourChecksummedVault" \
KEEPER_MANUAL_EXPECTED_NONCE=7 \
KEEPER_MANUAL_REASON="Automatic worker stopped; guarded operator recovery." \
npm run keeper:manual
```

The manual process rechecks `latest` and `pending` immediately before each write. If creator fees are forwarded first, the confirmed claim uses the expected nonce and the subsequent buyback must pass a second check at the next nonce. Any mismatch or pending transaction halts the run. A manual cycle can submit zero transactions, only `claimAndFlush`, only `executeBuyback`, or both. If a claim succeeds but a later buyback check skips, the collector blocks another claim until its next 15-minute window while the already-forwarded WETH remains available for a later poll.

After confirmation, the vault's `BuybackExecuted` event automatically updates `/api/stats`, `/api/buybacks`, and the website dashboard. This is independent of whether the authorized keeper was scheduled or manually invoked. The event does not label execution mode, so public copy must describe it as an authorized keeper execution, not claim it was necessarily automated. Direct token-side fee burns update `totalZazuBurned` but are not buyback-history rows because they emit `DirectZazuBurned`, not `BuybackExecuted`.

Do not resume automation until the manual job has emitted `keeper_stopped`, every transaction is confirmed, and `latest` equals `pending` again. Then scale the manual service back to zero and remove `KEEPER_MANUAL_ACK`, `KEEPER_MANUAL_EXPECTED_NONCE`, and `KEEPER_MANUAL_REASON` before restoring the automatic worker to one replica. Never retry a hashless or confirmation-uncertain submission until the signer nonce and transaction pool have been reconciled.

## Quote service contract

`KEEPER_QUOTE_API_URL` must be a trusted quote service for the separately verified DEX adapter and underlying Robinhood Chain DEX. The keeper sends an HTTP `POST` with:

```json
{
  "chainId": 0,
  "vault": "0x...",
  "router": "0x...",
  "wrappedNativeToken": "0x...",
  "inputToken": "0x...",
  "outputToken": "0x...",
  "recipient": "0x...",
  "amountIn": "1000000000000000000",
  "maximumSlippageBps": 100
}
```

The response must echo all request fields and provide:

```json
{
  "quoteId": "optional-provider-id",
  "chainId": 0,
  "router": "0x...",
  "wrappedNativeToken": "0x...",
  "inputToken": "0x...",
  "outputToken": "0x...",
  "recipient": "0x...",
  "amountIn": "1000000000000000000",
  "maximumSlippageBps": 100,
  "quotedOutput": "250000000000000000000",
  "priceImpactBps": 42,
  "routerData": "0x12345678...",
  "expiresAt": 1900000000
}
```

Amounts are unsigned base-unit strings. `expiresAt` is a Unix timestamp in seconds. The recipient must be the vault so the vault can measure the received ZAZU balance before forwarding it to the configured destination. For native fees, `inputToken` is the zero address.

The quote service should derive its quote from current onchain pool state and build route data for the verified `IDexAdapter` implementation. The keeper does not trust the response blindly. It verifies echoed addresses and amounts, checks expiry and price impact, derives `minimumZazuOut` from the vault slippage limit, simulates the complete vault call, and applies gas ceilings before submitting. The DEX adapter must separately validate route data and enforce the typed input, output, amount, minimum output, and recipient supplied by the vault.

## Concurrency and retries

The process holds an atomic file lock with a heartbeat. This prevents overlapping instances on a host or shared filesystem. Stale locks are never removed automatically because safe compare-and-delete is not available through the portable Node filesystem API. An operator must verify that no keeper is running before removing the exact stale lock file. Production orchestration should also run one replica or provide a shared persistent lock volume. The vault's onchain interval check remains the final concurrency backstop.

Read-only RPC operations use capped exponential backoff with jitter. A reverted simulation is never retried automatically. The submitted transaction carries the reconciled explicit nonce, checked buffered gas limit, and either explicit EIP-1559 fee caps or an explicit legacy gas price. If either the maximum gas units or maximum total fee cannot be bounded, the cycle is skipped. Transaction submission is attempted exactly once because an RPC timeout can leave submission status uncertain. A submission error or unresolved receipt halts the keeper and requires transaction-hash and signer-nonce reconciliation before restart. Run the automatic Railway service as one replica with GitHub autodeploy disabled and restart policy Never. Before any deployment or resume, stop the service, confirm no deployment is active, and verify `latest == pending`; never rely on a rolling restart.

After a confirmed `claimAndFlush`, the keeper requires exactly one nonzero collector `CreatorFeesForwarded` event. The confirmed event is authoritative because fees can accrue after pre-submit simulation. If ZAZU was forwarded, the keeper also requires one corresponding vault `DirectZazuBurned` event to the canonical burn destination covering at least the forwarded amount. A larger burn is valid when the vault already held dust or direct donations. Missing or insufficient receipt proof halts the worker before a buyback is attempted.

Confirmed executions are written as structured JSON to standard output and optionally to `KEEPER_LOG_FILE`. Each confirmation includes the transaction hash, amount spent, ZAZU received, effective price, destination, block, event ID, and gas data.

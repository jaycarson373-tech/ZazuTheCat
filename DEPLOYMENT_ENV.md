# ZAZU deployment environment handoff

The live data path has three separate responsibilities:

| Service | Responsibility | Sensitive values |
| --- | --- | --- |
| Vercel | Website, read-only chain APIs, and authenticated server-side pons quote route | Quote API shared secret and RPC URL, if the provider URL contains a credential |
| Railway | One keeper process that quotes, simulates, and submits bounded vault executions | Keeper private key, quote API key, credentialed RPC URL |
| Supabase | Optional searchable mirror of confirmed `BuybackExecuted` events | Elevated server key, held only by a separate mirror worker |

The contract and its `BuybackExecuted` events are always the source of truth. Supabase is an optional read cache and must never be used to decide an execution, calculate vault balances, or replace transaction explorer proof.

This handoff targets **pons v1 only**. The adapter and quote route assume its WETH/ZAZU Uniswap V3 pool and 1% fee tier. Do not use these values for pons v2, which has a bonding-curve phase, Uniswap V4 after graduation, and pairing-asset payouts through a fee escrow.

## One-time TUFF v2 test

The separate `npm run tuff:v2-test` command is a deliberately pinned exception for the existing TUFF test launch only. It does not use the website, Supabase, the ZAZU vault, or the continuous v1 keeper. It performs exactly three sequential transactions from the TUFF creator wallet: `sweepFees(0)`, escrow `claim(500000000000000)`, and a `0.0005 ETH` curve buy whose recipient is the canonical burn address. Both the partial claim and the buy are hard-capped at `0.0005 ETH`; the remaining creator fees stay in escrow.

Use a separate Railway service with build command `npm install --include=dev`, start command `npm run tuff:v2-test`, one replica, autodeploy disabled, and restart policy Never. Import [`deploy/railway-tuff-v2-test.env.example`](deploy/railway-tuff-v2-test.env.example) and run it first with `TUFF_TEST_DRY_RUN=true` and no key. The dry run uses the chain's sequential transaction simulator and prints the current nonce plus the exact live acknowledgement.

For the single live run, set the printed nonce, exact acknowledgement, `TUFF_TEST_DRY_RUN=false`, and the creator key in `TUFF_TEST_PRIVATE_KEY`. The script checks that the key derives the pinned creator, reconciles latest and pending nonces before every write, caps gas and slippage, submits each transaction once, waits for confirmations, and verifies both the `CurveBuy` and token transfer to the burn address. An uncertain submission or partial failure is a manual recovery event; do not change the nonce and rerun the whole sequence. Remove the private key and scale the service to zero after completion.

## Vercel

Import [`deploy/vercel.env.example`](deploy/vercel.env.example), replace every placeholder, and apply the variables to Production. Values beginning with `NEXT_PUBLIC_` are intentionally visible in the browser. Never place the keeper key, deployer key, or Supabase elevated key in Vercel. `KEEPER_QUOTE_API_KEY` belongs in Vercel only as a server-side value and must never use a `NEXT_PUBLIC_` prefix.

The duplicate public and server-side chain, token, and vault values are intentional. The API fails closed when those pins disagree. `BUYBACK_VAULT_START_BLOCK` must be the exact block in which the vault was deployed so event reads are complete and bounded.

Use a production provider endpoint for both hosted services. Robinhood's [connection documentation](https://docs.robinhood.com/chain/connecting/) describes the public RPC as rate-limited and not recommended for production traffic.

`/api/quote` is server-side only. It pins the official pons Quoter V2, WETH, 1% pool fee, and deployed `PonsV3Adapter`; derives the pool from the pons token; and requires the same `KEEPER_QUOTE_API_KEY` sent by Railway. The shared secret must not use a `NEXT_PUBLIC_` prefix.

After redeploying, verify both endpoints against the explorer:

```text
https://<SITE_HOST>/api/stats
https://<SITE_HOST>/api/buybacks?page=1&pageSize=20
https://<SITE_HOST>/api/activity?limit=12
```

`/api/activity` combines three contract-derived receipts without a database:
`CreatorFeesForwarded` from `PONS_FEE_COLLECTOR_ADDRESS`, plus
`DirectZazuBurned` and `BuybackExecuted` from the vault. For collector events it
also reads the confirmed transaction input so `claimAndFlush()` is labeled as a
claim plus flush while an ordinary `flush()` remains distinct. The endpoint
uses a block-and-log cursor for older activity and scans in bounded block
windows. `ACTIVITY_LOG_BLOCK_SPAN` can tune that window for the selected RPC.
It reads only through `chain head - ACTIVITY_CONFIRMATION_DEPTH`, which defaults
to two blocks, so the UI does not describe head-block logs as confirmed. The
collector source is included only after its bytecode, configured flag, ZAZU
token, buyback vault, and 900-second claim cadence all match. Missing or invalid
collector configuration leaves vault receipts available but marks the V1 trail
as incomplete. Zero-value `CreatorFeesForwarded` events are excluded.

## Railway

Create one worker service from this repository with:

```text
Build command: npm install --include=dev
Start command: npm run keeper
Replica count: 1
Node version: 22.13 or newer
Restart policy: Never
GitHub autodeploy: Disabled
```

Import [`deploy/railway.env.example`](deploy/railway.env.example) and replace every placeholder. The keeper compares every pinned value to the deployed vault and stops when any value differs.

Keep `KEEPER_DRY_RUN=true` for the first complete quote and simulation. Review the log, confirm the adapter, route, amount, minimum output, price impact, and gas bounds, then set it to `false` to permit submission. Do not run multiple Railway replicas because the included lock is local to one machine, not a distributed lock. Do not use rolling deployments. Before every deployment or resume, stop the service, wait for `keeper_stopped`, confirm no other deployment exists, and verify the signer wallet reports identical `latest` and `pending` nonces. Live automatic startup and every write repeat this check and use the reconciled nonce explicitly; any mismatch exits and remains stopped under restart policy Never.

`DEX_ROUTER_ADDRESS` is the deployed `PonsV3Adapter`, not the underlying swap router. The keeper quote URL points to the server-side `/api/quote` route. For this adapter, `WRAPPED_NATIVE_ADDRESS` and `FEE_TOKEN_ADDRESS` must both pin the official pons WETH, and the adapter accepts only empty `routeData`.

`PONS_FEE_COLLECTOR_ADDRESS` pins the collector used as the pons creator wallet. `PONS_LOCKER_ADDRESS` pins the active v1 locker. The Railway process polls once per minute, but it waits for the vault's 15-minute execution window before simulating the collector's `claimAndFlush()`. The collector permits that claim only from the vault's current keeper and independently enforces a 15-minute claim interval onchain. It skips an empty claim and submits only when a creator share is available. The collector claims from the pinned locker, forwards WETH to the vault, accounts it, forwards token-side ZAZU, and invokes the vault's `burnDirectZazu()`. Those functions cannot choose a recipient and can only send ZAZU to the canonical burn address.

After confirmation, the keeper requires exactly one nonzero `CreatorFeesForwarded` receipt and treats its amounts as authoritative because fees can accrue after simulation. A nonzero forwarded ZAZU amount must also have one `DirectZazuBurned` receipt from the vault to the canonical burn address covering at least the forwarded amount. The burn may be larger when pre-existing dust or direct donations were already in the vault. Missing or insufficient proof halts the service before the buyback phase.

### Guarded manual fallback

Keep a normally idle Railway service at zero replicas with start command `npm run keeper:manual`, GitHub autodeploys disabled, and restart policy Never. It must use the same deployed commit and pins as the automatic worker. The manual entrypoint forces `KEEPER_RUN_ONCE=true`, identifies its logs as manual, and defaults to `KEEPER_DRY_RUN=true`.

The automatic worker must be fully stopped before a live manual job begins. Railway containers do not share the keeper's `/tmp` file lock, and a rolling deployment can overlap. Scale automation to zero, wait for `keeper_stopped`, confirm there are no other replicas or deployments, and reconcile the keeper wallet's `latest` and `pending` nonces. If they differ, or a submitted transaction has uncertain status, stop and reconcile it before continuing.

Run the fallback once in dry-run mode first. For the live one-off, set all three temporary values:

```text
KEEPER_MANUAL_ACK=AUTOMATION_STOPPED:4663:<CHECKSUMMED_BUYBACK_VAULT_ADDRESS>
KEEPER_MANUAL_EXPECTED_NONCE=<MATCHING_LATEST_AND_PENDING_NONCE>
KEEPER_MANUAL_REASON=<8_TO_200_CHARACTER_INCIDENT_NOTE>
```

The live job rechecks both signer nonces before every write and binds the acknowledgement to the configured chain and vault. It still enforces the onchain 15-minute interval, execution limits, quote expiry, adaptive size, price impact, slippage, gas limits, and full simulation. Configure the manual job with restart policy Never. Configure at least 240 seconds of Railway deployment draining so the normal worker can finish any in-flight receipt check and emit `keeper_stopped` before shutdown.

Every successful buyback, scheduled or manual, emits the same onchain `BuybackExecuted` proof. `/api/stats`, `/api/buybacks`, and the website read that event and vault counters directly, so a manual recovery is documented automatically after the short cache window. The event does not distinguish manual from scheduled execution. Direct token-side creator fees are reflected in `totalZazuBurned` but do not create a `BuybackExecuted` history entry.

After the one-off process emits `keeper_stopped`, scale the manual service back to zero and delete its three temporary live-run variables before restoring the automatic service to one replica.

## pons v1 fee flow

`NEXT_PUBLIC_PONS_URL` controls the public pons link only. It does not move fees.

The official [pons documentation](https://docs.ponsfamily.com/) says every v1 launch trades against WETH in a 1% V3 pool, the creator selects a fee wallet, and creator rewards accrue in both the launched token and WETH. The deployed configuration therefore uses the official pons WETH as the vault fee token, a pool fee of `10000`, the narrow `PonsV3Adapter`, a predeployed `PonsFeeCollector`, and the canonical burn address.

Here, `100% of creator fees` means every WETH and ZAZU amount actually paid to the configured collector. It does not include the protocol share that pons retains under the launch's snapshotted fee split.

The collector resolves deployment order safely. Deploy `PonsFeeCollector` before token creation and use its printed address as the pons creator fee wallet. After pons creates ZAZU, deploy the adapter and vault, then configure the collector exactly once. The collector verifies the vault's token, WETH fee asset, and canonical burn destination and has no arbitrary withdrawal function.

`PonsFeeCollector.claimAndFlush()` calls the pinned active locker as the configured fee recipient. The verified locker authorizes the launch deployer, redirect recipient, owner, or an approved collector to call `collectFees(token)`. The collector additionally requires the caller to be the current vault keeper and records `lastClaimTime`, preventing another successful claim for 15 minutes. The deployment configuration verifies that `feeRedirects(ZAZU)` equals the collector before ownership transfer. Verify that redirect, `minimumClaimInterval() == 900`, and the vault keeper again on the explorer before enabling Railway submissions.

WETH fees are swapped for ZAZU by the bounded adapter. ZAZU-side creator fees are already the target token, so `burnDirectZazu()` sends them directly to the canonical burn address and records them in `totalZazuBurned`.

No pons private key or wallet credential belongs in the website. The user-facing `POWERED BY PONS` line is descriptive project copy, not a claim of partnership, endorsement, or operation by pons. Follow the [pons attribution terms](https://docs.ponsfamily.com/#terms-and-attribution), link to the app, and verify every address from the current contract registry.

## Contract deployment pins

Deploy the collector first with:

```text
CHAIN_ID=4663
DEPLOYER_PRIVATE_KEY=<DEPLOYER_SECRET>
WRAPPED_NATIVE_ADDRESS=<OFFICIAL_PONS_WETH_ADDRESS>
PONS_LOCKER_ADDRESS=0x736D76699C26D0d966744cAe304C000d471f7F35
```

For Robinhood mainnet, `CHAIN_ID` must be `4663`. Both mainnet scripts hard-revert on every other runtime chain even if the environment is misconfigured. From the repository root, first simulate and inspect each script without `--broadcast`, then repeat the identical command with `--broadcast` only after the trace and resolved addresses are approved:

```sh
forge script --root contracts script/DeployPonsFeeCollector.s.sol:DeployPonsFeeCollector \
  --rpc-url "$ROBINHOOD_RPC_URL"

forge script --root contracts script/DeployPonsFeeCollector.s.sol:DeployPonsFeeCollector \
  --rpc-url "$ROBINHOOD_RPC_URL" --broadcast --slow
```

Use the printed collector address as the creator fee wallet when launching ZAZU through pons v1. If the interface instead presents a bonding curve, custom pairing asset, or creator-tax configuration, stop because that is the incompatible v2 flow. After the ZAZU address exists, deploy the adapter and vault with:

```text
CHAIN_ID=4663
DEPLOYER_PRIVATE_KEY=<DEPLOYER_SECRET>
ZAZU_TOKEN_ADDRESS=<PONS_LAUNCHED_ZAZU_ADDRESS>
PONS_FEE_COLLECTOR_ADDRESS=<PREDEPLOYED_CREATOR_FEE_COLLECTOR_ADDRESS>
PONS_LOCKER_ADDRESS=0x736D76699C26D0d966744cAe304C000d471f7F35
PONS_SWAP_ROUTER_ADDRESS=0xCaf681a66D020601342297493863E78C959E5cb2
PONS_POOL_FEE=10000
WRAPPED_NATIVE_ADDRESS=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
FEE_TOKEN_ADDRESS=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
KEEPER_ADDRESS=<RAILWAY_KEEPER_ADDRESS>
BUYBACK_DESTINATION=0x000000000000000000000000000000000000dEaD
INITIAL_OWNER=<MULTISIG_CONTRACT_ADDRESS>
MIN_EXECUTION_AMOUNT=<MINIMUM_WETH_BUY_IN_WEI>
MAX_EXECUTION_AMOUNT=<MAXIMUM_WETH_BUY_IN_WEI>
MAX_SLIPPAGE_BPS=<INTEGER_FROM_1_TO_500>
CONFIGURATION_DELAY_SECONDS=172800
```

Verify the router and WETH addresses against the current pons contract registry and confirm bytecode on the Robinhood Chain explorer immediately before deployment. The adapter address printed by the deployment becomes Railway's `DEX_ROUTER_ADDRESS` fail-closed pin. The collector address is pinned separately as `PONS_FEE_COLLECTOR_ADDRESS`.

After the pons V1 token exists and every deployment pin above is populated, simulate and then broadcast the adapter, vault, collector configuration, timelock, and ownership-transfer sequence with:

```sh
forge script --root contracts script/DeployRobinhoodMainnet.s.sol:DeployRobinhoodMainnet \
  --rpc-url "$ROBINHOOD_RPC_URL"

forge script --root contracts script/DeployRobinhoodMainnet.s.sol:DeployRobinhoodMainnet \
  --rpc-url "$ROBINHOOD_RPC_URL" --broadcast --slow
```

## Supabase optional mirror

Apply [`supabase/migrations/202608050001_buyback_event_mirror.sql`](supabase/migrations/202608050001_buyback_event_mirror.sql) in the Supabase SQL editor or migration runner. It creates:

- an immutable-by-default event mirror keyed by chain, vault, and execution ID;
- a sync cursor table for a separate indexer;
- public read policies for `anon` and `authenticated`;
- no public insert, update, or delete policy;
- a service-role-only idempotent upsert function.

The optional mirror worker would need these server-only variables:

```text
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_SECRET_KEY=<SB_SECRET_SERVER_KEY>
# Legacy projects may use SUPABASE_SERVICE_ROLE_KEY instead.
```

The current keeper does not read or write Supabase, which keeps execution independent from the mirror. If a mirror worker is added, place its elevated key only on that server-side worker. [Supabase documents](https://supabase.com/docs/guides/getting-started/api-keys) that secret and legacy service-role keys bypass RLS, so never expose either key in a browser or prefix it with `NEXT_PUBLIC_`.

Prepared upsert and pagination examples are in [`supabase/examples/buyback_queries.sql`](supabase/examples/buyback_queries.sql). The upsert accepts only exact duplicate events on conflict. A chain reorganization should be handled explicitly by deleting the affected mirrored block range with the service role, then replaying confirmed logs from the RPC.

## Activation order

1. Select pons v1 explicitly, then verify the Robinhood Chain ID, RPC, explorer, official v1 router, Quoter V2, WETH, and pool fee from current documentation.
2. Deploy and verify `PonsFeeCollector`; use it as the pons creator fee wallet.
3. Launch ZAZU through pons v1 with the collector as creator wallet; record its token and pool addresses.
4. Deploy and verify `PonsV3Adapter` and `BuybackVault`, configure the collector exactly once, and record the vault deployment block.
5. Confirm the collector, adapter immutables, vault pins, keeper, canonical burn destination, and ownership.
6. Verify the v1 locker fee redirect and run `claimAndFlush()` in simulation; test both the WETH and ZAZU sides.
7. Set matching Vercel and Railway pins, including the shared quote secret.
8. Run one Railway keeper replica in dry-run mode and review the collector flush, quote, and simulation.
9. Enable submissions only after a small bounded end-to-end execution succeeds.
10. Reconcile the WETH buyback, direct ZAZU burn, destination receipts, public APIs, and explorer transactions.
11. Optionally start a separate Supabase mirror worker after on-chain reads are already working.

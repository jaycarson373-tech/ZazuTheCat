# ZAZU

The internet's most locked-in cat, built on Robinhood Chain and powered by pons.

This repository contains the Zazu site, the fixed 1,212-piece Zazu Cat NFT mint, a pons v1 creator-fee collector, a narrow Uniswap V3 adapter, the BuybackVault, a guarded Railway keeper, read-only public APIs, and an optional Supabase event mirror.

## Fee loop

```text
pons v1 creator fees
        |
        v
PonsFeeCollector.claimAndFlush()
        | WETH                         | ZAZU
        v                              v
BuybackVault treasury          canonical burn address
        |
        v
PonsV3Adapter -> pons WETH/ZAZU V3 pool
        |
        v
purchased ZAZU -> canonical burn address
```

The active pons v1 locker pays creator rewards in WETH and ZAZU. The collector is set as the launch fee wallet. Its keeper-only `claimAndFlush()` enforces an onchain 15-minute claim interval, forwards WETH to the vault, and burns token-side ZAZU. The worker polls once per minute but waits for the vault window before simulating a claim, skips an empty result, checks the vault and quote pins, applies price-impact and gas ceilings, simulates the buyback, and submits each transaction once. The collector cooldown prevents repeated tiny claims if a later quote or buyback check must wait for another poll.

This integration is for the active pons v1 WETH and Uniswap V3 path documented at [docs.ponsfamily.com](https://docs.ponsfamily.com/). It is not compatible with pons v2.

## Repository map

| Area | Purpose |
| --- | --- |
| `app/`, `components/`, `public/` | Zazu site, lore archive, live zero-based dashboard, and public APIs |
| `contracts/src/Zazu1212.sol` | Fixed 1,212-supply ERC-721 mint at 0.003 ETH |
| `contracts/script/DeployZazu1212.s.sol` | Robinhood Chain deployment and verification script |
| `contracts/src/PonsFeeCollector.sol` | Claims and routes the pons v1 creator share |
| `contracts/src/PonsV3Adapter.sol` | Restricts swaps to WETH into ZAZU through the pinned router |
| `contracts/src/BuybackVault.sol` | Bounds execution, accounts spend and burns, and emits receipts |
| `scripts/keeper.ts`, `keeper/` | Railway worker with fail-closed environment pins |
| `app/api/quote` | Authenticated server-side quote for the exact pons v1 pool |
| `app/api/stats`, `app/api/buybacks` | Read-only contract state and event history |
| `supabase/` | Optional event mirror SQL and sample queries |

## Run locally

Requirements: Node.js 22.13 or newer and Foundry.

```bash
npm install
npm run contracts:install
cp .env.example .env.local
npm run dev
```

Blank contract variables produce a clean dashboard that starts at zero. No placeholder address or fabricated activity is shown.

## Verify

```bash
npm run typecheck
npm run lint
npm run test:contracts
npm run test:keeper
npm run test:app
npm run vercel-build
```

## Deploy

Copy-ready Vercel and Railway templates, contract order, Supabase SQL, and activation checks are in [DEPLOYMENT_ENV.md](DEPLOYMENT_ENV.md).

The NFT contract and direct website mint have a separate copy-ready checklist in [docs/ZAZU_1212_MINT.md](docs/ZAZU_1212_MINT.md). Fund the isolated deployer with a 0.01 ETH buffer, pin and verify the final 1,212 metadata files, then run `npm run nft:deploy`. Vercel receives only the resulting public NFT contract address, never the deployer key.

Keep all private keys on the service that needs them. Vercel receives no signer key. Railway uses one minimally funded keeper and one replica. The chain and `BuybackExecuted` events remain the source of truth; Supabase is only an optional query mirror.

If automation is stopped for recovery, `npm run keeper:manual` provides a one-cycle fallback with dry-run by default, an explicit chain/vault acknowledgement, a reconciled signer nonce, and the same quote, simulation, gas, slippage, and cooldown checks. Successful manual executions emit the normal onchain event and appear automatically in the public stats and buyback APIs. Follow the stop, verify, run, and resume procedure in [keeper/README.md](keeper/README.md#manual-recovery).

Before enabling keeper submissions, verify the active pons factory, locker, router, Quoter V2, WETH, pool, collector fee redirect, adapter immutables, vault pins, burn destination, and multisig ownership against the Robinhood Chain explorer. Start Railway in dry-run mode, then validate one bounded end-to-end execution.

## Disclaimer

$ZAZU is a community meme token and can lose all value. Nothing here is financial advice. The project is independent and is not affiliated with or endorsed by Robinhood, pons, a DEX, or Zazu's owner.

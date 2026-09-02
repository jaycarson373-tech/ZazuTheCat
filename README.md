# DOG WIF SHIESTY

The masked dog of Robinhood Chain. Powered by Pons.

This repository contains the $SHIESTY landing page and its original neon-mask artwork.

## Shiesty PFP bot

The site includes an opt-in X profile-picture bot experience adapted from the proven [Horns bot](https://github.com/jaycarson373-tech/horns/tree/9690c3a732bc6b5ee50d15bd2b98c4550ccba621). A user mentions or replies to the bot with `shiesty me`; the worker loads that user's public PFP, applies the built-in Shiesty edit, and replies once with an AI-labeled image. `STOP` is persisted as an opt-out.

The worker lives in [`shiesty-bot/`](./shiesty-bot) and deploys as a separate Railway service. Its Supabase, X, and OpenAI secrets belong only in Railway. Vercel needs only the optional public handle/link shown in `.env.example`.

Keep the worker in `DRY_RUN=true` until the X app has Read and Write access, prepaid API credits, valid user-context credentials, and explicit approval from X for AI-powered automated replies. X Premium or a blue check does not replace developer API access or that approval.

## Community fee plan

$SHIESTY uses Pons with a 1% pool fee. The project creator share received from that pool is reserved for transparent community rewards, including drops, meme bounties, contests, and contributor support.

Community rewards are discretionary promotional distributions. Buying does not guarantee eligibility, yield, dividends, or returns. Completed distributions should be paired with public transaction receipts.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Verify

```bash
npm run typecheck
npm run lint
npm run test:app
npm run vercel-build
```

## Deploy

Import the browser-safe values from `deploy/vercel.env.example`. Never place a wallet private key in Vercel or any `NEXT_PUBLIC_` variable.

The repository also contains earlier experimental contract and worker code. It is not connected to the $SHIESTY page or its community distribution plan.

## Disclaimer

$SHIESTY is a community meme token and can lose all value. Nothing here is financial advice. The project is independent and is not affiliated with or endorsed by Robinhood or Pons.

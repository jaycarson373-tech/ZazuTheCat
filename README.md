# DOG WIF SHIESTY

The masked dog of Robinhood Chain. Powered by Pons.

This repository contains the $SHIESTY landing page and its original neon-mask artwork.

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

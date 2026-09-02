import assert from "node:assert/strict";
import test from "node:test";

let renderedPage;

async function render() {
  if (!renderedPage) {
    renderedPage = (async () => {
      const workerUrl = new URL("../dist/server/index.js", import.meta.url);
      workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
      const { default: worker } = await import(workerUrl.href);
      const response = await worker.fetch(
        new Request("http://localhost/", { headers: { accept: "text/html" } }),
        { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
        { waitUntil() {}, passThroughOnException() {} },
      );
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
      return response.text();
    })();
  }
  return renderedPage;
}

test("renders the complete Zazu identity and forty-cat hero", async () => {
  const html = await render();
  assert.match(html, /<title>\$ZAZU \| The Internet(?:&#x27;|')s Most Locked-In Cat<\/title>/i);
  assert.match(html, /THE INTERNET(?:&#x27;|')S MOST LOCKED-IN CAT/i);
  assert.match(html, /Creator fees buy ZAZU\. ZAZU gets burned\./i);
  assert.match(html, /POWERED BY PONS/i);
  assert.match(html, /ZAZU_VARIANTS_001-040\.PNG/i);
  assert.match(html, /40[\s\S]*CATS[\s\S]*LOADED/i);
  assert.match(html, /Forty lo-fi Zazu cat portraits/i);
  assert.match(html, /zazu-logo\.jpg/i);
  assert.match(html, /zazu-40-grid\.png/i);
  assert.match(html, /\/og\.png/i);
  assert.doesNotMatch(html, /BUYBACK \+ BURN/i);
});

test("renders the handmade 1,000-piece Zazu NFT collection without a dead mint link", async () => {
  const html = await render();
  assert.match(html, /THE ZAZU 1000/i);
  assert.match(html, /1,000[\s\S]*ZAZUS[\s\S]*MADE BY HAND/i);
  assert.match(html, /finite collection[\s\S]*1,000[\s\S]*custom handmade ZAZU NFTs/i);
  assert.match(html, /SUPPLY[\s\S]*1,000/i);
  assert.match(html, /PROCESS[\s\S]*HANDMADE/i);
  assert.match(html, /40 PREVIEW FILES/i);
  assert.match(html, /EXPLORE THE ZAZU FILES/i);
  assert.doesNotMatch(html, /MINT A ZAZU ↗/i);
});

test("renders a zero-based mini dashboard, simple mechanism, and header actions", async () => {
  const html = await render();
  assert.match(html, /BUYBACK DASHBOARD/i);
  assert.match(html, /ZAZU BURNED[\s\S]*0 \$ZAZU/i);
  assert.match(html, /ZAZU BOUGHT[\s\S]*0 \$ZAZU/i);
  assert.match(html, /FEES DEPLOYED[\s\S]*0 WETH/i);
  assert.match(html, /BUYBACKS[\s\S]*0/i);
  assert.match(html, /PONS FEES FLOW/i);
  assert.match(html, /AUTOMATION CHECKS IN/i);
  assert.match(html, /BUYBACK EXECUTES/i);
  assert.match(html, /ZAZU BURNS/i);
  assert.match(html, /PUBLIC VAULT/i);
  assert.match(html, /DEX ADAPTER/i);
  assert.match(html, /header-chip header-chip-placeholder[^>]*>CA<\/button>/i);
  assert.match(html, /header-chip header-chip-placeholder[^>]*>X<\/button>/i);
});

test("renders the complete V1 onchain activity terminal", async () => {
  const html = await render();
  assert.match(html, /THE ONCHAIN RECEIPTS/i);
  assert.match(html, /FOLLOW THE[\s\S]*FULL LOOP/i);
  assert.match(html, /TOTAL ZAZU BURNED/i);
  assert.match(html, /ONCHAIN RECEIPTS/i);
  assert.match(html, /ONCHAIN ACTIVITY/i);
  assert.match(html, /CLAIM \+ FLUSH/i);
  assert.match(html, /DIRECT TOKEN BURN/i);
  assert.match(html, /MARKET BUY \+ BURN/i);
  assert.doesNotMatch(html, /COMPLETE V1 TRAIL/i);
  assert.doesNotMatch(html, /PARTIAL ONCHAIN FEED|V1 TRAIL INCOMPLETE|SOURCE INCOMPLETE/i);
  assert.match(html, /NO ACTIVITY RECORDED/i);
  assert.doesNotMatch(html, /SUPABASE/i);
});

test("renders the Zazu Files lore without inventing a birthday", async () => {
  const html = await render();
  assert.match(html, /THE ZAZU FILES/i);
  assert.match(html, /DATE OF BIRTH:[\s\S]*CLASSIFIED/i);
  assert.match(html, /exact birthday was never published/i);
  assert.match(html, /ORIGIN FILE/i);
  assert.match(html, /2023/i);
  assert.match(html, /THE PHOTO ESCAPES/i);
  assert.match(html, /THE ELEMENTAL ERA/i);
  assert.match(html, /EARTH/i);
  assert.match(html, /VOID/i);
  assert.match(html, /WATER/i);
  assert.match(html, /FIRE/i);
  assert.match(html, /zazu-elements\.jpg/i);
});

test("contains the official socials and no stale brands or rejected copy", async () => {
  const html = await render();
  assert.match(html, /https:\/\/www\.instagram\.com\/zazubabyman\//i);
  assert.match(html, /https:\/\/www\.tiktok\.com\/@zazubabyman_/i);
  assert.match(html, /https:\/\/pons\.family\/launchpad/i);
  assert.match(html, /https:\/\/robinhoodchain\.blockscout\.com\//i);
  assert.doesNotMatch(html, /Timon|Smudge|Tutu|Rigby|Dino Cat|dinocattutu|iamrigbycat|timon\.surik/i);
  assert.doesNotMatch(html, /PFP GENERATOR|TAG THE BOT|DOWNLOAD PNG|SUPPORT METER|DONATION THERMOMETER/i);
  assert.doesNotMatch(html, /Solana|pump\.fun|jup\.ag|Jupiter/i);
  assert.doesNotMatch(html, /ZAZU\.EXE|prelaunch|testnet|awaiting verified|not configured|not set/i);
  assert.doesNotMatch(html, /stare that burns back|15 min target|public proof/i);
  assert.doesNotMatch(html, /BAD ROUTE|NO BUY|SAFE ROUTE|QUOTE CHECKED/i);
  assert.doesNotMatch(html, /EXECUTION GUARDRAILS|LIQUIDITY-AWARE EXECUTION/i);
  assert.doesNotMatch(html, /SMARTER BUYS|STEADIER BURNS|automatically sizes each buyback/i);
  assert.doesNotMatch(html, /STRICT MAXIMUM BUY SIZE|PRICE IMPACT CEILING|SIMULATION BEFORE SUBMIT/i);
  assert.doesNotMatch(html, /—/);
});

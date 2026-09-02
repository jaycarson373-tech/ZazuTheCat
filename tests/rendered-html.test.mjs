import assert from "node:assert/strict";
import test from "node:test";

let renderedPage;
let renderedPolicy;

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

async function render() {
  if (!renderedPage) {
    renderedPage = (async () => {
      const worker = await loadWorker();
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

async function renderPolicy() {
  if (!renderedPolicy) {
    renderedPolicy = (async () => {
      const worker = await loadWorker();
      const response = await worker.fetch(
        new Request("http://localhost/bot-policy", { headers: { accept: "text/html" } }),
        { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
        { waitUntil() {}, passThroughOnException() {} },
      );
      assert.equal(response.status, 200);
      return response.text();
    })();
  }
  return renderedPolicy;
}

test("renders the complete Dog Wif Shiesty identity and forty-dog hero", async () => {
  const html = await render();
  assert.match(html, /<title>\$SHIESTY \| Dog Wif Shiesty<\/title>/i);
  assert.match(html, /DOG WIF SHIESTY/i);
  assert.match(html, /IN THE HOOD,[\s\S]*WE WEAR SHIESTYS/i);
  assert.match(html, /ROBINHOOD CHAIN(?:&#x27;|')S MASKED DOG/i);
  assert.match(html, /THE_SHIESTY_PACK_001-040\.JPG/i);
  assert.match(html, /40 MASKS LOADED/i);
  assert.match(html, /Forty colorful animals wearing different shiesty masks and accessories/i);
  assert.match(html, /shiesty-logo\.jpg/i);
  assert.match(html, /shiesty-dog-wall\.png/i);
  assert.match(html, /shiesty-favicon\.png/i);
  assert.match(html, /shiesty-banner\.jpg/i);
  assert.match(html, /Official Dog Wif Shiesty banner/i);
});

test("explains the one-percent pool and community reward plan accurately", async () => {
  const html = await render();
  assert.match(html, /1% POOL FEE/i);
  assert.match(html, /creator share from the 1% pool fee is reserved for community rewards/i);
  assert.match(html, /COMMUNITY DROPS/i);
  assert.match(html, /MEME BOUNTIES/i);
  assert.match(html, /PACK CONTESTS/i);
  assert.match(html, /PUBLIC RECEIPTS/i);
  assert.match(html, /THE CREATOR SHARE LANDS/i);
  assert.match(html, /THE HOOD GETS IT/i);
  assert.match(html, /not yield, dividends, or guaranteed returns/i);
  assert.match(html, /Buying does not guarantee eligibility/i);
});

test("contains working navigation and no old NFT or buyback brand copy", async () => {
  const html = await render();
  assert.match(html, /href="#hood"[^>]*>The hood<\/a>/i);
  assert.match(html, /href="#community"[^>]*>1% back<\/a>/i);
  assert.match(html, /href="#how"[^>]*>How it works<\/a>/i);
  assert.match(html, /href="#bot"[^>]*>Mask bot<\/a>/i);
  assert.match(html, /https:\/\/pons\.family\/launchpad/i);
  assert.match(html, /https:\/\/robinhoodchain\.blockscout\.com\//i);
  assert.match(html, /header-chip header-chip-placeholder[^>]*>CA<\/button>/i);
  assert.match(html, /header-chip header-chip-placeholder[^>]*>X<\/button>/i);
  assert.doesNotMatch(html, /THE ZAZU 1000|ZAZU_VARIANTS|ZAZU ELEMENTS/i);
  assert.doesNotMatch(html, /NFT|MINT A|HANDMADE COLLECTION/i);
  assert.doesNotMatch(html, /BUYBACK|BURNED|BURN DESTINATION|ONCHAIN RECEIPTS/i);
  assert.doesNotMatch(html, /Timon|Smudge|Tutu|Rigby|Dino Cat|dinocattutu|iamrigbycat|timon\.surik/i);
  assert.doesNotMatch(html, /Solana|pump\.fun|jup\.ag|Jupiter/i);
  assert.doesNotMatch(html, /—/);
});

test("explains the opt-in Shiesty profile picture bot without a dead CTA", async () => {
  const html = await render();
  assert.match(html, /THE SHIESTY MACHINE/i);
  assert.match(html, /TAG IT\.[\s\S]*GET[\s\S]*SHIESTY\./i);
  assert.match(html, /shiesty me/i);
  assert.match(html, /PFP LOADED/i);
  assert.match(html, /MASK FITTED/i);
  assert.match(html, /ONE IMAGE REPLY PER REQUEST/i);
  assert.match(html, /REPLY[\s\S]*STOP[\s\S]*TO OPT OUT/i);
  assert.match(html, /href="\/bot-policy"[^>]*>PRIVACY \+ TERMS/i);
  assert.doesNotMatch(html, /TRY THE BOT ON X/i);
});

test("publishes the bot privacy, retention, opt-out, and use policy", async () => {
  const html = await renderPolicy();
  assert.match(html, /Shiesty PFP Bot Policy/i);
  assert.match(html, /WHAT IT USES/i);
  assert.match(html, /Temporary source and output files are deleted/i);
  assert.match(html, /Generated images are not stored in the bot database/i);
  assert.match(html, /STOP[^<]*to opt out/i);
  assert.match(html, /Do not use the bot to impersonate, harass, deceive, or target another person/i);
  assert.doesNotMatch(html, /—/);
});

import assert from "node:assert/strict";
import test from "node:test";

const rendered = new Map();
async function render(path = "/") {
  if (!rendered.has(path)) rendered.set(path, (async () => {
    let response;
    if (process.env.RENDER_TEST_BASE_URL) {
      response = await fetch(new URL(path, process.env.RENDER_TEST_BASE_URL));
    } else {
      const { default: worker } = await import("../dist/server/index.js");
      response = await worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
    }
    assert.equal(response.status, 200);
    return response.text();
  })());
  return rendered.get(path);
}

test("renders the pink FOID diary, supplied art and LULU pairing", async () => {
  const html = await render();
  assert.match(html, /<title>FOID \| Booked\. Busy\. Foid\.<\/title>/);
  for (const label of ["foid-pink-portrait", "foid-morning", "foid-pilates", "foid-astrology", "Get another excuse", "Daily lore", "Starbucks", "Mercury", "FOID paired with LULU", "LULU airdrops"]) assert.ok(html.includes(label), `Missing ${label}`);
  assert.doesNotMatch(html, /DwarzSz1q8vvmURDDW75i1KTU3ivZPbYJYHhiUeHf262|x\.com\/Tesllama|MicroSloth|SlothOS|MSLOTH/);
});

test("identifies LULU as the reward while keeping unannounced claims closed", async () => {
  const html = await render("/airdrops");
  assert.match(html, /NOT LIVE YET/);
  assert.match(html, /<button disabled="">Claims not open<\/button>/);
  assert.match(html, /<dt>Reward asset<\/dt><dd>LULU<\/dd>/);
  assert.match(html, /Not scheduled/);
  assert.match(html, /no active claim or wallet connection/);
  assert.doesNotMatch(html, /DwarzSz1q8vvmURDDW75i1KTU3ivZPbYJYHhiUeHf262/);
});

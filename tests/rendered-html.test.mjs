import assert from "node:assert/strict";
import test from "node:test";

let rendered;
async function render() {
  if (!rendered) {
    rendered = (async () => {
      if (process.env.RENDER_TEST_BASE_URL) {
        const response = await fetch(process.env.RENDER_TEST_BASE_URL);
        assert.equal(response.status, 200);
        return response.text();
      }
      const { default: worker } = await import("../dist/server/index.js");
      const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
      assert.equal(response.status, 200);
      return response.text();
    })();
  }
  return rendered;
}

test("renders the MicroSloth desktop and usable app controls", async () => {
  const html = await render();
  assert.match(html, /<title>MicroSloth \| Almost ready\.<\/title>/);
  for (const label of ["My Sloth", "The merger", "Sloth Update", "MSLOTH", "Explore the merger", "Check for updates", "Minimize window", "Maximize window", "Close window"]) assert.ok(html.includes(label), `Missing ${label}`);
  assert.match(html, /microsloth-ceo/);
});

test("identifies the fictional concept without reusing the prior token identity", async () => {
  const html = await render();
  assert.match(html, /Fictional merger/);
  assert.match(html, /Not affiliated with Microsoft Corporation/);
  assert.doesNotMatch(html, /DwarzSz1q8vvmURDDW75i1KTU3ivZPbYJYHhiUeHf262|x\.com\/Tesllama|TESLLAMA|Paired with Tesla/);
});

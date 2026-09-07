import assert from "node:assert/strict";
import test from "node:test";

const renderedPages = new Map();

async function render(pathname = "/") {
  if (!renderedPages.has(pathname)) {
    renderedPages.set(pathname, (async () => {
      const workerUrl = new URL("../dist/server/index.js", import.meta.url);
      workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
      const { default: worker } = await import(workerUrl.href);
      const response = await worker.fetch(
        new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
        { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
        { waitUntil() {}, passThroughOnException() {} },
      );
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
      return response.text();
    })());
  }
  return renderedPages.get(pathname);
}

test("renders the Tesllama model range and navigation", async () => {
  const html = await render();
  assert.match(html, /<title>TESLLAMA \| Community Vehicle Concepts<\/title>/i);
  assert.match(html, /TESLLAMA S/i);
  assert.match(html, />Model X<\/button>/i);
  assert.match(html, />Model CT<\/button>/i);
  assert.match(html, /Pearl White/i);
  assert.match(html, /Obsidian/i);
  assert.match(html, /aria-label="Play slideshow"/i);
  assert.match(html, /Shop Tesllamas/i);
  assert.match(html, />TESLLAMA on Stonk<\/a>/i);
  assert.doesNotMatch(html, /MARKET LAUNCH|Electric\. Fluffy|Built different/i);
});

test("labels the fictional lore and project relationship clearly", async () => {
  const html = await render();
  assert.match(html, /COMMUNITY LORE/i);
  assert.match(html, /According to Tesllama lore/i);
  assert.match(html, /leader of the llamas/i);
  assert.match(html, /Not affiliated with Tesla, Inc\. or Elon Musk/i);
  assert.doesNotMatch(html, /ZAZU 1212|BUYBACK DASHBOARD/i);
});

test("renders the locked coming-soon shop", async () => {
  const html = await render("/shop");
  assert.match(html, /SHOP TESLLAMAS/i);
  assert.match(html, /COMING SOON/i);
  assert.match(html, /first model collection is being prepared/i);
  assert.match(html, /TESLLAMA S/i);
  assert.match(html, /TESLLAMA X/i);
  assert.match(html, /TESLLAMA CT/i);
  assert.match(html, /Return home/i);
});

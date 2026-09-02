import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";
import { SHIESTY_EDIT_PROMPT } from "../src/constants.js";
import { OpenAiShiestyTransformer } from "../src/openai.js";

function config() {
  return loadConfig({
    BOT_USERNAME: "ShiestyBot",
    BOT_USER_ID: "123",
    X_BEARER_TOKEN: "read-token",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    OPENAI_API_KEY: "openai-key"
  });
}

test("moderates input and output around a constrained gpt-image-2 edit", async () => {
  const calls: Array<{ url: string; body: BodyInit | null | undefined }> = [];
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const fetchMock = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body });
    if (url.endsWith("/images/edits")) {
      return Response.json({ data: [{ b64_json: png.toString("base64") }] });
    }
    return Response.json({ results: [{ flagged: false }] });
  }) as typeof fetch;
  const profileDownloader = async () => ({
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    mimeType: "image/jpeg" as const
  });

  const transformer = new OpenAiShiestyTransformer(config(), fetchMock, profileDownloader);
  const result = await transformer.createShiestyPfp("https://pbs.twimg.com/profile_images/1/a.jpg", "shiesty me");
  assert.deepEqual(result, png);
  assert.deepEqual(calls.map((call) => call.url.split("/").at(-1)), ["moderations", "edits", "moderations"]);

  const editForm = calls[1]?.body;
  assert.ok(editForm instanceof FormData);
  assert.equal(editForm.get("model"), "gpt-image-2");
  assert.equal(editForm.get("size"), "1024x1024");
  assert.equal(editForm.get("quality"), "medium");
  assert.equal(editForm.has("input_fidelity"), false);
  assert.equal(editForm.get("moderation"), "auto");
  assert.equal(editForm.get("prompt"), SHIESTY_EDIT_PROMPT);
});

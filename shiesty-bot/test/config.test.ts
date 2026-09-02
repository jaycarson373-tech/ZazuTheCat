import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";

function baseEnv(): NodeJS.ProcessEnv {
  return {
    BOT_USERNAME: "ShiestyBot",
    BOT_USER_ID: "123456789",
    X_BEARER_TOKEN: "read-token",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
  };
}

test("dry run is the default and gpt-image-2 is the default model", () => {
  const config = loadConfig(baseEnv());
  assert.equal(config.dryRun, true);
  assert.equal(config.xAiAutoreplyApproved, false);
  assert.equal(config.openaiImageModel, "gpt-image-2");
  assert.equal(config.pollIntervalMs, 60_000);
});

test("live mode requires exact X approval switch", () => {
  const env = { ...baseEnv(), BOT_DRY_RUN: "false" };
  assert.throws(() => loadConfig(env), /X_AI_AUTOREPLY_APPROVED=true/);
  assert.throws(() => loadConfig({ ...env, X_AI_AUTOREPLY_APPROVED: "TRUE" }), /exactly true or false/);
});

test("live mode requires OAuth1 write credentials and OpenAI", () => {
  const env = { ...baseEnv(), BOT_DRY_RUN: "false", X_AI_AUTOREPLY_APPROVED: "true" };
  assert.throws(() => loadConfig(env), /Live mode requires X_API_KEY/);
  assert.throws(() => loadConfig({
    ...env,
    X_API_KEY: "key",
    X_API_SECRET: "secret",
    X_ACCESS_TOKEN: "token",
    X_ACCESS_TOKEN_SECRET: "token-secret"
  }), /OPENAI_API_KEY/);
});

test("valid live mode keeps all safety gates enabled", () => {
  const config = loadConfig({
    ...baseEnv(),
    BOT_DRY_RUN: "false",
    X_AI_AUTOREPLY_APPROVED: "true",
    X_API_KEY: "key",
    X_API_SECRET: "secret",
    X_ACCESS_TOKEN: "token",
    X_ACCESS_TOKEN_SECRET: "token-secret",
    OPENAI_API_KEY: "openai-key"
  });
  assert.equal(config.dryRun, false);
  assert.equal(config.xAiAutoreplyApproved, true);
});

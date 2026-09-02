import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig, type BotConfig } from "../src/config.js";
import type {
  ImageTransformer,
  InteractionPatch,
  InteractionStore,
  InteractionStatus,
  XAuthor,
  XGateway,
  XMention
} from "../src/types.js";
import { runCycle } from "../src/worker.js";

type Stored = InteractionPatch & { status: InteractionStatus; authorId: string };

class MemoryStore implements InteractionStore {
  cursor?: string;
  interactions = new Map<string, Stored>();
  optOuts = new Set<string>();

  async getCursor() { return this.cursor; }
  async setCursor(postId: string) { this.cursor = postId; }
  async claim(mention: XMention) {
    if (this.interactions.has(mention.id)) return false;
    this.interactions.set(mention.id, { status: "claimed", authorId: mention.authorId });
    return true;
  }
  async update(postId: string, patch: InteractionPatch) {
    const current = this.interactions.get(postId);
    if (!current) throw new Error("missing interaction");
    this.interactions.set(postId, { ...current, ...patch, status: patch.status ?? current.status });
  }
  async isOptedOut(authorId: string) { return this.optOuts.has(authorId); }
  async optOut(author: XAuthor) { this.optOuts.add(author.id); }
  async countRecentGlobal() {
    return [...this.interactions.values()].filter((row) => row.status === "posting" || row.status === "replied").length;
  }
  async countRecentForAuthor(authorId: string) {
    return [...this.interactions.values()].filter((row) => row.authorId === authorId && (row.status === "posting" || row.status === "replied")).length;
  }
}

class MockX implements XGateway {
  uploadCalls = 0;
  replyCalls = 0;
  sourceRechecks = 0;
  failReply = false;
  failSourceRecheck = false;

  constructor(readonly mentions: XMention[]) {}
  async verifyIdentity() {}
  async fetchMentions() { return { mentions: this.mentions, newestId: this.mentions.at(-1)?.id }; }
  async fetchAuthor(authorId: string) { return this.mentions.find((item) => item.authorId === authorId)?.author; }
  async assertSourceStillActionable() {
    this.sourceRechecks += 1;
    if (this.failSourceRecheck) throw new Error("source no longer readable");
  }
  async uploadPng() { this.uploadCalls += 1; return `media-${this.uploadCalls}`; }
  async replyWithMedia() {
    this.replyCalls += 1;
    if (this.failReply) throw new Error("simulated ambiguous timeout");
    return `reply-${this.replyCalls}`;
  }
}

class MockTransformer implements ImageTransformer {
  calls = 0;
  async createShiestyPfp() { this.calls += 1; return Buffer.from("png"); }
}

const fixedNow = new Date("2026-09-02T12:00:00.000Z");

function author(id = "author-1"): XAuthor {
  return {
    id,
    username: id,
    profileImageUrl: "https://pbs.twimg.com/profile_images/1/avatar_normal.jpg",
    protected: false
  };
}

function mention(id: string, text = "@ShiestyBot shiesty me", who = author()): XMention {
  return {
    id,
    text,
    authorId: who.id,
    author: who,
    createdAt: "2026-09-02T11:59:00.000Z",
    mentionedUsernames: ["ShiestyBot"]
  };
}

function makeConfig(live: boolean): BotConfig {
  const env: NodeJS.ProcessEnv = {
    BOT_USERNAME: "ShiestyBot",
    BOT_USER_ID: "bot-1",
    X_BEARER_TOKEN: "read-token",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
  };
  if (live) Object.assign(env, {
    BOT_DRY_RUN: "false",
    X_AI_AUTOREPLY_APPROVED: "true",
    X_API_KEY: "key",
    X_API_SECRET: "secret",
    X_ACCESS_TOKEN: "token",
    X_ACCESS_TOKEN_SECRET: "token-secret",
    OPENAI_API_KEY: "openai-key"
  });
  return loadConfig(env);
}

test("dry run consumes the interaction without generation or X writes", async () => {
  const store = new MemoryStore();
  const x = new MockX([mention("10")]);
  const transformer = new MockTransformer();
  const result = await runCycle(makeConfig(false), { store, x, transformer, now: () => fixedNow });
  assert.equal(result.dryRuns, 1);
  assert.equal(transformer.calls, 0);
  assert.equal(x.uploadCalls, 0);
  assert.equal(x.replyCalls, 0);
  assert.equal(store.interactions.get("10")?.status, "dry_run");
  assert.equal(store.cursor, "10");
});

test("exact STOP persists opt-out and later requests stay silent", async () => {
  const who = author("author-stop");
  const stop = mention("10", "@ShiestyBot STOP", who);
  const request = mention("11", "@ShiestyBot shiesty me", who);
  const store = new MemoryStore();
  const x = new MockX([stop, request]);
  const transformer = new MockTransformer();
  const result = await runCycle(makeConfig(false), { store, x, transformer, now: () => fixedNow });
  assert.equal(result.optedOut, 1);
  assert.equal(result.skipped, 1);
  assert.equal(store.optOuts.has(who.id), true);
  assert.equal(store.interactions.get("11")?.errorCode, "author_opted_out");
  assert.equal(x.replyCalls, 0);
});

test("a live interaction can create only one reply across repeated polls", async () => {
  const store = new MemoryStore();
  const x = new MockX([mention("10")]);
  const transformer = new MockTransformer();
  const config = makeConfig(true);
  const first = await runCycle(config, { store, x, transformer, now: () => fixedNow });
  const second = await runCycle(config, { store, x, transformer, now: () => fixedNow });
  assert.equal(first.replied, 1);
  assert.equal(second.duplicates, 1);
  assert.equal(x.replyCalls, 1);
  assert.equal(x.sourceRechecks, 1);
  assert.equal(transformer.calls, 1);
  assert.equal(store.interactions.get("10")?.status, "replied");
});

test("an ambiguous create-post failure remains posting and is never retried", async () => {
  const store = new MemoryStore();
  const x = new MockX([mention("10")]);
  x.failReply = true;
  const transformer = new MockTransformer();
  const config = makeConfig(true);
  const first = await runCycle(config, { store, x, transformer, now: () => fixedNow });
  const second = await runCycle(config, { store, x, transformer, now: () => fixedNow });
  assert.equal(first.failed, 1);
  assert.equal(second.duplicates, 1);
  assert.equal(x.replyCalls, 1);
  assert.equal(store.interactions.get("10")?.status, "posting");
  assert.equal(store.interactions.get("10")?.errorCode, "reply_result_unknown");
});

test("fresh source recheck happens after generation and before upload", async () => {
  const store = new MemoryStore();
  const x = new MockX([mention("10")]);
  x.failSourceRecheck = true;
  const transformer = new MockTransformer();
  const result = await runCycle(makeConfig(true), { store, x, transformer, now: () => fixedNow });
  assert.equal(result.failed, 1);
  assert.equal(transformer.calls, 1);
  assert.equal(x.sourceRechecks, 1);
  assert.equal(x.uploadCalls, 0);
  assert.equal(x.replyCalls, 0);
  assert.equal(store.interactions.get("10")?.status, "failed");
});

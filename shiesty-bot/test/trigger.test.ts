import assert from "node:assert/strict";
import test from "node:test";

import { classifyCommand, isDirectInteraction, normalizeCommand } from "../src/trigger.js";
import type { XMention } from "../src/types.js";

function mention(overrides: Partial<XMention> = {}): XMention {
  return {
    id: "10",
    text: "@ShiestyBot shiesty me",
    authorId: "20",
    mentionedUsernames: ["ShiestyBot"],
    ...overrides
  };
}

test("accepts only the exact opt-in phrase after removing the bot handle", () => {
  assert.equal(classifyCommand("@ShiestyBot shiesty me", "ShiestyBot"), "generate");
  assert.equal(classifyCommand("SHIESTY   ME @shiestybot", "ShiestyBot"), "generate");
  assert.equal(classifyCommand("@ShiestyBot please shiesty me", "ShiestyBot"), "none");
  assert.equal(classifyCommand("@ShiestyBot shiesty me now", "ShiestyBot"), "none");
  assert.equal(classifyCommand("@ShiestyBot shiesty me!", "ShiestyBot"), "none");
});

test("STOP is case-insensitive, exact, and persistent-command shaped", () => {
  assert.equal(classifyCommand("@ShiestyBot STOP", "ShiestyBot"), "stop");
  assert.equal(classifyCommand("@ShiestyBot stop please", "ShiestyBot"), "none");
  assert.equal(normalizeCommand("  @ShiestyBot  STOP  ", "ShiestyBot"), "stop");
});

test("requires a direct mention or direct reply", () => {
  assert.equal(isDirectInteraction(mention(), "ShiestyBot", "99"), true);
  assert.equal(isDirectInteraction(mention({ text: "shiesty me", mentionedUsernames: [], inReplyToUserId: "99" }), "ShiestyBot", "99"), true);
  assert.equal(isDirectInteraction(mention({ text: "shiesty me", mentionedUsernames: [] }), "ShiestyBot", "99"), false);
});

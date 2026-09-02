import assert from "node:assert/strict";
import test from "node:test";

import { createReplyPayload, sortMentionsOldestFirst } from "../src/x.js";
import type { XMention } from "../src/types.js";

const mention = (id: string): XMention => ({ id, text: "", authorId: "1", mentionedUsernames: [] });

test("sorts X snowflake IDs oldest first without numeric precision loss", () => {
  assert.deepEqual(
    sortMentionsOldestFirst([mention("10000000000000000003"), mention("9"), mention("10000000000000000001")]).map((item) => item.id),
    ["9", "10000000000000000001", "10000000000000000003"]
  );
});

test("reply payload is a reply with one media ID and AI disclosure", () => {
  assert.deepEqual(createReplyPayload("source", "media"), {
    text: "Shiesty fitted. 🥷",
    reply: { in_reply_to_tweet_id: "source" },
    media: { media_ids: ["media"] },
    made_with_ai: true
  });
});

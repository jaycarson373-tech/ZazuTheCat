import { OPT_IN_PHRASE, OPT_OUT_PHRASE } from "./constants.js";
import type { XMention } from "./types.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeCommand(text: string, botUsername: string): string {
  const username = botUsername.replace(/^@+/, "");
  const withoutBotMention = text.replace(
    new RegExp(`(^|\\s)@${escapeRegExp(username)}(?=\\b|$)`, "giu"),
    " "
  );

  return withoutBotMention
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

export function isDirectInteraction(mention: XMention, botUsername: string, botUserId: string): boolean {
  if (mention.inReplyToUserId === botUserId) return true;
  const normalizedUsername = botUsername.replace(/^@+/, "").toLocaleLowerCase("en-US");
  if (mention.mentionedUsernames.some((username) => username.toLocaleLowerCase("en-US") === normalizedUsername)) {
    return true;
  }
  return new RegExp(`(^|[^A-Za-z0-9_])@${escapeRegExp(normalizedUsername)}\\b`, "i").test(mention.text);
}

export type Command = "generate" | "stop" | "none";

export function classifyCommand(text: string, botUsername: string): Command {
  const command = normalizeCommand(text, botUsername);
  if (command === OPT_IN_PHRASE) return "generate";
  if (command === OPT_OUT_PHRASE) return "stop";
  return "none";
}

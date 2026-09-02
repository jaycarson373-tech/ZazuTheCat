import type { BotConfig } from "./config.js";
import { errorSummary, log } from "./logger.js";
import { NonRetryableError, UnsafeContentError } from "./retry.js";
import { classifyCommand, isDirectInteraction } from "./trigger.js";
import type { CycleResult, ImageTransformer, InteractionStore, XAuthor, XGateway, XMention } from "./types.js";

export type WorkerDependencies = {
  store: InteractionStore;
  x: XGateway;
  transformer: ImageTransformer;
  now?: () => Date;
};

function isTooOld(mention: XMention, now: Date, maxAgeMinutes: number): boolean {
  if (!mention.createdAt) return true;
  const timestamp = Date.parse(mention.createdAt);
  if (!Number.isFinite(timestamp)) return true;
  return now.getTime() - timestamp > maxAgeMinutes * 60_000;
}

function failureCode(error: unknown): string {
  if (error instanceof UnsafeContentError) return "moderation_blocked";
  if (error instanceof NonRetryableError) return "non_retryable";
  if (error instanceof Error) return error.name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100) || "error";
  return "unknown_error";
}

async function resolveAuthor(mention: XMention, x: XGateway): Promise<XAuthor | undefined> {
  if (mention.author?.profileImageUrl) return mention.author;
  return x.fetchAuthor(mention.authorId);
}

async function claimAndSkip(
  mention: XMention,
  reason: string,
  store: InteractionStore,
  result: CycleResult
): Promise<void> {
  const created = await store.claim(mention);
  if (!created) {
    result.duplicates += 1;
    return;
  }
  await store.update(mention.id, { status: "skipped", errorCode: reason });
  result.skipped += 1;
  log("interaction.skipped", { sourcePostId: mention.id, reason });
}

export async function runCycle(config: BotConfig, dependencies: WorkerDependencies): Promise<CycleResult> {
  const now = dependencies.now?.() ?? new Date();
  const cursor = await dependencies.store.getCursor();
  const batch = await dependencies.x.fetchMentions(cursor);
  const result: CycleResult = {
    fetched: batch.mentions.length,
    eligible: 0,
    duplicates: 0,
    dryRuns: 0,
    replied: 0,
    optedOut: 0,
    skipped: 0,
    failed: 0,
    newestId: batch.newestId
  };

  let liveRepliesThisCycle = 0;
  let recentGlobalReplies: number | undefined;

  for (const mention of batch.mentions) {
    if (mention.authorId === config.botUserId) continue;
    if (!isDirectInteraction(mention, config.botUsername, config.botUserId)) continue;
    const command = classifyCommand(mention.text, config.botUsername);
    if (command === "none") continue;

    const author = await resolveAuthor(mention, dependencies.x);
    if (!author) {
      await claimAndSkip(mention, "author_unavailable", dependencies.store, result);
      continue;
    }
    mention.author = author;

    if (command === "stop") {
      const created = await dependencies.store.claim(mention);
      if (!created) {
        result.duplicates += 1;
        continue;
      }
      await dependencies.store.optOut(author, mention.id);
      await dependencies.store.update(mention.id, { status: "opted_out" });
      result.optedOut += 1;
      log("interaction.opted_out", { sourcePostId: mention.id, authorId: author.id });
      continue;
    }

    result.eligible += 1;
    if (author.protected) {
      await claimAndSkip(mention, "protected_account", dependencies.store, result);
      continue;
    }
    if (mention.possiblySensitive) {
      await claimAndSkip(mention, "possibly_sensitive", dependencies.store, result);
      continue;
    }
    if (isTooOld(mention, now, config.maxMentionAgeMinutes)) {
      await claimAndSkip(mention, "mention_too_old_or_missing_date", dependencies.store, result);
      continue;
    }
    if (!author.profileImageUrl) {
      await claimAndSkip(mention, "profile_image_unavailable", dependencies.store, result);
      continue;
    }
    if (await dependencies.store.isOptedOut(author.id)) {
      await claimAndSkip(mention, "author_opted_out", dependencies.store, result);
      continue;
    }

    const created = await dependencies.store.claim(mention);
    if (!created) {
      result.duplicates += 1;
      continue;
    }

    if (config.dryRun) {
      await dependencies.store.update(mention.id, { status: "dry_run" });
      result.dryRuns += 1;
      log("interaction.dry_run", { sourcePostId: mention.id, authorId: author.id });
      continue;
    }

    if (liveRepliesThisCycle >= config.maxRepliesPerCycle) {
      await dependencies.store.update(mention.id, { status: "skipped", errorCode: "cycle_reply_limit" });
      result.skipped += 1;
      continue;
    }

    recentGlobalReplies ??= await dependencies.store.countRecentGlobal(
      new Date(now.getTime() - 60 * 60_000).toISOString()
    );
    if (recentGlobalReplies + liveRepliesThisCycle >= config.maxRepliesPerHour) {
      await dependencies.store.update(mention.id, { status: "skipped", errorCode: "global_reply_limit" });
      result.skipped += 1;
      continue;
    }
    const recentAuthorReplies = await dependencies.store.countRecentForAuthor(
      author.id,
      new Date(now.getTime() - 24 * 60 * 60_000).toISOString()
    );
    if (recentAuthorReplies >= config.maxRepliesPerAuthorPerDay) {
      await dependencies.store.update(mention.id, { status: "skipped", errorCode: "author_reply_limit" });
      result.skipped += 1;
      continue;
    }

    let replyAttempted = false;
    try {
      await dependencies.store.update(mention.id, { status: "processing" });
      const image = await dependencies.transformer.createShiestyPfp(author.profileImageUrl, mention.text);
      // Re-read the source immediately before any X write. A deleted/hidden/edited
      // source, changed author, sensitive flag, or removed opt-in cancels the reply.
      await dependencies.x.assertSourceStillActionable(mention);
      const mediaId = await dependencies.x.uploadPng(image);
      await dependencies.store.update(mention.id, { mediaId });

      // `posting` is intentionally written before the one and only create-post call.
      // If the network result is ambiguous, this interaction is held for manual review
      // instead of risking a duplicate automated reply.
      await dependencies.store.update(mention.id, { status: "posting" });
      replyAttempted = true;
      let replyId: string;
      try {
        replyId = await dependencies.x.replyWithMedia(mention.id, mediaId);
      } catch (error) {
        const summary = errorSummary(error);
        await dependencies.store.update(mention.id, {
          status: "posting",
          errorCode: "reply_result_unknown",
          errorDetail: summary.message
        });
        throw error;
      }

      await dependencies.store.update(mention.id, {
        status: "replied",
        replyPostId: replyId,
        errorCode: null,
        errorDetail: null
      });
      liveRepliesThisCycle += 1;
      result.replied += 1;
      log("interaction.replied", { sourcePostId: mention.id, replyPostId: replyId, authorId: author.id });
    } catch (error) {
      const summary = errorSummary(error);
      if (!replyAttempted) {
        await dependencies.store.update(mention.id, {
          status: "failed",
          errorCode: failureCode(error),
          errorDetail: summary.message
        });
      }
      result.failed += 1;
      log("interaction.failed", {
        sourcePostId: mention.id,
        authorId: author.id,
        code: failureCode(error),
        message: summary.message
      });
    }
  }

  if (batch.newestId) await dependencies.store.setCursor(batch.newestId);
  log("cycle.complete", result as unknown as Record<string, unknown>);
  return result;
}

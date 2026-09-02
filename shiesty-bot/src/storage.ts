import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { BotConfig } from "./config.js";
import type { InteractionPatch, InteractionStore, XAuthor, XMention } from "./types.js";

const INTERACTIONS = "shiesty_bot_interactions";
const OPT_OUTS = "shiesty_bot_opt_outs";
const CURSORS = "shiesty_bot_cursors";

function cleanDetail(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

export class SupabaseInteractionStore implements InteractionStore {
  private readonly client: SupabaseClient;

  constructor(private readonly config: BotConfig, client?: SupabaseClient) {
    this.client = client ?? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  async getCursor(): Promise<string | undefined> {
    const { data, error } = await this.client
      .from(CURSORS)
      .select("since_id")
      .eq("bot_project", this.config.botProject)
      .maybeSingle<{ since_id: string | null }>();
    if (error) throw error;
    return data?.since_id ?? undefined;
  }

  async setCursor(postId: string): Promise<void> {
    const { error } = await this.client.from(CURSORS).upsert({
      bot_project: this.config.botProject,
      since_id: postId,
      updated_at: new Date().toISOString()
    }, { onConflict: "bot_project" });
    if (error) throw error;
  }

  async claim(mention: XMention): Promise<boolean> {
    const { error } = await this.client.from(INTERACTIONS).insert({
      bot_project: this.config.botProject,
      source_post_id: mention.id,
      author_id: mention.authorId,
      author_username: mention.author?.username ?? null,
      source_created_at: mention.createdAt ?? null,
      status: "claimed"
    });
    if (!error) return true;
    if (error.code === "23505") return false;
    throw error;
  }

  async update(postId: string, patch: InteractionPatch): Promise<void> {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.mediaId !== undefined) update.media_id = patch.mediaId;
    if (patch.replyPostId !== undefined) update.reply_post_id = patch.replyPostId;
    if (patch.errorCode !== undefined) update.error_code = patch.errorCode?.slice(0, 100) ?? null;
    if (patch.errorDetail !== undefined) update.error_detail = cleanDetail(patch.errorDetail) ?? null;

    const { error } = await this.client
      .from(INTERACTIONS)
      .update(update)
      .eq("bot_project", this.config.botProject)
      .eq("source_post_id", postId);
    if (error) throw error;
  }

  async isOptedOut(authorId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(OPT_OUTS)
      .select("author_id")
      .eq("bot_project", this.config.botProject)
      .eq("author_id", authorId)
      .maybeSingle<{ author_id: string }>();
    if (error) throw error;
    return Boolean(data);
  }

  async optOut(author: XAuthor, sourcePostId: string): Promise<void> {
    const { error } = await this.client.from(OPT_OUTS).upsert({
      bot_project: this.config.botProject,
      author_id: author.id,
      author_username: author.username,
      source_post_id: sourcePostId,
      opted_out_at: new Date().toISOString()
    }, { onConflict: "bot_project,author_id" });
    if (error) throw error;
  }

  private async countSince(sinceIso: string, authorId?: string): Promise<number> {
    let query = this.client
      .from(INTERACTIONS)
      .select("source_post_id", { count: "exact", head: true })
      .eq("bot_project", this.config.botProject)
      .gte("updated_at", sinceIso)
      .in("status", ["posting", "replied"]);
    if (authorId) query = query.eq("author_id", authorId);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  countRecentGlobal(sinceIso: string): Promise<number> {
    return this.countSince(sinceIso);
  }

  countRecentForAuthor(authorId: string, sinceIso: string): Promise<number> {
    return this.countSince(sinceIso, authorId);
  }
}

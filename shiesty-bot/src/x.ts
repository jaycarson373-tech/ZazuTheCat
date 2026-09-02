import { TwitterApi } from "twitter-api-v2";

import type { BotConfig } from "./config.js";
import { oauth1IsConfigured } from "./config.js";
import { OUTPUT_IMAGE_MIME_TYPE, REPLY_TEXT } from "./constants.js";
import { NonRetryableError } from "./retry.js";
import { classifyCommand, isDirectInteraction } from "./trigger.js";
import type { XAuthor, XGateway, XMention } from "./types.js";

type XTimelineResponse = {
  data?: Array<{
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
    conversation_id?: string;
    in_reply_to_user_id?: string;
    possibly_sensitive?: boolean;
    entities?: { mentions?: Array<{ username: string }> };
  }>;
  includes?: {
    users?: Array<{
      id: string;
      username: string;
      name?: string;
      profile_image_url?: string;
      protected?: boolean;
    }>;
  };
  meta?: {
    newest_id?: string;
    next_token?: string;
  };
};

type XCreatePostResponse = { data?: { id?: string } };
type XSinglePostResponse = { data?: NonNullable<XTimelineResponse["data"]>[number] };

function mapAuthor(author: NonNullable<NonNullable<XTimelineResponse["includes"]>["users"]>[number]): XAuthor {
  return {
    id: author.id,
    username: author.username,
    name: author.name,
    profileImageUrl: author.profile_image_url,
    protected: author.protected
  };
}

function compareIdsAscending(left: XMention, right: XMention): number {
  try {
    const difference = BigInt(left.id) - BigInt(right.id);
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  } catch {
    return left.id.localeCompare(right.id);
  }
}

export function sortMentionsOldestFirst(mentions: XMention[]): XMention[] {
  return [...mentions].sort(compareIdsAscending);
}

export function createReplyPayload(sourcePostId: string, mediaId: string) {
  return {
    text: REPLY_TEXT,
    reply: { in_reply_to_tweet_id: sourcePostId },
    media: { media_ids: [mediaId] },
    made_with_ai: true as const
  };
}

function sameUsername(left: string, right: string): boolean {
  return left.replace(/^@+/, "").toLocaleLowerCase("en-US") === right.replace(/^@+/, "").toLocaleLowerCase("en-US");
}

export class TwitterGateway implements XGateway {
  private readonly readClient: TwitterApi;
  private readonly oauth1Client?: TwitterApi;

  constructor(private readonly config: BotConfig) {
    if (oauth1IsConfigured(config)) {
      this.oauth1Client = new TwitterApi({
        appKey: config.xApiKey,
        appSecret: config.xApiSecret,
        accessToken: config.xAccessToken,
        accessSecret: config.xAccessTokenSecret
      });
    }
    this.readClient = config.xBearerToken
      ? new TwitterApi(config.xBearerToken)
      : this.oauth1Client!;
  }

  async verifyIdentity(): Promise<void> {
    const lookup = await this.readClient.v2.userByUsername(this.config.botUsername, {
      "user.fields": ["id", "username"]
    });
    if (!lookup.data || lookup.data.id !== this.config.botUserId || !sameUsername(lookup.data.username, this.config.botUsername)) {
      throw new Error("X read identity does not match BOT_USER_ID and BOT_USERNAME");
    }

    if (!this.oauth1Client) {
      if (!this.config.dryRun) throw new Error("Live mode has no OAuth 1.0a write client");
      return;
    }

    const [v1Identity, v2Identity] = await Promise.all([
      this.oauth1Client.v1.verifyCredentials({ skip_status: true, include_email: false }),
      this.oauth1Client.v2.me({ "user.fields": ["id", "username"] })
    ]);
    if (
      v1Identity.id_str !== this.config.botUserId ||
      !sameUsername(v1Identity.screen_name, this.config.botUsername) ||
      v2Identity.data.id !== this.config.botUserId ||
      !sameUsername(v2Identity.data.username, this.config.botUsername)
    ) {
      throw new Error("X OAuth 1.0a write identity does not match BOT_USER_ID and BOT_USERNAME");
    }
  }

  async fetchMentions(sinceId?: string): Promise<{ mentions: XMention[]; newestId?: string }> {
    const mentionsById = new Map<string, XMention>();
    let newestId: string | undefined;
    let paginationToken: string | undefined;

    for (let page = 0; page < this.config.maxPagesPerPoll; page += 1) {
      const response = await this.readClient.v2.get<XTimelineResponse>(`users/${this.config.botUserId}/mentions`, {
        max_results: 100,
        ...(sinceId ? { since_id: sinceId } : {}),
        ...(paginationToken ? { pagination_token: paginationToken } : {}),
        expansions: ["author_id"],
        "tweet.fields": [
          "author_id",
          "created_at",
          "conversation_id",
          "entities",
          "in_reply_to_user_id",
          "possibly_sensitive",
          "referenced_tweets"
        ],
        "user.fields": ["id", "username", "name", "profile_image_url", "protected"]
      });
      newestId ??= response.meta?.newest_id;
      const users = new Map((response.includes?.users ?? []).map((user) => [user.id, mapAuthor(user)]));
      for (const post of response.data ?? []) {
        if (!post.author_id) continue;
        mentionsById.set(post.id, {
          id: post.id,
          text: post.text,
          authorId: post.author_id,
          createdAt: post.created_at,
          conversationId: post.conversation_id,
          inReplyToUserId: post.in_reply_to_user_id,
          possiblySensitive: post.possibly_sensitive,
          mentionedUsernames: post.entities?.mentions?.map((mention) => mention.username) ?? [],
          author: users.get(post.author_id)
        });
      }

      paginationToken = response.meta?.next_token;
      if (!paginationToken) break;
      if (page === this.config.maxPagesPerPoll - 1) {
        throw new Error(`Mention backlog exceeded MAX_PAGES_PER_POLL=${this.config.maxPagesPerPoll}; increase it before advancing the cursor`);
      }
    }

    const mentions = sortMentionsOldestFirst([...mentionsById.values()]);
    newestId ??= mentions.at(-1)?.id;
    return { mentions, newestId };
  }

  async fetchAuthor(authorId: string): Promise<XAuthor | undefined> {
    const response = await this.readClient.v2.user(authorId, {
      "user.fields": ["id", "username", "name", "profile_image_url", "protected"]
    });
    if (!response.data) return undefined;
    return mapAuthor(response.data);
  }

  async assertSourceStillActionable(mention: XMention): Promise<void> {
    const response = await this.readClient.v2.get<XSinglePostResponse>(`tweets/${mention.id}`, {
      "tweet.fields": ["author_id", "entities", "in_reply_to_user_id", "possibly_sensitive"]
    });
    const post = response.data;
    if (!post || post.author_id !== mention.authorId) {
      throw new NonRetryableError("Source post is no longer readable from the expected author");
    }
    const fresh: XMention = {
      id: post.id,
      text: post.text,
      authorId: post.author_id,
      inReplyToUserId: post.in_reply_to_user_id,
      possiblySensitive: post.possibly_sensitive,
      mentionedUsernames: post.entities?.mentions?.map((item) => item.username) ?? []
    };
    if (
      fresh.possiblySensitive ||
      !isDirectInteraction(fresh, this.config.botUsername, this.config.botUserId) ||
      classifyCommand(fresh.text, this.config.botUsername) !== "generate"
    ) {
      throw new NonRetryableError("Source post no longer satisfies the exact direct opt-in gate");
    }
  }

  async uploadPng(image: Buffer): Promise<string> {
    if (!this.oauth1Client) throw new Error("X OAuth 1.0a credentials are required to upload media");
    return this.oauth1Client.v2.uploadMedia(image, {
      media_type: OUTPUT_IMAGE_MIME_TYPE,
      media_category: "tweet_image"
    });
  }

  async replyWithMedia(sourcePostId: string, mediaId: string): Promise<string> {
    if (!this.oauth1Client) throw new Error("X OAuth 1.0a credentials are required to post replies");
    // Raw v2 call keeps made_with_ai even if an installed SDK's convenience type lags the API.
    const response = await this.oauth1Client.v2.post<XCreatePostResponse>(
      "tweets",
      createReplyPayload(sourcePostId, mediaId)
    );
    const replyId = response.data?.id;
    if (!replyId) throw new NonRetryableError("X create-post response did not include a post ID");
    return replyId;
  }
}

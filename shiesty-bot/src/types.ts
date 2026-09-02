export type XAuthor = {
  id: string;
  username: string;
  name?: string;
  profileImageUrl?: string;
  protected?: boolean;
};

export type XMention = {
  id: string;
  text: string;
  authorId: string;
  createdAt?: string;
  conversationId?: string;
  inReplyToUserId?: string;
  possiblySensitive?: boolean;
  mentionedUsernames: string[];
  author?: XAuthor;
};

export type InteractionStatus =
  | "claimed"
  | "processing"
  | "posting"
  | "replied"
  | "dry_run"
  | "opted_out"
  | "skipped"
  | "failed";

export type InteractionPatch = {
  status?: InteractionStatus;
  mediaId?: string | null;
  replyPostId?: string | null;
  errorCode?: string | null;
  errorDetail?: string | null;
};

export type CycleResult = {
  fetched: number;
  eligible: number;
  duplicates: number;
  dryRuns: number;
  replied: number;
  optedOut: number;
  skipped: number;
  failed: number;
  newestId?: string;
};

export interface InteractionStore {
  getCursor(): Promise<string | undefined>;
  setCursor(postId: string): Promise<void>;
  claim(mention: XMention): Promise<boolean>;
  update(postId: string, patch: InteractionPatch): Promise<void>;
  isOptedOut(authorId: string): Promise<boolean>;
  optOut(author: XAuthor, sourcePostId: string): Promise<void>;
  countRecentGlobal(sinceIso: string): Promise<number>;
  countRecentForAuthor(authorId: string, sinceIso: string): Promise<number>;
}

export interface XGateway {
  verifyIdentity(): Promise<void>;
  fetchMentions(sinceId?: string): Promise<{ mentions: XMention[]; newestId?: string }>;
  fetchAuthor(authorId: string): Promise<XAuthor | undefined>;
  assertSourceStillActionable(mention: XMention): Promise<void>;
  uploadPng(image: Buffer): Promise<string>;
  replyWithMedia(sourcePostId: string, mediaId: string): Promise<string>;
}

export interface ImageTransformer {
  createShiestyPfp(profileImageUrl: string, sourceText: string): Promise<Buffer>;
}

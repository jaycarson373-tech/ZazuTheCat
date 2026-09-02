import { BOT_PROJECT, USER_AGENT, X_IMAGE_MAX_BYTES } from "./constants.js";

export type BotConfig = {
  botUsername: string;
  botUserId: string;
  botProject: string;
  dryRun: boolean;
  xAiAutoreplyApproved: boolean;
  xBearerToken?: string;
  xApiKey?: string;
  xApiSecret?: string;
  xAccessToken?: string;
  xAccessTokenSecret?: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  openaiApiKey?: string;
  openaiBaseUrl: string;
  openaiImageModel: string;
  openaiModerationModel: string;
  pollIntervalMs: number;
  maxPagesPerPoll: number;
  maxRepliesPerCycle: number;
  maxRepliesPerHour: number;
  maxRepliesPerAuthorPerDay: number;
  maxMentionAgeMinutes: number;
  maxProfileImageBytes: number;
  downloadTimeoutMs: number;
  openaiTimeoutMs: number;
  userAgent: string;
};

function read(env: NodeJS.ProcessEnv, name: string): string | undefined {
  let value = env[name]?.trim();
  if (!value) return undefined;
  if (value.length >= 2) {
    const first = value.at(0);
    const last = value.at(-1);
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      value = value.slice(1, -1).trim();
    }
  }
  return value || undefined;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = read(env, name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function boolean(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const value = read(env, name);
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be exactly true or false`);
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  bounds: { min: number; max: number }
): number {
  const raw = read(env, name);
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < bounds.min || value > bounds.max) {
    throw new Error(`${name} must be between ${bounds.min} and ${bounds.max}`);
  }
  return value;
}

function normalizedUsername(value: string): string {
  const username = value.replace(/^@+/, "").trim();
  if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) {
    throw new Error("BOT_USERNAME must be a valid X username without a URL");
  }
  return username;
}

function hasCompleteOAuth1(config: Pick<BotConfig, "xApiKey" | "xApiSecret" | "xAccessToken" | "xAccessTokenSecret">) {
  return Boolean(config.xApiKey && config.xApiSecret && config.xAccessToken && config.xAccessTokenSecret);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const config: BotConfig = {
    botUsername: normalizedUsername(required(env, "BOT_USERNAME")),
    botUserId: required(env, "BOT_USER_ID"),
    botProject: read(env, "BOT_PROJECT") ?? BOT_PROJECT,
    dryRun: boolean(env, "BOT_DRY_RUN", true),
    xAiAutoreplyApproved: boolean(env, "X_AI_AUTOREPLY_APPROVED", false),
    xBearerToken: read(env, "X_BEARER_TOKEN"),
    xApiKey: read(env, "X_API_KEY"),
    xApiSecret: read(env, "X_API_SECRET"),
    xAccessToken: read(env, "X_ACCESS_TOKEN"),
    xAccessTokenSecret: read(env, "X_ACCESS_TOKEN_SECRET"),
    supabaseUrl: required(env, "SUPABASE_URL"),
    supabaseServiceRoleKey: required(env, "SUPABASE_SERVICE_ROLE_KEY"),
    openaiApiKey: read(env, "OPENAI_API_KEY"),
    openaiBaseUrl: read(env, "OPENAI_BASE_URL") ?? "https://api.openai.com/v1",
    openaiImageModel: read(env, "OPENAI_IMAGE_MODEL") ?? "gpt-image-2",
    openaiModerationModel: read(env, "OPENAI_MODERATION_MODEL") ?? "omni-moderation-latest",
    pollIntervalMs: integer(env, "POLL_INTERVAL_MS", 60_000, { min: 30_000, max: 3_600_000 }),
    maxPagesPerPoll: integer(env, "MAX_PAGES_PER_POLL", 5, { min: 1, max: 20 }),
    maxRepliesPerCycle: integer(env, "MAX_REPLIES_PER_CYCLE", 5, { min: 1, max: 25 }),
    maxRepliesPerHour: integer(env, "MAX_REPLIES_PER_HOUR", 20, { min: 1, max: 100 }),
    maxRepliesPerAuthorPerDay: integer(env, "MAX_REPLIES_PER_AUTHOR_PER_DAY", 2, { min: 1, max: 10 }),
    maxMentionAgeMinutes: integer(env, "MAX_MENTION_AGE_MINUTES", 1_440, { min: 1, max: 10_080 }),
    maxProfileImageBytes: integer(env, "MAX_PROFILE_IMAGE_BYTES", X_IMAGE_MAX_BYTES, {
      min: 100_000,
      max: X_IMAGE_MAX_BYTES
    }),
    downloadTimeoutMs: integer(env, "DOWNLOAD_TIMEOUT_MS", 10_000, { min: 1_000, max: 30_000 }),
    openaiTimeoutMs: integer(env, "OPENAI_TIMEOUT_MS", 120_000, { min: 10_000, max: 180_000 }),
    userAgent: read(env, "USER_AGENT") ?? USER_AGENT
  };

  if (!config.xBearerToken && !hasCompleteOAuth1(config)) {
    throw new Error("Set X_BEARER_TOKEN or all four X OAuth 1.0a credentials for mention reads");
  }

  if (!config.dryRun) {
    if (read(env, "X_AI_AUTOREPLY_APPROVED") !== "true") {
      throw new Error("Live mode requires X_AI_AUTOREPLY_APPROVED=true after written approval from X");
    }
    if (!hasCompleteOAuth1(config)) {
      throw new Error("Live mode requires X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET");
    }
    if (!config.openaiApiKey) {
      throw new Error("Live mode requires OPENAI_API_KEY");
    }
  }

  return config;
}

export function oauth1IsConfigured(config: BotConfig): config is BotConfig & Required<Pick<BotConfig,
  "xApiKey" | "xApiSecret" | "xAccessToken" | "xAccessTokenSecret"
>> {
  return hasCompleteOAuth1(config);
}

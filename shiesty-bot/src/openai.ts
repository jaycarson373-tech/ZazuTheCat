import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { BotConfig } from "./config.js";
import { OUTPUT_IMAGE_MIME_TYPE, SHIESTY_EDIT_PROMPT, X_IMAGE_MAX_BYTES } from "./constants.js";
import { downloadProfileImage } from "./download.js";
import { HttpError, NonRetryableError, UnsafeContentError, throwForBadResponse, withRetry } from "./retry.js";
import type { ImageTransformer } from "./types.js";

type ProfileDownloader = typeof downloadProfileImage;

type ModerationResponse = {
  results?: Array<{ flagged?: boolean }>;
};

type ImageEditResponse = {
  data?: Array<{ b64_json?: string }>;
};

function asDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function safeFilenameForMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "source.jpg";
  if (mimeType === "image/webp") return "source.webp";
  return "source.png";
}

function isPng(buffer: Buffer): boolean {
  return buffer.length >= 8 && buffer[0] === 0x89 && buffer.subarray(1, 4).toString("ascii") === "PNG";
}

function moderationStage(error: HttpError): "input" | "output" | undefined {
  if (error.status !== 400) return undefined;
  try {
    const payload = JSON.parse(error.responseBody) as {
      error?: { code?: string; moderation_details?: { moderation_stage?: string } };
    };
    if (payload.error?.code !== "moderation_blocked") return undefined;
    return payload.error.moderation_details?.moderation_stage === "output" ? "output" : "input";
  } catch {
    return undefined;
  }
}

export class OpenAiShiestyTransformer implements ImageTransformer {
  constructor(
    private readonly config: BotConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly profileDownloader: ProfileDownloader = downloadProfileImage
  ) {}

  private async postJson<T>(endpoint: string, body: unknown, service: string): Promise<T> {
    if (!this.config.openaiApiKey) throw new Error("OPENAI_API_KEY is required for image generation");
    return withRetry(async () => {
      const response = await this.fetchImpl(`${this.config.openaiBaseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.openaiApiKey}`,
          "Content-Type": "application/json",
          "User-Agent": this.config.userAgent
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.openaiTimeoutMs)
      });
      await throwForBadResponse(service, response);
      return (await response.json()) as T;
    });
  }

  private async assertModerationSafe(
    buffer: Buffer,
    mimeType: string,
    sourceText: string | undefined,
    stage: "input" | "output"
  ): Promise<void> {
    const input: Array<Record<string, unknown>> = [];
    if (sourceText) input.push({ type: "text", text: sourceText.slice(0, 1_000) });
    input.push({ type: "image_url", image_url: { url: asDataUrl(buffer, mimeType) } });
    const payload = await this.postJson<ModerationResponse>("/moderations", {
      model: this.config.openaiModerationModel,
      input
    }, `OpenAI ${stage} moderation`);
    if (!payload.results?.length) throw new NonRetryableError(`OpenAI ${stage} moderation returned no result`);
    if (payload.results.some((result) => result.flagged)) throw new UnsafeContentError(stage);
  }

  private async editImage(source: Buffer, mimeType: string): Promise<Buffer> {
    if (!this.config.openaiApiKey) throw new Error("OPENAI_API_KEY is required for image generation");
    return withRetry(async () => {
      const form = new FormData();
      form.append("model", this.config.openaiImageModel);
      form.append("image", new Blob([new Uint8Array(source)], { type: mimeType }), safeFilenameForMime(mimeType));
      form.append("prompt", SHIESTY_EDIT_PROMPT);
      form.append("n", "1");
      form.append("size", "1024x1024");
      form.append("quality", "medium");
      form.append("output_format", "png");
      form.append("moderation", "auto");

      const response = await this.fetchImpl(`${this.config.openaiBaseUrl}/images/edits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.openaiApiKey}`,
          "User-Agent": this.config.userAgent
        },
        body: form,
        signal: AbortSignal.timeout(this.config.openaiTimeoutMs)
      });

      try {
        await throwForBadResponse("OpenAI image edit", response);
      } catch (error) {
        if (error instanceof HttpError) {
          const stage = moderationStage(error);
          if (stage) throw new UnsafeContentError(stage);
        }
        throw error;
      }

      const payload = (await response.json()) as ImageEditResponse;
      const encoded = payload.data?.[0]?.b64_json;
      if (!encoded) throw new NonRetryableError("OpenAI image edit returned no base64 image");
      const output = Buffer.from(encoded, "base64");
      if (!isPng(output)) throw new NonRetryableError("OpenAI image edit output was not a PNG");
      if (output.byteLength > X_IMAGE_MAX_BYTES) throw new NonRetryableError("Generated image exceeds X's 5 MB image limit");
      return output;
    }, { attempts: 3, initialDelayMs: 1_000, maxDelayMs: 8_000 });
  }

  async createShiestyPfp(profileImageUrl: string, sourceText: string): Promise<Buffer> {
    const tempDirectory = await fs.mkdtemp(path.join(tmpdir(), "shiesty-pfp-"));
    try {
      const source = await this.profileDownloader(profileImageUrl, {
        maxBytes: this.config.maxProfileImageBytes,
        timeoutMs: this.config.downloadTimeoutMs,
        userAgent: this.config.userAgent,
        fetchImpl: this.fetchImpl
      });
      await fs.writeFile(path.join(tempDirectory, safeFilenameForMime(source.mimeType)), source.buffer);
      await this.assertModerationSafe(source.buffer, source.mimeType, sourceText, "input");
      const output = await this.editImage(source.buffer, source.mimeType);
      await fs.writeFile(path.join(tempDirectory, "shiesty.png"), output);
      await this.assertModerationSafe(output, OUTPUT_IMAGE_MIME_TYPE, undefined, "output");
      return output;
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }
}

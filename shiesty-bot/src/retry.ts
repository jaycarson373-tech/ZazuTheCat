import { setTimeout as sleep } from "node:timers/promises";

export class NonRetryableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "NonRetryableError";
  }
}

export class UnsafeContentError extends NonRetryableError {
  constructor(stage: "input" | "output") {
    super(`${stage} image was rejected by safety moderation`);
    this.name = "UnsafeContentError";
  }
}

export class HttpError extends Error {
  constructor(
    readonly service: string,
    readonly status: number,
    readonly responseBody: string,
    readonly retryable: boolean
  ) {
    super(`${service} returned HTTP ${status}`);
    this.name = "HttpError";
  }
}

export async function throwForBadResponse(service: string, response: Response): Promise<void> {
  if (response.ok) return;
  const body = (await response.text().catch(() => "")).slice(0, 1_000);
  throw new HttpError(service, response.status, body, response.status === 429 || response.status >= 500);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; initialDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 750;
  const maxDelayMs = options.maxDelayMs ?? 5_000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = error instanceof HttpError ? error.retryable : !(error instanceof NonRetryableError);
      if (!retryable || attempt === attempts) throw error;
      const delay = Math.min(maxDelayMs, initialDelayMs * 2 ** (attempt - 1)) + Math.floor(Math.random() * 150);
      await sleep(delay);
    }
  }

  throw lastError;
}

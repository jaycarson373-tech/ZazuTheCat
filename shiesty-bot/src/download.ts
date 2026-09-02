import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

import { INPUT_IMAGE_MIME_TYPES, PROFILE_IMAGE_HOSTS } from "./constants.js";
import { NonRetryableError, throwForBadResponse, withRetry } from "./retry.js";

export type DownloadedImage = {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

type Lookup = typeof dnsLookup;

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLocaleLowerCase("en-US").split("%")[0] ?? "";
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }
  return false;
}

export function isPublicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !isPrivateIpv4(address);
  if (family === 6) return !isPrivateIpv6(address);
  return false;
}

export function parseAllowedProfileUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new NonRetryableError("Profile image URL is invalid");
  }

  if (url.protocol !== "https:") throw new NonRetryableError("Profile image URL must use HTTPS");
  if (url.username || url.password) throw new NonRetryableError("Profile image URL must not include credentials");
  if (url.port && url.port !== "443") throw new NonRetryableError("Profile image URL must use the default HTTPS port");
  if (!PROFILE_IMAGE_HOSTS.has(url.hostname.toLocaleLowerCase("en-US"))) {
    throw new NonRetryableError("Profile image URL host is not allowed");
  }
  return url;
}

export function toOriginalProfileImageUrl(rawUrl: string): string {
  const url = parseAllowedProfileUrl(rawUrl);
  url.pathname = url.pathname.replace(/_(normal|bigger|mini)(\.[^.\/]+)$/i, "$2");
  return url.toString();
}

async function assertPublicDns(hostname: string, lookup: Lookup): Promise<void> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  if (results.length === 0 || results.some((result) => !isPublicIp(result.address))) {
    throw new NonRetryableError("Profile image host resolved to a non-public address");
  }
}

function detectMimeType(buffer: Buffer): DownloadedImage["mimeType"] | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer.subarray(1, 4).toString("ascii") === "PNG" &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return undefined;
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) throw new NonRetryableError("Profile image response had no body");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new NonRetryableError("Profile image exceeds the configured byte limit");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

export async function downloadProfileImage(
  rawUrl: string,
  options: {
    maxBytes: number;
    timeoutMs: number;
    userAgent: string;
    fetchImpl?: typeof fetch;
    lookup?: Lookup;
  }
): Promise<DownloadedImage> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookup = options.lookup ?? dnsLookup;
  let url = parseAllowedProfileUrl(toOriginalProfileImageUrl(rawUrl));

  return withRetry(async () => {
    for (let redirects = 0; redirects <= 2; redirects += 1) {
      await assertPublicDns(url.hostname, lookup);
      const response = await fetchImpl(url, {
        redirect: "manual",
        headers: { Accept: "image/webp,image/png,image/jpeg", "User-Agent": options.userAgent },
        signal: AbortSignal.timeout(options.timeoutMs)
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 2) throw new NonRetryableError("Profile image redirected too many times");
        url = parseAllowedProfileUrl(new URL(location, url).toString());
        continue;
      }

      await throwForBadResponse("X profile image", response);
      const declaredLength = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
        throw new NonRetryableError("Profile image exceeds the configured byte limit");
      }
      const declaredType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLocaleLowerCase("en-US");
      if (declaredType && !INPUT_IMAGE_MIME_TYPES.has(declaredType) && declaredType !== "application/octet-stream") {
        throw new NonRetryableError("Profile image response did not contain an accepted image type");
      }
      const buffer = await readBodyWithLimit(response, options.maxBytes);
      const mimeType = detectMimeType(buffer);
      if (!mimeType || (declaredType && INPUT_IMAGE_MIME_TYPES.has(declaredType) && declaredType !== mimeType)) {
        throw new NonRetryableError("Profile image bytes did not match an accepted image type");
      }
      return { buffer, mimeType };
    }
    throw new NonRetryableError("Profile image download failed");
  });
}

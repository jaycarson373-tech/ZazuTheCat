import assert from "node:assert/strict";
import test from "node:test";

import { downloadProfileImage, isPublicIp, parseAllowedProfileUrl, toOriginalProfileImageUrl } from "../src/download.js";

test("profile URLs are HTTPS and restricted to X image hosts", () => {
  assert.equal(parseAllowedProfileUrl("https://pbs.twimg.com/profile_images/1/a_normal.jpg").hostname, "pbs.twimg.com");
  assert.throws(() => parseAllowedProfileUrl("http://pbs.twimg.com/a.jpg"), /HTTPS/);
  assert.throws(() => parseAllowedProfileUrl("https://pbs.twimg.com.evil.example/a.jpg"), /not allowed/);
  assert.throws(() => parseAllowedProfileUrl("https://user:pass@pbs.twimg.com/a.jpg"), /credentials/);
});

test("upgrades the normal X avatar URL without changing its trusted host", () => {
  assert.equal(
    toOriginalProfileImageUrl("https://pbs.twimg.com/profile_images/123/avatar_normal.jpg"),
    "https://pbs.twimg.com/profile_images/123/avatar.jpg"
  );
});

test("rejects private, loopback, link-local, and mapped-private IPs", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.1.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPublicIp(address), false, address);
  }
  assert.equal(isPublicIp("8.8.8.8"), true);
  assert.equal(isPublicIp("2606:4700:4700::1111"), true);
});

const publicLookup = (async () => [{ address: "8.8.8.8", family: 4 }]) as never;

test("validates every redirect and rejects a redirect off X image hosts", async () => {
  let fetches = 0;
  const fetchMock = (async () => {
    fetches += 1;
    return new Response(null, {
      status: 302,
      headers: { location: "https://attacker.example/avatar.jpg" }
    });
  }) as typeof fetch;

  await assert.rejects(
    downloadProfileImage("https://pbs.twimg.com/profile_images/1/a_normal.jpg", {
      maxBytes: 5_000_000,
      timeoutMs: 1_000,
      userAgent: "test",
      fetchImpl: fetchMock,
      lookup: publicLookup
    }),
    /not allowed/
  );
  assert.equal(fetches, 1);
});

test("enforces the streaming byte cap even without content-length", async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const fetchMock = (async () => new Response(png, {
    status: 200,
    headers: { "content-type": "image/png" }
  })) as typeof fetch;

  await assert.rejects(
    downloadProfileImage("https://pbs.twimg.com/profile_images/1/a.png", {
      maxBytes: 8,
      timeoutMs: 1_000,
      userAgent: "test",
      fetchImpl: fetchMock,
      lookup: publicLookup
    }),
    /byte limit/
  );
});

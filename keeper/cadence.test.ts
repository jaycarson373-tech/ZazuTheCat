import assert from "node:assert/strict";
import test from "node:test";
import { cadenceWindow, REQUIRED_INTERVAL_SECONDS } from "./cadence";

test("the production cadence opens exactly at fifteen minutes", () => {
  const lastActionTime = 1_000n;
  const before = cadenceWindow({
    chainTimestamp: lastActionTime + REQUIRED_INTERVAL_SECONDS - 1n,
    lastActionTime,
    interval: REQUIRED_INTERVAL_SECONDS,
  });
  assert.deepEqual(before, {
    eligible: false,
    nextEligibleTime: 1_900n,
    secondsRemaining: 1n,
  });

  const boundary = cadenceWindow({
    chainTimestamp: lastActionTime + REQUIRED_INTERVAL_SECONDS,
    lastActionTime,
    interval: REQUIRED_INTERVAL_SECONDS,
  });
  assert.deepEqual(boundary, {
    eligible: true,
    nextEligibleTime: 1_900n,
    secondsRemaining: 0n,
  });
});

test("a completed claim stays gated even when an older buyback window is open", () => {
  const chainTimestamp = 2_000n;
  const vault = cadenceWindow({
    chainTimestamp,
    lastActionTime: 500n,
    interval: REQUIRED_INTERVAL_SECONDS,
  });
  const collector = cadenceWindow({
    chainTimestamp,
    lastActionTime: 1_900n,
    interval: REQUIRED_INTERVAL_SECONDS,
  });

  assert.equal(vault.eligible, true);
  assert.equal(collector.eligible, false);
  assert.equal(collector.secondsRemaining, 800n);
});

test("invalid cadence inputs fail closed", () => {
  assert.throws(
    () => cadenceWindow({ chainTimestamp: -1n, lastActionTime: 0n, interval: 900n }),
    /non-negative/,
  );
  assert.throws(
    () => cadenceWindow({ chainTimestamp: 0n, lastActionTime: 0n, interval: 0n }),
    /positive/,
  );
});

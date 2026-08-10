import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCollectorProof,
  classifyCollectorCall,
  decodeActivityLog,
  encodeActivityCursor,
  isMeaningfulActivity,
  parseActivityCursor,
  safeActivityBlock,
} from "../lib/onchain/activity";
import { LatestRequestGuard } from "../lib/latest-request";
import {
  BUYBACK_EXECUTED_TOPIC,
  CREATOR_FEES_FORWARDED_TOPIC,
  DIRECT_ZAZU_BURNED_TOPIC,
} from "../lib/onchain/buyback-vault";
import type { RpcLog } from "../lib/onchain/rpc";

const transactionHash = `0x${"ab".repeat(32)}`;
const address = (suffix: string) => `0x${suffix.padStart(40, "0")}`;
const word = (value: bigint | string) => {
  const body = typeof value === "bigint" ? value.toString(16) : value.replace(/^0x/, "");
  return body.padStart(64, "0");
};
const topicAddress = (value: string) => `0x${word(value)}`;
const topicUint = (value: bigint) => `0x${word(value)}`;
const data = (...values: bigint[]) => `0x${values.map(word).join("")}`;

function log(overrides: Partial<RpcLog>): RpcLog {
  return {
    address: address("1"),
    blockNumber: "0x64",
    data: "0x",
    logIndex: "0x2",
    topics: [],
    transactionHash,
    ...overrides,
  };
}

test("decodes BuybackExecuted as a buyback and burn proof", () => {
  const decoded = decodeActivityLog(log({
    topics: [
      BUYBACK_EXECUTED_TOPIC,
      topicUint(7n),
      topicAddress(address("22")),
      topicAddress(address("dead")),
    ],
    data: data(500n, 12_345n, 1_800_000_000n),
  }));

  assert.equal(decoded.kind, "buyback_burn");
  assert.equal(decoded.executionId, 7n);
  assert.equal(decoded.amountIn, 500n);
  assert.equal(decoded.zazuAmount, 12_345n);
  assert.equal(decoded.timestamp, 1_800_000_000n);
  assert.equal(decoded.destination, address("dead"));
});

test("does not label a buyback as burned when its event destination is not dead", () => {
  const decoded = decodeActivityLog(log({
    topics: [
      BUYBACK_EXECUTED_TOPIC,
      topicUint(8n),
      topicAddress(address("22")),
      topicAddress(address("1234")),
    ],
    data: data(500n, 12_345n, 1_800_000_000n),
  }));
  assert.equal(decoded.kind, "buyback");
  assert.equal(decoded.destination, address("1234"));
});

test("decodes direct token burns and creator-fee forwarding", () => {
  const direct = decodeActivityLog(log({
    topics: [DIRECT_ZAZU_BURNED_TOPIC, topicAddress(address("dead"))],
    data: data(44_000n, 1_800_000_001n),
  }));
  assert.equal(direct.kind, "direct_burn");
  assert.equal(direct.zazuAmount, 44_000n);
  assert.equal(direct.destination, address("dead"));

  const forwarded = decodeActivityLog(log({
    topics: [CREATOR_FEES_FORWARDED_TOPIC],
    data: data(900n, 44_000n),
  }));
  assert.equal(forwarded.kind, "fees_forwarded");
  assert.equal(forwarded.wrappedNativeAmount, 900n);
  assert.equal(forwarded.zazuAmount, 44_000n);
  assert.equal(forwarded.timestamp, null);
  assert.equal(isMeaningfulActivity(forwarded), true);
});

test("filters zero-value fee-forwarding events while retaining real activity", () => {
  const empty = decodeActivityLog(log({
    topics: [CREATOR_FEES_FORWARDED_TOPIC],
    data: data(0n, 0n),
  }));
  assert.equal(isMeaningfulActivity(empty), false);

  const burn = decodeActivityLog(log({
    topics: [DIRECT_ZAZU_BURNED_TOPIC, topicAddress(address("dead"))],
    data: data(1n, 1_800_000_001n),
  }));
  assert.equal(isMeaningfulActivity(burn), true);
});

test("requires a live, configured, matching collector with 900 second cadence", () => {
  const expectedZazuToken = address("77");
  const expectedBuybackVault = address("88");
  const ready = assessCollectorProof({
    address: address("99"),
    code: "0x6000",
    configured: 1n,
    zazuToken: expectedZazuToken,
    buybackVault: expectedBuybackVault,
    minimumClaimInterval: 900n,
    expectedZazuToken,
    expectedBuybackVault,
  });
  assert.deepEqual(ready, {
    ready: true,
    state: "ready",
    address: address("99"),
    error: null,
  });

  assert.equal(assessCollectorProof({
    address: null,
    expectedZazuToken,
    expectedBuybackVault,
  }).state, "missing");
  assert.equal(assessCollectorProof({
    address: address("99"),
    code: "0x6000",
    configured: 1n,
    zazuToken: expectedZazuToken,
    buybackVault: address("12"),
    minimumClaimInterval: 900n,
    expectedZazuToken,
    expectedBuybackVault,
  }).state, "vault_mismatch");
  assert.equal(assessCollectorProof({
    address: address("99"),
    code: "0x6000",
    configured: 1n,
    zazuToken: expectedZazuToken,
    buybackVault: expectedBuybackVault,
    minimumClaimInterval: 60n,
    expectedZazuToken,
    expectedBuybackVault,
  }).state, "cadence_mismatch");
});

test("derives a safe activity block from confirmation depth", () => {
  assert.equal(safeActivityBlock(1_000n, 2n), 998n);
  assert.equal(safeActivityBlock(1n, 2n), 0n);
  assert.throws(() => safeActivityBlock(10n, -1n), /cannot be negative/);
});

test("latest request guard aborts and rejects stale refreshes", () => {
  const guard = new LatestRequestGuard();
  const first = guard.begin();
  const second = guard.begin();
  assert.equal(first.signal.aborted, true);
  assert.equal(guard.isCurrent(first.sequence), false);
  assert.equal(guard.isCurrent(second.sequence), true);
  guard.stop();
  assert.equal(second.signal.aborted, true);
  assert.equal(guard.isCurrent(second.sequence), false);
});

test("classifies collector calldata without overstating unknown calls", () => {
  assert.equal(classifyCollectorCall("0x10f3e19d"), "claim_flush");
  assert.equal(classifyCollectorCall("0x6b9f96ea"), "fee_flush");
  assert.equal(classifyCollectorCall("0x12345678"), "fees_forwarded");
  assert.equal(classifyCollectorCall(undefined), "fees_forwarded");
});

test("round-trips activity cursors and rejects malformed input", () => {
  const cursor = parseActivityCursor("123456:9");
  assert.deepEqual(cursor, { blockNumber: 123456n, logIndex: 9n });
  assert.equal(encodeActivityCursor(cursor!), "123456:9");
  assert.equal(parseActivityCursor(null), null);
  assert.throws(() => parseActivityCursor("123456"), /blockNumber:logIndex/);
  assert.throws(() => parseActivityCursor("-1:0"), /blockNumber:logIndex/);
});

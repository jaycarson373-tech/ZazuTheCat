import assert from "node:assert/strict";
import test from "node:test";
import { assertManualNonceState, assertReconciledSignerNonce } from "./manual-nonce";

test("manual nonce guard accepts one fully reconciled nonce", () => {
  assert.doesNotThrow(() =>
    assertManualNonceState({
      expectedNonce: 7,
      latestNonce: 7,
      pendingNonce: 7,
      phase: "buyback",
    }),
  );
});

test("manual nonce guard rejects a pending transaction", () => {
  assert.throws(
    () =>
      assertManualNonceState({
        expectedNonce: 7,
        latestNonce: 7,
        pendingNonce: 8,
        phase: "creator_fee_flush",
      }),
    /pending while latest is 7/,
  );
});

test("manual nonce guard rejects a stale operator nonce", () => {
  assert.throws(
    () =>
      assertManualNonceState({
        expectedNonce: 7,
        latestNonce: 8,
        pendingNonce: 8,
        phase: "buyback",
      }),
    /expected signer nonce 7, but the chain reports 8/,
  );
});

test("automatic nonce guard returns the reconciled nonce for explicit submission", () => {
  assert.equal(
    assertReconciledSignerNonce({
      latestNonce: 12,
      pendingNonce: 12,
      phase: "creator_fee_flush",
      executionMode: "automatic",
    }),
    12,
  );
});

test("automatic startup fails closed when a transaction is pending", () => {
  assert.throws(
    () =>
      assertReconciledSignerNonce({
        latestNonce: 12,
        pendingNonce: 13,
        phase: "startup",
        executionMode: "automatic",
      }),
    /Automatic startup blocked.*pending while latest is 12/,
  );
});

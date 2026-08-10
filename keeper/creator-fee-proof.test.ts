import assert from "node:assert/strict";
import test from "node:test";
import { assertCreatorFeeReceiptProof } from "./creator-fee-proof";

const burnDestination = "0x000000000000000000000000000000000000dEaD";

test("accepts exact creator-fee forwarding and direct-burn proof", () => {
  const forwarded = assertCreatorFeeReceiptProof({
    expectedBurnDestination: burnDestination,
    forwardedEvents: [{ wrappedNativeAmount: 5n, zazuAmount: 9n }],
    directBurnEvents: [{ amount: 9n, destination: burnDestination.toLowerCase() }],
  });
  assert.deepEqual(forwarded, { wrappedNativeAmount: 5n, zazuAmount: 9n });
});

test("accepts a burn that includes pre-existing dust or direct donations", () => {
  const forwarded = assertCreatorFeeReceiptProof({
    expectedBurnDestination: burnDestination,
    forwardedEvents: [{ wrappedNativeAmount: 5n, zazuAmount: 9n }],
    directBurnEvents: [{ amount: 12n, destination: burnDestination }],
  });
  assert.deepEqual(forwarded, { wrappedNativeAmount: 5n, zazuAmount: 9n });
});

test("confirmed events remain authoritative when fees accrue after simulation", () => {
  const forwarded = assertCreatorFeeReceiptProof({
    expectedBurnDestination: burnDestination,
    forwardedEvents: [{ wrappedNativeAmount: 7n, zazuAmount: 11n }],
    directBurnEvents: [{ amount: 11n, destination: burnDestination }],
  });
  assert.deepEqual(forwarded, { wrappedNativeAmount: 7n, zazuAmount: 11n });
});

test("requires the direct burn to cover all forwarded ZAZU", () => {
  assert.throws(
    () =>
      assertCreatorFeeReceiptProof({
        expectedBurnDestination: burnDestination,
        forwardedEvents: [{ wrappedNativeAmount: 5n, zazuAmount: 9n }],
        directBurnEvents: [],
      }),
    /exactly one DirectZazuBurned/,
  );
  assert.throws(
    () =>
      assertCreatorFeeReceiptProof({
        expectedBurnDestination: burnDestination,
        forwardedEvents: [{ wrappedNativeAmount: 5n, zazuAmount: 9n }],
        directBurnEvents: [{ amount: 8n, destination: burnDestination }],
      }),
    /amount is less than/,
  );
});

test("rejects an unexpected direct burn for a zero-ZAZU claim", () => {
  assert.throws(
    () =>
      assertCreatorFeeReceiptProof({
        expectedBurnDestination: burnDestination,
        forwardedEvents: [{ wrappedNativeAmount: 5n, zazuAmount: 0n }],
        directBurnEvents: [{ amount: 1n, destination: burnDestination }],
      }),
    /unexpected DirectZazuBurned/,
  );
});

test("rejects a zero-value forwarding receipt", () => {
  assert.throws(
    () =>
      assertCreatorFeeReceiptProof({
        expectedBurnDestination: burnDestination,
        forwardedEvents: [{ wrappedNativeAmount: 0n, zazuAmount: 0n }],
        directBurnEvents: [],
      }),
    /must prove a nonzero/,
  );
});

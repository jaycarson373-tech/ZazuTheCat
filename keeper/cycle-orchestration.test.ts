import assert from "node:assert/strict";
import test from "node:test";
import {
  planCadencedActions,
  transitionAfterCreatorFeeClaim,
} from "./cycle-orchestration";

test("a confirmed claim refreshes state and advances the manual buy nonce", () => {
  assert.deepEqual(
    transitionAfterCreatorFeeClaim({ creatorFeesForwarded: true, expectedNonce: 7 }),
    { refreshVaultState: true, nextExpectedNonce: 8 },
  );
});

test("an empty claim phase preserves state and nonce", () => {
  assert.deepEqual(
    transitionAfterCreatorFeeClaim({ creatorFeesForwarded: false, expectedNonce: 7 }),
    { refreshVaultState: false, nextExpectedNonce: 7 },
  );
});

test("collector cooldown still permits a buy from an eligible existing treasury", () => {
  assert.deepEqual(
    planCadencedActions({
      vaultWindowOpen: true,
      collectorWindowOpen: false,
      treasuryBalance: 5n,
      minimumExecutionAmount: 2n,
    }),
    { attemptCreatorFeeClaim: false, attemptBuyFromExistingTreasury: true },
  );
});

test("a closed vault window blocks both actions", () => {
  assert.deepEqual(
    planCadencedActions({
      vaultWindowOpen: false,
      collectorWindowOpen: true,
      treasuryBalance: 5n,
      minimumExecutionAmount: 2n,
    }),
    { attemptCreatorFeeClaim: false, attemptBuyFromExistingTreasury: false },
  );
});

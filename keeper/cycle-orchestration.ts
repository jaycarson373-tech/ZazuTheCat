export function transitionAfterCreatorFeeClaim(options: {
  creatorFeesForwarded: boolean;
  expectedNonce?: number;
}): {
  refreshVaultState: boolean;
  nextExpectedNonce?: number;
} {
  return {
    refreshVaultState: options.creatorFeesForwarded,
    nextExpectedNonce:
      options.creatorFeesForwarded && options.expectedNonce !== undefined
        ? options.expectedNonce + 1
        : options.expectedNonce,
  };
}

export function planCadencedActions(options: {
  vaultWindowOpen: boolean;
  collectorWindowOpen: boolean;
  treasuryBalance: bigint;
  minimumExecutionAmount: bigint;
}): {
  attemptCreatorFeeClaim: boolean;
  attemptBuyFromExistingTreasury: boolean;
} {
  if (options.minimumExecutionAmount <= 0n || options.treasuryBalance < 0n) {
    throw new RangeError("treasury amounts must be non-negative with a positive minimum");
  }
  return {
    attemptCreatorFeeClaim: options.vaultWindowOpen && options.collectorWindowOpen,
    attemptBuyFromExistingTreasury:
      options.vaultWindowOpen && options.treasuryBalance >= options.minimumExecutionAmount,
  };
}

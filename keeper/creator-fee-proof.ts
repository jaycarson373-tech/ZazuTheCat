export interface CreatorFeesForwardedProof {
  wrappedNativeAmount: bigint;
  zazuAmount: bigint;
}

export interface DirectZazuBurnedProof {
  amount: bigint;
  destination: string;
}

export function assertCreatorFeeReceiptProof(options: {
  expectedBurnDestination: string;
  forwardedEvents: readonly CreatorFeesForwardedProof[];
  directBurnEvents: readonly DirectZazuBurnedProof[];
}): CreatorFeesForwardedProof {
  if (options.forwardedEvents.length !== 1) {
    throw new Error(
      `expected exactly one CreatorFeesForwarded event, found ${options.forwardedEvents.length}`,
    );
  }

  const forwarded = options.forwardedEvents[0];
  if (forwarded.wrappedNativeAmount === 0n && forwarded.zazuAmount === 0n) {
    throw new Error("CreatorFeesForwarded must prove a nonzero creator-fee transfer");
  }

  if (forwarded.zazuAmount === 0n) {
    if (options.directBurnEvents.length !== 0) {
      throw new Error("unexpected DirectZazuBurned event for a zero-ZAZU claim");
    }
    return forwarded;
  }

  if (options.directBurnEvents.length !== 1) {
    throw new Error(
      `expected exactly one DirectZazuBurned event, found ${options.directBurnEvents.length}`,
    );
  }
  const burn = options.directBurnEvents[0];
  if (burn.amount < forwarded.zazuAmount) {
    throw new Error("DirectZazuBurned amount is less than the forwarded ZAZU amount");
  }
  if (burn.destination.toLowerCase() !== options.expectedBurnDestination.toLowerCase()) {
    throw new Error("DirectZazuBurned destination does not match the pinned burn address");
  }
  return forwarded;
}

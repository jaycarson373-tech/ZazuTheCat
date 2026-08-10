export const REQUIRED_INTERVAL_SECONDS = 15n * 60n;

export interface CadenceWindow {
  eligible: boolean;
  nextEligibleTime: bigint;
  secondsRemaining: bigint;
}

export function cadenceWindow(options: {
  chainTimestamp: bigint;
  lastActionTime: bigint;
  interval: bigint;
}): CadenceWindow {
  const { chainTimestamp, lastActionTime, interval } = options;
  if (chainTimestamp < 0n || lastActionTime < 0n) {
    throw new RangeError("cadence timestamps must be non-negative");
  }
  if (interval <= 0n) throw new RangeError("cadence interval must be positive");

  const nextEligibleTime = lastActionTime + interval;
  const eligible = chainTimestamp >= nextEligibleTime;
  return {
    eligible,
    nextEligibleTime,
    secondsRemaining: eligible ? 0n : nextEligibleTime - chainTimestamp,
  };
}

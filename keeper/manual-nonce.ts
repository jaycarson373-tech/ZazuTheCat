export interface ManualNonceState {
  expectedNonce: number;
  latestNonce: number;
  pendingNonce: number;
  phase: "creator_fee_flush" | "buyback";
}

export type SignerNoncePhase = "startup" | "creator_fee_flush" | "buyback";

export interface SignerNonceState {
  latestNonce: number;
  pendingNonce: number;
  phase: SignerNoncePhase;
  executionMode: "automatic" | "manual";
  expectedNonce?: number;
}

/**
 * Returns the only nonce that is safe to submit explicitly. A pending nonce
 * always fails closed so a restarted or overlapping worker cannot queue a
 * transaction behind an unresolved one.
 */
export function assertReconciledSignerNonce(state: SignerNonceState): number {
  const mode = state.executionMode === "manual" ? "Manual" : "Automatic";
  if (state.latestNonce !== state.pendingNonce) {
    throw new Error(
      `${mode} ${state.phase} blocked because signer nonce ${state.pendingNonce} is pending while latest is ${state.latestNonce}. Reconcile pending transactions first.`,
    );
  }
  if (state.expectedNonce !== undefined && state.latestNonce !== state.expectedNonce) {
    throw new Error(
      `${mode} ${state.phase} expected signer nonce ${state.expectedNonce}, but the chain reports ${state.latestNonce}. Re-read the nonce and restart with an explicit acknowledgement.`,
    );
  }
  return state.latestNonce;
}

export function assertManualNonceState(state: ManualNonceState): void {
  assertReconciledSignerNonce({ ...state, executionMode: "manual" });
}

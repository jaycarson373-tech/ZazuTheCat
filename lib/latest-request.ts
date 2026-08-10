export class LatestRequestGuard {
  private sequence = 0;
  private controller: AbortController | null = null;

  begin(): { sequence: number; signal: AbortSignal } {
    this.controller?.abort();
    this.controller = new AbortController();
    this.sequence += 1;
    return { sequence: this.sequence, signal: this.controller.signal };
  }

  isCurrent(sequence: number): boolean {
    return sequence === this.sequence && this.controller?.signal.aborted === false;
  }

  stop(): void {
    this.sequence += 1;
    this.controller?.abort();
    this.controller = null;
  }
}

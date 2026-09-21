/** Counts only foreground play, starting at the first game input. */
export class PlayTimer {
  private accumulated = 0;
  private since?: number;
  private started = false;
  start(now = performance.now()) { this.started = true; this.resume(now); }
  resume(now = performance.now()) { if (this.started && this.since === undefined) this.since = now; }
  pause(now = performance.now()) {
    if (this.since !== undefined) this.accumulated += Math.max(0, now - this.since);
    this.since = undefined;
  }
  elapsed(now = performance.now()) { return this.accumulated + (this.since === undefined ? 0 : Math.max(0, now - this.since)); }
  reset() { this.accumulated = 0; this.since = undefined; this.started = false; }
}

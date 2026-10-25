import type { HalloweenSettings } from './halloween';

/**
 * When the lo-fi glitches come. Kept easy on the eyes: never sooner than 12 seconds apart, short
 * (the planner's length, 150-900 ms), and at most a second, weaker tremor right after; nothing flashes.
 * The witch crossing the moon brings one too. `fire` draws it (the board's shader and the sky's jitter).
 */
export const GLITCH_MIN_GAP = 12;
/** Cooldown after any glitch: a space filled within this many seconds brings none. */
export const FILL_GLITCH_GAP = 20;

export class Glitches {
  private active = false;
  private timer = 0;
  private last = -Infinity;
  private settings?: HalloweenSettings;

  constructor(private fire: (amount: number, ms: number) => void) {
    document.addEventListener('visibilitychange', () => this.schedule());
  }

  apply(settings: HalloweenSettings) { this.settings = settings; this.schedule(); }
  setActive(active: boolean) { this.active = active; this.schedule(); }

  /** One glitch now, at the planner's strength and length, whether or not automatic ones are on. */
  now(scale = 1) {
    const { glitchStrength = .5, glitchMs = 420 } = this.settings ?? {};
    this.last = performance.now();
    this.fire(glitchStrength * scale, glitchMs);
    // Half the time a smaller aftershock follows, like a tape catching twice.
    if (Math.random() < .5) window.setTimeout(() => this.fire(glitchStrength * scale * .55, glitchMs * .6), glitchMs + 140);
  }

  /** A glitch timed to a moment (the witch), if automatic glitches are on and the last one was not too recent. */
  cue(scale = .8) {
    if (this.active && this.settings?.glitch && performance.now() - this.last > GLITCH_MIN_GAP * 1000) this.now(scale);
  }

  /** A sealed space starts to fill: one glitch, no aftershock, if that option is on and the cooldown is over. */
  fill() {
    if (!this.active || !this.settings?.glitchOnFill || performance.now() - this.last < FILL_GLITCH_GAP * 1000) return;
    this.last = performance.now();
    this.fire(this.settings.glitchStrength, this.settings.glitchMs);
  }

  private schedule() {
    clearTimeout(this.timer);
    if (!this.active || document.hidden || !this.settings?.glitch) return;
    const every = Math.max(GLITCH_MIN_GAP, this.settings.glitchEvery);
    this.timer = window.setTimeout(() => {
      if (performance.now() - this.last > GLITCH_MIN_GAP * 1000) this.now();
      this.schedule();
    }, every * (0.7 + Math.random() * 0.6) * 1000);
  }
}

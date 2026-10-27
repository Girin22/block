import type { HalloweenSettings } from './halloween';

/**
 * When the lo-fi glitch comes: only as a witch paver is wedged into a single gap (2026-10-27), with no
 * timer and no cooldown, and once per moment (a second witch seating while one runs adds nothing).
 * Kept easy on the eyes: short (the planner's length, 150-900 ms) and nothing flashes. `fire` draws it
 * (the board's shader and the sky's jitter).
 */
export class Glitches {
  private active = false;
  private until = 0;
  private settings?: HalloweenSettings;

  constructor(private fire: (amount: number, ms: number) => void) {}

  apply(settings: HalloweenSettings) { this.settings = settings; }
  setActive(active: boolean) { this.active = active; }

  /** One glitch now, at the planner's strength and length (the panel's button and the G key). */
  now() {
    const { glitchStrength = .5, glitchMs = 420 } = this.settings ?? {};
    this.until = performance.now() + glitchMs;
    this.fire(glitchStrength, glitchMs);
  }

  /** A witch paver has just seated: one glitch, if that option is on and none is already running. */
  witch() {
    if (this.active && this.settings?.glitchOnWitch && performance.now() >= this.until) this.now();
  }
}

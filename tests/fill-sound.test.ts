import { describe, expect, it } from 'vitest';
import { FILL_LATE_CLICKS, FILL_LATE_FROM, FILL_OPENING_CLICKS, planFillSounds } from '../apps/play/src/fill-sound';

describe('filler sounds', () => {
  it('lets every filler of a short run click', () => {
    expect(planFillSounds([])).toEqual({ seats: new Set() });
    const short = Array.from({ length: FILL_OPENING_CLICKS + FILL_LATE_CLICKS }, (_, i) => i);
    expect([...planFillSounds(short).seats]).toEqual(short);
  });
  it('opens a long run with two clicks and gathers the rest into its later part', () => {
    for (const length of [8, 9, 12, 24, 200]) {
      const audible = Array.from({ length }, (_, i) => i + 10);
      for (const r of [0, 0.3, 0.7, 0.9999, 1]) {
        const picks = [...planFillSounds(audible, () => r).seats].map(order => audible.indexOf(order)).sort((a, b) => a - b);
        expect(picks.length).toBe(FILL_OPENING_CLICKS + FILL_LATE_CLICKS);
        expect(picks.slice(0, FILL_OPENING_CLICKS)).toEqual([0, 1]);
        const late = picks.slice(FILL_OPENING_CLICKS);
        const from = Math.min(Math.floor(length * FILL_LATE_FROM), length - FILL_LATE_CLICKS);
        for (const index of late) { expect(index).toBeGreaterThanOrEqual(from); expect(index).toBeLessThan(length); }
      }
    }
  });
});

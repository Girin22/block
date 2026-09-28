import { describe, expect, it } from 'vitest';
import { FILL_DRAG_FROM, FILL_SEAT_SOUNDS, planFillSounds } from '../apps/play/src/fill-sound';

describe('filler sounds', () => {
  it('lets every filler of a short run click, without the drag sound', () => {
    expect(planFillSounds([])).toEqual({ seats: new Set() });
    const plan = planFillSounds([0, 1, 2, 3]);
    expect(plan.drag).toBeUndefined();
    expect([...plan.seats]).toEqual([0, 1, 2, 3]);
  });
  it('spreads four clicks across a medium or long run, and opens only a long run with the drag sound', () => {
    expect(FILL_DRAG_FROM).toBe(8);
    for (const length of [5, 6, 7, 8, 9, 24, 200]) {
      const audible = Array.from({ length }, (_, i) => i + 10);
      for (const r of [0, 0.3, 0.7, 0.9999, 1]) {
        const plan = planFillSounds(audible, () => r);
        expect(plan.drag).toBe(length >= FILL_DRAG_FROM ? 10 : undefined);
        expect(plan.seats.size).toBe(FILL_SEAT_SOUNDS);
        // One click in each quarter of the run, never outside the run.
        const picks = [...plan.seats].map(order => audible.indexOf(order)).sort((a, b) => a - b);
        picks.forEach((index, part) => {
          expect(index).toBeGreaterThanOrEqual(Math.floor(part * length / FILL_SEAT_SOUNDS));
          expect(index).toBeLessThan(Math.floor((part + 1) * length / FILL_SEAT_SOUNDS));
        });
      }
    }
  });
});

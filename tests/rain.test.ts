import { describe, expect, it } from 'vitest';
import { DRY_SECONDS, RAIN_FALL, RAIN_RISE, SOAK_SECONDS, stepRain, wetTint } from '../apps/play/src/rain';

const run = (state: { intensity: number; wetness: number }, seconds: number, raining: boolean) => {
  for (let t = 0; t < seconds; t += 1 / 60) state = stepRain(state, 1 / 60, raining);
  return state;
};

describe('admin rain', () => {
  it('builds up gradually, soaks the pavement, and never leaves 0..1', () => {
    let state = { intensity: 0, wetness: 0 };
    state = run(state, RAIN_RISE / 2, true);
    expect(state.intensity).toBeGreaterThan(0.4);
    expect(state.intensity).toBeLessThan(0.6);
    expect(state.wetness).toBeLessThan(0.1);
    state = run(state, RAIN_RISE + SOAK_SECONDS + 1, true);
    expect(state.intensity).toBe(1);
    expect(state.wetness).toBe(1);
  });
  it('keeps the ground wet while the shower fades and dries it only afterwards', () => {
    let state = { intensity: 1, wetness: 0.5 };
    state = run(state, RAIN_FALL * 0.9, false);
    expect(state.intensity).toBeGreaterThan(0);
    expect(state.wetness).toBeGreaterThanOrEqual(0.5);
    const soaked = state.wetness;
    state = run(state, RAIN_FALL * 0.2 + DRY_SECONDS * 0.5, false);
    expect(state.intensity).toBe(0);
    expect(state.wetness).toBeLessThan(soaked);
    state = run(state, DRY_SECONDS, false);
    expect(state).toEqual({ intensity: 0, wetness: 0 });
  });
  it('tints wet stone darker and cooler without changing dry stone', () => {
    expect(wetTint(0)).toEqual([1, 1, 1]);
    expect(wetTint(-4)).toEqual([1, 1, 1]);
    const [r, g, b] = wetTint(1);
    expect(wetTint(9)).toEqual([r, g, b]);
    expect(r).toBeLessThan(g);
    expect(g).toBeLessThan(b);
    expect(b).toBeLessThan(1);
    expect(r).toBeGreaterThan(0.6);
    let previous = 1;
    for (let w = 0; w <= 1; w += 0.05) { expect(wetTint(w)[0]).toBeLessThanOrEqual(previous); previous = wetTint(w)[0]; }
  });
});

import { describe, expect, it } from 'vitest';
import { dropDuration, dropProgress, fillAltitude, fillGap, fillOpacity, fillTilt, gentle, FILL_DELAY, FILL_HEIGHT, FILL_LANDS, FILL_TILT, liftScale } from '../apps/play/src/drop-motion';

describe('weighted drop animation', () => {
  it('accelerates monotonically and lands exactly without overshooting', () => {
    expect(dropProgress(-1)).toBe(0);
    expect(dropProgress(2)).toBe(1);
    let previous = 0, speed = 0;
    for (let i = 1; i <= 100; i++) {
      const next = dropProgress(i / 100);
      expect(next - previous).toBeGreaterThan(speed);
      speed = next - previous; previous = next;
    }
    expect(previous).toBe(1);
  });
  it('scales flight time with distance while bounding input lock time', () => {
    expect(dropDuration(0)).toBe(0.1);
    expect(dropDuration(4)).toBeGreaterThan(dropDuration(1));
    expect(dropDuration(10000)).toBe(0.38);
  });
  it('lowers the white filler from above and seats it without growth, overshoot, or a fading landing', () => {
    // Held almost over its slot: height is perpendicular to the ground, not travel across the board.
    expect(FILL_HEIGHT).toBeLessThan(0.5);
    expect(fillAltitude(0)).toBe(1);
    expect(fillAltitude(FILL_LANDS)).toBeCloseTo(0, 10);
    expect(fillGap(0)).toBe(FILL_HEIGHT);
    expect(fillOpacity(FILL_DELAY)).toBe(0);
    expect(fillGap(FILL_LANDS)).toBeCloseTo(0, 10);
    expect(fillOpacity(FILL_LANDS)).toBe(1);
    let previous = FILL_HEIGHT;
    for (let i = 1; i <= 100; i++) {
      const age = FILL_DELAY + (FILL_LANDS - FILL_DELAY) * i / 100, gap = fillGap(age);
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(previous + 1e-12);
      previous = gap;
      if (i >= 50) expect(fillOpacity(age)).toBe(1);
    }
  });
  it('settles on the gentle curve: slow in, slow out, symmetric, never overshooting', () => {
    expect(gentle(0)).toBe(0);
    expect(gentle(1)).toBe(1);
    expect(gentle(0.5)).toBeCloseTo(0.5, 6);
    expect(gentle(0.1)).toBeLessThan(0.1);
    expect(gentle(0.9)).toBeGreaterThan(0.9);
    let previous = 0;
    for (let p = 0; p <= 1; p += 0.01) { expect(gentle(p)).toBeGreaterThanOrEqual(previous - 1e-12); previous = gentle(p); }
  });
  it('turns every filler the same way on arrival and straightens it exactly as it seats', () => {
    expect(fillTilt(0)).toBeCloseTo(FILL_TILT * Math.PI / 180, 10);
    expect(fillTilt(FILL_LANDS / 2)).toBeGreaterThan(0);
    expect(Math.abs(fillTilt(FILL_LANDS))).toBeLessThan(1e-9);
    expect(Math.abs(FILL_TILT)).toBeLessThan(10);
  });
  it('stays rigid: exact size on contact, a small steady lift in the air, never smaller than the slot', () => {
    expect(liftScale(0)).toBe(1);
    expect(liftScale(-3)).toBe(1);
    expect(liftScale(1.2)).toBeCloseTo(1.035, 10);
    expect(liftScale(500)).toBeCloseTo(1.035, 10);
    let previous = 1;
    for (let gap = 0; gap <= 1.5; gap += 0.01) {
      const scale = liftScale(gap);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
  });
});

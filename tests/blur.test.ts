import { describe, expect, it } from 'vitest';
import { blurChannel } from '../apps/play/src/blur';

describe('software blur for the shadow mask', () => {
  const width = 21, height = 21;
  const dot = () => { const v = new Float32Array(width * height); v[10 * width + 10] = 1; return v; };
  it('spreads a point symmetrically and keeps its total', () => {
    const out = blurChannel(dot(), width, height, 3);
    const total = out.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(out[10 * width + 10]).toBeLessThan(0.1);
    expect(out[10 * width + 10]).toBeGreaterThan(out[10 * width + 13]);
    expect(out[10 * width + 13]).toBeCloseTo(out[10 * width + 7], 6);
    expect(out[10 * width + 13]).toBeCloseTo(out[13 * width + 10], 6);
    expect(out[10 * width + 13]).toBeGreaterThan(0);
  });
  it('widens with sigma and does nothing at zero', () => {
    const narrow = blurChannel(dot(), width, height, 1), wide = blurChannel(dot(), width, height, 4);
    expect(wide[10 * width + 10]).toBeLessThan(narrow[10 * width + 10]);
    expect(wide[10 * width + 16]).toBeGreaterThan(narrow[10 * width + 16]);
    expect(Array.from(blurChannel(dot(), width, height, 0))).toEqual(Array.from(dot()));
  });
  it('treats the outside as empty: an edge dot loses the part that falls off, never gains', () => {
    const v = new Float32Array(width * height); v[0] = 1;
    const out = blurChannel(v, width, height, 3);
    const total = out.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(1);
    expect(total).toBeGreaterThan(0.1);
  });
});

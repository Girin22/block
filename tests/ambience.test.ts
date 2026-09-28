import { describe, expect, it } from 'vitest';
import { crossfadeCurves, nextTrack, TARGET_LUFS, trackGain } from '../apps/play/src/ambience';

describe('environment ambience', () => {
  it('never repeats the recording that just played and reaches every other one', () => {
    for (let current = 0; current < 4; current++) {
      const seen = new Set<number>();
      for (const r of [0, 0.2, 0.34, 0.5, 0.67, 0.9, 0.9999, 1]) {
        const next = nextTrack(4, current, () => r);
        expect(next).not.toBe(current); expect(next).toBeGreaterThanOrEqual(0); expect(next).toBeLessThan(4);
        seen.add(next);
      }
      expect(seen.size).toBe(3);
    }
  });
  it('picks any recording to begin with and copes with a single file', () => {
    expect(nextTrack(4, -1, () => 0)).toBe(0);
    expect(nextTrack(4, -1, () => 0.99)).toBe(3);
    expect(nextTrack(4, -1, () => 1)).toBeLessThan(4);
    expect(nextTrack(1, 0)).toBe(0);
  });
  it('crosses over at constant power from the outgoing to the incoming recording', () => {
    const { outgoing, incoming } = crossfadeCurves(32);
    for (let i = 0; i < 32; i++) expect(outgoing[i] ** 2 + incoming[i] ** 2).toBeCloseTo(1, 5);
    expect(outgoing[0]).toBe(1); expect(incoming[0]).toBe(0);
    expect(outgoing[31]).toBeCloseTo(0, 6); expect(incoming[31]).toBe(1);
  });
  it('brings every recording to the same loudness', () => {
    expect(trackGain(TARGET_LUFS)).toBe(1);
    expect(20 * Math.log10(trackGain(-26))).toBeCloseTo(TARGET_LUFS + 26, 10);
    // The quietest night recording is lifted about 16 dB and still peaks below full scale (-19.4 dBFS).
    expect(-19.4 + 20 * Math.log10(trackGain(-47.9))).toBeLessThan(-3);
  });
});

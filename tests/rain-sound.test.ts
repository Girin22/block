import { describe, expect, it } from 'vitest';
import { crossfade, LOOP_OVERLAP, RAIN_GAIN, rainLevel } from '../apps/play/src/rain-sound';

describe('rain ambience loop', () => {
  const duration = 111.07;
  it('plays a single pass untouched until the overlap begins', () => {
    expect(crossfade(0, duration)).toEqual({ ending: 1, starting: 0, progress: 0 });
    expect(crossfade(duration - LOOP_OVERLAP - 0.01, duration).progress).toBe(0);
    expect(crossfade(duration - LOOP_OVERLAP + 0.5, duration).progress).toBeGreaterThan(0);
  });
  it('crosses over at constant power and finishes exactly at the end of the pass', () => {
    for (let position = duration - LOOP_OVERLAP; position <= duration; position += 0.05) {
      const { ending, starting } = crossfade(position, duration);
      expect(ending * ending + starting * starting).toBeCloseTo(1, 10);
    }
    const end = crossfade(duration, duration);
    expect(end.progress).toBe(1);
    expect(end.ending).toBeCloseTo(0, 10);
    expect(end.starting).toBeCloseTo(1, 10);
    expect(crossfade(duration + 3, duration).progress).toBe(1);
  });
  it('stays silent-safe before the length is known and with very short clips', () => {
    expect(crossfade(4, NaN)).toEqual({ ending: 1, starting: 0, progress: 0 });
    expect(crossfade(4, 0)).toEqual({ ending: 1, starting: 0, progress: 0 });
    // A clip shorter than two overlaps never crosses over for more than half of its length.
    expect(crossfade(2.9, 6).progress).toBe(0);
    expect(crossfade(4.5, 6).progress).toBeCloseTo(0.5, 10);
  });
  it('follows the shower strength from silence to full level', () => {
    expect(rainLevel(0)).toBe(0);
    expect(rainLevel(-1)).toBe(0);
    expect(rainLevel(1)).toBe(RAIN_GAIN);
    expect(rainLevel(7)).toBe(RAIN_GAIN);
    expect(rainLevel(0.5)).toBeLessThan(RAIN_GAIN / 2);
  });
});

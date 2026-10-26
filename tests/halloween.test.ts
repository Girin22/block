import { describe, expect, it } from 'vitest';
import { pickEntry, tileRandom } from '../apps/play/src/halloween';

describe('Halloween paver weights', () => {
  const entries = [{ paver: 'stone', weight: 3 }, { paver: 'ghost', weight: 1 }, { paver: 'purple', weight: 0 }];

  it('draws pavers in proportion to their weights and never one weighted 0', () => {
    const counts: Record<string, number> = {};
    for (let id = 1; id <= 20000; id++) { const paver = pickEntry(entries, id, 1)!.paver; counts[paver] = (counts[paver] ?? 0) + 1; }
    expect(counts.stone / 20000).toBeCloseTo(0.75, 1);
    expect(counts.ghost / 20000).toBeCloseTo(0.25, 1);
    expect(counts.purple).toBeUndefined();
  });

  it('keeps the same paver for a tile, and falls back to the first when every weight is 0', () => {
    expect(pickEntry(entries, 42, 2)).toBe(pickEntry(entries, 42, 2));
    expect(pickEntry([{ paver: 'a', weight: 0 }, { paver: 'b', weight: 0 }], 7, 1)!.paver).toBe('a');
  });

  it('spreads tile randoms evenly in [0, 1)', () => {
    const values = Array.from({ length: 10000 }, (_, i) => tileRandom(i + 1, 3));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(values.reduce((a, b) => a + b, 0) / values.length).toBeCloseTo(0.5, 1);
  });
});

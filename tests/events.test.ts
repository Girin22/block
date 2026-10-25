import { describe, expect, it } from 'vitest';
import { eventOpen, HALLOWEEN, type SeasonalEvent } from '../apps/play/src/events';

describe('seasonal events', () => {
  it('opens Halloween from 24 October through 2 November, local time, every year', () => {
    expect(eventOpen(HALLOWEEN, new Date(2026, 9, 23, 23, 59))).toBe(false);
    expect(eventOpen(HALLOWEEN, new Date(2026, 9, 24, 0, 0))).toBe(true);
    expect(eventOpen(HALLOWEEN, new Date(2026, 9, 31, 12))).toBe(true);
    expect(eventOpen(HALLOWEEN, new Date(2026, 10, 2, 23, 59))).toBe(true);
    expect(eventOpen(HALLOWEEN, new Date(2026, 10, 3, 0, 0))).toBe(false);
    expect(eventOpen(HALLOWEEN, new Date(2027, 9, 30))).toBe(true);
  });

  it('handles a window that runs across the new year', () => {
    const event: SeasonalEvent = { from: [12, 24], to: [1, 2] };
    expect(eventOpen(event, new Date(2026, 11, 31))).toBe(true);
    expect(eventOpen(event, new Date(2027, 0, 2))).toBe(true);
    expect(eventOpen(event, new Date(2027, 0, 3))).toBe(false);
    expect(eventOpen(event, new Date(2026, 11, 23))).toBe(false);
  });
});

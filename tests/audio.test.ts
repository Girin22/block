import { describe, expect, it } from 'vitest';
import { clackVoice, PITCH_VARIATION } from '../apps/play/src/audio';

describe('placement sound voice', () => {
  it('makes the white filler higher, shorter, and quieter than a placed block', () => {
    const block = clackVoice(false), filler = clackVoice(true);
    expect(block.pitch).toBe(1);
    expect(block.length).toBe(1);
    expect(filler.pitch).toBeGreaterThan(block.pitch);
    expect(filler.length).toBeLessThan(block.length);
    expect(filler.gain).toBeLessThan(block.gain);
    expect(block.gain).toBeLessThan(1);
  });
  it('keeps the pitch drift small and bounded whatever variation is passed in', () => {
    expect(clackVoice(false, 1).pitch).toBeCloseTo(1 + PITCH_VARIATION, 10);
    expect(clackVoice(false, -1).pitch).toBeCloseTo(1 - PITCH_VARIATION, 10);
    expect(clackVoice(false, 50).pitch).toBeCloseTo(1 + PITCH_VARIATION, 10);
    expect(clackVoice(false, -50).pitch).toBeCloseTo(1 - PITCH_VARIATION, 10);
    expect(PITCH_VARIATION).toBeLessThan(0.05);
  });
});

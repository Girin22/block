import { describe, expect, it } from 'vitest';
import { clackVoice, PITCH_VARIATION } from '../apps/play/src/audio';
import { hitVoice } from '../apps/play/src/sound';

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
  it('plays recorded hits at full level for blocks and higher and quieter for the white filler', () => {
    expect(hitVoice(false)).toEqual({ rate: 1, gain: 1 });
    const filler = hitVoice(true);
    expect(filler.rate).toBeCloseTo(1.4, 10);
    expect(filler.gain).toBeCloseTo(0.75, 10);
    expect(hitVoice(false, 1).rate).toBeCloseTo(1 + PITCH_VARIATION, 10);
  });
});

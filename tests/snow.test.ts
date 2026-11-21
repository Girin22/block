import { describe, expect, it } from 'vitest';
import { WIDTH } from '../packages/play-core';
import { CHRISTMAS, eventOpen, greetingPhrases, santaDay } from '../apps/play/src/events';
import { coverDepth, GAIT, planWalk } from '../apps/play/src/snow';
import { setLine } from '../apps/play/src/greeting';

function random(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
}

describe('winter event', () => {
  it('is open from the first of December to the end of February', () => {
    expect(eventOpen(CHRISTMAS, new Date(2026, 10, 30, 23, 59))).toBe(false);
    expect(eventOpen(CHRISTMAS, new Date(2026, 11, 1))).toBe(true);
    expect(eventOpen(CHRISTMAS, new Date(2026, 11, 25))).toBe(true);
    expect(eventOpen(CHRISTMAS, new Date(2027, 0, 15))).toBe(true);
    expect(eventOpen(CHRISTMAS, new Date(2027, 1, 28, 23, 59))).toBe(true);
    expect(eventOpen(CHRISTMAS, new Date(2028, 1, 29))).toBe(true);
    expect(eventOpen(CHRISTMAS, new Date(2027, 2, 1))).toBe(false);
  });
});

describe('winter greeting', () => {
  const on = (month: number, day: number, year = 2026) => greetingPhrases(new Date(year, month - 1, day, 12));
  it('wishes a merry Christmas up to the 25th, both to the end of the year, a happy new year for a week', () => {
    expect(on(11, 30)).toEqual([]);
    expect(on(12, 1)).toEqual(['Merry Christmas']);
    expect(on(12, 25)).toEqual(['Merry Christmas']);
    expect(on(12, 26)).toEqual(['Merry Christmas', 'Happy New Year']);
    expect(on(12, 31)).toEqual(['Merry Christmas', 'Happy New Year']);
    expect(on(1, 1, 2027)).toEqual(['Happy New Year']);
    expect(on(1, 7, 2027)).toEqual(['Happy New Year']);
    expect(on(1, 8, 2027)).toEqual([]);
    expect(on(2, 14, 2027)).toEqual([]);
  });
});

describe('winter greeting lettering', () => {
  // Stand-in widths: a narrow i, a wide M, everything else the same, and a quarter-em space.
  const advance = (text: string) => [...text].reduce((sum, letter) => sum + (letter === 'i' ? 0.25 : letter === 'M' ? 0.9 : letter === ' ' ? 0.25 : 0.55), 0);
  it('leaves the same gap between letters whatever their widths, and a wider one between words', () => {
    for (const phrase of ['Merry Christmas', 'Happy New Year']) {
      const { glyphs, length } = setLine(phrase, advance);
      expect(glyphs.map(glyph => glyph.letter).join('')).toBe(phrase.replace(/ /g, ''));
      const gaps = glyphs.slice(1).map((glyph, i) => (glyph.centre - glyph.width / 2) - (glyphs[i].centre + glyphs[i].width / 2));
      const inWord = gaps.filter(gap => gap < 0.3), betweenWords = gaps.filter(gap => gap >= 0.3);
      expect(betweenWords.length).toBe(phrase.split(' ').length - 1);
      for (const gap of inWord) expect(gap).toBeCloseTo(inWord[0], 6);
      for (const gap of betweenWords) { expect(gap).toBeCloseTo(betweenWords[0], 6); expect(gap).toBeGreaterThan(inWord[0] * 3); }
      expect(length).toBeCloseTo(glyphs[glyphs.length - 1].centre + glyphs[glyphs.length - 1].width / 2, 6);
      expect(glyphs[0].centre - glyphs[0].width / 2).toBeCloseTo(0, 6);
    }
  });
});

describe('snow cover', () => {
  it('builds from bare to full with what has fallen since the cell was cleared', () => {
    expect(coverDepth(3, 3)).toBe(0);
    expect(coverDepth(3.4, 3)).toBeCloseTo(0.4);
    expect(coverDepth(9, 3)).toBe(1);
    expect(coverDepth(2, 3)).toBe(0);
  });
});

describe('animal tracks', () => {
  {
    it('the dog crosses the whole view, one print after another, paws alternating', () => {
      for (let seed = 1; seed <= 50; seed++) {
        const steps = planWalk(10, 20, random(Math.imul(seed, 2654435761) >>> 0)), gait = GAIT;
        expect(steps.length).toBeGreaterThan(4);
        // In at one edge of the view and out at another: a wall, or the top or bottom on a diagonal.
        const first = steps[0], last = steps[steps.length - 1];
        for (const end of [first, last]) expect(end.x < 1.5 || end.x > WIDTH - 1.5 || end.y < 11.5 || end.y > 28.5).toBe(true);
        for (let i = 1; i < steps.length; i++) {
          expect(steps[i].at).toBeGreaterThan(steps[i - 1].at);
          // Successive prints are a step apart, give or take the swing from one foot to the other.
          const distance = Math.hypot(steps[i].x - steps[i - 1].x, steps[i].y - steps[i - 1].y);
          expect(distance).toBeGreaterThan(gait.step * 0.7);
          expect(distance).toBeLessThan(gait.step + gait.side * 2.2);
        }
      }
    });
    it('crosses level on some walks and on a diagonal on others', () => {
      let level = 0, diagonal = 0;
      for (let seed = 1; seed <= 100; seed++) {
        // Seeds spread apart: neighbouring ones give this generator nearly the same first number.
        const steps = planWalk(10, 20, random(Math.imul(seed, 2654435761) >>> 0)), first = steps[0], last = steps[steps.length - 1];
        const slope = Math.abs((last.y - first.y) / (last.x - first.x));
        if (slope < 0.3) level++; else if (slope > 0.45) diagonal++;
      }
      expect(level).toBeGreaterThan(25);
      expect(diagonal).toBeGreaterThan(25);
    });
    it('passes through a low band of pavers, level or diagonal', () => {
      for (let seed = 1; seed <= 50; seed++) {
        const steps = planWalk(10, 3, random(Math.imul(seed, 2654435761) >>> 0));
        expect(steps.length).toBeGreaterThan(3);
        // Every walk leaves prints inside the band itself, not only around it.
        expect(steps.some(step => step.y >= 10 && step.y < 13 && step.x >= 0 && step.x < WIDTH)).toBe(true);
        for (const step of steps) { expect(step.y).toBeGreaterThan(7.6); expect(step.y).toBeLessThan(15.4); }
      }
    });
  }
  it('puts Santa hats on the snow ducks on Christmas Eve and Christmas Day only', () => {
    expect(santaDay(new Date(2026, 11, 24))).toBe(true);
    expect(santaDay(new Date(2026, 11, 25, 23, 59))).toBe(true);
    expect(santaDay(new Date(2026, 11, 23))).toBe(false);
    expect(santaDay(new Date(2026, 11, 26))).toBe(false);
    expect(santaDay(new Date(2027, 0, 24))).toBe(false);
  });
});

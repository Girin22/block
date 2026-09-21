import { expect, it } from 'vitest';
import { PlayTimer } from '../apps/play/src/play-timer';

it('counts play only after first input and excludes pause, export and background time', () => {
  const timer = new PlayTimer();
  timer.resume(0); expect(timer.elapsed(60000)).toBe(0);
  timer.start(60000); timer.start(61000); timer.pause(62000);
  expect(timer.elapsed(100000)).toBe(2000);
  timer.pause(110000); timer.resume(120000); timer.pause(121000);
  expect(timer.elapsed(200000)).toBe(3000);
  timer.reset(); timer.resume(300000); expect(timer.elapsed(400000)).toBe(0);
});

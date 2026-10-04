import { FILL_LANDS } from './drop-motion';
import { TILE_BLEED, tileImages } from './tile-assets';

/**
 * Studio intro before the game (designer's frames iPhone 16 - 1~4, 2026-10-04): pavers drop in one by
 * one at an even beat and close into the app icon's pinwheel; the white 1×1 is laid into the middle from just above, as the game lays its fillers, while
 * the makers' names rise softly beneath, and after a 1 s hold it hands over to the game. Plays on every
 * launch; a tap skips it.
 */
export const STUDIO_CREDIT = ['Studio Whynot', '×', 'Simulien'];

/** The app icon's layout (scripts/make-app-icon.py): centres on a 3×3 grid, y down, pulled apart a little
 *  for thin joints (closer than the icon's 1.075, as in the designer's frame). */
const SPREAD = 1.035;
/** Seconds between one paver's drop and the next (2026-10-04: one even beat, no longer "톡, 도도독"). */
const BEAT = 0.35;
const PIECES = [
  // An even beat, BEAT seconds apart; each touches down at 76% of DROP and settles by its end.
  { image: tileImages.horizontal, x: 1.0, y: 2.5, w: 2, h: 1, at: 0.25 },
  { image: tileImages.vertical, x: 2.5, y: 2.0, w: 1, h: 2, at: 0.25 + BEAT },
  { image: tileImages.vertical, x: 0.5, y: 1.0, w: 1, h: 2, at: 0.25 + BEAT * 2 },
  { image: tileImages.horizontal, x: 2.0, y: 0.5, w: 2, h: 1, at: 0.25 + BEAT * 3 },
] as const;
/**
 * Seconds: a drop, the white filler being laid (the game's FILL_LANDS), the names rising with it, the hold
 * once both are in, and the fade.
 */
const DROP = 0.55, FILL_AT = 0.25 + BEAT * 3 + DROP + 0.15, FILL = FILL_LANDS, CREDIT = 1.2, HOLD = 1;
/**
 * The hand-over (style.css): the mark and names drift up and fade first, then the ground fades and the
 * board shows through. `handOver` is called HAND_OVER seconds in, as the ground starts to clear, so the
 * onboarding's first line is already being uncovered beneath it and no bare board shows in between.
 */
const LEAVE = 1.4, HAND_OVER = 0.5;
const LEAVE_AT = FILL_AT + Math.max(FILL, CREDIT) + HOLD;

export function playStudioIntro(parent: HTMLElement, handOver: () => void) {
  const root = document.createElement('div'); root.id = 'studio-intro'; root.setAttribute('aria-label', STUDIO_CREDIT.join(' '));
  // The pinwheel spans 38% of the screen's width (designer's frame), so 3 × SPREAD + bleed cells make that.
  const cell = Math.min(parent.clientWidth * 0.38, parent.clientHeight * 0.175) / (3 * SPREAD + TILE_BLEED);
  root.style.setProperty('--c', `${cell}px`);
  const mark = document.createElement('div'); mark.className = 'studio-mark';
  const place = (image: string, x: number, y: number, w: number, h: number, className: string, at: number) => {
    const img = document.createElement('img'); img.src = image; img.alt = ''; img.className = className;
    Object.assign(img.style, {
      width: `${(w + TILE_BLEED) * cell}px`, height: `${(h + TILE_BLEED) * cell}px`,
      left: `${(x - 1.5) * SPREAD * cell - (w + TILE_BLEED) * cell / 2}px`, top: `${(y - 1.5) * SPREAD * cell - (h + TILE_BLEED) * cell / 2}px`,
      animationDelay: `${at}s`,
    });
    mark.append(img);
  };
  root.style.setProperty('--drop', `${DROP}s`); root.style.setProperty('--fill', `${FILL}s`); root.style.setProperty('--credit', `${CREDIT}s`);
  PIECES.forEach(({ image, x, y, w, h, at }) => place(image, x, y, w, h, 'drop', at));
  place(tileImages.center, 1.5, 1.5, 1, 1, 'fill', FILL_AT);
  const credit = document.createElement('p'); credit.className = 'studio-credit'; credit.style.setProperty('--credit-at', `${FILL_AT}s`);
  credit.innerHTML = STUDIO_CREDIT.map(line => `<span>${line}</span>`).join('');
  root.append(mark, credit); parent.append(root);
  let timer = 0;
  // A skipping tap hands over twice as fast; the scale stretches every part of the hand-over alike.
  const leave = (scale: number) => {
    clearTimeout(timer); root.style.setProperty('--leave', String(scale)); root.classList.add('leaving');
    window.setTimeout(handOver, HAND_OVER * scale * 1000);
    window.setTimeout(() => root.remove(), LEAVE * scale * 1000);
  };
  timer = window.setTimeout(() => leave(1), LEAVE_AT * 1000);
  root.addEventListener('pointerdown', () => { if (!root.classList.contains('leaving')) leave(0.5); });
}

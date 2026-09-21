/** Short drops stay snappy; longer drops have time to build weight. Seconds/cells. */
export function dropDuration(distance: number) {
  return Math.min(0.38, Math.max(0.1, Math.sqrt(Math.max(0, distance) / 65)));
}

/** Accelerate into contact instead of braking just before landing. */
export function dropProgress(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return 0.18 * t + 0.82 * t * t;
}

/**
 * Pavers are rigid: nothing squashes on contact. Height is shown only by how near the block is to
 * the camera, easing to exactly 1 as it meets the ground so the joints close flush. Cells in.
 */
/**
 * The white filler is lowered in the same way as a placed block: a short beat after the block that
 * closed the gap, it comes down from just above and stops dead. No growth, overshoot, or bounce.
 */
export const FILL_DELAY = 0.06, FILL_SECONDS = 0.2, FILL_HEIGHT = 1.2;
export const FILL_LANDS = FILL_DELAY + FILL_SECONDS;

/** Remaining height above the slot, in cells. */
export function fillGap(age: number) {
  return FILL_HEIGHT * (1 - dropProgress((age - FILL_DELAY) / FILL_SECONDS));
}

/** Hidden during the beat, then solid well before contact so the landing itself is never a fade. */
export function fillOpacity(age: number) {
  return Math.max(0, Math.min(1, (age - FILL_DELAY) / (FILL_SECONDS * 0.35)));
}

export function liftScale(gap: number) {
  const t = Math.max(0, Math.min(1, gap / 1.2));
  return 1 + 0.035 * t * t * (3 - 2 * t);
}

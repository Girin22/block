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
 * The white filler is set down a short beat after the block that closed the gap. It is held almost
 * directly over its slot and lowered perpendicular to the ground, so the height reads from the
 * shadow and the size rather than from travel across the board. No growth, overshoot, or bounce.
 */
export const FILL_DELAY = 0.06, FILL_SECONDS = 0.8;
/** Travel across the board in cells: small, so the tile never seems to fly in from far away. */
export const FILL_HEIGHT = 0.28;
/** Extra size while lifted; the camera looks straight down, so nearer means slightly larger. */
export const FILL_LIFT = 0.08;
export const FILL_LANDS = FILL_DELAY + FILL_SECONDS;
/** Fillers of one sealed space are laid one after another, this far apart, each at the same speed. */
export const FILL_STAGGER = 0.2;
/** Degrees a filler is turned as it appears; it straightens as it wedges into place. Every filler
 *  turns the same way: positive is counter-clockwise. The angle is a placeholder until the designer
 *  confirms it; flip the sign if the design turns the other way. */
export const FILL_TILT = 5;

/** Figma's "Gentle" easing, cubic-bezier(0.44, 0, 0.56, 1): the designer's settle for the fillers. */
export function gentle(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0 || p >= 1) return p;
  const bezier = (a: number, b: number, t: number) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  let low = 0, high = 1, t = p;
  for (let i = 0; i < 24; i++) { t = (low + high) / 2; if (bezier(0.44, 0.56, t) < p) low = t; else high = t; }
  return bezier(0, 1, t);
}

/** Height above the ground from 1 (held) to 0 (seated), on the designer's gentle curve. */
export function fillAltitude(age: number) {
  return 1 - gentle((age - FILL_DELAY) / FILL_SECONDS);
}

/** Radians of tilt still left at this age. */
export function fillTilt(age: number) {
  return FILL_TILT * Math.PI / 180 * fillAltitude(age);
}

/** Remaining offset across the board, in cells. */
export function fillGap(age: number) {
  return FILL_HEIGHT * fillAltitude(age);
}

/** Hidden during the beat, then solid well before contact so the landing itself is never a fade. */
export function fillOpacity(age: number) {
  return Math.max(0, Math.min(1, (age - FILL_DELAY) / (FILL_SECONDS * 0.35)));
}

export function liftScale(gap: number) {
  const t = Math.max(0, Math.min(1, gap / 1.2));
  return 1 + 0.035 * t * t * (3 - 2 * t);
}

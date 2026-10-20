/**
 * Which fillers of one sealed space make a sound. A few fillers each click into place. More than that
 * would be a rattle of identical clicks, so a long run clicks FILL_OPENING_CLICKS times right as it
 * begins (a quick "do-dok"), then is quiet, then gathers the other FILL_LATE_CLICKS into its later part,
 * one picked at random from each equal stretch there, so the space is heard filling up toward the end
 * (2026-10-20; before, the clicks were spread evenly from start to finish). The stone drag that used to
 * open a long run was dropped the same day with the Epidemic Sound recordings.
 */

/** Clicks on the first fillers of a long run, and clicks gathered into its later part. */
export const FILL_OPENING_CLICKS = 2, FILL_LATE_CLICKS = 5;
/** Where the later part of a long run begins, as a share of the run. */
export const FILL_LATE_FROM = 0.5;

export interface FillSoundPlan {
  /** Fillers that click as they seat. */
  seats: Set<number>;
}

/** `audible` lists, in laying order, the fillers that will seat on screen. */
export function planFillSounds(audible: readonly number[], random = Math.random): FillSoundPlan {
  if (audible.length <= FILL_OPENING_CLICKS + FILL_LATE_CLICKS) return { seats: new Set(audible) };
  const seats = new Set(audible.slice(0, FILL_OPENING_CLICKS));
  // A run only just long enough moves the later part back so each of its clicks still has a filler.
  const from = Math.max(FILL_OPENING_CLICKS, Math.min(Math.floor(audible.length * FILL_LATE_FROM), audible.length - FILL_LATE_CLICKS));
  const span = audible.length - from;
  for (let part = 0; part < FILL_LATE_CLICKS; part++) {
    const start = from + Math.floor(part * span / FILL_LATE_CLICKS), end = from + Math.floor((part + 1) * span / FILL_LATE_CLICKS);
    seats.add(audible[start + Math.min(end - start - 1, Math.floor(random() * (end - start)))]);
  }
  return { seats };
}

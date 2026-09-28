/**
 * Which fillers of one sealed space make a sound. A few fillers each click into place. More than that
 * would be a rattle of identical clicks, so only FILL_SEAT_SOUNDS of them click, one picked at random
 * from each equal stretch of the run so the clicks are spread from start to finish rather than bunched
 * together. A long run (FILL_DRAG_FROM or more) also opens with one stone drag sound.
 */

/** Most seat clicks a single run makes. */
export const FILL_SEAT_SOUNDS = 4;
/** On-screen fillers from which a run opens with the drag sound. */
export const FILL_DRAG_FROM = 8;

export interface FillSoundPlan {
  /** The filler whose appearance starts the drag sound, if the run is long. */
  drag?: number;
  /** Fillers that click as they seat. */
  seats: Set<number>;
}

/** `audible` lists, in laying order, the fillers that will seat on screen. */
export function planFillSounds(audible: readonly number[], random = Math.random): FillSoundPlan {
  if (audible.length <= FILL_SEAT_SOUNDS) return { seats: new Set(audible) };
  const seats = new Set<number>();
  for (let part = 0; part < FILL_SEAT_SOUNDS; part++) {
    const start = Math.floor(part * audible.length / FILL_SEAT_SOUNDS), end = Math.floor((part + 1) * audible.length / FILL_SEAT_SOUNDS);
    seats.add(audible[start + Math.min(end - start - 1, Math.floor(random() * (end - start)))]);
  }
  return audible.length >= FILL_DRAG_FROM ? { drag: audible[0], seats } : { seats };
}

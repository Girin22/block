/**
 * Seasonal environments that join the pause screen's picker for a few days, then step out again. The
 * window is read from the device's own date, so an event ships ahead in an update and opens by itself.
 */
export interface SeasonalEvent {
  /** First and last day shown, as [month, day] in the device's local time (both inclusive). */
  from: [number, number];
  to: [number, number];
}

export const HALLOWEEN: SeasonalEvent = { from: [10, 24], to: [11, 2] };
/** Winter: snow from the first of December to the end of February (the 29th in a leap year). */
export const CHRISTMAS: SeasonalEvent = { from: [12, 1], to: [2, 29] };

/**
 * The winter greeting's phrases for a date, in the order they are shown: Christmas wishes up to the
 * 25th, both in the last days of the year, New Year wishes for its first week, then none: the snow
 * stays through February, but a greeting that late would only seem forgotten.
 */
export const GREETINGS = ['Merry Christmas', 'Happy New Year'] as const;
export function greetingPhrases(date = new Date()): string[] {
  const day = (date.getMonth() + 1) * 100 + date.getDate();
  if (day >= 1201 && day <= 1225) return [GREETINGS[0]];
  if (day >= 1226) return [...GREETINGS];
  if (day <= 107) return [GREETINGS[1]];
  return [];
}

/** Whether the snow ducks wear Santa hats on this date: Christmas Eve and Christmas Day only. */
export function santaDay(date = new Date()) {
  return date.getMonth() === 11 && (date.getDate() === 24 || date.getDate() === 25);
}

/** Whether the event is open on this date. A window may run across the new year. */
export function eventOpen(event: SeasonalEvent, date = new Date()) {
  const day = (date.getMonth() + 1) * 100 + date.getDate();
  const from = event.from[0] * 100 + event.from[1], to = event.to[0] * 100 + event.to[1];
  return from <= to ? day >= from && day <= to : day >= from || day <= to;
}

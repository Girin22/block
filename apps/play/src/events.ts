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

/** Whether the event is open on this date. A window may run across the new year. */
export function eventOpen(event: SeasonalEvent, date = new Date()) {
  const day = (date.getMonth() + 1) * 100 + date.getDate();
  const from = event.from[0] * 100 + event.from[1], to = event.to[0] * 100 + event.to[1];
  return from <= to ? day >= from && day <= to : day >= from || day <= to;
}

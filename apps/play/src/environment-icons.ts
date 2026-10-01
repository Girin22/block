import type { Environment } from './ambience';

/** The environments the picker offers. Morning and night are switched off for now. */
export type PickedEnvironment = Extract<Environment, 'off' | 'day' | 'rain'>;

/**
 * Line icons for the environment picker, drawn on a 24px grid with round caps so they sit with the
 * handwriting face. Parts that move when selected carry a class (see style.css).
 */
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

// Kept sparse in the manner of system symbols: few strokes, generous space, dots instead of window frames.
export const environmentIcons: Record<PickedEnvironment, string> = {
  // A small cross: no ambience. It turns into place when chosen.
  off: svg(`<path class="cross" d="M7.5 7.5l9 9M16.5 7.5l-9 9"/>`),
  // Two buildings of different heights; their window dots flicker while selected, like a city at work.
  day: svg(`<path d="M5.5 19.5V6a1.5 1.5 0 0 1 1.5-1.5h4.5A1.5 1.5 0 0 1 13 6v13.5M13 10h3.5a1.5 1.5 0 0 1 1.5 1.5v8M4 19.5h16"/>
    <g class="lights"><path d="M8.25 8.5h.01"/><path d="M10.25 8.5h.01"/><path d="M8.25 12h.01"/><path d="M10.25 12h.01"/><path d="M15.5 14h.01"/></g>`),
  // A cloud with three short drops that fall while selected.
  rain: svg(`<path d="M8 15h8.5a3.5 3.5 0 0 0 .2-7 5 5 0 0 0-9.5-.4A3.7 3.7 0 0 0 8 15Z"/>
    <g class="drops"><path d="m9 18-.6 1.4"/><path d="m12.5 18-.6 1.4"/><path d="m16 18-.6 1.4"/></g>`),
};

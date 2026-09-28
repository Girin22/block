import type { Environment } from './ambience';

/**
 * Line icons for the environment picker, drawn on a 24px grid with round caps so they sit with the
 * handwriting face. Parts that move when selected carry a class (see style.css).
 */
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const environmentIcons: Record<Environment, string> = {
  // A sun half over the horizon, rays fanning upward.
  morning: svg(`<path d="M3.5 17.5h17"/><path d="M8 20.5h8"/>
    <g class="rise"><path d="M7.5 17.5a4.5 4.5 0 0 1 9 0"/><path d="M12 7.5v2M6.2 9.9l1.4 1.4M17.8 9.9l-1.4 1.4M4 14.2h1.8M18.2 14.2H20"/></g>`),
  // A full sun; the rays turn slowly while selected.
  day: svg(`<circle cx="12" cy="12" r="3.8"/>
    <g class="rays"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></g>`),
  // A crescent with one small star that twinkles while selected.
  night: svg(`<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1Z"/>
    <path class="star" d="M17.5 3.8v2.4M16.3 5h2.4"/>`),
  // A cloud with three slanted drops that fall while selected.
  rain: svg(`<path d="M7.2 14.5h9.6a3.7 3.7 0 0 0 .4-7.4 5.2 5.2 0 0 0-10-.3A3.9 3.9 0 0 0 7.2 14.5Z"/>
    <g class="drops"><path d="m8.6 17.5-.9 2"/><path d="m12.4 17.5-.9 2"/><path d="m16.2 17.5-.9 2"/></g>`),
};

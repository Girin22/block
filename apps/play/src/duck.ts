import { santaDay } from './events';
import duckImage from '../../../assets/images/christmas/snow-duck.png?url';
import santaDuckImage from '../../../assets/images/christmas/snow-duck-santa.png?url';
import { tuning } from './tuning';

/**
 * Snow ducks (a Christmas option, tuning.giftWrap === 2; it and the gift blocks exclude each other).
 * Every space the player seals off is filled with one-cell pieces only, and those are not pavers: the
 * gap stays open until a pair of snow-duck tongs comes over, closes on it, and leaves a duck made of
 * snow sitting there. The tongs only show up when there is a gap to fill, work through the gaps one by
 * one in the order they appeared, and leave again; seal off a big space and a whole troop of ducks is
 * pressed out in a row.
 *
 * The duck is a picture the filler wears (see tileArtwork), so the saved image shows the ducks as they
 * are on screen. A gap the tongs have not reached yet wears an empty picture.
 */
export const ducksOn = () => tuning.giftWrap === 2;

/** Fillers waiting for the tongs: still an open gap. */
const waiting = new Set<number>();
export const isWaiting = (id: number) => waiting.has(id);

/** The duck pictures: the plain duck, and the duck in a Santa hat for Christmas Eve and Christmas Day. */
const DUCK_IMAGES = [duckImage, santaDuckImage];
let sources: (HTMLImageElement | undefined)[] | undefined, none = '';
/** Drawn pictures by kind and whole degrees of lean. */
const drawn = new Map<string, string>();
let preparing: Promise<void> | undefined;
/** Loads the pictures once; until they are ready the fillers stay plain. */
export function prepareDucks() {
  return preparing ??= Promise.all(DUCK_IMAGES.map(url => new Promise<HTMLImageElement | undefined>(resolve => {
    const image = new Image();
    image.onload = () => resolve(image); image.onerror = () => resolve(undefined);
    image.src = url;
  }))).then(images => { none = duckPicture(); sources = images; });
}
/** The picture a one-cell filler wears while ducks are on, or nothing if they are off or not drawn yet. */
export function duckArt(id: number) {
  if (!ducksOn() || !sources) return undefined;
  if (waiting.has(id)) return none;
  // Plain ducks, in Santa hats on Christmas Eve and Christmas Day (or always, if a tester asks for it).
  const wanted = tuning.duckKind || santaDay() ? 1 : 0, kind = sources[wanted] ? wanted : 0, image = sources[kind];
  if (!image) return undefined;
  // The lean is fixed by the tile, so a duck keeps it across redraws and in the saved image.
  // Each leans its own way within tuning.duckTilt degrees either side, so a row of them is not stamped.
  const lean = Math.round((((Math.imul(id + 1, 2654435761) >>> 8) % 1001) / 500 - 1) * tuning.duckTilt), key = `${kind}:${lean}`;
  let picture = drawn.get(key);
  if (!picture) drawn.set(key, picture = duckPicture(image, lean));
  return picture;
}

const SIZE = 350;
/**
 * A snow duck (the planner's pictures, assets/images/christmas/snow-duck.png and snow-duck-santa.png),
 * all facing the same way but each leaning `lean` degrees.
 * The floor of its gap is not in this picture: the snow cover is laid there like on the pavers around it
 * (snow.ts, `SnowGround.floor`), and the duck is drawn over that cover with a soft shadow on the snow.
 * Without `duck` the picture is empty: a gap still waiting for the tongs.
 */
function duckPicture(duck?: HTMLImageElement, lean = 0) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  const context = canvas.getContext('2d')!;
  if (!duck) return canvas.toDataURL();
  // As large as the gap allows; its shadow falls to the lower left like the pavers'.
  const width = 256, height = width * duck.naturalHeight / duck.naturalWidth, left = (SIZE - width) / 2 + 2, top = 166 - height / 2;
  context.fillStyle = 'rgba(70,86,112,0.18)';
  context.beginPath(); context.ellipse(SIZE / 2 - 10, top + height - 14, width * 0.42, 26, 0, 0, Math.PI * 2); context.fill();
  // The duck is the whitest thing in the gap: its picture is lifted a little on a sheet of its own, so the
  // snow it sits on does not make it look grey.
  const sheet = document.createElement('canvas'); sheet.width = sheet.height = SIZE;
  const lifted = sheet.getContext('2d')!;
  // It leans about the middle of its base, as if set down a little askew.
  lifted.imageSmoothingQuality = 'high'; lifted.translate(left + width / 2, top + height * 0.85); lifted.rotate(lean * Math.PI / 180);
  lifted.drawImage(duck, -width / 2, -height * 0.85, width, height); lifted.setTransform(1, 0, 0, 1, 0, 0);
  lifted.globalCompositeOperation = 'source-atop'; lifted.fillStyle = 'rgba(255,255,255,0.24)'; lifted.fillRect(0, 0, SIZE, SIZE);
  context.drawImage(sheet, 0, 0);
  return canvas.toDataURL();
}

interface Cell { id: number; x: number; y: number; }
export interface TongsHost {
  /** Where a board point is inside `parent`, in CSS pixels, and how wide one cell is; undefined while there is no board to stand on. */
  place(x: number, y: number): { x: number; y: number; cell: number } | undefined;
  /** Whether the game is standing still (paused, a dialog open): the tongs wait. */
  held(): boolean;
  /** A duck has just been pressed out in this cell. */
  made(cell: Cell): void;
}

const NS = 'http://www.w3.org/2000/svg';
/**
 * The head of the tool: a duck-shaped mould seen from above (plump: a round back, pointed tail, big round head
 * and flat bill in a line, a folded wing marked on either side), drawn facing left and turned to lie
 * along the tool: bill away from the handles, tail towards the pivot. It is split down the duck's
 * middle, which is the tool's own axis, and each arm carries its half (2026-11-21, after the planner's
 * picture of real snow-duck tongs; before, each arm carried a whole duck upright on screen). Closed,
 * the halves meet as one duck; open, they part and the darker inner rim of each shows. One unit is a cell.
 */
const DUCK_MOULD = '<ellipse cx="0.1" cy="0" rx="0.335" ry="0.345"/><path d="M0.36 -0.16 Q0.57 0 0.36 0.16 Z"/><circle cx="-0.225" cy="0" r="0.24"/><path d="M-0.41 -0.1 Q-0.545 -0.095 -0.545 0 Q-0.545 0.095 -0.41 0.1 Z"/>';
/** How far the jaws swing open, in degrees, and the tool's reach in cells (the picture is this wide and tall). */
const JAW = 17, REACH = 6;
/** Seconds: closing on a gap, pressing, opening again, fading away once nothing is left, and fading in. */
const CLOSE = 0.14, PRESS = 0.26, OPEN = 0.24, LEAVE = 0.45, APPEAR = 0.28;

/**
 * The tongs: two cupped halves on long handles, crossed at a pivot like scissors. Drawn once as a
 * picture over the board and moved by the frame; they stay with the board as the camera climbs.
 */
export class DuckTongs {
  private root = document.createElement('div');
  private arms: SVGGElement[] = [];
  private queue: Cell[] = [];
  private raf = 0;
  private last = 0;
  private at?: { x: number; y: number };
  private from = { x: 0, y: 0 };
  private phase: 'travel' | 'close' | 'press' | 'open' | 'leave' = 'travel';
  private t = 0;
  private span = 0.4;
  /** 0-1: the tongs fade in where the work starts and fade out where it ends; they never cross the screen's edge. */
  private shown = 0;
  private released = false;
  /** Seconds until the tongs appear for work that has just come up. */
  private startIn?: number;

  constructor(parent: HTMLElement, private host: TongsHost) {
    this.root.className = 'duck-tongs'; this.root.setAttribute('aria-hidden', 'true'); this.root.hidden = true;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `${-REACH / 2} ${-REACH / 2} ${REACH} ${REACH}`);
    // The tool lies at a slant, handles off towards the lower right, as a hand would hold it.
    const tool = document.createElementNS(NS, 'g'); tool.setAttribute('transform', 'rotate(-38)');
    // Light from the top of the screen. The tool is turned 38 degrees and one arm mirrors the other, so
    // each half of the mould gets its own highlight centre, both towards the top of the screen.
    const dome = '<stop offset="0" stop-color="#ffe85e"/><stop offset="0.4" stop-color="#ffd117"/><stop offset="1" stop-color="#eeb200"/>';
    svg.innerHTML = `<defs>
      <radialGradient id="tongs-dome-a" gradientUnits="userSpaceOnUse" cx="-0.22" cy="-0.2" r="0.75">${dome}</radialGradient>
      <radialGradient id="tongs-dome-b" gradientUnits="userSpaceOnUse" cx="0.02" cy="-0.22" r="0.75">${dome}</radialGradient>
      <clipPath id="tongs-half"><rect x="-1" y="-1" width="1.004" height="2"/></clipPath>
      <clipPath id="tongs-rim"><rect x="-0.085" y="-1" width="0.09" height="2"/></clipPath>
      <radialGradient id="tongs-inside" gradientUnits="userSpaceOnUse" cx="0.05" cy="0.1" r="0.6"><stop offset="0" stop-color="#d79a00"/><stop offset="0.7" stop-color="#e9ae00"/><stop offset="1" stop-color="#f6c416"/></radialGradient>
      <radialGradient id="tongs-pivot" cx="0.4" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffe566"/><stop offset="0.55" stop-color="#ffcd0a"/><stop offset="1" stop-color="#dfa400"/></radialGradient>
    </defs>`;
    for (const side of [-1, 1]) {
      const arm = document.createElementNS(NS, 'g');
      // One arm: half of the round mould, a neck down to the pivot, and past it the handle with its finger ring.
      // Moulded plastic with no drawn outline (2026-11-21, after the planner's rendered reference): each
      // part is shaded as a solid. A bar is a dark underside, its body, and a line of light along the top;
      // the head is a duck-shaped mould (2026-11-21, in place of the half dome) with a soft highlight, and,
      // when the jaws are apart, its darker hollow.
      const key = side < 0 ? 'a' : 'b';
      const bar = (d: string) => `<path d="${d}" stroke="#e2a700" stroke-width="0.19" stroke-linecap="round"/><path d="${d}" stroke="#ffcd0a" stroke-width="0.15" stroke-linecap="round" transform="translate(0,-0.012)"/><path d="${d}" stroke="#ffe46a" stroke-width="0.04" stroke-linecap="round" opacity="0.85" transform="translate(-0.03,-0.03)"/>`;
      arm.innerHTML = `<g transform="scale(${side},1)">
        ${bar('M-0.02 1.25 L0.3 2.0')}
        <circle cx="0.38" cy="2.26" r="0.21" fill="none" stroke="#e2a700" stroke-width="0.15"/>
        <circle cx="0.38" cy="2.25" r="0.21" fill="none" stroke="#ffcd0a" stroke-width="0.12"/>
        <path d="M0.2 2.17 A0.21 0.21 0 0 1 0.42 2.045" fill="none" stroke="#ffe46a" stroke-width="0.035" stroke-linecap="round" opacity="0.9"/>
        ${bar('M-0.16 0.4 L-0.02 1.25')}
        <g clip-path="url(#tongs-half)" transform="translate(0,-0.03) scale(1.28,1.14)">
          <g transform="rotate(90)">
            <g fill="url(#tongs-dome-${key})">${DUCK_MOULD}</g>
            <path d="M-0.05 0.14 Q0.16 0.35 0.4 0.11 Q0.2 0.06 -0.05 0.14 Z" fill="#c98f00" opacity="0.24"/>
          </g>
          <ellipse cx="-0.12" cy="-0.27" rx="0.05" ry="0.075" fill="#fff6c0" opacity="0.5"/>
          <ellipse cx="-0.255" cy="0.07" rx="0.045" ry="0.16" fill="#fff6c0" opacity="0.28"/>
          <g class="inside" clip-path="url(#tongs-rim)">
            <g transform="rotate(90)" fill="url(#tongs-inside)">${DUCK_MOULD}</g>
          </g>
        </g>
      </g>`;
      tool.append(arm); this.arms.push(arm);
    }
    const pivot = document.createElementNS(NS, 'circle');
    pivot.setAttribute('cx', '0'); pivot.setAttribute('cy', '1.25'); pivot.setAttribute('r', '0.12'); pivot.setAttribute('fill', 'url(#tongs-pivot)');
    tool.append(pivot); svg.append(tool); this.root.append(svg); parent.append(this.root);
  }

  /** New gaps to fill: they stay open until the tongs get to them. */
  add(cells: readonly Cell[], delay = 0) {
    if (!cells.length) return;
    for (const cell of cells) { waiting.add(cell.id); this.queue.push({ id: cell.id, x: cell.x, y: cell.y }); }
    if (!this.at) this.startIn ??= delay;
    else if (this.phase === 'leave') this.setOff();
    // (Called back while fading out, they simply fade in again on the way to the new gap.)
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); }
  }
  /** A new session: nothing waits, and the tongs are gone. */
  reset() {
    waiting.clear(); this.queue = []; this.at = undefined; this.startIn = undefined; this.root.hidden = true;
    cancelAnimationFrame(this.raf); this.raf = 0;
  }
  /** Ducks were switched off: every gap is simply filled, at once. */
  finishAll() { const rest = this.queue; this.reset(); for (const cell of rest) this.host.made(cell); }

  private setOff() {
    const next = this.queue[0];
    this.from = { ...this.at! }; this.phase = 'travel'; this.t = 0;
    this.span = Math.max(0.26, Math.min(0.62, Math.hypot(next.x + 0.5 - this.from.x, next.y + 0.5 - this.from.y) * 0.085));
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = this.host.held() ? 0 : Math.min(0.05, Math.max(0, (now - this.last) / 1000)); this.last = now;
    if (!this.at) {
      // Not here yet: the snow is still settling into the new gaps. Then they appear just beside the first
      // gap, lifted, and come down onto it as they fade in.
      if (this.startIn === undefined || !this.queue.length) { this.startIn = undefined; return; }
      this.startIn -= dt;
      if (this.startIn > 0) { this.raf = requestAnimationFrame(this.frame); return; }
      const first = this.queue[0];
      this.startIn = undefined; this.at = { x: first.x + 0.5 + 0.8, y: first.y + 0.5 + 0.9 }; this.shown = 0; this.setOff(); this.span = APPEAR;
    }
    const at = this.at;
    // A long row of gaps is worked through faster, so a troop does not take all day.
    const pace = 1 + Math.min(2, this.queue.length / 6);
    let jaw = 1, lift = 0, shake = 0;
    if (this.phase === 'travel') {
      const next = this.queue[0];
      this.t = Math.min(1, this.t + dt * pace / this.span);
      const ease = this.t * this.t * (3 - 2 * this.t);
      at.x = this.from.x + (next.x + 0.5 - this.from.x) * ease; at.y = this.from.y + (next.y + 0.5 - this.from.y) * ease;
      lift = Math.sin(Math.PI * this.t);
      this.shown = Math.min(1, this.shown + dt / APPEAR);
      if (this.t >= 1 && this.shown >= 1) { this.phase = 'close'; this.t = 0; }
    } else if (this.phase === 'close') {
      this.t = Math.min(1, this.t + dt * pace / CLOSE); jaw = 1 - this.t * this.t;
      if (this.t >= 1) { this.phase = 'press'; this.t = 0; }
    } else if (this.phase === 'press') {
      this.t = Math.min(1, this.t + dt * pace / PRESS); jaw = 0; shake = Math.sin(this.t * Math.PI * 4) * (1 - this.t);
      if (this.t >= 1) {
        this.phase = 'open'; this.t = 0; this.released = false;
      }
    } else if (this.phase === 'open') {
      this.t = Math.min(1, this.t + dt * pace / OPEN); jaw = this.t * (2 - this.t); lift = 0.35 * this.t;
      // The duck is there only once the jaws have let go of it: it shows as they part, not before.
      if (!this.released && this.t >= 0.35) { this.released = true; const done = this.queue.shift()!; waiting.delete(done.id); this.host.made(done); }
      if (this.t >= 1) {
        if (this.queue.length) this.setOff();
        else { this.phase = 'leave'; this.t = 0; this.from = { ...at }; }
      }
    } else {
      this.t = Math.min(1, this.t + dt / LEAVE);
      // Lifted off the last duck and gone, on the spot.
      at.x = this.from.x + 0.35 * this.t; at.y = this.from.y + 0.4 * this.t; lift = 0.35 + 0.65 * this.t; this.shown = 1 - this.t * this.t;
      if (this.t >= 1) { this.at = undefined; this.root.hidden = true; return; }
    }
    const spot = this.host.place(at.x, at.y);
    if (spot) {
      const size = spot.cell * REACH;
      this.root.hidden = false;
      this.root.style.width = this.root.style.height = `${size}px`;
      // Carried a little above the board between gaps (larger, its shadow further off), pressed flat onto it at work.
      this.root.style.transform = `translate(${spot.x - size / 2}px,${spot.y - size / 2}px) scale(${1 + 0.1 * lift - 0.03 * (this.phase === 'press' ? 1 : 0)}) rotate(${shake * 3.5}deg)`;
      this.root.style.setProperty('--lift', String(lift)); this.root.style.setProperty('--shown', String(this.shown));
      // The hollow of each mould shows only while the jaws are apart; closed, they make one duck.
      for (const arm of this.arms) (arm.querySelector('.inside') as SVGGElement).style.opacity = String(Math.min(1, jaw * 1.6) * 0.85);
      this.arms[0].setAttribute('transform', `rotate(${JAW * jaw} 0 1.25)`);
      this.arms[1].setAttribute('transform', `rotate(${-JAW * jaw} 0 1.25)`);
    }
    this.raf = requestAnimationFrame(this.frame);
  };
}

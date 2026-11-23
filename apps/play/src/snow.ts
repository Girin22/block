/**
 * Snow weather (the Christmas environment), seen from straight above like the rain.
 * - Flakes drift over the screen on their own canvas, shrinking as they sink towards the ground.
 * - A cover builds up cell by cell, cut to the pavers' own interlocking outline so it sits on the
 *   blocks rather than hanging over them as a haze. By default only the pavers gather snow; the planner
 *   can let the whole ground gather it too (tuning.snowArea). The cover is one depth everywhere, set by
 *   how long it has snowed. The block in play carries only a light dusting (its own small picture,
 *   which the scene carries along); once it is down, the snow of its place gathers on it within a few
 *   seconds, so it joins the picture around it without a jump. The scene draws the
 *   cover under the falling block (a picture in board coordinates, redrawn only as it changes).
 * - Once the cover is deep enough, a dog trots across now and then, pressing a paw print at each step,
 *   only where there is snow to press. The prints are shallow: packed snow with a lit rim, not holes.
 *   New snow slowly fills them in again.
 * Purely visual: it never touches the board, the piece count, or the export.
 */
import { WIDTH } from '../../../packages/play-core';
import type { RainView } from './rain';
import { tuning } from './tuning';

/** Seconds for the snowfall to reach full strength and to die away, and for the cover to melt once it has. */
export const SNOW_RISE = 3, SNOW_FALL = 4, MELT_SECONDS = 6;
/** Depth (0-1 of a full cover) of new snow that fills a print in again. */
export const PRINT_REFILL = 1.2;
/** A print is only pressed where the cover is at least this deep; thinner snow shows no mark. */
export const PRINT_MIN_DEPTH = 0.25;
/** The dog's trot. Sizes in board cells (one cell is 11.25 cm of real pavement), speed in cells per second. */
export const GAIT = { size: 0.5, step: 1.2, side: 0.28, speed: 3.4 };

export interface Print { x: number; y: number; angle: number; }
export interface Step extends Print { at: number; }

/**
 * The prints of a dog crossing a band `rows` cells tall that starts at row `bottom`: in at one edge and
 * out at another, level or on a diagonal, wandering a little, left and right paws alternating. `at` is
 * the second each print is pressed. A level path over a low band is kept flatter so it stays inside.
 * `random` makes it repeatable for tests.
 */
export function planWalk(bottom: number, rows: number, random = Math.random): Step[] {
  const steps: Step[] = [], flat = Math.min(1, rows / 10);
  // Half the crossings run more or less level, the other half on a diagonal of 25 to 55 degrees, up or down.
  const diagonal = random() < 0.5, rightwards = random() < 0.5, upwards = random() < 0.5;
  const tilt = diagonal ? (0.45 + random() * 0.5) * (upwards ? 1 : -1) : (random() - 0.5) * 0.5 * flat;
  const heading = rightwards ? tilt : Math.PI - tilt;
  // The path is laid through a point inside the band, then traced back to where it enters.
  let x = WIDTH * (0.25 + random() * 0.5), y = bottom + rows * (0.25 + random() * 0.5);
  for (let back = 0; back < 40 && x > -1.6 && x < WIDTH + 1.6 && y > bottom - 1.5 && y < bottom + rows + 1.5; back++) {
    x -= Math.cos(heading) * GAIT.step; y -= Math.sin(heading) * GAIT.step;
  }
  const sway = (0.1 + random() * 0.15) * (diagonal ? 1 : flat), phase = random() * Math.PI * 2;
  for (let i = 0; i < 48; i++) {
    const angle = heading + Math.sin(phase + i * 0.55) * sway, side = i % 2 ? 1 : -1;
    x += Math.cos(angle) * GAIT.step; y += Math.sin(angle) * GAIT.step;
    if (x < -2 || x > WIDTH + 2 || y < bottom - 2 || y > bottom + rows + 2) break;
    steps.push({ x: x - Math.sin(angle) * GAIT.side * side, y: y + Math.cos(angle) * GAIT.side * side, angle, at: i * GAIT.step / GAIT.speed });
  }
  return steps;
}

/** Depth of the cover (0-1) from how much has fallen since the cell was last bare. */
export function coverDepth(fallen: number, since: number) { return Math.max(0, Math.min(1, fallen - since)); }

/** A steady number in [0, 1) for a cell, so the cover's grain does not shimmer between redraws. */
function grain(x: number, y: number, salt: number) {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ salt * 83492791, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** What the snow asks about the board: which cells hold a paver, and how high the stack reaches. */
export interface SnowGround { filled(x: number, y: number): boolean; height(): number; /** Whether two cells are one paver. */ joined?(x1: number, y1: number, x2: number, y2: number): boolean; /** Whether a cell is open ground that holds snow (a snow duck's gap): it is laid thicker there, to show on the dark floor. */ floor?(x: number, y: number): boolean; }

interface Flake { x: number; y: number; radius: number; age: number; life: number; fall: number; phase: number; alpha: number; }

/** Cover picture: pixels per cell, and how often it is redrawn while the snow is still building up. */
// (2026-11-22: each interval here was lengthened. Every redraw also sends the whole picture to the graphics
// card again, and on a phone the winter environment ran hot and stuttered. Snow is slow; it does not show.)
const CELL_PX = 40, COVER_INTERVAL = 1.5, PRINT_INTERVAL = 3, STEP_INTERVAL = 0.2;
/** Seconds between redraws of the string lights: they glow slowly, so a third of the frames is plenty. */
const LIGHTS_INTERVAL = 0.05, LIGHTS_MARGIN = 1;
const COVER_COLUMNS = WIDTH + 2;
/** Rows the picture holds beyond the view, below and above: the camera climbs this far before it is redrawn whole. */
const ROWS_BELOW = 2, ROWS_ABOVE = 9;
/** How far a point lies from the middle of the pavement towards its sides: 0 in the middle, 1 at the frame. */
const sideways = (x: number) => Math.min(1.3, Math.abs(x - WIDTH / 2) / (WIDTH / 2));
/**
 * How much snow lies at a point once it has all fallen, 0-1: a walked-on pavement, thin and patchy down
 * the middle and thick along both sides, where nobody treads. The patches follow a slow noise field and
 * know nothing of the pavers' outlines, so the snow lies across the stones rather than tracing them.
 */
function snowDensity(x: number, y: number) {
  const side = sideways(x), field = driftField(x, y);
  return Math.min(1, 0.08 + 0.7 * Math.max(0, field - 0.3) + (0.35 + 0.65 * field) * side * side);
}
/** Soft, grainy patches of snow, drawn once and stamped wherever snow lies. */
const SPRITE_PX = 64, SNOW_SPRITES = 4;
let sprites: HTMLCanvasElement[] | undefined;
function snowSprites() {
  if (sprites) return sprites;
  sprites = [];
  for (let v = 0; v < SNOW_SPRITES; v++) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = SPRITE_PX;
    const context = canvas.getContext('2d')!, half = SPRITE_PX / 2;
    // A few soft lobes make an uneven patch with no edge to speak of.
    for (let n = 0; n < 5; n++) {
      const cx = half + (grain(v, n, 301) - 0.5) * 18, cy = half + (grain(v, n, 302) - 0.5) * 18, r = 9 + grain(v, n, 303) * 11;
      const lobe = context.createRadialGradient(cx, cy, 0, cx, cy, r);
      lobe.addColorStop(0, 'rgba(247,250,254,0.62)'); lobe.addColorStop(0.5, 'rgba(247,250,254,0.34)'); lobe.addColorStop(1, 'rgba(247,250,254,0)');
      context.fillStyle = lobe; context.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
    }
    // No pinholes: punched through and then enlarged on the board, they made the snow look like pitted
    // rock. Only a few flakes that catch the light, kept inside the patch.
    context.globalCompositeOperation = 'source-atop'; context.fillStyle = '#ffffff';
    for (let n = 0; n < 12; n++) {
      context.globalAlpha = 0.35 + 0.4 * grain(v, n, 320);
      context.fillRect(half + (grain(v, n, 322) - 0.5) * 30, half + (grain(v, n, 323) - 0.5) * 30, 1, 1);
    }
    sprites.push(canvas);
  }
  return sprites;
}

/**
 * The patches of snow on one cell: four of them, a little off the quarter points, each wider than the cell.
 * `draw` is given each patch's centre (board cells), its width in cells, which sprite, and how strong it is.
 * `depth` is the cell's own snow and `amount` the snow overall (both 0-1); `floor` marks the open floor of a
 * snow duck's gap, where the same snow is laid thicker (or it would be lost against the dark ground) and
 * then cut to the planner's share `kept`. The screen and the saved image both draw from this.
 */
export function eachSnowPatch(x: number, y: number, depth: number, amount: number, floor: boolean, kept: number, cover: number, draw: (lx: number, ly: number, size: number, sprite: number, strength: number) => void) {
  const share = depth * depth * (3 - 2 * depth);
  for (let n = 0; n < 4; n++) {
    const lx = x + (n & 1) * 0.5 + 0.25 + (grain(x, y, n + 104) - 0.5) * 0.3, ly = y + (n >> 1) * 0.5 + 0.25 + (grain(x, y, n + 108) - 0.5) * 0.3;
    // A gap's floor has its snow in full as soon as it has gathered, however little has fallen on the pavers so far.
    const strength = (floor
      ? Math.min(1, snowDensity(lx, ly) * 1.6 * share + 0.18 * (amount > 0 ? Math.min(1, depth / amount) : 0)) * kept
      : snowDensity(lx, ly) * share) * cover;
    if (strength < 0.03) continue;
    draw(lx, ly, 1 + 0.6 * grain(x, y, n + 112), Math.floor(grain(x, y, n + 116) * SNOW_SPRITES), strength);
  }
}
/** The snow sprites as pictures a saved image can hold inline. */
export function snowSpriteURLs() { return snowSprites().map(sprite => sprite.toDataURL('image/png')); }

/** Where the drifts lie, 0-1: smooth noise a few cells across, so patches and bare stretches are both broad. */
function driftField(x: number, y: number) {
  const octave = (scale: number, salt: number) => {
    const u = x / scale, v = y / scale, i = Math.floor(u), j = Math.floor(v);
    const fu = u - i, fv = v - j, su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
    const low = grain(i, j, salt) + (grain(i + 1, j, salt) - grain(i, j, salt)) * su;
    const high = grain(i, j + 1, salt) + (grain(i + 1, j + 1, salt) - grain(i, j + 1, salt)) * su;
    return low + (high - low) * sv;
  };
  return Math.max(0, Math.min(1, (octave(1.9, 200) * 0.65 + octave(0.7, 201) * 0.35 - 0.2) / 0.6));
}
/** The pavers' edge warp (play-core's contour): the same wave everywhere, so cells join like the artwork. */
export const WARP = 0.115;
const SIDE_POINTS = 6;
/**
 * The snow pictures are drawn by the processor, not the graphics card (2026-11-23). They are made of
 * thousands of small stamps and then handed to WebGL as a texture; drawn on the card, a slow phone's
 * graphics thread stalled on them for up to 0.7 s at a time (measured on a Galaxy Tab A7 Lite: 15 frames
 * a second in the winter environment, 32 with only this changed).
 */
const SOFT: CanvasRenderingContext2DSettings = { willReadFrequently: true };
const cellKey = (x: number, y: number) => y * 16 + x + 2;
/**
 * A block comes down with only a little snow on it (`FRESH` of what lies around). Once it is down, the
 * snow of its place gathers on it over `RUSTLE_SECONDS`, redrawn often enough to read as one movement.
 */
export const FRESH = 0.3;
const RUSTLE_SECONDS = 8, RUSTLE_REDRAW = 0.5, QUICK_REDRAW = 0.15;
/** Where the block in play's own snow is read from: mid-pavement, far below anything on the board. */
const PIECE_HOME = { x: Math.floor(WIDTH / 2) - 1, y: -4000 };
/** The falling block's own cover: this much room around its cells for the warped outline. */
export const PIECE_MARGIN = 0.25;

/** A crumb of snow knocked loose, in board cells. */
interface Puff { x: number; y: number; vx: number; vy: number; radius: number; age: number; life: number; /** A sparkle rather than a crumb: its colour, and where its twinkle starts. */ colour?: string; twinkle?: number; }
/** The sparkles a duck in a Santa hat throws up as it is pressed out: the string lights' colours, brighter. */
const SPARKLES = ['#fff3c4', '#ffd45e', '#fff3c4', '#ff8f80', '#ffffff', '#8fe6b4'];

/**
 * String lights down both sides of the pavement (tuning.snowLights): a dark wire swaying gently along
 * each edge of the screen with a small bulb every so often, mostly warm white with gold, a soft red and a
 * soft green among them. Each bulb breathes at its own pace, never blinking off. They hang at fixed
 * heights on the board, so they pass by as the stack climbs.
 */
const BULB_COLOURS = ['#ffe6b0', '#ffc95a', '#ffe6b0', '#ff7d6e', '#ffe6b0', '#86d8a8'];
const WIRE_SWAY = 0.13, WIRE_WAVE = 1.9, BULB_PX = 64;
/** One colour for every bulb (tuning.lightsColour): gold, or a clean white. */
const BULB_GOLD = ['#ffc95a'], BULB_WHITE = ['#fff8ea'];
const bulbs = new Map<readonly string[], HTMLCanvasElement[]>();
function bulbSprites(colours: readonly string[]) {
  let sprites = bulbs.get(colours);
  if (!sprites) bulbs.set(colours, sprites = colours.map(colour => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = BULB_PX;
    const context = canvas.getContext('2d')!, half = BULB_PX / 2;
    // The glow, then the glass, then the filament's white point.
    const glow = context.createRadialGradient(half, half, 0, half, half, half);
    glow.addColorStop(0, colour + 'cc'); glow.addColorStop(0.22, colour + '66'); glow.addColorStop(0.55, colour + '1c'); glow.addColorStop(1, colour + '00');
    context.fillStyle = glow; context.fillRect(0, 0, BULB_PX, BULB_PX);
    context.fillStyle = colour; context.beginPath(); context.arc(half, half, BULB_PX * 0.105, 0, Math.PI * 2); context.fill();
    context.fillStyle = 'rgba(255,255,255,0.85)'; context.beginPath(); context.arc(half - 1, half - 1.5, BULB_PX * 0.045, 0, Math.PI * 2); context.fill();
    return canvas;
  }));
  return sprites;
}
/**
 * How bright bulb k of one string is now (tuning.lightsEffect). None of them goes fully dark.
 * 0 breath: each at its own slow pace. 1 twinkle: steady, with a brief sparkle now and then.
 * 2 flow: a wave of light running down the string. 3 turns: neighbours brighten in turn.
 */
function bulbLight(k: number, side: number, clock: number) {
  const effect = tuning.lightsEffect;
  if (effect === 1) {
    const spark = Math.max(0, Math.sin(clock * (1.1 + 0.9 * grain(k, side, 401)) + grain(k, side, 402) * Math.PI * 2));
    return 0.5 + 0.5 * spark ** 10;
  }
  if (effect === 2) return 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(clock * 2.6 + k * 0.8 + side * 1.5)) ** 2;
  if (effect === 3) {
    const turn = 0.5 + 0.5 * Math.tanh(2.5 * Math.sin(clock * 1.5));
    return 0.3 + 0.7 * ((k + side) % 2 === 0 ? turn : 1 - turn);
  }
  return 0.72 + 0.28 * Math.sin(clock * (0.9 + 0.35 * grain(k, side, 401)) + grain(k, side, 402) * Math.PI * 2);
}
function drawLights(context: CanvasRenderingContext2D, view: RainView, clock: number, strength: number) {
  const sprites = bulbSprites(tuning.lightsColour === 1 ? BULB_GOLD : tuning.lightsColour === 2 ? BULB_WHITE : BULB_COLOURS), rows = view.heightPx / view.cellPx, bottom = view.top - rows;
  const toY = (y: number) => (view.top - y) * view.cellPx;
  const BULB_PITCH = Math.max(0.2, tuning.lightsPitch), zigzag = tuning.lightsZigzag;
  for (const right of [false, true]) {
    // The wire keeps a fixed distance from the middle of the screen (tuning.lightsSpan) and sways about it with height.
    const edge = view.widthPx / 2 * (1 + (right ? 1 : -1) * tuning.lightsSpan / 100), turn = right ? 1.7 : 0;
    const wireX = (y: number) => edge + Math.sin(y * Math.PI * 2 / WIRE_WAVE + turn) * WIRE_SWAY * view.cellPx * (right ? -1 : 1);
    context.globalAlpha = 0.8 * strength; context.strokeStyle = '#26332c'; context.lineWidth = 1.1; context.lineJoin = 'round';
    // The wire itself is left out unless asked for (tuning.lightsWire): two dark lines down the screen's edges
    // caught the eye more than the lights did (2026-11-22). The bulbs keep the places it gave them.
    const wired = tuning.lightsWire === 1;
    if (wired) {
      context.beginPath();
      for (let y = bottom - 0.5; y <= view.top + 0.5; y += 0.12) { if (y === bottom - 0.5) context.moveTo(wireX(y), toY(y)); else context.lineTo(wireX(y), toY(y)); }
      context.stroke();
    }
    for (let k = Math.floor((bottom - 1) / BULB_PITCH); k * BULB_PITCH <= view.top + 1; k++) {
      const side = right ? 1 : 0, index = ((k % sprites.length) + sprites.length + (right ? 3 : 0)) % sprites.length; // k may be negative
      // Bulbs hang to either side of the wire in turn, a loose zigzag: the inner ones stand further out than
      // the outer ones, and each is a little off its place along and across the wire, fixed per bulb.
      const hang = k * BULB_PITCH + (right ? BULB_PITCH / 2 : 0), y = hang + (grain(k, side, 411) - 0.5) * 2 * BULB_PITCH * tuning.lightsJitterY / 100;
      const inward = (k & 1) === 0, reach = 0.065 + (inward ? 0.5 : -0.5) * zigzag + (grain(k, side, 412) - 0.5) * 2 * tuning.lightsJitterX;
      const breath = bulbLight(k, side, clock);
      const size = view.cellPx * 0.83, x = wireX(hang) + (right ? -1 : 1) * view.cellPx * reach;
      // Its short lead off the wire.
      if (wired) { context.globalAlpha = 0.8 * strength; context.beginPath(); context.moveTo(wireX(hang), toY(hang)); context.lineTo(x, toY(y)); context.stroke(); }
      context.globalAlpha = breath * strength;
      context.drawImage(sprites[index], x - size / 2, toY(y) - size / 2, size, size);
    }
  }
  context.globalAlpha = 1;
}

export class Snow {
  private snowing = false;
  private intensity = 0;
  private presence = 0;
  /** Snowfall so far, in covers: 1 is the amount that fully covers bare ground. */
  private fallen = 0;
  private groundSince = 0;
  /** Cells swept bare since the snow began (an opened gift): their cover starts over from then. */
  private since = new Map<number, number>();
  /** Cells whose snow was just jolted by a landing block, and when. */
  private shaken = new Map<number, { x: number; y: number; at: number; seconds: number; from: number }>();
  private puffs: Puff[] = [];
  /** Snow piled in open gaps (a snow duck's, before the tongs come), and gaps where it is sinking away. */
  private heaps = new Map<number, { x: number; y: number; at: number; seconds: number; from: number; to: number }>();
  /** The cover the block in play wears: its cells only, with `PIECE_MARGIN` around them. */
  readonly piece = document.createElement('canvas');
  private pieceDrawn = '';
  private flakes: Flake[] = [];
  private prints: (Print & { fallen: number })[] = [];
  private walk?: { steps: Step[]; clock: number; forced: boolean };
  private pending = false;
  private walked = false;
  private clock = 0;
  private nextWalk?: number;
  private context: CanvasRenderingContext2D | null;
  private blank = true;
  /** The cover, drawn in board cells: `rect` says which cells the picture spans. */
  readonly cover = document.createElement('canvas');
  /**
   * Every snowy cell's patches at their fullest, uncut, over the same cells as the cover (2026-11-23).
   * Stamping them is what a redraw costs (a slow tablet took 70 ms for the picture, 40 ms for a corner of
   * it, twice a second), so they are stamped once: a redraw lays this picture down and only dims and
   * cuts it. A cell is stamped when snow first lies on it; `based` says which are in (2 for a gap's floor).
   */
  private base = document.createElement('canvas');
  private based = new Map<number, number>();
  private baseKey = '';
  rect = { x: -1, y: 0, columns: COVER_COLUMNS, rows: 1 };
  /** The part of the cover picture the last redraw changed, in its pixels; undefined when it was all of it. */
  coverDirty?: { x: number; y: number; w: number; h: number };
  /** The cover picture's pixels, for the scene to hand to the graphics card. */
  coverPixels(x: number, y: number, w: number, h: number) { return this.cover.getContext('2d', SOFT)!.getImageData(x, y, w, h).data; }
  private dirty = true;
  /** The dog has pressed prints the picture does not show yet. */
  private stepped = false;
  /** The string lights as last drawn, laid under the flakes each frame. */
  private lights?: HTMLCanvasElement;
  private lightsAt = -Infinity;
  private lightsDrawn = '';
  private lightsTop = 0;
  private coverAt = -Infinity;
  private wholeAt = -Infinity;
  private drawnArea = -1;
  private drawnCover = -1;
  private drawnDucks = '';
  /** The board, for snow that gathers on the pavers only. Without it every cell counts as ground. */
  ground?: SnowGround;

  constructor(private canvas: HTMLCanvasElement) { this.context = canvas.getContext('2d'); }

  get on() { return this.snowing; }
  set(snowing: boolean) { this.snowing = snowing; }
  /** 0-1: how visible the cover is as a whole (it fades away as it melts). */
  get coverOpacity() { return this.presence; }
  /** How deep the cover is where it has gathered since the snow began, 0-1. */
  get depth() { return coverDepth(this.fallen, this.groundSince); }
  /** Tiles swept bare: their cells gather snow afresh. */
  cleared(tiles: readonly { x: number; y: number; w: number; h: number }[]) {
    if (this.presence <= 0) return;
    for (const tile of tiles) for (let x = tile.x; x < tile.x + tile.w; x++) for (let y = tile.y; y < tile.y + tile.h; y++) this.since.set(cellKey(x, y), this.fallen);
    this.dirty = true;
  }
  /**
   * Tiles that just landed: they start with the little snow they came down with and gather the rest
   * over the next moments, and a few crumbs puff out from their edges. `strength` 0-1 scales it (a small filler stirs less).
   */
  rustle(tiles: readonly { x: number; y: number; w: number; h: number }[], strength = 1) {
    const depth = this.depth * this.presence;
    if (depth < 0.08) { this.dirty = true; return; }
    this.coverAt = -Infinity;
    for (const tile of tiles) {
      for (let x = tile.x; x < tile.x + tile.w; x++) for (let y = tile.y; y < tile.y + tile.h; y++) this.shaken.set(cellKey(x, y), { x, y, at: this.clock, seconds: RUSTLE_SECONDS, from: FRESH });
      const cx = tile.x + tile.w / 2, cy = tile.y + tile.h / 2;
      for (let i = 0, count = Math.round((tile.w + tile.h) * 2.5 * depth * strength); i < count; i++) {
        // Somewhere along the outline, thrown outwards and a little down the screen, slowing as it goes.
        const along = Math.random() * 2 * (tile.w + tile.h), side = along < tile.w ? 0 : along < tile.w + tile.h ? 1 : along < 2 * tile.w + tile.h ? 2 : 3;
        const t = Math.random();
        const x = side === 0 || side === 2 ? tile.x + t * tile.w : side === 1 ? tile.x + tile.w : tile.x;
        const y = side === 1 || side === 3 ? tile.y + t * tile.h : side === 0 ? tile.y : tile.y + tile.h;
        const turn = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5) * 0.9, speed = (0.7 + Math.random() * 1.5) * (0.6 + 0.4 * strength);
        this.puffs.push({ x, y, vx: Math.cos(turn) * speed, vy: Math.sin(turn) * speed - 0.25, radius: 0.035 + Math.random() * 0.06, age: -Math.random() * 0.05, life: 0.32 + Math.random() * 0.3 });
      }
    }
  }
  /** Cells that start bare and gather their snow in `seconds` (the floor of a snow duck's gap, which fills quickly). */
  gather(cells: readonly { x: number; y: number }[], seconds: number) {
    for (const { x, y } of cells) {
      this.shaken.set(cellKey(x, y), { x, y, at: this.clock, seconds, from: 0 });
      // It piles up there: a heap, until something uses it (see spend).
      this.heaps.set(cellKey(x, y), { x, y, at: this.clock, seconds: 0, from: 1, to: 1 });
    }
    this.coverAt = -Infinity;
  }
  /** The heap in a cell is used up (pressed into a snow duck): what is left sinks to the thin cover of any other floor. */
  spend(x: number, y: number, seconds = 0.7) {
    this.heaps.set(cellKey(x, y), { x, y, at: this.clock, seconds, from: this.heapAt(x, y), to: 0 });
    this.coverAt = -Infinity;
  }
  /** How much of a heap lies in a cell, 0-1. */
  private heapAt(x: number, y: number) {
    const heap = this.heaps.get(cellKey(x, y));
    if (!heap) return 0;
    const t = heap.seconds > 0 ? Math.min(1, (this.clock - heap.at) / heap.seconds) : 1;
    return heap.from + (heap.to - heap.from) * t * t * (3 - 2 * t);
  }
  /** A burst of snow from the middle of a cell: crumbs thrown out all round, as a duck is pressed out. */
  burst(x: number, y: number, amount = 1, festive = false) {
    // A duck in a Santa hat comes with a little show: sparkles in the lights' colours fly further and hang
    // a moment longer than the crumbs of snow, twinkling as they go out.
    if (festive) for (let i = 0, count = 22; i < count; i++) {
      const turn = i / count * Math.PI * 2 + Math.random() * 0.6, speed = 1.9 + Math.random() * 2.6, start = 0.15 + Math.random() * 0.2;
      this.puffs.push({ x: x + 0.5 + Math.cos(turn) * start, y: y + 0.5 + Math.sin(turn) * start, vx: Math.cos(turn) * speed, vy: Math.sin(turn) * speed + 0.25, radius: 0.11 + Math.random() * 0.11, age: -Math.random() * 0.1, life: 0.7 + Math.random() * 0.6, colour: SPARKLES[i % SPARKLES.length], twinkle: Math.random() * Math.PI * 2 });
    }
    for (let i = 0, count = Math.round(16 * amount); i < count; i++) {
      const turn = i / count * Math.PI * 2 + Math.random() * 0.5, speed = 1.3 + Math.random() * 2.2, start = 0.2 + Math.random() * 0.15;
      this.puffs.push({ x: x + 0.5 + Math.cos(turn) * start, y: y + 0.5 + Math.sin(turn) * start, vx: Math.cos(turn) * speed, vy: Math.sin(turn) * speed - 0.3, radius: 0.035 + Math.random() * 0.07, age: -Math.random() * 0.04, life: 0.34 + Math.random() * 0.32 });
    }
  }
  /** Something under the cover changed (a filler seated, the board paused): redraw it. */
  touch() { this.dirty = true; }
  /** A new session starts on fresh ground coordinates; old prints would land in the wrong place. */
  newSession() { this.since.clear(); this.shaken.clear(); this.heaps.clear(); this.puffs = []; this.prints = []; this.walk = undefined; this.dirty = true; }
  /** Whether the dog is crossing right now. */
  get walking() { return !!this.walk; }
  /** Sends the dog across now (the panel's "try it"), even over snow too thin to show prints well. */
  visit() { this.pending = true; }

  /** Whether a cell gathers snow: every cell, or only pavers (the board's, and the frame's around it). */
  private gathers(x: number, y: number) {
    return tuning.snowArea === 1 || !this.ground || x < 0 || x >= WIDTH || y < 0 || this.ground.filled(x, y);
  }
  /** How deep the cover is on one cell, 0-1. */
  depthAt(x: number, y: number) {
    if (!this.gathers(x, y)) return 0;
    const key = cellKey(x, y), depth = coverDepth(this.fallen, this.since.get(key) ?? this.groundSince), landed = this.shaken.get(key);
    if (!landed) return depth;
    const t = (this.clock - landed.at) / landed.seconds;
    if (t >= 1) return depth;
    // Slow to start, as the first flakes take, then filling in and easing into what lies around it.
    return depth * (landed.from + (1 - landed.from) * t * t * (3 - 2 * t));
  }

  /**
   * Draws the cover for the block in play, `w` by `h` cells: a light dusting and a thin white edge, the
   * little that settles on a block on its way down. It is the same wherever the block is, and what the
   * block still has as it lands, before the snow of its place gathers on it. Returns true when the
   * picture changed (as the snow deepens or the block turns).
   */
  pieceCover(w: number, h: number) {
    const depth = this.depth * FRESH, drawn = `${w}:${h}:${Math.round(depth * 48)}:${tuning.snowCover}`;
    if (drawn === this.pieceDrawn) return false;
    this.pieceDrawn = drawn;
    const piece = this.piece, width = Math.round((w + PIECE_MARGIN * 2) * CELL_PX), height = Math.round((h + PIECE_MARGIN * 2) * CELL_PX);
    if (piece.width !== width || piece.height !== height) { piece.width = width; piece.height = height; }
    const context = piece.getContext('2d', SOFT)!;
    context.setTransform(1, 0, 0, 1, 0, 0); context.globalCompositeOperation = 'source-over'; context.globalAlpha = 1;
    context.clearRect(0, 0, width, height);
    const { x, y } = PIECE_HOME, cells: number[] = [];
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) cells.push(x + i, y + j, depth);
    this.paint(context, cells,
      (cx, cy) => (cx - x - WARP * Math.sin(cy * Math.PI * 2) + PIECE_MARGIN) * CELL_PX,
      (cx, cy) => (h + PIECE_MARGIN - (cy - y + WARP * Math.sin(cx * Math.PI * 2))) * CELL_PX, depth);
    return true;
  }

  /** Advances the weather and draws the flakes. Returns true when the cover picture was redrawn. */
  frame(dt: number, view: RainView) {
    this.clock += dt;
    this.intensity = Math.max(0, Math.min(1, this.intensity + (this.snowing ? dt / SNOW_RISE : -dt / SNOW_FALL)));
    if (this.intensity > 0) this.fallen += dt * this.intensity / tuning.snowAccumSeconds;
    if (this.snowing) this.presence = Math.min(1, this.presence + dt / 1.5);
    else if (this.intensity <= 0 && this.presence > 0) {
      this.presence = Math.max(0, this.presence - dt / MELT_SECONDS);
      // Melted away: the next snowfall starts on bare ground.
      if (!this.presence) { this.groundSince = this.fallen; this.since.clear(); this.shaken.clear(); this.prints = []; this.walk = undefined; this.nextWalk = undefined; this.walked = false; this.dirty = true; }
    }
    this.drawFlakes(dt, view);
    if (this.presence <= 0) return false;
    this.walkOn(dt, view);
    return this.drawCover(view);
  }

  private drawFlakes(dt: number, view: RainView) {
    const context = this.context;
    if (!context) return;
    // Flakes are soft dots: a canvas finer than this costs fill time on a phone and shows nothing more.
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.round(view.widthPx * ratio), height = Math.round(view.heightPx * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; this.blank = true; }
    if (this.intensity <= 0 && !this.flakes.length && !this.puffs.length && !(tuning.snowLights && this.snowing)) {
      if (!this.blank) { context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, width, height); this.blank = true; }
      return;
    }
    this.blank = false;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, view.widthPx, view.heightPx);
    // The string lights hang behind the falling snow.
    // They are part of the environment, not of the weather: they are there at once when it is chosen and
    // gone at once when it is left, while the snow itself still takes its time to stop and melt.
    // They are drawn on a picture of their own, afresh when the view has moved and otherwise a few times
    // a second, and that picture is laid down each frame: one copy instead of every bulb and wire.
    if (tuning.snowLights && this.snowing) {
      // The picture reaches a cell beyond the view above and below, so while the camera climbs it is only
      // slid along; it is drawn afresh a few times a second, or once the view has moved past that margin.
      const lights = this.lights ??= document.createElement('canvas'), drawn = `${width}:${height}:${view.left}:${view.cellPx}`;
      const margin = LIGHTS_MARGIN * view.cellPx, tall = view.heightPx + margin * 2;
      if (drawn !== this.lightsDrawn || Math.abs(view.top - this.lightsTop) > LIGHTS_MARGIN || this.clock - this.lightsAt >= LIGHTS_INTERVAL) {
        const layerHeight = Math.round(tall * ratio);
        if (lights.width !== width || lights.height !== layerHeight) { lights.width = width; lights.height = layerHeight; }
        const layer = lights.getContext('2d')!;
        layer.setTransform(ratio, 0, 0, ratio, 0, 0); layer.clearRect(0, 0, view.widthPx, tall);
        drawLights(layer, { ...view, top: view.top + LIGHTS_MARGIN, heightPx: tall }, this.clock, 1);
        this.lightsDrawn = drawn; this.lightsAt = this.clock; this.lightsTop = view.top;
      }
      context.drawImage(lights, 0, (view.top - this.lightsTop) * view.cellPx - margin, view.widthPx, tall);
    }
    const speed = tuning.snowSpeed, wanted = Math.round(tuning.snowAmount * this.intensity);
    // New flakes come in a few at a time, so a change of amount never arrives as one burst.
    for (let born = 0; this.flakes.length < wanted && born < 4; born++) {
      this.flakes.push({
        x: Math.random() * (view.widthPx + 80) - 40, y: Math.random() * (view.heightPx + 60) - 60,
        radius: 1 + Math.random() * Math.random() * 2.5, age: 0, life: 3 + Math.random() * 3, fall: 22 + Math.random() * 50,
        phase: Math.random() * Math.PI * 2, alpha: 0.5 + Math.random() * 0.45,
      });
    }
    let kept = 0;
    context.fillStyle = '#f7fafc';
    for (const flake of this.flakes) {
      flake.age += dt * speed;
      const t = flake.age / flake.life;
      if (t >= 1) continue;
      this.flakes[kept++] = flake;
      flake.x += (tuning.snowWind * 40 + Math.sin(flake.phase + flake.age * 1.4) * 14) * dt * speed;
      flake.y += flake.fall * dt * speed;
      // Near the camera a flake is large and soft; it shrinks and sharpens as it sinks, then lands.
      const size = flake.radius * tuning.snowSize * (1.3 - 0.85 * t);
      context.globalAlpha = flake.alpha * Math.min(1, t / 0.12) * Math.min(1, (1 - t) / 0.12) * (0.55 + 0.45 * t);
      // The small ones are squares, which cost a fraction of a path and look the same at that size.
      if (size < 1.4) context.fillRect(flake.x - size * 0.9, flake.y - size * 0.9, size * 1.8, size * 1.8);
      else { context.beginPath(); context.arc(flake.x, flake.y, size, 0, Math.PI * 2); context.fill(); }
    }
    this.flakes.length = kept;
    // Crumbs knocked loose by a landing block: out from its edges, slowing, gone in a moment.
    kept = 0;
    context.fillStyle = '#ffffff';
    for (const puff of this.puffs) {
      puff.age += dt;
      if (puff.age >= puff.life) continue;
      this.puffs[kept++] = puff;
      if (puff.age < 0) continue;
      const t = puff.age / puff.life, slow = Math.exp(-dt * 5);
      puff.x += puff.vx * dt; puff.y += puff.vy * dt; puff.vx *= slow; puff.vy *= slow;
      const px = (puff.x - view.left) * view.cellPx, py = (view.top - puff.y) * view.cellPx;
      if (puff.colour) {
        // A four-pointed star with a soft halo, flickering as it fades.
        const flicker = 0.6 + 0.4 * Math.sin(puff.age * 26 + (puff.twinkle ?? 0)), arm = puff.radius * view.cellPx * (1 - 0.3 * t) * (0.8 + 0.2 * flicker), waist = arm * 0.22;
        context.fillStyle = puff.colour;
        context.globalAlpha = 0.22 * (1 - t) * flicker; context.beginPath(); context.arc(px, py, arm * 1.25, 0, Math.PI * 2); context.fill();
        context.globalAlpha = (1 - t * t) * flicker;
        context.beginPath(); context.moveTo(px, py - arm); context.lineTo(px + waist, py - waist); context.lineTo(px + arm, py); context.lineTo(px + waist, py + waist);
        context.lineTo(px, py + arm); context.lineTo(px - waist, py + waist); context.lineTo(px - arm, py); context.lineTo(px - waist, py - waist); context.closePath(); context.fill();
        context.fillStyle = '#ffffff';
        continue;
      }
      context.globalAlpha = 0.95 * (1 - t * t);
      context.beginPath(); context.arc(px, py, puff.radius * view.cellPx * (1 - 0.45 * t), 0, Math.PI * 2); context.fill();
    }
    this.puffs.length = kept;
    context.globalAlpha = 1;
  }

  /** Presses the dog's next prints, and sends it across again when its time comes. */
  private walkOn(dt: number, view: RainView) {
    const viewRows = view.heightPx / view.cellPx, viewBottom = view.top - viewRows;
    // On pavers only, the dog keeps to the stack: the band from the bottom of the view to its top.
    const onPavers = tuning.snowArea !== 1 && !!this.ground;
    const rows = onPavers ? Math.min(viewRows, this.ground!.height() - viewBottom) : viewRows;
    if (this.pending) { this.pending = false; if (rows > 0) this.walk = { steps: planWalk(viewBottom, rows), clock: 0, forced: true }; }
    if (this.walk) {
      const walk = this.walk; walk.clock += dt;
      while (walk.steps.length && walk.steps[0].at <= walk.clock) {
        const step = walk.steps.shift()!, x = Math.floor(step.x), y = Math.floor(step.y);
        // No print where there is nothing to press: a bare cell, or (unless asked for) snow too thin.
        // Nor in a snow duck's gap: the dog goes round the ducks, it does not tread on them.
        if (!this.gathers(x, y) || this.ground?.floor?.(x, y) || (!walk.forced && this.depthAt(x, y) < PRINT_MIN_DEPTH)) continue;
        this.prints.push({ x: step.x, y: step.y, angle: step.angle, fallen: this.fallen });
        this.stepped = true;
      }
      if (!walk.steps.length) { this.walk = undefined; this.nextWalk = undefined; }
      return;
    }
    if (!this.snowing || !tuning.snowTracks || this.depth < tuning.snowTrackDepth || rows < 1) { this.nextWalk = undefined; return; }
    // The first crossing comes soon after the snow is deep enough; later ones keep the planner's interval,
    // counted from when the last one has gone.
    const from = tuning.snowTrackFrom, to = Math.max(from, tuning.snowTrackTo);
    this.nextWalk ??= this.clock + (this.walked ? from + Math.random() * (to - from) : 2 + Math.random() * 4);
    if (this.clock < this.nextWalk) return;
    this.walk = { steps: planWalk(viewBottom, rows), clock: 0, forced: false }; this.walked = true;
  }

  /**
   * Paints snow on `cells` (x, y, depth in threes) through `px`/`py`, which map board cells to picture
   * pixels. `amount` is how deep the snow is overall (0-1). Returns the outline of the cells, for the
   * prints that follow.
   *
   * The snow is stamped as soft patches whose strength follows `snowDensity`, cut only by the outline of
   * the pavers as a whole, never by the single stones: nothing in it traces a block. A block that has
   * just landed (shallower than the rest) takes the same patches more faintly, inside its own outline,
   * until its snow has gathered.
   */
  private paint(context: CanvasRenderingContext2D, cells: number[], px: (x: number, y: number) => number, py: (x: number, y: number) => number, amount: number, base?: HTMLCanvasElement) {
    const all = new Path2D(), lit = new Set<number>();
    const gathering: { x: number; y: number; depth: number; outline: Path2D }[] = [], floors: typeof gathering = [];
    for (let c = 0; c < cells.length; c += 3) {
      const x = cells[c], y = cells[c + 1], depth = cells[c + 2];
      if (depth <= 0) continue;
      lit.add(cellKey(x, y));
      const paths = [all];
      if (this.ground?.floor?.(x, y)) { const outline = new Path2D(); floors.push({ x, y, depth, outline }); paths.push(outline); }
      if (depth < amount - 0.004) { const outline = new Path2D(); gathering.push({ x, y, depth, outline }); paths.push(outline); }
      for (const path of paths) {
        path.moveTo(px(x, y), py(x, y));
        for (let i = 1; i <= SIDE_POINTS; i++) path.lineTo(px(x + i / SIDE_POINTS, y), py(x + i / SIDE_POINTS, y));
        for (let i = 1; i <= SIDE_POINTS; i++) path.lineTo(px(x + 1, y + i / SIDE_POINTS), py(x + 1, y + i / SIDE_POINTS));
        for (let i = 1; i <= SIDE_POINTS; i++) path.lineTo(px(x + 1 - i / SIDE_POINTS, y + 1), py(x + 1 - i / SIDE_POINTS, y + 1));
        for (let i = 1; i < SIDE_POINTS; i++) path.lineTo(px(x, y + 1 - i / SIDE_POINTS), py(x, y + 1 - i / SIDE_POINTS));
        path.closePath();
      }
    }
    if (!lit.size) return all;
    const images = snowSprites(), cover = Math.min(1, tuning.snowCover * 1.3);
    // The patches of one cell: four of them, a little off the quarter points, each wider than the cell.
    const put = (lx: number, ly: number, size: number, sprite: number, strength: number) => {
      const width = size * CELL_PX;
      context.globalAlpha = Math.min(1, strength);
      context.drawImage(images[sprite], px(lx, ly) - width / 2, py(lx, ly) - width / 2, width, width);
    };
    const kept = tuning.duckFloor / 100;
    const stamp = (x: number, y: number, depth: number) => eachSnowPatch(x, y, depth, amount, !!this.ground?.floor?.(x, y), kept, cover, put);
    // The patches go down uncut, and the pavers' outline is cut out of the picture once at the end
    // (2026-11-23). Before, every patch was drawn through a clip of that whole outline, thousands of
    // points long: on a slow phone that one clip made a redraw take up to 0.7 s and the game stutter.
    const full = amount * amount * (3 - 2 * amount);
    // The cover's patches are kept ready, at their fullest (see `base`), and laid down as one picture, as
    // faint as the snow is deep so far. The block in play has only a few and stamps its own.
    if (base) { context.globalAlpha = full; context.drawImage(base, 0, 0); }
    else for (let c = 0; c < cells.length; c += 3) if (cells[c + 2] > 0) stamp(cells[c], cells[c + 1], amount);
    // A block still gathering its snow has the same patches, only fainter: its share of them is left and
    // the rest taken off, inside its own outline. (Before, each such cell was emptied and its patches and
    // its neighbours' drawn again through a clip of the cell, 36 clipped stamps a cell; with several
    // blocks gathering at once that was most of a redraw.)
    context.globalCompositeOperation = 'destination-out';
    for (const cell of gathering) {
      context.globalAlpha = 1 - Math.min(1, cell.depth * cell.depth * (3 - 2 * cell.depth) / full);
      context.fill(cell.outline);
    }
    context.globalCompositeOperation = 'source-over';
    // Heaps: the snow piled into a gap before the tongs come, each kept inside its own gap. The planner
    // sets how much (none at 0) and how it lies: a tight mound in the middle, or spread over the floor.
    const much = tuning.duckHeap / 100, spread = tuning.duckHeapSpread / 100;
    if (much > 0) for (const cell of floors) {
      const heap = this.heapAt(cell.x, cell.y) * much * (amount > 0 ? Math.min(1, cell.depth / amount) : 0);
      if (heap <= 0.02) continue;
      const size = (0.85 + 0.85 * spread) * CELL_PX, reach = 0.06 + 0.3 * spread;
      context.save(); context.clip(cell.outline); context.globalAlpha = Math.min(1, heap) * cover;
      for (let layer = 0; layer < 2; layer++) for (let n = 0; n < 5; n++) {
        const lx = cell.x + 0.5 + (n ? (n & 1 ? reach : -reach) : 0), ly = cell.y + 0.5 + (n ? (n > 2 ? reach : -reach) : 0);
        context.drawImage(images[(n + layer) % images.length], px(lx, ly) - size / 2, py(lx, ly) - size / 2, size, size);
      }
      context.restore();
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'destination-in'; context.fill(all); context.globalCompositeOperation = 'source-over';
    return all;
  }

  private drawCover(view: RainView) {
    const viewRows = view.heightPx / view.cellPx, bottom = view.top - viewRows;
    const rows = Math.ceil(viewRows) + ROWS_BELOW + ROWS_ABOVE;
    const outside = bottom < this.rect.y || view.top > this.rect.y + this.rect.rows || rows !== this.rect.rows;
    const ducks = `${tuning.duckHeap}:${tuning.duckHeapSpread}:${tuning.duckFloor}`;
    const retuned = this.drawnArea !== tuning.snowArea || this.drawnCover !== tuning.snowCover || this.drawnDucks !== ducks;
    // The whole picture is redrawn only when it must be: while the snow is still building up (once a
    // second is plenty for snow), while prints fill in, or when the view moved. A block gathering its
    // snow redraws just its own corner of the picture, a few times a second.
    const whole = this.dirty || outside || retuned
      || (this.stepped && this.clock - this.wholeAt >= STEP_INTERVAL)
      || (this.depth < 1 && this.clock - this.wholeAt >= COVER_INTERVAL)
      || ((this.since.size > 0 || this.prints.length > 0) && this.clock - this.wholeAt >= PRINT_INTERVAL);
    // Where blocks are still gathering their snow, found afresh each time so it never outgrows them.
    let box: { x0: number; y0: number; x1: number; y1: number } | undefined, quick = false;
    // A heap sinking away is redrawn the same way, and forgotten once it is gone.
    for (const [key, heap] of this.heaps) {
      if (heap.to === heap.from) continue;
      if (this.clock - heap.at >= heap.seconds + QUICK_REDRAW * 2) { if (heap.to <= 0) this.heaps.delete(key); else { heap.from = heap.to; } continue; }
      quick = true;
      box ??= { x0: heap.x, y0: heap.y, x1: heap.x + 1, y1: heap.y + 1 };
      box.x0 = Math.min(box.x0, heap.x); box.y0 = Math.min(box.y0, heap.y); box.x1 = Math.max(box.x1, heap.x + 1); box.y1 = Math.max(box.y1, heap.y + 1);
    }
    for (const [key, cell] of this.shaken) {
      if (this.clock - cell.at >= cell.seconds + RUSTLE_REDRAW * 2) { this.shaken.delete(key); continue; }
      if (cell.seconds < 3 && this.clock - cell.at < cell.seconds + QUICK_REDRAW) quick = true;
      box ??= { x0: cell.x, y0: cell.y, x1: cell.x + 1, y1: cell.y + 1 };
      box.x0 = Math.min(box.x0, cell.x); box.y0 = Math.min(box.y0, cell.y); box.x1 = Math.max(box.x1, cell.x + 1); box.y1 = Math.max(box.y1, cell.y + 1);
    }
    if (!whole && !(box && this.clock - this.coverAt >= (quick ? QUICK_REDRAW : RUSTLE_REDRAW))) return false;
    this.dirty = false; this.coverAt = this.clock; this.drawnArea = tuning.snowArea; this.drawnCover = tuning.snowCover; this.drawnDucks = ducks;
    if (whole) { this.stepped = false; this.wholeAt = this.clock; this.rect = { x: -1, y: Math.floor(bottom) - ROWS_BELOW, columns: COVER_COLUMNS, rows }; }
    const { cover, rect } = this;
    if (cover.width !== rect.columns * CELL_PX || cover.height !== rect.rows * CELL_PX) { cover.width = rect.columns * CELL_PX; cover.height = rect.rows * CELL_PX; }
    const context = cover.getContext('2d', SOFT)!;
    context.setTransform(1, 0, 0, 1, 0, 0); context.globalCompositeOperation = 'source-over'; context.globalAlpha = 1;
    // The cells to draw: all of them, or those around the gathering blocks. The picture is cut two cells
    // out from those blocks and drawn from three out, so what is redrawn along the cut is what was there.
    let x0 = rect.x, x1 = rect.x + rect.columns, y0 = rect.y, y1 = rect.y + rect.rows;
    context.save();
    this.coverDirty = undefined;
    if (!whole && box) {
      x0 = Math.max(x0, box.x0 - 3); x1 = Math.min(x1, box.x1 + 3); y0 = Math.max(y0, box.y0 - 3); y1 = Math.min(y1, box.y1 + 3);
      const left = (box.x0 - 2 - rect.x) * CELL_PX, top = (rect.y + rect.rows - (box.y1 + 2)) * CELL_PX;
      const right = Math.min(cover.width, left + (box.x1 - box.x0 + 4) * CELL_PX), low = Math.min(cover.height, top + (box.y1 - box.y0 + 4) * CELL_PX), x = Math.max(0, left), y = Math.max(0, top);
      if (right <= x || low <= y) { context.restore(); return false; }
      this.coverDirty = { x, y, w: right - x, h: low - y };
      context.beginPath(); context.rect(left, top, (box.x1 - box.x0 + 4) * CELL_PX, (box.y1 - box.y0 + 4) * CELL_PX); context.clip();
    }
    context.clearRect(0, 0, cover.width, cover.height);
    // Board cells to the picture's pixels, through the pavers' edge warp.
    // (The contour is written with y running down the screen; here y runs up the board, so both signs turn.)
    const px = (x: number, y: number) => (x - WARP * Math.sin(y * Math.PI * 2) - rect.x) * CELL_PX;
    const py = (x: number, y: number) => (rect.y + rect.rows - (y + WARP * Math.sin(x * Math.PI * 2))) * CELL_PX;
    const cells: number[] = [], fresh: number[] = [], { base, based } = this;
    const baseKey = `${rect.x}:${rect.y}:${rect.columns}:${rect.rows}:${tuning.snowCover}:${tuning.duckFloor}:${tuning.snowArea}`;
    let stale = baseKey !== this.baseKey;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const key = cellKey(x, y), depth = this.depthAt(x, y), had = based.get(key);
        // A cell as deep as the ground no longer needs its own record.
        if (depth >= 1 && this.since.has(key)) this.since.delete(key);
        if (depth > 0) cells.push(x, y, depth);
        // The stamped patches follow the cells: a newly snowy one is added, and when one has gone bare or
        // has become (or stopped being) a gap's floor, they are all stamped again.
        const kind = depth > 0 ? this.ground?.floor?.(x, y) ? 2 : 1 : 0;
        if (kind && !had) fresh.push(x, y, kind); else if (kind !== (had ?? 0)) stale = true;
      }
    }
    if (stale) {
      this.baseKey = baseKey; based.clear(); fresh.length = 0;
      if (base.width !== cover.width || base.height !== cover.height) { base.width = cover.width; base.height = cover.height; }
      for (let y = rect.y; y < rect.y + rect.rows; y++) for (let x = rect.x; x < rect.x + rect.columns; x++) if (this.depthAt(x, y) > 0) fresh.push(x, y, this.ground?.floor?.(x, y) ? 2 : 1);
    }
    if (stale || fresh.length) {
      const layer = base.getContext('2d', SOFT)!, images = snowSprites(), strong = Math.min(1, tuning.snowCover * 1.3), kept = tuning.duckFloor / 100;
      layer.setTransform(1, 0, 0, 1, 0, 0); layer.globalCompositeOperation = 'source-over';
      if (stale) layer.clearRect(0, 0, base.width, base.height);
      for (let c = 0; c < fresh.length; c += 3) {
        based.set(cellKey(fresh[c], fresh[c + 1]), fresh[c + 2]);
        eachSnowPatch(fresh[c], fresh[c + 1], 1, 1, fresh[c + 2] === 2, kept, strong, (lx, ly, size, sprite, strength) => {
          const width = size * CELL_PX;
          layer.globalAlpha = Math.min(1, strength);
          layer.drawImage(images[sprite], px(lx, ly) - width / 2, py(lx, ly) - width / 2, width, width);
        });
      }
      layer.globalAlpha = 1;
    }
    const outline = this.paint(context, cells, px, py, this.depth, base);
    // Prints are pressed wherever there is a paver under them, as deep as the snow there allows.
    if (this.prints.length) context.clip(outline);
    let kept = 0;
    for (const print of this.prints) {
      const strength = 1 - (this.fallen - print.fallen) / PRINT_REFILL;
      if (strength <= 0 || print.y < rect.y - 2) continue;
      this.prints[kept++] = print;
      // Much the same everywhere, only a touch deeper where the snow lies thick: prints that differed a lot looked untidy.
      const deep = 0.82 + 0.18 * Math.max(0, Math.min(1, (snowDensity(print.x, print.y) - 0.3) / 0.35));
      pressPaw(context, (print.x - rect.x) * CELL_PX, (rect.y + rect.rows - print.y) * CELL_PX, print.angle, strength, Math.floor(print.x * 97 + print.y * 131), deep);
    }
    this.prints.length = kept;
    context.restore();
    context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1; context.globalCompositeOperation = 'source-over';
    return true;
  }
}

/** A dog's paw, one unit wide, toes towards the top: the big pad and four toe pads. */
function pawPath(context: CanvasRenderingContext2D) {
  context.moveTo(0, 0.02);
  context.bezierCurveTo(0.2, 0.02, 0.3, 0.2, 0.26, 0.31);
  context.bezierCurveTo(0.22, 0.4, 0.08, 0.36, 0, 0.36);
  context.bezierCurveTo(-0.08, 0.36, -0.22, 0.4, -0.26, 0.31);
  context.bezierCurveTo(-0.3, 0.2, -0.2, 0.02, 0, 0.02);
  for (const [x, y, turn] of [[-0.33, -0.05, -0.5], [-0.13, -0.28, -0.15], [0.13, -0.28, 0.15], [0.33, -0.05, 0.5]]) {
    context.moveTo(x + 0.09, y); context.ellipse(x, y, 0.09, 0.135, turn, 0, Math.PI * 2);
  }
}

/**
 * One paw print in thin snow: a faint, dark mark where the paw pressed the snow down to the stone, with
 * a slightly darker edge on the light's side and next to no rim (2026-11-21: the white-rimmed print made
 * for a deep cover looked pasted on now that the snow lies shallow). Light comes from the upper right,
 * as on the pavers. `x`, `y` is the print's centre in picture pixels; `seed` keeps its few crumbs in
 * place between redraws; `deep` 0-1 says how thick the snow is there and adds only a touch of relief.
 */
function pressPaw(context: CanvasRenderingContext2D, x: number, y: number, angle: number, strength: number, seed: number, deep = 1) {
  const size = GAIT.size * CELL_PX;
  // Board angles turn anticlockwise with y up; the paw points up the canvas.
  const trace = (dx: number, dy: number) => {
    context.setTransform(1, 0, 0, 1, x + dx, y + dy); context.rotate(Math.PI / 2 - angle); context.scale(size, size);
    context.beginPath(); pawPath(context);
  };
  // The rim the paw pushed up, on the side away from the light.
  // The snow is too thin to be pushed up into a white rim: only a breath of one, where it lies thickest.
  trace(-1, 1); context.globalAlpha = 0.16 * strength * deep; context.fillStyle = '#ffffff'; context.fill();
  // On a mere dusting the paw wipes through to the stone, which shows darker and damp.
  // The paw presses the thin snow down to the stone, which shows through dark and damp.
  trace(0, 0); context.globalAlpha = 0.3 * strength; context.fillStyle = '#4b343a'; context.fill();
  // The packed snow in the print.
  trace(0, 0); context.globalAlpha = 0.14 * strength * deep; context.fillStyle = '#7384a2'; context.fill();
  // The print's wall on the light's side, in shadow: the same outline shifted, seen only inside the print.
  context.save();
  trace(0, 0); context.clip();
  trace(-1.5, 1.5); context.globalAlpha = 0.22 * strength * deep; context.strokeStyle = '#3d3138'; context.lineWidth = 2 / size; context.stroke();
  context.restore();
  // Crumbs of broken snow around it.
  context.setTransform(1, 0, 0, 1, x, y); context.fillStyle = '#7d8eaa';
  for (let n = 0; n < 3; n++) {
    const turn = grain(seed, n, 3) * Math.PI * 2, reach = size * (0.56 + grain(seed, n, 5) * 0.16), crumb = 1 + grain(seed, n, 7) * 1.2;
    context.globalAlpha = 0.08 * strength * deep;
    context.fillRect(Math.cos(turn) * reach, Math.sin(turn) * reach, crumb, crumb);
  }
}

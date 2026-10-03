/**
 * Rain weather (the pause screen's rain environment): rain seen from straight above. Streaks arrive at a point on the ground, leave a
 * ripple and a dark wet mark, and the pavement slowly darkens and cools as it soaks. Purely visual:
 * it never touches the board, the piece count, or the export.
 */

/** Seconds for the shower to reach full strength and to die away. */
export const RAIN_RISE = 2.5, RAIN_FALL = 3.5;
/** Seconds of full rain to soak the pavement, and seconds for it to dry again. */
export const SOAK_SECONDS = 9, DRY_SECONDS = 16;

import type { RainAmbience } from './rain-sound';
import { tuning } from './tuning';

export interface RainState { intensity: number; wetness: number; }

/** Advances the shower and the dampness of the ground. Both stay within 0..1. */
export function stepRain(state: RainState, dt: number, raining: boolean): RainState {
  const intensity = Math.max(0, Math.min(1, state.intensity + (raining ? dt / RAIN_RISE : -dt / RAIN_FALL)));
  // The ground only dries once the rain has really stopped, and soaks in proportion to how hard it falls.
  const change = intensity > 0 ? dt * intensity / SOAK_SECONDS : -dt / DRY_SECONDS;
  return { intensity, wetness: Math.max(0, Math.min(1, state.wetness + change)) };
}

/** sRGB multiplier for a wet surface: darker and a little cooler, never tinted beyond recognition. */
export function wetTint(wetness: number): [number, number, number] {
  const w = Math.max(0, Math.min(1, wetness)), eased = w * w * (3 - 2 * w);
  return [1 - 0.30 * eased, 1 - 0.21 * eased, 1 - 0.18 * eased];
}

/** What the scene tells the weather about the camera each frame. Lengths are board cells unless noted. */
export interface RainView { widthPx: number; heightPx: number; cellPx: number; left: number; top: number; }

interface Drop { x: number; y: number; remaining: number; total: number; length: number; alpha: number; }
interface Ripple { x: number; y: number; age: number; life: number; radius: number; }
interface Mark { x: number; y: number; age: number; life: number; radius: number; }

const DROPS_PER_SECOND = 64, MAX_MARKS = 300;
// Screen-space direction the streaks travel in: mostly down, leaning with a light wind.
const WIND_X = 0.26, WIND_Y = 0.966, FALL_SPEED = 1500;
const MARK_COLOR = '8, 14, 18';

/**
 * Removes spent items in place, keeping the survivors in order, and hands the spent ones back to a
 * pool so a shower allocates nothing per frame (no garbage-collection hitches on phones).
 */
function sweep<T>(items: T[], pool: T[], alive: (item: T) => boolean) {
  let kept = 0;
  for (let i = 0; i < items.length; i++) { const item = items[i]; if (alive(item)) items[kept++] = item; else pool.push(item); }
  items.length = kept;
}

/**
 * One soft wet mark, drawn once: the same radial ramp the marks used to build every frame (full, 80% at
 * 0.7 of the radius, clear at the edge). Each mark is this image scaled, with its alpha applied on top,
 * which replaces up to 300 gradient fills a frame with plain image draws.
 */
function markSprite() {
  const size = 64, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(${MARK_COLOR}, 1)`); gradient.addColorStop(0.7, `rgba(${MARK_COLOR}, 0.8)`); gradient.addColorStop(1, `rgba(${MARK_COLOR}, 0)`);
  context.fillStyle = gradient; context.fillRect(0, 0, size, size);
  return canvas;
}

export class Rain {
  private state: RainState = { intensity: 0, wetness: 0 };
  private raining = false;
  private drops: Drop[] = [];
  private ripples: Ripple[] = [];
  private marks: Mark[] = [];
  private dropPool: Drop[] = [];
  private ripplePool: Ripple[] = [];
  private markPool: Mark[] = [];
  private owed = 0;
  private context: CanvasRenderingContext2D | null;
  private sprite?: HTMLCanvasElement;
  /** True once the canvas has been cleared with nothing left to draw; it then stays untouched. */
  private blank = false;

  constructor(private canvas: HTMLCanvasElement, private ambience?: RainAmbience) { this.context = canvas.getContext('2d'); }

  get on() { return this.raining; }
  get wetness() { return this.state.wetness; }
  toggle() { this.raining = !this.raining; return this.raining; }
  set(raining: boolean) { this.raining = raining; }
  /** A new session starts on fresh ground coordinates; old marks would land in the wrong place. */
  clearMarks() { this.marks = []; this.ripples = []; this.drops = []; }

  frame(dt: number, view: RainView) {
    this.state = stepRain(this.state, dt, this.raining);
    // The sound follows the shower itself, so it swells and fades with what is on screen.
    this.ambience?.update(this.state.intensity);
    const context = this.context;
    if (!context) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(view.widthPx * ratio), height = Math.round(view.heightPx * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; this.blank = true; }
    const { intensity, wetness } = this.state;
    if (intensity <= 0 && wetness <= 0 && !this.marks.length) {
      // Dry and empty: clear once, then leave the canvas alone so the compositor has nothing to redo.
      if (!this.blank) { context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, this.canvas.width, this.canvas.height); this.blank = true; }
      return;
    }
    this.blank = false;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, view.widthPx, view.heightPx);
    const speed = tuning.rainSpeed, rippleScale = tuning.rippleSize;

    // World (cells, y up) to screen (CSS pixels, y down).
    const sx = (x: number) => (x - view.left) * view.cellPx, sy = (y: number) => (view.top - y) * view.cellPx;

    // A cool, dim wash for the mood of an overcast street.
    const mood = Math.max(intensity, wetness * 0.6);
    if (mood > 0) { context.fillStyle = `rgba(14, 24, 36, ${0.13 * mood})`; context.fillRect(0, 0, view.widthPx, view.heightPx); }

    if (intensity > 0) {
      this.owed += dt * DROPS_PER_SECOND * intensity;
      const columns = view.widthPx / view.cellPx, rows = view.heightPx / view.cellPx;
      for (; this.owed >= 1; this.owed--) {
        const total = (0.16 + Math.random() * 0.12) / speed;
        const drop = this.dropPool.pop() ?? { x: 0, y: 0, remaining: 0, total: 0, length: 0, alpha: 0 };
        drop.x = view.left + Math.random() * columns; drop.y = view.top - Math.random() * rows;
        drop.remaining = total; drop.total = total; drop.length = 16 + Math.random() * 20; drop.alpha = 0.22 + Math.random() * 0.24;
        this.drops.push(drop);
      }
    }

    // Wet marks first: they belong to the ground, under everything else. Newest are drawn first, as before.
    for (const mark of this.marks) mark.age += dt;
    sweep(this.marks, this.markPool, mark => mark.age < mark.life);
    this.sprite ??= markSprite();
    for (let i = this.marks.length - 1; i >= 0 && this.sprite; i--) {
      const mark = this.marks[i];
      const t = mark.age / mark.life, fade = t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92;
      // Once the whole pavement is soaked, single marks stop standing out.
      const alpha = 0.2 * fade * (1 - 0.75 * wetness);
      if (alpha <= 0.004) continue;
      const x = sx(mark.x), y = sy(mark.y), r = mark.radius * (1 + 0.5 * t);
      context.globalAlpha = alpha; context.drawImage(this.sprite, x - r, y - r, r * 2, r * 2);
    }

    context.lineCap = 'round'; context.lineWidth = 1;
    for (const ripple of this.ripples) ripple.age += dt;
    sweep(this.ripples, this.ripplePool, ripple => ripple.age < ripple.life);
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const ripple = this.ripples[i];
      const t = ripple.age / ripple.life, grow = 1 - (1 - t) * (1 - t), x = sx(ripple.x), y = sy(ripple.y);
      context.strokeStyle = 'rgb(214, 232, 238)'; context.globalAlpha = 0.34 * (1 - t) * (1 - t);
      context.beginPath(); context.arc(x, y, 1.5 + ripple.radius * rippleScale * grow, 0, Math.PI * 2); context.stroke();
      if (t < 0.18) { context.fillStyle = 'rgb(232, 242, 246)'; context.globalAlpha = 0.5 * (1 - t / 0.18); context.beginPath(); context.arc(x, y, 1.2, 0, Math.PI * 2); context.fill(); }
    }

    // Streaks that reach the ground become a ripple and a mark, newest first as before.
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i]; drop.remaining -= dt;
      if (drop.remaining > 0) continue;
      const ripple = this.ripplePool.pop() ?? { x: 0, y: 0, age: 0, life: 0, radius: 0 };
      ripple.x = drop.x; ripple.y = drop.y; ripple.age = 0; ripple.life = 0.42 + Math.random() * 0.2; ripple.radius = 7 + Math.random() * 7;
      this.ripples.push(ripple);
      const mark = this.markPool.pop() ?? { x: 0, y: 0, age: 0, life: 0, radius: 0 };
      mark.x = drop.x; mark.y = drop.y; mark.age = 0; mark.life = 3.5 + Math.random() * 3.5; mark.radius = 3.5 + Math.random() * 4.5;
      this.marks.push(mark);
      if (this.marks.length > MAX_MARKS) this.markPool.push(this.marks.shift()!);
    }
    sweep(this.drops, this.dropPool, drop => drop.remaining > 0);
    context.strokeStyle = 'rgb(206, 224, 232)'; context.lineWidth = 1.25;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const away = drop.remaining * FALL_SPEED * speed, x = sx(drop.x) - WIND_X * away, y = sy(drop.y) - WIND_Y * away;
      // Streaks fade in as they enter so none pops into view mid-screen.
      const enter = Math.min(1, (drop.total - drop.remaining) * speed / 0.05);
      context.globalAlpha = drop.alpha * enter;
      context.beginPath(); context.moveTo(x - WIND_X * drop.length, y - WIND_Y * drop.length); context.lineTo(x, y); context.stroke();
    }
    context.globalAlpha = 1;
  }
}

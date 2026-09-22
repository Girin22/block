/**
 * Admin-only weather: rain seen from straight above. Streaks arrive at a point on the ground, leave a
 * ripple and a dark wet mark, and the pavement slowly darkens and cools as it soaks. Purely visual:
 * it never touches the board, the piece count, or the export.
 */

/** Seconds for the shower to reach full strength and to die away. */
export const RAIN_RISE = 2.5, RAIN_FALL = 3.5;
/** Seconds of full rain to soak the pavement, and seconds for it to dry again. */
export const SOAK_SECONDS = 9, DRY_SECONDS = 16;

import type { RainAmbience } from './rain-sound';

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

export class Rain {
  private state: RainState = { intensity: 0, wetness: 0 };
  private raining = false;
  private drops: Drop[] = [];
  private ripples: Ripple[] = [];
  private marks: Mark[] = [];
  private owed = 0;
  private context: CanvasRenderingContext2D | null;

  constructor(private canvas: HTMLCanvasElement, private ambience?: RainAmbience) { this.context = canvas.getContext('2d'); }

  get on() { return this.raining; }
  get wetness() { return this.state.wetness; }
  toggle() { this.raining = !this.raining; return this.raining; }
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
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, view.widthPx, view.heightPx);
    const { intensity, wetness } = this.state;
    if (intensity <= 0 && wetness <= 0 && !this.marks.length) return;

    // World (cells, y up) to screen (CSS pixels, y down).
    const sx = (x: number) => (x - view.left) * view.cellPx, sy = (y: number) => (view.top - y) * view.cellPx;

    // A cool, dim wash for the mood of an overcast street.
    const mood = Math.max(intensity, wetness * 0.6);
    if (mood > 0) { context.fillStyle = `rgba(14, 24, 36, ${0.13 * mood})`; context.fillRect(0, 0, view.widthPx, view.heightPx); }

    if (intensity > 0) {
      this.owed += dt * DROPS_PER_SECOND * intensity;
      const columns = view.widthPx / view.cellPx, rows = view.heightPx / view.cellPx;
      for (; this.owed >= 1; this.owed--) {
        const total = 0.16 + Math.random() * 0.12;
        this.drops.push({ x: view.left + Math.random() * columns, y: view.top - Math.random() * rows, remaining: total, total, length: 16 + Math.random() * 20, alpha: 0.22 + Math.random() * 0.24 });
      }
    }

    // Wet marks first: they belong to the ground, under everything else.
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const mark = this.marks[i]; mark.age += dt;
      if (mark.age >= mark.life) { this.marks.splice(i, 1); continue; }
      const t = mark.age / mark.life, fade = t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92;
      // Once the whole pavement is soaked, single marks stop standing out.
      const alpha = 0.2 * fade * (1 - 0.75 * wetness);
      if (alpha <= 0.004) continue;
      const x = sx(mark.x), y = sy(mark.y), r = mark.radius * (1 + 0.5 * t);
      const gradient = context.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(8, 14, 18, ${alpha})`); gradient.addColorStop(0.7, `rgba(8, 14, 18, ${alpha * 0.8})`); gradient.addColorStop(1, 'rgba(8, 14, 18, 0)');
      context.fillStyle = gradient; context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fill();
    }

    context.lineCap = 'round';
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const ripple = this.ripples[i]; ripple.age += dt;
      if (ripple.age >= ripple.life) { this.ripples.splice(i, 1); continue; }
      const t = ripple.age / ripple.life, grow = 1 - (1 - t) * (1 - t), x = sx(ripple.x), y = sy(ripple.y);
      context.strokeStyle = `rgba(214, 232, 238, ${0.34 * (1 - t) * (1 - t)})`; context.lineWidth = 1;
      context.beginPath(); context.arc(x, y, 1.5 + ripple.radius * grow, 0, Math.PI * 2); context.stroke();
      if (t < 0.18) { context.fillStyle = `rgba(232, 242, 246, ${0.5 * (1 - t / 0.18)})`; context.beginPath(); context.arc(x, y, 1.2, 0, Math.PI * 2); context.fill(); }
    }

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i]; drop.remaining -= dt;
      if (drop.remaining <= 0) {
        this.drops.splice(i, 1);
        this.ripples.push({ x: drop.x, y: drop.y, age: 0, life: 0.42 + Math.random() * 0.2, radius: 7 + Math.random() * 7 });
        this.marks.push({ x: drop.x, y: drop.y, age: 0, life: 3.5 + Math.random() * 3.5, radius: 3.5 + Math.random() * 4.5 });
        if (this.marks.length > MAX_MARKS) this.marks.shift();
        continue;
      }
      const away = drop.remaining * FALL_SPEED, x = sx(drop.x) - WIND_X * away, y = sy(drop.y) - WIND_Y * away;
      // Streaks fade in as they enter so none pops into view mid-screen.
      const enter = Math.min(1, (drop.total - drop.remaining) / 0.05);
      context.strokeStyle = `rgba(206, 224, 232, ${drop.alpha * enter})`; context.lineWidth = 1.25;
      context.beginPath(); context.moveTo(x - WIND_X * drop.length, y - WIND_Y * drop.length); context.lineTo(x, y); context.stroke();
    }
  }
}

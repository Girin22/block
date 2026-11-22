/**
 * The snow duck's sound: packed snow giving under a press, the squeaky crunch Korean writes as 뽀드득.
 * Drafts for the planner to choose from (2026-11-22, tuning.duckSound); until then a duck sounded like
 * any filler, a stone set down. They are made here from filtered noise, so nothing is recorded or
 * licensed: a soft thump as the tongs close, then one or more short grains of crunch, each a band of
 * noise that stutters the way snow sticks and slips.
 */
interface Grain {
  /** Seconds from the start, and how long the grain lasts. */
  at: number; length: number;
  /** The band's centre at the grain's start and end, in Hz, and how narrow it is. */
  from: number; to: number; q: number;
  /** Stick-slip: how many times a second the grain stutters (0 for a smooth hiss), and how deeply (0-1). */
  stutter: number; depth: number;
  gain: number;
}
interface Draft { label: string; seconds: number; thump: number; grains: Grain[]; }

export const CRUNCH_DRAFTS: readonly Draft[] = [
  // 뽀-드득: a thump, then two grains, the second shorter and a little higher.
  { label: '뽀드득', seconds: 0.26, thump: 0.5, grains: [
    { at: 0.035, length: 0.085, from: 1500, to: 1900, q: 2.2, stutter: 95, depth: 0.8, gain: 0.9 },
    { at: 0.135, length: 0.065, from: 2000, to: 2500, q: 2.6, stutter: 120, depth: 0.85, gain: 1 },
  ] },
  // 뽀득: one short, bright squeak. The plainest of them.
  { label: '뽀득 (짧게)', seconds: 0.16, thump: 0.4, grains: [
    { at: 0.025, length: 0.075, from: 2100, to: 2900, q: 3.2, stutter: 140, depth: 0.7, gain: 1 },
  ] },
  // A slow press into deep snow: lower and softer, the stutter felt more than heard.
  { label: '꾹 (낮고 부드럽게)', seconds: 0.32, thump: 0.75, grains: [
    { at: 0.03, length: 0.2, from: 1100, to: 800, q: 1.4, stutter: 55, depth: 0.6, gain: 1 },
  ] },
];

/** One draft as samples (mono, peak 0.8). `random` gives the noise, so a seeded one gives the same sound. */
export function crunchSamples(kind: number, sampleRate: number, random: () => number = Math.random) {
  const draft = CRUNCH_DRAFTS[Math.max(0, Math.min(CRUNCH_DRAFTS.length - 1, kind))];
  const samples = new Float32Array(Math.ceil(draft.seconds * sampleRate));
  // The thump: a low tone falling away, with a breath of dull noise on it.
  let dull = 0, phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    if (t > 0.09) break;
    phase += 2 * Math.PI * (170 - 900 * t) / sampleRate;
    dull += 0.08 * ((random() * 2 - 1) - dull);
    samples[i] += draft.thump * (0.55 * Math.sin(phase) + 2.2 * dull) * Math.min(1, t / 0.004) * Math.exp(-t / 0.022);
  }
  for (const grain of draft.grains) {
    // A state-variable band-pass, its centre gliding over the grain.
    let low = 0, band = 0;
    const start = Math.floor(grain.at * sampleRate), count = Math.floor(grain.length * sampleRate), turn = random() * Math.PI * 2;
    for (let n = 0; n < count && start + n < samples.length; n++) {
      const t = n / sampleRate, along = n / count;
      const f = 2 * Math.sin(Math.PI * (grain.from + (grain.to - grain.from) * along) / sampleRate);
      const high = (random() * 2 - 1) - low - band / grain.q;
      band += f * high; low += f * band;
      // Quick to come, then falling away; the stutter cuts it into the little slips of packed snow.
      const shape = Math.min(1, t / 0.004) * Math.pow(1 - along, 1.6);
      const slip = grain.stutter ? 1 - grain.depth + grain.depth * Math.pow(Math.abs(Math.sin(Math.PI * grain.stutter * t + turn)), 2.5) : 1;
      samples[start + n] += grain.gain * band * shape * slip;
    }
  }
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0) for (let i = 0; i < samples.length; i++) samples[i] *= 0.8 / peak;
  return samples;
}

/**
 * Looping rain ambience for the admin weather. The recording fades in and out at its own edges, so a
 * plain loop would dip every pass. Two streamed voices overlap instead: the next pass starts under the
 * end of the current one and they cross over at equal power. Streaming keeps the 111-second stereo file
 * out of memory, and the gain nodes make the volume controllable on iOS, where element.volume is fixed.
 */

/** Seconds of overlap between the end of one pass and the start of the next. */
export const LOOP_OVERLAP = 5;
/** The recording is very quiet (about -39 dBFS RMS); this lifts it to sit under the block sounds. */
export const RAIN_GAIN = 2.1;

/** Equal-power gains for the pass that is ending and the pass that is starting. */
export function crossfade(position: number, duration: number, overlap = LOOP_OVERLAP) {
  if (!(duration > 0) || !(overlap > 0)) return { ending: 1, starting: 0, progress: 0 };
  const span = Math.min(overlap, duration / 2);
  const progress = Math.max(0, Math.min(1, (position - (duration - span)) / span));
  return { ending: Math.cos(progress * Math.PI / 2), starting: Math.sin(progress * Math.PI / 2), progress };
}

/** How loud the rain is for a given shower strength: it swells in late and trails off softly. */
export function rainLevel(intensity: number) {
  const i = Math.max(0, Math.min(1, intensity));
  return RAIN_GAIN * i * i;
}

interface Voice { element: HTMLAudioElement; gain: GainNode; }

export class RainAmbience {
  private context?: AudioContext;
  private master?: GainNode;
  private voices: Voice[] = [];
  private current = 0;
  private crossing = false;

  constructor(private url: string) {
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.silence(); });
    window.addEventListener('pagehide', () => this.silence());
  }

  /** Must run inside the click that toggles the rain: browsers only let audio start from a gesture. */
  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain(); this.master.gain.value = 0; this.master.connect(this.context.destination);
        for (let i = 0; i < 2; i++) {
          const element = new Audio(); element.src = this.url; element.preload = 'auto'; element.loop = false;
          const gain = this.context.createGain(); gain.gain.value = i === 0 ? 1 : 0;
          this.context.createMediaElementSource(element).connect(gain).connect(this.master);
          this.voices.push({ element, gain });
        }
        // iOS only lets an element play later if it was first started from a gesture.
        const spare = this.voices[1].element;
        void spare.play().then(() => { if (!this.crossing) spare.pause(); spare.currentTime = 0; }).catch(() => {});
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* The rain simply stays silent. */ }
  }

  /** Called every frame with the shower strength, 0..1. */
  update(intensity: number) {
    if (!this.context || !this.master || this.voices.length < 2 || document.hidden) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(rainLevel(intensity), now, 0.12);
    if (intensity <= 0) { this.silence(); return; }
    const ending = this.voices[this.current], starting = this.voices[1 - this.current];
    if (ending.element.paused && !ending.element.ended) void ending.element.play().catch(() => {});
    // Coming back from a hidden tab mid-crossover: the incoming pass has to resume as well.
    if (this.crossing && starting.element.paused) void starting.element.play().catch(() => {});
    const duration = ending.element.duration;
    const mix = crossfade(ending.element.currentTime, duration);
    if (mix.progress > 0 && !this.crossing) {
      this.crossing = true; starting.element.currentTime = 0; void starting.element.play().catch(() => {});
    }
    ending.gain.gain.setTargetAtTime(this.crossing ? mix.ending : 1, now, 0.03);
    starting.gain.gain.setTargetAtTime(this.crossing ? mix.starting : 0, now, 0.03);
    if (this.crossing && (mix.progress >= 1 || ending.element.ended)) {
      ending.element.pause(); ending.element.currentTime = 0; ending.gain.gain.setValueAtTime(0, now);
      starting.gain.gain.setTargetAtTime(1, now, 0.03);
      this.current = 1 - this.current; this.crossing = false;
    }
  }

  private silence() {
    for (const voice of this.voices) if (!voice.element.paused) voice.element.pause();
    if (this.master && this.context) { this.master.gain.cancelScheduledValues(this.context.currentTime); this.master.gain.value = 0; }
  }
}

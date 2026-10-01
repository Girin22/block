/**
 * Environment ambience. Each environment is a deck of field recordings:
 * - day rotates through its recordings in a shuffled order,
 * - morning and night pick one recording per session and repeat it.
 * The recordings fade in and out at their own edges, so the next pass always starts under the last
 * seconds of the current one and the two cross over at equal power. Two streamed voices per deck take
 * turns, which keeps the files out of memory, and gain nodes make fades work on iOS, where
 * element.volume is fixed. Rain is not a deck: its sound follows the on-screen shower (rain-sound.ts).
 * 'off' has no deck either, so choosing it simply fades the ambience out.
 */

export type Environment = 'off' | 'morning' | 'day' | 'night' | 'rain';
export interface Track {
  url: string;
  /** Integrated loudness of the recording, in LUFS. */
  lufs: number;
  /** Extra dB on top of the common level, for recordings that feel louder than they measure. */
  trim?: number;
}

/** Seconds the outgoing and incoming passes overlap. Covers the ~1-2 s fade at each recording's edge. */
export const CROSSFADE = 6;
/**
 * Every recording is brought to this loudness, so switching environments never jumps in level. It sits
 * about 12 dB under a block landing (about -22 LUFS momentary), so the bed never masks the play.
 * Lowered from -32 on 2026-09-29 after playtests found the bed a little loud.
 */
export const TARGET_LUFS = -35;
/** Seconds to swell in the first time, and time constants for pausing and resuming. */
export const FADE_IN = 2.5, PAUSE_FADE = 0.25, RESUME_FADE = 0.4;
/** Seconds to cross from one environment to another while playing. */
export const SWITCH_FADE = 1.5;
/**
 * Testing aid (2026-09-29): morning and night also draw a different recording every time play resumes
 * from the pause screen, so each one can be heard without starting a new session. Set to false to go
 * back to one recording per session.
 */
export const REDRAW_ON_RESUME = true;

/** Linear gain that brings a recording of the given loudness to TARGET_LUFS, plus its own trim. */
export function trackGain(lufs: number, trim = 0) { return 10 ** ((TARGET_LUFS - lufs + trim) / 20); }

/** A random recording other than the one just played, so the same street never plays twice in a row. */
export function nextTrack(count: number, current: number, random = Math.random) {
  if (count <= 1) return 0;
  if (current < 0 || current >= count) return Math.floor(random() * count) % count;
  return (current + 1 + Math.floor(random() * (count - 1)) % (count - 1)) % count;
}

/** Equal-power gain curves (outgoing, incoming) for a crossover sampled at `steps` points. */
export function crossfadeCurves(steps = 64) {
  const outgoing = new Float32Array(steps), incoming = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    outgoing[i] = Math.cos(t * Math.PI / 2); incoming[i] = Math.sin(t * Math.PI / 2);
  }
  return { outgoing, incoming };
}

/** `unlocked` records that the element has played once from a tap, which strict browsers require. */
interface Voice { element: HTMLAudioElement; trim: GainNode; fade: GainNode; track: number; unlocked: boolean; }

/** Two voices that hand one environment's recordings over to each other. */
class Deck {
  readonly level: GainNode;
  private voices: Voice[] = [];
  private current = 0;
  private crossing = false;
  private started = false;
  private track: number;
  stopTimer = 0;

  constructor(private context: AudioContext, destination: AudioNode, private tracks: Track[], private repeat: boolean) {
    this.level = context.createGain(); this.level.connect(destination);
    this.track = nextTrack(tracks.length, -1);
    for (let i = 0; i < 2; i++) {
      const element = new Audio(); element.preload = 'auto'; element.loop = false;
      const trim = context.createGain(), fade = context.createGain(); fade.gain.value = 0;
      context.createMediaElementSource(element).connect(trim).connect(fade).connect(this.level);
      const voice: Voice = { element, trim, fade, track: -1, unlocked: false };
      element.addEventListener('timeupdate', () => this.watch(voice));
      element.addEventListener('ended', () => this.finish(voice));
      this.voices.push(voice);
    }
  }

  /** A repeating deck draws a different recording; it starts from the top when next played. */
  redraw() { if (this.repeat) { this.stop(); this.track = nextTrack(this.tracks.length, this.track); } }

  /**
   * Starts or continues the deck. Call it from a tap, and again from later taps: strict browsers
   * (Chrome on iPhone) refuse to start an element outside a tap, and a refused start is simply
   * retried. The idle voice is started and stopped once inside a tap as well, so that it may start on
   * its own later when the crossover comes.
   */
  play() {
    clearTimeout(this.stopTimer);
    if (!this.started) {
      this.started = true; this.crossing = false; this.current = 0;
      const [first, spare] = this.voices;
      this.load(first, this.track); first.fade.gain.cancelScheduledValues(0); first.fade.gain.value = 1;
      this.load(spare, this.following(first.track)); spare.fade.gain.value = 0;
    }
    for (const voice of this.voices) {
      if (this.active(voice)) void voice.element.play().then(() => { voice.unlocked = true; this.lastError = ''; }).catch((error: Error) => { this.lastError = error.name; });
      else if (!voice.unlocked) void voice.element.play().then(() => {
        voice.unlocked = true;
        if (!this.active(voice)) { voice.element.pause(); voice.element.currentTime = 0; }
      }).catch(() => {});
    }
  }

  private active(voice: Voice) { return voice === this.voices[this.current] || this.crossing; }

  /** For the admin readout: is the audible voice actually playing, and why did the last start fail. */
  lastError = '';
  get sounding() { return this.started && !this.voices[this.current].element.paused; }

  pause() { for (const voice of this.voices) if (!voice.element.paused) voice.element.pause(); }

  /** Silences the deck and forgets its position; the next play() starts a fresh pass. */
  stop() {
    this.pause(); this.started = false; this.crossing = false;
    for (const voice of this.voices) { voice.fade.gain.cancelScheduledValues(0); voice.fade.gain.value = 0; }
  }

  private following(track: number) { return this.repeat ? track : nextTrack(this.tracks.length, track); }

  private load(voice: Voice, track: number) {
    voice.track = track; voice.trim.gain.value = trackGain(this.tracks[track].lufs, this.tracks[track].trim);
    if (voice.element.src !== new URL(this.tracks[track].url, location.href).href) voice.element.src = this.tracks[track].url;
    voice.element.currentTime = 0;
  }

  /** Starts the crossover once the playing pass enters its last CROSSFADE seconds. */
  private watch(voice: Voice) {
    if (this.crossing || !this.started || voice !== this.voices[this.current] || voice.element.paused) return;
    const { duration, currentTime } = voice.element;
    if (!(duration > 0)) return;
    const remaining = duration - currentTime;
    if (remaining > Math.min(CROSSFADE, duration / 2)) return;
    this.crossing = true;
    const incoming = this.voices[1 - this.current], now = this.context.currentTime, span = Math.max(0.05, remaining);
    const { outgoing: down, incoming: up } = crossfadeCurves();
    voice.fade.gain.cancelScheduledValues(now); voice.fade.gain.setValueCurveAtTime(down, now, span);
    incoming.fade.gain.cancelScheduledValues(now); incoming.fade.gain.setValueCurveAtTime(up, now, span);
    incoming.element.currentTime = 0; void incoming.element.play().catch(() => {});
  }

  /** The outgoing pass has run out: hand over and fetch the one after next. */
  private finish(voice: Voice) {
    if (!this.started || voice !== this.voices[this.current]) return;
    // If the tail was never seen (e.g. a stalled stream), the next pass simply starts at full level.
    const incoming = this.voices[1 - this.current], now = this.context.currentTime;
    voice.fade.gain.cancelScheduledValues(now); voice.fade.gain.setValueAtTime(0, now);
    incoming.fade.gain.cancelScheduledValues(now); incoming.fade.gain.setValueAtTime(1, now);
    if (incoming.element.paused) void incoming.element.play().catch(() => {});
    this.current = 1 - this.current; this.crossing = false;
    this.load(voice, this.following(incoming.track));
  }
}

/** One audio context for every environment; decks are built the first time they are needed. */
export class Soundscape {
  private context?: AudioContext;
  private master?: GainNode;
  private decks = new Map<Environment, Deck>();
  private selected: Environment = 'day';
  private playing = false;
  private suspendTimer = 0;

  constructor(private tracks: Partial<Record<Environment, { tracks: Track[]; repeat: boolean }>>) {}

  get environment() { return this.selected; }

  /** A short Korean status line for the admin panel, to tell a device setting from a real defect. */
  get status() {
    const deck = this.decks.get(this.selected);
    if (!this.context) return '환경음: 아직 시작 전(화면을 한 번 탭)';
    const context = this.context.state === 'running' ? '' : ` · 오디오 ${this.context.state}`;
    if (this.selected === 'off') return `환경음: 꺼짐${context}`;
    if (this.selected === 'rain') return `환경음: 비${context}`;
    if (!this.playing) return `환경음: 일시정지${context}`;
    if (deck?.sounding) return `환경음: 재생 중${context}`;
    return `환경음: <b>막힘</b>${deck?.lastError ? ` (${deck.lastError})` : ''}${context}`;
  }

  /** Starts or resumes the selected environment. Call from a user gesture. */
  play() {
    try {
      const first = !this.context;
      this.context ??= new AudioContext();
      if (!this.master) { this.master = this.context.createGain(); this.master.gain.value = 0; this.master.connect(this.context.destination); }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
      const deck = this.deck(this.selected);
      // Already playing: a later tap only retries whatever a strict browser refused the first time.
      if (this.playing) { deck?.play(); return; }
      clearTimeout(this.suspendTimer); this.playing = true;
      if (deck && REDRAW_ON_RESUME && !first) deck.redraw();
      if (deck) { deck.level.gain.cancelScheduledValues(0); deck.level.gain.value = 1; deck.play(); }
      const now = this.context.currentTime, gain = this.master.gain;
      gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now);
      if (first) gain.linearRampToValueAtTime(1, now + FADE_IN); else gain.setTargetAtTime(1, now, RESUME_FADE / 3);
    } catch { /* Ambience simply stays silent. */ }
  }

  /** Fades everything out quickly, then holds each recording where it is. */
  pause() {
    if (!this.playing || !this.context || !this.master) return;
    this.playing = false;
    const now = this.context.currentTime, gain = this.master.gain;
    gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now); gain.setTargetAtTime(0, now, PAUSE_FADE / 3);
    clearTimeout(this.suspendTimer);
    this.suspendTimer = window.setTimeout(() => {
      if (this.playing) return;
      for (const deck of this.decks.values()) deck.pause();
      void this.context?.suspend().catch(() => {});
    }, PAUSE_FADE * 1000 + 50);
  }

  /** Switches environment. While paused the new one simply starts on the next play(). */
  select(environment: Environment) {
    if (environment === this.selected) return;
    const previous = this.decks.get(this.selected); this.selected = environment;
    const context = this.context;
    if (context && this.playing) {
      const now = context.currentTime;
      if (previous) {
        previous.level.gain.cancelScheduledValues(now); previous.level.gain.setValueAtTime(previous.level.gain.value, now);
        previous.level.gain.linearRampToValueAtTime(0, now + SWITCH_FADE);
        clearTimeout(previous.stopTimer); previous.stopTimer = window.setTimeout(() => previous.stop(), SWITCH_FADE * 1000 + 50);
      }
      const next = this.deck(environment);
      if (next) {
        next.level.gain.cancelScheduledValues(now); next.level.gain.setValueAtTime(0, now);
        next.level.gain.linearRampToValueAtTime(1, now + SWITCH_FADE); next.play();
      }
    } else previous?.stop();
  }

  /** A new session: repeating environments draw a new recording. */
  newSession() { for (const deck of this.decks.values()) deck.redraw(); }

  private deck(environment: Environment) {
    const spec = this.tracks[environment];
    if (!spec?.tracks.length || !this.context || !this.master) return undefined;
    let deck = this.decks.get(environment);
    if (!deck) { deck = new Deck(this.context, this.master, spec.tracks, spec.repeat); this.decks.set(environment, deck); }
    return deck;
  }
}

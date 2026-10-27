import { clackVoice, synthesize } from './audio';
import { nextTrack } from './ambience';
import { replaceIfStuck } from './audio-session';

/**
 * The pause button pops: the high pop pauses, the low one resumes. Since 2026-10-20 both are Pixabay's
 * "Wine cork pop" (universfield, Pixabay Content License); the resume pop is the same cut at 0.8x speed,
 * and both are leveled to the Epidemic pops they replaced. At their recorded level (-30 LUFS
 * momentary) they sit about 5 dB under a block landing and 5 dB over the ambience, as a UI sound
 * should. 2.5 (-22, the loudest sound in the game) was too loud in play, 2026-09-29.
 */
export const BUTTON_GAIN = 1;
export type ButtonSound = 'pause' | 'resume';
/** The studio intro's pavers land a little under the game's own (about -3 dB), as a prelude. */
export const INTRO_GAIN = 0.7;
/** Seconds a hit set ahead sounds before the drawn contact: the eye reads a landing a touch early. */
export const HIT_LEAD = 0.02;

/** Playback rate and level for one placement hit: the white filler is higher and quieter. */
export function hitVoice(white: boolean, variation = 0) {
  const voice = clackVoice(white, variation), block = clackVoice(false);
  return { rate: voice.pitch, gain: voice.gain / block.gain };
}

/** Plays an effect by id elsewhere (the iOS app's own player, native.ts): `rate` changes speed and pitch, `delay` is in seconds. */
export interface EffectPlayer { play(id: string, rate: number, volume: number, delay: number): void; }

export class PlaySound {
  private context?: AudioContext;
  /** While set, every effect goes to this player and no audio context is made (the iOS app's X environment). */
  private native?: EffectPlayer;
  private output?: DynamicsCompressorNode;
  private buttonBuffers?: Record<ButtonSound, Promise<AudioBuffer | undefined>>;
  /** Context time until which a button sound is still ringing; pausing waits for it. */
  private ringingUntil = 0;
  private suspendTimer = 0;
  /** The latest press, resolved once its sound has started (or failed to). */
  private pressing?: Promise<void>;
  /** Bumped by every unlock, so a pending suspend from an earlier pause is dropped. */
  private pauseToken = 0;

  /**
   * Recorded stone hits for placement, decoded once; one is picked at random per placement. They are cut
   * from Pixabay's "Two large cobblestone blocks" (Pixabay Content License) with the room tail pulled
   * down, replacing the Epidemic Sound hits on 2026-10-20.
   */
  private hits?: Promise<AudioBuffer[]>;
  private decodedHits: AudioBuffer[] = [];
  private lastHit = -1;

  constructor(private buttonURLs?: Record<ButtonSound, string>, private hitURLs: string[] = []) {}

  /** Whether effects can sound right now, without waiting for a tap. */
  get running() { return !!this.native || this.context?.state === 'running'; }
  /**
   * Hands the effects to `player` (ids hit0.., pause, resume), letting go of the page's context so the
   * page holds no audio at all, or takes them back with undefined.
   */
  useNative(player?: EffectPlayer) {
    if (player === this.native) return;
    this.native = player;
    if (player) this.release();
  }
  unlock() {
    if (this.native) return;
    try {
      clearTimeout(this.suspendTimer); this.pauseToken++;
      this.context ??= new AudioContext();
      // Safari leaves the context 'interrupted', not 'suspended', after the phone locks or another app
      // takes the audio; it only comes back with resume() from a tap.
      if (this.context.state !== 'running') { void this.context.resume().catch(() => {}); this.recover(this.context); }
      if (!this.output) {
        // A limiter, not a compressor: it only catches peaks when many hits stack up. The recorded hits
        // already peak near -3 dBFS, and the old -10 dB / 8:1 setting (tuned for the synthesized clack)
        // pressed them down 4-8 dB under the ambience.
        this.output = this.context.createDynamicsCompressor();
        this.output.threshold.value = -3; this.output.knee.value = 0; this.output.ratio.value = 20;
        this.output.attack.value = 0.001; this.output.release.value = 0.1;
        this.output.connect(this.context.destination);
      }
      if (this.hitURLs.length && !this.hits) {
        const context = this.context;
        this.hits = Promise.all(this.hitURLs.map(url => fetch(url).then(response => response.arrayBuffer()).then(data => context.decodeAudioData(data))))
          .then(buffers => (this.decodedHits = buffers)).catch(() => []);
      }
      // The pops are tiny; decode them once so later presses play instantly.
      if (this.buttonURLs && !this.buttonBuffers) {
        const context = this.context, load = (url: string) => fetch(url).then(response => response.arrayBuffer()).then(data => context.decodeAudioData(data)).catch(() => undefined);
        this.buttonBuffers = { pause: load(this.buttonURLs.pause), resume: load(this.buttonURLs.resume) };
      }
    } catch { /* Silent play remains available. */ }
  }
  /**
   * `level` scales the hit and `inSeconds` sets it ahead on the audio clock, both for the studio intro
   * (INTRO_GAIN). A hit set ahead comes out early by the device's output latency, so it is heard on time.
   */
  place(white = false, level = 1, inSeconds = 0) {
    if (this.native) {
      this.lastHit = nextTrack(this.hitURLs.length, this.lastHit);
      const voice = hitVoice(white, Math.random() * 2 - 1);
      this.native.play(`hit${this.lastHit}`, voice.rate, voice.gain * level, Math.max(0, inSeconds - HIT_LEAD));
      return;
    }
    this.unlock(); if (!this.context || !this.output) return;
    const variation = Math.random() * 2 - 1, context = this.context;
    const latency = inSeconds > 0 ? (context.outputLatency || context.baseLatency || 0) + HIT_LEAD : 0;
    const at = context.currentTime + Math.max(0, inSeconds - latency);
    // Until the recordings have loaded (only the first moments of a session), the synthesized hit stands in.
    if (!this.decodedHits.length) {
      const trim = context.createGain(); trim.gain.value = level; trim.connect(this.output);
      synthesize(context, trim, white, variation, at); window.setTimeout(() => trim.disconnect(), (at - context.currentTime + 2) * 1000); return;
    }
    this.lastHit = nextTrack(this.decodedHits.length, this.lastHit);
    const voice = hitVoice(white, variation), source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = this.decodedHits[this.lastHit]; source.playbackRate.value = voice.rate; gain.gain.value = voice.gain * level;
    source.connect(gain).connect(this.output);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(at);
  }
  /** The pause button's press. Bypasses the limiter so it plays at exactly BUTTON_GAIN. */
  button(sound: ButtonSound) {
    if (this.native) { this.native.play(sound, 1, BUTTON_GAIN, 0); return; }
    this.unlock(); const context = this.context;
    if (!context || !this.buttonBuffers) return;
    this.pressing = this.buttonBuffers[sound].then(buffer => {
      if (!buffer) return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; gain.gain.value = BUTTON_GAIN;
      source.connect(gain).connect(context.destination);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
      this.ringingUntil = Math.max(this.ringingUntil, context.currentTime + buffer.duration);
    });
  }
  /** Bumped by every pause, so a stuck context is only replaced while the effects are wanted. */
  private pauses = 0;
  private recovering = false;
  /** A context left stuck after another app took the audio is dropped for a fresh one (decoded sounds carry over). */
  private recover(context: AudioContext) {
    if (this.recovering) return;
    this.recovering = true; const pauses = this.pauses;
    window.setTimeout(() => { this.recovering = false; }, 800);
    replaceIfStuck(context, () => {
      if (pauses !== this.pauses || context !== this.context) return;
      this.release(); this.unlock();
    });
  }
  /**
   * The app has left the screen: the context is closed and the next sound starts a fresh one (decoded
   * sounds carry over). After another app has played, iOS can hand back a context that says 'running'
   * yet stays silent.
   */
  release() {
    const context = this.context;
    if (!context) return;
    clearTimeout(this.suspendTimer); this.pauses++;
    this.context = undefined; this.output = undefined;
    void context.close().catch(() => {});
  }
  /** Suspends the effects once any button sound has finished, so pausing never cuts it off. */
  pause() {
    const context = this.context; if (!context) return;
    this.pauses++;
    clearTimeout(this.suspendTimer); const token = ++this.pauseToken;
    // The first press may still be decoding; wait until its sound has actually started.
    void (this.pressing ?? Promise.resolve()).then(() => {
      if (token !== this.pauseToken) return;
      const wait = Math.max(0, this.ringingUntil - context.currentTime) + 0.05;
      this.suspendTimer = window.setTimeout(() => { if (token === this.pauseToken && context.state === 'running') void context.suspend().catch(() => {}); }, wait * 1000);
    });
  }
  reset() { this.pause(); }
}

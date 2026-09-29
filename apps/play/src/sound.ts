import { clackVoice, synthesize } from './audio';
import { nextTrack } from './ambience';

/** The pause button's recording plays at half its original amplitude (-6 dB). */
export const BUTTON_GAIN = 0.5;
/** The stone drag that opens a long run of white fillers. */
export const DRAG_GAIN = 0.8;

/** Playback rate and level for one placement hit: the white filler is higher and quieter. */
export function hitVoice(white: boolean, variation = 0) {
  const voice = clackVoice(white, variation), block = clackVoice(false);
  return { rate: voice.pitch, gain: voice.gain / block.gain };
}

export class PlaySound {
  private context?: AudioContext;
  private output?: DynamicsCompressorNode;
  private buttonData?: Promise<ArrayBuffer>;
  private buttonBuffer?: Promise<AudioBuffer | undefined>;
  /** Context time until which a button sound is still ringing; pausing waits for it. */
  private ringingUntil = 0;
  private suspendTimer = 0;
  /** The latest press, resolved once its sound has started (or failed to). */
  private pressing?: Promise<void>;
  /** Bumped by every unlock, so a pending suspend from an earlier pause is dropped. */
  private pauseToken = 0;

  /** Recorded stone hits for placement, decoded once; one is picked at random per placement. */
  private hits?: Promise<AudioBuffer[]>;
  private decodedHits: AudioBuffer[] = [];
  private lastHit = -1;

  private dragBuffer?: Promise<AudioBuffer | undefined>;

  constructor(private buttonURL?: string, private hitURLs: string[] = [], private dragURL?: string) {}

  unlock() {
    try {
      clearTimeout(this.suspendTimer); this.pauseToken++;
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
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
      if (this.dragURL && !this.dragBuffer) {
        const context = this.context;
        this.dragBuffer = fetch(this.dragURL).then(response => response.arrayBuffer()).then(data => context.decodeAudioData(data)).catch(() => undefined);
      }
      // The recording is small (about 20 KB); decode it once so later presses play instantly.
      if (this.buttonURL && !this.buttonBuffer) {
        const context = this.context;
        this.buttonData ??= fetch(this.buttonURL).then(response => response.arrayBuffer());
        this.buttonBuffer = this.buttonData.then(data => context.decodeAudioData(data)).catch(() => undefined);
      }
    } catch { /* Silent play remains available. */ }
  }
  place(white = false) {
    this.unlock(); if (!this.context || !this.output) return;
    const variation = Math.random() * 2 - 1;
    // Until the recordings have loaded (only the first moments of a session), the synthesized hit stands in.
    if (!this.decodedHits.length) { synthesize(this.context, this.output, white, variation); return; }
    this.lastHit = nextTrack(this.decodedHits.length, this.lastHit);
    const voice = hitVoice(white, variation), source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = this.decodedHits[this.lastHit]; source.playbackRate.value = voice.rate; gain.gain.value = voice.gain;
    source.connect(gain).connect(this.output);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start();
  }
  /** A long run of white fillers begins: one drag of stone over stone. */
  drag() {
    this.unlock(); const context = this.context, output = this.output;
    if (!context || !output || !this.dragBuffer) return;
    void this.dragBuffer.then(buffer => {
      if (!buffer || context.state !== 'running') return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; gain.gain.value = DRAG_GAIN;
      source.connect(gain).connect(output);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
    });
  }
  /** The pause button's press. Bypasses the compressor so it plays at exactly BUTTON_GAIN. */
  button() {
    this.unlock(); const context = this.context;
    if (!context || !this.buttonBuffer) return;
    this.pressing = this.buttonBuffer.then(buffer => {
      if (!buffer) return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; gain.gain.value = BUTTON_GAIN;
      source.connect(gain).connect(context.destination);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
      this.ringingUntil = Math.max(this.ringingUntil, context.currentTime + buffer.duration);
    });
  }
  /** Suspends the effects once any button sound has finished, so pausing never cuts it off. */
  pause() {
    const context = this.context; if (!context) return;
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

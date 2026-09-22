/**
 * The placement sound: one paver set against another. Hard, dry, and mineral, with almost no ring,
 * so it stays clean when blocks are placed in quick succession. Everything is synthesized; the game
 * ships no audio files.
 */

/** How much each hit may drift in pitch, so repeated placements never sound machine-made. */
export const PITCH_VARIATION = 0.025;

/** The white filler is a smaller piece: higher, shorter, and quieter than a placed block. */
export function clackVoice(white: boolean, variation = 0) {
  const drift = 1 + Math.max(-1, Math.min(1, variation)) * PITCH_VARIATION;
  return { pitch: (white ? 1.4 : 1) * drift, length: white ? 0.8 : 1, gain: white ? 0.5175 : 0.69, contact: white ? 1.15 : 1 };
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ctx: BaseAudioContext) {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.25), ctx.sampleRate);
    const data = buffer.getChannelData(0); let seed = 73;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 0xffffffff * 2 - 1; }
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** variation is -1..1 and picks where in the allowed pitch drift this hit falls. */
export function synthesize(ctx: BaseAudioContext, destination: AudioNode, white: boolean, variation = 0) {
  const voice = clackVoice(white, variation), t0 = ctx.currentTime + 0.005;
  const bus = ctx.createGain(); bus.gain.value = voice.gain; bus.connect(destination);
  let pending = 0;
  const finish = (source: AudioScheduledSourceNode, nodes: AudioNode[]) => {
    pending++;
    source.onended = () => { source.disconnect(); nodes.forEach(node => node.disconnect()); if (--pending === 0) bus.disconnect(); };
  };
  /** One resonant mode of the struck block: instant attack, exponential decay, optional pitch fall. */
  const mode = (frequency: number, amplitude: number, decay: number, fallTo?: number) => {
    const end = t0 + decay * voice.length;
    const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency * voice.pitch, t0);
    if (fallTo) osc.frequency.exponentialRampToValueAtTime(fallTo * voice.pitch, t0 + 0.045 * voice.length);
    gain.gain.setValueAtTime(0, t0); gain.gain.linearRampToValueAtTime(amplitude, t0 + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, end); gain.gain.linearRampToValueAtTime(0, end + 0.004);
    osc.connect(gain).connect(bus); finish(osc, [gain]); osc.start(t0); osc.stop(end + 0.01);
  };
  /** The contact itself: a very short band of noise. */
  const contact = (frequency: number, q: number, amplitude: number, duration: number) => {
    const end = t0 + duration;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noiseBuffer(ctx); filter.type = 'bandpass'; filter.frequency.value = frequency * voice.contact; filter.Q.value = q;
    gain.gain.setValueAtTime(0, t0); gain.gain.linearRampToValueAtTime(amplitude, t0 + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, end); gain.gain.linearRampToValueAtTime(0, end + 0.003);
    source.connect(filter).connect(gain).connect(bus); finish(source, [filter, gain]); source.start(t0); source.stop(end + 0.01);
  };
  contact(2200, 1.2, 0.8, 0.022);
  mode(410, 0.5, 0.055); mode(985, 0.24, 0.03); mode(205, 0.4, 0.07, 130);
}

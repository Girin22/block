import { synthesize } from './audio';
export class PlaySound {
  private context?: AudioContext;
  private output?: DynamicsCompressorNode;
  unlock() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
      if (!this.output) {
        this.output = this.context.createDynamicsCompressor();
        this.output.threshold.value = -10; this.output.ratio.value = 8;
        this.output.connect(this.context.destination);
      }
    } catch { /* Silent play remains available. */ }
  }
  place(white = false) {
    this.unlock(); if (!this.context || !this.output) return;
    synthesize(this.context, this.output, white, Math.random() * 2 - 1);
  }
  pause() { if (this.context?.state === 'running') void this.context.suspend().catch(() => {}); }
  reset() { this.pause(); }
}

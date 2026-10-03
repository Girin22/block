import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light_canvas';
// The same animation as assets/images/pause.lottie (its only scene, byte-identical JSON). The light
// canvas player replaces the dotLottie wasm runtime (about 1.4 MB) for the app build; frames were
// compared pixel by pixel on 2026-10-01 and differ only in sub-pixel edge antialiasing.
import animationData from '../../../assets/images/pause.json';

// On-screen length of the icon swap; the pause panel in style.css settles later, at 0.8 seconds.
const TRANSITION_SECONDS = 0.3;

export class PauseIcon {
  private player: AnimationItem;
  private paused = false;
  private loaded = false;
  private endFrame = 26;

  constructor(private button: HTMLButtonElement, canvas: HTMLCanvasElement) {
    // The canvas keeps its 40×40 attributes; the player multiplies them by this ratio once on load.
    this.player = lottie.loadAnimation<'canvas'>({
      // No container: drawing straight into the given context, so the player never measures the button.
      container: undefined as unknown as Element, renderer: 'canvas', loop: false, autoplay: false, animationData,
      rendererSettings: { context: canvas.getContext('2d')!, clearCanvas: true, dpr: Math.min(devicePixelRatio, 2) },
    });
    const ready = () => {
      if (this.loaded) return;
      this.loaded = true;
      this.endFrame = Math.max(1, this.player.totalFrames - 1);
      // Derive the rate from the clip so a re-exported animation keeps the same on-screen time.
      const clip = this.player.getDuration() * this.endFrame / Math.max(1, this.player.totalFrames - 1);
      this.player.setSpeed(clip > 0 ? clip / TRANSITION_SECONDS : 1);
      this.player.goToAndStop(this.paused ? this.endFrame : 0, true);
      this.button.classList.add('icon-ready');
    };
    this.player.addEventListener('DOMLoaded', ready);
    if (this.player.isLoaded) ready();
    this.player.addEventListener('data_failed', () => { this.loaded = false; this.button.classList.remove('icon-ready'); });
    this.player.addEventListener('complete', () => {
      this.player.goToAndStop(this.paused ? this.endFrame : 0, true);
    });
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (!this.loaded) return;
    const frame = this.player.currentFrame, target = paused ? this.endFrame : 0;
    this.player.pause();
    this.player.setDirection(paused ? 1 : -1);
    if (Math.abs(target - frame) < .01) this.player.goToAndStop(target, true);
    else this.player.play();
  }

  dispose() { this.player.destroy(); }
}

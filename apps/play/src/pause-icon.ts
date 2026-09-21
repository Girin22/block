import { DotLottie } from '@lottiefiles/dotlottie-web';
import wasmURL from '@lottiefiles/dotlottie-web/dotlottie-player.wasm?url';
import animationURL from '../../../assets/images/Flow 2.lottie?url';

// Ship the runtime with the app; playback never relies on a remote CDN.
DotLottie.setWasmUrl(wasmURL);

// On-screen length of the icon swap; the pause panel in style.css settles later, at 0.8 seconds.
const TRANSITION_SECONDS = 0.3;

export class PauseIcon {
  private player: DotLottie;
  private paused = false;
  private loaded = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private endFrame = 56;

  constructor(private button: HTMLButtonElement, canvas: HTMLCanvasElement) {
    this.player = new DotLottie({
      canvas, src: animationURL, autoplay: false, loop: false,
      renderConfig: { devicePixelRatio: Math.min(devicePixelRatio, 2), autoResize: true },
    });
    this.player.addEventListener('load', () => {
      this.loaded = true;
      this.endFrame = Math.min(56, this.player.totalFrames - 1);
      this.player.setSegment(0, this.endFrame);
      // Derive the rate from the clip so a re-exported animation keeps the same on-screen time.
      const clip = this.player.duration * this.endFrame / Math.max(1, this.player.totalFrames - 1);
      this.player.setSpeed(clip > 0 ? clip / TRANSITION_SECONDS : 1);
      this.player.setFrame(this.paused ? this.endFrame : 0);
      this.button.classList.add('icon-ready');
    });
    this.player.addEventListener('loadError', () => { this.loaded = false; this.button.classList.remove('icon-ready'); });
    this.player.addEventListener('complete', () => {
      this.player.pause(); this.player.setFrame(this.paused ? this.endFrame : 0);
    });
    this.reduced.addEventListener('change', this.snap);
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (!this.loaded) return;
    const frame = this.player.currentFrame, target = paused ? this.endFrame : 0;
    this.player.pause();
    this.player.setMode(paused ? 'forward' : 'reverse');
    this.player.setFrame(frame);
    if (this.reduced.matches || Math.abs(target - frame) < .01) this.player.setFrame(target);
    else this.player.play();
  }

  private snap = () => {
    if (this.loaded && this.reduced.matches) {
      this.player.pause(); this.player.setFrame(this.paused ? this.endFrame : 0);
    }
  };

  dispose() { this.reduced.removeEventListener('change', this.snap); this.player.destroy(); }
}

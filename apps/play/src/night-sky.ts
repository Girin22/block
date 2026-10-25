import type { Backdrop, HalloweenSettings, Visitor } from './halloween';

/** Silhouettes drawn for the game: a bat, and a witch riding her broom to the right. */
const BAT = `<svg viewBox="0 0 24 12" aria-hidden="true"><path d="M12 4.2c.5-1.1 1.2-1.6 1.8-1.5-.3.6-.3 1.1 0 1.5 1.6-1.6 4.7-2.4 8.2-1.4-1.9.6-3 1.9-3.3 3.6-1.1-.8-2.3-.9-3.2-.2-.7.6-1.3 1.6-1.6 2.9-.6-.7-1.2-1.1-1.9-1.1s-1.3.4-1.9 1.1c-.3-1.3-.9-2.3-1.6-2.9-.9-.7-2.1-.6-3.2.2C5 5 3.9 3.7 2 3.1c3.5-1 6.6-.2 8.2 1.4.3-.4.3-.9 0-1.5.6-.1 1.3.4 1.8 1.5Z"/></svg>`;
const WITCH = `<svg viewBox="-4 -6 124 62" aria-hidden="true">
  <path d="M15 44.4 112 35.8l.5 2.6-97 8.6Z"/>
  <path d="M17 43.6 1 37.4l2.4 5.4-3.2 4.6 4.2 3.4L17.6 48Z"/>
  <path d="M51 42c1.6-11 7.4-19.4 16-21.6 4.4 6 6.8 13.4 8.6 19.6-7.2 1.4-15.4 4.2-24.6 2Z"/>
  <path d="M57 29.6c-9.6-2.6-18.4 2.2-27.6-.4 7.4 6.4 16.4 8.4 25.4 8.8Z"/>
  <circle cx="70.5" cy="16" r="5.2"/>
  <path d="M63 13.6c4.4-1.6 10.8-1.6 16.6.6l-6-1.8c-2.4-6.4-7.2-11-15.6-14.4 4.8 5.4 6.4 10 5 15.6Z"/>
  <path d="m70 40 10.6 3.8 4-1-1.8 3.4-11.6-.8Z"/>
</svg>`;

/**
 * Halloween's sky, behind the pavers (the board is drawn on a clear background while the event is on).
 * The lantern night is a plain deep plum; the lo-fi night is a dusky gradient with a moon, haze and a
 * soft film grain. Now and then a visitor crosses: a few bats, the witch passing the moon, or a
 * jack-o'-lantern whooshing by. Visitors run on the compositor (Web Animations) and only while the
 * event is on screen.
 */
export class NightSky {
  readonly element = document.createElement('div');
  private active = false;
  private timer = 0;
  private settings?: HalloweenSettings;
  /** The witch is the sky's big moment; the glitch can answer it. */
  onWitch?: () => void;

  constructor(private pumpkinURL: string) {
    this.element.id = 'backdrop'; this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = '<div class="lofi"><div class="moon"></div><div class="haze"></div><div class="grain"></div></div><div class="visitors"></div>';
    document.addEventListener('visibilitychange', () => this.schedule());
  }

  apply(settings: HalloweenSettings) {
    this.settings = settings;
    this.setBackdrop(settings.backdrop);
    this.schedule();
  }
  private setBackdrop(backdrop: Backdrop) { this.element.dataset.backdrop = backdrop; }

  setActive(active: boolean) {
    this.active = active;
    if (!active) this.element.querySelector('.visitors')!.replaceChildren();
    this.schedule();
  }

  private schedule() {
    clearTimeout(this.timer);
    const enabled = this.enabled();
    if (!this.active || document.hidden || !enabled.length || !this.settings) return;
    const every = this.settings.visitorEvery;
    this.timer = window.setTimeout(() => {
      const list = this.enabled();
      if (list.length) this.visit(list[Math.floor(Math.random() * list.length)]);
      this.schedule();
    }, every * (0.6 + Math.random() * 0.8) * 1000);
  }
  private enabled() { return (Object.keys(this.settings?.visitors ?? {}) as Visitor[]).filter(key => this.settings!.visitors[key]); }

  /** Sends one visitor across now (the panel's preview buttons use this too). */
  visit(visitor: Visitor) {
    if (!this.active) return;
    if (visitor === 'bats') this.bats();
    else if (visitor === 'witch') this.witch();
    else this.jack();
  }

  private add(className: string, html = '') {
    const node = document.createElement('div'); node.className = className; node.innerHTML = html;
    this.element.querySelector('.visitors')!.append(node);
    return node;
  }

  /** Two to four bats flutter across the upper sky on loose, separate paths. */
  private bats() {
    const count = 2 + Math.floor(Math.random() * 3), leftward = Math.random() < .5;
    for (let i = 0; i < count; i++) {
      const bat = this.add('bat', BAT), size = 26 + Math.random() * 16, top = 8 + Math.random() * 34;
      bat.style.width = `${size}px`; bat.style.setProperty('--flap', `${150 + Math.random() * 80}ms`);
      const duration = 6000 + Math.random() * 4000, rise = (Math.random() - .5) * 18, from = leftward ? 110 : -15, to = leftward ? -15 : 110;
      const keyframes: Keyframe[] = [0, .25, .5, .75, 1].map(at => ({
        transform: `translate(${from + (to - from) * at}cqw, ${top + rise * at + Math.sin(at * Math.PI * 3 + i) * 3}cqh) scaleX(${leftward ? -1 : 1})`,
        opacity: at === 0 || at === 1 ? 0 : 1,
      }));
      bat.animate(keyframes, { duration, delay: i * (300 + Math.random() * 500), easing: 'linear', fill: 'both' }).finished.then(() => bat.remove(), () => bat.remove());
    }
  }

  /** The witch rides slowly past the moon: she rises out of the dusk, crosses, and is gone. */
  private witch() {
    const witch = this.add('witch', WITCH);
    witch.animate([
      { transform: 'translate(-30cqw, 24cqh) rotate(-4deg)', opacity: 0 },
      { transform: 'translate(10cqw, 17cqh) rotate(-6deg)', opacity: .85, offset: .2 },
      { transform: 'translate(60cqw, 12cqh) rotate(-3deg)', opacity: .85, offset: .75 },
      { transform: 'translate(105cqw, 9cqh) rotate(-1deg)', opacity: 0 },
    ], { duration: 9000, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' }).finished.then(() => witch.remove(), () => witch.remove());
    window.setTimeout(() => this.onWitch?.(), 2200);
  }

  /** A glowing jack-o'-lantern whooshes across on an arc, spinning, with a short trail. */
  private jack() {
    const fromLeft = Math.random() < .5, low = 30 + Math.random() * 30, duration = 1300;
    for (let i = 3; i >= 0; i--) {
      const jack = this.add(`jack${i ? ' trail' : ''}`, `<img src="${this.pumpkinURL}" alt="">`);
      jack.style.opacity = String(1 - i * .24);
      const x = (at: number) => fromLeft ? -15 + 130 * at : 115 - 130 * at;
      const keyframes: Keyframe[] = [0, .5, 1].map(at => ({ transform: `translate(${x(at)}cqw, ${low - Math.sin(at * Math.PI) * 18}cqh) rotate(${(fromLeft ? 1 : -1) * at * 540}deg)` }));
      jack.animate(keyframes, { duration, delay: i * 45, easing: 'cubic-bezier(.3,.1,.7,.9)', fill: 'both' }).finished.then(() => jack.remove(), () => jack.remove());
    }
  }
}

import { WIDTH, type Rotation, type Tile } from '../../../packages/play-core';
import { FILL_LANDS, FILL_STAGGER } from './drop-motion';
import { onTuning, tuning } from './tuning';

/**
 * First-run onboarding (designer's frames, 2026-10-03): an intro written out line by line, then three
 * hands-on steps (tap to rotate, swipe sideways, swipe down), each finished by doing it. Play is then
 * free, and a last line about the red button comes and goes over it while its halo shows for a few
 * seconds. The hole guide (a demo hole the guide lays and fills under two lines, and the first-hole tip
 * before it) is switched off for now (2026-10-04); its code stays, its calls are commented out. Only two
 * "seen" marks are stored, never play.
 */
export type OnboardingPage = 'intro' | 'rotate' | 'move' | 'place' | 'hole' | 'fill' | 'restart';

export const ONBOARDING_PAGES: readonly { key: OnboardingPage; label: string }[] = [
  { key: 'intro', label: '시작 화면' },
  { key: 'rotate', label: '1. 탭 회전' },
  { key: 'move', label: '2. 옆으로 스와이프' },
  { key: 'place', label: '3. 아래로 스와이프' },
  // The hole guide is switched off for now (2026-10-04); its copy is kept below but not shown or edited.
  // { key: 'hole', label: '첫 구멍 안내 1' },
  // { key: 'fill', label: '첫 구멍 안내 2' },
  { key: 'restart', label: '4. 빨간 버튼(일시정지)' },
];

/** A blank line leaves a gap. Nothing is underlined (2026-10-04); underscores from older saved copy are dropped. */
export const ONBOARDING_DEFAULTS: Readonly<Record<OnboardingPage, string>> = {
  intro: '한 줄을 완성해도\n아무 것도 사라지지 않습니다.\n\n그저 끝없이 보도블록을 깔 뿐입니다.\n\n매 게임 세션 또한 따로\n저장되지 않습니다.\n\n쌓을 만큼 쌓고,\n그만 쌓고 싶을 때 멈추는 게임,\n\n보도보도.',
  rotate: '화면 어디든 탭하면\n보도블록이 회전합니다.',
  move: '옆으로 스와이프하면,\n이동합니다.',
  place: '아래로 스와이프하면,\n쌓입니다.',
  hole: '구멍이 발생해도,\n당황하지 마세요.',
  fill: '저희가 채워줄게요.',
  restart: '빨간 버튼을 누르면\n일시정지할 수 있어요.',
};

/** The live copy; the admin panel edits it for the planner. */
export const onboardingText: Record<OnboardingPage, string> = { ...ONBOARDING_DEFAULTS };

const SEEN_INTRO = 'bodobodo.onboarded', SEEN_HOLE = 'bodobodo.holeTip';
const seen = (key: string) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const mark = (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* Shown again next time. */ } };
/** Admin: forget both marks, so the next launch starts with the intro again. */
export function resetOnboarding() { try { localStorage.removeItem(SEEN_INTRO); localStorage.removeItem(SEEN_HOLE); } catch { /* Nothing stored. */ } }

/** The first hole: written slowly enough to watch, but a big space still finishes in a few seconds. */
const HOLE_FILL_PACE = 0.45;
/** Seconds a finished line stays before it fades, and the fade itself (matches the CSS). */
const HOLD = 1.1, FADE = 0.45;
/** The hole tip's first line stays only briefly before the second one (2026-10-03: shortened from HOLD). */
const HOLE_GAP = 0.6;
/** Seconds after the finger lifts before the gesture hint returns, if that step is still not done. */
const HINT_AGAIN = 1.4;
/** Seconds the gesture hint takes to fade in (matches the CSS); its gesture opens once it is fully shown. */
const HINT_IN = 0.9;
/** Seconds the red-button line and halo stay over free play before they fade (2026-10-04). */
const PAUSE_TIP = 5;
/** The demo hole: seconds between the guide's own moves, so each one can be followed by eye. */
const DEMO_STEP = 0.12, DEMO_BEAT = 0.35;

interface Writing { done: Promise<void>; finish: () => void; skip?: () => void; }

/** Designed breaths, in seconds, scaled by the planner's `pauseScale`. */
const PAUSE = { comma: 0.3, stop: 0.5, line: 0.4 };

/**
 * Seconds to wait after writing `char` before the next one: the even beat of the tuned speed, a slightly
 * longer beat after a space, a breath after punctuation or at the end of a line, and (when on) a small
 * random sway so it never ticks like a machine. `lineEnd` is true for the last character of a line.
 */
function beat(char: string, lineEnd: boolean, sway = true) {
  const base = 1 / Math.max(1, tuning.typingSpeed), scale = tuning.pauseScale;
  let seconds = base * (char === ' ' ? 1.25 : 1);
  if (sway && tuning.rhythmJitter) seconds *= 0.85 + Math.random() * 0.3;
  if (/[,，、]/.test(char)) seconds += PAUSE.comma * scale;
  else if (/[.!?。…]/.test(char)) seconds += PAUSE.stop * scale;
  if (lineEnd) seconds += PAUSE.line * scale;
  return seconds;
}

/**
 * Every page is uncovered by a sweep (2026-10-04), unless the planner switches to letter by letter. The
 * long intro is uncovered over `introSweepSeconds` and can be tapped ahead; the later pages are short,
 * so each comes in whole in one soft pass of `stepSweepSeconds` (a wider edge, see style.css).
 */
const sweeping = () => tuning.introSweep === 1;

/** How long writing `text` takes on average, so the first-hole tip can time its fillers to the words. */
export function writingSeconds(text: string) {
  if (sweeping()) return tuning.stepSweepSeconds;
  let seconds = 0;
  for (const line of text.split('\n')) {
    const chars = [...plain(line)];
    chars.forEach((char, i) => { seconds += beat(char, i === chars.length - 1, false); });
  }
  return seconds;
}

/**
 * Writes `text` into `target` one character at a time, each settling in like ink (see `inkSeconds`) at a
 * hand's rhythm, or with `sweep`, uncovers the whole text at once from the top down (for the long
 * intro). finish() shows the rest at once; skip() (intro only) jumps ahead one stop at a time.
 *
 * Skip stops: the text's paragraphs (split by blank lines) are taken two at a time, and the last
 * paragraph is never skipped. For the intro that is "…깔 뿐입니다." then "…멈추는 게임,", after which
 * "보도보도." and the start button always play out.
 */
function write(target: HTMLElement, text: string, whole = true, sweep = sweeping()): Writing {
  target.replaceChildren(); target.classList.remove('leaving', 'slow'); target.classList.toggle('sweep', sweep); target.classList.toggle('whole', sweep && whole);
  target.style.removeProperty('--mask-y');
  target.style.setProperty('--ink', `${tuning.inkSeconds}s`);
  const chars: { span: HTMLElement; after: (sway: boolean) => number }[] = [];
  // The last character index and the last line element of every paragraph.
  const paragraphs: { lastChar: number; lastLine: HTMLElement }[] = [];
  let open = false;
  for (const raw of text.split('\n')) {
    const line = document.createElement('span'); line.className = 'line';
    const content = plain(raw);
    if (!content) { line.innerHTML = '&nbsp;'; open = false; }
    else {
      if (sweep) line.textContent = content;
      else {
        const letters = [...content];
        letters.forEach((char, i) => {
          const span = document.createElement('span'); span.className = 'ch'; span.textContent = char; line.append(span);
          chars.push({ span, after: sway => beat(char, i === letters.length - 1, sway) });
        });
      }
      if (!open) paragraphs.push({ lastChar: -1, lastLine: line });
      open = true;
      const paragraph = paragraphs[paragraphs.length - 1];
      paragraph.lastChar = chars.length - 1; paragraph.lastLine = line;
    }
    target.append(line);
  }
  // Every second paragraph ends a stop, the last paragraph excluded.
  const stops = paragraphs.slice(0, -1).filter((_, i) => i % 2 === 1);
  return sweep ? sweepAll(target, stops.map(stop => stop.lastLine), Math.max(0.1, whole ? tuning.stepSweepSeconds : tuning.introSweepSeconds)) : typeChars(chars, stops.map(stop => stop.lastChar));
}

function typeChars(chars: { span: HTMLElement; after: (sway: boolean) => number }[], stops: number[]): Writing {
  let index = 0, timer = 0, resolve!: () => void;
  const done = new Promise<void>(r => { resolve = r; });
  const step = () => {
    if (index >= chars.length) { resolve(); return; }
    const char = chars[index++];
    char.span.classList.add('on');
    timer = window.setTimeout(step, char.after(true) * 1000);
  };
  step();
  return {
    done,
    finish: () => { clearTimeout(timer); for (; index < chars.length; index++) chars[index].span.classList.add('on'); resolve(); },
    skip: () => {
      const stop = stops.find(last => last >= index);
      if (stop === undefined) return;
      clearTimeout(timer);
      for (; index <= stop; index++) chars[index].span.classList.add('on');
      // Writing goes on from the next paragraph after the breath that ends this one.
      timer = window.setTimeout(step, chars[stop].after(false) * 1000);
    },
  };
}

/**
 * The whole text is uncovered in one pass, a soft edge travelling from its top to its bottom at an even
 * pace. The mask is 2.25x the text's height with its edge at 44.4-55.6%, so at progress t its fully
 * shown part reaches 1.25t - 0.25 of the text's height.
 */
function sweepAll(target: HTMLElement, stops: HTMLElement[], seconds: number): Writing {
  let progress = 0, last = performance.now(), frame = 0, resolve!: () => void;
  const done = new Promise<void>(r => { resolve = r; });
  const show = () => target.style.setProperty('--mask-y', `${(1 - progress) * 100}%`);
  const tick = (now: number) => {
    progress = Math.min(1, progress + (now - last) / 1000 / seconds); last = now;
    show();
    if (progress < 1) frame = requestAnimationFrame(tick); else resolve();
  };
  show(); frame = requestAnimationFrame(tick);
  /** Progress at which everything down to the bottom of `line` is fully shown. */
  const reach = (line: HTMLElement) => {
    const box = target.getBoundingClientRect(), bottom = line.getBoundingClientRect().bottom;
    return Math.min(1, ((bottom - box.top) / Math.max(1, box.height) + 0.25) / 1.25);
  };
  return {
    done,
    finish: () => { cancelAnimationFrame(frame); progress = 1; show(); resolve(); },
    skip: () => {
      const next = stops.map(reach).find(at => at > progress + 0.001);
      if (next !== undefined) { progress = next; show(); }
    },
  };
}

/** Older saved copy wrapped a line in underscores to underline it; the marks are dropped now. */
function plain(line: string) { return line.replace(/^_(.*)_$/, '$1'); }

const wait = (seconds: number) => new Promise<void>(resolve => setTimeout(resolve, seconds * 1000));

export interface OnboardingScene { conceal: boolean; holdFall: boolean; readonly activeScreen?: { x: number; y: number; cell: number }; }
/** The game's controls, for the demo hole the guide lays itself. */
export interface OnboardingPlayer {
  /** Where an upright block would land in each column. */
  heights(): number[];
  column(): number;
  rotation(): Rotation;
  aim(column: number, rotation: Rotation): void;
  /** Drops the active block; resolves once it is placed (false if it could not drop). */
  drop(): Promise<boolean>;
}
type Step = 'intro' | 'rotate' | 'move' | 'place' | 'hole' | 'restart' | 'done';
export type Gesture = 'rotate' | 'move' | 'place';

/**
 * The demo hole's moves, the app icon's pinwheel (2026-10-04): four pavers around one white 1×1, on a
 * flat run of three columns nearest the middle. A flat block along the bottom, an upright one on the
 * right, an upright one on the left resting on the flat block, and a flat one across the top resting on
 * the right one; that last block seals the middle cell. Undefined when no three columns are level (the
 * demo is then left out).
 */
function demoMoves(heights: number[]): [number, Rotation][] | undefined {
  const c = Array.from({ length: WIDTH - 2 }, (_, c) => c)
    .filter(c => heights[c] === heights[c + 1] && heights[c] === heights[c + 2])
    .sort((a, b) => Math.abs(a + 1 - (WIDTH - 1) / 2) - Math.abs(b + 1 - (WIDTH - 1) / 2))[0];
  return c === undefined ? undefined : [[c, 0], [c + 2, 1], [c, 1], [c + 1, 0]];
}

export class Onboarding {
  private step: Step = seen(SEEN_INTRO) ? 'done' : 'intro';
  private holeSeen = seen(SEEN_HOLE);
  private holeRunning = false;
  private hint: HTMLElement;
  private hintStep?: 'rotate' | 'move' | 'place' | 'restart';
  private hintTimer = 0;
  /** Tutorial pacing: a step's own gesture waits while one line goes and the next is written, plus a short beat. */
  private settling = false;
  /**
   * Gestures the tutorial has opened. Each opens when its step is ready (line written, then the round
   * hint fully shown) and stays open, so earlier ones keep working while the next line is written: rotate, then rotate and
   * move, then everything.
   */
  private unlocked = new Set<Gesture>();
  /** The demo's last block is on its way: its fillers are laid slowly, taking `fillSeconds`. */
  private sealing = false;
  private fillSeconds = 0;
  /** Set by the game: the controls the demo hole uses. */
  player?: OnboardingPlayer;
  /** Bumped to abandon an unfinished sequence (a new step, or the hole tip cut short). */
  private run = 0;
  private writing?: Writing;
  private root: HTMLElement;
  private text: HTMLElement;
  private start: HTMLButtonElement;

  constructor(parent: HTMLElement, private scene: () => OnboardingScene | undefined, private changed: () => void) {
    this.root = document.createElement('div'); this.root.id = 'onboarding'; this.root.setAttribute('aria-live', 'polite');
    this.text = document.createElement('p'); this.text.className = 'onboarding-text';
    this.start = document.createElement('button'); this.start.id = 'onboarding-start'; this.start.type = 'button'; this.start.textContent = '시작하기';
    this.root.append(this.text, this.start); parent.append(this.root);
    // The gesture hint at the bottom centre: a soft fingertip with a trailing wake, no guide behind it (see style.css).
    this.hint = document.createElement('div'); this.hint.id = 'onboarding-hint'; this.hint.setAttribute('aria-hidden', 'true');
    this.hint.innerHTML = '<span class="chevron left"></span><span class="chevron right"></span><span class="chevron down"></span><span class="ring"></span><span class="ring late"></span><span class="wake"></span><span class="finger"></span>';
    parent.append(this.hint);
    onTuning(({ onboardingSize, onboardingPhoneScale, gestureHint }) => {
      this.root.style.setProperty('--onboarding-scale', String(onboardingSize));
      this.root.style.setProperty('--onboarding-phone', String(onboardingPhoneScale));
      if (!gestureHint) this.hideHint(); else if (this.hintStep && !this.hint.classList.contains('show')) this.showHint();
    });
    // A finger on the screen hides the hint; if the step is still not done, it comes back a little later.
    // The red-button halo is away from the finger and only stays a few seconds, so it is left alone.
    parent.addEventListener('pointerdown', () => { if (this.hintStep === 'restart') return; clearTimeout(this.hintTimer); this.hint.classList.remove('show'); }, true);
    parent.addEventListener('pointerup', () => {
      if (this.hintStep === 'restart') return;
      clearTimeout(this.hintTimer);
      if (this.hintStep) this.hintTimer = window.setTimeout(() => this.showHint(), HINT_AGAIN * 1000);
    }, true);
    // A tap during the intro jumps ahead one stop (two paragraphs); its last paragraph always plays out.
    // Only the intro takes touches, so nothing else in the onboarding can be skipped.
    this.root.addEventListener('pointerdown', () => { if (this.step === 'intro') this.writing?.skip?.(); });
    this.start.addEventListener('click', () => { if (this.step === 'intro') void this.next('rotate'); });
  }

  /**
   * Whether all game input is held back: the intro, the demo hole, the first-hole tip while it plays,
   * and the first tutorial line while it is written (no gesture is open yet). The red-button line never
   * holds play back.
   */
  get blocking() { return this.step === 'intro' || this.step === 'hole' || this.holeRunning || (this.settling && !this.unlocked.size); }
  /** Whether this gesture is open yet; once the tutorial's steps are done, every one is. */
  allows(gesture: Gesture) { return this.step === 'done' || this.step === 'restart' || this.unlocked.has(gesture); }
  get introShowing() { return this.step === 'intro'; }
  /** The red button stays shut through the intro and while the guide lays its demo hole. */
  get pauseLocked() { return this.step === 'intro' || this.step === 'hole'; }
  /** The red-button line is showing over play. */
  get pauseTipShowing() { return this.step === 'restart'; }

  /** Starts the intro on a first launch; otherwise nothing shows. */
  begin() { this.apply(); if (this.step === 'intro') void this.show('intro'); }

  /** Brings a scene (new or recreated after "새로 쌓기") in line with the current step. */
  apply() {
    const scene = this.scene();
    if (!scene) return;
    scene.conceal = this.step === 'intro' || this.holeRunning;
    scene.holdFall = this.step !== 'place' && this.step !== 'restart' && this.step !== 'done' || this.holeRunning || this.settling;
  }

  /** The player rotated the block or moved it sideways. */
  acted(action: 'rotate' | 'move') {
    if (action === 'rotate' && this.step === 'rotate') void this.next('move');
    else if (action === 'move' && this.step === 'move') void this.next('place');
  }

  /**
   * A block was placed with these tiles. Finishes the last hands-on step, and for the demo hole (or, on a
   * device that finished an older onboarding, the first sealed space) returns the slow pace for its
   * fillers while the lines play. The caller passes the pace to the scene.
   */
  placed(added: readonly Tile[]): { delay: number; speed: number } | undefined {
    // The hole guide is off (2026-10-04): the last hands-on step goes straight on to the red button.
    // To bring it back, go to 'hole' here and uncomment the lines below and in next() and interrupt().
    if (this.step === 'place') void this.next('restart');
    return undefined;
    // const whites = added.filter(tile => tile.white).length;
    // if (this.sealing && whites) {
    //   this.sealing = false;
    //   this.fillSeconds = (FILL_LANDS + (whites - 1) * FILL_STAGGER) / (tuning.fillSpeed * HOLE_FILL_PACE);
    //   return { delay: 0, speed: HOLE_FILL_PACE };
    // }
    // if (!whites || this.holeSeen || this.step !== 'done' || this.holeRunning) return undefined;
    // // The fillers start as the second line begins: after the first line is written, held and faded.
    // const delay = writingSeconds(onboardingText.hole) + HOLE_GAP + FADE;
    // const fillSeconds = (FILL_LANDS + (whites - 1) * FILL_STAGGER) / (tuning.fillSpeed * HOLE_FILL_PACE);
    // void this.holeTip(fillSeconds);
    // return { delay, speed: HOLE_FILL_PACE };
  }

  /**
   * Pausing or leaving the app during the hole tip ends it at once; it counts as seen. Leaving during the
   * demo hole ends it the same way and moves on to the red-button step.
   */
  interrupt() {
    // Hole guide off (2026-10-04).
    // if (this.holeRunning) this.endHole();
    // if (this.step === 'hole') { this.sealing = false; this.holeSeen = true; mark(SEEN_HOLE); void this.next('restart'); }
  }

  private async next(step: Step) {
    const run = ++this.run, from = this.step;
    this.writing?.finish(); this.start.classList.remove('ready'); this.hideHint();
    // The new step starts at once, but its gesture stays closed (and the block waits) until its line has
    // been written and a short beat has passed, so the player reads each line instead of swiping through.
    // Gestures opened by earlier steps keep working meanwhile.
    this.step = step; this.settling = step === 'rotate' || step === 'move' || step === 'place'; this.apply(); this.changed();
    // The red-button line is only a passing note over free play, so the onboarding counts as seen there.
    if (step === 'restart' || step === 'done') mark(SEEN_INTRO);
    if (this.text.childElementCount) {
      // The tutorial lines take their time to go: a slow fade that drifts up and softens (`stepFadeSeconds`).
      const slow = from === 'rotate' || from === 'move' || from === 'place' || from === 'restart', seconds = slow ? tuning.stepFadeSeconds : FADE;
      this.text.style.setProperty('--leave', `${seconds}s`);
      this.text.classList.toggle('slow', slow); this.text.classList.add('leaving');
      await wait(seconds); if (run !== this.run) return;
    }
    if (step === 'done') { this.text.replaceChildren(); this.root.classList.remove('intro'); return; }
    // Hole guide off (2026-10-04).
    // if (step === 'hole') { await this.demo(run); return; }
    await this.show(step);
    if (step === 'restart') {
      this.hintStep = step; this.showHint();
      await wait(PAUSE_TIP); if (run !== this.run) return;
      void this.next('done'); return;
    }
    await wait(tuning.stepReadySeconds); if (run !== this.run) return;
    this.settling = false; this.apply(); this.changed();
    if (step === 'rotate' || step === 'move' || step === 'place') {
      this.hintStep = step; this.showHint();
      if (tuning.gestureHint) { await wait(HINT_IN); if (run !== this.run) return; }
      this.unlocked.add(step);
    }
  }


  private async show(page: OnboardingPage) {
    const run = this.run;
    this.root.classList.toggle('intro', page === 'intro');
    this.writing = write(this.text, onboardingText[page], page !== 'intro');
    await this.writing.done;
    if (page === 'intro' && run === this.run && this.step === 'intro') this.start.classList.add('ready');
  }

  /**
   * The guide lays a few blocks itself to seal off a space while the first line is written, then the
   * last block seals it and the fillers come in slowly under the second line.
   */
  private async demo(run: number) {
    const moves = this.player && demoMoves(this.player.heights());
    if (moves) {
      const seal = moves.pop()!;
      this.writing = write(this.text, onboardingText.hole);
      for (const move of moves) if (!await this.autoPlace(move, run)) return;
      await this.writing.done; await wait(HOLE_GAP); if (run !== this.run) return;
      this.text.classList.add('leaving'); await wait(FADE); if (run !== this.run) return;
      this.sealing = true;
      if (!await this.autoPlace(seal, run)) return;
      const started = performance.now();
      this.writing = write(this.text, onboardingText.fill);
      await this.writing.done;
      await wait(Math.max(0, this.fillSeconds - (performance.now() - started) / 1000) + HOLD); if (run !== this.run) return;
      this.text.classList.add('leaving'); await wait(FADE); if (run !== this.run) return;
    }
    this.sealing = false; this.holeSeen = true; mark(SEEN_HOLE);
    this.text.replaceChildren(); void this.next('restart');
  }

  /** Turns the active block, walks it a column at a time, then drops it, slowly enough to follow. */
  private async autoPlace([column, rotation]: [number, Rotation], run: number) {
    const player = this.player!;
    if (player.rotation() !== rotation) { player.aim(player.column(), rotation); await wait(DEMO_BEAT); if (run !== this.run) return false; }
    while (player.column() !== column) {
      const from = player.column();
      player.aim(from + Math.sign(column - from), rotation);
      if (player.column() === from || player.rotation() !== rotation) return false;
      await wait(DEMO_STEP); if (run !== this.run) return false;
    }
    await wait(DEMO_BEAT); if (run !== this.run) return false;
    return await player.drop() && run === this.run;
  }

  private async holeTip(fillSeconds: number) {
    const run = ++this.run;
    this.holeRunning = true; this.apply(); this.changed();
    this.writing = write(this.text, onboardingText.hole);
    await this.writing.done; await wait(HOLE_GAP); if (run !== this.run) return;
    this.text.classList.add('leaving'); await wait(FADE); if (run !== this.run) return;
    const started = performance.now();
    this.writing = write(this.text, onboardingText.fill);
    await this.writing.done;
    // Stay until the slow fillers have seated, then a beat more.
    await wait(Math.max(0, fillSeconds - (performance.now() - started) / 1000) + HOLD); if (run !== this.run) return;
    this.text.classList.add('leaving'); await wait(FADE); if (run !== this.run) return;
    this.endHole();
  }

  /**
   * Shows the current step's gesture at the bottom centre of the board, where the thumb rests: the
   * game takes swipes anywhere, so the hint teaches the motion, not a target. Sized by the board cell.
   */
  private showHint() {
    if (!this.hintStep || !tuning.gestureHint || this.settling) return;
    // The red-button halo is sized by the button (style.css), not the board.
    const cell = this.hintStep !== 'restart' && this.scene()?.activeScreen?.cell;
    if (cell) this.hint.style.setProperty('--cell', `${cell}px`);
    this.hint.dataset.gesture = this.hintStep; this.hint.classList.add('show');
  }


  private hideHint() {
    this.hintStep = undefined; clearTimeout(this.hintTimer);
    this.hint.classList.remove('show');
  }

  private endHole() {
    this.run++; this.writing?.finish();
    this.holeRunning = false; this.holeSeen = true; mark(SEEN_HOLE);
    this.text.replaceChildren(); this.apply(); this.changed();
  }
}

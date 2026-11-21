import { tuning } from './tuning';

/**
 * The winter greeting: cut-out letters hung in a shallow arc like a garland without its string or its
 * flags, just the letters, each in a felt colour with a cream edge so it reads on dark ground and on
 * snow alike. They come down one after another in an even rhythm, rest a moment, then let go and fall
 * away; the next phrase follows in the same place. It is a brief, quiet moment over play: nothing is
 * locked, and pausing simply ends it.
 *
 * The line is set like type, not in equal boxes: each letter keeps its own width and its kerning with
 * its neighbours, with a little even tracking and a clear gap between words. Its size follows the
 * screen, and every phrase of one showing shares the size the longest of them needs.
 */
const IN_MS = 640, OUT_MS = 900, OUT_STAGGER_MS = 45, BETWEEN_MS = 260;
/** Felt colours, in turn: the pavers' red, a warm gold, and the game's green. */
const COLOURS = ['red', 'gold', 'green'] as const;
const FACE = "700 100px 'Jost','GangBuJang',sans-serif";
/**
 * In ems: space added after every letter, and added to a word space. The cream edge (0.17 em in the
 * stylesheet) reaches half its width beyond each letter, so the tracking leaves the edges of two
 * neighbours just clear of each other.
 */
const TRACKING = 0.21, WORD_GAP = 0.4;
/** The line fills this share of the screen's width, within these letter sizes in CSS pixels. */
const FILL = 0.84, MIN_SIZE = 13, MAX_SIZE = 40;
/** How far the middle of the line hangs below its ends, as a share of its length. */
const SAG = 0.075;

interface Glyph { letter: string; centre: number; width: number; }
let measurer: CanvasRenderingContext2D | null | undefined;
/** Where each letter of a phrase sits along the line, in ems, and the line's whole length. */
export function setLine(phrase: string, advance: (text: string) => number): { glyphs: Glyph[]; length: number } {
  const glyphs: Glyph[] = [];
  let extra = 0;
  for (let i = 0; i < phrase.length; i++) {
    const letter = phrase[i];
    if (letter === ' ') { extra += WORD_GAP - TRACKING; continue; }
    // Measured from the start of the phrase, so the pair's kerning is already in the position.
    const width = advance(letter), start = advance(phrase.slice(0, i + 1)) - width + extra;
    glyphs.push({ letter, centre: start + width / 2, width });
    extra += TRACKING;
  }
  const last = glyphs[glyphs.length - 1];
  return { glyphs, length: last ? last.centre + last.width / 2 : 0 };
}
function advanceOf(text: string) {
  if (measurer === undefined) { measurer = document.createElement('canvas').getContext('2d'); if (measurer) measurer.font = FACE; }
  // Without a canvas every letter counts as a little over half an em, which still sets an even line.
  return measurer ? measurer.measureText(text).width / 100 : text.length * 0.6;
}

export class Greeting {
  private element = document.createElement('div');
  private timers: number[] = [];
  private showing = false;
  private shownAt = -Infinity;
  /** The phrase hanging now and the letters' size in ems of the widest phrase of this showing. */
  private hung?: { glyphs: Glyph[]; length: number };
  private widest = 1;
  constructor(private parent: HTMLElement) {
    this.element.id = 'greeting'; this.element.setAttribute('aria-hidden', 'true');
    parent.append(this.element);
    // A turned or resized screen re-sets the line where it hangs, without starting it over.
    new ResizeObserver(() => this.arrange()).observe(parent);
  }
  get active() { return this.showing; }
  /**
   * Whether the greeting may come up on its own now: switched on, not already up, and either not seen
   * yet this run or last seen at least the planner's interval ago (0 keeps it to once a run).
   */
  get due() {
    if (this.showing || tuning.greeting !== 1) return false;
    if (this.shownAt === -Infinity) return true;
    return tuning.greetingEvery > 0 && performance.now() - this.shownAt >= tuning.greetingEvery * 60000;
  }
  /** Shows the phrases one after another. */
  show(phrases: readonly string[]) {
    if (!phrases.length) return;
    this.cancel(); this.showing = true; this.shownAt = performance.now();
    const lines = phrases.map(phrase => setLine(phrase, advanceOf));
    this.widest = Math.max(1, ...lines.map(line => line.length));
    let at = 0;
    for (const line of lines) {
      const stagger = tuning.greetingStagger * 1000;
      const hold = (line.glyphs.length - 1) * stagger + IN_MS + tuning.greetingHold * 1000;
      this.later(at, () => this.hang(line, stagger));
      this.later(at + hold, () => this.element.classList.add('out'));
      at += hold + (line.glyphs.length - 1) * OUT_STAGGER_MS + OUT_MS + BETWEEN_MS;
    }
    this.later(at, () => this.cancel());
  }
  /** Takes the greeting down at once (pause, leaving winter). */
  cancel() {
    this.timers.forEach(timer => clearTimeout(timer)); this.timers = [];
    this.element.replaceChildren(); this.element.classList.remove('out'); this.showing = false; this.hung = undefined;
  }
  private later(ms: number, run: () => void) { this.timers.push(window.setTimeout(run, ms)); }
  /** Puts one phrase up: a piece per letter, each starting its drop a beat after the one before. */
  private hang(line: { glyphs: Glyph[]; length: number }, stagger: number) {
    this.hung = line;
    this.element.classList.remove('out');
    this.element.replaceChildren(...line.glyphs.map(({ letter }, index) => {
      // The letter itself is the garland's piece; `data-letter` draws its cream edge behind it.
      const piece = document.createElement('span'); piece.className = `letter ${COLOURS[index % COLOURS.length]}`;
      piece.textContent = letter; piece.dataset.letter = letter;
      piece.style.animationDelay = `${index * stagger}ms`; piece.style.setProperty('--out', `${index * OUT_STAGGER_MS}ms`);
      return piece;
    }));
    this.arrange();
  }
  /** Sets the hanging letters along the arc for the screen as it is now. */
  private arrange() {
    const line = this.hung, width = this.parent.clientWidth;
    if (!line || !width) return;
    const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, width * FILL / this.widest));
    const length = line.length * size, sag = length * SAG;
    Array.from(this.element.children).forEach((child, index) => {
      const glyph = line.glyphs[index], piece = child as HTMLElement;
      // -1 at the left end of the line, 1 at the right; the line hangs lowest in the middle.
      const along = line.length ? glyph.centre / line.length * 2 - 1 : 0;
      // Each letter leans with the curve where it hangs, and a touch to one side or the other, as if pinned by hand.
      const lean = Math.atan(-4 * along * sag / length) * 180 / Math.PI + (index % 2 ? 1.6 : -1.6);
      piece.style.left = `${width / 2 + (glyph.centre - line.length / 2) * size - glyph.width * size / 2}px`;
      piece.style.top = `${sag * (1 - along * along)}px`;
      piece.style.width = `${glyph.width * size}px`; piece.style.fontSize = `${size}px`;
      piece.style.setProperty('--turn', `${lean.toFixed(1)}deg`);
    });
  }
}

import { WIDTH, type Rotation } from './index';

/**
 * Auto stacking: the game lays blocks by itself in a repeating pattern. It only chooses where the next
 * block is dropped (a column and an orientation); the block then falls and seals spaces exactly as a
 * player's would, so the usual rules, fillers and limits all apply.
 *
 * A pattern is an endless drop sequence that starts from a level top. On an uneven top the stacker first
 * levels it (see levelMoves), and it does so again whenever the top stops matching what its own drops
 * would have built (the player placed a block in between).
 */
export type AutoPattern = 'pinwheel';
export const AUTO_PATTERNS: readonly { key: AutoPattern; label: string }[] = [
  // The stairs and the zigzag were taken out on 2026-11-21: one pattern, switched on and off.
  { key: 'pinwheel', label: '바람개비' },
];
export interface AutoMove { x: number; rotation: Rotation; }

const lying = (x: number): AutoMove => ({ x, rotation: 0 }), upright = (x: number): AutoMove => ({ x, rotation: 1 });

/** One period of each pattern on the nine-column board, in drop order. */
const SEQUENCES: Record<AutoPattern, readonly AutoMove[]> = {
  // The app icon's pinwheel, three across: four blocks around a middle that seals into a white 1x1.
  pinwheel: [0, 3, 6].flatMap(left => [lying(left), upright(left + 2), upright(left), lying(left + 1)]),
};

/** Drops a block on a skyline of column tops and returns the row it lands on. */
export function settle(tops: number[], move: AutoMove) {
  if (move.rotation % 2) { const y = tops[move.x]; tops[move.x] = y + 2; return y; }
  const y = Math.max(tops[move.x], tops[move.x + 1]);
  tops[move.x] = tops[move.x + 1] = y + 1;
  return y;
}

/**
 * Drops that bring any skyline to one level. With L the level of the lid's underside: every column is
 * raised with upright blocks to L or L - 1, a pair of neighbours both at L - 1 takes a lying block, and
 * then a lid of four lying blocks over columns 0-7 seals what is left under it (those gaps fill with
 * white). Column 8 is brought to L - 1 so one last upright block ends level with the lid, at L + 1.
 */
export function levelMoves(tops: readonly number[]): AutoMove[] {
  const moves: AutoMove[] = [], last = WIDTH - 1;
  const highest = Math.max(...tops);
  const level = (highest - tops[last]) % 2 === 0 ? highest + 1 : highest;
  for (let top = tops[last]; top < level - 1; top += 2) moves.push(upright(last));
  for (let left = 0; left < last; left += 2) {
    const raised = [left, left + 1].map(column => {
      let top = tops[column];
      for (; top <= level - 2; top += 2) moves.push(upright(column));
      return top;
    });
    if (raised[0] === level - 1 && raised[1] === level - 1) moves.push(lying(left));
    moves.push(lying(left));
  }
  moves.push(upright(last));
  return moves;
}

export class AutoStacker {
  private queue: AutoMove[] = [];
  /** The level the pattern started from, and the skyline its drops have built above it since. */
  private base?: number;
  private built: number[] = [];
  private index = 0;
  constructor(readonly pattern: AutoPattern) {}
  /** True while the stacker is still levelling the top before (re)starting its pattern. */
  get levelling() { return this.queue.length > 0; }
  /**
   * The next drop, given each column's current top (where an upright block would land). The caller is
   * expected to make that drop before asking again.
   */
  next(tops: readonly number[]): AutoMove {
    if (this.queue.length) return this.queue.shift()!;
    const base = this.base;
    if (base === undefined || !tops.every((top, column) => top === base + this.built[column])) {
      if (!tops.every(top => top === tops[0])) { this.base = undefined; this.queue = levelMoves(tops); return this.queue.shift()!; }
      this.base = tops[0]; this.built = Array<number>(WIDTH).fill(0); this.index = 0;
    }
    const sequence = SEQUENCES[this.pattern], move = sequence[this.index++ % sequence.length];
    settle(this.built, move);
    return move;
  }
}

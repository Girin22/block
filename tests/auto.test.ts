import { describe, expect, it } from 'vitest';
import { Pavement, WIDTH } from '../packages/play-core';
import { AUTO_PATTERNS, AutoStacker, levelMoves, settle } from '../packages/play-core/auto';

const tops = (board: Pavement) => Array.from({ length: WIDTH }, (_, column) => board.landing(column, 1).y);
function random(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
}
/** Cells no tile covers below the lowest column top: holes the pattern left behind. */
function holes(board: Pavement) {
  const covered = new Set<number>();
  for (const tile of board.tiles) for (let x = tile.x; x < tile.x + tile.w; x++) for (let y = tile.y; y < tile.y + tile.h; y++) covered.add(y * WIDTH + x);
  const floor = Math.min(...tops(board));
  let missing = 0;
  for (let y = 0; y < floor; y++) for (let x = 0; x < WIDTH; x++) if (!covered.has(y * WIDTH + x)) missing++;
  return missing;
}
function run(board: Pavement, stacker: AutoStacker, moves: number) {
  for (let i = 0; i < moves; i++) { const move = stacker.next(tops(board)); board.drop(move.x, move.rotation); }
}

describe('auto stacking', () => {
  for (const { key } of AUTO_PATTERNS) {
    it(`${key} paves a fresh board without leaving holes, mostly with placed blocks`, () => {
      const board = new Pavement(), stacker = new AutoStacker(key);
      run(board, stacker, 600);
      expect(stacker.levelling).toBe(false);
      expect(holes(board)).toBe(0);
      expect(board.greens).toBe(600);
      // The fillers are only the pattern's own gaps: single cells.
      const whites = board.tiles.filter(tile => tile.white);
      expect(whites.every(tile => tile.h === 1 && tile.w === 1)).toBe(true);
      expect(whites.length / board.tiles.length).toBeLessThan(0.21);
      expect(Math.max(...tops(board)) - Math.min(...tops(board))).toBeLessThanOrEqual(3);
    });
    it(`${key} levels a board the player left uneven, then carries on`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const board = new Pavement(), next = random(seed);
        for (let i = 0; i < 5 + seed; i++) { const rotation = next() < 0.5 ? 0 : 1; board.drop(Math.floor(next() * (WIDTH - (rotation ? 0 : 1))), rotation); }
        const stacker = new AutoStacker(key);
        run(board, stacker, 300);
        expect(holes(board)).toBe(0);
        // A block the player drops in between is absorbed the same way.
        board.drop(Math.floor(next() * WIDTH), 1);
        run(board, stacker, 300);
        expect(holes(board)).toBe(0);
      }
    });
  }
  it('levels any skyline to one height', () => {
    const next = random(7);
    for (let round = 0; round < 200; round++) {
      const skyline = Array.from({ length: WIDTH }, () => Math.floor(next() * 9));
      for (const move of levelMoves(skyline)) settle(skyline, move);
      expect(new Set(skyline).size).toBe(1);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { Pavement, size, WIDTH, type Rotation } from '../packages/play-core';

/** Reference check, independent of Pavement: which empty cells can no longer reach the sky. */
function sealedCells(board: Pavement, tiles = board.tiles) {
  const filled = new Set<string>();
  for (const tile of tiles) for (let x = tile.x; x < tile.x + tile.w; x++) for (let y = tile.y; y < tile.y + tile.h; y++) filled.add(`${x},${y}`);
  const open = new Set<string>(), queue: [number, number][] = [];
  for (let x = 0; x < WIDTH; x++) { open.add(`${x},${board.height}`); queue.push([x, board.height]); }
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const key = `${nx},${ny}`;
      if (nx < 0 || nx >= WIDTH || ny < 0 || ny > board.height || filled.has(key) || open.has(key)) continue;
      open.add(key); queue.push([nx, ny]);
    }
  }
  const sealed: string[] = [];
  for (let y = 0; y < board.height; y++) for (let x = 0; x < WIDTH; x++) if (!filled.has(`${x},${y}`) && !open.has(`${x},${y}`)) sealed.push(`${x},${y}`);
  return sealed;
}

function cellsOf(tiles: { x: number; y: number; w: number; h: number }[]) {
  const cells: string[] = [];
  for (const tile of tiles) for (let x = tile.x; x < tile.x + tile.w; x++) for (let y = tile.y; y < tile.y + tile.h; y++) cells.push(`${x},${y}`);
  return cells.sort();
}

/** A small deterministic random source so failures reproduce. */
function random(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
}

/** Plays like a person: drops from above, slides sideways at different heights, tucks under overhangs. */
function playRandomly(seed: number, blocks: number, check: (board: Pavement, added: ReturnType<Pavement['place']>, sealedBefore: string[]) => void) {
  const next = random(seed), board = new Pavement();
  for (let i = 0; i < blocks; i++) {
    const rotation = (Math.floor(next() * 4)) as Rotation;
    let x = Math.floor(next() * (WIDTH - size(rotation).w + 1)), y = board.height + 2;
    for (let step = 0; step < 6; step++) {
      const lowest = board.landingFrom(x, y, rotation).y;
      y = lowest + Math.floor(next() * (y - lowest + 1));
      x = board.moveSide(x, y, Math.floor(next() * WIDTH), rotation);
    }
    const landing = board.landingFrom(x, y, rotation);
    const sealedBefore = sealedCells(board);
    const added = board.place(landing.x, landing.y, rotation);
    check(board, added, sealedBefore);
  }
}

describe('filling sealed spaces', () => {
  it('fills exactly the spaces the new block sealed, never part of an open one', () => {
    for (let seed = 1; seed <= 300; seed++) {
      playRandomly(seed, 60, (board, added, sealedBefore) => {
        expect(sealedBefore, `seed ${seed}: a sealed space was already left empty`).toEqual([]);
        // What the green block alone sealed off, judged without the fillers it triggered.
        const whites = added.filter(tile => tile.white);
        const sealedByBlock = sealedCells(board, board.tiles.filter(tile => !whites.includes(tile))).sort();
        expect(cellsOf(whites), `seed ${seed}: fillers differ from the sealed space`).toEqual(sealedByBlock);
      });
    }
  });
});

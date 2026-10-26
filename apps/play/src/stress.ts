import { MAX_SESSION_BLOCKS, Pavement, WIDTH } from '../../../packages/play-core';

/** Deterministic export/load fixture, not a simulation of human play. */
export function stressBoard(count: number, tower = false) {
  const board = new Pavement();
  for (let i = 0; i < Math.min(MAX_SESSION_BLOCKS, Math.max(0, Math.floor(count))); i++) {
    board.drop(tower ? 2 : (i % Math.floor(WIDTH / 2)) * 2, 0);
    board.advanceFloor(Math.max(0, board.height - 20));
  }
  return board;
}

/** Store-art fixture: `tiers` rows of the app icon's pinwheel, three across, each sealing a white 1x1. */
export function pinwheelBoard(tiers: number) {
  const board = new Pavement();
  for (let tier = 0; tier < tiers; tier++) {
    for (let left = 0; left < WIDTH; left += 3) {
      board.drop(left, 0); // lying, along the bottom
      board.drop(left + 2, 1); // standing, at the right
      board.drop(left, 1); // standing, at the left on the first
      board.drop(left + 1, 0); // lying across the top, which seals the middle
    }
  }
  return board;
}

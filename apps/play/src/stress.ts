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

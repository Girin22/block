import { expect, it } from 'vitest';
import { stressBoard } from '../apps/play/src/stress';
import { receiptSVG } from '../apps/play/src/export';

it('seeds a long board that remains playable and exports the complete history', () => {
  const board = stressBoard(1200);
  expect(board.tiles).toHaveLength(1200);
  expect(board.height).toBe(300);
  expect(board.drop(0, 0)[0].y).toBe(300);
  const svg = receiptSVG(board, new Date(2026, 8, 7));
  expect(svg).toContain('1201조각');
  expect(svg.match(/<use /g)).toHaveLength(1201);
});

it('supports a tall worst-case layout without dropping old export records', () => {
  const board = stressBoard(3600, true);
  expect(board.height).toBe(3600);
  expect(board.tiles).toHaveLength(3600);
  expect(board.drop(2, 0)[0].y).toBe(3600);
});

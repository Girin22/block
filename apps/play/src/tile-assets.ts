import horizontal from '../../../assets/images/horizontal.png?inline';
import vertical from '../../../assets/images/vertical.png?inline';
import center from '../../../assets/images/center.png?inline';
import whiteHorizontal from '../../../assets/images/white_horizontal.png?inline';
import whiteVertical from '../../../assets/images/white_vertical.png?inline';

// The artwork includes the interlocking edge beyond its logical grid footprint.
export const TILE_BLEED = 0.18;
export const tileImages = { horizontal, vertical, center, whiteHorizontal, whiteVertical };
export type TileImage = keyof typeof tileImages;
/** The artwork a tile uses. Every white size has its own image; the green block is one shape rotated. */
export function tileImage(tile: { white: boolean; w: number; h: number }): TileImage {
  if (!tile.white) return tile.h === 2 ? 'vertical' : 'horizontal';
  return tile.w === 2 ? 'whiteHorizontal' : tile.h === 2 ? 'whiteVertical' : 'center';
}

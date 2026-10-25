import horizontal from '../../../assets/images/horizontal.png?inline';
import vertical from '../../../assets/images/vertical.png?inline';
import center from '../../../assets/images/center.png?inline';
import whiteHorizontal from '../../../assets/images/white_horizontal.png?inline';
import whiteVertical from '../../../assets/images/white_vertical.png?inline';

import halloweenHorizontal from '../../../assets/images/halloween/horizontal.png?url';
import halloweenVertical from '../../../assets/images/halloween/vertical.png?url';
import halloweenCenter from '../../../assets/images/halloween/center.png?url';
import halloweenWhiteHorizontal from '../../../assets/images/halloween/white_horizontal.png?url';
import halloweenWhiteVertical from '../../../assets/images/halloween/white_vertical.png?url';

// The artwork includes the interlocking edge beyond its logical grid footprint.
export const TILE_BLEED = 0.18;
export const tileImages = { horizontal, vertical, center, whiteHorizontal, whiteVertical };
export type TileImage = keyof typeof tileImages;
/**
 * Event environments dress the board in their own pavers, same outlines: Halloween lays cobwebbed
 * stone, wraps the two-cell fillers in bandages and seats a jack-o'-lantern in each single gap. Only the
 * screen changes; the export keeps the everyday pavers. Loaded by URL, so they cost nothing until chosen.
 */
export type TileSkin = 'everyday' | 'halloween';
export const tileSkins: Record<TileSkin, Record<TileImage, string>> = {
  everyday: tileImages,
  halloween: { horizontal: halloweenHorizontal, vertical: halloweenVertical, center: halloweenCenter, whiteHorizontal: halloweenWhiteHorizontal, whiteVertical: halloweenWhiteVertical },
};
/** The artwork a tile uses. Every white size has its own image; the green block is one shape rotated. */
export function tileImage(tile: { white: boolean; w: number; h: number }): TileImage {
  if (!tile.white) return tile.h === 2 ? 'vertical' : 'horizontal';
  return tile.w === 2 ? 'whiteHorizontal' : tile.h === 2 ? 'whiteVertical' : 'center';
}

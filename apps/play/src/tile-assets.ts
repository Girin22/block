import horizontal from '../../../assets/images/horizontal.png?inline';
import vertical from '../../../assets/images/vertical.png?inline';
import center from '../../../assets/images/center.png?inline';
import whiteHorizontal from '../../../assets/images/white_horizontal.png?inline';
import whiteVertical from '../../../assets/images/white_vertical.png?inline';

import { pickPaver } from './halloween';

// The artwork includes the interlocking edge beyond its logical grid footprint.
export const TILE_BLEED = 0.18;
export const tileImages = { horizontal, vertical, center, whiteHorizontal, whiteVertical };
export type TileImage = keyof typeof tileImages;
/**
 * Event environments dress the board in their own pavers, same outlines (halloween.ts picks one per
 * tile by weight). Only the screen changes; the export keeps the everyday pavers.
 */
export type TileSkin = 'everyday' | 'halloween';
/** A tile's picture: the image, and whether an upright one (an added image without a lying picture) is turned a quarter clockwise to lie flat. */
export interface Artwork { url: string; turn: boolean; }
export function tileArtwork(tile: { id: number; white: boolean; w: number; h: number }, skin: TileSkin): Artwork {
  if (skin === 'halloween') {
    const paver = pickPaver(!tile.white ? 'block' : tile.w + tile.h === 2 ? 'single' : 'double', tile.id);
    if (paver && tile.w === 2 && paver.lying) return { url: paver.lying, turn: false };
    if (paver) return { url: paver.url, turn: tile.w === 2 };
  }
  return { url: tileImages[tileImage(tile)], turn: false };
}
/** The artwork a tile uses. Every white size has its own image; the green block is one shape rotated. */
export function tileImage(tile: { white: boolean; w: number; h: number }): TileImage {
  if (!tile.white) return tile.h === 2 ? 'vertical' : 'horizontal';
  return tile.w === 2 ? 'whiteHorizontal' : tile.h === 2 ? 'whiteVertical' : 'center';
}

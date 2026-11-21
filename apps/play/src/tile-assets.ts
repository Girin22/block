import horizontal from '../../../assets/images/horizontal.png?inline';
import vertical from '../../../assets/images/vertical.png?inline';
import center from '../../../assets/images/center.png?inline';
import whiteHorizontal from '../../../assets/images/white_horizontal.png?inline';
import whiteVertical from '../../../assets/images/white_vertical.png?inline';
import christmasRed from '../../../assets/images/christmas/red.png?url';
import christmasWhite from '../../../assets/images/christmas/white.png?url';
import christmasSingle from '../../../assets/images/christmas/white-single.png?url';

import { leadPaver, pickPaver } from './halloween';
import { duckArt } from './duck';
import { giftPicture } from './gift';

// The artwork includes the interlocking edge beyond its logical grid footprint.
export const TILE_BLEED = 0.18;
export const tileImages = { horizontal, vertical, center, whiteHorizontal, whiteVertical };
export type TileImage = keyof typeof tileImages;
/**
 * Event environments dress the board in their own pavers, same outlines (halloween.ts picks one per
 * tile by weight; Christmas has one per slot). The saved image shows what is on screen.
 */
export type TileSkin = 'everyday' | 'halloween' | 'christmas';
export const TILE_SKINS: readonly { key: TileSkin; label: string }[] = [
  { key: 'everyday', label: '기본' }, { key: 'halloween', label: '할로윈' }, { key: 'christmas', label: '크리스마스' },
];
/** What a tile is on the board: a block the player placed, or a filler of one or two cells. */
export type TileSlot = 'block' | 'single' | 'double';
export const TILE_SLOTS: readonly { key: TileSlot; label: string }[] = [
  { key: 'block', label: '놓는 블록' }, { key: 'single', label: '1칸 채움' }, { key: 'double', label: '2칸 채움' },
];
export const slotOf = (tile: { white: boolean; w: number; h: number }): TileSlot => !tile.white ? 'block' : tile.w + tile.h === 2 ? 'single' : 'double';
/** Christmas (2026-11): red blocks, white fillers, on the everyday outlines. Drawn upright only. */
const CHRISTMAS: Record<TileSlot, string> = { block: christmasRed, single: christmasSingle, double: christmasWhite };

/**
 * A picture a planner swapped into a slot (preview page). `url` is the upright one (or the square);
 * `lying` is its lying picture, already shaded for lying flat (lying.ts).
 */
export interface TileOverride { url: string; lying?: string; }
const overrides: Record<TileSkin, Partial<Record<TileSlot, TileOverride>>> = { everyday: {}, halloween: {}, christmas: {} };
const overrideListeners = new Set<() => void>();
export function tileOverride(skin: TileSkin, slot: TileSlot) { return overrides[skin][slot]; }
export function setTileOverride(skin: TileSkin, slot: TileSlot, value?: TileOverride) {
  if (value) overrides[skin][slot] = value; else delete overrides[skin][slot];
  overrideListeners.forEach(listener => listener());
}
export function onTileOverrides(listener: () => void) { overrideListeners.add(listener); return () => overrideListeners.delete(listener); }
export const hasTileOverrides = (skin: TileSkin) => Object.keys(overrides[skin]).length > 0;

/**
 * A tile's picture: the image, and whether an upright one without a lying picture of its own is turned
 * a quarter clockwise and re-shaded to lie flat (lying.ts).
 */
export interface Artwork { url: string; turn: boolean; }
export function tileArtwork(tile: { id: number; white: boolean; w: number; h: number }, skin: TileSkin): Artwork {
  const slot = slotOf(tile), flat = tile.w === 2;
  // Christmas snow ducks: a one-cell filler is a duck made of snow, or still an open gap (duck.ts).
  const duck = skin === 'christmas' && slot === 'single' && tile.white ? duckArt(tile.id) : undefined;
  if (duck) return { url: duck, turn: false };
  // Christmas gift blocks: a one-cell filler wears its wrapping, or its ornament once opened (gift.ts).
  const gift = skin === 'christmas' && slot === 'single' ? giftPicture(tile.id) : undefined;
  if (gift) return { url: gift, turn: false };
  const own = overrides[skin][slot];
  if (own) return flat && own.lying ? { url: own.lying, turn: false } : { url: own.url, turn: flat };
  if (skin === 'christmas') return { url: CHRISTMAS[slot], turn: flat };
  if (skin === 'halloween') {
    const paver = pickPaver(slot, tile.id);
    if (paver && flat && paver.lying) return { url: paver.lying, turn: false };
    if (paver) return { url: paver.url, turn: flat };
  }
  return { url: tileImages[tileImage(tile)], turn: false };
}
/** The slot's upright picture in a skin (an event's most likely paver), for counters and panels. */
export function slotPicture(slot: TileSlot, skin: TileSkin): string {
  const own = overrides[skin][slot];
  if (own) return own.url;
  if (skin === 'christmas') return CHRISTMAS[slot];
  const everyday = slot === 'block' ? tileImages.vertical : slot === 'single' ? tileImages.center : tileImages.whiteVertical;
  return (skin === 'halloween' && leadPaver(slot)?.url) || everyday;
}
/** The artwork a tile uses. Every white size has its own image; the green block is one shape rotated. */
export function tileImage(tile: { white: boolean; w: number; h: number }): TileImage {
  if (!tile.white) return tile.h === 2 ? 'vertical' : 'horizontal';
  return tile.w === 2 ? 'whiteHorizontal' : tile.h === 2 ? 'whiteVertical' : 'center';
}

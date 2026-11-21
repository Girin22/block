import { AUTO_PATTERNS, type AutoPattern } from '../../../packages/play-core/auto';
import type { Environment } from './ambience';
import { loadPicture, lyingCanvas, uprightCanvas } from './lying';
import { setTileOverride, slotPicture, TILE_SKINS, TILE_SLOTS, tileArtwork, tileOverride, type TileOverride, type TileSkin, type TileSlot } from './tile-assets';
import { restoreSavedTuning, saveTuning, setTuning, tuning, TUNING_DEFAULTS, TUNING_FIELDS, TUNING_GROUPS, type Tuning } from './tuning';

/**
 * Preview builds only (VITE_PREVIEW=1): the planner's review page frames the game and edits it from
 * outside through `window.bodobodoPreview`. Nothing here ships in the app or the public web build.
 * Edits are kept on that browser only, like the admin panel's.
 */
export type PreviewCue = 'glitch' | 'bats' | 'dog' | 'greeting';
export interface PreviewHost {
  environments: readonly { id: Environment; label: string; event?: boolean }[];
  eventShown(environment: Environment): boolean;
  showEvent(environment: Environment, on: boolean): void;
  environment(): Environment;
  chooseEnvironment(environment: Environment): void;
  auto(): AutoPattern | undefined;
  chooseAuto(pattern?: AutoPattern): void;
  cue(name: PreviewCue): void;
}

const TILES_KEY = 'blockstep.tiles.v1';
type SavedTiles = Partial<Record<TileSkin, Partial<Record<TileSlot, TileOverride>>>>;
function savedTiles(): SavedTiles { try { return JSON.parse(localStorage.getItem(TILES_KEY) ?? '{}') as SavedTiles; } catch { return {}; } }
function saveTile(skin: TileSkin, slot: TileSlot, value?: TileOverride) {
  const saved = savedTiles(), slots = saved[skin] ??= {};
  if (value) slots[slot] = value; else delete slots[slot];
  try { localStorage.setItem(TILES_KEY, JSON.stringify(saved)); return true; } catch { return false; }
}

/** The picture no larger than `limit` on its long side, so a few of them fit in the browser's storage. */
function fitted(picture: HTMLImageElement, limit: number) {
  const scale = Math.min(1, limit / Math.max(picture.naturalWidth, picture.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
  const context = canvas.getContext('2d')!; context.imageSmoothingQuality = 'high';
  context.drawImage(picture, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * A picture for a slot, from a file. A two-cell picture may be drawn upright or lying: either way the
 * other one is made from it, turned and re-shaded so the stone's side sits where the everyday paver's
 * does in each orientation (lying.ts).
 */
async function overrideFrom(file: Blob, slot: TileSlot): Promise<TileOverride> {
  const source = URL.createObjectURL(file);
  try {
    const picture = fitted(await loadPicture(source), slot === 'single' ? 350 : 646);
    if (slot === 'single') return { url: picture.toDataURL('image/png') };
    if (picture.width > picture.height) return { url: (await uprightCanvas(picture)).toDataURL('image/png'), lying: picture.toDataURL('image/png') };
    return { url: picture.toDataURL('image/png'), lying: (await lyingCanvas(picture)).toDataURL('image/png') };
  } finally { URL.revokeObjectURL(source); }
}

export function installPreview(host: PreviewHost) {
  restoreSavedTuning();
  const saved = savedTiles();
  for (const { key: skin } of TILE_SKINS) for (const { key: slot } of TILE_SLOTS) { const value = saved[skin]?.[slot]; if (value?.url) setTileOverride(skin, slot, value); }
  const bridge = {
    tuning: {
      groups: TUNING_GROUPS, fields: TUNING_FIELDS, defaults: TUNING_DEFAULTS,
      values: (): Tuning => ({ ...tuning }),
      set(key: keyof Tuning, value: number) { setTuning(key, value); saveTuning(); },
      reset(keys: readonly (keyof Tuning)[]) { for (const key of keys) setTuning(key, TUNING_DEFAULTS[key]); saveTuning(); },
    },
    environments: host.environments, environment: host.environment, chooseEnvironment: host.chooseEnvironment,
    // Event environments can be taken out of the picker, to judge the pause screen's room without them.
    events: { list: host.environments.filter(({ event }) => event), shown: host.eventShown, set: host.showEvent },
    auto: { patterns: AUTO_PATTERNS, get: host.auto, set: host.chooseAuto },
    tiles: {
      skins: TILE_SKINS, slots: TILE_SLOTS,
      changed: (skin: TileSkin, slot: TileSlot) => !!tileOverride(skin, slot),
      /** The slot's upright picture and, for a two-cell slot, the lying one exactly as the board draws it. */
      async pictures(skin: TileSkin, slot: TileSlot) {
        const upright = slotPicture(slot, skin);
        if (slot === 'single') return { upright };
        // Tile id 1 stands for the slot; an event with several pavers shows its first.
        const art = tileArtwork({ id: 1, white: slot !== 'block', w: 2, h: 1 }, skin);
        const lying = art.turn ? (await lyingCanvas(await loadPicture(art.url))).toDataURL('image/png') : art.url;
        return { upright: tileOverride(skin, slot) ? upright : art.turn ? art.url : upright, lying };
      },
      /** Swaps a picture in from a file. Resolves false if it shows but could not be kept (storage full). */
      async replace(skin: TileSkin, slot: TileSlot, file: Blob) {
        const value = await overrideFrom(file, slot);
        setTileOverride(skin, slot, value);
        return saveTile(skin, slot, value);
      },
      restore(skin: TileSkin, slot: TileSlot) { setTileOverride(skin, slot); saveTile(skin, slot); },
    },
    cue: host.cue,
  };
  (window as unknown as { bodobodoPreview: typeof bridge }).bodobodoPreview = bridge;
}

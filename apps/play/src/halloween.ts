import stone from '../../../assets/images/halloween/stone.png?url';
import ghostDomino from '../../../assets/images/halloween/ghost-domino.png?url';
import purple from '../../../assets/images/halloween/purple.png?url';
import orange from '../../../assets/images/halloween/orange.png?url';
import mummy from '../../../assets/images/halloween/mummy.png?url';
import pumpkin from '../../../assets/images/halloween/pumpkin.png?url';
import witch from '../../../assets/images/halloween/witch.png?url';
import ghost from '../../../assets/images/halloween/ghost.png?url';
// Lying two-cell pictures, shaded with the stone's side along the bottom like horizontal.png
// (scripts/make-halloween-lying.py).
import stoneLying from '../../../assets/images/halloween/stone-lying.png?url';
import ghostDominoLying from '../../../assets/images/halloween/ghost-domino-lying.png?url';
import purpleLying from '../../../assets/images/halloween/purple-lying.png?url';
import orangeLying from '../../../assets/images/halloween/orange-lying.png?url';
import mummyLying from '../../../assets/images/halloween/mummy-lying.png?url';

/**
 * The Halloween event's look, editable from the admin panel while the planner reviews drafts.
 * - Tiles: each slot (the placed block, the one-cell filler, the two-cell filler) holds any number of
 *   pavers, each with a weight. A tile draws its paver from its own id, so it keeps the same one as the
 *   game goes on, and a changed weight re-dresses the whole board at once for comparison.
 * - Backdrop: the lantern night or a lo-fi night sky, with bats, a witch and a flying jack-o'-lantern.
 * - Glitch: a short lo-fi glitch, gentle on the eyes, as a witch paver seats in a single gap, and one on demand.
 * Players get the defaults; the panel keeps a planner's changes on that device only.
 */
export type HalloweenSlot = 'block' | 'single' | 'double';
/** Two-cell pavers are drawn upright (176 x 323); single ones square (175 x 175). */
export type PaverShape = 'domino' | 'square';
export const SLOT_SHAPE: Record<HalloweenSlot, PaverShape> = { block: 'domino', single: 'square', double: 'domino' };
export const SLOTS: readonly { key: HalloweenSlot; label: string }[] = [
  { key: 'block', label: '놓는 블록' }, { key: 'single', label: '1칸 채움' }, { key: 'double', label: '2칸 채움' },
];
/** `lying` is a two-cell paver's own lying picture; without one (an added image) the upright one is turned. */
export interface Paver { id: string; name: string; url: string; shape: PaverShape; lying?: string; }
export const PAVER_LIBRARY: readonly Paver[] = [
  { id: 'stone', name: '거미줄 돌', url: stone, shape: 'domino', lying: stoneLying },
  { id: 'ghost-domino', name: '유령', url: ghostDomino, shape: 'domino', lying: ghostDominoLying },
  { id: 'purple', name: '보라', url: purple, shape: 'domino', lying: purpleLying },
  { id: 'orange', name: '주황', url: orange, shape: 'domino', lying: orangeLying },
  { id: 'mummy', name: '붕대', url: mummy, shape: 'domino', lying: mummyLying },
  { id: 'pumpkin', name: '호박', url: pumpkin, shape: 'square' },
  { id: 'witch', name: '마녀', url: witch, shape: 'square' },
  { id: 'ghost', name: '유령', url: ghost, shape: 'square' },
];
/** One paver in a slot. `url` is set for an image the planner added from their own files. */
export interface SlotEntry { paver: string; weight: number; name?: string; url?: string; }

export type Backdrop = 'lantern' | 'lofi';
export type Visitor = 'bats' | 'witch' | 'jack';
/** How the dark visitors stand out on a dim phone: as they are, a glowing rim, a lit sky behind them, or a lighter colour. */
export type VisitorLook = 'plain' | 'rim' | 'backlight' | 'light';
export const VISITOR_LOOKS: readonly { key: VisitorLook; label: string }[] = [
  { key: 'plain', label: '그대로' }, { key: 'rim', label: '윤곽 빛' }, { key: 'backlight', label: '뒤 밝히기' }, { key: 'light', label: '밝은 색' },
];
export const VISITORS: readonly { key: Visitor; label: string }[] = [
  { key: 'bats', label: '박쥐' }, { key: 'witch', label: '마녀 실루엣' }, { key: 'jack', label: '잭오랜턴' },
];
export interface HalloweenSettings {
  tiles: Record<HalloweenSlot, SlotEntry[]>;
  backdrop: Backdrop;
  visitors: Record<Visitor, boolean>;
  /** Each visitor comes on its own clock, every `visitorFrom`-`visitorTo` seconds at random, so two may cross together. */
  visitorFrom: number;
  visitorTo: number;
  /** How the bats and the witch are made visible on a dim phone, how strongly (0-1), and their size.
   *  The rim (2026-10-26) went back to the plain silhouette at its own size on 2026-10-27. */
  visitorLook: VisitorLook;
  visitorGlow: number;
  visitorScale: number;
  /** One glitch as a witch paver seats in a single gap (the moment it is wedged in), never on a timer. */
  glitchOnWitch: boolean;
  /** 0-1: how far the picture tears and splits. */
  glitchStrength: number;
  /** Milliseconds one glitch lasts. */
  glitchMs: number;
}

/**
 * Settled by the planner on 2026-10-25, revised 2026-10-27: purple and orange blocks half and half,
 * pumpkins three to one witch in single gaps, bandages in two-cell gaps; the lantern night with bats
 * only, every 10-15 s; a glitch only as a witch paver seats. The other drafts (the witch silhouette
 * among them) stay in the library for the panel.
 */
export const HALLOWEEN_DEFAULTS: Readonly<HalloweenSettings> = {
  tiles: {
    block: [{ paver: 'purple', weight: 1 }, { paver: 'orange', weight: 1 }],
    single: [{ paver: 'pumpkin', weight: 3 }, { paver: 'witch', weight: 1 }],
    double: [{ paver: 'mummy', weight: 1 }],
  },
  backdrop: 'lantern',
  visitors: { bats: true, witch: false, jack: false },
  visitorFrom: 10, visitorTo: 15,
  visitorLook: 'plain', visitorGlow: 0.6, visitorScale: 1,
  glitchOnWitch: true, glitchStrength: 0.5, glitchMs: 420,
};

const copy = (settings: Readonly<HalloweenSettings>): HalloweenSettings => JSON.parse(JSON.stringify(settings));
export const halloween: HalloweenSettings = copy(HALLOWEEN_DEFAULTS);

const listeners = new Set<(value: HalloweenSettings) => void>();
export function onHalloween(listener: (value: HalloweenSettings) => void) { listeners.add(listener); listener(halloween); return () => listeners.delete(listener); }
/** Applies a change and tells every listener (the board, the backdrop, the glitch timer, the panel). */
export function changeHalloween(change: (value: HalloweenSettings) => void) { change(halloween); listeners.forEach(listener => listener(halloween)); }
export function replaceHalloween(value: HalloweenSettings) { changeHalloween(current => Object.assign(current, copy(value))); }

/** The panel's "try it now" buttons: one glitch, or one visitor across the sky. */
export type Cue = 'glitch' | Visitor;
const cueListeners = new Set<(cue: Cue) => void>();
export function onCue(listener: (cue: Cue) => void) { cueListeners.add(listener); }
export function cue(value: Cue) { cueListeners.forEach(listener => listener(value)); }

export function paverOf(entry: SlotEntry): Paver | undefined {
  if (entry.url) return { id: entry.paver, name: entry.name ?? '내 이미지', url: entry.url, shape: PAVER_LIBRARY.find(p => p.id === entry.paver)?.shape ?? 'domino' };
  return PAVER_LIBRARY.find(p => p.id === entry.paver);
}

/** A steady number in [0, 1) for a tile id, different per slot, so neighbours do not move in step. */
export function tileRandom(id: number, salt: number) {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The paver a tile wears in this slot, picked by weight from its id; the first entry if all are 0. */
export function pickEntry(entries: readonly SlotEntry[], id: number, salt: number): SlotEntry | undefined {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (!total) return entries[0];
  let at = tileRandom(id, salt) * total;
  for (const entry of entries) { at -= Math.max(0, entry.weight); if (at < 0) return entry; }
  return entries[entries.length - 1];
}
const SALT: Record<HalloweenSlot, number> = { block: 1, single: 2, double: 3 };
export function pickPaver(slot: HalloweenSlot, id: number) {
  const entry = pickEntry(halloween.tiles[slot], id, SALT[slot]);
  return entry && paverOf(entry);
}
/** The slot's most likely paver, for the pause screen's counters. */
export function leadPaver(slot: HalloweenSlot) {
  const entry = [...halloween.tiles[slot]].sort((a, b) => b.weight - a.weight)[0];
  return entry && paverOf(entry);
}

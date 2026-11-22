import { WIDTH, type Pavement, type Tile } from '../../../packages/play-core';
import { encodePNG } from './png';
import { hasTileOverrides, TILE_BLEED, tileArtwork, tileImages, type Artwork, type TileSkin } from './tile-assets';
import { lyingCanvas } from './lying';
import { eachSnowPatch, WARP } from './snow';

export const PNG_MAX_PIXELS = 32000000;
export const PNG_MAX_HEIGHT = 65536;
// Keep the exported photo at 688px even when the playable board grows wider.
const UNIT = 264 / WIDTH, BUCKET_ROWS = 32;
const LABEL_Y = 38, LABEL_SIZE = 12, LABEL_COLOR = '#718173', LABEL_FONT = "'GangBuJang','Nanum GangBuJangNimCe',sans-serif";
const pauseTask = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const definition = (id: string, w: number, h: number, image: string) => {
  const width = (w + TILE_BLEED) * UNIT, height = (h + TILE_BLEED) * UNIT;
  return `<image id="${id}" x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" preserveAspectRatio="none" xlink:href="${image}"/>`;
};
const definitions = ([
  ['tile-2-1', 2, 1, tileImages.horizontal], ['tile-1-2', 1, 2, tileImages.vertical], ['tile-1-1', 1, 1, tileImages.center],
  ['tile-2-1-white', 2, 1, tileImages.whiteHorizontal], ['tile-1-2-white', 1, 2, tileImages.whiteVertical],
] as const).map(([id, w, h, image]) => definition(id, w, h, image)).join('');
const shapeId = (tile: Tile) => `tile-${tile.w}-${tile.h}${tile.white && tile.w + tile.h > 2 ? '-white' : ''}`;

/** The pictures a saved image uses: shared definitions, and which one each tile points at. */
export interface ReceiptArt { defs: string; id: (tile: Tile) => string; }
const EVERYDAY: ReceiptArt = { defs: definitions, id: shapeId };

/** An event paver as a data URL (a saved SVG can only hold its pictures inline), turned flat when it lies. */
const inlined = new Map<string, Promise<string>>();
function inline({ url, turn }: Artwork) {
  const key = `${turn ? 'turn:' : ''}${url}`;
  if (!inlined.has(key)) inlined.set(key, new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // Lying flat, an upright picture is turned and re-shaded exactly as on screen (lying.ts).
      if (turn) { lyingCanvas(image).then(canvas => resolve(canvas.toDataURL('image/png')), reject); return; }
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      canvas.getContext('2d')!.drawImage(image, 0, 0); resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => { inlined.delete(key); reject(new Error('Paver image failed')); };
    image.src = url;
  }));
  return inlined.get(key)!;
}

/**
 * The saved image shows the board as it looks on screen: an event skin saves the event's pavers, each
 * tile wearing the same one as on screen (see tileArtwork). The everyday look needs no preparation.
 */
export async function receiptArt(tiles: readonly Tile[], skin: TileSkin): Promise<ReceiptArt> {
  if (skin === 'everyday' && !hasTileOverrides(skin)) return EVERYDAY;
  const keyOf = (tile: Tile) => { const art = tileArtwork(tile, skin); return { art, key: `${tile.w}x${tile.h}:${art.turn ? 'turn:' : ''}${art.url}` }; };
  const ids = new Map<string, string>(), defs: Promise<string>[] = [];
  for (const tile of tiles) {
    const { art, key } = keyOf(tile);
    if (ids.has(key)) continue;
    const id = `art-${ids.size}`; ids.set(key, id);
    defs.push(inline(art).then(image => definition(id, tile.w, tile.h, image)));
  }
  return { defs: (await Promise.all(defs)).join(''), id: tile => ids.get(keyOf(tile).key) ?? shapeId(tile) };
}

export function photoSize(width: number, height: number) { return { width: width * 2, height: height * 2 }; }
export function receiptFormat(width: number, height: number): 'png' | 'svg' {
  const photo = photoSize(width, height);
  return photo.height > PNG_MAX_HEIGHT || photo.width * photo.height > PNG_MAX_PIXELS ? 'svg' : 'png';
}

/**
 * Snow on a saved image (the winter environment): the cover as it lies once it has all fallen, without the
 * dog's prints, so a board saved twice looks the same. It is written as the screen draws it (snow.ts): the
 * same soft patches, each a `<use>` of one of four small pictures, cut to the pavers by a clip made of one
 * warped cell outline used once per cell. Being plain SVG it is in the PNG (drawn from these stripes) and
 * in the SVG file alike. Snow ducks sit on top of it, as on screen.
 */
export interface ReceiptSnow {
  /** The four snow patches as data URLs (snowSpriteURLs). */
  sprites: readonly string[];
  /** Whether a tile is a snow duck in its gap: its floor keeps only `floor` of the snow, and it is drawn over it. */
  duck(tile: Tile): boolean;
  floor: number;
  /** How much of the pavers the snow hides, 0-1 (the screen's own measure). */
  cover: number;
}
const round = (value: number) => Math.round(value * 10) / 10;
/** One cell's outline with the pavers' edge warp, its lower left corner at the origin. The warp repeats every cell, so one serves all. */
const CELL_OUTLINE = (() => {
  const points: string[] = [], N = 12;
  // Grown by a hair about its middle, so neighbouring cells overlap and no seam shows between them.
  const GROW = 1.012, part = (value: number) => Math.round(value * UNIT * 100) / 100;
  const at = (x: number, y: number) => `${part(0.5 + (x - WARP * Math.sin(y * Math.PI * 2) - 0.5) * GROW)} ${part(-0.5 - (y + WARP * Math.sin(x * Math.PI * 2) - 0.5) * GROW)}`;
  for (let i = 0; i < N; i++) points.push(at(i / N, 0));
  for (let i = 0; i < N; i++) points.push(at(1, i / N));
  for (let i = 0; i < N; i++) points.push(at(1 - i / N, 1));
  for (let i = 0; i < N; i++) points.push(at(0, 1 - i / N));
  return `M${points.join('L')}Z`;
})();

/** Snapshot and spatial buckets: full export history, bounded preview/stripe rendering. */
export class Receipt {
  readonly width = WIDTH * UNIT + 80;
  readonly height: number;
  readonly tiles: readonly Tile[];
  private buckets = new Map<number, Tile[]>();
  private patternHeight: number;
  /** Which tile fills each cell, kept only when snow is to be drawn. */
  private cells?: Map<number, Tile>;
  private rows: number;
  constructor(board: Pavement, readonly started: Date, private art: ReceiptArt = EVERYDAY, private snow?: ReceiptSnow) {
    this.rows = board.height;
    if (snow) { this.cells = new Map(); for (const tile of board.tiles) for (let x = tile.x; x < tile.x + tile.w; x++) for (let y = tile.y; y < tile.y + tile.h; y++) this.cells.set(y * WIDTH + x, tile); }
    this.tiles = board.tiles.slice(); this.patternHeight = Math.max(3, board.height) * UNIT;
    // Nine columns give fractional cell pixels; the encoded PNG still needs whole rows.
    this.height = Math.ceil(this.patternHeight + 112);
    for (const tile of this.tiles) {
      const key = Math.floor(tile.y / BUCKET_ROWS);
      if (!this.buckets.has(key)) this.buckets.set(key, []);
      this.buckets.get(key)!.push(tile);
    }
  }
  get format() { return receiptFormat(this.width, this.height); }
  /** The one line of text on the picture: date and piece count, white filler included. */
  get label() {
    const date = `${this.started.getFullYear()}.${String(this.started.getMonth() + 1).padStart(2, '0')}.${String(this.started.getDate()).padStart(2, '0')}`;
    return `${date} · ${String(this.tiles.length).padStart(2, '0')}조각`;
  }
  /**
   * paper: the legacy receipt look (cream paper, torn edge, stitch line). Off, the background stays
   * transparent. label: the text line inside the SVG; the PNG draws it on the canvas instead so the
   * handwriting face is used.
   */
  private header(top: number, height: number, scale = 1, paper = true, label = true) {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${this.width * scale}" height="${height * scale}" viewBox="0 ${top} ${this.width} ${height}"><defs>${this.art.defs}${this.snowDefs()}</defs>`;
    if (paper) {
      let teeth = `M0 0H${this.width}V${this.height - 8}`;
      for (let x = this.width; x > 0; x -= 12) teeth += `L${Math.max(0, x - 6)} ${this.height}L${Math.max(0, x - 12)} ${this.height - 8}`;
      svg += `<path d="${teeth}Z" fill="#fffcf2"/>`;
    }
    if (label) svg += `<text x="${this.width / 2}" y="${LABEL_Y}" fill="${LABEL_COLOR}" font-family="${LABEL_FONT}" font-size="${LABEL_SIZE}" font-weight="400" letter-spacing="1" text-anchor="middle">${this.label}</text>`;
    if (paper) svg += `<path d="M24 56H${this.width - 24}" fill="none" stroke="#b9c2ad" stroke-width="1" stroke-dasharray="3 4"/>`;
    return svg;
  }
  private tileSVG(tile: Tile) {
    const x = 40 + (tile.x + tile.w / 2) * UNIT;
    const y = 76 + this.patternHeight - (tile.y + tile.h / 2) * UNIT;
    return `<use xlink:href="#${this.art.id(tile)}" x="${x}" y="${y}"/>`;
  }
  private snowDefs() {
    if (!this.snow) return '';
    return `<path id="snow-cell" d="${CELL_OUTLINE}"/>` + this.snow.sprites.map((url, i) => `<symbol id="snow-${i}" viewBox="0 0 1 1" preserveAspectRatio="none"><image width="1" height="1" preserveAspectRatio="none" xlink:href="${url}"/></symbol>`).join('');
  }
  private isDuck(tile: Tile) { return !!this.snow?.duck(tile); }
  /** The snow on board rows `from` up to (not including) `to`, cut to the pavers in them. `id` names its clip. */
  private snowSVG(from: number, to: number, id: string) {
    const snow = this.snow, cells = this.cells;
    if (!snow || !cells) return '';
    from = Math.max(0, from); to = Math.min(this.rows, to);
    if (to <= from) return '';
    const base = 76 + this.patternHeight, clip: string[] = [], patches: string[] = [];
    for (let y = from; y < to; y++) for (let x = 0; x < WIDTH; x++) if (cells.has(y * WIDTH + x)) clip.push(`<use xlink:href="#snow-cell" x="${round(40 + x * UNIT)}" y="${round(base - y * UNIT)}"/>`);
    if (!clip.length) return '';
    const put = (lx: number, ly: number, size: number, sprite: number, strength: number) => {
      const width = size * UNIT, x = 40 + (lx - WARP * Math.sin(ly * Math.PI * 2)) * UNIT, y = base - (ly + WARP * Math.sin(lx * Math.PI * 2)) * UNIT;
      patches.push(`<use xlink:href="#snow-${sprite}" x="${round(x - width / 2)}" y="${round(y - width / 2)}" width="${round(width)}" height="${round(width)}" opacity="${Math.round(Math.min(1, strength) * 100) / 100}"/>`);
    };
    // A patch is wider than its cell, so the rows just outside lend theirs, and so does the frame the
    // screen shows on either side and below (its cells always gather snow).
    for (let y = from - 1; y <= to; y++) for (let x = -1; x <= WIDTH; x++) {
      const tile = x >= 0 && x < WIDTH && y >= 0 ? cells.get(y * WIDTH + x) : undefined;
      if (x >= 0 && x < WIDTH && y >= 0 && !tile) continue;
      eachSnowPatch(x, y, 1, 1, !!tile && snow.duck(tile), snow.floor, snow.cover, put);
    }
    return `<clipPath id="${id}">${clip.join('')}</clipPath><g clip-path="url(#${id})">${patches.join('')}</g>`;
  }
  window(top: number, height: number, scale = 1, paper = true) {
    const minimum = (76 + this.patternHeight - top - height) / UNIT - TILE_BLEED / 2;
    const maximum = (76 + this.patternHeight - top) / UNIT + TILE_BLEED / 2;
    const parts = [this.header(top, height, scale, paper, paper)], ducks: string[] = [];
    for (let bucket = Math.max(0, Math.floor((minimum - 2) / BUCKET_ROWS)); bucket <= Math.floor(maximum / BUCKET_ROWS); bucket++) {
      for (const tile of this.buckets.get(bucket) ?? []) {
        if (tile.y + tile.h >= minimum && tile.y <= maximum) (this.isDuck(tile) ? ducks : parts).push(this.tileSVG(tile));
      }
    }
    // The snow lies on the pavers, and the snow ducks sit on the snow.
    parts.push(this.snowSVG(Math.floor(minimum) - 1, Math.ceil(maximum) + 1, 'snow-clip'), ...ducks);
    parts.push('</svg>'); return parts.join('');
  }
  svg(paper = true) {
    const pavers = this.tiles.filter(tile => !this.isDuck(tile)), ducks = this.tiles.filter(tile => this.isDuck(tile));
    return this.header(0, this.height, 1, paper) + pavers.map(tile => this.tileSVG(tile)).join('') + this.snowSVG(0, this.rows, 'snow-clip') + ducks.map(tile => this.tileSVG(tile)).join('') + '</svg>';
  }
  /** The saved SVG is transparent like the PNG; only the label line is kept. */
  async svgFile(signal?: AbortSignal) {
    const parts: BlobPart[] = [this.header(0, this.height, 1, false)];
    const ducks: Tile[] = [];
    for (let i = 0; i < this.tiles.length; i += 1024) {
      signal?.throwIfAborted();
      parts.push(this.tiles.slice(i, i + 1024).map(tile => this.isDuck(tile) ? (ducks.push(tile), '') : this.tileSVG(tile)).join(''));
      await pauseTask();
    }
    // The snow, a band of rows at a time, then the snow ducks on top of it.
    if (this.snow) for (let from = 0; from < this.rows; from += BUCKET_ROWS) {
      signal?.throwIfAborted();
      parts.push(this.snowSVG(from, from + BUCKET_ROWS, `snow-clip-${from / BUCKET_ROWS}`));
      await pauseTask();
    }
    for (let i = 0; i < ducks.length; i += 1024) parts.push(ducks.slice(i, i + 1024).map(tile => this.tileSVG(tile)).join(''));
    signal?.throwIfAborted(); parts.push('</svg>');
    return new File(parts, this.filename('svg'), { type: 'image/svg+xml' });
  }
  filename(extension: string) { return `blockstep-${this.started.toISOString().replaceAll(':', '-')}.${extension}`; }
}
export function receiptSVG(board: Pavement, started: Date, paper = true) { return new Receipt(board, started).svg(paper); }

/** A transparent PNG of the whole pavement with the label drawn in the app's handwriting face. */
export async function receiptPhoto(receipt: Receipt, signal?: AbortSignal, progress?: (value: number) => void): Promise<File> {
  if (receipt.format !== 'png') throw new Error('Receipt exceeds photo size limit');
  const size = photoSize(receipt.width, receipt.height);
  const font = `${LABEL_SIZE * 2}px ${LABEL_FONT}`;
  await document.fonts?.load(font).catch(() => {});
  const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = 256;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas unavailable');
  async function* rows() {
    try {
      for (let top = 0; top < size.height; top += 256) {
        signal?.throwIfAborted();
        const height = Math.min(256, size.height - top);
        const url = URL.createObjectURL(new Blob([receipt.window(top / 2, height / 2, 2, false)], { type: 'image/svg+xml' }));
        const image = new Image();
        try {
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve(); image.onerror = () => reject(new Error('Photo stripe decode failed')); image.src = url;
          });
          signal?.throwIfAborted();
          context!.clearRect(0, 0, size.width, 256);
          context!.drawImage(image, 0, 0);
          if (top === 0) {
            context!.font = font; context!.fillStyle = LABEL_COLOR; context!.textAlign = 'center'; context!.textBaseline = 'alphabetic';
            context!.fillText(receipt.label, size.width / 2, LABEL_Y * 2);
          }
          const rgba = context!.getImageData(0, 0, size.width, height).data;
          const stride = size.width * 4 + 1, bytes = new Uint8Array(stride * height);
          for (let y = 0; y < height; y++) {
            // PNG Sub filter; chunk boundaries never restart the zlib stream.
            bytes[y * stride] = 1;
            for (let x = 0; x < size.width; x++) for (let channel = 0; channel < 4; channel++) {
              const source = (y * size.width + x) * 4 + channel;
              bytes[y * stride + 1 + x * 4 + channel] = rgba[source] - (x ? rgba[source - 4] : 0);
            }
          }
          yield bytes;
        } finally { URL.revokeObjectURL(url); image.src = ''; }
        progress?.(Math.min(1, (top + height) / size.height)); await pauseTask();
      }
    } finally { canvas.width = 1; canvas.height = 1; }
  }
  const blob = await encodePNG(size.width, size.height, rows(), signal, 4);
  return new File([blob], receipt.filename('png'), { type: 'image/png' });
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file), link = document.createElement('a');
  link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

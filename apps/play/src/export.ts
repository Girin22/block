import { WIDTH, type Pavement, type Tile } from '../../../packages/play-core';
import { encodePNG } from './png';
import { TILE_BLEED, tileImages } from './tile-assets';

export const PNG_MAX_PIXELS = 32000000;
export const PNG_MAX_HEIGHT = 65536;
// Keep the exported photo at 688px even when the playable board grows wider.
const UNIT = 264 / WIDTH, BUCKET_ROWS = 32;
const LABEL_Y = 38, LABEL_SIZE = 12, LABEL_COLOR = '#718173', LABEL_FONT = "'GangBuJang','Nanum GangBuJangNimCe',sans-serif";
const pauseTask = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const definitions = [
  ['tile-2-1', 2, 1, tileImages.horizontal], ['tile-1-2', 1, 2, tileImages.vertical], ['tile-1-1', 1, 1, tileImages.center],
  ['tile-2-1-white', 2, 1, tileImages.whiteHorizontal], ['tile-1-2-white', 1, 2, tileImages.whiteVertical],
].map(([id, w, h, image]) => {
  const width = (Number(w) + TILE_BLEED) * UNIT, height = (Number(h) + TILE_BLEED) * UNIT;
  return `<image id="${id}" x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" preserveAspectRatio="none" xlink:href="${image}"/>`;
}).join('');
const shapeId = (tile: Tile) => `tile-${tile.w}-${tile.h}${tile.white && tile.w + tile.h > 2 ? '-white' : ''}`;

export function photoSize(width: number, height: number) { return { width: width * 2, height: height * 2 }; }
export function receiptFormat(width: number, height: number): 'png' | 'svg' {
  const photo = photoSize(width, height);
  return photo.height > PNG_MAX_HEIGHT || photo.width * photo.height > PNG_MAX_PIXELS ? 'svg' : 'png';
}

/** Snapshot and spatial buckets: full export history, bounded preview/stripe rendering. */
export class Receipt {
  readonly width = WIDTH * UNIT + 80;
  readonly height: number;
  readonly tiles: readonly Tile[];
  private buckets = new Map<number, Tile[]>();
  private patternHeight: number;
  constructor(board: Pavement, readonly started: Date) {
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
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${this.width * scale}" height="${height * scale}" viewBox="0 ${top} ${this.width} ${height}"><defs>${definitions}</defs>`;
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
    return `<use xlink:href="#${shapeId(tile)}" x="${x}" y="${y}"/>`;
  }
  window(top: number, height: number, scale = 1, paper = true) {
    const minimum = (76 + this.patternHeight - top - height) / UNIT - TILE_BLEED / 2;
    const maximum = (76 + this.patternHeight - top) / UNIT + TILE_BLEED / 2;
    const parts = [this.header(top, height, scale, paper, paper)];
    for (let bucket = Math.max(0, Math.floor((minimum - 2) / BUCKET_ROWS)); bucket <= Math.floor(maximum / BUCKET_ROWS); bucket++) {
      for (const tile of this.buckets.get(bucket) ?? []) {
        if (tile.y + tile.h >= minimum && tile.y <= maximum) parts.push(this.tileSVG(tile));
      }
    }
    parts.push('</svg>'); return parts.join('');
  }
  svg(paper = true) { return this.header(0, this.height, 1, paper) + this.tiles.map(tile => this.tileSVG(tile)).join('') + '</svg>'; }
  /** The saved SVG is transparent like the PNG; only the label line is kept. */
  async svgFile(signal?: AbortSignal) {
    const parts: BlobPart[] = [this.header(0, this.height, 1, false)];
    for (let i = 0; i < this.tiles.length; i += 1024) {
      signal?.throwIfAborted();
      parts.push(this.tiles.slice(i, i + 1024).map(tile => this.tileSVG(tile)).join(''));
      await pauseTask();
    }
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

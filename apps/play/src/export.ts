import { WIDTH, type Pavement, type Tile } from '../../../packages/play-core';
import { encodePNG } from './png';
import { TILE_BLEED, tileImages } from './tile-assets';

export const PNG_MAX_PIXELS = 32000000;
export const PNG_MAX_HEIGHT = 65536;
// Keep the exported photo at 688px even when the playable board grows wider.
const UNIT = 264 / WIDTH, BUCKET_ROWS = 32;
const pauseTask = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const definitions = [[2, 1, tileImages.horizontal], [1, 2, tileImages.vertical], [1, 1, tileImages.center]].map(([w, h, image]) => {
  const width = (Number(w) + TILE_BLEED) * UNIT, height = (Number(h) + TILE_BLEED) * UNIT;
  return `<image id="tile-${w}-${h}" x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" preserveAspectRatio="none" xlink:href="${image}"/>`;
}).join('');

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
  private header(top: number, height: number, scale = 1) {
    const date = `${this.started.getFullYear()}.${String(this.started.getMonth() + 1).padStart(2, '0')}.${String(this.started.getDate()).padStart(2, '0')}`;
    const count = this.tiles.length ? `${String(this.tiles.length).padStart(2, '0')} piece` : 'piece';
    let teeth = `M0 0H${this.width}V${this.height - 8}`;
    for (let x = this.width; x > 0; x -= 12) teeth += `L${Math.max(0, x - 6)} ${this.height}L${Math.max(0, x - 12)} ${this.height - 8}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${this.width * scale}" height="${height * scale}" viewBox="0 ${top} ${this.width} ${height}"><defs>${definitions}</defs><path d="${teeth}Z" fill="#fffcf2"/><text x="${this.width / 2}" y="38" fill="#718173" font-family="Arial,sans-serif" font-size="12" font-weight="400" letter-spacing="1" text-anchor="middle">${date} · ${count}</text><path d="M24 56H${this.width - 24}" fill="none" stroke="#b9c2ad" stroke-width="1" stroke-dasharray="3 4"/>`;
  }
  private tileSVG(tile: Tile) {
    const x = 40 + (tile.x + tile.w / 2) * UNIT;
    const y = 76 + this.patternHeight - (tile.y + tile.h / 2) * UNIT;
    return `<use xlink:href="#tile-${tile.w}-${tile.h}" x="${x}" y="${y}"/>`;
  }
  window(top: number, height: number, scale = 1) {
    const minimum = (76 + this.patternHeight - top - height) / UNIT - TILE_BLEED / 2;
    const maximum = (76 + this.patternHeight - top) / UNIT + TILE_BLEED / 2;
    const parts = [this.header(top, height, scale)];
    for (let bucket = Math.max(0, Math.floor((minimum - 2) / BUCKET_ROWS)); bucket <= Math.floor(maximum / BUCKET_ROWS); bucket++) {
      for (const tile of this.buckets.get(bucket) ?? []) {
        if (tile.y + tile.h >= minimum && tile.y <= maximum) parts.push(this.tileSVG(tile));
      }
    }
    parts.push('</svg>'); return parts.join('');
  }
  svg() { return this.header(0, this.height) + this.tiles.map(tile => this.tileSVG(tile)).join('') + '</svg>'; }
  async svgFile(signal?: AbortSignal) {
    const parts: BlobPart[] = [this.header(0, this.height)];
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
export function receiptSVG(board: Pavement, started: Date) { return new Receipt(board, started).svg(); }

export async function receiptPhoto(receipt: Receipt, signal?: AbortSignal, progress?: (value: number) => void): Promise<File> {
  if (receipt.format !== 'png') throw new Error('Receipt exceeds photo size limit');
  const size = photoSize(receipt.width, receipt.height);
  const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = 256;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas unavailable');
  async function* rows() {
    try {
      for (let top = 0; top < size.height; top += 256) {
        signal?.throwIfAborted();
        const height = Math.min(256, size.height - top);
        const url = URL.createObjectURL(new Blob([receipt.window(top / 2, height / 2, 2)], { type: 'image/svg+xml' }));
        const image = new Image();
        try {
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve(); image.onerror = () => reject(new Error('Photo stripe decode failed')); image.src = url;
          });
          signal?.throwIfAborted();
          context!.fillStyle = '#fff'; context!.fillRect(0, 0, size.width, 256);
          context!.drawImage(image, 0, 0);
          const rgba = context!.getImageData(0, 0, size.width, height).data;
          const stride = size.width * 3 + 1, bytes = new Uint8Array(stride * height);
          for (let y = 0; y < height; y++) {
            // PNG Sub filter; chunk boundaries never restart the zlib stream.
            bytes[y * stride] = 1;
            for (let x = 0; x < size.width; x++) for (let channel = 0; channel < 3; channel++) {
              const source = (y * size.width + x) * 4 + channel;
              bytes[y * stride + 1 + x * 3 + channel] = rgba[source] - (x ? rgba[source - 4] : 0);
            }
          }
          yield bytes;
        } finally { URL.revokeObjectURL(url); image.src = ''; }
        progress?.(Math.min(1, (top + height) / size.height)); await pauseTask();
      }
    } finally { canvas.width = 1; canvas.height = 1; }
  }
  const blob = await encodePNG(size.width, size.height, rows(), signal);
  return new File([blob], receipt.filename('png'), { type: 'image/png' });
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file), link = document.createElement('a');
  link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

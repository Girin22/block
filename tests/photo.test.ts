import { expect, it } from 'vitest';
import { photoSize, receiptFormat, Receipt, PNG_MAX_PIXELS, PNG_MAX_HEIGHT } from '../apps/play/src/export';
import { stressBoard } from '../apps/play/src/stress';
import { crc32, encodePNG } from '../apps/play/src/png';

it('never sacrifices photo resolution: chooses SVG instead of shrinking', () => {
  expect(photoSize(344, 17712)).toEqual({ width: 688, height: 35424 });
  expect(receiptFormat(344, 17712)).toBe('png');
  expect(receiptFormat(344, 52912)).toBe('svg');
  expect(receiptFormat(344, PNG_MAX_HEIGHT / 2 + 1)).toBe('svg');
  const boundary = Math.floor(PNG_MAX_PIXELS / 688 / 2);
  expect(receiptFormat(344, boundary)).toBe('png');
  expect(receiptFormat(344, boundary + 1)).toBe('svg');
});

it('keeps PNG dimensions integral for heights between three-row motifs', () => {
  for (const height of [4, 5, 7, 8]) {
    const receipt = new Receipt(stressBoard(height, true), new Date(2026, 8, 21));
    const pixels = photoSize(receipt.width, receipt.height);
    expect(pixels.width).toBe(688);
    expect(Number.isInteger(pixels.height)).toBe(true);
    expect(receipt.height).toBeGreaterThanOrEqual(height * 264 / 9 + 112);
    expect(receipt.format).toBe('png');
  }
});

it('keeps a long preview bounded while full SVG retains every tile with shared embedded images', async () => {
  const receipt = new Receipt(stressBoard(3600), new Date(2026, 8, 7));
  expect(receipt.window(0, 1000).match(/<use /g)!.length).toBeLessThan(160);
  expect(receipt.window(receipt.height - 1000, 1000)).toContain('<use ');
  const file = await receipt.svgFile(); const svg = await file.text();
  expect(svg.match(/<use /g)).toHaveLength(3600);
  expect(svg.match(/id="tile-/g)).toHaveLength(5);
  expect(file.size).toBeLessThan(650000);
});

it('encodes valid PNG chunks and one continuous zlib stream across stripes', async () => {
  expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  const row1 = new Uint8Array([0, 255, 0, 0, 0, 255, 0]);
  const row2 = new Uint8Array([0, 0, 0, 255, 255, 255, 255]);
  async function* rows() { yield row1; yield row2; }
  const blob = await encodePNG(2, 2, rows());
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer), parts: BlobPart[] = [];
  expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  for (let pos = 8; pos < bytes.length;) {
    const length = view.getUint32(pos), type = new TextDecoder().decode(bytes.slice(pos + 4, pos + 8));
    expect(crc32(bytes.subarray(pos + 4, pos + 8 + length))).toBe(view.getUint32(pos + 8 + length));
    if (type === 'IHDR') { expect(view.getUint32(pos + 8)).toBe(2); expect(view.getUint32(pos + 12)).toBe(2); }
    if (type === 'IDAT') parts.push(bytes.slice(pos + 8, pos + 8 + length));
    pos += length + 12;
  }
  const inflated = new Uint8Array(await new Response(new Blob(parts).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  expect(Array.from(inflated)).toEqual([...row1, ...row2]);
});

it('rejects incomplete PNG rows and cancels abandoned exports', async () => {
  async function* incomplete() { yield new Uint8Array(7); }
  await expect(encodePNG(2, 2, incomplete())).rejects.toThrow('Incomplete PNG rows');
  const abort = new AbortController(); abort.abort();
  const receipt = new Receipt(stressBoard(10), new Date());
  await expect(receipt.svgFile(abort.signal)).rejects.toThrow();
});

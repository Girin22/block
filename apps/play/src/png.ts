// PNG truecolor (3 channels) or truecolor with alpha (4), non-interlaced. One zlib stream, multiple bounded IDAT chunks.
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const value of data) crc = crcTable[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data = new Uint8Array(0)) {
  const bytes = new Uint8Array(data.length + 12), view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  bytes.set(new TextEncoder().encode(type), 4); bytes.set(data, 8);
  view.setUint32(bytes.length - 4, crc32(bytes.subarray(4, bytes.length - 4)));
  return bytes;
}
export async function encodePNG(width: number, height: number, rows: AsyncIterable<Uint8Array>, signal?: AbortSignal, channels: 3 | 4 = 3): Promise<Blob> {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) throw new Error('Invalid PNG dimensions');
  const header = new Uint8Array(13), view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = channels === 4 ? 6 : 2;
  const parts: BlobPart[] = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header)];
  const iterator = rows[Symbol.asyncIterator]();
  let byteCount = 0;
  const source = new ReadableStream<BufferSource>({
    async pull(controller) {
      try {
        signal?.throwIfAborted();
        const next = await iterator.next();
        if (next.done) {
          if (byteCount !== height * (width * channels + 1)) throw new Error('Incomplete PNG rows');
          controller.close();
        } else { byteCount += next.value.length; controller.enqueue(new Uint8Array(next.value)); }
      } catch (error) { controller.error(error); }
    },
    async cancel() { await iterator.return?.(); },
  });
  const reader = source.pipeThrough(new CompressionStream('deflate')).getReader();
  try {
    while (true) {
      signal?.throwIfAborted();
      const next = await reader.read(); if (next.done) break;
      parts.push(chunk('IDAT', new Uint8Array(next.value)));
    }
    parts.push(chunk('IEND'));
    return new Blob(parts, { type: 'image/png' });
  } catch (error) {
    await reader.cancel().catch(() => {}); throw error;
  } finally { reader.releaseLock(); await iterator.return?.(); }
}

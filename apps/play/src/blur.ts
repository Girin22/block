/**
 * Soft shadows without relying on the canvas `filter` property, which older iOS Safari (before 18)
 * silently ignores. That left the drop shadow as a hard black cut-out on those phones.
 */

/** True when this browser really applies `context.filter`, not merely exposes the property. */
export function canvasFilterWorks(): boolean {
  try {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 9;
    const context = canvas.getContext('2d');
    if (!context || typeof context.filter !== 'string') return false;
    context.filter = 'blur(2px)'; context.fillStyle = '#000'; context.fillRect(4, 4, 1, 1);
    // A working blur spreads the single pixel into its neighbours.
    return context.getImageData(1, 4, 1, 1).data[3] > 0;
  } catch { return false; }
}

/** Gaussian-like blur of one channel by three box passes. Outside the image counts as zero, so an
 *  interior shape keeps its total while nothing is duplicated at the edges. */
export function blurChannel(values: Float32Array, width: number, height: number, sigma: number): Float32Array {
  if (sigma <= 0) return values.slice();
  // Three box blurs of this radius approximate a Gaussian of the given sigma.
  const radius = Math.max(1, Math.round(Math.sqrt(sigma * sigma * 12 / 3 + 1) / 2 - 0.5));
  let source = values.slice(), target = new Float32Array(values.length);
  const pass = (line: (index: number) => number, length: number, count: number) => {
    const size = radius * 2 + 1;
    for (let l = 0; l < count; l++) {
      const at = (i: number) => i < 0 || i >= length ? 0 : source[line(l * length + i)];
      let sum = 0;
      for (let i = 0; i <= radius; i++) sum += at(i);
      for (let i = 0; i < length; i++) {
        target[line(l * length + i)] = sum / size;
        sum += at(i + radius + 1) - at(i - radius);
      }
    }
    [source, target] = [target, source];
  };
  for (let i = 0; i < 3; i++) {
    pass(index => index, width, height);
    pass(index => (index % height) * width + Math.floor(index / height), height, width);
  }
  return source;
}

import { tileImages } from './tile-assets';

/**
 * A two-cell paver has one picture, drawn upright, yet it also lies flat. Simply turning the picture
 * turns its lighting too: the stone's side would show at the wrong edge. The everyday paver has both
 * pictures drawn by hand, so the ratio between its lying picture and its upright one turned a quarter
 * clockwise is exactly that change of light. Any other paver on the same outline is turned and then
 * multiplied by that ratio (inside the face it is 1, so the artwork itself is untouched). This is the
 * same step scripts/make-halloween-lying.py does ahead of time, done here for pictures that only exist
 * as an upright one: the Christmas pavers and any image a planner swaps in.
 */
interface LightMap { width: number; height: number; ratio: Float32Array; }
type Picture = HTMLImageElement | HTMLCanvasElement;

const widthOf = (picture: Picture) => picture instanceof HTMLImageElement ? picture.naturalWidth : picture.width;
const heightOf = (picture: Picture) => picture instanceof HTMLImageElement ? picture.naturalHeight : picture.height;

export function loadPicture(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image); image.onerror = () => reject(new Error('Picture failed to load'));
    image.src = url;
  });
}

/** The picture turned a quarter: clockwise to lie flat, or back anticlockwise to stand. */
function turned(picture: Picture, clockwise: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = heightOf(picture); canvas.height = widthOf(picture);
  const context = canvas.getContext('2d')!;
  if (clockwise) { context.translate(canvas.width, 0); context.rotate(Math.PI / 2); }
  else { context.translate(0, canvas.height); context.rotate(-Math.PI / 2); }
  context.drawImage(picture, 0, 0);
  return canvas;
}

const luminance = (data: Uint8ClampedArray, i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

let light: Promise<LightMap> | undefined;
function lightMap() {
  return light ??= Promise.all([loadPicture(tileImages.horizontal), loadPicture(tileImages.vertical)]).then(([lying, upright]) => {
    const width = lying.naturalWidth, height = lying.naturalHeight;
    const pixels = (picture: Picture) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(picture, 0, 0, width, height);
      return context.getImageData(0, 0, width, height).data;
    };
    const flat = pixels(lying), turn = pixels(turned(upright, true)), ratio = new Float32Array(width * height).fill(1);
    for (let i = 0; i < ratio.length; i++) {
      if (flat[i * 4 + 3] <= 8 || turn[i * 4 + 3] <= 8) continue;
      ratio[i] = Math.min(1.6, Math.max(0.25, luminance(flat, i * 4) / Math.max(luminance(turn, i * 4), 1)));
    }
    return { width, height, ratio };
  });
}

/** Multiplies (or divides) a lying picture by the change of light, in place. */
function shade(canvas: HTMLCanvasElement, map: LightMap, undo: boolean) {
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const image = context.getImageData(0, 0, canvas.width, canvas.height), data = image.data;
  for (let y = 0; y < canvas.height; y++) {
    const row = Math.min(map.height - 1, Math.floor(y * map.height / canvas.height)) * map.width;
    for (let x = 0; x < canvas.width; x++) {
      const ratio = map.ratio[row + Math.min(map.width - 1, Math.floor(x * map.width / canvas.width))];
      if (ratio === 1) continue;
      const i = (y * canvas.width + x) * 4, scale = undo ? 1 / ratio : ratio;
      data[i] *= scale; data[i + 1] *= scale; data[i + 2] *= scale;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/** An upright two-cell picture as it lies flat: turned clockwise, the stone's side along the bottom. */
export async function lyingCanvas(upright: Picture) {
  const map = await lightMap();
  return shade(turned(upright, true), map, false);
}

/** The reverse, for a picture that was drawn lying: the upright one it would have come from. */
export async function uprightCanvas(lying: Picture) {
  const map = await lightMap();
  const canvas = document.createElement('canvas'); canvas.width = widthOf(lying); canvas.height = heightOf(lying);
  canvas.getContext('2d', { willReadFrequently: true })!.drawImage(lying, 0, 0);
  return turned(shade(canvas, map, true), false);
}

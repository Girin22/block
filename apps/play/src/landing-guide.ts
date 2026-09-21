import * as THREE from 'three';
import { tileImages } from './tile-assets';

export type GuideKey = 'horizontal' | 'vertical';

// Sizes are CSS pixels on screen, so the guide stays equally crisp on every device.
const LINE_WIDTH = 1.5, DASH = 5, GAP = 4;
const FILL = 'rgba(167, 200, 151, 0.17)', LINE = 'rgba(196, 219, 182, 0.9)';

/** Follows the opaque silhouette clockwise (Moore neighbourhood). Points are 0..1 of the image. */
export function traceOutline(alpha: (x: number, y: number) => boolean, width: number, height: number): [number, number][] {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && alpha(x, y);
  let startX = -1, startY = -1;
  for (let y = 0; y < height && startX < 0; y++) for (let x = 0; x < width; x++) if (inside(x, y)) { startX = x; startY = y; break; }
  if (startX < 0) return [];
  // Clockwise on screen: E, SE, S, SW, W, NW, N, NE.
  const steps = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const points: [number, number][] = [];
  let x = startX, y = startY, heading = 7;
  for (let guard = 0; guard < (width + height) * 8; guard++) {
    points.push([(x + .5) / width, (y + .5) / height]);
    let moved = false;
    const first = (heading + (heading % 2 ? 6 : 7)) % 8;
    for (let i = 0; i < 8; i++) {
      const direction = (first + i) % 8, [dx, dy] = steps[direction];
      if (inside(x + dx, y + dy)) { x += dx; y += dy; heading = direction; moved = true; break; }
    }
    if (!moved || (x === startX && y === startY)) break;
  }
  return points;
}

/** Removes pixel stair-steps from a closed outline without shrinking its corners noticeably. */
export function smoothOutline(points: [number, number][], radius = 3, stride = 2): [number, number][] {
  const n = points.length;
  if (n < radius * 2 + 1) return points;
  const result: [number, number][] = [];
  for (let i = 0; i < n; i += stride) {
    let sx = 0, sy = 0;
    for (let k = -radius; k <= radius; k++) { const p = points[(i + k + n) % n]; sx += p[0]; sy += p[1]; }
    result.push([sx / (radius * 2 + 1), sy / (radius * 2 + 1)]);
  }
  return result;
}

/** The landing preview: a flat, even fill inside a crisp dashed outline of the real tile shape. */
export class LandingGuide {
  private outlines: Partial<Record<GuideKey, [number, number][]>> = {};
  private aspect: Partial<Record<GuideKey, number>> = {};
  private textures: Record<GuideKey, THREE.CanvasTexture>;
  private cellPixels = 0;
  private pixelRatio = 1;
  private disposed = false;

  constructor() {
    const make = () => {
      const texture = new THREE.CanvasTexture(document.createElement('canvas'));
      texture.colorSpace = THREE.SRGBColorSpace;
      // Drawn at the exact on-screen size, so no mip chain is wanted to soften the dashes.
      texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
      return texture;
    };
    this.textures = { horizontal: make(), vertical: make() };
    for (const key of ['horizontal', 'vertical'] as const) {
      const image = new Image();
      image.onload = () => {
        if (this.disposed) return;
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, image.width, image.height).data;
        const traced = traceOutline((x, y) => data[(y * image.width + x) * 4 + 3] > 127, image.width, image.height);
        this.outlines[key] = smoothOutline(traced);
        this.aspect[key] = image.width / image.height;
        this.draw(key);
      };
      image.src = tileImages[key];
    }
  }

  get ready() { return !!this.outlines.horizontal && !!this.outlines.vertical && this.cellPixels > 0; }
  texture(key: GuideKey) { return this.textures[key]; }

  /** cellPixels is device pixels per board cell; pixelRatio converts the CSS-sized dashes. */
  resize(cellPixels: number, pixelRatio: number) {
    if (Math.abs(cellPixels - this.cellPixels) < .5 && pixelRatio === this.pixelRatio) return;
    this.cellPixels = cellPixels; this.pixelRatio = pixelRatio;
    this.draw('horizontal'); this.draw('vertical');
  }

  private draw(key: GuideKey) {
    const outline = this.outlines[key], aspect = this.aspect[key];
    if (!outline || !aspect || !this.cellPixels) return;
    const texture = this.textures[key], canvas = texture.image as HTMLCanvasElement;
    // The artwork spans the same plane as the real tile: two cells plus bleed along its long side.
    const long = Math.round(this.cellPixels * 2.18), short = Math.round(long / Math.max(aspect, 1 / aspect));
    canvas.width = aspect > 1 ? long : short; canvas.height = aspect > 1 ? short : long;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    let perimeter = 0;
    outline.forEach(([u, v], index) => {
      const x = u * canvas.width, y = v * canvas.height;
      if (index) context.lineTo(x, y); else context.moveTo(x, y);
      const [pu, pv] = outline[(index + outline.length - 1) % outline.length];
      perimeter += Math.hypot(x - pu * canvas.width, y - pv * canvas.height);
    });
    context.closePath();
    context.fillStyle = FILL; context.fill();
    // Clip so the whole stroke sits inside the silhouette and never paints over a neighbour.
    context.save(); context.clip();
    const unit = (DASH + GAP) * this.pixelRatio, fit = perimeter / (Math.max(1, Math.round(perimeter / unit)) * unit);
    context.setLineDash([DASH * this.pixelRatio * fit, GAP * this.pixelRatio * fit]);
    context.lineWidth = LINE_WIDTH * this.pixelRatio * 2; context.lineJoin = 'round'; context.strokeStyle = LINE;
    context.stroke(); context.restore();
    // The canvas size may have changed; release the old GPU storage before re-uploading.
    texture.dispose(); texture.needsUpdate = true;
  }

  dispose() { this.disposed = true; this.textures.horizontal.dispose(); this.textures.vertical.dispose(); }
}

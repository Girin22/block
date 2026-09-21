import * as THREE from 'three';
import { type Rotation } from '../../../packages/play-core';
import { TILE_BLEED, tileImages } from './tile-assets';

// Figma values at the source artwork's scale (approximately 148px per cell).
const SOURCE_CELL = 148;
const BLUR = 41;
const PADDING = Math.ceil(BLUR * 1.5);
const OFFSET_X = -26 / SOURCE_CELL, OFFSET_Y = -40 / SOURCE_CELL;

// Horizontal block, vertical block, and the square white filler.
const SHAPES = [
  { url: tileImages.horizontal, w: 2, h: 1 },
  { url: tileImages.vertical, w: 1, h: 2 },
  { url: tileImages.center, w: 1, h: 1 },
];
const SQUARE = 2;

/** One cached alpha mask per shape; no blur/filter work in the animation loop. */
export class FallingShadow {
  readonly mesh: THREE.Mesh;
  private material = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  private geometries = SHAPES.map(({ w, h }) =>
    new THREE.PlaneGeometry(w + TILE_BLEED + PADDING * 2 / SOURCE_CELL, h + TILE_BLEED + PADDING * 2 / SOURCE_CELL));
  private maps: (THREE.CanvasTexture | undefined)[] = [];
  private disposed = false;

  constructor() {
    this.mesh = new THREE.Mesh(this.geometries[0], this.material);
    for (const [index, { url }] of SHAPES.entries()) {
      const image = new Image();
      image.onload = () => {
        if (this.disposed) return;
        const canvas = document.createElement('canvas');
        canvas.width = image.width + PADDING * 2; canvas.height = image.height + PADDING * 2;
        const context = canvas.getContext('2d');
        if (!context) return;
        // Figma blur radius maps to approximately half that Gaussian sigma.
        context.filter = `blur(${BLUR / 2}px)`;
        context.drawImage(image, PADDING, PADDING);
        context.filter = 'none'; context.globalCompositeOperation = 'source-in';
        context.fillStyle = '#000'; context.fillRect(0, 0, canvas.width, canvas.height);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        this.maps[index] = texture;
      };
      image.src = url;
    }
  }

  update(active: THREE.Mesh, rotation: Rotation, spin: number, landingY: number) {
    const index = rotation % 2;
    this.mesh.geometry = this.geometries[index];
    this.cast(this.mesh, index, active, active.position.y - SHAPES[index].h / 2 - landingY, 1);
    this.mesh.rotation.z = active.rotation.z - spin;
  }

  /** An extra shadow for a white filler lowering itself; it shares the cached mask and geometry. */
  spawnSquare() { return new THREE.Mesh(this.geometries[SQUARE], this.material.clone()); }
  updateSquare(shadow: THREE.Mesh, target: THREE.Mesh, gap: number, strength: number) { this.cast(shadow, SQUARE, target, gap, strength); }

  private cast(shadow: THREE.Mesh, index: number, target: THREE.Mesh, gap: number, strength: number) {
    const map = this.maps[index], material = shadow.material as THREE.MeshBasicMaterial;
    shadow.visible = target.visible && !!map;
    if (!map) return;
    if (material.map !== map) { material.map = map; material.needsUpdate = true; }
    // The shadow tightens and fades as the tile nears the ground, and is gone on contact.
    const t = Math.min(1, Math.max(0, gap) / 1.2), lift = t * t * (3 - 2 * t);
    material.opacity = 0.4 * lift * strength;
    shadow.position.copy(target.position);
    shadow.position.x += OFFSET_X * (.25 + .75 * lift);
    shadow.position.y += OFFSET_Y * (.25 + .75 * lift);
    shadow.position.z = .04;
  }

  dispose() {
    this.disposed = true;
    this.geometries.forEach(geometry => geometry.dispose());
    this.maps.forEach(texture => texture?.dispose()); this.material.dispose();
  }
}

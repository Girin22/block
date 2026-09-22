// Three 3-cell-wide interlocking motifs fit side by side.
export const WIDTH = 9;
export const MAX_SESSION_BLOCKS = 24 * 60 * 60 * 2;
export type Rotation = 0 | 1 | 2 | 3;
// Every block enters upright in the exact middle column. A two-wide block cannot be centred on an
// odd board, a one-wide upright block can.
export const SPAWN_ROTATION: Rotation = 1;
export const SPAWN_X = Math.floor((WIDTH - 1) / 2);
export interface Tile { id: number; x: number; y: number; w: number; h: number; rotation: Rotation; white: boolean; }
export function size(rotation: Rotation) { return rotation % 2 ? { w: 1, h: 2 } : { w: 2, h: 1 }; }
export const COLORS = ['#408d6c', '#4b9976', '#398665', '#519a78'];
export function tileColor(tile: Tile) { return tile.white ? '#f5f0df' : COLORS[(tile.id - 1) % COLORS.length]; }

export class Pavement {
  readonly tiles: Tile[] = [];
  private cells = new Map<string, number>();
  private columns = Array<number>(WIDTH).fill(0);
  private floor = 0;
  get floorY() { return this.floor; }
  height = 0;
  private placedBlocks = 0;
  get greens() { return this.placedBlocks; }
  get atLimit() { return this.placedBlocks >= MAX_SESSION_BLOCKS; }
  landing(x: number, rotation: Rotation) {
    const { w, h } = size(rotation);
    x = Math.max(0, Math.min(WIDTH - w, Math.round(x)));
    let y = this.floor;
    for (let column = x; column < x + w; column++) y = Math.max(y, this.columns[column]);
    return { x, y, w, h, rotation };
  }
  advanceFloor(y: number) {
    if (y <= this.floor) return;
    this.floor = Math.floor(y);
    // Full tile history remains for export; collision data only needs the active band.
    for (const key of this.cells.keys()) if (Number(key.split(',')[1]) < this.floor - 1) this.cells.delete(key);
  }
  canPlace(x: number, y: number, rotation: Rotation): boolean {
    const { w, h } = size(rotation);
    if (!Number.isInteger(x) || x < 0 || x + w > WIDTH || y < this.floor - 0.00001) return false;
    for (let cx = x; cx < x + w; cx++) {
      for (let cy = Math.floor(y + 0.00001); cy < Math.ceil(y + h - 0.00001); cy++) {
        if (this.cells.has(`${cx},${cy}`)) return false;
      }
    }
    return true;
  }
  landingFrom(x: number, y: number, rotation: Rotation) {
    if (!this.canPlace(x, y, rotation)) throw new Error('Active tile overlaps the board');
    const { w, h } = size(rotation);
    let bottom = this.floor;
    for (let cx = x; cx < x + w; cx++) {
      for (let cy = Math.floor(y + 0.00001) - 1; cy >= bottom; cy--) {
        if (this.cells.has(`${cx},${cy}`)) { bottom = Math.max(bottom, cy + 1); break; }
      }
    }
    return { x, y: bottom, w, h, rotation };
  }
  moveSide(x: number, y: number, target: number, rotation: Rotation): number {
    target = Math.max(0, Math.min(WIDTH - size(rotation).w, Math.round(target)));
    const step = Math.sign(target - x);
    while (x !== target && this.canPlace(x + step, y, rotation)) x += step;
    return x;
  }
  rotateAt(x: number, y: number, rotation: Rotation): number | undefined {
    // A small sideways wall kick, never a vertical lift or a jump across tiles.
    for (const offset of [0, -1, 1]) {
      if (this.canPlace(x + offset, y, rotation)) return x + offset;
    }
    return undefined;
  }
  drop(x: number, rotation: Rotation): Tile[] {
    const p = this.landing(x, rotation);
    return this.place(p.x, p.y, rotation);
  }
  place(x: number, y: number, rotation: Rotation): Tile[] {
    if (this.atLimit) throw new Error('Session block limit reached');
    if (!Number.isInteger(y) || !this.canPlace(x, y, rotation) || this.landingFrom(x, y, rotation).y !== y) throw new Error('Tile must land in a free supported position');
    const tile = this.insert({ x, y, ...size(rotation), rotation, white: false });
    this.placedBlocks++;
    const added = [tile];
    // Any isolated single cell qualifies; diagonals and neighboring tile types do not matter.
    // Board walls and the active floor also close a side.
    const blocked = (x: number, y: number) => x < 0 || x >= WIDTH || y < this.floor || this.cells.has(`${x},${y}`);
    for (let cy = Math.max(this.floor, tile.y - 1); cy <= tile.y + tile.h; cy++) {
      for (let cx = Math.max(0, tile.x - 1); cx <= Math.min(WIDTH - 1, tile.x + tile.w); cx++) {
        if (this.cells.has(`${cx},${cy}`)) continue;
        if (blocked(cx - 1, cy) && blocked(cx + 1, cy) && blocked(cx, cy - 1) && blocked(cx, cy + 1)) {
          added.push(this.insert({ x: cx, y: cy, w: 1, h: 1, rotation: 0, white: true }));
        }
      }
    }
    return added;
  }
  private insert(data: Omit<Tile, 'id'>): Tile {
    const tile = { ...data, id: this.tiles.length + 1 }; this.tiles.push(tile);
    for (let x = tile.x; x < tile.x + tile.w; x++) {
      for (let y = tile.y; y < tile.y + tile.h; y++) this.cells.set(`${x},${y}`, tile.id);
      this.columns[x] = Math.max(this.columns[x], tile.y + tile.h);
    }
    this.height = Math.max(this.height, tile.y + tile.h); return tile;
  }
}

/** Rotationally symmetric edge warp: the curved keys fit in every orientation. */
export function contour(w: number, h: number): [number, number][] {
  const points: [number, number][] = [], radius = 0.10;
  const add = (x: number, y: number) => points.push([x + 0.115 * Math.sin(y * Math.PI * 2) - w / 2, y - 0.115 * Math.sin(x * Math.PI * 2) - h / 2]);
  const line = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 20);
    for (let i = 0; i < n; i++) add(ax + (bx - ax) * i / n, ay + (by - ay) * i / n);
  };
  const arc = (x: number, y: number, angle: number) => {
    for (let i = 0; i < 8; i++) { const a = angle + i / 8 * Math.PI / 2; add(x + Math.cos(a) * radius, y + Math.sin(a) * radius); }
  };
  line(radius, 0, w - radius, 0); arc(w - radius, radius, -Math.PI / 2);
  line(w, radius, w, h - radius); arc(w - radius, h - radius, 0);
  line(w - radius, h, radius, h); arc(radius, h - radius, Math.PI / 2);
  line(0, h - radius, 0, radius); arc(radius, radius, Math.PI);
  return points;
}

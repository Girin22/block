// Three 3-cell-wide interlocking motifs fit side by side.
export const WIDTH = 9;
export const MAX_SESSION_BLOCKS = 24 * 60 * 60 * 2;
export type Rotation = 0 | 1 | 2 | 3;
// Every block enters upright in the exact middle column. A two-wide block cannot be centred on an
// odd board, a one-wide upright block can.
export const SPAWN_ROTATION: Rotation = 1;
export const SPAWN_X = Math.floor((WIDTH - 1) / 2);
/** One cell is half a real interlocking paver: 225 × 112.5 mm, so 11.25 cm along the path. */
export const CELL_METERS = 0.1125;
/** Length of path actually paved: every filled cell, green or white, spread across the full width. */
export function pathMeters(cells: number) { return cells / WIDTH * CELL_METERS; }
export function formatMeters(cells: number) { return `${pathMeters(cells).toFixed(1)}미터`; }
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
  private filledCells = 0;
  get greens() { return this.placedBlocks; }
  /** Filled cells, white fillers included. */
  get filled() { return this.filledCells; }
  get atLimit() { return this.placedBlocks >= MAX_SESSION_BLOCKS; }
  landing(x: number, rotation: Rotation) {
    const { w, h } = size(rotation);
    x = Math.max(0, Math.min(WIDTH - w, Math.round(x)));
    let y = this.floor;
    for (let column = x; column < x + w; column++) y = Math.max(y, this.columns[column]);
    return { x, y, w, h, rotation };
  }
  /** The floor only limits where the active block can land. Every cell stays known so that a
   *  space the player closes off later can be filled all the way down, even below the screen. */
  advanceFloor(y: number) {
    if (y <= this.floor) return;
    this.floor = Math.floor(y);
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
    // Every empty space this block just sealed off is paved with white fillers, lowest row first.
    for (const region of this.enclosedAround(tile)) {
      for (const piece of tileRegion(region)) added.push(this.insert({ ...piece, white: true }));
    }
    return added;
  }
  private empty(x: number, y: number) { return x >= 0 && x < WIDTH && y >= 0 && !this.cells.has(`${x},${y}`); }
  /** Empty regions touching the tile that can no longer reach the open sky. Walls, the ground and
   *  tiles bound a region; the camera floor does not, so a space can extend below the screen. */
  private enclosedAround(tile: Tile): Cell[][] {
    const regions: Cell[][] = [], seen = new Set<string>();
    for (let cy = tile.y - 1; cy <= tile.y + tile.h; cy++) {
      for (let cx = tile.x - 1; cx <= tile.x + tile.w; cx++) {
        const edge = cy < tile.y || cy >= tile.y + tile.h, side = cx < tile.x || cx >= tile.x + tile.w;
        if (edge === side || !this.empty(cx, cy) || seen.has(`${cx},${cy}`)) continue;
        const region = this.flood(cx, cy, seen);
        if (region) regions.push(region);
      }
    }
    return regions;
  }
  /** Highest cells first: an open region reaches the sky quickly, an enclosed one is walked whole. */
  private flood(x: number, y: number, seen: Set<string>): Cell[] | undefined {
    const rows = new Map<number, Cell[]>(); let top = y;
    const push = (x: number, y: number) => {
      const key = `${x},${y}`; if (seen.has(key)) return; seen.add(key);
      let row = rows.get(y); if (!row) rows.set(y, row = []); row.push([x, y]); if (y > top) top = y;
    };
    push(x, y);
    const cells: Cell[] = [];
    while (true) {
      while (top >= 0 && !rows.get(top)?.length) top--;
      if (top < 0) return cells;
      const [cx, cy] = rows.get(top)!.pop()!;
      // Nothing sits at or above the stack's height, so a region that gets there is open.
      if (cy >= this.height) return undefined;
      cells.push([cx, cy]);
      if (this.empty(cx - 1, cy)) push(cx - 1, cy);
      if (this.empty(cx + 1, cy)) push(cx + 1, cy);
      if (this.empty(cx, cy - 1)) push(cx, cy - 1);
      if (this.empty(cx, cy + 1)) push(cx, cy + 1);
    }
  }
  private insert(data: Omit<Tile, 'id'>): Tile {
    const tile = { ...data, id: this.tiles.length + 1 }; this.tiles.push(tile);
    this.filledCells += tile.w * tile.h;
    for (let x = tile.x; x < tile.x + tile.w; x++) {
      for (let y = tile.y; y < tile.y + tile.h; y++) this.cells.set(`${x},${y}`, tile.id);
      this.columns[x] = Math.max(this.columns[x], tile.y + tile.h);
    }
    this.height = Math.max(this.height, tile.y + tile.h); return tile;
  }
}

export type Cell = [number, number];
export interface Piece { x: number; y: number; w: number; h: number; rotation: Rotation; }

/**
 * Paves a sealed region with white 1×1, 2×1 and 1×2 fillers, bottom row first and left to right, in
 * the order they will be laid. Where both long shapes fit, the choice alternates on a checkerboard so
 * the joints weave like the green pattern instead of lining up into long seams.
 */
export function tileRegion(cells: readonly Cell[]): Piece[] {
  const free = new Set(cells.map(([x, y]) => `${x},${y}`));
  const pieces: Piece[] = [];
  for (const [x, y] of cells.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0])) {
    if (!free.has(`${x},${y}`)) continue;
    const up = free.has(`${x},${y + 1}`), right = free.has(`${x + 1},${y}`);
    const tall = up && (!right || (x + y) % 2 === 1);
    const w = !tall && right ? 2 : 1, h = tall ? 2 : 1;
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) free.delete(`${x + dx},${y + dy}`);
    pieces.push({ x, y, w, h, rotation: h === 2 ? 1 : 0 });
  }
  return pieces;
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

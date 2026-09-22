import * as THREE from 'three';
import { followCamera } from './camera-motion';
import { dropDuration, dropProgress, fillAltitude, fillGap, fillOpacity, fillTilt, FILL_LANDS, FILL_LIFT, FILL_STAGGER, liftScale } from './drop-motion';
import { size, WIDTH, SPAWN_ROTATION, SPAWN_X, type Pavement, type Rotation, type Tile } from '../../../packages/play-core';

import { TILE_BLEED, tileImage, tileImages, type TileImage } from './tile-assets';
import { FallingShadow } from './falling-shadow';
import { LandingGuide } from './landing-guide';
import { wetTint, type Rain } from './rain';

const VIEW_WIDTH = WIDTH + .28;
const DRY_GROUND = new THREE.Color('#2c2929'), WET_GROUND = new THREE.Color('#202427');

function geometry(rotation: number, white = false) {
  const plane = new THREE.PlaneGeometry((white ? 1 : 2) + TILE_BLEED, 1 + TILE_BLEED);
  // Counter-rotate UVs so each supplied image keeps its original lighting at rest.
  const uv = plane.getAttribute('uv'), angle = rotation * Math.PI / 2;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i) - .5, v = uv.getY(i) - .5;
    uv.setXY(i, .5 + Math.cos(angle) * u - Math.sin(angle) * v, .5 + Math.sin(angle) * u + Math.cos(angle) * v);
  }
  return plane;
}
export class PlayScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-VIEW_WIDTH / 2, VIEW_WIDTH / 2, 8, -8, 0.1, 100);
  private dominoes = [0, 1, 2, 3].map(rotation => geometry(rotation));
  private square = geometry(0, true);
  private textures = new Map<string, THREE.Texture>();
  private materials = new Map<string, THREE.MeshBasicMaterial>();
  private settled = new Map<number, THREE.Mesh>();
  private active: THREE.Mesh;
  private ghost: THREE.Mesh;
  private fallingShadow: FallingShadow;
  private guide = new LandingGuide();
  private frameTiles = new Map<string, THREE.Mesh>();
  private halfHeight = 8;
  private center = 7.4;
  private cameraVelocity = 0;
  private x = SPAWN_X;
  private rotation: Rotation = SPAWN_ROTATION;
  private spin = SPAWN_ROTATION * Math.PI / 2;
  private controlledY?: number;
  private held = false;
  private started = false;
  private contactTime = 0;
  private paused = false;
  private raf = 0;
  private last = 0;
  private animationTime = 0;
  private dropping?: { from: THREE.Vector3; to: THREE.Vector3; elapsed: number; duration: number; done: () => void };
  // Block motion is the game itself and stays the same everywhere. Only the camera, whose movement
  // covers the whole screen, honours the system's reduce-motion setting by jumping instead of gliding.
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private observer: ResizeObserver;
  /** Fires as a white filler seats on screen; the game plays its sound here. */
  onFillSeat?: () => void;
  constructor(private canvas: HTMLCanvasElement, private board: Pavement, private onAutoLand: () => void, private rain?: Rain) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.background = DRY_GROUND.clone();
    this.fallingShadow = new FallingShadow(); this.scene.add(this.fallingShadow.mesh);
    this.active = new THREE.Mesh(this.dominoes[0], this.material('horizontal')); this.scene.add(this.active);
    this.ghost = new THREE.Mesh(this.dominoes[0], new THREE.MeshBasicMaterial({ map: this.guide.texture('horizontal'), transparent: true, depthWrite: false, toneMapped: false }));
    this.ghost.scale.z = 0.04; this.scene.add(this.ghost);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize();
    this.spawn();
    this.frame(0);
  }
  private material(key: TileImage) {
    if (!this.materials.has(key)) {
      const texture = new THREE.TextureLoader().load(tileImages[key]);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      this.textures.set(key, texture);
      this.materials.set(key, new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .02, depthWrite: false, toneMapped: false }));
    }
    return this.materials.get(key)!;
  }
  private orient() {
    this.active.geometry = this.ghost.geometry = this.dominoes[this.rotation];
    const material = this.material(this.rotation % 2 ? 'vertical' : 'horizontal');
    this.active.material = material;
    (this.ghost.material as THREE.MeshBasicMaterial).map = this.guide.texture(this.rotation % 2 ? 'vertical' : 'horizontal');
  }
  private updateFrame() {
    const visible = new Set<string>();
    const add = (key: string, x: number, y: number, vertical: boolean) => {
      visible.add(key);
      let mesh = this.frameTiles.get(key);
      if (!mesh) {
        const rotation = vertical ? 1 : 0;
        mesh = new THREE.Mesh(this.dominoes[rotation], this.material(vertical ? 'vertical' : 'horizontal'));
        mesh.rotation.z = rotation * Math.PI / 2; mesh.renderOrder = -1;
        this.scene.add(mesh); this.frameTiles.set(key, mesh);
      }
      mesh.position.set(x, y, 0);
    };
    // World-grid-aligned edges stay interlocked as the camera follows the stack.
    const bottom = Math.floor((this.center - this.halfHeight) / 2) - 1;
    const top = Math.ceil((this.center + this.halfHeight) / 2) + 1;
    for (let row = bottom; row <= top; row++) {
      add(`left-${row}`, -.5, row * 2 + 1, true);
      add(`right-${row}`, WIDTH + .5, row * 2 + 1, true);
    }
    // The bottom row belongs to the real ground only. Higher up, the pavement's own gaps show.
    if (this.center - this.halfHeight < 1) for (let column = -2; column < WIDTH + 2; column += 2) add(`bottom-${column}`, column + 1, -.5, false);
    for (const [key, mesh] of this.frameTiles) {
      if (!visible.has(key)) { this.scene.remove(mesh); this.frameTiles.delete(key); }
    }
  }
  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const oldCenter = this.center;
    this.renderer.setSize(w, h, false);
    this.guide.resize(w / VIEW_WIDTH * this.renderer.getPixelRatio(), this.renderer.getPixelRatio());
    this.halfHeight = VIEW_WIDTH / 2 * h / w;
    this.camera.top = this.halfHeight; this.camera.bottom = -this.halfHeight; this.camera.updateProjectionMatrix();
    this.center = Math.max(this.halfHeight - 0.12, this.board.height + 0.6);
    if (this.controlledY !== undefined && !this.dropping) {
      const y = this.controlledY + this.center - oldCenter;
      this.controlledY = this.board.canPlace(this.x, y, this.rotation) ? y : Math.max(y, this.board.landing(this.x, this.rotation).y);
    }
    this.cameraVelocity = 0;
  }
  get busy() { return this.board.atLimit || !!this.dropping; }
  get cellPixels() { return this.canvas.clientWidth / VIEW_WIDTH; }
  get activeY() { return this.controlledY ?? this.center + (this.halfHeight - 2.2) - size(this.rotation).h / 2; }
  get canRelease() {
    // Use the tile's lower edge in the current camera, not the finger or world origin.
    const edge = new THREE.Vector3(this.x + size(this.rotation).w / 2, this.activeY, 0.12).project(this.camera);
    // NDC -1 is the bottom and +1 is the top: 75% from bottom is +0.5.
    return edge.y < 0.5;
  }
  start() { this.started = true; }
  beginDrag() { this.start(); this.controlledY = this.activeY; this.held = true; this.contactTime = 0; }
  endDrag() { this.held = false; this.contactTime = 0; }
  lower(distance: number) {
    const bottom = this.activeY;
    this.controlledY = Math.max(this.board.landingFrom(this.x, bottom, this.rotation).y, bottom - Math.max(0, distance));
  }
  aim(x: number, rotation: Rotation) {
    const previousX = this.x;
    const bottom = this.activeY;
    if (rotation !== this.rotation) {
      const kickedX = this.board.rotateAt(this.x, bottom, rotation);
      if (kickedX === undefined) return false;
      this.x = kickedX;
    } else {
      this.x = this.board.moveSide(this.x, bottom, x, rotation);
    }
    if (this.controlledY !== undefined) this.controlledY = bottom;
    this.spin += ((rotation - this.rotation + 4) % 4) * Math.PI / 2;
    if (this.x !== previousX || rotation !== this.rotation) this.contactTime = 0;
    this.rotation = rotation; this.orient();
    return true;
  }
  get column() { return this.x; }
  spawn() {
    this.held = false; this.contactTime = 0;
    this.controlledY = undefined; this.x = SPAWN_X; this.rotation = SPAWN_ROTATION; this.spin = SPAWN_ROTATION * Math.PI / 2;
    this.active.position.set(SPAWN_X + size(SPAWN_ROTATION).w / 2, this.center + (this.halfHeight - 2.2), 0.12);
    this.active.rotation.z = this.spin; this.orient();
  }
  drop(done: () => void) {
    if (this.busy) return;
    const p = this.board.landingFrom(this.x, this.activeY, this.rotation);
    this.dropping = {
      from: this.active.position.clone(), to: new THREE.Vector3(p.x + p.w / 2, p.y + p.h / 2, 0),
      elapsed: 0, duration: dropDuration(this.activeY - p.y), done,
    };
    this.ghost.visible = false;
  }
  /** Pass animate = false for tiles that were already part of the board (restored fixtures). */
  add(tiles: Tile[], animate = true) {
    // Fillers of one placement are laid in order, a beat apart; a long run only sounds now and then.
    const whites = tiles.filter(tile => tile.white).length, soundEvery = Math.max(1, Math.ceil(whites / 24));
    let order = 0;
    for (const tile of tiles) {
      const image = tileImage(tile);
      const mesh = new THREE.Mesh(tile.white && tile.w === 1 && tile.h === 1 ? this.square : this.dominoes[tile.rotation], this.material(image));
      mesh.position.set(tile.x + tile.w / 2, tile.y + tile.h / 2, 0);
      mesh.rotation.z = tile.rotation * Math.PI / 2;
      mesh.renderOrder = tile.id;
      mesh.userData.born = this.animationTime; mesh.userData.white = tile.white; mesh.userData.image = image;
      mesh.userData.baseY = tile.y; mesh.userData.height = tile.h;
      this.scene.add(mesh); this.settled.set(tile.id, mesh);
      if (!tile.white || !animate) continue;
      // Lowered from just above: its own fading material and shadow exist only until it seats.
      mesh.userData.born = this.animationTime + order * FILL_STAGGER; mesh.userData.sound = order % soundEvery === 0;
      mesh.userData.spin = mesh.rotation.z; order++;
      const material = this.material(image).clone(); material.opacity = 0; mesh.material = material;
      const shadow = this.fallingShadow.spawn(image); shadow.renderOrder = tile.id - .5;
      mesh.userData.shadow = shadow; this.scene.add(shadow);
    }
  }
  private seat(mesh: THREE.Mesh) {
    const shadow = mesh.userData.shadow as THREE.Mesh | undefined;
    if (!shadow) return;
    this.scene.remove(shadow); (shadow.material as THREE.Material).dispose();
    (mesh.material as THREE.Material).dispose(); mesh.material = this.material(mesh.userData.image as TileImage);
    mesh.position.set(mesh.position.x, mesh.userData.baseY + mesh.userData.height / 2, 0); mesh.scale.set(1, 1, 1);
    mesh.rotation.z = mesh.userData.spin; mesh.userData.shadow = undefined;
  }
  pause(value: boolean) {
    this.paused = value;
    // A paused summary shows completed joins, never a half-grown white filler.
    if (value) for (const mesh of this.settled.values()) mesh.userData.born = Math.min(mesh.userData.born, this.animationTime - .5);
  }
  dispose() {
    cancelAnimationFrame(this.raf); this.observer.disconnect();
    for (const mesh of this.settled.values()) this.seat(mesh);
    this.dominoes.forEach(geometry => geometry.dispose()); this.square.dispose(); this.fallingShadow.dispose(); this.guide.dispose();
    (this.ghost.material as THREE.Material).dispose();
    this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose()); this.renderer.dispose();
  }
  private frame = (now: number) => {
    const elapsed = Math.min(0.05, Math.max(0, (now - this.last) / 1000)), dt = this.paused ? 0 : elapsed; this.last = now; this.animationTime += dt;
    const targetCenter = Math.max(this.halfHeight - 0.12, this.board.height + 0.6);
    const oldCenter = this.center;
    if (dt > 0) {
      const next = followCamera(this.center, this.cameraVelocity, targetCenter, dt);
      this.center = this.reduced ? targetCenter : next.position;
      this.cameraVelocity = this.reduced ? 0 : next.velocity;
    }
    if (this.controlledY !== undefined) this.controlledY += this.center - oldCenter;
    if (!this.dropping && !this.held) this.board.advanceFloor(Math.max(0, Math.floor(this.center - this.halfHeight + 0.5)));
    this.camera.position.set(WIDTH / 2, this.center, 22); this.camera.lookAt(WIDTH / 2, this.center, 0);
    this.updateFrame();
    if (this.rain) {
      // Weather keeps its own clock: it goes on falling over a paused board.
      this.rain.frame(elapsed, { widthPx: this.canvas.clientWidth, heightPx: this.canvas.clientHeight, cellPx: this.cellPixels, left: (WIDTH - VIEW_WIDTH) / 2, top: this.center + this.halfHeight });
      const [r, g, b] = wetTint(this.rain.wetness);
      for (const material of this.materials.values()) material.color.setRGB(r, g, b, THREE.SRGBColorSpace);
      (this.scene.background as THREE.Color).lerpColors(DRY_GROUND, WET_GROUND, this.rain.wetness);
    }
    this.active.visible = !this.board.atLimit && !this.paused;
    if (this.paused) this.ghost.visible = false;
    this.ghost.renderOrder = this.board.tiles.length + 1; this.fallingShadow.mesh.renderOrder = this.board.tiles.length + 2; this.active.renderOrder = this.board.tiles.length + 3;
    if (!this.board.atLimit && this.started && !this.held && !this.dropping && dt > 0) {
      const bottom = this.board.landingFrom(this.x, this.activeY, this.rotation).y;
      this.controlledY = Math.max(bottom, this.activeY - dt * 1.1);
      this.contactTime = this.controlledY <= bottom + 0.00001 ? this.contactTime + dt : 0;
      if (this.contactTime >= 0.45) { this.contactTime = 0; this.onAutoLand(); }
    }
    const p = this.board.landingFrom(this.x, this.activeY, this.rotation);
    this.ghost.position.set(p.x + p.w / 2, p.y + p.h / 2, 0.015); this.ghost.rotation.z = this.spin;
    if (this.dropping) {
      const drop = this.dropping; drop.elapsed += dt;
      const t = Math.min(1, drop.elapsed / drop.duration);
      this.active.position.lerpVectors(drop.from, drop.to, dropProgress(t));
      if (t === 1) { this.dropping = undefined; drop.done(); }
    } else {
      const targetX = p.x + p.w / 2;
      this.active.position.x += (targetX - this.active.position.x) * (1 - Math.exp(-dt * 26));
      this.active.position.y = this.activeY + size(this.rotation).h / 2;
      this.active.position.z = 0.12;
      this.ghost.visible = !this.board.atLimit && !this.paused && this.guide.ready;
    }
    // A rigid paver lowered into its socket: slightly nearer the camera in the air, exact size on contact.
    const lift = liftScale(this.active.position.y - size(this.rotation).h / 2 - p.y);
    this.active.scale.set(lift, lift, 1);
    this.active.rotation.z += (this.spin - this.active.rotation.z) * (1 - Math.exp(-dt * 28));
    this.fallingShadow.update(this.active, this.rotation, this.spin, this.board.landingFrom(this.x, this.activeY, this.rotation).y);
    for (const [id, mesh] of this.settled) {
      if (mesh.position.y < this.center - this.halfHeight - 3) { this.seat(mesh); this.scene.remove(mesh); this.settled.delete(id); continue; }
      const shadow = mesh.userData.shadow as THREE.Mesh | undefined;
      if (!shadow) continue;
      // The white filler is lowered straight onto its slot: accelerating, rigid, flush on contact.
      const age = this.animationTime - mesh.userData.born;
      if (age >= FILL_LANDS) { this.seat(mesh); if (mesh.userData.sound && dt > 0) this.onFillSeat?.(); continue; }
      const altitude = fillAltitude(age), opacity = fillOpacity(age), lift = 1 + FILL_LIFT * altitude;
      (mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
      mesh.position.y = mesh.userData.baseY + mesh.userData.height / 2 + fillGap(age); mesh.position.z = .1; mesh.scale.set(lift, lift, 1);
      // Slightly turned on arrival, straight by the time it is wedged in.
      const tilt = fillTilt(age); mesh.rotation.z = mesh.userData.spin + tilt;
      // The shadow, not the travel, carries the height: 1.2 cells is its full separation.
      this.fallingShadow.updateSpawned(shadow, mesh, 1.2 * altitude, opacity, tilt);
    }
    this.renderer.render(this.scene, this.camera); this.raf = requestAnimationFrame(this.frame);
  };
}

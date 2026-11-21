import single from '../../../assets/images/christmas/white-single.png?url';
import { tileRandom } from './halloween';
import { tuning } from './tuning';

/**
 * Gift blocks (a Christmas option, tuning.giftWrap): every one-cell filler arrives wrapped in paper
 * with a ribbon. Tapping it tears the paper off and shows the white paver underneath with one of four
 * ornaments set into the stone: a Santa hat, a gingerbread man, a star, or a shiny bauble (fixed by the
 * tile's id). The pictures are drawn here, on the filler's own picture, so they keep its outline and
 * its shading, and the saved image shows each gift as it is on screen.
 */
export const ORNAMENTS = ['hat', 'gingerbread', 'star', 'bauble'] as const;
export type Ornament = typeof ORNAMENTS[number];
export function ornamentOf(id: number): Ornament { return ORNAMENTS[Math.floor(tileRandom(id, 11) * ORNAMENTS.length)]; }

export const giftsOn = () => tuning.giftWrap === 1;
/** Whether this one-cell filler comes as a gift: the planner's share of them, fixed by the tile's id. */
export const isGiftTile = (id: number) => giftsOn() && tileRandom(id, 12) * 100 < tuning.giftChance;
const opened = new Set<number>();
export const isOpened = (id: number) => opened.has(id);
export function openGift(id: number) { opened.add(id); }
/** A new session wraps everything again. */
export function resetGifts() { opened.clear(); }

let art: { wrapped: string; open: Record<Ornament, string> } | undefined;
let preparing: Promise<void> | undefined;
/** Draws the pictures once; until they are ready the fillers stay plain. */
export function prepareGifts() {
  return preparing ??= new Promise<void>(resolve => {
    const base = new Image();
    base.onload = () => {
      art = { wrapped: wrappedPicture(base), open: Object.fromEntries(ORNAMENTS.map(name => [name, openPicture(base, name)])) as Record<Ornament, string> };
      resolve();
    };
    base.onerror = () => resolve();
    base.src = single;
  });
}
/** The picture a one-cell filler wears while gifts are on, or nothing if they are off or not drawn yet. */
export function giftPicture(id: number) {
  if (!isGiftTile(id) || !art) return undefined;
  return opened.has(id) ? art.open[ornamentOf(id)] : art.wrapped;
}

/** Felt and icing colours, kept close to the pavers' own: nothing brighter than the red block. */
const RED = '#c2534f', GREEN = '#4c8467', GOLD = '#dcae52', CREAM = '#f4ead6', BROWN = '#b27c49', INK = '#3b302c';
/** Pictures are drawn at twice the filler's own size, so they stay crisp in the saved image. */
const SIZE = 350, MID = SIZE / 2;

function canvasOf() { const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE; return canvas; }
/** Keeps only what lies on the paver, with the stone's own light and grain over whatever was drawn. */
function seat(context: CanvasRenderingContext2D, base: HTMLImageElement, grain: number) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = 'multiply'; context.globalAlpha = grain; context.drawImage(base, 0, 0, SIZE, SIZE);
  context.globalCompositeOperation = 'destination-in'; context.globalAlpha = 1; context.drawImage(base, 0, 0, SIZE, SIZE);
  context.globalCompositeOperation = 'source-over';
}

/** Wrapped: green paper with small cream dots, a cream ribbon crossed over it and a bow where it crosses. */
function wrappedPicture(base: HTMLImageElement) {
  const canvas = canvasOf(), context = canvas.getContext('2d')!;
  context.drawImage(base, 0, 0, SIZE, SIZE);
  context.globalCompositeOperation = 'multiply'; context.fillStyle = GREEN; context.fillRect(0, 0, SIZE, SIZE);
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = CREAM; context.globalAlpha = 0.55;
  for (let row = -1; row < 9; row++) for (let column = -1; column < 9; column++) {
    context.beginPath(); context.arc(column * 46 + (row % 2 ? 23 : 0), row * 40 + 12, 5, 0, Math.PI * 2); context.fill();
  }
  context.globalAlpha = 1;
  const band = 46;
  for (const upright of [true, false]) {
    context.fillStyle = CREAM; context.fillRect(upright ? MID - band / 2 : 0, upright ? 0 : MID - band / 2, upright ? band : SIZE, upright ? SIZE : band);
    // A folded edge along each side of the ribbon.
    context.fillStyle = '#d9c9a8';
    for (const edge of [-band / 2, band / 2 - 5]) context.fillRect(upright ? MID + edge : 0, upright ? 0 : MID + edge, upright ? 5 : SIZE, upright ? SIZE : 5);
  }
  // The bow: two loops and a knot.
  context.translate(MID, MID);
  for (const side of [-1, 1]) {
    context.save(); context.rotate(side * 0.5); context.translate(side * 44, -6);
    context.beginPath(); context.ellipse(0, 0, 40, 25, 0, 0, Math.PI * 2);
    context.fillStyle = GOLD; context.fill(); context.lineWidth = 4; context.strokeStyle = '#b98a37'; context.stroke();
    context.beginPath(); context.ellipse(side * -4, 0, 17, 9, 0, 0, Math.PI * 2); context.fillStyle = '#c3963f'; context.fill();
    context.restore();
  }
  context.beginPath(); context.arc(0, 0, 19, 0, Math.PI * 2); context.fillStyle = GOLD; context.fill(); context.lineWidth = 4; context.strokeStyle = '#b98a37'; context.stroke();
  seat(context, base, 0.5);
  return canvas.toDataURL('image/png');
}

/** Shapes are drawn in a box from -1 to 1, this many pixels to the unit, centred on the paver. */
const UNIT = 74;
type Shape = (context: CanvasRenderingContext2D) => void;
function place(context: CanvasRenderingContext2D, dx = 0, dy = 0) { context.setTransform(UNIT, 0, 0, UNIT, MID + dx, MID + dy); }
/**
 * One flat piece set into the stone: its colour, a shadow along the edge nearest the light (upper
 * right, as on the pavers) and a faint light along the far edge, so it reads as sunk in, not stuck on.
 */
function inlay(context: CanvasRenderingContext2D, shape: Shape, colour: string) {
  place(context); context.fillStyle = colour; context.beginPath(); shape(context); context.fill();
  for (const [dx, dy, tone, alpha] of [[-5, 5, INK, 0.32], [4, -4, '#ffffff', 0.4]] as const) {
    // The edge alone: the shape, less the same shape moved away from that edge.
    const edge = canvasOf(), draw = edge.getContext('2d')!;
    place(draw); draw.fillStyle = tone; draw.beginPath(); shape(draw); draw.fill();
    draw.globalCompositeOperation = 'destination-out';
    place(draw, dx, dy); draw.beginPath(); shape(draw); draw.fill();
    context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = alpha; context.drawImage(edge, 0, 0); context.globalAlpha = 1;
  }
}
const dot = (context: CanvasRenderingContext2D, x: number, y: number, radius: number) => { context.moveTo(x + radius, y); context.arc(x, y, radius, 0, Math.PI * 2); };
function pill(context: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, radius: number) {
  const angle = Math.atan2(by - ay, bx - ax);
  context.moveTo(ax + Math.cos(angle + Math.PI / 2) * radius, ay + Math.sin(angle + Math.PI / 2) * radius);
  context.arc(ax, ay, radius, angle + Math.PI / 2, angle - Math.PI / 2);
  context.arc(bx, by, radius, angle - Math.PI / 2, angle + Math.PI / 2);
  context.closePath();
}

const ORNAMENT_ART: Record<Ornament, (context: CanvasRenderingContext2D) => void> = {
  // A soft red hat leaning to one side, with a cream brim and a pompom.
  hat(context) {
    inlay(context, c => {
      c.moveTo(-0.72, 0.42); c.bezierCurveTo(-0.62, -0.5, -0.1, -0.98, 0.3, -0.78);
      c.bezierCurveTo(0.62, -0.62, 0.84, -0.3, 0.8, -0.02); c.bezierCurveTo(0.62, -0.3, 0.5, -0.36, 0.4, -0.34);
      c.bezierCurveTo(0.56, -0.1, 0.66, 0.16, 0.68, 0.42); c.closePath();
    }, RED);
    inlay(context, c => pill(c, -0.7, 0.56, 0.66, 0.56, 0.2), CREAM);
    inlay(context, c => dot(c, 0.8, 0.04, 0.2), CREAM);
  },
  // A gingerbread man with icing eyes, a smile, two buttons and cuffs.
  gingerbread(context) {
    inlay(context, c => {
      dot(c, 0, -0.52, 0.34);
      pill(c, -0.66, -0.02, 0.66, -0.02, 0.17);
      pill(c, 0, -0.1, 0, 0.3, 0.3);
      pill(c, -0.22, 0.34, -0.36, 0.78, 0.17); pill(c, 0.22, 0.34, 0.36, 0.78, 0.17);
    }, BROWN);
    place(context); context.fillStyle = CREAM; context.strokeStyle = CREAM; context.lineCap = 'round'; context.lineWidth = 0.055;
    context.beginPath(); dot(context, -0.13, -0.58, 0.05); dot(context, 0.13, -0.58, 0.05); dot(context, 0, 0.02, 0.055); dot(context, 0, 0.24, 0.055); context.fill();
    context.beginPath(); context.arc(0, -0.5, 0.15, 0.2 * Math.PI, 0.8 * Math.PI); context.stroke();
    for (const [x, y, turn] of [[-0.6, -0.02, Math.PI / 2], [0.6, -0.02, Math.PI / 2], [-0.33, 0.68, 0.3], [0.33, 0.68, -0.3]]) {
      context.beginPath(); context.moveTo(x - Math.cos(turn) * 0.12, y - Math.sin(turn) * 0.12); context.lineTo(x + Math.cos(turn) * 0.12, y + Math.sin(turn) * 0.12); context.stroke();
    }
  },
  // A plump five-pointed star.
  star(context) {
    inlay(context, c => {
      for (let i = 0; i < 10; i++) {
        const turn = -Math.PI / 2 + i * Math.PI / 5, reach = i % 2 ? 0.46 : 0.9;
        const x = Math.cos(turn) * reach, y = Math.sin(turn) * reach + 0.05;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.closePath();
    }, GOLD);
    // Softened points: the same colour drawn round over the corners.
    place(context); context.strokeStyle = GOLD; context.lineJoin = 'round'; context.lineWidth = 0.1;
    context.beginPath();
    for (let i = 0; i < 10; i++) { const turn = -Math.PI / 2 + i * Math.PI / 5, reach = (i % 2 ? 0.46 : 0.9) - 0.06; context.lineTo(Math.cos(turn) * reach, Math.sin(turn) * reach + 0.05); }
    context.closePath(); context.stroke();
  },
  // A red bauble with a gold cap, a cream band, and a glint where the light catches it.
  bauble(context) {
    inlay(context, c => pill(c, -0.12, -0.74, 0.12, -0.74, 0.11), GOLD);
    inlay(context, c => dot(c, 0, 0.1, 0.72), RED);
    place(context); context.save();
    context.beginPath(); dot(context, 0, 0.1, 0.72); context.clip();
    context.fillStyle = CREAM; context.globalAlpha = 0.9; context.fillRect(-1, 0.02, 2, 0.17); context.globalAlpha = 1;
    context.restore();
    place(context); context.fillStyle = '#ffffff';
    context.globalAlpha = 0.55; context.beginPath(); context.ellipse(-0.3, -0.22, 0.2, 0.11, -0.7, 0, Math.PI * 2); context.fill();
    // The glint: a small four-pointed sparkle.
    context.globalAlpha = 0.95; context.beginPath();
    for (let i = 0; i < 8; i++) { const turn = i * Math.PI / 4, reach = i % 2 ? 0.055 : 0.2; context.lineTo(0.3 + Math.cos(turn) * reach, -0.3 + Math.sin(turn) * reach); }
    context.closePath(); context.fill(); context.globalAlpha = 1;
  },
};

/** Opened: the white paver with its ornament set into the middle. */
function openPicture(base: HTMLImageElement, ornament: Ornament) {
  const canvas = canvasOf(), context = canvas.getContext('2d')!;
  context.drawImage(base, 0, 0, SIZE, SIZE);
  ORNAMENT_ART[ornament](context);
  // Only a little of the stone's grain over the ornament, so the paver itself stays as white as its neighbours.
  seat(context, base, 0.1);
  return canvas.toDataURL('image/png');
}

/**
 * The paper coming off: scraps of green paper and bits of ribbon fly out from the gift and fade.
 * `x`, `y` are the gift's centre inside `parent` in CSS pixels, `cell` one board cell's width, and
 * `snow` how deep the snow lay on it (0-1).
 */
export function tearOpen(parent: HTMLElement, x: number, y: number, cell: number, snow = 0) {
  const burst = document.createElement('div'); burst.className = 'gift-burst'; burst.setAttribute('aria-hidden', 'true');
  burst.style.left = `${x}px`; burst.style.top = `${y}px`;
  for (let i = 0; i < 11; i++) {
    const scrap = document.createElement('span'), ribbon = i >= 8;
    const turn = i / 11 * Math.PI * 2 + Math.random() * 0.5, reach = cell * (0.75 + Math.random() * 0.7);
    scrap.className = ribbon ? 'ribbon' : i % 3 === 2 ? 'dotted' : '';
    const size = cell * (ribbon ? 0.34 : 0.2 + Math.random() * 0.14);
    scrap.style.cssText = `width:${size}px;height:${ribbon ? size * 0.3 : size * (0.7 + Math.random() * 0.4)}px;--dx:${Math.cos(turn) * reach}px;--dy:${Math.sin(turn) * reach + cell * 0.25}px;--spin:${(Math.random() - 0.5) * 520}deg;--from:${Math.random() * 90}deg`;
    burst.append(scrap);
  }
  // Snow that lay on the gift is shaken off with the paper: soft clumps puffing out a short way.
  for (let i = 0, clumps = Math.round(snow * 9); i < clumps; i++) {
    const clump = document.createElement('span'); clump.className = 'snow';
    const turn = Math.random() * Math.PI * 2, reach = cell * (0.35 + Math.random() * 0.55), size = cell * (0.1 + Math.random() * 0.14);
    clump.style.cssText = `width:${size}px;height:${size}px;--dx:${Math.cos(turn) * reach}px;--dy:${Math.sin(turn) * reach + cell * 0.12}px;animation-delay:${Math.random() * 90}ms`;
    burst.append(clump);
  }
  parent.append(burst);
  window.setTimeout(() => burst.remove(), 860);
}

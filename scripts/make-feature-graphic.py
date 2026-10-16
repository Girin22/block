"""Builds the Google Play feature graphic (1024x500) from the in-game tile artwork.

A pile of green pavers rises at both sides and dips in the middle, with white fillers in the gaps as in
the game; the name sits in the dip, inside the centre that Play never crops. One paver is still falling.

Run: python scripts/make-feature-graphic.py
Writes assets/store/feature-graphic.png.
"""
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TILES = ROOT / 'assets' / 'images'
OUT = ROOT / 'assets' / 'store'
FONT = ROOT / 'assets' / 'fonts' / '나눔손글씨 강부장님체.ttf'
W, H = 1024, 500
BACKGROUND = (44, 41, 41, 255)  # the board's ground, #2c2929
TEXT = (250, 249, 246, 255)  # the studio intro's credit colour
BLEED = 0.18  # tile-assets.ts TILE_BLEED
CELL = 58
SPREAD = 1.04  # a hair of joint between pavers, as in the icon
SEED = 7


def heights(cols: int) -> list[int]:
    """Pile height per column: tall at both sides, low in the middle where the name sits."""
    out = []
    for c in range(cols):
        t = abs(c - (cols - 1) / 2) / ((cols - 1) / 2)  # 0 in the middle, 1 at the sides
        out.append(round(1.6 + 5.6 * t ** 1.8))
    return out


def tile(cols: int, rows: int, rng: random.Random) -> list[tuple[str, int, int, int, int]]:
    """Covers the pile with mostly green 2x1/1x2 pavers and the odd white filler."""
    hs = heights(cols)
    inside = lambda c, r: 0 <= c < cols and 0 <= r < rows and r >= rows - hs[c]
    used = set()
    pieces = []
    for r in range(rows):
        for c in range(cols):
            if not inside(c, r) or (c, r) in used:
                continue
            right = inside(c + 1, r) and (c + 1, r) not in used
            down = inside(c, r + 1) and (c, r + 1) not in used
            options = (['h'] * 3 if right else []) + (['v'] * 3 if down else [])
            white = not options or rng.random() < 0.1
            kind = 'c' if not options else rng.choice(options)
            if kind == 'h':
                used |= {(c, r), (c + 1, r)}
                pieces.append(('white_horizontal' if white else 'horizontal', c, r, 2, 1))
            elif kind == 'v':
                used |= {(c, r), (c, r + 1)}
                pieces.append(('white_vertical' if white else 'vertical', c, r, 1, 2))
            else:
                used.add((c, r))
                pieces.append(('center', c, r, 1, 1))
    return pieces


def place(canvas: Image.Image, name: str, x: float, y: float, w: int, h: int, alpha: float = 1.0):
    """Draws one paver whose footprint's top-left grid corner is at pixel (x, y)."""
    art = Image.open(TILES / f'{name}.png').convert('RGBA')
    art = art.resize((round((w + BLEED) * CELL), round((h + BLEED) * CELL)), Image.LANCZOS)
    if alpha < 1:
        art.putalpha(art.getchannel('A').point(lambda a: round(a * alpha)))
    cx = x + w * CELL * SPREAD / 2
    cy = y + h * CELL * SPREAD / 2
    canvas.alpha_composite(art, (round(cx - art.width / 2), round(cy - art.height / 2)))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)
    pitch = CELL * SPREAD
    cols = int(W / pitch) + 2
    rows = int(H / pitch) + 1
    left = (W - cols * pitch) / 2
    top = H - rows * pitch + pitch * 0.35  # let the bottom row run off the edge
    canvas = Image.new('RGBA', (W, H), BACKGROUND)
    for name, c, r, w, h in tile(cols, rows, rng):
        place(canvas, name, left + c * pitch, top + r * pitch, w, h)

    # A paver on its way down, clear of the name.
    place(canvas, 'horizontal', left + 3.6 * pitch, top + 1.1 * pitch, 2, 1)

    draw = ImageDraw.Draw(canvas)
    title = ImageFont.truetype(str(FONT), 128)
    sub = ImageFont.truetype(str(FONT), 40)
    draw.text((W / 2, 205), '보도보도', font=title, fill=TEXT, anchor='mm')
    draw.text((W / 2, 292), '하나씩 쌓아 가는 나만의 길', font=sub, fill=(250, 249, 246, 200), anchor='mm')
    canvas.convert('RGB').save(OUT / 'feature-graphic.png')


if __name__ == '__main__':
    main()

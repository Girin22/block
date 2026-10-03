"""Builds the app icon from the in-game tile artwork, so the icon always matches the board's colors.

The layout follows the designer's icon (Frame 56, 2026-10-03): four green pavers in a pinwheel around
one white 1x1 filler, pulled slightly apart so dark joints show, on the board's dark ground.

Run: python scripts/make-app-icon.py
Writes assets/app-icon/: icon-only.png (full square, iOS and stores), icon-foreground.png and
icon-background.png (Android adaptive icon layers), play-store-512.png (the Play Console listing icon),
splash.png and splash-dark.png (launch screen: the board's ground with a small pinwheel), and
preview-rounded.png (a look at the result).
Then: npx @capacitor/assets generate --assetPath assets/app-icon --android --ios (see docs/deployment.md).
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TILES = ROOT / 'assets' / 'images'
OUT = ROOT / 'assets' / 'app-icon'
SIZE = 1024
BACKGROUND = (45, 42, 42, 255)  # sampled from the designer's icon
BLEED = 0.18  # the artwork's interlocking edge beyond its grid footprint (tile-assets.ts TILE_BLEED)
SPREAD = 1.075  # how far the pinwheel is pulled apart from its centre, for the joints
EXTENT = 0.86  # share of the icon the pavers span, as in the designer's icon

# (image, centre x, centre y, cells wide, cells high) on a 3x3 grid; the white filler sits in the middle.
PIECES = [
    ('vertical', 0.5, 1.0, 1, 2),
    ('horizontal', 2.0, 0.5, 2, 1),
    ('vertical', 2.5, 2.0, 1, 2),
    ('horizontal', 1.0, 2.5, 2, 1),
    ('center', 1.5, 1.5, 1, 1),
]


def pavers(size: int, extent: float) -> Image.Image:
    """The pinwheel on a transparent square, spanning `extent` of it."""
    span = 3 * SPREAD + BLEED  # outer size of the arrangement in cells
    cell = size * extent / span
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for name, cx, cy, w, h in PIECES:
        art = Image.open(TILES / f'{name}.png').convert('RGBA')
        art = art.resize((round((w + BLEED) * cell), round((h + BLEED) * cell)), Image.LANCZOS)
        x = size / 2 + (cx - 1.5) * SPREAD * cell - art.width / 2
        y = size / 2 + (cy - 1.5) * SPREAD * cell - art.height / 2
        layer.alpha_composite(art, (round(x), round(y)))
    return layer


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    full = Image.new('RGBA', (SIZE, SIZE), BACKGROUND)
    full.alpha_composite(pavers(SIZE, EXTENT))
    full.convert('RGB').save(OUT / 'icon-only.png')  # stores reject transparency in the main icon
    # Android crops adaptive icons to a circle or squircle inside the middle 66%; keep the pavers there.
    pavers(SIZE, 0.62).save(OUT / 'icon-foreground.png')
    Image.new('RGB', (SIZE, SIZE), BACKGROUND[:3]).save(OUT / 'icon-background.png')
    full.convert('RGB').resize((512, 512), Image.LANCZOS).save(OUT / 'play-store-512.png')
    splash = Image.new('RGBA', (2732, 2732), (44, 41, 41, 255))  # the board's ground, #2c2929
    splash.alpha_composite(pavers(2732, 0.16))
    splash.convert('RGB').save(OUT / 'splash.png'); splash.convert('RGB').save(OUT / 'splash-dark.png')
    mask = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=round(SIZE * 0.225), fill=255)
    preview = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    preview.paste(full, (0, 0), mask)
    preview.save(OUT / 'preview-rounded.png')


if __name__ == '__main__':
    main()

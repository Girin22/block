"""Builds the lying (2x1) pictures of the Halloween two-cell pavers, shaded like the everyday ones.

The everyday horizontal paver is the upright one turned a quarter clockwise with its edges re-shaded:
the stone's side shows along the bottom instead of the left. So the ratio between horizontal.png and the
turned vertical.png is exactly that change of light. Each Halloween upright (drawn on the same outline)
is turned the same way and multiplied by the ratio, so a lying Halloween paver casts its edge where the
everyday ones do. Inside the face the ratio is 1, so the artwork itself is untouched.

Run: python scripts/make-halloween-lying.py
Writes assets/images/halloween/<name>-lying.png for every two-cell picture.
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / 'assets' / 'images'
HALLOWEEN = IMAGES / 'halloween'
UPRIGHT = ['stone', 'ghost-domino', 'purple', 'orange', 'mummy']


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert('RGBA'), dtype=np.float64)


def luminance(rgba: np.ndarray) -> np.ndarray:
    return rgba[..., :3] @ np.array([0.299, 0.587, 0.114])


def main():
    lying = load(IMAGES / 'horizontal.png')
    turned = np.rot90(load(IMAGES / 'vertical.png'), -1)  # a quarter clockwise, as the game turns pictures
    solid = (lying[..., 3] > 8) & (turned[..., 3] > 8)
    light = np.ones(lying.shape[:2])
    light[solid] = luminance(lying)[solid] / np.maximum(luminance(turned)[solid], 1)
    light = np.clip(light, 0.25, 1.6)
    for name in UPRIGHT:
        art = np.rot90(load(HALLOWEEN / f'{name}.png'), -1).copy()
        art[..., :3] = np.clip(art[..., :3] * light[..., None], 0, 255)
        Image.fromarray(art.round().astype(np.uint8), 'RGBA').save(HALLOWEEN / f'{name}-lying.png')
        print(name, art.shape[1], 'x', art.shape[0])


if __name__ == '__main__':
    main()

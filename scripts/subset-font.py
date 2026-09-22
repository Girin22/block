"""Rebuilds assets/fonts/GangBuJang-ksx1001.woff2 from the full handwriting face.

The full TTF is 5.9 MB, far too heavy for a phone on first pause. The app's text only needs the
2,350 KS X 1001 syllables plus ASCII, which comes to about 0.6 MB as WOFF2. Any syllable outside
that set falls back to the system font; extend the set here if such text is ever added.

    pip install fonttools brotli
    python scripts/subset-font.py
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'assets', 'fonts', '나눔손글씨 강부장님체.ttf')
TARGET = os.path.join(ROOT, 'assets', 'fonts', 'GangBuJang-ksx1001.woff2')


def ksx1001_syllables():
    def encodable(ch):
        try:
            ch.encode('iso2022_kr'); return True
        except UnicodeEncodeError:
            return False
    return ''.join(chr(c) for c in range(0xAC00, 0xD7A4) if encodable(chr(c)))


text = os.path.join(ROOT, 'assets', 'fonts', 'ksx1001.txt')
with open(text, 'w', encoding='utf-8') as f:
    f.write(ksx1001_syllables())
try:
    subprocess.run([sys.executable, '-m', 'fontTools.subset', SOURCE, f'--text-file={text}',
                    '--unicodes=U+0020-007E,U+00A0,U+3131-318E', '--flavor=woff2',
                    f'--output-file={TARGET}', '--layout-features=*', '--no-hinting'], check=True)
finally:
    os.remove(text)
print(f'{TARGET}: {os.path.getsize(TARGET) // 1024} KB')

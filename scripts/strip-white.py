#!/usr/bin/env python3
"""
Strip near-white background from PNG images while preserving edge quality.

Usage: python scripts/strip-white.py

Config:
  SOURCE_DIR  = where your source PNGs are
  DEST_DIR    = where to save (relative to project root, created if missing)
  TOLERANCE   = how far from #FFFFFF to still strip (0 = only pure white, 15 = generous)
"""

import os
import sys
from PIL import Image

# --- CONFIG ---
SOURCE_DIR = r"C:\Users\Kiron\Downloads\CV Scan Images"
DEST_DIR   = "public/images/scan"
TOLERANCE  = 15   # 0-255. Strips #F0F0F0 and up. Increase if you see halos.
# -------------

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST_ABS = os.path.join(PROJECT_ROOT, DEST_DIR)


def strip_white_bg(img_path, out_path, tol):
    """Open a PNG, strip near-white pixels to transparent, save lossless."""
    img = Image.open(img_path).convert("RGBA")
    pixels = list(img.getdata())
    new_data = []
    lo = 255 - tol

    for r, g, b, a in pixels:
        if a == 0:
            new_data.append((0, 0, 0, 0))
        elif r >= lo and g >= lo and b >= lo:
            new_data.append((0, 0, 0, 0))
        else:
            new_data.append((r, g, b, a))

    img.putdata(new_data)
    img.save(out_path, "PNG", compress_level=9)


def _fmt(b):
    if b < 1024:
        return f"{b}B"
    elif b < 1024 * 1024:
        return f"{b / 1024:.1f}KB"
    else:
        return f"{b / 1024 / 1024:.1f}MB"


def main():
    os.makedirs(DEST_ABS, exist_ok=True)

    pngs = sorted(f for f in os.listdir(SOURCE_DIR) if f.lower().endswith(".png"))
    if not pngs:
        print(f"No PNG files found in {SOURCE_DIR}")
        sys.exit(1)

    print(f"Source:     {SOURCE_DIR}  ({len(pngs)} files)")
    print(f"Dest:       {DEST_ABS}")
    print(f"Tolerance:  {TOLERANCE}  (strips #%02xFFFFFF and up)" % (255 - TOLERANCE))
    print()

    for i, fname in enumerate(pngs, 1):
        src = os.path.join(SOURCE_DIR, fname)
        out = os.path.join(DEST_ABS, fname)
        strip_white_bg(src, out, TOLERANCE)
        src_sz = os.path.getsize(src)
        out_sz = os.path.getsize(out)
        delta = ((out_sz - src_sz) / src_sz) * 100
        print(f"  [{i}/{len(pngs)}] {fname}  ({_fmt(src_sz)} -> {_fmt(out_sz)}, {delta:+.1f}%)")

    print(f"\nDone - {len(pngs)} files written to {DEST_ABS}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""statusbar-full.png (the whole status bar) -> statusbar.png: its left and right ends stacked,
so the picture is readable at its real size. Usage: python3 make-statusbar.py <shots folder>"""
import os, sys
from PIL import Image
shots = sys.argv[1]
im = Image.open(os.path.join(shots, "statusbar-full.png")); w, h = im.size
out = Image.new("RGB", (1200, h * 2 + 16), (40, 42, 46))
out.paste(im.crop((0, 0, 1200, h)), (0, 0)); out.paste(im.crop((w - 1200, 0, w, h)), (0, h + 16))
out.save(os.path.join(shots, "statusbar.png")); os.remove(os.path.join(shots, "statusbar-full.png"))

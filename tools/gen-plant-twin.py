"""Write the home page's plant animation (index.html, between
<!-- twin:svg --> and <!-- /twin:svg -->): the offshore platform of
tools/gen-plant-wireframe.py, split into the parts it is assembled from
(jacket, decks, pumps, separators, modules, stacks, tower, cranes, bridge,
flare, walkway), one <g class="tw-part"> each, in that order.
Usage: python3 tools/gen-plant-twin.py
"""
import os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "tools", "gen-plant-wireframe.py")
PAGE = os.path.join(ROOT, "index.html")

# The wireframe script's section comments name the parts.
PARTS = {"# water": "water", "# jacket legs": "jacket", "# risers": "jacket", "# deck slabs": "decks",
         "# stairs": "decks", "# cellar deck": "cellar", "# mezzanine": "mezz", "# main deck": "modules",
         "# top deck": "stacks", "# telecom": "tower", "# crane 1": "crane1", "# crane 2": "crane2",
         "# bridge": "bridge", "# flare boom": "flare", "# foreground walkway": "walkway"}
ORDER = ["water", "jacket", "decks", "cellar", "mezz", "modules", "stacks", "tower", "crane1", "crane2", "bridge", "flare", "walkway"]

lines = []
for line in open(SRC, encoding="utf-8").read().split("\n"):
    for key, part in PARTS.items():
        if line.startswith(key):
            lines.append("PART = %r" % part)
    lines.append(line)
code = "\n".join(lines)
code = code.replace('def seg(a, b, layer="main"):\n    layers[layer].append((proj(a), proj(b)))',
                    'PART = "misc"\ndef seg(a, b, layer="main"):\n    layers[layer].append((proj(a), proj(b), PART))')
code = code[:code.index("# ---------------------------------------------------------------- write svg")]
env = {"__name__": "twin", "sys": __import__("sys")}
import sys
sys.argv = [SRC, os.devnull]
exec(compile(code, SRC, "exec"), env)
layers = env["layers"]

pts = [p for L in ("main", "fine") for s in layers[L] for p in s[:2]]
minx = min(p[0] for p in pts); maxx = max(p[0] for p in pts)
miny = min(p[1] for p in pts); maxy = max(p[1] for p in pts)
pad = 20
W, H = maxx - minx + 2 * pad, maxy - miny + 2 * pad
parts = {}
for L, w in (("main", "1.1"), ("fine", "0.6"), ("water", "0.8")):
    for a, b, part in layers[L]:
        if not all(minx <= q[0] <= maxx and miny <= q[1] <= maxy for q in (a, b)):
            continue
        parts.setdefault(part, {}).setdefault(w, []).append(
            "M%.1f %.1fL%.1f %.1f" % (a[0] - minx + pad, a[1] - miny + pad, b[0] - minx + pad, b[1] - miny + pad))

groups = "".join(
    '<g class="tw-part tw-%s" style="--i:%d">%s</g>' % (p, i, "".join('<path stroke-width="%s" d="%s"/>' % (w, "".join(d)) for w, d in parts[p].items()))
    for i, p in enumerate(ORDER) if p in parts)
svg = ('<svg class="tw-svg" viewBox="0 0 %.0f %.0f" fill="none" stroke="#0b2a4a" stroke-linecap="round" aria-hidden="true">%s</svg>'
       % (W, H, groups))
page = open(PAGE, encoding="utf-8").read()
new = re.sub(r"<!-- twin:svg -->.*?<!-- /twin:svg -->", lambda m: "<!-- twin:svg -->" + svg + "<!-- /twin:svg -->", page, flags=re.S)
if new == page and "<!-- twin:svg -->" not in page:
    sys.exit("index.html has no <!-- twin:svg --> marker")
open(PAGE, "w", encoding="utf-8").write(new)
print("plant twin: %d parts, %d bytes, viewBox %.0f x %.0f" % (len(parts), len(svg), W, H))

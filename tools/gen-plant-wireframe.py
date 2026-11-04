"""Generate a monochrome wireframe of an offshore process platform as SVG.
Usage: python3 tools/gen-plant-wireframe.py assets/img/plant-wireframe.svg

Scene is built in 3D (x right, y depth, z up, metres) and projected with a
simple perspective camera, so the drawing reads like a CAD wireframe.
"""
import math, sys

OUT = sys.argv[1]

# ---------------------------------------------------------------- camera
CAM = (150.0, -125.0, 62.0)
TGT = (62.0, 14.0, 34.0)
FOCAL = 1450.0

def sub(a, b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def dot(a, b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def norm(a):
    l = math.sqrt(dot(a, a)); return (a[0]/l, a[1]/l, a[2]/l)

FWD = norm(sub(TGT, CAM))
RIGHT = norm(cross(FWD, (0, 0, 1)))
UP = cross(RIGHT, FWD)

def proj(p):
    d = sub(p, CAM)
    x, y, z = dot(d, RIGHT), dot(d, UP), dot(d, FWD)
    return (FOCAL * x / z, -FOCAL * y / z)

# ---------------------------------------------------------------- primitives
layers = {"main": [], "fine": [], "water": []}

def seg(a, b, layer="main"):
    layers[layer].append((proj(a), proj(b)))

def poly(pts, layer="main", closed=False):
    for i in range(len(pts) - (0 if closed else 1)):
        seg(pts[i], pts[(i+1) % len(pts)], layer)

def lerp(a, b, t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t)
def add(a, b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])

def box(x0, y0, z0, x1, y1, z1, layer="main"):
    c = [(x, y, z) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
    for i, j in [(0,1),(2,3),(0,2),(1,3),(4,5),(6,7),(4,6),(5,7),(0,4),(1,5),(2,6),(3,7)]:
        seg(c[i], c[j], layer)

def circle(c, r, z, n=28, layer="main"):
    pts = [(c[0]+r*math.cos(2*math.pi*i/n), c[1]+r*math.sin(2*math.pi*i/n), z) for i in range(n)]
    poly(pts, layer, closed=True)
    return pts

def vcyl(cx, cy, z0, z1, r, rings=(), layer="main", r_top=None):
    r_top = r if r_top is None else r_top
    circle((cx, cy), r, z0, layer=layer)
    circle((cx, cy), r_top, z1, layer=layer)
    for zr in rings:
        t = (zr - z0) / (z1 - z0)
        circle((cx, cy), r + (r_top - r) * t, zr, layer="fine")
    # silhouette lines: pick the angles that project furthest left/right
    best = []
    for i in range(72):
        a = 2*math.pi*i/72
        p0 = (cx+r*math.cos(a), cy+r*math.sin(a), z0)
        best.append((proj(p0)[0], a))
    best.sort()
    for _, a in (best[0], best[-1]):
        seg((cx+r*math.cos(a), cy+r*math.sin(a), z0),
            (cx+r_top*math.cos(a), cy+r_top*math.sin(a), z1), layer)

def hcyl(p0, p1, r, layer="main", n=20):
    """Horizontal vessel along x or y between p0 and p1 with dished ends hinted by rings."""
    axis = norm(sub(p1, p0))
    side = norm(cross(axis, (0, 0, 1)))
    up = (0, 0, 1)
    def ring(c):
        return [add(c, add(tuple(side[k]*r*math.cos(2*math.pi*i/n) for k in range(3)),
                           tuple(up[k]*r*math.sin(2*math.pi*i/n) for k in range(3)))) for i in range(n)]
    a, b = ring(p0), ring(p1)
    poly(a, layer, True); poly(b, layer, True)
    for i in (0, n//4, n//2, 3*n//4):
        seg(a[i], b[i], layer)

def truss(a, b, w, h, panels, layer="main", top=True):
    """Box truss from a to b; w = horizontal half-width vector, h = height."""
    hv = (0, 0, h)
    rails = [add(a, w), sub(a, w)]
    for sgn in (1, -1):
        off = tuple(sgn*x for x in w)
        lo0, lo1 = add(a, off), add(b, off)
        hi0, hi1 = add(lo0, hv), add(lo1, hv)
        seg(lo0, lo1, layer); seg(hi0, hi1, layer)
        for i in range(panels + 1):
            t = i / panels
            seg(lerp(lo0, lo1, t), lerp(hi0, hi1, t), layer)
            if i < panels:
                t2 = (i+1) / panels
                if i % 2 == 0:
                    seg(lerp(lo0, lo1, t), lerp(hi0, hi1, t2), "fine")
                else:
                    seg(lerp(hi0, hi1, t), lerp(lo0, lo1, t2), "fine")
    # cross members
    for i in range(panels + 1):
        t = i / panels
        pa, pb = lerp(add(a, w), add(b, w), t), lerp(sub(a, w), sub(b, w), t)
        seg(pa, pb, "fine")
        if top:
            seg(add(pa, hv), add(pb, hv), "fine")

def lattice_tower(cx, cy, z0, z1, w0, w1, panels, layer="main"):
    def corners(z):
        t = (z - z0) / (z1 - z0); w = w0 + (w1 - w0) * t
        return [(cx-w, cy-w, z), (cx+w, cy-w, z), (cx+w, cy+w, z), (cx-w, cy+w, z)]
    levels = [z0 + (z1 - z0) * i / panels for i in range(panels + 1)]
    for i, z in enumerate(levels):
        c = corners(z); poly(c, "fine", True)
        if i < panels:
            n = corners(levels[i+1])
            for k in range(4):
                seg(c[k], n[k], layer)
                seg(c[k], n[(k+1) % 4], "fine")
                seg(c[(k+1) % 4], n[k], "fine")

def railing(pts, h=1.2, layer="fine", posts=3.0):
    poly([add(p, (0, 0, h)) for p in pts], layer)
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i+1]
        L = math.dist(a, b); n = max(1, int(L / posts))
        for k in range(n + 1):
            p = lerp(a, b, k / n); seg(p, add(p, (0, 0, h)), layer)

def stair(x, y0, y1, z0, z1, layer="fine"):
    seg((x, y0, z0), (x, y1, z1), layer); seg((x+1.2, y0, z0), (x+1.2, y1, z1), layer)
    n = int(abs(z1 - z0) / 0.9)
    for k in range(n + 1):
        t = k / n
        seg((x, y0+(y1-y0)*t, z0+(z1-z0)*t), (x+1.2, y0+(y1-y0)*t, z0+(z1-z0)*t), layer)

# ---------------------------------------------------------------- scene
XS = [0, 22, 44, 66]
YS = [0, 30]
DECKS = [14, 23, 32, 41]
X0, X1, Y0, Y1 = -6, 72, -5, 35

# water: a few long horizontal strokes, dashes fading out
for i, y in enumerate([-30, -12, 8, 30, 55, 85]):
    for x in range(-40, 170, 22):
        if (x // 26 + i) % 3 != 0:
            seg((x, y, 0), (x + 14, y, 0), "water")

# jacket legs (battered) + bracing
for x in XS:
    for y in YS:
        bx = (x - 33) * 0.06; by = (y - 15) * 0.06
        vcyl(x + bx, y + by, 0, DECKS[0], 1.3, rings=(4, 9))
for z_lo, z_hi in [(0, 7), (7, DECKS[0])]:
    for y in YS:
        for i in range(len(XS) - 1):
            a, b = XS[i], XS[i+1]
            seg((a, y, z_lo), (b, y, z_hi), "fine"); seg((b, y, z_lo), (a, y, z_hi), "fine")
            seg((a, y, z_hi), (b, y, z_hi))
    for x in XS:
        seg((x, 0, z_lo), (x, 30, z_hi), "fine"); seg((x, 30, z_lo), (x, 0, z_hi), "fine")
        seg((x, 0, z_hi), (x, 30, z_hi))
# risers / caissons
for x, y in [(10, -1.5), (30, -1.5), (52, -1.5)]:
    vcyl(x, y, 0, DECKS[0], 0.6)

# deck slabs, columns, facade bracing
for k, z in enumerate(DECKS):
    inset = 0 if k else 2
    box(X0 + inset, Y0 + inset, z - 1.6, X1 - inset, Y1 - inset, z)
    railing([(X0, Y0, z), (X1, Y0, z), (X1, Y1, z)])
    if k < len(DECKS) - 1:
        zn = DECKS[k+1] - 1.6
        for x in XS + [X1 - 1]:
            for y in (Y0 + 1, Y1 - 1):
                seg((x, y, z), (x, y, zn))
        for i in range(len(XS) - 1):
            if (i + k) % 2 == 0:
                seg((XS[i], Y0 + 1, z), (XS[i+1], Y0 + 1, zn), "fine")
            else:
                seg((XS[i+1], Y0 + 1, z), (XS[i], Y0 + 1, zn), "fine")
        seg((X1 - 1, Y0 + 1, z), (X1 - 1, Y1 - 1, zn), "fine")

# stairs on the front face
stair(X1 - 4, Y0 - 1, Y0 + 9, DECKS[0], DECKS[1] - 1.6)
stair(X0 + 3, Y0 - 1, Y0 + 9, DECKS[1], DECKS[2] - 1.6)
stair(X1 - 4, Y0 - 1, Y0 + 9, DECKS[2], DECKS[3] - 1.6)

# cellar deck: pumps, manifolds
for x in (4, 12, 20):
    box(x, 4, DECKS[0], x + 5, 9, DECKS[0] + 3)
for x in range(30, 64, 6):
    vcyl(x, 22, DECKS[0], DECKS[0] + 5, 1.6, rings=(DECKS[0] + 2.5,))
hcyl((28, 8, DECKS[0] + 2.4), (52, 8, DECKS[0] + 2.4), 2.2)

# mezzanine: separators & heat exchangers
hcyl((4, 6, DECKS[1] + 3), (26, 6, DECKS[1] + 3), 2.8)
hcyl((4, 20, DECKS[1] + 3), (24, 20, DECKS[1] + 3), 2.6)
hcyl((34, 4, DECKS[1] + 2), (60, 4, DECKS[1] + 2), 1.6)
hcyl((34, 9, DECKS[1] + 2), (60, 9, DECKS[1] + 2), 1.6)
box(40, 18, DECKS[1], 66, 30, DECKS[1] + 7)
for x in range(42, 66, 4):
    seg((x, 18, DECKS[1]), (x, 18, DECKS[1] + 7), "fine")

# main deck: compressor modules, scrubbers
box(2, 2, DECKS[2], 30, 14, DECKS[2] + 7.5)
box(2, 18, DECKS[2], 30, 30, DECKS[2] + 7.5)
for y in (2, 18):
    for x in range(5, 30, 5):
        seg((x, y, DECKS[2]), (x, y, DECKS[2] + 7.5), "fine")
for x in (38, 46):
    vcyl(x, 6, DECKS[2], DECKS[2] + 8.5, 2.2, rings=(DECKS[2] + 2, DECKS[2] + 6.5))
box(54, 2, DECKS[2], 68, 30, DECKS[2] + 6)
for y in range(5, 30, 5):
    seg((54, y, DECKS[2] + 6), (68, y, DECKS[2] + 6), "fine")

# top deck: turbine enclosures + exhaust stacks (the signature skyline)
for x0, y0 in [(10, 6), (24, 6), (38, 6), (52, 6)]:
    box(x0 - 4, y0 - 3, DECKS[3], x0 + 6, y0 + 18, DECKS[3] + 6.5)
    seg((x0 - 4, y0 - 3, DECKS[3] + 3.2), (x0 + 6, y0 - 3, DECKS[3] + 3.2), "fine")
# tall slim stacks (with spiral strakes hinted by rings)
for x, y, h in [(16, 22, 36), (30, 22, 38), (44, 22, 41)]:
    vcyl(x, y, DECKS[3] + 6.5, DECKS[3] + h, 1.7, rings=[DECKS[3] + 6.5 + 3*i for i in range(1, int((h - 6.5) / 3))])
    circle((x, y), 2.1, DECKS[3] + h - 0.6, layer="main")
# short wide casings
for x, y, h in [(9, 14, 22), (23, 14, 24), (37, 14, 23), (51, 14, 21)]:
    vcyl(x, y, DECKS[3] + 6.5, DECKS[3] + h, 2.6, rings=(DECKS[3] + 11, DECKS[3] + h - 3), r_top=2.3)
railing([(X0, Y1, DECKS[3]), (X0, Y0, DECKS[3])])

# telecom lattice tower (back left)
lattice_tower(-1, 30, DECKS[3], DECKS[3] + 52, 2.6, 0.7, 13)
for z, r in [(DECKS[3] + 44, 1.4), (DECKS[3] + 38, 1.2)]:
    circle((1.5, 30), r, z, layer="fine")
seg((-1, 30, DECKS[3] + 52), (-1, 30, DECKS[3] + 57))

# crane 1 (front left)
vcyl(-3, -2, DECKS[3], DECKS[3] + 8, 1.6, rings=(DECKS[3] + 4,))
box(-6, -5, DECKS[3] + 8, -1, 0, DECKS[3] + 11)
truss((-3.5, -2, DECKS[3] + 10), (-52, -10, DECKS[3] + 13), (0, 0.9, 0), 1.5, 14)
seg((-3, -2, DECKS[3] + 18), (-52, -10, DECKS[3] + 14.5), "fine")
seg((-3, -2, DECKS[3] + 11), (-3, -2, DECKS[3] + 18))
seg((-52, -10, DECKS[3] + 13), (-52, -10, DECKS[3] - 4), "fine")

# crane 2 (front right)
vcyl(70, 26, DECKS[3], DECKS[3] + 14, 1.8, rings=(DECKS[3] + 5, DECKS[3] + 10))
box(67, 23, DECKS[3] + 14, 73, 29, DECKS[3] + 18)
lattice_tower(70, 26, DECKS[3] + 18, DECKS[3] + 28, 1.4, 0.5, 4)
truss((71, 25, DECKS[3] + 16), (112, 6, DECKS[3] + 12), (0.4, 0.8, 0), 1.4, 12)
seg((70, 26, DECKS[3] + 28), (112, 6, DECKS[3] + 13.4), "fine")
seg((112, 6, DECKS[3] + 12), (112, 6, DECKS[3] - 2), "fine")

# bridge to the flare tower
truss((X1, 22, DECKS[2] - 4), (128, 22, DECKS[2] - 4), (0, 1.6, 0), 3.2, 22)
lattice_tower(128, 22, 0, DECKS[2] - 4, 3.0, 2.0, 5)
# flare boom: inclined lattice up to the tip
truss((128, 22, DECKS[2] - 0.8), (142, 22, 66), (0, 1.3, 0), 2.0, 12)
vcyl(142, 22, 66, 69, 0.9)
for i in range(5):
    a = math.pi * (0.25 + 0.12 * i)
    seg((142, 22, 69), (142 + 3.5 * math.cos(a), 22, 69 + 3.5 * math.sin(a)), "fine")

# foreground walkway coming toward the viewer
truss((X1 + 2, Y0 - 2, DECKS[1] - 4), (104, -42, 15), (1.25, 1.25, 0), 3.4, 9)

# ---------------------------------------------------------------- write svg
allpts = [p for L in (layers['main'], layers['fine']) for s in L for p in s]
minx = min(p[0] for p in allpts); maxx = max(p[0] for p in allpts)
miny = min(p[1] for p in allpts); maxy = max(p[1] for p in allpts)
pad = 20
W, H = maxx - minx + 2*pad, maxy - miny + 2*pad

def path(L):
    out = []
    for (a, b) in L:
        if not all(minx <= q[0] <= maxx and miny <= q[1] <= maxy for q in (a, b)): continue
        out.append("M%.1f %.1fL%.1f %.1f" % (a[0]-minx+pad, a[1]-miny+pad, b[0]-minx+pad, b[1]-miny+pad))
    return "".join(out)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" fill="none" stroke="#0e1116" stroke-linecap="round">
<path stroke-width="1.1" d="{path(layers['main'])}"/>
<path stroke-width="0.6" d="{path(layers['fine'])}"/>
<path stroke-width="0.8" stroke-opacity="0.6" d="{path(layers['water'])}"/>
</svg>
'''
open(OUT, "w").write(svg)
print(OUT, len(svg), "bytes", W, H)

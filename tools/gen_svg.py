# -*- coding: utf-8 -*-
# Genereert de nagetekende dieptekaart als standalone SVG
import math
import shape

# ---------- coordinaat-transformatie: 4800-scanruimte -> SVG ----------
S = 3.7
OX, OY = 540, 555


def T(p):
    return ((p[0] - OX) / S, (p[1] - OY) / S)


def fmt(v):
    return f"{v:.1f}"


# ---------- Catmull-Rom -> cubic bezier (gesloten pad) ----------
def smooth_closed(points, tension=1.0):
    pts = [T(p) for p in points]
    n = len(pts)
    d = f"M {fmt(pts[0][0])} {fmt(pts[0][1])} "
    for i in range(n):
        p0 = pts[(i - 1) % n]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6 * tension, p1[1] + (p2[1] - p0[1]) / 6 * tension)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6 * tension, p2[1] - (p3[1] - p1[1]) / 6 * tension)
        d += f"C {fmt(c1[0])} {fmt(c1[1])} {fmt(c2[0])} {fmt(c2[1])} {fmt(p2[0])} {fmt(p2[1])} "
    return d + "Z"


# ---------- padinterpolatie over de oeverlijn ----------
LAKE = shape.LAKE


def path_resample(poly, closed=True):
    pts = poly + ([poly[0]] if closed else [])
    out = [poly[0]]
    for a, b in zip(pts, pts[1:]):
        dist = math.hypot(b[0] - a[0], b[1] - a[1])
        steps = max(1, int(dist / 8))
        for s in range(1, steps + 1):
            out.append((a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps))
    return out


DENSE = path_resample(LAKE)


def nearest_idx(p):
    return min(range(len(DENSE)), key=lambda i: (DENSE[i][0] - p[0]) ** 2 + (DENSE[i][1] - p[1]) ** 2)


def along_path(p_start, p_end, count):
    i0, i1 = nearest_idx(p_start), nearest_idx(p_end)
    if i1 < i0:
        i0, i1 = i1, i0
        rev = True
    else:
        rev = False
    seg = DENSE[i0:i1 + 1]
    # cumulatieve lengte
    cum = [0.0]
    for a, b in zip(seg, seg[1:]):
        cum.append(cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    total = cum[-1]
    res = []
    for k in range(count):
        target = total * k / (count - 1) if count > 1 else 0
        j = min(range(len(cum)), key=lambda i: abs(cum[i] - target))
        res.append(seg[j])
    return list(reversed(res)) if rev else res


# ---------- stekken ----------
stekken = []  # (nummer, (x,y) scan, (dx,dy) svg-offset naar buiten)

# NW-oever: 1,3,5,7
for nr, pt in zip([1, 3, 5, 7], [(885, 1040), (930, 957), (975, 875), (1048, 762)]):
    stekken.append((nr, pt, (-15, -3)))
# ingang-bank: 2,4,6,8,10 (gespiegeld stagger tegen overlap)
bank = [(770, 1394), (786, 1448), (799, 1487), (811, 1527), (820, 1562)]
for i, (nr, pt) in enumerate(zip([2, 4, 6, 8, 10], bank)):
    off = -14 if i % 2 == 0 else -27
    stekken.append((nr, pt, (off, 3)))
# NE-oever west-lob: 9 t/m 47
for nr, pt in zip(range(9, 48, 2), along_path((1350, 822), (2242, 1572), 20)):
    stekken.append((nr, pt, (10, -11)))
# dal: 49-53, 55
for nr, pt in zip([49, 51, 53], [(2325, 1702), (2400, 1798), (2452, 1866)]):
    stekken.append((nr, pt, (12, -8)))
stekken.append((55, (2545, 1895), (4, 15)))
# west-oever oost-lob: 57 t/m 77
for nr, pt in zip(range(57, 78, 2), along_path((2650, 1836), (3258, 1230), 11)):
    stekken.append((nr, pt, (-12, -9)))
# NE-oever oost-lob: 79 t/m 99
e_pts = [(3618, 1335), (3722, 1432), (3788, 1492), (3843, 1543), (3922, 1618),
         (3982, 1682), (4042, 1752), (4112, 1818), (4172, 1882), (4238, 1945), (4272, 2042)]
for nr, pt in zip(range(79, 100, 2), e_pts):
    stekken.append((nr, pt, (12, -8)))
# zuidoever oost-lob: 54 t/m 100
for i, nr in enumerate(range(54, 101, 2)):
    x = 2360 + (4237 - 2360) * i / 23
    stekken.append((nr, (x, 2218), (0, 16)))
# zuidoever west-lob: 20 t/m 52
for i, nr in enumerate(range(20, 53, 2)):
    x = 1015 + (2095 - 1015) * i / 16
    stekken.append((nr, (x, 2249), (0, 16)))

# ---------- dieptezones (scanruimte, impressionistisch conform origineel) ----------
C10 = [
    (1060, 1080), (1130, 870), (1230, 835), (1345, 915), (1500, 1055), (1700, 1215),
    (1900, 1405), (2060, 1550), (2210, 1690), (2330, 1810), (2430, 1905), (2530, 1948),
    (2630, 1885), (2760, 1780), (2870, 1665), (2975, 1545), (3090, 1430), (3210, 1345),
    (3335, 1310), (3455, 1365), (3520, 1475), (3530, 1605), (3465, 1735), (3340, 1840),
    (3190, 1908), (3040, 1938), (2890, 1955), (2760, 2000), (2610, 2070), (2470, 2115),
    (2330, 2100), (2180, 2090), (2020, 2105), (1850, 2115), (1680, 2095), (1500, 2112),
    (1310, 2082), (1150, 2005), (1078, 1885), (1038, 1725), (1028, 1500), (1038, 1280),
]
C15_W = [
    (1150, 1160), (1250, 1055), (1360, 1090), (1510, 1195), (1660, 1315), (1810, 1435),
    (1955, 1570), (2050, 1690), (2075, 1805), (1995, 1900), (1845, 1948), (1650, 1905),
    (1450, 1950), (1255, 1898), (1152, 1795), (1102, 1600), (1102, 1355),
]
C15_E = [
    (3055, 1505), (3150, 1385), (3280, 1332), (3400, 1372), (3468, 1472),
    (3448, 1602), (3330, 1700), (3180, 1720), (3068, 1640),
]
C18_W = [
    (1185, 1355), (1300, 1282), (1425, 1335), (1482, 1432), (1400, 1520), (1278, 1540), (1192, 1470),
]
C18_E = [
    (3205, 1482), (3292, 1402), (3378, 1452), (3388, 1550), (3298, 1620), (3212, 1580),
]

# ---------- SVG opbouwen ----------
W, H = 1150, 745
parts = []
parts.append(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="\'Segoe UI\', \'Helvetica Neue\', Arial, sans-serif">')
parts.append("""<defs>
<style>
 .stek circle{fill:#ffffff;stroke:#1d4e79;stroke-width:1.1;}
 .stek text{fill:#123c5e;font-weight:600;text-anchor:middle;}
 .lbl{fill:#5b5442;font-size:12px;}
 .contour{fill:none;stroke:#ffffff;stroke-opacity:.75;stroke-width:1.2;stroke-dasharray:5 4;}
 .dlabel{fill:#ffffff;font-size:11px;font-weight:600;opacity:.95;text-anchor:middle;}
 .road{stroke:#c9c2ad;stroke-width:10;fill:none;stroke-linecap:round;}
 .roadline{stroke:#ffffff;stroke-width:1.2;fill:none;stroke-dasharray:8 7;opacity:.9;}
</style>
</defs>""")
# achtergrond (land)
parts.append(f'<rect width="{W}" height="{H}" fill="#f2eee1"/>')

# wegen
# Roeleveenseweg NW (langs west-lob) en NE (langs oost-lob)
parts.append('<g>')
parts.append('<path class="road" d="M 8 470 L 128 24"/>')
parts.append('<path class="roadline" d="M 8 470 L 128 24"/>')
parts.append('<path class="road" d="M 786 118 L 1142 488"/>')
parts.append('<path class="roadline" d="M 786 118 L 1142 488"/>')
# zuidkant: fietspad + Rijksweg 12
parts.append('<path d="M 30 500 L 1120 492" stroke="#d8d2c0" stroke-width="4" fill="none"/>')
parts.append('<path class="road" d="M 20 540 L 1130 532"/>')
parts.append('<path class="roadline" d="M 20 540 L 1130 532"/>')
parts.append('</g>')
parts.append('<text class="lbl" transform="translate(52,320) rotate(-75)" font-style="italic">Roeleveenseweg</text>')
parts.append('<text class="lbl" transform="translate(1010,300) rotate(48)" font-style="italic">Roeleveenseweg</text>')
parts.append('<text class="lbl" x="565" y="487" font-style="italic" font-size="11">fietspad</text>')
parts.append('<text class="lbl" x="560" y="560" font-style="italic">Rijksweg 12 (A12)</text>')
parts.append('<text class="lbl" x="40" y="561" font-size="11">&#8592; Den Haag</text>')
parts.append('<text class="lbl" x="1035" y="561" font-size="11">Utrecht &#8594;</text>')

# meer: schaduw + waterbasis (0-10 m tint) + zones
lake_d = smooth_closed(LAKE, tension=0.9)
parts.append(f'<path d="{lake_d}" fill="#1d4e79" opacity="0.18" transform="translate(2.5,3.5)"/>')
parts.append(f'<path d="{lake_d}" fill="#b9dcf2"/>')
parts.append(f'<clipPath id="lake"><path d="{lake_d}"/></clipPath>')
parts.append('<g clip-path="url(#lake)">')
parts.append(f'<path d="{smooth_closed(C10)}" fill="#7cbde4"/>')
parts.append(f'<path d="{smooth_closed(C15_W)}" fill="#3f8dc6"/>')
parts.append(f'<path d="{smooth_closed(C15_E)}" fill="#3f8dc6"/>')
parts.append(f'<path d="{smooth_closed(C18_W)}" fill="#1f639c"/>')
parts.append(f'<path d="{smooth_closed(C18_E)}" fill="#1f639c"/>')
# contourlijnen
for poly in (C10, C15_W, C15_E, C18_W, C18_E):
    parts.append(f'<path class="contour" d="{smooth_closed(poly)}"/>')
parts.append('</g>')
# oeverlijn
parts.append(f'<path d="{lake_d}" fill="none" stroke="#2b6a99" stroke-width="2.2"/>')

# dieptelabels
for txt, pt in [("10m", (1180, 990)), ("15m", (1600, 1750)), ("18m", (1330, 1430)),
                ("18m", (3295, 1512)), ("15m", (3390, 1660)), ("10m", (2690, 2015)),
                ("&#177; 5 m", (3800, 1980)), ("&#177; 5 m", (900, 1800))]:
    x, y = T(pt)
    fill = '#ffffff' if not txt.startswith('&#177;') else '#2b6a99'
    parts.append(f'<text class="dlabel" x="{fmt(x)}" y="{fmt(y)}" fill="{fill}">{txt}</text>')

# stekken
parts.append('<g class="stek" font-size="8">')
for nr, pt, off in stekken:
    x, y = T(pt)
    cx, cy = x + off[0], y + off[1]
    parts.append(f'<line x1="{fmt(x)}" y1="{fmt(y)}" x2="{fmt(cx)}" y2="{fmt(cy)}" stroke="#1d4e79" stroke-width="0.8"/>')
    parts.append(f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="6.6"/>')
    parts.append(f'<text x="{fmt(cx)}" y="{fmt(cy + 2.6)}">{nr}</text>')
parts.append('</g>')

# landmarks
def landmark(pt, tekst, dx=0, dy=0, anchor='start', size=11):
    x, y = T(pt)
    return (f'<text x="{fmt(x + dx)}" y="{fmt(y + dy)}" fill="#5b5442" font-size="{size}" '
            f'font-style="italic" text-anchor="{anchor}">{tekst}</text>')

# ingang + pijl
ix, iy = T((640, 1470))
parts.append(f'<text x="{fmt(ix - 24)}" y="{fmt(iy + 22)}" fill="#8a3d2f" font-size="12" font-weight="700" text-anchor="start">ingang</text>')
parts.append(f'<path d="M {fmt(ix - 4)} {fmt(iy + 12)} L {fmt(ix + 26)} {fmt(iy - 6)}" stroke="#8a3d2f" stroke-width="1.6" fill="none" marker-end="url(#arr)"/>')
parts.append('<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#8a3d2f"/></marker></defs>')
# schuilhut
sx, sy = T((820, 1230))
parts.append(f'<rect x="{fmt(sx - 26)}" y="{fmt(sy - 5)}" width="11" height="8" fill="#8a7f63" stroke="#5b5442" stroke-width="1"/>')
parts.append(f'<text x="{fmt(sx - 30)}" y="{fmt(sy + 3)}" fill="#5b5442" font-size="10" font-style="italic" text-anchor="end">schuilhut</text>')
# duiker + brug
parts.append(landmark((2245, 2320), 'duiker', 0, 12, 'middle', 10))
parts.append(landmark((3900, 1505), 'brug', 26, -6, 'start', 10))

# noordpijl
nx, ny = 585, 60
parts.append(f'<g stroke="#4a4536" fill="#4a4536"><line x1="{nx}" y1="{ny + 26}" x2="{nx}" y2="{ny - 14}" stroke-width="1.6"/>'
             f'<path d="M {nx} {ny - 22} L {nx - 6} {ny - 6} L {nx} {ny - 11} L {nx + 6} {ny - 6} Z"/>'
             f'<text x="{nx}" y="{ny + 44}" text-anchor="middle" font-size="13" font-weight="700" stroke="none">N</text></g>')

# titel
parts.append('<text x="30" y="618" font-size="26" font-weight="700" fill="#123c5e">Plas van der Ende</text>')
parts.append('<text x="30" y="641" font-size="13" fill="#5b5442">Dieptekaart met steknummers 1 t/m 100 &#183; NPHV Nootdorps Pijnackerse Hengelsport Vereniging</text>')
parts.append('<text x="30" y="660" font-size="11" fill="#8a8268">Nagetekend naar de originele dieptemetingen (schaal 1:2000) &#183; dieptes in meters</text>')

# legenda
lx, ly = 700, 600
zones = [("0 - 10 m", "#b9dcf2"), ("10 - 15 m", "#7cbde4"), ("15 - 18 m", "#3f8dc6"), ("&gt; 18 m", "#1f639c")]
parts.append(f'<text x="{lx}" y="{ly - 8}" font-size="12" font-weight="700" fill="#123c5e">diepte</text>')
for i, (t, c) in enumerate(zones):
    x = lx + i * 105
    parts.append(f'<rect x="{x}" y="{ly}" width="20" height="14" fill="{c}" stroke="#2b6a99" stroke-width="0.8" rx="2"/>')
    parts.append(f'<text x="{x + 26}" y="{ly + 11}" font-size="12" fill="#4a4536">{t}</text>')
parts.append(f'<g class="stek" font-size="8"><circle cx="{lx + 10}" cy="{ly + 40}" r="6.6"/><text x="{lx + 10}" y="{fmt(ly + 42.6)}">55</text></g>')
parts.append(f'<text x="{lx + 26}" y="{ly + 44}" font-size="12" fill="#4a4536">steknummer</text>')

parts.append('</svg>')

with open('plas-van-der-ende-dieptekaart.svg', 'w') as f:
    f.write('\n'.join(parts))
print('SVG geschreven,', len(stekken), 'stekken')

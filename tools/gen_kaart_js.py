# -*- coding: utf-8 -*-
# Genereert site/kaart.js: interactieve kaart-SVG + stekring voor de wedstrijd-app.
# Draaien vanuit de tools-map: python3 gen_kaart_js.py
import json
import math
import os
import shape

S = 3.7
OX, OY = 540, 555


def T(p):
    return ((p[0] - OX) / S, (p[1] - OY) / S)


def fmt(v):
    return f"{v:.1f}"


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


LAKE = shape.LAKE


def path_resample(poly):
    pts = poly + [poly[0]]
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
    rev = i1 < i0
    if rev:
        i0, i1 = i1, i0
    seg = DENSE[i0:i1 + 1]
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


stekken = []
for nr, pt in zip([1, 3, 5, 7], [(885, 1040), (930, 957), (975, 875), (1048, 762)]):
    stekken.append((nr, pt, (-15, -3)))
bank = [(770, 1394), (786, 1448), (799, 1487), (811, 1527), (820, 1562)]
for i, (nr, pt) in enumerate(zip([2, 4, 6, 8, 10], bank)):
    off = -14 if i % 2 == 0 else -27
    stekken.append((nr, pt, (off, 3)))
for nr, pt in zip(range(9, 48, 2), along_path((1350, 822), (2242, 1572), 20)):
    stekken.append((nr, pt, (10, -11)))
for nr, pt in zip([49, 51, 53], [(2325, 1702), (2400, 1798), (2452, 1866)]):
    stekken.append((nr, pt, (12, -8)))
stekken.append((55, (2545, 1895), (4, 15)))
for nr, pt in zip(range(57, 78, 2), along_path((2650, 1836), (3258, 1230), 11)):
    stekken.append((nr, pt, (-12, -9)))
e_pts = [(3618, 1335), (3722, 1432), (3788, 1492), (3843, 1543), (3922, 1618),
         (3982, 1682), (4042, 1752), (4112, 1818), (4172, 1882), (4238, 1945), (4272, 2042)]
for nr, pt in zip(range(79, 100, 2), e_pts):
    stekken.append((nr, pt, (12, -8)))
for i, nr in enumerate(range(54, 101, 2)):
    x = 2360 + (4237 - 2360) * i / 23
    stekken.append((nr, (x, 2218), (0, 16)))
for i, nr in enumerate(range(20, 53, 2)):
    x = 1015 + (2095 - 1015) * i / 16
    stekken.append((nr, (x, 2249), (0, 16)))

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

W, H = 1150, 575
parts = []
parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="system-ui, \'Segoe UI\', Arial, sans-serif">')
parts.append(f'<rect width="{W}" height="{H}" fill="#f2eee1"/>')
parts.append('<g>')
parts.append('<path d="M 8 470 L 128 24" stroke="#c9c2ad" stroke-width="10" fill="none" stroke-linecap="round"/>')
parts.append('<path d="M 8 470 L 128 24" stroke="#ffffff" stroke-width="1.2" fill="none" stroke-dasharray="8 7" opacity=".9"/>')
parts.append('<path d="M 786 118 L 1142 488" stroke="#c9c2ad" stroke-width="10" fill="none" stroke-linecap="round"/>')
parts.append('<path d="M 786 118 L 1142 488" stroke="#ffffff" stroke-width="1.2" fill="none" stroke-dasharray="8 7" opacity=".9"/>')
parts.append('<path d="M 30 512 L 1120 505" stroke="#d8d2c0" stroke-width="4" fill="none"/>')
parts.append('<path d="M 20 548 L 1130 541" stroke="#c9c2ad" stroke-width="10" fill="none" stroke-linecap="round"/>')
parts.append('<path d="M 20 548 L 1130 541" stroke="#ffffff" stroke-width="1.2" fill="none" stroke-dasharray="8 7" opacity=".9"/>')
parts.append('</g>')
parts.append('<text transform="translate(52,320) rotate(-75)" font-style="italic" fill="#5b5442" font-size="12">Roeleveenseweg</text>')
parts.append('<text transform="translate(1010,300) rotate(48)" font-style="italic" fill="#5b5442" font-size="12">Roeleveenseweg</text>')
parts.append('<text x="565" y="500" font-style="italic" fill="#5b5442" font-size="11">fietspad</text>')
parts.append('<text x="545" y="568" font-style="italic" fill="#5b5442" font-size="12">Rijksweg 12 (A12)</text>')

lake_d = smooth_closed(LAKE, tension=0.9)
parts.append(f'<path d="{lake_d}" fill="#1d4e79" opacity="0.18" transform="translate(2.5,3.5)"/>')
parts.append(f'<path d="{lake_d}" fill="#b9dcf2"/>')
parts.append(f'<clipPath id="lake"><path d="{lake_d}"/></clipPath>')
# Sinds 17 jul 2026: de echte dieptekaart (sonar-scan NPHV, bron
# "Bodemstructuur kaart 1.png" in de Karperplas-klantmap) als onderlaag,
# geclipt op de oevercontour zodat de fotorand exact samenvalt met de
# vector-oever. De matrix (beeld 2250x1177 -> viewBox) komt uit de
# contour-fit in KemblincK/Viswedstrijdapp/kaart-proef-tools/ (IoU 0.93);
# bij een nieuwe scan de fit opnieuw draaien (fit_kaart.py) en de zes
# getallen hier bijwerken. De oude vector-dieptelagen (C10/C15/C18
# hierboven) blijven bewaard als terugval maar worden niet meer getekend.
parts.append('<g clip-path="url(#lake)">'
             '<image href="dieptekaart.jpg" width="2250" height="1177" '
             'transform="matrix(0.42250 -0.05100 0.05100 0.42250 21.241 63.470)" '
             'preserveAspectRatio="none"/></g>')

# vaste zone-indeling (getekend door de organisatie, getraceerd via tools/zonelaag.json);
# app.js toont deze laag alleen als de wedstrijd-zones overeenkomen met de standaard
with open(os.path.join(os.path.dirname(__file__), 'zonelaag.json')) as zf:
    ZONELAAG = json.load(zf)
parts.append('<g id="zonelaag" style="display:none">')
parts.append('<g clip-path="url(#lake)" stroke="#c2451e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85">')
for lijn in ZONELAAG['lijnen']:
    d = 'M ' + ' L '.join(f"{fmt(x)} {fmt(y)}" for x, y in lijn)
    parts.append(f'<path d="{d}"/>')
parts.append('</g>')
parts.append('<g text-anchor="middle" font-weight="800">')
for let in ZONELAAG['letters']:
    parts.append(f'<g class="zoneletter" data-zone="{let["letter"]}" style="cursor:pointer">'
                 f'<circle cx="{fmt(let["x"])}" cy="{fmt(let["y"])}" r="14" fill="transparent" stroke="none"/>'
                 f'<circle class="zoneletter-dot" cx="{fmt(let["x"])}" cy="{fmt(let["y"])}" r="9.5" fill="#ffffff" fill-opacity="0.88" stroke="#c2451e" stroke-width="1.6"/>'
                 f'<text x="{fmt(let["x"])}" y="{fmt(let["y"] + 4.2)}" font-size="12" fill="#9a3413" pointer-events="none">{let["letter"]}</text></g>')
parts.append('</g>')
parts.append('</g>')

parts.append(f'<path d="{lake_d}" fill="none" stroke="#2b6a99" stroke-width="2.2"/>')

# dieptelabels: donker met witte halo, leesbaar op elke tint van de fotokaart
for txt, pt, _licht in [("10m", (1180, 990), True), ("15m", (1600, 1750), True), ("18m", (1330, 1430), True),
                        ("18m", (3295, 1512), True), ("15m", (3390, 1660), True), ("10m", (2690, 2015), True),
                        ("± 5 m", (3800, 1980), False), ("± 5 m", (900, 1800), False)]:
    x, y = T(pt)
    parts.append(f'<text x="{fmt(x)}" y="{fmt(y)}" fill="#123c5e" stroke="#ffffff" stroke-width="2.6" '
                 f'stroke-opacity=".8" paint-order="stroke" font-size="11" font-weight="600" '
                 f'opacity=".95" text-anchor="middle">{txt}</text>')

# herkenningspunten (aangewezen door Patrick op satellietfoto's, 6-7 jul 2026)
parts.append('<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#8a3d2f"/></marker></defs>')


def geb(x, y, w=13, h=9, fill='#8a7f63'):
    X, Y = T((x, y))
    parts.append(f'<rect x="{fmt(X - w / 2)}" y="{fmt(Y - h / 2)}" width="{w}" height="{h}" fill="{fill}" stroke="#5b5442" stroke-width="1" rx="1"/>')


def lab(x, y, tekst, anchor='start', kleur='#5b5442', size=10, vet=False):
    X, Y = T((x, y))
    stijl = ' font-weight="700"' if vet else ' font-style="italic"'
    parts.append(f'<text x="{fmt(X)}" y="{fmt(Y)}" font-size="{size}"{stijl} fill="{kleur}" text-anchor="{anchor}">{tekst}</text>')


def pijl(x1, y1, x2, y2):
    X1, Y1 = T((x1, y1))
    X2, Y2 = T((x2, y2))
    parts.append(f'<path d="M {fmt(X1)} {fmt(Y1)} L {fmt(X2)} {fmt(Y2)}" stroke="#8a3d2f" stroke-width="1.6" fill="none" marker-end="url(#arr)"/>')


geb(628, 1590, 18, 12)                       # manege (west, links van stek 6)
lab(640, 1660, 'manege', 'middle')
geb(820, 1230, 11, 8)                        # schuilhut
lab(802, 1236, 'schuilhut', 'end')
geb(806, 1012, 10, 6, '#9a9a8c')             # container + ingang noord (bij stek 1)
lab(842, 1000, 'container')
pijl(706, 942, 792, 988)
lab(696, 936, 'ingang', 'end', '#8a3d2f', 10, True)
geb(2330, 1902, 14, 10, '#c9c2ad')           # De Dobber, drijvend clubhuis (bij stek 53)
lab(2308, 1958, 'De Dobber (clubhuis)', 'end', '#123c5e')
tx1, ty1 = T((3706, 1450))                   # TNO-meetstation op het water (bij stek 81)
tx2, ty2 = T((3612, 1524))
parts.append(f'<line x1="{fmt(tx1)}" y1="{fmt(ty1)}" x2="{fmt(tx2)}" y2="{fmt(ty2)}" stroke="#5b5442" stroke-width="2"/>')
geb(3604, 1530, 13, 10, '#c9c2ad')
lab(3585, 1588, 'TNO-meetstation', 'end', '#123c5e')
geb(4424, 2112, 13, 10)                      # woning zuidoosthoek (bij stek 99)
lab(4400, 2178, 'woning', 'end')
geb(2268, 2256, 12, 5, '#b0a789')            # bruggetje + ingang bij de duiker (stek 54)
lab(2244, 2262, 'brug', 'end')
lab(2196, 2330, 'duiker', 'end')
pijl(2298, 2332, 2324, 2250)
lab(2320, 2352, 'ingang', 'start', '#8a3d2f', 10, True)
pijl(958, 2332, 1000, 2258)                  # ingang zuidwest (bij stek 22)
lab(948, 2348, 'ingang', 'end', '#8a3d2f', 10, True)

nx, ny = 585, 56
parts.append(f'<g stroke="#4a4536" fill="#4a4536"><line x1="{nx}" y1="{ny + 26}" x2="{nx}" y2="{ny - 14}" stroke-width="1.6"/>'
             f'<path d="M {nx} {ny - 22} L {nx - 6} {ny - 6} L {nx} {ny - 11} L {nx + 6} {ny - 6} Z"/>'
             f'<text x="{nx}" y="{ny + 44}" text-anchor="middle" font-size="13" font-weight="700" stroke="none">N</text></g>')

# klikbare stekken
parts.append('<g id="stekken" font-size="8.2">')
stek_posities = {}
for nr, pt, off in stekken:
    x, y = T(pt)
    cx, cy = x + off[0], y + off[1]
    parts.append(f'<g class="stek" data-stek="{nr}" style="cursor:pointer">'
                 f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="13" fill="transparent" stroke="none"/>'
                 f'<line x1="{fmt(x)}" y1="{fmt(y)}" x2="{fmt(cx)}" y2="{fmt(cy)}" stroke="#1d4e79" stroke-width="0.8" pointer-events="none"/>'
                 f'<circle class="stek-dot" cx="{fmt(cx)}" cy="{fmt(cy)}" r="7.4" fill="#ffffff" stroke="#1d4e79" stroke-width="1.1"/>'
                 f'<text x="{fmt(cx)}" y="{fmt(cy + 2.8)}" fill="#123c5e" font-weight="600" text-anchor="middle" pointer-events="none">{nr}</text>'
                 f'<title></title></g>')
parts.append('</g>')
parts.append('</svg>')
svg = ''.join(parts)

# stekring: zelfde volgorde als wedstrijd.stek_ring in de database
ring = []
pos = 0
for stek in range(1, 100, 2):
    pos += 1
    ring.append((stek, pos))
for stek in range(100, 53, -2):
    pos += 1
    ring.append((stek, pos))
for stek in range(52, 19, -2):
    pos += 1
    ring.append((stek, pos))
pos += 1  # gat: zuidwest-oever zonder stekken
for stek in [10, 8, 6, 4, 2]:
    pos += 1
    ring.append((stek, pos))

out = (
    "// Gegenereerd door tools/gen_kaart_js.py, niet met de hand bewerken\n"
    f"const KAART_SVG = {json.dumps(svg)};\n"
    f"const STEK_POSITIE = {json.dumps({str(s): p for s, p in ring})};\n"
    f"const ZONE_STANDAARD = {json.dumps(ZONELAAG['zones'])};\n"
)
dest = os.path.join(os.path.dirname(__file__), '..', 'docs', 'nphv', 'kaart.js')
with open(dest, 'w') as f:
    f.write(out)
print('kaart.js geschreven:', len(svg), 'bytes svg,', len(ring), 'stekken')

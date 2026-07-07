# -*- coding: utf-8 -*-
# DEFINITIEVE zonekaart: Patricks handgetekende zonelijnen (getraceerd uit de
# foto) op de wedstrijdstekkenkaart, met zoneletters A.. en zonelijst.
import math
import json
import sys
import numpy as np
from PIL import Image, ImageDraw
from collections import deque

sys.path.insert(0, '/Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijden/tools')
import shape

S = 3.7
OX, OY = 540, 555
SCH = 1280 / 1150  # beeld-px per viewBox-eenheid

def T(p):
    return ((p[0] - OX) / S, (p[1] - OY) / S)

def naar_img(p):
    v = T(p)
    return (v[0] * SCH, v[1] * SCH)

def fmt(v):
    return f"{v:.1f}"

def smooth_closed(points, tension=1.0):
    pts = [T(p) for p in points]
    n = len(pts)
    d = f"M {fmt(pts[0][0])} {fmt(pts[0][1])} "
    for i in range(n):
        p0, p1, p2, p3 = pts[(i-1) % n], pts[i], pts[(i+1) % n], pts[(i+2) % n]
        c1 = (p1[0] + (p2[0]-p0[0])/6*tension, p1[1] + (p2[1]-p0[1])/6*tension)
        c2 = (p2[0] - (p3[0]-p1[0])/6*tension, p2[1] - (p3[1]-p1[1])/6*tension)
        d += f"C {fmt(c1[0])} {fmt(c1[1])} {fmt(c2[0])} {fmt(c2[1])} {fmt(p2[0])} {fmt(p2[1])} "
    return d + "Z"

LAKE = shape.LAKE

def path_resample(poly):
    pts = poly + [poly[0]]
    out = [poly[0]]
    for a, b in zip(pts, pts[1:]):
        dist = math.hypot(b[0]-a[0], b[1]-a[1])
        steps = max(1, int(dist / 8))
        for s in range(1, steps+1):
            out.append((a[0]+(b[0]-a[0])*s/steps, a[1]+(b[1]-a[1])*s/steps))
    return out

DENSE = path_resample(LAKE)
N = len(DENSE)

def nearest_idx(p):
    return min(range(N), key=lambda i: (DENSE[i][0]-p[0])**2 + (DENSE[i][1]-p[1])**2)

def along_path(p_start, p_end, count):
    i0, i1 = nearest_idx(p_start), nearest_idx(p_end)
    rev = i1 < i0
    if rev:
        i0, i1 = i1, i0
    seg = DENSE[i0:i1+1]
    cum = [0.0]
    for a, b in zip(seg, seg[1:]):
        cum.append(cum[-1] + math.hypot(b[0]-a[0], b[1]-a[1]))
    total = cum[-1]
    res = []
    for k in range(count):
        doel = total * k / (count-1) if count > 1 else 0
        j = min(range(len(cum)), key=lambda i: abs(cum[i]-doel))
        res.append(seg[j])
    return list(reversed(res)) if rev else res

# stek-ankers (zelfde als de app-generator)
stekken = {}
for nr, pt in zip([1, 3, 5, 7], [(885, 1040), (930, 957), (975, 875), (1048, 762)]):
    stekken[nr] = pt
bank = [(770, 1394), (786, 1448), (799, 1487), (811, 1527), (820, 1562)]
for nr, pt in zip([2, 4, 6, 8, 10], bank):
    stekken[nr] = pt
for nr, pt in zip(range(9, 48, 2), along_path((1350, 822), (2242, 1572), 20)):
    stekken[nr] = pt
for nr, pt in zip([49, 51, 53], [(2325, 1702), (2400, 1798), (2452, 1866)]):
    stekken[nr] = pt
stekken[55] = (2545, 1895)
for nr, pt in zip(range(57, 78, 2), along_path((2650, 1836), (3258, 1230), 11)):
    stekken[nr] = pt
e_pts = [(3618, 1335), (3722, 1432), (3788, 1492), (3843, 1543), (3922, 1618),
         (3982, 1682), (4042, 1752), (4112, 1818), (4172, 1882), (4238, 1945), (4272, 2042)]
for nr, pt in zip(range(79, 100, 2), e_pts):
    stekken[nr] = pt
for i, nr in enumerate(range(54, 101, 2)):
    stekken[nr] = (2360 + (4237-2360)*i/23, 2218)
for i, nr in enumerate(range(20, 53, 2)):
    stekken[nr] = (1015 + (2095-1015)*i/16, 2249)

RING_POS = {}
pos = 0
for s_ in range(1, 100, 2):
    pos += 1; RING_POS[s_] = pos
for s_ in range(100, 53, -2):
    pos += 1; RING_POS[s_] = pos
for s_ in range(52, 19, -2):
    pos += 1; RING_POS[s_] = pos
pos += 1
for s_ in [10, 8, 6, 4, 2]:
    pos += 1; RING_POS[s_] = pos

WEDSTRIJD = sorted([3, 6, 24, 26, 27, 34, 37, 40, 42, 47, 50, 55, 58, 61, 65, 68, 75, 76, 78, 85, 91, 99],
                   key=lambda s_: RING_POS[s_])

# ---- getraceerde zonelijnen (beeld-px 1280x779), einden naar oever overshooten
net = json.load(open('netwerk.json'))
W_IMG, H_IMG = 1280, 779

LAKE_IMG = [naar_img(p) for p in LAKE]

def dichtst_op_contour(x, y):
    beste, bd = None, 1e18
    pts = LAKE_IMG + [LAKE_IMG[0]]
    for a, b in zip(pts, pts[1:]):
        ax, ay, bx, by = a[0], a[1], b[0], b[1]
        dx, dy = bx-ax, by-ay
        t = max(0, min(1, ((x-ax)*dx + (y-ay)*dy) / max(1e-9, dx*dx+dy*dy)))
        q = (ax+t*dx, ay+t*dy)
        d = (q[0]-x)**2 + (q[1]-y)**2
        if d < bd:
            beste, bd = q, d
    return beste, math.sqrt(bd)

# eindpunt-graad in het netwerk om losse uiteinden te herkennen
tel = {}
def sleutel(p):
    return (round(p[0]), round(p[1]))
for k in net:
    for e in (k[0], k[-1]):
        tel[sleutel(e)] = tel.get(sleutel(e), 0) + 1

# rommelige dubbele kruising bij de L/K-junctie samentrekken tot 1 knooppunt
# (in de tekening ontstond daar een klein driehoekje)
VAK = (735, 372, 783, 404)   # x0, y0, x1, y1 in beeld-px
KNOOP = (762.0, 392.0)
def in_vak(p):
    return VAK[0] <= p[0] <= VAK[2] and VAK[1] <= p[1] <= VAK[3]
samengetrokken = []
for k in net:
    pts = [tuple(p) for p in k]
    nieuw = []
    for pt in pts:
        if in_vak(pt):
            if not nieuw or nieuw[-1] != KNOOP:
                nieuw.append(KNOOP)
        else:
            nieuw.append(pt)
    lengte = sum(math.hypot(b[0]-a[0], b[1]-a[1]) for a, b in zip(nieuw, nieuw[1:]))
    if len(nieuw) >= 2 and lengte > 6:
        samengetrokken.append([list(pt) for pt in nieuw])
net = samengetrokken

# extra grens (verzoek Patrick 7 jul): vanaf stek 81 langs het TNO-meetstation
# omlaag naar het bestaande lijnennet, zodat 75 en 85 aparte zones worden
net.append([[957.0, 264.0], [944.0, 292.0], [920.0, 316.0], [896.0, 327.0], [881.0, 330.0]])

tel = {}
for k in net:
    for e in (k[0], k[-1]):
        tel[sleutel(e)] = tel.get(sleutel(e), 0) + 1

# korte losse spurs (dood eind in het water) wegsnoeien
def is_spur(k):
    lengte = sum(math.hypot(b[0]-a[0], b[1]-a[1]) for a, b in zip(k, k[1:]))
    if lengte > 35:
        return False
    for e in (k[0], k[-1]):
        if tel[sleutel(e)] == 1 and dichtst_op_contour(e[0], e[1])[1] > 25:
            return True
    return False
net = [k for k in net if not is_spur(k)]

# raster-versie met overshoot voorbij de oever (voor regiodetectie)
raster_lijnen = []
for k in net:
    pts = [tuple(p) for p in k]
    for kant in (0, -1):
        e = pts[kant]
        if tel[sleutel(e)] > 1:
            continue
        (qx, qy), d = dichtst_op_contour(e[0], e[1])
        if d < 45:
            binnen = pts[1] if kant == 0 else pts[-2]
            rx, ry = qx - binnen[0], qy - binnen[1]
            L = max(1e-9, math.hypot(rx, ry))
            over = (qx + rx/L*28, qy + ry/L*28)
            if kant == 0:
                pts = [over] + pts
            else:
                pts = pts + [over]
    raster_lijnen.append(pts)

meer_img = Image.new('L', (W_IMG, H_IMG), 0)
ImageDraw.Draw(meer_img).polygon(LAKE_IMG, fill=255)
meer = np.asarray(meer_img) > 0
rand_img = Image.new('L', (W_IMG, H_IMG), 0)
dr = ImageDraw.Draw(rand_img)
for pts in raster_lijnen:
    dr.line(pts, fill=255, width=11, joint='curve')
rand = np.asarray(rand_img) > 0
water = meer & ~rand

lab = np.zeros((H_IMG, W_IMG), dtype=np.int32)
volgende = 0
for y0 in range(0, H_IMG, 4):
    for x0 in range(0, W_IMG, 4):
        if water[y0, x0] and lab[y0, x0] == 0:
            volgende += 1
            q = deque([(y0, x0)])
            lab[y0, x0] = volgende
            while q:
                y, x = q.popleft()
                for ny, nx in ((y+1, x), (y-1, x), (y, x+1), (y, x-1)):
                    if 0 <= ny < H_IMG and 0 <= nx < W_IMG and water[ny, nx] and lab[ny, nx] == 0:
                        lab[ny, nx] = volgende
                        q.append((ny, nx))
groottes = {i: int((lab == i).sum()) for i in range(1, volgende+1)}
groot = {i for i, g in groottes.items() if g > 1500}

def regio_van(pt):
    x, y = naar_img(pt)
    x, y = int(round(x)), int(round(y))
    beste, bd = None, 1e18
    r = 40
    for yy in range(max(0, y-r), min(H_IMG, y+r+1)):
        for xx in range(max(0, x-r), min(W_IMG, x+r+1)):
            l = lab[yy, xx]
            if l in groot:
                d = (yy-y)**2 + (xx-x)**2
                if d < bd:
                    beste, bd = l, d
    return beste

zones = {}
for nr in WEDSTRIJD:
    zones.setdefault(regio_van(stekken[nr]), []).append(nr)
zonelijst = sorted(zones.items(), key=lambda kv: min(RING_POS[n] for n in kv[1]))
LETTERS = {}
for i, (l, leden) in enumerate(zonelijst):
    LETTERS[l] = chr(65+i)
    print(chr(65+i), '=', sorted(leden), f'({groottes[l]}px)')
leeg = [l for l in groot if l not in zones]
print('lege grote regio\'s:', leeg)

# letterposities: erosie-pool per regio
def pool(l):
    m = (lab == l)
    while True:
        m2 = m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
        m2 = m2 & np.roll(np.roll(m, 1, 0), 1, 1) & np.roll(np.roll(m, -1, 0), -1, 1)
        if m2.sum() < 400:
            break
        m = m2
    ys, xs = np.nonzero(m)
    return (float(xs.mean()), float(ys.mean()))

posities = {l: pool(l) for l in zones}
# handmatige bijstelling: E-label weg van het De Dobber-label (beeld-px)
for l, leden in zones.items():
    if sorted(leden) == [55]:
        posities[l] = (posities[l][0] + 18, posities[l][1] - 14)

# lijnen licht gladstrijken (Chaikin) voor het tekenen
def chaikin(pts, it=1):
    for _ in range(it):
        nieuw = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            nieuw.append((a[0]*0.72+b[0]*0.28, a[1]*0.72+b[1]*0.28))
            nieuw.append((a[0]*0.28+b[0]*0.72, a[1]*0.28+b[1]*0.72))
        nieuw.append(pts[-1])
        pts = nieuw
    return pts

# export voor de app-kaart (tools/gen_kaart_js.py leest dit bestand)
def chaikin_vroeg(pts, it=1):
    for _ in range(it):
        nieuw = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            nieuw.append((a[0]*0.72+b[0]*0.28, a[1]*0.72+b[1]*0.28))
            nieuw.append((a[0]*0.28+b[0]*0.72, a[1]*0.28+b[1]*0.72))
        nieuw.append(pts[-1])
        pts = nieuw
    return pts

zonelaag = {
    'lijnen': [[[round(x/SCH, 1), round(y/SCH, 1)] for x, y in chaikin_vroeg([tuple(pt) for pt in k], 2)]
               for k in raster_lijnen],
    'letters': [{'letter': LETTERS[l], 'x': round(posities[l][0]/SCH, 1), 'y': round(posities[l][1]/SCH, 1)}
                for l, _ in zonelijst],
    'zones': [{'naam': LETTERS[l], 'stekken': sorted(leden)} for l, leden in zonelijst],
}
json.dump(zonelaag, open('zonelaag.json', 'w'), indent=1)
print('zonelaag.json geschreven:', len(zonelaag['lijnen']), 'lijnen,', len(zonelaag['letters']), 'letters')

# ---- SVG
C10 = [(1060,1080),(1130,870),(1230,835),(1345,915),(1500,1055),(1700,1215),(1900,1405),(2060,1550),
       (2210,1690),(2330,1810),(2430,1905),(2530,1948),(2630,1885),(2760,1780),(2870,1665),(2975,1545),
       (3090,1430),(3210,1345),(3335,1310),(3455,1365),(3520,1475),(3530,1605),(3465,1735),(3340,1840),
       (3190,1908),(3040,1938),(2890,1955),(2760,2000),(2610,2070),(2470,2115),(2330,2100),(2180,2090),
       (2020,2105),(1850,2115),(1680,2095),(1500,2112),(1310,2082),(1150,2005),(1078,1885),(1038,1725),
       (1028,1500),(1038,1280)]
C15_W = [(1150,1160),(1250,1055),(1360,1090),(1510,1195),(1660,1315),(1810,1435),(1955,1570),(2050,1690),
         (2075,1805),(1995,1900),(1845,1948),(1650,1905),(1450,1950),(1255,1898),(1152,1795),(1102,1600),(1102,1355)]
C15_E = [(3055,1505),(3150,1385),(3280,1332),(3400,1372),(3468,1472),(3448,1602),(3330,1700),(3180,1720),(3068,1640)]
C18_W = [(1185,1355),(1300,1282),(1425,1335),(1482,1432),(1400,1520),(1278,1540),(1192,1470)]
C18_E = [(3205,1482),(3292,1402),(3378,1452),(3388,1550),(3298,1620),(3212,1580)]

W, H = 1150, 700
p = []
p.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="system-ui, Arial, sans-serif">')
p.append(f'<rect width="{W}" height="{H}" fill="#f2eee1"/>')
p.append('<path d="M 8 470 L 128 24" stroke="#c9c2ad" stroke-width="10" fill="none" stroke-linecap="round"/>')
p.append('<path d="M 786 118 L 1142 488" stroke="#c9c2ad" stroke-width="10" fill="none" stroke-linecap="round"/>')
p.append('<path d="M 20 548 L 1130 541" stroke="#c9c2ad" stroke-width="10" fill="none" stroke-linecap="round"/>')

lake_d = smooth_closed(LAKE, tension=0.9)
p.append(f'<path d="{lake_d}" fill="#1d4e79" opacity="0.18" transform="translate(2.5,3.5)"/>')
p.append(f'<path d="{lake_d}" fill="#b9dcf2"/>')
p.append(f'<clipPath id="lake"><path d="{lake_d}"/></clipPath>')
p.append('<g clip-path="url(#lake)">')
p.append(f'<path d="{smooth_closed(C10)}" fill="#7cbde4"/>')
p.append(f'<path d="{smooth_closed(C15_W)}" fill="#3f8dc6"/>')
p.append(f'<path d="{smooth_closed(C15_E)}" fill="#3f8dc6"/>')
p.append(f'<path d="{smooth_closed(C18_W)}" fill="#1f639c"/>')
p.append(f'<path d="{smooth_closed(C18_E)}" fill="#1f639c"/>')
for poly in (C10, C15_W, C15_E, C18_W, C18_E):
    p.append(f'<path d="{smooth_closed(poly)}" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="1" stroke-dasharray="5 4"/>')

# zonelijnen binnen het meer tekenen (in de clip)
p.append('<g stroke="#c2451e" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9">')
for pts in raster_lijnen:
    glad = chaikin(pts, 2)
    d_ = 'M ' + ' L '.join(f'{fmt(x/SCH)} {fmt(y/SCH)}' for x, y in glad)
    p.append(f'<path d="{d_}"/>')
p.append('</g>')
p.append('</g>')
p.append(f'<path d="{lake_d}" fill="none" stroke="#2b6a99" stroke-width="2.2"/>')

# === herkenningspunten ===
p.append('<defs><marker id="pijlpunt" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#8a3d2f"/></marker></defs>')

def _geb(x, y, w=13, h=9, fill='#8a7f63'):
    X, Y = T((x, y))
    p.append(f'<rect x="{fmt(X-w/2)}" y="{fmt(Y-h/2)}" width="{w}" height="{h}" fill="{fill}" stroke="#5b5442" stroke-width="1" rx="1"/>')

def _lab(x, y, tekst, anchor='start', kleur='#5b5442', size=10.5, vet=False):
    X, Y = T((x, y))
    w_ = ' font-weight="700"' if vet else ' font-style="italic"'
    p.append(f'<text x="{fmt(X)}" y="{fmt(Y)}" font-size="{size}"{w_} fill="{kleur}" text-anchor="{anchor}">{tekst}</text>')

def _pijl(x1, y1, x2, y2):
    X1, Y1 = T((x1, y1)); X2, Y2 = T((x2, y2))
    p.append(f'<path d="M {fmt(X1)} {fmt(Y1)} L {fmt(X2)} {fmt(Y2)}" stroke="#8a3d2f" stroke-width="1.8" fill="none" marker-end="url(#pijlpunt)"/>')

def _lijn(x1, y1, x2, y2, kleur='#5b5442', w=2):
    X1, Y1 = T((x1, y1)); X2, Y2 = T((x2, y2))
    p.append(f'<line x1="{fmt(X1)}" y1="{fmt(Y1)}" x2="{fmt(X2)}" y2="{fmt(Y2)}" stroke="{kleur}" stroke-width="{w}"/>')

_geb(628, 1590, 18, 12)
_lab(640, 1660, 'manege', 'middle')
_geb(820, 1230, 11, 8)
_lab(802, 1236, 'schuilhut', 'end')
_geb(806, 1012, 10, 6, '#9a9a8c')
_lab(842, 1000, 'container')
_pijl(706, 942, 792, 988)
_lab(696, 936, 'ingang', 'end', '#8a3d2f', 10.5, True)
_geb(2330, 1902, 14, 10, '#c9c2ad')
_lab(2308, 1958, 'De Dobber (clubhuis)', 'end', '#123c5e')
_lijn(3706, 1450, 3612, 1524, '#5b5442', 2)
_geb(3604, 1530, 13, 10, '#c9c2ad')
_lab(3585, 1588, 'TNO-meetstation', 'end', '#123c5e')
_geb(4424, 2112, 13, 10)
_lab(4400, 2178, 'woning', 'end')
_geb(2268, 2256, 12, 5, '#b0a789')
_lab(2255, 2296, 'brug', 'end')
_pijl(2298, 2332, 2324, 2250)
_lab(2290, 2348, 'ingang', 'end', '#8a3d2f', 10.5, True)
_pijl(958, 2332, 1000, 2258)
_lab(948, 2348, 'ingang', 'end', '#8a3d2f', 10.5, True)

# zoneletters
p.append('<g text-anchor="middle" font-weight="800">')
for l, (px, py) in posities.items():
    X, Y = px / SCH, py / SCH
    letter = LETTERS[l]
    p.append(f'<circle cx="{fmt(X)}" cy="{fmt(Y)}" r="11.5" fill="#ffffff" fill-opacity="0.88" stroke="#c2451e" stroke-width="2"/>')
    p.append(f'<text x="{fmt(X)}" y="{fmt(Y+5)}" font-size="14.5" fill="#9a3413">{letter}</text>')
p.append('</g>')

# stekken: wedstrijdstekken groen, rest vervaagd
offsets = {
    'nw': (-15, -3), 'ne': (10, -11), 'dal': (12, -8), 'oost': (-12, -9),
    'one': (12, -8), 'zuid': (0, 16), 'bank': (-14, 3),
}
def offset_voor(nr):
    if nr in (1, 3, 5, 7): return offsets['nw']
    if nr in (2, 4, 6, 8, 10): return offsets['bank']
    if 9 <= nr <= 47 and nr % 2 == 1: return offsets['ne']
    if nr in (49, 51, 53): return offsets['dal']
    if nr == 55: return (4, 15)
    if 57 <= nr <= 77 and nr % 2 == 1: return offsets['oost']
    if 79 <= nr <= 99 and nr % 2 == 1: return offsets['one']
    return offsets['zuid']

p.append('<g font-size="8.2">')
for nr, pt in stekken.items():
    x, y = T(pt)
    dx, dy = offset_voor(nr)
    cx, cy = x + dx, y + dy
    if nr in WEDSTRIJD:
        p.append(f'<line x1="{fmt(x)}" y1="{fmt(y)}" x2="{fmt(cx)}" y2="{fmt(cy)}" stroke="#1d4e79" stroke-width="0.8"/>')
        p.append(f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="7.8" fill="#2e7d32" stroke="#1b5e20" stroke-width="1.2"/>')
        p.append(f'<text x="{fmt(cx)}" y="{fmt(cy+2.8)}" fill="#ffffff" font-weight="700" text-anchor="middle">{nr}</text>')
    else:
        p.append(f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="6" fill="#ffffff" stroke="#1d4e79" stroke-width="0.8" opacity="0.25"/>')
        p.append(f'<text x="{fmt(cx)}" y="{fmt(cy+2.6)}" fill="#123c5e" text-anchor="middle" opacity="0.25" font-size="7">{nr}</text>')
p.append('</g>')

# titel + legenda + zonelijst
aantal = len(zonelijst)
p.append('<text x="30" y="612" font-size="24" font-weight="700" fill="#123c5e">Plas van der Ende · zone-indeling</text>')
p.append(f'<text x="30" y="637" font-size="13" fill="#5b5442">{aantal} zones (A t/m {chr(64+aantal)}) · loting gaat per zone · groene stekken doen mee</text>')

# zonelijst rechtsonder in twee regels
delen = []
for l, leden in zonelijst:
    leden = sorted(leden)
    delen.append(f"{LETTERS[l]} = {'+'.join(str(n) for n in leden)}")
helft = (len(delen)+1)//2
r1 = ' · '.join(delen[:helft])
r2 = ' · '.join(delen[helft:])
p.append(f'<text x="1120" y="622" font-size="11.5" fill="#4a4536" text-anchor="end">{r1}</text>')
p.append(f'<text x="1120" y="640" font-size="11.5" fill="#4a4536" text-anchor="end">{r2}</text>')
p.append('<text x="1120" y="663" font-size="10.5" font-style="italic" fill="#8a7f63" text-anchor="end">zonegrenzen (oranje) volgens de indeling van de organisatie</text>')

p.append('</svg>')

with open('zonekaart-def.svg', 'w') as f:
    f.write(''.join(p))
print('zonekaart-def.svg geschreven,', aantal, 'zones')

# -*- coding: utf-8 -*-
# CONCEPT-kaart: zoneverdeling op basis van de 22 vaste wedstrijdstekken.
# Grenslijnen lopen van de oever (midden tussen twee buurstekken) naar een
# middellijn door de plas, zoals op de geplastificeerde wedstrijdkaart.
import math
import sys
sys.path.insert(0, '/Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijden/tools')
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

# ringvolgorde (posities zoals in de database)
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

# middellijn door de plas (4800-ruimte)
SPINE = [(1000, 1280), (1180, 1400), (1500, 1560), (1850, 1720), (2200, 1900),
         (2550, 1990), (2900, 1900), (3250, 1810), (3600, 1880), (3950, 2000), (4230, 2120)]

def dichtstbij_spine(p):
    beste, beste_d = None, 1e18
    for a, b in zip(SPINE, SPINE[1:]):
        ax, ay, bx, by = *a, *b
        dx, dy = bx-ax, by-ay
        t = max(0, min(1, ((p[0]-ax)*dx + (p[1]-ay)*dy) / (dx*dx + dy*dy)))
        q = (ax + t*dx, ay + t*dy)
        d = (q[0]-p[0])**2 + (q[1]-p[1])**2
        if d < beste_d:
            beste, beste_d = q, d
    return beste

# grenspunten: pathwise midden tussen opeenvolgende wedstrijdstekken (met wrap)
grenzen = []
for a, b in zip(WEDSTRIJD, WEDSTRIJD[1:] + WEDSTRIJD[:1]):
    ia, ib = nearest_idx(stekken[a]), nearest_idx(stekken[b])
    stap = (ib - ia) % N
    im = (ia + stap // 2) % N
    m = DENSE[im]
    grenzen.append((a, b, m, dichtstbij_spine(m)))

# ---- SVG opbouwen (basis zoals de standalone kaart, plus zonelaag)
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

# manege (westkant, links van stek 6)
_geb(628, 1590, 18, 12)
_lab(640, 1660, 'manege', 'middle')
# schuilhut
_geb(820, 1230, 11, 8)
_lab(802, 1236, 'schuilhut', 'end')
# ingang + container bij stek 1 (noord)
_geb(806, 1012, 10, 6, '#9a9a8c')
_lab(842, 1000, 'container')
_pijl(706, 942, 792, 988)
_lab(696, 936, 'ingang', 'end', '#8a3d2f', 10.5, True)
# De Dobber, drijvend clubhuis (links van stek 53)
_geb(2330, 1902, 14, 10, '#c9c2ad')
_lab(2308, 1958, 'De Dobber (clubhuis)', 'end', '#123c5e')
# TNO-meetstation op het water (links van stek 81), met steiger vanaf de oever
_lijn(3706, 1450, 3612, 1524, '#5b5442', 2)
_geb(3604, 1530, 13, 10, '#c9c2ad')
_lab(3585, 1588, 'TNO-meetstation', 'end', '#123c5e')
# woning in de zuidoosthoek (rechts van stek 99)
_geb(4424, 2112, 13, 10)
_lab(4400, 2178, 'woning', 'end')
# bruggetje + ingang bij de duiker (links van stek 54)
_geb(2268, 2256, 12, 5, '#b0a789')
_lab(2255, 2296, 'brug', 'end')
_pijl(2298, 2332, 2324, 2250)
_lab(2290, 2348, 'ingang', 'end', '#8a3d2f', 10.5, True)
# ingang zuidwest (links van stek 22)
_pijl(958, 2332, 1000, 2258)
_lab(948, 2348, 'ingang', 'end', '#8a3d2f', 10.5, True)


# stekken: wedstrijdstekken groen, rest vervaagd
offsets = {  # zelfde offsetrichting per oever als in de app
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
    mee = nr in WEDSTRIJD
    if mee:
        p.append(f'<line x1="{fmt(x)}" y1="{fmt(y)}" x2="{fmt(cx)}" y2="{fmt(cy)}" stroke="#1d4e79" stroke-width="0.8"/>')
        p.append(f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="7.8" fill="#2e7d32" stroke="#1b5e20" stroke-width="1.2"/>')
        p.append(f'<text x="{fmt(cx)}" y="{fmt(cy+2.8)}" fill="#ffffff" font-weight="700" text-anchor="middle">{nr}</text>')
    else:
        p.append(f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="6" fill="#ffffff" stroke="#1d4e79" stroke-width="0.8" opacity="0.25"/>')
        p.append(f'<text x="{fmt(cx)}" y="{fmt(cy+2.6)}" fill="#123c5e" text-anchor="middle" opacity="0.25" font-size="7">{nr}</text>')
p.append('</g>')

# titel + legenda
p.append('<text x="30" y="618" font-size="24" font-weight="700" fill="#123c5e">Plas van der Ende · wedstrijdstekken</text>')
p.append('<text x="30" y="643" font-size="13" fill="#5b5442">22 vaste wedstrijdstekken (groen) · overige stekken doen niet mee</text>')

p.append('<g><circle cx="720" cy="638" r="7.8" fill="#2e7d32" stroke="#1b5e20" stroke-width="1.2"/><text x="734" y="642" font-size="12" fill="#4a4536">wedstrijdstek (groen bolletje met steknummer)</text></g>')

p.append('</svg>')

with open('stekkenkaart-zonder-lijnen.svg', 'w') as f:
    f.write(''.join(p))
print('zonekaart geschreven,', len(grenzen), 'grenslijnen')

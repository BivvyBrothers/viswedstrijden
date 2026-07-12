# -*- coding: utf-8 -*-
# Genereert een STANDAARDKAART (generieke zonekaart zonder maatwerk) voor een
# tenant: docs/<slug>/kaart.js met dezelfde interface als de NPHV-kaart
# (KAART_SVG, STEK_POSITIE, ZONE_STANDAARD) en exact dezelfde markup-classes
# (.stek/.stek-dot, #zonelaag, .zoneletter/.zoneletter-dot), zodat app.js
# er niets van merkt.
#
# Gebruik (vanuit tools/):
#   python3 gen_standaardkaart.py --slug demo --stekken 40 --zones 8
#
# LET OP (tot de database multi-tenant is): de server valideert stekken tegen
# wedstrijd.stek_ring (NPHV-nummering: 1-100 zonder 12/14/16/18). Een
# standaardkaart-tenant kan daarom nog niet zelf stekken kiezen in koppelmode;
# voor kijk-demo's en individuele wedstrijden met nummers die in de ring
# bestaan werkt alles. Bij de tenancy-migratie krijgt elke tenant een eigen ring.
import argparse
import json
import math
import os


def fmt(v):
    return f"{v:.1f}"


def smooth_closed(pts, tension=1.0):
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


W, H = 1150, 575
CX, CY = 575, 300
RX, RY = 462, 192


def oever(t, schaal=1.0):
    """Organische oevervorm: ellips met vaste harmonische afwijkingen."""
    r = 1 + 0.09 * math.sin(2 * t + 0.8) + 0.055 * math.sin(3 * t + 2.1) + 0.035 * math.sin(5 * t + 4.4)
    return (CX + math.cos(t) * RX * r * schaal, CY + math.sin(t) * RY * r * schaal)


def polygoon(schaal=1.0, punten=72):
    return [oever(2 * math.pi * i / punten, schaal) for i in range(punten)]


T0 = math.pi * 1.25  # startpunt linksboven (bij de ingang)
_DICHT = [oever(T0 + 2 * math.pi * i / 1440) for i in range(1441)]
_CUM = [0.0]
for _a, _b in zip(_DICHT, _DICHT[1:]):
    _CUM.append(_CUM[-1] + math.hypot(_b[0] - _a[0], _b[1] - _a[1]))
_TOTAAL = _CUM[-1]


def oever_op_fractie(f, schaal=1.0):
    """Punt op de oever op fractie f (0-1) van de omtrek, gemeten in booglengte
    vanaf het startpunt linksboven; schaal trekt het punt naar het middelpunt."""
    doel = (f % 1.0) * _TOTAAL
    lo, hi = 0, len(_CUM) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if _CUM[mid] < doel:
            lo = mid + 1
        else:
            hi = mid
    x, y = _DICHT[lo]
    return (CX + (x - CX) * schaal, CY + (y - CY) * schaal)


def bouw(slug, n_stekken, n_zones, uit_pad):
    if n_stekken < n_zones * 2:
        raise SystemExit('te weinig stekken voor dit aantal zones')
    if n_zones > 26:
        raise SystemExit('maximaal 26 zones (A-Z)')

    LAKE = polygoon(1.0)
    BINNEN = polygoon(0.58, 48)

    parts = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
                 f'font-family="system-ui, \'Segoe UI\', Arial, sans-serif">')
    parts.append(f'<rect width="{W}" height="{H}" fill="#f2eee1"/>')

    lake_d = smooth_closed(LAKE, tension=0.9)
    parts.append(f'<path d="{lake_d}" fill="#1d4e79" opacity="0.18" transform="translate(2.5,3.5)"/>')
    parts.append(f'<path d="{lake_d}" fill="#b9dcf2"/>')
    parts.append(f'<clipPath id="lake"><path d="{lake_d}"/></clipPath>')
    parts.append('<g clip-path="url(#lake)">')
    parts.append(f'<path d="{smooth_closed(BINNEN)}" fill="#7cbde4"/>')
    parts.append(f'<path d="{smooth_closed(BINNEN)}" fill="none" stroke="#ffffff" '
                 'stroke-opacity=".75" stroke-width="1.2" stroke-dasharray="5 4"/>')
    parts.append('</g>')

    # zone-indeling: opeenvolgende groepen stekken, grenzen als radiale lijnen
    basis = n_stekken // n_zones
    rest = n_stekken % n_zones
    zones = []
    stek = 1
    for z in range(n_zones):
        aantal = basis + (1 if z < rest else 0)
        letter = chr(ord('A') + z)
        zones.append({'naam': letter, 'stekken': list(range(stek, stek + aantal))})
        stek += aantal

    # stekken op de oever: stek i op fractie (i-0.5)/N van de omtrek (booglengte)
    def stek_fractie(i):
        return (i - 0.5) / n_stekken

    def grens_fractie(stek_voor):
        # grens tussen stek_voor en stek_voor+1
        return stek_voor / n_stekken

    parts.append('<g id="zonelaag" style="display:none">')
    parts.append('<g clip-path="url(#lake)" stroke="#c2451e" stroke-width="2.6" '
                 'stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85">')
    for z in zones:
        f = grens_fractie(z['stekken'][-1])
        x1, y1 = oever_op_fractie(f, 0.32)
        x2, y2 = oever_op_fractie(f, 1.06)
        parts.append(f'<path d="M {fmt(x1)} {fmt(y1)} L {fmt(x2)} {fmt(y2)}"/>')
    parts.append('</g>')
    parts.append('<g text-anchor="middle" font-weight="800">')
    for z in zones:
        f_mid = (stek_fractie(z['stekken'][0]) + stek_fractie(z['stekken'][-1])) / 2
        lx, ly = oever_op_fractie(f_mid, 0.74)
        parts.append(f'<g class="zoneletter" data-zone="{z["naam"]}" style="cursor:pointer">'
                     f'<circle cx="{fmt(lx)}" cy="{fmt(ly)}" r="14" fill="transparent" stroke="none"/>'
                     f'<circle class="zoneletter-dot" cx="{fmt(lx)}" cy="{fmt(ly)}" r="9.5" '
                     f'fill="#ffffff" fill-opacity="0.88" stroke="#c2451e" stroke-width="1.6"/>'
                     f'<text x="{fmt(lx)}" y="{fmt(ly + 4.2)}" font-size="12" fill="#9a3413" '
                     f'pointer-events="none">{z["naam"]}</text></g>')
    parts.append('</g>')
    parts.append('</g>')

    parts.append(f'<path d="{lake_d}" fill="none" stroke="#2b6a99" stroke-width="2.2"/>')

    # ingang-pijl bij stek 1
    f_in = stek_fractie(1)
    ax, ay = oever_op_fractie(f_in, 1.24)
    bx, by = oever_op_fractie(f_in, 1.08)
    parts.append('<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" '
                 'markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#8a3d2f"/></marker></defs>')
    parts.append(f'<path d="M {fmt(ax)} {fmt(ay)} L {fmt(bx)} {fmt(by)}" stroke="#8a3d2f" '
                 'stroke-width="1.6" fill="none" marker-end="url(#arr)"/>')
    parts.append(f'<text x="{fmt(ax)}" y="{fmt(ay - 6)}" font-size="10" font-weight="700" '
                 f'fill="#8a3d2f" text-anchor="middle">ingang</text>')

    # noordpijl
    nx, ny = 1080, 60
    parts.append(f'<g stroke="#4a4536" fill="#4a4536"><line x1="{nx}" y1="{ny + 26}" x2="{nx}" '
                 f'y2="{ny - 14}" stroke-width="1.6"/>'
                 f'<path d="M {nx} {ny - 22} L {nx - 6} {ny - 6} L {nx} {ny - 11} L {nx + 6} {ny - 6} Z"/>'
                 f'<text x="{nx}" y="{ny + 44}" text-anchor="middle" font-size="13" font-weight="700" '
                 f'stroke="none">N</text></g>')

    # klikbare stekken (zelfde markup als de NPHV-kaart)
    parts.append('<g id="stekken" font-size="8.2">')
    for i in range(1, n_stekken + 1):
        f = stek_fractie(i)
        x, y = oever_op_fractie(f, 1.0)
        ox, oy = oever_op_fractie(f, 1.12)
        dx, dy = ox - x, oy - y
        lengte = math.hypot(dx, dy) or 1
        cx_, cy_ = x + dx / lengte * 17, y + dy / lengte * 17
        parts.append(f'<g class="stek" data-stek="{i}" style="cursor:pointer">'
                     f'<circle cx="{fmt(cx_)}" cy="{fmt(cy_)}" r="13" fill="transparent" stroke="none"/>'
                     f'<line x1="{fmt(x)}" y1="{fmt(y)}" x2="{fmt(cx_)}" y2="{fmt(cy_)}" '
                     f'stroke="#1d4e79" stroke-width="0.8" pointer-events="none"/>'
                     f'<circle class="stek-dot" cx="{fmt(cx_)}" cy="{fmt(cy_)}" r="7.4" '
                     f'fill="#ffffff" stroke="#1d4e79" stroke-width="1.1"/>'
                     f'<text x="{fmt(cx_)}" y="{fmt(cy_ + 2.8)}" fill="#123c5e" font-weight="600" '
                     f'text-anchor="middle" pointer-events="none">{i}</text>'
                     f'<title></title></g>')
    parts.append('</g>')
    parts.append('</svg>')
    svg = ''.join(parts)

    ring = {str(i): i for i in range(1, n_stekken + 1)}

    out = (
        "// Gegenereerd door tools/gen_standaardkaart.py, niet met de hand bewerken\n"
        f"const KAART_SVG = {json.dumps(svg)};\n"
        f"const STEK_POSITIE = {json.dumps(ring)};\n"
        f"const ZONE_STANDAARD = {json.dumps(zones)};\n"
    )
    with open(uit_pad, 'w') as f:
        f.write(out)
    print(f'standaardkaart geschreven: {uit_pad} ({n_stekken} stekken, {n_zones} zones, {len(svg)} bytes svg)')
    return zones


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--slug', required=True, help='tenant-map onder docs/ (bijv. demo)')
    ap.add_argument('--stekken', type=int, default=40)
    ap.add_argument('--zones', type=int, default=8)
    args = ap.parse_args()
    # zelfde slug-regels als nieuwe_tenant.py: alfanumeriek + lowercase, zodat
    # een padachtige slug nooit buiten docs/<slug>/ kan schrijven (Codex v4 P2-4)
    if not args.slug.isalnum() or args.slug != args.slug.lower():
        raise SystemExit('FOUT: slug moet kleine letters/cijfers zijn')
    docs = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', 'docs'))
    dest = os.path.realpath(os.path.join(docs, args.slug, 'kaart.js'))
    if os.path.dirname(os.path.dirname(dest)) != docs:
        raise SystemExit('FOUT: doelpad valt buiten docs/')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    bouw(args.slug, args.stekken, args.zones, dest)

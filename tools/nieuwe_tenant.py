# -*- coding: utf-8 -*-
# Maakt een complete nieuwe tenant-map onder docs/ op basis van de NPHV-tenant.
# - Elke tekstvervanging heeft een assert op het aantal treffers, zodat een
#   sjabloonwijziging nooit stilletjes een halve tenant oplevert.
# - Namen worden ge-escaped voor HTML en het manifest gaat via json (Codex v4
#   P1-2: 'HSV "De Plas"' of 'H&S' mag geen kapotte HTML/JSON opleveren).
# - Er wordt eerst in een tijdelijke map gebouwd en pas bij succes hernoemd
#   (Codex v4 P2-5: geen halve tenant-mappen bij een gefaalde run).
#
# Gebruik (vanuit tools/):
#   python3 nieuwe_tenant.py --slug demo --kort Demo \
#       --volledig "Demo-omgeving van de viswedstrijdapp" \
#       --stekken 40 --zones 8
#   python3 nieuwe_tenant.py --slug hsvx --kort HSVX --volledig "HSV X" --kaart-van nphv
#
# Daarna handmatig (het script herinnert eraan):
#   - kaart: standaardkaart is gegenereerd, maatwerkkaart later vervangen
#   - instructies-print.pdf per tenant maken (link is voor nu verwijderd)
#   - DATABASE is nog single-tenant: org-wachtwoord, zones en stek_ring zijn
#     gedeeld met NPHV tot de tenancy-migratie (zie CLAUDE.md)
import argparse
import html
import json
import os
import shutil

import gen_standaardkaart

HIER = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HIER, '..', 'docs')
BRON = os.path.join(DOCS, 'nphv')


def slug_ok(slug):
    return slug.isalnum() and slug == slug.lower()


def vervang(tekst, oud, nieuw, verwacht=1, context=''):
    n = tekst.count(oud)
    if n != verwacht:
        raise SystemExit(f'FOUT {context}: verwachtte {verwacht}x {oud!r}, vond {n}x. '
                         'Sjabloon (docs/nphv) is veranderd; pas nieuwe_tenant.py aan.')
    return tekst.replace(oud, nieuw)


def lees(pad):
    with open(pad, encoding='utf-8') as f:
        return f.read()


def schrijf(pad, tekst):
    with open(pad, 'w', encoding='utf-8') as f:
        f.write(tekst)


def bouw_bestanden(doel, slug, kort, volledig, water, stekken, zones, kaart_van):
    """Schrijft alle tenant-bestanden naar map `doel` (nog niet de eindmap)."""
    # HTML-veilige varianten; het manifest krijgt de ruwe strings via json
    kh = html.escape(kort, quote=True)
    vh = html.escape(volledig, quote=True)
    wh = html.escape(water, quote=True)
    sub = f'{vh} · {wh}' if water else vh

    # --- index.html ---
    t = lees(os.path.join(BRON, 'index.html'))
    t = vervang(t, '<title>Viswedstrijden NPHV · Plas van der Ende</title>',
                f'<title>Viswedstrijden {kh}</title>', 1, 'index.html titel')
    t = vervang(t, '<meta name="description" content="Viswedstrijden van de NPHV (Nootdorps '
                   'Pijnackerse Hengelsportvereniging) op de Plas van der Ende: loting, stekkeuze, '
                   'vangstregistratie en live klassement.">',
                f'<meta name="description" content="Viswedstrijden van {kh}: loting, stekkeuze, '
                f'vangstregistratie en live klassement.">', 1, 'index.html description')
    t = vervang(t, '<meta name="apple-mobile-web-app-title" content="NPHV">',
                f'<meta name="apple-mobile-web-app-title" content="{kh}">', 1, 'index.html app-title')
    t = vervang(t, 'class="brand-logo"> NPHV Viswedstrijden</a>',
                f'class="brand-logo"> {kh} Viswedstrijden</a>', 1, 'index.html brand')
    t = vervang(t, '<h1>Viswedstrijden NPHV</h1>', f'<h1>Viswedstrijden {kh}</h1>', 1, 'index.html h1')
    t = vervang(t, '<p class="sub">Nootdorps Pijnackerse Hengelsportvereniging · Plas van der Ende</p>',
                f'<p class="sub">{sub}</p>', 1, 'index.html sub')
    schrijf(os.path.join(doel, 'index.html'), t)

    # --- instructies.html ---
    t = lees(os.path.join(BRON, 'instructies.html'))
    t = vervang(t, '<title>Zet de app op je beginscherm · NPHV Viswedstrijden</title>',
                f'<title>Zet de app op je beginscherm · {kh} Viswedstrijden</title>', 1, 'instructies titel')
    t = vervang(t, 'class="brand-logo"> NPHV Viswedstrijden</a>',
                f'class="brand-logo"> {kh} Viswedstrijden</a>', 1, 'instructies brand')
    t = vervang(t, 'en kies daar <b style="color:#E8871E">NPHV</b>',
                f'en kies daar <b style="color:#E8871E">{kh}</b>', 1, 'instructies kies-daar')
    t = vervang(t, 'direct kan ook: <b style="color:#E8871E">viswedstrijdapp.nl/nphv</b>',
                f'direct kan ook: <b style="color:#E8871E">viswedstrijdapp.nl/{slug}</b>', 1, 'instructies adres')
    t = vervang(t, '<p class="muted klein">Liever op papier? <a href="instructies-print.pdf">'
                   'Download de print-versie (PDF, A4)</a>.</p>',
                '', 1, 'instructies print-link (nog geen tenant-pdf)')
    schrijf(os.path.join(doel, 'instructies.html'), t)

    # --- sw.js (comments krijgen de slug: gevalideerd alfanumeriek, dus veilig) ---
    t = lees(os.path.join(BRON, 'sw.js'))
    t = vervang(t, '/* Service worker NPHV:', f'/* Service worker {slug}:', 1, 'sw kop')
    t = vervang(t, 'deze worker draait onder /nphv/', f'deze worker draait onder /{slug}/', 1, 'sw pad-comment')
    t = vervang(t, "const CACHE = 'nphv-shell-v1';", f"const CACHE = '{slug}-shell-v1';", 1, 'sw cache-naam')
    t = vervang(t, "k.startsWith('nphv-shell')", f"k.startsWith('{slug}-shell')", 1, 'sw cleanup')
    schrijf(os.path.join(doel, 'sw.js'), t)

    # --- manifest.webmanifest: via json, nooit tekst-plakken ---
    manifest = json.loads(lees(os.path.join(BRON, 'manifest.webmanifest')))
    for sleutel in ('name', 'short_name', 'description', 'start_url', 'scope', 'icons'):
        if sleutel not in manifest:
            raise SystemExit(f'FOUT manifest-sjabloon: sleutel {sleutel!r} ontbreekt in docs/nphv/')
    manifest['name'] = f'{kort} Viswedstrijden'
    manifest['short_name'] = kort
    manifest['description'] = f'Viswedstrijden van {kort}: loting, stekkeuze, vangsten en live klassement'
    schrijf(os.path.join(doel, 'manifest.webmanifest'),
            json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

    # --- config.js en version.json: 1-op-1 ---
    shutil.copy(os.path.join(BRON, 'config.js'), os.path.join(doel, 'config.js'))
    shutil.copy(os.path.join(BRON, 'version.json'), os.path.join(doel, 'version.json'))

    # --- kaart.js ---
    if kaart_van:
        shutil.copy(os.path.join(DOCS, kaart_van, 'kaart.js'), os.path.join(doel, 'kaart.js'))
        print(f'kaart.js gekopieerd van docs/{kaart_van}/')
    else:
        gen_standaardkaart.bouw(slug, stekken, zones, os.path.join(doel, 'kaart.js'))

    return sub


def controleer(doel):
    """Post-checks op de gegenereerde tenant (Codex v4 P1-2)."""
    verwacht = ['index.html', 'instructies.html', 'sw.js', 'manifest.webmanifest',
                'config.js', 'version.json', 'kaart.js']
    for naam in verwacht:
        pad = os.path.join(doel, naam)
        if not os.path.isfile(pad) or os.path.getsize(pad) == 0:
            raise SystemExit(f'FOUT post-check: {naam} ontbreekt of is leeg')
    with open(os.path.join(doel, 'manifest.webmanifest'), encoding='utf-8') as f:
        json.load(f)  # geldige JSON of een luide fout


def bouw_tenant(slug, kort, volledig, water, stekken, zones, kaart_van):
    doel = os.path.join(DOCS, slug)
    tmp = os.path.join(DOCS, f'.tmp-{slug}')
    if os.path.exists(doel):
        raise SystemExit(f'FOUT: docs/{slug}/ bestaat al; verwijder eerst of kies een andere slug.')
    if os.path.exists(tmp):
        shutil.rmtree(tmp)
    os.makedirs(tmp)

    try:
        sub = bouw_bestanden(tmp, slug, kort, volledig, water, stekken, zones, kaart_van)
        controleer(tmp)
    except BaseException:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    os.rename(tmp, doel)

    # keuzeregel op de rootpagina (na de rename; faalt dit, dan meldt het
    # script dat de tenant-map WEL bestaat en alleen de rootregel mist)
    root = os.path.join(DOCS, 'index.html')
    t = lees(root)
    if f'href="{slug}/"' in t:
        raise SystemExit(f'LET OP: docs/{slug}/ is aangemaakt; de rootpagina had al een regel voor {slug}.')
    anker = '    <p class="muted klein installeer-tip"'
    kaartje = (f'    <a class="water-kaart" href="{slug}/">\n'
               f'      <img src="icon-192.png" alt="">\n'
               f'      <div>\n'
               f'        <b>{html.escape(kort, quote=True)}</b>\n'
               f'        <span>{sub}</span>\n'
               f'      </div>\n'
               f'      <span class="pijl" aria-hidden="true">›</span>\n'
               f'    </a>\n')
    try:
        t = vervang(t, anker, kaartje + anker, 1, 'root-keuzepagina')
    except SystemExit as e:
        raise SystemExit(f'{e}\nLET OP: docs/{slug}/ is WEL aangemaakt; voeg de rootregel handmatig toe.')
    schrijf(root, t)

    print(f'\nTenant docs/{slug}/ aangemaakt en toegevoegd aan de keuzepagina. Nog doen:')
    print(f'  1. Controleer docs/{slug}/index.html (teksten) en de kaart in de browser.')
    print(f'  2. instructies-print.pdf voor deze tenant maken (link is weggelaten).')
    print(f'  3. Release-checklist in CLAUDE.md nalopen (versies, SHELL-paden, CSP).')
    print(f'  4. LET OP: database is nog single-tenant (org-wachtwoord/zones/stek_ring')
    print(f'     gedeeld met NPHV) tot de tenancy-migratie; zie CLAUDE.md.')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--slug', required=True, help='mapnaam onder docs/, ook het adres (viswedstrijdapp.nl/<slug>)')
    ap.add_argument('--kort', required=True, help='korte naam voor topbar/manifest (bijv. HSVX)')
    ap.add_argument('--volledig', required=True, help='volledige organisatienaam')
    ap.add_argument('--water', default='', help='naam van het viswater (optioneel)')
    ap.add_argument('--stekken', type=int, default=40, help='aantal stekken op de standaardkaart')
    ap.add_argument('--zones', type=int, default=8, help='aantal zones op de standaardkaart')
    ap.add_argument('--kaart-van', default='', help='kopieer kaart.js van deze bestaande tenant i.p.v. standaardkaart')
    a = ap.parse_args()
    if not slug_ok(a.slug):
        raise SystemExit('FOUT: slug moet kleine letters/cijfers zijn (wordt het URL-pad)')
    if a.kaart_van and not slug_ok(a.kaart_van):
        raise SystemExit('FOUT: --kaart-van moet een bestaande tenant-slug zijn (kleine letters/cijfers)')
    bouw_tenant(a.slug, a.kort, a.volledig, a.water, a.stekken, a.zones, a.kaart_van)

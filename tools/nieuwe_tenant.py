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
    nphv_desc = ('Viswedstrijden van de NPHV (Nootdorps Pijnackerse Hengelsportvereniging) '
                 'op de Plas van der Ende: loting, stekkeuze, vangstregistratie, '
                 'live klassement en seizoenscompetitie.')
    nieuwe_desc = (f'Viswedstrijden van {kh}: loting, stekkeuze, vangstregistratie, '
                   'live klassement en seizoenscompetitie.')
    t = vervang(t, f'<meta name="description" content="{nphv_desc}">',
                f'<meta name="description" content="{nieuwe_desc}">', 1, 'index.html description')
    # og-tags (titel/description spiegelen de gewone meta, url krijgt de slug)
    t = vervang(t, '<meta property="og:title" content="Viswedstrijden NPHV · Plas van der Ende">',
                f'<meta property="og:title" content="Viswedstrijden {kh}">', 1, 'index.html og:title')
    t = vervang(t, f'<meta property="og:description" content="{nphv_desc}">',
                f'<meta property="og:description" content="{nieuwe_desc}">', 1, 'index.html og:description')
    t = vervang(t, '<meta property="og:url" content="https://viswedstrijdapp.nl/nphv/">',
                f'<meta property="og:url" content="https://viswedstrijdapp.nl/{slug}/">', 1, 'index.html og:url')
    t = vervang(t, '<meta name="apple-mobile-web-app-title" content="NPHV">',
                f'<meta name="apple-mobile-web-app-title" content="{kh}">', 1, 'index.html app-title')
    t = vervang(t, 'class="brand-logo"> NPHV Viswedstrijden</a>',
                f'class="brand-logo"> {kh} Viswedstrijden</a>', 1, 'index.html brand')
    t = vervang(t, '<h1>Viswedstrijden NPHV</h1>', f'<h1>Viswedstrijden {kh}</h1>', 1, 'index.html h1')
    t = vervang(t, '<p class="sub">Nootdorps Pijnackerse Hengelsportvereniging · Plas van der Ende</p>',
                f'<p class="sub">{sub}</p>', 1, 'index.html sub')
    # 3D-knop alleen behouden als de bronkaart ook een kaart-3d.jpg heeft
    knop_3d = ('      <p class="kaart-3d-rij"><button type="button" class="btn klein-btn" '
               'data-groot="kaart-3d.jpg" data-groot-alt="3D-dieptekaart van de Plas van der Ende '
               'met stekken en zones">⛰️ Bekijk de dieptekaart in 3D</button></p>\n')
    heeft_3d = kaart_van and os.path.isfile(os.path.join(DOCS, kaart_van, 'kaart-3d.jpg'))
    if not heeft_3d:
        t = vervang(t, knop_3d, '', 1, 'index.html 3d-knop (geen kaart-3d.jpg voor deze tenant)')
    schrijf(os.path.join(doel, 'index.html'), t)

    # --- instructies.html ---
    t = lees(os.path.join(BRON, 'instructies.html'))
    t = vervang(t, '<title>Zet de app op je beginscherm · NPHV Viswedstrijden</title>',
                f'<title>Zet de app op je beginscherm · {kh} Viswedstrijden</title>', 1, 'instructies titel')
    t = vervang(t, '<meta property="og:title" content="Zet de app op je beginscherm · NPHV Viswedstrijden">',
                f'<meta property="og:title" content="Zet de app op je beginscherm · {kh} Viswedstrijden">',
                1, 'instructies og:title')
    t = vervang(t, '<meta property="og:url" content="https://viswedstrijdapp.nl/nphv/instructies.html">',
                f'<meta property="og:url" content="https://viswedstrijdapp.nl/{slug}/instructies.html">',
                1, 'instructies og:url')
    t = vervang(t, 'class="brand-logo"> NPHV Viswedstrijden</a>',
                f'class="brand-logo"> {kh} Viswedstrijden</a>', 1, 'instructies brand')
    t = vervang(t, 'tik op <b style="color:#fff">Inloggen</b> en kies daar <b style="color:#E8871E">NPHV</b>',
                f'tik op <b style="color:#fff">Inloggen</b> en kies daar <b style="color:#E8871E">{kh}</b>',
                1, 'instructies kies-daar')
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
    # Codex v7 P2-2: de fotokaart alleen in de SHELL als deze tenant hem echt krijgt
    heeft_foto = bool(kaart_van) and os.path.isfile(os.path.join(DOCS, kaart_van, 'dieptekaart.jpg'))
    if not heeft_foto:
        t = vervang(t, "'config.js', 'dieptekaart.jpg',", "'config.js',", 1, 'sw SHELL dieptekaart')
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

    # --- config.js: 1-op-1 op de TENANT-slug na ---
    t = lees(os.path.join(BRON, 'config.js'))
    t = vervang(t, "const TENANT = 'nphv';", f"const TENANT = '{slug}';", 1, 'config TENANT')
    schrijf(os.path.join(doel, 'config.js'), t)
    shutil.copy(os.path.join(BRON, 'version.json'), os.path.join(doel, 'version.json'))

    # --- kaart.js ---
    if kaart_van:
        shutil.copy(os.path.join(DOCS, kaart_van, 'kaart.js'), os.path.join(doel, 'kaart.js'))
        print(f'kaart.js gekopieerd van docs/{kaart_van}/')
        # fotokaart-onderlaag (v51) + 3D-weergave (v52): horen bij kaart.js
        for extra in ('dieptekaart.jpg', 'kaart-3d.jpg'):
            bronfoto = os.path.join(DOCS, kaart_van, extra)
            if os.path.isfile(bronfoto):
                shutil.copy(bronfoto, os.path.join(doel, extra))
                print(f'{extra} meegekopieerd van docs/{kaart_van}/'
                      + (' (zet hem ook in de sw.js SHELL)' if extra == 'dieptekaart.jpg' else ''))
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
    # Codex v7 P2-2: kaart-assets consistent met kaart.js, sw-SHELL en index.html
    kaart = lees(os.path.join(doel, 'kaart.js'))
    sw = lees(os.path.join(doel, 'sw.js'))
    if 'dieptekaart.jpg' in kaart:
        if not os.path.isfile(os.path.join(doel, 'dieptekaart.jpg')):
            raise SystemExit('FOUT post-check: kaart.js verwijst naar dieptekaart.jpg maar die ontbreekt')
        if 'dieptekaart.jpg' not in sw:
            raise SystemExit('FOUT post-check: dieptekaart.jpg hoort in de sw.js SHELL van deze tenant')
    elif 'dieptekaart.jpg' in sw:
        raise SystemExit('FOUT post-check: sw.js SHELL noemt dieptekaart.jpg maar kaart.js gebruikt hem niet')
    idx = lees(os.path.join(doel, 'index.html'))
    if 'data-groot="kaart-3d.jpg"' in idx and not os.path.isfile(os.path.join(doel, 'kaart-3d.jpg')):
        raise SystemExit('FOUT post-check: index.html heeft de 3D-knop maar kaart-3d.jpg ontbreekt')


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

    # keuzeregel op de inlogpagina (sinds v50: de root is een landingspagina,
    # de organisatie-keuze staat op docs/inloggen/index.html; faalt dit, dan
    # meldt het script dat de tenant-map WEL bestaat en alleen de regel mist)
    root = os.path.join(DOCS, 'inloggen', 'index.html')
    t = lees(root)
    if f'href="/{slug}/"' in t:
        raise SystemExit(f'LET OP: docs/{slug}/ is aangemaakt; de inlogpagina had al een regel voor {slug}.')
    anker = '    <p class="muted klein installeer-tip"'
    kaartje = (f'    <a class="water-kaart" href="/{slug}/">\n'
               f'      <img src="/icon-192.png" alt="">\n'
               f'      <div>\n'
               f'        <b>{html.escape(kort, quote=True)}</b>\n'
               f'        <span>{sub}</span>\n'
               f'      </div>\n'
               f'      <span class="pijl" aria-hidden="true">›</span>\n'
               f'    </a>\n')
    try:
        t = vervang(t, anker, kaartje + anker, 1, 'inlogpagina-keuzeregel')
    except SystemExit as e:
        raise SystemExit(f'{e}\nLET OP: docs/{slug}/ is WEL aangemaakt; voeg de regel op /inloggen/ handmatig toe.')
    schrijf(root, t)

    print(f'\nTenant docs/{slug}/ aangemaakt en toegevoegd aan de inlogpagina (/inloggen/). Nog doen:')
    print(f'  1. Controleer docs/{slug}/index.html (teksten) en de kaart in de browser.')
    print(f'  2. instructies-print.pdf voor deze tenant maken (link is weggelaten).')
    print(f'  3. Release-checklist in CLAUDE.md nalopen (versies, SHELL-paden, CSP).')
    print(f'  4. Klant-rij in de database aanmaken (voor het beheeroverzicht):')
    print(f"     insert into wedstrijd.klanten (slug, naam) values ('{slug}', '<volledige naam>');")
    print(f'  5. LET OP: database is nog single-tenant (org-wachtwoord/zones/stek_ring')
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

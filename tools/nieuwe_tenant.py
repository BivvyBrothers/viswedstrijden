# -*- coding: utf-8 -*-
# Maakt een complete nieuwe tenant-map onder docs/ op basis van de NPHV-tenant.
# Elke tekstvervanging gebeurt met een assert op het aantal treffers, zodat een
# sjabloonwijziging nooit stilletjes een halve tenant oplevert.
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
import os
import shutil
import subprocess
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HIER, '..', 'docs')
BRON = os.path.join(DOCS, 'nphv')


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


def bouw_tenant(slug, kort, volledig, water, stekken, zones, kaart_van):
    doel = os.path.join(DOCS, slug)
    if os.path.exists(doel):
        raise SystemExit(f'FOUT: docs/{slug}/ bestaat al; verwijder eerst of kies een andere slug.')
    os.makedirs(doel)

    sub = f'{volledig} · {water}' if water else volledig

    # --- index.html ---
    t = lees(os.path.join(BRON, 'index.html'))
    t = vervang(t, '<title>Viswedstrijden NPHV · Plas van der Ende</title>',
                f'<title>Viswedstrijden {kort}</title>', 1, 'index.html titel')
    t = vervang(t, '<meta name="description" content="Viswedstrijden van de NPHV (Nootdorps '
                   'Pijnackerse Hengelsportvereniging) op de Plas van der Ende: loting, stekkeuze, '
                   'vangstregistratie en live klassement.">',
                f'<meta name="description" content="Viswedstrijden van {kort}: loting, stekkeuze, '
                f'vangstregistratie en live klassement.">', 1, 'index.html description')
    t = vervang(t, '<meta name="apple-mobile-web-app-title" content="NPHV">',
                f'<meta name="apple-mobile-web-app-title" content="{kort}">', 1, 'index.html app-title')
    t = vervang(t, 'class="brand-logo"> NPHV Viswedstrijden</a>',
                f'class="brand-logo"> {kort} Viswedstrijden</a>', 1, 'index.html brand')
    t = vervang(t, '<h1>Viswedstrijden NPHV</h1>', f'<h1>Viswedstrijden {kort}</h1>', 1, 'index.html h1')
    t = vervang(t, '<p class="sub">Nootdorps Pijnackerse Hengelsportvereniging · Plas van der Ende</p>',
                f'<p class="sub">{sub}</p>', 1, 'index.html sub')
    schrijf(os.path.join(doel, 'index.html'), t)

    # --- instructies.html ---
    t = lees(os.path.join(BRON, 'instructies.html'))
    t = vervang(t, '<title>Zet de app op je beginscherm · NPHV Viswedstrijden</title>',
                f'<title>Zet de app op je beginscherm · {kort} Viswedstrijden</title>', 1, 'instructies titel')
    t = vervang(t, 'class="brand-logo"> NPHV Viswedstrijden</a>',
                f'class="brand-logo"> {kort} Viswedstrijden</a>', 1, 'instructies brand')
    t = vervang(t, 'en kies daar <b style="color:#E8871E">NPHV</b>',
                f'en kies daar <b style="color:#E8871E">{kort}</b>', 1, 'instructies kies-daar')
    t = vervang(t, 'direct kan ook: <b style="color:#E8871E">viswedstrijdapp.nl/nphv</b>',
                f'direct kan ook: <b style="color:#E8871E">viswedstrijdapp.nl/{slug}</b>', 1, 'instructies adres')
    t = vervang(t, '<p class="muted klein">Liever op papier? <a href="instructies-print.pdf">'
                   'Download de print-versie (PDF, A4)</a>.</p>',
                '', 1, 'instructies print-link (nog geen tenant-pdf)')
    schrijf(os.path.join(doel, 'instructies.html'), t)

    # --- sw.js ---
    t = lees(os.path.join(BRON, 'sw.js'))
    t = vervang(t, '/* Service worker NPHV:', f'/* Service worker {kort}:', 1, 'sw kop')
    t = vervang(t, 'deze worker draait onder /nphv/', f'deze worker draait onder /{slug}/', 1, 'sw pad-comment')
    t = vervang(t, "const CACHE = 'nphv-shell-v1';", f"const CACHE = '{slug}-shell-v1';", 1, 'sw cache-naam')
    t = vervang(t, "k.startsWith('nphv-shell')", f"k.startsWith('{slug}-shell')", 1, 'sw cleanup')
    schrijf(os.path.join(doel, 'sw.js'), t)

    # --- manifest.webmanifest ---
    t = lees(os.path.join(BRON, 'manifest.webmanifest'))
    t = vervang(t, '"name": "NPHV Viswedstrijden"', f'"name": "{kort} Viswedstrijden"', 1, 'manifest name')
    t = vervang(t, '"short_name": "NPHV"', f'"short_name": "{kort}"', 1, 'manifest short_name')
    t = vervang(t, '"description": "Viswedstrijden van de NPHV op de Plas van der Ende: '
                   'loting, stekkeuze, vangsten en live klassement"',
                f'"description": "Viswedstrijden van {kort}: loting, stekkeuze, vangsten en live klassement"',
                1, 'manifest description')
    schrijf(os.path.join(doel, 'manifest.webmanifest'), t)

    # --- config.js en version.json: 1-op-1 ---
    shutil.copy(os.path.join(BRON, 'config.js'), os.path.join(doel, 'config.js'))
    shutil.copy(os.path.join(BRON, 'version.json'), os.path.join(doel, 'version.json'))

    # --- kaart.js ---
    if kaart_van:
        shutil.copy(os.path.join(DOCS, kaart_van, 'kaart.js'), os.path.join(doel, 'kaart.js'))
        print(f'kaart.js gekopieerd van docs/{kaart_van}/')
    else:
        subprocess.run([sys.executable, os.path.join(HIER, 'gen_standaardkaart.py'),
                        '--slug', slug, '--stekken', str(stekken), '--zones', str(zones)], check=True)

    # --- keuzeregel op de rootpagina ---
    root = os.path.join(DOCS, 'index.html')
    t = lees(root)
    anker = '    <p class="muted klein installeer-tip"'
    kaartje = (f'    <a class="water-kaart" href="{slug}/">\n'
               f'      <img src="icon-192.png" alt="">\n'
               f'      <div>\n'
               f'        <b>{kort}</b>\n'
               f'        <span>{sub}</span>\n'
               f'      </div>\n'
               f'      <span class="pijl" aria-hidden="true">›</span>\n'
               f'    </a>\n')
    t = vervang(t, anker, kaartje + anker, 1, 'root-keuzepagina')
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
    if not a.slug.isalnum() or a.slug != a.slug.lower():
        raise SystemExit('FOUT: slug moet kleine letters/cijfers zijn (wordt het URL-pad)')
    bouw_tenant(a.slug, a.kort, a.volledig, a.water, a.stekken, a.zones, a.kaart_van)

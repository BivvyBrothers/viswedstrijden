#!/usr/bin/env python3
"""Vangstfoto's klaarmaken voor de landingspagina.

Waarom een script en geen handmatige export: foto's van een telefoon bevatten
EXIF, en daar zitten vaak GPS-coordinaten in. De site verkoopt "geen
locatie-tracking"; dan mag de stek van een vereniging niet alsnog in de
metadata van een sfeerfoto op diezelfde site staan. Dit script schrijft de
foto's opnieuw weg ZONDER enige metadata, verkleind en geoptimaliseerd.

Gebruik:
    python3 tools/site_fotos.py --bron ~/pad/naar/fotos
    python3 tools/site_fotos.py --bron ~/pad/naar/fotos --html

Uitvoer: docs/schermen/vangsten/vangst-01.jpg, -02.jpg, ... (max 1400px lange
zijde, kwaliteit 82). Met --html komt er ook een blok HTML op stdout dat je in
docs/index.html kunt plakken.
"""
import argparse
import os
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    raise SystemExit('FOUT: Pillow ontbreekt. Installeer met: pip3 install --user Pillow')

HIER = os.path.dirname(os.path.abspath(__file__))
DOEL = os.path.join(os.path.dirname(HIER), 'docs', 'schermen', 'vangsten')
MAX_ZIJDE = 1400
KWALITEIT = 82
EXTENSIES = ('.jpg', '.jpeg', '.png', '.heic', '.webp')


def verwerk(bron, doel_map):
    os.makedirs(doel_map, exist_ok=True)
    bestanden = sorted(
        f for f in os.listdir(bron)
        if f.lower().endswith(EXTENSIES) and not f.startswith('.')
    )
    if not bestanden:
        raise SystemExit(f'FOUT: geen afbeeldingen gevonden in {bron}')
    uit = []
    for i, naam in enumerate(bestanden, start=1):
        pad = os.path.join(bron, naam)
        try:
            im = Image.open(pad)
        except Exception as e:                      # noqa: BLE001
            print(f'  overgeslagen ({naam}): {e}', file=sys.stderr)
            continue
        # draaiing uit EXIF toepassen VOOR we de metadata weggooien
        im = ImageOps.exif_transpose(im).convert('RGB')
        im.thumbnail((MAX_ZIJDE, MAX_ZIJDE), Image.LANCZOS)
        # nieuwe afbeelding uit alleen de pixels: geen EXIF, geen GPS, geen
        # toestelgegevens, geen tijdstempel
        schoon = Image.new('RGB', im.size)
        schoon.putdata(list(im.getdata()))
        doel_naam = f'vangst-{len(uit) + 1:02d}.jpg'
        doel = os.path.join(doel_map, doel_naam)
        schoon.save(doel, 'JPEG', quality=KWALITEIT, optimize=True, progressive=True)
        kb = os.path.getsize(doel) // 1024
        print(f'  {naam}  ->  {doel_naam}  {schoon.size[0]}x{schoon.size[1]}  {kb} KB',
              file=sys.stderr)
        uit.append((doel_naam, schoon.size))
    return uit


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bron', required=True, help='map met de originele foto\'s')
    ap.add_argument('--html', action='store_true', help='print het HTML-blok voor de landing')
    a = ap.parse_args()
    bron = os.path.expanduser(a.bron)
    if not os.path.isdir(bron):
        raise SystemExit(f'FOUT: {bron} is geen map')
    fotos = verwerk(bron, DOEL)
    print(f'\n{len(fotos)} foto\'s klaar in docs/schermen/vangsten/', file=sys.stderr)
    if a.html:
        regels = '\n'.join(
            f'      <img src="schermen/vangsten/{n}" alt="Karper gevangen tijdens een wedstrijd" '
            f'width="{b}" height="{h}" loading="lazy">'
            for n, (b, h) in fotos
        )
        print(f"""    <div class="fotostrook">
{regels}
    </div>""")


if __name__ == '__main__':
    main()

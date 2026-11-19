#!/usr/bin/env python3
"""Maakt de WebP-versies van de beelden op de landingspagina.

De landingspagina (docs/index.html) laadt sinds v113 (18 nov 2026) alleen nog .webp:
samen 0,9 MB in plaats van 2,0 MB. De PNG's en JPG's blijven de BRON (schermopnamen
uit tools/mobiel_screenshot.mjs, foto's uit tools/site_fotos.py) en worden ook nog
gebruikt door de instructiepagina's, het prijzenblad en de advertenties.

Draai dit script na ELKE nieuwe schermopname of foto, anders toont de site het oude beeld:

    python3 tools/naar_webp.py            # alles opnieuw
    python3 tools/naar_webp.py --check    # alleen melden wat ouder is dan zijn bron

WebP bewaart geen EXIF tenzij je erom vraagt, dus er komt geen locatie mee.
"""
import pathlib
import sys

from PIL import Image

DOCS = pathlib.Path(__file__).resolve().parent.parent / "docs"
BRONNEN = [
    "schermen/avondlicht-1600.jpg", "schermen/scherm-klassement.png", "schermen/scherm-overzicht.png",
    "schermen/scherm-kaart-nphv.png", "schermen/kaart3d-stekken.jpg", "schermen/uitsnede-klassement.jpg",
    "schermen/vangst-klassement.jpg", "schermen/uitsnede-seizoen.jpg", "schermen/uitslag-gedeeld.png",
    "schermen/beginscherm-mockup.jpg", "film/wedstrijdfilm-poster.jpg", "film/wedstrijdfilm-poster-staand.jpg",
]


def main():
    alleen_check = "--check" in sys.argv
    verouderd = 0
    for rel in BRONNEN:
        bron = DOCS / rel
        doel = bron.with_suffix(".webp")
        if not bron.exists():
            raise SystemExit(f"FOUT: bron ontbreekt: {rel}")
        if alleen_check:
            if not doel.exists() or doel.stat().st_mtime < bron.stat().st_mtime:
                verouderd += 1
                print(f"verouderd: {doel.relative_to(DOCS)}")
            continue
        im = Image.open(bron)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.getbands() or im.mode == "P" else "RGB")
        if im.mode == "RGBA" and im.getextrema()[3][0] == 255:
            im = im.convert("RGB")   # geen echte doorzichtigheid: scheelt een kanaal
        # schermopnamen (tekst, vlakken) verdragen iets meer kwaliteit dan foto's
        im.save(doel, "WEBP", quality=84 if bron.suffix == ".png" else 80, method=6)
        print(f"{bron.stat().st_size / 1024:6.0f} -> {doel.stat().st_size / 1024:5.0f} kB  {doel.relative_to(DOCS)}")
    # het kleine logo voor de topbar (34 px, scherp tot 3x)
    logo = DOCS / "logo-rond-112.webp"
    if not alleen_check:
        Image.open(DOCS / "logo-rond-512.png").convert("RGBA").resize((112, 112), Image.LANCZOS).save(
            logo, "WEBP", quality=90, method=6)
        print(f"logo: {logo.stat().st_size / 1024:.0f} kB")
    if alleen_check:
        print("alles bij" if not verouderd else f"{verouderd} beeld(en) opnieuw maken: python3 tools/naar_webp.py")
        sys.exit(1 if verouderd else 0)


if __name__ == "__main__":
    main()

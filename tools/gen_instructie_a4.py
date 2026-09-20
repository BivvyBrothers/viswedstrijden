# Genereert de A4 "zet de app op je beginscherm" in twee of meer varianten uit
# beginscherm-a4.html. De bron is NPHV-specifiek geschreven; dit script maakt er
# een neutrale ALGEMENE versie van voor de root van de site en per tenant een
# eigen versie.
#
# Waarom: de algemene PDF op viswedstrijdapp.nl/instructies-print.pdf was tot
# 20 sep 2026 letterlijk de NPHV-versie ("tik op Inloggen, kies NPHV"), terwijl
# die pagina ook door andere clubs en door nieuwe klanten wordt gelezen.
#
# Draaien vanuit app/:
#   python3 tools/gen_instructie_a4.py                  (algemeen + nphv)
#   python3 tools/gen_instructie_a4.py --slug X --kort NAAM   (extra tenant)
#
# Uitvoer:
#   docs/instructies-print.pdf        algemene versie (ook beginscherm-instructie.pdf/.png)
#   docs/<slug>/instructies-print.pdf per tenant
import argparse, pathlib, subprocess, sys

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
APP = pathlib.Path(__file__).resolve().parent.parent
BRON = APP / "beginscherm-a4.html"

# De twee NPHV-plekken in de bron, exact zoals ze er staan.
KIES = ('tik op Inloggen, kies <b style="color:#f0a04b">NPHV</b> '
        '&middot; direct kan ook: <b style="color:#f0a04b">viswedstrijdapp.nl/nphv</b>')
KIES_ALT = ('tik op Inloggen, kies <b style="color:#f0a04b">NPHV</b> '
            '· direct kan ook: <b style="color:#f0a04b">viswedstrijdapp.nl/nphv</b>')
VOET = '<span class="oranje">viswedstrijdapp.nl/nphv</span>'


def maak(html, kies, voet):
    t = html
    for oud in (KIES, KIES_ALT):
        t = t.replace(oud, kies)
    t = t.replace(VOET, voet)
    return t


def naar_pdf(html, pdf, ook_png=False):
    tmp = APP / "_a4-tijdelijk.html"
    tmp.write_text(html, encoding="utf-8")
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={pdf}", f"file://{tmp}"], capture_output=True)
    tmp.unlink()
    import fitz
    d = fitz.open(pdf)
    if d.page_count != 1:
        sys.exit(f"FOUT: {pdf.name} werd {d.page_count} pagina's, moet er één zijn")
    if ook_png:
        d[0].get_pixmap(dpi=110).save(pdf.with_suffix(".png"))
    print(f"  {pdf.relative_to(APP)} ({pdf.stat().st_size // 1024} KB)")


p = argparse.ArgumentParser()
p.add_argument("--slug", help="tenant-map, bijv. nphv")
p.add_argument("--kort", help="korte naam van de organisatie, bijv. NPHV")
a = p.parse_args()

bron = BRON.read_text(encoding="utf-8")
assert VOET in bron, "voet met /nphv niet gevonden; is beginscherm-a4.html gewijzigd?"
assert KIES in bron or KIES_ALT in bron, "keuzeregel met NPHV niet gevonden"

if a.slug:
    if not a.kort:
        sys.exit("--slug vraagt ook --kort")
    map_ = APP / "docs" / a.slug
    if not map_.is_dir():
        sys.exit(f"tenantmap {map_} bestaat niet")
    print(f"Tenant {a.kort}:")
    naar_pdf(maak(bron,
                  f'tik op Inloggen, kies <b style="color:#f0a04b">{a.kort}</b> '
                  f'&middot; direct kan ook: <b style="color:#f0a04b">viswedstrijdapp.nl/{a.slug}</b>',
                  f'<span class="oranje">viswedstrijdapp.nl/{a.slug}</span>'),
             map_ / "instructies-print.pdf")
    raise SystemExit

print("Algemeen (root):")
algemeen = maak(bron,
                'tik op Inloggen en kies <b style="color:#f0a04b">jouw organisatie</b> '
                '&middot; of gebruik de link die je van de organisatie kreeg',
                '<span class="oranje">viswedstrijdapp.nl</span>')
naar_pdf(algemeen, APP / "docs" / "instructies-print.pdf")
naar_pdf(algemeen, APP / "beginscherm-instructie.pdf", ook_png=True)

print("Tenant NPHV:")
naar_pdf(maak(bron,
              'tik op Inloggen, kies <b style="color:#f0a04b">NPHV</b> '
              '&middot; direct kan ook: <b style="color:#f0a04b">viswedstrijdapp.nl/nphv</b>',
              '<span class="oranje">viswedstrijdapp.nl/nphv</span>'),
         APP / "docs" / "nphv" / "instructies-print.pdf")

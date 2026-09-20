# Zet vangstfoto's in de demo-wedstrijd (viswedstrijdapp.nl/demo, code DEMOJA).
#
# Waarom: de geseede demo had 20 vangsten zonder foto, dus een bezoeker zag
# alleen de visje-placeholder en niet wat de app met echte vangstfoto's doet.
# Zes vangsten hebben er sinds 20 sep 2026 een (verspreid over gewicht en tijd,
# inclusief de grootste vis, want die thumbnail staat ook in het klassement).
#
# Alleen foto's uit marketing/fotos-site/ (de VRIJGEGEVEN map, zie het LEESMIJ
# daar). Twee foto's uit die map dragen een @BivvyBrothers-watermerk en zijn
# daarom bewust NIET gekozen. De foto's worden aan mannelijke deelnemersnamen
# gekoppeld, want op elke foto staat een man.
#
# Draaien vanuit app/:  python3 tools/demo_fotos.py --pin <admin-pin van DEMOJA>
# De pin staat in de database (wedstrijden.admin_pin) en NOOIT in deze repo.
# Het script uploadt via de edge function en print daarna de SQL om de vangsten
# te koppelen; die SQL draai je zelf in Supabase.
#
# Na een nieuwe demo-seed zijn de foto_path-waarden weg: dit script opnieuw
# draaien, met de vangst-id's uit de verse seed.
import argparse, pathlib, subprocess, sys
from PIL import Image, ImageOps

APP = pathlib.Path(__file__).resolve().parent.parent
BRON = APP / "marketing" / "fotos-site"
SB = "https://xyfvkmhkwcjqskxrcfrj.supabase.co"
KEY = "sb_publishable_0sb4MYouujq5bmE6svX6Hg_EzPViAJK"   # publieke sleutel, staat ook in config.js
CODE = "DEMOJA"
WEDSTRIJD = "de8ce7aa-0f6b-4f2e-b7f6-2b964b93be05"

# foto -> (visser, gewicht in gram) van de vangst waar hij bij hoort
KOPPELING = [
    ("AEFDDC3F-EBD4-4E79-94EF-0BFB5FB2EB5F_1_105_c.jpeg", "Thijs", 14650),
    ("952CEE1E-CD6E-4261-847C-F9599165B564_1_201_a.jpeg", "Piet", 12400),
    ("F03C2C01-8393-45ED-B39D-DF4176F0956A_1_102_o.jpeg", "Jan", 11800),
    ("B0D707FC-A26B-40E0-BB39-C211F12A8BBA_1_105_c.jpeg", "Dennis", 10250),
    ("89048D78-1C41-46BE-A6A8-F7E70F92EEC8_1_105_c.jpeg", "Kees", 6200),
    ("CFB7C3BE-A968-4575-824D-5CFCDE3BFFF8.jpeg", "Marco", 5150),
]

a = argparse.ArgumentParser()
a.add_argument("--pin", required=True, help="admin-pin van de demo-wedstrijd DEMOJA")
args = a.parse_args()

tmp = pathlib.Path("/tmp/demofotos")
tmp.mkdir(exist_ok=True)
regels = []
for naam, visser, gram in KOPPELING:
    f = BRON / naam
    if not f.exists():
        sys.exit(f"foto ontbreekt: {f}")
    im = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
    im.thumbnail((1400, 1400), Image.LANCZOS)
    schoon = Image.new("RGB", im.size)        # nieuw beeld = geen metadata, dus geen GPS
    schoon.putdata(list(im.getdata()))
    uit = tmp / f"{visser.lower()}.jpg"
    schoon.save(uit, "JPEG", quality=82, optimize=True)

    r = subprocess.run([
        "curl", "-s", "-X", "POST", f"{SB}/functions/v1/upload-vangstfoto",
        "-H", f"apikey: {KEY}", "-H", f"Authorization: Bearer {KEY}",
        "-H", "Content-Type: image/jpeg", "-H", f"x-w-code: {CODE}",
        "-H", f"x-w-pin: {args.pin}", "--data-binary", f"@{uit}",
    ], capture_output=True, text=True)
    if '"pad"' not in r.stdout:
        sys.exit(f"upload mislukt voor {visser}: {r.stdout[:200]}")
    pad = r.stdout.split('"pad":"')[1].split('"')[0]
    print(f"  {visser:8} {schoon.size} -> {pad}")
    regels.append((visser, gram, pad))

print("\n-- SQL: koppel de foto's aan de vangsten van de demo-wedstrijd")
print("update wedstrijd.vangsten v set foto_path = k.pad")
print("from (values")
print(",\n".join(
    f"  ('{v}', {g}, '{p}')" for v, g, p in regels))
print(") as k(visser, gram, pad)")
print("where v.wedstrijd_id = '" + WEDSTRIJD + "' and v.gewicht_gram = k.gram")
print("  and v.team_id = (select t.id from wedstrijd.teams t")
print("                   where t.wedstrijd_id = v.wedstrijd_id and t.naam = k.visser)")
print("returning v.id, k.visser, v.gewicht_gram, v.foto_path;")

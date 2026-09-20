# Zet vangstfoto's in de demo-wedstrijd (viswedstrijdapp.nl/demo, code DEMOJA).
#
# Waarom: de geseede demo had 20 vangsten zonder foto, dus een bezoeker zag
# alleen de visje-placeholder en niet wat de app met echte vangstfoto's doet.
# Sinds 21 sep 2026 hebben ALLE twintig vangsten er een (wens Patrick). Drie foto's
# zijn twee keer gebruikt; er zijn niet meer vrijgegeven foto's.
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
    ("EABD6D92-7828-44ED-A252-BC307D7E301F_1_201_a.jpeg", "Anouk", 13100),
    ("952CEE1E-CD6E-4261-847C-F9599165B564_1_201_a.jpeg", "Piet", 12400),
    ("F03C2C01-8393-45ED-B39D-DF4176F0956A_1_102_o.jpeg", "Jan", 11800),
    ("B0D707FC-A26B-40E0-BB39-C211F12A8BBA_1_105_c.jpeg", "Dennis", 10250),
    ("D3B46F2E-DA4B-4174-95A6-B008F55539FF_1_102_o.jpeg", "Wesley", 9600),
    ("1E302F9D-E0EA-46FD-A828-70EE31FD7AD1_1_102_o.jpeg", "Sanne", 9200),
    ("31E71ED0-E728-48CE-A267-9F03EFED5690_1_102_a.jpeg", "Kees", 8650),
    ("0D4AEAEA-0A39-4738-A97D-CBAFF220B09E.jpeg", "Sanne", 7750),
    ("7DA4F091-47A1-4235-8B92-CB834F3AC24F_1_105_c.jpeg", "Marco", 7300),
    ("561B8EAD-E380-492A-95FD-A653477EEF10_1_105_c.jpeg", "Ruben", 6900),
    ("D03EEB89-DC1A-4B40-BB8D-E1209C800930_1_105_c.jpeg", "Anouk", 6450),
    ("89048D78-1C41-46BE-A6A8-F7E70F92EEC8_1_105_c.jpeg", "Kees", 6200),
    ("18CF215D-1D3B-4BDF-8DD3-B0D0700AF0EA_1_105_c.jpeg", "Sanne", 5300),
    ("CFB7C3BE-A968-4575-824D-5CFCDE3BFFF8.jpeg", "Marco", 5150),
    ("781BF21C-44F1-46C4-91B8-569CE6EE7ADB.jpeg", "Thijs", 4800),
    ("5D3CE0BF-CF25-416B-A033-D578C0450E80.jpeg", "Jan", 4200),
    ("0D4AEAEA-0A39-4738-A97D-CBAFF220B09E.jpeg", "Marco", 3400),
    ("561B8EAD-E380-492A-95FD-A653477EEF10_1_105_c.jpeg", "Kees", 3100),
    ("781BF21C-44F1-46C4-91B8-569CE6EE7ADB.jpeg", "Wesley", 2800),
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

# Merkblok voor de e-mailhandtekening: het ronde logo met "Loot. Vis. Win."
# eronder en de oranje penseelstreek. Wordt als een plaatje in de handtekening
# gezet, want een mailclient rendert geen webfont en geen inline SVG betrouwbaar.
#
# Besluit Patrick 20 sep 2026: GEEN groen vlak eromheen. De achtergrond is
# doorzichtig (het logo brengt zijn eigen groene cirkel mee) en de slogan staat
# in donkergroen met oranje punten, zodat het blok op een witte mailachtergrond
# staat zonder kader.
#
# Draaien vanuit app/: python3 marketing/gen_handtekening_merk.py
# Uitvoer: docs/handtekening-merk.png (320x340, tonen op 160x170)
import base64, pathlib, subprocess

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HIER = pathlib.Path(__file__).parent
APP = HIER.parent
b64 = lambda p: base64.b64encode(pathlib.Path(p).read_bytes()).decode()
mont = b64(APP / "docs/fonts/montserrat-latin.woff2")
logo = b64(APP / "docs/logo-rond-512.png")

STREEP = ("<svg viewBox='0 0 200 15'><path d='M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7"
          "-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z' fill='#f0a04b'/></svg>")

html = f"""<!DOCTYPE html><html><head><meta charset='utf-8'><style>
@font-face {{ font-family:'Montserrat'; font-weight:400 900; src:url(data:font/woff2;base64,{mont}) format('woff2'); }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html,body {{ width:320px; height:300px; overflow:hidden; background:transparent; }}
body {{ font-family:'Montserrat',Arial,sans-serif;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:6px 10px 10px; }}
img {{ width:210px; height:210px; display:block; }}
.slogan {{ margin-top:14px; width:100%; text-align:center; }}
.slogan .t {{ font-size:40px; font-weight:800; color:#353d2a; letter-spacing:-1px; line-height:1; }}
.slogan i {{ color:#f0a04b; font-style:normal; }}
.slogan svg {{ display:block; width:100%; margin-top:4px; }}
</style></head><body>
<img src='data:image/png;base64,{logo}'>
<div class='slogan'><div class='t'>Loot<i>.</i> Vis<i>.</i> Win<i>.</i></div>{STREEP}</div>
</body></html>"""

tmp = HIER / "_hs.html"
tmp.write_text(html, encoding="utf-8")
uit = APP / "docs" / "handtekening-merk.png"
subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                "--default-background-color=00000000",
                f"--screenshot={uit}", "--window-size=320,300",
                "--force-device-scale-factor=1", f"file://{tmp.resolve()}"], capture_output=True)
tmp.unlink()

from PIL import Image
im = Image.open(uit).convert("RGBA")
if im.getpixel((2, 2))[3] > 10:      # Chrome gaf toch een dekkende achtergrond
    print("LET OP: achtergrond niet doorzichtig")
im.save(uit)
print("geschreven:", uit, uit.stat().st_size // 1024, "KB")

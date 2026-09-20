# Merkblok voor de e-mailhandtekening: het ronde logo op donkergroen met
# "Loot. Vis. Win." eronder en de oranje penseelstreek (beeld van Patrick,
# 20 sep 2026). Wordt als een plaatje in de handtekening gezet, want een
# mailclient rendert geen webfont en geen inline SVG betrouwbaar.
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
html,body {{ width:320px; height:340px; overflow:hidden; }}
body {{ background:#353d2a; font-family:'Montserrat',Arial,sans-serif;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:22px 20px 26px; }}
img {{ width:196px; height:196px; display:block; }}
.slogan {{ margin-top:16px; width:100%; text-align:center; }}
.slogan .t {{ font-size:38px; font-weight:800; color:#fff; letter-spacing:-1px; line-height:1; }}
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
                f"--screenshot={uit}", "--window-size=320,340",
                "--force-device-scale-factor=1", f"file://{tmp.resolve()}"], capture_output=True)
tmp.unlink()

# afgeronde hoeken met transparante buitenrand: het blok mag niet als een
# rechthoekig vlak in de mail staan
from PIL import Image, ImageDraw
im = Image.open(uit).convert("RGBA")
masker = Image.new("L", im.size, 0)
ImageDraw.Draw(masker).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=26, fill=255)
im.putalpha(masker)
im.save(uit)
print("geschreven:", uit, uit.stat().st_size // 1024, "KB")

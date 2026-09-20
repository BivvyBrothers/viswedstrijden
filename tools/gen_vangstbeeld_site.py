# Vangstbeeld voor de landingspagina: de foto in het viswedstrijdapp-frame, zoals de
# social-posts, maar ZONDER wedstrijdgegevens (geen datum, tijd, plaats of wedstrijd).
# Alleen gewicht en naam. Besluit Patrick 20 sep 2026.
# Draaien vanuit app/: python3 tools/gen_vangstbeeld_site.py
import base64, io, pathlib, subprocess
from PIL import Image, ImageOps

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HIER = pathlib.Path(__file__).parent
APP = HIER.parent
BRON = APP / "../ontwerp/Foto's site/18CF215D-1D3B-4BDF-8DD3-B0D0700AF0EA_1_105_c.jpeg"
GEWICHT, NAAM = "17,9 kg", "Patrick"

def b64(p): return base64.b64encode(pathlib.Path(p).read_bytes()).decode()
# EXIF-draaiing toepassen en ZONDER metadata wegschrijven (geen GPS op de site)
im = ImageOps.exif_transpose(Image.open(BRON)).convert("RGB")
buf = io.BytesIO(); im.save(buf, "JPEG", quality=92)
foto = base64.b64encode(buf.getvalue()).decode()
logo = b64(APP / "docs/logo-rond-512.png")

HTML = f"""<!DOCTYPE html><html><head><meta charset='utf-8'><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
html,body {{ width:1080px; height:1350px; overflow:hidden; }}
body {{ font-family: Arial, Helvetica, sans-serif; background:#353d2a; color:#fff; position:relative; }}
.foto {{ width:1080px; height:800px; overflow:hidden; background:#29271e; }}
.foto img {{ width:100%; height:100%; object-fit:cover; object-position:center 45%; display:block; }}
.paneel {{ padding:58px 70px 0; }}
.kg {{ font-size:152px; font-weight:700; line-height:1; color:#f0a04b; letter-spacing:-3px; }}
.naam {{ font-size:62px; font-weight:700; margin-top:16px; letter-spacing:-1px; }}
.voet {{ position:absolute; left:70px; right:70px; bottom:58px; display:flex; align-items:center; justify-content:space-between; }}
.voet .l {{ display:flex; align-items:center; gap:18px; }}
.voet img {{ width:76px; height:76px; }}
.voet .adres {{ font-family:'Courier New',monospace; font-weight:700; font-size:32px; color:#f0a04b; }}
.voet .kem {{ font-size:22px; color:#9ba183; }}
</style></head><body>
<div class='foto'><img src='data:image/jpeg;base64,{foto}'></div>
<div class='paneel'><div class='kg'>{GEWICHT}</div><div class='naam'>{NAAM}</div></div>
<div class='voet'><div class='l'><img src='data:image/png;base64,{logo}'><span class='adres'>viswedstrijdapp.nl</span></div><span class='kem'>een product van KemblincK</span></div>
</body></html>"""

hp = HIER / "_vangstbeeld.html"; hp.write_text(HTML, encoding="utf-8")
png = APP / "docs/schermen/_vangstbeeld.png"
subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars", f"--screenshot={png}",
                "--window-size=1080,1350", "--force-device-scale-factor=1", f"file://{hp.resolve()}"],
               capture_output=True)
hp.unlink()
doel = APP / "docs/schermen/vangst-klassement.jpg"
k = Image.open(png).convert("RGB").resize((864, 1080), Image.LANCZOS)
schoon = Image.new("RGB", k.size); schoon.putdata(list(k.getdata()))
schoon.save(doel, "JPEG", quality=86, optimize=True, progressive=True)
png.unlink()
print("geschreven:", doel, schoon.size, doel.stat().st_size // 1024, "KB")

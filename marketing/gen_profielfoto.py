# Profielfoto voor Instagram en Facebook (1080x1080): de karper uit het app-icoon met
# "viswedstrijdapp" in een boog erboven. Huisstijl: legergroen #2f4a2a + oranje #E8871E.
# Draaien vanuit deze map: python3 gen_profielfoto.py  -> profielfoto-socials.png
import base64, io, math, pathlib, subprocess
from PIL import Image

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HIER = pathlib.Path(__file__).parent
GROEN = (47, 74, 42); ORANJE = (232, 135, 30)

# 1. de vis uit het icoon halen: alles wat niet groen is wordt oranje met een alpha op basis van de afstand tot groen
ico = Image.open(HIER / "../docs/icon-512.png").convert("RGB")
px = ico.load(); vis = Image.new("RGBA", ico.size, (0, 0, 0, 0)); vp = vis.load()
maxd = math.dist(GROEN, ORANJE)
for y in range(ico.height):
    for x in range(ico.width):
        a = min(1.0, math.dist(px[x, y], GROEN) / maxd)
        vp[x, y] = (*ORANJE, round(a * 255))
bbox = vis.getbbox(); vis = vis.crop(bbox)
buf = io.BytesIO(); vis.save(buf, "PNG"); vis64 = base64.b64encode(buf.getvalue()).decode()
vw, vh = vis.size

# 2. compositie in SVG: boogtekst boven, vis eronder, alles binnen de cirkel-uitsnede van Instagram/Facebook
W = 1080; cx, cy = 540, 540
R = 415                                    # straal van de tekstboog (letterbovenkant blijft binnen de cirkel)
schaal = 660 / vw; fw, fh = vw * schaal, vh * schaal
fx, fy = cx - fw / 2, 640 - fh / 2         # vis iets onder het midden
# boog van links (200 graden) via boven naar rechts (340 graden), met de klok mee
def pt(deg): return (cx + R * math.cos(math.radians(deg)), cy + R * math.sin(math.radians(deg)))
x1, y1 = pt(185); x2, y2 = pt(355)
svg = f"""<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='{W}' height='{W}' viewBox='0 0 {W} {W}'>
  <rect width='{W}' height='{W}' fill='rgb{GROEN}'/>
  <defs><path id='boog' d='M {x1:.1f} {y1:.1f} A {R} {R} 0 0 1 {x2:.1f} {y2:.1f}'/></defs>
  <text font-family="'Avenir Next','Segoe UI',Arial,sans-serif" font-weight='800' font-size='88' fill='rgb{ORANJE}' letter-spacing='6'>
    <textPath xlink:href='#boog' startOffset='50%' text-anchor='middle'>viswedstrijd<tspan fill='#ffffff'>app</tspan>.nl</textPath>
  </text>
  <image xlink:href='data:image/png;base64,{vis64}' x='{fx:.1f}' y='{fy:.1f}' width='{fw:.1f}' height='{fh:.1f}'/>
</svg>"""
html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>*{{margin:0}}html,body{{width:{W}px;height:{W}px;overflow:hidden}}</style></head><body>{svg}</body></html>"
hp = HIER / "profielfoto-socials.html"; pp = HIER / "profielfoto-socials.png"
hp.write_text(html, encoding="utf-8")
subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars", f"--screenshot={pp}",
                f"--window-size={W},{W}", "--force-device-scale-factor=1", f"file://{hp.resolve()}"], capture_output=True)
hp.unlink()
# voorvertoning van de cirkel-uitsnede zoals Instagram en Facebook hem tonen
im = Image.open(pp).convert("RGBA"); m = Image.new("L", im.size, 0)
from PIL import ImageDraw
ImageDraw.Draw(m).ellipse((0, 0, W - 1, W - 1), fill=255)
rond = Image.new("RGBA", im.size, (230, 228, 208, 255)); rond.paste(im, (0, 0), m); rond.save(HIER / "profielfoto-socials-rond-preview.png")
print("geschreven:", pp, "+ rond-preview")

# Visueel huisstijloverzicht (1400x1900) voor viswedstrijdapp.nl.
# Draaien vanuit app/: python3 tools/gen_huisstijl_overzicht.py
import base64, pathlib, subprocess
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HIER = pathlib.Path(__file__).parent; APP = HIER.parent
def b64(p): return base64.b64encode(pathlib.Path(p).read_bytes()).decode()
mont = b64(APP / "docs/fonts/montserrat-latin.woff2")
logo = b64(APP / "docs/logo-rond-512.png")
icoon = b64(APP / "docs/icon-512.png")
zon = b64(APP / "docs/schermen/avondlicht-800.jpg")

KLEUREN = [("Donkergroen","#353d2a","topbar, koppen, donkere blokken"),("Groen","#4d5839","knoppen in de app"),
           ("Diepgroen","#293222","voet"),("Olijf","#6d7355","zachte accenten"),("Oranje","#f0a04b","accent, actie, slogan"),
           ("Zand","#e6e4d0","achtergrond site"),("Zand licht","#edeadb","afwisselende secties"),
           ("Zand vlak","#dfdcc6","vlakken in een kaart"),("Tekst","#29271e","lopende tekst"),("Gedempt","#6b6853","bijschriften")]
swatches = "".join(f"<div class='sw'><div class='vak' style='background:{h}'></div><b>{n}</b><span>{h}</span><small>{u}</small></div>" for n,h,u in KLEUREN)
STREEP = ("<svg viewBox='0 0 200 15'><path d='M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1"
          "-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z' fill='#f0a04b'/></svg>")

HTML = f"""<!DOCTYPE html><html><head><meta charset='utf-8'><style>
@font-face {{ font-family:'Montserrat'; font-weight:400 900; src:url(data:font/woff2;base64,{mont}) format('woff2'); }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html,body {{ width:1400px; height:1490px; }}
body {{ font-family:'Montserrat',Arial,sans-serif; background:#e6e4d0; color:#29271e; padding:54px 60px; }}
h1 {{ font-size:46px; font-weight:800; color:#353d2a; letter-spacing:-1px; }}
h1 span {{ color:#f0a04b; }}
h2 {{ font-size:15px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#f0a04b; margin:38px 0 16px; }}
.kop {{ display:flex; align-items:center; gap:26px; }}
.kop img {{ width:110px; height:110px; }}
.kop .sub {{ font-size:17px; color:#6b6853; margin-top:6px; }}
.sws {{ display:grid; grid-template-columns:repeat(5,1fr); gap:14px; }}
.sw .vak {{ height:76px; border-radius:12px; box-shadow:inset 0 0 0 1px rgba(0,0,0,.08); }}
.sw b {{ display:block; font-size:14px; font-weight:700; margin-top:8px; }}
.sw span {{ display:block; font-family:'Courier New',monospace; font-size:13px; color:#6b6853; }}
.sw small {{ display:block; font-size:12px; color:#6b6853; margin-top:2px; }}
.rij {{ display:grid; grid-template-columns:1fr 1fr; gap:34px; }}
.kaart {{ background:#fff; border-radius:16px; padding:26px 30px; }}
.kaart.groen {{ background:#353d2a; color:#fff; }}
.let800 {{ font-size:40px; font-weight:800; letter-spacing:-.8px; }}
.let700 {{ font-size:22px; font-weight:700; margin-top:10px; }}
.let400 {{ font-size:17px; font-weight:400; margin-top:10px; line-height:1.5; color:#6b6853; }}
.kaart.groen .let400 {{ color:#d9dcc2; }}
.oranje {{ color:#f0a04b; }}
.knoppen {{ display:flex; gap:12px; margin-top:16px; flex-wrap:wrap; }}
.knop {{ padding:13px 22px; border-radius:12px; font-weight:700; font-size:16px; }}
.k1 {{ background:#f0a04b; color:#2c331f; }}
.k2 {{ background:rgba(255,255,255,.12); color:#fff; border:1.5px solid rgba(255,255,255,.55); }}
.k3 {{ background:#4d5839; color:#fff; }}
.slogan {{ display:inline-block; }}
.slogan .t {{ font-size:34px; font-weight:800; color:#fff; letter-spacing:-.5px; }}
.slogan .p {{ color:#f0a04b; }}
.slogan svg {{ display:block; width:100%; margin-top:4px; }}
.foto {{ border-radius:14px; overflow:hidden; height:190px; position:relative; }}
.foto img {{ width:100%; height:100%; object-fit:cover; }}
.telefoon {{ width:120px; aspect-ratio:78/163.4; background:linear-gradient(145deg,#56594d,#24271e 12%,#1b1e16 50%,#24271e 88%,#56594d);
  border-radius:12.8%/6.11%; padding:2.97%; }}
.telefoon div {{ width:100%; height:100%; background:#cdd0bb; border-radius:10.4%/4.97%; }}
.voet {{ margin-top:34px; font-size:14px; color:#6b6853; }}
</style></head><body>
<div class='kop'>
  <img src='data:image/png;base64,{logo}'>
  <div><h1>Huisstijl <span>viswedstrijdapp.nl</span></h1>
  <div class='sub'>Vastgelegd 20 september 2026 &middot; Patrick Kemble, KemblincK</div></div>
</div>
<h2>Kleuren</h2><div class='sws'>{swatches}</div>
<h2>Lettertype: Montserrat</h2>
<div class='rij'>
  <div class='kaart'>
    <div class='let800'>Koppen in ExtraBold 800</div>
    <div class='let700'>Knoppen en vette woorden in Bold 700</div>
    <div class='let400'>Lopende tekst in Regular 400. Rustig, concreet, Nederlands en tutoyerend. Codes en adressen blijven monospace.</div>
    <div class='knoppen'><span class='knop k1'>Primaire actie</span><span class='knop k3'>In de app</span></div>
  </div>
  <div class='kaart groen'>
    <div class='let800'>Koppen afwisselend<br>wit en <span class='oranje'>oranje</span></div>
    <div class='let400'>Het eerste deel wit of donkergroen, het tweede deel oranje. Tekst op oranje is altijd donker.</div>
    <div class='knoppen'><span class='knop k1'>Bekijk de demo</span><span class='knop k2'>Zo werkt het</span></div>
  </div>
</div>
<h2>Slogan, logo en beeld</h2>
<div class='rij'>
  <div class='kaart groen' style='display:flex; align-items:center; justify-content:center;'>
    <span class='slogan'><span class='t'>Loot<span class='p'>.</span> Vis<span class='p'>.</span> Win<span class='p'>.</span></span>{STREEP}</span>
  </div>
  <div class='kaart' style='display:flex; align-items:center; gap:26px;'>
    <img src='data:image/png;base64,{logo}' style='width:104px;height:104px'>
    <img src='data:image/png;base64,{icoon}' style='width:78px;height:78px;border-radius:18px'>
    <div class='telefoon'><div></div></div>
    <div class='let400' style='margin:0'>Rond logo overal in een pagina. Vierkant icoon alleen voor favicon en beginscherm. Telefoon altijd in de verhouding 78 : 163,4.</div>
  </div>
</div>
<div class='foto' style='margin-top:34px'><img src='data:image/jpeg;base64,{zon}'></div>
<div class='voet'>Beeld: avondlicht aan het water met een donkergroene waas voor leesbare tekst. Vangstfoto's altijd zonder metadata.
Volledige beschrijving in ontwerp/HUISSTIJL.md.</div>
</body></html>"""
hp = HIER / "_huisstijl.html"; hp.write_text(HTML, encoding="utf-8")
uit = APP / "../ontwerp/huisstijl-overzicht.png"
subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars", f"--screenshot={uit}",
                "--window-size=1400,1490", "--force-device-scale-factor=1", f"file://{hp.resolve()}"], capture_output=True)
hp.unlink(); print("geschreven:", uit)

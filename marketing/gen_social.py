import base64, subprocess, pathlib

OUT = pathlib.Path("marketing/social"); OUT.mkdir(parents=True, exist_ok=True)
def b64(p): return base64.b64encode(pathlib.Path(p).read_bytes()).decode()
icon = b64("docs/icon-512.png")

CSS = """
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:1080px; height:1080px; overflow:hidden; }
body { font-family:'Avenir Next','Segoe UI',Arial,sans-serif; position:relative; }
.groen { background:#353d2a; color:#fff; }
.creme { background:#edeadb; color:#29271e; }
.wrap { width:1080px; height:1080px; padding:90px 90px 190px; display:flex; flex-direction:column; }
.badge { width:150px; height:150px; border-radius:34px; display:block; }
.oranje { color:#E8871E; }
.voet { position:absolute; left:90px; right:90px; bottom:74px; display:flex; align-items:baseline; justify-content:space-between; }
.voet .adres { font-family:'Courier New',monospace; font-weight:800; font-size:34px; color:#E8871E; letter-spacing:.5px; }
.voet .kem { font-size:24px; }
"""
def html(body, klass, extra=""):
    return f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>{CSS}{extra}</style></head><body class='{klass}'>{body}</body></html>"

def voet(kemkleur):
    return f"<div class='voet'><span class='adres'>viswedstrijdapp.nl</span><span class='kem' style='color:{kemkleur}'>een product van KemblincK</span></div>"

# 1) LANCERING
lancering = html(f"""
<div class='wrap'>
  <img class='badge' src='data:image/png;base64,{icon}'>
  <div style='margin-top:50px'>
    <div style='font-size:32px; font-weight:700; color:#E8871E; letter-spacing:2px'>NIEUW</div>
    <h1 style='font-size:92px; line-height:1.05; font-weight:800; margin-top:16px'>De<br>viswedstrijd&#8209;app<br>is er</h1>
    <p style='font-size:39px; line-height:1.4; color:#d9dcc2; margin-top:38px; max-width:860px'>
    Loten, je stek kiezen op de kaart, je vangst doorgeven met foto en het klassement
    <b style='color:#fff'>live</b> volgen. Alles op je telefoon.</p>
    <p style='font-size:33px; color:#9ba183; margin-top:30px'>Zonder App Store &nbsp;&#183;&nbsp; zonder account</p>
  </div>
  {voet('#9ba183')}
</div>""", "groen")

# 2) FEATURES
def feat(svg, titel, tekst):
    return f"<div class='kaart'><div class='ico'>{svg}</div><b>{titel}</b><p>{tekst}</p></div>"
svg_loting = "<svg width='58' height='58' viewBox='0 0 64 64'><rect x='10' y='10' width='44' height='44' rx='10' fill='none' stroke='#E8871E' stroke-width='4'/><circle cx='22' cy='22' r='4.5' fill='#E8871E'/><circle cx='42' cy='22' r='4.5' fill='#E8871E'/><circle cx='32' cy='32' r='4.5' fill='#E8871E'/><circle cx='22' cy='42' r='4.5' fill='#E8871E'/><circle cx='42' cy='42' r='4.5' fill='#E8871E'/></svg>"
svg_kaart = "<svg width='58' height='58' viewBox='0 0 64 64'><path d='M24 8 L40 14 L56 8 L56 50 L40 56 L24 50 L8 56 L8 14 Z' fill='none' stroke='#E8871E' stroke-width='4' stroke-linejoin='round'/><path d='M24 8 L24 50 M40 14 L40 56' stroke='#E8871E' stroke-width='4'/><circle cx='32' cy='30' r='5' fill='#E8871E'/></svg>"
svg_klass = "<svg width='58' height='58' viewBox='0 0 64 64'><path d='M20 12 h24 v10 a12 12 0 0 1 -24 0 z' fill='none' stroke='#E8871E' stroke-width='4' stroke-linejoin='round'/><path d='M20 16 H12 a6 6 0 0 0 8 8 M44 16 h8 a6 6 0 0 1 -8 8' fill='none' stroke='#E8871E' stroke-width='4'/><path d='M32 34 v8 M24 52 h16 M28 46 h8' stroke='#E8871E' stroke-width='4' stroke-linecap='round'/></svg>"
svg_push = "<svg width='58' height='58' viewBox='0 0 64 64'><path d='M32 10 c-9 0 -14 6 -14 15 v10 l-5 8 h38 l-5 -8 v-10 c0 -9 -5 -15 -14 -15 z' fill='none' stroke='#E8871E' stroke-width='4' stroke-linejoin='round'/><path d='M26 48 a6 6 0 0 0 12 0' fill='none' stroke='#E8871E' stroke-width='4'/></svg>"

features = html(f"""
<div class='wrap' style='padding-top:80px'>
  <h1 style='font-size:70px; font-weight:800; color:#353d2a'>Wat kan de app?</h1>
  <p style='font-size:33px; color:#57543f; margin-top:12px'>De hele wedstrijd op je telefoon.</p>
  <div class='grid'>
    {feat(svg_loting,"Digitaal loten","Iedereen ziet meteen zijn lotnummer. Geen briefjes uit een emmer.")}
    {feat(svg_kaart,"Stek op de kaart","Om de beurt je plek kiezen. Bezette plekken zie je direct.")}
    {feat(svg_klass,"Live klassement","Elke vangst telt meteen mee: totaalgewicht en grootste vis.")}
    {feat(svg_push,"Meldingen","Een seintje bij elke vangst. Iedereen blijft op de hoogte.")}
  </div>
  {voet('#7a7660')}
</div>""", "creme", """
.grid { margin-top:42px; display:grid; grid-template-columns:1fr 1fr; gap:26px; }
.kaart { background:#fff; border-radius:26px; padding:34px 32px; box-shadow:0 2px 8px rgba(42,39,33,.12); }
.kaart .ico { width:80px; height:80px; border-radius:20px; background:#f3f1e4; display:flex; align-items:center; justify-content:center; margin-bottom:20px; }
.kaart b { display:block; font-size:39px; color:#353d2a; margin-bottom:11px; }
.kaart p { font-size:28px; line-height:1.38; color:#57543f; }
""")

# 3) ORGANISATOREN
organisatoren = html(f"""
<div class='wrap'>
  <img class='badge' src='data:image/png;base64,{icon}'>
  <div style='margin-top:48px'>
    <h1 style='font-size:78px; line-height:1.08; font-weight:800'>Organiseer je<br>zelf een<br><span class='oranje'>viswedstrijd?</span></h1>
    <p style='font-size:39px; line-height:1.42; color:#d9dcc2; margin-top:42px; max-width:880px'>
    Voor je vereniging, je viswater of gewoon met een vaste groep vrienden.
    Je krijgt een <b style='color:#fff'>eigen omgeving</b> met eigen kaart, loting en klassement.</p>
    <p style='font-size:37px; color:#fff; margin-top:40px'>Kijk op <b class='oranje'>kemblinck.nl</b> of stuur een DM.</p>
  </div>
  {voet('#9ba183')}
</div>""", "groen")

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for naam, doc in {"1-lancering":lancering,"2-features":features,"3-organisatoren":organisatoren}.items():
    hp = OUT / f"{naam}.html"; hp.write_text(doc, encoding="utf-8")
    pp = OUT / f"{naam}.png"
    subprocess.run([CHROME,"--headless","--disable-gpu","--hide-scrollbars",f"--screenshot={pp}","--window-size=1080,1080","--force-device-scale-factor=1",f"file://{hp.resolve()}"], capture_output=True)
    print("gerenderd:", pp.name)

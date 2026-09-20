# Advertentie voor Instagram en Facebook, in de huisstijl van 20 sep 2026
# (ontwerp/HUISSTIJL.md): Montserrat, groen #353d2a, oranje #f0a04b, koppen
# afwisselend wit en oranje, slogan met penseelstreek, telefoon in de echte
# toestelverhouding 78 : 163,4.
#
# Het telefoonscherm toont het tegeloverzicht zoals goedgekeurd in het ontwerp
# van 19 september (fase 4). Plaats de advertentie pas als fase 4 live is,
# anders ziet een bezoeker een ander scherm dan de advertentie belooft.
#
# Draaien vanuit app/: python3 marketing/gen_advertentie.py
# Uitvoer: marketing/advertentie-vierkant.png (1080x1080, feed)
#          marketing/advertentie-staand.png   (1080x1350, Instagram 4:5)
import base64, pathlib, subprocess

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HIER = pathlib.Path(__file__).parent
APP = HIER.parent
def b64(p): return base64.b64encode(pathlib.Path(p).read_bytes()).decode()

mont  = b64(APP / "docs/fonts/montserrat-latin.woff2")
logo  = b64(APP / "docs/logo-rond-512.png")
zon   = b64(APP / "docs/schermen/avondlicht-1600.jpg")
vis   = b64(APP / "docs/schermen/vangst-klein.jpg")

PRIJS_GROOT, PRIJS_REGEL1, PRIJS_REGEL2 = "&euro; 79", "per wedstrijd", "alles inbegrepen"
VOORWAARDE = ("Grotere groep? Tot 25 deelnemers &euro; 119, tot 50 &euro; 159.<br>"
              "Een heel jaar onbeperkt vissen: vanaf &euro; 199.")

STREEP = ("<svg viewBox='0 0 200 15'><path d='M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7"
          "-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z' fill='#f0a04b'/></svg>")

IC = {
 "kaart": "<path d='M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z'/><path d='M9 3v15M15 6v15'/>",
 "loting": "<path d='M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6M3 3l6 6'/>",
 "beker": "<path d='M8 4h8v5a4 4 0 0 1-8 0z'/><path d='M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3'/><path d='M10 14h4v4h-4zM8 20h8'/>",
 "vangst": "<path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor'/>",
 "pin": "<path d='M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z'/><circle cx='12' cy='10' r='2.6'/>",
 "telefoon": "<rect x='6' y='2' width='12' height='20' rx='3'/><path d='M11 18.5h2'/>",
 "oog": "<path d='M1.6 12S5 5.6 12 5.6 22.4 12 22.4 12 19 18.4 12 18.4 1.6 12 1.6 12z'/><circle cx='12' cy='12' r='3'/>",
}
def svg(naam, kleur="#f0a04b", dikte=2):
    return (f"<svg viewBox='0 0 24 24' fill='none' stroke='{kleur}' stroke-width='{dikte}' "
            f"stroke-linecap='round' stroke-linejoin='round'>{IC[naam]}</svg>")

STAND = [("1", "Patrick", "17,9 kg"), ("2", "Jeroen", "12,4 kg"), ("3", "Mark", "9,8 kg")]

VOORDELEN = [("pin", "Kaart met jullie stekken", "zones, nummers en wie waar zit"),
             ("loting", "Loting in één tik", "iedereen kiest om de beurt"),
             ("beker", "Live klassement", "vangst erin, stand bijgewerkt"),
             ("oog", "Thuis meekijken", "met een aparte kijkcode")]

def tegel(icoon, label, zand=False):
    kleur = "#d8d0b7" if zand else "#cbd0b7"
    return (f"<div class='tegel' style='background:{kleur}'>"
            f"<span class='ti'>{svg(icoon, '#2b3122', 1.8)}</span>"
            f"<span class='tl'>{label}</span><span class='tp'>&rsaquo;</span></div>")

def navknop(icoon, label, actief=False):
    k = "#f0a04b" if actief else "#b9bfa6"
    return (f"<div class='nav {'aan' if actief else ''}'>{svg(icoon, k, 1.9)}"
            f"<span style='color:{k}'>{label}</span></div>")

def telefoon_html():
    return f"""
<div class='telefoon'><div class='scherm'>
  <div class='tb'>Viswedstrijdapp</div>
  <div class='kop'>
    <img class='rond' src='data:image/png;base64,{logo}'>
    <div class='slog'>Loot<i>.</i> Vis<i>.</i> Win<i>.</i>{STREEP}</div>
  </div>
  <div class='tegels'>
    {tegel('kaart', 'Viswater')}{tegel('loting', 'Loting', True)}
    {tegel('beker', 'Klassement', True)}{tegel('vangst', 'Vangsten')}
  </div>
  <div class='mini'>
    <div class='mk'>Klassement</div>
    {''.join(f"<div class='mr'><b>{n}</b><span>{nm}</span><i>{g}</i></div>" for n,nm,g in STAND)}
  </div>
  <div class='laatste'>
    <img src='data:image/jpeg;base64,{vis}'>
    <div><b>Nieuwe vangst</b><span>Patrick &middot; 17,9 kg</span></div>
    <i>nu</i>
  </div>
  <div class='navbalk'>
    {navknop('kaart', 'Overzicht', True)}{navknop('pin', 'Kaart')}
    {navknop('vangst', 'Vangsten')}{navknop('telefoon', 'Meer')}
  </div>
</div></div>"""


def bouw(breedte, hoogte, bestandsnaam):
    staand = hoogte > breedte
    # telefoonbreedte en plek; de schermmaten schalen mee (basis 352 px)
    tb = 352 if staand else 322
    f = tb / 352
    tel_top = 452 if staand else 300
    tel_rechts = 44 if staand else 40
    css = f"""
@font-face {{ font-family:'Montserrat'; font-weight:400 900; src:url(data:font/woff2;base64,{mont}) format('woff2'); }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html,body {{ width:{breedte}px; height:{hoogte}px; overflow:hidden; }}
body {{ font-family:'Montserrat',Arial,sans-serif; position:relative; color:#fff; }}
.bg {{ position:absolute; inset:0; }}
.bg img {{ width:100%; height:100%; object-fit:cover; object-position:58% 50%; }}
.waas {{ position:absolute; inset:0;
  background:linear-gradient(100deg, rgba(22,27,16,.96) 0%, rgba(22,27,16,.9) 36%, rgba(22,27,16,.5) 68%, rgba(22,27,16,.44) 100%); }}
.waas2 {{ position:absolute; inset:0;
  background:radial-gradient(120% 80% at 78% 92%, rgba(18,22,13,.55) 0%, rgba(18,22,13,0) 60%); }}
.in {{ position:absolute; inset:0; padding:{56 if staand else 50}px; display:flex; flex-direction:column; }}
.logo {{ width:{160 if staand else 146}px; height:auto; }}
.prijs {{ position:absolute; top:{50 if staand else 44}px; right:{50 if staand else 44}px;
  width:{232 if staand else 218}px; height:{232 if staand else 218}px; border-radius:50%;
  background:#f0a04b; color:#2c331f; display:flex; flex-direction:column;
  align-items:center; justify-content:center; text-align:center; line-height:1;
  box-shadow:0 14px 34px rgba(0,0,0,.4); }}
.prijs .v {{ font-size:24px; font-weight:700; }}
.prijs .b {{ font-size:{60 if staand else 56}px; font-weight:800; letter-spacing:-2px; margin:4px 0 6px; }}
.prijs .r1 {{ font-size:19px; font-weight:700; }}
.prijs .r2 {{ font-size:15px; font-weight:400; margin-top:3px; }}
h1 {{ font-size:{65 if staand else 61}px; font-weight:800; line-height:1.04; letter-spacing:-2px;
  margin-top:{42 if staand else 26}px; max-width:{660 if staand else 630}px; }}
h1 .o {{ color:#f0a04b; }}
.sub {{ font-size:{25 if staand else 22}px; color:#e9ead9; margin-top:18px; line-height:1.42; max-width:{560 if staand else 500}px; }}
.sub b {{ color:#fff; font-weight:700; }}
.vd {{ margin-top:{32 if staand else 26}px; display:flex; flex-direction:column; gap:{19 if staand else 16}px; }}
.vd .r {{ display:flex; align-items:center; gap:15px; }}
.vd svg {{ width:33px; height:33px; flex:0 0 auto; }}
.vd b {{ display:block; font-size:{25 if staand else 22}px; font-weight:700; line-height:1.15; }}
.vd span {{ display:block; font-size:{18 if staand else 16}px; color:#cfd3bd; }}
.onder {{ margin-top:auto; }}
.vw {{ font-size:{19 if staand else 17}px; color:#d9dcc2; margin-bottom:16px; line-height:1.45; max-width:{600 if staand else 560}px; }}
.cta {{ display:inline-flex; align-items:center; gap:16px; background:#f0a04b; color:#2c331f;
  font-size:{31 if staand else 27}px; font-weight:800; padding:{24 if staand else 21}px {46 if staand else 38}px;
  border-radius:999px; letter-spacing:-.5px; box-shadow:0 12px 30px rgba(0,0,0,.3); }}

/* telefoon: echte toestelverhouding 78 : 163,4 */
.telefoon {{ position:absolute; right:{tel_rechts}px; top:{tel_top}px;
  width:{tb}px; aspect-ratio:78/163.4; padding:2.97%;
  background:linear-gradient(145deg,#56594d,#24271e 12%,#1b1e16 50%,#24271e 88%,#56594d);
  border-radius:12.8%/6.11%; box-shadow:0 30px 64px rgba(0,0,0,.55); transform:rotate(-3deg); }}
.scherm {{ width:100%; height:100%; background:#3e4732; border-radius:10.4%/4.97%;
  overflow:hidden; padding:{20*f:.1f}px {17*f:.1f}px 0; display:flex; flex-direction:column; }}
.tb {{ text-align:center; font-size:{15*f:.1f}px; font-weight:700; color:#fff; opacity:.9; margin-bottom:{13*f:.1f}px; }}
.kop {{ display:flex; flex-direction:column; align-items:center; margin-top:{6*f:.1f}px; }}
.kop .rond {{ width:{104*f:.1f}px; height:{104*f:.1f}px; }}
.slog {{ margin-top:{12*f:.1f}px; text-align:center; font-size:{27*f:.1f}px; font-weight:800; color:#fff; letter-spacing:-.6px; line-height:1; }}
.slog i {{ color:#f0a04b; font-style:normal; }}
.slog svg {{ width:{176*f:.1f}px; display:block; margin:{2*f:.1f}px auto 0; }}
.tegels {{ display:grid; grid-template-columns:1fr 1fr; gap:{9*f:.1f}px; margin-top:{18*f:.1f}px; }}
.tegel {{ border-radius:{14*f:.1f}px; padding:{11*f:.1f}px {11*f:.1f}px {9*f:.1f}px; position:relative; }}
.tegel .ti svg {{ width:{25*f:.1f}px; height:{25*f:.1f}px; }}
.tegel .tl {{ display:block; margin-top:{10*f:.1f}px; font-size:{14*f:.1f}px; font-weight:700; color:#2b3122; padding-right:{16*f:.1f}px; }}
.tegel .tp {{ position:absolute; right:{10*f:.1f}px; bottom:{7*f:.1f}px; color:#5c6350; font-size:{16*f:.1f}px; font-weight:700; }}
.mini {{ margin-top:{11*f:.1f}px; background:#4a5540; border-radius:{14*f:.1f}px; padding:{11*f:.1f}px {12*f:.1f}px {9*f:.1f}px; }}
.mk {{ font-size:{12*f:.1f}px; font-weight:700; color:#f0a04b; letter-spacing:.08em; text-transform:uppercase; margin-bottom:{7*f:.1f}px; }}
.mr {{ display:flex; align-items:center; gap:{9*f:.1f}px; padding:{5*f:.1f}px 0; border-top:1px solid rgba(255,255,255,.12); font-size:{13.5*f:.1f}px; }}
.mr:first-of-type {{ border-top:0; }}
.mr b {{ color:#f0a04b; font-weight:800; width:{13*f:.1f}px; }}
.mr span {{ color:#fff; font-weight:600; flex:1; }}
.mr i {{ color:#dfe2cc; font-style:normal; font-weight:700; }}
.laatste {{ margin-top:{11*f:.1f}px; background:#4a5540; border-radius:{14*f:.1f}px; padding:{9*f:.1f}px {11*f:.1f}px;
  display:flex; align-items:center; gap:{10*f:.1f}px; }}
.laatste img {{ width:{44*f:.1f}px; height:{38*f:.1f}px; object-fit:cover; border-radius:{9*f:.1f}px; }}
.laatste div {{ flex:1; }}
.laatste b {{ display:block; font-size:{13.5*f:.1f}px; font-weight:700; color:#fff; }}
.laatste span {{ display:block; font-size:{12*f:.1f}px; color:#dfe2cc; margin-top:{2*f:.1f}px; }}
.laatste i {{ font-style:normal; font-size:{11.5*f:.1f}px; font-weight:700; color:#f0a04b; }}
.navbalk {{ margin-top:auto; margin-left:{-17*f:.1f}px; margin-right:{-17*f:.1f}px; padding:{11*f:.1f}px {6*f:.1f}px {15*f:.1f}px;
  background:#293222; display:flex; justify-content:space-around; }}
.nav {{ display:flex; flex-direction:column; align-items:center; gap:{4*f:.1f}px; font-size:{10.5*f:.1f}px; font-weight:700; }}
.nav svg {{ width:{21*f:.1f}px; height:{21*f:.1f}px; }}
"""
    html = f"""<!DOCTYPE html><html><head><meta charset='utf-8'><style>{css}</style></head><body>
<div class='bg'><img src='data:image/jpeg;base64,{zon}'></div><div class='waas'></div><div class='waas2'></div>
<div class='in'>
  <img class='logo' src='data:image/png;base64,{logo}'>
  <h1>Organiseer je<br>eigen <span class='o'>viswedstrijd?</span></h1>
  <p class='sub'>Voor je vereniging, viswater of gewoon met een vaste groep vrienden.
  Je krijgt een eigen omgeving met <b>eigen kaart, loting en klassement</b>.</p>
  <div class='vd'>
    {''.join(f"<div class='r'>{svg(i)}<div><b>{t}</b><span>{u}</span></div></div>" for i,t,u in VOORDELEN)}
  </div>
  <div class='onder'>
    <div class='vw'>{VOORWAARDE}</div>
    <div class='cta'>Kijk op viswedstrijdapp.nl <span>&rarr;</span></div>
  </div>
</div>
<div class='prijs'><span class='v'>Vanaf</span><span class='b'>{PRIJS_GROOT}</span>
  <span class='r1'>{PRIJS_REGEL1}</span><span class='r2'>{PRIJS_REGEL2}</span></div>
{telefoon_html()}
</body></html>"""
    hp = HIER / "_adv.html"; hp.write_text(html, encoding="utf-8")
    uit = HIER / bestandsnaam
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars", f"--screenshot={uit}",
                    f"--window-size={breedte},{hoogte}", "--force-device-scale-factor=1",
                    f"file://{hp.resolve()}"], capture_output=True)
    hp.unlink(); print("geschreven:", uit.name, f"({breedte}x{hoogte})")

bouw(1080, 1080, "advertentie-vierkant.png")
bouw(1080, 1350, "advertentie-staand.png")

# Viswedstrijden · Plas van der Ende

Webapp voor viswedstrijden: digitale loting, stekkeuze op de dieptekaart,
vangstregistratie met foto, live klassement met aftelklok. Gepositioneerd voor
viswedstrijden in het algemeen (niet alleen karper); wordt via kemblinck.nl ook
aangeboden aan verenigingen, viswaterbeheerders en vriendengroepen die zelf
wedstrijden organiseren (doelgroep verbreed 11 jul 2026).

## Werkafspraken

- Alle teksten (UI, docs, commits, antwoorden) in het **Nederlands**.
- **Geen em-dashes** (—) in output; gebruik `|`, `:`, `,`, haakjes of een nieuwe zin.
- Deze repo is **PUBLIEK** (github.com/BivvyBrothers/viswedstrijden): nooit echte
  pincodes, tokens of persoonsgegevens committen. De Supabase-URL en publishable key
  in `docs/config.js` zijn bewust publiek en veilig.
- Commits eindigen met `Co-Authored-By: Claude <naam> <noreply@anthropic.com>`.

## Architectuur

- **Frontend:** statisch, vanilla JS, geen build-stap, geen dependencies.
  Webroot is `docs/` (GitHub Pages, branch main, map /docs).
  Live: https://viswedstrijdapp.nl (CNAME in `docs/CNAME`, DNS bij TransIP).
- **Klanten (migratie wedstrijd_klanten, 14 jul 2026):** tabel
  `wedstrijd.klanten` (slug = tenant-map, naam) + `wedstrijden.klant_id`.
  Elke tenant-omgeving is een klant; `config.js` heeft `const TENANT = '<slug>'`
  en `w_maak_wedstrijd` krijgt `p_klant` mee (oude clients zonder parameter
  vallen terug op nphv). Lichte eerste tenancy-stap voor het beheeroverzicht;
  org-wachtwoord/zones/stek_ring blijven gedeeld tot de volledige migratie.
  Nieuwe tenant = ook een klant-rij inserten (nieuwe_tenant.py print de SQL).
- **Multi-tenant (sinds 11 jul 2026):** elke organisatie krijgt een eigen pad,
  bijv. `/nphv/` (NPHV, Nootdorps Pijnackerse Hengelsportvereniging, Plas van
  der Ende). De root is een keuzepagina (`docs/index.html` + `docs/landing.js`;
  stuurt oude `#/w`- en `#/k`-links door naar /nphv/). GEDEELD op de root:
  app.js, styles.css, iconen, kemblinck-logo. PER TENANT in de eigen map:
  index.html (naam/branding), config.js, kaart.js, manifest.webmanifest
  (start_url/scope ./), sw.js (eigen scope), version.json, instructies.html
  (+ print-pdf). Tenant-index verwijst naar gedeelde assets met absolute paden
  (/app.js). De oude root-sw.js is een self-destruct (unregister + cache wissen).
  DATABASE is nog single-tenant: bij de tweede organisatie krijgen
  instellingen/wedstrijden een tenant-kolom (eigen org-wachtwoord en
  standaard_zones per water) en gaan de w_*-RPC's een p_water-parameter
  meekrijgen vanuit config.js; dat is bewust uitgesteld tot die er is.
- **Backend:** Supabase-project "Samen" (`xyfvkmhkwcjqskxrcfrj`), schema **`wedstrijd`**
  (gedeeld project, LET OP: raak de andere schema's/tabellen daar niet aan).
  Foto's in publieke storage-bucket `wedstrijd-fotos` (max 5 MB, alleen afbeeldingen).
- **API-model:** tabellen hebben RLS aan zonder policies; ALLE toegang loopt via
  security-definer RPC's `w_*` in het public schema. Elke wijziging aan spelregels
  hoort dus in een RPC-migratie, niet in de frontend. Frontend praat via kale
  `fetch` met PostgREST (`/rest/v1/rpc/...`), geen supabase-js.
- **Realtime:** bewust polling (elke 6s `w_get_state`), geen websockets.
- **Klok:** countdown rekent met `server_now` uit `w_get_state` (offset tegen
  Date.now), eindtijd wordt ALTIJD ook server-side afgedwongen in
  `w_registreer_vangst`.

## v2-features (5 jul 2026)

- **Organisatie-gate:** nieuwe wedstrijden alleen met het organisatie-wachtwoord
  (tabel `wedstrijd.instellingen`, check server-side in `w_maak_wedstrijd`/`w_org_check`;
  wijzigen via `w_org_wachtwoord`). Wachtwoord NOOIT in deze repo zetten.
- **Zones:** `wedstrijden.zones` jsonb `[{naam, stekken[]}]`, beheer via `w_admin_zones`
  (alleen tijdens aanmelden), keuze via `w_kies_zone` (1 tik op de kaart selecteert de
  hele zone). Zonder zones werkt `w_kies_stek` zoals voorheen.
- **Teamnaam:** optioneel bij koppels (`teams.team_naam`), weergave "Teamnaam (lid & lid)".
- **Join-first:** deelnemer zonder sessie landt automatisch op de Mijn team-tab.
- **Push:** service worker `docs/sw.js` + VAPID (public key in config.js, private in
  `wedstrijd.instellingen`) + edge function `push-vangst` (custom auth via x-push-secret,
  verify_jwt uit). `w_registreer_vangst` triggert de push via pg_net, best effort.
  Eigen team krijgt geen melding. In-app toast als fallback.
- **Camo-thema:** kleurvariabelen in styles.css heten nog `--blauw-*` maar bevatten
  legergroen; kaartmarkers gebruiken bewust `--kaart-blauw` (leesbaar op het water).

## v3: rollen (6 jul 2026)

- **3 ingangen op de homepagina:** Deelnemer (deelnemerscode, `#/w/CODE`),
  Kijker (kijkcode, `#/k/KIJKCODE`, ziet alleen klok + klassement + push),
  Organisator (org-wachtwoord, `#/org`).
- Elke wedstrijd heeft een **deelnemerscode** (`code`) en **kijkcode** (`kijk_code`),
  uniek over beide kolommen (generator `wedstrijd.nieuwe_code()`).
  `w_get_state_kijker` geeft de deelnemerscode bewust NIET terug.
- **Organisatie-omgeving:** `w_org_wedstrijden(p_wachtwoord)` levert alles incl.
  admin_pin per wedstrijd; "Openen & beheren" zet de pin in sessionStorage en
  navigeert naar de wedstrijd (beheer-tab direct ontgrendeld).
- Klassement (totaal) toont de opbouw per vis; vangsten tonen datum + tijd.

## Domeinbegrippen

- **Stekken:** 96 stuks, nummers 1-100 waarbij **12, 14, 16 en 18 niet bestaan**
  (stuk zuidwest-oever zonder stekken, conform de originele NPHV-kaart; oneven
  13/15/17 bestaan gewoon). Oneven = noord/west-oevers, even = ingang-bank (2-10)
  en zuidoever (20-100).
- **`stek_ring`** (tabel + `STEK_POSITIE` in kaart.js): fysieke volgorde rond de
  plas voor "naast elkaar"-checks bij koppels. Bewuste keuzes: 52-54 (over de
  duiker) telt als aangrenzend; gaten tussen 10-20 en tussen 2-1.
- **Modes:** `individueel` (1 stek per visser) of `koppel` (2 aangrenzende stekken,
  score als team).
- **Rollen:** organisator = pincode per wedstrijd; deelnemer = wedstrijdcode + naam,
  geheim token in localStorage (`team:CODE`). Geen accounts.
- **Klassement:** totaalgewicht (som alle vissen per team) en grootste vis.
  Vangsten tellen direct mee; alleen de organisator corrigeert of verwijdert.

## Kaart

De dieptekaart is nagetekend van de originele NPHV-scan (`Dieptekaart plas.pdf`):
- `tools/shape.py` = oevercontour in 4800px-scanruimte (bron van waarheid)
- `tools/gen_svg.py` = standalone kaart (`plas-van-der-ende-dieptekaart.svg`)
- `tools/gen_kaart_js.py` = interactieve app-kaart, schrijft `docs/kaart.js`
- `tools/zonelaag.json` = vaste zone-indeling (19 zones A-S): grenslijnen + letters
  in viewBox-coordinaten + de zonedefinities. Gegenereerd uit Patricks handgetekende
  lijnen door `tools/gen_zonekaart_def.py` (traceert de foto in `review/zone-lijnen-definitief.jpeg`).
  Dezelfde indeling staat in `wedstrijd.instellingen.standaard_zones` (7 jul 2026).
- kaart.js bevat een laag `#zonelaag` (lijnen + letters) en `ZONE_STANDAARD`;
  app.js toont de laag alleen als de wedstrijd-zones exact overeenkomen met de
  standaard (functie `zonesZijnStandaard`), anders blijft hij verborgen.
- Herkenningspunten op de kaart: manege, schuilhut, container + 3 ingangen,
  De Dobber (clubhuis), TNO-meetstation, woning, brug/duiker.

Kaart wijzigen: pas de tools aan en draai `python3 gen_kaart_js.py` vanuit `tools/`.
`docs/kaart.js` nooit met de hand bewerken (gegenereerd bestand).

## Standaardkaart en nieuwe tenants (12 jul 2026)

- `tools/gen_standaardkaart.py --slug X --stekken 40 --zones 8`: genereert een
  GENERIEKE zonekaart (organische watervorm, stekken op booglengte verdeeld,
  radiale zonegrenzen A-Z) met exact dezelfde interface en markup als de
  NPHV-kaart. Dit is het goedkope-instap-product uit de prijsstrategie.
- `tools/nieuwe_tenant.py --slug X --kort NAAM --volledig "..." [--water "..."]
  [--kaart-van nphv]`: scaffold een complete tenant-map vanaf docs/nphv/
  (index/instructies/sw/manifest/config/version + standaardkaart) en voegt de
  keuzeregel op de rootpagina toe. ELKE vervanging heeft een assert; als het
  NPHV-sjabloon wijzigt, faalt het script luid in plaats van stil.
- LET OP tot de DB-tenancy er is: de server valideert stekken tegen de
  NPHV-`stek_ring`; standaardkaart-tenants kunnen dus nog geen eigen
  stekkeuze/koppelmode draaien. Kijk-demo's en direct geseede data werken wel.

## Demo-omgeving (/demo/, 12 jul 2026)

- Volledige tenant (eerste product van nieuwe_tenant.py) met standaardkaart
  (40 stekken, 8 zones) en een geseede AFGELOPEN voorbeeldwedstrijd
  "Voorjaarswedstrijd (demo)": 12 vissers, 20 vangsten zonder foto.
- Publieke codes: kijkcode `KIJKJE` (knop op /demo/), persoonlijke
  deelnemercode `DEMOJA` (meekijken als visser Jan, deelnemer-scherm + kaart).
  De wedstrijd is afgelopen dus registreren/aanmelden is server-side dicht.
- Demo vernieuwen: seed-SQL opnieuw draaien (delete op kijk_code KIJKJE +
  insert; zie sessie 12 jul of schrijf hem opnieuw), daarna Jan's code weer
  op DEMOJA zetten.

## Vangst delen op social media (v45, 14 jul 2026)

Per vangst een deel-knop (vangsten-feed + Mijn vangsten): `tekenVangst()`
maakt een 1080x1352-afbeelding (Instagram-vriendelijk 4:5) met de vangstfoto
cover-gecropt (of de karper-placeholder bij handmatige invoer), gewicht groot,
visser, wedstrijd + datum en de app-voet. Foto's laden met
crossOrigin='anonymous' (bucket stuurt ACAO *, dus geen canvas-taint).
Alle deel-afbeeldingen (uitslag, seizoen, vangst) hebben sinds v45 een
gedeelde voet `tekenVoet()` met het KARPERLOGO + viswedstrijdapp.nl
(APP_ICOON preload van /icon-192.png). Delen gaat via `deelPng()`
(share-sheet op mobiel = WhatsApp/Instagram/Facebook, anders download).

## Uitslag delen als afbeelding (v41, 14 jul 2026)

Op een AFGELOPEN wedstrijd met vangsten toont het klassement een knop
"Deel de einduitslag" (#deel-rij in beide tenant-indexen; app.js verbergt hem
via renderKlassement). `tekenUitslag()` tekent de top-10 (totaal-klassement,
zelfde tiebreaks via gedeelde helper `klassementRijen()`) + grootste vis op een
canvas in de app-huisstijl met viswedstrijdapp.nl in de voet (gratis reclame in
de groepsapp). `deelUitslag()`: Web Share API met bestand (share-sheet op
mobiel), anders PNG-download. Geen server-kant.

## Seizoensklassement (v42, 14 jul 2026)

Ontwerp + regelonderbouwing: `seizoensklassement-ontwerp.md` (Sportvisunie 2026).
- Tabel `wedstrijd.seizoenen` (naam + regels jsonb) + `wedstrijden.seizoen_id`
  en `wedstrijden.dag_regels` ({"ex_aequo": app|sportvisunie|karper}).
- Regels per seizoen: telling (plaatspunten|totaalgewicht), aftrek (0-20),
  niet_vanger (gemiddelde|vangers_plus_1|max_plus_1), gemist
  (hoogste_plus_1|deelnemers_plus_1), ex_aequo-default. Defaults = Sportvisunie.
- RPC's: w_org_seizoen_maak/wijzig/verwijder/koppel + w_org_seizoenen (org-ww)
  en publiek `w_seizoen_stand(p_code)` (wedstrijd- of kijkcode van een
  gekoppelde wedstrijd; alleen AFGELOPEN wedstrijden tellen; berekent punten,
  aftrek doorgestreept, gemist, tiebreaks; deelnemers gematcht op
  genormaliseerde naam, koppels op het naampaar ongeacht volgorde).
- Client: tabblad Seizoen (ook voor kijkers) verschijnt alleen als de
  wedstrijd bij een seizoen hoort (laadSeizoen na het openen); org-omgeving
  heeft een Seizoenen-kaart + per wedstrijdkaart een seizoen-select en een
  daguitslag(ex-aequo)-select; "Deel de seizoensstand" hergebruikt het
  v41-canvas. Demo: "Demo-competitie 2026" met 3 gekoppelde wedstrijden
  (extra kijkcodes KIJKD2/KIJKD3, niet geadverteerd).
- FASE 2 (bewust later): vak/zone-klassering, naam-aliassen samenvoegen.

## Alleen-lezen-vlag (abonnement verlopen)

`wedstrijd.instellingen.alleen_lezen` (migratie `wedstrijd_alleen_lezen`):
true = `w_maak_wedstrijd` weigert met 'alleen_lezen' (nette fouttekst in
app.js), bestaande wedstrijden blijven bekijkbaar. Nu 1 vlag voor de hele
database; wordt per tenant bij de tenancy-migratie.

## Beheerdersomgeving (v44, 14 jul 2026; alleen Patrick)

Vierde rol naast kijker/deelnemer/organisator: KemblincK-support. VERBORGEN
route `#/beheerder` (geen knop in de UI; werkt in elke tenant en via de root
dankzij landing.js). Eigen `beheerder_wachtwoord` in wedstrijd.instellingen
(migratie `wedstrijd_beheerder`; waarde alleen in DB + Patricks
wachtwoordmanager, NOOIT in deze repo). RPC's: `w_su_overzicht` (stats,
instellingen-status, wedstrijden GEGROEPEERD PER KLANT incl. admin_pin;
klant-tabs in de UI), `w_su_alleen_lezen`,
`w_su_org_wachtwoord` (reset voor organisator die hem kwijt is),
`w_su_wachtwoord` (eigen ww wijzigen; min. 12 tekens); alles via
wedstrijd.su_check met pg_sleep. Client: view-beheerder in beide
tenant-indexen, sessionStorage `suww`, "Openen & beheren" gebruikt de
bestaande pin-flow.

## Release-checklist (multi-tenant, sinds v36)

Bij elke release controleren:
1. `APP_VERSION` in docs/app.js == ELKE tenant-`version.json` (docs/nphv/ en
   docs/demo/; root-version.json bestaat alleen nog voor oude clients en mag meelopen).
2. Elke tenant-map is compleet: index.html, config.js, kaart.js,
   manifest.webmanifest, sw.js, version.json, instructies.html (+ print-pdf).
3. Alle paden in de `SHELL`-lijst van elke tenant-sw.js bestaan ECHT
   (gedeelde assets absoluut: /app.js, /styles.css, iconen; tenant-bestanden
   relatief). Cache-naam is tenant-specifiek (`nphv-shell-*`), NOOIT kaal 'shell'.
4. Elke statische HTML-pagina heeft bewust een eigen meta-CSP
   (instructiepagina's: script-src 'none').
5. Bij wijzigingen aan gedeelde teksten: root- én tenant-instructies bijwerken.
6. Nieuwe tenant: de klant-rij MOET in wedstrijd.klanten staan voordat de
   omgeving live gaat (w_maak_wedstrijd faalt anders met klant_niet_gevonden;
   nieuwe_tenant.py print de insert-SQL).
7. Root-hash-test: `/#/k/KIJKJE` moet in /demo/ landen, `/#/org` in /nphv/
   (landing.js: kale root-hashes zijn legacy-NPHV; nieuwe tenants delen
   ALTIJD links met tenantpad, alleen de demo-kijkcode heeft een mapping).

## Lokaal draaien en testen

- Preview-server "viswedstrijden" in de launch.json van de cowork-map (poort 8642).
- Testwedstrijd in de database: code `EWVNEV`, pin `test1234` (testdata, mag weg).
- Volledige flow testen: wedstrijd aanmaken → 2+ teams aanmelden → loting →
  stekkeuze (check: beurtvolgorde, bezette stek, aangrenzendheid) → tijden verzetten
  met `w_admin_tijden` → vangst registreren → klassement → eindtijd-gate.

## Migraties (Supabase, schema wedstrijd)

`wedstrijd_schema_v1`, `wedstrijd_rpcs_v1`, `wedstrijd_fotos_bucket`,
`wedstrijd_admin_check`, `wedstrijd_fotos_geen_listing`, ...,
`wedstrijd_verwijder_wedstrijd` + `wedstrijd_verwijder_via_storage_api`
(w_org_verwijder_wedstrijd: organisator verwijdert een wedstrijd definitief;
teams/vangsten/push_subs cascaden, foto's via edge function `wis-fotos` met de
Storage API omdat directe deletes op storage.objects geblokkeerd zijn; zelfde
x-push-secret-patroon als push-vangst, best effort via pg_net),
`wedstrijd_analyse_ronde_1` (gewicht 50-50000g server-side, idempotente
vangst-registratie via unieke foto_path, w_admin_kies/w_admin_voeg_vangst/
w_admin_wedstrijd, team verwijderen in elke fase, pg_sleep bij fout org-ww;
vangsten.foto_path is sindsdien nullable: placeholder in de UI),
`wedstrijd_codex_v2_fixes` (team verwijderen geblokkeerd bij vangsten
'team_heeft_vangsten'; idempotentie eist zelfde wedstrijd+team+gewicht+actief
anders 'foto_al_gebruikt'; foto_path-regex gelijk aan wis-fotos.ts).
Nieuwe migraties benoemen als `wedstrijd_<omschrijving>`.
**Werkafspraak:** `review/database.sql` na elke migratie-reeks VERS exporteren
uit de live database (pg_get_functiondef); nooit changelog-blokken aanplakken,
dat gaf in de Codex-v2-review schijn-bevindingen over verouderde definities.
Advisor-warnings "security definer callable by anon" op de `w_*`-functies zijn
by design (de RPC's zijn de publieke API, validatie zit erin).

## Bewuste beperkingen (niet "fixen" zonder overleg)

- Foto's in een publieke bucket, geen rate-limiting, pins niet gehasht (hobby-schaal).
- Geen seizoensklassement; elke wedstrijd staat op zichzelf.
- Deelnemers kunnen eigen vangsten niet wijzigen (alleen organisator).

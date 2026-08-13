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
- `review/database.sql` is de REVIEWBRON, geen herstelscript: functiedefinities
  worden bij elke migratie meegewijzigd, maar het bestand is nooit tegen een
  lege database gedraaid. Herstelbron = de migratiegeschiedenis in Supabase.

## Architectuur

- **Frontend:** statisch, vanilla JS, geen build-stap, geen dependencies.
  Webroot is `docs/` (GitHub Pages, branch main, map /docs).
  Live: https://viswedstrijdapp.nl (CNAME in `docs/CNAME`, DNS bij TransIP).
- **Klanten (migratie wedstrijd_klanten, 14 jul 2026):** tabel
  `wedstrijd.klanten` (slug = tenant-map, naam) + `wedstrijden.klant_id`.
  Elke tenant-omgeving is een klant; `config.js` heeft `const TENANT = '<slug>'`
  en `w_maak_wedstrijd` krijgt `p_klant` mee (oude clients zonder parameter
  vallen terug op nphv). Dit was de eerste tenancy-stap (beheeroverzicht);
  org-wachtwoord en zones volgden 18 jul, de stekring 13 aug. Alles per klant nu.
  Nieuwe tenant = ook een klant-rij inserten (nieuwe_tenant.py print de SQL).
- **Multi-tenant (sinds 11 jul 2026):** elke organisatie krijgt een eigen pad,
  bijv. `/nphv/` (NPHV, Nootdorps Pijnackerse Hengelsportvereniging, Plas van
  der Ende). De root (`docs/index.html` + `docs/landing.js`) is sinds v50 een
  LANDINGSPAGINA in marketing-stijl met een Inloggen-knop; de organisatie-keuze
  staat op `docs/inloggen/index.html` (/inloggen/). landing.js blijft op de
  root staan en stuurt oude `#/w`- en `#/k`-links door naar /nphv/ (/demo/
  voor KIJKJE). `docs/info.html` is een meta-refresh-redirect naar / (oude
  links + kemblinck.nl-kaart); de slug `inloggen` is daarmee gereserveerd,
  nooit als tenant-slug gebruiken. GEDEELD op de root:
  app.js, styles.css, iconen, kemblinck-logo. PER TENANT in de eigen map:
  index.html (naam/branding), config.js, kaart.js, manifest.webmanifest
  (start_url/scope ./), sw.js (eigen scope), version.json, instructies.html
  (+ print-pdf). Tenant-index verwijst naar gedeelde assets met absolute paden
  (/app.js). De oude root-sw.js is een self-destruct (unregister + cache wissen).
  **DATABASE-TENANCY IS AF (18 jul 2026, migraties `wedstrijd_tenancy_stap1`
  t/m `stap4`).** Organisatiewachtwoord, standaardzones en de alleen-lezen-vlag
  staan per klant in `wedstrijd.klant_instellingen`; seizoenen hebben een
  `klant_id`. Elke `w_org_*`-RPC (inclusief verwijderen en seizoensbeheer)
  krijgt `p_klant` uit `config.js` (`const KLANT()` in app.js) en bepaalt de
  klant via `wedstrijd.klant_van_org(p_wachtwoord, p_klant)`. LET OP: p_klant
  is een SELECTOR, geen bewijs; de helper eist dat het wachtwoord bij die klant
  hoort. Zonder p_klant geldt het oude gedrag (terugval op nphv), zodat oude
  PWA-clients blijven werken. Platformbreed blijven in `instellingen`: VAPID,
  push-secret en het beheerderswachtwoord. Een nieuwe klant heeft dus ook een
  rij in `klant_instellingen` nodig (zie release-checklist).
- **Backend:** Supabase-project "Samen" (`xyfvkmhkwcjqskxrcfrj`), schema **`wedstrijd`**
  (gedeeld project, LET OP: raak de andere schema's/tabellen daar niet aan).
  Foto's in publieke storage-bucket `wedstrijd-fotos` (max 5 MB, alleen afbeeldingen).
  **Upload loopt sinds v64 via de edge function `upload-vangstfoto`**
  (kopie in `review/upload-vangstfoto.ts`): die controleert eerst het teamtoken
  of de admin-pin, kiest zelf het pad en uploadt met de service-role sleutel.
  Rate-limit 20 uploads per IP per minuut. **De anon-INSERT-policy op de bucket
  is ingetrokken op 11 aug 2026** (migratie `wedstrijd_fotos_anon_insert_intrekken`),
  ruim drie weken na v64: er staat nu GEEN enkele policy meer op `wedstrijd-fotos`,
  dus schrijven kan alleen nog de edge function (service-role omzeilt RLS) en
  lezen loopt via de public-bucket-URL. Een directe upload met de publieke sleutel
  geeft nu 403 "new row violates row-level security policy". Codex v10 hoog-2 dicht.
- **API-model:** tabellen hebben RLS aan zonder policies; ALLE toegang loopt via
  security-definer RPC's `w_*` in het public schema. Elke wijziging aan spelregels
  hoort dus in een RPC-migratie, niet in de frontend. Frontend praat via kale
  `fetch` met PostgREST (`/rest/v1/rpc/...`), geen supabase-js.
- **Realtime:** bewust polling (elke 6s `w_get_state`), geen websockets.
  **Late antwoorden (v66, na een bug uit v62):** `SESSIE_GEN` hoogt alleen op
  bij een ROUTEWISSEL en bij uitloggen, NOOIT per poll. In v62 kreeg elk
  verzoek een eigen nummer, waardoor een antwoord dat langer dan 6 seconden
  onderweg was door de volgende poll ongeldig werd verklaard: op een traag
  netwerk bleef het scherm daardoor leeg. Verder `STATE_BEZIG`/`ORG_BEZIG` (sla
  een poll over zolang er een verzoek loopt) en een harde timeout van 20s in
  `rpc()` via AbortController, foutcode `geen_verbinding`.
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
  `w_get_state_kijker` geeft de deelnemerscode bewust NIET terug. Wat hij WEL
  teruggeeft: team-ID's, namen, lotnummers, stekken/zones en alle actieve
  vangsten met fotopad. De kijkers-UI toont daarvan alleen klok, klassement en
  seizoen, maar de API-grens is ruimer. **Dat is een keuze, geen omissie**
  (Codex v11 meldde het als lek): het is precies wat op de wedstrijddag aan het
  water openbaar is, en de kijkcode deelt de organisator zelf. Wil je dat ooit
  smaller, dan hoort dat server-side in een aparte projectie, niet in de client.
- **Organisatie-omgeving:** `w_org_wedstrijden(p_wachtwoord)` levert alles incl.
  admin_pin per wedstrijd; "Openen & beheren" zet de pin in sessionStorage en
  navigeert naar de wedstrijd (beheer-tab direct ontgrendeld).
- Klassement (totaal) toont de opbouw per vis; vangsten tonen datum + tijd.

## Domeinbegrippen

- **Stekken:** 96 stuks, nummers 1-100 waarbij **12, 14, 16 en 18 niet bestaan**
  (stuk zuidwest-oever zonder stekken, conform de originele NPHV-kaart; oneven
  13/15/17 bestaan gewoon). Oneven = noord/west-oevers, even = ingang-bank (2-10)
  en zuidoever (20-100).
- **`stek_ring`** (tabel + `STEK_POSITIE` in kaart.js): fysieke volgorde rond het
  water voor "naast elkaar"-checks bij koppels. Bewuste keuzes bij NPHV: 52-54
  (over de duiker) telt als aangrenzend; gaten tussen 10-20 en tussen 2-1.
  **PER KLANT sinds 13 aug 2026** (migraties `stekring_per_klant_stap1/stap2`):
  kolom `klant_id`, primary key `(klant_id, positie)`. Daarvoor was de ring
  globaal en dus de NPHV-nummering, waardoor de demokaart (stekken 1 t/m 40)
  plekken aanbood die de server met `onbekende_stek` weigerde. Dat was de harde
  blokkade voor klant 2. De klant wordt ALTIJD uit de wedstrijd afgeleid
  (`v_w.klant_id`), nooit uit een parameter van de client.
  **De ring moet exact gelijk zijn aan `STEK_POSITIE` in de kaart.js van die
  tenant.** Genereren en controleren: `python3 tools/stekring_sql.py --slug X`
  (met `--check` alleen de samenvatting: aantal stekken, aaneengesloten stukken
  en het maximum aantal koppels). Aangepast per klant: `wedstrijd.max_koppels(klant)`
  en `wedstrijd.valideer_zones(zones, klant)`; die twee zitten in het schema
  `wedstrijd` en zijn niet via PostgREST aanroepbaar, dus hun oude signatuur is
  gedropt. De RPC-signaturen in `public` zijn ONgewijzigd, dus oude PWA-clients
  blijven werken.
- **Modes:** `individueel` (1 stek per visser) of `koppel` (2 aangrenzende stekken,
  score als team).
- **Rollen:** organisator = pincode per wedstrijd; deelnemer = wedstrijdcode + naam,
  geheim token in localStorage (`team:CODE`). Geen accounts.
- **Klassement:** totaalgewicht (som alle vissen per team) en grootste vis.
  Vangsten tellen direct mee; alleen de organisator corrigeert of verwijdert.
- **Levenscyclus (server dwingt af, sinds v66):** opnieuw loten kan NIET meer
  zodra er een actieve vangst is (`reset_niet_mogelijk_vangsten`); een vangst
  wordt geweigerd als de wedstrijd in `stekkeuze` staat en het team nog geen
  stek of zone heeft (`kies_eerst_je_plek`). Bewust NIET afgedwongen: "vangst
  alleen bij status klaar". Een wedstrijd die nooit geloot wordt blijft op
  `aanmelden` staan en dat is een ondersteunde werkwijze (eigen fase-icoon
  sinds v59: LIVE, nog niet geloot).

## Kaart

**Fotokaart-onderlaag (v51, 17 jul 2026):** de NPHV-kaart toont sinds v51 de
ECHTE sonar-dieptekaart als onderlaag: `docs/nphv/dieptekaart.jpg` (2250x1177,
bron "Bodemstructuur kaart 1.png" in de Karperplas-klantmap, zwart ->
#b9dcf2 vervangen op volle resolutie vóór verkleinen). gen_kaart_js.py zet
hem als `<image>` in de SVG, GECLIPT op de vector-oevercontour (fotorand =
vectorrand, fit-restfout onzichtbaar); transform-matrix komt uit de
contour-fit in `KemblincK/Viswedstrijdapp/kaart-proef-tools/` (fit_kaart.py,
IoU 0.93). Bij een nieuwe scan: fit opnieuw draaien en de zes matrix-getallen
in gen_kaart_js.py bijwerken. De oude vector-dieptelagen (C10/C15/C18) staan
nog in de generator als terugval maar worden niet getekend.
`dieptekaart.jpg` zit in de nphv-sw.js SHELL; nieuwe_tenant.py
`--kaart-van nphv` kopieert hem mee.

**3D-weergave (v52):** knop "⛰️ Bekijk de dieptekaart in 3D" onder de
kaart-legenda in docs/nphv/index.html opent `docs/nphv/kaart-3d.jpg`
(3D-render met stekken/zones, uit kaart-proef-tools) via het bestaande
data-groot-lightboxmechanisme in app.js (geen JS-wijziging). Bewust NIET in
de sw-SHELL (laadt on demand). nieuwe_tenant.py stript de knop voor tenants
zonder kaart-3d.jpg en kopieert hem mee bij --kaart-van.

**Startscherm-restyle (v52):** tenant-home in landing-stijl: hero met
eyebrow ("De wedstrijd-app voor aan het water", generiek = scaffold-veilig),
groter logo, rolknoppen als kaarten met icoon-chip (.rol-icoon), titel +
subtekst (.rol-tekst) en chevron (.rol-pijl); markup in BEIDE tenant-indexen
identiek, CSS in styles.css.

De vector-oevercontour is nagetekend van de originele NPHV-scan (`Dieptekaart plas.pdf`):
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
- Sinds 13 aug 2026 heeft elke klant een EIGEN stekring, dus standaardkaart-
  tenants kunnen gewoon stekkeuze en koppelmode draaien. Wel verplicht bij een
  nieuwe tenant: de ring vullen met `tools/stekring_sql.py --slug X`, anders
  geeft elke stekkeuze `onbekende_stek`.

## Demo-omgeving (/demo/, 12 jul 2026)

- Volledige tenant (eerste product van nieuwe_tenant.py) met standaardkaart
  (40 stekken, 8 zones) en een geseede AFGELOPEN voorbeeldwedstrijd
  "Voorjaarswedstrijd (demo)": 12 vissers, 20 vangsten zonder foto.
- Publieke codes: kijkcode `KIJKJE` (knop op /demo/) en deelnemerscode
  `DEMOJA` (= `wedstrijden.code` van de demo-wedstrijd; opent het
  deelnemer-scherm met de kaart). De wedstrijd is afgelopen dus
  registreren/aanmelden is server-side dicht.
- Demo vernieuwen: seed-SQL opnieuw draaien (delete op kijk_code KIJKJE +
  insert), daarna VERPLICHT de codes terugzetten, anders kloppen de
  geadverteerde codes op /demo/ niet meer (gebeurde 16 jul):
  `update wedstrijd.wedstrijden set code='DEMOJA' where kijk_code='KIJKJE';`

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

## Deel-melding na wedstrijd aanmaken (v48, 15 jul 2026)

Na een succesvolle w_maak_wedstrijd toont de organisator-flow een overlay
(#deel-nieuw, buiten de views zoals de lightbox) met deelnemerscode, directe
link en kijkcode + kopieer-knoppen en "Deel de uitnodiging" (navigator.share
met kant-en-klare uitnodigingstekst incl. instructies-link; fallback =
tekst naar klembord). Data in DEEL_NIEUW; overlay blijft staan over de
wedstrijdweergave waarnaar genavigeerd wordt.

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
**Hardening + UI-ronde (v57/v58, Codex-review v9):** globaal-banner boven de
instellingen (alleen-lezen en org-wachtwoord gelden voor ALLE omgevingen tot
de tenancy-migratie), idempotente `w_su_wachtwoord` (migratie
`wedstrijd_su_hardening_v9`) met herhaalveld + toon/verberg, aparte
foutcodes org/beheerder, 15 minuten inactiviteitslimiet, generatieteller +
routechecks tegen late antwoorden, admin-pins standaard gemaskeerd
(waarde uit de state, niet uit data-attributen). Layout: statkaartjes,
klantkiezer (tabs tot 5 klanten, anders een select), zoekveld + filters
(alle/live & komend/afgelopen), compacte wedstrijdrijen met uitklapbare
detailregel, gevaarlijke acties in een apart blok "Toegang en blokkades"
onderaan. Nog open (hardening-ronde bij klant 2): rate-limit vóór de DB op
`w_su_*`, su-login-token, `w_su_klant` met paginering.

## Wedstrijd-iconen in de lijsten (v59, 18 jul 2026)

Idee van Patrick (geinspireerd op de competitietypes van VISDEX): een lange
wedstrijdlijst moet in één oogopslag te scannen zijn. Twee gedeelde helpers
in app.js, gebruikt door ZOWEL `orgWedstrijdKaart` (organisator) als
`suKaart` (beheerder), zodat beide lijsten dezelfde taal spreken:
- `wedstrijdFase(w, nuMs)` geeft `{icoon, klasse, label}` per fase:
  📋 aanmelden open, 🎲 loting bezig, ⏳ wacht op start, 🔴 LIVE,
  ⚠️ LIVE maar nog niet geloot, 🏁 afgelopen. De klasse (`fase-*`) kleurt
  zowel het ronde icoonvlak (`.w-icoon`) als de statuschip.
- `wedstrijdKenmerken(w, seizoenNaam)` geeft chips voor het speltype en de
  extra's: 🎣 individueel / 👥 koppels, 🗺️ zones, 🏅 <seizoensnaam>.
  Elke chip heeft een `title` met de uitleg.
Bij een nieuw speltype (bijv. witvis of lengte-modus) hier een icoon
toevoegen, niet per lijst apart. `SEIZOEN_PER_CODE` bevat sindsdien ook
`naam` (was alleen id + ex).

## UX aan de waterkant (v65, 18 jul 2026)

Uit review v8 (UX-2/9/10), gericht op gebruik met natte handen en fel zonlicht:
- **Kaart heeft twee standen**: "Overzicht" (het hele water past op het scherm,
  `.kaart-houder.passend` zet `min-width` op 0) en "Inzoomen" (de oude 700px
  voor leesbare steknummers). De keuze staat in `localStorage.kaartzoom`.
- **Tabbalk wrapt onder 560px** in twee rijen in plaats van horizontaal
  scrollen; geen half zichtbare tab meer.
- **Zwevende hoofdactie** `#snel-vangst`: alleen voor een deelnemer met een
  team, tijdens een LOPENDE wedstrijd (`fase() === 'live'`), en niet op de
  vangsten-tab zelf. `renderSnelVangst()` draait bij elke render en bij elke
  tabwissel.
- **Landing**: directe demo-links per rol (kijker `/demo/#/k/KIJKJE`,
  deelnemer `/demo/#/w/DEMOJA`).

## Wedstrijd als sjabloon (v67, 13 aug 2026)

Knop **📋 Als sjabloon** op elke wedstrijdkaart in de organisatie-omgeving
(`data-org-sjabloon`). `vulSjabloon(code)` vult het formulier Nieuwe wedstrijd
met naam, type, maximum, regels en de DUUR van de bronwedstrijd; de datum
schuift per hele week door tot de eerstvolgende toekomstige datum, zodat
dezelfde weekdag en tijd blijven staan. Had de bron een seizoen, dan wordt de
nieuwe wedstrijd na het aanmaken automatisch aan hetzelfde seizoen en dezelfde
dagregel gekoppeld (`w_org_seizoen_koppel`); mislukt dat, dan blijft de
wedstrijd gewoon bestaan en zegt een toast dat het seizoen handmatig moet.
Nooit overgenomen: deelnemers, vangsten, codes, pin, loting.

Boven het formulier verschijnt `#nw-sjabloon` met de bron en een
leegmaak-knop. Dat is bewust opdringerig: een sjabloon dat je gedachteloos
indient geeft een wedstrijd met de regels en tijden van vorig seizoen.

`w_org_wedstrijden` geeft sinds deze versie ook `regels` terug (alleen een
extra JSON-veld, geen signatuurwijziging, dus oude clients merken niets).

## Offline wachtrij voor vangsten (v68, 13 aug 2026)

Derde voorstel uit het Codex-featureadvies. Een vangst gaat EERST duurzaam in
IndexedDB (`vwa-wachtrij`, store `vangsten`, keyPath `id`) en pas daarna naar de
server. Tot v67 leefde de poging in een gewone variabele: app sluiten of
herladen betekende alles kwijt, terwijl juist aan het water het bereik wegvalt.

- `wachtrijZet/Alles/Weg` zijn dunne wrappers om IndexedDB. Mislukt het openen
  (privémodus, oude browser), dan valt het formulier terug op de oude directe
  weg, zodat de app nooit slechter werkt dan voorheen.
- Het item bewaart `code`, `gewicht_gram`, de gecomprimeerde `blob`,
  `gemaakt_op` en na een geslaagde upload het `pad`. **Het teamtoken staat er
  bewust NIET in**; dat wordt bij verzenden vers uit localStorage gehaald.
  Doordat het pad bewaard blijft, uploadt een retry niet opnieuw en kan de
  registratie niet dubbel (de RPC is idempotent op `foto_path`).
- `verstuurWachtrij()` loopt de rij op volgorde af. Bij een NETWERKfout stopt
  hij (volgorde behouden, later opnieuw). `wedstrijd_afgelopen` zet het item op
  `te_laat`; de definitieve serverfouten uit `WACHTRIJ_DEFINITIEF` zetten het op
  `geweigerd` met de vertaalde melding. Beide blijven staan tot de gebruiker ze
  wegtikt, zodat een vangst nooit stil verdwijnt.
- Aangeroepen bij: openen van een wedstrijd, elke 5e poll (30s), terugkeren naar
  de voorgrond, en het `online`-event. **Bewust geen Background Sync**: op
  iPhone niet betrouwbaar beschikbaar.
- De strook `#wachtrij` staat boven het registratieformulier en toont per item
  wat er staat te wachten, met "nu proberen" of "verwijderen".

Getest met Chrome DevTools-netwerkemulatie: offline blijft het item staan
(status `wacht`, geen upload geprobeerd), en zodra het `online`-event vuurt
pakt de app hem uit zichzelf op, uploadt de foto en registreert.

## Documentatie-oppervlakken (WERKAFSPRAAK sinds 15 jul 2026)

Bij ELKE nieuwe feature of gedragswijziging die gebruikers raakt worden ALLE
documentatie-oppervlakken in dezelfde sessie bijgewerkt (afspraak Patrick;
zie ook feedback_docs_consequent.md in de memory). De lijst:

1. `docs/index.html` | DE landingspagina in marketing-stijl (root, sinds v50;
   was v49 nog info.html): hero "Loot. Vis. Win." met Inloggen-knop,
   eyebrow-secties, telefoon-mockups met demo-screenshots uit
   `docs/schermen/`, privacy-blok, FAQ. Bij zichtbare UI-wijzigingen de
   screenshots verversen met **`tools/mobiel_screenshot.mjs`** (CDP +
   `mobile: true`, 390x844 @2x = 780x1688, verhouding 1:2,16). NIET met
   `chrome --headless --screenshot --window-size`: zonder mobiele emulatie
   negeert Chrome de viewport-meta, rendert het de pagina op schermbreedte en
   levert het een beeld met te grote tekst, een halve tabbalk en afgekapte
   kolommen | precies daarom leken de eerste mockups (860x1440, 1:1,67) op
   tablets. Bronnen: klassement = /demo/#/k/KIJKJE, home = /demo/, kaart = de
   ECHTE NPHV-dieptekaart via `/nphv/#/w/499QWP?t=<teamtoken uit de DB>`
   (testwedstrijd "Voorjaarswedstrijd", klik "Kaart" + "Inzoomen"). Op die
   kaartopname `#topcode` leegmaken (de wedstrijdcode geeft toegang tot de
   deelnemerslijst) en vanaf scrollTop 0 fotograferen, zodat "Loting & volgorde"
   met de deelnemersnamen NIET in beeld komt.
   `docs/info.html` is alleen nog een redirect naar /.
2. `docs/inloggen/index.html` | inlogpagina met de organisatie-keuze
   (nieuwe tenants komen hier als kaart bij; nieuwe_tenant.py doet dat)
3. `docs/nphv/index.html` + `docs/demo/index.html` | meta descriptions
4. `docs/instructies.html` + `docs/nphv/instructies.html` +
   `docs/demo/instructies.html` | intro-zin met de mogelijkheden
5. `beginscherm-a4.html` -> REGENEREREN: `beginscherm-instructie.pdf/.png` +
   kopie naar `docs/instructies-print.pdf` + `docs/nphv/instructies-print.pdf`
   (headless Chrome --print-to-pdf, PNG via pymupdf)
6. `prijzenblad-a4.html` (feature-chips) -> REGENEREREN: `prijzenblad.pdf/.png`
7. `draaiboek-wedstrijddag.md` | organisator-draaiboek
8. `README.md` | repo-omschrijving
9. **kemblinck.nl** (repo `KemblincK/Bedrijf/site/`): Viswedstrijden-productkaart
   (product__desc + product__info); na akkoord direct pushen (vaste afspraak)
10. Deze CLAUDE.md + de project-memory
11. **og/social-meta (sinds v49):** elke statische HTML-pagina heeft
    og:title/og:description (spiegelen title + meta description: bij
    tekstwijziging BEIDE bijwerken), og:url (absolute URL), og:image
    (https://viswedstrijdapp.nl/og.png, 1200x630) en twitter:card.
    Nieuwe pagina = zelfde blok toevoegen; `docs/og.png` staat in de
    huisstijl (bron: og-image.html-patroon, headless screenshot 1200x630).
    nieuwe_tenant.py vervangt de og-tags automatisch mee (asserts).

De demo-omgeving is zelf ook documentatie: nieuwe zichtbare features waar
mogelijk in de demo laten zien (zoals de demo-competitie).

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
6. Nieuwe tenant: de klant-rij MOET in wedstrijd.klanten staan én een rij in
   wedstrijd.klant_instellingen (eigen organisatiewachtwoord, eventueel
   standaardzones) voordat de omgeving live gaat; anders faalt inloggen met
   org_wachtwoord_onjuist en aanmaken met klant_niet_gevonden.
   nieuwe_tenant.py print beide insert-statements. **Daarnaast VERPLICHT: de
   stekring van die klant vullen** (`python3 tools/stekring_sql.py --slug X`),
   anders geeft elke stekkeuze `onbekende_stek`. Controleer met `--check` dat
   het aantal stekken en het maximum aantal koppels klopt met de kaart.
7. Root-hash-test: `/#/k/KIJKJE` moet in /demo/ landen, `/#/org` in /nphv/
   (landing.js: kale root-hashes zijn legacy-NPHV; nieuwe tenants delen
   ALTIJD links met tenantpad, alleen de demo-kijkcode heeft een mapping).
8. Bij features: de documentatie-oppervlakken-lijst hierboven volledig langslopen.

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

- Foto's in een publieke bucket; pins niet gehasht (hobby-schaal). Uploads
  lopen sinds v64 wel via de edge function met rate-limit, en sinds 11 aug is
  de directe schrijfroute dicht.
- Deelnemers kunnen eigen vangsten niet wijzigen (alleen organisator).
- De kijkcode geeft via de API meer terug dan de kijkers-UI toont (zie v3:
  rollen). Keuze, geen omissie.
- Tijden worden uitgelegd in de tijdzone van het TOESTEL van de organisator.
  Bij Nederlandse klanten geen probleem; een tenant-tijdzone staat op de
  backlog.
- Vangst registreren kan ook in een wedstrijd die nooit geloot is (status
  `aanmelden`). Dat is bewust: informele wedstrijden zonder loting moeten
  gewoon werken.

## Speltypen: pas bouwen bij een concrete klantvraag (besluit Patrick, 13 aug 2026)

Witvis-modus, lengte-modus (cm) en een algemene puntenformule voor aantallen of
soorten stonden op de backlog. Ze gaan er NIET in tot een betalende klant er
concreet om vraagt. Reden (Codex-featureadvies v11, door Patrick bevestigd): de
hele codebase rekent in grammen en "grootste vis", en een tweede scoremodel
raakt klassement, seizoen, deelafbeelding, kaart en export tegelijk. Zolang
niemand het vraagt, is het gok-scope die de rest vertraagt. Op het moment dat
er een klantvraag komt, kunnen we het alsnog inbouwen.

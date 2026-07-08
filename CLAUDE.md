# Viswedstrijden · Plas van der Ende

Webapp voor karperwedstrijden: digitale loting, stekkeuze op de dieptekaart,
vangstregistratie met foto, live klassement met aftelklok.

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
  Live: https://viswedstrijd.kemblinck.nl (CNAME in `docs/CNAME`, DNS bij TransIP).
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

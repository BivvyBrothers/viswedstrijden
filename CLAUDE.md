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

## Domeinbegrippen

- **Stekken:** 96 stuks, nummers 1-100 waarbij **12-18 niet bestaan** (stuk oever
  zonder stekken, conform de originele NPHV-kaart). Oneven = noord/west-oevers,
  even = ingang-bank (2-10) en zuidoever (20-100).
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
`wedstrijd_admin_check`, `wedstrijd_fotos_geen_listing`.
Nieuwe migraties benoemen als `wedstrijd_<omschrijving>`.
Advisor-warnings "security definer callable by anon" op de `w_*`-functies zijn
by design (de RPC's zijn de publieke API, validatie zit erin).

## Bewuste beperkingen (niet "fixen" zonder overleg)

- Foto's in een publieke bucket, geen rate-limiting, pins niet gehasht (hobby-schaal).
- Geen seizoensklassement; elke wedstrijd staat op zichzelf.
- Deelnemers kunnen eigen vangsten niet wijzigen (alleen organisator).

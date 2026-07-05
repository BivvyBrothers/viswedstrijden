# Viswedstrijden · Plas van der Ende

Webapp voor karperwedstrijden op de Plas van der Ende: digitale loting, stekkeuze op de
interactieve dieptekaart, vangstregistratie met foto en een live klassement.

## Structuur

```
Viswedstrijden/
├── plas-van-der-ende-dieptekaart.svg   nagetekende dieptekaart (standalone, voor hergebruik)
├── plas-van-der-ende-dieptekaart.png   hoge-resolutie versie (4600x2980)
├── docs/                                de webapp (statisch, geen build-stap)
│   ├── index.html
│   ├── styles.css
│   ├── app.js                           alle logica (vanilla JS, geen dependencies)
│   ├── config.js                        Supabase-URL + publishable key (publiek, veilig)
│   └── kaart.js                         gegenereerd: interactieve kaart + stekring
└── tools/
    ├── shape.py                         oevercontour (4800px-scanruimte)
    ├── gen_svg.py                       genereert de standalone dieptekaart-SVG
    └── gen_kaart_js.py                  genereert docs/kaart.js
```

Kaart aanpassen: bewerk `tools/shape.py` of de generatorscripts en draai
`python3 gen_kaart_js.py` vanuit de tools-map.

## Backend (Supabase)

Draait gratis mee in het bestaande project **Samen** (`xyfvkmhkwcjqskxrcfrj`), volledig
gescheiden in schema **`wedstrijd`** + storage-bucket **`wedstrijd-fotos`** (publiek, max
5 MB, alleen afbeeldingen). Migraties: `wedstrijd_schema_v1`, `wedstrijd_rpcs_v1`,
`wedstrijd_fotos_bucket`, `wedstrijd_admin_check`, `wedstrijd_fotos_geen_listing`.

Tabellen (RLS aan, geen policies; alle toegang via RPC's):
- `wedstrijden` : code, naam, mode (individueel/koppel), start/eind, status, admin_pin
- `teams`       : deelnemers/koppels, geheim token, lotnummer, gekozen stekken
- `vangsten`    : gewicht (gram), foto-pad, status (actief/verwijderd)
- `stek_ring`   : fysieke volgorde van de 96 stekken rond de plas (voor "naast elkaar")

RPC's (public schema, security definer, alle validatie server-side):
- `w_maak_wedstrijd`, `w_get_state`, `w_join`, `w_mijn_team`
- `w_start_stekkeuze` (loting), `w_kies_stek` (beurtvolgorde + bezet + aangrenzend afgedwongen)
- `w_registreer_vangst` (alleen tussen start- en eindtijd, server-klok)
- beheer: `w_admin_check`, `w_admin_vangst`, `w_admin_reset_loting`, `w_admin_tijden`,
  `w_admin_verwijder_team`

## Beveiligingsmodel

- Deelnemers: wedstrijdcode + naam, geen accounts. Elke deelname krijgt een geheim token
  (localStorage); registreren/stek kiezen kan alleen met dat token.
- Organisator: pincode per wedstrijd (gekozen bij aanmaken, sessionStorage).
- Eindtijd is hard: de server weigert registraties na de eindtijd, wat de klant ook toont.
- Steknummers 12-18 bestaan niet (stuk oever zonder stekken, conform de originele kaart).
- Bekende beperkingen (bewust, hobby-schaal): foto's staan in een publieke bucket,
  geen rate-limiting, pins niet gehasht.

## Lokaal draaien

Preview-server "viswedstrijden" in `.claude/launch.json` (poort 8642), of een willekeurige
statische server op de `docs/`-map.

## Publiceren

De site is statisch: op GitHub Pages zetten volstaat (repo met de inhoud van `docs/`).
Werkt ook op elke andere statische host. Na publicatie: niets configureren, config.js
bevat alleen publieke gegevens.

## Testwedstrijd

Code `EWVNEV` (pin `test1234`) staat in de database met testdata: 2 koppels, gekozen
stekken en 3 vangsten. Kan als demo dienen of verwijderd worden.

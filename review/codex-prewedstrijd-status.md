# Status Codex pre-wedstrijd review (31 aug 2026, voor de Carpclassic 12 sep)

Review: `codex-prewedstrijd-uit.md`. Alle claims eerst tegen de echte code
geverifieerd; alle zeven hoge bevindingen bleken echt.

## Gefixt in v79 + migratie `wedstrijd_reset_gate_start`

| # | Ernst | Fix |
|---|---|---|
| 1 | hoog | wachtrij-item bewaart `team_id`+`team_naam`; versturen alleen als de actieve sessie hetzelfde team is, anders wachten met uitleg in de strook. Browsergetest (item van een ander team bleef staan, eigen item ging door) |
| 2 | hoog | late-RPC: alleen echte validatiefouten worden `te_laat`; storing = later opnieuw; `foto_al_gebruikt` = antwoord was al aangekomen, item weg |
| 3 | hoog | `upload_mislukt`/5xx niet meer vertaald naar `ongeldige_foto`; niet definitief, dus retry |
| 4 | hoog | `kies_eerst_je_plek` uit `WACHTRIJ_DEFINITIEF`. Browsergetest: vangst zonder plek bleef wachten en kwam na plek-toewijzing vanzelf door |
| 5 | hoog | indienmoment vastgelegd vóór fotocompressie; client-gate van 15s voor de eindtijd weg (server + late-pad beslissen) |
| 6 | hoog | directe route (geen IndexedDB) hergebruikt het fotopad bij een retry van dezelfde vangst: idempotentie kan niet meer omzeild raken |
| 7 | hoog | migratie: `w_admin_reset_loting` weigert na de starttijd (`reset_niet_na_start`) en ook bij vangsten op `wacht`. Getest: vóór start ok, na start geweigerd |
| 10 | middel | home-login: storing geeft een nette melding in plaats van doorvallen naar "wedstrijd niet gevonden" |
| 11 | middel | teamcodes-cache sleutelt op de team-id's, niet op het aantal |

## Bewust NIET gefixt vóór 12 sep (backlog)

- **6b (client_id database-hard)**: de padhergebruik-fix dekt het praktisch; een
  unieke kolom + RPC-signatuurwijziging is te ingrijpend vlak voor de wedstrijd.
- **8 (tiebreak `gevangen_op` vs `created_at`)**: de feitelijke regel is
  "vroegst geregistreerd"; alleen relevant bij exact gelijk gewicht ÉN een
  goedgekeurde late vangst. Keuze na de wedstrijd maken.
- **9 (nulvangers onzichtbaar in dagklassement)**: raakt ook de
  deelafbeeldingen; te veel oppervlak vlak voor de wedstrijd.
- **12 (`w_admin_tijden` vrij aanpasbaar)**: bewuste flexibiliteit voor de
  organisator; het draaiboek is de waarborg.
- **13 (naam-race op hoofdletters)**: verwaarloosbaar risico.

## Waar Codex naast zat of te voorzichtig was

- Niets wezenlijks; de review was accuraat. De "niet kunnen verifiëren"-lijst
  klopte ook: de kop van database.sql was verouderd (nu bijgewerkt) en de
  capaciteit/live-data heb ik zelf read-only geverifieerd (19 zones, max 15,
  9 aanmeldingen = 7 loteenheden; duo-paren gezond).

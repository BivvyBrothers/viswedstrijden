# Status Codex pre-wedstrijd review 3 (4 sep 2026, tegenlezing van v80/v81)

Review: `codex-prewedstrijd3-uit.md` (7 punten). Verwerkt vóór de push van v81.

| # | Ernst | Besluit |
|---|---|---|
| 1 | hoog | GEFIXT: upload-timeout dekt nu ook het lezen van het antwoord (`r.json()` binnen dezelfde try/finally) |
| 2 | hoog | BEWUST NIET: zonder Web Locks (alleen heel oude browsers) blijft het dubbel-venster-risico; `client_id` database-hard blijft backlog |
| 3 | hoog | GEFIXT: geen automatische reload zolang het vangstformulier gevuld is of verwerkt wordt (`FORMULIER_BEZIG`) |
| 4 | hoog | BEWUST NIET: race tussen `w_admin_wis_plek` en een registratie op precies dezelfde seconde; gevolg is een vangst bij een team zonder plek, wat de organisator direct herstelt. De fix raakt `w_registreer_vangst`, de meest kritieke RPC, een week voor de wedstrijd |
| 5 | hoog | BEWUST NIET: laatkomer mag tot de eindtijd (zie statusdoc ronde 2); deur dicht via het maximum |
| 6 | middel | GEFIXT: edge function v4 behandelt 408/425/429 als storing (503) i.p.v. 403 |
| 7 | middel | GEFIXT: verbindingsbanner verdwijnt bij elke routewissel |

Codex bevestigde: de races tussen `w_join` (laatkomer), `w_start_stekkeuze` en
`w_kies_zone`, inclusief `max(lot_nummer)+1` en de capaciteitscheck, zijn door
de wedstrijdlock correct geserialiseerd.

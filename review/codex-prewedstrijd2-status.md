# Status Codex pre-wedstrijd review 2 (4 sep 2026, Carpclassic 12 sep)

Review: `codex-prewedstrijd2-uit.md`. Elke claim tegen de code geverifieerd.

## Gefixt (v81 + migratie wedstrijd_admin_wis_plek + edge function v3)

| # | Ernst | Wat |
|---|---|---|
| A2 | hoog | browserlock (`navigator.locks`) om de wachtrij: twee vensters kunnen niet meer hetzelfde item tegelijk uploaden |
| A3 | hoog | upload-timeout 60s via AbortController; netwerkfout/timeout = `upload_mislukt` (retry) |
| A4 | hoog | edge function: storing bij de autorisatie-RPC geeft 503 `upload_mislukt` i.p.v. 403 `geen_toegang` (live getest: fout token nog steeds 403, goede pin 200) |
| A7 | middel | home-login: elke fout is een storing, geen doorval meer |
| B1 | hoog | versie: automatisch vernieuwen bij een nieuwere `version.json` (één poging per versie, niet tijdens typen of verzenden) |
| B3 | middel | `w_admin_wis_plek` + Beheer-knop "plek wissen": verkeerde toewijzing per team herstelbaar, ook na de start |
| B4 | middel | indienmoment met de servergecorrigeerde klok (`nu()`) |
| B5 | middel | deelafbeelding tot 16 rijen (13 deelnemers passen) |
| B6 | hoog | verbindingsbanner met tijdstip van de laatste goede stand; draaiboek: papieren noodplan voor de loting |

## Bewust anders of niet gedaan

- **A1 (laatkomer tot de eindtijd)**: bewust open gelaten. Alleen wie de
  deelnemerscode heeft kan aanmelden (dat was vóór de loting ook al zo), elke
  nieuwe deelnemer staat direct zichtbaar in Beheer en de lotinglijst, en de
  organisator sluit de deur door het maximum op het huidige aantal te zetten
  (draaiboek). Een 09:15-laatkomer moet er gewoon in kunnen.
- **A2b (client_id database-hard)**: blijft backlog; de lock plus padhergebruik
  dekken het praktisch.
- **A5 (oude wachtrij-items zonder team_id)**: er zijn geen echte items van
  vóór v79 (de Carpclassic is nog niet begonnen). Backlog.
- **A6 (resetgate omzeilbaar via starttijd)**: organisator-only en bewust
  twee stappen. Backlog.
- **B laag (push-tag/TTL)**: backlog.
- **Nulvangers in de deelafbeelding**: bewust niet (raakt klassement-semantiek);
  de volledige lijst staat in de app.

## Nog een vondst buiten Codex om

- Demo-klant had de 19 NPHV-zones als `standaard_zones` bij een 8-zone-kaart;
  rechtgezet in `klant_instellingen`.

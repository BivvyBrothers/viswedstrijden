# Codex-review v5: verwerkingsstatus (14 jul 2026, app v43)

Alle 8 bevindingen verwerkt (0x P0, 4x P1, 4x P2). Serverfixes in migraties
`wedstrijd_codex_v5_fixes` + `wedstrijd_seizoen_karper_grootste_vis`, alle
drie met het reproductiescenario van de reviewer server-side bewezen.

| # | Bevinding | Status |
|---|---|---|
| P1-1 | database.sql faalde op lege database (index vóór wedstrijden-tabel) | **GEFIXT**: `wedstrijden_seizoen_idx` staat nu direct na de wedstrijden-tabel; de seizoenen-tabel stond al vóór wedstrijden (FK-volgorde klopt). NB: draaien op een schone Postgres blijft onmogelijk op deze Mac (geen psql/docker, bekende beperking); volgorde is handmatig geverifieerd. |
| P1-2 | Karper-tiebreak woog de grootste vis niet mee | **GEFIXT**: karper-order is nu `gewicht desc, aantal desc, grootste desc, t_grootste asc`. Getest met exact het scenario van de reviewer (A: grootste 12 kg om 11:00 vs B: grootste 10 kg om 10:00 → A wint). Interpretatie expliciet vastgelegd in seizoensklassement-ontwerp.md: eerst gewicht van de grootste vis, dan pas het tijdstip. |
| P1-3 | Deelafbeelding einduitslag verloor gedeelde plaatsen | **GEFIXT**: tekenUitslag gebruikt nu dezelfde rangbepaling als de tabel (zelfde sleutel `totaal\|grootste\|tijd`, gedeeld rangnummer met doortellen). |
| P1-4 | laadSeizoen kon stale data in de verkeerde wedstrijd zetten | **GEFIXT**: code-capture + guard; late responses van een vorige route worden genegeerd (zowel succes- als foutpad). |
| P2-5 | Seizoensstand ververste niet mee | **GEFIXT**: de wedstrijd-poll ververst de seizoensstand 1x per minuut (alleen als er al een seizoen is), met de stale-guard uit P1-4. |
| P2-6 | Org-poll kon open seizoen-selects weg-renderen | **GEFIXT**: renderOrg slaat over zolang de focus in een `.org-seizoen`-element staat (zelfde patroon als de bestaande data-scherp-guard). |
| P2-7 | Dubbele FOUTEN-key wedstrijd_afgelopen | **GEFIXT**: `w_push_subscribe` geeft nu een eigen code `meldingen_gesloten` (server-side getest op de demo); de dubbele key is weg en beide teksten bestaan naast elkaar. |
| P2-8 | Ongeldige aftrek gaf rauwe cast-error | **GEFIXT**: `seizoen_regels_check` valideert aftrek eerst als tekst (`^[0-9]{1,2}$`) en cast daarna; `{"aftrek":"abc"}` geeft nu netjes 'ongeldige_regels' (getest). |

Extra, op verzoek van Patrick: alle punten uit v2 t/m v4 zijn nagelopen in de
huidige code (tenant-cachenamen + Promise.allSettled, root-self-destruct wist
alleen 'shell', landing token- en KIJKJE-afhandeling, CSP's op alle
instructiepagina's, scaffold-escaping + tmp-dir + slug-validaties,
pushknop-gedrag) en staan allemaal nog overeind; versies overal gelijk (43).

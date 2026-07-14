# Codex-review v6: verwerkingsstatus (14 jul 2026, app v47)

Alle 4 bevindingen verwerkt (0x P0, 1x P1, 3x P2). De P1-serverfix is met de
drie relevante scenario's bewezen (migratie `wedstrijd_klant_niet_gevonden`).

| # | Bevinding | Status |
|---|---|---|
| P1-1 | Onbekende tenant-slug viel stil terug op nphv | **GEFIXT**: alleen NULL/lege p_klant (oude gecachte clients) valt nog op nphv terug; een niet-lege onbekende slug geeft 'klant_niet_gevonden'. Getest: 'hsvx' faalt, null -> nphv, 'demo' -> demo. Nieuwe fouttekst voor de organisator ("omgeving nog niet gekoppeld aan een klant, neem contact op") en release-checklist-stap: klant-rij MOET bestaan voor livegang van een tenant. |
| P2-2 | Uitloggen liet pins achter in memory en verborgen DOM | **GEFIXT**: `wisSuScherm()` leegt SU_DATA/SU_KLANT, de stats/instellingen/wedstrijden-DOM en alle wachtwoordvelden; wordt aangeroepen bij uitloggen (samen met het wissen van suww) en bij het verlaten van de #/beheerder-route (suww blijft dan bewust geldig binnen de sessie). |
| P2-3 | Vangst delen kon blijven hangen bij een foto die nooit laadt | **GEFIXT**: `laadFoto()` heeft een 12s-timeout die naar dezelfde placeholder/fout-flow rejectt; de deel-knop komt altijd weer vrij. |
| P2-4 | Logo-voet niet gegarandeerd op de eerste deelactie | **GEFIXT**: `APP_ICOON_KLAAR`-promise + `wachtOpVoetLogo()` (race met 1,5s) wordt vóór elke deelactie (uitslag/seizoen/vangst) ge-await, zodat het logo er vrijwel altijd op staat en delen nooit blijft hangen als het icoon onbereikbaar is. |

De expliciete goedkeuringen uit de review zijn genoteerd: su_check sluitend
(ook bij NULL-wachtwoord in de database), alle vier w_su_*-RPC's gecheckt,
beheer-UI escapet DB-strings, geen wachtwoord-lekkage naar URL/DOM/logs,
oude clients blijven werken op de nieuwe w_maak_wedstrijd, klant-tabs en
zonder_klant-waarschuwing correct, lightbox onaangetast, versies gelijk.

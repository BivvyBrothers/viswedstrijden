# Codex-review v4: verwerkingsstatus (12 jul 2026, app v40)

Alle 5 bevindingen verwerkt. De P0 was een echte vondst: push-subscribe was
inderdaad het enige publieke schrijfvlak dat open bleef op afgelopen
wedstrijden, precies op de wedstrijd waar we publiek codes van delen.

| # | Bevinding | Status |
|---|---|---|
| P0-1 | Publieke demo-code kon onbeperkt push_subs vullen | **GEFIXT** (migratie `wedstrijd_push_afgelopen_dicht`): `w_push_subscribe` weigert met 'wedstrijd_afgelopen' zodra `now() > eind_ts`, direct na de wedstrijd_niet_gevonden-check. Server-side getest: subscribe op KIJKJE wordt geblokkeerd. Bestaande demo-subscriptions opgeruimd (0 over). Client: pushknop en iOS-tip verborgen bij fase 'voorbij', BEHALVE voor wie nog geabonneerd is (die houdt de uitzet-knop); nieuwe fouttekst 'wedstrijd_afgelopen' in FOUTEN. |
| P1-2 | Scaffold zette tenantnamen ongescapet in HTML en JSON | **GEFIXT**: `html.escape(quote=True)` voor alle namen in HTML-contexten; het manifest gaat nu via `json.loads`/`json.dumps` (ruwe strings, geldige JSON gegarandeerd) met sleutel-asserts op het sjabloon; post-check valideert de gegenereerde manifest-JSON en dat alle 7 tenant-bestanden bestaan en niet leeg zijn. Getest met `--kort 'HSV "De Plas"' --volledig 'H&S Hengelsport <test>'`: manifest geldige JSON, HTML netjes ge-escaped, rootregel ook. |
| P1-3 | Root-hashlinks gingen blind naar /nphv/ | **GEFIXT** (pragmatische variant): landing.js documenteert nu expliciet dat kale root-hashes LEGACY-NPHV zijn (nieuwe tenants delen altijd links met tenantpad) en de publieke demo-kijkcode `#/k/KIJKJE` krijgt een eigen mapping naar /demo/. Getest: `/#/k/KIJKJE` landt in /demo/ met werkende kijker-view; `/#/org` landt nog in /nphv/. Release-checklist uitgebreid met deze test. Structurele tenant-scoping van codes komt met de DB-tenancy. |
| P2-4 | gen_standaardkaart.py valideerde --slug niet standalone | **GEFIXT**: zelfde slug-regels als het scaffold (alfanumeriek + lowercase) plus een realpath-check dat het doel onder docs/ blijft. |
| P2-5 | Scaffold kon halve tenant-mappen achterlaten | **GEFIXT**: bouwt nu in `docs/.tmp-<slug>` en hernoemt pas na alle stappen en post-checks; bij elke fout wordt de tmp-map opgeruimd. Kaartgenerator wordt geimporteerd (schrijft in de tmp-map) in plaats van als subprocess. Faalt de rootregel-stap na de rename, dan zegt de foutmelding expliciet dat de tenant-map WEL bestaat. |

Versie 39 → 40 (app.js + 3 version.json's). `review/database.sql` bijgewerkt met
de verse `w_push_subscribe`-definitie. De expliciete goedkeuringen uit de review
(SHELL-paden, cache-namen, manifest-scope, DOM-elementen, kaart-interface,
demo effectief alleen-lezen voor wedstrijdacties, alleen_lezen-guard op de
juiste plek) zijn genoteerd; de kanttekening dat directe storage-upload niet
aan eind_ts gekoppeld is blijft onder de bewuste beperkingen vallen.

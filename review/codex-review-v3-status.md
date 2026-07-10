# Codex-review v3: verwerkingsstatus (11 jul 2026, app v36)

Alle 6 bevindingen verwerkt. Bevinding 1 was een echte misser: de bedoelde
sw-aanpassing was destijds stilletjes niet doorgekomen (tekst-replace zonder
assert); precies daarom is deze review-ronde waardevol geweest.

| # | Bevinding | Status |
|---|---|---|
| P0-1 | Tenant-worker precachete niet-bestaande paden | **GEFIXT**: SHELL bevat nu exact de echte URL's (tenant-bestanden relatief, gedeelde assets absoluut: /app.js, /styles.css, iconen, logo, plus instructies.html). Precache per asset via Promise.allSettled zodat één misser de rest niet blokkeert; navigate-fallback probeert './' en daarna 'index.html'. **Live geverifieerd**: cache bevat exact de 12 juiste paden. |
| P1-2 | Root self-destruct wiste ook tenant-caches | **GEFIXT**: tenant-cache heet nu `nphv-shell-v1`; de tenant-activate ruimt alleen oudere `nphv-shell-*` en de oude kale `shell` op; de root self-destruct wist uitsluitend nog `shell`. |
| P1-3 | Teamtoken in query-vorm (`/?t=...#/w/CODE`) ging verloren | **GEFIXT** zoals voorgesteld: landing.js verhuist een `?t=`-token de hash in (de vorm die app.js leest). NB: onze uitgegeven teamlinks hebben de token altijd al ín de hash gehad, dus dit was defensief; getest en werkend (team-sessie wordt gezet, token wordt daarna uit de adresbalk gescrubd door de bestaande scrub). |
| P2-4 | Instructiepagina's zonder CSP | **GEFIXT**: beide hebben nu een eigen meta-CSP met `script-src 'none'`. |
| P2-5 | Root-instructies linkte naar niet-bestaand manifest | **GEFIXT**: manifest-link verwijderd op de root-variant (installatie hoort per tenant); de NPHV-variant houdt zijn tenant-manifest. |
| P2-6 | Release-drift (APP_VERSION-comment, dubbele instructies) | **GEFIXT**: comment verwijst nu naar de tenant-version.json's; release-checklist toegevoegd aan CLAUDE.md (versies gelijk, tenant-map compleet, SHELL-paden bestaan echt, cache-naam tenant-specifiek, CSP per pagina, beide instructies bijwerken). |

Aanvullend, op jouw advies bij "expliciet gecontroleerd": de vier oude-ingang-varianten
zijn na deploy live getest (oud domein root, oud domein met #/w-hash, oud domein met
query-token + hash, en /nphv/-deeplink via het oude domein).

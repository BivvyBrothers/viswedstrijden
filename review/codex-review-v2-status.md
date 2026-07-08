# Codex-review v2: verwerkingsstatus (8 jul 2026, app v23)

Alle 11 bevindingen beoordeeld en verwerkt. Per punt:

| # | Bevinding | Status |
|---|---|---|
| P0-1 | database.sql niet synchroon met v21-frontend | **OPGELOST**: `review/database.sql` volledig VERS gegenereerd uit de live database (pg_get_functiondef + actueel tabelmodel incl. `push_subs.route`, `wedstrijden.max_teams/regels`, `w_admin_regels`, `w_push_subscribe` met p_route, `w_push_payload` met route). Geen changelog-lagen meer; het bestand is nu 1-op-1 de live staat. |
| P0-2 | Changelog claimde fixes die niet effectief in de SQL stonden | **OPGELOST** door dezelfde verse export. Belangrijk: de LIVE database had deze fixes al (FOR UPDATE in alle keuze-RPC's, capaciteitscheck, zone-reset, strenge push-validatie zijn geverifieerd met pg_get_functiondef); alleen de bundel was verouderd. |
| P0-3 | Team verwijderen cascade-verwijderde vangsten | **GEFIXT** (migratie `wedstrijd_codex_v2_fixes`): `w_admin_verwijder_team` weigert nu met `team_heeft_vangsten` zodra het team vangsten heeft (ook soft-verwijderde: audit blijft intact). Frontend toont een uitleg-melding. |
| P1-4 | Idempotentie op foto_path te ruim | **GEFIXT**: conflictpad eist nu zelfde wedstrijd + team + gewicht + status actief; anders `foto_al_gebruikt`. |
| P1-5 | http_wis_fotos ontbrak in de bundel | **OPGELOST**: volledige definitie staat in de verse export. |
| P1-6 | Locks gelijk trekken | **GEEN LIVE ACTIE NODIG**: live hebben w_kies_stek, w_kies_zone, w_admin_kies, w_start_stekkeuze, w_admin_reset_loting en w_join allemaal FOR UPDATE op de wedstrijd-rij (geverifieerd); het bundel-artefact is weg. |
| P2-7 | Notificatieklik navigeerde niet naar de route | **GEFIXT** in sw.js: bestaand venster wordt eerst naar de route genavigeerd (met try/catch-fallback naar alleen focus). |
| P2-8 | Foto-pad-validatie DB ruimer dan wis-fotos | **GEFIXT**: `w_registreer_vangst` en `w_admin_voeg_vangst` valideren nu met dezelfde regex als PAD_OK in wis-fotos.ts (`^CODE/[A-Za-z0-9-]+\.(jpe?g|png|webp|gif|heic)$`). |
| P2-9 | CSP-directives | **DEELS**: `object-src 'none'` toegevoegd. `frame-ancestors` werkt niet via een meta-tag (door browsers genegeerd; header vereist) en GitHub Pages ondersteunt geen custom headers; bewust weggelaten. |
| P2-10 | "+ nog 3 kg" moest vissen zijn | **GEFIXT**: "12,34 + ... kg + nog 3 vissen". |
| P2-11 | Push onderdrukt bij willekeurig zichtbaar venster | **GEFIXT**: onderdrukking alleen als een zichtbaar venster de route van de melding toont; zonder route-info wordt de melding altijd getoond. |

Alle server-fixes zijn end-to-end getest met wegwerp-wedstrijden (raar pad geweigerd,
retry idempotent, ander gewicht op zelfde foto geweigerd, team-delete geblokkeerd
met actieve én met soft-verwijderde vangsten).

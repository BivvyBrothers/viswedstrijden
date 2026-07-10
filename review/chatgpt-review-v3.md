# Review-verzoek v3: viswedstrijd-app (v35) | domeinverhuizing + multi-tenant

Je bent een kritische senior reviewer. Je deed eerder review v2 (11 bevindingen,
allemaal verwerkt en door jou goedgekeurd in de eindcontrole, app v23). Sindsdien
is er veel verbouwd: eigen domein, een merk-laag en vooral een **multi-tenant
opzet met een eigen omgeving per organisatie**. Controleer de nieuwe structuur op
bugs, security-gaten en regressies. De eerste echte wedstrijd komt eraan; wees streng.

## Context

- Live: **https://viswedstrijdapp.nl** (GitHub Pages, publieke repo
  BivvyBrothers/viswedstrijden, webroot `docs/`)
- De root is een **keuzepagina** ("Kies jouw organisatie"); elke organisatie heeft
  een eigen pad. Eerste bewoner: **/nphv/** (NPHV, Nootdorps Pijnackerse
  Hengelsportvereniging, Plas van der Ende).
- Oude adressen redirecten: viswedstrijd.kemblinck.nl en viswedstrijdapp.com
  (aparte redirect-repo's met index/404 + JS location.replace incl. pad en hash).
- Dit document staat in `KemblincK/Viswedstrijden/review/`; paden hieronder zijn
  relatief aan `KemblincK/Viswedstrijden/`.

## Wat is er veranderd sinds jouw v2-eindcontrole (v23 → v35)

1. **Domein:** verhuisd van viswedstrijd.kemblinck.nl naar viswedstrijdapp.nl;
   http→https afgedwongen; www-redirect; redirect-repo's voor de oude adressen.
2. **Multi-tenant bestandsstructuur (v35):**
   - GEDEELD op de root: `app.js`, `styles.css`, iconen, `kemblinck-logo.png`.
   - PER TENANT in `docs/nphv/`: `index.html` (branding), `config.js`, `kaart.js`,
     `manifest.webmanifest` (start_url en scope `./`), eigen `sw.js`,
     `version.json`, `instructies.html` + `instructies-print.pdf`.
   - Tenant-index laadt gedeelde assets met absolute paden (`/app.js`,
     `/styles.css`, `/icon-192.png`).
   - Root `index.html` + `landing.js`: keuzepagina; stuurt `#/w/...`, `#/k/...`
     en `#/org` door naar `/nphv/` + hash (ook op hashchange).
   - Root `sw.js` is nu een **self-destruct** (unregister + caches wissen +
     clients hernavigeren) voor oude beginscherm-installaties op de root-scope.
3. **Nieuwe pagina's:** `docs/info.html` (marketing, wat kan de app),
   `docs/instructies.html` (generiek, root) en `docs/nphv/instructies.html`
   (met het adres viswedstrijdapp.nl/nphv).
4. **Merk-laag:** KemblincK-blok op landing en in de NPHV-omgeving (app-stijl,
   geen externe fonts; Google Fonts is bewust weer verwijderd), app-logo in
   topbar en hero. Doelgroep-teksten verbreed (ook vriendengroepen).
5. **Database: ONGEWIJZIGD sinds v2.** `review/database.sql` (verse export van
   8 jul) is nog actueel. Er is bewust nog GEEN tenant-kolom: de database is
   single-tenant tot de tweede organisatie zich meldt (plan: tenant-kolom op
   instellingen/wedstrijden + p_water-parameter in de RPC's vanuit config.js).

## Te reviewen bestanden

| Bestand | Wat |
|---|---|
| `docs/index.html` + `docs/landing.js` | keuzepagina + hash-doorverwijzing |
| `docs/sw.js` | self-destruct worker (root-scope) |
| `docs/nphv/index.html` | tenant-app (NPHV), absolute vs relatieve paden |
| `docs/nphv/sw.js` | tenant-worker: precache-shell, push, notificatieklik |
| `docs/nphv/manifest.webmanifest` | PWA-instellingen per tenant |
| `docs/nphv/config.js` | Supabase-URL + publishable key (bewust publiek) |
| `docs/app.js` | GEDEELDE app-logica (~1500 regels); let op pad-aannames |
| `docs/info.html`, `docs/instructies.html`, `docs/nphv/instructies.html` | statische pagina's, eigen CSP's |
| `review/database.sql` | actuele DB-export (ongewijzigd sinds v2) |
| `review/push-vangst.ts`, `review/wis-fotos.ts` | edge functions (ongewijzigd) |

## Bewuste keuzes: NIET aanmerken

- Database single-tenant met gedocumenteerd migratiepad (zie boven). Eén
  organisatie-wachtwoord; dat wordt per-tenant zodra de database meegaat.
- Foto's in een publieke bucket met uuid-paden; pins ongehasht; polling in
  plaats van realtime; geen rate limiting behalve pg_sleep op het org-wachtwoord.
- Advisor-warnings "security definer callable by anon" op w_*-functies.
- w_admin_voeg_vangst zonder eindtijd-check (vangnet voor de organisator).
- De redirect-repo's zijn bewust piepklein (meta-refresh + JS) en noindex.
- frame-ancestors ontbreekt in de CSP's: kan niet via een meta-tag en GitHub
  Pages ondersteunt geen custom headers.

## Focusvragen

1. **Service worker-scopes:** de oude root-worker gaat via self-destruct weg en
   /nphv/ krijgt een eigen worker. Zie je scenario's waarin een achtergebleven
   root-worker (of zijn cache) de /nphv/-app of de keuzepagina kan verstoren,
   of waarin beide workers elkaars fetches afvangen?
2. **Tenant-worker cache:** `docs/nphv/sw.js` pre-cachet zowel relatieve
   (`./`, `index.html`, `kaart.js`) als absolute paden (`/app.js`, `/styles.css`).
   Klopt de cache-strategie (network-first, version.json uitgesloten) nog in
   deze structuur? Kan een verouderde gedeelde asset blijven hangen?
3. **PWA-installatie op /nphv/:** manifest met start_url/scope `./` en iconen
   op absolute root-paden; apple-touch-icon absoluut. Werkt installatie en push
   op iOS-beginscherm en Android correct binnen deze scope? Iets dat breekt?
4. **landing.js:** `location.replace('/nphv/' + location.hash)` bij
   `#/w`-, `#/k`- en `#/org`-hashes, ook op hashchange. Is dit veilig (open
   redirect, hash-injectie) en dekkend (alle oude linkvormen, incl. teamlinks
   met `?t=TOKEN` vóór de hash: `/?t=...#/w/CODE` — komt de token-query mee)?
5. **Pad-aannames in gedeelde app.js:** deel-links en beheer-links gebruiken
   `location.origin + location.pathname`; de service worker-registratie en
   version-check zijn relatief; push-routes zijn `#/w/CODE`-vormen en de
   notificatieklik navigeert `'./' + route` vanuit de tenant-scope. Zie je een
   plek waar nog een root-pad wordt aangenomen die nu onder /nphv/ hoort?
6. **CSP per pagina:** landing, info, instructies (root en nphv) en de
   tenant-app hebben elk een eigen meta-CSP. Kloppen ze (geen te ruime en geen
   brekende), nu Google Fonts weer weg is?
7. **Dubbele instructiepagina's en versiebestanden:** root en /nphv/ hebben
   elk instructies + version.json. Zie je drift-risico's die we beter kunnen
   afdekken (bijv. iets dat bij een release vergeten gaat worden)?
8. **Oude ingangen:** bestaande QR/A4/WhatsApp-links, bookmarks op het oude
   domein, oude beginscherm-apps op de root en op viswedstrijd.kemblinck.nl:
   loopt elk pad netjes naar de juiste plek?
9. **Regressie in de app zelf:** de app-logica is sinds v23 nauwelijks
   veranderd, maar de index is verplaatst/gedupliceerd. Check de tenant-index
   op ontbrekende elementen die app.js verwacht (id's, tabs, formulieren).
10. **Toekomstvastheid:** zie je in de huidige opzet iets dat het geplande
    database-multi-tenant-pad (tenant-kolom + p_water) onnodig moeilijk maakt?

## Gewenste output

Geneste lijst, gesorteerd op prioriteit:
- **P0** = fixen vóór de eerste echte wedstrijd (blokkade, dataverlies, verkeerde omgeving)
- **P1** = belangrijk, kort daarna
- **P2** = nice to have

Per bevinding: bestand + regel(indicatie), probleem, concreet reproductiescenario
en voorgestelde fix. Sluit af met wat je expliciet gecontroleerd en goedgekeurd
hebt, zodat we weten wat afgedekt is.

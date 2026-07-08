# Review-verzoek: viswedstrijd-app (v21) | grondige controle

Je bent een kritische senior reviewer. Controleer deze webapp op **bugs, security-gaten,
race-condities en wedstrijddag-risico's**. De app is live en wordt binnenkort voor een
echte karperwedstrijd gebruikt. Wees streng: liever een vals alarm dan een gemiste bug.

## Wat is dit

Statische webapp voor karperwedstrijden op de Plas van der Ende (Nootdorp):
digitale loting, stekkeuze op een dieptekaart, vangstregistratie met foto,
live klassement met aftelklok, webpush bij vangsten. Drie rollen: deelnemer,
kijker, organisator. Geen accounts.

- Live: https://viswedstrijd.kemblinck.nl (GitHub Pages, publieke repo BivvyBrothers/viswedstrijden)
- Frontend: vanilla JS, geen build-stap, geen dependencies
- Backend: Supabase (Postgres + storage + edge functions), schema `wedstrijd`
- Dit document staat in `KemblincK/Viswedstrijden/review/`; alle paden hieronder
  zijn relatief aan `KemblincK/Viswedstrijden/`

## Te reviewen bestanden (lees ze allemaal)

| Bestand | Wat |
|---|---|
| `docs/app.js` | alle app-logica (~1450 regels): routing, rollen, kaart, loting, klassement, push, beheer |
| `docs/index.html` | alle views + CSP meta |
| `docs/sw.js` | service worker: webpush + offline app-shell (network-first) |
| `docs/styles.css` | styling (camo-thema; variabelen heten nog `--blauw-*`) |
| `docs/kaart.js` | GEGENEREERD (niet handmatig reviewen op stijl): interactieve kaart-SVG, STEK_POSITIE, ZONE_STANDAARD |
| `docs/config.js` | Supabase-URL + publishable key + VAPID public (bewust publiek) |
| `review/database.sql` | volledig schema + alle RPC's + changelog van alle wijzigingen (onderaan de nieuwste) |
| `review/push-vangst.ts` | edge function webpush (batches, custom auth x-push-secret) |
| `review/wis-fotos.ts` | edge function foto's verwijderen via Storage API (service role) |

## Beveiligingsmodel (zo is het bedoeld)

- Tabellen hebben RLS **aan zonder policies**; ALLE toegang loopt via
  SECURITY DEFINER RPC's `w_*` in het public schema met `set search_path = ''`.
  De RPC's zijn de publieke API; validatie zit erin. Dat anon ze mag aanroepen is by design.
- Autorisatie-lagen: organisatie-wachtwoord (tabel instellingen, server-side check),
  admin_pin per wedstrijd (auto-gegenereerd), team-token (uuid, localStorage),
  deelnemerscode + kijkcode + persoonlijke deelnemer-code (6 tekens, uniek).
- Eindtijd wordt ALTIJD server-side afgedwongen in w_registreer_vangst.
- Klok rekent met server_now (offset tegen Date.now).
- Polling elke 6s (1x/min op de achtergrond), bewust geen websockets.

## Recente wijzigingen (v15-v21, extra aandacht hier)

1. **Vaste zone-indeling** (19 zones A-S) als laag op de kaart; `zonesZijnStandaard()`
   vergelijkt wedstrijd-zones met `ZONE_STANDAARD` en toont de laag alleen bij een match.
   Zoneletters zijn klikbaar (klikZone); kleuren: oranje = selectie, groen = eigen/bevestigd,
   rood = bezet.
2. **w_org_verwijder_wedstrijd**: wedstrijd + cascade + foto's via edge function
   `wis-fotos` (pg_net fire-and-forget, x-push-secret auth, service role bulk-delete).
3. **Analyse-ronde (migratie `wedstrijd_analyse_ronde_1`)**:
   - gewicht 50-50000 gram: check-constraint + expliciete check in w_registreer_vangst en w_admin_vangst
   - idempotente registratie: unieke index op vangsten.foto_path; bij unique_violation
     geeft w_registreer_vangst de bestaande vangst terug ({id, dubbel:true})
   - `w_admin_kies`: organisator wijst een plek toe aan een team zonder keuze,
     **bewust zonder beurt-check** (vangnet voor afwezige deelnemers)
   - `w_admin_verwijder_team`: nu in elke fase; zet status op 'klaar' als het laatste
     keuzeloze team wegvalt tijdens de stekkeuze
   - `w_admin_voeg_vangst`: handmatige invoer door organisator, foto optioneel
     (foto_path is nu NULLABLE), **bewust geen eindtijd-check** (vangnet voor te late uploads)
   - `w_admin_wedstrijd`: naam en max_teams aanpassen (max nooit lager dan huidig aantal)
   - pg_sleep(0.5) bij fout org-wachtwoord
   - frontend: offline app-shell (sw.js network-first met cache-fallback, version.json
     uitgesloten van cache), "Geen verbinding"-melding, klassement-tiebreaks
     (totaal → grootste vis → vroegst gevangen; gelijke stand = zelfde rangnummer),
     opbouwregel afgekapt op 10 vissen, push overgeslagen als de app zichtbaar is,
     team-uitlogknop, teamcodes-cache, CSP meta-tag, ADMIN_KIES-modus op de kaart
     ("geef plek"-flow), vangst-toevoegen-formulier in Beheer.

## Bewuste keuzes: NIET aanmerken

- Foto's in een publieke bucket, paden met uuid's (geen listing-RPC).
- Pins en org-wachtwoord ongehasht in de database (hobby-schaal, geen accounts).
- Geen rate limiting behalve de pg_sleep op het org-wachtwoord.
- Polling in plaats van realtime; 6 seconden latentie is prima.
- Koppelwedstrijd + zones met 1 stek wordt niet geblokkeerd (organisator weet dit).
- Advisor-warnings "security definer callable by anon" op w_*-functies: by design.
- w_admin_voeg_vangst zonder eindtijd-check: bewust (zie boven).
- Verwijderde vangsten krijgen status 'verwijderd' (blijven in de DB als audit).
- CDN kan een verwijderde foto-URL nog even cachen.

## Focusvragen

1. **Nieuwe RPC's**: zitten er autorisatie- of validatiegaten in w_admin_kies,
   w_admin_voeg_vangst, w_admin_verwijder_team, w_admin_wedstrijd,
   w_org_verwijder_wedstrijd, w_secret_check? Kan een deelnemer (met alleen een
   team-token) of een buitenstaander (alleen de publieke key) ergens iets mee dat niet mag?
2. **Race-condities**: loting/stekkeuze gebruikt FOR UPDATE op de wedstrijd-rij.
   Kloppen de nieuwe paden (w_admin_kies parallel met w_kies_zone; verwijder_team
   tijdens andermans keuze; w_admin_wedstrijd max verlagen parallel met w_join)?
3. **Idempotentie**: is de unique-violation-afhandeling in w_registreer_vangst
   waterdicht? Kan de client-retry-flow (zelfde foto_path hergebruiken) alsnog
   dubbele of verloren vangsten opleveren?
4. **Service worker**: is de network-first-strategie correct geimplementeerd?
   Risico's op een blijvend stale app-shell, kapotte updates (skipWaiting +
   clients.claim), of cache-vervuiling? version.json is uitgesloten; is dat genoeg
   voor de verversbanner-flow (APP_VERSION vs version.json)?
5. **CSP** in index.html: klopt hij, en breekt hij iets (SVG met style-attributen,
   blob-previews, service worker, manifest)? Ontbreken er zinvolle directives?
6. **klikbare zoneletters + ADMIN_KIES**: kan een deelnemer via de UI of direct via
   RPC buiten zijn beurt kiezen? Is de client-side guard (magSelecteren) consistent
   met de server-side checks?
7. **Klassement-tiebreaks**: klopt de sortering en de gelijke-rang-weergave?
   Randgevallen: team zonder vangsten, vangst zonder foto (grootste-vis-modus),
   verwijderde vangsten.
8. **Offline/flaky netwerk**: eerste load faalt → "Geen verbinding" + retry via poll.
   Zijn er paden waar de app in een kapotte tussenstand blijft hangen (INIT_KLAAR,
   PENDING_TOKEN, pin-check)?
9. **Edge functions**: push-vangst en wis-fotos: auth-bypass mogelijk? Kan iemand
   met de publieke anon key de Storage API-delete misbruiken (pad-regex, bucket-scope)?
10. **XSS**: alle innerHTML-paden nalopen (namen, teamnamen, zonenamen, regels-tekst,
    foutmeldingen). esc() wordt gebruikt; is er een pad vergeten?
11. **iOS-beginscherm-app**: localStorage per app-context, geen confirm(), pushmeldingen
    alleen standalone. Zie je gedrag dat daar stukloopt (bijv. de nieuwe uitlogknop,
    de beheer-modus, de offline-cache)?
12. **Tijd en klok**: TIJD_OFFSET, fase(), de 15-seconden-marge bij registreren,
    w_admin_tijden. Randgevallen rond start/einde (zomertijd, telefoon met foute klok)?

## Gewenste output

Geneste lijst met bevindingen, gesorteerd op prioriteit:
- **P0** = moet gefixt vóór de eerste echte wedstrijd (dataverlies, manipulatie, blokkade)
- **P1** = belangrijk, kan direct na de wedstrijd
- **P2** = nice to have / stijl

Per bevinding: bestand + regel(indicatie), het probleem, een concreet reproductiescenario
en een voorgestelde fix. Meld ook expliciet wat je gecontroleerd en goedgekeurd hebt,
zodat we weten wat afgedekt is.

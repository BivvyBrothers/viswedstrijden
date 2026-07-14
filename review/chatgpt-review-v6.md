# Review-verzoek v6: viswedstrijd-app (v46) | beheerdersomgeving, social delen, klanten-model

Je bent een kritische senior reviewer. Je deed eerder v2 t/m v5; alles is
verwerkt en live. Sindsdien zijn er drie releases bij: de **beheerdersomgeving
(v44)**, **vangst delen op social media + logo-voet (v45)** en het **lichte
klanten-model met beheer per klant (v46)**. Wees extra streng op v44: dat is
het meest privilege-gevoelige stuk van de app (geeft toegang tot alle
admin-pins en instellingen).

Dit document staat in `KemblincK/Viswedstrijdapp/app/review/`; alle paden
hieronder zijn relatief aan `KemblincK/Viswedstrijdapp/app/` en rechtstreeks
leesbaar vanaf schijf. De code staat ook publiek op
https://github.com/BivvyBrothers/viswedstrijden (branch main, APP_VERSION 46).

## Wat is er nieuw sinds jouw v5-controle (v43 → v46)

1. **v44 | beheerdersomgeving (alleen voor de app-beheerder/KemblincK):**
   - VERBORGEN route `#/beheerder` (geen knop in de UI; landing.js stuurt de
     kale root-variant door). Eigen `beheerder_wachtwoord` in
     wedstrijd.instellingen (migratie `wedstrijd_beheerder`), los van het
     organisatie-wachtwoord; waarde staat alleen in de database.
   - RPC's via `wedstrijd.su_check` (pg_sleep bij fout wachtwoord):
     `w_su_overzicht` (stats, instellingen-status, alle wedstrijden incl.
     **admin_pin**), `w_su_alleen_lezen` (vlag toggelen),
     `w_su_org_wachtwoord` (organisatie-wachtwoord resetten, min. 6),
     `w_su_wachtwoord` (eigen wachtwoord wijzigen, min. 12).
   - Client: `#view-beheerder` in beide tenant-indexen, sessionStorage
     `suww`, "Openen & beheren" via de bestaande pin-flow, pin kopiëren.
2. **v45 | vangst delen op social media:**
   - Deel-knop per vangst (vangsten-feed + Mijn vangsten): `tekenVangst()`
     maakt een 1080x1352-canvas met de vangstfoto cover-gecropt
     (`laadFoto` met crossOrigin='anonymous'; de publieke bucket stuurt
     `access-control-allow-origin: *`) of een logo-placeholder bij
     handmatige vangsten; gewicht, visser, wedstrijd + datum eronder.
   - Alle deel-afbeeldingen (uitslag/seizoen/vangst) hebben nu een gedeelde
     voet `tekenVoet()` met het app-icoon (`APP_ICOON` preload van
     /icon-192.png) + viswedstrijdapp.nl.
3. **v46 | klanten-model + beheer per klant:**
   - Tabel `wedstrijd.klanten` (slug ~ '^[a-z0-9]{1,30}$' = tenant-map,
     naam) + `wedstrijden.klant_id` (migratie `wedstrijd_klanten`); nphv en
     demo geseed, bestaande wedstrijden toegewezen.
   - `w_maak_wedstrijd` kreeg een 8e parameter `p_klant` (tenant-slug uit de
     nieuwe `const TENANT` in config.js); null/onbekend valt terug op nphv.
     De OUDE 7-parameter-functie is gedropt (PostgREST zou anders twee
     kandidaten zien); oude gecachte clients roepen de nieuwe aan zonder
     p_klant en krijgen de default.
   - `w_su_overzicht` groepeert nu per klant (klant-tabs in de beheer-UI,
     per-klant stats, waarschuwing bij wedstrijden zonder klant).
   - `tools/nieuwe_tenant.py` vervangt de TENANT-regel in config.js en print
     de klant-insert-SQL als checklist-stap.

## Te reviewen bestanden

| Bestand | Wat |
|---|---|
| `review/database.sql` | instellingen.beheerder_wachtwoord, su_check + w_su_*, klanten-tabel, nieuwe w_maak_wedstrijd, gegroepeerde w_su_overzicht (verse defs onderaan + tabellen bovenin) |
| `docs/app.js` | route #/beheerder + initSu/laadSu/renderSu/suKaart + su-listeners; tekenVoet/laadFoto/tekenVangst/deelVangst/koppelVangstDelen; SU_KLANT-tabs; p_klant bij w_maak_wedstrijd |
| `docs/nphv/index.html` + `docs/demo/index.html` | view-beheerder (login + omgeving), deel-knoppen in feed/Mijn vangsten (via JS) |
| `docs/nphv/config.js` + `docs/demo/config.js` | const TENANT |
| `docs/landing.js` | #/beheerder-doorsturing |
| `tools/nieuwe_tenant.py` | TENANT-vervanging + klant-SQL-reminder |

## Bewuste keuzes: NIET aanmerken

- Het beheerderswachtwoord staat als platte tekst in wedstrijd.instellingen,
  consistent met het organisatie-wachtwoord en de pins (gedocumenteerde
  hobby-schaal-keuze). Het staat nergens in de repo.
- De route `#/beheerder` is verborgen maar het wachtwoord is de echte gate;
  dat de route in de publieke JS zichtbaar is, is geaccepteerd.
- `w_su_overzicht` geeft admin_pins van alle wedstrijden terug: dat is de
  bedoeling (support), uitsluitend achter het beheerderswachtwoord.
- sessionStorage voor `suww` (zelfde patroon als het org-wachtwoord).
- Het klanten-model is bewust licht: org-wachtwoord/zones/stek_ring blijven
  gedeeld tot de volledige tenancy-migratie bij klant 2.
- Vangst-deelknoppen staan ook op andermans vangsten in de feed: delen van
  andermans vis is sociaal gedrag (thuisfront deelt de vangst van de visser),
  geen beveiligingsvlak; de afbeelding bevat alleen al-publieke data.
- Eerdere bewuste keuzes uit v2 t/m v5 blijven gelden.

## Focusvragen

1. **Beheerder-autorisatie:** loop alle vier w_su_*-RPC's na: kan er iets
   zonder (correct) beheerderswachtwoord? Is `su_check` sluitend (null-ww in
   de database = altijd weigeren?), en zie je escalatiepaden (bijv. via
   w_su_org_wachtwoord naar org-omgeving en dan verder) die we onbedoeld
   makkelijker hebben gemaakt dan bedoeld?
2. **Lekkage in de beheer-UI:** renderSu/suKaart bouwen HTML met
   DB-strings (wedstrijdnamen, klantnamen zijn organisator-invoer). Is alles
   ge-escaped (XSS)? En blijft `suww` nergens anders hangen (logs, URL's)?
3. **w_maak_wedstrijd-wijziging:** de oude 7-param-functie is gedropt en de
   nieuwe heeft p_klant default null. Zie je een scenario waarin een oude
   gecachte client (PostgREST rpc-call met named params zonder p_klant)
   breekt? En is de fallback "onbekende slug -> nphv" verstandig, of hoort
   dat een fout te zijn?
4. **Canvas/foto's:** laadFoto met crossOrigin + cover-crop + toBlob: zie je
   randgevallen (heel grote foto's, EXIF-rotatie, trage laadtijd terwijl de
   gebruiker wegnavigeert, dubbelklik op de deel-knop)? Is de
   AbortError-afhandeling compleet?
5. **Klant-tabs:** SU_KLANT-state overleeft ververs/re-render; klopt de
   fallback als een klant verdwijnt of leeg is? En de zonder_klant-
   waarschuwing: kan die ooit onterecht verschijnen/verzwijgen?
6. **Regressies:** de voet-refactor (tekenVoet) raakt de bestaande uitslag-
   en seizoensafbeeldingen; en de feed/Mijn vangsten kregen extra knoppen.
   Breekt er iets aan bestaande flows (foto-lightbox via data-groot,
   kijker zonder vangsten-tab)?
7. **Scaffold:** klopt de nieuwe TENANT-vervanging voor toekomstige tenants
   (assert dekkend?) en is de klant-insert-reminder voldoende, of hoort de
   scaffold te falen zolang de klant-rij ontbreekt?

## Gewenste output

Geneste lijst, gesorteerd op prioriteit (P0 = fixen voordat dit in gebruik
gaat, P1 = belangrijk, P2 = nice to have). Per bevinding: bestand +
regel(indicatie), probleem, concreet reproductiescenario en voorgestelde fix.
Sluit af met wat je expliciet gecontroleerd en goedgekeurd hebt.

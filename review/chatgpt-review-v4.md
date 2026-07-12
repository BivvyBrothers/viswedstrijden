# Review-verzoek v4: viswedstrijd-app (v39) | standaardkaart, tenant-scaffold, demo-omgeving, alleen-lezen

Je bent een kritische senior reviewer. Je deed eerder review v2 (11 bevindingen)
en v3 (6 bevindingen, o.a. de sw-precache-P0); alles is verwerkt en live. De app
draait op https://viswedstrijdapp.nl (publieke repo BivvyBrothers/viswedstrijden,
webroot `docs/`, huidige stand = commit met APP_VERSION 39). Sindsdien is het
"klaar-voor-klanten-pakket" gebouwd. Controleer dat op bugs, security-gaten en
regressies. Wees streng: dit gaat naar betalende verenigingen.

Dit document staat in `KemblincK/Viswedstrijden/review/`; alle paden hieronder
zijn relatief aan `KemblincK/Viswedstrijden/` en zijn rechtstreeks leesbaar
vanaf schijf (zelfde map als dit bestand). De code staat ook publiek op
https://github.com/BivvyBrothers/viswedstrijden (branch main).

## Wat is er nieuw sinds jouw v3-controle (v36 → v39)

1. **v37/v38 (klein):** tekstrondes: beide inlogroutes in alle uitleg,
   installeer-tip linkt naar de uitleg, hengel-emoji in de instructie-topbars
   vervangen door het logo.
2. **v39 | standaardkaart-generator** `tools/gen_standaardkaart.py`: genereert
   een GENERIEKE zonekaart (organische watervorm, stekken op booglengte
   verdeeld, radiale zonegrenzen, letters A-Z) als `docs/<slug>/kaart.js`,
   met dezelfde interface als de NPHV-kaart: `KAART_SVG`, `STEK_POSITIE`,
   `ZONE_STANDAARD` en identieke markup-classes (.stek/.stek-dot, #zonelaag,
   .zoneletter/.zoneletter-dot).
3. **v39 | tenant-scaffold** `tools/nieuwe_tenant.py`: maakt een complete
   tenant-map vanaf `docs/nphv/` (index/instructies/sw/manifest/config/version
   + kaart) en voegt de keuzeregel op de rootpagina toe. Elke tekstvervanging
   heeft een assert op het aantal treffers (les uit jouw v3-P0).
4. **v39 | demo-omgeving** `docs/demo/` (eerste product van het scaffold):
   geseede AFGELOPEN voorbeeldwedstrijd "Voorjaarswedstrijd (demo)" in de
   productiedatabase (12 teams, 20 vangsten zonder foto, direct via SQL
   ge-insert, geen zones dus stekken-modus). Publieke codes op de demo-homepage:
   kijkcode `KIJKJE` en persoonlijke deelnemercode `DEMOJA` (meekijken als
   visser "Jan", zodat bezoekers het deelnemer-scherm mét kaart zien).
5. **v39 | alleen-lezen-vlag** (migratie `wedstrijd_alleen_lezen`):
   `wedstrijd.instellingen.alleen_lezen boolean default false`; guard in
   `w_maak_wedstrijd` direct na de wachtwoordcheck (`raise 'alleen_lezen'`),
   nette fouttekst in app.js. Bestaande wedstrijden blijven bewust volledig
   beheerbaar en bekijkbaar; alleen NIEUW aanmaken wordt geblokkeerd.
6. `docs/app.js`: alleen APP_VERSION 39 + de nieuwe fouttekst; verder ongewijzigd.
7. `review/database.sql` is bijgewerkt (instellingen-tabel + verse
   `w_maak_wedstrijd`-definitie uit live).

## Te reviewen bestanden

| Bestand | Wat |
|---|---|
| `tools/gen_standaardkaart.py` | kaart-generator: geometrie, zone-indeling, markup-compatibiliteit |
| `tools/nieuwe_tenant.py` | scaffold: vervangingen+asserts, slug-validatie, root-index-insertie |
| `docs/demo/index.html` | demo-branding + extra demo-sectie (knop KIJKJE, uitleg DEMOJA) |
| `docs/demo/sw.js` | gegenereerde tenant-worker: cache-naam, SHELL-paden |
| `docs/demo/manifest.webmanifest`, `docs/demo/config.js`, `docs/demo/version.json` | tenant-bestanden |
| `docs/demo/kaart.js` | gegenereerd (40 stekken, 8 zones); niet handmatig bewerkt |
| `docs/demo/instructies.html` | gegenereerd; print-pdf-link bewust weggelaten |
| `docs/index.html` | keuzepagina met nu 2 regels (NPHV + Demo) |
| `docs/app.js` | regel APP_VERSION + FOUTEN.alleen_lezen |
| `review/database.sql` | instellingen.alleen_lezen + w_maak_wedstrijd-guard |

## Bewuste keuzes: NIET aanmerken

- **De demo deelt de single-tenant productiedatabase met NPHV.** De
  demo-wedstrijd staat in dezelfde wedstrijden-tabel en verschijnt in de
  organisatie-omgeving van de beheerder; dat is geaccepteerd tot de
  tenancy-migratie.
- **Demo-codes zijn bewust publiek** (KIJKJE, DEMOJA). Na inloggen met DEMOJA
  is ook de deelnemerscode van de demo-wedstrijd zichtbaar in de URL; de
  wedstrijd is afgelopen, dus aanmelden en registreren zijn server-side dicht.
- **Standaardkaart-tenants kunnen nog geen eigen echte wedstrijden draaien:**
  de server valideert stekken tegen de NPHV-`stek_ring`, en
  `w_maak_wedstrijd` kopieert de NPHV-`standaard_zones`. Gedocumenteerd als
  onderdeel van de geplande DB-tenancy (tenant-kolom + p_water + eigen ring
  en zones per water). De demo omzeilt dit met direct geseede data zonder zones.
- `alleen_lezen` is nu 1 vlag voor de hele database; wordt per tenant bij de
  tenancy-migratie.
- Nieuwe tenants krijgen (nog) geen instructies-print.pdf; de link is in het
  scaffold bewust verwijderd.
- Eerdere bewuste keuzes uit v2/v3 blijven gelden (publieke foto-bucket,
  ongehashte pins, polling, security-definer-warnings, frame-ancestors
  onmogelijk op Pages).

## Focusvragen

1. **Demo-misbruik:** loop de w_*-RPC's na vanuit het perspectief van een
   vreemde die KIJKJE, DEMOJA én (na inloggen) de wedstrijdcode heeft, op een
   wedstrijd met status 'klaar' en eind_ts in het verleden. Kan hij IETS
   muteren (teamnaam, push_subs-spam, vangst, stek, zone, heraanmelden) of
   data zien die niet voor kijkers bedoeld is? Wat is het ergste realistische
   scenario en is dat acceptabel voor een demo?
2. **Scaffold-correctheid:** kloppen de gegenereerde demo-bestanden exact met
   de release-checklist (SHELL-paden bestaan echt, cache-naam demo-shell-v1,
   scope ./, CSP's aanwezig)? Zie je een sjabloon-wijziging in docs/nphv/ die
   de asserts NIET zouden vangen maar wel een kapotte tenant oplevert?
3. **gen_standaardkaart.py:** klopt de geometrie/logica (booglengte-verdeling,
   zone-toewijzing stekken↔letters↔grenslijnen, STEK_POSITIE als 1..N ring
   zonder wrap) en is de markup 1-op-1 compatibel met wat app.js verwacht?
4. **alleen_lezen-guard:** is de plek in w_maak_wedstrijd juist (na
   wachtwoordcheck, vóór inserts), en zijn er andere schrijf-RPC's die bij een
   verlopen abonnement redelijkerwijs óók dicht zouden moeten maar die we nu
   missen? (Bewust open: beheer van bestaande wedstrijden blijft werken.)
5. **Demo-index regressie:** de extra sectie op docs/demo/index.html; missen
   er elementen die app.js verwacht, of breekt de extra `<a class="btn">` iets
   (bijv. selectors die op .btn matchen)?
6. **Root-keuzepagina:** 2 tenant-regels + de scaffold-insertie vóór de
   installeer-tip; robuust genoeg? (Volgorde, duplicaat-detectie bij herdraaien.)
7. **Versie-drift:** APP_VERSION nu in docs/app.js + 3 version.json's
   (root/nphv/demo). Zie je een release-stap die realistisch vergeten wordt en
   die de checklist nog niet dekt?

## Gewenste output

Geneste lijst, gesorteerd op prioriteit:
- **P0** = fixen voordat dit aan klanten getoond wordt
- **P1** = belangrijk, kort daarna
- **P2** = nice to have

Per bevinding: bestand + regel(indicatie), probleem, concreet
reproductiescenario en voorgestelde fix. Sluit af met wat je expliciet
gecontroleerd en goedgekeurd hebt.

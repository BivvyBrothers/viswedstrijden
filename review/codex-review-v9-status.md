# Status Codex-review v9 (verwerkt 18 jul 2026, v57)

Bron: `codex-review-v9-bevindingen.md` (beheerdersomgeving, client + server).
Uitkomst: geen P0; drie P1's en vier P2's. Alles is verwerkt of bewust
gepland, plus twee van de vijf UI-voorstellen direct doorgevoerd.
Servermigratie: `wedstrijd_su_hardening_v9` (LIVE, database.sql ververst).

## Bevindingen

### 1. P1 · Klant-UI, globale acties | VERWERKT (UI) + VOORWAARDE

- De instellingen-kaart meldt nu prominent: "Deze instellingen zijn
  GLOBAAL: ze gelden voor alle omgevingen tegelijk". De alleen-lezen-knop
  zegt "Zet alleen-lezen AAN/UIT voor ALLE omgevingen" en de
  org-wachtwoord-reset heeft een expliciete bevestigingsstap ("Nogmaals:
  geldt voor ALLE omgevingen", vervalt na 5 seconden) plus dezelfde
  waarschuwing in de formuliertekst.
- De structurele fix (klantgebonden instellingen + klant-id in de RPC's)
  is onderdeel van de DB-tenancy-migratie die al als harde voorwaarde
  voor een tweede productieklant vaststaat; deze bevinding bevestigt de
  scope daarvan (org-wachtwoord, alleen-lezen, zones, stek_ring).

### 2. P1 · pg_sleep is geen rate-limit | GEDEELTELIJK NU, REST GEPLAND

- Nu gecontroleerd: het beheerderswachtwoord is 20 willekeurige tekens
  uit de wachtwoordmanager; online raden is daarmee praktisch kansloos,
  ook parallel. (Waarde uiteraard niet in de repo.)
- De sessie-kant is verkleind met de inactiviteitslimiet (zie P2-5).
- Gepland voor de hardening-ronde vóór de eerste betaalde klant (samen
  met de tenancy-migratie): rate-limiting vóór de database voor de
  `w_su_*`-routes (Edge Function met IP-limit of Data API pre-request),
  en als structurele variant één Supabase Auth-gebruiker met ingetrokken
  EXECUTE voor anon. Bewust NIET gedaan: pg_sleep verlengen (verbindings-
  uitputting) en een globale mislukte-pogingenteller (self-lockout),
  conform het advies van de reviewer zelf.

### 3. P1 · Lock-out-risico bij wachtwoordwijziging | VERWERKT

- Server (migratie `wedstrijd_su_hardening_v9`): `w_su_wachtwoord` is nu
  idempotent: is het "nieuwe" wachtwoord al het huidige, dan komt de
  retry als succes terug (`al_gewijzigd: true`). Het raden-orakel is niet
  goedkoper geworden: een fout kandidaat-wachtwoord valt door naar
  `su_check` met pg_sleep. Live getest: retry-pad geeft ok, fout
  wachtwoord geeft `beheerder_wachtwoord_onjuist`.
- Client: herhaal-veld ("herhaal nieuw beheerderswachtwoord", moet gelijk
  zijn), toon/verberg-knoppen, `autocomplete="new-password"`, knop uit
  tijdens de call, waarschuwing dat dit de enige beheerderstoegang is, en
  bij een netwerkfout de expliciete melding dat de wijziging mogelijk al
  is doorgevoerd en dat dezelfde retry veilig is.
- Herstelprocedure staat buiten de repo (Supabase-dashboard; genoteerd in
  de projectmemory, niet hier).

### 4. P2 · Opruiming bij fout of laat antwoord | VERWERKT

- `wisSuScherm()` draait nu bij ELKE routewissel weg van `#/beheerder`
  (conditie op SU_DATA verwijderd).
- `laadSu()` heeft een generatieteller + routecheck na elke await: een
  laat antwoord vult nooit meer een verlaten scherm en bewaart geen
  wachtwoord meer. Zelfde routecheck in de login-handler.
- Foutpad gesplitst: alleen `beheerder_wachtwoord_onjuist` beëindigt de
  sessie (met opruiming); een netwerkfout toont een toast en laat de
  sessie intact, zodat "ververs" gewoon opnieuw kan.

### 5. P2 · Wachtwoord als eeuwig sessietoken | VERWERKT (limiet), TOKEN GEPLAND

- Inactiviteitslimiet van 15 minuten: elke su-actie ververst de teller;
  een bewaker wist `suww` en het scherm na verloop, met nette melding.
- Het kortlevende servertoken (w_su_login) of Supabase Auth gaat mee in
  dezelfde hardening-ronde als P1-2; dat is de structurele oplossing.

### 6. P2 · Alles-in-één overzicht | GEPLAND

Bij de huidige twee klanten is de payload klein en het risico beperkt.
`w_su_klant` met paginering + een samenvattend `w_su_overzicht` staat op
de backlog voor het moment dat er meer klanten zijn; dat sluit aan op
UI-voorstel 2 (zoeken/selecteren in plaats van tabs).

### 7. P2 · Wachtwoordvelden en foutmeldingen | VERWERKT

- Login: `autocomplete="current-password"`; beide nieuw-velden:
  `type="password"` + `autocomplete="new-password"` + toon/verberg-knop +
  `maxlength="64"`. Het org-veld was `type="text"` en is nu ook een
  wachtwoordveld.
- Server: aparte foutcodes `org_wachtwoord_te_kort` (6) en
  `beheerder_wachtwoord_te_kort` (12) met kloppende clientteksten
  (inclusief de uitleg dat randspaties niet meetellen), en de server
  weigert dat organisatie- en beheerderswachtwoord gelijk worden
  (beide richtingen). Live getest.

## UI-voorstellen

- (1) Scope zichtbaar maken: DOORGEVOERD via de globaal-banner en de
  knopteksten (zie P1-1). Klantnaam in de knop kan pas betekenis krijgen
  na de tenancy-migratie.
- (3) Pins maskeren: DOORGEVOERD. Pins tonen standaard `••••` met een
  toon/verberg-knop en een kopieerknop; de echte waarde staat niet meer
  in `data-*`-attributen maar wordt bij gebruik opgezocht in de
  su-state (conform het voorstel). Bewuste afwijking: de deelnemers- en
  kijkcode blijven zichtbaar; die deelt support juist voortdurend en het
  risico is veel lager dan bij de pin (waarmee je wedstrijden beheert).
- (2) Zoeken/selecteren bij 5+ klanten en (5) tabel-layout: backlog,
  samen met P2-6 (dezelfde verbouwing van het overzicht).
- (4) Gevaarlijke acties in één blok met modal: gedeeltelijk gedekt
  (banner + bevestigingsstappen op beide gevaarlijke acties); de
  volledige hergroepering gaat mee met de UI-verbouwing van (2)/(5).

## Verificatie

- Preview-test (alles groen): login, globaal-banner, alleen-lezen-
  knoptekst, pin gemaskeerd/tonen/verbergen, org-reset dubbele
  bevestiging, toon-wachtwoord-knoppen, uitloggen wist de sessie.
- Live RPC-test: idempotente retry (`al_gewijzigd: true`), fout
  wachtwoord (`beheerder_wachtwoord_onjuist`), te kort org-wachtwoord
  (`org_wachtwoord_te_kort`).
- `node --check docs/app.js` geslaagd; versies op 57;
  `review/database.sql` ververst met de live functiedefinities.

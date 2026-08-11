# Status Codex-review v10 (verwerkt 18 jul 2026, v61)

Eerste review die via de Codex CLI is gedraaid (skill `codex-second-opinion`,
read-only, hele app: client + server + laatste vijf commits). Uitkomst van
Codex: 3 hoog, 10 middel, 2 laag. Ruwe uitvoer: `codex-review-v10-codex.md`.

Werkwijze conform de skill: eerst zelf hetzelfde nagelopen, daarna elke
concrete claim tegen de code geverifieerd voordat er iets is overgenomen.

## Direct verwerkt in v61 (+ migratie `wedstrijd_codex_v10_fixes`)

### 1. Grootste vis: bij gelijk gewicht won de LAATSTE in plaats van de eerste

Geverifieerd en de belangrijkste vondst van deze ronde, want dit raakt de
uitslag. `w_get_state` levert vangsten `order by created_at desc` (nieuw naar
oud) en `klassementRijen()` gebruikte `>`; daardoor bleef bij twee even zware
vissen van hetzelfde team de NIEUWSTE staan, terwijl het klassement daarna
sorteert op "wie zijn grootste vis het eerst ving". Scenario: Anna vangt om
10:00 en 15:00 elk 8 kg, Bram om 12:00 ook 8 kg. Bij gelijk totaalgewicht
hoort Anna te winnen (10:00), maar de app rekende met 15:00 en zette Bram
boven haar. Gefixt door bij gelijk gewicht expliciet de vroegste `created_at`
te kiezen; getest met precies dit scenario.

### 2. Aanmelden kon na de eindtijd (server)

`w_join` keek alleen naar `status = 'aanmelden'`. Een wedstrijd die nooit
geloot is blijft in die status staan, dus je kon je dagen na de eindtijd nog
aanmelden. Nu sluit de aanmelding ook op `eind_ts`. Live getest op een
bestaande wedstrijd die precies in die toestand stond: geeft nu
`wedstrijd_afgelopen`.

### 3. Koppelcapaciteit: 48 toegestaan, maar er passen er maar 47

De check deelde het aantal stekken (96) door twee. De `stek_ring` is echter
geen gesloten cirkel maar bestaat uit twee stukken van 91 en 5 posities;
daarin passen maximaal `floor(91/2) + floor(5/2) = 47` paren naast elkaar.
Bij 48 koppels startte de loting dus normaal, waarna het laatste koppel geen
geldige plek meer kon kiezen. Nieuwe functie `wedstrijd.max_koppels()`
berekent de echte capaciteit uit de segmenten (nu 47) en `w_start_stekkeuze`
gebruikt die bij koppelwedstrijden.

### 4. Geen rijvergrendeling bij wachtwoordwijziging (server)

`w_su_wachtwoord` en `w_su_org_wachtwoord` lazen en schreven zonder lock.
Twee gelijktijdige wijzigingen konden elkaar overschrijven: de eerste client
meldt succes en bewaart een wachtwoord dat niet meer werkt, en omdat er
precies één beheerder is, is dat een lock-out. Beide functies nemen nu
`for update` op `instellingen.id = 1` vóór de controle. De idempotente
retry uit v9 blijft werken (live getest).

### 5. Beheerderslijst rekende met een stilstaande klok

`renderSu()` gebruikte steeds dezelfde `SU_DATA.server_now`. Wie om 07:50
inlogt bij een wedstrijd die om 08:00 begint, zag om 09:00 nog steeds
"aanmelden open". Nu wordt de verstreken tijd sinds het ophalen erbij
opgeteld.

### 6. Organisator-omgeving liet pins en data achter

De su-omgeving ruimde na v9 netjes op, maar de organisator niet: pins stonden
in `data-pin`-attributen en na uitloggen bleven `ORG_DATA`, de seizoenen en
de gevulde containers staan. Nu haalt de organisator de pin (net als de
beheerder) uit de actuele state, en `wisOrgScherm()` maakt bij uitloggen
state en DOM leeg. Regressie tijdens deze fix zelf gevonden en verholpen:
`ORG_DATA` is een object met een `wedstrijden`-lijst, geen array, waardoor
"Openen & beheren" even niet werkte; getest tot de knop weer de pin zet en
navigeert.

## Zelf gevonden, al gefixt in v60 (vóór de Codex-uitslag)

- Zoekveld in de beheerderslijst: de cursor sprong naar het eind bij typen
  middenin de zoekterm.
- `wedstrijdFase` geeft nu een stabiele `sleutel`; de organisatorkaart hing
  zijn bezettingstekst aan de LABELTEKST, wat stil zou breken bij een
  tekstwijziging.
- De inactiviteitstimer bleef na uitloggen doordraaien.

Codex zag deze drie niet; ze zijn onafhankelijk uit de eigen nalezing
gekomen.

## Bevestigd, maar bewust NIET nu (gepland en al bekend)

- **Tenancy (Codex hoog 1).** Organisatiewachtwoord, zones, seizoenen en
  alleen-lezen zijn globaal; `w_org_verwijder_wedstrijd` controleert geen
  klant. Terecht, en het staat al als HARDE VOORWAARDE voor een tweede
  productieklant. De toevoeging van Codex die we meenemen: ook verwijderen
  en de seizoens-RPC's moeten klantgebonden worden, niet alleen lezen.
- **Foto-upload zonder autorisatie (hoog 2)** en **rate-limiting (hoog 3)**:
  horen bij dezelfde hardening-ronde; upload via een Edge Function met
  teamtoken-controle, rate-limit vóór de database, langere persoonlijke
  codes. Vandaag geen productie-risico bij één klant, wel vóór klant 2.
  **AFGEROND: v64 (18 jul) bracht de edge function; op 11 aug is ook de
  anon-INSERT-policy op de bucket ingetrokken** (migratie
  `wedstrijd_fotos_anon_insert_intrekken`), nadat alle clients ruim drie weken
  de tijd hadden om v64+ op te halen. Geverifieerd: directe upload met de
  publieke sleutel geeft 403 RLS, upload via de edge function met een geldig
  teamtoken geeft 200, publieke leesroute onveranderd 200.
- **Levenscyclus strakker afdwingen (middel 4, deels)**: het aanmelden na
  de eindtijd is nu dicht. De rest (vangst alleen bij status 'klaar', reset
  alleen vóór de start en zonder vangsten) vraagt een expliciete
  state-machine en gaat mee met de tenancy-migratie.
- **Late state-antwoorden in de wedstrijdflow (middel 6)**: dezelfde
  generatieteller als in de su-code, maar dan in `laadState`. Zinnige fix,
  bewust apart gehouden van deze ronde omdat hij de kernflow raakt en een
  eigen testronde verdient.
- **Push per wedstrijd (7), idempotent aanmaken (8), dag_regels in de state
  (9b), seizoen-naamsleutel (10), payload-omvang (11), foto-cleanup boven
  1000 (13)**: allemaal reëel, allemaal backlog. 9b en 10 hangen samen met
  de al geplande seizoen-fase-2 (vak/zone-klassering + naam-aliassen).

## Verificatie

- Live RPC-tests: aanmelden na eindtijd geeft `wedstrijd_afgelopen`,
  `wedstrijd.max_koppels()` geeft 47 (was impliciet 48), idempotente
  wachtwoord-retry werkt nog, foutcodes ongewijzigd.
- Browsertests: organisator "Openen & beheren" zet de pin en navigeert,
  geen `data-pin` meer in de DOM, uitloggen maakt state en containers leeg,
  beheerderslijst met zoeken/filteren/uitklappen werkt, cursorpositie blijft
  staan.
- Tiebreak getest met het scenario hierboven (Anna/Bram).
- `node --check docs/app.js` geslaagd; versies op 61; `review/database.sql`
  bijgewerkt met de vier live definities en de nieuwe helper.

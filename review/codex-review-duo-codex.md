# Codex-review duo-feature (30 aug 2026)

Rauwe output van `codex exec` (read-only) op commit `0e63bfa` (v72). Verwerking en verantwoording: `codex-review-duo-status.md`.

## Oordeel

Niet inzetten op 12 september voordat de P0 en de eerste twee P1’s zijn opgelost. De servertransacties zijn redelijk solide, maar de normale DUO-clientflow is nog niet betrouwbaar.

STORM: beoordeeld op commit `0e63bfa`, de effectieve SQL, huidige en oude clientcode en eerdere reviewstatussen. Aanname: `review/database.sql` is gelijk aan live. Er zijn geen live database- of gelijktijdigheidstests uitgevoerd en ik vond geen geautomatiseerde DUO-tests.

## P0

- **P0 | De client laat slechts één willekeurig duolid kiezen en kan de gedeelde plek als bezet tonen**

  - **Bestand en regel:** [docs/app.js:1346](docs/app.js:1346), [docs/app.js:1362](docs/app.js:1362), [docs/app.js:1415](docs/app.js:1415), [review/database.sql:1351](review/database.sql:1351).
  - **Probleem:** `teamAanBeurt()` kiest één teamrij bij het laagste lotnummer. `magSelecteren()` vergelijkt daarna uitsluitend het team-ID. Omdat beide duoleden hetzelfde lotnummer hebben, krijgt maar één van hen bediening op de kaart. `bezetDoor[stek] = team` overschrijft bovendien het eerste duolid met het tweede, waarna de andere visser de gezamenlijke stek als bezet in plaats van als eigen ziet.
  - **Scenario:** A meldt A en B als duo aan. Bij hun beurt kan alleen de teamrij die toevallig door `teamAanBeurt()` wordt gekozen een stek aantikken. De ander ziet alleen “Aan de beurt: B”. Na de keuze ziet één telefoon de gezamenlijke stek groen en de andere mogelijk als bezet. De poll kan dit opnieuw renderen. Omdat beide inserts in dezelfde transactie `created_at = now()` krijgen en de state geen extra sorteersleutel gebruikt, is niet gegarandeerd welk duolid als laatste staat. Of dit in de huidige live query daadwerkelijk tussen polls wisselt, heb ik niet live kunnen aantonen.
  - **Concreet fixvoorstel:** behandel in de client `duo_id ?? id` als loteenheid. Bepaal het minimale open lotnummer en laat elk eigen team met dat lotnummer kiezen. Bouw kaartbezetting per loteenheid op en markeer de stek als eigen wanneer de ingelogde teamrij tot die eenheid behoort. Groepeer de twee namen in één lotingrij of markeer beide als aan de beurt. Voeg server-side `t.id` als laatste sorteersleutel toe voor deterministische state.
  - **Regressietest:** open A en B in twee clients, laat beide tegelijk een andere stek kiezen en verifieer: beide kunnen de knop bedienen, één RPC slaagt, de andere krijgt `al_gekozen`, beide state-rijen krijgen dezelfde plek en daarna gaat de beurt exact één lotnummer verder.

## P1

- **P1 | Het verborgen tweede naamveld kan onbedoeld een duo aanmaken**

  - **Bestand en regel:** [docs/app.js:2471](docs/app.js:2471), [docs/app.js:2712](docs/app.js:2712), [review/database.sql:340](review/database.sql:340).
  - **Probleem:** de client verstuurt `p_naam2` altijd, ongeacht de DUO-checkbox. De server leidt DUO uitsluitend af uit een niet-lege `p_naam2`. Verbergen van het veld wist de waarde niet.
  - **Scenario:** iemand vinkt DUO aan, vult de maatnaam in en vinkt DUO weer uit. De maatnaam verdwijnt uit beeld, maar wordt toch verstuurd. De server maakt twee deelnemers aan en verbruikt twee plaatsen. Omgekeerd geldt: alleen spaties voldoen aan HTML `required`, maar worden voor verzending naar `null` getrimd, waardoor stil een solo wordt aangemaakt. De gecachte v71-client verstuurde dit veld ook altijd. Een achtergebleven waarde uit een eerder KOPPEL-formulier verandert daardoor onder de nieuwe serversemantiek onverwacht in een duo.
  - **Concreet fixvoorstel:** laat de submitcode `p_naam2` alleen meesturen bij KOPPEL of wanneer DUO daadwerkelijk aangevinkt is. Valideer de getrimde maatnaam vóór de RPC en wis het veld bij uitvinken of routewisseling. Voor harde backward-compatibiliteit is een aparte `w_join_duo` veiliger: laat `w_join` bij individueel `p_naam2` blijven negeren zoals vóór v72.
  - **Regressietest:** test aan, uit, alleen spaties, route KOPPEL naar individueel en een v71-payload met een onverwacht gevulde `p_naam2`.

- **P1 | De gedeelde link brengt de maat niet naar het persoonlijke inlogveld en de code heeft geen veilige levenscyclus**

  - **Bestand en regel:** [docs/app.js:478](docs/app.js:478), [docs/app.js:2483](docs/app.js:2483), [docs/app.js:2488](docs/app.js:2488), [docs/app.js:2731](docs/app.js:2731).
  - **Probleem:** het deelbericht opent `#/w/WEDSTRIJDCODE`, maar het persoonlijke-codeveld bestaat alleen op het beginscherm. De ontvanger landt dus op “Meedoen” en kan zich gemakkelijk nogmaals aanmelden. `DUO_MAAT` bestaat bovendien alleen in geheugen, wordt niet bij routewisseling of uitloggen gewist en wordt niet tegen de actuele state gecontroleerd.
  - **Scenario:** B opent het gedeelde bericht en ziet geen veld voor de ontvangen code. A vernieuwt de PWA voordat de code gedeeld is en raakt hem kwijt. Of A logt uit en als iemand anders in, waarna de oude bearer-code opnieuw kan worden getoond of gedeeld. Na verwijdering van B blijft het blok eveneens een ongeldige code tonen.
  - **Concreet fixvoorstel:** deel de tenant-homepage met de expliciete instructie “Kies Deelnemer en vul deze persoonlijke code in”, of maak een echte persoonlijke-code-deeplink. Breid het token-beveiligde `w_mijn_team` uit met de actuele duomaat en diens code, zodat herstel na herladen mogelijk is. Bind clientstate aan wedstrijdcode en team-ID en wis die bij routewisseling, uitloggen of een verdwenen duo. Bewaar de code niet onbeperkt los in `localStorage`.

- **P1 | Twee praktisch gelijke duonamen worden in het seizoen één deelnemer**

  - **Bestand en regel:** [review/database.sql:84](review/database.sql:84), [review/database.sql:346](review/database.sql:346), [review/database.sql:1065](review/database.sql:1065), [review/database.sql:1112](review/database.sql:1112).
  - **Probleem:** de daguitslag en vangsten zijn correct per team-ID gescheiden. Het seizoen gebruikt echter `lower(trim(naam))` als identiteit, terwijl de unieke teamconstraint hoofdlettergevoelig is. Dit is eerder gemeld en staat nog expliciet als open backlog in [codex-review-v10-status.md:106](review/codex-review-v10-status.md:106), dus niet afgehandeld.
  - **Scenario:** een duo meldt `Jan` en `jan` aan. Beide krijgen een eigen dagklassement en vangsten, maar `w_seizoen_stand` voegt hun punten en gewichten samen onder één seizoenssleutel. Daarmee klopt de aanname “seizoen hoeft niets van duo te weten” alleen zolang genormaliseerde namen uniek zijn.
  - **Concreet fixvoorstel:** gebruik structureel een stabiele seizoensdeelnemer-ID. Voor 12 september minimaal: weiger binnen één wedstrijd dubbele `lower(btrim(naam))`-waarden, zowel tussen duoleden als tegenover bestaande deelnemers. Controleer dezelfde invariant bij naamwijziging.
  - **Regressietest:** meld `Jan` plus `jan` aan en verwacht een domeinfout, niet twee teams die later in het seizoen samenvallen.

## P2

- **P2 | Exact gelijke duonamen geven een technische databasefout**

  - **Bestand en regel:** [review/database.sql:97](review/database.sql:97), [review/database.sql:353](review/database.sql:353), [docs/app.js:75](docs/app.js:75).
  - **Scenario:** beide naamvelden bevatten exact `Jan`. De tweede insert raakt de unieke constraint. De transactie wordt terecht volledig teruggedraaid, maar de client toont de ruwe constraintmelding omdat geen herkenbare foutcode wordt opgegooid.
  - **Concreet fixvoorstel:** valideer beide genormaliseerde namen vóór de inserts en geef bijvoorbeeld `duo_namen_gelijk`. Vertaal die fout in `FOUTEN`. Vang daarnaast bestaande-naamconflicten af als `naam_bestaat_al`.

De serverkant van de genoemde races is verder coherent: `w_join`, start, reset, deelnemerkeuze, beheerkeuze en verwijderen vergrendelen allemaal dezelfde wedstrijd-rij. Daardoor worden gelijktijdig kiezen, beheer tegenover deelnemer, verwijderen tegenover kiezen en reset tegenover kiezen geserialiseerd. `max_teams` telt terecht personen, de stek- en zonecapaciteit telt loteenheden, KOPPEL kan via `w_join` geen duo worden en aanmelden na de loting wordt geweigerd. Oude clients die `p_naam2` werkelijk weglaten blijven werken en de extra `duo`-responsvelden worden door de repositoryclient genegeerd.


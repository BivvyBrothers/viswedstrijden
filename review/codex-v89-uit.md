**Oordeel: twee middelzware bugs en één klein probleem.** Geen aangetoonde mogelijkheid om met alleen een kijkcode wedstrijdgegevens te wijzigen.

Gecontroleerd tegen de lokale v89-code en `review/database.sql`. De productie-RPC is niet gecontroleerd. Twee gerichte uitvoerchecks bevestigen de verborgen-tabroute en het gedrag zonder eigen team.

1. **Middel: kijker kan tijdens een rolwissel de oude deelnemerstab openen.**  
   **Bestand/functies:** `docs/app.js`, `route()`, `initWedstrijd()`, `activateTab()`, `renderVangsten()`.

   **Scenario:** een ingelogde deelnemer opent in hetzelfde document een kijklink. `route()` wist `STATE`, maar laat de oude DOM staan. Tot de kijkerstate binnenkomt, staat op de nu toegankelijke vangstentab nog de oude knop `#vangst-doorgeef`. Die roept `activateTab('team')` aan. De tabhandler controleert niet of de knop verborgen is of de rol toegang heeft. Daardoor opent de verborgen deelnemerstab met oude inhoud, mogelijk inclusief de persoonlijke code en duo-code.

   Bij een mislukte state-aanvraag blijft deze mogelijkheid bestaan. Na succesvol laden verdwijnt de doorgeefknop, maar `renderAlles()` sluit een inmiddels geopende teamtab niet zelf.

   **Voorstel:** controleer toegestane rol, zichtbaarheid en geladen state in de centrale tabhandler. Verberg bij iedere routewisseling onmiddellijk de deelnemeracties en wis gevoelige teaminhoud.  
   **Afbakening:** dit ontsluit eerder geladen gegevens op hetzelfde toestel. Het bewijst geen toegang tot andermans gegevens via alleen een kijkcode.

2. **Middel: kijkerskaart toont zonewedstrijden verkeerd.**  
   **Bestand/functies:** `review/database.sql`, `w_get_state_kijker()`; `docs/app.js`, `heeftZones()`, `zonesZijnStandaard()`, `renderKaart()`.

   **Scenario:** een wedstrijd gebruikt zones of slechts een selectie van stekken. De kijker-RPC levert `teams[].zone` en `stekken`, maar geen `wedstrijd.zones`. Daardoor:
   
   - retourneert `heeftZones()` altijd `false`;
   - verdwijnen ook bij de standaardindeling de zoneletters en zonelijnen;
   - verschijnen ongebruikte stekken buiten de wedstrijdindeling als ‘vrij’;
   - ontbreken zonenamen in de stektitels.

   **Voorstel:** voeg `'zones', w.zones` toe aan het wedstrijdobject van `w_get_state_kijker()`. Dit veroorzaakt nu geen crash, maar wel aantoonbaar verkeerde kaartinformatie.

3. **Laag: delen kan stil mislukken.**  
   **Bestand/functie:** `docs/app.js`, `initWedstrijd()` → `deelKijklink()`.

   **Scenario:** `navigator.share` bestaat, maar de aanroep mislukt. De lege `catch` behandelt iedere fout als annulering. De gebruiker krijgt geen melding en geen kopieeroptie.

   **Voorstel:** negeer alleen `AbortError`; probeer bij andere fouten `kopieerTekst(tekst)` en meld het resultaat.

De overige gevraagde controles:

- **Stek- en zoneklikken na laden:** geen bevoegdheidslek gevonden. De kijkroute gebruikt de kijkcode als sessiesleutel; het deelnemersteam onder de wedstrijdcode wordt niet hergebruikt. `adminKiesActief()` vereist bovendien organisatorrol. De muterende SQL-functies controleren wedstrijdcode plus token of pin.
- **`renderLoting()` zonder team:** werkt. `teamAanBeurt()` gebruikt alle teams; `mijnBeurtNu()` retourneert zonder eigen team `false`. De relevante velden zitten in de kijker-RPC.
- **Vangsten en deelafbeeldingen:** de benodigde foto-, naam-, gewicht- en tijdvelden worden geleverd. Deze deelacties wijzigen geen wedstrijdgegevens en voegen geen deelnemerscode of token toe.
- **Kijklink delen:** gebruikt uitsluitend `STATE.wedstrijd.kijk_code`.
- **`appendChild` bij rolwissels:** geen fout gevonden. Iedere aanroep herstelt de zichtbare rolvolgorde; verborgen knoppen blijven verborgen. Herstel van een organisatorpin roept opnieuw `renderTabs()` aan.
- **Vroege `activateTab('klassement')`:** geen null-crash. De handler schakelt panelen en roept `renderSnelVangst()` aan; bij kijkerrol stopt diens voorwaarde al op de rolcheck.
- **Kop en aantallen:** de RPC levert `mode` en altijd een teams-array. Individuele duoleden tellen terecht afzonderlijk; koppelteams tellen als koppels.

**Releaseadvies: herstel bevindingen 1 en 2 vóór vrijgave.**


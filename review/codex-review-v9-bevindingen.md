# Codex-review v9: beheerdersomgeving

Datum: 18 juli 2026

Scope: uitsluitend de verborgen KemblincK-beheerdersomgeving, client en server, op basis van commit `c99f2dc`. Er zijn geen live beheeracties uitgevoerd en er zijn geen wachtwoorden of andere geheime waarden bekeken of opgenomen.

## STORM-check

- Bronnen: `docs/app.js`, beide tenant-indexen, `docs/landing.js`, `review/database.sql`, `CLAUDE.md` en de eerdere v6-status. Voor Supabase-specifieke claims zijn de officiële pagina's [Database Functions](https://supabase.com/docs/guides/database/functions), [Securing your API](https://supabase.com/docs/guides/api/securing-your-api) en [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) gebruikt.
- Aannames: `review/database.sql` is de actuele export van de live functiedefinities, conform de projectafspraak. De werkelijke waarde en sterkte van het beheerderswachtwoord zijn onbekend en bewust niet onderzocht.
- Tegenperspectief: één beheerder, een wachtwoordmanager en de hobby-schaal verlagen de kans op misbruik. De impact van een geslaagde aanval blijft echter hoog, omdat één credential alle klantcodes, admin-pins en beheeracties ontsluit.
- Ontbrekende informatie: geen live database-advisors, verbindingslimieten, requestlogs, belastbaarheidstest of praktijktest met tien klanten. Daardoor zijn schaalbevindingen als P2 gewogen.
- Basis voor antwoord: voldoende voor de onderstaande autorisatie-, sessie-, robuustheids- en UI-bevindingen.

## Samenvatting

- P0: geen blocker gevonden.
- P1: drie belangrijke punten rond globale actie-scope, brute-forcebescherming en het wijzigen van het enige beheerderswachtwoord.
- P2: vier verbeterpunten rond sessie-opruiming, credentialduur, datalading en wachtwoordvelden.
- Positief: de vier `w_su_*`-functies controleren het beheerderswachtwoord voordat zij data lezen of wijzigen, gebruiken `SECURITY DEFINER` met een lege `search_path`, en de client escapet dynamische databasewaarden voordat deze in HTML komen.

## Bevindingen

### 1. P1 | Acties die per klant lijken te werken, wijzigen in werkelijkheid de hele database

- Bestand/regel: `review/database.sql:22-32`, `review/database.sql:1436-1458`, `docs/app.js:697-731` en `docs/nphv/index.html:231-252`.
- Wat er misgaat: het overzicht groepeert wedstrijden per klant en laat een klanttab kiezen, maar `alleen_lezen` en `organisator_wachtwoord` staan nog in de ene rij `wedstrijd.instellingen` met `id = 1`. De RPC's `w_su_alleen_lezen` en `w_su_org_wachtwoord` krijgen geen klant-id of slug. De gekozen klanttab heeft dus geen invloed op deze acties. Dit sluit aan op de bekende, nog onvoltooide tenancy-migratie, maar de beheerders-UI maakt de globale scope niet zichtbaar.
- Scenario: Patrick bekijkt de tab Demo en reset het organisatie-wachtwoord met het idee alleen de demo te wijzigen. De server wijzigt het gedeelde wachtwoord, waardoor ook NPHV het nieuwe wachtwoord krijgt. Hetzelfde geldt voor alleen-lezen: de knop blokkeert of activeert het aanmaken van wedstrijden voor alle omgevingen tegelijk.
- Concreet fixvoorstel: maak klantgebonden instellingen een harde voorwaarde vóór een tweede productieklant. Voeg bijvoorbeeld `wedstrijd.klant_instellingen` toe met `klant_id`, organisatie-wachtwoord, alleen-lezen en standaardzones. Laat beide RPC's een klant-id ontvangen en controleer die server-side. Tot die migratie klaar is: zet boven de instellingen een opvallende tekst "Globale instellingen voor alle omgevingen", toon de geselecteerde klant niet als context bij deze knoppen en vraag bij elke wijziging expliciet om bevestiging dat alle omgevingen worden geraakt.

### 2. P1 | `pg_sleep(0.5)` is geen rate-limit en maakt parallel misbruik relatief goedkoop

- Bestand/regel: `review/database.sql:1377-1388` en `review/database.sql:1390-1472`.
- Wat er misgaat: alle vier beheerder-RPC's zijn publieke `SECURITY DEFINER`-functies en gebruiken hetzelfde wachtwoord als enige autorisatie. Supabase bevestigt dat databasefuncties standaard door elke rol uitvoerbaar zijn, tenzij `EXECUTE` expliciet wordt ingetrokken. De vertraging van 0,5 seconde remt één seriële aanvaller, maar niet veel gelijktijdige verzoeken. Elk fout verzoek houdt bovendien databasewerk vast tijdens de slaap. Een aanvaller hoeft het wachtwoord dus niet te raden om op kleine schaal verbindingscapaciteit te verbruiken.
- Scenario: iemand haalt de openbare project-URL en publishable key uit `config.js` en stuurt parallel foutieve verzoeken naar meerdere `w_su_*`-endpoints. De pogingen lopen tegelijk en delen geen teller, backoff of lockout. De verborgen hashroute biedt hierbij geen extra bescherming.
- Concreet fixvoorstel: controleer nu dat het beheerderswachtwoord willekeurig en lang is, bij voorkeur minimaal 20 tekens uit de wachtwoordmanager. Voeg daarna een rate-limit vóór de database toe, specifiek voor de `w_su_*`-routes. Supabase documenteert hiervoor een Data API pre-requestcontrole per IP; een kleine Edge Function met IP-rate-limit is ook geschikt. Verleng `pg_sleep` niet, want dat vergroot het risico op verbindingsuitputting. Een globale mislukte-pogingenteller in `instellingen` is goedkoper, maar maakt opzettelijke lock-out mogelijk en is daarom alleen een tweede keus. De structureel beste vervolgstap is één Supabase Auth-gebruiker, `EXECUTE` intrekken van `PUBLIC` en `anon`, alleen `authenticated` toelaten en in elke functie de vaste beheerder-id controleren.

### 3. P1 | Het wijzigen van het enige beheerderswachtwoord kan een onduidelijke lock-out veroorzaken

- Bestand/regel: `docs/nphv/index.html:241-246`, `docs/app.js:1725-1733` en `review/database.sql:1461-1471`.
- Wat er misgaat: het nieuwe beheerderswachtwoord wordt één keer, gemaskeerd en zonder bevestigingsveld ingevoerd. De server wijzigt het direct. De client bewaart het nieuwe wachtwoord pas nadat het antwoord succesvol is ontvangen. Er is geen herstelroute in de app en geen idempotent retry-pad voor een verloren antwoord.
- Scenario: de database wijzigt het wachtwoord, maar de netwerkverbinding valt weg voordat het antwoord de browser bereikt. De client houdt dan het oude wachtwoord in `sessionStorage` en toont een netwerkfout, terwijl de server alleen het nieuwe wachtwoord accepteert. Bij een typefout werkt de huidige tab na een geslaagd antwoord nog gewoon, omdat precies die fout getypte waarde in de sessie wordt gezet; de lock-out wordt mogelijk pas zichtbaar nadat de tab is gesloten.
- Concreet fixvoorstel: voeg twee velden toe, "Nieuw wachtwoord" en "Herhaal nieuw wachtwoord", plus een toon/verbergknop. Gebruik `autocomplete="new-password"`, schakel de verzendknop uit tijdens de call en toon vóór uitvoering dat dit de enige beheerderstoegang wijzigt. Maak de servercall veilig herhaalbaar: als het huidige opgeslagen wachtwoord al gelijk is aan `p_nieuw`, mag dezelfde wijzigingspoging als succes terugkomen. Toon bij een netwerkfout expliciet dat de wijziging mogelijk al is uitgevoerd en laat eerst met het nieuwe wachtwoord controleren. Leg daarnaast een korte herstelprocedure via het Supabase-dashboard vast buiten de publieke repo.

### 4. P2 | De v6-opruiming kan bij een fout of late response worden overgeslagen

- Bestand/regel: `docs/app.js:289-300`, `docs/app.js:650-675` en `docs/app.js:1699-1708`.
- Wat er misgaat: bij het verlaten van `#/beheerder` wordt `wisSuScherm()` alleen aangeroepen als `SU_DATA` op dat moment truthy is. In `laadSu()` wist het foutpad eerst `SU_DATA`, maar roept het `wisSuScherm()` niet aan. Eerder gerenderde codes en pins blijven daardoor in de verborgen DOM staan. Daarnaast controleert de loginhandler na `await rpc(...)` niet of de route nog steeds `#/beheerder` is.
- Scenario 1: het overzicht staat open en "ververs" krijgt een netwerkfout. `suww` wordt verwijderd en het loginscherm verschijnt, maar de eerder gevulde `#su-wedstrijden` blijft verborgen in de DOM. Omdat `SU_DATA` al `null` is, ruimt een volgende routewisseling dit niet meer op.
- Scenario 2: Patrick logt in en gebruikt direct de browser-terugknop voordat de RPC klaar is. Het late antwoord vult daarna alsnog `SU_DATA`, slaat het wachtwoord op en rendert alle gevoelige gegevens in een inmiddels verborgen view.
- Concreet fixvoorstel: roep `wisSuScherm()` onvoorwaardelijk aan wanneer de route `#/beheerder` verlaat. Gebruik voor login en verversen een requestgeneratie of `AbortController`, en controleer na elke `await` opnieuw of de beheerderroute nog actief is voordat state, sessie of DOM wordt gevuld. Laat `laadSu()` alleen bij `beheerder_wachtwoord_onjuist` de credential verwijderen; toon bij een gewone netwerkfout een retry zonder de sessie stilletjes te beëindigen.

### 5. P2 | Het blijvende wachtwoord fungeert als sessietoken zonder vervaldatum

- Bestand/regel: `docs/app.js:217-225`, `docs/app.js:665-668`, `docs/app.js:1704-1706` en `docs/app.js:1720-1729`.
- Wat er misgaat: het platte beheerderswachtwoord staat de hele tabsessie in `sessionStorage` en gaat bij iedere beheerder-RPC opnieuw mee. Bij het openen van een wedstrijd wordt de overzichts-DOM gewist, maar `suww` blijft bewust aanwezig zodat teruggaan automatisch opnieuw inlogt. Er is geen inactiviteitslimiet.
- Scenario: een toekomstige same-origin XSS elders in de app hoeft geen token te misbruiken met een korte levensduur, maar kan het duurzame beheerderswachtwoord uitlezen en later opnieuw gebruiken. De huidige CSP, het ontbreken van externe scripts en consequent gebruik van `esc()` verlagen die kans aanzienlijk; daarom is dit voor de huidige schaal P2 en geen blocker.
- Concreet fixvoorstel: voeg minimaal een inactiviteitslimiet van bijvoorbeeld 15 minuten toe en wis `suww` bij expliciet verlaten van de supporttaak. Beter is een `w_su_login` die na wachtwoordcontrole een willekeurig, kortlevend token teruggeeft; bewaar server-side alleen een hash en vervaltijd en laat de overige RPC's dat token controleren. Supabase Auth met één vaste gebruiker is de nettere structurele variant en levert bestaande sessie- en rate-limitmechanismen.

### 6. P2 | Het overzicht haalt alle historische codes en pins van alle klanten tegelijk op

- Bestand/regel: `review/database.sql:1398-1433` en `docs/app.js:678-725`.
- Wat er misgaat: `w_su_overzicht` bouwt bij elke login en refresh één JSON-object met alle klanten, alle wedstrijden en per wedstrijd deelnemerscode, kijkcode en admin-pin. De UI toont maar één klanttab tegelijk, maar de gegevens van alle andere klanten blijven in `SU_DATA`. De relevante foreign-keykolommen hebben indexen, dus het huidige probleem is vooral payloadgrootte en onnodige blootstelling, niet direct een ontbrekende index.
- Scenario: bij tien klanten met jaren aan wedstrijden groeit iedere verversing mee met de volledige historie. Het scherm heeft alleen gegevens van de gekozen klant nodig, maar ontvangt en bewaart alle codes en pins. Zo wordt laden trager en is de hoeveelheid gevoelige data in één response groter dan nodig.
- Concreet fixvoorstel: laat `w_su_overzicht` alleen statistieken, instellingen en klantsamenvattingen teruggeven. Voeg een aparte `w_su_klant(p_token, p_klant, p_cursor)` toe voor de gekozen klant, standaard beperkt tot actieve en de meest recente wedstrijden. Gebruik cursorpaginering voor oudere wedstrijden. Dit maakt zoeken en inklappen in de UI ook eenvoudiger.

### 7. P2 | Wachtwoordvelden, bevestiging en foutmeldingen passen niet bij de handeling

- Bestand/regel: `docs/nphv/index.html:214-245`, dezelfde velden in `docs/demo/index.html:230-261`, `docs/app.js:27-30` en `docs/app.js:1716-1733`.
- Wat er misgaat: het organisatie-wachtwoord staat als zichtbaar `type="text"`; alle wachtwoordvelden gebruiken `autocomplete="off"`, terwijl Patrick juist een wachtwoordmanager gebruikt. De reset van het organisatie-wachtwoord heeft geen tweede bevestigingsstap. Tot slot gebruiken de serverchecks voor zes en twaalf tekens hetzelfde foutcodewoord `wachtwoord_te_kort`, terwijl de clienttekst altijd "minimaal 6 tekens" zegt.
- Scenario: tijdens schermdelen staat een nieuw organisatie-wachtwoord leesbaar in beeld. Enter voert de reset direct uit. Bij een beheerderswachtwoord van twaalf tekens met een afsluitende spatie laat de browser het formulier toe, maar de server trimt naar elf tekens en toont vervolgens de onjuiste melding dat zes tekens vereist zijn.
- Concreet fixvoorstel: gebruik voor login `autocomplete="current-password"` en voor beide nieuwe waarden `type="password"` plus `autocomplete="new-password"`. Voeg een toon/verbergknop en `maxlength` toe. Bevestig de organisatie-reset met de exacte scope en schakel de knop uit tijdens uitvoering. Gebruik aparte foutcodes voor het organisatie- en beheerderswachtwoord en weiger server-side dat beide wachtwoorden gelijk worden.

## Expliciet gecontroleerd en goedgekeurd

- Alle vier publieke `w_su_*`-functies roepen eerst `wedstrijd.su_check()` aan. Er is geen beheerderfunctie gevonden die de wachtwoordcheck overslaat.
- De `SECURITY DEFINER`-functies zetten `search_path` leeg en kwalificeren tabellen en functies met hun schema. In de gecontroleerde SQL is geen dynamische SQL aanwezig.
- `w_su_overzicht` geeft wel supportcodes en pins terug, maar geen beheerderswachtwoord, organisatie-wachtwoord, private VAPID-sleutel of push-secret.
- `renderSu()` gebruikt `esc()` voor klantnamen, slugs, wedstrijdnamen, codes, pins en seizoennaam voordat `innerHTML` wordt gevuld.
- De alleen-lezenknop vereist al een tweede tik binnen vijf seconden. Dat voorkomt de eenvoudigste misklik, maar maakt de globale scope nog niet duidelijk.
- De rootdoorstuurroute in `docs/landing.js` verwerkt `#/beheerder` correct en stopt geen credential in de URL.
- `node --check docs/app.js` is geslaagd en `APP_VERSION` plus alle tenantversies staan gelijk op 56.

## UI-voorstellen voor de beheerderspagina

1. **Maak scope de eerste visuele regel.** Toon bovenaan een vaste balk met "Geselecteerde klant: NPHV" of "Globale instelling: raakt alle omgevingen". Herhaal de naam in elke gevaarlijke knop, bijvoorbeeld "Zet NPHV op alleen-lezen".

2. **Vervang klanttabs door zoeken en selecteren.** Gebruik bij meer dan vijf klanten een zoekveld met een compacte keuzelijst en aantallen. Toon daarna alleen de gekozen klant. Voeg filters toe voor "Actief", "Komend" en "Afgelopen".

3. **Masker codes en pins standaard.** Toon bijvoorbeeld `••••` met aparte knoppen voor tonen en kopiëren. Bewaar de echte waarde niet in een zichtbaar `data-*`-attribuut; koppel de knop via een interne map of closure. Dit helpt vooral bij schermdelen en meekijkers, zonder support langzamer te maken.

4. **Zet gevaarlijke instellingen in één duidelijk blok.** Groepeer alleen-lezen, organisatie-wachtwoord en beheerderswachtwoord onder "Toegang en blokkades". Gebruik een korte bevestigingsmodal met doel, gevolg en annuleerknop. Schakel acties tijdens het verzoek uit en toon daarna een blijvende succesregel met tijdstip.

5. **Maak wedstrijdregels compacter en beter scanbaar.** Gebruik op desktop een tabelachtige lijst met vaste kolommen voor status, datum, teams en vangsten. Zet "Openen en beheren" als primaire rijactie en verplaats codes, pin en kopiëren naar een uitklapbare detailregel. Op mobiel blijven het losse, volle-breedterijen.

## Eindoordeel

De beheerderfuncties zijn niet onbeveiligd: iedere serveractie controleert dezelfde aparte credential, gevoelige configuratiesleutels worden niet teruggegeven en de client voorkomt in het gecontroleerde pad HTML-injectie. Het huidige ontwerp steunt echter vrijwel volledig op de sterkte van één wachtwoord. Voor de huidige ene productieklant is dat verdedigbaar als het wachtwoord lang en willekeurig is. Vóór een tweede productieklant zijn klantgebonden instellingen en echte rate-limiting geen luxe meer. De sessierace en het wachtwoordwijzigingspad kunnen onafhankelijk daarvan nu al goedkoop robuuster worden gemaakt.

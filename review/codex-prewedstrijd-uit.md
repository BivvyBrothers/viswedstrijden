## Oordeel

Niet veilig om ongewijzigd in te zetten op 12 september. De duo-loting zelf is grotendeels correct, maar ik zie zeven hoge risico’s. Vooral de offline wachtrij kan vangsten aan de verkeerde deelnemer koppelen, herstelbare fouten permanent blokkeren of dubbele vangsten veroorzaken.

## Korte STORM-check

- Bronnen: huidige `database.sql`, `app.js`, NPHV-markup, serviceworker en de drie edge-functionkopieën.
- Aanname: de RPC-definities zijn inderdaad de live definities, zoals je aangeeft.
- Tegenperspectief: handmatig vangsten toevoegen beperkt sommige gevolgen, maar voorkomt verkeerde scores en dubbele vangsten niet.
- Ontbreekt: live schema, live wedstrijddata en bevestiging dat productie exact deze edge functions en client serveert.
- Basis: voldoende voor een code-oordeel, niet voor een volledige productiebevestiging. De actuele Supabase-wijzigingen veranderen, voor zover uit de changelog blijkt, niets aan de hier beoordeelde Postgres-locks en tijdcontroles. Dit is een gevolgtrekking uit de [Supabase-changelog](https://supabase.com/changelog?types=breaking-change). De RPC-body’s blijven cruciaal omdat `SECURITY DEFINER` met de rechten van de functie-eigenaar draait. [Supabase-documentatie](https://supabase.com/docs/guides/database/functions)

## Hoog

1. Offline vangst kan bij de verkeerde deelnemer terechtkomen

Bestand: [docs/app.js:2126](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2126>), `verstuurWachtrij` rond regel 2175 en aanmaak item rond regel 2641.

Het wachtrij-item bewaart geen `team_id`. Bij verzending wordt opnieuw `sessie.team(item.code)` opgehaald. Als deelnemer A offline een vangst opslaat en daarna op hetzelfde toestel uitlogt of via herstel-login als deelnemer B inlogt, wordt de vangst met het token van B verstuurd. Bij een duo komt dit reëel voor wanneer van deelnemer wordt gewisseld.

Concrete oplossing: sla minimaal het oorspronkelijke `team_id` in elk wachtrij-item op. Verstuur alleen wanneer `sessie.team(item.code).id === item.team_id`. Laat het item anders staan met “log opnieuw in als [oorspronkelijke deelnemer]”. Het token kan daarna uit de huidige, gecontroleerde sessie komen.

2. Elke fout bij de late-RPC wordt definitief als “te laat” opgeslagen

Bestand: [docs/app.js:2197](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2197>), `verstuurWachtrij`.

Als `w_registreer_vangst_laat` een timeout, netwerkfout of tijdelijke serverfout geeft, zet de client het item direct op `te_laat`. Items met een status worden daarna nooit opnieuw geprobeerd. Dit is extra gevaarlijk wanneer de server de vangst al heeft opgeslagen maar alleen het antwoord verloren ging. De deelnemer krijgt dan het advies om hem handmatig te laten toevoegen, met kans op een dubbele vangst.

Concrete oplossing: alleen `te_lang_geleden`, `buiten_wedstrijdtijd` en echte validatiefouten definitief maken. Bij netwerkfouten, timeouts en 5xx het item zonder status laten staan en later opnieuw proberen.

3. Tijdelijke Storage-fout wordt permanent als ongeldige foto behandeld

Bestanden: [docs/app.js:138](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:138>), `uploadFoto`; [review/upload-vangstfoto.ts:99](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/upload-vangstfoto.ts:99>).

De edge function retourneert bij een Storage-probleem HTTP 502 met `upload_mislukt`. De client vertaalt iedere onbekende uploadfout naar `ongeldige_foto`. Die fout staat in `WACHTRIJ_DEFINITIEF`, waarna de vangst permanent wordt geweigerd.

Concrete oplossing: geef `upload_mislukt` apart door. Alleen echte 4xx-validatiefouten zijn definitief. Netwerkfouten en 5xx moeten in de wachtrij blijven. Voeg tevens een uploadtimeout met `AbortController` toe.

4. “Kies eerst je plek” wordt ten onrechte als definitieve afwijzing opgeslagen

Bestanden: [docs/app.js:2166](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2166>); [review/database.sql:600](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:600>), `w_registreer_vangst`.

Als de loting om 09.00 uur nog niet helemaal klaar is en iemand al een vangst invoert, wordt `kies_eerst_je_plek` permanent als `geweigerd` opgeslagen. Nadat de organisator alsnog een plek toewijst, wordt de vangst niet opnieuw verstuurd.

Concrete oplossing: verwijder `kies_eerst_je_plek` uit `WACHTRIJ_DEFINITIEF`. Laat deze fout automatisch opnieuw proberen nadat de state een plek voor het team bevat.

5. Geldige vangsten in de laatste 15 seconden worden volledig geblokkeerd

Bestanden: [docs/app.js:2632](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2632>); [review/database.sql:598](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:598>), `w_registreer_vangst`.

De server accepteert registraties tot de echte eindtijd. De client weigert echter alles in de laatste 15 seconden, zelfs duurzaam opslaan in IndexedDB. Bovendien wordt `gemaakt_op` pas ná fotocompressie vastgelegd. Een telefoon die langer dan verwacht comprimeert kan daardoor een vóór 11.30 uur ingediende vangst een tijdstip ná 11.30 uur geven.

Concrete oplossing: leg `ingediendOp = Date.now()` direct bij het submit-event vast. Sta opslaan in de wachtrij toe zolang dit tijdstip niet na de server-eindtijd ligt. Laat de server beslissen of directe registratie of late goedkeuring nodig is.

6. Zonder IndexedDB kan een verloren antwoord een dubbele vangst veroorzaken

Bestanden: [docs/app.js:2664](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2664>); [review/database.sql:614](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:614>), `w_registreer_vangst`.

In privémodus of bij een IndexedDB-fout gebruikt de client de directe route. Als de registratie slaagt maar het antwoord verloren gaat, uploadt een herhaling dezelfde foto onder een nieuw willekeurig pad. De server ziet daardoor geen idempotente herhaling en telt de vangst tweemaal.

Concrete oplossing: voeg ook aan deelnemersregistraties een vaste `p_client_id` toe. Maak deze database-hard uniek per wedstrijd en laat iedere retry dezelfde ID gebruiken. Idempotentie uitsluitend op `foto_path` is onvoldoende.

7. De loting kan tijdens de lopende wedstrijd worden gereset

Bestanden: [review/database.sql:718](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:718>), `w_admin_reset_loting`; [docs/app.js:3154](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:3154>).

Reset wordt na de start niet geblokkeerd. Alleen actieve vangsten blokkeren reset. Vangsten op `wacht` of `verwijderd` doen dat niet. Een reset om bijvoorbeeld 09.05 uur kan alle plekken wissen en de status terugzetten op `aanmelden`. Daardoor kunnen nieuwe deelnemers zich tijdens de wedstrijd aanmelden. `w_registreer_vangst` controleert een ontbrekende plek alleen bij status `stekkeuze`, dus na de reset kunnen oningedeelde deelnemers toch vangsten registreren.

Concrete oplossing: blokkeer reset server-side zodra `now() >= start_ts` of zodra enige vangst met status `actief` of `wacht` bestaat. Maak voor echte calamiteiten een aparte, expliciete beheerprocedure.

## Middel

8. De tiebreak “vroegst gevangen” gebruikt feitelijk het moment van serverontvangst

Bestanden: [docs/app.js:1567](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:1567>), `klassementRijen`; [review/database.sql:1136](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:1136>), `w_seizoen_stand`.

De client en het seizoensklassement gebruiken `created_at`. Bij een offline vangst is dat het tijdstip waarop de telefoon later verbinding kreeg. `gevangen_op` wordt niet in de actieve state teruggegeven. Een goedgekeurde offline vangst kan hierdoor de verkeerde tiebreakpositie krijgen.

Concrete oplossing: maak een expliciete keuze. Als “vroegst gevangen” werkelijk de regel is, gebruik overal `coalesce(gevangen_op, created_at)`. Als telefoontijd niet betrouwbaar genoeg is, noem en hanteer de regel consequent als “vroegst geregistreerd”.

9. Deelnemers zonder vangst ontbreken volledig in het dagklassement

Bestand: [docs/app.js:1617](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:1617>), `klassementRijen`, vooral regel 1631.

De functie filtert alle rijen met nul vangsten weg. Bij een duo met één vanger verschijnt daardoor maar één duolid. De andere heeft wel een losse score van nul, maar is nergens in de daguitslag of deelafbeelding zichtbaar. Het seizoensklassement behandelt niet-vangers wel als deelnemer, dus de twee uitslagen zijn niet gelijk opgebouwd.

Concrete oplossing: behoud alle teams in `klassementRijen` en toon nulvangers onderaan met `0,00 kg`.

10. Herstel-login op het beginscherm slikt netwerkfouten in

Bestand: [docs/app.js:497](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:497>), formulier `form-deelnemer`.

Elke fout van `w_login_deelnemer`, ook een timeout, wordt behandeld alsof de invoer een wedstrijdcode was. De gebruiker komt dan op `#/w/PERSOONLIJKECODE` en ziet “wedstrijd niet gevonden”.

Concrete oplossing: alleen naar de wedstrijdroute gaan wanneer de RPC succesvol `null` teruggeeft. Toon bij netwerk- en serverfouten een herstelbare fout op het formulier. Het herstel-formulier binnen de wedstrijd doet dit al correct.

11. Teamcodes-cache kan na verwijderen en opnieuw aanmelden verouderd blijven

Bestand: [docs/app.js:3169](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:3169>), `renderBeheer`.

De cachesleutel bestaat alleen uit wedstrijdcode en aantal teams. Als één deelnemer wordt verwijderd en een andere zich aanmeldt, blijft het aantal gelijk. De cache bevat dan nog de verwijderde team-ID en de nieuwe persoonlijke code blijft als puntjes staan.

Concrete oplossing: gebruik de gesorteerde team-ID’s in de cachesleutel of leeg `TEAMCODES_CACHE` bij iedere wijziging van de teamset.

12. Wedstrijdtijden kunnen bestaande vangsten ongeldig maken

Bestand: [review/database.sql:741](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:741>), `w_admin_tijden`.

De organisator kan start en einde vrij wijzigen nadat er vangsten zijn geregistreerd. Bestaande actieve vangsten blijven meetellen, ook als ze daarna buiten het nieuwe tijdvenster vallen. Tegelijk kunnen nog wachtende offline vangsten door het nieuwe venster worden geweigerd. Registratie lockt bovendien niet dezelfde wedstrijd-rij, waardoor tijdwijziging en registratie gelijktijdig uiteenlopende beslissingen kunnen nemen.

Concrete oplossing: blokkeer tijdwijzigingen na de eerste actieve of wachtende vangst, tenzij een expliciete correctieprocedure wordt gebruikt. Lock bij registratie dezelfde wedstrijd-rij.

## Laag

13. Gelijktijdige naamswijzigingen kunnen alsnog case-insensitieve duplicaten maken

Bestand: [review/database.sql:434](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:434>), `w_wijzig_team`.

Normale wijzigingen controleren duplicaten correct. Twee verschillende teams kunnen echter gelijktijdig naar bijvoorbeeld `Jan` en `jan` wijzigen, omdat alleen de eigen teamrij wordt gelockt. De gewone unieke constraint accepteert verschillende hoofdletters, terwijl het seizoen beide namen samenvoegt via `lower(trim(naam))`.

Concrete oplossing: een unieke expressie-index op wedstrijd-ID plus `lower(btrim(naam))`, aangevuld met vertaling van de constraintfout naar `naam_bestaat_al`.

## Gecontroleerd en correct bevonden

- `w_join` lockt de wedstrijd en telt een duo als twee deelnemers voor `max_teams`.
- Duo’s krijgen twee losse teamrijen, tokens, codes en vangsten.
- `w_start_stekkeuze` telt een duo als één loteenheid en geeft beide leden hetzelfde lotnummer.
- `w_kies_zone`, `w_kies_stek` en `w_admin_kies` locken dezelfde wedstrijd-rij en schrijven de keuze naar beide duoleden.
- Als beide duoleden tegelijk verschillende zones kiezen, wint één transactie. De tweede krijgt daarna `al_gekozen`. Er ontstaat geen gesplitst duo.
- `w_admin_kies` mag een willekeurig duolid ontvangen en werkt dan beide rijen bij.
- Verwijderen van één duolid voor, tijdens of na de loting maakt de partner solo en behoudt diens lotnummer en eventuele plek.
- Verwijderen van een team met enige historische vangst wordt altijd geweigerd, ook nadat de vangst soft-deleted is. Dat beschermt auditdata, maar betekent dat zo’n team nooit echt verwijderd kan worden.
- `w_admin_reset_loting` wist nu ook `zone`.
- Gewone vangsten tellen alleen mee tussen start en einde. Late vangsten krijgen status `wacht` en tellen pas na goedkeuring mee.
- Correctie, soft-delete en handmatig toevoegen werken per losse team-ID, dus ook per afzonderlijk duolid.
- De kijker-state bevat beide duoleden en actieve vangsten. De kijker gebruikt een aparte RPC en krijgt geen persoonlijke codes of admin-pin.
- `SESSIE_GEN` beschermt tegen antwoorden van een verlaten route en `STATE_BEZIG` voorkomt overlappende polls.
- De nachtwedstrijd zelf is technisch correct verwerkt: geen “vandaag”-logica, absolute timestamps, beide datums worden getoond en de klok kan meer dan 24 uur tonen.
- `APP_VERSION` en `docs/nphv/version.json` staan beide op 78.
- `node --check` slaagde voor `app.js`, de NPHV-serviceworker, `config.js` en `kaart.js`.

## Niet kunnen verifiëren

- Of de live database werkelijk exact deze functies bevat. De kop van `database.sql` noemt nog 13 augustus en app v66, terwijl de client op v78 staat.
- De actuele tabelconstraints en indexen. Het bestand zegt zelf dat de tabeldefinities niet volledig zijn bijgewerkt. Daardoor kon ik bijvoorbeeld geen live unieke constraint op `vangsten.client_id` bevestigen.
- Of de gedeployde edge functions exact overeenkomen met de reviewkopieën.
- Of productie op dit moment versie 78 serveert. De directe productiecontrole en de Browser-skill konden in deze omgeving niet worden gestart.
- De echte wedstrijdinstellingen, start- en eindtijd, zones, capaciteit, teamtelling en de huidige `duo_id`-paren.
- Gedrag op echte iPhones met volle opslag, privémodus, app-kill, carrier-NAT, zeer traag bereik en herstel over middernacht.
- SQL-races tegen de live database. Ik heb bewust geen muterende tests uitgevoerd omdat er al echte deelnemers zijn.
- Er is geen uitvoerbare geautomatiseerde testset in deze checkout aangetroffen voor duo-races, offline retries, eindtijd of beheeracties.


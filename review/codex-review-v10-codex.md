## Oordeel

De app is functioneel verzorgd, maar nog niet veilig schaalbaar als echte multi-tenantdienst. Ik vond 3 bevindingen met hoge ernst, 10 met middelhoge ernst en 2 met lage ernst. De belangrijkste blokkade is dat klanten alleen in de presentatie gescheiden zijn. De server hanteert nog één globale organisatietoegang.

Dit is een statische review van de actuele repo en de laatste vijf commits. Ik heb de live database, Storage-policies, Edge Function-configuratie en eventuele externe rate-limits niet kunnen testen.

## Hoge ernst

**1. Organisatoren kunnen alle klanten beheren**

Ernst: hoog. Bestand: [review/database.sql:880](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:880>), functies `w_org_wedstrijden`, `w_maak_wedstrijd`, `w_org_verwijder_wedstrijd` en alle seizoens-RPC’s.

Probleem en scenario: het organisatiewachtwoord, de standaardzones, seizoenen en alleen-lezenstatus zijn globaal. `w_org_wedstrijden` retourneert alle wedstrijden inclusief beheerpins. `w_maak_wedstrijd` accepteert iedere bestaande klantslug na controle van hetzelfde globale wachtwoord. `w_org_verwijder_wedstrijd` controleert helemaal geen klant. Zodra klant A organisatortoegang krijgt, kan die klant wedstrijden van klant B bekijken, openen, wijzigen, koppelen aan seizoenen en verwijderen. De ene KemblincK-beheerder verandert niets aan dit autorisatiegat, omdat de organisator een andere rol is.

Concrete fix: maak instellingen en seizoenen klantgebonden. Laat iedere organisatiecredential server-side aan precies één `klant_id` koppelen. Filter en valideer `klant_id` in iedere `w_org_*`-RPC. Vertrouw niet op `p_klant` of `TENANT` uit de openbare client. Behoud alleen de KemblincK-beheerder als globale rol.

**2. Foto-upload is niet aan een wedstrijdteam te autoriseren**

Ernst: hoog. Bestand: [docs/app.js:89](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:89>) en [review/database.sql:155](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:155>).

Probleem en scenario: de browser uploadt rechtstreeks met de publieke sleutel. Het uploadverzoek bevat geen teamtoken, persoonlijke code of beheersessie. Een Storage-policy kan daardoor hooguit bucket, pad en bestandstype controleren, maar niet bewijzen dat de uploader bij het team hoort. Een aanvaller kan dezelfde openbare clientgegevens gebruiken om grote aantallen toegestane afbeeldingen te uploaden. Niet-geregistreerde bestanden worden nooit door de databasecleanup gevonden en veroorzaken opslagkosten of quota-uitputting.

Concrete fix: trek anonieme `INSERT` op de bucket in. Laat een Edge Function eerst wedstrijdcode plus teamtoken of beheerspin controleren en daarna een servergekozen pad en een kortlevende uploadmogelijkheid uitgeven. Voeg periodieke weesbestandcleanup toe. Supabase bevestigt dat uploads via policies op `storage.objects` moeten worden geautoriseerd; een publieke bucket maakt alleen het ophalen publiek, niet automatisch het uploaden. [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control).

**3. Publieke toegangscodes en wachtwoord-RPC’s zijn niet beschermd tegen geautomatiseerde aanvallen**

Ernst: hoog. Bestand: [review/database.sql:162](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:162>), [review/database.sql:366](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:366>), [review/database.sql:865](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:865>) en [review/database.sql:1377](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:1377>).

Probleem en scenario: persoonlijke codes hebben 32 mogelijke tekens en zes posities, dus ongeveer 30 bits zoekruimte. `w_login_deelnemer` geeft bij een geldige code direct het teamtoken terug. Naarmate het aantal klanten en teams groeit, neemt de kans op een geldige treffer lineair toe. De repo toont geen pre-database throttling. Daarnaast houdt `pg_sleep(0.5)` bij onjuiste organisatie- en beheerderswachtwoorden juist een databaseverbinding bezet. Veel parallelle ongeldige verzoeken kunnen daardoor de databasepool uitputten, ook zonder een wachtwoord te raden. Een externe WAF die niet in de repo staat kan dit risico verlagen, maar is hier niet aantoonbaar.

Concrete fix: plaats gevoelige login- en beheeracties achter een Edge Function of Supabase Auth met IP- en accountgebonden rate-limits. Maak persoonlijke herstelcodes minimaal 12 willekeurige tekens of gebruik opaque tokens. Trek `EXECUTE` op beheer-RPC’s in voor `anon` en laat alleen de vertrouwde serverlaag ze aanroepen. Functies zijn standaard uitvoerbaar voor publieke rollen tenzij dit expliciet wordt ingetrokken. [Supabase functieprivileges](https://supabase.com/docs/guides/database/functions).

## Middelhoge ernst

**4. De wedstrijdlevenscyclus wordt niet consequent server-side afgedwongen**

Ernst: middel. Bestand: [review/database.sql:332](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:332>), [review/database.sql:504](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:504>) en [review/database.sql:608](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:608>).

Probleem en scenario: `w_join` controleert alleen `status`, niet of de eindtijd voorbij is. `w_registreer_vangst` controleert alleen het tijdvenster, niet of de loting klaar is of het team een plaats heeft. `w_admin_reset_loting` mag ook na de start en na geregistreerde vangsten worden uitgevoerd. Daardoor kan iemand zich na afloop aanmelden bij een nooit gelote wedstrijd, kunnen teams tijdens een niet-afgeronde loting al vangsten registreren en kan een reset bij een afgelopen wedstrijd alle plaatsen wissen terwijl de vangsten blijven staan.

Concrete fix: leg een expliciete state machine vast. Sluit aanmelden uiterlijk bij de eindtijd, sta deelnemersregistratie alleen toe bij `status = 'klaar'` en een toegewezen plaats, en laat reset alleen vóór de start en zonder vangsten toe. Maak voor noodherstel een aparte, expliciete beheeractie.

**5. De server laat 48 koppels toe terwijl slechts 47 geldige paren bestaan**

Ernst: middel. Bestand: [review/database.sql:121](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:121>) en [review/database.sql:573](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:573>).

Probleem en scenario: de capaciteitscheck deelt 96 stekken door twee. De fysieke ring bestaat echter uit segmenten van 91 en 5 opeenvolgende posities. Daarin passen maximaal `floor(91/2) + floor(5/2) = 47` disjuncte paren. Een wedstrijd met 48 koppels begint dus normaal, maar minstens één koppel kan nooit twee aangrenzende stekken kiezen. Ongunstige eerdere keuzes kunnen ook bij minder koppels de resterende stekken fragmenteren.

Concrete fix: bereken de maximale matching van de nog vrije ringposities. Controleer dit zowel vóór de loting als na iedere voorgestelde keuze. Een eenvoudiger alternatief is vooraf 47 niet-overlappende paren te genereren en koppels alleen uit die paren te laten kiezen.

**6. Late state-antwoorden kunnen wedstrijden en rollen door elkaar halen**

Ernst: middel. Bestand: [docs/app.js:293](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:293>) en [docs/app.js:502](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:502>), functie `laadState`.

Probleem en scenario: `laadState` legt code en rol niet lokaal vast en heeft geen generatieteller. Open wedstrijd A op een trage verbinding en navigeer direct naar kijkroute B. Als A als laatste antwoordt, overschrijft het antwoord `STATE` en rendert de app gegevens van A onder URL en rol B. De recente SU-code heeft hiervoor wel `SU_REQ`, maar de algemene wedstrijdflow niet.

Concrete fix: leg bij aanvang `code`, `kijker` en een oplopend requestnummer vast. Verwerk het antwoord alleen als alle drie nog actueel zijn. Annuleer oude fetches aanvullend met `AbortController`.

**7. Eén pushendpoint kan maar bij één wedstrijd horen**

Ernst: middel. Bestand: [review/database.sql:109](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:109>) en [docs/app.js:1785](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:1785>).

Probleem en scenario: `push_subs.endpoint` is globaal uniek en de upsert verplaatst de rij naar de nieuwste wedstrijd. De client bewaart daarentegen per code een vlag. Wie binnen één tenant wedstrijd A en daarna B volgt, ziet beide lokaal als actief, maar ontvangt alleen B. Meldingen uitzetten bij A verwijdert vervolgens de serverinschrijving van B en schrijft B lokaal niet terug naar uit.

Concrete fix: gebruik een unieke combinatie van `wedstrijd_id` en `endpoint`. Laat uitschrijven ook wedstrijdcode plus endpoint ontvangen en alleen die koppeling verwijderen. Roep `PushSubscription.unsubscribe()` pas aan wanneer lokaal geen wedstrijdkoppelingen meer bestaan.

**8. Aanmaken en handmatige vangsten zijn niet idempotent**

Ernst: middel. Bestand: [docs/app.js:468](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:468>), [review/database.sql:924](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:924>), [docs/app.js:2243](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2243>) en [review/database.sql:810](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:810>).

Probleem en scenario: het formulier voor een nieuwe wedstrijd blokkeert herhaald verzenden niet en de server kent geen idempotentiesleutel. Twee tikken of een retry na een verloren antwoord maken twee wedstrijden. Bij een handmatige vangst zonder foto maakt een retry twee vangsten; met foto geeft de tweede poging alleen een unieke-sleutelfout, hoewel de eerste mogelijk is gelukt.

Concrete fix: genereer per mutatie een UUID en sla die in een unieke kolom op. Laat een herhaalde UUID het oorspronkelijke resultaat teruggeven. Het tijdelijk uitschakelen van knoppen blijft nuttig, maar vervangt server-idempotentie niet.

**9. De daguitslag gebruikt de verkeerde tiebreak en negeert de gekozen dagregel**

Ernst: middel. Bestand: [docs/app.js:1280](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:1280>), [review/database.sql:272](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:272>) en [review/database.sql:1262](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:1262>).

Probleem en scenario: vangsten komen nieuw naar oud binnen. Bij twee even zware grootste vissen bewaart `klassementRijen` de nieuwste, terwijl het commentaar en de sortering de vroegste bedoelen. Daarnaast retourneert `w_get_state` geen `dag_regels`, zodat het gewone klassement en de gedeelde uitslag altijd de app-tiebreak gebruiken. Bij de ingestelde Sportvisunie-regel kan de pagina dus plaatsen 1 en 2 tonen terwijl het seizoen beide teams plaats 1 geeft.

Concrete fix: laat bij gelijk gewicht expliciet de vroegste `created_at` winnen. Retourneer de effectieve `ex_aequo`-regel in de state en gebruik één gedeelde rangschikkingsfunctie voor live klassement, eindafbeelding en seizoensberekening.

**10. Seizoensdeelnemers worden op een botsingsgevoelige naamtekst samengevoegd**

Ernst: middel. Bestand: [review/database.sql:78](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:78>) en [review/database.sql:1292](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:1292>).

Probleem en scenario: de teamconstraint is hoofdlettergevoelig op alleen `naam`, terwijl de seizoenssleutel namen lowercase maakt en koppelnamen sorteert. `Jan` en `jan` mogen dus in dezelfde wedstrijd bestaan maar worden in het seizoen één deelnemer. Ook `Jan & Piet` en `Piet & Jan` kunnen als twee teams worden aangemeld en daarna worden samengevoegd. Punten en gewichten worden dubbel opgeteld en de resultatenrij kan meer cellen bevatten dan er wedstrijden zijn.

Concrete fix: introduceer een stabiele `seizoen_deelnemer_id` en koppel teams expliciet. Als tussenoplossing: sla een genormaliseerde deelnemerssleutel op, maak die binnen een wedstrijd uniek en groepeer vóór het berekenen van plaatsen.

**11. Alle clients pollen volledige, onbeperkte histories**

Ernst: middel. Bestand: [docs/app.js:321](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:321>), [review/database.sql:272](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:272>), [docs/app.js:341](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:341>) en [review/database.sql:1390](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:1390>).

Probleem en scenario: iedere wedstrijdclient downloadt elke zes seconden alle teams en alle actieve vangsten. De organisatie downloadt elke tien seconden alle oude en nieuwe wedstrijden met tellingen. `w_su_overzicht` retourneert alle klanten, wedstrijden en pins in één payload en voert meerdere gecorreleerde tellingen per klant en wedstrijd uit. Bij veel vangsten, kijkers en klanten groeit zowel databasewerk als netwerkverkeer lineair en onbeperkt.

Concrete fix: splits samenvatting, recente vangsten en beheerdata. Gebruik een wijzigingsversie of cursor voor vangsten, server-side geaggregeerde klassementen en keysetpaginering voor organisatie en beheer. Stop achtergrondpolling van het volledige organisatiearchief.

**12. Gelijktijdige beheerderswachtwoordwijzigingen kunnen de enige beheerder buitensluiten**

Ernst: middel. Bestand: [review/database.sql:1467](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:1467>), functie `w_su_wachtwoord`.

Probleem en scenario: de functie controleert het oude wachtwoord en voert daarna een losse update uit zonder rijvergrendeling. Twee tabbladen of apparaten kunnen gelijktijdig hetzelfde oude wachtwoord goedkeuren en verschillende nieuwe wachtwoorden schrijven. De laatste update wint; de eerste client meldt succes en bewaart een wachtwoord dat niet meer werkt. Omdat er precies één beheerder is, is het gevolg een volledige lock-out.

Concrete fix: lock rij `instellingen.id = 1` onmiddellijk met `FOR UPDATE`. Controleer onder die lock eerst het idempotente retrypad, daarna het oude wachtwoord en vervolgens de gelijkheidsregels. Pas dezelfde lock toe op de organisatiecredentialwijziging.

**13. Verwijderen van een wedstrijd ruimt maximaal 1000 foto’s op**

Ernst: middel. Bestand: [review/wis-fotos.ts:23](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/wis-fotos.ts:23>) en [review/database.sql:969](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:969>).

Probleem en scenario: de Edge Function kapt de lijst af met `slice(0, 1000)`. Daarna verwijdert de database de wedstrijd en alle verwijzingen. Bij een grote wedstrijd met meer dan 1000 foto’s blijven de overige bestanden achter, zonder databasepad om ze later nog doelgericht te verwijderen.

Concrete fix: verwerk alle paden in server-side batches en bewaar cleanupwerk in een tabel met status en retries. Verwijder de wedstrijd pas nadat de taak duurzaam is vastgelegd.

## Lage ernst

**14. Organisatie-uitloggen laat beheerpins in geheugen en verborgen DOM staan**

Ernst: laag. Bestand: [docs/app.js:442](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:442>), [docs/app.js:579](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:579>) en [docs/app.js:934](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:934>).

Probleem en scenario: uitloggen wist `sessionStorage`, maar niet `ORG_DATA`, `ORG_SEIZOENEN` of de organisatiecontainers. De wedstrijdkaarten bewaren pins bovendien in `data-pin`. Op een gedeeld apparaat blijven deze waarden na uitloggen via DOM-inspectie of later geïnjecteerde code leesbaar. De recente SU-refactor heeft dit voor SU-pins juist wel opgelost.

Concrete fix: voeg `wisOrgScherm()` toe en roep die bij uitloggen en routewissels aan. Leeg gevoelige DOM en globale state. Zoek pins bij gebruik op in actuele state in plaats van ze in `data-*` te zetten.

**15. `wedstrijdFase` gebruikt in de beheerdersomgeving een stilstaande tijd**

Ernst: laag. Bestand: [docs/app.js:697](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:697>), [docs/app.js:724](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:724>) en [docs/app.js:798](</Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:798>).

Probleem en scenario: `renderSu` gebruikt steeds dezelfde `SU_DATA.server_now`. De beheerpagina pollt niet automatisch. Wie om 07:50 inlogt bij een wedstrijd die om 08:00 begint, kan om 09:00 nog steeds “aanmelden open” zien, ook na lokaal zoeken of uitklappen.

Concrete fix: bewaar bij laden het verschil tussen servertijd en `Date.now()` en bereken bij iedere render een actuele tijd. Laat de faseweergave minimaal eenmaal per minuut opnieuw renderen.

## Beoordeling van de recente commits

De v57-hardening is grotendeels effectief: late SU-antwoorden worden genegeerd, netwerkfouten beëindigen de sessie niet meer en pins staan niet meer in SU-data-attributen. De ontbrekende database-lock bij het wijzigen van het enige beheerderswachtwoord blijft echter een serverrace.

De v58-herbouw introduceert geen aangetoonde XSS. Alle namen, slugs, codes en seizoensnamen in de nieuwe beheerweergave worden ge-escaped. De zoek- en filterfunctie werkt alleen client-side en lost de onbeperkte serverpayload niet op.

De v59-helpers `wedstrijdFase` en `wedstrijdKenmerken` worden consequent in beide lijsten gebruikt en escapen de seizoensnaam correct. Het aantoonbare probleem is de stilstaande SU-tijd, niet de HTML-opbouw.

Ik vond geen direct exploiteerbare SQL-injectie of DOM-XSS. De `SECURITY DEFINER`-functies gebruiken bij de kritieke paden een lege `search_path`, en de kijkerstate geeft geen deelnemerscode of beheerspin terug.

Verificatie: `node --check` slaagt voor `app.js`, beide tenantserviceworkers en `landing.js`; alle versiebestanden staan op 59; beide tenantpagina’s hebben dezelfde vaste DOM-id’s; `git diff --check` is schoon. Er zijn geen bestanden gewijzigd.


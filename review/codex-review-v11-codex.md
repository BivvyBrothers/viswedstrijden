# Codex-review v11 (13 aug 2026): diepe review van de hele app

Rauwe output van `codex exec` (read-only), gevraagd op de volledige codebase na
v65. Niet gefilterd; verificatie en besluiten komen in het statusdocument.

## Uitkomst

Ik vond 1 P0, 10 P1- en 7 P2-bevindingen. Ik heb de eerdere statusdocumenten meegenomen en geen afgeronde punten herhaald, behalve waar de huidige oplossing aantoonbaar onvolledig is.

Korte STORM-check: de analyse steunt op `CLAUDE.md`, alle reviewstatussen, de volledige actuele SQL, frontend, service workers, tenantconfiguraties en drie edgefuncties. De belangrijkste onzekerheid is dat `review/database.sql` zichzelf tegenspreekt als volledige export. Daardoor kan ik sommige live RLS- en constraintclaims niet bevestigen zonder de gedeployde database te inspecteren.

## P0

- **P0 | Afgetrokken wedstrijden beïnvloeden alsnog de eindrangschikking van een seizoen**

  - **Bestand en regel:** [database.sql:994](review/database.sql:994), [database.sql:1007](review/database.sql:1007), [database.sql:1017](review/database.sql:1017), [seizoensklassement-ontwerp.md:37](seizoensklassement-ontwerp.md:37).
  - **Probleem:** `gewicht_geteld` sluit vervallen resultaten correct uit, maar `gewicht_totaal` en `hoogste_dag` worden over alle wedstrijden berekend. Beide waarden worden daarna als beslissende ex-aequoregels gebruikt. Een wedstrijd die volgens de aftrekregel niet meetelt, kan dus toch de kampioen bepalen. Dit wijkt af van het vastgelegde ontwerp.
  - **Reproductie:** maak een seizoen met drie wedstrijden en één aftrekresultaat. Geef twee deelnemers dezelfde getelde eindscore en dezelfde getelde gewichten. Geef deelnemer A in diens vervallen wedstrijd een zwaardere vangst dan deelnemer B. A wordt vervolgens hoger gerangschikt, hoewel die wedstrijd niet zou mogen meetellen.
  - **Fix:** bereken afzonderlijke velden zoals `gewicht_geteld` en `hoogste_dag_geteld`, beide met `FILTER (WHERE NOT vervallen)`, en gebruik uitsluitend die velden in de eindrangschikking. Als totaalgewicht inclusief vervallen wedstrijden nuttig is voor weergave, houd dat dan als apart informatief veld.

## P1

- **P1 | De server gebruikt één NPHV-stekring voor alle tenants**

  - **Bestand en regel:** [database.sql:121](review/database.sql:121), [database.sql:381](review/database.sql:381), [database.sql:554](review/database.sql:554), [demo/kaart.js:3](docs/demo/kaart.js:3).
  - **Probleem:** de frontendkaart is tenantgebonden, maar `stek_ring` bevat één globale NPHV-volgorde zonder `klant_id`. Keuzevalidatie, koppelcapaciteit en standaardzones gebruiken deze globale ring. De demokaart bevat bijvoorbeeld stekken 12, 14, 16 en 18, terwijl die niet in de NPHV-ring voorkomen.
  - **Reproductie:** open een wedstrijd voor de demotenant en probeer in vrije stekkeuze stek 12 te kiezen. De kaart biedt deze stek aan, maar de RPC retourneert `onbekende_stek`. Omgekeerd kan een handmatig RPC-verzoek een NPHV-stek accepteren die niet op de tenantkaart staat.
  - **Fix:** maak de stekring tenantgebonden, bijvoorbeeld `(klant_id, positie, stek)`, en leid `klant_id` altijd af van de wedstrijd. Gebruik dezelfde tabel voor validatie, capaciteit, zones en loting. Voeg een integriteitstest toe die iedere `kaart.js` vergelijkt met de serverring van die tenant.

- **P1 | De capaciteit van 47 koppels garandeert niet dat alle koppels een plek kunnen kiezen**

  - **Bestand en regel:** [database.sql:520](review/database.sql:520), [database.sql:376](review/database.sql:376), [database.sql:710](review/database.sql:710).
  - **Probleem:** de startcontrole berekent hoeveel paren aanvankelijk beschikbaar zijn. Iedere latere keuze controleert alleen of de twee gekozen stekken vrij en aangrenzend zijn. Geldige lokale keuzes kunnen de resterende ring fragmenteren, waardoor minder paren overblijven dan er koppels moeten kiezen. De eerdere capaciteitsfix is daardoor onvolledig.
  - **Reproductie:** start met 47 koppels. Laat het eerste koppel 3 en 5 kiezen en het tweede 9 en 11. Dit zijn geldige aangrenzende paren, maar ze laten losse segmenten achter. Na deze twee keuzes zijn nog maar 44 paren vormbaar voor 45 resterende koppels. Minstens één koppel kan nooit afronden.
  - **Fix:** simuleer na iedere voorgestelde keuze de maximale matching van alle resterende vrije segmenten. Sta de keuze alleen toe als het maximale aantal resterende paren minstens gelijk is aan het aantal nog ongeplaatste koppels. Een eenvoudiger alternatief is vooraf niet-overlappende paren reserveren.

- **P1 | De server dwingt de levenscyclus van een wedstrijd niet af**

  - **Bestand en regel:** [database.sql:463](review/database.sql:463), [database.sql:544](review/database.sql:544), [database.sql:574](review/database.sql:574).
  - **Probleem:** `w_registreer_vangst` controleert tijd, code en teamtoken, maar niet of de loting gereed is en het team een stek of zone heeft. `w_admin_reset_loting` kan ook na de start en na geregistreerde vangsten worden uitgevoerd. De reset verwijdert plaatsingen maar laat vangsten bestaan.
  - **Reproductie:** laat een deelnemer tijdens het geldige tijdvenster een vangst registreren voordat stekkeuze of loting is afgerond. Dit wordt geaccepteerd. Registreer daarna vangsten en roep vervolgens `w_admin_reset_loting` aan. De wedstrijd gaat terug naar aanmelden, plaatsingen verdwijnen en de bestaande vangsten blijven meetellen.
  - **Fix:** leg toegestane statusovergangen centraal vast. Sta deelnemersvangsten alleen toe bij status `klaar` en met een geldige plaatsing. Sta een gewone reset alleen vóór de start en zonder vangsten toe. Maak voor uitzonderingen een afzonderlijke, expliciete en gelogde beheeractie.

- **P1 | De uitslag gebruikt registratietijd in plaats van vangsttijd**

  - **Bestand en regel:** [database.sql:101](review/database.sql:101), [database.sql:477](review/database.sql:477), [app.js:1383](docs/app.js:1383), [database.sql:591](review/database.sql:591).
  - **Probleem:** de ex-aequoregel voor de grootste vis gebruikt `created_at`, dus het moment waarop de registratie de server bereikt. Bij slecht bereik is dat niet noodzakelijk het vangstmoment. Daarnaast kan een organisator de start- en eindtijd achteraf zo wijzigen dat bestaande vangsten buiten het nieuwe venster vallen. Registratie en tijdwijziging zijn niet tegen elkaar geserialiseerd.
  - **Reproductie:** Anna vangt om 10:00 een vis van 10 kg, maar registreert door slecht bereik om 10:10. Bram vangt dezelfde maat om 10:05 en registreert direct. Bram wint de ex-aequo, hoewel Anna de vis eerder ving. Daarna kan de organisator de starttijd naar 11:00 verplaatsen zonder dat de vangsten opnieuw worden gevalideerd.
  - **Fix:** voeg een apart zakelijk veld `gevangen_op` toe en behoud `created_at` als onveranderbare audittijd. Leg vast wie `gevangen_op` mag invoeren en corrigeren. Vergrendel de wedstrijd tijdens registratie en tijdwijziging en weiger tijdwijzigingen die actieve vangsten ongeldig maken, tenzij een expliciete correctieworkflow wordt gebruikt.

- **P1 | Organisator- en beheerderswachtwoorden kunnen samenvallen**

  - **Bestand en regel:** [database.sql:1059](review/database.sql:1059), [database.sql:1256](review/database.sql:1256), [database.sql:1406](review/database.sql:1406), [database.sql:1580](review/database.sql:1580).
  - **Probleem:** `w_su_wachtwoord` vergelijkt een nieuw beheerderswachtwoord met het oude globale organisatorveld, niet met alle tenantwachtwoorden in `klant_instellingen`. De directe `w_org_wachtwoord` controleert evenmin of het nieuwe wachtwoord gelijk is aan het beheerderswachtwoord en vergrendelt de tenantrij niet.
  - **Reproductie:** stel bij tenant A organisatorwachtwoord `voorbeeld123` in. Wijzig daarna het beheerderswachtwoord naar dezelfde waarde. De server staat dit toe. Iedere organisator die deze waarde kent, kan vervolgens beheerders-RPC's aanroepen, waaronder het overzicht met andere klanten en wedstrijdpincodes.
  - **Fix:** dwing in beide richtingen af dat beheerders- en organisatorwachtwoorden uniek zijn. Doe dit onder rijvergrendeling. Een centrale credentialtabel met type, eigenaar en unieke hash is robuuster dan losse velden en losse controles.

- **P1 | Toegangscodes hebben geen gemeenschappelijke databaseconstraint**

  - **Bestand en regel:** [database.sql:55](review/database.sql:55), [database.sql:78](review/database.sql:78), [database.sql:167](review/database.sql:167), [database.sql:1205](review/database.sql:1205).
  - **Probleem:** wedstrijdcodes, kijkcodes en deelnemercodes zijn elk afzonderlijk uniek, maar niet onderling. De generator controleert de drie tabellen vooraf, maar dit is een racegevoelige check zonder gemeenschappelijke constraint. Sommige RPC's zoeken met een `OR` over meerdere codes, waardoor een botsing een verkeerd object kan selecteren.
  - **Reproductie:** voeg via een seed of gelijktijdige transacties een kijkcode toe die gelijk is aan de wedstrijdcode van een andere tenant. Beide afzonderlijke constraints accepteren dit. Een pushinschrijving, seizoensaanvraag of frontendlogin met die code wordt vervolgens ambigu en kan aan de verkeerde wedstrijd worden gekoppeld.
  - **Fix:** reserveer alle codes via één tabel, bijvoorbeeld `toegangscodes(code primary key, soort, object_id, klant_id)`. Laat codegeneratie atomair invoegen en bij een conflict opnieuw genereren. Gebruik dezelfde tabel voor alle codezoekacties.

- **P1 | Teamverwijdering kan een gelijktijdig ingevoerde vangst meenemen**

  - **Bestand en regel:** [database.sql:738](review/database.sql:738), [database.sql:463](review/database.sql:463), [database.sql:1102](review/database.sql:1102).
  - **Probleem:** `w_admin_verwijder_team` controleert eerst of vangsten bestaan en verwijdert daarna het team. De teamrij wordt niet vóór de controle vergrendeld. Een gelijktijdige vangst kan na de controle worden ingevoegd en daarna via `ON DELETE CASCADE` alsnog verdwijnen.
  - **Reproductie:** organisator A start teamverwijdering en passeert de controle dat geen vangsten bestaan. Deelnemer of organisator B voegt vóór de daadwerkelijke delete een vangst toe. A verwijdert vervolgens het team, waarna de zojuist geaccepteerde vangst door de cascade verdwijnt.
  - **Fix:** selecteer en vergrendel de teamrij eerst met `FOR UPDATE`, controleer daarna de vangsten en verwijder pas daarna. Gebruik in de vangst-RPC's een compatibele vergrendelingsvolgorde en voeg een echte gelijktijdigheidstest toe.

- **P1 | De kijkcode geeft via de API meer gegevens dan alleen het klassement**

  - **Bestand en regel:** [database.sql:1162](review/database.sql:1162), [app.js:381](docs/app.js:381), [app.js:625](docs/app.js:625).
  - **Probleem:** de frontend verbergt voor kijkers de beheer- en vangstschermen, maar `w_get_state_kijker` retourneert alle team-ID's, lotnummers, exacte stekken of zones en iedere vangst met ID, tijdstip en fotopad. Volgens de opgegeven roldefinitie is de kijker beperkt tot het klassement. De echte autorisatiegrens voldoet daar niet aan.
  - **Reproductie:** roep met alleen een kijkcode rechtstreeks `/rpc/w_get_state_kijker` aan. Uit het antwoord kan de gebruiker de volledige vangsthistorie, posities, tijdstippen en fotopaden reconstrueren, ook al toont de kijkersinterface die onderdelen niet.
  - **Fix:** maak een server-side kijkersprojectie die uitsluitend toegestane klassementvelden retourneert. Als foto's en stekken bewust publiek moeten zijn, leg dat dan expliciet vast als onderdeel van de kijkersrol. Op basis van de huidige rolomschrijving is dit een autorisatielek.

- **P1 | De bescherming tegen oude responses kan bij trage verbinding alle state-updates blokkeren**

  - **Bestand en regel:** [app.js:341](docs/app.js:341), [app.js:540](docs/app.js:540), [app.js:648](docs/app.js:648), [app.js:462](docs/app.js:462).
  - **Probleem:** iedere poll verhoogt `STATE_REQ`. Als een request langer duurt dan de pollinterval van zes seconden, maakt de volgende poll het eerdere antwoord ongeldig. Bij blijvend trage verbinding wordt ieder antwoord weggegooid. De organisatorrequests hebben daarnaast geen vergelijkbare generatiecontrole en kunnen na uitloggen alsnog pincodes en DOM-inhoud terugplaatsen.
  - **Reproductie:** laat iedere state-aanvraag zeven seconden duren. Op zes seconden start een nieuwe aanvraag; op zeven seconden wordt de eerste afgekeurd. Dit herhaalt zich onbeperkt. Vertraag daarnaast `w_org_wedstrijden`, log uit voordat het antwoord terugkomt en zie dat de late response `ORG_DATA` en het organisatorscherm opnieuw vult.
  - **Fix:** sta per route en rol maximaal één state-request tegelijk toe en sla polls over zolang dat request loopt. Verhoog een generatie uitsluitend bij route-, code- of rolwijziging. Gebruik dezelfde sessiegeneratie voor organisatorrequests en invalideer die bij uitloggen.

- **P1 | `database.sql` is geen reproduceerbare volledige waarheid**

  - **Bestand en regel:** [database.sql:3](review/database.sql:3), [database.sql:55](review/database.sql:55), [database.sql:94](review/database.sql:94), [database.sql:1223](review/database.sql:1223), [database.sql:1256](review/database.sql:1256).
  - **Probleem:** de kop noemt dit de volledige live bron en herstelbron, maar de tabeldefinities missen tenantkolommen die latere functies gebruiken. `push_subs.endpoint` is globaal uniek, terwijl `w_push_subscribe` een conflictconstraint op `(wedstrijd_id, endpoint)` verwacht. `klant_instellingen` wordt aangemaakt, maar in dit bestand staat geen RLS-activering voor die tabel.
  - **Reproductie:** voer het bestand uit tegen een lege database. Functies die ontbrekende `klant_id`-kolommen gebruiken kunnen niet correct worden aangemaakt en de samengestelde `ON CONFLICT` heeft geen passende unieke constraint. Een herstel uit uitsluitend dit bestand levert dus niet aantoonbaar dezelfde beveiliging en structuur op.
  - **Fix:** genereer één coherente schema-export met tabellen, kolommen, constraints, RLS, grants en functies in afhankelijkheidsvolgorde. Voeg CI toe die deze export in een lege PostgreSQL-database herstelt en daarna RLS-, constraint- en RPC-tests uitvoert. Omdat het bestand intern inconsistent is, kan ik niet met zekerheid zeggen of de live tabel `klant_instellingen` momenteel wel of geen RLS heeft.

## P2

- **P2 | De gedeelde uitslagafbeelding kan de verkeerde winnaar van de grootste vis tonen**

  - **Bestand en regel:** [app.js:1492](docs/app.js:1492), [app.js:1511](docs/app.js:1511).
  - **Probleem:** de tab grootste vis sorteert correct op gewicht en vervolgens tijdstip. De uitslagafbeelding reduceert echter een op totaalgewicht gesorteerde lijst en vervangt de winnaar alleen bij strikt groter visgewicht.
  - **Reproductie:** Anna heeft totaal 20 kg en om 15:00 een grootste vis van 10 kg. Bram heeft totaal 10 kg en om 10:00 een grootste vis van 10 kg. De tab zet Bram bovenaan, maar de afbeelding noemt Anna.
  - **Fix:** bepaal de winnaar via één gedeelde comparator voor gewicht aflopend en vangsttijd oplopend. Gebruik diezelfde helper voor de tabel en de afbeelding.

- **P2 | Foto-upload en foto-opruiming vormen geen sluitende levenscyclus**

  - **Bestand en regel:** [upload-vangstfoto.ts:81](review/upload-vangstfoto.ts:81), [upload-vangstfoto.ts:92](review/upload-vangstfoto.ts:92), [database.sql:1374](review/database.sql:1374), [wis-fotos.ts:23](review/wis-fotos.ts:23).
  - **Probleem:** een geldig teamtoken mag ook na afloop nog uploaden, omdat de edgefunctie alleen de identiteit controleert. Als registratie daarna faalt of de gebruiker de pagina sluit, blijft een foto zonder databasereferentie achter. De verwijderfunctie verwerkt bovendien maximaal 1.000 paden, terwijl de wedstrijdrecords daarna al kunnen verdwijnen.
  - **Reproductie:** upload na de eindtijd met een nog geldig teamtoken. De upload slaagt, maar `w_registreer_vangst` weigert de vangst. De foto wordt nooit aan `vangsten` gekoppeld en komt daardoor niet in de normale verwijderlijst. Bij meer dan 1.000 foto's blijven eveneens objecten achter.
  - **Fix:** laat een uploadautorisatie-RPC ook wedstrijdstatus, tijdvenster en plaatsing controleren. Registreer uploads als tijdelijke objecten met eigenaar en vervaltijd, laat vangstregistratie ze claimen en ruim verlopen uploads periodiek op. Gebruik voor wedstrijdverwijdering een duurzame batchtaak voordat referenties verdwijnen.

- **P2 | De service worker wacht onbeperkt op een slechte netwerkverbinding**

  - **Bestand en regel:** [nphv/sw.js:25](docs/nphv/sw.js:25), [demo/sw.js:24](docs/demo/sw.js:24).
  - **Probleem:** de shell gebruikt network-first en valt pas op de cache terug nadat `fetch` afwijst. Bij een half werkende verbinding of captive portal kan dat lang duren. De PWA lijkt dan vastgelopen terwijl een bruikbare shell in de cache staat.
  - **Reproductie:** laad de PWA eenmaal volledig, simuleer daarna een verbinding waarop requests blijven hangen in plaats van direct te falen en heropen de app. De gecachete shell verschijnt pas na de browsertimeout.
  - **Fix:** gebruik voor navigatie en shellbestanden een korte timeout of stale-while-revalidate. Houd API-responses buiten deze shellcache en toon in de UI duidelijk dat live gegevens nog worden bijgewerkt.

- **P2 | Essentiële bediening is niet met toetsenbord of schakelbediening uitvoerbaar**

  - **Bestand en regel:** [styles.css:230](docs/styles.css:230), [gen_standaardkaart.py:164](tools/gen_standaardkaart.py:164), [app.js:1176](docs/app.js:1176).
  - **Probleem:** de verplichte foto-input heeft `display: none`, terwijl de zichtbare vervanger niet normaal focusbaar is. De stekken op de SVG-kaart hebben geen `tabindex`, rol of toetsenbordhandler. Dit blokkeert functionele handelingen, niet alleen cosmetische toegankelijkheid.
  - **Reproductie:** doorloop de vangstregistratie en stekkeuze uitsluitend met Tab, Enter en Spatie. De gebruiker bereikt de foto-upload en kaartstekken niet.
  - **Fix:** verberg de file-input alleen visueel of gebruik een echte knop die de input activeert. Genereer focusbare kaartobjecten met `role="button"`, `tabindex="0"`, een duidelijke `aria-label` en handlers voor Enter en Spatie. Bied bij voorkeur ook een native keuzelijst als alternatief.

- **P2 | Wedstrijdtijden hangen af van de tijdzone van het apparaat**

  - **Bestand en regel:** [app.js:506](docs/app.js:506), [app.js:132](docs/app.js:132), [app.js:557](docs/app.js:557).
  - **Probleem:** `datetime-local` wordt geïnterpreteerd in de lokale tijdzone van de browser en daarna naar UTC omgezet. Weergave gebeurt opnieuw in de lokale browserzone. Ook wordt de serverklokoffset berekend tegen het ontvangsttijdstip, waardoor netwerkvertraging volledig als klokverschil wordt gezien.
  - **Reproductie:** laat een organisator buiten Nederland 08:00 invullen voor een Nederlandse wedstrijd. De opgeslagen UTC-tijd correspondeert niet met 08:00 in `Europe/Amsterdam`. Bij een trage response loopt de weergegeven serverklok daarnaast achter met ongeveer de netwerklatentie.
  - **Fix:** leg per tenant een IANA-tijdzone vast en interpreteer ingevoerde wandtijd server-side in die zone, inclusief controles rond zomertijd. Bereken klokoffset met het midden tussen requeststart en ontvangst of laat de server resterende seconden retourneren.

- **P2 | Een lokaal teamtoken kan een geldige organisatorupload blokkeren**

  - **Bestand en regel:** [app.js:98](docs/app.js:98), [upload-vangstfoto.ts:81](review/upload-vangstfoto.ts:81).
  - **Probleem:** de uploadcode kiest eerst een aanwezig lokaal teamtoken en stuurt alleen bij afwezigheid daarvan de admin-pin. Een organisatorapparaat waarop nog een oud of verwijderd deelnemersteam staat, gebruikt daardoor de verkeerde credential.
  - **Reproductie:** neem op één apparaat eerst als deelnemer deel, verwijder of vervang dat team en log daarna in als organisator. Voeg via beheer een vangst met foto toe. De upload stuurt het oude teamtoken en wordt geweigerd, ondanks de geldige admin-pin.
  - **Fix:** kies de credential op basis van de actieve rol. Stuur in organisatormodus altijd de admin-pin. Een alternatief is beide credentials meesturen en de edgefunctie toegang geven wanneer minstens één daarvan geldig is.

- **P2 | De beheerinterface meldt ten onrechte dat een reset alle omgevingen raakt**

  - **Bestand en regel:** [app.js:2061](docs/app.js:2061), [app.js:2070](docs/app.js:2070), [app.js:2076](docs/app.js:2076).
  - **Probleem:** bevestiging en succesmelding zeggen dat het organisatorwachtwoord voor alle omgevingen wordt gewijzigd, terwijl de RPC-aanroep de geselecteerde `klant_id` meestuurt. Bij een beveiligingsincident kan de eigenaar daardoor ten onrechte aannemen dat alle tenants zijn geroteerd.
  - **Reproductie:** selecteer demo en wijzig het organisatorwachtwoord. De interface meldt dat alle omgevingen zijn bijgewerkt, maar NPHV behoudt het oude wachtwoord.
  - **Fix:** vermeld de geselecteerde klantnaam in bevestiging en resultaat. Bied, als een globale rotatie nodig is, een afzonderlijke actie die expliciet alle tenants verwerkt en per tenant resultaat toont.

Tot slot: ik vond in de huidige frontend geen reproduceerbare DOM-XSS via team-, wedstrijd- of seizoensnamen. De onderzochte sinks escapen databasewaarden consequent. De tenantpagina's hebben ook geen `unsafe-inline` in `script-src`, en de publieke Supabase- en VAPID-sleutels zijn overeenkomstig de projectafspraken geen geheimen.


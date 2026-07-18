# Codex-review v8: bevindingen en voorstellen

Datum: 18 juli 2026

Scope: totaalreview van de publieke site en de PWA als nieuwe bezoeker en potentiële klant, plus een korte codecheck van v53 tot en met v55. Ik heb de live site op desktop en op een mobiele viewport van 375 px bekeken, de publieke demo als deelnemer doorlopen en de relevante lokale broncode en projectdocumentatie gecontroleerd. De productieomgeving van NPHV is niet gewijzigd en er zijn geen testacties in uitgevoerd.

## STORM-check

- Bronnen: de live pagina's op `viswedstrijdapp.nl`, `review/chatgpt-review-v8.md`, `CLAUDE.md`, de huidige bestanden in `docs/` en de commits vanaf v53.
- Aannames: de live site komt overeen met de huidige checkout op commit `6f7a26e`; de gecontroleerde pagina's en versies bevestigen dat beeld.
- Tegenperspectief: een deel van de landingspagina kan bedoeld zijn als aanbod dat pas na verkoop technisch wordt ingericht. Dat maakt toekomstgerichte copy begrijpelijk, maar niet de stellige belofte dat een standaardkaart nu direct werkt.
- Ontbrekende informatie: geen echte veldtest met wegvallend mobiel bereik, geen organisatorwachtwoord voor de demo en geen test van pushmeldingen op fysieke iPhone- en Android-apparaten.
- Basis voor antwoord: voldoende voor de onderstaande site-, client- en UX-bevindingen. De Supabase-server is conform de opdracht niet opnieuw volledig gereviewd.

## 1. Bevindingen

### 1. P1 | De site verkoopt tenantmogelijkheden die technisch nog niet volledig beschikbaar zijn

- Pagina/bestand: `docs/index.html:140-144`, `docs/index.html:260-279`, `CLAUDE.md:44-47` en `CLAUDE.md:151-164`.
- Wat er misgaat: de site zegt dat iedere organisatie een eigen omgeving, waterkaart, zone-indeling en wedstrijdregels krijgt. Ook staat er: "Geen eigen kaart? Dan start je met een standaardkaart die direct werkt." De projectdocumentatie zegt echter expliciet dat de database nog niet volledig per tenant is gescheiden. Organisatiewachtwoord, zones en `stek_ring` zijn nog gedeeld en een standaardkaart-tenant kan nog geen eigen stekkeuze of koppelmodus draaien.
- Scenario: een tweede vereniging vraagt het prijzenblad aan en koopt een omgeving met standaardkaart. De voorkant kan worden aangemaakt, maar de kernfunctie stekkeuze wordt nog tegen de NPHV-volgorde gevalideerd en instellingen zijn niet volledig per organisatie geïsoleerd. De klant krijgt daardoor niet het product dat de landingspagina zonder voorbehoud belooft.
- Concreet fixvoorstel: maak de volledige tenancy-migratie een voorwaarde voordat een tweede productieklant wordt geactiveerd. Scheid minimaal organisatiewachtwoord, standaardzones, wedstrijdinstellingen en stekvalidatie per klant of water. Pas tot dat moment de copy aan naar bijvoorbeeld: "Geen eigen kaart? Dan kunnen we een standaardkaart voor jullie voorbereiden. Ingebruikname volgt na de technische inrichting van jullie omgeving." Verwijder in elk geval "die direct werkt".

### 2. P1 | Registratie bij slecht bereik is niet betrouwbaar of idempotent

- Pagina/bestand: `docs/index.html:194-197`, `docs/index.html:247-250`, `docs/app.js:61-90`, `docs/app.js:1822-1848` en `docs/nphv/sw.js:25-40`.
- Wat er misgaat: de site zegt dat de app bij slecht bereik blijft werken. De service worker bewaart alleen dezelfde-origin GET-verzoeken. Vangstfoto's en RPC-aanroepen zijn cross-origin POST-verzoeken naar Supabase en worden niet in een wachtrij gezet. Een netwerkfout verschijnt bovendien als een technische melding zoals "Er ging iets mis: Failed to fetch". Foto-upload en vangstregistratie zijn twee losse verzoeken met telkens een nieuw willekeurig fotopad.
- Scenario: een visser uploadt een foto, waarna de verbinding wegvalt tijdens of vlak na `w_registreer_vangst`. Als de server de vangst wel heeft opgeslagen maar het antwoord de telefoon niet bereikt, ziet de visser een fout en probeert hij opnieuw. De tweede poging krijgt een nieuw fotopad en kan dezelfde vangst dubbel registreren. Als alleen de upload slaagt, blijft een verweesde foto achter. Er is geen zichtbare status "wacht op verbinding" en geen zekere hervatting.
- Concreet fixvoorstel: voeg eerst een herkenbare netwerkfout en een veilige knop "Opnieuw proberen" toe, behoud gewicht en foto in het formulier en maak de offlinebelofte preciezer. Maak daarna de schrijfroute idempotent met een clientgegenereerde `submission_id`, een unieke serverconstraint en een vast fotopad per poging. Voor werkelijk slecht-bereikgebruik is een lokale outbox in IndexedDB nodig, met duidelijke statussen zoals "wacht op verbinding", "wordt verzonden" en "geregistreerd". Schrijf op de site voorlopig: "De app en klok blijven bruikbaar bij een korte onderbreking; voor het registreren van een vangst is verbinding nodig."

### 3. P2 | De generieke instructiepagina stuurt "Naar de app" terug naar de landingspagina

- Pagina/bestand: `docs/inloggen/index.html:65` en `docs/instructies.html:45-46,106`.
- Wat er misgaat: vanaf `/inloggen/` opent "Bekijk de uitleg" de generieke instructiepagina. De knop "Naar de app" heeft daar `href="./"` en gaat daardoor naar `/`, de marketingpagina, in plaats van naar de organisatiekeuze. Bij de tenant-instructies is hetzelfde relatieve pad wel correct, omdat `./` daar naar `/nphv/` of `/demo/` verwijst.
- Scenario: een nieuwe deelnemer bekijkt eerst de installatie-uitleg en tikt daarna op "Naar de app". Hij belandt opnieuw op de landingspagina en moet nogmaals "Inloggen" kiezen voordat hij zijn organisatie kan selecteren.
- Concreet fixvoorstel: wijzig alleen op `docs/instructies.html` de hoofdknop naar `href="/inloggen/"`. Laat de tenantvarianten op `href="./"` staan. Overweeg ook de terugknop op de generieke pagina naar `/inloggen/` te laten verwijzen en de merklink naar `/`.

### 4. P2 | De verbeterde fotolightbox is voor hulptechnologie nog geen echte modal

- Pagina/bestand: `docs/nphv/index.html:462`, `docs/demo/index.html:477`, `docs/app.js:1867-1904` en `docs/styles.css:230-235`.
- Wat er misgaat: v53 heeft terecht een echte sluitknop, Escape, contextuele alt-tekst, foutafhandeling en focusherstel toegevoegd. De lightbox blijft echter een gewone `div` zonder dialogsemantiek. De rest van de pagina wordt niet `inert` en focus wordt niet binnen de overlay gehouden. De fouttoast heeft ook geen `role="status"` of `aria-live`.
- Scenario: een toetsenbord- of schermlezergebruiker opent een vangstfoto of 3D-kaart. De focus gaat naar "Sluiten", maar Tab kan daarna naar bediening achter de donkere overlay springen. Een mislukte afbeelding sluit de overlay, maar de toastmelding wordt mogelijk niet uitgesproken.
- Concreet fixvoorstel: gebruik bij voorkeur een native `<dialog>` met `showModal()` en `close()`. Voeg een toegankelijke naam toe, herstel focus na sluiten en laat de browser de achtergrond blokkeren. Als de huidige `div` blijft, voeg dan minimaal `role="dialog"`, `aria-modal="true"`, een focuslus en `inert` op de achtergrond toe. Geef `#toast` `role="status"` en `aria-live="polite"`.

## Codecheck v53 tot en met v55

- Geen P0 gevonden.
- De nieuwe lightboxhelpers conflicteren niet met `#deel-nieuw`: de globale klikhandler sluit alleen `#foto-groot` en de deeloverlay heeft eigen bediening.
- De contextuele alt-tekst, Escape-afhandeling, focus heen en terug en fouttoast zijn functioneel aanwezig. Alleen de modal- en live-regionsemantiek uit bevinding 4 ontbreekt nog.
- De scaffoldcontroles voor `kaart.js`, `dieptekaart.jpg`, `kaart-3d.jpg` en de service-worker-SHELL kloppen. `controleer()` is succesvol uitgevoerd op zowel `docs/nphv` als `docs/demo`.
- De karperlogo's hebben in v55 vaste `width`- en `height`-attributen. Daarmee is de bedoelde bescherming tegen een oude CSS-cache aanwezig.
- `APP_VERSION` en alle drie `version.json`-bestanden staan op 55. `node --check docs/app.js` en de Python-syntaxcontrole voor beide tenantscripts zijn geslaagd.
- De v8-briefing noemt de commitnummers van v54 en v55 verwisseld. In de repository is v54 `8022dc4` en v55 `e800215`; `3d9b952` is het v7-statusdocument.
- De OG-afbeelding is correct 1200 x 630 px, goed leesbaar en visueel consistent met de site. De redirect van `/info.html` naar `/` en de gecontroleerde lokale links en assets zijn in orde.

## 2. Aanbevelingen site en UX

### 1. Maak de demo de primaire actie voor nieuwe bezoekers

De huidige hero en mobiele kop geven "Inloggen" de meeste nadruk. Dat is logisch voor bestaande klanten, maar niet voor de verkooproute. Maak de oranje hoofdknop "Bekijk de live demo" en link direct naar `/demo/#/k/KIJKJE`. Zet "Inloggen bij mijn organisatie" als secundaire knop en behoud "Inloggen" rechtsboven voor terugkerende gebruikers.

### 2. Geef elke relevante rol een demo met één tik

De kijkersdemo opent direct, maar de deelnemersdemo vraagt eerst scrollen, "Deelnemer" kiezen, `DEMOJA` overtypen en op "Meedoen" tikken. Maak bovenaan drie duidelijke keuzes: "Bekijk als kijker", "Bekijk als deelnemer" en "Bekijk als organisator". Laat de deelnemerskeuze automatisch de publieke demo-identiteit openen. Geef kopers voor de organisatorrol een read-only voorbeeldscherm of rondleiding, zonder een echt wachtwoord openbaar te maken.

### 3. Gebruik een letterlijke Nederlandse hoofdboodschap

"Loot. Vis. Win." is herkenbaar, maar vertelt een verenigingsbestuur niet in één oogopslag wat het product oplost. Gebruik bijvoorbeeld `Viswedstrijden organiseren zonder papier` als H1 en behoud `Loot. Vis. Win.` als korte merkregel. Zet daaronder: "Loting, stekkeuze, vangsten en live klassement in één app, zonder accounts voor deelnemers."

### 4. Zet het onderscheidende privacyverhaal direct onder de hero

"Geen accounts, geen logboek en geen locatietracking" is een sterk antwoord op een echte weerstand onder vissers, maar staat nu pas ver onderaan. Plaats direct onder de hero een compacte bewijsregel met drie punten: "Geen deelnemersaccount", "Geen vangstenlogboek" en "Geen locatietracking". Laat het uitgebreide privacyblok op zijn huidige plek staan.

### 5. Voeg concreet bewijs uit de praktijk toe

De NPHV-kaart is zichtbaar, maar nog niet gepresenteerd als klantbewijs. Voeg, na toestemming, een korte praktijksectie toe met de naam NPHV, een echte screenshot en één controleerbaar resultaat of citaat. Vermijd algemene tevredenheidstaal; laat bijvoorbeeld zien hoeveel handelingen de organisator niet meer op papier hoeft te doen.

### 6. Leg het traject van aanvraag tot eerste wedstrijd uit

Een vereniging weet nu wat de app kan, maar niet wat zij moet aanleveren, hoe de kaart wordt gemaakt, hoe testen werkt en welke ondersteuning er op de eerste wedstrijddag is. Voeg voor de FAQ een korte sectie "Van waterkaart naar wedstrijddag" toe met vier stappen: materiaal aanleveren, omgeving inrichten, proefwedstrijd draaien en livegang. Noem alleen een doorlooptijd of serviceniveau als KemblincK dat ook kan waarmaken.

### 7. Verminder de frictie rond het prijzenblad zonder prijzen openbaar te maken

Dat prijzen bewust per mail gaan is verdedigbaar, maar "mail voor het prijzenblad" voelt passief. Maak er een duidelijke knop "Vraag het prijzenblad aan" van met een ingevuld onderwerp en een korte mailtekst waarin organisatie, water en verwacht aantal deelnemers al als vragen staan. Zet ernaast welke twee onderdelen de prijs bepalen: standaardkaart of maatwerkkaart, plus inrichting en ondersteuning.

### 8. Maak de mobiele hero korter

Op 375 px vult de hero met tekst, twee knoppen en de lange telefoonmock-up meer dan het eerste scherm. Daardoor ziet een bezoeker nog geen bewijs of inhoudssectie. Beperk de zichtbare mock-up op mobiel tot een korte uitsnede of vaste hoogte, zodat de volgende sectie onderaan het eerste scherm al zichtbaar wordt. Houd beide CTA's volledig boven de vouw.

### 9. Geef de kaart een overzichtsstand en een gerichte zoomstand

De kaart heeft op mobiel een minimale breedte van 700 px en vraagt horizontaal schuiven. Voeg een compacte bediening "Overzicht" en "Inzoomen" toe. Toon eerst het hele water met grote zonekeuzes; centreer na een zonekeuze automatisch de relevante stekken. Dit verkleint zoeken en vegen met natte handen of fel zonlicht.

### 10. Vereenvoudig de wedstrijdnavigatie op smalle schermen

Met vijf deelnemertabs ontstaat op 375 px een horizontale tabrij met een zichtbare scrollbar en een deels afgesneden laatste tab. Houd de drie primaire taken altijd zichtbaar, bijvoorbeeld "Kaart", "Stand" en "Vangst". Verplaats "Mijn team" en "Seizoen" naar een compacte knop "Meer", of gebruik twee stabiele rijen zonder horizontaal schuiven. Maak tijdens een lopende wedstrijd "Vangst registreren" bovendien een vaste, goed bereikbare hoofdactie.

## Eindoordeel

De site en demo ogen verzorgd, passen visueel bij elkaar en maken het product veel concreter dan in eerdere versies. De route naar de kijkersdemo werkt goed en de deelnemersdemo is functioneel. De belangrijkste blokkade zit niet in de presentatie maar in de productbelofte: een nieuwe productieklant met eigen instellingen of standaardkaart kan technisch nog niet volledig worden geleverd. Los die mismatch en de betrouwbaarheid bij wisselend bereik op voordat de site actief nieuwe verenigingen gaat converteren. De overige punten zijn gerichte verbeteringen, geen reden om de huidige NPHV-omgeving stil te leggen.

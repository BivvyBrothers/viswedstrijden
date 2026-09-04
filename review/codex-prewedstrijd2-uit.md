# Oordeel

Niet ongewijzigd inzetten op 12 september. De loting en duo-afhandeling zijn grotendeels correct, maar ik zie vijf hoge risico’s: ongecontroleerde laatkomers in v80, mogelijke dubbele vangsten, een permanent geblokkeerde wachtrij, onterecht definitief geweigerde uploads en het ontbreken van een werkbare offline loting.

Tijdens de review verschoof `HEAD` van v79 naar commit `131374f` met v80. Ik heb daarom zowel de oorspronkelijk gevraagde v78/v79-fixes als de nieuwe v80-wijziging beoordeeld. Het oordeel geldt voor de huidige v80.

Kleine feitelijke correctie: zaterdag 09:00 tot zondag 11:30 duurt 26 uur en 30 minuten. De klokcode verwerkt dat correct.

## DEEL A: regressie-review

### 1. Hoog: v80 laat iedereen met de wedstrijdcode tot de eindtijd instromen

Bestanden: [review/database.sql:322](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:322>), `w_join`; [docs/app.js:2847](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2847>), `renderTeamTab`.

V80 accepteert `w_join` bij `stekkeuze` en `klaar` tot zondag 11:30. Hiervoor is geen admin-pin nodig. Met 13 van maximaal 15 deelnemers kunnen dus tijdens de wedstrijd nog twee personen zichzelf toevoegen, een zone kiezen en vangsten registreren. Het publieke aanmeldformulier maakt dit bovendien expliciet mogelijk.

Concrete oplossing: sta aanmelden na de loting alleen toe zolang `now() < start_ts`. Maak voor uitzonderingen na 09:00 een aparte `w_admin_voeg_deelnemer` met admin-pin. Daarmee blijft het gewenste 08:05-scenario mogelijk zonder de deelnemerslijst tijdens de wedstrijd open te laten.

### 2. Hoog: hetzelfde wachtrij-item kan vanuit twee appvensters dubbel worden geregistreerd

Bestanden: [docs/app.js:2140](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2140>), `WACHTRIJ_BEZIG`; [docs/app.js:2197](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2197>), `verstuurWachtrij`; [review/database.sql:610](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:610>), `w_registreer_vangst`.

`WACHTRIJ_BEZIG` beschermt alleen één JavaScript-context. Als de beginscherm-app en een browsertab tegelijk openstaan, lezen beide dezelfde IndexedDB-rij met `pad: null`. Beide uploaden naar een ander, door de server gegenereerd fotopad. De unieke index op `foto_path` ziet vervolgens twee verschillende paden, zodat beide vangsten kunnen worden ingevoegd.

`FALLBACK_POGING` heeft hetzelfde fundamentele gat: na een verloren RPC-antwoord zorgt een gewijzigd gewicht voor een nieuw `kenmerk`, een nieuw fotopad en mogelijk een tweede vangst.

Concrete oplossing: stuur `item.id` als vaste `p_client_id` mee en maak die database-hard uniek per wedstrijd. Laat de RPC bij een bestaande `client_id` de bestaande vangst teruggeven. Een browserlock via `navigator.locks` is nuttige extra bescherming, maar geen vervanging voor server-idempotentie.

### 3. Hoog: één upload kan de hele wachtrij onbeperkt vasthouden

Bestanden: [docs/app.js:123](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:123>), `uploadFoto`; [docs/app.js:2184](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2184>), `verstuurWachtrij`.

De upload-`fetch` heeft geen `AbortController`. Als deze op een half werkende mobiele verbinding blijft hangen, blijft `WACHTRIJ_BEZIG` waar en worden geen andere vangsten verstuurd.

Daarnaast stopt iedere niet-definitieve fout de hele lus met `break`. Een blijvend probleem met het oudste item blokkeert daardoor ook latere vangsten en zelfs items van andere wedstrijden.

Concrete oplossing: geef uploads een harde timeout van bijvoorbeeld 20 seconden. Bewaar per item een pogingteller en `volgende_poging`. Laat na een mislukte poging andere items doorgaan, maar probeer het mislukte item later opnieuw.

### 4. Hoog: een tijdelijke databasefout tijdens uploadautorisatie wordt definitief “geen toegang”

Bestanden: [review/upload-vangstfoto.ts:56](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/upload-vangstfoto.ts:56>), `rpc`; [review/upload-vangstfoto.ts:81](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/upload-vangstfoto.ts:81>); [docs/app.js:2181](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2181>).

Als `w_mijn_team` of `w_admin_check` tijdelijk een 5xx retourneert, zet de edge function `toegestaan` op `false` en antwoordt zij met HTTP 403 `geen_toegang`. De client beschouwt `geen_toegang` als definitief en zet de vangst op `geweigerd`.

De nieuwe vertaling van expliciete `upload_mislukt`- en 5xx-antwoorden is dus goed, maar dit autorisatiepad omzeilt die verbetering.

Concrete oplossing: onderscheid “geldige RPC, maar token/pin bestaat niet” van “RPC niet bereikbaar”. Geef bij netwerk- of 5xx-fouten HTTP 503 met `upload_mislukt`. Alleen een betrouwbaar vastgestelde ongeldige credential mag 403 geven.

### 5. Middel: oude v74/v77-wachtrijitems hebben nog geen teambeveiliging

Bestand: [docs/app.js:2191](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2191>), `verstuurWachtrij`.

De controle luidt:

```js
item.team_id && team.id !== item.team_id
```

Een oud wachtrij-item zonder `team_id` wordt dus alsnog met het momenteel ingelogde team verstuurd. Dat is precies het oorspronkelijke verkeerde-teamprobleem, maar dan voor migrerende v74/v77-items.

Concrete oplossing: verstuur items zonder `team_id` nooit automatisch. Toon ze als legacy-item met gewicht, tijd en foto en laat de organisator ze handmatig verwerken.

### 6. Middel: de nieuwe resetgate is te omzeilen via de starttijd

Bestanden: [review/database.sql:746](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:746>), `w_admin_reset_loting`; [review/database.sql:770](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:770>), `w_admin_tijden`.

De rechtstreekse gate is correct: reset na `start_ts` en bij actieve of wachtende vangsten wordt geweigerd. De organisator kan `start_ts` echter eerst naar de toekomst verplaatsen en daarna resetten.

Concrete oplossing: leg `loting_gestart_op` of `oorspronkelijke_start_ts` onveranderlijk vast. Blokkeer verplaatsing van de start naar de toekomst zodra de oorspronkelijke start is verstreken. Laat alleen een aparte, expliciete calamiteitenprocedure hiervan afwijken.

### 7. Middel: de home-loginfix vangt echte fetchfouten nog niet af

Bestand: [docs/app.js:504](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:504>), formulier `form-deelnemer`.

Alleen foutcode `geen_verbinding` stopt de doorval. Een directe `fetch`-`TypeError`, parsingfout of serverfout wordt nog steeds behandeld alsof de persoonlijke code een wedstrijdcode was.

Concrete oplossing: ga alleen naar de wedstrijdroute wanneer `w_login_deelnemer` succesvol `null` retourneert. Toon bij iedere exception een herstelbare fout en blijf op het formulier.

## Antwoord op de wachtrijvragen

- Een verkeerd ingelogd team gebruikt nu `continue`. Zo’n item blokkeert latere items niet.
- Een niet-definitieve fout gebruikt `break` en blokkeert de rest van die verzendronde.
- Een hangende upload kan de rij voor de volledige levensduur van dat appvenster blokkeren.
- Eén venster dat exact hetzelfde `item.pad`, team en gewicht herhaalt, maakt dankzij de unieke foto-index geen dubbele rij.
- Twee vensters kunnen wel dubbel registreren doordat beide vóór het opslaan van `item.pad` een verschillend pad uploaden.
- `laatDefinitief` maakt tijdelijke RPC-fouten niet langer definitief. Dat deel is correct.
- `buiten_wedstrijdtijd` blijft kwetsbaar voor een verkeerde telefoonklok.
- De expliciete vertaling van `upload_mislukt` en HTTP 5xx is correct, afgezien van de autorisatiemisclassificatie hierboven.

# DEEL B: tijdlijn wedstrijddag

## 07:45, app openen

### Hoog: v80 is niet gegarandeerd

Bestanden: [docs/nphv/sw.js:6](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/nphv/sw.js:6>), [docs/nphv/index.html:548](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/nphv/index.html:548>), [docs/app.js:367](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:367>), `checkVersie`.

De serviceworker gebruikt nog steeds `nphv-shell-v1`. `index.html`, `/app.js` en `/styles.css` hebben geen versienummer in hun URL.

Online probeert de worker eerst het netwerk. Een oude app controleert `version.json` met `no-store` en toont vervolgens een banner, maar de gebruiker moet die banner zelf aantikken. Er is geen harde versiepoort voor Start loting of vangstregistratie.

Offline krijgt de gebruiker de oude gecachte app. Bij een koude start ontbreekt bovendien `STATE`, omdat wedstrijdstate niet lokaal wordt bewaard. De shell opent dan wel, maar loten en registreren werken niet.

Concrete oplossing: maak cache en asset-URL’s releasegebonden, bijvoorbeeld `nphv-shell-v80` en `/app.js?v=80`. Blokkeer kritieke acties zodra `version.json` hoger is dan `APP_VERSION`. Toon de actieve versie zichtbaar in Beheer. Laat alle telefoons op 12 september vóór 08:00 online openen en controleer het versienummer.

## 08:05, deelnemers wijzigen

In de huidige v80 kan iemand na Start loting alsnog aanmelden en krijgt die het laatste lotnummer. Dat lost het 08:05-scenario op, maar is zoals hierboven beschreven te ruim tot zondag 11:30.

Voor duo’s geldt:

- Een afwezige duomaat kan via `w_admin_verwijder_team` worden verwijderd zolang die geen vangst heeft. De overblijvende deelnemer wordt solo en behoudt lotnummer en toegewezen zone.
- Twee bestaande solo’s kunnen niet rechtstreeks aan elkaar worden gekoppeld.
- Om twee solo’s alsnog duo te maken, moeten beide zonder vangsten worden verwijderd en opnieuw als duo aanmelden. Codes en lotpositie veranderen.
- `w_admin_kies` kan alleen een plek toewijzen. De RPC kan geen deelnemer maken en geen twee bestaande deelnemers tot duo koppelen.

## 08:10, loting

Op de opgegeven stand zijn er 10 loteenheden voor 19 zones. Dat past ruim.

Gecontroleerd en correct:

- `w_start_stekkeuze` telt ieder `duo_id` eenmaal.
- Beide duoleden krijgen hetzelfde lotnummer.
- Beide telefoons tonen “Jij bent aan de beurt”.
- Na de keuze worden zone en stekken naar beide duorijen geschreven.
- De andere duomaat ziet de keuze uiterlijk na de volgende poll van zes seconden.
- Als beide tegelijk verschillende zones bevestigen, wint één transactie. De andere krijgt `al_gekozen`; het duo splitst niet.
- Reageert iemand niet, dan blijft die loteenheid de gewone deelnemerskeuze blokkeren.
- De organisator kan via `w_admin_kies` die persoon of ieder ander open team een zone geven. Deze beheerroute hoeft de normale beurtvolgorde niet te volgen.

Middel: een al bevestigde verkeerde beheertoewijzing kan niet individueel worden aangepast. Voor de start resteert alleen een volledige reset; na de start is zelfs die afgesloten. Voeg een admin-RPC toe voor verplaatsen of wisselen vóór de eerste vangst, met dezelfde locks en bezetheidscontroles als `w_admin_kies`.

## 09:00 tot zondag 11:30

De klok gebruikt `server_now` als offset en telt uren niet modulo 24. De duur van 26 uur en 30 minuten werkt dus.

De kijker-RPC geeft beide duoleden als losse teamrijen terug. Vangsten worden per eigen `team_id` geteld. Duo’s delen alleen lot en zone, niet hun score.

### Middel: late vangsten gebruiken de ongecorrigeerde telefoonklok

Bestanden: [docs/app.js:2668](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2668>), [docs/app.js:2213](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2213>), [review/database.sql:1246](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:1246>).

De app kent een servercorrectie via `TIJD_OFFSET`, maar slaat `gemaakt_op` op met rauwe `Date.now()`. Een verkeerd ingestelde telefoon kan daardoor een geldige late vangst definitief als `buiten_wedstrijdtijd` laten afwijzen.

Concrete oplossing: leg het indienmoment vast met `nu()` en bewaar desgewenst daarnaast de ruwe telefoontijd en gebruikte offset voor controle.

### Laag: pushmeldingen kunnen elkaar vervangen of na één uur verlopen

Bestanden: [docs/nphv/sw.js:59](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/nphv/sw.js:59>), [review/push-vangst.ts:51](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/review/push-vangst.ts:51>).

Alle meldingen gebruiken tag `vangst`, waardoor het besturingssysteem eerdere meldingen kan vervangen. De push-TTL is 3600 seconden; een toestel dat langer dan een uur offline is, kan de melding missen. Een later goedgekeurde wachtende vangst stuurt geen nieuwe push.

Concrete oplossing: gebruik de vangst-ID in de tag of verwijder de vaste tag. Kies bewust een langere TTL voor de nachtwedstrijd en verstuur desgewenst een melding na goedkeuring.

## Zondag 11:30

Voor IndexedDB-items werkt het hoofdpad goed: het indienmoment wordt vóór compressie vastgelegd. Komt de registratie na de eindtijd binnen, dan gaat de vangst binnen de marge van 24 uur naar status `wacht`. De organisator moet hem eerst goedkeuren.

De directe `FALLBACK_POGING` zonder IndexedDB heeft dit late pad niet. Een voor 11:30 begonnen registratie die pas daarna bij de RPC komt, wordt daar alleen als `wedstrijd_afgelopen` geweigerd. De organisator kan hem nog handmatig toevoegen.

### Middel: de gedeelde einduitslag is geen volledige uitslag

Bestanden: [docs/app.js:1627](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:1627>), `klassementRijen`; [docs/app.js:1710](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:1710>), `tekenUitslag`.

Deelnemers zonder vangst worden volledig weggefilterd. De deelafbeelding toont bovendien maximaal tien deelnemers met vangst. Bij 13 vangers worden drie alleen samengevat als “nog 3 deelnemers met vangst”. Bij nulvangers ontbreekt zelfs die vermelding.

Concrete oplossing: behoud alle 13 deelnemers in `klassementRijen` met 0,00 kg. Maak voor deze omvang één afbeelding met alle 13 rijen of twee afbeeldingen. Noem de resterende deelnemers niet alleen als aantal.

## Storingen tijdens de loting

### Hoog: er is geen offline loting of duidelijke storingsstatus

Bestanden: [docs/app.js:641](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:641>), `laadState`; [docs/app.js:2521](</Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2521>), keuzehandler.

Bij een totale Supabase-storing:

- Start loting, deelnemerskeuzes en beheerkeuzes werken niet.
- Een eerste laadpoging toont “Geen verbinding”.
- Na een eerdere succesvolle laadpoging blijft verouderde state zichtbaar zonder duidelijke melding hoe oud die is.
- Er is geen lokale of offline beheerroute.

De handmatige uitweg bestaat pas nadat Supabase terug is: voer de loting op papier uit, start daarna de digitale loting en wijs via `w_admin_kies` de op papier gekozen zones aan de juiste deelnemers toe. `w_admin_kies` hoeft de gegenereerde beurtvolgorde niet te volgen.

Concrete oplossing vóór 12 september: print vóór 08:00 een lijst met alle deelnemers, duo’s en 19 zones. Leg vast dat bij een storing volledig op papier wordt geloot. Voeg in de app een zichtbare “verbinding verloren, gegevens van HH:MM”-banner toe. Implementeer later een beheerexport en een expliciete offline noodmodus.

## Verificatie

Geslaagd:

- `node --check` op v79 en de huidige v80 voor `app.js`, `nphv/sw.js`, `config.js` en `kaart.js`.
- Versiebestanden waren binnen iedere onderzochte versie gelijk aan `APP_VERSION`.
- `git diff --check` gaf geen codeproblemen.
- Alle genoemde lotings-RPC’s gebruiken dezelfde wedstrijdlock en werken duo-breed.

Niet kunnen verifiëren:

- Of productie daadwerkelijk v80 serveert.
- De HTTP-responsheaders en exacte GitHub Pages-cacheduur. DNS/netwerktoegang naar `viswedstrijdapp.nl` was in deze omgeving geblokkeerd.
- Of commit `131374f` en de v80-databasemigratie live staan. De export noemt ze live, maar ik kon dat niet onafhankelijk controleren.
- De actuele 13 deelnemers, drie `duo_id`-paren, 19 zones, `max_teams = 15` en live constraints/indexen.
- Of de gedeployde edge functions exact overeenkomen met de reviewkopieën.
- Gedrag op echte iPhones, meerdere gelijktijdige appvensters, volle opslag, privémodus en push tijdens langdurige slaapstand.
- SQL-races tegen productie. Ik heb geen muterende tests op de echte wedstrijd uitgevoerd.
- Er staat geen uitvoerbare geautomatiseerde regressietestset in deze checkout voor wachtrijconcurrentie, offline loting, eindtijd en duo-races.


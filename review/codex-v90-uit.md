**Oordeel: v90 nog niet vrijgeven.** Vooral de tijdgebonden rangschikking en het opslaan tijdens polling moeten worden aangepast.

Gecontroleerd tegen `docs/app.js`, `docs/nphv/index.html` en `review/database.sql`. JavaScript-syntaxcontrole slaagt. Gerichte Node-reproducties bevestigen de rangschikkingsfout, ontbrekende verplaatsingsmelding, gewichtsafronding en tijdzonegevallen. De SQL is statisch gecontroleerd; de toegepaste productiemigratie is niet onafhankelijk geverifieerd.

1. **Hoog: tijdcorrectie verandert de uitslag niet.**  
   **Bestand/functie:** `docs/app.js:1761`, `klTijdGrootste()`; `:1809`, `klassementRijen()`; `review/database.sql:1220`, `w_seizoen_stand()`; `:2060`, `wedstrijd.meld_afgelopen()`.  
   **Scenario:** A heeft 10 kg om 10.00 uur, geregistreerd om 12.00 uur. B heeft 10 kg om 10.30 uur, geregistreerd om 11.00 uur. De feed toont A als eerder gevangen, maar B wint de tiebreak. Een organisatorcorrectie verandert dat niet. Dit botst met de codecommentaar “vroegst gevangen wint”.  
   **Voorstel:** gebruik `vangstTijd()` zowel bij de selectie van de grootste vangst als bij de tijdvergelijking. Pas ook beide SQL-rangschikkingen aan naar `coalesce(gevangen_op, created_at)`. `klGrootsteVan()` zelf leest alleen gewicht en is niet het probleem. Ook `tekenVangst()` op regel 2103 gebruikt nog `created_at`, waardoor een deelafbeelding na een datumcorrectie de verkeerde datum kan tonen.

2. **Hoog: een correctie kan ongemerkt een gelijktijdige correctie terugdraaien.**  
   **Bestand/functie:** `docs/app.js:3575`, `renderBeheer()` en de opslaghandler op regel 3695.  
   **Scenario:** organisator A bewerkt de tijd. Organisator B verandert ondertussen de visser. De volgende poll vervangt `STATE`, maar laat vanwege het gefocuste invoerveld de oude formulierwaarden staan. A slaat op: de handler vergelijkt de oude visserselectie met de nieuwe `STATE` en stuurt onbedoeld een terugplaatsing mee. Bij gelijktijdige verwijdering wordt `v` zelfs `undefined` en loopt de handler vast.  
   **Voorstel:** bewaar per bewerkte rij de oorspronkelijke waarden en stuur uitsluitend bewust gewijzigde velden. Voeg servercontrole op een verwachte recordversie toe; meld een conflict bij tussentijdse wijziging of verwijdering.

3. **Middel: de nieuwe visserselectie wordt tijdens gebruik overschreven.**  
   **Bestand/functie:** `docs/app.js:3580`, `renderBeheer()`.  
   **Scenario:** de organisator kiest een andere visser en houdt de select gefocust. Na maximaal zes seconden bouwt polling `#b-vangsten` opnieuw op. Alleen `INPUT` en `TEXTAREA` beschermen tegen verversen; `SELECT` ontbreekt. De keuze verdwijnt.  
   **Voorstel:** voeg minimaal `SELECT` toe aan de bescherming. Bewaar daarnaast niet-opgeslagen wijzigingen per rij, zodat ook focusverlies vóór opslaan ze niet wist.

4. **Middel: alleen tijd of visser corrigeren kan ook het gewicht wijzigen.**  
   **Bestand/functie:** `docs/app.js:3688`, `renderBeheer()`; `parseGewicht()`.  
   **Scenario:** 12.345 gram is toegestaan door invoer en database. Het bewerkingsveld toont door `toFixed(2)` echter `12,35`. Zonder gewichtsaanpassing stuurt opslaan daardoor 12.350 gram mee en krijgt de vangst ook de auditmarkering `gewicht`. Dit is gereproduceerd.  
   **Voorstel:** behoud drie decimalen in het bewerkingsveld, of stuur gewicht uitsluitend mee wanneer de gebruiker dat veld daadwerkelijk heeft gewijzigd.

5. **Middel: gewijzigde handmatige tijd kan bij een retry stil worden genegeerd.**  
   **Bestand/functie:** `docs/app.js:3419`, submit-handler in `initBeheerKnoppen()`; `review/database.sql:1458`, `w_admin_voeg_vangst()`.  
   **Scenario:** toevoegen slaagt op de server, maar het antwoord gaat verloren. De organisator verandert daarna alleen de tijd en probeert opnieuw. `pogingKey` bevat geen tijd, dus dezelfde `p_client_id` blijft gelden. SQL retourneert `bestond_al`, waarna de interface succes meldt en het formulier wist. De nieuwe tijd is niet opgeslagen.  
   **Voorstel:** bevries de volledige payload tijdens retries. Handel `bestond_al` expliciet af en laat een gewijzigde tijd via de correctie-RPC opslaan. Alleen een nieuwe idempotentiesleutel maken kan hier juist een dubbele vangst veroorzaken.

6. **Middel: verplaatsingen blijven voor beide teams ongemeld.**  
   **Bestand/functie:** `docs/app.js:886`, `meldNieuweVangsten()`; `review/database.sql:985`, `w_admin_vangst()`.  
   **Scenario:** vangst X verhuist van A naar B. Beide clients kennen X al, dus de ID-controle slaat hem over. **Noch A, noch B krijgt een in-appmelding.** De correctie-RPC verstuurt ook geen push.  
   **Voorstel:** bewaar naast het ID ook het vorige `team_id` en meld een correctie afzonderlijk aan het oude en nieuwe team. Alleen het nieuwe team in de “nieuwe vangst”-logica opnemen helpt niet: eigen vangsten worden daar eveneens overgeslagen.

7. **Middel: verwijderde vangsten krijgen wel auditgegevens, maar nergens een zichtbare ster.**  
   **Bestand/functie:** `review/database.sql:985`, `w_admin_vangst()`; `:1485` en `:1520`, beide statefuncties; `docs/app.js`, `renderBeheer()`.  
   **Scenario:** verwijderen schrijft `gewijzigd_wat = ...verwijderd`, maar beide states leveren uitsluitend `status = 'actief'`. De vangst verdwijnt ook uit Beheer, dat dezelfde lijst gebruikt. De uitleg “Elke aanpassing krijgt een ★ … zichtbaar voor iedereen” klopt daardoor niet voor verwijderen.  
   **Voorstel:** voeg een afzonderlijk correctieoverzicht toe met verwijderingsregels. Houd die buiten `STATE.vangsten`, omdat het klassement alle daarin aanwezige vangsten meetelt.

8. **Middel: fototoestemming blijft aangevinkt bij een volgende aanmelding.**  
   **Bestand/functie:** `docs/app.js:508`, `route()`; `:2885`, aanmeldhandler in `initWedstrijd()`.  
   **Scenario:** iemand meldt zich met toestemming aan voor wedstrijd A en opent daarna wedstrijd B in hetzelfde document. `route()` verbergt de kaarten, maar reset het vinkje niet. Ook na aanmelden wordt het formulier niet gereset. B ontvangt daardoor opnieuw `true` zonder een nieuwe vinkhandeling.  
   **Voorstel:** reset het toestemmingsveld bij het beginnen van een nieuwe aanmelding of deelnemerswissel. Behoud de keuze alleen tijdens een retry van dezelfde aanmelding.

9. **Middel: de duo-maat kan zelf geen toestemming instellen; bij koppels is de registratie dubbelzinnig.**  
   **Bestand/functie:** `review/database.sql:400`, `w_join()`; `docs/app.js`, `renderTeamTab()` en `renderBeheer()`.  
   **Scenario:** bij een individueel duo krijgt alleen de aanmelder toestemming; de maat blijft terecht op `false`. Na inloggen heeft die maat echter geen instelling of RPC om dat zelf te veranderen. Bij een koppel staat één toestemmingsboolean voor twee personen, terwijl het vinkje over “Mijn vangstfoto’s” spreekt en Beheer het hele team als “socials ok” labelt.  
   **Voorstel:** voeg een via het eigen token beveiligde toestemmingsinstelling toe. Leg bij koppels expliciet vast op wie de toestemming betrekking heeft; presenteer één individuele keuze niet als toestemming van beide personen.

10. **Middel: tijdvalidatie begrenst niet tot het wedstrijdvenster.**  
    **Bestand/functie:** `review/database.sql:1009`, `w_admin_vangst()`; `:1466`, `w_admin_voeg_vangst()`.  
    **Scenario:** na afloop wordt een expliciete vangsttijd ná `eind_ts` geaccepteerd, zolang deze vóór `now()` ligt. Bij handmatig toevoegen omzeilt een lege tijd bovendien de tijdvalidatie volledig; de getoonde tijd wordt dan `created_at`. De late-deelnemer-RPC controleert wél op `eind_ts`.  
    **Voorstel:** valideer een effectieve vangsttijd tegen start, einde en huidige tijd. Als organisatorinvoer buiten het wedstrijdvenster bewust toegestaan is, maak daarvan een expliciete uitzondering; nu hangt het gedrag ongemerkt af van een leeg veld.

11. **Laag: zomertijdgrenzen kunnen een andere tijd opleveren dan ingevoerd.**  
    **Bestand/functie:** `docs/app.js:186`, `naarLocalInput()`; tijdconversies in beide beheerhandlers.  
    **Scenario:** in `Europe/Amsterdam` wordt `2026-03-29T02:30` door `new Date()` genormaliseerd naar 03.30 uur. Op 25 oktober bestaan twee verschillende tijdstippen die beide als 02.30 uur worden weergegeven; de vergelijkingscheck kan die niet onderscheiden. Beide gevallen zijn gereproduceerd.  
    **Voorstel:** controleer of de geconverteerde datum exact terugkomt als de ingevoerde lokale waarde. Maak bij dubbelzinnige tijden de offset expliciet. Op gewone dagen is lokaal invoeren → ISO/UTC → `timestamptz` correct; er is daar geen algemene verschuiving van twee uur.

De overige expliciet gevraagde controles:

- **Minutenafronding:** ongewijzigde seconden veroorzaken géén onterechte tijdcorrectie, omdat beide kanten door `naarLocalInput()` gaan. Bij een echte minuutwijziging worden seconden wel nul. Een correctie binnen dezelfde minuut is niet mogelijk. Een leeggemaakt tijdveld wordt genegeerd; maak het verplicht of bied expliciet “terug naar registratietijd” aan.
- **Handtekening na verplaatsing:** de normale correctieroute wijzigt `gewijzigd_op`, waardoor de feed opnieuw rendert. De eigen lijsten veranderen bovendien door het filter op `team_id`. Het ontbreken van `team_id` in de handtekening veroorzaakt via deze RPC dus geen aangetoonde renderfout.
- **Leegmaken in `route()`:** beide handtekeningen worden eerst `null`. De volgende state rendert de leeggemaakte lijsten opnieuw.
- **Tabloze toestand:** niet aangetoond voor de bestaande aanroepen. Een geweigerde `activateTab()` laat de huidige tab intact; `renderTabs()` kiest een geldige vervanger wanneer de actieve tab niet bij de rol hoort.


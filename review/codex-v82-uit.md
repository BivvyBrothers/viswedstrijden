**Oordeel: v82 heeft concrete herstelbugs en een race die teamgegevens onder de verkeerde wedstrijd kan opslaan. De wachtwoordbewaarfunctie is nog niet betrouwbaar onderbouwd. Ik adviseer een herstelrelease.**

Bronbasis: de diff, de lokale v82-code, beide tenantpagina’s, service workers en de SQL-snapshot. Vijf gerichte controles op de daadwerkelijke JS-functies zijn geslaagd. Browsergedrag is getoetst aan documentatie, niet op fysieke iOS- of Android-toestellen. De SQL-snapshot is niet live tegen productie gecontroleerd.

1. **Hoog · `docs/app.js`, `renderTeamTab()`, circa regel 3101: een late teamcode-response kan een andere sessie overschrijven.**  
   **Scenario:** wedstrijd A heeft een opgeslagen token zonder persoonlijke code. `w_mijn_team` loopt nog wanneer de gebruiker naar B gaat. De callback gebruikt vervolgens de actuele globale `CODE`: `sessie.zetTeam(CODE, { ...t, code: ... })`. Daardoor krijgt `team:B` het token en de teamgegevens van A. Ook de zichtbare code en het nieuwe bewaarveld worden gevuld met A’s code. Na uitloggen kan dezelfde callback bovendien het verwijderde team opnieuw opslaan.  
   **Voorstel:** leg wedstrijdcode, `SESSIE_GEN` en token vóór het verzoek vast. Controleer alle drie vóór iedere opslag- of DOM-mutatie. Doe dit ook voor de naburige duo-callback. De opslagrace bestond al; v82 breidt de gevolgen uit naar het wachtwoordformulier.

2. **Middel · `docs/app.js`, uitloghandler en `onthoudLaatste()`: uitloggen schakelt automatisch herstel niet werkelijk uit.**  
   **Scenario:** de handler verwijdert `team:CODE` en `laatste:tenant`, maar roept direct `laadState(false)` aan. Die schrijft via `onthoudLaatste()` dezelfde wedstrijd terug, ook zonder teamtoken. Als de state-load wordt overgeslagen wegens een lopend verzoek, doet een volgende succesvolle poll hetzelfde. Bij herstart belandt de gebruiker opnieuw in deze wedstrijd. Dit is met de echte functies bevestigd.  
   **Voorstel:** bewaar een expliciete onderdrukking per wedstrijd na uitloggen, die pas door een nieuwe bewuste deelnameactie vervalt. Wis de laatste verwijzing bovendien alleen als die bij de uitgelogde wedstrijd hoort.

3. **Middel · `docs/app.js`, `laadState()` → `onthoudLaatste()`: “laatst geopend” betekent feitelijk “laatst succesvol gepolld”.**  
   **Scenario:** A en B staan in twee tabbladen binnen dezelfde tenant. Beide overschrijven elke poll dezelfde herstelverwijzing. De volgende herstart hangt af van welk antwoord als laatste arriveerde. Daarnaast verdringt het even openen van B zonder team de actieve deelname aan A. Dat laatste is bevestigd.  
   **Voorstel:** werk de herstelkeuze bij na een bewuste routeopening of succesvolle aanmelding. Ververs bij polls alleen naam/eindtijd wanneer de opgeslagen verwijzing nog naar diezelfde wedstrijd en rol wijst. Bewaar desgewenst “laatst bekeken” afzonderlijk van “actieve deelname”.

4. **Middel · `docs/app.js`, `laadState()` en `onthoudLaatste()`: een organisator die ook deelnemer is, valt buiten herstel.**  
   **Scenario:** iemand heeft zowel een geldig teamtoken als een geldige wedstrijdpin. De initiële state-load kiest automatisch `ROL = 'organisator'`. Vervolgens weigert `onthoudLaatste()` deze wedstrijd te bewaren. Een bestaande verwijzing naar een andere wedstrijd blijft staan. Ook is de teamtab voor deze rol verborgen.  
   **Voorstel:** bepaal deelnemerherstel aan de hand van het aanwezige team en de expliciet gekozen rol, onafhankelijk van het bezit van een pin. Voeg een bewuste keuze tussen organiseren en deelnemen toe. Het bezit van beide credentials mag niet automatisch deelname uitsluiten.

5. **Middel · `docs/app.js`, `DOMContentLoaded`, `route()` en `hervatLaatste()`: `home-bewust` heeft een onduidelijke levensduur en is niet tenantspecifiek.**  
   **Scenario:** na een klik op terug blijft de vlag bestaan zolang de paginasessie behouden blijft. Een herladen of herstelde sessie op de tenantroot slaat daardoor automatisch herstel over. Bij navigatie van `/nphv/` naar `/demo/` in hetzelfde tabblad beïnvloedt dezelfde vlag ook de andere tenant. `sessionStorage` overleeft reloads en sessieherstel; aannemen dat iedere PWA-herstart het wist, is dus onjuist. Het precieze iOS-startpad vereist een toesteltest. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)  
   **Voorstel:** voor teruggaan binnen de huidige SPA is de vlag overbodig, omdat uitsluitend `route(true)` herstelt. Verwijder haar als iedere nieuwe documentstart moet hervatten. Moet een bewuste homekeuze ook reloads overleven, maak dat beleid expliciet, tenantspecifiek en begrensd.

6. **Middel · `docs/app.js`, `sessie.zetLaatste()` en `laadState()`: mislukte opslag blokkeert een succesvolle schermverversing.**  
   **Scenario:** `localStorage.setItem()` faalt, bijvoorbeeld door overschrijding van de opslaglimiet. `onthoudLaatste()` staat vóór `renderAlles()`. De exception belandt in de algemene laadfoutafhandeling: de app toont een verbindingsprobleem terwijl de RPC succesvol was en verwerkt de nieuwe state niet verder. Dit kan zich iedere poll herhalen.  
   **Voorstel:** vang fouten van de optionele herstelopslag lokaal af. Laat de actuele wedstrijd altijd renderen. Schrijf de herstelgegevens alleen wanneer ze veranderen.

7. **Middel · `docs/nphv/index.html`, `docs/demo/index.html`, `form-bewaar-code`; `docs/app.js`, submit-handler: de bewaarbelofte gaat verder dan de implementatie.**  
   **Scenario:** de gebruiker drukt op “bewaar in de wachtwoorden van je telefoon”. De app doet uitsluitend `preventDefault()`, verbergt het formulier en toont een toast. Er is geen bevestiging dat iets is opgeslagen. De uitleg “dan staat de code al bewaard, of bewaart je browser geen wachtwoorden” mist de mogelijkheid dat de browser dit formulier niet als geslaagde authenticatie herkent.  
   Chromium adviseert een herkenbare navigatie of History-navigatie met volledige verwijdering van het formulier. Apple beschrijft autocomplete-attributen als ondersteuning voor herkenning. Geen van beide onderbouwt dat dit verborgen, vooraf ingevulde, `readonly new-password`-veld met deze SPA-submit gegarandeerd een bewaarvraag oplevert. [Chromium](https://new.chromium.org/developers/design-documents/create-amazing-password-forms/), [Apple](https://developer.apple.com/documentation/security/enabling-password-autofill-on-an-html-input-element)  
   **Voorstel:** behandel wachtwoordopslag als optionele browserfunctie rond een echte succesvolle herstelactie. Maak kopiëren/delen de duidelijke, betrouwbare bewaarroute. Vervang de uitleg door: “Geen bewaarvraag gezien? We kunnen niet controleren of je telefoon de code heeft opgeslagen. Kopieer of deel de code om hem zelf te bewaren.” Claim pas ondersteuning na tests op beide genoemde browsers.

8. **Middel · `docs/app.js`, `route()` en handler van `form-herstel`: de username kan bij de verkeerde wedstrijd horen.**  
   **Scenario:** het herstelformulier staat open bij A, met username `nphv-A`. De gebruiker vult een persoonlijke code van B in. `w_login_deelnemer` accepteert dat bewust en navigeert vervolgens naar B. Tijdens het indienen was de combinatie echter username A met wachtwoord B. Als een wachtwoordmanager die combinatie vastlegt, is de wedstrijdlabeling onjuist.  
   **Voorstel:** richt de bewaarstap pas na succesvolle identificatie in met `login.wedstrijd_code`. Een username per wedstrijd onderscheidt bovendien geen twee deelnemers aan dezelfde wedstrijd op één toestel; voeg daarvoor een stabiele deelnemersidentiteit toe. Welke combinatie browsers nu daadwerkelijk bewaren, blijft een praktijktest.

9. **Middel · `docs/nphv/sw.js` en `docs/demo/sw.js`, fetch-handler: oude `app.js` en nieuwe HTML kunnen worden gemengd, ook tussen tenantcaches.**  
   **Scenario:** de nieuwe HTML wordt opgehaald, maar `/app.js` valt terug op cache. `caches.match()` zoekt zonder cachebeperking door alle caches. Daardoor kan bijvoorbeeld de oude gedeelde `/app.js` uit de democache worden gebruikt. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage/match)  
   Met v81-JS heeft het nieuwe bewaarformulier geen submit-handler en doet het een gewone formuliernavigatie. De oog- en deelknoppen hebben evenmin hun nieuwe handlers. `checkVersie()` kan dit offline niet herstellen; online wordt automatisch herladen maar één keer per doelversie geprobeerd.  
   **Voorstel:** zoek uitsluitend in de eigen tenantcache. Gebruik daarnaast een samenhangende release-shell met versiegebonden assetnamen. Alleen `?v=82` toevoegen is hier onvoldoende zolang `ignoreSearch: true` verschillende versies gelijk behandelt. Dit cacheprobleem bestond al, maar raakt de nieuwe functie rechtstreeks.

10. **Middel · `docs/app.js`, `renderVangsten()`, `renderTeamTab()` en `vangstFotoHtml()`: een mislukte foto krijgt geen gerichte herstelpoging.**  
    **Scenario:** de vangsten-JSON komt binnen, maar de afbeeldingsrequest mislukt bij slecht bereik. De handtekening blijft daarna gelijk, dus nieuwe succesvolle polls behouden hetzelfde kapotte image-element. De `online`-handler probeert alleen de vangstenwachtrij te versturen.  
    **Voorstel:** behoud de handtekeningoptimalisatie, maar markeer mislukte afbeeldingen met een `error`-handler en probeer uitsluitend die afbeeldingen opnieuw na herstel van de verbinding. De hele lijst opnieuw opbouwen is daarvoor niet nodig.

11. **Laag · `docs/app.js`, `vangstenHandtekening()`: scheidingstekens kunnen een noodzakelijke render verbergen.**  
    **Scenario:** `naam="Jan|Piet", naam2="Kees"` en `naam="Jan", naam2="Piet|Kees"` produceren dezelfde naamcomponent in de handtekening, maar verschillende zichtbare ledenteksten. Deze botsing is met de echte functie bevestigd.  
    **Voorstel:** gebruik `JSON.stringify()` op arrays met afzonderlijke veldwaarden. Ken de nieuwe handtekening pas toe nadat de DOM-opbouw en knopkoppeling succesvol zijn afgerond.

12. **Laag · `docs/app.js`, submit-handler van `form-bewaar-code` en `renderTeamTab()`: de bedoelde wachttijd van 60 seconden werkt niet.**  
    **Scenario:** submit zet `f.hidden = true`. De volgende succesvolle poll roept `zetTeamCode(t.code)` aan en zet het formulier alweer zichtbaar, doorgaans binnen zes seconden. De uitleg blijft staan, ook bij een volgende wedstrijd.  
    **Voorstel:** beheer de zichtbaarheid met expliciete toestand per wedstrijd/team, bijvoorbeeld een tijdstip tot wanneer het formulier verborgen blijft. Reset de uitleg bij een sessiewissel.

13. **Middel · `docs/app.js`, handler van `btn-code-deel`: de gedeelde inloglink kan naar een andere wedstrijd leiden.**  
    **Scenario:** iemand bewaart de code van A, bezoekt later B en opent daarna het bericht over A. De gedeelde link bevat alleen de tenantroot. Sessieherstel stuurt hem daarom naar B, terwijl het bericht over A gaat.  
    **Voorstel:** deel de concrete deelnemersroute: `${location.origin}${location.pathname}#/w/${CODE}`. Voeg toe dat de persoonlijke code bij die wedstrijd hoort.

14. **Laag · `docs/app.js`, `laatsteGeldig()` en `hervatLaatste()`: ongeldige einddatums verlopen nooit.**  
    **Scenario:** een herstelrecord bevat een ongeldige datum. De vergelijking met `NaN` is steeds `false`, waardoor zowel opruimen als de automatische herstelgrens wordt omzeild. Een ontbrekende einddatum wordt expliciet `Infinity`. De ongeldige-datumroute is bevestigd.  
    **Voorstel:** eis een eindige geparste datum en een boolean voor `kijker`. Wis ongeldige records. Gebruik een ontbrekende datum niet als onbeperkte toestemming voor automatisch herstel.

Ook gecontroleerd, zonder daar een bug van te maken:

- **Geen automatische teruglus bij gewone hash-navigatie:** `initieel === true` sluit het `HashChangeEvent` uit; `location.replace()` voorkomt bovendien een extra geschiedenisitem.
- **Kijklink van dezelfde wedstrijd:** de SQL-snapshot eist verschillende deelnemers- en kijkcodes. Daardoor beschermt `h.code !== code` de bestaande deelname hier normaal juist wel.
- **Fasewisselingen:** registratievelden, geslotenmelding en doorgeefknop worden vóór de handtekening-check bijgewerkt. De check blokkeert die updates niet. Deelknoppen lezen bij aanklikken de actuele `STATE`.
- **Normale afloop en verwijdering:** na 24 uur vervalt automatisch herstel, na zeven dagen de Verder-kaart. Een succesvolle “niet gevonden”-response wist de bijbehorende verwijzing; een netwerkfout doet dat terecht niet.
- **Demo is lokaal bijgewerkt:** beide tenantpagina’s bevatten de nieuwe formulieren en beide tenantversiebestanden staan op 82.

**Releaseverdict: herstel eerst de sessierace, de overschrijfregels voor herstel en de cacheconsistentie. Presenteer wachtwoordopslag tot toestelvalidatie als een mogelijkheid, niet als een werkende garantie.**


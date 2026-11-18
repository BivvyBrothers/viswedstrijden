De belangrijkste risico’s zitten in de service worker van de demo, de standaardverzending van wachtwoordformulieren en de navigatie op smalle schermen.

Dit is een statische review van uitsluitend de aangeleverde code. `app.js`, `styles.css`, mediabestanden en tenantconfiguraties ontbreken. Runtimegedrag, contrast en daadwerkelijke offlinewerking zijn daardoor niet geverifieerd. Onderstaande 21 bevindingen staan op ernst gesorteerd.

1. **Hoog | `docs/demo/index.html:451–454, 470–473` | Persoonlijke code kan in de URL terechtkomen.**  
   Beide formulieren bevatten `name="password"`, maar missen `method`. De browser gebruikt standaard GET. Wanneer JavaScript de verzending niet onderschept, verschijnt de code in de URL en mogelijk in geschiedenis en serverlogs.  
   **Fix:** geef deze formulieren een veilige verzendroute. Voor een uitsluitend door JavaScript afgehandeld formulier: gebruik `method="post"`, onderschep `submit` met `preventDefault()` en activeer verzendknoppen pas nadat de handlers zijn gekoppeld. GitHub Pages kan die POST zelf niet afhandelen, maar het geheim belandt zo niet in de URL.

2. **Hoog | `docs/demo/sw.js:39–42` | Offlinefallback zoekt alsnog door alle tenantcaches.**  
   De eerste lookup gebruikt de eigen cache, maar de navigatiefallback gebruikt `caches.match()`. Dat doorzoekt alle caches van dezelfde origin en doorbreekt de expliciet bedoelde isolatie. Als niets gevonden wordt, kan bovendien `undefined` worden teruggegeven waar een `Response` nodig is.  
   **Fix:** voer ook beide fallbacklookups uit via dezelfde geopende democache. Eindig altijd met een expliciete offline-`Response` als de shell ontbreekt.

3. **Middel | `docs/demo/sw.js:11–15` | Installatie slaagt ook zonder essentiële appbestanden.**  
   `Promise.allSettled()` laat de installatie slagen wanneer bijvoorbeeld `index.html` of `/app.js` niet gecachet kon worden. De worker kan daarna activeren terwijl de offline-app onbruikbaar is.  
   **Fix:** cache essentiële bestanden met een installatieblokkerende `Promise.all()` of `addAll()`. Behandel alleen optionele afbeeldingen en andere niet-essentiële bestanden met `allSettled()`.

4. **Middel | `docs/demo/sw.js:6, 15–22, 30–33` | Updates kunnen verschillende codeversies mengen.**  
   De vaste cachenaam wordt tijdens installatie en gebruik overschreven. HTML, configuratie en gedeelde scripts worden onafhankelijk bijgewerkt. `skipWaiting()` en `clients.claim()` kunnen die combinatie direct aan bestaande pagina’s opleggen.  
   **Fix:** gebruik een cachenaam per release, vul de essentiële shell volledig en laat een nieuwe worker pas na een gecontroleerde update overnemen. Serveer de shellbestanden vervolgens als samenhangende release.

5. **Middel | `docs/demo/sw.js:30–33` | Cachewrites vallen buiten de levensduur van het event.**  
   De promise van `caches.open(...).then(...put...)` wordt niet afgewacht en niet met `e.waitUntil()` verbonden. De browser kan de worker beëindigen voordat de cachewrite klaar is.  
   **Fix:** koppel de volledige cachewrite aan `e.waitUntil()` of neem hem op in de afgehandelde promise.

6. **Middel | `docs/demo/sw.js:25–33` | De runtimecache heeft geen inhoudelijke begrenzing of opruiming.**  
   Iedere succesvolle GET naar dezelfde origin kan worden opgeslagen, ook buiten de demo. Varianten met verschillende querystrings krijgen afzonderlijke entries. Er is geen limiet of vervalbeleid.  
   **Fix:** gebruik een allowlist voor demo- en gedeelde shellbestanden. Cache overige bestanden alleen bewust, met een maximumaantal entries of vervalbeleid.

7. **Middel | `docs/demo/sw.js:29–42` | Cachefallback kan bij slecht bereik lang uitblijven.**  
   De cache wordt pas geraadpleegd wanneer `fetch()` faalt. Een hangende verbinding kan de offline-shell daardoor lang blokkeren. Ook een HTTP 500 leidt rechtstreeks tot een foutpagina, ondanks een beschikbare cache.  
   **Fix:** gebruik voor navigaties een netwerkverzoek met een begrensde wachttijd en cachefallback. Definieer expliciet welke HTTP-fouten eveneens een fallback krijgen.

8. **Middel | `docs/demo/sw.js:53–54, 71–79` | Pushafhandeling kan het verkeerde tenantvenster gebruiken.**  
   Met `includeUncontrolled: true` worden ook vensters buiten de demo meegenomen. De klikhandler kiest vervolgens het eerste venster dat gefocust kan worden. Een notificatie kan zo een andere tenant of de marketingsite overnemen. `includes()` is bovendien geen betrouwbare routevergelijking.  
   **Fix:** beperk kandidaten tot dezelfde origin én het pad `/demo/`. Vergelijk geparste routes exact, geef een passend wedstrijdvenster voorrang en open anders een nieuw demovenster.

9. **Middel | `docs/sw.js:10–11` | Opruimen forceert een herlaadactie zonder die af te wachten.**  
   Alle gevonden gecontroleerde vensters worden opnieuw genavigeerd. Dat kan een actieve invoer onderbreken. De navigatiepromises vallen buiten de afgewachte opruimtaak.  
   **Fix:** verwijder de automatische herlaadactie als uitschrijven voldoende is. Is herladen noodzakelijk, beperk dit dan tot relevante pagina’s, bescherm niet-opgeslagen invoer en wacht de navigaties af met `Promise.allSettled()`.

10. **Middel | `docs/landing.css:51–72` | De topbar kan buiten het scherm vallen.**  
    Merk en inloglink staan zonder wrapping naast elkaar en gebruiken `white-space: nowrap`. Vanaf 880 px komen daar vijf navigatielinks bij. Rond die grens en op smalle telefoons kan de gezamenlijke breedte groter zijn dan de beschikbare ruimte. `overflow-x: hidden` op regel 38 verbergt vervolgens de overloop.  
    **Fix:** voeg een mobiele menuvariant toe, laat de topbar gecontroleerd omslaan of verhoog het desktopbreekpunt op basis van de benodigde breedte. Controleer ook 320 px en tekstvergroting.

11. **Middel | `docs/demo/index.html:81, 90, 99, 246, 266, 295, 304, 308, 453–454, 555, 563` | Meerdere invoervelden missen een blijvend label.**  
    Deze velden hebben geen gekoppeld `<label>` of expliciete toegankelijke naam. Placeholders verdwijnen tijdens invoer en vervangen geen zichtbaar label. De omliggende uitleg is niet programmatisch gekoppeld.  
    **Fix:** voeg zichtbare `<label for="…">`-elementen toe. Verbind aanvullende instructies via `aria-describedby`.

12. **Middel | `docs/index.html:82–89` | De film heeft geen bediening wanneer JavaScript uitvalt.**  
    Het video-element heeft geen `controls`. De zichtbare afspeelknop werkt uitsluitend via `film.js`. Bij een laadfout blijven een onbedienbare video en een niet-functionerende knop over.  
    **Fix:** zet standaard `controls` op de video. Verwijder die pas nadat de aangepaste bediening succesvol is geïnitialiseerd, en toon de aangepaste knoppen pas dan.

13. **Middel | `docs/film.js:33–40` | De geluidsknop hangt af van niet-portabele audiodetectie.**  
    De gebruikte eigenschappen zijn niet uniform beschikbaar. Een browser kan dus een geluidsspoor afspelen terwijl `heeftGeluid()` altijd `false` retourneert. De knop blijft dan verborgen. Of de aangeleverde film geluid bevat, is niet vast te stellen.  
    **Fix:** leg voor deze bekende videobestanden expliciet vast of ze geluid bevatten, bijvoorbeeld met `data-heeft-geluid`. Laat essentiële bediening niet afhangen van deze detectie.

14. **Middel | `docs/demo/index.html:656–672` | Het uitnodigingsvenster mist dialoogsemantiek.**  
    Dit element gebruikt dezelfde `lightbox`-opzet als de andere vensters, maar mist `role="dialog"`, een toegankelijke naam en een modaliteitsverklaring.  
    **Fix:** voeg bij werkelijk modaal gebruik `role="dialog"`, `aria-modal="true"` en `aria-labelledby` naar de titel toe. Regel daarnaast beginfocus, focusbegrenzing, Escape en focusteruggave. Die laatste onderdelen zijn zonder `app.js` niet te beoordelen.

15. **Middel | `docs/demo/index.html:338–345, 371–373, 398–399, 620–624` | Actieve keuzes zijn in de HTML alleen visueel gemarkeerd.**  
    Klassen zoals `actief` geven hulptechnologie geen geselecteerde toestand door. Of `app.js` die toestand alsnog toevoegt, is onbekend.  
    **Fix:** geef schakelknoppen een bijgewerkte `aria-pressed`. Gebruik voor echte tabs het volledige tabpatroon met `aria-selected`, paneelkoppelingen en toetsenbordbediening. Geef de onderste navigatie een eigen naam en maak de huidige bestemming programmatisch herkenbaar.

16. **Laag | `docs/index.html:23` | Redirectscript blokkeert de HTML-parser.**  
    `landing.js` wordt synchroon in de head opgehaald en uitgevoerd. Daardoor wacht de rest van de pagina op het script. Vroeg redirecten kan bewust zijn, maar ook normale bezoekers betalen deze blokkering.  
    **Fix:** voeg `defer` toe als redirecten na het parsen acceptabel is. Behoud de synchrone uitvoering alleen als de vroege redirect aantoonbaar nodig is.

17. **Laag | `docs/index.html:28–40` | Een directe springlink naar de hoofdinhoud ontbreekt.**  
    Toetsenbordgebruikers moeten bij ieder bezoek langs de headerlinks voordat zij de inhoud bereiken.  
    **Fix:** voeg vóór de header een bij focus zichtbare link toe naar bijvoorbeeld `<main id="hoofdinhoud">`.

18. **Laag | `docs/index.html:240–255` | Nieuwe hoofdonderwerpen beginnen met h3.**  
    Seizoenscompetitie en delen zijn zelfstandige onderwerpen in een nieuwe sectie, maar volgen semantisch onder de eerdere h2 over het live klassement.  
    **Fix:** maak beide kaarttitels h2, met behoud van de gewenste vormgeving, of voeg een passende overkoepelende h2 toe.

19. **Laag | Alle vier aangeleverde HTML-pagina’s, binnen de head | Canonical ontbreekt.**  
    `og:url` vervangt geen canonical. Bij bereikbaarheid via meerdere URL-varianten ontbreekt een expliciet aangegeven voorkeursadres.  
    **Fix:** voeg per pagina een absolute, naar zichzelf verwijzende `<link rel="canonical" href="…">` toe. Controleer dat interne links hetzelfde voorkeursadres gebruiken.

20. **Laag | `docs/inloggen/index.html:24–36`; `docs/landing.css:105–108, 129, 191, 304–305` | Dubbele en ongebruikte CSS maakt onderhoud lastiger.**  
    `.water-kaart` krijgt kort na elkaar verschillende waarden voor padding en margin. In de landings-CSS worden `display`-waarden direct weer overschreven. `.knop.donker`, `.knop img` en `.slogan-blok.donker` worden nergens in de aangeleverde landingspagina gebruikt. De omgekeerde beeldvolgorde is al aanwezig in de DOM.  
    **Fix:** consolideer de dubbele regels en verwijder selectors die voor deze pagina aantoonbaar overbodig zijn.

21. **Laag | `docs/index.html:18`; `docs/inloggen/index.html:18`; `docs/demo/index.html:18`; `docs/instructies.html:18` | Inline styles verzwakken de stijlbeperking van de CSP.**  
    Alle policies staan `'unsafe-inline'` toe voor styles. Dit is geen aangetoond beveiligingslek, maar beperkt de bescherming tegen geïnjecteerde stijlen.  
    **Fix:** verplaats inline style-attributen en styleblokken naar eigen stylesheets en verwijder daarna `'unsafe-inline'`. Controleer voor de demo eerst of `app.js` dynamische inline styles nodig heeft.

Verder zie ik in de aangeleverde HTML geen dubbele id’s, ontbrekende `lang`-attributen, ontbrekende `alt`-attributen of duidelijk ongeldige nesting. Lege alt-teksten bij decoratieve beelden zijn passend. Een h2 binnen een `summary` is toegestaan. Alle aangeleverde `target="_blank"`-links hebben `rel="noopener"`.

Titles, descriptions en Open Graph-tags zijn aanwezig. Structured data ontbreekt, maar dat is een optionele SEO-uitbreiding. De fonts worden lokaal geladen met `font-display: swap`. Ontbrekende eigen focusregels betekenen hier ook niet automatisch dat focus onzichtbaar is: de aangeleverde CSS schakelt de standaardbrowseroutline niet uit.
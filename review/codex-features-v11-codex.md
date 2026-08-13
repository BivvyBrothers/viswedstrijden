# Codex-featureadvies (13 aug 2026)

Rauwe output van `codex exec` (read-only) op de vraag welke functionaliteit
nog toegevoegd zou moeten worden. De bestaande backlog is BEWUST niet
meegegeven, zodat het advies onafhankelijk is.

Mijn advies: bouw eerst wedstrijdsjablonen, maak de stekkenstructuur echt tenantgebonden en voeg een betrouwbare offline vangstwachtrij toe. Die combinatie verlaagt het dagelijkse werk, maakt klant twee werkelijk mogelijk en versterkt de belangrijkste belofte aan de waterkant.

## Korte STORM-check

- **Bronnen:** `CLAUDE.md`, `README.md`, het draaiboek, frontend, service worker, laatste SQL-definities, edgefuncties, tenantgenerator en prijsblad.
- **Aannames:** nieuwe klanten gebruiken andere steknummers en organisatoren herhalen grotendeels dezelfde wedstrijden.
- **Tegenperspectief:** met één echte klant is nog niet bewezen welke functies verkoop opleveren. Daarom geef ik betrouwbaarheid en herhaalwerk voorrang boven verbreding.
- **Ontbrekend:** gebruiksstatistieken, supportvragen en interviews met andere verenigingen.
- **Basis:** sterk genoeg voor voorstellen 1 tot en met 4. Voor de overige voorstellen zou ik eerst drie tot vijf organisatoren spreken.

## Voorstellen, gerangschikt op waarde gedeeld door inspanning

### 1. Wedstrijd dupliceren of gebruiken als sjabloon

Voeg bij iedere eerdere wedstrijd de knop **Gebruik als sjabloon** toe. Daarmee worden type, maximum, regels, wedstrijdduur, seizoen en dagregel ingevuld voor een nieuwe datum, maar nooit deelnemers, vangsten, codes of loting.

- **Voor wie:** organisator.
- **Waarom nu:** het draaiboek zegt letterlijk dat de organisator iedere keer maximum, tijden en regels moet invullen of plakken. De huidige aanmaakflow verstuurt al deze velden opnieuw, zonder hergebruik ([docs/app.js](docs/app.js:489)).
- **Omvang:** klein, uren.
- **Risico:** oude regels kunnen gedachteloos worden overgenomen. Toon daarom vóór aanmaken een korte samenvatting met “controleer regels en tijden”.

### 2. Tenantgebonden waterprofiel met eigen stekkenring

Maak `wateren` en `water_stekken` de bron van waarheid voor steknummers, fysieke volgorde, onderbrekingen en standaardzones. Iedere wedstrijd krijgt een `water_id`; bij één water wordt dat automatisch gekozen, bij meerdere wateren verschijnt een keuzelijst.

- **Voor wie:** producteigenaar en organisator.
- **Waarom nu:** de frontendkaart is per tenant, maar de server valideert alle zones en stekkeuzes nog tegen één globale NPHV-`stek_ring` ([review/database.sql](review/database.sql:205)). De tenantgenerator waarschuwt zelfs dat stekkeuze alleen met de NPHV-nummering werkt ([tools/nieuwe_tenant.py](tools/nieuwe_tenant.py:228)). Dit blokkeert de kernfunctie bij klant twee en botst met het verkochte concept van eigen en extra wateren.
- **Omvang:** middel, meerdere dagen. Reken op groot als meerdere wateren direct volledig beheersbaar moeten worden.
- **Risico:** migratie van bestaande NPHV-wedstrijden en synchronisatie tussen kaartbestand en database. Geen extra server nodig en vrijwel geen privacykosten.

### 3. Offline vangst veiligstellen met wachtrij en nacontrole

Bij “Registreer vangst” worden gewicht, gecomprimeerde foto en een unieke poging eerst duurzaam in IndexedDB opgeslagen. De app probeert in de voorgrond opnieuw te verzenden; komt de verbinding pas na de eindtijd terug, dan wordt de vangst als **wacht op goedkeuring** bij de organisator aangeboden.

- **Voor wie:** deelnemer en organisator.
- **Waarom nu:** de service worker bewaart alleen de appbestanden, niet de vangstinvoer ([docs/nphv/sw.js](docs/nphv/sw.js:25)). De huidige retry leeft alleen in een JavaScriptvariabele en verdwijnt bij sluiten of herladen ([docs/app.js](docs/app.js:2204)); het draaiboek schuift dit nu door naar handmatige invoer door de organisator.
- **Omvang:** middel, dagen.
- **Risico:** een tijdstip op een offline telefoon is geen betrouwbaar bewijs. Laat na de eindtijd daarom altijd de organisator beslissen. Wis lokale foto’s automatisch na succesvolle synchronisatie. Vertrouw niet uitsluitend op Background Sync, omdat ondersteuning op iPhone beperkt is. Geen permanent eigen servertje nodig.

### 4. Volledige uitslag exporteren als CSV en printblad

Voeg voor de organisator een export toe met alle deelnemers, stekken of zones, vangsten, tijden, totaalgewicht, grootste vis en eindklassering. Maak daarnaast een eenvoudige printweergave voor clubarchief en prijsuitreiking.

- **Voor wie:** organisator.
- **Waarom nu:** de huidige deelafbeelding bevat alleen de top tien ([docs/app.js](docs/app.js:1509)). Dat is geschikt voor WhatsApp, maar niet als volledige officiële uitslag of invoer voor een verenigingsadministratie.
- **Omvang:** klein, uren.
- **Risico:** het exportbestand bevat namen en vangstgegevens buiten de app. Zet er daarom een korte privacywaarschuwing bij. Geen server nodig.

### 5. Wedstrijddagdashboard met aanwezigheidscheck

Maak één compact scherm met aanwezig, afwezig, nog niet gekozen, aan de beurt, vangsten in behandeling en snelle noodacties. Laat de organisator vóór de loting deelnemers afvinken en loot standaard alleen onder aanwezigen.

- **Voor wie:** organisator.
- **Waarom nu:** “aangemeld” betekent nu automatisch “aanwezig”. Bij een no-show moet de organisator wachten, een plaats toewijzen of de deelnemer verwijderen, precies zoals het draaiboek beschrijft ([draaiboek-wedstrijddag.md](draaiboek-wedstrijddag.md:30)).
- **Omvang:** middel, dagen.
- **Risico:** een verplichte check-in kan kleine vriendengroepen irriteren. Maak hem per wedstrijd optioneel. Aanwezigheid is nieuwe persoonsgegevens, maar blijft beperkt tot de wedstrijd en vereist geen locatie.

### 6. Betrouwbare identiteit binnen een seizoen, zonder account

Geef deelnemers binnen één seizoen een interne seizoensidentiteit en laat de organisator bijna gelijke namen samenvoegen. Bij aanmelden kan de deelnemer een eerder gebruikte naam aantikken, zonder een algemeen profiel of persoonlijk vangstenlogboek te maken.

- **Voor wie:** organisator en deelnemer.
- **Waarom nu:** de seizoensstand koppelt nu op genormaliseerde naam. “Jan”, “Jan B.” en een typefout worden daardoor verschillende personen; het ontwerp benoemt dit zelf als fase 2 ([seizoensklassement-ontwerp.md](seizoensklassement-ontwerp.md:84)).
- **Omvang:** middel, dagen.
- **Risico:** dit volgt iemand wel over meerdere wedstrijden. Beperk de identiteit daarom tot één organisatie en één seizoen, maak hem niet doorzoekbaar en verwijder hem met het seizoen.

### 7. Fotoarchief met bewaartermijn

Laat een organisatie kiezen: foto’s onbeperkt bewaren, na 30, 90 of 365 dagen verwijderen, of handmatig “wedstrijd archiveren”. Gewichten, uitslagen en seizoenspunten blijven bestaan, alleen de originele foto’s verdwijnen.

- **Voor wie:** organisator en producteigenaar.
- **Waarom nu:** foto’s staan in een publiek leesbare bucket en verdwijnen nu pas betrouwbaar bij het verwijderen van de hele wedstrijd ([review/wis-fotos.ts](review/wis-fotos.ts:1)). Bewaartermijnen maken het privacyverhaal concreter en beperken opslaggroei.
- **Omvang:** middel, dagen.
- **Risico:** verwijderen is onomkeerbaar en oude deelafbeeldingen kunnen hun bronfoto verliezen. Automatische uitvoering vraagt Supabase Cron of een vergelijkbare geplande taak, maar geen eigen permanent servertje. Begin eventueel met handmatig archiveren.

### 8. Optionele controlemodus met correctiegeschiedenis

Bied per wedstrijd twee standen: **direct tellen** zoals nu, of **eerst goedkeuren**. Leg bij correcties het oorspronkelijke gewicht, het nieuwe gewicht, tijdstip en soort actie vast, zodat discussies kunnen worden teruggelezen zonder deelnemersaccounts.

- **Voor wie:** organisator, deelnemer en kijker.
- **Waarom nu:** een deelnemervangst telt nu onmiddellijk mee; een beheerder kan het gewicht later overschrijven of de vangst verbergen. Het datamodel kent alleen `actief` en `verwijderd`, dus er is geen inzicht in wat is aangepast ([review/database.sql](review/database.sql:94)).
- **Omvang:** middel, dagen.
- **Risico:** goedkeuring haalt snelheid en plezier uit informele wedstrijden. Houd “direct tellen” als standaard en zet controlemodus alleen aan voor verenigingen die dit nodig hebben. Een auditlog vergroot de hoeveelheid bewaarde gegevens enigszins.

### 9. Instelbare zichtbaarheid van het live klassement

Laat de organisator kiezen tussen altijd live, alleen vangsten tonen zonder tussenstand, stand met vertraging, of klassement pas na afloop. De server moet dit afdwingen; alleen onderdelen verbergen in JavaScript is onvoldoende omdat de kijker-RPC nu alle vangsten terugstuurt ([review/database.sql](review/database.sql:1162)).

- **Voor wie:** organisator, deelnemer en kijker.
- **Waarom nu:** sommige wedstrijdvormen kunnen baat hebben bij minder tactische informatie tijdens de wedstrijd. Dit is nog een hypothese, geen aangetoond probleem bij de huidige klant.
- **Omvang:** middel, dagen.
- **Risico:** minder live spanning en mogelijk verwarring bij kijkers. Toon daarom duidelijk wanneer en waarom de stand verborgen is.

### 10. Beperkte weegploegrol

Maak een aparte code voor controleurs die alleen een team kunnen kiezen of scannen en een vangst kunnen registreren of goedkeuren. Zij krijgen geen toegang tot tijden, loting, deelnemers verwijderen, wedstrijd verwijderen of organisatie-instellingen.

- **Voor wie:** organisator en officiële weegploeg.
- **Waarom nu:** handmatig toevoegen bestaat al, maar vereist nu de volledige beheerderspin en geeft daarmee veel meer rechten dan een controleur nodig heeft ([docs/app.js](docs/app.js:2424)). Dit kan de app geschikter maken voor wedstrijden waar niet iedere visser zelf registreert, maar valideer die behoefte eerst bij potentiële klanten.
- **Omvang:** groot, weken.
- **Risico:** een extra rol vergroot autorisatie-, test- en supportcomplexiteit. Verkeerd gedeelde controleurcodes kunnen uitslagen beïnvloeden. Geen permanent servertje nodig.

## Welke drie ik als eerste zou bouwen

1. **Wedstrijd dupliceren:** snel resultaat, iedere terugkerende organisator profiteert en het raakt de kritieke live flow nauwelijks.
2. **Tenantgebonden waterprofielen:** noodzakelijk voordat je eerlijk een tweede organisatie met eigen steknummers of extra water kunt verkopen.
3. **Offline vangstwachtrij:** raakt het spannendste moment van het product en maakt de belofte “werkt bij slecht bereik” aantoonbaar sterker.

CSV-export staat inhoudelijk dicht bij de top drie, maar is vooral administratief gemak. Waterprofielen en offline registratie verwijderen echte verkoop- en betrouwbaarheidsblokkades.

## Wat ik niet zou bouwen

- **Geen deelnemersaccounts, persoonlijk vangstenlogboek of GPS-navigatie.** Dat vernietigt precies het privacyonderscheid waarmee de landing verkoopt.
- **Geen native iOS- en Android-app.** De PWA voorkomt twee releasekanalen, storebeleid en extra support. De huidige problemen vragen om betere offline verwerking, niet om een tweede frontend.
- **Geen universele puntformulebouwer voor gewicht, lengte, aantallen en soorten.** De code is overal op grammen en grootste vis gebouwd. Voeg pas een tweede vaste scoremodus toe wanneer een betalende klant die concreet nodig heeft.
- **Geen AI-visherkenning of automatische gewichtscontrole vanaf foto’s.** Dat introduceert kosten, privacyvragen en schijnzekerheid bij wedstrijdgeschillen.
- **Geen chat, sociaal profiel of openbare vangstencommunity.** Dat maakt van een compacte wedstrijdtool een moderatieproduct en botst met “geen vangstenlogboek”.
- **Geen websockets alleen omdat het moderner klinkt.** De zes-secondenpolling is voorspelbaar, eenvoudig en rekening houdend met batterijgebruik. Optimaliseer eerst de payload als schaal dat noodzakelijk maakt.
- **Nog geen selfservice-betaling en klantportaal.** Met één productieklant leveren facturen en handmatige onboarding waarschijnlijk minder onderhoud op dan een compleet abonnementsproces. Maak eerst klant twee technisch mogelijk.

Tot slot zou ik vóór voorstel 2 en 3 de server-state-machine aanscherpen. `w_registreer_vangst` controleert nu tijd en team, maar niet expliciet of de loting voltooid is en het team een plek heeft; resetten kan bovendien nog ruim worden aangeroepen. Dat is uitslagintegriteit en dus belangrijker dan een nieuwe zichtbare feature. Ik zou ook eerst een verse database-export maken: de SQL-header noemt nog app v22, terwijl onderin veel latere vervangingen staan, ondanks de werkafspraak dat dit bestand een actuele export moet zijn.


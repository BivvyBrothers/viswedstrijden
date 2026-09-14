**Reviewverdict: v88 nog niet goedkeuren.** De winnaar kan onjuist worden aangekondigd, mislukte pushes worden niet herhaald en het afsluitscherm blijft na wijzigingen verouderd.

STORM-check: gecontroleerd tegen de lokale JavaScript-, migratie-, database- en edgefunctioncode en officiële documentatie. De drie rangscenario’s hieronder zijn met de bestaande JavaScriptfuncties uitgevoerd. Productierechten, cronhistorie en daadwerkelijk delen op iOS zijn niet live getest.

1. **Hoog · `review/migraties/wedstrijd_afsluiting_v88.sql`, `meld_afgelopen()` · Push noemt verkeerde winnaar.**

   De SQL sorteert op totaal, grootste vis en **vroegste willekeurige vangst**. De client gebruikt het tijdstip van de **grootste vis**, plus bij `karper` eerst het aantal vissen.

   Reproduceerbaar:
   - `app`: A vangt 1 kg om 08.00 en 9 kg om 10.00; B vangt 9 kg om 09.00 en 1 kg om 11.00. SQL kiest A, klassement B.
   - `karper`: A vangt 6 + 4 kg; B vangt 4 + 3 + 3 kg. SQL kiest A, klassement B.

   **Voorstel:** laat SQL dezelfde effectieve dagregel bepalen als `dagRegel()`. Bereken per team de grootste vis én het vroegste tijdstip waarop dat maximum is gevangen. Neem bij `karper` het aantal vóór de grootste vis op.

2. **Hoog · dezelfde SQL-functie en `docs/app.js`, `toonAfsluiting()` · Gedeelde plaatsen worden onterecht unieke podiumplaatsen.**

   Bij Sportvisunie delen twee teams met 10 kg plaats 1. De push kiest door `LIMIT 1` één winnaar; de overlay geeft de tweede zilver. Ook volledig gelijke standen onder de andere regels gaan mis. Het klassement verwerkt dit wél met `klRangSleutel()`.

   **Voorstel:** maak een gedeelde rangberekening voor tabel, afbeelding en overlay. Toon alle teams met rang 1 als winnaars en selecteer podiumplaatsen op rang, niet op de eerste drie arrayposities. Pas dezelfde rangsemantiek toe in SQL.

3. **Hoog · `meld_afgelopen()`, `extensions.http_post_ignore()` en `review/push-vangst.ts` · Tijdelijke verzendfouten veroorzaken permanent gemiste pushes.**

   `eind_gemeld_op` wordt gezet terwijl `net.http_post()` alleen een verzoek in de wachtrij plaatst. De helper bewaart het request-ID niet. Een timeout, edgefunctionfout of pushproviderfout leidt dus niet tot herstel. De edgefunction retourneert bovendien gewoon HTTP 200 als individuele verzendingen mislukken; alleen 404/410 worden opgeruimd.

   **Voorstel:** registreer een duurzaam afsluitevent met unieke sleutel per wedstrijd/afsluitversie, request-ID en verzendstatus. Herhaal tijdelijke fouten per subscription, zodat succesvolle ontvangers niet telkens opnieuw worden benaderd. Een geslaagde HTTP-aanroep alleen bewijst geen aflevering op het toestel. [pg_net-documentatie](https://github.com/supabase/pg_net)

4. **Hoog · `meld_afgelopen()` en `toonAfsluiting()` · “Winnaar” is te definitief voor de bestaande late-vangstenflow.**

   `review/database.sql` bevat `w_registreer_vangst_laat()`, met een marge van 24 uur, en `w_admin_vangst_beslis()`. Een later goedgekeurde vangst kan de winnaar veranderen nadat push en overlay al zijn verschenen. De overlay wordt bij volgende polls niet bijgewerkt.

   **Voorstel:** vermeld bij tijdsafloop “voorlopige uitslag” en “reguliere registratie gesloten”. Koppel een definitieve winnaar aan expliciete goedkeuring door de organisator. Werk een nog geopende overlay bij wanneer goedgekeurde vangsten veranderen.

5. **Middel · `docs/app.js`, `checkAfsluiting()` en `route()` · Afsluitscherm blijft staan wanneer de wedstrijd weer live wordt.**

   Scenario: de overlay staat open en de organisator verlengt de wedstrijd. De volgende poll krijgt de nieuwe eindtijd, maar `checkAfsluiting()` doet alleen `return`. Het scherm blijft “Registreren is gesloten” tonen.

   Ook `route()` sluit de overlay niet bij navigatie naar home of een andere wedstrijd. De deelknop gebruikt vervolgens de actuele globale `STATE`, die bij een andere wedstrijd hoort of `null` is.

   **Voorstel:** sluit de overlay bij routewisseling en zodra de fase niet meer `voorbij` is. Bind het getoonde scherm en de deelactie aan dezelfde wedstrijd en afsluitversie.

6. **Middel · `docs/app.js`, `checkAfsluiting()` · Eenmaligheidsvlag past niet bij heropening en verschillende toegangscodes.**

   De server maakt na verlenging opnieuw een eindmelding mogelijk, maar `afsluit:CODE` onderdrukt het tweede afsluitscherm blijvend. Omgekeerd krijgt hetzelfde toestel de overlay opnieuw via de kijklink: `CODE` is daar de andere kijkcode.

   Bovendien wordt de vlag gezet voordat `toonAfsluiting()` heeft vastgesteld dat het scherm beschikbaar is.

   **Voorstel:** gebruik een gedeelde wedstrijdidentificatie, bijvoorbeeld de in beide states aanwezige `kijk_code`, plus een afsluitversie. Markeer pas na succesvol tonen. Daarmee krijgen deelnemer- en kijkroute dezelfde sleutel en kan een nieuwe afsluiting opnieuw verschijnen.

7. **Middel · `review/migraties/wedstrijd_afsluiting_v88.sql`, initialisatie en `meld_afgelopen()` · Achterstallige meldingen verdwijnen definitief.**

   Na meer dan drie uur cronuitval vallen ongemelde wedstrijden buiten de selectie. Hetzelfde gebeurt wanneer de eindtijd naar meer dan drie uur geleden wordt verzet.

   Daarnaast markeert opnieuw uitvoeren van de volledige migratie **alle inmiddels afgelopen, ongemelde wedstrijden** als gemeld. Dat onderdrukt ook geldige nieuwe meldingen.

   **Voorstel:** maak de historische initialisatie aantoonbaar eenmalig. Geef verlopen meldingen een afzonderlijke status, zoals `vervallen`, en houd retrytermijnen los van het tijdvenster voor het aanmaken van nieuwe events. Als drie uur bewust de grens is, is dit geaccepteerd berichtverlies, geen garantie op één push.

8. **Middel · `w_admin_tijden()` · Een oude client kan een ongeldige prijsuitreiking laten staan.**

   De functie controleert uitsluitend `p_prijsuitreiking`. Een oude client stuurt die niet mee. Verplaatst die de start naar ná de bestaande prijsuitreiking, dan behoudt `coalesce()` toch de oude prijsdatum. De nieuwe validatieregel wordt daarmee omzeild.

   **Voorstel:** bereken eerst de uiteindelijke prijsdatum uit wissen, nieuwe invoer of bestaande waarde. Valideer vervolgens die uiteindelijke waarde tegen `p_start`.

9. **Middel · `docs/styles.css`, `.afsluit` en `.afsluit-kaart` · Podium kan op kleine schermen onbereikbaar worden.**

   De vaste, verticaal gecentreerde overlay heeft geen scrollvoorziening. Met lange wedstrijd-, team- en koppelnamen kan de kaart hoger worden dan het scherm, vooral in landschapsstand of bij tekstvergroting. Sluiten en delen kunnen buiten beeld vallen.

   **Voorstel:** begrens de kaarthoogte tot de beschikbare viewport en voeg `overflow-y: auto` toe, met ruimte voor safe areas. Geef de overlay tevens dialoogsemantiek en focusafhandeling zoals bij de bestaande fotolightbox.

10. **Laag · `docs/app.js`, `deelUitslag()` · Nieuwe deelknop blijft tijdens delen actief.**

    De functie schakelt alleen `#btn-deel-uitslag` uit. `#afsluit-deel` blijft klikbaar, waardoor dubbel tikken meerdere deelverzoeken start.

    **Voorstel:** blokkeer beide knoppen met één gedeelde bezigvlag en herstel ze in `finally`.

De overige gevraagde controles leveren deze uitkomst op:

- **Cron-overlap en losse update:** deze constructie is correct. De rijlock blijft tot transactie-einde bestaan; een aparte `UPDATE` binnen dezelfde loop verliest die bescherming niet. pg_cron voert bovendien niet twee instanties van dezelfde job tegelijk uit. Een gelijktijdige tijdswijziging wordt geserialiseerd. Als de cron eerst wint, kan een al klaargezette melding nog aankomen nadat de organisator verlengt; daarvoor moet een verzendverzoek een controleerbare afsluitversie bevatten. [PostgreSQL-locks](https://www.postgresql.org/docs/current/explicit-locking.html), [pg_cron](https://github.com/citusdata/pg_cron)

- **Oude PostgREST-clients:** beide RPC’s blijven aanroepbaar zonder de nieuwe parameters. Bij `w_admin_tijden()` worden dat `NULL` en `false`, waardoor de prijsdatum behouden blijft. Voorwaarden: de nieuwe functie is uitvoerbaar voor de API-rol en de schemacache is vernieuwd. `DROP` verwijdert oude expliciete grants; de migratie legt die voor de nieuwe signaturen niet opnieuw vast. Leg rechten expliciet vast en voeg `NOTIFY pgrst, 'reload schema';` toe. Een huidige productiestoring is hiermee niet aangetoond. [PostgREST](https://docs.postgrest.org/en/stable/references/api/functions.html), [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)

- **Security:** `search_path = ''` en de gekwalificeerde applicatieobjecten zijn hier correct; ingebouwde functies zoals `format()` blijven beschikbaar. De revoke op `wedstrijd.meld_afgelopen()` is passend. De cron moet draaien onder een eigenaar/bevoegde rol. De migratie alleen bewijst de actuele rolrechten niet.

- **Geen vangsten, koppel en duo:** de lege uitslag wordt correct afgehandeld. Koppelnamen worden samengesteld; individuele duoleden horen volgens de bestaande code ieder hun eigen score te houden. Niet op `duo_id` groeperen is dus juist.

- **Tijd en klok:** de 24-uursgrens gebruikt correct `nu()` met serveroffset. Netwerkvertraging veroorzaakt een kleine achterstand, geen fout van een hele tijdzone. De rode klokklasse wordt iedere tik verwijderd en opnieuw bepaald. Amsterdam-conversie in SQL is correct; voeg bij een prijsuitreiking op een andere kalenderdag ook de datum toe.

- **Confetti en iOS:** de DPR-schaling is correct. De beweging is wel per frame en daardoor sneller op 120 Hz; gebruik verstreken tijd voor beweging. `files + text` is toegestaan, maar garandeert niet dat iedere iOS-doelapp beide overneemt. Controleer dezelfde payload met `canShare()` en bied een expliciete afbeelding-only fallback bij fouten. Zonder toesteltest is een specifieke iOS-regressie niet vastgesteld. [Web Share-specificatie](https://www.w3.org/TR/web-share/)


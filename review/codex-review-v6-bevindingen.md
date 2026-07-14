# Codex review v6 - bevindingen en voorstellen

Context: review van `KemblincK/Viswedstrijdapp/app` op basis van
`review/chatgpt-review-v6.md`. Focus: v44 beheerdersomgeving, v45 vangst delen
op social media, v46 licht klanten-model. Regelnummers zijn indicatief en
verwijzen naar de huidige lokale bestanden.

## Samenvatting

- P0: geen blokkade gevonden.
- P1: onbekende of ontbrekende klant-slug valt stil terug op `nphv`. Dat is
  gevaarlijk zodra er meer echte klanten komen, omdat configuratie- of
  scaffoldfouten worden verborgen en wedstrijden bij de verkeerde klant kunnen
  belanden.
- P2: enkele verbeteringen rond deelafbeeldingen en beheerder-sessiehygiene.
- Goedgekeurd: de vier `w_su_*` RPC's hebben allemaal de
  beheerderswachtwoord-check, de beheer-UI escapet DB-strings, de hidden route
  lekt geen wachtwoord via URL of logs, en de bestaande lightbox-flow wordt niet
  geraakt door de nieuwe deelknoppen.

## Bevindingen

1. P1 - Onbekende tenant-slug wordt als NPHV opgeslagen
   - Bestand en regels:
     - `review/database.sql:924-963`, vooral `950-953`
     - `docs/app.js:455-468`
     - `docs/nphv/config.js:5`
     - `docs/demo/config.js:5`
     - `tools/nieuwe_tenant.py:116-120` en `182-188`
   - Probleem:
     `w_maak_wedstrijd` zoekt de klant via:

     ```sql
     select id into v_klant
     from wedstrijd.klanten
     where slug = coalesce(nullif(lower(trim(p_klant)), ''), 'nphv');

     if v_klant is null then
       select id into v_klant from wedstrijd.klanten where slug = 'nphv';
     end if;
     ```

     Daarmee zijn twee heel verschillende situaties niet meer te onderscheiden:
     een oude gecachte client zonder `p_klant`, en een nieuwe tenant met een
     foute of nog niet aangemaakte klant-rij. De eerste mag naar `nphv`
     terugvallen. De tweede moet luid falen, anders maakt bijvoorbeeld
     `/hsvx/` wedstrijden aan onder NPHV. De beheerder ziet dan ook geen
     `zonder_klant` waarschuwing, omdat er juist wel een `klant_id` is gezet,
     alleen de verkeerde.
   - Reproductiescenario:
     1. Maak met `tools/nieuwe_tenant.py --slug hsvx ...` een nieuwe tenant.
     2. Vergeet de database-stap:
        `insert into wedstrijd.klanten (slug, naam) values ('hsvx', '...');`
     3. Open `/hsvx/`, log in als organisatie en maak een wedstrijd.
     4. `docs/app.js:467` stuurt `p_klant: 'hsvx'`.
     5. `review/database.sql:950-953` vindt geen `hsvx` en valt terug op
        `nphv`.
     6. De wedstrijd staat in het beheeroverzicht onder NPHV in plaats van
        onder HSVX.
   - Voorgestelde fix:
     Laat alleen `NULL` of lege `p_klant` naar `nphv` vallen voor oude
     gecachte clients. Een niet-lege onbekende slug moet een fout worden.

     ```sql
     declare
       v_klant uuid;
       v_klant_slug text;
     begin
       v_klant_slug := nullif(lower(trim(p_klant)), '');
       if v_klant_slug is null then
         v_klant_slug := 'nphv';
       end if;

       select id into v_klant
       from wedstrijd.klanten
       where slug = v_klant_slug;

       if v_klant is null then
         raise exception 'klant_niet_gevonden';
       end if;
     ```

     Voeg `klant_niet_gevonden` toe aan `FOUTEN` in `docs/app.js`, met een
     tekst voor de organisator zoals: "Deze omgeving is nog niet gekoppeld aan
     een klant. Neem contact op met KemblincK." Zet in de releasecheck dat de
     klant-rij bestaat voordat een tenant live gaat. De scaffold hoeft niet
     per se database-toegang te krijgen, maar de app/backend mag deze fout niet
     stil maskeren.

2. P2 - Uitloggen uit beheer laat gevoelige data in memory en verborgen DOM
   - Bestand en regels:
     - `docs/app.js:216-217`
     - `docs/app.js:628-645`
     - `docs/app.js:647-710`
     - `docs/app.js:1622-1633`
   - Probleem:
     Bij beheerder-login wordt `SU_DATA` gevuld met alle wedstrijden en
     admin-pins. `renderSu()` schrijft die pins ook in de DOM. De uitlogknop
     verwijdert alleen `sessionStorage.suww` en zet de hash terug naar home:

     ```js
     $('#su-uitloggen')?.addEventListener('click', () => {
       sessionStorage.removeItem('suww');
       location.hash = '';
     });
     ```

     `SU_DATA`, `SU_KLANT` en de inhoud van `#su-wedstrijden` blijven daarna
     bestaan in dezelfde tab, alleen verborgen achter `#view-beheerder`. Dat is
     vooral een lokaal/shared-device risico, maar bij een expliciete logout
     verwacht je dat pins niet meer in memory of DOM rondhangen.
   - Reproductiescenario:
     1. Ga naar `#/beheerder` en log in.
     2. Controleer dat `#su-wedstrijden` kaartjes met admin-pins bevat.
     3. Klik `uitloggen`.
     4. Inspecteer dezelfde pagina met DevTools: de verborgen beheerder-DOM en
        de globale `SU_DATA` bevatten nog de eerder geladen pins.
   - Voorgestelde fix:
     Voeg een kleine opruimfunctie toe en gebruik die bij logout en eventueel
     wanneer de route niet langer `#/beheerder` is.

     ```js
     function wisSuData() {
       sessionStorage.removeItem('suww');
       SU_DATA = null;
       SU_KLANT = null;
       $('#su-stats') && ($('#su-stats').textContent = '');
       $('#su-instellingen') && ($('#su-instellingen').innerHTML = '');
       $('#su-wedstrijden') && ($('#su-wedstrijden').innerHTML = '');
       $('#su-ww') && ($('#su-ww').value = '');
       $('#su-ww-nieuw') && ($('#su-ww-nieuw').value = '');
       $('#su-orgww-nieuw') && ($('#su-orgww-nieuw').value = '');
     }
     ```

     Daarna:

     ```js
     $('#su-uitloggen')?.addEventListener('click', () => {
       wisSuData();
       location.hash = '';
     });
     ```

3. P2 - Vangst delen kan blijven hangen als een foto nooit laadt
   - Bestand en regels:
     - `docs/app.js:1302-1310`
     - `docs/app.js:1323-1352`
     - `docs/app.js:1355-1365`
   - Probleem:
     `deelVangst()` disabled de knop en wacht op `tekenVangst()`. Als
     `laadFoto()` geen `load` of `error` krijgt, bijvoorbeeld door een trage of
     half-open netwerkverbinding, blijft de Promise open en wordt de knop niet
     opnieuw enabled. De fallback naar placeholder werkt alleen bij een echte
     `onerror`.
   - Reproductiescenario:
     1. Open een wedstrijd met een vangstfoto.
     2. Simuleer in DevTools een request naar de foto dat niet afrondt, of zet
        de browser op een zeer trage/offline overgang precies tijdens delen.
     3. Klik `deel`.
     4. De knop blijft disabled zolang de image-Promise niet resolve/reject.
   - Voorgestelde fix:
     Geef `laadFoto()` een timeout en reject dan naar dezelfde placeholder-flow.

     ```js
     function laadFoto(url, timeoutMs = 12000) {
       return new Promise((ok, nee) => {
         const img = new Image();
         const timer = setTimeout(() => {
           img.onload = null;
           img.onerror = null;
           img.src = '';
           nee(new Error('foto_laden_mislukt'));
         }, timeoutMs);
         img.crossOrigin = 'anonymous';
         img.onload = () => { clearTimeout(timer); ok(img); };
         img.onerror = () => { clearTimeout(timer); nee(new Error('foto_laden_mislukt')); };
         img.src = url;
       });
     }
     ```

4. P2 - De logo-voet is niet gegarandeerd op de eerste deelactie
   - Bestand en regels:
     - `docs/app.js:1273-1300`
     - `docs/app.js:1231`
     - `docs/app.js:1351`
   - Probleem:
     De reviewbrief stelt dat alle deelafbeeldingen een voet met app-icoon en
     `viswedstrijdapp.nl` hebben. In de code is het icoon best-effort:
     `tekenVoet()` tekent het logo alleen als `APP_ICOON.complete` en
     `naturalWidth` al waar zijn. Wie heel snel na pageload deelt, of bij een
     trage icon-request, krijgt wel de tekstvoet maar niet het logo.
   - Reproductiescenario:
     1. Open de app met cache uitgeschakeld en trage throttling.
     2. Klik direct op delen van uitslag, seizoen of vangst.
     3. De voet bevat `viswedstrijdapp.nl`, maar het app-icoon kan ontbreken.
   - Voorgestelde fix:
     Maak de preload expliciet wachtbaar en wacht daar kort op voordat een
     canvas wordt gemaakt, of teken een vaste fallback-markering als het icoon
     nog niet klaar is.

     ```js
     const APP_ICOON_KLAAR = new Promise((resolve) => {
       APP_ICOON.onload = resolve;
       APP_ICOON.onerror = resolve;
     });

     async function wachtOpVoetAssets() {
       await Promise.race([
         APP_ICOON_KLAAR,
         new Promise((resolve) => setTimeout(resolve, 1500)),
       ]);
     }
     ```

     Roep `await wachtOpVoetAssets()` aan in de deelhandlers voor uitslag,
     seizoen en vangst. Houd wel een korte timeout, zodat delen niet stukgaat
     als het icoon echt niet beschikbaar is.

## Expliciet gecontroleerd en goedgekeurd

1. Beheerder-autorisatie
   - `review/database.sql:1373-1384`: `wedstrijd.su_check()` weigert als
     `beheerder_wachtwoord` `NULL` is of niet exact overeenkomt met
     `trim(p_wachtwoord)`. De `pg_sleep(0.5)` zit op het foutpad.
   - `review/database.sql:1386-1468`: alle vier publieke beheerder-RPC's
     roepen eerst `wedstrijd.su_check(p_wachtwoord)` aan:
     `w_su_overzicht`, `w_su_alleen_lezen`, `w_su_org_wachtwoord`,
     `w_su_wachtwoord`.
   - De functies met bevoegdheden zijn `SECURITY DEFINER` en gebruiken
     `SET search_path TO ''`. Objecten worden met schema gekwalificeerd.
   - `w_su_org_wachtwoord` is inderdaad een escalatie naar de gewone
     org-omgeving, maar dat is de bedoelde supportfunctie en blijft achter het
     beheerderwachtwoord.

2. Beheerder-UI en XSS
   - `docs/app.js:647-663`: `suKaart()` escapet wedstrijdnaam, code,
     kijkcode, admin-pin en seizoennaam voordat deze in HTML terechtkomen.
   - `docs/app.js:684-694`: klant-slug, klantnaam en namen in
     `zonder_klant` worden geescapet. Tellingen en booleans komen als getallen
     of vaste labels terug.
   - `docs/app.js:1622-1652`: het beheerderswachtwoord gaat naar RPC-body en
     sessionStorage, niet naar URL of zichtbare DOM. Het invoerveld wordt na
     login en wachtwoordwijziging geleegd.

3. Oude clients en nieuwe `w_maak_wedstrijd`
   - `review/database.sql:924`: de nieuwe functie heeft `p_klant text DEFAULT
     NULL::text`. Een named-parameter RPC-call zonder `p_klant` blijft dus
     functioneel.
   - De oude 7-parameterfunctie is terecht weg, zodat PostgREST geen dubbele
     kandidaat hoeft te kiezen. Deploy-check blijft wel: schema cache na de
     migratie laten verversen als Supabase dat niet automatisch doet.

4. Klant-tabs en zonder-klant waarschuwing
   - `docs/app.js:679-694`: `SU_KLANT` valt terug naar de eerste bestaande
     klant als de vorige selectie verdwijnt. Een lege klantenlijst resulteert
     in "Geen wedstrijden bij deze klant" zonder crash.
   - `review/database.sql:1409-1429`: gegroepeerde data per klant en
     `zonder_klant` komen uit dezelfde bron. De waarschuwing is correct voor
     echte `klant_id is null` records. De enige inhoudelijke zwakte zit in de
     P1 hierboven: onbekende slugs worden nu niet `null`, maar foutief NPHV.

5. Social delen en bestaande flows
   - `docs/app.js:1257-1269`: `deelPng()` gebruikt Web Share wanneer mogelijk
     en valt terug naar downloaden met `URL.revokeObjectURL`.
   - `docs/app.js:1323-1352`: `tekenVangst()` tekent foto of placeholder en
     vangt image-load fouten af.
   - `docs/app.js:1355-1365`: de deelknop wordt tijdens delen disabled en in
     `finally` weer enabled bij normale resolve/reject.
   - `docs/app.js:1502-1522` en `1858-1870`: de deelknoppen worden na elke
     render opnieuw gekoppeld.
   - `docs/app.js:1526-1533` en `1792-1800`: de lightbox luistert alleen naar
     `data-groot`; de nieuwe deelknoppen gebruiken `data-deel-vangst` en
     breken de foto-lightbox niet.

6. Tenant-config en scaffold
   - `docs/nphv/config.js:5` en `docs/demo/config.js:5`: beide tenants hebben
     een expliciete `TENANT`.
   - `tools/nieuwe_tenant.py:116-120`: de scaffold vervangt de NPHV
     `TENANT`-regel gericht en luid.
   - `tools/nieuwe_tenant.py:182-188`: de klant-insert wordt expliciet als
     checkliststap geprint. Dat is bruikbaar, maar vanwege de P1 moet de
     backend onbekende niet-lege slugs alsnog weigeren.

7. Releaseversie
   - `docs/app.js:4`: `APP_VERSION = 46`.
   - `docs/version.json`, `docs/nphv/version.json` en `docs/demo/version.json`
     bevatten allemaal `{"v": 46}`.

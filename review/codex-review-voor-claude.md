# Code-review voor Claude Code

Review van de webapp Viswedstrijden Plas van der Ende, op basis van:

- `../docs/index.html`
- `../docs/app.js`
- `../docs/styles.css`
- `../docs/sw.js`
- `../docs/config.js`
- `../docs/kaart.js`
- `../tools/gen_kaart_js.py`
- `../tools/shape.py`
- `database.sql`
- `push-vangst.ts`

Doel van dit document: geef Claude Code een concrete lijst met verbeteringen om door te voeren. De originele briefing staat in `codex-review-v1.md`.

## Samenvatting

Het beveiligingsmodel staat in grote lijnen goed: tabellen zitten achter RLS zonder policies, toegang loopt via `SECURITY DEFINER` RPC's met lege `search_path`, en de kijker-RPC lekt geen deelnemerscode of admin pin.

De belangrijkste fixes zitten in wedstrijdconsistentie:

- reset van een zone-loting wist de gekozen zone niet
- muterende RPC's locken niet consequent de wedstrijd-rij
- er ontbreekt een capaciteitscheck voordat de loting start
- organisatie-uitloggen laat admin-pins in `sessionStorage` staan
- push-subscriptions mogen te veel ongeldige data opslaan

## P0

### 1. Reset loting wist oude zone niet

**Bestand:** `database.sql`  
**Functie:** `public.w_admin_reset_loting`, rond regel 507

**Probleem**

`w_admin_reset_loting` zet `lot_nummer = null` en `stekken = '{}'`, maar laat `zone` staan. Bij een zonewedstrijd blijven oude zones daardoor bezet via:

- database: `w_kies_zone` checkt `lower(coalesce(zone,''))`
- frontend: `zoneBezet()` kijkt naar `t.zone`

Na een reset kan de nieuwe loting dus vastlopen omdat zones nog als gekozen worden gezien.

**Voorstel**

Pas de update aan:

```sql
update wedstrijd.teams
set lot_nummer = null,
    stekken = '{}',
    zone = null
where wedstrijd_id = v_w.id;
```

## P1

### 2. Muterende wedstrijd-RPC's locken de wedstrijd-rij niet consequent

**Bestanden:** `database.sql`  
**Functies:** `w_start_stekkeuze`, `w_admin_zones`, `w_admin_reset_loting`, `w_kies_stek`, `w_kies_zone`, eventueel `w_admin_tijden`

**Probleem**

De functies lezen de wedstrijd-rij zonder `FOR UPDATE`. Tegelijkertijd locken `w_kies_stek` en `w_kies_zone` alleen de eigen teamrij. Daardoor kunnen beheeracties en keuzes elkaar kruisen, bijvoorbeeld:

- loting starten terwijl zones net worden aangepast
- reset tijdens een actieve keuze
- tijden wijzigen terwijl iemand registreert of kiest
- dubbele beheeractie vanuit twee tabs

Normale stekkeuze is door beurtvolgorde grotendeels beschermd, maar het geheel is niet transactioneel genoeg voor een wedstrijddag.

**Voorstel**

Haal in alle muterende RPC's de wedstrijd op met `FOR UPDATE`:

```sql
select * into v_w
from wedstrijd.wedstrijden
where code = upper(trim(p_code))
  and admin_pin = trim(p_pin)
for update;
```

Voor deelnemeracties:

```sql
select w.* into v_w
from wedstrijd.wedstrijden w
where w.code = upper(trim(p_code))
for update;
```

Gebruik daarna statuschecks op de gelockte rij. Dit serializeert beheer en keuzes per wedstrijd.

### 3. Geen capaciteitscheck voordat de loting start

**Bestand:** `database.sql`  
**Functie:** `w_start_stekkeuze`, rond regel 334

**Probleem**

De loting kan starten met meer teams dan beschikbare zones of stekken. Bij zones is dit direct blokkerend. Bij losse koppelstekken kan de stekkeuze later vastlopen door fragmentatie, zelfs als het totaal aantal stekken op papier genoeg is.

**Voorstel**

Voeg vóór het toekennen van lotnummers checks toe:

- als `v_w.zones is not null`: `count(teams) <= jsonb_array_length(v_w.zones)`
- zonder zones: `count(teams) * benodigde_stekken <= count(stek_ring)`

Voor koppelwedstrijden zonder zones is een harde perfecte-matching-check beter, maar voor deze app is het praktischer om koppelwedstrijden met veel deelnemers via zones te laten lopen.

### 4. Organisatie-uitloggen laat wedstrijd-pins actief

**Bestand:** `../docs/app.js`  
**Functie:** handler `#org-uitloggen`, rond regel 324

**Probleem**

Uitloggen wist alleen `orgww`. De per-wedstrijd pins blijven staan als `pin:CODE` in `sessionStorage`. Als dezelfde browser daarna een wedstrijd opent, wordt de beheer-tab opnieuw ontgrendeld.

**Voorstel**

Wis bij uitloggen ook alle `pin:` keys en reset runtime-state:

```js
$('#org-uitloggen').addEventListener('click', () => {
  sessionStorage.removeItem('orgww');
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('pin:')) sessionStorage.removeItem(key);
  }
  ADMIN_OPEN = false;
  ROL = 'deelnemer';
  location.hash = '';
});
```

### 5. Codes zijn niet hard uniek over beide kolommen

**Bestand:** `database.sql`  
**Tabel:** `wedstrijd.wedstrijden`, regels 13 en 14

**Probleem**

`code` en `kijk_code` zijn afzonderlijk uniek, maar niet over beide kolommen samen. De generator checkt dit normaal, maar er is geen databaseconstraint die voorkomt dat een deelnemerscode van wedstrijd A gelijk wordt aan de kijkcode van wedstrijd B bij gelijktijdige inserts of handmatige datafixes.

**Voorstel**

Maak uniciteit over beide codekolommen hard. Opties:

- centrale tabel `wedstrijd.codes(code primary key, wedstrijd_id, soort)`
- trigger op `wedstrijden` die bij insert/update controleert dat `new.code` en `new.kijk_code` nergens in beide kolommen voorkomen
- minimaal `check (code <> kijk_code)` toevoegen, maar dat dekt niet cross-row

### 6. Push-subscribe accepteert te veel ongeldige subscription-data

**Bestand:** `database.sql`  
**Functie:** `w_push_subscribe`, rond regel 561

**Probleem**

Iedereen met deelnemerscode of kijkcode kan een willekeurige `https://` endpoint met lege of ongeldige `p256dh` en `auth` opslaan. Daardoor kan de push-loop later veel mislukte sends doen. Omdat alleen 404 en 410 worden opgeschoond, kunnen sommige ongeldige subscriptions blijven hangen.

**Voorstel**

Strakker valideren:

- `p_p256dh` verplicht, base64url, redelijke lengte, bijvoorbeeld 80 tot 120 chars
- `p_auth` verplicht, base64url, redelijke lengte, bijvoorbeeld 16 tot 40 chars
- als `p_token is not null` en geen team matcht: reject met `team_niet_gevonden`
- laat kijkers expliciet `p_token = null` gebruiken

### 7. Foto-compressie heeft geen robuuste fallback op oudere telefoons

**Bestand:** `../docs/app.js`  
**Functie:** `compressFoto`, rond regel 114

**Probleem**

De functie hangt volledig op `createImageBitmap`. Op oudere iOS-versies of bij bepaalde HEIC/JPEG-varianten kan dat falen. Dan krijgt de deelnemer alleen een algemene fout terwijl de vangst mogelijk vlak voor eindtijd wordt geregistreerd.

**Voorstel**

Voeg fallback toe via `Image`, `URL.createObjectURL(file)` en canvas. Controleer daarna ook de blobgrootte vóór upload. Als compressie faalt, toon een specifieke melding dat de deelnemer een andere foto moet kiezen of opnieuw moet fotograferen.

### 8. Push edge function verstuurt sequentieel

**Bestand:** `push-vangst.ts`  
**Functie:** loop over `payload.subs`, rond regel 46

**Probleem**

Bij veel kijkers verstuurt de edge function alle notifications één voor één. Dat kan traag worden of timeouts geven.

**Voorstel**

Gebruik `Promise.allSettled` met begrensde batches, bijvoorbeeld 20 tot 50 tegelijk. Verzamel daarna:

- geslaagde sends
- 404 en 410 voor cleanup
- overige fouten voor logging

Onbegrensde `Promise.allSettled` kan bij veel subscribers te agressief zijn.

## P2

### 9. Teamlink-token blijft staan als state-load faalt

**Bestand:** `../docs/app.js`  
**Functies:** `route`, `laadState`, rond regels 215 en 380

**Probleem**

De token uit `#/w/CODE?t=TOKEN` wordt pas uit de URL gehaald na succesvolle `w_get_state`. Bij offline netwerk, verkeerde code of serverfout blijft de token in de adresbalk en browsergeschiedenis zichtbaar.

**Voorstel**

Parse de token in `route()`, bewaar hem in `PENDING_TOKEN` en doe meteen:

```js
history.replaceState(null, '', location.pathname + '#/w/' + CODE);
```

Daarna mag `laadState()` de token nog gebruiken uit geheugen.

### 10. Weesfoto's na upload zonder registratie

**Bestanden:** `../docs/app.js`, `database.sql`  
**Functies:** `uploadFoto`, `w_registreer_vangst`

**Probleem**

De foto wordt eerst naar storage geupload en pas daarna geregistreerd via RPC. Als stap 2 faalt, bijvoorbeeld door eindtijd, netwerk of tokenprobleem, blijft het bestand in storage staan.

**Voorstel**

Binnen de huidige architectuur zijn dit de beste opties:

- frontend: vóór upload checken of er nog voldoende tijd is, bijvoorbeeld minimaal 30 tot 60 seconden
- frontend: bij RPC-fout een best-effort delete proberen als storage-policy dat toestaat
- backend/operatie: periodieke cleanup van storage-objecten zonder `vangsten.foto_path`

### 11. Beheer-polling kan bevestigingen en edits verstoren

**Bestand:** `../docs/app.js`  
**Functie:** `renderBeheer`, rond regel 1056

**Probleem**

De beheerweergave wordt bij polling opnieuw opgebouwd met `innerHTML`. Daardoor kan een tik-nogmaals-bevestiging verdwijnen. Gewicht-edits in `b-vangsten` kunnen tijdens typen worden overschreven.

**Voorstel**

Maak beheeracties via event delegation stabieler en preserve focused inputs. Simpel alternatief: pauzeer beheer-polling zolang focus in een input of textarea in de beheer-tab zit.

### 12. Zones-parser kan verwarring geven bij ranges

**Bestand:** `../docs/app.js`  
**Functie:** `parseZones`, rond regel 1011

**Probleem**

De parser maakt van `20-30` automatisch `20,22,24,26,28,30`, maar van een gemengde pariteit range `9-20` alle bestaande stekken in die range. Niet-bestaande stekken worden in ranges stil overgeslagen.

Database en frontend verschillen niet in de uiteindelijke JSON-validatie, maar de invoersemantiek kan voor organisatoren onduidelijk zijn.

**Voorstel**

Toon na parsing een preview per zone met het aantal stekken en de concrete lijst. Meld expliciet als niet-bestaande nummers uit een range zijn overgeslagen.

### 13. Push-notificatie opent niet de juiste wedstrijdroute

**Bestand:** `../docs/sw.js`  
**Functie:** `notificationclick`, rond regel 17

**Probleem**

Bij klik opent de service worker `.`. De gebruiker komt dan op de homepagina in plaats van direct in de wedstrijd of kijkerweergave.

**Voorstel**

Neem een URL op in de push payload, bijvoorbeeld `#/k/KIJKCODE` of minimaal de laatst bekende route. Gebruik die URL in `clients.openWindow()`.

### 14. Geen expliciet update-mechanisme voor assets

**Bestand:** `../docs/sw.js` en frontend init in `../docs/app.js`

**Probleem**

De service worker doet alleen push en geen caching. Dat is prima. GitHub Pages kan assets echter nog kort cachen, waardoor deelnemers tijdens een wedstrijddag mogelijk op verschillende appversies zitten.

**Voorstel**

Voeg een klein `version.json` of `APP_VERSION` mechanisme toe. Laat de app bij verschil een reload-melding tonen.

### 15. Review-SQL bevat geen seeddata voor `stek_ring`

**Bestand:** `database.sql`  
**Tabel:** `wedstrijd.stek_ring`

**Probleem**

Het bestand maakt `stek_ring` aan, maar bevat geen inserts. Als dit bestand ooit als herstel- of migratiebron wordt gebruikt, breken zone-validatie en stekkeuze.

**Voorstel**

Voeg de 96 stekken toe als seeddata, of genereer ze uit dezelfde ringdefinitie als `tools/gen_kaart_js.py`.

## Gericht antwoord op de vragen uit de briefing

1. `w_push_subscribe` met kijkcode en null-token is binnen het model acceptabel voor kijkers, maar de validatie is te ruim. Relevanter risico is vervuiling van `push_subs` met ongeldige endpoints/keys.
2. Teamlink-token in de URL is functioneel acceptabel, maar beter direct uit de adresbalk halen in `route()` in plaats van na succesvolle state-load.
3. `w_kies_stek` en `w_kies_zone` locken de eigen teamrij. Voor gewone beurtvolgorde is dat grotendeels genoeg, maar beheeracties moeten dezelfde wedstrijd-rij locken om reset/start/zonewijziging-races te voorkomen.
4. Team-id's uit `w_get_state` zijn niet voldoende om te schrijven. Registreren en kiezen vereist de team-token.
5. Server-side eindtijd in `w_registreer_vangst` is correct. Randgeval blijft dat foto-upload al klaar kan zijn en de RPC net te laat komt. Dat is eerlijk, maar geef vlak voor eindtijd duidelijkere UI-feedback.
6. `renderOrg` en `renderBeheer` kunnen tik-nogmaals-status kwijtraken door re-render. Niet kritisch, maar in beheer kan het irritant zijn.
7. Zones-parser en database valideren dezelfde uiteindelijke JSON. Verwarring zit in de frontend-range-semantiek, niet in serververschil.
8. Weesfoto's zijn waarschijnlijk acceptabel op hobby-schaal, maar cleanup is verstandig.
9. `Promise.allSettled` is veilig als je het begrenst in batches.
10. View-state lekt niet direct door `hidden`, maar org-pins blijven na uitloggen beschikbaar in `sessionStorage`.
11. Geen fetch-handler is prima voor push. Een versie-check is de moeite waard voor wedstrijddagen.
12. Voor 40 koppels mist vooral operationele hardening: capaciteitscheck, zones/koppelvakken vooraf, push-batching, betere offline/foto-foutmeldingen, en beheer-polling die invoer niet verstoort.

## Expliciet gecontroleerd en in orde

- `w_get_state_kijker` geeft geen deelnemerscode en geen admin pin terug.
- `w_org_wedstrijden` geeft admin pins alleen na organisatie-wachtwoord terug.
- Team-id's alleen geven geen schrijfrechten.
- Alle kritieke RPC's gebruiken `SECURITY DEFINER SET search_path TO ''`.
- Gebruikersinvoer in HTML-rendering gaat vrijwel overal via `esc()` of `textContent`.
- Foto-URL's komen uit databasepaths en worden escaped voordat ze in attributen belanden.
- Eindtijd wordt server-side afgedwongen in `w_registreer_vangst`.
- De edge function vertrouwt niet op JWT, maar laat het secret controleren via `w_push_payload`.
- Eigen team krijgt geen pushmelding door `s.team_id is distinct from p_team_id`.
- `docs/kaart.js` is gegenereerd en de ringdefinitie in de generator lijkt consistent met de bedoelde fysieke stekring.

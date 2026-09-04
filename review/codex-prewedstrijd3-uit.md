Oordeel: nog niet ongewijzigd inzetten. Ik zie vijf hoge en twee middelhoge risico’s.

STORM: beoordeeld op actuele `git diff HEAD`, `git show HEAD`, de tweede review en de inmiddels toegevoegde SQL-definitie. Productiedeployment en echte iPhone-tests zijn niet verifieerbaar.

1. Hoog: uploadtimeout dekt de responsebody niet  
[docs/app.js:144](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:144), `uploadFoto`. De timer wordt direct na de `fetch` gewist. Als alleen de headers binnenkomen en `r.json()` blijft hangen, blijven `WACHTRIJ_BEZIG` en de browserlock alsnog vaststaan.  
Fix: lees en valideer de JSON binnen hetzelfde `try/finally` en wis de timer pas daarna.

2. Hoog: Web Locks voorkomt dubbele vangsten niet in de terugval  
[docs/app.js:2226](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2226), [review/database.sql:610](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:610). Zonder `navigator.locks` werkt de rij functioneel, maar twee vensters kunnen hetzelfde item met twee fotopaden registreren. Een gesuspendeerde lockhouder kan bovendien andere vensters laten overslaan.  
Fix: stuur `item.id` als `p_client_id`, maak `(wedstrijd_id, client_id)` uniek en laat de RPC bij een conflict de bestaande vangst retourneren.

3. Hoog: automatisch herladen kan een vangst wissen  
[docs/app.js:380](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:380), [docs/app.js:2723](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2723). De controle beschermt alleen een gefocust invoerveld en `WACHTRIJ_BEZIG`. Tijdens fotocompressie, vóór IndexedDB-opslag en tijdens de directe terugval is die vlag `false`. Herladen verliest dan de invoer.  
Fix: op een wedstrijdroute nooit automatisch herladen zolang een vangstformulier gegevens bevat of een submit loopt. Toon dan alleen de updateknop. De `sessionStorage`-guard voorkomt wél een herlaadlus bij een oude `app.js`.

4. Hoog: `w_admin_wis_plek` racet met vangstregistratie  
[review/database.sql:917](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:917), [review/database.sql:622](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:622). De wis-RPC lockt wedstrijd en team, maar `w_registreer_vangst` niet. Een registratie kan de oude plek lezen, wachten op de foreign-keylock en na het wissen alsnog invoegen.  
Fix: laat normale én late registratie dezelfde wedstrijdlock nemen en controleer plek/status pas daarna opnieuw. De duo-brede wisactie en overgang `klaar` naar `stekkeuze` zijn verder correct.

5. Hoog: v80 blijft publiek aanmelden tot de eindtijd toestaan  
[review/database.sql:339](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/review/database.sql:339). Iedereen met de wedstrijdcode kan tijdens de wedstrijd instromen en `klaar` terugzetten naar `stekkeuze`.  
Fix: publieke laatkomers alleen vóór `start_ts`; daarna uitsluitend via een admin-RPC.

6. Middel: tijdelijke autorisatie-4xx wordt definitief 403  
[review/upload-vangstfoto.ts:56](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/review/upload-vangstfoto.ts:56), [docs/app.js:2223](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:2223). PostgREST 408/425/429 wordt `geen_toegang`; de wachtrij markeert de vangst dan definitief geweigerd.  
Fix: alleen bewezen ongeldige credentials als 403 behandelen. Time-outs, rate-limits en onverwachte RPC-antwoorden moeten 503 `upload_mislukt` worden.

7. Middel: verbindingsbanner blijft na navigatie staan  
[docs/app.js:667](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:667), [docs/app.js:400](/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude%20cowork/KemblincK/Viswedstrijdapp/app/docs/app.js:400). De banner wordt alleen na een succesvolle wedstrijdpoll verborgen, niet bij routewissel.  
Fix: verberg de banner en reset `STATE_OK_OP` bij iedere routewissel.

`node --check docs/app.js` en `git diff --check HEAD` slagen. De races tussen `w_join`, `w_start_stekkeuze` en `w_kies_zone`, inclusief `max(lot_nummer)+1` en capaciteit, zijn door de wedstrijdlock correct geserialiseerd.
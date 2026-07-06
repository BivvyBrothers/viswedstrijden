# Code-review Viswedstrijden Plas van der Ende (v1)

Je bent een senior reviewer. Beoordeel de volledige codebase van een webapp voor
karperwedstrijden en doe concrete verbetervoorstellen. De voorstellen worden daarna
door Claude Code doorgevoerd, dus wees precies: benoem per bevinding het bestand,
de functie of regel, het probleem en de voorgestelde oplossing.

## Wat de app doet

Live op https://viswedstrijd.kemblinck.nl (GitHub Pages). Wedstrijdvissen op een
plas met 96 genummerde stekken (nummers 1-100, 12-18 bestaan niet). Drie rollen:

1. **Deelnemer** (deelnemerscode): aanmelden (individueel of koppel, optionele
   teamnaam), digitale loting (site loot de volgorde), om de beurt een stek of
   zone kiezen op een interactieve kaart, vangsten registreren (gewicht + verplichte
   foto) zolang de wedstrijd loopt. Eindtijd wordt server-side afgedwongen.
2. **Kijker** (aparte kijkcode): ziet alleen de aftelklok en het klassement
   (totaalgewicht met opbouw per vis, en grootste vis), kan pushmeldingen aanzetten.
3. **Organisator** (globaal organisatie-wachtwoord): omgeving met actieve en
   afgelopen wedstrijden, nieuwe wedstrijd aanmaken, vaste zone-indeling beheren,
   loting starten, vangsten corrigeren of verwijderen, tijden aanpassen.

Web push bij nieuwe vangsten via een service worker + VAPID + Supabase edge function,
getriggerd vanuit de database (pg_net) bij elke registratie. Het team dat de vis
ving krijgt zelf geen melding.

## Bestanden om te reviewen (alle paden relatief aan deze map)

Frontend (statisch, vanilla JS, geen build-stap; ook publiek op
https://github.com/BivvyBrothers/viswedstrijden):
- `../docs/index.html` : alle views (home met rolkeuze, wedstrijd, kijker, organisatie)
- `../docs/app.js` : alle logica (~1000 regels; routing, state-polling, kaart, loting,
  zones, klassement, vangsten, push, beheer)
- `../docs/styles.css` : styling (camouflage-thema)
- `../docs/sw.js` : service worker (alleen push, geen caching)
- `../docs/config.js` : Supabase-URL + publishable key + VAPID public key (bewust publiek)
- `../docs/kaart.js` : GEGENEREERD bestand (interactieve SVG-kaart + stekring);
  alleen scannen op structurele problemen, niet op stijl
- `../tools/gen_kaart_js.py` en `../tools/shape.py` : generator van de kaart

Backend (Supabase):
- `database.sql` (in deze map) : volledige tabellen + alle RPC's zoals ze nu
  live staan. Dit is de kern van het beveiligingsmodel: lees dit grondig.
- `push-vangst.ts` (in deze map) : de edge function voor web push.

## Beveiligingsmodel (zo is het bedoeld)

- Tabellen staan in schema `wedstrijd`, dat niet via PostgREST bereikbaar is;
  RLS staat aan zonder policies. Alle toegang loopt via SECURITY DEFINER RPC's
  in `public`, aanroepbaar met de publieke anon key. Elke RPC valideert zelf.
- Autorisatie-lagen: organisatie-wachtwoord (globaal, tabel instellingen),
  admin_pin (per wedstrijd, automatisch gegenereerd, alleen zichtbaar voor de
  organisatie via w_org_wedstrijden), team-token (uuid, per deelnemer, in
  localStorage), deelnemerscode en kijkcode (6 tekens).
- Foto's staan in een publieke storage-bucket (max 5 MB, alleen afbeeldingen),
  anon mag uploaden, geen listing.

## Bewuste keuzes: NIET als bevinding rapporteren

- Hobby-schaal: wachtwoord en pins plain in de database, geen rate limiting,
  geen accounts, publieke foto-bucket, VAPID private key in een DB-tabel.
- Polling (elke 6s) in plaats van websockets/realtime.
- Geen seizoensklassement; elke wedstrijd staat op zichzelf.
- Deelnemers kunnen eigen vangsten niet wijzigen (alleen de organisator).
- confirm()/alert() zijn bewust vervangen door een tik-nogmaals-patroon en toasts
  (iOS-beginscherm-apps blokkeren browser-dialogen).
- Alle UI-teksten in het Nederlands; geen em-dashes in teksten.

## Focus van de review

1. **Beveiliging binnen het model**: kan iemand zonder de juiste sleutel toch
   schrijven of meer lezen dan bedoeld? Denk aan: kijkcode vs deelnemerscode,
   w_push_subscribe die beide codes accepteert, teamlinks (#/w/CODE?t=TOKEN),
   het teruggeven van admin_pin in w_org_wedstrijden, de push_payload/cleanup
   secret-checks, en of de edge function misbruikt kan worden (verify_jwt staat uit).
2. **Race conditions en consistentie**: gelijktijdige stek-/zonekeuzes (FOR UPDATE
   correct?), dubbele registraties, loting resetten terwijl iemand kiest,
   zones wijzigen vlak voor de loting, twee tabbladen met dezelfde sessie.
3. **Logische fouten** in loting, beurtvolgorde, aangrenzendheid (stek_ring),
   zone-validatie, tijdvensters (server_now offset in de frontend), en de
   klassementsberekening.
4. **Frontend-robuustheid**: state-polling vs formulier-invoer, XSS (alle
   gebruikersinvoer gaat door esc(), klopt dat overal?), foto-upload en
   compressie op oudere telefoons, offline of trage verbindingen aan de
   waterkant, iOS-specifieke problemen.
5. **Web push**: subscription-lifecycle (endpoint-rotatie, verlopen subs),
   de pg_net fire-and-forget aanroep, edge function foutafhandeling.
6. **Kleinere zaken**: dode code, inconsistenties, toegankelijkheid, performance
   bij bijv. 50 teams en 300 vangsten.

## Gerichte vragen

1. w_push_subscribe accepteert ook een kijkcode en een null-token. Kan hiermee
   iets misbruikt worden (bijv. subscriptions van anderen overschrijven via
   on conflict (endpoint) do update)?
2. De teamlink zet een token uit de URL om in een sessie. De token blijft even
   in de browsergeschiedenis staan. Acceptabel of beter oplosbaar?
3. w_kies_stek/w_kies_zone: is het FOR UPDATE-lock voldoende tegen twee teams
   die tegelijk dezelfde stek/zone bevestigen? Ontbreekt er een lock op de
   wedstrijd-rij?
4. w_get_state geeft team-id's terug; vangsten refereren daaraan. Kan een
   kwaadwillende met alleen die id's iets doen? (Registreren vereist de token.)
5. De frontend rekent de resterende tijd met een server_now-offset maar de
   keiharde grens zit in w_registreer_vangst. Zitten daar randgevallen in
   (klokverschil, net-voor-eindtijd uploads waarvan de foto-upload al klaar is
   maar de RPC net te laat komt)?
6. renderOrg pollt elke 10s en vervangt innerHTML, inclusief knoppen met het
   tik-nogmaals-patroon. Kan een re-render een bevestiging onderbreken en is
   dat erg?
7. De zones-parser in de frontend ("Zone A: 20-30", stap 2 bij gelijke pariteit)
   en wedstrijd.valideer_zones in de database moeten hetzelfde afdwingen.
   Zie je verschillen die tot verwarring leiden?
8. De foto gaat eerst naar storage en daarna pas naar w_registreer_vangst.
   Mislukt stap 2, dan blijft een weesbestand achter. Is er een betere volgorde
   binnen de beperking dat er geen server is?
9. push-vangst.ts verstuurt notificaties sequentieel in een for-loop. Bij veel
   subscribers kan dat traag worden; is Promise.allSettled hier veilig?
10. index.html bevat alle views in één pagina met hidden-attributen. Zie je
    plekken waar view-state kan lekken tussen rollen (bijv. organisator-data
    die zichtbaar blijft na uitloggen)?
11. De service worker heeft geen fetch-handler en geen cache. Prima voor push,
    maar GitHub Pages cachet assets 10 minuten. Is een update-mechanisme
    (bijv. versie-check + reload-melding) de moeite waard?
12. Wat mist er om een wedstrijd van 40 koppels soepel te laten verlopen?

## Gewenst outputformat

Groepeer bevindingen als:
- **P0**: fout die een wedstrijd kan verstoren of het beveiligingsmodel breekt
- **P1**: moet gefixt worden, maar blokkeert geen wedstrijd
- **P2**: verbetering, opruimwerk, nice-to-have

Per bevinding: [bestand + functie/regel] · probleem · concreet voorstel.
Sluit af met een korte lijst van dingen die je expliciet hebt gecontroleerd en
in orde vond, zodat we weten wat afgedekt is.

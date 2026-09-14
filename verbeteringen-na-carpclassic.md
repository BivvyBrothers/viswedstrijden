# Verbeteringen viswedstrijdapp na de Carpclassic Nootdorp (12 en 13 sep 2026)

Status 14 sep: **Forms-uitkomsten binnen (20 antwoorden, samenvatting in
`klanten/NPHV/evaluatie-carpclassic-uitkomsten.md`), lijst bijgewerkt,
planvoorstel onderaan.** Bouwen pas na akkoord van Patrick op de volgorde.

Notities per punt zijn een eerste inschatting (bestaat al / klein / groter),
geen besluit.

## Kijkers

| # | Waarneming | Eerste inschatting |
|---|---|---|
| K1 | Kop boven het klassement zegt "Totaal gewicht, team"; moet "team/deelnemer" zijn | Tekstfix, klein |
| K2 | Kijkers zien alleen de grootste vissen, niet alle vangsten. Extra tab "Vangsten" voor kijkers | Kijkers hebben nu alleen `klassement` en `seizoen` (app.js, TABS per rol). Vangstenlijst bestaat al voor deelnemers; hergebruiken via `w_get_state_kijker`. Middel |
| K3 | Op de pagina van een lopende wedstrijd hoort een link te staan voor wie de app zelf wil gebruiken | Klein; promotieregel onderaan de kijkersweergave, naar viswedstrijdapp.nl |
| K4 | Kijkers moeten de kijklink makkelijk kunnen doorsturen | Klein; deelknop met Web Share API, zoals bij vangst delen (v45) |
| K5 | Bij einde wedstrijd een melding: winnaar groot met confetti, nummer 2 en 3 klein | Zelfde bouwsteen als D7; einde-detectie in de client (eindtijd staat in de state) plus één push via de edge function. Middel |
| K6 | Thuisblijvers hebben niets aan de kaart, zones en wie-zit-waar; dieptekaart alleen voor deelnemers | **Forms beslist: kijkers willen juist de kaart met wie waar zit (3 van 12) en de foto van de vis (2 van 12).** Kaart alleen-lezen tonen voor kijkers (de state bevat stekken en zones al), geen dieptekaart-3D. Middel |
| K7 | Kijkers willen het totaal aantal deelnemers zien (1x Forms) | Tellertje boven het klassement, ook nulvangers meetellen. Klein |

## Deelnemers

| # | Waarneming | Eerste inschatting |
|---|---|---|
| D1 | Na een paar uur niet actief soms uitgelogd | **GEBOUWD in v82, herstelrelease v83 na Codex-review (14 sep).** Oorzaak gevonden: Forms: 6 van 8 deelnemers, 4 van 8 raakten daardoor hun code kwijt. Het is GEEN echt uitloggen: het token `team:CODE` blijft in localStorage staan. Twee routes landen op het inlogscherm: (a) de terugknop `#btn-terug` zet `location.hash = ''` voor iedereen behalve de organisator (app.js regel 363), en Patrick zag mensen daar vaak op tikken; (b) de PWA start na afsluiten door iOS opnieuw op `start_url` = tenantroot = home. Fix: de home-route moet een geldig token herkennen en de deelnemer direct terugzetten in zijn wedstrijd ("Verder als <naam>" of automatisch), en de terugknop mag een deelnemer tijdens een lopende wedstrijd niet naar het inlogscherm sturen. De `recente`-sectie die dit ooit deed is verwijderd (regel 362). Klein tot middel |
| D2 | Op het tabblad Vangsten flikkeren de foto's om de zoveel seconden | **GEBOUWD in v82.** Rendering: de lijst wordt bij elke poll opnieuw opgebouwd, waardoor `<img>` opnieuw laadt. Fix: alleen bijwerken wat veranderd is (keyed render) of afbeeldingen cachen. Klein tot middel |
| D3 | Deelnemers moeten de kijkerscode makkelijk kunnen delen met vrienden, uitdrukkelijk NIET hun eigen deelnemerscode | Klein; deelknop in "Mijn deelname" die alleen de kijklink deelt. Let op: kijkcode moet dan in de deelnemersstate zitten |
| D4 | Code opslaan als wachtwoord bij eerste inlog, zodat je hem makkelijk terugvult na uitloggen | **GEBOUWD in v82** (toesteltest iPhone nog nodig). Middel; het inlogformulier met `autocomplete="username"` en `autocomplete="current-password"` markeren zodat iOS/Android aanbieden hem in de wachtwoordmanager te zetten. Geen account nodig. Hangt samen met D1 |
| D5 | Vangst registreren kan op vier plekken (oranje knop bij Kaart en Klassement, groene knop bij Vangsten, "Mijn deelname"); verwarrend. De oranje knop is duidelijk | Ontwerpkeuze: één vaste oranje knop op alle tabbladen, groene knop en de ingang in Mijn deelname weg. Middel; raakt instructies en site (doc-oppervlakken) |
| D6 | Melding bij einde wedstrijd: vangsten registreren kan niet meer | Klein bovenop K5/D7: één push "Wedstrijd afgelopen" met de uitslag erin |
| D7 | Bij einde wedstrijd: winnaar groot met confetti, 2 en 3 klein | Zie K5, zelfde component voor deelnemer en kijker |
| D8 | Laatste uur: de tijd kleurt rood | Klein; klok-render in app.js |
| D9 | Na de eindtijd een melding hoe laat de prijsuitreiking is | Klein als het een veld op de wedstrijd wordt (organisator vult tijd in bij aanmaken); meld het in dezelfde einde-push als D6 |
| D10 | Deelnemer kan aan het einde de uitslag delen op socials, met duidelijke link naar de site (promotie) | Bestaat deels: "Uitslag delen als afbeelding" (v41) en vangst delen (v45). Ontbreekt: prominente knop aan het einde en een link naar viswedstrijdapp.nl in de deeltekst. Klein |
| D11 | Bij aanmelden (vóór de start) vragen of de vangstfoto's gebruikt mogen worden voor de socials van de viswedstrijdapp (toegevoegd 14 sep) | Vinkje in het aanmeldformulier, opgeslagen per team (`teams.foto_toestemming`), zichtbaar in Beheer en in de beheerdersomgeving zodat Patrick weet welke foto's hij mag gebruiken. Standaard UIT. Klein |
| D12 | Persoonlijke code beter meegeven na aanmelden (uit Forms: "wachtwoord had ik nog niet eerder gekregen") | **GEBOUWD in v82.** Code groot tonen direct na aanmelden met "bewaar hem" en een deelknop naar jezelf; hoort bij D4. Klein |
| D13 | Tweede foto per vis (andere zijde), 1x gevraagd in Forms | Later; raakt upload, opslag en deelafbeelding. Pas bij meer vraag |

## Organisator

| # | Waarneming | Eerste inschatting |
|---|---|---|
| O1 | Vangst aan een andere deelnemer toewijzen (iemand vist met z'n tweeën en zit onder de verkeerde code) | Middel: nieuwe beheer-RPC die `deelnemer_id` van een vangst wijzigt, met audit (wie, wanneer, van wie naar wie) |
| O2 | Tijd handmatig invullen bij handmatig invoeren van een vangst | Klein; tijdveld in het beheerformulier, default nu |
| O3 | Sterretje bij een vangst die door de organisator is aangepast | Klein zodra O1/O2 een `gewijzigd_door`-kolom opleveren; tonen in klassement en vangstenlijst |

## Rode draden (voorlopig)

1. **Betrouwbaarheid eerst**: D1 (uitloggen) en D2 (flikkeren) raken iedereen en
   kwamen al tijdens de wedstrijd naar boven.
2. **Einde van de wedstrijd als moment**: K5, D6, D7, D9 en D10 zijn samen één
   feature: "afsluiting" (push + scherm met winnaar, prijsuitreiking, delen).
3. **Delen als promotiekanaal**: K3, K4, D3 en D10 zijn allemaal kleine
   deelknoppen met een link naar de site. Goedkoop, en het is hoe nieuwe
   klanten binnenkomen (Forms vraag 19 en 26).
4. **Eén manier om een vangst te registreren** (D5) is een ontwerpbesluit dat
   ook instructies, site en draaiboek raakt.
5. **Organisator-correcties** (O1 tot O3) zijn één klein blok werk in Beheer.

## Planvoorstel (14 sep, na de Forms-uitkomsten; wacht op akkoord Patrick)

Niet bouwen: chat (4 van 8 zegt WhatsApp is prima; hooguit later een
omroep voor de organisator), tweede foto per vis (1 stem).

| release | inhoud | waarom eerst |
|---|---|---|
| **v82 Sessie-herstel** | D1 (home herkent token en zet de deelnemer terug in zijn wedstrijd; terugknop stuurt een deelnemer niet naar het inlogscherm), D4 (inlogveld met `autocomplete` zodat de telefoon de code in de wachtwoordmanager zet), D12 (code groot tonen na aanmelden), D2 (flikkerende foto's) | Het enige echte probleem uit de evaluatie: 6 van 8 deelnemers. Alles wat hierna komt is pas geloofwaardig als dit weg is |
| **v83 Afsluiting** | K5/D7 (winnaar met confetti, 2 en 3 klein), D6 (registreren gesloten), D9 (tijd prijsuitreiking als veld op de wedstrijd), D8 (laatste uur klok rood), D10 (deelknop uitslag met sitelink) | Eén samenhangende feature, en het moment waarop de app zichzelf verkoopt in de groepsapp |
| **v84 Kijkers** | K2 (tab Vangsten met foto's), K6 (kaart wie-zit-waar, alleen-lezen), K7 (aantal deelnemers), K1 (kop team/deelnemer), K3 (promotielink), K4 + D3 (kijklink delen, nooit de eigen code) | 12 van 12 kijkers komt terug en 6 van 12 wil de app zelf gebruiken; dit is het promotiekanaal |
| **v85 Organisator en aanmelden** | O1 (vangst toewijzen aan ander), O2 (tijd bij handmatige vangst), O3 (sterretje bij gecorrigeerde vangst), D11 (foto-toestemming bij aanmelden), D5 (één vaste oranje registratieknop, groene knop en ingang in Mijn deelname weg; instructies en site mee) | Correcties in Beheer zijn één klein blok; D5 raakt de docs en kan daarom beter in een eigen ronde |

Elke release: Codex-review vooraf (werkafspraak), docs-oppervlakken mee, en
de demo-omgeving laat de nieuwe onderdelen zien.

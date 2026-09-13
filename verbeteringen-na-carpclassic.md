# Verbeteringen viswedstrijdapp na de Carpclassic Nootdorp (12 en 13 sep 2026)

Status: **verzamellijst, nog geen plan.** Patricks eigen waarnemingen van de
eerste echte wedstrijd (vastgelegd 13 sep). De Forms-evaluatie onder deelnemers
en kijkers loopt; zodra die binnen is (richtdatum: week van 15 sep) maken we
hier één geprioriteerd plan van. Tot die tijd niets bouwen.

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
| K6 | Thuisblijvers hebben niets aan de kaart, zones en wie-zit-waar; dieptekaart alleen voor deelnemers | Bewust zo, maar heroverwegen: wie-zit-waar is voor thuis juist leuk. Beslispunt na de evaluatie (vraag 24 in Forms gaat hierover) |

## Deelnemers

| # | Waarneming | Eerste inschatting |
|---|---|---|
| D1 | Na een paar uur niet actief soms uitgelogd | **Hoogste prioriteit**: ook al meerdere keren gehoord tijdens de wedstrijd. Oorzaak nog niet bewezen (iOS die de PWA-opslag opruimt? sessie-generatie? code uit localStorage weg?). Eerst onderzoeken, dan pas fixen. Forms vraag 4 en 5 meten hoe vaak |
| D2 | Op het tabblad Vangsten flikkeren de foto's om de zoveel seconden | Rendering: de lijst wordt bij elke poll opnieuw opgebouwd, waardoor `<img>` opnieuw laadt. Fix: alleen bijwerken wat veranderd is (keyed render) of afbeeldingen cachen. Klein tot middel |
| D3 | Deelnemers moeten de kijkerscode makkelijk kunnen delen met vrienden, uitdrukkelijk NIET hun eigen deelnemerscode | Klein; deelknop in "Mijn deelname" die alleen de kijklink deelt. Let op: kijkcode moet dan in de deelnemersstate zitten |
| D4 | Code opslaan als wachtwoord bij eerste inlog, zodat je hem makkelijk terugvult na uitloggen | Middel; het inlogformulier met `autocomplete="username"` en `autocomplete="current-password"` markeren zodat iOS/Android aanbieden hem in de wachtwoordmanager te zetten. Geen account nodig. Hangt samen met D1 |
| D5 | Vangst registreren kan op vier plekken (oranje knop bij Kaart en Klassement, groene knop bij Vangsten, "Mijn deelname"); verwarrend. De oranje knop is duidelijk | Ontwerpkeuze: één vaste oranje knop op alle tabbladen, groene knop en de ingang in Mijn deelname weg. Middel; raakt instructies en site (doc-oppervlakken) |
| D6 | Melding bij einde wedstrijd: vangsten registreren kan niet meer | Klein bovenop K5/D7: één push "Wedstrijd afgelopen" met de uitslag erin |
| D7 | Bij einde wedstrijd: winnaar groot met confetti, 2 en 3 klein | Zie K5, zelfde component voor deelnemer en kijker |
| D8 | Laatste uur: de tijd kleurt rood | Klein; klok-render in app.js |
| D9 | Na de eindtijd een melding hoe laat de prijsuitreiking is | Klein als het een veld op de wedstrijd wordt (organisator vult tijd in bij aanmaken); meld het in dezelfde einde-push als D6 |
| D10 | Deelnemer kan aan het einde de uitslag delen op socials, met duidelijke link naar de site (promotie) | Bestaat deels: "Uitslag delen als afbeelding" (v41) en vangst delen (v45). Ontbreekt: prominente knop aan het einde en een link naar viswedstrijdapp.nl in de deeltekst. Klein |

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

Aanvullen met de Forms-uitkomsten (`klanten/NPHV/evaluatie-carpclassic-vragen.md`
bevat de vragenlijst), daarna prioriteren en versienummers toekennen.

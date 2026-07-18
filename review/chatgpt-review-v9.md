# Reviewverzoek v9 · beheerdersomgeving (viswedstrijdapp, 18 jul 2026)

Je bent een kritische senior reviewer (security, robuustheid en UX). Scope
van deze ronde: uitsluitend de BEHEERDERSOMGEVING van de viswedstrijdapp,
client én server. Eerdere rondes (v2 t/m v8, alle verwerkt) dekten de rest
van de app en de site; verwijs alleen naar die gebieden als een
beheerder-bevinding erop ingrijpt.

## Wat is de beheerdersomgeving

Een vierde, verborgen rol naast deelnemer/kijker/organisator: het
KemblincK-supportscherm waarmee Patrick (enige gebruiker) organisatoren
helpt. Bereikbaar via de route `#/beheerder` in elke tenant (geen knop in
de UI; de rootpagina stuurt de hash door via `docs/landing.js`). Inloggen
met een apart beheerderswachtwoord (alleen in de database en in Patricks
wachtwoordmanager; NIET in de repo, en dat moet zo blijven, de repo is
publiek).

Functies na inloggen:
- statistiekenregel (klanten, wedstrijden, teams, vangsten, push, seizoenen)
- instellingen: alleen-lezen-vlag aan/uit (abonnement verlopen),
  organisatie-wachtwoord resetten, eigen beheerderswachtwoord wijzigen
- wedstrijden gegroepeerd per klant (tabs NPHV / Demo), per wedstrijd de
  deelnemerscode, kijkcode en admin-pin in beeld (bewust: support) plus
  "Openen & beheren" (zet de pin in sessionStorage en opent de wedstrijd
  met de beheer-tab ontgrendeld)

## Te reviewen code

Repo-pad:
`/Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/`

1. `docs/app.js` | de hele su-sectie: zoek op `initSu`, `laadSu`,
   `renderSu`, `suKaart`, `wisSuScherm`, `suww`, `#/beheerder`. Let ook op
   de wisselwerking met de router en de poll-cyclus.
2. `docs/nphv/index.html` en `docs/demo/index.html` | `#view-beheerder`
   (su-login, su-omgeving, de drie formulieren) en hoe de invoervelden
   gedeclareerd zijn (type, autocomplete, enz.).
3. `review/database.sql` | de serverkant: `wedstrijd.su_check` en de
   `w_su_*`-functies (`w_su_overzicht`, `w_su_alleen_lezen`,
   `w_su_org_wachtwoord`, `w_su_wachtwoord`). Kijk naar wat er
   teruggegeven wordt, welke validatie er is en hoe brute force wordt
   afgeremd (pg_sleep).
4. `docs/landing.js` | de `#/beheerder`-doorstuurroute.
5. `CLAUDE.md`, sectie "Beheerdersomgeving (v44)" | de afspraken.

## Risico-kader (weeg je bevindingen hiertegen)

- Er is precies één legitieme gebruiker (Patrick). Geen multi-admin,
  geen rollen, geen audit-eisen van derden.
- De repo is PUBLIEK: alle client- en servercode is voor iedereen
  leesbaar; de route `#/beheerder` is dus geen geheim. De verdediging
  moet volledig uit het wachtwoord + serverkant komen.
- Hobby-schaal by design (zie CLAUDE.md "Bewuste beperkingen"): pins
  niet gehasht, geen rate-limiting-infrastructuur. Benoem het gerust als
  een bevinding als je vindt dat de beheerdersingang zwaarder beschermd
  moet zijn dan de rest, maar wees concreet over de goedkoopste zinvolle
  maatregel.

## Aandachtspunten

- **Brute force en timing**: is `su_check` met pg_sleep voldoende, of is
  het wachtwoord online te raden (geen lockout, geen backoff, anon key
  publiek)? Wat is de goedkoopste verbetering (bijv. exponentieel
  oplopende vertraging of een failed-attempts-teller in instellingen)?
- **Sessiebeheer**: het wachtwoord staat als platte tekst in
  sessionStorage (`suww`) zolang de sessie loopt en gaat bij elke
  su-RPC mee. Is dat acceptabel voor deze schaal, of is een kortlevend
  servertoken de moeite waard? Controleer ook of `wisSuScherm` alle
  gevoelige DOM/state echt opruimt (v6 heeft daar al een fix gehad).
- **Gevoelige data in beeld**: admin-pins en codes van ALLE klanten staan
  onversleuteld in het overzicht (bewust voor support). Zie je een
  goedkope verbetering (bijv. pins standaard gemaskeerd met een
  toon-knop) die support niet hindert?
- **Gevaarlijke acties**: alleen-lezen aanzetten en org-wachtwoord
  resetten raken een hele klantomgeving. Is er een bevestigingsstap en
  duidelijke feedback? Kan een misklik kwaad?
- **Invoervelden**: staan de wachtwoordvelden op het juiste type
  (password vs text), autocomplete-attributen, en lekt de
  browser-wachtwoordmanager hier iets?
- **Schaalbaarheid van de UI**: bij 10+ klanten worden de tabs en de
  lijst lang; is de huidige opzet houdbaar of is er een simpele
  verbetering (zoeken, inklappen)?
- **Visuele consistentie**: de rest van de app kreeg in v52 een
  restyle (hero-eyebrow, kaart-stijl rolknoppen); de beheerderspagina
  heeft nog de oude vlakke stijl. Doe concrete, kleine voorstellen die
  het scherm rustiger en scanbaarder maken (dit is een supporttool,
  functie boven vorm).
- **Router-randgevallen**: wat gebeurt er bij `#/beheerder` terwijl je al
  in een wedstrijd zit, bij teruggaan met de browser-terugknop, en bij
  een verlopen/fout wachtwoord halverwege een actie?

## Output

Markdown-lijst met bevindingen (P0 = blocker, P1 = belangrijk, P2 =
nice-to-have): per punt bestand/regel, scenario en een concreet
fix-voorstel, gewogen tegen het risico-kader hierboven. Daarna een korte
lijst UI-voorstellen voor de beheerderspagina (maximaal 5, concreet).
GEEN wachtwoorden of geheime waarden in je output opnemen.

Patrick zet je output in `review/codex-review-v9-bevindingen.md`; daarna
verwerk ik de punten en leg ik per punt verantwoording af in een
status-document, zoals bij v4 t/m v8.

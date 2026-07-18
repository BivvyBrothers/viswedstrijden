# Reviewverzoek v8 · totaalreview site + app (viswedstrijdapp, 17 jul 2026)

Je bent een kritische senior reviewer met twee petten: productdesigner/
UX-copywriter én technisch reviewer. Waar v2 t/m v7 diff-reviews waren,
vraag ik nu een TOTAALREVIEW van de site en de app zoals een nieuwe
bezoeker en een nieuwe klant ze vandaag ervaren, plus een korte codecheck
van de laatste wijzigingen (v53-v55).

## Context en positionering

- Product: statische multi-tenant PWA voor viswedstrijden, live op
  https://viswedstrijdapp.nl (GitHub Pages, geen build-stap, vanilla JS).
- Positionering: BEWUST geen registratie-/logboek-app (vissers zijn
  terughoudend met vangst- en stekgegevens); focus is 100% wedstrijden.
  Doelgroep: hengelsportverenigingen, viswaterbeheerders en
  vriendengroepen. Verkoop loopt via de landingspagina + demo.
- Rollen in de app: deelnemer (wedstrijdcode + naam, geen account),
  kijker (kijkcode, alleen klok/klassement), organisator (wachtwoord).
- Server: Supabase via security-definer RPC's; v2-v7 hebben de server al
  grondig gereviewd, dat hoeft NIET opnieuw. Meld server-punten alleen als
  je iets nieuws/ernstigs ziet (definities: `review/database.sql`).
- Repo-pad (alles leesbaar voor jou):
  `/Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/`
  Projectafspraken en architectuur: `CLAUDE.md` in de repo-root.

## Deel A · De site (marketing-oppervlak)

Beoordeel als bezoeker die via een gedeelde link of zoekopdracht
binnenkomt, op desktop én mobiel (denk 375px):

1. Landing `docs/index.html` (live: https://viswedstrijdapp.nl): hero
   "Loot. Vis. Win.", secties met telefoon-mockups (`docs/schermen/`),
   dieptescan-3D-figuur, wedstrijddag-stappen, privacy-blok, FAQ, CTA.
2. Inlogpagina `docs/inloggen/index.html` (live: /inloggen/).
3. Instructiepagina's `docs/instructies.html` + tenant-varianten en de
   print-A4 (`beginscherm-a4.html`).
4. og/social-meta + `docs/og.png` (hoe oogt een gedeelde link).
5. Redirect `docs/info.html` -> /.

Let op: conversie (is de route bezoeker -> demo -> contact logisch en
kort?), copy (toon, consistentie, spelfouten, beloftes die de app niet
waarmaakt), informatie-architectuur (mist er iets dat een vereniging wil
weten voordat ze mailen?), visuele consistentie met de app-huisstijl,
en eventuele dode of verwarrende links. Prijzen staan bewust NIET op de
site (prijzenblad gaat per mail); beoordeel of dat gemis voelbaar is.

## Deel B · De app (PWA)

Loop de app door zoals een echte gebruiker, via de demo-omgeving
(live en publiek, geen echte deelnemersdata):

- Kijker: https://viswedstrijdapp.nl/demo/#/k/KIJKJE (afgelopen
  voorbeeldwedstrijd met uitslag + tabblad Seizoen).
- Deelnemer-inkijk: code DEMOJA via /demo/ (kaart met stekken, vangsten,
  Mijn team; registreren is dicht want de wedstrijd is afgelopen).
- Extra kijkcodes seizoen: KIJKD2, KIJKD3.
- De NPHV-omgeving (/nphv/) alleen BEKIJKEN tot het startscherm; daar
  draait productie, geen testacties doen.

Beoordeel per rol: eerste indruk en begrijpelijkheid van het startscherm
(nieuwe rolknop-kaarten), de kaart (echte dieptekaart-onderlaag bij NPHV,
standaardkaart in de demo, 3D-knop bij NPHV), klassement en seizoensstand
(leesbaarheid, opbouw per vis), delen (uitslag/seizoen/vangst als
afbeelding), instructies/onboarding, en offline-/slecht-bereik-gedrag
voor zover je dat uit de code kunt afleiden (`docs/app.js`,
`docs/nphv/sw.js`). Gebruiksvriendelijkheid aan de waterkant (zon,
natte handen, haast) weegt zwaar.

## Deel C · Codecheck laatste wijzigingen (v53-v55)

Kort, zoals eerdere diff-reviews:

- v53 `284228d`: lightbox-toegankelijkheid (echte sluitknop, focus
  heen/terug, Escape, `data-groot-alt`, error-toast) + scaffold-checks in
  `tools/nieuwe_tenant.py` (SHELL/kaart.js/bestanden-consistentie).
- v54 `e800215` + v55 `3d9b952`-reeks: karperlogo als `.knop-logo` in
  landing- en demo-knoppen, met vaste width/height-attributen tegen
  CSS-cache-races.

Kijk vooral of de nieuwe lightbox-helpers (`openFotoGroot`/
`sluitFotoGroot` in `docs/app.js`) nergens conflicteren met de
deel-overlay (`#deel-nieuw`) en of de scaffold-post-checks kloppen.

## Output

Twee lijsten in markdown:

1. **Bevindingen** met prioriteit (P0 = blocker, P1 = belangrijk,
   P2 = nice-to-have): per punt pagina/bestand, wat er misgaat, scenario
   en een concreet fix-voorstel. Functionele en technische punten.
2. **Aanbevelingen site & UX** (geen bugs): maximaal je top-10, gerangschikt
   op verwachte impact voor conversie of gebruiksgemak, elk met een concreet
   voorstel (welke sectie, welke copy, welk element).

Patrick zet je output in `review/codex-review-v8-bevindingen.md`; daarna
verwerk ik de punten en leg ik per punt verantwoording af in een
status-document, zoals bij v4 t/m v7.

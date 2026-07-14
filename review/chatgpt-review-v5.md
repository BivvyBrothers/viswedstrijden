# Review-verzoek v5: viswedstrijd-app (v42) | uitslag delen + seizoensklassement

Je bent een kritische senior reviewer. Je deed eerder v2 t/m v4; alle
bevindingen zijn verwerkt en live. Sindsdien zijn er twee features bij:
**einduitslag delen als afbeelding (v41)** en het **seizoensklassement (v42)**,
gebouwd naar de Sportvisunie-reglementen 2026. Controleer op bugs,
security-gaten, rekenkundige fouten en regressies.

Dit document staat in `KemblincK/Viswedstrijdapp/app/review/`; alle paden
hieronder zijn relatief aan `KemblincK/Viswedstrijdapp/app/` en rechtstreeks
leesbaar vanaf schijf. De code staat ook publiek op
https://github.com/BivvyBrothers/viswedstrijden (branch main).

## Wat is er nieuw sinds jouw v4-controle (v40 → v42)

1. **v41 | uitslag delen:** op een AFGELOPEN wedstrijd met vangsten staat onder
   het klassement "Deel de einduitslag": `tekenUitslag()` (canvas, top-10 +
   grootste vis, huisstijl, viswedstrijdapp.nl in de voet) + `deelUitslag()`
   (Web Share API met bestand, anders PNG-download). Aggregatie gedeeld met de
   klassement-tabel via `klassementRijen()` (zelfde tiebreaks).
2. **v42 | seizoensklassement** (ontwerp: `seizoensklassement-ontwerp.md`,
   gebaseerd op 5 Sportvisunie-reglementen; lees dat eerst):
   - DB: tabel `wedstrijd.seizoenen` (naam, regels jsonb) +
     `wedstrijden.seizoen_id` + `wedstrijden.dag_regels`; RPC's
     `w_org_seizoen_maak/wijzig/verwijder/koppel`, `w_org_seizoenen`
     (org-wachtwoord) en publiek `w_seizoen_stand(p_code)`.
   - Regels per seizoen: telling plaatspunten|totaalgewicht; aftrek 0-20
     slechtste resultaten vervallen (minimaal 1 telt); niet-vanger
     gemiddelde (ceil((vangers+1 + plaatsen)/2), ONK/KKKC) | vangers+1 (NOK) |
     max+1 (ONK Clubs); gemist hoogste+1 (TTC 7.4) | deelnemers+1; ex-aequo
     per wedstrijd te overriden: app (grootste vis, dan vroegst; uniek
     genummerd) | sportvisunie (gedeelde plaats, doortellen) | karper (meer
     vissen, dan grootste vis het eerst; KKKC 6.5).
   - Alleen AFGELOPEN wedstrijden (eind_ts < now()) tellen mee. Eindstand:
     minste punten, tiebreak totaal gevangen gewicht (alle wedstrijden), dan
     hoogste daggewicht; gedeelde plaats bij volledige gelijkheid (rank).
   - Deelnemer-matching over wedstrijden: genormaliseerde naam (lower/trim);
     koppels op het naampaar ongeacht volgorde (least/greatest).
   - Client: tabblad Seizoen (verschijnt alleen als de wedstrijd bij een
     seizoen hoort; ook voor kijkers), tabel met kolom per wedstrijd
     (doorgestreept = aftrek, grijs = gemist), "Deel de seizoensstand"
     (canvas), org-omgeving: Seizoenen-kaart + selects per wedstrijdkaart.
3. Demo uitgebreid: "Demo-competitie 2026" met 3 afgelopen wedstrijden
   (kijkcodes KIJKJE publiek; KIJKD2/KIJKD3 bestaan maar zijn niet
   geadverteerd).

## Te reviewen bestanden

| Bestand | Wat |
|---|---|
| `review/database.sql` (onderaan) | seizoenen-tabel + alle w_org_seizoen_* + `w_seizoen_stand` (verse live defs) |
| `docs/app.js` | klassementRijen/tekenUitslag/deelPng (v41), laadSeizoen/renderSeizoen/tekenSeizoen/deelSeizoen, renderTabs-wijziging, org-seizoenenbeheer + selects, route-hook |
| `docs/nphv/index.html` + `docs/demo/index.html` | seizoen-tabknop + tab-sectie + org-Seizoenen-kaart + deel-knoppen |
| `seizoensklassement-ontwerp.md` | het ontwerp waar de implementatie aan moet voldoen |

## Bewuste keuzes: NIET aanmerken

- Vak/zone-klassering, naam-aliassen (spelvarianten samenvoegen), strafpunten
  en prijzengeld: bewust fase 2 / buiten scope (staat in het ontwerp).
- `w_seizoen_stand` is publiek opvraagbaar met elke geldige wedstrijd- of
  kijkcode van een gekoppelde wedstrijd; het toont alleen namen/punten/
  gewichten die via de klassementen toch al publiek zijn, en GEEN codes.
- Deelnemersnamen zijn de identiteit over wedstrijden heen; een organisator
  die namen anders spelt splitst een visser bewust (gedocumenteerd).
- Tiebreak "totaal vangstgewicht" telt over ALLE geviste wedstrijden
  (reglement zegt niet of vervallen resultaten meetellen; dit is de gekozen,
  gedocumenteerde interpretatie).
- De demo deelt de single-tenant productiedatabase (sinds v4 bekend);
  seizoenen krijgen bij de tenancy-migratie ook een tenant-kolom.
- Aftrek default 1 bij seizoenen zonder expliciete regels (jsonb leeg).

## Focusvragen

1. **Rekenlogica `w_seizoen_stand`:** loop de puntentoekenning na tegen de
   reglementen (ONK 2.5/3.5, TTC 7.4/7.5, KKKC 6.2-6.5, NOK 3.1, ONK Clubs
   3.1-3.2): plaats per variant, niet-vanger-formules, gemist-formules,
   aftrek ("minstens 1 telt"), tiebreaks, gedeelde eindplaatsen. Klopt de
   `max_plus_1`-variant ook bij gedeelde plaatsen (max over uitgedeelde
   vangerspunten)? En de aftrek-keuze bij gelijke punten (laagste gewicht
   vervalt eerst)?
2. **SQL-robuustheid:** temp-tabellen met `on commit drop` + `drop if exists`
   binnen een security-definer-functie: zie je problemen bij parallelle
   aanroepen in dezelfde sessie/transactie (PostgREST), of memory/performance
   bij realistische groottes (200 teams x 20 wedstrijden)? Injectie-risico's?
3. **Autorisatie:** alle nieuwe schrijf-RPC's eisen het org-wachtwoord met
   pg_sleep bij fout; `w_seizoen_stand` is read-only. Gemist schrijfvlak?
   Kan een kijkcode via het seizoen ergens data zien die kijkers niet horen
   te zien (bijv. via een gekoppelde wedstrijd die nog in de aanmeldfase is)?
4. **Client-regressies:** renderTabs is aangepast (kijkers kunnen nu een
   tabbalk krijgen); check de kijker-flow zonder seizoen (moet exact als
   voorheen), de deelnemer-flow, en dat de seizoen-tab correct verdwijnt bij
   navigeren naar een wedstrijd zonder seizoen (SEIZOEN-reset in de route).
5. **Org-UI:** de seizoen/dagregel-selects worden elke 10s her-gerenderd door
   de org-poll; kan een wijziging verloren gaan terwijl de select open staat,
   of een race tussen onchange en re-render?
6. **Canvas-functies:** tekenUitslag/tekenSeizoen bij randgevallen: 0 of 1
   deelnemers, extreem lange namen, punten met .5 (gemiddelde-formule kan
   op .5 uitkomen? ceil voorkomt dat; klopt dat overal), heel veel
   wedstrijden (breedte tabel/afbeelding).
7. **v41-refactor:** klassementRijen wordt nu door tabel én canvas gebruikt;
   is het gedrag identiek aan de oude inline-versie (geen regressie in de
   klassement-tab)?

## Gewenste output

Geneste lijst, gesorteerd op prioriteit (P0 = fixen voordat klanten dit zien,
P1 = belangrijk, P2 = nice to have). Per bevinding: bestand +
regel(indicatie), probleem, concreet reproductiescenario en voorgestelde fix.
Sluit af met wat je expliciet gecontroleerd en goedgekeurd hebt.

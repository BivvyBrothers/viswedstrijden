# Ontwerp seizoensklassement | gebaseerd op de Sportvisunie-reglementen 2026

Bronnen (sportvisunie.nl/nl/artikelen/wedstrijden-nationaal-reglementen,
gelezen 14 jul 2026): Wedstrijdreglement Top Teamcompetities 2026,
ONK en selectie Dobber- en Feedervissen 2026, Voorrondes en ONK Clubs 2026,
Noord-Oostelijk Kampioenschap 2026, Karper Koppel Kanalen Competitie 2026.

## Wat de reglementen gemeen hebben

**Binnen een wedstrijd (de dagklassering):**
1. Klassering op totaal vangstgewicht: zwaarste = plaats 1, enz. De plaats is
   meteen het aantal punten (laag = goed). Bron: alle reglementen.
2. **Ex aequo:** exact gelijk gewicht = dezelfde klassering, er wordt
   doorgeteld ("nummer 1 en 2 gelijk: beiden 1, de volgende is 3").
   Bron: ONK 2.5/3.5/4.5, ONK Clubs 3.1, NOK 3.1.
   De KKKC (karper) wijkt af: bij gelijk gewicht wint het koppel met MEER
   karpers, daarna de grootste vis die het eerst gevangen is (KKKC 6.5).
3. **Niet-vangers** krijgen punten volgens een van drie varianten:
   - ONK + KKKC: het gemiddelde van (aantal vangers + 1) en (totaal aantal
     plaatsen), naar boven afgerond;
   - NOK: aantal vangers + 1;
   - ONK Clubs: hoogste uitgedeelde punten + 1.
4. Grote velden worden in **vakken** geklasseerd (punten = plaats binnen je
   vak); kleine velden zijn 1 vak (NOK 3.1 noemt dat expliciet).

**Over de wedstrijden heen (de competitie):**
5. **Punten optellen, minste punten wint** (TTC 7.5, KKKC 7.1).
6. **Aftrekwedstrijden:** een vast aantal slechtste resultaten vervalt
   (TTC: 5 van 6 of 3 van 4; KKKC: 3 beste van 4). Een wedstrijd met
   sanctie-strafpunten vervalt nooit (TTC 7.5.1).
7. **Wie een wedstrijd mist** krijgt het hoogste aantal behaalde
   wedstrijdpunten + 1 (TTC 7.4).
8. **Tiebreaks eindstand:** 1) totaal vangstgewicht over de (meegetelde)
   wedstrijden, 2) hoogste vangstgewicht in een wedstrijd (TTC 7.5, ONK).

## Vertaling naar de app

### Concept

Nieuw begrip **seizoen** (competitie): een set wedstrijden van een organisatie
met een naam ("Zomeravondcompetitie 2026") en een regelprofiel. De organisator
maakt seizoenen in de organisatie-omgeving en koppelt wedstrijden eraan
(aanvinken bij aanmaken of achteraf in Beheer). Een wedstrijd zonder seizoen
blijft precies wat hij nu is.

**Regels kiezen per seizoen EN per wedstrijd:**
- Het **seizoen** draagt het regelprofiel voor de competitie-telling
  (puntensysteem, aftrek, niet-vanger- en afwezig-regel).
- De **wedstrijd** kiest zijn eigen dagregels: of hij meetelt in het seizoen
  en welke ex-aequo-variant geldt (app-standaard, Sportvisunie-witvis of
  KKKC-karper). Zo kan een feestwedstrijd buiten de competitie blijven en kan
  een karperseizoen andere dagregels hebben dan een witvisseizoen.

### Regelprofiel per seizoen (instellingen, met Sportvisunie-defaults)

| Instelling | Opties | Default (= Sportvisunie) |
|---|---|---|
| Telling | **plaatspunten** (dagklassering = punten, minste wint) of **totaalgewicht** (som kg, meeste wint) | plaatspunten |
| Aftrekwedstrijden | 0..n slechtste resultaten vervallen | 1 (zoals TTC/KKKC) |
| Niet-vanger krijgt | **gemiddelde** ceil((vangers+1 + plaatsen)/2), **vangers+1**, of **max+1** | gemiddelde (ONK/KKKC) |
| Wedstrijd gemist | **hoogste punten + 1** of **deelnemers + 1** | hoogste punten + 1 (TTC 7.4) |
| Tiebreak eindstand | vast: totaal gewicht, dan hoogste dag-gewicht, dan gedeelde plaats | vast |

De variant "totaalgewicht" staat niet in de reglementen maar is de
vriendengroepen-modus: simpel uit te leggen, geen punten. Voor verenigingen
is plaatspunten de norm; wie een wedstrijd mist ligt er dan niet meteen uit
(zeker met een aftrekwedstrijd).

### Dagregels per wedstrijd

| Instelling | Opties | Default |
|---|---|---|
| Telt mee in seizoen | ja/nee (= wel/geen seizoen gekoppeld) | ja bij aanmaken binnen een seizoen |
| Ex aequo in de daguitslag | **app-standaard** (grootste vis wint, dan vroegst gevangen; huidige gedrag), **sportvisunie** (gedeelde plaats, doortellen), **karper/KKKC** (meer vissen wint, dan grootste vis die het eerst gevangen is) | app-standaard (geen gedragswijziging voor bestaande gebruikers) |

Vak-klassering (punten per zone in plaats van over het hele veld) is bewust
FASE 2: clubvelden zijn doorgaans 1 vak (NOK), en de app kent zones al per
team (`teams.zone`), dus dit kan later zonder schemawijziging als extra
seizoens-optie erbij.

### Deelnemer-identiteit over wedstrijden heen

Teams bestaan per wedstrijd; het seizoen koppelt op **genormaliseerde naam**
(trim, lowercase, bij koppels het paar namen ongeacht volgorde). Risico:
spelvarianten ("Jan" vs "Jan B.") splitsen een visser in twee regels. Aanpak:
- de aanmeld-UI toont bij een seizoenswedstrijd de namen die eerder in het
  seizoen meededen (tikken = overnemen);
- de organisator ziet in het seizoensbeheer een waarschuwing bij bijna-gelijke
  namen; samenvoegen via een alias-tabel is fase 2.

### Techniek

- **Datamodel:** tabel `wedstrijd.seizoenen` (id, naam, regels jsonb,
  created_at) + `wedstrijden.seizoen_id` (nullable) +
  `wedstrijden.dag_regels` (jsonb, alleen de ex-aequo-variant). Bij de
  DB-tenancy-migratie krijgt `seizoenen` dezelfde tenant-kolom als de rest.
- **Berekening server-side** in een nieuwe RPC `w_seizoen_stand(p_code)`
  (security definer, zoals alles): levert per deelnemer de punten per
  wedstrijd, welke resultaten vervallen zijn (aftrek), totaal en de
  tiebreak-velden. Eén bron van waarheid, ook bruikbaar voor de deel-afbeelding.
  Beheer-RPC's: `w_org_seizoen_maak/wijzig/verwijder/koppel` (org-wachtwoord).
- **UI:** (a) organisatie-omgeving: seizoenen aanmaken + wedstrijden koppelen
  + regelprofiel; (b) in de wedstrijdweergave een tab of blok **"Seizoen"**
  met de tussenstand, zichtbaar voor deelnemers en kijkers van elke gekoppelde
  wedstrijd; (c) **"Deel de seizoensstand"** hergebruikt het
  uitslag-canvas van v41 (zelfde huisstijl, viswedstrijdapp.nl in de voet).
- **Weergave-details conform reglementen:** vervallen (aftrek)resultaten
  doorgestreept tonen, gedeelde plaatsen met hetzelfde rangnummer en
  doortellen, en per rij de opbouw (punten per wedstrijd) zoals de
  TTC-voorbeeldtabel (wedstrijddag 1 + 2 + totaal).

### Wat bewust NIET (nu)

- Vakken/vak-punten binnen een wedstrijd (fase 2, zie boven).
- Sanctie-strafpunten en het "sanctiewedstrijd vervalt nooit"-mechanisme:
  hobby-organisatoren corrigeren gewoon de uitslag; strafpunten zijn
  bondsniveau.
- Meerdaagse wedstrijden als één uitslag (KKKC vist 45 uur non-stop): een
  wedstrijd in de app heeft al vrije start/eindtijden, dus dit werkt vanzelf.
- Prijzengeld-verdeling (KKKC 6.6/7.2): buiten scope, blijft mensenwerk.

### Faseringsvoorstel

1. **Fase 1:** seizoenen + koppeling + plaatspunten/totaalgewicht + aftrek +
   niet-vanger/afwezig-regels + seizoenstab + delen als afbeelding.
2. **Fase 2:** vak(zone)-klassering, naam-aliassen/samenvoegen,
   seizoensarchief per jaar.

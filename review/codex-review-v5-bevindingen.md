# Codex-review v5: bevindingen en voorstellen

Dit document hoort bij `chatgpt-review-v5.md` en beoordeelt app v42: einduitslag delen als afbeelding en het nieuwe seizoensklassement.

## Samenvatting

Ik heb geen P0 gevonden die de hele feature blokkeert voordat klanten hem kunnen zien. De hoofdlijnen zijn goed: `w_seizoen_stand` rekent server-side, gebruikt alleen afgelopen wedstrijden, deelt geen codes via de publieke seizoen-API en de nieuwe tenant-indexen bevatten de vereiste seizoen-tab en deelknoppen.

Er zijn wel een paar P1-punten die ik zou fixen voordat je het seizoensklassement breed verkoopt. De belangrijkste zijn: de SQL-bundel is niet opnieuw vanaf nul uitvoerbaar, de karper-tiebreak lijkt de grootste vis niet mee te wegen, de deelafbeelding van de einduitslag verliest gedeelde plaatsen, en `laadSeizoen()` kan bij snelle navigatie stale data in de verkeerde wedstrijd tonen.

## P0

Geen P0 gevonden.

## P1

### 1. `database.sql` faalt bij een restore op een lege database

**Bestand**

- `review/database.sql`, regels 33 tot 45

**Probleem**

De schema-bundel maakt eerst `wedstrijd.seizoenen` aan en doet daarna:

```sql
create index wedstrijden_seizoen_idx on wedstrijd.wedstrijden (seizoen_id);
```

Maar `wedstrijd.wedstrijden` wordt pas daarna aangemaakt. Op een lege database faalt deze bundel dus bij regel 43 met "relation wedstrijd.wedstrijden does not exist".

Dit lijkt geen live-runtime probleem als de migraties al in Supabase staan, maar het breekt wel de afgesproken review-, herstel- en migratiebron.

**Reproductiescenario**

1. Maak een lege database.
2. Draai `review/database.sql`.
3. De uitvoering stopt voordat `wedstrijd.wedstrijden` bestaat.

**Voorstel**

Verplaats de index naar direct na de definitie van `wedstrijd.wedstrijden`, dus na regel 63. Controleer daarna een keer met een lege database of de bundel volledig doorloopt.

### 2. Karper-tiebreak lijkt `grootste vis` niet mee te wegen

**Bestand**

- `review/database.sql`, regels 1261 tot 1264 en 1274 tot 1279

**Probleem**

De karpervariant gebruikt:

```sql
rank() over (order by b.gewicht desc, b.aantal desc, b.t_grootste asc)
```

Dat verwerkt "meer vissen wint" en daarna het tijdstip van de grootste vis, maar niet het gewicht van de grootste vis zelf. Volgens het ontwerp is de karperregel: meer vissen, daarna grootste vis het eerst. De beschikbare kolom `b.grootste` wordt in deze variant niet gebruikt.

Daardoor kan een koppel met een kleinere grootste vis hoger eindigen dan een koppel met een grotere grootste vis, puur omdat die kleinere grootste vis eerder is gevangen.

**Reproductiescenario**

Dagwedstrijd met `ex_aequo = 'karper'`:

1. Koppel A: totaal 20 kg, 2 vissen, grootste 12 kg om 11:00.
2. Koppel B: totaal 20 kg, 2 vissen, grootste 10 kg om 10:00.
3. De SQL zet B boven A door `t_grootste asc`, terwijl "grootste vis" A hoort te bevoordelen.

**Voorstel**

Neem `b.grootste desc` op in de karper-ordering:

```sql
when 'karper' then rank() over (
  order by b.gewicht desc, b.aantal desc, b.grootste desc, b.t_grootste asc
)
```

Leg in `seizoensklassement-ontwerp.md` ook expliciet vast of "grootste vis het eerst" eerst op gewicht en daarna op vangsttijd betekent. De huidige implementatie gebruikt alleen de tijd.

### 3. Deelafbeelding einduitslag verliest gedeelde plaatsen

**Bestand**

- `docs/app.js`, regels 1003 tot 1010 en 1083 tot 1091

**Probleem**

De klassementstabel houdt volledige gelijke standen bij elkaar via `metRang(...)`. De canvasfunctie `tekenUitslag()` sorteert dezelfde rijen, maar tekent de plek als `i + 1`.

Daardoor kan de tabel bijvoorbeeld twee teams op plaats 1 tonen, terwijl de gedeelde afbeelding daar plaats 1 en 2 van maakt.

**Reproductiescenario**

1. Maak een afgelopen wedstrijd met twee teams met exact dezelfde totale vangst, dezelfde grootste vis en hetzelfde tiebreaktijdstip, of twee teams zonder onderscheidende tiebreak.
2. Open de klassementstabel: beide krijgen dezelfde rang.
3. Deel de einduitslag als afbeelding.
4. De afbeelding toont unieke volgnummers.

**Voorstel**

Maak een gedeelde ranking-helper voor tabel en canvas, of laat `tekenUitslag()` dezelfde `metRang`-logica gebruiken:

```js
const gerangschikt = metRangVoorTotaal(rijen);
gerangschikt.slice(0, 10).forEach(({ r, rang }) => {
  ctx.fillText(String(rang), ...);
});
```

Dan blijft de gedeelde afbeelding exact gelijk aan de zichtbare einduitslag.

### 4. `laadSeizoen()` kan stale seizoensdata in de verkeerde wedstrijd renderen

**Bestand**

- `docs/app.js`, regels 278 tot 305 en 1184 tot 1190

**Probleem**

Bij elke wedstrijdroute wordt `laadSeizoen()` asynchroon gestart. De functie controleert na de RPC niet of `CODE` nog dezelfde wedstrijd is. Als de gebruiker snel navigeert, kan een oude response later binnenkomen en `SEIZOEN` vullen voor de nieuwe route.

**Reproductiescenario**

1. Open een wedstrijd die bij een seizoen hoort.
2. Navigeer direct naar een wedstrijd zonder seizoen voordat `w_seizoen_stand` terug is.
3. De oude response kan alsnog `SEIZOEN` zetten en `renderTabs()` aanroepen.
4. De seizoen-tab of seizoeninhoud kan dan bij de verkeerde wedstrijd verschijnen.

**Voorstel**

Capture de code bij de start en negeer stale responses:

```js
async function laadSeizoen() {
  const code = CODE;
  try {
    const stand = await rpc('w_seizoen_stand', { p_code: code });
    if (CODE !== code) return;
    SEIZOEN = stand;
  } catch {
    if (CODE !== code) return;
    SEIZOEN = null;
  }
  renderTabs();
  renderSeizoen();
}
```

Overweeg hetzelfde patroon later ook voor `laadState`, maar de nieuwe seizoensroute is nu de plek waar dit zichtbaar kan worden.

## P2

### 5. Seizoensstand ververst niet mee met polling of correcties

**Bestand**

- `docs/app.js`, regels 525 tot 535 en 1184 tot 1190

**Probleem**

`laadSeizoen()` draait alleen bij het openen van een wedstrijd. De normale polling roept `laadState()` aan, maar niet opnieuw `w_seizoen_stand`.

Daardoor blijft de seizoen-tab stale als de organisator in een andere sessie een vangst corrigeert, een wedstrijd aan een seizoen koppelt, of een net afgelopen wedstrijd meetelt.

**Reproductiescenario**

1. Open de seizoen-tab.
2. Laat de organisator in een andere browser een vangst corrigeren in een gekoppelde afgelopen wedstrijd.
3. De gewone wedstrijdstate ververst, maar de seizoensstand blijft hetzelfde tot de gebruiker opnieuw navigeert of herlaadt.

**Voorstel**

Ververs seizoensdata periodiek, maar rustig:

- na `laadState(false)` alleen als `SEIZOEN` al bestaat
- of elke minuut naast de gewone poll
- altijd met de stale-response guard uit P1-4

### 6. Organisatie-poll kan open seizoen-selects opnieuw renderen

**Bestand**

- `docs/app.js`, regels 541 tot 548 en 651 tot 718

**Probleem**

De organisatieomgeving wordt elke 10 seconden opnieuw gerenderd. `renderOrg()` bewaart scherpe bevestigingen via `[data-scherp]`, maar niet de focus of open toestand van de nieuwe seizoen-selects.

Als een organisator net een seizoen of dagregel-select open heeft, kan de poll de kaart vervangen. Dat voelt alsof de keuze wegvalt.

**Reproductiescenario**

1. Log in als organisator.
2. Open een seizoen-select op een wedstrijdkaart.
3. Wacht tot de 10s poll valt.
4. De kaart kan opnieuw gerenderd worden en de open select verdwijnt.

**Voorstel**

Sla renderen over als de gebruiker in de seizoenbediening bezig is:

```js
if (document.activeElement?.closest?.('.org-seizoen')) return;
```

Of maak de org-poll slimmer: alleen data bijwerken als er geen input/select in `#view-org` focus heeft.

### 7. `wedstrijd_afgelopen` staat dubbel in `FOUTEN`

**Bestand**

- `docs/app.js`, regels 25 en 50

**Probleem**

`FOUTEN` bevat twee keer dezelfde key:

```js
wedstrijd_afgelopen: 'Deze wedstrijd is afgelopen; meldingen aanzetten kan niet meer.',
...
wedstrijd_afgelopen: 'De wedstrijd is afgelopen: registreren kan niet meer.',
```

In JavaScript wint de tweede key. De push-specifieke tekst op regel 25 wordt dus nooit gebruikt.

**Reproductiescenario**

1. Probeer meldingen aan te zetten op een afgelopen wedstrijd waar server-side `w_push_subscribe` `wedstrijd_afgelopen` teruggeeft.
2. De app kan alleen de registratiegerichte tekst tonen, niet de meldingentekst.

**Voorstel**

Gebruik aparte foutcodes, bijvoorbeeld `meldingen_gesloten` voor `w_push_subscribe`, of verwijder de eerste tekst en accepteer de generieke melding.

### 8. Ongeldige `aftrek` kan een rauwe cast-error geven

**Bestand**

- `review/database.sql`, regels 1095 tot 1108

**Probleem**

`wedstrijd.seizoen_regels_check` cast direct:

```sql
coalesce((p->>'aftrek')::int, 0)
```

Bij JSON zoals `{"aftrek":"abc"}` geeft PostgreSQL een rauwe cast-error in plaats van de bedoelde `ongeldige_regels`. Dit is alleen via het org-wachtwoord bereikbaar, maar het is wel een rafelrandje in de nieuwe API.

**Reproductiescenario**

Roep `w_org_seizoen_maak` of `w_org_seizoen_wijzig` aan met geldige org-auth en `p_regels = '{"aftrek":"abc"}'::jsonb`. De helper gooit geen nette applicatiefout.

**Voorstel**

Valideer de tekst voor het casten:

```sql
if p ? 'aftrek' and (p->>'aftrek') !~ '^[0-9]+$' then
  raise exception 'ongeldige_regels';
end if;
```

Daarna pas casten en de 0..20 check doen.

## Expliciet gecontroleerd en goedgekeurd

- `APP_VERSION` staat op 42 en `docs/version.json`, `docs/nphv/version.json` en `docs/demo/version.json` staan ook op 42.
- De NPHV- en demo-index bevatten de seizoen-tabknop, `tab-seizoen`, `seizoen-inhoud`, `seizoen-deel-rij`, `btn-deel-seizoen`, `deel-rij` en `btn-deel-uitslag`.
- Kijkers zonder seizoen houden de oude flow: de tabbalk blijft verborgen en alleen klassement plus kop/klok blijven zichtbaar.
- `SEIZOEN` wordt bij routewissel naar een wedstrijd eerst op `null` gezet, zodat de seizoen-tab niet bewust blijft hangen. De race in P1-4 gaat alleen over een later binnenkomende oude RPC-response.
- `w_seizoen_stand` telt alleen wedstrijden met `eind_ts < now()` mee.
- De publieke seizoen-API geeft geen wedstrijdcodes, kijkcodes, admin-pins of teamtokens terug.
- De schrijf-RPC's voor seizoenen gebruiken het organisatie-wachtwoord en slapen bij fout wachtwoord, conform de bestaande org-RPC's.
- De `max_plus_1`-variant gebruikt bij gedeelde Sportvisunie-plaatsen de hoogste uitgedeelde vangersplaats plus 1. Dat past bij de focusvraag voor gedeelde plaatsen.
- Aftrek houdt minimaal 1 wedstrijd geteld via `least(v_aftrek, v_aantal_w - 1)`.
- `klassementRijen()` behoudt voor de gewone klassementtabel dezelfde aggregatiebasis als voorheen: actieve vangsten per team, totaalgewicht, aantal en grootste vis.

# Nieuwe klant aanzetten

Van "ja, we doen het" naar een werkende omgeving. Eén keer volledig gerepeteerd op
een oefenslug (21 sep 2026) en daarna groen bevonden met de rooktest: tien stappen
door de echte app, inclusief loting en stekkeuze. Reken op een half uur werk.

Voorbeeld hieronder: club "Oefenclub", water "de Oefenplas", 24 stekken, 6 zones.
Vervang die vier waarden en je bent er. Wachtwoorden staan NOOIT in deze repo:
bewaar ze in Wachtwoorden.app en geef ze los door aan de klant.

## 1. Vraag de klant vier dingen

1. Naam van de vereniging (volledig) en een korte naam voor de topbalk.
2. Naam van het water.
3. Aantal stekken en aantal zones (zones mag 0 zijn: dan loot je per losse stek).
4. Eigen waterkaart digitaliseren of de standaardkaart met eigen stekken/zones?
   Standaard = fictief water, eigen kaart = meerwerk (zie prijzenblad).

## 2. Map en pagina's genereren

```bash
python3 tools/nieuwe_tenant.py --slug oefen --kort "Oefenclub" \
  --volledig "Oefenclub Testwater" --water "de Oefenplas" --stekken 24 --zones 6
```

Dit maakt `docs/oefen/` (index, config.js, sw.js, version.json, kaart.js, manifest,
iconen) en zet de club als kaartje op `/inloggen/`. `NAV_TEGELS` staat voor nieuwe
tenants meteen op `true`: nieuwe klanten beginnen met de tegelnavigatie.

Controleer daarna in de browser: titel, clubnaam, waternaam, en of de kaart stekken
tekent. Geen NPHV-resten (`grep -ri nphv docs/oefen/` mag alleen de gedeelde assets
op de root opleveren).

## 3. Klant in de database

```sql
insert into wedstrijd.klanten (slug, naam) values ('oefen', 'Oefenclub Testwater');
insert into wedstrijd.klant_instellingen (klant_id, organisator_wachtwoord)
  select id, '<eigen organisatiewachtwoord>' from wedstrijd.klanten where slug = 'oefen';
```

## 3b. Pakketlimiet zetten (hoort bij de prijsafspraak)

De prijs gaat per staffel, dus leg het afgesproken aantal deelnemers ook in de
app vast. Zonder deze regel kan de klant onbeperkt mensen laten meedoen.

```sql
update wedstrijd.klant_instellingen set max_deelnemers = 10
  where klant_id = (select id from wedstrijd.klanten where slug = 'oefen');
```

Kies: `10` bij 79 euro, `25` bij 119, `50` bij 159, bij een seizoen het aantal
dat is afgesproken. Het telt **personen**: bij een koppelwedstrijd past de helft
van dat aantal aan koppels. Laat je de kolom leeg, dan is er geen limiet (zo
staan NPHV en de demo).

De organisator ziet de grens in het formulier ("Jullie pakket: maximaal X
deelnemers") en de server weigert meer: `boven_pakket` bij het aanmaken,
`pakket_vol` bij het aanmelden.

## 4. Stekring vullen (deze wordt het vaakst vergeten)

De stekring bepaalt de loting. Zonder ring geeft elke stekkeuze `onbekende_stek`, en
de loting weigert met `te_veel_teams_voor_stekken` zodra er één deelnemer is.

```bash
python3 tools/stekring_sql.py --slug oefen
```

De ring moet exact gelijk zijn aan `STEK_POSITIE` in `docs/oefen/kaart.js`. Het script
leest die kaart, dus wijzig je later de kaart, dan opnieuw uitvoeren.

## 5. Rooktest draaien op de nieuwe omgeving

Eerst lokaal serveren (`python3 -m http.server 8642 --directory docs`), dan:

```bash
node tools/rooktest.mjs --orgww "<organisatiewachtwoord>" --basis "http://localhost:8642/oefen"
```

Tien stappen moeten groen zijn, inclusief de laatste: loting en stekkeuze. Die stap
bewijst de stekring en de kaart samen. De test maakt en verwijdert zijn eigen
wegwerpwedstrijd; blijft er na een rode run iets staan, haal die dan weg in de
organisatieomgeving.

## 6. Papier en overdracht

```bash
python3 tools/gen_instructie_a4.py --slug oefen --kort "Oefenclub"
```

Geeft het instructieblad voor de wedstrijddag met de eigen adressen erin. Verder:
`draaiboek-wedstrijddag.md` doornemen met de organisator, en het
organisatiewachtwoord los doorgeven (niet per mail samen met de link).

## 7. Live zetten

Commit en push `docs/` (GitHub Pages). Controleer daarna op de echte site:
`https://viswedstrijdapp.nl/oefen/` en het kaartje op `/inloggen/`.

## Wat er misgaat als je een stap overslaat

| Overgeslagen | Wat de klant merkt |
|---|---|
| Stekring (stap 4) | Loting weigert, stekkeuze geeft "Onbekend steknummer" |
| Klant-rij (stap 3) | Organisator kan niet inloggen, wedstrijd aanmaken mislukt |
| Rooktest (stap 5) | Je ontdekt bovenstaande pas op de wedstrijddag |
| Kaartje /inloggen/ | Klant moet de diepe link bewaren, verliest hem |
| Pakketlimiet (stap 3b) | Klant kan meer deelnemers laten meedoen dan betaald |

# Codex-review v4: bevindingen en voorstellen

Dit document hoort bij `KemblincK/Viswedstrijden/review/chatgpt-review-v4.md` en beoordeelt app v39: standaardkaart-generator, tenant-scaffold, demo-omgeving en de alleen-lezen-vlag.

## Samenvatting

De v3-PWA-problemen zijn in de tenant-workers goed verwerkt. De demo- en NPHV-workers gebruiken tenant-specifieke caches, absolute paden voor gedeelde root-assets en relatieve paden voor tenantbestanden. De demo-tenant is qua DOM, manifest, CSP en versie in lijn met de bestaande app.

De belangrijkste nieuwe risico's zitten niet in de kaart of de service worker, maar in publieke schrijfoppervlakken en tenant-scaffolding:

- de publieke demo-code kan nog push-abonnementen naar de database schrijven, ook na afloop van de wedstrijd
- nieuwe tenantnamen worden in HTML en manifest gezet zonder escaping of JSON-serialisatie
- hash-links op de root worden nog blind naar `/nphv/` gestuurd, terwijl er nu ook `/demo/` bestaat

## P0

### 1. Publieke demo-code kan onbeperkt `push_subs` blijven vullen

**Bestanden**

- `docs/demo/index.html`, regels 37 tot 45
- `docs/app.js`, regels 969 tot 1014
- `review/database.sql`, regels 971 tot 1001

**Probleem**

De demo-homepage publiceert `KIJKJE` en `DEMOJA`. Dat is bewust. Maar `w_push_subscribe` accepteert elke geldige wedstrijdcode of kijkcode zolang de wedstrijd bestaat. De functie controleert niet of de wedstrijd al is afgelopen.

Daardoor kan iedereen met de publieke kijkcode `KIJKJE` rijen schrijven naar `wedstrijd.push_subs`, ook voor de afgelopen demo-wedstrijd. De UI maakt dit zelfs normaal bereikbaar: `renderPushKnop()` toont de meldingenknop op basis van browsercapaciteit, niet op basis van `fase()`.

Dit is de enige demo-route die ik vond waarmee een vreemde zonder admin-pin of organisatie-wachtwoord nog echt database-state kan muteren. Aanmelden, stekkeuze en vangstregistratie worden server-side goed geblokkeerd, maar push-subscribe niet.

**Reproductiescenario**

1. Open `/demo/#/k/KIJKJE` in een browser met Push API-ondersteuning en klik op meldingen aan.
2. Of roep direct de RPC aan met `p_code: "KIJKJE"`, een unieke `https://...` endpoint-string en syntactisch geldige `p256dh` en `auth`.
3. Herhaal dit met steeds een andere endpoint.
4. Elke unieke endpoint wordt ingevoegd of bijgewerkt in `wedstrijd.push_subs`, ondanks dat de demo-wedstrijd voorbij is.

Het realistische gevolg is geen wedstrijdmanipulatie, maar wel database-spam en vervuiling van een publiek schrijfvlak dat op een verkoopdemo staat.

**Voorstel**

Blokkeer push-subscribe server-side voor afgelopen wedstrijden:

```sql
if now() > v_w.eind_ts then
  raise exception 'wedstrijd_afgelopen';
end if;
```

Zet deze check in `w_push_subscribe` direct na de `wedstrijd_niet_gevonden` check. Voor wedstrijden die nog moeten beginnen of live zijn, mag aanmelden voor meldingen blijven werken.

Aanvullend in `app.js`: verberg de pushknop als `fase() === 'voorbij'`, zodat de UI hetzelfde verhaal vertelt als de server.

Ruim na de fix bestaande demo-subscriptions op:

```sql
delete from wedstrijd.push_subs
where wedstrijd_id = (select id from wedstrijd.wedstrijden where kijk_code = 'KIJKJE');
```

## P1

### 2. Tenant-scaffold zet tenantnamen ongescapet in HTML en JSON

**Bestand**

- `tools/nieuwe_tenant.py`, regels 56 tot 103 en 121 tot 128

**Probleem**

`nieuwe_tenant.py` plakt `kort`, `volledig` en `water` direct in HTML en in `manifest.webmanifest`. Dat werkt voor `Demo`, maar breekt makkelijk bij normale organisatienamen met tekens als `"`, `&`, `<` of `>`.

Voorbeelden:

- `--kort 'HSV "De Plas"'` maakt ongeldige JSON in `manifest.webmanifest`
- `--volledig 'H&S Hengelsport'` levert ongescapete HTML-tekst op
- een naam met `<` of `"` kan attributen, meta descriptions of zichtbare HTML slopen

De asserts vangen alleen of de sjabloontekst is gevonden. Ze vangen niet of de gegenereerde tenant syntactisch geldige HTML en JSON heeft.

**Reproductiescenario**

1. Draai het scaffold met:

```bash
python3 tools/nieuwe_tenant.py --slug test --kort 'HSV "De Plas"' --volledig 'H&S Hengelsport'
```

2. Open `docs/test/manifest.webmanifest`.
3. De JSON is kapot door de ongescapete quote in `kort`.

**Voorstel**

Gebruik expliciete serializers per context:

- HTML tekst en attributen: `html.escape(..., quote=True)`
- manifest: lees JSON in, pas velden aan, schrijf met `json.dumps(..., ensure_ascii=False, indent=2)`
- root-kaartje en meta descriptions: escape zichtbare tekst en attribuutwaarden

Voeg daarna een post-check toe:

- `json.load()` op `manifest.webmanifest`
- eenvoudige HTML-parse of minimaal controle dat alle gegenereerde HTML-bestanden bestaan en geen ruwe `<script` uit tenant-input bevatten

### 3. Root-hashlinks gaan nog altijd blind naar `/nphv/`

**Bestanden**

- `docs/landing.js`, regels 1 tot 13
- `docs/index.html`, regels 45 tot 60

**Probleem**

In v3 was dit logisch: elke oude `#/w/...` of `#/k/...` link hoorde bij NPHV. In v39 bestaat er nu ook `/demo/`, maar `landing.js` stuurt elke root-hash nog steeds naar `/nphv/`:

```js
location.replace('/nphv/' + hash);
```

Daardoor kan een hash-only demo-link of toekomstige tenant-link in de verkeerde shell openen. De database is nog single-tenant, dus de code kan inhoudelijk wel werken, maar de gebruiker ziet dan NPHV-branding, NPHV-instructies en de NPHV-kaartomgeving.

**Reproductiescenario**

1. Open `https://viswedstrijdapp.nl/#/k/KIJKJE`.
2. De landing redirect naar `https://viswedstrijdapp.nl/nphv/#/k/KIJKJE`.
3. De demo-wedstrijd wordt in de NPHV-tenant geopend.

Voor betaalde tenants is dat precies het soort "verkeerde omgeving" dat je wilt voorkomen.

**Voorstel**

Maak expliciet dat root-hashes alleen legacy-NPHV zijn, of stop met blind redirecten zodra er meerdere publieke tenants zijn.

Praktische opties:

- houd root-hashredirect alleen voor bestaande legacy NPHV-links en documenteer dat alle nieuwe deel-links altijd tenantpad bevatten
- voeg voor publieke demo-codes een tijdelijke mapping toe, bijvoorbeeld `KIJKJE` en `DEMOJA` naar `/demo/`
- beter voor later: voer tenant-scoping in de database door, zodat een code aan een tenant gekoppeld is en de app verkeerde tenant/code-combinaties kan weigeren

Minimaal voor nu: voeg een test toe aan de releasecheck: `/#/k/KIJKJE` mag niet in de NPHV-shell landen.

## P2

### 4. `gen_standaardkaart.py` valideert `--slug` niet als hij los wordt gebruikt

**Bestand**

- `tools/gen_standaardkaart.py`, regels 200 tot 208

**Probleem**

`nieuwe_tenant.py` valideert de slug met `isalnum()` en lowercase. `gen_standaardkaart.py` doet dat niet. Als de generator rechtstreeks wordt gebruikt, wordt `args.slug` direct in een pad gezet:

```python
dest = os.path.join(os.path.dirname(__file__), '..', 'docs', args.slug, 'kaart.js')
```

Dit is geen publiek runtime-risico, maar wel een onderhoudsvalkuil. Een typefout of padachtige slug kan buiten de bedoelde tenantmap schrijven.

**Reproductiescenario**

1. Draai de generator rechtstreeks met een padachtige slug.
2. De outputlocatie wordt niet beperkt tot een nette `docs/<slug>/kaart.js`.

**Voorstel**

Deel dezelfde slugvalidatie met `nieuwe_tenant.py`, of voeg hem lokaal toe:

```python
if not args.slug.isalnum() or args.slug != args.slug.lower():
    raise SystemExit('FOUT: slug moet kleine letters/cijfers zijn')
```

Gebruik daarna `Path.resolve()` en controleer dat het resultaat onder `docs/` blijft.

### 5. Scaffold is niet transactioneel en kan halve tenantmappen achterlaten

**Bestand**

- `tools/nieuwe_tenant.py`, regels 47 tot 70 en 72 tot 130

**Probleem**

Het script maakt de doelmap al op regel 50. Daarna volgen meerdere asserts en schrijfacties. Als een latere vervanging faalt, blijft er een half aangemaakte tenantmap staan. Bij opnieuw draaien stopt het script dan meteen met `docs/<slug>/ bestaat al`.

Dat is veilig in de zin dat het luid faalt, maar onhandig bij de workflow waar dit script juist voor bedoeld is.

**Reproductiescenario**

1. Pas `docs/nphv/index.html` aan zodat een latere verwachte tekst niet meer voorkomt.
2. Draai `tools/nieuwe_tenant.py` voor een nieuwe slug.
3. Het script faalt na het aanmaken van de map.
4. De volgende run faalt op "docs/<slug>/ bestaat al", ook als de oorzaak inmiddels is gefixt.

**Voorstel**

Schrijf naar een tijdelijke map, bijvoorbeeld `docs/.<slug>.tmp`, en hernoem pas naar `docs/<slug>/` als alle stappen gelukt zijn. Bij een fout kan de tijdelijke map veilig worden opgeruimd of expliciet in de foutmelding worden genoemd.

## Expliciet gecontroleerd en goedgekeurd

- De `SHELL`-paden van `docs/nphv/sw.js` en `docs/demo/sw.js` bestaan allemaal echt. Gedeelde assets staan absoluut op de root, tenantbestanden relatief in de tenantmap.
- De cache-namen zijn tenant-specifiek: `nphv-shell-v1` en `demo-shell-v1`. Ze gebruiken niet meer het kale `shell`.
- De tenant-workers verwijderen oude caches alleen voor hun eigen prefix plus de oude root-cache `shell`. Demo wist dus geen NPHV-cache en andersom.
- `docs/demo/manifest.webmanifest` gebruikt `start_url: "./"` en `scope: "./"`, passend bij een tenant-PWA.
- `docs/demo/index.html` heeft de DOM-elementen die `docs/app.js` verwacht. De extra demo-sectie met `<a class="btn">` breekt geen eventselectors, omdat de app op specifieke ids, forms of `button[data-tab]` luistert.
- `docs/app.js` staat op `APP_VERSION = 39`; `docs/version.json`, `docs/nphv/version.json` en `docs/demo/version.json` staan ook op `39`.
- De standaardkaart voor demo bevat 40 stekken, 8 zones, `KAART_SVG`, `STEK_POSITIE`, `ZONE_STANDAARD`, `.stek`, `.stek-dot`, `#zonelaag`, `.zoneletter` en `.zoneletter-dot`. De zones dekken stekken 1 tot en met 40 zonder gaten.
- De demo-wedstrijd is server-side effectief alleen-lezen voor wedstrijdacties: `w_join` blokkeert door status `klaar`, `w_kies_stek` en `w_kies_zone` blokkeren buiten `stekkeuze`, `w_registreer_vangst` blokkeert na `eind_ts`.
- Admin-mutaties vereisen nog steeds admin-pin of organisatie-wachtwoord. De publieke demo-codes geven die niet weg.
- De alleen-lezen-guard in `w_maak_wedstrijd` staat op de juiste plek: na de wachtwoordcheck en vóór validaties en inserts. Bestaande wedstrijden blijven zoals bedoeld beheerbaar.
- De CSP's van root, demo-index en demo-instructies passen bij de huidige pagina's. De demo-instructies gebruiken `script-src 'none'`, wat goed past bij een statische instructiepagina.
- Ik heb storage-upload niet als aparte bevinding opgenomen, omdat publieke foto-bucket en ontbreken van rate limiting expliciet als bewuste beperking zijn vastgelegd. Let wel: directe storage-upload blijft niet aan `eind_ts` gekoppeld; dat is alleen acceptabel zolang die bewuste keuze blijft staan.

# Codex-review v3: bevindingen en voorstellen

Dit document hoort bij `chatgpt-review-v3.md` en beoordeelt app v35 na de verhuizing naar `https://viswedstrijdapp.nl` en de nieuwe multi-tenant structuur met `/nphv/` als eerste tenant.

## Samenvatting

De nieuwe tenant-opzet is in grote lijnen gezond. De NPHV-index laadt de gedeelde assets vanaf de root, de app registreert de service worker relatief binnen `/nphv/`, de versiecheck is tenant-relatief, de deel-links blijven onder het actuele tenantpad en de push-routes gebruiken hash-routes die binnen de tenant-scope passen.

De belangrijkste risico's zitten in de PWA-laag:

- de tenant-service-worker precachet paden die in deze bestandsstructuur niet bestaan
- de root self-destruct worker wist alle caches op het origin, dus ook tenant-caches
- oude teamlinks met `?t=TOKEN` voor de hash verliezen hun token op de landing-redirect

## P0

### 1. Tenant-worker precachet verkeerde paden en kan daardoor geen betrouwbare offline shell opbouwen

**Bestanden**

- `docs/nphv/sw.js`, regels 4 tot 9
- `docs/nphv/index.html`, regels 16 en 352
- `docs/nphv/instructies.html`, regels 10 tot 12

**Probleem**

`docs/nphv/sw.js` gebruikt `CACHE = 'shell'` en zet in `SHELL` onder andere `styles.css`, `app.js`, `icon-180.png`, `icon-192.png`, `icon-512.png` en `kemblinck-logo.png`.

Omdat deze worker onder `/nphv/` staat, worden die relatieve paden bij precache behandeld als tenant-paden, zoals `/nphv/styles.css` en `/nphv/app.js`. De tenant-index laadt dezelfde assets juist bewust vanaf de root: `/styles.css`, `/app.js`, `/icon-192.png` en `/kemblinck-logo.png`.

Daardoor kan `c.addAll(...)` falen op 404's. De `.catch(() => {})` op regel 9 slikt die fout volledig. Een enkele ontbrekende asset kan de hele precache-operatie laten mislukken, waardoor de offline app-shell niet zeker aanwezig is.

**Reproductiescenario**

1. Wis browserdata of open een schoon profiel.
2. Open `https://viswedstrijdapp.nl/nphv/`.
3. Laat de service worker installeren.
4. Zet de verbinding uit voordat er een tweede gecontroleerde online page-load is geweest.
5. Open de app opnieuw vanaf het beginscherm.

De kans is reeel dat de offline shell ontbreekt, omdat `/nphv/app.js`, `/nphv/styles.css` en root-iconen niet goed zijn gepre-cachet.

**Voorstel**

Maak de cache tenant- en versie-specifiek en precache exact de URL's die de tenant gebruikt:

```js
const CACHE = 'nphv-shell-v35';
const SHELL = [
  './',
  'index.html',
  'instructies.html',
  'kaart.js',
  'config.js',
  'manifest.webmanifest',
  '/styles.css',
  '/app.js',
  '/icon-180.png',
  '/icon-192.png',
  '/icon-512.png',
  '/kemblinck-logo.png',
];
```

Laat `version.json` live blijven, zoals nu al bedoeld is. Overweeg daarnaast om assets individueel te cachen met logging of `Promise.allSettled`, zodat een ontbrekende niet ongemerkt de hele shell onderuit haalt.

Maak de navigatiefallback ook iets robuuster:

```js
return caches.match(req, { ignoreSearch: true }).then((m) => m
  || (req.mode === 'navigate'
    ? caches.match('./').then((home) => home || caches.match('index.html'))
    : Response.error()));
```

Test dit expliciet met een schone browser, eerste installatie en daarna offline openen.

## P1

### 2. Root self-destruct worker wist ook tenant-caches

**Bestand**

- `docs/sw.js`, regels 4 tot 9

**Probleem**

De root-worker verwijdert bij activatie alle cache keys:

```js
const sleutels = await caches.keys();
await Promise.all(sleutels.map((k) => caches.delete(k)));
```

Cache Storage is per origin, niet per service-worker-scope. Een root-worker op `https://viswedstrijdapp.nl/` kan dus ook caches verwijderen die door `/nphv/sw.js` zijn aangemaakt. Omdat de tenant-worker nu ook `CACHE = 'shell'` gebruikt, is er bovendien geen duidelijke scheiding tussen oude root-cache en nieuwe tenant-cache.

**Reproductiescenario**

1. Een gebruiker heeft de nieuwe `/nphv/` PWA al geopend, waardoor de tenant-cache is opgebouwd.
2. De oude root-worker wordt daarna geactiveerd of geupdate als self-destruct worker.
3. De root-worker verwijdert alle caches op het origin.
4. De gebruiker staat later offline aan het water en verwacht dat de NPHV-app-shell beschikbaar is.

De app kan dan alsnog zonder offline shell zitten.

**Voorstel**

Combineer deze fix met bevinding 1:

- geef tenant-caches namen als `nphv-shell-v35`
- laat de root self-destruct worker alleen bekende oude root-caches verwijderen, bijvoorbeeld `shell`, of sluit tenant-prefixen expliciet uit
- verwijder bij tenant-activate alleen oudere `nphv-shell-*` caches

Voorbeeld:

```js
await Promise.all(sleutels
  .filter((k) => k === 'shell' || k.startsWith('root-'))
  .map((k) => caches.delete(k)));
```

Als `shell` de oude root-cache was, verwijder die bewust eenmalig, maar zorg dat de nieuwe tenant-cache niet dezelfde naam gebruikt.

### 3. Landing-redirect verliest teamtokens in oude linkvorm `/?t=...#/w/CODE`

**Bestanden**

- `docs/landing.js`, regels 5 en 6
- `docs/app.js`, regels 273 tot 280

**Probleem**

De landing stuurt oude wedstrijdhashes door met:

```js
location.replace('/nphv/' + location.hash);
```

Daarbij wordt `location.search` genegeerd. De app zelf haalt teamtokens juist uit de hash:

```js
const mT = location.hash.match(/[?&]t=([0-9a-f-]{36})/i);
```

Een oude teamlink in deze vorm raakt daardoor zijn token kwijt:

```text
https://viswedstrijdapp.nl/?t=TOKEN#/w/CODE
```

Na redirect wordt dit:

```text
https://viswedstrijdapp.nl/nphv/#/w/CODE
```

De deelnemer komt dan wel in de juiste wedstrijd, maar de persoonlijke teamtoken is weg.

**Reproductiescenario**

1. Open een oude teamlink met `?t=UUID` voor de hash.
2. De landing redirect naar `/nphv/`.
3. De app ziet geen `t` meer in de hash.
4. De gebruiker moet opnieuw met persoonlijke code of handmatige login verder.

**Voorstel**

Vertaal bij de landing-redirect een token uit `location.search` naar de hashvorm die `app.js` al begrijpt:

```js
function naarTenant() {
  if (/^#\/(w|k)\//.test(location.hash) || location.hash === '#/org') {
    const params = new URLSearchParams(location.search);
    const token = params.get('t');
    let hash = location.hash;
    if (token && /^#\/w\//.test(hash) && !/[?&]t=/.test(hash)) {
      hash += (hash.includes('?') ? '&' : '?') + 't=' + encodeURIComponent(token);
    }
    location.replace('/nphv/' + hash);
  }
}
```

Alternatief: laat `app.js` naast `location.hash` ook `location.search` uitlezen. De landing-fix is kleiner en houdt de token-scrub in `app.js` intact.

## P2

### 4. Instructiepagina's hebben geen eigen CSP, ondanks de review-briefing

**Bestanden**

- `docs/instructies.html`, regels 3 tot 13
- `docs/nphv/instructies.html`, regels 3 tot 13

**Probleem**

De briefing zegt dat landing, info, instructies en tenant-app elk een eigen meta-CSP hebben. `docs/index.html`, `docs/info.html` en `docs/nphv/index.html` hebben die inderdaad. De twee instructiepagina's niet.

Deze pagina's bevatten nu geen scripts, dus het is geen directe exploit. Maar het is wel hardening-drift: juist statische hulppagina's worden vaak later uitgebreid met kleine scripts, embeds of tracking. Zonder CSP valt dat minder snel op.

**Reproductiescenario**

1. Open de instructiepagina.
2. Inspecteer de `<head>`.
3. Er is geen `Content-Security-Policy` meta-tag.

**Voorstel**

Voeg een CSP toe die past bij de pagina's:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'">
```

Als later scripts nodig zijn, maak dat een bewuste wijziging.

### 5. Root-instructiepagina verwijst naar een manifest dat niet bestaat

**Bestand**

- `docs/instructies.html`, regel 9

**Probleem**

De root-instructiepagina bevat:

```html
<link rel="manifest" href="manifest.webmanifest">
```

In de huidige structuur is alleen `docs/nphv/manifest.webmanifest` aanwezig. Een root-manifest is er niet. Dit geeft een 404 en maakt het gedrag rond "installeren vanaf de root-instructiepagina" onduidelijk, terwijl de root juist geen app-installatie meer moet zijn.

**Reproductiescenario**

1. Open `https://viswedstrijdapp.nl/instructies.html`.
2. De browser vraagt `/manifest.webmanifest` op.
3. Die bestaat niet in de huidige `docs/` root.

**Voorstel**

Kies een expliciete richting:

- verwijder de manifest-link op de root-instructiepagina, omdat installatie per tenant moet gebeuren
- of maak de root-instructiepagina duidelijk alleen een routeerpagina naar tenant-instructies

De NPHV-instructiepagina mag de tenant-manifest-link houden.

### 6. Release-drift rond versie en dubbele instructies kan makkelijk terugkomen

**Bestanden**

- `docs/app.js`, regel 4
- `docs/nphv/version.json`
- `docs/instructies.html`
- `docs/nphv/instructies.html`

**Probleem**

`docs/app.js` zegt nog:

```js
const APP_VERSION = 35; // gelijk houden met docs/version.json; verhogen bij elke release
```

Maar in de nieuwe structuur hoort de live check onder `/nphv/` bij `docs/nphv/version.json`. De code werkt door de relatieve fetch op regel 267, maar de comment stuurt onderhoud de verkeerde kant op.

Daarnaast zijn root- en tenant-instructies bijna hetzelfde. Dat is verdedigbaar, maar het verhoogt het risico dat bij de volgende release maar een van de twee wordt bijgewerkt.

**Reproductiescenario**

1. Verhoog `APP_VERSION`.
2. Volg de comment en zoek naar `docs/version.json`.
3. Dat bestand bestaat niet of is niet de tenant-bron.
4. Een release kan daardoor zonder juiste tenant-versiecheck live gaan.

**Voorstel**

- update de comment naar `gelijk houden met de tenant-version.json, bijvoorbeeld docs/nphv/version.json`
- voeg een korte releasecheck toe in `review/` of de README:
  - `APP_VERSION` gelijk aan elke tenant `version.json`
  - elke tenant heeft `index.html`, `config.js`, `kaart.js`, `manifest.webmanifest`, `sw.js`, `version.json` en `instructies.html`
  - alle assets in `SHELL` bestaan echt op het pad dat de service worker cachet
  - elke statische HTML-pagina heeft bewust wel of geen CSP

## Expliciet gecontroleerd en goedgekeurd

- `docs/nphv/index.html` laadt gedeelde root-assets bewust met absolute paden, waaronder `/styles.css` en `/app.js`. Dat past bij de gedeelde app-laag.
- `docs/app.js` registreert `sw.js` relatief vanaf de tenantpagina. Onder `/nphv/` wordt dat dus `/nphv/sw.js`, met tenant-scope.
- `docs/app.js` haalt `version.json` relatief op. Onder `/nphv/` komt dit bij `docs/nphv/version.json` uit.
- Deel-links en beheer-links gebruiken `location.origin + location.pathname + '#/w/' + CODE`, waardoor links binnen `/nphv/` blijven.
- Push-subscribe stuurt routes als `#/w/CODE` of `#/k/CODE`; de tenant-worker opent die met `./` binnen de tenant-scope.
- `docs/nphv/manifest.webmanifest` heeft `start_url: "./"` en `scope: "./"`. Dat is de juiste richting voor een tenant-PWA.
- De CSP's van `docs/index.html`, `docs/info.html` en `docs/nphv/index.html` passen bij de huidige externe afhankelijkheden. Google Fonts is niet meer nodig en staat ook niet open.
- `docs/nphv/config.js` bevat alleen publieke Supabase- en VAPID-gegevens. Dat is passend voor een publieke frontend.
- De database en edge functions zijn niet opnieuw diep herbeoordeeld, omdat ze volgens de briefing ongewijzigd zijn sinds v2. De interactie met push-routes is wel gecontroleerd in de frontend en tenant-worker.
- De aparte redirect-repo's voor oude domeinen zaten niet in deze workspace. Die kan ik daarom niet inhoudelijk goedkeuren vanuit deze review. Test live minimaal: oud domein root, oud domein `#/w/CODE`, oud domein `/?t=TOKEN#/w/CODE`, oud domein `/nphv/#/w/CODE`.

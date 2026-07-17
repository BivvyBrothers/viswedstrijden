# Status Codex-review v7 (verwerkt 17 jul 2026, v53)

Bron: `codex-review-v7-bevindingen.md` (review van v48 t/m v52).
Uitkomst review: geen P0/P1; twee P2's, beide verwerkt in v53.

## 1. P2 · 3D-lightbox: toetsenbord + mislukte image-loads | VERWERKT

Alle vijf de voorstellen doorgevoerd (`docs/app.js`, beide tenant-indexen,
`docs/styles.css`):

- Sluitknop is nu een echte `<button type="button" class="sluit"
  aria-label="Sluiten">` in beide tenants, met focus-visible-stijl.
- Nieuwe helpers `openFotoGroot()`/`sluitFotoGroot()` in app.js: bij openen
  gaat de focus naar de sluitknop, bij sluiten terug naar het element dat de
  lightbox opende (als dat nog bestaat).
- Escape sluit de lightbox (document-brede keydown-handler, no-op als hij
  dicht is).
- Contextuele alt via `data-groot-alt`; de 3D-knop levert "3D-dieptekaart
  van de Plas van der Ende met stekken en zones", vangstfoto's houden de
  default "vangstfoto". De click-handler gebruikt nu `closest('[data-groot]')`
  (robuuster dan `e.target.dataset`).
- `error`-listener op de lightbox-afbeelding: bij een mislukte load sluit de
  lightbox en toont een toast ("De afbeelding kon niet geladen worden.
  Controleer je verbinding en probeer het opnieuw."). Getest in de preview
  met een niet-bestaand pad: overlay dicht + toast zichtbaar; happy path
  (open, alt, focus, Escape) eveneens getest.

**Bewuste afwijking (offline-cache):** `kaart-3d.jpg` gaat NIET alsnog in de
SHELL. De reviewer stelde dit als optie; de fetch-handler van de service
worker cachet echter ELKE succesvolle GET al runtime (network-first met
`c.put(req, kopie)`), dus na de eerste online weergave is de 3D-kaart
offline gewoon beschikbaar. Precachen zou 233 KB toevoegen aan elke
installatie, ook voor gebruikers die de knop nooit aanraken. Het
foutmelding-pad hierboven dekt het geval "offline en nog nooit bekeken".

## 2. P2 · Scaffold: `dieptekaart.jpg` in de SHELL van standaardtenants | VERWERKT

`tools/nieuwe_tenant.py`:

- De sw.js-bouwstap verwijdert `'dieptekaart.jpg'` uit de SHELL wanneer de
  tenant geen fotokaart meekrijgt (alleen bij `--kaart-van` van een bron mét
  `dieptekaart.jpg` blijft hij staan), met de gebruikelijke luide assert.
- `controleer()` bewaakt nu de consistentie driehoek kaart.js / sw-SHELL /
  bestanden: verwijst kaart.js naar `dieptekaart.jpg`, dan moet het bestand
  bestaan én in de SHELL staan; noemt de SHELL hem terwijl kaart.js hem niet
  gebruikt, dan faalt de post-check. Zelfde bewaking voor de 3D-knop
  (`data-groot="kaart-3d.jpg"` in index.html vereist het bestand).
- De 3D-knop-assert is bijgewerkt op het nieuwe `data-groot-alt`-attribuut.
- Getest met twee wegwerptenants: standaard (geen fotokaart in SHELL, geen
  3D-knop, post-checks groen) en `--kaart-van nphv` (fotokaart + 3D-knop +
  beide bestanden meegekopieerd); daarna opgeruimd.

## Goedgekeurde punten uit de review

De expliciete goedkeuringen (deelmelding-flow met textContent, geen
redirect-lus, SHELL's compleet, demo zonder fotokaart/3D, og-metadata
consistent, data-groot zonder injectiepad, v6-fixes aanwezig) vragen geen
actie. Genoteerd als bevestiging dat v48-v52 verder schoon is.

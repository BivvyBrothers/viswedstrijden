# Reviewverzoek v7 · viswedstrijdapp (v48 t/m v52, 15-18 jul 2026)

Je bent een kritische senior reviewer. Review de onderstaande wijzigingen op
bugs, security, robuustheid, consistentie en gemiste randgevallen. Meld
bevindingen als lijst met prioriteit (P0 = blocker, P1 = belangrijk, P2 =
nice-to-have), per bevinding: bestand, wat er misgaat, reproductie/scenario
en een concreet fix-voorstel. Geen stijlcommentaar zonder functioneel effect.

## Context

Statische multi-tenant PWA voor viswedstrijden, live op viswedstrijdapp.nl.
Webroot `docs/` (GitHub Pages), tenants `/nphv/` en `/demo/`, gedeelde
`app.js`/`styles.css` op de root, per tenant index/config/kaart/sw/version.
Backend: Supabase, schema `wedstrijd`, alle toegang via security-definer
RPC's (`w_*`); frontend praat via kale fetch met PostgREST. Repo is PUBLIEK.
Alle projectafspraken staan in `CLAUDE.md` in de repo-root; de actuele
serverdefinities in `review/database.sql`.

**In deze reeks (v48-v52) zijn er GEEN server-/databasewijzigingen**; alles
is client/statisch. Eerdere reviews: v2 t/m v6 volledig verwerkt (zie
`review/codex-review-v6-status.md`).

## Repo-pad

`/Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijdapp/app/`

## Wat is er veranderd (commits nieuwst eerst)

- **v52 `143f97e`**: 3D-dieptekaartweergave + startscherm-restyle.
  Knop onder de kaart-legenda in `docs/nphv/index.html` opent
  `docs/nphv/kaart-3d.jpg` via het bestaande `data-groot`-lightbox-
  mechanisme in `docs/app.js` (regel ~1867, geen JS-wijziging).
  Tenant-startschermen: hero met eyebrow + rolknoppen herbouwd als
  kaarten (`.rol-icoon`/`.rol-tekst`/`.rol-pijl`, `docs/styles.css`).
- **v51 `07afd29`**: echte sonar-dieptekaart als onderlaag in de NPHV-kaart.
  `tools/gen_kaart_js.py` zet `docs/nphv/dieptekaart.jpg` (2250x1177) als
  `<image>` in `KAART_SVG`, geclipt op de vector-oevercontour, met een
  hardcoded affine matrix (herkomst: contour-fit, IoU 0.93, tooling buiten
  de repo). Oude vector-dieptelagen (C10/C15/C18) niet meer getekend.
  `docs/nphv/sw.js`: `dieptekaart.jpg` toegevoegd aan SHELL.
- **v50 `c91a151`**: root `docs/index.html` = marketing-landingspagina
  (hero "Loot. Vis. Win.", telefoon-mockups uit `docs/schermen/`,
  privacy-blok, FAQ met details/summary); organisatie-keuze verplaatst naar
  nieuw `docs/inloggen/index.html`; `docs/info.html` = meta-refresh-redirect
  naar `/`; `docs/landing.js` ONGEWIJZIGD op de root (legacy hash-redirects:
  `#/k/KIJKJE` naar /demo/, overige naar /nphv/, met ?t=-token-migratie);
  instructiepagina's + `beginscherm-a4.html`: stap "tik op Inloggen".
- **v49 `02acd7a`**: og/twitter-meta op alle pagina's + `docs/og.png`;
  `prijzenblad-a4.html` en root in dezelfde stijl.
- **v48 `0231860`**: deel-melding na wedstrijd aanmaken: overlay
  `#deel-nieuw` (lightbox-patroon) met deelnemerscode/link/kijkcode +
  kopieerknoppen + navigator.share; state `DEEL_NIEUW` in `docs/app.js`.

## Te reviewen bestanden (in volgorde van belang)

1. `docs/app.js` | vooral: deel-nieuw-flow (zoek `DEEL_NIEUW`, `deel-nieuw`),
   het `data-groot`-lightboxmechanisme, en of de v52-markupwijziging van de
   rolknoppen nergens anders aannames breekt (zoek `.rolknop`, `rol-`).
2. `docs/nphv/index.html` + `docs/demo/index.html` | nieuwe rolknop-markup,
   3D-knop (alleen nphv), deel-nieuw-overlay, og-tags, CSP.
3. `docs/index.html` (landing), `docs/inloggen/index.html`,
   `docs/info.html` (redirect), `docs/instructies.html` + tenant-varianten.
4. `docs/landing.js` | kloppen de redirects nog met de nieuwe paginastructuur
   (root = landing, keuze op /inloggen/)? Randgevallen: hash met token,
   onbekende hash, hashchange na laden.
5. `docs/nphv/sw.js` | SHELL-wijziging: gedrag bij bestaande installaties
   (zelfde cache-naam, network-first), offline-gedrag van dieptekaart.jpg
   en de NIET-gecachte kaart-3d.jpg.
6. `tools/gen_kaart_js.py` | fotolaag-injectie (clip, matrix,
   preserveAspectRatio), dode C10/C15/C18-code, dieptelabels met halo.
7. `tools/nieuwe_tenant.py` | alle asserts synchroon met de huidige
   sjablonen? (og-tags, 3D-knop-strip, dieptekaart/kaart-3d-kopie,
   keuzeregel op /inloggen/). Wat gebeurt er bij een tenant gescaffold in
   de periode v49-v51 (tussenvormen)?
8. `docs/styles.css` | nieuwe .rol-*, .hero-*, .kaart-3d-rij, landing-CSS
   in de pagina's zelf (inline style-blokken).

## Specifieke aandachtspunten

- **Oude clients/PWA-installaties**: iPhone-gebruikers met de app op het
  beginscherm (cache v1.0-era of v47). Kan de SHELL-wijziging of de nieuwe
  kaart met foto-onderlaag hen breken? Denk aan de network-first strategie
  en `ignoreSearch: true` bij cache-match.
- **Gedeelde links**: alle og:url's absoluut en juist? og:title/description
  spiegelen title/meta-description; ergens gedivergeerd?
- **CSP per pagina**: landing heeft script-src 'self' (landing.js nodig),
  inloggen/info/instructies 'none'. Klopt dat overal met de daadwerkelijke
  inhoud (geen inline JS ergens)?
- **data-groot-mechanisme**: statische waarden in eigen markup; zie je een
  pad waarlangs dit met gebruikersinvoer te injecteren is (bijv. via
  gerenderde vangst-/teamnamen die in innerHTML belanden)?
- **Toegankelijkheid**: rolknoppen (button met spans), 3D-lightbox (geen
  focus-trap), details/summary-FAQ; alleen melden waar het functioneel
  schaadt (toetsenbord/screenreader onbruikbaar).
- **Redirect-lus**: info.html -> / en oude bookmarks op /#/... in combinatie
  met landing.js; is een lus of dode link mogelijk?
- **De demo-tenant heeft GEEN dieptekaart.jpg/kaart-3d.jpg**: klopt de
  demo-flow overal nog (standaardkaart, geen 3D-knop)?

## Output

Schrijf je bevindingen als markdown-lijst (P0/P1/P2, bestand, scenario,
fix). Patrick zet ze in `review/codex-review-v7-bevindingen.md`; daarna
verwerk ik ze en leg ik per punt verantwoording af in een status-document,
zoals bij v4/v5/v6.

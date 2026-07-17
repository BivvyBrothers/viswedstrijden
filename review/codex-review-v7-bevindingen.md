# Codex review v7 - bevindingen en voorstellen

Context: review van v48 t/m v52 op basis van `review/chatgpt-review-v7.md`.
Scope: statische/clientwijzigingen in `docs/`, `tools/nieuwe_tenant.py` en
`tools/gen_kaart_js.py`. Regelnummers zijn indicatief voor de huidige lokale
checkout.

## Samenvatting

- P0: geen blockers gevonden.
- P1: geen belangrijke regressies gevonden.
- P2: twee verbeterpunten gevonden rond de 3D-lightbox en de tenant-scaffold.
- Goedgekeurd: de v48 deelmelding gebruikt `textContent`, de root-redirects
  veroorzaken geen lus, de huidige NPHV/demo service-worker shells missen geen
  bestanden, de demo heeft geen 3D-knop of dieptekaartverwijzing, en de
  og/title/description metadata is consistent.

## Bevindingen

1. P2 - 3D-lightbox is niet robuust voor toetsenbordgebruik en offline/mislukte image-loads
   - Bestand en regels:
     - `docs/nphv/index.html:298`
     - `docs/nphv/index.html:462`
     - `docs/app.js:1867-1874`
     - `docs/styles.css:226-233`
     - `docs/nphv/sw.js:7-9`
   - Probleem:
     De nieuwe 3D-knop opent `kaart-3d.jpg` via het bestaande
     `data-groot` mechanisme. Dat mechanisme zet alleen `#foto-groot img.src`
     en toont de lightbox. De sluitknop is een niet-focusbare `<span>`, Escape
     wordt niet afgehandeld, focus wordt niet in de lightbox gezet, en het
     image-element houdt altijd `alt="vangstfoto"`, ook bij de 3D-kaart. Omdat
     `kaart-3d.jpg` bewust niet in de NPHV `SHELL` staat, krijgt een offline
     gebruiker bovendien een lege/broken image-lightbox zonder uitleg.
   - Reproductiescenario:
     1. Open `/nphv/#/w/<code>` of een NPHV-wedstrijd met toetsenbord.
     2. Tab naar "Bekijk de dieptekaart in 3D" en druk Enter.
     3. De lightbox opent, maar er is geen focusbare sluitknop en Escape doet
        niets. Tabben gaat door naar controls achter de overlay.
     4. Herhaal offline of met `kaart-3d.jpg` geblokkeerd. De overlay opent,
        maar toont alleen een kapotte afbeelding, zonder fallbacktekst.
   - Voorgestelde fix:
     Maak van de lightbox een kleine herbruikbare dialog-helper:
     - gebruik een echte `<button type="button">` als sluitknop;
     - zet focus naar de sluitknop of de dialog bij openen;
     - sluit op Escape;
     - geef de image een contextuele alt, bijvoorbeeld via
       `data-groot-alt="3D-dieptekaart van de Plas van der Ende"`;
     - voeg `img.onerror` toe met een melding zoals "De 3D-kaart is nu niet
       beschikbaar. Probeer opnieuw met internetverbinding."

     Als de 3D-kaart ook offline bruikbaar moet zijn, zet `kaart-3d.jpg` in de
     NPHV `SHELL`. Met ongeveer 233 KB is dat qua grootte beperkt. Als bewust
     on-demand laden gewenst blijft, cache hem dan na de eerste succesvolle
     online openactie of toon ten minste de foutmelding hierboven.

2. P2 - Nieuwe standaardtenants krijgen een niet-bestaande `dieptekaart.jpg` in hun service-worker shell
   - Bestand en regels:
     - `tools/nieuwe_tenant.py:119-125`
     - `tools/nieuwe_tenant.py:145-156`
     - `tools/nieuwe_tenant.py:161-170`
     - `docs/nphv/sw.js:7-9`
   - Probleem:
     `nieuwe_tenant.py` gebruikt `docs/nphv/sw.js` als sjabloon. Sinds v51
     bevat dat sjabloon `dieptekaart.jpg` in `SHELL`. Bij een gewone
     standaardtenant zonder `--kaart-van` genereert het script wel een
     standaard `kaart.js`, maar geen `dieptekaart.jpg`. De gegenereerde
     service worker probeert die ontbrekende asset alsnog te precachen. Door
     `Promise.allSettled()` faalt de installatie niet, maar elke standaardtenant
     krijgt een 404 tijdens install en het post-checkpad vangt deze mismatch
     niet af.
   - Reproductiescenario:
     1. Draai `python3 tools/nieuwe_tenant.py --slug hsvx --kort HSVX --volledig "HSV X"`.
     2. Inspecteer `docs/hsvx/sw.js`: `dieptekaart.jpg` staat in `SHELL`.
     3. Inspecteer `docs/hsvx/`: er is geen `dieptekaart.jpg`.
     4. Bij PWA-installatie probeert de service worker de ontbrekende asset te
        cachen. Dat is niet zichtbaar voor de gebruiker, maar het maskeert een
        echte shell/asset mismatch.
   - Voorgestelde fix:
     Maak de service-worker shell afhankelijk van de gegenereerde assets:
     - verwijder `dieptekaart.jpg` uit `sw.js` wanneer de doelmap geen
       `dieptekaart.jpg` krijgt;
     - behoud hem bij `--kaart-van nphv` of bij een andere bronkaart waarvan
       `kaart.js` echt `dieptekaart.jpg` gebruikt;
     - breid `controleer()` uit: als `kaart.js` `dieptekaart.jpg` bevat, moet
       het bestand bestaan en in `SHELL` staan; als `index.html`
       `data-groot="kaart-3d.jpg"` bevat, moet `kaart-3d.jpg` bestaan.

## Expliciet gecontroleerd en goedgekeurd

1. v48 deelmelding na wedstrijd aanmaken
   - `docs/app.js:473-485`: `DEEL_NIEUW` wordt gevuld na een succesvolle
     `w_maak_wedstrijd`. De naam, code, kijkcode en link worden met
     `textContent` in de overlay gezet, niet via `innerHTML`.
   - `docs/app.js:479`: de directe deelnemerslink wordt opgebouwd voordat de
     hash naar `#/w/<code>` wijzigt. Daardoor blijft de link netjes
     `/tenant/#/w/<code>`.
   - `docs/app.js:1668-1692`: sluiten, delen en kopieren lezen alleen uit
     `DEEL_NIEUW`. Bij een ontbrekende state gebeurt er niets, dus geen crash.
   - `docs/nphv/index.html:465-480` en `docs/demo/index.html:480-495`: beide
     tenants hebben de benodigde overlay-elementen.

2. `data-groot` en XSS-oppervlak
   - `docs/app.js:1867-1874`: de globale handler opent alleen de waarde van
     `data-groot` en sluit alleen bij klikken binnen `#foto-groot`.
   - `docs/app.js:1172` en `1576-1579`: dynamische foto-URL's worden via
     `esc()` in de HTML-attributen gezet.
   - `docs/nphv/index.html:298`: de nieuwe 3D-waarde is statische markup en
     bevat geen gebruikersinvoer.
   - De nieuwe deeloverlay gebruikt dezelfde `.lightbox`-laag, maar wordt niet
     geraakt door de sluitlogica van `#foto-groot`.

3. Rolknoppen en startscherm-restyle
   - `docs/app.js:385-394`: de JS selecteert nog steeds `.rolknop` en gebruikt
     `k.dataset.rol`. De extra spans in v52 breken deze aanname niet.
   - `docs/nphv/index.html:50-53` en `docs/demo/index.html:66-69`: de
     rolknoppen zijn gewone buttons, staan buiten forms en hebben nog steeds
     `data-rol`.

4. Root, inloggen en redirects
   - `docs/landing.js:8-24`: oude root-hashes `#/w/...`, `#/k/...`,
     `#/org` en `#/beheerder` worden nog naar `/nphv/` gestuurd. `#/k/KIJKJE`
     gaat naar `/demo/`. De `?t=` migratie voor teamlinks blijft behouden.
   - `docs/index.html:23`: root gebruikt `landing.js`, passend bij
     `script-src 'self'`.
   - `docs/inloggen/index.html` bevat geen script en heeft `script-src 'none'`.
   - `docs/info.html:9-10`: de oude info-pagina doet alleen meta-refresh naar
     `/` en heeft geen script. Geen redirect-lus gevonden.

5. CSP en metadata
   - Root, inloggen, instructies, NPHV en demo hebben absolute `og:url` waarden.
   - Voor de gecontroleerde pagina's zijn `<title>` en `og:title` gelijk, en
     `meta description` en `og:description` gelijk.
   - `docs/og.png` bestaat en is 1200 x 630.
   - De pagina's met scripts hebben `script-src 'self'`; statische pagina's
     zonder scripts hebben `script-src 'none'`.

6. Service workers en assets
   - `docs/nphv/sw.js`: de huidige NPHV `SHELL` verwijst naar bestaande
     bestanden, inclusief `dieptekaart.jpg`.
   - `docs/demo/sw.js`: de demo `SHELL` verwijst naar bestaande bestanden en
     bevat geen `dieptekaart.jpg`.
   - `docs/nphv/kaart.js` bevat `dieptekaart.jpg` als SVG-image. `docs/demo/kaart.js`
     bevat geen fotolaag.
   - `docs/nphv/kaart-3d.jpg`, `docs/nphv/dieptekaart.jpg` en de
     landingspagina-afbeeldingen in `docs/schermen/` bestaan lokaal.

7. Versies en v6-status
   - `docs/app.js:4`: `APP_VERSION = 52`.
   - `docs/version.json`, `docs/nphv/version.json` en `docs/demo/version.json`
     bevatten allemaal `{"v": 52}`.
   - De v6-fix voor onbekende klant-slugs is aanwezig:
     `review/database.sql:953-956` werpt `klant_niet_gevonden`, en
     `docs/app.js:28` heeft een nette fouttekst.
   - De v6-fix voor beheerder-sessiehygiene is aanwezig:
     `docs/app.js:293` wist het beheerdersscherm bij verlaten van de route en
     `docs/app.js:644-651` maakt `SU_DATA`, `SU_KLANT` en de gevoelige DOM leeg.

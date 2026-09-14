# Onafhankelijke review v82 (sessie-herstel), 14 sep 2026

Codex CLI 0.147 kon het ingestelde model niet aanroepen (upgrade vereist sudo);
daarom een Claude-subagent met schone context als onafhankelijke reviewer.
Alle zeven bevindingen zijn verwerkt vóór de release.

1. HOOG | `laatste` was origin-breed: /nphv/ en /demo/ stuurden elkaars wedstrijd door. Fix: sleutel `laatste:<tenant>`.
2. MIDDEL | `hervatLaatste()` draaide bij elke home-routering (browser-terugknop = verborgen herlaad; org-uitloggen gooide de organisator een wedstrijd in). Fix: alleen bij `route(true)` vanuit DOMContentLoaded.
3. MIDDEL | home-veld als `type=password` zou de openbare wedstrijdcode als wachtwoord bewaren en het slot van de persoonlijke code overschrijven. Fix: home-veld terug naar text; alleen `#herstel-code` als password met username per wedstrijd; bewaar-formulier op de teamkaart.
4. MIDDEL | kijklink overschreef de deelnemersessie. Fix: guard in `onthoudLaatste`.
5. MIDDEL | `toonCodeNaAanmelden()` deed niets als er een poll onderweg was. Fix: vlag `TOON_CODE_NA_RENDER`, geconsumeerd in `renderTeamTab`.
6. LAAG | ongeldige code in `laatste` gaf een leeg scherm. Fix: patrooncheck in `laatsteGeldig`.
7. LAAG | `autocapitalize` dood op een password-veld. Vervalt voor het home-veld door 3; herstelveld houdt het oogje en `.toUpperCase()`.

In orde bevonden: handtekening-check van de vangstenlijsten, service worker (network-first), verwijderde wedstrijd wist `laatste`.

Toesteltest iPhone (open, Patrick): 1) demo openen en daarna /nphv/: geen cross-over meer; 2) aanmelden, "bewaar in de wachtwoorden" tikken: komt de vraag van iOS, en vult het herstelveld daarna de code in; 3) als deelnemer de kijklink openen, app wegvegen, herstarten: deelnemersweergave.

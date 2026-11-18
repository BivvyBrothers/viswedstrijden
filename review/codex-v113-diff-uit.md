Ik vind twee aantoonbare regressies met ernst **middel**. Geen bevindingen met ernst hoog.

1. **docs/app.js, renderBeheer**
   
   Betreffende regel:
   ```js
   if (gelukt) [gewichtEl, teamEl, tijdEl].forEach((el) => { if (el.isConnected) el.dataset.orig = el.value; });
   ```
   **Ernst: middel.** Deze regel markeert de actuele veldwaarden als opgeslagen, ook als de gebruiker ze tijdens het verzoek opnieuw heeft aangepast.

   Reproduceerbaar: wijzig gewicht van 10 naar 11 en klik op opslaan. Typ tijdens het verzoek 12 in hetzelfde veld en houd de focus daar. `renderBeheer(false)` slaat de verversing dan over vanwege het actieve invoerveld. Na succesvolle opslag staat op de server 11, maar wordt `data-orig` op 12 gezet. Opnieuw opslaan meldt vervolgens ‘Niets gewijzigd’. De volgende verversing kan de correctie naar 12 wissen. Voorheen werd deze nieuwe invoer niet als opgeslagen gemarkeerd.

   **Concrete fix:** leg bij de klik de verzonden veldwaarden vast. Werk na succes uitsluitend de bijbehorende `data-orig` bij naar die vastgelegde waarden, nooit naar de dan actuele `el.value`. Laat tussentijdse wijzigingen als concept bestaan.

2. **docs/app.js, laadState**
   
   Betreffende regels:
   ```js
   if (!mijnKijker && PENDING_TOKEN) {
   ```
   en:
   ```js
   if (!storing) PENDING_TOKEN = null;
   ```
   **Ernst: middel.** Een blijvende storing bij `w_mijn_team` vertraagt nu ook alle volgende verversingen van de wedstrijdstand, zelfs wanneer `w_get_state` probleemloos werkt.

   Iedere poll haalt eerst de stand op en wacht daarna opnieuw maximaal 20 seconden op het teamherstel voordat `renderAlles` wordt uitgevoerd. Ondertussen blokkeert `STATE_BEZIG` de andere polls. Voorheen gebeurde die extra wachttijd alleen tijdens de eerste laadpoging; daarna kon de stand weer normaal verversen.

   **Concrete fix:** voer herhaalde tokenherstelpogingen buiten het blokkerende pad van de stateverversing uit, met een eigen bezetvlag en generatiecontrole. Render de opgehaalde stand direct en ververs de teamweergave zodra het herstel slaagt.
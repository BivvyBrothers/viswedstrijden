OpenAI Codex v0.154.0
--------
workdir: /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
model: gpt-6-astra
provider: openai
approval: never
sandbox: read-only
reasoning effort: medium
reasoning summaries: none
session id: 01a0c3c9-c7a8-75a2-8c23-f66d7bc5b923
--------
user
Beoordeel deze diff van een vanilla-JS webapp voor viswedstrijden (geen build, geen framework).
Fase 5 van een herontwerp: de organisatieomgeving wordt een overzicht met panelen, en vier blokken
in het beheer-tabblad worden uitklapbaar. Alles achter de per-tenant vlag NAV_TEGELS (nu alleen demo aan).

Wat je moet weten:
- De organisatieomgeving (#view-org) pollt elke 10 seconden laadOrg() -> renderOrg(); die vult lijsten
  met innerHTML. De panelen worden alleen met `hidden` getoond of verborgen.
- Alleen de organisator komt hier, na inloggen met het organisatiewachtwoord (sessionStorage 'orgww').
- Het beheer-tabblad zit BINNEN een wedstrijd en wordt ook elke 6 seconden opnieuw gerenderd.
- De app draait ook als beginscherm-app (PWA) op iPhone.

Vragen:
1. Kan de gebruiker in een toestand raken waarin hij iets niet meer kan bereiken of niet ziet dat er
   actie nodig is? Denk aan: een open paneel dat door de poll verdwijnt, een melding of fout die in een
   verborgen paneel of in een dichtgeklapt blok staat, of een formulier dat submit terwijl het verborgen is.
2. zetBeheerBlokken() draait maar één keer (BEHEER_BLOKKEN_GEZET). Kan dat misgaan als de beheer-tab pas
   later in de DOM verschijnt, bij een andere wedstrijd, of na uitloggen en opnieuw inloggen?
3. Gaat er iets stuk als de vlag UIT staat (NPHV)?
4. Toegankelijkheid: details/summary met een h2 erin, focus, en de knoppen.
Noem per bevinding bestand, wat er misgaat en de ernst (hoog/middel/laag). Wees concreet.
diff --git a/CLAUDE.md b/CLAUDE.md
index 9f920c8..e4e2102 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -695,6 +695,26 @@ dan is de app exact als v100.** Nu: demo aan, NPHV uit tot de testmatrix daar gr
 - Nog open voor NPHV: instructiepagina's en draaiboek beschrijven straks de nieuwe
   navigatie, en de schermopnamen op de landingspagina moeten dan opnieuw.
 
+## Organisatiebeheer in panelen en blokken (v104, 21 sep 2026, fase 5 van het ontwerp)
+
+Zelfde vlag als fase 4 (`NAV_TEGELS` in `config.js`): demo aan, NPHV uit. Zonder de vlag
+staat alles onder elkaar zoals in v103.
+
+- **Organisatieomgeving** (`#view-org`): je komt binnen op `#org-overzicht` met twee
+  statkaartjes (actieve wedstrijden, seizoenen) en vijf rijen: Actieve wedstrijden,
+  Nieuwe wedstrijd, Seizoenen, Vaste zone-indeling, Eerdere wedstrijden. Elke rij toont
+  één `[data-orgvak]`-sectie en zet `#org-terug` erboven. **De secties zelf zijn
+  ONGEWIJZIGD**: `toonOrgVak()` doet niets anders dan `hidden` zetten, dus alle
+  formulieren, id's en handlers blijven staan. `renderOrgOverzicht()` vult de
+  statkaartjes uit `ORG_DATA` en `ORG_SEIZOENEN`; `route()` roept `toonOrgVak(null)` aan
+  zodat je altijd op het overzicht binnenkomt.
+- **Beheer-tab binnen een wedstrijd**: Zones, Wedstrijdregels, Loting en Deelnemers zijn
+  `<details class="card beheer-blok">` geworden. `zetBeheerBlokken()` klapt ze dicht als
+  de vlag aan staat en laat ze open als de vlag uit staat (dan is het beeld gelijk aan
+  v103). Bewust NIET uitklapbaar: de kaart met naam, codes en tijden, "Na de eindtijd
+  binnengekomen" (`#b-wacht-card`, dat vraagt actie) en "Vangsten corrigeren" (dat is het
+  werk van de wedstrijddag).
+
 ## Wedstrijd als sjabloon (v67, 13 aug 2026)
 
 Knop **📋 Als sjabloon** op elke wedstrijdkaart in de organisatie-omgeving
diff --git a/docs/app.js b/docs/app.js
index f52ff49..b2e1d8d 100644
--- a/docs/app.js
+++ b/docs/app.js
@@ -1,7 +1,7 @@
 /* Viswedstrijden Plas van der Ende - app-logica */
 'use strict';
 
-const APP_VERSION = 103; // gelijk houden met ELKE tenant-version.json (docs/*/version.json); verhogen bij elke release
+const APP_VERSION = 104; // gelijk houden met ELKE tenant-version.json (docs/*/version.json); verhogen bij elke release
 
 /* ---------- helpers ---------- */
 const $ = (sel) => document.querySelector(sel);
@@ -576,6 +576,7 @@ function route(initieel) {
     CODE = null; KIJKER = false;
     $('#topcode').textContent = 'organisatie';
     toonView('org');
+    toonOrgVak(null);   // altijd op het overzicht binnenkomen (fase 5)
     laadOrg(true);
     ORG_POLL = setInterval(() => laadOrg(false), 10000);
   } else {
@@ -662,6 +663,17 @@ function tabsVanRol() {
   return lijst;
 }
 
+// Beheer-blokken: met de nieuwe indeling ingeklapt (fase 5), zonder de vlag open,
+// zodat NPHV precies ziet wat het gewend is tot de vlag daar omgaat.
+let BEHEER_BLOKKEN_GEZET = false;
+function zetBeheerBlokken() {
+  if (BEHEER_BLOKKEN_GEZET) return;
+  const blokken = document.querySelectorAll('#tab-beheer .beheer-blok');
+  if (!blokken.length) return;
+  blokken.forEach((d) => { d.open = !TEGELS(); });
+  BEHEER_BLOKKEN_GEZET = true;
+}
+
 function renderTabs() {
   // duidelijker labels (klantvraag NPHV): bij een individuele wedstrijd is
   // "Mijn team" verwarrend, daar heet de tab "Mijn deelname"
@@ -678,6 +690,7 @@ function renderTabs() {
   const balkOnder = $('#onderbalk');
   if (balkOnder) balkOnder.hidden = !TEGELS();
   renderMeer(zichtbaar);
+  zetBeheerBlokken();
   document.querySelectorAll('#tabs button').forEach((b) => {
     // 'overzicht' bestaat alleen als navigatiedoel; de knop ervoor staat onderaan
     b.hidden = b.dataset.tab === 'overzicht' || !zichtbaar.includes(b.dataset.tab);
@@ -1053,6 +1066,31 @@ async function laadOrg(eerste) {
   }
 }
 
+// Organisatieomgeving als overzicht met panelen (v104, fase 5 van het ontwerp).
+// De onderdelen zelf zijn ONGEWIJZIGD: dit toont er één tegelijk en zet een
+// terugknop erboven. Zonder NAV_TEGELS staat alles onder elkaar zoals voorheen.
+let ORG_VAK = null;
+function toonOrgVak(sleutel) {
+  ORG_VAK = sleutel;
+  const aan = TEGELS();
+  const overzicht = $('#org-overzicht');
+  if (overzicht) overzicht.hidden = !aan || !!sleutel;
+  const terug = $('#org-terug');
+  if (terug) terug.hidden = !aan || !sleutel;
+  document.querySelectorAll('#view-org [data-orgvak]').forEach((el) => {
+    el.hidden = aan ? (el.dataset.orgvak !== sleutel) : false;
+  });
+  if (aan) window.scrollTo({ top: 0, behavior: 'smooth' });
+}
+function renderOrgOverzicht() {
+  if (!TEGELS()) return;
+  const nuMs = new Date(ORG_DATA?.server_now || Date.now()).getTime();
+  const alle = ORG_DATA?.wedstrijden || [];
+  const actief = alle.filter((w) => new Date(w.eind_ts).getTime() >= nuMs).length;
+  const w = $('#org-stat-wedstrijden'); if (w) w.textContent = actief;
+  const z = $('#org-stat-seizoenen'); if (z) z.textContent = (ORG_SEIZOENEN || []).length;
+}
+
 /* ---------- seizoenenbeheer (organisatie) ---------- */
 let ORG_SEIZOENEN = null;      // lijst uit w_org_seizoenen
 let SEIZOEN_PER_CODE = {};     // wedstrijdcode -> { id, naam, ex }
@@ -1066,6 +1104,7 @@ async function laadOrgSeizoenen() {
     }
     renderOrgSeizoenen();
     renderOrg();
+    renderOrgOverzicht();
   } catch { /* seizoenen zijn optioneel; stil falen */ }
 }
 
@@ -1528,6 +1567,8 @@ function renderOrg() {
     ? voorbij.map((w) => orgWedstrijdKaart(w, nuMs)).join('')
     : '<p class="muted">Nog geen afgeronde wedstrijden.</p>';
 
+  renderOrgOverzicht();
+
   const orgPinVan = (code) => (ORG_DATA?.wedstrijden || []).find((w) => w.code === code)?.admin_pin || null;
   document.querySelectorAll('[data-org-open]').forEach((b) => {
     b.onclick = () => {
@@ -2867,6 +2908,13 @@ function initWedstrijd() {
     activateTab(doel);
     if (doel === 'overzicht') window.scrollTo({ top: 0, behavior: 'smooth' });
   };
+  // organisatieomgeving: rijen openen een onderdeel, de knop erboven gaat terug
+  document.addEventListener('click', (e) => {
+    const rij = e.target.closest('#org-overzicht [data-orgnaar]');
+    if (rij) { toonOrgVak(rij.dataset.orgnaar); return; }
+    if (e.target.closest('#org-terug')) toonOrgVak(null);
+  });
+
   // bewust begrensd tot de nieuwe navigatie-onderdelen, zodat deze handler nooit
   // een bestaande knop elders kan kapen (Codex fase 4)
   document.addEventListener('click', (e) => {
diff --git a/docs/demo/index.html b/docs/demo/index.html
index 31e20dd..0c1c976 100644
--- a/docs/demo/index.html
+++ b/docs/demo/index.html
@@ -131,12 +131,33 @@
     <p class="muted klein">Deel per wedstrijd de <b>deelnemerscode</b> met de vissers en de <b>kijkcode</b> met iedereen die mag meekijken.</p>
   </section>
 
-  <section class="card">
+  <!-- Organisatieoverzicht (v104, fase 5 van het ontwerp; alleen met NAV_TEGELS).
+       De onderdelen hieronder blijven ONGEWIJZIGD staan, ze worden alleen een voor
+       een getoond. Zonder de vlag blijft deze kaart verborgen en staat alles onder
+       elkaar zoals voorheen. -->
+  <section class="card org-overzicht" id="org-overzicht" hidden>
+    <div class="org-stats">
+      <div class="org-stat"><b id="org-stat-wedstrijden">0</b><span>actieve wedstrijden</span></div>
+      <div class="org-stat"><b id="org-stat-seizoenen">0</b><span>seizoenen</span></div>
+    </div>
+    <div class="org-rijen">
+      <button class="org-rij" data-orgnaar="actief"><span><b>Actieve wedstrijden</b><small>wat er nu loopt, met codes en beheer</small></span><span class="pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="org-rij" data-orgnaar="nieuw"><span><b>Nieuwe wedstrijd</b><small>een wedstrijd aanmaken en delen</small></span><span class="pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="org-rij" data-orgnaar="seizoen"><span><b>Seizoenen (competitie)</b><small>doorlopend klassement over meerdere dagen</small></span><span class="pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="org-rij" data-orgnaar="zones"><span><b>Vaste zone-indeling</b><small>de standaardzones van jullie water</small></span><span class="pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="org-rij" data-orgnaar="eerder"><span><b>Eerdere wedstrijden</b><small>afgelopen wedstrijden terugkijken</small></span><span class="pijl" aria-hidden="true">&rsaquo;</span></button>
+    </div>
+  </section>
+
+  <button class="btn licht org-terug" id="org-terug" hidden>&lsaquo; Terug naar het overzicht</button>
+
+
+  <section class="card" data-orgvak="actief">
     <h2>Actieve wedstrijden</h2>
     <div id="org-actief"></div>
   </section>
 
-  <section class="card">
+  <section class="card" data-orgvak="nieuw">
     <h2>Nieuwe wedstrijd</h2>
     <p id="nw-sjabloon" class="sjabloon-hint" hidden></p>
     <form id="form-nieuw" class="stack">
@@ -171,7 +192,7 @@
     </form>
   </section>
 
-  <section class="card">
+  <section class="card" data-orgvak="seizoen">
     <h2>Seizoenen (competitie)</h2>
     <p class="muted klein">Een seizoen telt de uitslagen van meerdere wedstrijden op tot een
     doorlopend klassement (regels naar de Sportvisunie-reglementen, per seizoen instelbaar).
@@ -216,7 +237,7 @@
     </form>
   </section>
 
-  <section class="card" id="org-zones-card">
+  <section class="card" data-orgvak="zones" id="org-zones-card">
     <h2>Vaste zone-indeling van de plas</h2>
     <p class="muted klein">Deze indeling geldt automatisch voor elke nieuwe wedstrijd.
     Eén regel per zone, formaat <b>Naam: steknummers</b>, bijv. <b>Zone A: 20-30</b> of <b>B: 55</b>
@@ -227,7 +248,7 @@
     <p id="org-zones-ok" class="ok" hidden></p>
   </section>
 
-  <section class="card">
+  <section class="card" data-orgvak="eerder">
     <h2>Eerdere wedstrijden</h2>
     <div id="org-verleden"></div>
   </section>
@@ -524,8 +545,8 @@
         <button id="b-tijden" class="btn">Tijden opslaan</button>
         <p id="b-fout" class="fout" hidden></p>
       </div>
-      <div class="card">
-        <h2>Zones <span class="muted">(optioneel)</span></h2>
+      <details class="card beheer-blok">
+        <summary><h2>Zones <span class="muted">(optioneel)</span></h2></summary>
         <p class="muted klein">Nieuwe wedstrijden krijgen automatisch de vaste zone-indeling van de plas
         (te beheren op de homepagina, achter het organisatie-wachtwoord). Pas hieronder alleen aan als deze
         wedstrijd afwijkt, bijv. een zone die dicht is. Formaat: <b>Naam: steknummers</b>, 1 regel per zone.
@@ -534,26 +555,26 @@
         <button id="b-zones-opslaan" class="btn">Zones opslaan</button>
         <p id="b-zones-fout" class="fout" hidden></p>
         <p id="b-zones-ok" class="ok" hidden></p>
-      </div>
-      <div class="card">
-        <h2>Wedstrijdregels</h2>
+      </details>
+      <details class="card beheer-blok">
+        <summary><h2>Wedstrijdregels</h2></summary>
         <p class="muted klein">Deelnemers en kijkers zien dit als uitklapbaar blok onder de klok. Leeg = geen regels-blok.</p>
         <textarea id="b-regels" rows="5" maxlength="3000" placeholder="bijv. Maximaal 2 hengels per visser"></textarea>
         <button id="b-regels-opslaan" class="btn">Regels opslaan</button>
         <p id="b-regels-ok" class="ok" hidden></p>
-      </div>
-      <div class="card">
-        <h2>Loting</h2>
+      </details>
+      <details class="card beheer-blok">
+        <summary><h2>Loting</h2></summary>
         <p class="muted">Start de loting als alle deelnemers aangemeld zijn. De site bepaalt willekeurig de volgorde; daarna kiest iedereen op zijn beurt een stek op de kaart.</p>
         <div class="row">
           <button id="b-loting" class="btn primary">🎲 Start loting</button>
           <button id="b-reset" class="btn gevaar">Reset loting</button>
         </div>
-      </div>
-      <div class="card">
-        <h2>Deelnemers</h2>
+      </details>
+      <details class="card beheer-blok">
+        <summary><h2>Deelnemers</h2></summary>
         <div id="b-teams"></div>
-      </div>
+      </details>
       <div class="card" id="b-wacht-card" hidden>
         <h2>Na de eindtijd binnengekomen</h2>
         <p class="muted klein">Deze vangsten zijn tijdens de wedstrijd ingevoerd maar konden
diff --git a/docs/demo/version.json b/docs/demo/version.json
index 6b3933e..b4459bd 100644
--- a/docs/demo/version.json
+++ b/docs/demo/version.json
@@ -1 +1 @@
-{"v": 103}
+{"v": 104}
diff --git a/docs/nphv/index.html b/docs/nphv/index.html
index ee22a63..ee1246d 100644
--- a/docs/nphv/index.html
+++ b/docs/nphv/index.html
@@ -114,12 +114,33 @@
     <p class="muted klein">Deel per wedstrijd de <b>deelnemerscode</b> met de vissers en de <b>kijkcode</b> met iedereen die mag meekijken.</p>
   </section>
 
-  <section class="card">
+  <!-- Organisatieoverzicht (v104, fase 5 van het ontwerp; alleen met NAV_TEGELS).
+       De onderdelen hieronder blijven ONGEWIJZIGD staan, ze worden alleen een voor
+       een getoond. Zonder de vlag blijft deze kaart verborgen en staat alles onder
+       elkaar zoals voorheen. -->
+  <section class="card org-overzicht" id="org-overzicht" hidden>
+    <div class="org-stats">
+      <div class="org-stat"><b id="org-stat-wedstrijden">0</b><span>actieve wedstrijden</span></div>
+      <div class="org-stat"><b id="org-stat-seizoenen">0</b><span>seizoenen</span></div>
+    </div>
+    <div class="org-rijen">
+      <button class="org-rij" data-orgnaar="actief"><span><b>Actieve wedstrijden</b><small>wat er nu loopt, met codes en beheer</small></span><span class="pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="org-rij" data-orgnaar="nieuw"><span><b>Nieuwe wedstrijd</b><small>een wedstrijd aanmaken en delen</small></span><span class="pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="org-rij" data-orgnaar="seizoen"><span><b>Seizoenen (competitie)</b><small>doorlopend klassement over meerdere dagen</small></span><span class="pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="org-rij" data-orgnaar="zones"><span><b>Vaste zone-indeling</b><small>de standaardzones van jullie water</small></span><span class="pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="org-rij" data-orgnaar="eerder"><span><b>Eerdere wedstrijden</b><small>afgelopen wedstrijden terugkijken</small></span><span class="pijl" aria-hidden="true">&rsaquo;</span></button>
+    </div>
+  </section>
+
+  <button class="btn licht org-terug" id="org-terug" hidden>&lsaquo; Terug naar het overzicht</button>
+
+
+  <section class="card" data-orgvak="actief">
     <h2>Actieve wedstrijden</h2>
     <div id="org-actief"></div>
   </section>
 
-  <section class="card">
+  <section class="card" data-orgvak="nieuw">
     <h2>Nieuwe wedstrijd</h2>
     <p id="nw-sjabloon" class="sjabloon-hint" hidden></p>
     <form id="form-nieuw" class="stack">
@@ -154,7 +175,7 @@
     </form>
   </section>
 
-  <section class="card">
+  <section class="card" data-orgvak="seizoen">
     <h2>Seizoenen (competitie)</h2>
     <p class="muted klein">Een seizoen telt de uitslagen van meerdere wedstrijden op tot een
     doorlopend klassement (regels naar de Sportvisunie-reglementen, per seizoen instelbaar).
@@ -199,7 +220,7 @@
     </form>
   </section>
 
-  <section class="card" id="org-zones-card">
+  <section class="card" data-orgvak="zones" id="org-zones-card">
     <h2>Vaste zone-indeling van de plas</h2>
     <p class="muted klein">Deze indeling geldt automatisch voor elke nieuwe wedstrijd.
     Eén regel per zone, formaat <b>Naam: steknummers</b>, bijv. <b>Zone A: 20-30</b> of <b>B: 55</b>
@@ -210,7 +231,7 @@
     <p id="org-zones-ok" class="ok" hidden></p>
   </section>
 
-  <section class="card">
+  <section class="card" data-orgvak="eerder">
     <h2>Eerdere wedstrijden</h2>
     <div id="org-verleden"></div>
   </section>
@@ -508,8 +529,8 @@
         <button id="b-tijden" class="btn">Tijden opslaan</button>
         <p id="b-fout" class="fout" hidden></p>
       </div>
-      <div class="card">
-        <h2>Zones <span class="muted">(optioneel)</span></h2>
+      <details class="card beheer-blok">
+        <summary><h2>Zones <span class="muted">(optioneel)</span></h2></summary>
         <p class="muted klein">Nieuwe wedstrijden krijgen automatisch de vaste zone-indeling van de plas
         (te beheren op de homepagina, achter het organisatie-wachtwoord). Pas hieronder alleen aan als deze
         wedstrijd afwijkt, bijv. een zone die dicht is. Formaat: <b>Naam: steknummers</b>, 1 regel per zone.
@@ -518,26 +539,26 @@
         <button id="b-zones-opslaan" class="btn">Zones opslaan</button>
         <p id="b-zones-fout" class="fout" hidden></p>
         <p id="b-zones-ok" class="ok" hidden></p>
-      </div>
-      <div class="card">
-        <h2>Wedstrijdregels</h2>
+      </details>
+      <details class="card beheer-blok">
+        <summary><h2>Wedstrijdregels</h2></summary>
         <p class="muted klein">Deelnemers en kijkers zien dit als uitklapbaar blok onder de klok. Leeg = geen regels-blok.</p>
         <textarea id="b-regels" rows="5" maxlength="3000" placeholder="bijv. Maximaal 2 hengels per visser"></textarea>
         <button id="b-regels-opslaan" class="btn">Regels opslaan</button>
         <p id="b-regels-ok" class="ok" hidden></p>
-      </div>
-      <div class="card">
-        <h2>Loting</h2>
+      </details>
+      <details class="card beheer-blok">
+        <summary><h2>Loting</h2></summary>
         <p class="muted">Start de loting als alle deelnemers aangemeld zijn. De site bepaalt willekeurig de volgorde; daarna kiest iedereen op zijn beurt een stek op de kaart.</p>
         <div class="row">
           <button id="b-loting" class="btn primary">🎲 Start loting</button>
           <button id="b-reset" class="btn gevaar">Reset loting</button>
         </div>
-      </div>
-      <div class="card">
-        <h2>Deelnemers</h2>
+      </details>
+      <details class="card beheer-blok">
+        <summary><h2>Deelnemers</h2></summary>
         <div id="b-teams"></div>
-      </div>
+      </details>
       <div class="card" id="b-wacht-card" hidden>
         <h2>Na de eindtijd binnengekomen</h2>
         <p class="muted klein">Deze vangsten zijn tijdens de wedstrijd ingevoerd maar konden
diff --git a/docs/nphv/version.json b/docs/nphv/version.json
index 6b3933e..b4459bd 100644
--- a/docs/nphv/version.json
+++ b/docs/nphv/version.json
@@ -1 +1 @@
-{"v": 103}
+{"v": 104}
diff --git a/docs/styles.css b/docs/styles.css
index 8ec58ee..091c2b0 100644
--- a/docs/styles.css
+++ b/docs/styles.css
@@ -680,3 +680,39 @@ body.meer-open { overflow: hidden; }
   .meer-inhoud { max-width: 560px; margin: 0 auto; border-radius: 18px; margin-bottom: 30px; }
   .meer-paneel { align-items: center; }
 }
+
+
+/* ---- Organisatieoverzicht (v104, fase 5): alleen met body.nav-tegels ---- */
+.org-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
+.org-stat {
+  background: #f1eedd; border: 1px solid var(--kaart-rand); border-radius: 14px;
+  padding: 12px 14px;
+}
+.org-stat b { display: block; font-size: 26px; font-weight: 800; color: var(--groen-donker); line-height: 1.1; }
+.org-stat span { display: block; font-size: 12.5px; color: var(--grijs); margin-top: 2px; }
+.org-rijen { display: grid; gap: 8px; }
+.org-rij {
+  width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px;
+  background: #f1eedd; border: 1px solid var(--kaart-rand); border-radius: 12px;
+  padding: 13px 15px; font: inherit; text-align: left; cursor: pointer; min-height: 52px;
+}
+.org-rij:active { background: #e7e3cf; }
+.org-rij b { display: block; font-weight: 700; color: var(--groen-donker); }
+.org-rij small { display: block; font-size: 12.5px; color: var(--grijs); margin-top: 1px; }
+.org-rij .pijl { color: var(--olijf); font-size: 20px; font-weight: 700; }
+.org-terug { margin-bottom: 12px; }
+
+
+/* ---- Beheer in blokken (v104, fase 5) ---- */
+.beheer-blok > summary {
+  cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px;
+  min-height: 48px; margin: -4px 0;
+}
+.beheer-blok > summary::-webkit-details-marker { display: none; }
+.beheer-blok > summary::before {
+  content: '\203a'; font-size: 22px; font-weight: 700; color: var(--olijf);
+  transition: transform .15s ease; line-height: 1;
+}
+.beheer-blok[open] > summary::before { transform: rotate(90deg); }
+.beheer-blok > summary h2 { margin: 0; }
+.beheer-blok[open] > summary { margin-bottom: 10px; }
=== CONTEXT: laadOrg/renderOrg ===
  if (!knop) return;
  // niet zweven waar het formulier al staat (team-tab) of waar de vaste
  // doorgeef-knop staat (vangsten-tab)
  const opTeamTab = !$('#tab-team')?.hidden;
  knop.hidden = !(ROL === 'deelnemer' && fase() === 'live'
    && !!sessie.team(CODE) && !opTeamTab);
}

/* ---------- organisatie-omgeving ---------- */
let ORG_DATA = null;

let ORG_BEZIG = false;

async function laadOrg(eerste) {
  if (ORG_BEZIG && !eerste) return;
  ORG_BEZIG = true;
  const mijnGen = SESSIE_GEN;
  try {
    const res = await rpc('w_org_wedstrijden', { p_wachtwoord: sessie.orgWw() || '', p_klant: KLANT() });
    if (mijnGen !== SESSIE_GEN) return;   // uitgelogd of ander scherm: niets vullen
    if (!res) { sessionStorage.removeItem('orgww'); location.hash = ''; return; }
    ORG_DATA = res;
    renderOrg();
    if (eerste) laadOrgSeizoenen();

codex
Ik controleer de diff tegen de aanwezige code, vooral de bestaande handlers, meldingen en DOM-verversing. Daarbij maak ik onderscheid tussen aantoonbare fouten en punten die op iPhone met VoiceOver getest moeten worden.

exec
/bin/zsh -lc "rg -n 'Viswedstrijd|v21|security' /Users/kemble/.codex/memories/MEMORY.md" in /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
 succeeded in 0ms:
1:# Task Group: Viswedstrijdapp visual design and Claude asset handoff
3:scope: Create or hand off approved visual assets for Viswedstrijdapp; keep visual art direction separate from Claude's later technical implementation.
4:applies_to: cwd=/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp; reuse_rule=reuse the handoff and documentation workflow for this project, but verify the current CloudStorage path and asset provenance before editing.
23:- Claude handoff folder: `/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/ontwerp/van-chatgpt/2026-09-19-definitieve-briefing/`. The verified clean 16:9 asset is `07-zonsondergang-schoon-16x9.png`; its briefing, file index, and start page were updated. [Task 1]
308:# Task Group: Viswedstrijden code-review and Claude handoff
310:scope: Review the Viswedstrijden webapp or prepare a concrete Dutch Markdown review for Claude Code; includes earlier validated findings and a boundary for the unfinished v21 review.
311:applies_to: cwd=/Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijden; reuse_rule=revalidate effective final SQL definitions, frontend, and edge functions before treating any finding as current.
317:- rollout_summaries/2026-07-06T10-06-28-HpZQ-viswedstrijden_code_review_en_v21_vervolg.md (cwd=/Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork, rollout_path=/Users/kemble/.codex/sessions/2026/07/06/rollout-2026-07-06T12-06-28-019f36e4-bebc-70c3-8669-bddfceb5a4a6.jsonl, updated_at=2026-09-18T20:56:34+00:00, thread_id=019f36e4-bebc-70c3-8669-bddfceb5a4a6, success)
321:- Viswedstrijden, codex-review-voor-claude.md, codex-review-v1.md, review/, P0/P1/P2, SECURITY DEFINER, RLS, database.sql, app.js, push-vangst.ts, geen em-dashes
323:## Task 2: Resume the v21 security and robustness review, incomplete
327:- rollout_summaries/2026-07-06T10-06-28-HpZQ-viswedstrijden_code_review_en_v21_vervolg.md (cwd=/Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork, rollout_path=/Users/kemble/.codex/sessions/2026/07/06/rollout-2026-07-06T12-06-28-019f36e4-bebc-70c3-8669-bddfceb5a4a6.jsonl, updated_at=2026-09-18T20:56:34+00:00, thread_id=019f36e4-bebc-70c3-8669-bddfceb5a4a6, partial)
331:- chatgpt-review-v2.md, v21-review, create or replace, w_login_deelnemer, w_admin_kies, w_admin_voeg_vangst, w_admin_wedstrijd, w_org_verwijder_wedstrijd, wis-fotos.ts, sw.js, CSP
342:- `database.sql` can contain earlier RPCs followed by later `create or replace` definitions: assess the final effective definitions. The v21 context adds personal participant codes, idempotent catch registration, offline service worker, CSP, fixed zone map, and `wis-fotos`; changelog claims require code verification. [Task 2]
347:- The v21 review was not completed in the available rollout. Do not claim a v21 result until `review/database.sql`, `docs/app.js`, `docs/index.html`, `docs/sw.js`, `docs/config.js`, `review/push-vangst.ts`, and `review/wis-fotos.ts` have been assessed. [Task 2]

exec
/bin/zsh -lc "pwd; rg -n 'toonOrgVak|zetBeheerBlokken|function renderOrg|function renderBeheer|org-zones-card|sjabloon|form-nieuw|org-fout|BEHEER_BLOKKEN' docs/app.js; rg -n '\\[hidden\\]|focus|summary' docs/styles.css" in /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
 succeeded in 0ms:
/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
579:    toonOrgVak(null);   // altijd op het overzicht binnenkomen (fase 5)
668:let BEHEER_BLOKKEN_GEZET = false;
669:function zetBeheerBlokken() {
670:  if (BEHEER_BLOKKEN_GEZET) return;
674:  BEHEER_BLOKKEN_GEZET = true;
693:  zetBeheerBlokken();
713:// standaard: morgen 08:00 tot 17:00; ook gebruikt als het sjabloon wordt gewist
772:    const foutEl = $('#org-fout'); foutEl.hidden = true;
814:  $('#form-nieuw').addEventListener('submit', async (e) => {
842:      // sjabloon: hetzelfde seizoen en dezelfde dagregel meekoppelen. Mislukt dat,
1073:function toonOrgVak(sleutel) {
1085:function renderOrgOverzicht() {
1118:function renderOrgSeizoenen() {
1490:      <button class="btn" data-org-sjabloon="${esc(w.code)}" title="Vul het formulier 'Nieuwe wedstrijd' met de instellingen van deze wedstrijd">\ud83d\udccb Als sjabloon</button>
1496:// Een wedstrijd als sjabloon gebruiken: type, maximum, regels, duur, seizoen en
1526:  ($('#form-nieuw').closest('section') || $('#form-nieuw'))
1532:// de organisator moet zien dat hier gekopieerde waarden staan: een sjabloon dat
1535:  const el = $('#nw-sjabloon');
1542:    <button type="button" class="btn klein-btn" id="nw-sjabloon-wis">leegmaken</button>`;
1544:  $('#nw-sjabloon-wis').onclick = () => {
1553:function renderOrg() {
1592:  document.querySelectorAll('[data-org-sjabloon]').forEach((b) => {
2914:    if (rij) { toonOrgVak(rij.dataset.orgnaar); return; }
2915:    if (e.target.closest('#org-terug')) toonOrgVak(null);
3825:async function renderBeheer(magPrefill) {
18:  --blauw-mid: #6d7355;      /* olijf (accenten, focus) */
116:input:focus, select:focus { outline: 2px solid var(--blauw-mid); border-color: var(--blauw-mid); }
118:label[hidden] { display: none; }
251:#b-toevoegen summary { cursor: pointer; font-weight: 700; color: var(--blauw-donker); padding: 4px 0; }
279:.lightbox[hidden] { display: none; }
283:.lightbox .sluit:focus-visible { outline: 2px solid #fff; border-radius: 8px; }
328:textarea:focus { outline: 2px solid var(--blauw-mid); border-color: var(--blauw-mid); }
335:.toast[hidden] { display: none; }
398:.snel-vangst[hidden] { display: none; }
474:.update-banner[hidden] { display: none; }
476:.regels-card summary {
488:.terug-knop[hidden] { display: none; }
639:.onderbalk[hidden], .meer-paneel[hidden] { display: none; }
707:.beheer-blok > summary {
711:.beheer-blok > summary::-webkit-details-marker { display: none; }
712:.beheer-blok > summary::before {
716:.beheer-blok[open] > summary::before { transform: rotate(90deg); }
717:.beheer-blok > summary h2 { margin: 0; }
718:.beheer-blok[open] > summary { margin-bottom: 10px; }

exec
/bin/zsh -lc "sed -n '760,880p' docs/app.js; sed -n '1038,1145p' docs/app.js; sed -n '1496,1645p' docs/app.js; sed -n '3825,3970p' docs/app.js; rg -n 'b-zones|b-regels|b-loting|org-zones|innerHTML =|initWedstrijd\\(' docs/app.js" in /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
 succeeded in 0ms:
      // en mag niet doorvallen naar "dan is het wel een wedstrijdcode"
      toast(foutTekst(new Error('geen_verbinding'))); return;
    }
    location.hash = '#/w/' + code;
  });
  $('#form-kijker').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#kijker-code').value.trim().toUpperCase();
    if (code) location.hash = '#/k/' + code;
  });
  $('#form-orglogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const foutEl = $('#org-fout'); foutEl.hidden = true;
    const ww = $('#org-ww').value.trim();
    try {
      const check = await rpc('w_org_check', { p_wachtwoord: ww, p_klant: KLANT() });
      sessie.zetOrgWw(ww);
      if ($('#org-zones').value.trim() === '') {
        $('#org-zones').value = zonesNaarTekst(check.standaard_zones);
      }
      location.hash = '#/org';
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });

  $('#org-uitloggen').addEventListener('click', () => {
    sessionStorage.removeItem('orgww');
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const sleutel = sessionStorage.key(i);
      if (sleutel && sleutel.startsWith('pin:')) sessionStorage.removeItem(sleutel);
    }
    ADMIN_OPEN = false;
    ROL = 'deelnemer';
    wisOrgScherm();
    location.hash = '';
  });

  $('#org-zones-opslaan').addEventListener('click', async () => {
    const foutEl = $('#org-zones-fout'), okEl = $('#org-zones-ok');
    foutEl.hidden = true; okEl.hidden = true;
    let geparsed;
    try { geparsed = parseZones($('#org-zones').value); }
    catch (err) { foutEl.textContent = err.message; foutEl.hidden = false; return; }
    try {
      const res = await rpc('w_org_standaard_zones', { p_wachtwoord: sessie.orgWw() || '', p_zones: geparsed.zones, p_klant: KLANT() });
      okEl.textContent = res.zones === 0
        ? 'Vaste indeling gewist: nieuwe wedstrijden loten per losse stek.'
        : `Vaste indeling opgeslagen: ${zonesPreview(geparsed)}. Elke nieuwe wedstrijd gebruikt deze automatisch.`;
      okEl.hidden = false;
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });

  // vaste client_id per invoer: dubbel tikken of een retry na een verloren
  // antwoord maakt geen tweede wedstrijd meer (Codex v10)
  let NIEUW_POGING = null;
  $('#form-nieuw').addEventListener('submit', async (e) => {
    e.preventDefault();
    const foutEl = $('#nieuw-fout'); foutEl.hidden = true;
    const knop = e.target.querySelector('button[type="submit"]');
    if (knop.disabled) return;
    const pogingKey = [$('#nw-naam').value.trim(), $('#nw-mode').value,
                       startVeld.value, eindVeld.value].join('|');
    if (!NIEUW_POGING || NIEUW_POGING.key !== pogingKey) {
      NIEUW_POGING = { key: pogingKey, id: crypto.randomUUID() };
    }
    knop.disabled = true;
    const oudeTekst = knop.textContent;
    knop.textContent = 'Bezig…';
    try {
      const res = await rpc('w_maak_wedstrijd', {
        p_naam: $('#nw-naam').value.trim(),
        p_mode: $('#nw-mode').value,
        p_start: new Date(startVeld.value).toISOString(),
        p_eind: new Date(eindVeld.value).toISOString(),
        p_org_wachtwoord: sessie.orgWw() || '',
        p_max_teams: $('#nw-max').value ? parseInt($('#nw-max').value, 10) : null,
        p_regels: $('#nw-regels').value.trim() || null,
        p_klant: typeof TENANT !== 'undefined' ? TENANT : null,
        p_client_id: NIEUW_POGING.id,
        p_prijsuitreiking: $('#nw-prijs')?.value ? new Date($('#nw-prijs').value).toISOString() : null,
      });
      NIEUW_POGING = null;
      sessie.zetPin(res.code, res.pin);
      // sjabloon: hetzelfde seizoen en dezelfde dagregel meekoppelen. Mislukt dat,
      // dan is de wedstrijd er gewoon en kan de organisator het seizoen alsnog
      // met de keuzelijst op de wedstrijdkaart kiezen.
      if (SJABLOON && SJABLOON.seizoen_id && !res.bestond_al) {
        try {
          await rpc('w_org_seizoen_koppel', {
            p_wachtwoord: sessie.orgWw() || '',
            p_code: res.code,
            p_seizoen_id: SJABLOON.seizoen_id,
            p_ex_aequo: SJABLOON.ex || null,
            p_klant: KLANT(),
          });
        } catch { toast('Wedstrijd aangemaakt, maar het seizoen koppelen lukte niet. Kies het seizoen op de wedstrijdkaart.'); }
      }
      SJABLOON = null;
      toonSjabloonHint();
      DEEL_NIEUW = {
        naam: $('#nw-naam').value.trim(),
        start: new Date(startVeld.value).toISOString(),
        eind: new Date(eindVeld.value).toISOString(),
        code: res.code,
        kijk: res.kijk_code,
        link: location.origin + location.pathname + '#/w/' + res.code,
      };
      $('#dn-naam').textContent = DEEL_NIEUW.naam;
      $('#dn-code').textContent = DEEL_NIEUW.code;
      $('#dn-kijk').textContent = DEEL_NIEUW.kijk;
      $('#dn-link').textContent = DEEL_NIEUW.link;
      $('#deel-nieuw').hidden = false;
      location.hash = '#/w/' + res.code;
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
    knop.disabled = false;
    knop.textContent = oudeTekst;
  });
}

let DUO_MAAT = null;        // {code, naam, deelnemer_code, token?}: maat-gegevens, gebonden aan de wedstrijdcode
let DUO_MAAT_GEZOCHT = false;  // eenmalige herstelpoging via w_mijn_team na herladen

  // niet zweven waar het formulier al staat (team-tab) of waar de vaste
  // doorgeef-knop staat (vangsten-tab)
  const opTeamTab = !$('#tab-team')?.hidden;
  knop.hidden = !(ROL === 'deelnemer' && fase() === 'live'
    && !!sessie.team(CODE) && !opTeamTab);
}

/* ---------- organisatie-omgeving ---------- */
let ORG_DATA = null;

let ORG_BEZIG = false;

async function laadOrg(eerste) {
  if (ORG_BEZIG && !eerste) return;
  ORG_BEZIG = true;
  const mijnGen = SESSIE_GEN;
  try {
    const res = await rpc('w_org_wedstrijden', { p_wachtwoord: sessie.orgWw() || '', p_klant: KLANT() });
    if (mijnGen !== SESSIE_GEN) return;   // uitgelogd of ander scherm: niets vullen
    if (!res) { sessionStorage.removeItem('orgww'); location.hash = ''; return; }
    ORG_DATA = res;
    renderOrg();
    if (eerste) laadOrgSeizoenen();
  } catch {
    if (mijnGen !== SESSIE_GEN) return;
    if (eerste) location.hash = '';
  } finally {
    if (mijnGen === SESSIE_GEN) ORG_BEZIG = false;
  }
}

// Organisatieomgeving als overzicht met panelen (v104, fase 5 van het ontwerp).
// De onderdelen zelf zijn ONGEWIJZIGD: dit toont er één tegelijk en zet een
// terugknop erboven. Zonder NAV_TEGELS staat alles onder elkaar zoals voorheen.
let ORG_VAK = null;
function toonOrgVak(sleutel) {
  ORG_VAK = sleutel;
  const aan = TEGELS();
  const overzicht = $('#org-overzicht');
  if (overzicht) overzicht.hidden = !aan || !!sleutel;
  const terug = $('#org-terug');
  if (terug) terug.hidden = !aan || !sleutel;
  document.querySelectorAll('#view-org [data-orgvak]').forEach((el) => {
    el.hidden = aan ? (el.dataset.orgvak !== sleutel) : false;
  });
  if (aan) window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderOrgOverzicht() {
  if (!TEGELS()) return;
  const nuMs = new Date(ORG_DATA?.server_now || Date.now()).getTime();
  const alle = ORG_DATA?.wedstrijden || [];
  const actief = alle.filter((w) => new Date(w.eind_ts).getTime() >= nuMs).length;
  const w = $('#org-stat-wedstrijden'); if (w) w.textContent = actief;
  const z = $('#org-stat-seizoenen'); if (z) z.textContent = (ORG_SEIZOENEN || []).length;
}

/* ---------- seizoenenbeheer (organisatie) ---------- */
let ORG_SEIZOENEN = null;      // lijst uit w_org_seizoenen
let SEIZOEN_PER_CODE = {};     // wedstrijdcode -> { id, naam, ex }

async function laadOrgSeizoenen() {
  try {
    ORG_SEIZOENEN = await rpc('w_org_seizoenen', { p_wachtwoord: sessie.orgWw() || '', p_klant: KLANT() });
    SEIZOEN_PER_CODE = {};
    for (const z of ORG_SEIZOENEN) {
      for (const w of z.wedstrijden) SEIZOEN_PER_CODE[w.code] = { id: z.id, naam: z.naam, ex: w.ex_aequo || '' };
    }
    renderOrgSeizoenen();
    renderOrg();
    renderOrgOverzicht();
  } catch { /* seizoenen zijn optioneel; stil falen */ }
}

const SEIZOEN_REGEL_TEKST = {
  telling: { plaatspunten: 'plaatspunten', totaalgewicht: 'totaalgewicht' },
  niet_vanger: { gemiddelde: 'niet-vanger: gemiddelde (ONK)', vangers_plus_1: 'niet-vanger: vangers+1', max_plus_1: 'niet-vanger: hoogste+1' },
  gemist: { hoogste_plus_1: 'gemist: hoogste+1', deelnemers_plus_1: 'gemist: deelnemers+1' },
  ex_aequo: { app: 'gelijk: grootste vis', sportvisunie: 'gelijk: gedeelde plaats', karper: 'gelijk: karper (KKKC)' },
};

function renderOrgSeizoenen() {
  const el = $('#org-seizoenen');
  if (!el || ORG_SEIZOENEN === null) return;
  if (!ORG_SEIZOENEN.length) {
    el.innerHTML = '<p class="muted">Nog geen seizoenen. Maak er hieronder een aan en koppel daarna wedstrijden via de wedstrijdkaarten hierboven.</p>';
    return;
  }
  el.innerHTML = ORG_SEIZOENEN.map((z) => {
    const r = z.regels || {};
    const samenvatting = [
      SEIZOEN_REGEL_TEKST.telling[r.telling || 'plaatspunten'],
      `aftrek: ${Number(r.aftrek ?? 1)}`,
      SEIZOEN_REGEL_TEKST.niet_vanger[r.niet_vanger || 'gemiddelde'],
      SEIZOEN_REGEL_TEKST.gemist[r.gemist || 'hoogste_plus_1'],
      SEIZOEN_REGEL_TEKST.ex_aequo[r.ex_aequo || 'app'],
    ].join(' · ');
    return `<div class="org-w">
      <div class="org-w-kop"><b>${esc(z.naam)}</b>
        <button class="btn gevaar klein-btn" data-seizoen-verwijder="${esc(z.id)}" data-naam="${esc(z.naam)}">🗑️</button></div>
      <div class="muted klein">${esc(samenvatting)}</div>
      <div class="muted klein">${z.wedstrijden.length
        ? 'wedstrijden: ' + z.wedstrijden.map((w) => esc(w.naam)).join(' · ')
        : 'nog geen wedstrijden gekoppeld'}</div>
    </div>`;
  }).join('');
  document.querySelectorAll('[data-seizoen-verwijder]').forEach((b) => {
    b.onclick = () => tikNogmaals(b, '⚠️ Definitief weg', async () => {
      try {
// Een wedstrijd als sjabloon gebruiken: type, maximum, regels, duur, seizoen en
// dagregel overnemen naar een NIEUWE datum. Nooit deelnemers, vangsten, codes of
// loting; die horen bij de oude wedstrijd. Het draaiboek liet de organisator dit
// tot nu toe elke keer opnieuw intikken (Codex-featureadvies v11, voorstel 1).
let SJABLOON = null;   // { code, naam, seizoen_id, ex } zolang het formulier gevuld staat

function vulSjabloon(code) {
  const w = (ORG_DATA?.wedstrijden || []).find((x) => x.code === code);
  if (!w) return;
  const start = new Date(w.start_ts);
  const eind = new Date(w.eind_ts);
  const duurMs = eind.getTime() - start.getTime();
  // dezelfde weekdag en tijd, doorgeschoven naar de eerstvolgende toekomst
  const nieuweStart = new Date(start);
  while (nieuweStart.getTime() <= nu()) nieuweStart.setDate(nieuweStart.getDate() + 7);
  const nieuwEind = new Date(nieuweStart.getTime() + duurMs);

  $('#nw-naam').value = w.naam;
  $('#nw-mode').value = w.mode;
  $('#nw-max').value = w.max_teams || '';
  $('#nw-regels').value = w.regels || '';
  $('#nw-start').value = naarLocalInput(nieuweStart.toISOString());
  $('#nw-eind').value = naarLocalInput(nieuwEind.toISOString());

  const gekoppeld = SEIZOEN_PER_CODE[w.code];
  SJABLOON = { code: w.code, naam: w.naam, seizoen_id: gekoppeld ? gekoppeld.id : null,
               ex: gekoppeld ? gekoppeld.ex : null };
  toonSjabloonHint();
  // naar de KAART scrollen, niet naar het formulier: anders valt de melding
  // die vertelt dat dit gekopieerde waarden zijn net boven beeld
  ($('#form-nieuw').closest('section') || $('#form-nieuw'))
    .scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#nw-naam').focus();
  $('#nw-naam').select();
}

// de organisator moet zien dat hier gekopieerde waarden staan: een sjabloon dat
// je gedachteloos indient, geeft een wedstrijd met de regels van vorig jaar
function toonSjabloonHint() {
  const el = $('#nw-sjabloon');
  if (!el) return;
  if (!SJABLOON) { el.hidden = true; return; }
  const seizoenTekst = SJABLOON.seizoen_id
    ? ` Het seizoen wordt automatisch meegekoppeld.` : '';
  el.innerHTML = `\ud83d\udccb Overgenomen van <b>${esc(SJABLOON.naam)}</b>.
    Controleer naam, datum, tijden en regels.${seizoenTekst}
    <button type="button" class="btn klein-btn" id="nw-sjabloon-wis">leegmaken</button>`;
  el.hidden = false;
  $('#nw-sjabloon-wis').onclick = () => {
    SJABLOON = null;
    ['#nw-naam', '#nw-max', '#nw-regels', '#nw-start', '#nw-eind'].forEach((s2) => { $(s2).value = ''; });
    $('#nw-mode').value = 'individueel';
    zetStandaardTijden();
    toonSjabloonHint();
  };
}

function renderOrg() {
  if (!ORG_DATA) return;
  if (document.querySelector('#org-actief [data-scherp], #org-verleden [data-scherp]')) return;
  // niet onder iemands handen weg-renderen: open seizoen-selects overleven de poll
  if (document.activeElement && document.activeElement.closest
      && document.activeElement.closest('.org-seizoen')) return;
  const nuMs = new Date(ORG_DATA.server_now).getTime();
  const alle = ORG_DATA.wedstrijden || [];
  const actief = alle.filter((w) => new Date(w.eind_ts).getTime() >= nuMs);
  const voorbij = alle.filter((w) => new Date(w.eind_ts).getTime() < nuMs);
  $('#org-actief').innerHTML = actief.length
    ? actief.map((w) => orgWedstrijdKaart(w, nuMs)).join('')
    : '<p class="muted">Geen actieve wedstrijden. Maak er hieronder een aan.</p>';
  $('#org-verleden').innerHTML = voorbij.length
    ? voorbij.map((w) => orgWedstrijdKaart(w, nuMs)).join('')
    : '<p class="muted">Nog geen afgeronde wedstrijden.</p>';

  renderOrgOverzicht();

  const orgPinVan = (code) => (ORG_DATA?.wedstrijden || []).find((w) => w.code === code)?.admin_pin || null;
  document.querySelectorAll('[data-org-open]').forEach((b) => {
    b.onclick = () => {
      const pin = orgPinVan(b.dataset.orgOpen);
      if (!pin) return;
      sessie.zetPin(b.dataset.orgOpen, pin);
      location.hash = '#/w/' + b.dataset.orgOpen;
    };
  });
  document.querySelectorAll('[data-org-loting]').forEach((b) => {
    b.onclick = () => tikNogmaals(b, '⚠️ Tik nogmaals: loting starten', async () => {
      const pin = orgPinVan(b.dataset.orgLoting);
      if (!pin) return;
      try {
        await rpc('w_start_stekkeuze', { p_code: b.dataset.orgLoting, p_pin: pin });
        sessie.zetPin(b.dataset.orgLoting, pin);
        location.hash = '#/w/' + b.dataset.orgLoting;
      } catch (err) { toast(foutTekst(err)); }
    });
  });
  document.querySelectorAll('[data-org-sjabloon]').forEach((b) => {
    b.onclick = () => vulSjabloon(b.dataset.orgSjabloon);
  });
  document.querySelectorAll('[data-org-verwijder]').forEach((b) => {
    b.onclick = () => tikNogmaals(b, '⚠️ Definitief weg', async () => {
      try {
        const res = await rpc('w_org_verwijder_wedstrijd', {
          p_wachtwoord: sessie.orgWw() || '',
          p_code: b.dataset.orgVerwijder,
          p_klant: KLANT(),
        });
        toast(`"${res.naam}" verwijderd (${res.teams} team${res.teams === 1 ? '' : 's'}, ${res.vangsten} vangst${res.vangsten === 1 ? '' : 'en'}).`);
        laadOrg();
      } catch (err) { toast(foutTekst(err)); }
    });
  });
  document.querySelectorAll('[data-org-seizoen]').forEach((sel) => {
    sel.onchange = async () => {
      try {
        await rpc('w_org_seizoen_koppel', {
          p_wachtwoord: sessie.orgWw() || '',
          p_code: sel.dataset.orgSeizoen,
          p_seizoen_id: sel.value || null,
          p_ex_aequo: null,
          p_klant: KLANT(),
        });
        await laadOrgSeizoenen();
      } catch (err) { toast(foutTekst(err)); laadOrgSeizoenen(); }
    };
  });
  document.querySelectorAll('[data-org-dagregel]').forEach((sel) => {
    sel.onchange = async () => {
      const code = sel.dataset.orgDagregel;
      try {
        await rpc('w_org_seizoen_koppel', {
          p_wachtwoord: sessie.orgWw() || '',
          p_code: code,
          p_seizoen_id: (SEIZOEN_PER_CODE[code] || {}).id || null,
          p_ex_aequo: sel.value || null,
          p_klant: KLANT(),
        });
        await laadOrgSeizoenen();
      } catch (err) { toast(foutTekst(err)); laadOrgSeizoenen(); }
    };
  });
}

/* ---------- kop + klok ---------- */
function renderKop() {
  const w = STATE.wedstrijd;
  $('#w-naam').textContent = w.naam;
  const regelsCard = $('#regels-card');
  regelsCard.hidden = !w.regels;
  if (w.regels) $('#regels-tekst').textContent = w.regels;
async function renderBeheer(magPrefill) {
  if (ROL !== 'organisator' || !ADMIN_OPEN) { $('#beheer-inhoud').hidden = true; $('#pin-card').hidden = false; return; }
  $('#pin-card').hidden = true;
  $('#beheer-inhoud').hidden = false;
  if (!magPrefill) {
    const actiefEl = document.activeElement;
    if (actiefEl && actiefEl.closest && actiefEl.closest('#beheer-inhoud')
        && (actiefEl.tagName === 'INPUT' || actiefEl.tagName === 'TEXTAREA' || actiefEl.tagName === 'SELECT')) return;
    if (document.querySelector('#beheer-inhoud [data-scherp]')) return;
  }

  renderWachtende();

  const w = STATE.wedstrijd;
  $('#b-code').textContent = w.code;
  $('#b-link').textContent = location.origin + location.pathname + '#/w/' + w.code;
  const naamEl = $('#b-naam'), maxEl = $('#b-max');
  if ((magPrefill || !naamEl.dataset.geraakt)
      && document.activeElement !== naamEl && document.activeElement !== maxEl) {
    naamEl.value = w.naam;
    maxEl.value = w.max_teams ?? '';
  }
  naamEl.onfocus = maxEl.onfocus = () => { naamEl.dataset.geraakt = '1'; };
  const startEl = $('#b-start'), eindEl = $('#b-eind'), prijsEl = $('#b-prijs');
  if (magPrefill || (document.activeElement !== startEl && document.activeElement !== eindEl
      && document.activeElement !== prijsEl && !startEl.dataset.geraakt)) {
    startEl.value = naarLocalInput(w.start_ts);
    eindEl.value = naarLocalInput(w.eind_ts);
    if (prijsEl) prijsEl.value = w.prijsuitreiking_ts ? naarLocalInput(w.prijsuitreiking_ts) : '';
  }
  startEl.onfocus = eindEl.onfocus = () => { startEl.dataset.geraakt = '1'; };
  if (prijsEl) prijsEl.onfocus = () => { startEl.dataset.geraakt = '1'; };

  const zonesEl = $('#b-zones');
  if ((magPrefill || !zonesEl.dataset.geraakt) && document.activeElement !== zonesEl) {
    zonesEl.value = zonesNaarTekst(w.zones);
  }
  zonesEl.onfocus = () => { zonesEl.dataset.geraakt = '1'; };
  const regelsEl = $('#b-regels');
  if ((magPrefill || !regelsEl.dataset.geraakt) && document.activeElement !== regelsEl) {
    regelsEl.value = w.regels || '';
  }
  regelsEl.onfocus = () => { regelsEl.dataset.geraakt = '1'; };
  const zonesDicht = w.status !== 'aanmelden';
  zonesEl.disabled = zonesDicht;
  $('#b-zones-opslaan').disabled = zonesDicht;

  $('#b-loting').disabled = w.status !== 'aanmelden';
  $('#b-reset').disabled = w.status === 'aanmelden';

  const duoMaatVan = (t) => t.duo_id
    ? STATE.teams.find((x) => x.duo_id === t.duo_id && x.id !== t.id) : null;
  $('#b-teams').innerHTML = STATE.teams.length ? STATE.teams.map((t) => `
    <div class="b-rij">
      <span class="naam">${teamNaamHtml(t)}${duoMaatVan(t)
        ? ` <span class="duo-label">🎣 duo met ${esc(duoMaatVan(t).naam)}</span>`
        : ''}${t.foto_toestemming ? ' <span class="foto-ok-label" title="foto\'s mogen op de socials van de viswedstrijdapp">📸 socials ok</span>' : ''}</span>
      <span class="muted klein">${t.lot_nummer ? 'lot ' + t.lot_nummer : ''} ${t.zone ? '· ' + esc(zoneLabel(t.zone)) : (t.stekken || []).length ? '· stek ' + t.stekken.join('+') : ''}</span>
      <span class="muted klein">🔑 <b class="codegroot klein-code" data-team-code="${t.id}">·····</b></span>
      ${w.status === 'stekkeuze' && !(t.stekken || []).length ? `<button class="btn klein-btn" data-team-kies="${t.id}">📍 geef plek</button>` : ''}
      ${w.status !== 'aanmelden' && ((t.stekken || []).length || t.zone) ? `<button class="btn klein-btn" data-team-wis="${t.id}" title="plek weer vrijgeven (alleen zonder vangsten)">🧹 plek wissen</button>` : ''}
      <button class="btn gevaar klein-btn" data-team-weg="${t.id}">verwijder</button>
    </div>`).join('') : '<p class="muted">Nog geen deelnemers.</p>';
  const codesSleutel = CODE + ':' + STATE.teams.map((t) => t.id).sort().join(',');
  const vulCodes = (codes) => {
    for (const c of codes || []) {
      const el = $('#b-teams').querySelector(`[data-team-code="${c.team_id}"]`);
      if (el) el.textContent = c.deelnemer_code;
    }
  };
  if (TEAMCODES_CACHE.sleutel === codesSleutel) {
    vulCodes(TEAMCODES_CACHE.codes);
  } else {
    rpc('w_admin_teamcodes', { p_code: CODE, p_pin: sessie.pin(CODE) }).then((codes) => {
      TEAMCODES_CACHE = { sleutel: codesSleutel, codes: codes || [] };
      vulCodes(codes);
    }).catch(() => {});
  }
  $('#b-teams').querySelectorAll('[data-team-weg]').forEach((b) => {
    const geloot = w.status !== 'aanmelden';
    b.onclick = () => tikNogmaals(b, geloot ? '⚠️ incl. vangsten, zeker?' : 'zeker?', () =>
      beheerActie('w_admin_verwijder_team', { p_team_id: b.dataset.teamWeg }));
  });
  $('#b-teams').querySelectorAll('[data-team-wis]').forEach((b) => {
    b.onclick = () => tikNogmaals(b, 'plek vrijgeven, zeker?', () =>
      beheerActie('w_admin_wis_plek', { p_team_id: b.dataset.teamWis }));
  });
  $('#b-teams').querySelectorAll('[data-team-kies]').forEach((b) => {
    b.onclick = () => {
      const t = STATE.teams.find((x) => x.id === b.dataset.teamKies);
      if (!t) return;
      ADMIN_KIES = { teamId: t.id, naam: teamNaam(t) };
      SELECTIE = []; SELECTIE_ZONE = null;
      activateTab('kaart');
      renderKaart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });

  // vangst handmatig toevoegen: teamlijst bijhouden (niet verversen terwijl hij openstaat)
  const teamSelect = $('#bv-team');
  if (document.activeElement !== teamSelect) {
    const huidig = teamSelect.value;
    teamSelect.innerHTML = STATE.teams.map((t) => `<option value="${t.id}">${esc(teamNaam(t))}</option>`).join('');
    if ([...teamSelect.options].some((o) => o.value === huidig)) teamSelect.value = huidig;
  }

  const teamsBijId = new Map(STATE.teams.map((t) => [t.id, t]));
  const teamOpties = (gekozen) => STATE.teams.map((t) => `<option value="${t.id}"${t.id === gekozen ? ' selected' : ''}>${esc(teamNaam(t))}</option>`).join('');
  $('#b-vangsten').innerHTML = STATE.vangsten.length ? STATE.vangsten.map((v) => `
    <div class="b-rij">
      ${vangstFotoHtml(v, 'thumb')}
      <span class="naam">${teamsBijId.get(v.team_id) ? teamNaamHtml(teamsBijId.get(v.team_id)) : '?'}${sterHtml(v)} · ${fmtDatumTijd(vangstTijd(v))}</span>
      <input class="gewicht-edit" value="${(v.gewicht_gram / 1000).toFixed(2).replace('.', ',')}" data-orig="${(v.gewicht_gram / 1000).toFixed(2).replace('.', ',')}" data-vangst="${v.id}" aria-label="gewicht in kg">
      <select class="team-edit" data-vangst-team="${v.id}" data-orig="${v.team_id}" aria-label="visser">${teamOpties(v.team_id)}</select>
      <input class="tijd-edit" type="datetime-local" value="${naarLocalInput(vangstTijd(v))}" data-orig="${naarLocalInput(vangstTijd(v))}" data-vangst-tijd="${v.id}" aria-label="gevangen om">
      <button class="btn klein-btn" data-vangst-opslaan="${v.id}">opslaan</button>
      <button class="btn gevaar klein-btn" data-vangst-weg="${v.id}">verwijder</button>
    </div>`).join('') : '<p class="muted">Nog geen vangsten.</p>';
  $('#b-vangsten').querySelectorAll('[data-vangst-opslaan]').forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.vangstOpslaan;
      const rij = $('#b-vangsten');
      if (!STATE.vangsten.some((x) => x.id === id)) { toast('Deze vangst bestaat niet meer.'); return; }
      const gewichtEl = rij.querySelector(`input[data-vangst="${id}"]`);
      const teamEl = rij.querySelector(`select[data-vangst-team="${id}"]`);
      const tijdEl = rij.querySelector(`input[data-vangst-tijd="${id}"]`);
      // alleen meesturen wat de organisator ZELF in deze rij veranderde (vergeleken
      // met wat de rij toonde, niet met de nieuwste state): anders draait een opslag
      // een gelijktijdige correctie van een collega terug, of krijgt een vangst van
      // 12,345 kg door de afronding op twee decimalen elke keer een ster (Codex v90)
      const args = { p_vangst_id: id };
      if (gewichtEl.value.trim() !== gewichtEl.dataset.orig) {
        const gram = parseGewicht(gewichtEl.value);
        if (!gram) { toast('Ongeldig gewicht.'); return; }
        args.p_gewicht_gram = gram;
      }
      if (teamEl.value && teamEl.value !== teamEl.dataset.orig) args.p_team_id = teamEl.value;
      if (tijdEl.value && tijdEl.value !== tijdEl.dataset.orig) {
        const d = new Date(tijdEl.value);
        if (Number.isNaN(d.getTime())) { toast('Ongeldige tijd.'); return; }
        args.p_gevangen_op = d.toISOString();
      }
      if (Object.keys(args).length === 1) { toast('Niets gewijzigd.'); return; }
      await beheerActie('w_admin_vangst', args);
    };
386:  $('#verder-tekst').innerHTML = l.kijker
472:  initHome(); initWedstrijd(); route(true);
551:      .forEach((sel) => { const el = $(sel); if (el) el.innerHTML = ''; });
652:  vak.innerHTML = rest.map((n) =>
777:      if ($('#org-zones').value.trim() === '') {
778:        $('#org-zones').value = zonesNaarTekst(check.standaard_zones);
796:  $('#org-zones-opslaan').addEventListener('click', async () => {
797:    const foutEl = $('#org-zones-fout'), okEl = $('#org-zones-ok');
800:    try { geparsed = parseZones($('#org-zones').value); }
1122:    el.innerHTML = '<p class="muted">Nog geen seizoenen. Maak er hieronder een aan en koppel daarna wedstrijden via de wedstrijdkaarten hierboven.</p>';
1125:  el.innerHTML = ORG_SEIZOENEN.map((z) => {
1174:  ['#org-actief', '#org-verleden', '#org-seizoenen', '#org-zones'].forEach((s) => {
1177:    if ('value' in el) el.value = ''; else el.innerHTML = '';
1189:  ['#su-instellingen', '#su-wedstrijden'].forEach((s) => { const el = $(s); if (el) el.innerHTML = ''; });
1317:  $('#su-stats').innerHTML = [
1326:  $('#su-instellingen').innerHTML = `
1362:  $('#su-wedstrijden').innerHTML = `
1540:  el.innerHTML = `\ud83d\udccb Overgenomen van <b>${esc(SJABLOON.naam)}</b>.
1563:  $('#org-actief').innerHTML = actief.length
1566:  $('#org-verleden').innerHTML = voorbij.length
1687:  houder.innerHTML = KAART_SVG;
1876:    el.innerHTML = '<p class="muted">Nog geen deelnemers aangemeld.</p>';
1886:  el.innerHTML = voortgang + (geloot ? '' : '<p class="muted klein">De loting is nog niet gestart. Volgorde hieronder is de aanmeldvolgorde.</p>') +
1979:    el.innerHTML = '<p class="muted">Nog geen vangsten geregistreerd.</p>';
2007:    el.innerHTML = (uitleg ? `<p class="muted klein regel-uitleg">${esc(uitleg)}</p>` : '')
2020:    el.innerHTML = `<table class="klassement">
2408:    podium.innerHTML = '<p class="muted">Er is niets gevangen. Volgende keer beter!</p>';
2411:    podium.innerHTML = `<div class="afsluit-winnaar"><div class="label">🏆 ${w1.length > 1 ? 'Gedeelde eerste plaats' : 'Winnaar'}</div>
2493:  if (!SEIZOEN) { el.innerHTML = ''; if (deelRij) deelRij.hidden = true; return; }
2503:  el.innerHTML = `
2597:    el.innerHTML = '<p class="muted">Nog geen vangsten. De eerste vis komt eraan…</p>';
2600:  el.innerHTML = STATE.vangsten.map((v) => {
2770:  if (!WACHTRIJ_CACHE.length) { el.hidden = true; el.innerHTML = ''; return; }
2771:  el.innerHTML = WACHTRIJ_CACHE.map((i) => {
2886:function initWedstrijd() {
3491:  $('#team-titel').innerHTML = avatarHtml(mijn) + esc(teamNaam(mijn));
3572:  $('#mijn-vangsten').innerHTML = eigen.map((v) => `
3624:  $('#b-loting').addEventListener('click', () =>
3625:    tikNogmaals($('#b-loting'), '⚠️ Tik nogmaals: loting starten', () => beheerActie('w_start_stekkeuze', {})));
3698:  $('#b-regels-opslaan').addEventListener('click', async () => {
3699:    const okEl = $('#b-regels-ok'); okEl.hidden = true;
3701:      await rpc('w_admin_regels', { p_code: CODE, p_pin: sessie.pin(CODE), p_regels: $('#b-regels').value });
3702:      okEl.textContent = $('#b-regels').value.trim() ? 'Regels opgeslagen.' : 'Regels verwijderd.';
3708:  $('#b-zones-opslaan').addEventListener('click', async () => {
3709:    const foutEl = $('#b-zones-fout'), okEl = $('#b-zones-ok');
3712:    try { geparsed = parseZones($('#b-zones').value); }
3795:  if (!lijst.length) { kaart.hidden = true; el.innerHTML = ''; return; }
3797:  el.innerHTML = lijst.map((v) => `
3858:  const zonesEl = $('#b-zones');
3863:  const regelsEl = $('#b-regels');
3870:  $('#b-zones-opslaan').disabled = zonesDicht;
3872:  $('#b-loting').disabled = w.status !== 'aanmelden';
3877:  $('#b-teams').innerHTML = STATE.teams.length ? STATE.teams.map((t) => `
3928:    teamSelect.innerHTML = STATE.teams.map((t) => `<option value="${t.id}">${esc(teamNaam(t))}</option>`).join('');
3934:  $('#b-vangsten').innerHTML = STATE.vangsten.length ? STATE.vangsten.map((v) => `

web search: 
web search: site.developer.mozilla.org summary heading accessibility role heading ...
exec
/bin/zsh -lc "sed -n '65,118p' docs/styles.css; sed -n '3688,3735p' docs/app.js; sed -n '1150,1215p' docs/app.js; sed -n '480,591p' docs/app.js; rg -n 'initWedstrijd|renderTabs\\(|function wisOrgScherm|tab-beheer|<script|TEGELS =' docs/app.js docs/demo/index.html docs/config.js; sed -n '3874,3920p' docs/app.js" in /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
 succeeded in 0ms:
  margin: 12px 0; box-shadow: 0 1px 4px rgba(42,39,33,.08);
}
.hero { background: linear-gradient(150deg, #2c331f, #4d5839 62%, #6d7355); color: #fff;
  display: flex; align-items: center; gap: 16px; padding: 24px 20px; }
.hero-logo { width: 84px; height: 84px; border-radius: 50%; flex: 0 0 auto;
  box-shadow: 0 4px 12px rgba(0,0,0,.3); }
.hero-eyebrow { display: block; font-size: 11.5px; font-weight: 700; letter-spacing: .13em;
  text-transform: uppercase; color: var(--oranje); margin-bottom: 3px; }
.hero h1 { margin: 0 0 6px; font-size: 30px; line-height: 1.12; letter-spacing: -.6px; font-weight: 800; }
.hero h1 .accent { color: var(--oranje); }
.hero .sub { margin: 0; opacity: .92; font-size: 15px; }

/* startscherm van een organisatie: hero met de slogan erboven */
.hero.start { display: block; padding: 26px 20px 28px; }
.slogan-blok { display: inline-block; margin-bottom: 12px; }
.slogan-blok .tekst { display: block; font-size: 19px; font-weight: 800; letter-spacing: -.3px;
  color: #fff; line-height: 1; }
.slogan-blok .punt { color: var(--oranje); }
.slogan-blok svg { display: block; width: 100%; height: auto; color: var(--oranje); margin-top: 3px; }

h1 { font-size: 22px; margin: 0 0 6px; color: inherit; }
h2 { font-size: 17px; margin: 0 0 10px; color: var(--blauw-donker); }
.muted { color: var(--grijs); }
.klein { font-size: 13px; }
.fout { color: var(--rood); font-weight: 600; }
.ok { color: var(--groen); font-weight: 600; }

/* merk-blok in de gewone app-stijl */
.merk-blok { text-align: center; }
.merk-titel { margin: 0 0 8px; font-weight: 700; font-size: 17px; color: var(--blauw-donker); }
.merk-tekst { margin: 0 auto; max-width: 46ch; font-size: 13px; line-height: 1.5; color: var(--grijs); }
.merk-tekst a { color: var(--blauw); font-weight: 600; text-decoration: none; white-space: nowrap; }
.merk-tekst a:hover { text-decoration: underline; }
.merk-voet { margin: 14px 0 6px; }
.merk-voet img { width: 84px; height: auto; }
.merk-logo { margin: 4px 0 10px; }
.merk-logo img { width: 132px; height: 132px; }
.merk-links { margin: 0; font-weight: 600; font-size: 13px; }
.merk-links a { color: var(--blauw); text-decoration: none; }
.merk-links a:hover { text-decoration: underline; }
.merk-links span { color: var(--zand-donker); margin: 0 8px; }
.merk-social { display: flex; justify-content: center; gap: 18px; margin: 12px 0 0; }
.merk-social a { display: inline-flex; align-items: center; gap: 6px; color: var(--blauw); font-weight: 600; font-size: 13px; text-decoration: none; }
.merk-social a:hover { text-decoration: underline; }
.merk-social svg { width: 20px; height: 20px; }

input, select, button { font: inherit; }
input, select {
  width: 100%; padding: 10px 12px; border: 1.5px solid var(--zand-donker);
  border-radius: 10px; background: #fff; color: var(--tekst);
}
input:focus, select:focus { outline: 2px solid var(--blauw-mid); border-color: var(--blauw-mid); }
label { display: block; margin: 0 0 10px; font-weight: 600; font-size: 14px; color: var(--blauw-donker); }
label[hidden] { display: none; }
      BV_POGING = null;
      okEl.textContent = `Vangst van ${fmtKg(gram)} toegevoegd.`;
      okEl.hidden = false;
      $('#form-b-vangst').reset();
      $('#bv-foto-label').textContent = '📷 Foto (optioneel)';
      await laadState(false);
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
    knop.disabled = false; knop.textContent = 'Vangst toevoegen';
  });

  $('#b-regels-opslaan').addEventListener('click', async () => {
    const okEl = $('#b-regels-ok'); okEl.hidden = true;
    try {
      await rpc('w_admin_regels', { p_code: CODE, p_pin: sessie.pin(CODE), p_regels: $('#b-regels').value });
      okEl.textContent = $('#b-regels').value.trim() ? 'Regels opgeslagen.' : 'Regels verwijderd.';
      okEl.hidden = false;
      await laadState(false);
    } catch (err) { toast(foutTekst(err)); }
  });

  $('#b-zones-opslaan').addEventListener('click', async () => {
    const foutEl = $('#b-zones-fout'), okEl = $('#b-zones-ok');
    foutEl.hidden = true; okEl.hidden = true;
    let geparsed;
    try { geparsed = parseZones($('#b-zones').value); }
    catch (err) { foutEl.textContent = err.message; foutEl.hidden = false; return; }
    try {
      const res = await rpc('w_admin_zones', { p_code: CODE, p_pin: sessie.pin(CODE), p_zones: geparsed.zones });
      okEl.textContent = res.zones === 0 ? 'Zones gewist: gewone loting per stek.'
        : `${res.zones} zones opgeslagen: ${zonesPreview(geparsed)}`;
      okEl.hidden = false;
      await laadState(false);
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });
}

// "Zone A: 20-30" of "B: 1,3,5" -> {zones: [{naam, stekken}], overgeslagen: [...]};
// reeks met gelijke pariteit springt per 2; niet-bestaande nummers in een reeks
// worden overgeslagen en apart gemeld
function parseZones(tekst) {
  const regels = tekst.split('\n').map((r) => r.trim()).filter(Boolean);
  const overgeslagen = new Set();
  if (!regels.length) return { zones: [], overgeslagen: [] };
  const zones = [];
  for (const regel of regels) {
    const m = regel.match(/^(.{1,20}?)\s*[:=]\s*(.+)$/);
    if (!m) throw new Error(`Regel niet begrepen: "${regel}". Gebruik het formaat Naam: nummers.`);
    const naam = m[1].trim();
    });
  });
}

/* ---------- beheerdersomgeving (KemblincK support, route #/beheerder) ---------- */
let SU_DATA = null;
let SU_KLANT = null;   // geselecteerde klant in het beheeroverzicht
let SU_ZOEK = '';      // zoekterm op wedstrijdnaam/code
let SU_REQ = 0;        // generatieteller: laat een laat antwoord nooit een verlaten scherm vullen (Codex v9 P2-4)
let SU_LAATST = 0;     // laatste su-activiteit voor de inactiviteitslimiet (Codex v9 P2-5)
let SU_OPGEHAALD = 0;  // Date.now() bij het ophalen van SU_DATA, voor een lopende klok
let SU_WAKER = null;
const SU_MAX_INACTIEF = 15 * 60 * 1000;
let SU_FILTER = 'alle'; // alle | actief | afgelopen
let SU_OPEN_CODE = null; // wedstrijd met uitgeklapte details

// pins en overzicht horen niet in memory/DOM achter te blijven (Codex v6 P2-2)
// spiegelbeeld van wisSuScherm: organisator-state en gevoelige DOM leegmaken
// bij uitloggen (Codex v10)
function wisOrgScherm() {
  SESSIE_GEN += 1;   // late antwoorden mogen het scherm niet opnieuw vullen
  ORG_DATA = null;
  ORG_SEIZOENEN = [];
  SEIZOEN_PER_CODE = {};
  ['#org-actief', '#org-verleden', '#org-seizoenen', '#org-zones'].forEach((s) => {
    const el = $(s);
    if (!el) return;
    if ('value' in el) el.value = ''; else el.innerHTML = '';
  });
}

function wisSuScherm() {
  if (SU_WAKER) { clearInterval(SU_WAKER); SU_WAKER = null; }
  SU_DATA = null;
  SU_KLANT = null;
  SU_ZOEK = '';
  SU_FILTER = 'alle';
  SU_OPEN_CODE = null;
  ['#su-stats'].forEach((s) => { const el = $(s); if (el) el.textContent = ''; });
  ['#su-instellingen', '#su-wedstrijden'].forEach((s) => { const el = $(s); if (el) el.innerHTML = ''; });
  ['#su-ww', '#su-ww-nieuw', '#su-ww-nieuw2', '#su-orgww-nieuw'].forEach((s) => { const el = $(s); if (el) el.value = ''; });
}

function initSu() {
  $('#su-login').hidden = !!sessie.suWw();
  $('#su-omgeving').hidden = !sessie.suWw();
  if (sessie.suWw()) laadSu();
}

function suActiviteit() { SU_LAATST = Date.now(); }

function startSuWaker() {
  if (SU_WAKER) return;
  SU_WAKER = setInterval(() => {
    if (!sessie.suWw()) return;
    if (Date.now() - SU_LAATST > SU_MAX_INACTIEF) {
      sessionStorage.removeItem('suww');
      wisSuScherm();
      if (location.hash === '#/beheerder') {
        initSu();
        toast('Beheerdersessie verlopen na 15 minuten zonder activiteit. Log opnieuw in.');
      }
    }
  }, 60000);
}

  });
  // zodra het bereik terug is meteen proberen, niet wachten op de volgende poll
  window.addEventListener('online', () => { if (CODE) verstuurWachtrij(); });
});

async function checkVersie() {
  try {
    const r = await fetch('version.json?_=' + APP_VERSION + '-' + Math.floor(nu() / 600000), { cache: 'no-store' });
    const j = await r.json();
    if (j.v > APP_VERSION) {
      $('#update-banner').hidden = false;
      // wedstrijddag: iedereen moet op de laatste versie zitten zonder zelf op
      // een banner te hoeven tikken; vernieuw vanzelf, maar niet midden in het
      // typen of tijdens een lopende wachtrij-verzending (Codex pre-wedstrijd 2)
      const ae = document.activeElement;
      const typt = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
      const alGeprobeerd = sessionStorage.getItem('herlaad-poging') === String(j.v);
      // een half ingevuld of nog te verwerken vangstformulier (foto gekozen,
      // compressie bezig, directe route zonder IndexedDB) mag nooit verloren
      // gaan door een herlaad (Codex ronde 3)
      const vangstBezig = FORMULIER_BEZIG
        || !!($('#v-gewicht')?.value) || !!($('#v-foto')?.files?.length);
      if (!typt && !alGeprobeerd && !WACHTRIJ_BEZIG && !vangstBezig) {
        sessionStorage.setItem('herlaad-poging', String(j.v));
        location.reload();
      }
    }
  } catch { /* offline of tijdelijk onbereikbaar: stil houden */ }
}

function route(initieel) {
  SESSIE_GEN += 1;   // alles wat nog onderweg is, hoort bij het vorige scherm
  sluitMeer();       // een open Meer-paneel hoort bij het vorige scherm (Codex fase 4, punt 2)
  STATE_OK_OP = 0; verbindingBanner(false);   // de banner hoort bij het vorige scherm
  DUO_MAAT_GEZOCHT = false;
  const mW = location.hash.match(/^#\/w\/([A-Za-z0-9]{4,8})/);
  const mK = location.hash.match(/^#\/k\/([A-Za-z0-9]{4,8})/);
  const mT = location.hash.match(/[?&]t=([0-9a-f-]{36})/i);
  PENDING_TOKEN = mT ? mT[1] : null;
  if (mT && mW) {
    // token meteen uit adresbalk en geschiedenis halen; hij leeft verder in geheugen
    history.replaceState(null, '', location.pathname + '#/w/' + mW[1].toUpperCase());
  }
  clearInterval(POLL); clearInterval(KLOKTIK); clearInterval(ORG_POLL);
  if (location.hash !== '#/beheerder') wisSuScherm();
  if (mW || mK) {
    KIJKER = !!mK;
    CODE = (mW || mK)[1].toUpperCase();
    sessionStorage.removeItem(HOME_BEWUST());   // in een wedstrijd: herstel bij een herstart weer aan
    // wachtwoordmanager: per wedstrijd een eigen regel (username = tenant + wedstrijdcode)
    document.querySelectorAll('.ww-username').forEach((u) => { u.value = `${KLANT() || 'wedstrijd'}-${CODE}`; });
    $('#topcode').textContent = CODE;
    toonView('wedstrijd');
    ROL = KIJKER ? 'kijker' : 'deelnemer';
    renderTabs();
    // met tegelnavigatie is het overzicht de thuisbasis voor elke rol; zonder
    // tegels blijft het oude gedrag (kijker landt op het klassement)
    if (TEGELS()) activateTab('overzicht');
    else if (KIJKER) activateTab('klassement');
    SELECTIE = []; SELECTIE_ZONE = null;
    ADMIN_OPEN = false;
    STATE = null;
    BEKENDE_VANGSTEN = null;
    VANGSTEN_SIG = null; MIJN_VANGSTEN_SIG = null;
    sluitAfsluiting(false);   // een open afsluitscherm hoort bij de vorige wedstrijd
    // oude inhoud van de vorige wedstrijd meteen weg (Codex v89): tot de nieuwe
    // state er is mag een kijker de deelnemerstab met codes van de vorige
    // sessie niet meer bereiken
    document.querySelectorAll('#tab-team .card').forEach((c) => { c.hidden = true; });
    $('#form-join')?.reset();   // ook het foto-toestemmingsvinkje: geldt per wedstrijd
    ['#team-code', '#duo-maat-code', '#vangsten-feed', '#mijn-vangsten', '#klassement-inhoud', '#loting-lijst']
      .forEach((sel) => { const el = $(sel); if (el) el.innerHTML = ''; });
    INIT_KLAAR = false;
    ADMIN_KIES = null;
    POLL_TELLER = 0;
    laadState(true);
    verstuurWachtrij();          // openstaande vangsten van een vorige sessie
    SEIZOEN = null;
    laadSeizoen();
    POLL = setInterval(() => {
      POLL_TELLER += 1;
      if (document.hidden && POLL_TELLER % 10 !== 0) return; // op de achtergrond: 1x per minuut (accu)
      laadState(!INIT_KLAAR);
      if (POLL_TELLER % 5 === 0) verstuurWachtrij();   // elke 30s: staat er nog iets klaar?
      // seizoensstand rustig meeverversen (corrigeerde vangsten, nieuwe wedstrijden)
      if (SEIZOEN && POLL_TELLER % 10 === 0) laadSeizoen();
    }, 6000);
    KLOKTIK = setInterval(tikKlok, 1000);
  } else if (location.hash === '#/beheerder') {
    // verborgen support-omgeving (KemblincK); geen knop op de homepagina
    CODE = null; KIJKER = false;
    $('#topcode').textContent = 'beheer';
    toonView('beheerder');
    initSu();
  } else if (location.hash === '#/org') {
    if (!sessie.orgWw()) { location.hash = ''; return; }
    CODE = null; KIJKER = false;
    $('#topcode').textContent = 'organisatie';
    toonView('org');
    toonOrgVak(null);   // altijd op het overzicht binnenkomen (fase 5)
    laadOrg(true);
    ORG_POLL = setInterval(() => laadOrg(false), 10000);
  } else {
    // alleen bij de START van de app (niet bij elke hashchange): anders wordt de
    // browser-terugknop een verborgen herlaad en gooit "uitloggen" de organisator
    // een wedstrijd in
    if (initieel === true && hervatLaatste()) return;
    CODE = null; KIJKER = false;
    $('#topcode').textContent = '';
    toonView('home');
    renderVerderKaart();
  }
rg: docs/config.js: No such file or directory (os error 2)
docs/demo/index.html:526:  <section id="tab-beheer" class="tab" hidden>
docs/demo/index.html:675:<script src="config.js"></script>
docs/demo/index.html:676:<script src="kaart.js"></script>
docs/demo/index.html:677:<script src="/app.js"></script>
docs/app.js:472:  initHome(); initWedstrijd(); route(true);
docs/app.js:534:    renderTabs();
docs/app.js:619:const TEGELS = () => typeof NAV_TEGELS !== 'undefined' && !!NAV_TEGELS;
docs/app.js:671:  const blokken = document.querySelectorAll('#tab-beheer .beheer-blok');
docs/app.js:677:function renderTabs() {
docs/app.js:936:      renderTabs();
docs/app.js:1169:function wisOrgScherm() {
docs/app.js:2485:  renderTabs();
docs/app.js:2886:function initWedstrijd() {

  const duoMaatVan = (t) => t.duo_id
    ? STATE.teams.find((x) => x.duo_id === t.duo_id && x.id !== t.id) : null;
  $('#b-teams').innerHTML = STATE.teams.length ? STATE.teams.map((t) => `
    <div class="b-rij">
      <span class="naam">${teamNaamHtml(t)}${duoMaatVan(t)
        ? ` <span class="duo-label">🎣 duo met ${esc(duoMaatVan(t).naam)}</span>`
        : ''}${t.foto_toestemming ? ' <span class="foto-ok-label" title="foto\'s mogen op de socials van de viswedstrijdapp">📸 socials ok</span>' : ''}</span>
      <span class="muted klein">${t.lot_nummer ? 'lot ' + t.lot_nummer : ''} ${t.zone ? '· ' + esc(zoneLabel(t.zone)) : (t.stekken || []).length ? '· stek ' + t.stekken.join('+') : ''}</span>
      <span class="muted klein">🔑 <b class="codegroot klein-code" data-team-code="${t.id}">·····</b></span>
      ${w.status === 'stekkeuze' && !(t.stekken || []).length ? `<button class="btn klein-btn" data-team-kies="${t.id}">📍 geef plek</button>` : ''}
      ${w.status !== 'aanmelden' && ((t.stekken || []).length || t.zone) ? `<button class="btn klein-btn" data-team-wis="${t.id}" title="plek weer vrijgeven (alleen zonder vangsten)">🧹 plek wissen</button>` : ''}
      <button class="btn gevaar klein-btn" data-team-weg="${t.id}">verwijder</button>
    </div>`).join('') : '<p class="muted">Nog geen deelnemers.</p>';
  const codesSleutel = CODE + ':' + STATE.teams.map((t) => t.id).sort().join(',');
  const vulCodes = (codes) => {
    for (const c of codes || []) {
      const el = $('#b-teams').querySelector(`[data-team-code="${c.team_id}"]`);
      if (el) el.textContent = c.deelnemer_code;
    }
  };
  if (TEAMCODES_CACHE.sleutel === codesSleutel) {
    vulCodes(TEAMCODES_CACHE.codes);
  } else {
    rpc('w_admin_teamcodes', { p_code: CODE, p_pin: sessie.pin(CODE) }).then((codes) => {
      TEAMCODES_CACHE = { sleutel: codesSleutel, codes: codes || [] };
      vulCodes(codes);
    }).catch(() => {});
  }
  $('#b-teams').querySelectorAll('[data-team-weg]').forEach((b) => {
    const geloot = w.status !== 'aanmelden';
    b.onclick = () => tikNogmaals(b, geloot ? '⚠️ incl. vangsten, zeker?' : 'zeker?', () =>
      beheerActie('w_admin_verwijder_team', { p_team_id: b.dataset.teamWeg }));
  });
  $('#b-teams').querySelectorAll('[data-team-wis]').forEach((b) => {
    b.onclick = () => tikNogmaals(b, 'plek vrijgeven, zeker?', () =>
      beheerActie('w_admin_wis_plek', { p_team_id: b.dataset.teamWis }));
  });
  $('#b-teams').querySelectorAll('[data-team-kies]').forEach((b) => {
    b.onclick = () => {
      const t = STATE.teams.find((x) => x.id === b.dataset.teamKies);
      if (!t) return;
      ADMIN_KIES = { teamId: t.id, naam: teamNaam(t) };
      SELECTIE = []; SELECTIE_ZONE = null;
      activateTab('kaart');
      renderKaart();
      window.scrollTo({ top: 0, behavior: 'smooth' });

codex
De poll vervangt de inhoud van de lijsten, maar laat de paneelsecties en `<details>` zelf staan. Een geopend paneel klapt daardoor niet vanzelf dicht. Wel blijft bij ‘Als sjabloon’ het ingevulde formulier verborgen, en kunnen opslagfouten onzichtbaar binnenkomen nadat de gebruiker een paneel heeft verlaten of een blok heeft dichtgeklapt.

exec
/bin/zsh -lc "sed -n '119,147p' docs/styles.css; sed -n '1434,1495p' docs/app.js; rg -n 'form-seizoen|seizoen-fout|sz-fout|NAV_TEGELS|outline' docs/app.js docs/demo/config.js docs/nphv/config.js docs/styles.css; sed -n '2890,2920p' docs/app.js; sed -n '192,240p' docs/demo/index.html" in /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
 succeeded in 0ms:
label input, label select { margin-top: 5px; font-weight: 400; }
.stack { display: flex; flex-direction: column; }
.row { display: flex; gap: 8px; }
.row input { flex: 1; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.row2 input { min-width: 0; }
@media (max-width: 430px) { .row2 { grid-template-columns: 1fr; } }

.btn {
  padding: 10px 16px; border: none; border-radius: 10px; cursor: pointer;
  background: #f1eedd; color: var(--blauw-donker); font-weight: 700;
  border: 1.5px solid var(--kaart-rand); min-height: 44px;
}
.btn.primary { background: var(--blauw); color: #fff; }
.btn.gevaar { background: #f3ded9; color: var(--rood); }
.btn.breed { width: 100%; padding: 14px; font-size: 17px; }
.knop-logo { width: 22px; height: 22px; border-radius: 50%; vertical-align: -5px; margin-right: 4px; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.klein-btn { padding: 4px 10px; font-size: 12px; }


/* klok */
.klok-card { text-align: center; }
.w-kop { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
.chip {
  background: var(--blauw-licht); color: var(--blauw-donker);
  border-radius: 999px; padding: 3px 12px; font-size: 13px; font-weight: 700;
}
.chip.live { background: #dcedc8; color: var(--groen); }
      const veld = document.querySelector(`[data-su-pinveld="${CSS.escape(b.dataset.suPinToon)}"]`);
      const pin = suPinVan(b.dataset.suPinToon);
      if (!veld || !pin) return;
      suActiviteit();
      const verborgen = veld.textContent.startsWith('\u2022');
      veld.textContent = verborgen ? pin : '\u2022\u2022\u2022\u2022';
      b.textContent = verborgen ? '\ud83d\ude48 verberg pin' : '\ud83d\udc41 toon pin';
    };
  });
  document.querySelectorAll('[data-su-kopieer]').forEach((b) => {
    b.onclick = async () => {
      const pin = suPinVan(b.dataset.suKopieer);
      if (!pin) return;
      suActiviteit();
      await kopieerTekst(pin);
      toast('Pin gekopieerd.');
    };
  });
}

function orgWedstrijdKaart(w, nuMs) {
  const actief = new Date(w.eind_ts).getTime() >= nuMs;
  const vol = w.max_teams && w.teams >= w.max_teams;
  const teller = w.max_teams ? `${w.teams}/${w.max_teams}` : `${w.teams}`;
  const fase = wedstrijdFase(w, nuMs);
  // de organisator ziet iets meer detail dan de beheerder: bezetting erbij
  const statusTekst = fase.sleutel === 'aanmelden'
    ? (vol ? `✅ compleet (${teller}) · klaar voor loting` : `aanmelden open · ${teller} aangemeld`)
    : fase.label;
  const gekoppeld = SEIZOEN_PER_CODE[w.code];
  const seizoenRegel = (ORG_SEIZOENEN && ORG_SEIZOENEN.length) ? `<div class="row org-seizoen muted klein" style="align-items:center; gap:6px; margin-top:4px">seizoen
      <select data-org-seizoen="${esc(w.code)}"><option value="">geen</option>
        ${ORG_SEIZOENEN.map((z) => `<option value="${esc(z.id)}"${gekoppeld && gekoppeld.id === z.id ? ' selected' : ''}>${esc(z.naam)}</option>`).join('')}
      </select>
      ${gekoppeld ? `<select data-org-dagregel="${esc(w.code)}" title="wat telt bij exact gelijk gewicht in de daguitslag">
        <option value="">gelijk gewicht: seizoensregel</option>
        <option value="app"${gekoppeld.ex === 'app' ? ' selected' : ''}>gelijk gewicht: grootste vis</option>
        <option value="sportvisunie"${gekoppeld.ex === 'sportvisunie' ? ' selected' : ''}>gelijk gewicht: gedeelde plaats</option>
        <option value="karper"${gekoppeld.ex === 'karper' ? ' selected' : ''}>gelijk gewicht: karper (KKKC)</option>
      </select>` : ''}
    </div>` : '';
  return `<div class="org-w">
    <div class="org-w-kop">
      <span class="w-icoon ${fase.klasse}" aria-hidden="true">${fase.icoon}</span>
      <b>${esc(w.naam)}</b>
      <span class="chip ${fase.klasse}">${esc(statusTekst)}</span>
    </div>
    <div class="w-kenmerken">${wedstrijdKenmerken(w, gekoppeld ? gekoppeld.naam : null)}</div>
    <div class="muted klein">${fmtDatumTijd(w.start_ts)} tot ${fmtDatumTijd(w.eind_ts)} ·
      ${w.max_teams ? `${w.teams}/${w.max_teams}` : w.teams} team${w.teams === 1 && !w.max_teams ? '' : 's'} · ${w.vangsten} vangst${w.vangsten === 1 ? '' : 'en'}</div>
    <div class="org-codes muted klein">deelnemerscode <b class="codegroot klein-code">${esc(w.code)}</b>
      · kijkcode <b class="codegroot klein-code">${esc(w.kijk_code)}</b></div>
    ${seizoenRegel}
    <div class="row org-acties">
      <button class="btn primary" data-org-open="${esc(w.code)}">Openen &amp; beheren</button>
      ${w.status === 'aanmelden' && actief ? `<button class="btn" data-org-loting="${esc(w.code)}">🎲 Start loting</button>` : ''}
      <button class="btn" data-org-sjabloon="${esc(w.code)}" title="Vul het formulier 'Nieuwe wedstrijd' met de instellingen van deze wedstrijd">\ud83d\udccb Als sjabloon</button>
      <button class="btn gevaar" data-org-verwijder="${esc(w.code)}" data-naam="${esc(w.naam)}">🗑️</button>
    </div>
  </div>`;
}

docs/styles.css:116:input:focus, select:focus { outline: 2px solid var(--blauw-mid); border-color: var(--blauw-mid); }
docs/styles.css:283:.lightbox .sluit:focus-visible { outline: 2px solid #fff; border-radius: 8px; }
docs/styles.css:328:textarea:focus { outline: 2px solid var(--blauw-mid); border-color: var(--blauw-mid); }
docs/styles.css:604:   Alleen actief als config.js NAV_TEGELS aanzet: app.js zet dan body.nav-tegels.
docs/app.js:617:// NAV_TEGELS in config.js: eerst demo, daarna NPHV. Staat de vlag uit, dan is
docs/app.js:619:const TEGELS = () => typeof NAV_TEGELS !== 'undefined' && !!NAV_TEGELS;
docs/app.js:1071:// terugknop erboven. Zonder NAV_TEGELS staat alles onder elkaar zoals voorheen.
docs/app.js:3068:  $('#form-seizoen')?.addEventListener('submit', async (e) => {
docs/app.js:3070:    const foutEl = $('#seizoen-fout');
docs/demo/config.js:9:const NAV_TEGELS = true;
docs/nphv/config.js:9:const NAV_TEGELS = false;
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('actief', x === b));
    document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== 'tab-' + b.dataset.tab; });
    renderSnelVangst();  // knop hoort weg te zijn op de vangsten-tab zelf
    merkOnderbalk(b.dataset.tab);
  });

  // ---- tegelnavigatie (v101) ----
  // Alles hieronder navigeert via activateTab naar de BESTAANDE tabs. De tegels
  // en de onderbalk zijn dus presentatie; rolcontrole en rendering blijven waar
  // ze stonden.
  const ga = (doel) => {
    sluitMeer();
    if (doel === 'home') { $('#btn-terug')?.click(); return; }   // label in renderMeer volgt de rol
    if (doel === 'loting') {   // loting is geen eigen tab: de kaartweergave, maar dan bij de lijst
      activateTab('kaart');
      setTimeout(() => $('#loting-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      return;
    }
    activateTab(doel);
    if (doel === 'overzicht') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // organisatieomgeving: rijen openen een onderdeel, de knop erboven gaat terug
  document.addEventListener('click', (e) => {
    const rij = e.target.closest('#org-overzicht [data-orgnaar]');
    if (rij) { toonOrgVak(rij.dataset.orgnaar); return; }
    if (e.target.closest('#org-terug')) toonOrgVak(null);
  });

  // bewust begrensd tot de nieuwe navigatie-onderdelen, zodat deze handler nooit
  // een bestaande knop elders kan kapen (Codex fase 4)
  document.addEventListener('click', (e) => {
    </form>
  </section>

  <section class="card" data-orgvak="seizoen">
    <h2>Seizoenen (competitie)</h2>
    <p class="muted klein">Een seizoen telt de uitslagen van meerdere wedstrijden op tot een
    doorlopend klassement (regels naar de Sportvisunie-reglementen, per seizoen instelbaar).
    Koppel wedstrijden via de wedstrijdkaarten hierboven; deelnemers en kijkers zien dan
    een extra tabblad Seizoen.</p>
    <div id="org-seizoenen"></div>
    <form id="form-seizoen" class="stack">
      <label>Naam van het seizoen
        <input id="sz-naam" type="text" maxlength="60" placeholder="bijv. Zomercompetitie 2027" required>
      </label>
      <label>Telling
        <select id="sz-telling">
          <option value="plaatspunten">Plaatspunten: dagklassering = punten, minste punten wint (Sportvisunie)</option>
          <option value="totaalgewicht">Totaalgewicht: alle kilo's opgeteld, meeste wint (simpel)</option>
        </select>
      </label>
      <label>Aftrekwedstrijden <span class="muted">(aantal slechtste resultaten dat vervalt)</span>
        <input id="sz-aftrek" type="number" inputmode="numeric" min="0" max="20" value="1">
      </label>
      <label>Deelnemer zonder vangst krijgt
        <select id="sz-nietvanger">
          <option value="gemiddelde">gemiddelde van (vangers + 1) en aantal deelnemers (Sportvisunie ONK)</option>
          <option value="vangers_plus_1">aantal vangers + 1</option>
          <option value="max_plus_1">hoogste uitgedeelde punten + 1</option>
        </select>
      </label>
      <label>Wedstrijd gemist
        <select id="sz-gemist">
          <option value="hoogste_plus_1">hoogste punten van die wedstrijd + 1 (Sportvisunie TTC)</option>
          <option value="deelnemers_plus_1">aantal deelnemers + 1</option>
        </select>
      </label>
      <label>Bij exact gelijk gewicht in een daguitslag
        <select id="sz-exaequo">
          <option value="app">grootste vis wint, dan vroegst gevangen (app-standaard)</option>
          <option value="sportvisunie">gedeelde plaats, doortellen (Sportvisunie)</option>
          <option value="karper">meeste vissen wint, dan grootste vis het eerst (karper/KKKC)</option>
        </select>
      </label>
      <button type="submit" class="btn primary">Seizoen aanmaken</button>
      <p id="seizoen-fout" class="fout" hidden></p>
    </form>
  </section>

  <section class="card" data-orgvak="zones" id="org-zones-card">

codex
**Oordeel: eerst aanpassen.** Ik zie concrete regressies bij sjablonen, foutmeldingen, focus en de uitgeschakelde vlag. Een poll die het hele paneel sluit, zie ik juist niet.

STORM-check: beoordeeld op basis van de diff en de huidige lokale handlers, HTML en CSS. Het browsergedrag rond `summary` is getoetst aan documentatie. Geen praktijktest uitgevoerd met iPhone-PWA of VoiceOver.

1. **Middel: ‘Als sjabloon’ vult een verborgen formulier.**  
   **Bestand:** `docs/app.js`, `vulSjabloon()` rond regel 1502.  
   Open ‘Actieve wedstrijden’ of ‘Eerdere wedstrijden’ en kies ‘Als sjabloon’. De handler vult `#form-nieuw`, maar opent het paneel `nieuw` niet. `scrollIntoView()` en `focus()` maken een verborgen bovenliggende sectie niet zichtbaar. De knop lijkt niets te doen; de gekopieerde waarden worden pas zichtbaar als de gebruiker zelf naar ‘Nieuwe wedstrijd’ navigeert.  
   **Fix:** roep `toonOrgVak('nieuw')` aan vóór scrollen en focussen.

2. **Middel: opslagfouten kunnen onzichtbaar binnenkomen.**  
   **Bestand:** `docs/app.js`, handlers voor `#org-zones-opslaan`, `#form-nieuw`, `#form-seizoen` en `#b-zones-opslaan`.  
   Reproduceer met een trage verbinding: start opslaan, ga terug naar het organisatieoverzicht of sluit het blok ‘Zones’, en laat de aanvraag mislukken. De handler maakt alleen de fouttekst zichtbaar. De bovenliggende sectie blijft verborgen of het `<details>` blijft gesloten. De gebruiker krijgt geen zichtbare aanwijzing dat opslaan is mislukt.  
   **Fix:** toon de fout ook buiten het paneel, met een blijvende melding en een knop naar het betreffende onderdeel. Bij gesloten beheerblokken kan ook een foutindicator op de `summary` worden gezet.

   **Formulieren:** verbergen start zelf geen submit. Een al gestarte submit loopt wel door. Bij ‘Nieuwe wedstrijd’ kan de succesvolle respons daardoor alsnog naar de aangemaakte wedstrijd navigeren nadat de gebruiker naar het overzicht is teruggegaan.

3. **Middel: paneelnavigatie heeft geen focusoverdracht.**  
   **Bestand:** `docs/app.js`, `toonOrgVak()` rond regel 1073.  
   De functie verbergt de aangeklikte overzichtsknop, maar verplaatst de focus niet naar het geopende paneel. Bij teruggaan wordt ook de terugknop zelf verborgen zonder focusherstel. Scrollen is geen focusbeheer. Toetsenbord- en schermlezergebruikers verliezen daardoor hun navigatiepositie; de precieze terugval verschilt per browser.  
   **Fix:** focus bij openen de paneelkop met `tabindex="-1"` en herstel bij teruggaan de focus op de bijbehorende overzichtsknop. Voer dit uitsluitend bij gebruikersnavigatie uit, niet tijdens polling.

4. **Middel: NPHV krijgt de nieuwe interactie ondanks `NAV_TEGELS = false`.**  
   **Bestanden:** `docs/nphv/index.html`, de vier `.beheer-blok`-elementen; `docs/app.js`, `zetBeheerBlokken()`; `docs/styles.css` vanaf regel 707.  
   De vlag zet de blokken slechts één keer open. Het blijven bedienbare `<details>` die gebruikers vervolgens kunnen sluiten. De pijlen, extra focusstops en gewijzigde opmaak gelden eveneens zonder vlag. Die gesloten toestand blijft bij volgende renders behouden. De bewering ‘gelijk aan v103’ klopt dus niet.  
   **Fix:** behoud bij uitgeschakelde vlag de oorspronkelijke statische kaarten, of maak expliciet een statische variant met gewone koppen en altijd zichtbare inhoud. Alleen de pijlen verbergen is onvoldoende.

5. **Middel: het overzicht verbergt een bestaande actieaanwijzing.**  
   **Bestand:** `docs/app.js`, `renderOrgOverzicht()` tegenover `orgWedstrijdKaart()`.  
   De wedstrijdkaart toont bij een volle wedstrijd ‘compleet · klaar voor loting’. Op het nieuwe overzicht staan uitsluitend aantallen wedstrijden en seizoenen. Wanneer een wedstrijd vol raakt terwijl de organisator op het overzicht blijft, verandert daar geen actie-indicator. De aanwijzing wordt alleen in het verborgen paneel bijgewerkt.  
   **Fix:** voeg bijvoorbeeld ‘1 wedstrijd klaar voor loting’ toe aan de rij ‘Actieve wedstrijden’. Dit is een verlies aan zichtbaarheid, geen onbereikbare functie.

6. **Laag: bestaande instructies verwijzen naar verborgen onderdelen.**  
   **Bestanden:** beide `index.html`-bestanden bij ‘Seizoenen’; `docs/app.js`, `renderOrg()` en `renderOrgSeizoenen()`.  
   ‘Koppel wedstrijden via de wedstrijdkaarten hierboven’ en ‘Maak er hieronder een aan’ kloppen bij panelen niet meer. Die onderdelen staan in een ander paneel.  
   **Fix:** gebruik bij ingeschakelde vlag concrete navigatieknoppen naar ‘Actieve wedstrijden’ en ‘Nieuwe wedstrijd’.

7. **Laag, compatibiliteitsrisico: de `h2` binnen `summary` is niet overal als kop beschikbaar.**  
   **Bestanden:** beide `index.html`-bestanden, de vier beheerblokken.  
   Dit is **geldige HTML**, maar sommige browser- en schermlezercombinaties verliezen de kopsemantiek binnen `summary`. Daardoor kan navigatie via koppen afwijken. [MDN beschrijft deze beperking](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/summary).  
   **Fix:** test de koppenlijst en bediening met VoiceOver in Safari én de beginscherm-app. Gebruik zo nodig een aparte kop met een disclosureknop wanneer betrouwbare kopnavigatie vereist is.

**Wat ik niet als fout aanmerk:**

- **Polling sluit geen panelen of beheerblokken.** `renderOrg()` vervangt de binnenste wedstrijdlijsten. `renderBeheer()` vervangt onder andere `#b-teams`, niet de omringende `<details>`. `toonOrgVak(null)` wordt bij routing aangeroepen, niet bij iedere poll. Een afgelopen wedstrijd kan wel naar het verborgen paneel ‘Eerdere wedstrijden’ verhuizen.
- **De eenmalige initialisatie gaat in deze DOM-opzet niet mis.** De beheerblokken staan al in de HTML. Verborgen elementen worden gewoon gevonden. Bij nul gevonden blokken blijft de boolean `false`, zodat een volgende aanroep opnieuw probeert. Wedstrijdwissels en uitloggen vervangen deze elementen niet. Open/dicht-keuzes blijven daardoor behouden. Alleen bij toekomstige DOM-vervanging of gedeeltelijk later ingevoegde blokken wordt de globale boolean problematisch; initialisatie per element is dan robuuster.
- **De nieuwe navigatieknoppen veroorzaken geen onbedoelde form-submit:** ze staan buiten formulieren. `type="button"` toevoegen is wel verstandig.
- **Geen ontbrekende toetsenbordbediening aangetoond:** native buttons en `summary` zijn bedienbaar. De CSS verwijdert hun focus-outline niet. Het concrete toegankelijkheidsprobleem zit hier vooral in de ontbrekende focusoverdracht.
tokens used
42.897
**Oordeel: eerst aanpassen.** Ik zie concrete regressies bij sjablonen, foutmeldingen, focus en de uitgeschakelde vlag. Een poll die het hele paneel sluit, zie ik juist niet.

STORM-check: beoordeeld op basis van de diff en de huidige lokale handlers, HTML en CSS. Het browsergedrag rond `summary` is getoetst aan documentatie. Geen praktijktest uitgevoerd met iPhone-PWA of VoiceOver.

1. **Middel: ‘Als sjabloon’ vult een verborgen formulier.**  
   **Bestand:** `docs/app.js`, `vulSjabloon()` rond regel 1502.  
   Open ‘Actieve wedstrijden’ of ‘Eerdere wedstrijden’ en kies ‘Als sjabloon’. De handler vult `#form-nieuw`, maar opent het paneel `nieuw` niet. `scrollIntoView()` en `focus()` maken een verborgen bovenliggende sectie niet zichtbaar. De knop lijkt niets te doen; de gekopieerde waarden worden pas zichtbaar als de gebruiker zelf naar ‘Nieuwe wedstrijd’ navigeert.  
   **Fix:** roep `toonOrgVak('nieuw')` aan vóór scrollen en focussen.

2. **Middel: opslagfouten kunnen onzichtbaar binnenkomen.**  
   **Bestand:** `docs/app.js`, handlers voor `#org-zones-opslaan`, `#form-nieuw`, `#form-seizoen` en `#b-zones-opslaan`.  
   Reproduceer met een trage verbinding: start opslaan, ga terug naar het organisatieoverzicht of sluit het blok ‘Zones’, en laat de aanvraag mislukken. De handler maakt alleen de fouttekst zichtbaar. De bovenliggende sectie blijft verborgen of het `<details>` blijft gesloten. De gebruiker krijgt geen zichtbare aanwijzing dat opslaan is mislukt.  
   **Fix:** toon de fout ook buiten het paneel, met een blijvende melding en een knop naar het betreffende onderdeel. Bij gesloten beheerblokken kan ook een foutindicator op de `summary` worden gezet.

   **Formulieren:** verbergen start zelf geen submit. Een al gestarte submit loopt wel door. Bij ‘Nieuwe wedstrijd’ kan de succesvolle respons daardoor alsnog naar de aangemaakte wedstrijd navigeren nadat de gebruiker naar het overzicht is teruggegaan.

3. **Middel: paneelnavigatie heeft geen focusoverdracht.**  
   **Bestand:** `docs/app.js`, `toonOrgVak()` rond regel 1073.  
   De functie verbergt de aangeklikte overzichtsknop, maar verplaatst de focus niet naar het geopende paneel. Bij teruggaan wordt ook de terugknop zelf verborgen zonder focusherstel. Scrollen is geen focusbeheer. Toetsenbord- en schermlezergebruikers verliezen daardoor hun navigatiepositie; de precieze terugval verschilt per browser.  
   **Fix:** focus bij openen de paneelkop met `tabindex="-1"` en herstel bij teruggaan de focus op de bijbehorende overzichtsknop. Voer dit uitsluitend bij gebruikersnavigatie uit, niet tijdens polling.

4. **Middel: NPHV krijgt de nieuwe interactie ondanks `NAV_TEGELS = false`.**  
   **Bestanden:** `docs/nphv/index.html`, de vier `.beheer-blok`-elementen; `docs/app.js`, `zetBeheerBlokken()`; `docs/styles.css` vanaf regel 707.  
   De vlag zet de blokken slechts één keer open. Het blijven bedienbare `<details>` die gebruikers vervolgens kunnen sluiten. De pijlen, extra focusstops en gewijzigde opmaak gelden eveneens zonder vlag. Die gesloten toestand blijft bij volgende renders behouden. De bewering ‘gelijk aan v103’ klopt dus niet.  
   **Fix:** behoud bij uitgeschakelde vlag de oorspronkelijke statische kaarten, of maak expliciet een statische variant met gewone koppen en altijd zichtbare inhoud. Alleen de pijlen verbergen is onvoldoende.

5. **Middel: het overzicht verbergt een bestaande actieaanwijzing.**  
   **Bestand:** `docs/app.js`, `renderOrgOverzicht()` tegenover `orgWedstrijdKaart()`.  
   De wedstrijdkaart toont bij een volle wedstrijd ‘compleet · klaar voor loting’. Op het nieuwe overzicht staan uitsluitend aantallen wedstrijden en seizoenen. Wanneer een wedstrijd vol raakt terwijl de organisator op het overzicht blijft, verandert daar geen actie-indicator. De aanwijzing wordt alleen in het verborgen paneel bijgewerkt.  
   **Fix:** voeg bijvoorbeeld ‘1 wedstrijd klaar voor loting’ toe aan de rij ‘Actieve wedstrijden’. Dit is een verlies aan zichtbaarheid, geen onbereikbare functie.

6. **Laag: bestaande instructies verwijzen naar verborgen onderdelen.**  
   **Bestanden:** beide `index.html`-bestanden bij ‘Seizoenen’; `docs/app.js`, `renderOrg()` en `renderOrgSeizoenen()`.  
   ‘Koppel wedstrijden via de wedstrijdkaarten hierboven’ en ‘Maak er hieronder een aan’ kloppen bij panelen niet meer. Die onderdelen staan in een ander paneel.  
   **Fix:** gebruik bij ingeschakelde vlag concrete navigatieknoppen naar ‘Actieve wedstrijden’ en ‘Nieuwe wedstrijd’.

7. **Laag, compatibiliteitsrisico: de `h2` binnen `summary` is niet overal als kop beschikbaar.**  
   **Bestanden:** beide `index.html`-bestanden, de vier beheerblokken.  
   Dit is **geldige HTML**, maar sommige browser- en schermlezercombinaties verliezen de kopsemantiek binnen `summary`. Daardoor kan navigatie via koppen afwijken. [MDN beschrijft deze beperking](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/summary).  
   **Fix:** test de koppenlijst en bediening met VoiceOver in Safari én de beginscherm-app. Gebruik zo nodig een aparte kop met een disclosureknop wanneer betrouwbare kopnavigatie vereist is.

**Wat ik niet als fout aanmerk:**

- **Polling sluit geen panelen of beheerblokken.** `renderOrg()` vervangt de binnenste wedstrijdlijsten. `renderBeheer()` vervangt onder andere `#b-teams`, niet de omringende `<details>`. `toonOrgVak(null)` wordt bij routing aangeroepen, niet bij iedere poll. Een afgelopen wedstrijd kan wel naar het verborgen paneel ‘Eerdere wedstrijden’ verhuizen.
- **De eenmalige initialisatie gaat in deze DOM-opzet niet mis.** De beheerblokken staan al in de HTML. Verborgen elementen worden gewoon gevonden. Bij nul gevonden blokken blijft de boolean `false`, zodat een volgende aanroep opnieuw probeert. Wedstrijdwissels en uitloggen vervangen deze elementen niet. Open/dicht-keuzes blijven daardoor behouden. Alleen bij toekomstige DOM-vervanging of gedeeltelijk later ingevoegde blokken wordt de globale boolean problematisch; initialisatie per element is dan robuuster.
- **De nieuwe navigatieknoppen veroorzaken geen onbedoelde form-submit:** ze staan buiten formulieren. `type="button"` toevoegen is wel verstandig.
- **Geen ontbrekende toetsenbordbediening aangetoond:** native buttons en `summary` zijn bedienbaar. De CSS verwijdert hun focus-outline niet. Het concrete toegankelijkheidsprobleem zit hier vooral in de ontbrekende focusoverdracht.

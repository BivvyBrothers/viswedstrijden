OpenAI Codex v0.154.0
--------
workdir: /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
model: gpt-6-astra
provider: openai
approval: never
sandbox: read-only
reasoning effort: medium
reasoning summaries: none
session id: 01a0c0c6-ed70-7b83-89fa-64c30a684de7
--------
user
Beoordeel deze diff van een vanilla-JS webapp voor viswedstrijden (geen build, geen framework).
Het is fase 4 van een herontwerp: er komt een tegeloverzicht binnen een wedstrijd plus een vaste
navigatiebalk onderaan, achter een per-tenant vlag NAV_TEGELS in config.js (nu alleen aan op de demo).

Context die je moet weten:
- De app heeft rollen: kijker, deelnemer, organisator. TABS_PER_ROL bepaalt welke tabs een rol mag zien
  en activateTab weigert alles buiten die lijst; dat is een beveiligingsgrens die niet mag verzwakken.
- De bestaande tabbalk #tabs blijft bestaan; de nieuwe onderbalk en de tegels navigeren ernaartoe.
- route() draait bij elke hashwissel en bij de start; er loopt een poll elke 6 seconden die renderTabs aanroept.
- De app draait ook als beginscherm-app (PWA) op iPhone.

Vragen:
1. Zitten er fouten in die bij een gebruiker fout gaan? Denk aan: een kijker die via het Meer-paneel of
   een tegel op een deelnemersscherm komt, een paneel dat open blijft staan bij een routewissel of bij het
   wisselen van wedstrijd, dubbele event-handlers door de globale document-click, of geheugenlekken.
2. Kan de nieuwe globale click-handler op document bestaande knoppen kapen? Let op data-ga en data-meer.
3. Is er iets dat stuk gaat als de vlag UIT staat (NPHV), of als STATE nog null is bij de eerste render?
4. Toegankelijkheid en mobiel gebruik: raakvlakken, safe-area, focus.
Noem per bevinding: bestand, wat er misgaat, en de ernst (hoog/middel/laag). Wees concreet.
diff --git a/docs/app.js b/docs/app.js
index d5d7497..dd4381d 100644
--- a/docs/app.js
+++ b/docs/app.js
@@ -1,7 +1,7 @@
 /* Viswedstrijden Plas van der Ende - app-logica */
 'use strict';
 
-const APP_VERSION = 100; // gelijk houden met ELKE tenant-version.json (docs/*/version.json); verhogen bij elke release
+const APP_VERSION = 101; // gelijk houden met ELKE tenant-version.json (docs/*/version.json); verhogen bij elke release
 
 /* ---------- helpers ---------- */
 const $ = (sel) => document.querySelector(sel);
@@ -531,7 +531,10 @@ function route(initieel) {
     toonView('wedstrijd');
     ROL = KIJKER ? 'kijker' : 'deelnemer';
     renderTabs();
-    if (KIJKER) activateTab('klassement');   // kijkers landen op het klassement, niet op de kaart
+    // met tegelnavigatie is het overzicht de thuisbasis voor elke rol; zonder
+    // tegels blijft het oude gedrag (kijker landt op het klassement)
+    if (TEGELS()) activateTab('overzicht');
+    else if (KIJKER) activateTab('klassement');
     SELECTIE = []; SELECTIE_ZONE = null;
     ADMIN_OPEN = false;
     STATE = null;
@@ -596,11 +599,16 @@ function toonView(naam) {
 function activateTab(naam) {
   // alleen tabs die bij de huidige rol horen (Codex v89: een oude knop mocht
   // een kijker naar de deelnemerstab sturen)
-  if (!(TABS_PER_ROL[ROL] || TABS_PER_ROL.deelnemer).includes(naam)) return;
+  if (!tabsVanRol().includes(naam)) return;
   const b = document.querySelector(`#tabs button[data-tab=${naam}]`);
   if (b) b.click();
 }
 
+// Tegelnavigatie (v101, fase 4 van het ontwerp). Per tenant aan te zetten met
+// NAV_TEGELS in config.js: eerst demo, daarna NPHV. Staat de vlag uit, dan is
+// alles precies als voorheen; het overzicht en de onderbalk blijven verborgen.
+const TEGELS = () => typeof NAV_TEGELS !== 'undefined' && !!NAV_TEGELS;
+
 // welke tabs elke rol ziet
 const TABS_PER_ROL = {
   // kijkers (v89, uit de Carpclassic-evaluatie): ook de kaart (wie zit waar) en
@@ -609,6 +617,35 @@ const TABS_PER_ROL = {
   deelnemer: ['kaart', 'klassement', 'vangsten', 'team', 'seizoen'],
   organisator: ['kaart', 'klassement', 'vangsten', 'seizoen', 'beheer'],
 };
+// Labels voor de tegels, de onderbalk en het Meer-paneel op één plek
+function tabLabel(naam) {
+  if (naam === 'team') return STATE?.wedstrijd?.mode === 'koppel' ? 'Mijn team' : 'Mijn deelname';
+  return { overzicht: 'Overzicht', kaart: 'Kaart & loting', klassement: 'Klassement',
+    vangsten: 'Vangsten', seizoen: 'Seizoen', beheer: 'Beheer' }[naam] || naam;
+}
+
+// Het Meer-paneel bevat alles wat niet in de onderbalk past, in de volgorde van
+// de rol. De lijst komt uit dezelfde bron als de tabbalk, dus een kijker krijgt
+// hier nooit een deelnemersscherm te zien.
+const ONDERBALK = ['overzicht', 'kaart', 'vangsten'];
+function renderMeer(zichtbaar) {
+  const vak = $('#meer-knoppen');
+  if (!vak) return;
+  const rest = zichtbaar.filter((n) => !ONDERBALK.includes(n));
+  vak.innerHTML = rest.map((n) =>
+    `<button class="meer-knop" data-ga="${n}">${esc(tabLabel(n))}<span aria-hidden="true">&rsaquo;</span></button>`).join('')
+    + '<button class="meer-knop" data-ga="home">Naar het startscherm<span aria-hidden="true">&rsaquo;</span></button>';
+}
+
+// De tabs van deze rol, met het overzicht vooraan zodra de tegelnavigatie aan
+// staat. Eén bron voor renderTabs, activateTab en het Meer-paneel, zodat de
+// rolbeperking maar op één plek staat.
+function tabsVanRol() {
+  const lijst = (TABS_PER_ROL[ROL] || TABS_PER_ROL.deelnemer).slice();
+  if (TEGELS()) lijst.unshift('overzicht');
+  return lijst;
+}
+
 function renderTabs() {
   // duidelijker labels (klantvraag NPHV): bij een individuele wedstrijd is
   // "Mijn team" verwarrend, daar heet de tab "Mijn deelname"
@@ -617,12 +654,17 @@ function renderTabs() {
     teamKnop.textContent = STATE.wedstrijd.mode === 'koppel' ? 'Mijn team' : 'Mijn deelname';
   }
   // de seizoen-tab bestaat alleen als deze wedstrijd bij een seizoen hoort
-  const zichtbaar = (TABS_PER_ROL[ROL] || TABS_PER_ROL.deelnemer)
+  const zichtbaar = tabsVanRol()
     .filter((naam) => naam !== 'seizoen' || !!SEIZOEN);
   $('#tabs').hidden = false;
   document.body.classList.toggle('rol-kijker', ROL === 'kijker');
+  document.body.classList.toggle('nav-tegels', TEGELS());
+  const balkOnder = $('#onderbalk');
+  if (balkOnder) balkOnder.hidden = !TEGELS();
+  renderMeer(zichtbaar);
   document.querySelectorAll('#tabs button').forEach((b) => {
-    b.hidden = !zichtbaar.includes(b.dataset.tab);
+    // 'overzicht' bestaat alleen als navigatiedoel; de knop ervoor staat onderaan
+    b.hidden = b.dataset.tab === 'overzicht' || !zichtbaar.includes(b.dataset.tab);
   });
   // knoppen in de tabbalk in de volgorde van de rol zetten (kijker: klassement eerst)
   const balk = $('#tabs');
@@ -924,6 +966,31 @@ function renderAlles(eerste) {
   renderSnelVangst();
 }
 
+// De knop in de onderbalk die bij de huidige tab hoort krijgt de actieve stijl.
+// 'loting' valt onder Kaart, alles wat niet in de balk staat onder Meer.
+function merkOnderbalk(tab) {
+  const balk = $('#onderbalk');
+  if (!balk) return;
+  balk.querySelectorAll('button').forEach((b) => {
+    const doel = b.dataset.ga;
+    b.classList.toggle('aan', doel ? doel === tab : !ONDERBALK.includes(tab));
+  });
+  // op het overzicht is de bovenste tabbalk dubbelop; in detailschermen blijft hij
+  document.body.classList.toggle('op-overzicht', tab === 'overzicht');
+}
+function toonMeer() {
+  const paneel = $('#meer-paneel');
+  if (!paneel) return;
+  paneel.hidden = false;
+  document.body.classList.add('meer-open');
+}
+function sluitMeer() {
+  const paneel = $('#meer-paneel');
+  if (!paneel) return;
+  paneel.hidden = true;
+  document.body.classList.remove('meer-open');
+}
+
 // Zwevende hoofdactie voor de deelnemer zolang de wedstrijd loopt: registreren
 // is dan de enige handeling die telt, en je hebt vaak natte handen of felle zon.
 // Verdwijnt zodra je op de vangsten-tab staat (daar staat het formulier al).
@@ -2689,6 +2756,29 @@ function initWedstrijd() {
     document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('actief', x === b));
     document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== 'tab-' + b.dataset.tab; });
     renderSnelVangst();  // knop hoort weg te zijn op de vangsten-tab zelf
+    merkOnderbalk(b.dataset.tab);
+  });
+
+  // ---- tegelnavigatie (v101) ----
+  // Alles hieronder navigeert via activateTab naar de BESTAANDE tabs. De tegels
+  // en de onderbalk zijn dus presentatie; rolcontrole en rendering blijven waar
+  // ze stonden.
+  const ga = (doel) => {
+    sluitMeer();
+    if (doel === 'home') { $('#btn-terug')?.click(); return; }
+    if (doel === 'loting') {   // loting is geen eigen tab: de kaartweergave, maar dan bij de lijst
+      activateTab('kaart');
+      setTimeout(() => $('#loting-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
+      return;
+    }
+    activateTab(doel);
+    if (doel === 'overzicht') window.scrollTo({ top: 0, behavior: 'smooth' });
+  };
+  document.addEventListener('click', (e) => {
+    const knop = e.target.closest('[data-ga]');
+    if (knop) { ga(knop.dataset.ga); return; }
+    if (e.target.closest('[data-meer]')) { toonMeer(); return; }
+    if (e.target.closest('[data-meer-sluit]')) sluitMeer();
   });
 
   $('#kl-totaal').addEventListener('click', () => { KLASSEMENT_MODE = 'totaal'; renderKlassement(); });
diff --git a/docs/demo/config.js b/docs/demo/config.js
index 339eaf1..02841e2 100644
--- a/docs/demo/config.js
+++ b/docs/demo/config.js
@@ -4,3 +4,6 @@ const SB_KEY = 'sb_publishable_0sb4MYouujq5bmE6svX6Hg_EzPViAJK';
 const FOTO_BUCKET = 'wedstrijd-fotos';
 const TENANT = 'demo'; // tenant-slug = klant in de database
 const VAPID_PUBLIC = 'BMqyaPZkcFFyJz7llz7wjIOl7zKOmsmB06i-ulktx4rMaTrS_4exJhbffT9wV04ZmPVw9AJD7QBX3PJH-zxUMQw';
+// Tegelnavigatie (fase 4 van het ontwerp, v101): overzicht met tegels + balk
+// onderaan. Eerst alleen op de demo; NPHV volgt zodra de testmatrix groen is.
+const NAV_TEGELS = true;
diff --git a/docs/demo/index.html b/docs/demo/index.html
index 1261c9e..8c990ab 100644
--- a/docs/demo/index.html
+++ b/docs/demo/index.html
@@ -313,6 +313,7 @@
   </details>
 
   <nav class="tabs" id="tabs">
+    <button data-tab="overzicht" hidden>Overzicht</button>
     <button data-tab="kaart" class="actief">Kaart &amp; loting</button>
     <button data-tab="klassement">Klassement</button>
     <button data-tab="vangsten">Vangsten</button>
@@ -321,6 +322,24 @@
     <button data-tab="beheer">Beheer</button>
   </nav>
 
+  <!-- Overzicht (v101, fase 4 van het ontwerp; alleen zichtbaar met NAV_TEGELS
+       in config.js). Dit is de thuisbasis binnen een wedstrijd: merk, de vier
+       tegels en verder alles via de balk onderaan. De tegels navigeren naar de
+       BESTAANDE tabs, dus de rol-, autorisatie- en renderlogica verandert niet. -->
+  <section id="tab-overzicht" class="tab" hidden>
+    <div class="ov-merk">
+      <img src="/logo-rond-512.png" alt="Viswedstrijdapp" width="96" height="96">
+      <span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span>
+    </div>
+    <div class="tegels">
+      <button class="tegel" data-ga="kaart"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z'/><path d='M9 3v15M15 6v15'/></svg></span><span class="t-titel">Viswater</span><span class="t-sub">de kaart met alle stekken</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="tegel" data-ga="loting"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6M3 3l6 6'/></svg></span><span class="t-titel">Loting</span><span class="t-sub">wie zit waar, en je eigen plek</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="tegel" data-ga="klassement"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M8 4h8v5a4 4 0 0 1-8 0z'/><path d='M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3'/><path d='M10 14h4v4h-4zM8 20h8'/></svg></span><span class="t-titel">Klassement</span><span class="t-sub">de stand van nu</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="tegel" data-ga="vangsten"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg></span><span class="t-titel">Vangsten</span><span class="t-sub">alles wat er gevangen is</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
+    </div>
+    <div id="ov-extra" class="ov-extra"></div>
+  </section>
+
   <!-- Kaart -->
   <section id="tab-kaart" class="tab">
     <div class="card">
@@ -572,6 +591,25 @@
 
 <button id="snel-vangst" class="snel-vangst" hidden>⚖️ Vangst registreren</button>
 
+<!-- Onderste navigatiebalk (v101, fase 4): alleen met NAV_TEGELS. De knoppen
+     activeren dezelfde tabs als de tabbalk; "Meer" opent een paneel met de rest
+     (klassement, mijn deelname, seizoen, beheer, uitloggen) op basis van de rol. -->
+<nav class="onderbalk" id="onderbalk" hidden>
+  <button data-ga="overzicht"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M3 10.5 12 3l9 7.5'/><path d='M5 9.8V21h14V9.8'/></svg><span>Overzicht</span></button>
+  <button data-ga="kaart"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z'/><circle cx='12' cy='10' r='2.6'/></svg><span>Kaart</span></button>
+  <button data-ga="vangsten"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg><span>Vangsten</span></button>
+  <button data-meer><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='5' cy='12' r='1.6'/><circle cx='12' cy='12' r='1.6'/><circle cx='19' cy='12' r='1.6'/></svg><span>Meer</span></button>
+</nav>
+<div class="meer-paneel" id="meer-paneel" hidden>
+  <div class="meer-vlak" data-meer-sluit></div>
+  <div class="meer-inhoud" role="dialog" aria-label="Meer voor deze wedstrijd">
+    <div class="meer-greep" aria-hidden="true"></div>
+    <div id="meer-knoppen"></div>
+    <button class="btn breed" data-meer-sluit>Sluiten</button>
+  </div>
+</div>
+
+
 <div id="foto-groot" class="lightbox" role="dialog" aria-modal="true" aria-label="Afbeelding vergroot" hidden><img alt="vangstfoto"><button type="button" class="sluit" aria-label="Sluiten">✕</button></div>
 
 <!-- deel-melding direct na het aanmaken van een wedstrijd -->
diff --git a/docs/demo/version.json b/docs/demo/version.json
index 018a51d..3379643 100644
--- a/docs/demo/version.json
+++ b/docs/demo/version.json
@@ -1 +1 @@
-{"v": 100}
+{"v": 101}
diff --git a/docs/nphv/config.js b/docs/nphv/config.js
index a8f9dd3..b854a68 100644
--- a/docs/nphv/config.js
+++ b/docs/nphv/config.js
@@ -4,3 +4,6 @@ const SB_KEY = 'sb_publishable_0sb4MYouujq5bmE6svX6Hg_EzPViAJK';
 const FOTO_BUCKET = 'wedstrijd-fotos';
 const TENANT = 'nphv'; // tenant-slug = klant in de database
 const VAPID_PUBLIC = 'BMqyaPZkcFFyJz7llz7wjIOl7zKOmsmB06i-ulktx4rMaTrS_4exJhbffT9wV04ZmPVw9AJD7QBX3PJH-zxUMQw';
+// Tegelnavigatie (fase 4 van het ontwerp, v101): staat hier nog UIT. Gaat aan
+// zodra de testmatrix op de demo groen is.
+const NAV_TEGELS = false;
diff --git a/docs/nphv/index.html b/docs/nphv/index.html
index 30476fa..b058722 100644
--- a/docs/nphv/index.html
+++ b/docs/nphv/index.html
@@ -297,6 +297,7 @@
   </details>
 
   <nav class="tabs" id="tabs">
+    <button data-tab="overzicht" hidden>Overzicht</button>
     <button data-tab="kaart" class="actief">Kaart &amp; loting</button>
     <button data-tab="klassement">Klassement</button>
     <button data-tab="vangsten">Vangsten</button>
@@ -305,6 +306,24 @@
     <button data-tab="beheer">Beheer</button>
   </nav>
 
+  <!-- Overzicht (v101, fase 4 van het ontwerp; alleen zichtbaar met NAV_TEGELS
+       in config.js). Dit is de thuisbasis binnen een wedstrijd: merk, de vier
+       tegels en verder alles via de balk onderaan. De tegels navigeren naar de
+       BESTAANDE tabs, dus de rol-, autorisatie- en renderlogica verandert niet. -->
+  <section id="tab-overzicht" class="tab" hidden>
+    <div class="ov-merk">
+      <img src="/logo-rond-512.png" alt="Viswedstrijdapp" width="96" height="96">
+      <span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span>
+    </div>
+    <div class="tegels">
+      <button class="tegel" data-ga="kaart"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z'/><path d='M9 3v15M15 6v15'/></svg></span><span class="t-titel">Viswater</span><span class="t-sub">de kaart met alle stekken</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="tegel" data-ga="loting"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6M3 3l6 6'/></svg></span><span class="t-titel">Loting</span><span class="t-sub">wie zit waar, en je eigen plek</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="tegel" data-ga="klassement"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M8 4h8v5a4 4 0 0 1-8 0z'/><path d='M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3'/><path d='M10 14h4v4h-4zM8 20h8'/></svg></span><span class="t-titel">Klassement</span><span class="t-sub">de stand van nu</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
+      <button class="tegel" data-ga="vangsten"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg></span><span class="t-titel">Vangsten</span><span class="t-sub">alles wat er gevangen is</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
+    </div>
+    <div id="ov-extra" class="ov-extra"></div>
+  </section>
+
   <!-- Kaart -->
   <section id="tab-kaart" class="tab">
     <div class="card">
@@ -557,6 +576,25 @@
 
 <button id="snel-vangst" class="snel-vangst" hidden>⚖️ Vangst registreren</button>
 
+<!-- Onderste navigatiebalk (v101, fase 4): alleen met NAV_TEGELS. De knoppen
+     activeren dezelfde tabs als de tabbalk; "Meer" opent een paneel met de rest
+     (klassement, mijn deelname, seizoen, beheer, uitloggen) op basis van de rol. -->
+<nav class="onderbalk" id="onderbalk" hidden>
+  <button data-ga="overzicht"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M3 10.5 12 3l9 7.5'/><path d='M5 9.8V21h14V9.8'/></svg><span>Overzicht</span></button>
+  <button data-ga="kaart"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z'/><circle cx='12' cy='10' r='2.6'/></svg><span>Kaart</span></button>
+  <button data-ga="vangsten"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg><span>Vangsten</span></button>
+  <button data-meer><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='5' cy='12' r='1.6'/><circle cx='12' cy='12' r='1.6'/><circle cx='19' cy='12' r='1.6'/></svg><span>Meer</span></button>
+</nav>
+<div class="meer-paneel" id="meer-paneel" hidden>
+  <div class="meer-vlak" data-meer-sluit></div>
+  <div class="meer-inhoud" role="dialog" aria-label="Meer voor deze wedstrijd">
+    <div class="meer-greep" aria-hidden="true"></div>
+    <div id="meer-knoppen"></div>
+    <button class="btn breed" data-meer-sluit>Sluiten</button>
+  </div>
+</div>
+
+
 <div id="foto-groot" class="lightbox" role="dialog" aria-modal="true" aria-label="Afbeelding vergroot" hidden><img alt="vangstfoto"><button type="button" class="sluit" aria-label="Sluiten">✕</button></div>
 
 <!-- deel-melding direct na het aanmaken van een wedstrijd -->
diff --git a/docs/nphv/version.json b/docs/nphv/version.json
index 018a51d..3379643 100644
--- a/docs/nphv/version.json
+++ b/docs/nphv/version.json
@@ -1 +1 @@
-{"v": 100}
+{"v": 101}
diff --git a/docs/styles.css b/docs/styles.css
index 84efc7a..bafd0e8 100644
--- a/docs/styles.css
+++ b/docs/styles.css
@@ -598,3 +598,84 @@ textarea:focus { outline: 2px solid var(--blauw-mid); border-color: var(--blauw-
 .rolknop .rol-icoon { background: var(--zand); }
 .merk-blok .merk-logo img { width: 76px; height: 76px; }
 .merk-blok .merk-voet { display: none; }
+
+
+/* ============ Tegelnavigatie (v101, fase 4 van het ontwerp) ============
+   Alleen actief als config.js NAV_TEGELS aanzet: app.js zet dan body.nav-tegels.
+   Het overzicht is de thuisbasis binnen een wedstrijd (donkergroen vlak met het
+   merk en vier tegels), de vaste balk onderaan brengt je overal heen. */
+#tab-overzicht {
+  background: var(--overzicht-bg);
+  border-radius: 18px;
+  padding: clamp(16px, 4vw, 24px) clamp(14px, 4vw, 22px) clamp(18px, 4vw, 26px);
+  margin-bottom: 14px;
+}
+.ov-merk { text-align: center; color: #fff; }
+.ov-merk img { width: 96px; height: 96px; display: block; margin: 0 auto; }
+.ov-merk .slogan-blok { display: block; margin-top: 10px; color: var(--oranje); }
+.ov-merk .slogan-blok .tekst {
+  display: block; font-size: clamp(22px, 6vw, 28px); font-weight: 800;
+  color: #fff; line-height: 1; letter-spacing: -.5px;
+}
+.ov-merk .slogan-blok .punt { color: var(--oranje); }
+.ov-merk .slogan-blok svg { display: block; width: min(230px, 70%); height: auto; margin: 3px auto 0; }
+
+.tegels { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
+.tegel {
+  position: relative; text-align: left; border: 0; cursor: pointer;
+  background: var(--tegel-olijf); color: var(--tekst);
+  border-radius: 14px; padding: 13px 13px 12px; min-height: 104px;
+  display: flex; flex-direction: column; gap: 2px; font: inherit;
+}
+.tegel:nth-child(2), .tegel:nth-child(3) { background: var(--tegel-zand); }
+.tegel:active { transform: scale(.985); }
+.tegel .t-icoon svg { width: 26px; height: 26px; color: #2b3122; }
+.tegel .t-titel { margin-top: 8px; font-size: 15px; font-weight: 700; color: #2b3122; }
+.tegel .t-sub { font-size: 12px; line-height: 1.3; color: #55523f; padding-right: 12px; }
+.tegel .t-pijl { position: absolute; right: 11px; bottom: 9px; color: #5c6350; font-size: 18px; font-weight: 700; }
+.ov-extra:not(:empty) { margin-top: 14px; }
+
+/* vaste balk onderaan */
+.onderbalk[hidden], .meer-paneel[hidden] { display: none; }
+.onderbalk {
+  position: fixed; left: 0; right: 0; bottom: 0; z-index: 60;
+  background: #293222; display: flex; justify-content: space-around;
+  padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
+  box-shadow: 0 -6px 20px rgba(0, 0, 0, .22);
+}
+.onderbalk button {
+  flex: 1; background: none; border: 0; cursor: pointer; font: inherit;
+  display: flex; flex-direction: column; align-items: center; gap: 3px;
+  padding: 6px 2px; color: #b9bfa6; font-size: 11px; font-weight: 700;
+  min-height: 48px; border-radius: 10px;
+}
+.onderbalk button svg { width: 22px; height: 22px; }
+.onderbalk button.aan { color: var(--oranje); }
+.onderbalk button:active { background: rgba(255, 255, 255, .08); }
+
+body.nav-tegels { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
+body.nav-tegels .snel-vangst { bottom: calc(76px + env(safe-area-inset-bottom)); }
+body.nav-tegels.op-overzicht #tabs { display: none; }
+body.meer-open { overflow: hidden; }
+
+/* Meer-paneel */
+.meer-paneel { position: fixed; inset: 0; z-index: 70; display: flex; align-items: flex-end; }
+.meer-vlak { position: absolute; inset: 0; background: rgba(20, 24, 15, .55); }
+.meer-inhoud {
+  position: relative; width: 100%; background: var(--kaart);
+  border-radius: 18px 18px 0 0; padding: 10px 16px calc(18px + env(safe-area-inset-bottom));
+  max-height: 80vh; overflow: auto;
+}
+.meer-greep { width: 40px; height: 4px; border-radius: 2px; background: var(--kaart-rand); margin: 0 auto 12px; }
+.meer-knop {
+  width: 100%; display: flex; justify-content: space-between; align-items: center;
+  background: #f1eedd; border: 1px solid var(--kaart-rand); border-radius: 12px;
+  padding: 14px 16px; margin-bottom: 8px; font: inherit; font-weight: 700;
+  color: var(--groen-donker); cursor: pointer; min-height: 48px;
+}
+.meer-knop:active { background: #e7e3cf; }
+@media (min-width: 620px) {
+  .tegels { grid-template-columns: repeat(4, 1fr); }
+  .meer-inhoud { max-width: 560px; margin: 0 auto; border-radius: 18px; margin-bottom: 30px; }
+  .meer-paneel { align-items: center; }
+}
=== CONTEXT: bestaande navigatiefuncties ===
  if (su) su.hidden = naam !== 'beheerder';
  $('#btn-terug').hidden = naam === 'home';
}
function activateTab(naam) {
  // alleen tabs die bij de huidige rol horen (Codex v89: een oude knop mocht
  // een kijker naar de deelnemerstab sturen)
  if (!tabsVanRol().includes(naam)) return;
  const b = document.querySelector(`#tabs button[data-tab=${naam}]`);
  if (b) b.click();
}

// Tegelnavigatie (v101, fase 4 van het ontwerp). Per tenant aan te zetten met
// NAV_TEGELS in config.js: eerst demo, daarna NPHV. Staat de vlag uit, dan is
// alles precies als voorheen; het overzicht en de onderbalk blijven verborgen.
const TEGELS = () => typeof NAV_TEGELS !== 'undefined' && !!NAV_TEGELS;

// welke tabs elke rol ziet
const TABS_PER_ROL = {
  // kijkers (v89, uit de Carpclassic-evaluatie): ook de kaart (wie zit waar) en
  // de vangsten met foto's; alleen lezen, geen team-tab
  kijker: ['klassement', 'kaart', 'vangsten', 'seizoen'],
  deelnemer: ['kaart', 'klassement', 'vangsten', 'team', 'seizoen'],
  organisator: ['kaart', 'klassement', 'vangsten', 'seizoen', 'beheer'],
};
// Labels voor de tegels, de onderbalk en het Meer-paneel op één plek
function tabLabel(naam) {
  if (naam === 'team') return STATE?.wedstrijd?.mode === 'koppel' ? 'Mijn team' : 'Mijn deelname';
  return { overzicht: 'Overzicht', kaart: 'Kaart & loting', klassement: 'Klassement',
    vangsten: 'Vangsten', seizoen: 'Seizoen', beheer: 'Beheer' }[naam] || naam;
}

// Het Meer-paneel bevat alles wat niet in de onderbalk past, in de volgorde van
// de rol. De lijst komt uit dezelfde bron als de tabbalk, dus een kijker krijgt
// hier nooit een deelnemersscherm te zien.
const ONDERBALK = ['overzicht', 'kaart', 'vangsten'];
function renderMeer(zichtbaar) {
  const vak = $('#meer-knoppen');
  if (!vak) return;
  const rest = zichtbaar.filter((n) => !ONDERBALK.includes(n));
  vak.innerHTML = rest.map((n) =>
    `<button class="meer-knop" data-ga="${n}">${esc(tabLabel(n))}<span aria-hidden="true">&rsaquo;</span></button>`).join('')
    + '<button class="meer-knop" data-ga="home">Naar het startscherm<span aria-hidden="true">&rsaquo;</span></button>';
}

// De tabs van deze rol, met het overzicht vooraan zodra de tegelnavigatie aan
// staat. Eén bron voor renderTabs, activateTab en het Meer-paneel, zodat de
// rolbeperking maar op één plek staat.
function tabsVanRol() {
  const lijst = (TABS_PER_ROL[ROL] || TABS_PER_ROL.deelnemer).slice();
  if (TEGELS()) lijst.unshift('overzicht');
  return lijst;
}

function renderTabs() {
  // duidelijker labels (klantvraag NPHV): bij een individuele wedstrijd is
  // "Mijn team" verwarrend, daar heet de tab "Mijn deelname"
  const teamKnop = document.querySelector('#tabs button[data-tab=team]');
  if (teamKnop && STATE?.wedstrijd) {
    teamKnop.textContent = STATE.wedstrijd.mode === 'koppel' ? 'Mijn team' : 'Mijn deelname';
  }
  // de seizoen-tab bestaat alleen als deze wedstrijd bij een seizoen hoort
  const zichtbaar = tabsVanRol()
    .filter((naam) => naam !== 'seizoen' || !!SEIZOEN);
  $('#tabs').hidden = false;
  document.body.classList.toggle('rol-kijker', ROL === 'kijker');
  document.body.classList.toggle('nav-tegels', TEGELS());
  const balkOnder = $('#onderbalk');
  if (balkOnder) balkOnder.hidden = !TEGELS();
  renderMeer(zichtbaar);
  document.querySelectorAll('#tabs button').forEach((b) => {
    // 'overzicht' bestaat alleen als navigatiedoel; de knop ervoor staat onderaan
    b.hidden = b.dataset.tab === 'overzicht' || !zichtbaar.includes(b.dataset.tab);
  });
  // knoppen in de tabbalk in de volgorde van de rol zetten (kijker: klassement eerst)
  const balk = $('#tabs');
  zichtbaar.forEach((naam) => { const b = balk.querySelector(`button[data-tab=${naam}]`); if (b) balk.appendChild(b); });
  const actief = document.querySelector('#tabs button.actief');
  if (!actief || actief.hidden || !zichtbaar.includes(actief.dataset.tab)) {
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('actief', x.dataset.tab === zichtbaar[0]));
    document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== 'tab-' + zichtbaar[0]; });
  }
}

/* ---------- home ---------- */
// standaard: morgen 08:00 tot 17:00; ook gebruikt als het sjabloon wordt gewist
function zetStandaardTijden() {
  const morgen = new Date(Date.now() + 86400000);
  morgen.setHours(8, 0, 0, 0);
  $('#nw-start').value = naarLocalInput(morgen.toISOString());
  const eind = new Date(morgen); eind.setHours(17, 0, 0, 0);
  $('#nw-eind').value = naarLocalInput(eind.toISOString());
}

function initHome() {
  const startVeld = $('#nw-start'), eindVeld = $('#nw-eind');
  zetStandaardTijden();

  // rolkaarten: één rol kiezen opent alleen dat formulier (v99, ontwerp 19 sep).
  // De formulieren, id's en handlers blijven ongewijzigd; alleen de presentatie
  // verandert: de kaarten verdwijnen en er komt een knop 'Andere rol kiezen'.
  function toonRol(rol) {
    document.querySelectorAll('.rolknop').forEach((x) => x.classList.toggle('actief', x.dataset.rol === rol));
    $('#form-deelnemer').hidden = rol !== 'deelnemer';
    $('#form-kijker').hidden = rol !== 'kijker';
    $('#form-orglogin').hidden = rol !== 'org';

codex
Ik controleer de diff en de omliggende navigatiecode. Daarbij onderscheid ik aantoonbare fouten van punten die nog een test op een iPhone vragen.

exec
/bin/zsh -lc "rg -n 'Viswedstrijden|v21' /Users/kemble/.codex/memories/MEMORY.md" in /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
 succeeded in 0ms:
237:# Task Group: Viswedstrijden code-review and Claude handoff
239:scope: Review the Viswedstrijden webapp or prepare a concrete Dutch Markdown review for Claude Code; includes v1 findings and boundaries for resuming the unfinished v21 review.
240:applies_to: cwd=/Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijden; reuse_rule=revalidate effective SQL and edge functions before treating findings as current.
250:- Viswedstrijden, database.sql, SECURITY DEFINER, w_admin_reset_loting, w_push_subscribe, stek_ring, push-vangst.ts
262:## Task 3: Resume chatgpt-review-v2 against v21 codebase, incomplete
270:- chatgpt-review-v2.md, v21, create or replace, w_admin_kies, w_admin_voeg_vangst, wis-fotos.ts, sw.js, CSP
279:- Voor v21 zijn de latere `create or replace`-definities onderaan `review/database.sql` effectief; inspecteer ook `app.js`, `sw.js`, CSP, `push-vangst.ts` en `wis-fotos.ts`. [Task 3]

exec
/bin/zsh -lc "pwd; rg --files -g 'AGENTS.md' -g 'app.js' -g 'styles.css' -g 'index.html' -g 'sw.js'" in /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
 succeeded in 0ms:
/Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
docs/sw.js
docs/app.js
docs/inloggen/index.html
docs/styles.css
docs/nphv/sw.js
docs/nphv/index.html
docs/index.html
docs/demo/sw.js
docs/demo/index.html

exec
/bin/zsh -lc "rg -n 'function route|function toonView|function initWedstrijd|initWedstrijd\\(|data-ga|data-meer|sluitMeer|merkOnderbalk|renderTabs\\(|viewport|snel-vangst|\\[hidden\\]' docs/app.js docs/styles.css docs/demo/index.html docs/nphv/index.html" in /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
 succeeded in 0ms:
docs/nphv/index.html:5:<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
docs/nphv/index.html:319:      <button class="tegel" data-ga="kaart"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z'/><path d='M9 3v15M15 6v15'/></svg></span><span class="t-titel">Viswater</span><span class="t-sub">de kaart met alle stekken</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/nphv/index.html:320:      <button class="tegel" data-ga="loting"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6M3 3l6 6'/></svg></span><span class="t-titel">Loting</span><span class="t-sub">wie zit waar, en je eigen plek</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/nphv/index.html:321:      <button class="tegel" data-ga="klassement"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M8 4h8v5a4 4 0 0 1-8 0z'/><path d='M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3'/><path d='M10 14h4v4h-4zM8 20h8'/></svg></span><span class="t-titel">Klassement</span><span class="t-sub">de stand van nu</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/nphv/index.html:322:      <button class="tegel" data-ga="vangsten"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg></span><span class="t-titel">Vangsten</span><span class="t-sub">alles wat er gevangen is</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/nphv/index.html:577:<button id="snel-vangst" class="snel-vangst" hidden>⚖️ Vangst registreren</button>
docs/nphv/index.html:583:  <button data-ga="overzicht"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M3 10.5 12 3l9 7.5'/><path d='M5 9.8V21h14V9.8'/></svg><span>Overzicht</span></button>
docs/nphv/index.html:584:  <button data-ga="kaart"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z'/><circle cx='12' cy='10' r='2.6'/></svg><span>Kaart</span></button>
docs/nphv/index.html:585:  <button data-ga="vangsten"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg><span>Vangsten</span></button>
docs/nphv/index.html:586:  <button data-meer><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='5' cy='12' r='1.6'/><circle cx='12' cy='12' r='1.6'/><circle cx='19' cy='12' r='1.6'/></svg><span>Meer</span></button>
docs/nphv/index.html:589:  <div class="meer-vlak" data-meer-sluit></div>
docs/nphv/index.html:593:    <button class="btn breed" data-meer-sluit>Sluiten</button>
docs/demo/index.html:5:<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
docs/demo/index.html:335:      <button class="tegel" data-ga="kaart"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z'/><path d='M9 3v15M15 6v15'/></svg></span><span class="t-titel">Viswater</span><span class="t-sub">de kaart met alle stekken</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/demo/index.html:336:      <button class="tegel" data-ga="loting"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6M3 3l6 6'/></svg></span><span class="t-titel">Loting</span><span class="t-sub">wie zit waar, en je eigen plek</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/demo/index.html:337:      <button class="tegel" data-ga="klassement"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M8 4h8v5a4 4 0 0 1-8 0z'/><path d='M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3'/><path d='M10 14h4v4h-4zM8 20h8'/></svg></span><span class="t-titel">Klassement</span><span class="t-sub">de stand van nu</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/demo/index.html:338:      <button class="tegel" data-ga="vangsten"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg></span><span class="t-titel">Vangsten</span><span class="t-sub">alles wat er gevangen is</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/demo/index.html:592:<button id="snel-vangst" class="snel-vangst" hidden>⚖️ Vangst registreren</button>
docs/demo/index.html:598:  <button data-ga="overzicht"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M3 10.5 12 3l9 7.5'/><path d='M5 9.8V21h14V9.8'/></svg><span>Overzicht</span></button>
docs/demo/index.html:599:  <button data-ga="kaart"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z'/><circle cx='12' cy='10' r='2.6'/></svg><span>Kaart</span></button>
docs/demo/index.html:600:  <button data-ga="vangsten"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg><span>Vangsten</span></button>
docs/demo/index.html:601:  <button data-meer><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='5' cy='12' r='1.6'/><circle cx='12' cy='12' r='1.6'/><circle cx='19' cy='12' r='1.6'/></svg><span>Meer</span></button>
docs/demo/index.html:604:  <div class="meer-vlak" data-meer-sluit></div>
docs/demo/index.html:608:    <button class="btn breed" data-meer-sluit>Sluiten</button>
docs/styles.css:118:label[hidden] { display: none; }
docs/styles.css:279:.lightbox[hidden] { display: none; }
docs/styles.css:335:.toast[hidden] { display: none; }
docs/styles.css:389:.snel-vangst {
docs/styles.css:398:.snel-vangst[hidden] { display: none; }
docs/styles.css:399:.snel-vangst:active { transform: translateX(-50%) scale(.97); }
docs/styles.css:474:.update-banner[hidden] { display: none; }
docs/styles.css:488:.terug-knop[hidden] { display: none; }
docs/styles.css:639:.onderbalk[hidden], .meer-paneel[hidden] { display: none; }
docs/styles.css:657:body.nav-tegels .snel-vangst { bottom: calc(76px + env(safe-area-inset-bottom)); }
docs/app.js:472:  initHome(); initWedstrijd(); route(true);
docs/app.js:510:function route(initieel) {
docs/app.js:533:    renderTabs();
docs/app.js:591:function toonView(naam) {
docs/app.js:636:    `<button class="meer-knop" data-ga="${n}">${esc(tabLabel(n))}<span aria-hidden="true">&rsaquo;</span></button>`).join('')
docs/app.js:637:    + '<button class="meer-knop" data-ga="home">Naar het startscherm<span aria-hidden="true">&rsaquo;</span></button>';
docs/app.js:649:function renderTabs() {
docs/app.js:903:      renderTabs();
docs/app.js:971:function merkOnderbalk(tab) {
docs/app.js:987:function sluitMeer() {
docs/app.js:998:  const knop = $('#snel-vangst');
docs/app.js:2351:  renderTabs();
docs/app.js:2752:function initWedstrijd() {
docs/app.js:2759:    merkOnderbalk(b.dataset.tab);
docs/app.js:2767:    sluitMeer();
docs/app.js:2778:    const knop = e.target.closest('[data-ga]');
docs/app.js:2780:    if (e.target.closest('[data-meer]')) { toonMeer(); return; }
docs/app.js:2781:    if (e.target.closest('[data-meer-sluit]')) sluitMeer();
docs/app.js:3253:  $('#snel-vangst')?.addEventListener('click', () => {

exec
/bin/zsh -lc "sed -n '470,700p' docs/app.js; sed -n '2720,2815p' docs/app.js; tail -90 docs/app.js" in /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
 succeeded in 0ms:
    b.setAttribute('aria-label', veld.type === 'password' ? 'toon code' : 'verberg code');
  }));
  initHome(); initWedstrijd(); route(true);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  checkVersie();
  setInterval(checkVersie, 10 * 60 * 1000);
  $('#update-banner').addEventListener('click', () => location.reload());
  // terug in beeld: direct verversen (de poll loopt op de achtergrond op 1/10 tempo)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && CODE) { laadState(!INIT_KLAAR); verstuurWachtrij(); }
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
}
function toonView(naam) {
  $('#view-home').hidden = naam !== 'home';
  $('#view-wedstrijd').hidden = naam !== 'wedstrijd';
  $('#view-org').hidden = naam !== 'org';
  const su = $('#view-beheerder');
  if (su) su.hidden = naam !== 'beheerder';
  $('#btn-terug').hidden = naam === 'home';
}
function activateTab(naam) {
  // alleen tabs die bij de huidige rol horen (Codex v89: een oude knop mocht
  // een kijker naar de deelnemerstab sturen)
  if (!tabsVanRol().includes(naam)) return;
  const b = document.querySelector(`#tabs button[data-tab=${naam}]`);
  if (b) b.click();
}

// Tegelnavigatie (v101, fase 4 van het ontwerp). Per tenant aan te zetten met
// NAV_TEGELS in config.js: eerst demo, daarna NPHV. Staat de vlag uit, dan is
// alles precies als voorheen; het overzicht en de onderbalk blijven verborgen.
const TEGELS = () => typeof NAV_TEGELS !== 'undefined' && !!NAV_TEGELS;

// welke tabs elke rol ziet
const TABS_PER_ROL = {
  // kijkers (v89, uit de Carpclassic-evaluatie): ook de kaart (wie zit waar) en
  // de vangsten met foto's; alleen lezen, geen team-tab
  kijker: ['klassement', 'kaart', 'vangsten', 'seizoen'],
  deelnemer: ['kaart', 'klassement', 'vangsten', 'team', 'seizoen'],
  organisator: ['kaart', 'klassement', 'vangsten', 'seizoen', 'beheer'],
};
// Labels voor de tegels, de onderbalk en het Meer-paneel op één plek
function tabLabel(naam) {
  if (naam === 'team') return STATE?.wedstrijd?.mode === 'koppel' ? 'Mijn team' : 'Mijn deelname';
  return { overzicht: 'Overzicht', kaart: 'Kaart & loting', klassement: 'Klassement',
    vangsten: 'Vangsten', seizoen: 'Seizoen', beheer: 'Beheer' }[naam] || naam;
}

// Het Meer-paneel bevat alles wat niet in de onderbalk past, in de volgorde van
// de rol. De lijst komt uit dezelfde bron als de tabbalk, dus een kijker krijgt
// hier nooit een deelnemersscherm te zien.
const ONDERBALK = ['overzicht', 'kaart', 'vangsten'];
function renderMeer(zichtbaar) {
  const vak = $('#meer-knoppen');
  if (!vak) return;
  const rest = zichtbaar.filter((n) => !ONDERBALK.includes(n));
  vak.innerHTML = rest.map((n) =>
    `<button class="meer-knop" data-ga="${n}">${esc(tabLabel(n))}<span aria-hidden="true">&rsaquo;</span></button>`).join('')
    + '<button class="meer-knop" data-ga="home">Naar het startscherm<span aria-hidden="true">&rsaquo;</span></button>';
}

// De tabs van deze rol, met het overzicht vooraan zodra de tegelnavigatie aan
// staat. Eén bron voor renderTabs, activateTab en het Meer-paneel, zodat de
// rolbeperking maar op één plek staat.
function tabsVanRol() {
  const lijst = (TABS_PER_ROL[ROL] || TABS_PER_ROL.deelnemer).slice();
  if (TEGELS()) lijst.unshift('overzicht');
  return lijst;
}

function renderTabs() {
  // duidelijker labels (klantvraag NPHV): bij een individuele wedstrijd is
  // "Mijn team" verwarrend, daar heet de tab "Mijn deelname"
  const teamKnop = document.querySelector('#tabs button[data-tab=team]');
  if (teamKnop && STATE?.wedstrijd) {
    teamKnop.textContent = STATE.wedstrijd.mode === 'koppel' ? 'Mijn team' : 'Mijn deelname';
  }
  // de seizoen-tab bestaat alleen als deze wedstrijd bij een seizoen hoort
  const zichtbaar = tabsVanRol()
    .filter((naam) => naam !== 'seizoen' || !!SEIZOEN);
  $('#tabs').hidden = false;
  document.body.classList.toggle('rol-kijker', ROL === 'kijker');
  document.body.classList.toggle('nav-tegels', TEGELS());
  const balkOnder = $('#onderbalk');
  if (balkOnder) balkOnder.hidden = !TEGELS();
  renderMeer(zichtbaar);
  document.querySelectorAll('#tabs button').forEach((b) => {
    // 'overzicht' bestaat alleen als navigatiedoel; de knop ervoor staat onderaan
    b.hidden = b.dataset.tab === 'overzicht' || !zichtbaar.includes(b.dataset.tab);
  });
  // knoppen in de tabbalk in de volgorde van de rol zetten (kijker: klassement eerst)
  const balk = $('#tabs');
  zichtbaar.forEach((naam) => { const b = balk.querySelector(`button[data-tab=${naam}]`); if (b) balk.appendChild(b); });
  const actief = document.querySelector('#tabs button.actief');
  if (!actief || actief.hidden || !zichtbaar.includes(actief.dataset.tab)) {
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('actief', x.dataset.tab === zichtbaar[0]));
    document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== 'tab-' + zichtbaar[0]; });
  }
}

/* ---------- home ---------- */
// standaard: morgen 08:00 tot 17:00; ook gebruikt als het sjabloon wordt gewist
function zetStandaardTijden() {
  const morgen = new Date(Date.now() + 86400000);
  morgen.setHours(8, 0, 0, 0);
  $('#nw-start').value = naarLocalInput(morgen.toISOString());
  const eind = new Date(morgen); eind.setHours(17, 0, 0, 0);
  $('#nw-eind').value = naarLocalInput(eind.toISOString());
}

function initHome() {
  const startVeld = $('#nw-start'), eindVeld = $('#nw-eind');
  zetStandaardTijden();

  // rolkaarten: één rol kiezen opent alleen dat formulier (v99, ontwerp 19 sep).
  // De formulieren, id's en handlers blijven ongewijzigd; alleen de presentatie
  // verandert: de kaarten verdwijnen en er komt een knop 'Andere rol kiezen'.
  function toonRol(rol) {
    document.querySelectorAll('.rolknop').forEach((x) => x.classList.toggle('actief', x.dataset.rol === rol));
    $('#form-deelnemer').hidden = rol !== 'deelnemer';
    $('#form-kijker').hidden = rol !== 'kijker';
    $('#form-orglogin').hidden = rol !== 'org';
      if (perm !== 'granted') {
        toast('Meldingen zijn geweigerd in de browser.');
        knop.disabled = false; renderPushKnop(); return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidBytes(VAPID_PUBLIC),
      });
      const j = sub.toJSON();
      const t = sessie.team(CODE);
      await rpc('w_push_subscribe', {
        p_code: CODE, p_token: (!KIJKER && t) ? t.token : null,
        p_endpoint: sub.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth,
        p_route: (KIJKER ? '#/k/' : '#/w/') + CODE,
      });
      localStorage.setItem('push:' + CODE, '1');
      toast('Je krijgt nu een melding bij elke nieuwe vangst 🐟');
    }
  } catch (err) {
    toast('Meldingen aanzetten is niet gelukt.');
  }
  knop.disabled = false;
  renderPushKnop();
}

function vapidBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/* ---------- mijn team + registreren ---------- */
function initWedstrijd() {
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
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
    if (doel === 'home') { $('#btn-terug')?.click(); return; }
    if (doel === 'loting') {   // loting is geen eigen tab: de kaartweergave, maar dan bij de lijst
      activateTab('kaart');
      setTimeout(() => $('#loting-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      return;
    }
    activateTab(doel);
    if (doel === 'overzicht') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  document.addEventListener('click', (e) => {
    const knop = e.target.closest('[data-ga]');
    if (knop) { ga(knop.dataset.ga); return; }
    if (e.target.closest('[data-meer]')) { toonMeer(); return; }
    if (e.target.closest('[data-meer-sluit]')) sluitMeer();
  });

  $('#kl-totaal').addEventListener('click', () => { KLASSEMENT_MODE = 'totaal'; renderKlassement(); });
  $('#kl-grootste').addEventListener('click', () => { KLASSEMENT_MODE = 'grootste'; renderKlassement(); });
  $('#btn-deel-uitslag')?.addEventListener('click', deelUitslag);
  // kijklink delen (v89): kijker deelt door, deelnemer nodigt het thuisfront uit;
  // ALTIJD de kijkcode, nooit de deelnemers- of persoonlijke code
  const deelKijklink = async () => {
    const w = STATE?.wedstrijd;
    const kijk = w?.kijk_code;
    if (!kijk) { toast('De kijkcode is nog niet bekend, probeer het zo nog eens.'); return; }
    const link = `${location.origin}${location.pathname}#/k/${kijk}`;
    const tekst = `Kijk live mee met ${w.naam}: klassement, vangsten en de kaart. ${link} (kijkcode ${kijk})`;
    if (navigator.share) {
      try { await navigator.share({ title: `Kijk mee: ${w.naam}`, text: tekst }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; /* anders: kopiëren */ }
    }
    const ok = await kopieerTekst(tekst);
    toast(ok ? 'Kijklink gekopieerd, plak hem in de groepsapp.' : 'Kopiëren mislukt.');
  };
  $('#btn-kijklink-deel')?.addEventListener('click', deelKijklink);
  $('#btn-kijkers-uitnodigen')?.addEventListener('click', deelKijklink);
  $('#afsluit-deel')?.addEventListener('click', deelUitslag);
  $('#afsluit-ok')?.addEventListener('click', () => sluitAfsluiting(true));
  $('#afsluit-sluit')?.addEventListener('click', () => sluitAfsluiting(false));
  $('#btn-deel-seizoen')?.addEventListener('click', deelSeizoen);
  $('#dn-sluit')?.addEventListener('click', () => { $('#deel-nieuw').hidden = true; });
  $('#dn-deel')?.addEventListener('click', async () => {
    const d = DEEL_NIEUW;
    if (!d) return;
    const tekst = `\ud83c\udfa3 ${d.naam}\n\ud83d\udcc5 ${fmtDatumTijd(d.start)} tot ${fmtDatumTijd(d.eind)}\n\n`
      + `Doe mee: open ${d.link} en meld je aan met code ${d.code}.\n`
      + `Thuis meekijken kan met kijkcode ${d.kijk} op ${location.origin}${location.pathname}\n\n`
      + `Tip: zet de app op je beginscherm voor meldingen bij elke vangst: ${location.origin}${location.pathname}instructies.html`;
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
  });
  $('#b-vangsten').querySelectorAll('[data-vangst-weg]').forEach((b) => {
    b.onclick = () => tikNogmaals(b, 'zeker?', () => beheerActie('w_admin_vangst', { p_vangst_id: b.dataset.vangstWeg, p_verwijder: true }));
  });
}

exec
/bin/zsh -lc "sed -n '880,922p' docs/app.js; sed -n '995,1018p' docs/app.js; sed -n '2338,2362p' docs/app.js; sed -n '60,100p' docs/styles.css; rg -n 'data-ga|data-meer|loting-card|btn-terug|focus|safe-area|z-index' docs --glob '*.js' --glob '*.css' --glob '*.html'" in /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
 succeeded in 0ms:
    TIJD_OFFSET = new Date(s.server_now).getTime() - Date.now();
    if (eerste && !mijnKijker && PENDING_TOKEN) {
      const token = PENDING_TOKEN;
      try {
        const team = await rpc('w_mijn_team', { p_code: mijnCode, p_token: token });
        if (verouderd()) return;
        if (team) sessie.zetTeam(mijnCode, { id: team.id, token, naam: team.naam });
      } catch { /* ongeldige teamlink: negeren */ }
      if (verouderd()) return;
      PENDING_TOKEN = null;
    }
    if (eerste && !mijnKijker) {
      const pin = sessie.pin(mijnCode);
      if (pin) {
        try {
          await rpc('w_admin_check', { p_code: mijnCode, p_pin: pin });
          if (verouderd()) return;
          ROL = 'organisator'; ADMIN_OPEN = true;
        } catch {
          if (verouderd()) return;
          sessionStorage.removeItem('pin:' + mijnCode); ROL = 'deelnemer';
        }
      } else { ROL = 'deelnemer'; }
      renderTabs();
    }
    onthoudLaatste(s, mijnCode, mijnKijker);
    meldNieuweVangsten();
    STATE_OK_OP = Date.now();
    verbindingBanner(false);
    renderAlles(eerste);
    checkAfsluiting();
    INIT_KLAAR = true;
    if (eerste && ROL === 'deelnemer' && !sessie.team(mijnCode) && s.wedstrijd.status === 'aanmelden') {
      // deelnemer met een gedeelde link start bij het invoeren van eigen gegevens
      activateTab('team');
    }
  } catch (err) {
    // hier komen we alleen bij netwerk-/serverfouten; "bestaat niet" loopt via toonNietGevonden
    if (verouderd()) return;
    if (STATE) verbindingBanner(true);   // oude gegevens in beeld: zeg hoe oud
    if (eerste && !STATE) {
      $('#w-naam').textContent = 'Geen verbinding';
      $('#klok').textContent = '--:--:--';
// is dan de enige handeling die telt, en je hebt vaak natte handen of felle zon.
// Verdwijnt zodra je op de vangsten-tab staat (daar staat het formulier al).
function renderSnelVangst() {
  const knop = $('#snel-vangst');
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
}

/* ---------- seizoensklassement ---------- */
async function laadSeizoen() {
  const code = CODE; // late responses van een vorige wedstrijd negeren (Codex v5 P1-4)
  try {
    const stand = await rpc('w_seizoen_stand', { p_code: code });
    if (CODE !== code) return;
    SEIZOEN = stand;
  } catch {
    if (CODE !== code) return;
    SEIZOEN = null; // geen seizoen, of nog geen afgelopen wedstrijden
  }
  renderTabs();
  renderSeizoen();
}

function renderSeizoen() {
  const el = $('#seizoen-inhoud');
  if (!el) return;
  const deelRij = $('#seizoen-deel-rij');
  if (!SEIZOEN) { el.innerHTML = ''; if (deelRij) deelRij.hidden = true; return; }
  if (deelRij) deelRij.hidden = false;
  const s = SEIZOEN;
  const regels = s.seizoen.regels;

.container { max-width: 860px; margin: 0 auto; padding: 12px calc(12px + env(safe-area-inset-right)) calc(80px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left)); }

.card {
  background: var(--kaart); border-radius: 14px; padding: 16px;
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
docs/app.js:222:    ta.focus(); ta.select();
docs/app.js:456:  $('#btn-terug').addEventListener('click', () => {
docs/app.js:597:  $('#btn-terug').hidden = naam === 'home';
docs/app.js:636:    `<button class="meer-knop" data-ga="${n}">${esc(tabLabel(n))}<span aria-hidden="true">&rsaquo;</span></button>`).join('')
docs/app.js:637:    + '<button class="meer-knop" data-ga="home">Naar het startscherm<span aria-hidden="true">&rsaquo;</span></button>';
docs/app.js:702:    if (rol) $({ deelnemer: '#deelnemer-code', kijker: '#kijker-code', org: '#org-ww' }[rol])?.focus();
docs/app.js:1332:      if (nieuw) { nieuw.focus(); nieuw.setSelectionRange(cursor, cursor); }
docs/app.js:1464:  $('#nw-naam').focus();
docs/app.js:1806:  const kop = document.querySelector('#loting-card h2');
docs/app.js:2768:    if (doel === 'home') { $('#btn-terug')?.click(); return; }
docs/app.js:2771:      setTimeout(() => $('#loting-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
docs/app.js:2778:    const knop = e.target.closest('[data-ga]');
docs/app.js:2780:    if (e.target.closest('[data-meer]')) { toonMeer(); return; }
docs/app.js:2781:    if (e.target.closest('[data-meer-sluit]')) sluitMeer();
docs/app.js:3198:    $('#wn-naam').focus();
docs/app.js:3257:    $('#v-gewicht')?.focus();
docs/app.js:3273:      e.preventDefault(); // simpele focuslus: de sluitknop is het enige bedienbare element
docs/app.js:3274:      $('#foto-groot .sluit')?.focus();
docs/app.js:3285:// lightbox voor vangstfoto's en de 3D-dieptekaart: focus naar de sluitknop
docs/app.js:3295:  lb.querySelector('.sluit')?.focus();
docs/app.js:3301:  if (FOTO_GROOT_OPENER && document.contains(FOTO_GROOT_OPENER)) FOTO_GROOT_OPENER.focus();
docs/app.js:3699:  naamEl.onfocus = maxEl.onfocus = () => { naamEl.dataset.geraakt = '1'; };
docs/app.js:3707:  startEl.onfocus = eindEl.onfocus = () => { startEl.dataset.geraakt = '1'; };
docs/app.js:3708:  if (prijsEl) prijsEl.onfocus = () => { startEl.dataset.geraakt = '1'; };
docs/app.js:3714:  zonesEl.onfocus = () => { zonesEl.dataset.geraakt = '1'; };
docs/app.js:3719:  regelsEl.onfocus = () => { regelsEl.dataset.geraakt = '1'; };
docs/landing.css:52:  position: sticky; top: 0; z-index: 30;
docs/landing.css:55:  padding: calc(9px + env(safe-area-inset-top)) clamp(14px, 4vw, 34px) 9px;
docs/landing.css:113:.hero-foto { position: absolute; inset: 0; z-index: 0; }
docs/landing.css:116:  position: absolute; inset: 0; z-index: 1;
docs/landing.css:119:.hero-inhoud { position: relative; z-index: 2; padding-top: clamp(34px, 5vw, 76px); padding-bottom: clamp(26px, 3vw, 44px); }
docs/landing.css:148:  position: relative; z-index: 2; background: rgba(23,28,16,.88);
docs/landing.css:275:.slot .binnen { position: relative; z-index: 2; padding-top: clamp(40px, 6vw, 78px); padding-bottom: clamp(40px, 6vw, 78px); }
docs/landing.css:280:.voet { background: var(--groen-diep); color: var(--licht-op-groen); padding: 34px 0 calc(30px + env(safe-area-inset-bottom)); text-align: center; }
docs/styles.css:18:  --blauw-mid: #6d7355;      /* olijf (accenten, focus) */
docs/styles.css:51:  position: sticky; top: 0; z-index: 20;
docs/styles.css:54:  padding: calc(10px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 10px calc(16px + env(safe-area-inset-left));
docs/styles.css:61:.container { max-width: 860px; margin: 0 auto; padding: 12px calc(12px + env(safe-area-inset-right)) calc(80px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left)); }
docs/styles.css:116:input:focus, select:focus { outline: 2px solid var(--blauw-mid); border-color: var(--blauw-mid); }
docs/styles.css:157:  position: sticky; top: 46px; z-index: 15;
docs/styles.css:276:  position: fixed; inset: 0; background: rgba(10,20,30,.92); z-index: 100;
docs/styles.css:283:.lightbox .sluit:focus-visible { outline: 2px solid #fff; border-radius: 8px; }
docs/styles.css:328:textarea:focus { outline: 2px solid var(--blauw-mid); border-color: var(--blauw-mid); }
docs/styles.css:331:  position: fixed; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom)); transform: translateX(-50%);
docs/styles.css:333:  font-weight: 700; z-index: 90; box-shadow: 0 4px 14px rgba(0,0,0,.3); max-width: 92vw;
docs/styles.css:390:  position: fixed; z-index: 18;
docs/styles.css:392:  bottom: calc(16px + env(safe-area-inset-bottom));
docs/styles.css:470:  position: fixed; top: calc(52px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
docs/styles.css:472:  padding: 10px 18px; font-weight: 700; z-index: 95; box-shadow: 0 4px 14px rgba(0,0,0,.25); cursor: pointer;
docs/styles.css:585:  position: sticky; top: 0; z-index: 60; background: #a63c2c; color: #fff;
docs/styles.css:641:  position: fixed; left: 0; right: 0; bottom: 0; z-index: 60;
docs/styles.css:643:  padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
docs/styles.css:656:body.nav-tegels { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
docs/styles.css:657:body.nav-tegels .snel-vangst { bottom: calc(76px + env(safe-area-inset-bottom)); }
docs/styles.css:662:.meer-paneel { position: fixed; inset: 0; z-index: 70; display: flex; align-items: flex-end; }
docs/styles.css:666:  border-radius: 18px 18px 0 0; padding: 10px 16px calc(18px + env(safe-area-inset-bottom));
docs/instructies.html:59:        <span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span>
docs/nphv/instructies.html:60:        <span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span>
docs/nphv/sw.js:74:      // bestaand venster: eerst naar de juiste wedstrijd navigeren, dan focussen
docs/nphv/sw.js:76:        try { await c.navigate('./' + route); } catch { /* navigatie geweigerd: alleen focus */ }
docs/nphv/sw.js:78:      if ('focus' in c) return c.focus();
docs/nphv/index.html:32:  <button id="btn-terug" class="terug-knop" aria-label="Terug" hidden>‹</button>
docs/nphv/index.html:40:    <span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span>
docs/nphv/index.html:316:      <span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span>
docs/nphv/index.html:319:      <button class="tegel" data-ga="kaart"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z'/><path d='M9 3v15M15 6v15'/></svg></span><span class="t-titel">Viswater</span><span class="t-sub">de kaart met alle stekken</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/nphv/index.html:320:      <button class="tegel" data-ga="loting"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6M3 3l6 6'/></svg></span><span class="t-titel">Loting</span><span class="t-sub">wie zit waar, en je eigen plek</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/nphv/index.html:321:      <button class="tegel" data-ga="klassement"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M8 4h8v5a4 4 0 0 1-8 0z'/><path d='M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3'/><path d='M10 14h4v4h-4zM8 20h8'/></svg></span><span class="t-titel">Klassement</span><span class="t-sub">de stand van nu</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/nphv/index.html:322:      <button class="tegel" data-ga="vangsten"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg></span><span class="t-titel">Vangsten</span><span class="t-sub">alles wat er gevangen is</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/nphv/index.html:350:    <div class="card" id="loting-card">
docs/nphv/index.html:583:  <button data-ga="overzicht"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M3 10.5 12 3l9 7.5'/><path d='M5 9.8V21h14V9.8'/></svg><span>Overzicht</span></button>
docs/nphv/index.html:584:  <button data-ga="kaart"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z'/><circle cx='12' cy='10' r='2.6'/></svg><span>Kaart</span></button>
docs/nphv/index.html:585:  <button data-ga="vangsten"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg><span>Vangsten</span></button>
docs/nphv/index.html:586:  <button data-meer><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='5' cy='12' r='1.6'/><circle cx='12' cy='12' r='1.6'/><circle cx='19' cy='12' r='1.6'/></svg><span>Meer</span></button>
docs/nphv/index.html:589:  <div class="meer-vlak" data-meer-sluit></div>
docs/nphv/index.html:593:    <button class="btn breed" data-meer-sluit>Sluiten</button>
docs/inloggen/index.html:52:    <span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span>
docs/demo/sw.js:73:      // bestaand venster: eerst naar de juiste wedstrijd navigeren, dan focussen
docs/demo/sw.js:75:        try { await c.navigate('./' + route); } catch { /* navigatie geweigerd: alleen focus */ }
docs/demo/sw.js:77:      if ('focus' in c) return c.focus();
docs/demo/instructies.html:60:        <span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span>
docs/demo/index.html:32:  <button id="btn-terug" class="terug-knop" aria-label="Terug" hidden>‹</button>
docs/demo/index.html:40:    <span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span>
docs/demo/index.html:332:      <span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span>
docs/demo/index.html:335:      <button class="tegel" data-ga="kaart"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z'/><path d='M9 3v15M15 6v15'/></svg></span><span class="t-titel">Viswater</span><span class="t-sub">de kaart met alle stekken</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/demo/index.html:336:      <button class="tegel" data-ga="loting"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M21 21l-6-6M3 3l6 6'/></svg></span><span class="t-titel">Loting</span><span class="t-sub">wie zit waar, en je eigen plek</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/demo/index.html:337:      <button class="tegel" data-ga="klassement"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M8 4h8v5a4 4 0 0 1-8 0z'/><path d='M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3'/><path d='M10 14h4v4h-4zM8 20h8'/></svg></span><span class="t-titel">Klassement</span><span class="t-sub">de stand van nu</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/demo/index.html:338:      <button class="tegel" data-ga="vangsten"><span class="t-icoon"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg></span><span class="t-titel">Vangsten</span><span class="t-sub">alles wat er gevangen is</span><span class="t-pijl" aria-hidden="true">&rsaquo;</span></button>
docs/demo/index.html:365:    <div class="card" id="loting-card">
docs/demo/index.html:598:  <button data-ga="overzicht"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M3 10.5 12 3l9 7.5'/><path d='M5 9.8V21h14V9.8'/></svg><span>Overzicht</span></button>
docs/demo/index.html:599:  <button data-ga="kaart"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z'/><circle cx='12' cy='10' r='2.6'/></svg><span>Kaart</span></button>
docs/demo/index.html:600:  <button data-ga="vangsten"><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M2 12s3.6-5 8.6-5c3 0 5.5 1.7 6.8 3.5L21 8.5v7l-3.6-2c-1.3 1.8-3.8 3.5-6.8 3.5C5.6 17 2 12 2 12z'/><circle cx='8' cy='10.8' r='.8' fill='currentColor' stroke='none'/></svg><span>Vangsten</span></button>
docs/demo/index.html:601:  <button data-meer><svg class='' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='5' cy='12' r='1.6'/><circle cx='12' cy='12' r='1.6'/><circle cx='19' cy='12' r='1.6'/></svg><span>Meer</span></button>
docs/demo/index.html:604:  <div class="meer-vlak" data-meer-sluit></div>
docs/demo/index.html:608:    <button class="btn breed" data-meer-sluit>Sluiten</button>
docs/index.html:50:          <span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span>
docs/index.html:391:    <p class="slogan-voet"><span class="slogan-blok"><span class="tekst">Loot<span class="punt">.</span> Vis<span class="punt">.</span> Win<span class="punt">.</span></span><svg viewBox="0 0 200 15" aria-hidden="true" focusable="false"><path d="M2.5 11.2C34 5.1 96 1.6 174 2.2c8 .1 16 .6 23.5 1.7-7.4.3-15 .1-22.6.1-60-.3-116 2.4-168.5 9.4-2.4.3-4.3-.6-3.9-2.2z" fill="currentColor"/></svg></span></p>

codex
De rolcontrole blijft voor de nieuwe knoppen intact. Wel blijven de onderbalk en het Meer-paneel buiten de wedstrijd zichtbaar na bepaalde routewissels. Ook vervangt `renderMeer()` telkens alle knoppen, waardoor een gebruiker die met het toetsenbord navigeert zijn focus kan verliezen.

exec
/bin/zsh -lc "sed -n '450,470p' docs/app.js; sed -n '925,969p' docs/app.js; rg -n 'function fase|outline|\\.tabs|box-sizing' docs/app.js docs/styles.css; nl -ba docs/styles.css | sed -n '638,678p'; nl -ba /Users/kemble/.codex/memories/MEMORY.md | sed -n '237,241p'" in /Users/kemble/Library/CloudStorage/OneDrive-Kemblinck/Claude cowork/KemblincK/Viswedstrijdapp/app
 succeeded in 0ms:
// de volgende poll ongeldig verklaard. Op een traag netwerk gold dat voor ELK
// antwoord en bevroor het scherm terwijl de app leek te werken (Codex v11 P1).
let SESSIE_GEN = 0;
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  localStorage.removeItem('recente'); // opruiming: Recent-sectie is vervallen
  $('#btn-terug').addEventListener('click', () => {
    // organisator in een wedstrijd -> terug naar het organisatie-overzicht; anders naar het startscherm
    if (CODE && ROL === 'organisator' && sessie.orgWw()) { location.hash = '#/org'; return; }
    // bewust naar het startscherm: dan niet meteen weer terugsturen (sessie-herstel)
    sessionStorage.setItem(HOME_BEWUST(), '1');
    location.hash = '';
  });
  document.querySelector('.brand')?.addEventListener('click', () => sessionStorage.setItem(HOME_BEWUST(), '1'));
  // herstelveld is type=password (wachtwoordmanager); het oogje toont de code
  document.querySelectorAll('[data-toon-code]').forEach((b) => b.addEventListener('click', () => {
    const veld = $(b.dataset.toonCode);
    if (!veld) return;
    veld.type = veld.type === 'password' ? 'text' : 'password';
    b.textContent = veld.type === 'password' ? '\ud83d\udc41' : '\ud83d\ude48';
    b.setAttribute('aria-label', veld.type === 'password' ? 'toon code' : 'verberg code');
  } finally {
    // alleen de eigenaar van de huidige generatie geeft de vlag vrij; een laat
    // antwoord van een verlaten scherm mag het lopende verzoek niet vrijgeven
    if (mijnGen === SESSIE_GEN) STATE_BEZIG = false;
  }
}
function toonNietGevonden() {
  if (sessie.laatste()?.code === CODE) sessie.wisLaatste();   // anders blijft de app hierheen springen
  $('#w-naam').textContent = 'Wedstrijd niet gevonden';
  $('#klok').textContent = '--:--:--';
  $('#klok-sub').textContent = 'Controleer de code of vraag de organisator om de juiste link.';
}

function meldNieuweVangsten() {
  const ids = new Set(STATE.vangsten.map((v) => v.id));
  if (BEKENDE_VANGSTEN) {
    const mijn = sessie.team(CODE);
    const teamsBijId = new Map(STATE.teams.map((t) => [t.id, t]));
    for (const v of STATE.vangsten) {
      if (BEKENDE_VANGSTEN.has(v.id)) continue;
      if (mijn && v.team_id === mijn.id) continue;
      const t = teamsBijId.get(v.team_id);
      toast(`🐟 Nieuwe vangst: ${fmtKg(v.gewicht_gram)} door ${t ? teamNaam(t) : 'onbekend'}`);
    }
  }
  BEKENDE_VANGSTEN = ids;
}

function renderAlles(eerste) {
  renderKop();
  tikKlok();
  renderKlassement();
  renderPushKnop();
  const kijkerCard = $('#kijker-card');
  if (kijkerCard) kijkerCard.hidden = ROL !== 'kijker';
  renderKaart();      // kijkers: alleen lezen (magSelecteren is false zonder team of pin)
  renderLoting();
  renderVangsten();
  if (ROL === 'kijker') return; // kijkers: geen team-tab, beheer of zwevende knop
  if (ROL === 'deelnemer') { renderTeamTab(); renderWachtrij(); }
  if (ROL === 'organisator') renderBeheer(eerste);
  renderSnelVangst();
}

// De knop in de onderbalk die bij de huidige tab hoort krijgt de actieve stijl.
docs/styles.css:37:* { box-sizing: border-box; }
docs/styles.css:47:button, a, .stek, .tabs button { touch-action: manipulation; }
docs/styles.css:116:input:focus, select:focus { outline: 2px solid var(--blauw-mid); border-color: var(--blauw-mid); }
docs/styles.css:156:.tabs {
docs/styles.css:163:  .tabs { flex-wrap: wrap; overflow-x: visible; }
docs/styles.css:164:  .tabs button { flex: 1 1 30%; font-size: 13px; padding: 8px 6px; min-height: 40px; }
docs/styles.css:166:.tabs button {
docs/styles.css:172:.tabs button.actief { background: var(--blauw); color: #fff; }
docs/styles.css:283:.lightbox .sluit:focus-visible { outline: 2px solid #fff; border-radius: 8px; }
docs/styles.css:320:  .tabs { top: 42px; }
docs/styles.css:321:  .tabs button { font-size: 12px; padding: 8px 8px; }
docs/styles.css:328:textarea:focus { outline: 2px solid var(--blauw-mid); border-color: var(--blauw-mid); }
docs/app.js:414:function fase() {
   638	/* vaste balk onderaan */
   639	.onderbalk[hidden], .meer-paneel[hidden] { display: none; }
   640	.onderbalk {
   641	  position: fixed; left: 0; right: 0; bottom: 0; z-index: 60;
   642	  background: #293222; display: flex; justify-content: space-around;
   643	  padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
   644	  box-shadow: 0 -6px 20px rgba(0, 0, 0, .22);
   645	}
   646	.onderbalk button {
   647	  flex: 1; background: none; border: 0; cursor: pointer; font: inherit;
   648	  display: flex; flex-direction: column; align-items: center; gap: 3px;
   649	  padding: 6px 2px; color: #b9bfa6; font-size: 11px; font-weight: 700;
   650	  min-height: 48px; border-radius: 10px;
   651	}
   652	.onderbalk button svg { width: 22px; height: 22px; }
   653	.onderbalk button.aan { color: var(--oranje); }
   654	.onderbalk button:active { background: rgba(255, 255, 255, .08); }
   655	
   656	body.nav-tegels { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
   657	body.nav-tegels .snel-vangst { bottom: calc(76px + env(safe-area-inset-bottom)); }
   658	body.nav-tegels.op-overzicht #tabs { display: none; }
   659	body.meer-open { overflow: hidden; }
   660	
   661	/* Meer-paneel */
   662	.meer-paneel { position: fixed; inset: 0; z-index: 70; display: flex; align-items: flex-end; }
   663	.meer-vlak { position: absolute; inset: 0; background: rgba(20, 24, 15, .55); }
   664	.meer-inhoud {
   665	  position: relative; width: 100%; background: var(--kaart);
   666	  border-radius: 18px 18px 0 0; padding: 10px 16px calc(18px + env(safe-area-inset-bottom));
   667	  max-height: 80vh; overflow: auto;
   668	}
   669	.meer-greep { width: 40px; height: 4px; border-radius: 2px; background: var(--kaart-rand); margin: 0 auto 12px; }
   670	.meer-knop {
   671	  width: 100%; display: flex; justify-content: space-between; align-items: center;
   672	  background: #f1eedd; border: 1px solid var(--kaart-rand); border-radius: 12px;
   673	  padding: 14px 16px; margin-bottom: 8px; font: inherit; font-weight: 700;
   674	  color: var(--groen-donker); cursor: pointer; min-height: 48px;
   675	}
   676	.meer-knop:active { background: #e7e3cf; }
   677	@media (min-width: 620px) {
   678	  .tegels { grid-template-columns: repeat(4, 1fr); }
   237	# Task Group: Viswedstrijden code-review and Claude handoff
   238	
   239	scope: Review the Viswedstrijden webapp or prepare a concrete Dutch Markdown review for Claude Code; includes v1 findings and boundaries for resuming the unfinished v21 review.
   240	applies_to: cwd=/Users/kemble/Library/CloudStorage/OneDrive-Persoonlijk/Claude cowork/KemblincK/Viswedstrijden; reuse_rule=revalidate effective SQL and edge functions before treating findings as current.
   241	

2026-09-20T21:44:57.621133Z ERROR codex_core::tools::router: error=collab spawn failed: no thread with id: 01a0c0c7-63a4-79d2-9ece-5b5eb097b1aa
codex
**Oordeel: nog niet vrijgeven.** De nieuwe navigatie omzeilt de rolcontrole niet, maar de afhandeling van routewissels en focus moet worden hersteld.

STORM-check: beoordeeld op de diff én de lokale broncode. Geen praktijktest op een iPhone uitgevoerd. Eén verschil met je context: lokaal roept niet iedere zessecondenpoll rechtstreeks `renderTabs()` aan; dat gebeurt onder andere bij de eerste laadactie en na `laadSeizoen()`. Hieronder benoem ik waar dat verschil uitmaakt.

1. **Middel: onderbalk blijft zichtbaar buiten een wedstrijd.**  
   **Bestand:** `docs/app.js`, `renderTabs()` en `toonView()`.  
   Na het openen van een wedstrijd wordt `#onderbalk` zichtbaar. Bij teruggaan naar home of het organisatieoverzicht wordt hij niet verborgen. Hij staat buiten de wedstrijdview en blijft daardoor beschikbaar. De knoppen activeren vervolgens tabs binnen een verborgen wedstrijdview, zonder zichtbaar resultaat.  
   **Herstel:** toon de balk uitsluitend als `TEGELS()` aanstaat én de wedstrijdview actief is. Werk ook `nav-tegels` en `op-overzicht` bij wanneer je de wedstrijd verlaat.

2. **Middel: Meer-paneel blijft open bij route- of wedstrijdwissel.**  
   **Bestand:** `docs/app.js`, `route()`, `toonMeer()` en `sluitMeer()`.  
   Open Meer en wissel de hash, bijvoorbeeld via browser-terug. `route()` sluit het paneel niet. Het blijft over het nieuwe scherm liggen en `body.meer-open` houdt scrollen geblokkeerd. Bij een andere wedstrijd kunnen de knoppen achter het open paneel veranderen.  
   **Herstel:** roep `sluitMeer()` aan bij iedere routewissel, vóór het verwerken van de nieuwe route.

3. **Middel: opnieuw renderen verwijdert de gefocuste Meer-knop.**  
   **Bestand:** `docs/app.js`, `renderMeer()`.  
   Iedere aanroep vervangt alle knoppen met `innerHTML`, ook wanneer inhoud en rol gelijk blijven. Staat de toetsenbordfocus op zo’n knop, dan verdwijnt dat element en verliest de gebruiker zijn positie. Met de door jou beschreven poll gebeurt dit mogelijk iedere zes seconden; in de lokale code bij de genoemde renderaanroepen. Dit is geen geheugenlek.  
   **Herstel:** vervang de inhoud alleen als de doelen of labels veranderen. Behoud bij noodzakelijke vervanging de focus op hetzelfde navigatiedoel.

4. **Middel: het Meer-paneel heeft geen werkend modaal focusgedrag.**  
   **Bestanden:** `docs/app.js`, `toonMeer()`/`sluitMeer()`; `docs/demo/index.html` en `docs/nphv/index.html`, `.meer-inhoud`.  
   Openen verplaatst de focus niet naar het paneel. Tab kan achter de overlay terechtkomen; Escape sluit niets. Sluiten herstelt de focus niet. `role="dialog"` alleen regelt dit niet. Ook tegels kunnen bij navigatie de focus achterlaten in een sectie die wordt verborgen.  
   **Herstel:** implementeer focusplaatsing, focusbegrenzing, Escape en focusterugkeer. Maak de achtergrond tijdens het dialoogvenster inert en voeg passend `aria-modal`, `aria-expanded` en `aria-controls` toe. Verplaats na tegelnavigatie de focus naar het doelscherm.

5. **Middel: automatische tabwissel synchroniseert de onderbalk niet.**  
   **Bestand:** `docs/app.js`, laatste blok van `renderTabs()`.  
   Als de actieve tab vervalt, bijvoorbeeld wanneer een geselecteerde seizoen-tab verdwijnt, activeert dit blok rechtstreeks `overzicht`. Het roept `merkOnderbalk()` niet aan. Daardoor kan Meer geselecteerd blijven en blijft de bovenste tabbalk zichtbaar op het overzicht.  
   Bovendien wordt de bewust verborgen overzichtknop door `actief.hidden` iedere keer als ongeldige actieve tab behandeld. Dat stuurt gebruikers op een andere geldige tab **niet** iedere poll terug, maar veroorzaakt wel onnodige herstelacties.  
   **Herstel:** bepaal geldigheid op basis van `zichtbaar.includes(...)` en gebruik één functie om tabinhoud, actieve knoppen en `op-overzicht` te synchroniseren.

6. **Laag: “Naar het startscherm” heeft voor organisatoren een ander doel.**  
   **Bestand:** `docs/app.js`, `ga('home')` en de bestaande `#btn-terug`-handler.  
   Een organisator met `sessie.orgWw()` gaat naar `#/org`, terwijl de knop het startscherm belooft.  
   **Herstel:** navigeer expliciet naar home of pas het label aan het werkelijke doel aan.

De overige vragen:

- **Rolbeveiliging:** intact voor deze nieuwe navigatieroutes. Meer gebruikt de rollijst; alle tabdoelen lopen door `activateTab()`. Een kijker krijgt zo geen toegang tot `team` of `beheer`. De fallback naar deelnemer bij een onbekende rol bestond al.
- **Globale click-handler:** in de onderzochte broncode geen bestaande, onafhankelijke toepassingen van `data-ga` of `data-meer` gevonden. Dus geen aangetoonde kaping. De handler is wel onnodig breed en actief bij een uitgeschakelde vlag. Begrens hem tot de nieuwe navigatiecontainers, met controle op vlag en actieve wedstrijdview. `[data-meer]` matcht overigens **niet** `[data-meer-sluit]`.
- **Dubbele handlers/geheugenlekken:** niet aangetoond. `initWedstrijd()` wordt eenmaal bij `DOMContentLoaded` aangeroepen. De door `activateTab()` opgewekte klik bevat alleen `data-tab` en veroorzaakt hier geen navigatielus.
- **Vlag uit / `STATE === null`:** geen concrete crash gevonden. Optional chaining beschermt de nieuwe labels; overzicht en onderbalk blijven verborgen bij NPHV.
- **Mobiel:** de nieuwe navigatieknoppen hebben minimaal 48 px hoogte; de tegels minimaal 104 px. Onderste safe-area en `viewport-fit=cover` zijn aanwezig. Linker- en rechter-safe-area ontbreken bij de nieuwe vaste balk en het paneel. Controleer dit in liggende iPhone-stand en voeg daar zo nodig inset-padding toe. De belangrijkste aantoonbare toegankelijkheidsproblemen zijn focus en herhaald vervangen van knoppen.


tokens used
39.086
**Oordeel: nog niet vrijgeven.** De nieuwe navigatie omzeilt de rolcontrole niet, maar de afhandeling van routewissels en focus moet worden hersteld.

STORM-check: beoordeeld op de diff én de lokale broncode. Geen praktijktest op een iPhone uitgevoerd. Eén verschil met je context: lokaal roept niet iedere zessecondenpoll rechtstreeks `renderTabs()` aan; dat gebeurt onder andere bij de eerste laadactie en na `laadSeizoen()`. Hieronder benoem ik waar dat verschil uitmaakt.

1. **Middel: onderbalk blijft zichtbaar buiten een wedstrijd.**  
   **Bestand:** `docs/app.js`, `renderTabs()` en `toonView()`.  
   Na het openen van een wedstrijd wordt `#onderbalk` zichtbaar. Bij teruggaan naar home of het organisatieoverzicht wordt hij niet verborgen. Hij staat buiten de wedstrijdview en blijft daardoor beschikbaar. De knoppen activeren vervolgens tabs binnen een verborgen wedstrijdview, zonder zichtbaar resultaat.  
   **Herstel:** toon de balk uitsluitend als `TEGELS()` aanstaat én de wedstrijdview actief is. Werk ook `nav-tegels` en `op-overzicht` bij wanneer je de wedstrijd verlaat.

2. **Middel: Meer-paneel blijft open bij route- of wedstrijdwissel.**  
   **Bestand:** `docs/app.js`, `route()`, `toonMeer()` en `sluitMeer()`.  
   Open Meer en wissel de hash, bijvoorbeeld via browser-terug. `route()` sluit het paneel niet. Het blijft over het nieuwe scherm liggen en `body.meer-open` houdt scrollen geblokkeerd. Bij een andere wedstrijd kunnen de knoppen achter het open paneel veranderen.  
   **Herstel:** roep `sluitMeer()` aan bij iedere routewissel, vóór het verwerken van de nieuwe route.

3. **Middel: opnieuw renderen verwijdert de gefocuste Meer-knop.**  
   **Bestand:** `docs/app.js`, `renderMeer()`.  
   Iedere aanroep vervangt alle knoppen met `innerHTML`, ook wanneer inhoud en rol gelijk blijven. Staat de toetsenbordfocus op zo’n knop, dan verdwijnt dat element en verliest de gebruiker zijn positie. Met de door jou beschreven poll gebeurt dit mogelijk iedere zes seconden; in de lokale code bij de genoemde renderaanroepen. Dit is geen geheugenlek.  
   **Herstel:** vervang de inhoud alleen als de doelen of labels veranderen. Behoud bij noodzakelijke vervanging de focus op hetzelfde navigatiedoel.

4. **Middel: het Meer-paneel heeft geen werkend modaal focusgedrag.**  
   **Bestanden:** `docs/app.js`, `toonMeer()`/`sluitMeer()`; `docs/demo/index.html` en `docs/nphv/index.html`, `.meer-inhoud`.  
   Openen verplaatst de focus niet naar het paneel. Tab kan achter de overlay terechtkomen; Escape sluit niets. Sluiten herstelt de focus niet. `role="dialog"` alleen regelt dit niet. Ook tegels kunnen bij navigatie de focus achterlaten in een sectie die wordt verborgen.  
   **Herstel:** implementeer focusplaatsing, focusbegrenzing, Escape en focusterugkeer. Maak de achtergrond tijdens het dialoogvenster inert en voeg passend `aria-modal`, `aria-expanded` en `aria-controls` toe. Verplaats na tegelnavigatie de focus naar het doelscherm.

5. **Middel: automatische tabwissel synchroniseert de onderbalk niet.**  
   **Bestand:** `docs/app.js`, laatste blok van `renderTabs()`.  
   Als de actieve tab vervalt, bijvoorbeeld wanneer een geselecteerde seizoen-tab verdwijnt, activeert dit blok rechtstreeks `overzicht`. Het roept `merkOnderbalk()` niet aan. Daardoor kan Meer geselecteerd blijven en blijft de bovenste tabbalk zichtbaar op het overzicht.  
   Bovendien wordt de bewust verborgen overzichtknop door `actief.hidden` iedere keer als ongeldige actieve tab behandeld. Dat stuurt gebruikers op een andere geldige tab **niet** iedere poll terug, maar veroorzaakt wel onnodige herstelacties.  
   **Herstel:** bepaal geldigheid op basis van `zichtbaar.includes(...)` en gebruik één functie om tabinhoud, actieve knoppen en `op-overzicht` te synchroniseren.

6. **Laag: “Naar het startscherm” heeft voor organisatoren een ander doel.**  
   **Bestand:** `docs/app.js`, `ga('home')` en de bestaande `#btn-terug`-handler.  
   Een organisator met `sessie.orgWw()` gaat naar `#/org`, terwijl de knop het startscherm belooft.  
   **Herstel:** navigeer expliciet naar home of pas het label aan het werkelijke doel aan.

De overige vragen:

- **Rolbeveiliging:** intact voor deze nieuwe navigatieroutes. Meer gebruikt de rollijst; alle tabdoelen lopen door `activateTab()`. Een kijker krijgt zo geen toegang tot `team` of `beheer`. De fallback naar deelnemer bij een onbekende rol bestond al.
- **Globale click-handler:** in de onderzochte broncode geen bestaande, onafhankelijke toepassingen van `data-ga` of `data-meer` gevonden. Dus geen aangetoonde kaping. De handler is wel onnodig breed en actief bij een uitgeschakelde vlag. Begrens hem tot de nieuwe navigatiecontainers, met controle op vlag en actieve wedstrijdview. `[data-meer]` matcht overigens **niet** `[data-meer-sluit]`.
- **Dubbele handlers/geheugenlekken:** niet aangetoond. `initWedstrijd()` wordt eenmaal bij `DOMContentLoaded` aangeroepen. De door `activateTab()` opgewekte klik bevat alleen `data-tab` en veroorzaakt hier geen navigatielus.
- **Vlag uit / `STATE === null`:** geen concrete crash gevonden. Optional chaining beschermt de nieuwe labels; overzicht en onderbalk blijven verborgen bij NPHV.
- **Mobiel:** de nieuwe navigatieknoppen hebben minimaal 48 px hoogte; de tegels minimaal 104 px. Onderste safe-area en `viewport-fit=cover` zijn aanwezig. Linker- en rechter-safe-area ontbreken bij de nieuwe vaste balk en het paneel. Controleer dit in liggende iPhone-stand en voeg daar zo nodig inset-padding toe. De belangrijkste aantoonbare toegankelijkheidsproblemen zijn focus en herhaald vervangen van knoppen.



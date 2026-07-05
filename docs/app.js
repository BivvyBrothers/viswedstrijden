/* Viswedstrijden Plas van der Ende - app-logica */
'use strict';

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const FOUTEN = {
  wedstrijd_niet_gevonden: 'Wedstrijd niet gevonden. Controleer de code.',
  aanmelden_gesloten: 'Het aanmelden is gesloten: de loting is al gestart.',
  ongeldige_naam: 'Vul een geldige naam in (max. 40 tekens).',
  tweede_naam_verplicht: 'Dit is een koppelwedstrijd: vul ook de naam van je koppelmaat in.',
  naam_bestaat_al: 'Deze naam is al aangemeld. Kies een andere naam.',
  pin_onjuist: 'Pincode onjuist.',
  pin_te_kort: 'Pincode moet minimaal 4 tekens zijn.',
  al_geloot: 'De loting is al gestart.',
  geen_deelnemers: 'Er zijn nog geen deelnemers aangemeld.',
  geen_stekkeuze_fase: 'De stekkeuze is nu niet actief.',
  team_niet_gevonden: 'Je deelname is niet gevonden. Meld je opnieuw aan.',
  al_gekozen: 'Je hebt al een stek gekozen.',
  niet_jouw_beurt: 'Je bent nog niet aan de beurt.',
  verkeerd_aantal_stekken: 'Kies het juiste aantal stekken.',
  onbekende_stek: 'Onbekend steknummer.',
  stekken_niet_naast_elkaar: 'De twee stekken moeten naast elkaar liggen.',
  stek_bezet: 'Die stek is net gekozen door iemand anders. Kies een andere.',
  wedstrijd_niet_begonnen: 'De wedstrijd is nog niet begonnen.',
  wedstrijd_afgelopen: 'De wedstrijd is afgelopen: registreren kan niet meer.',
  ongeldige_foto: 'De foto kon niet worden verwerkt.',
  eind_voor_start: 'De eindtijd moet na de starttijd liggen.',
  alleen_tijdens_aanmelden: 'Kan alleen tijdens de aanmeldfase.',
  vangst_niet_gevonden: 'Vangst niet gevonden.',
};
const foutTekst = (e) => FOUTEN[e.message] || ('Er ging iets mis: ' + e.message);

async function rpc(fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
    },
    body: JSON.stringify(args || {}),
  });
  if (!r.ok) {
    let msg = 'onbekende_fout';
    try { const j = await r.json(); msg = j.message || msg; } catch { /* leeg */ }
    throw new Error(msg);
  }
  const tekst = await r.text();
  return tekst ? JSON.parse(tekst) : null;
}

async function uploadFoto(code, blob) {
  const pad = `${code}/${crypto.randomUUID()}.jpg`;
  const r = await fetch(`${SB_URL}/storage/v1/object/${FOTO_BUCKET}/${pad}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'image/jpeg' },
    body: blob,
  });
  if (!r.ok) throw new Error('ongeldige_foto');
  return pad;
}
const fotoUrl = (pad) => `${SB_URL}/storage/v1/object/public/${FOTO_BUCKET}/${pad}`;

function parseGewicht(txt) {
  const n = parseFloat(String(txt).replace(',', '.').replace(/[^0-9.]/g, ''));
  if (!isFinite(n)) return null;
  const gram = Math.round(n * 1000);
  if (gram < 50 || gram > 50000) return null;
  return gram;
}
const fmtKg = (gram) => (gram / 1000).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
const fmtTijd = (iso) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
const fmtDatumTijd = (iso) => new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function naarLocalInput(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const teamNaam = (t) => t.naam2 ? `${t.naam} & ${t.naam2}` : t.naam;

async function compressFoto(file, maxDim = 1400, kwaliteit = 0.8) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const schaal = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * schaal);
  c.height = Math.round(bmp.height * schaal);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => b ? res(b) : rej(new Error('ongeldige_foto')), 'image/jpeg', kwaliteit));
}

/* ---------- globale app-status ---------- */
let CODE = null;          // actieve wedstrijdcode
let STATE = null;         // laatste w_get_state resultaat
let TIJD_OFFSET = 0;      // server_now - Date.now()
let POLL = null;
let KLOKTIK = null;
let SELECTIE = [];        // geselecteerde stekken tijdens stekkeuze
let KLASSEMENT_MODE = 'totaal';
let ADMIN_OPEN = false;

const sessie = {
  team(code) { try { return JSON.parse(localStorage.getItem('team:' + code)); } catch { return null; } },
  zetTeam(code, t) { localStorage.setItem('team:' + code, JSON.stringify(t)); },
  pin(code) { return sessionStorage.getItem('pin:' + code); },
  zetPin(code, pin) { sessionStorage.setItem('pin:' + code, pin); },
  recent() { try { return JSON.parse(localStorage.getItem('recente')) || []; } catch { return []; } },
  zetRecent(code, naam) {
    const lijst = this.recent().filter((r) => r.code !== code);
    lijst.unshift({ code, naam });
    localStorage.setItem('recente', JSON.stringify(lijst.slice(0, 6)));
  },
};

const nu = () => Date.now() + TIJD_OFFSET;
function fase() {
  if (!STATE?.wedstrijd) return 'onbekend';
  const w = STATE.wedstrijd;
  const t = nu();
  if (t < new Date(w.start_ts).getTime()) return 'voor';
  if (t <= new Date(w.eind_ts).getTime()) return 'live';
  return 'voorbij';
}

/* ---------- routing ---------- */
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => { initHome(); initWedstrijd(); route(); });

function route() {
  const m = location.hash.match(/^#\/w\/([A-Za-z0-9]{4,8})/);
  clearInterval(POLL); clearInterval(KLOKTIK);
  if (m) {
    CODE = m[1].toUpperCase();
    $('#topcode').textContent = CODE;
    toonView('wedstrijd');
    SELECTIE = [];
    ADMIN_OPEN = false;
    STATE = null;
    laadState(true);
    POLL = setInterval(() => laadState(false), 6000);
    KLOKTIK = setInterval(tikKlok, 1000);
  } else {
    CODE = null;
    $('#topcode').textContent = '';
    toonView('home');
    renderRecente();
  }
}
function toonView(naam) {
  $('#view-home').hidden = naam !== 'home';
  $('#view-wedstrijd').hidden = naam !== 'wedstrijd';
}

/* ---------- home ---------- */
function initHome() {
  const startVeld = $('#nw-start'), eindVeld = $('#nw-eind');
  const morgen = new Date(Date.now() + 86400000);
  morgen.setHours(8, 0, 0, 0);
  startVeld.value = naarLocalInput(morgen.toISOString());
  const eind = new Date(morgen); eind.setHours(17, 0, 0, 0);
  eindVeld.value = naarLocalInput(eind.toISOString());

  $('#form-open').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#open-code').value.trim().toUpperCase();
    if (code) location.hash = '#/w/' + code;
  });

  $('#form-nieuw').addEventListener('submit', async (e) => {
    e.preventDefault();
    const foutEl = $('#nieuw-fout'); foutEl.hidden = true;
    try {
      const res = await rpc('w_maak_wedstrijd', {
        p_naam: $('#nw-naam').value.trim(),
        p_mode: $('#nw-mode').value,
        p_start: new Date(startVeld.value).toISOString(),
        p_eind: new Date(eindVeld.value).toISOString(),
        p_pin: $('#nw-pin').value.trim(),
      });
      sessie.zetPin(res.code, $('#nw-pin').value.trim());
      sessie.zetRecent(res.code, $('#nw-naam').value.trim());
      location.hash = '#/w/' + res.code;
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });
}
function renderRecente() {
  const el = $('#recente');
  const lijst = sessie.recent();
  el.innerHTML = lijst.length
    ? '<span class="muted klein">Recent: </span>' + lijst.map((r) => `<a href="#/w/${esc(r.code)}">${esc(r.naam)} (${esc(r.code)})</a>`).join('')
    : '';
}

/* ---------- wedstrijd: state laden ---------- */
async function laadState(eerste) {
  if (!CODE) return;
  try {
    const s = await rpc('w_get_state', { p_code: CODE });
    if (!s?.wedstrijd) { toonNietGevonden(); return; }
    STATE = s;
    TIJD_OFFSET = new Date(s.server_now).getTime() - Date.now();
    if (eerste) sessie.zetRecent(CODE, s.wedstrijd.naam);
    renderAlles(eerste);
  } catch (err) {
    if (eerste) toonNietGevonden();
  }
}
function toonNietGevonden() {
  $('#w-naam').textContent = 'Wedstrijd niet gevonden';
  $('#klok').textContent = '--:--:--';
  $('#klok-sub').textContent = 'Controleer de code of vraag de organisator om de juiste link.';
}

function renderAlles(eerste) {
  renderKop();
  tikKlok();
  renderKaart();
  renderLoting();
  renderKlassement();
  renderVangsten();
  renderTeamTab();
  renderBeheer(eerste);
}

/* ---------- kop + klok ---------- */
function renderKop() {
  const w = STATE.wedstrijd;
  $('#w-naam').textContent = w.naam;
  $('#w-tijden').textContent =
    `${fmtDatumTijd(w.start_ts)} tot ${fmtDatumTijd(w.eind_ts)}` +
    (w.mode === 'koppel' ? ' · koppelwedstrijd' : ' · individueel');
  const chip = $('#w-status');
  const f = fase();
  chip.className = 'chip';
  if (f === 'voorbij') { chip.textContent = 'Afgelopen'; chip.classList.add('voorbij'); }
  else if (f === 'live') { chip.textContent = '● LIVE'; chip.classList.add('live'); }
  else if (w.status === 'aanmelden') chip.textContent = 'Aanmelden open';
  else if (w.status === 'stekkeuze') chip.textContent = 'Stekkeuze bezig';
  else chip.textContent = 'Wacht op start';
}

function tikKlok() {
  if (!STATE?.wedstrijd) return;
  const w = STATE.wedstrijd;
  const f = fase();
  const el = $('#klok'), sub = $('#klok-sub');
  el.classList.remove('bijna');
  let doel, label;
  if (f === 'voor') { doel = new Date(w.start_ts).getTime(); label = 'tot de start'; }
  else if (f === 'live') { doel = new Date(w.eind_ts).getTime(); label = 'tot het einde van de wedstrijd'; }
  else { el.textContent = 'AFGELOPEN'; sub.textContent = 'Registreren is gesloten.'; renderKop(); return; }
  let rest = Math.max(0, doel - nu());
  const u = Math.floor(rest / 3600000);
  const m = Math.floor((rest % 3600000) / 60000);
  const s = Math.floor((rest % 60000) / 1000);
  const p = (n) => String(n).padStart(2, '0');
  el.textContent = u > 99 ? `${u}u ${p(m)}m` : `${p(u)}:${p(m)}:${p(s)}`;
  sub.textContent = label;
  if (f === 'live' && rest < 15 * 60000) el.classList.add('bijna');
  if (rest === 0) laadState(false);
}

/* ---------- kaart ---------- */
function initKaart() {
  const houder = $('#kaart-houder');
  if (houder.dataset.klaar) return;
  houder.innerHTML = KAART_SVG;
  houder.dataset.klaar = '1';
  houder.addEventListener('click', (e) => {
    const g = e.target.closest('g.stek');
    if (g) klikStek(parseInt(g.dataset.stek, 10));
  });
}

function mijnTeam() {
  const t = sessie.team(CODE);
  if (!t || !STATE) return null;
  return STATE.teams.find((x) => x.id === t.id) || null;
}
function teamAanBeurt() {
  if (!STATE || STATE.wedstrijd.status !== 'stekkeuze') return null;
  const open = STATE.teams.filter((t) => t.lot_nummer && (!t.stekken || t.stekken.length === 0));
  if (!open.length) return null;
  return open.reduce((a, b) => (a.lot_nummer < b.lot_nummer ? a : b));
}
const aantalNodig = () => (STATE?.wedstrijd.mode === 'koppel' ? 2 : 1);

function klikStek(nr) {
  const w = STATE?.wedstrijd;
  if (!w || w.status !== 'stekkeuze') return;
  const mijn = mijnTeam();
  const beurt = teamAanBeurt();
  if (!mijn || !beurt || beurt.id !== mijn.id) return;
  const bezet = STATE.teams.some((t) => (t.stekken || []).includes(nr));
  if (bezet) return;
  const i = SELECTIE.indexOf(nr);
  if (i >= 0) SELECTIE.splice(i, 1);
  else {
    SELECTIE.push(nr);
    if (SELECTIE.length > aantalNodig()) SELECTIE.shift();
  }
  renderKaart();
}

function renderKaart() {
  initKaart();
  const w = STATE.wedstrijd;
  const mijn = mijnTeam();
  const beurt = teamAanBeurt();
  const mijnBeurt = !!(mijn && beurt && mijn.id === beurt.id);
  if (!mijnBeurt) SELECTIE = [];

  const bezetDoor = {};
  for (const t of STATE.teams) for (const s of (t.stekken || [])) bezetDoor[s] = t;

  document.querySelectorAll('#kaart-houder g.stek').forEach((g) => {
    const nr = parseInt(g.dataset.stek, 10);
    g.classList.remove('bezet', 'mijn', 'keuze', 'kiesbaar');
    const eigenaar = bezetDoor[nr];
    const titel = g.querySelector('title');
    if (eigenaar) {
      g.classList.add(mijn && eigenaar.id === mijn.id ? 'mijn' : 'bezet');
      if (titel) titel.textContent = `Stek ${nr}: ${teamNaam(eigenaar)}`;
    } else {
      if (titel) titel.textContent = `Stek ${nr}: vrij`;
      if (SELECTIE.includes(nr)) g.classList.add('keuze');
      else if (mijnBeurt) g.classList.add('kiesbaar');
    }
  });

  const melding = $('#kaart-melding');
  const actie = $('#stek-actie');
  const knop = $('#btn-kies');
  if (w.status === 'stekkeuze' && beurt) {
    melding.hidden = false;
    if (mijnBeurt) {
      const n = aantalNodig();
      melding.className = 'melding groen';
      melding.textContent = n === 2
        ? `Jij bent aan de beurt! Kies 2 stekken naast elkaar (${SELECTIE.length}/2 geselecteerd).`
        : 'Jij bent aan de beurt! Tik op een vrije stek.';
      actie.hidden = false;
      let ok = SELECTIE.length === n;
      if (ok && n === 2) {
        const p = SELECTIE.map((s) => STEK_POSITIE[String(s)]).sort((a, b) => a - b);
        ok = p[1] - p[0] === 1;
        if (!ok) melding.textContent = 'Deze stekken liggen niet naast elkaar. Kies 2 aangrenzende stekken.';
      }
      knop.disabled = !ok;
      knop.textContent = ok ? `Bevestig stek ${[...SELECTIE].sort((a, b) => a - b).join(' + ')}` : 'Selecteer je stek' + (n === 2 ? 'ken' : '');
    } else {
      melding.className = 'melding';
      melding.textContent = `Aan de beurt: ${teamNaam(beurt)} (lot ${beurt.lot_nummer})`;
      actie.hidden = true;
    }
  } else {
    melding.hidden = true;
    actie.hidden = true;
  }
}

$('#btn-kies')?.addEventListener('click', async () => {
  const t = sessie.team(CODE);
  if (!t) return;
  const knop = $('#btn-kies');
  knop.disabled = true;
  try {
    await rpc('w_kies_stek', { p_code: CODE, p_token: t.token, p_stekken: [...SELECTIE].sort((a, b) => a - b) });
    SELECTIE = [];
    await laadState(false);
  } catch (err) {
    alert(foutTekst(err));
    await laadState(false);
  }
});

/* ---------- loting-lijst ---------- */
function renderLoting() {
  const el = $('#loting-lijst');
  const w = STATE.wedstrijd;
  const beurt = teamAanBeurt();
  if (!STATE.teams.length) {
    el.innerHTML = '<p class="muted">Nog geen deelnemers aangemeld.</p>';
    return;
  }
  const geloot = STATE.teams.some((t) => t.lot_nummer);
  el.innerHTML = (geloot ? '' : '<p class="muted klein">De loting is nog niet gestart. Volgorde hieronder is de aanmeldvolgorde.</p>') +
    STATE.teams.map((t) => {
      const isBeurt = beurt && beurt.id === t.id;
      const stekken = (t.stekken || []).length ? 'stek ' + t.stekken.join(' + ') : (geloot ? (isBeurt ? 'aan de beurt…' : 'wacht') : '');
      return `<div class="loting-rij${isBeurt ? ' beurt' : ''}">
        <span class="lotnr">${t.lot_nummer ?? '·'}</span>
        <span>${esc(teamNaam(t))}</span>
        <span class="stekjes">${esc(stekken)}</span>
      </div>`;
    }).join('');
}

/* ---------- klassement ---------- */
$('#kl-totaal').addEventListener('click', () => { KLASSEMENT_MODE = 'totaal'; renderKlassement(); });
$('#kl-grootste').addEventListener('click', () => { KLASSEMENT_MODE = 'grootste'; renderKlassement(); });

function renderKlassement() {
  $('#kl-totaal').classList.toggle('actief', KLASSEMENT_MODE === 'totaal');
  $('#kl-grootste').classList.toggle('actief', KLASSEMENT_MODE === 'grootste');
  const el = $('#klassement-inhoud');
  const perTeam = new Map();
  for (const t of STATE.teams) perTeam.set(t.id, { team: t, totaal: 0, aantal: 0, grootste: null });
  for (const v of STATE.vangsten) {
    const r = perTeam.get(v.team_id);
    if (!r) continue;
    r.totaal += v.gewicht_gram;
    r.aantal += 1;
    if (!r.grootste || v.gewicht_gram > r.grootste.gewicht_gram) r.grootste = v;
  }
  const rijen = [...perTeam.values()].filter((r) => r.aantal > 0);
  if (!rijen.length) {
    el.innerHTML = '<p class="muted">Nog geen vangsten geregistreerd.</p>';
    return;
  }
  const rangKlas = (i) => 'rank' + (i === 0 ? ' goud' : i === 1 ? ' zilver' : i === 2 ? ' brons' : '');
  if (KLASSEMENT_MODE === 'totaal') {
    rijen.sort((a, b) => b.totaal - a.totaal || b.aantal - a.aantal);
    el.innerHTML = `<table class="klassement">
      <tr><th>#</th><th>Team</th><th class="r">Vissen</th><th class="r">Totaal</th></tr>
      ${rijen.map((r, i) => `<tr>
        <td class="${rangKlas(i)}">${i + 1}</td>
        <td>${esc(teamNaam(r.team))}${r.team.stekken?.length ? ` <span class="muted klein">stek ${r.team.stekken.join('+')}</span>` : ''}</td>
        <td class="r">${r.aantal}</td>
        <td class="r"><b>${fmtKg(r.totaal)}</b></td>
      </tr>`).join('')}
    </table>`;
  } else {
    rijen.sort((a, b) => b.grootste.gewicht_gram - a.grootste.gewicht_gram);
    el.innerHTML = `<table class="klassement">
      <tr><th>#</th><th>Team</th><th class="r">Grootste vis</th><th></th></tr>
      ${rijen.map((r, i) => `<tr>
        <td class="${rangKlas(i)}">${i + 1}</td>
        <td>${esc(teamNaam(r.team))}</td>
        <td class="r"><b>${fmtKg(r.grootste.gewicht_gram)}</b></td>
        <td><img class="thumb" src="${esc(fotoUrl(r.grootste.foto_path))}" alt="grootste vis" data-groot="${esc(fotoUrl(r.grootste.foto_path))}"></td>
      </tr>`).join('')}
    </table>`;
  }
}

/* ---------- vangstenfeed ---------- */
function renderVangsten() {
  const el = $('#vangsten-feed');
  const admin = ADMIN_OPEN;
  if (!STATE.vangsten.length) {
    el.innerHTML = '<p class="muted">Nog geen vangsten. De eerste karper komt eraan…</p>';
    return;
  }
  const teamsBijId = new Map(STATE.teams.map((t) => [t.id, t]));
  el.innerHTML = STATE.vangsten.map((v) => {
    const t = teamsBijId.get(v.team_id);
    return `<div class="vangst-kaart">
      <img src="${esc(fotoUrl(v.foto_path))}" alt="vangst" data-groot="${esc(fotoUrl(v.foto_path))}" loading="lazy">
      <div class="info">
        <div class="gewicht">${fmtKg(v.gewicht_gram)}</div>
        <div class="wie">${esc(t ? teamNaam(t) : 'onbekend')}</div>
        <div class="tijd">${fmtTijd(v.created_at)}</div>
      </div>
    </div>`;
  }).join('');
}

/* ---------- mijn team + registreren ---------- */
function initWedstrijd() {
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('actief', x === b));
    document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== 'tab-' + b.dataset.tab; });
  });

  $('#form-join').addEventListener('submit', async (e) => {
    e.preventDefault();
    const foutEl = $('#join-fout'); foutEl.hidden = true;
    try {
      const res = await rpc('w_join', {
        p_code: CODE,
        p_naam: $('#join-naam').value.trim(),
        p_naam2: $('#join-naam2').value.trim() || null,
      });
      sessie.zetTeam(CODE, { id: res.team_id, token: res.token, naam: $('#join-naam').value.trim() });
      await laadState(false);
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });

  $('#v-foto').addEventListener('change', () => {
    const f = $('#v-foto').files[0];
    const img = $('#v-preview');
    if (f) {
      img.src = URL.createObjectURL(f);
      img.hidden = false;
      $('#v-foto-label').textContent = '📷 ' + (f.name.length > 30 ? f.name.slice(0, 30) + '…' : f.name);
    } else { img.hidden = true; }
  });

  $('#form-vangst').addEventListener('submit', async (e) => {
    e.preventDefault();
    const foutEl = $('#v-fout'), okEl = $('#v-ok'), knop = $('#v-submit');
    foutEl.hidden = true; okEl.hidden = true;
    const t = sessie.team(CODE);
    const gram = parseGewicht($('#v-gewicht').value);
    const bestand = $('#v-foto').files[0];
    if (!gram) { foutEl.textContent = 'Vul een geldig gewicht in tussen 0,05 en 50 kg, bijv. 12,45.'; foutEl.hidden = false; return; }
    if (!bestand) { foutEl.textContent = 'Een foto is verplicht als bewijs van de vangst.'; foutEl.hidden = false; return; }
    knop.disabled = true; knop.textContent = 'Bezig met uploaden…';
    try {
      const blob = await compressFoto(bestand);
      const pad = await uploadFoto(CODE, blob);
      await rpc('w_registreer_vangst', { p_code: CODE, p_token: t.token, p_gewicht_gram: gram, p_foto_path: pad });
      okEl.textContent = `Vangst van ${fmtKg(gram)} geregistreerd! 🎉`;
      okEl.hidden = false;
      $('#form-vangst').reset();
      $('#v-preview').hidden = true;
      $('#v-foto-label').textContent = '📷 Foto maken of kiezen';
      await laadState(false);
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
    knop.disabled = false; knop.textContent = 'Registreer vangst';
  });

  initBeheerKnoppen();

  /* lightbox */
  document.body.addEventListener('click', (e) => {
    const groot = e.target.dataset?.groot;
    if (groot) {
      $('#foto-groot img').src = groot;
      $('#foto-groot').hidden = false;
    } else if (e.target.closest('#foto-groot')) {
      $('#foto-groot').hidden = true;
    }
  });
}

function renderTeamTab() {
  const w = STATE.wedstrijd;
  const t = sessie.team(CODE);
  const mijn = mijnTeam();
  const f = fase();

  const joinCard = $('#join-card'), teamCard = $('#team-card');
  const regCard = $('#registreer-card'), dichtCard = $('#dicht-card'), mvCard = $('#mijn-vangsten-card');

  if (!t || !mijn) {
    teamCard.hidden = true; regCard.hidden = true; mvCard.hidden = true;
    joinCard.hidden = false;
    const kanJoinen = w.status === 'aanmelden';
    $('#form-join').hidden = !kanJoinen;
    $('#join-naam2-label').hidden = w.mode !== 'koppel';
    $('#join-naam2').required = w.mode === 'koppel';
    $('#join-uitleg').textContent = kanJoinen
      ? (w.mode === 'koppel' ? 'Meld je koppel aan met beide namen.' : 'Meld je aan met je naam.')
      : 'Het aanmelden is gesloten (de loting is al geweest). Vraag de organisator om hulp als je mee had moeten doen.';
    dichtCard.hidden = true;
    return;
  }

  joinCard.hidden = true;
  teamCard.hidden = false;
  $('#team-titel').textContent = teamNaam(mijn);
  const stekTekst = (mijn.stekken || []).length ? `Jouw stek: ${mijn.stekken.join(' + ')}` :
    (w.status === 'aanmelden' ? 'De loting moet nog beginnen.' :
     w.status === 'stekkeuze' ? `Lotnummer ${mijn.lot_nummer}. Kies je stek op de kaart zodra je aan de beurt bent.` : 'Nog geen stek.');
  $('#team-info').textContent = stekTekst;

  if (f === 'live') {
    regCard.hidden = false; dichtCard.hidden = true;
  } else {
    regCard.hidden = true; dichtCard.hidden = false;
    $('#dicht-tekst').textContent = f === 'voor'
      ? `Registreren kan vanaf de start (${fmtDatumTijd(w.start_ts)}).`
      : 'De wedstrijd is afgelopen. Registreren is niet meer mogelijk.';
  }

  const eigen = STATE.vangsten.filter((v) => v.team_id === mijn.id);
  mvCard.hidden = eigen.length === 0;
  $('#mijn-vangsten').innerHTML = eigen.map((v) => `
    <div class="vangst-kaart">
      <img src="${esc(fotoUrl(v.foto_path))}" alt="vangst" data-groot="${esc(fotoUrl(v.foto_path))}" loading="lazy">
      <div class="info">
        <div class="gewicht">${fmtKg(v.gewicht_gram)}</div>
        <div class="tijd">${fmtTijd(v.created_at)}</div>
      </div>
    </div>`).join('') +
    '<p class="muted klein">Fout gemaakt? Alleen de organisator kan een vangst aanpassen of verwijderen.</p>';
}

/* ---------- beheer ---------- */
function initBeheerKnoppen() {
  $('#form-pin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = $('#pin-input').value.trim();
    const foutEl = $('#pin-fout'); foutEl.hidden = true;
    try {
      await rpc('w_admin_check', { p_code: CODE, p_pin: pin });
      sessie.zetPin(CODE, pin);
      ADMIN_OPEN = true;
      renderBeheer(true);
      renderVangsten();
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });

  $('#b-loting').addEventListener('click', async () => {
    if (!confirm('Loting starten? Daarna kunnen er geen deelnemers meer bij.')) return;
    await beheerActie('w_start_stekkeuze', {});
  });
  $('#b-reset').addEventListener('click', async () => {
    if (!confirm('Loting en alle stekkeuzes wissen? Alle deelnemers moeten dan opnieuw loten.')) return;
    await beheerActie('w_admin_reset_loting', {});
  });
  $('#b-tijden').addEventListener('click', async () => {
    await beheerActie('w_admin_tijden', {
      p_start: new Date($('#b-start').value).toISOString(),
      p_eind: new Date($('#b-eind').value).toISOString(),
    });
  });
  $('#b-kopieer').addEventListener('click', () => {
    navigator.clipboard?.writeText(location.origin + location.pathname + '#/w/' + CODE);
    $('#b-kopieer').textContent = 'gekopieerd!';
    setTimeout(() => { $('#b-kopieer').textContent = 'kopieer'; }, 1500);
  });
}

async function beheerActie(fn, extra) {
  const foutEl = $('#b-fout'); foutEl.hidden = true;
  try {
    await rpc(fn, { p_code: CODE, p_pin: sessie.pin(CODE), ...extra });
    await laadState(false);
  } catch (err) {
    foutEl.textContent = foutTekst(err); foutEl.hidden = false;
  }
}

async function renderBeheer(magPrefill) {
  const pin = sessie.pin(CODE);
  if (!ADMIN_OPEN && pin) {
    try { await rpc('w_admin_check', { p_code: CODE, p_pin: pin }); ADMIN_OPEN = true; } catch { ADMIN_OPEN = false; }
  }
  $('#pin-card').hidden = ADMIN_OPEN;
  $('#beheer-inhoud').hidden = !ADMIN_OPEN;
  if (!ADMIN_OPEN) return;

  const w = STATE.wedstrijd;
  $('#b-code').textContent = w.code;
  $('#b-link').textContent = location.origin + location.pathname + '#/w/' + w.code;
  const startEl = $('#b-start'), eindEl = $('#b-eind');
  if (magPrefill || (document.activeElement !== startEl && document.activeElement !== eindEl && !startEl.dataset.geraakt)) {
    startEl.value = naarLocalInput(w.start_ts);
    eindEl.value = naarLocalInput(w.eind_ts);
  }
  startEl.onfocus = eindEl.onfocus = () => { startEl.dataset.geraakt = '1'; };

  $('#b-loting').disabled = w.status !== 'aanmelden';
  $('#b-reset').disabled = w.status === 'aanmelden';

  $('#b-teams').innerHTML = STATE.teams.length ? STATE.teams.map((t) => `
    <div class="b-rij">
      <span class="naam">${esc(teamNaam(t))}</span>
      <span class="muted klein">${t.lot_nummer ? 'lot ' + t.lot_nummer : ''} ${(t.stekken || []).length ? '· stek ' + t.stekken.join('+') : ''}</span>
      ${w.status === 'aanmelden' ? `<button class="btn gevaar klein-btn" data-team-weg="${t.id}">verwijder</button>` : ''}
    </div>`).join('') : '<p class="muted">Nog geen deelnemers.</p>';
  $('#b-teams').querySelectorAll('[data-team-weg]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Deelnemer verwijderen?')) return;
      await beheerActie('w_admin_verwijder_team', { p_team_id: b.dataset.teamWeg });
    };
  });

  const teamsBijId = new Map(STATE.teams.map((t) => [t.id, t]));
  $('#b-vangsten').innerHTML = STATE.vangsten.length ? STATE.vangsten.map((v) => `
    <div class="b-rij">
      <img class="thumb" src="${esc(fotoUrl(v.foto_path))}" data-groot="${esc(fotoUrl(v.foto_path))}" alt="">
      <span class="naam">${esc(teamsBijId.get(v.team_id) ? teamNaam(teamsBijId.get(v.team_id)) : '?')} · ${fmtTijd(v.created_at)}</span>
      <input class="gewicht-edit" value="${(v.gewicht_gram / 1000).toFixed(2).replace('.', ',')}" data-vangst="${v.id}">
      <button class="btn klein-btn" data-vangst-opslaan="${v.id}">opslaan</button>
      <button class="btn gevaar klein-btn" data-vangst-weg="${v.id}">verwijder</button>
    </div>`).join('') : '<p class="muted">Nog geen vangsten.</p>';
  $('#b-vangsten').querySelectorAll('[data-vangst-opslaan]').forEach((b) => {
    b.onclick = async () => {
      const veld = $('#b-vangsten').querySelector(`input[data-vangst="${b.dataset.vangstOpslaan}"]`);
      const gram = parseGewicht(veld.value);
      if (!gram) { alert('Ongeldig gewicht.'); return; }
      await beheerActie('w_admin_vangst', { p_vangst_id: b.dataset.vangstOpslaan, p_gewicht_gram: gram });
    };
  });
  $('#b-vangsten').querySelectorAll('[data-vangst-weg]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Vangst verwijderen van het klassement?')) return;
      await beheerActie('w_admin_vangst', { p_vangst_id: b.dataset.vangstWeg, p_verwijder: true });
    };
  });
}

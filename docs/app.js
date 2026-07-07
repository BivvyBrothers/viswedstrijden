/* Viswedstrijden Plas van der Ende - app-logica */
'use strict';

const APP_VERSION = 19; // gelijk houden met docs/version.json; verhogen bij elke release

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
  naam_bestaat_al: 'Deze naam is al aangemeld. Ben jij dat en wil je verder onder deze naam? Gebruik dan je herstel-link, of vraag de organisator die voor je op te zoeken in Beheer.',
  wedstrijd_vol: 'De wedstrijd zit vol: het maximale aantal deelnemers is bereikt.',
  ongeldig_maximum: 'Het maximum moet tussen 2 en 200 liggen.',
  regels_te_lang: 'De wedstrijdregels zijn te lang (max. 3000 tekens).',
  pin_onjuist: 'Pincode onjuist.',
  pin_te_kort: 'Pincode moet minimaal 4 tekens zijn.',
  org_wachtwoord_onjuist: 'Organisatie-wachtwoord onjuist.',
  wachtwoord_te_kort: 'Wachtwoord moet minimaal 6 tekens zijn.',
  al_geloot: 'De loting is al gestart.',
  geen_deelnemers: 'Er zijn nog geen deelnemers aangemeld.',
  te_veel_teams_voor_zones: 'Meer teams dan zones: pas de zones of het aantal deelnemers aan voor je loot.',
  te_veel_teams_voor_stekken: 'Meer teams dan beschikbare stekken: verklein het aantal deelnemers voor je loot.',
  geen_stekkeuze_fase: 'De stekkeuze is nu niet actief.',
  team_niet_gevonden: 'Je deelname is niet gevonden. Meld je opnieuw aan.',
  al_gekozen: 'Je hebt al gekozen.',
  niet_jouw_beurt: 'Je bent nog niet aan de beurt.',
  verkeerd_aantal_stekken: 'Kies het juiste aantal stekken.',
  onbekende_stek: 'Onbekend steknummer.',
  stekken_niet_naast_elkaar: 'De twee stekken moeten naast elkaar liggen.',
  stek_bezet: 'Die stek is net gekozen door iemand anders. Kies een andere.',
  zone_bezet: 'Die zone is net gekozen door iemand anders. Kies een andere.',
  onbekende_zone: 'Onbekende zone.',
  wedstrijd_gebruikt_zones: 'Deze wedstrijd werkt met zones: kies een zone.',
  wedstrijd_zonder_zones: 'Deze wedstrijd werkt niet met zones.',
  ongeldige_zones: 'De zone-indeling is ongeldig. Controleer het formaat (Naam: nummers).',
  zone_naam_dubbel: 'Twee zones hebben dezelfde naam.',
  stek_in_meerdere_zones: 'Een steknummer zit in meerdere zones.',
  alleen_tijdens_aanmelden: 'Kan alleen tijdens de aanmeldfase (vóór de loting).',
  wedstrijd_niet_begonnen: 'De wedstrijd is nog niet begonnen.',
  wedstrijd_afgelopen: 'De wedstrijd is afgelopen: registreren kan niet meer.',
  ongeldige_foto: 'De foto kon niet worden verwerkt (RAW-bestanden worden niet ondersteund). Kies een andere foto of maak een nieuwe.',
  ongeldige_subscription: 'Meldingen aanzetten is niet gelukt.',
  eind_voor_start: 'De eindtijd moet na de starttijd liggen.',
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
const ledenNaam = (t) => t.naam2 ? `${t.naam} & ${t.naam2}` : t.naam;
const teamNaam = (t) => t.team_naam || ledenNaam(t);
const teamNaamHtml = (t) => t.team_naam
  ? `${esc(t.team_naam)} <span class="leden">(${esc(ledenNaam(t))})</span>`
  : esc(ledenNaam(t));

async function kopieerTekst(tekst) {
  try { await navigator.clipboard.writeText(tekst); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = tekst;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

function laadViaImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('ongeldige_foto')); };
    img.src = url;
  });
}

async function compressFoto(file, maxDim = 1400, kwaliteit = 0.8) {
  let bron;
  try { bron = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    try { bron = await createImageBitmap(file); }
    catch { bron = await laadViaImage(file); } // fallback voor oudere telefoons/formaten
  }
  const bw = bron.width || bron.naturalWidth, bh = bron.height || bron.naturalHeight;
  if (!bw || !bh) throw new Error('ongeldige_foto');
  const schaal = Math.min(1, maxDim / Math.max(bw, bh));
  const c = document.createElement('canvas');
  c.width = Math.round(bw * schaal);
  c.height = Math.round(bh * schaal);
  c.getContext('2d').drawImage(bron, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', kwaliteit));
  if (!blob || blob.size < 100 || blob.size > 4.5 * 1024 * 1024) throw new Error('ongeldige_foto');
  return blob;
}

// confirm()/alert() worden in iOS-beginscherm-apps stilletjes geblokkeerd;
// daarom: eerste tik zet de knop op scherp, tweede tik binnen 5s voert uit.
function tikNogmaals(knop, waarschuwing, actie) {
  if (knop.dataset.scherp) {
    delete knop.dataset.scherp;
    knop.textContent = knop.dataset.orig;
    actie();
    return;
  }
  knop.dataset.scherp = '1';
  knop.dataset.orig = knop.textContent;
  knop.textContent = waarschuwing;
  setTimeout(() => {
    if (knop.dataset.scherp) {
      delete knop.dataset.scherp;
      knop.textContent = knop.dataset.orig;
    }
  }, 5000);
}

let toastTimer = null;
function toast(tekst) {
  const el = $('#toast');
  el.textContent = tekst;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
  if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
}

/* ---------- globale app-status ---------- */
let CODE = null;
let STATE = null;
let TIJD_OFFSET = 0;
let POLL = null;
let KLOKTIK = null;
let SELECTIE = [];        // geselecteerde stekken (stekkeuze zonder zones)
let SELECTIE_ZONE = null; // geselecteerde zone (stekkeuze met zones)
let KLASSEMENT_MODE = 'totaal';
let ADMIN_OPEN = false;
let KIJKER = false;          // true = kijkersweergave (alleen klassement)
let ROL = 'deelnemer';       // 'deelnemer' | 'kijker' | 'organisator' 
let ORG_POLL = null;
let BEKENDE_VANGSTEN = null; // Set van vangst-ids voor in-app meldingen
let PENDING_TOKEN = null;    // token uit een teamlink (#/w/CODE?t=...)

const sessie = {
  team(code) { try { return JSON.parse(localStorage.getItem('team:' + code)); } catch { return null; } },
  zetTeam(code, t) { localStorage.setItem('team:' + code, JSON.stringify(t)); },
  pin(code) { return sessionStorage.getItem('pin:' + code); },
  zetPin(code, pin) { sessionStorage.setItem('pin:' + code, pin); },
  orgWw() { return sessionStorage.getItem('orgww'); },
  zetOrgWw(ww) { sessionStorage.setItem('orgww', ww); },
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
const heeftZones = () => Array.isArray(STATE?.wedstrijd?.zones) && STATE.wedstrijd.zones.length > 0;
function zoneVanStek(nr) {
  if (!heeftZones()) return null;
  return STATE.wedstrijd.zones.find((z) => (z.stekken || []).map(Number).includes(nr)) || null;
}
function zoneBezet(naam) {
  return STATE.teams.some((t) => (t.zone || '').toLowerCase() === String(naam).toLowerCase());
}
// de vaste zonelijnen + letters op de kaart horen bij de standaard-indeling;
// alleen tonen als de zones van deze wedstrijd daar exact mee overeenkomen
function zonesZijnStandaard() {
  if (!heeftZones() || typeof ZONE_STANDAARD === 'undefined') return false;
  const norm = (zs) => zs
    .map((z) => `${String(z.naam).trim().toLowerCase()}:${(z.stekken || []).map(Number).sort((a, b) => a - b).join(',')}`)
    .sort().join('|');
  return norm(STATE.wedstrijd.zones) === norm(ZONE_STANDAARD);
}
// voorkomt "zone Zone A"; een puur numerieke zonenaam is een losse stek en heet "stek N"
const zoneLabel = (naam) => {
  const n = String(naam).trim();
  if (/^\d+$/.test(n)) return 'stek ' + n;
  return /^zone/i.test(n) ? n : 'zone ' + n;
};

/* ---------- routing ---------- */
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  localStorage.removeItem('recente'); // opruiming: Recent-sectie is vervallen
  $('#btn-terug').addEventListener('click', () => {
    // organisator in een wedstrijd -> terug naar het organisatie-overzicht; anders naar het inlogscherm
    if (CODE && ROL === 'organisator' && sessie.orgWw()) location.hash = '#/org';
    else location.hash = '';
  });
  initHome(); initWedstrijd(); route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  checkVersie();
  setInterval(checkVersie, 10 * 60 * 1000);
});

async function checkVersie() {
  try {
    const r = await fetch('version.json?_=' + APP_VERSION + '-' + Math.floor(nu() / 600000), { cache: 'no-store' });
    const j = await r.json();
    if (j.v > APP_VERSION) $('#update-banner').hidden = false;
  } catch { /* offline of tijdelijk onbereikbaar: stil houden */ }
}

function route() {
  const mW = location.hash.match(/^#\/w\/([A-Za-z0-9]{4,8})/);
  const mK = location.hash.match(/^#\/k\/([A-Za-z0-9]{4,8})/);
  const mT = location.hash.match(/[?&]t=([0-9a-f-]{36})/i);
  PENDING_TOKEN = mT ? mT[1] : null;
  if (mT && mW) {
    // token meteen uit adresbalk en geschiedenis halen; hij leeft verder in geheugen
    history.replaceState(null, '', location.pathname + '#/w/' + mW[1].toUpperCase());
  }
  clearInterval(POLL); clearInterval(KLOKTIK); clearInterval(ORG_POLL);
  if (mW || mK) {
    KIJKER = !!mK;
    CODE = (mW || mK)[1].toUpperCase();
    $('#topcode').textContent = CODE;
    toonView('wedstrijd');
    ROL = KIJKER ? 'kijker' : 'deelnemer';
    renderTabs();
    SELECTIE = []; SELECTIE_ZONE = null;
    ADMIN_OPEN = false;
    STATE = null;
    BEKENDE_VANGSTEN = null;
    laadState(true);
    POLL = setInterval(() => laadState(false), 6000);
    KLOKTIK = setInterval(tikKlok, 1000);
  } else if (location.hash === '#/org') {
    if (!sessie.orgWw()) { location.hash = ''; return; }
    CODE = null; KIJKER = false;
    $('#topcode').textContent = 'organisatie';
    toonView('org');
    laadOrg(true);
    ORG_POLL = setInterval(() => laadOrg(false), 10000);
  } else {
    CODE = null; KIJKER = false;
    $('#topcode').textContent = '';
    toonView('home');
  }
}
function toonView(naam) {
  $('#view-home').hidden = naam !== 'home';
  $('#view-wedstrijd').hidden = naam !== 'wedstrijd';
  $('#view-org').hidden = naam !== 'org';
  $('#btn-terug').hidden = naam === 'home';
}
function activateTab(naam) {
  const b = document.querySelector(`#tabs button[data-tab=${naam}]`);
  if (b) b.click();
}

// welke tabs elke rol ziet
const TABS_PER_ROL = {
  kijker: ['klassement'],
  deelnemer: ['kaart', 'klassement', 'vangsten', 'team'],
  organisator: ['kaart', 'klassement', 'vangsten', 'beheer'],
};
function renderTabs() {
  const zichtbaar = TABS_PER_ROL[ROL] || TABS_PER_ROL.deelnemer;
  $('#tabs').hidden = ROL === 'kijker';
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.hidden = !zichtbaar.includes(b.dataset.tab);
  });
  if (ROL === 'kijker') {
    document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== 'tab-klassement'; });
    return;
  }
  const actief = document.querySelector('#tabs button.actief');
  if (!actief || actief.hidden || !zichtbaar.includes(actief.dataset.tab)) {
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('actief', x.dataset.tab === zichtbaar[0]));
    document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== 'tab-' + zichtbaar[0]; });
  }
}

/* ---------- home ---------- */
function initHome() {
  const startVeld = $('#nw-start'), eindVeld = $('#nw-eind');
  const morgen = new Date(Date.now() + 86400000);
  morgen.setHours(8, 0, 0, 0);
  startVeld.value = naarLocalInput(morgen.toISOString());
  const eind = new Date(morgen); eind.setHours(17, 0, 0, 0);
  eindVeld.value = naarLocalInput(eind.toISOString());

  // rolknoppen: klap het bijbehorende invoerveld uit
  document.querySelectorAll('.rolknop').forEach((k) => {
    k.addEventListener('click', () => {
      document.querySelectorAll('.rolknop').forEach((x) => x.classList.toggle('actief', x === k));
      $('#form-deelnemer').hidden = k.dataset.rol !== 'deelnemer';
      $('#form-kijker').hidden = k.dataset.rol !== 'kijker';
      $('#form-orglogin').hidden = k.dataset.rol !== 'org';
      const veld = { deelnemer: '#deelnemer-code', kijker: '#kijker-code', org: '#org-ww' }[k.dataset.rol];
      $(veld)?.focus();
    });
  });

  $('#form-deelnemer').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('#deelnemer-code').value.trim().toUpperCase();
    if (!code) return;
    try {
      const login = await rpc('w_login_deelnemer', { p_code: code });
      if (login) {
        sessie.zetTeam(login.wedstrijd_code, {
          id: login.team_id, token: login.token, naam: login.naam, code: login.deelnemer_code,
        });
        location.hash = '#/w/' + login.wedstrijd_code;
        return;
      }
    } catch { /* geen persoonlijke code: probeer als wedstrijdcode */ }
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
      const check = await rpc('w_org_check', { p_wachtwoord: ww });
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
    location.hash = '';
  });

  $('#org-zones-opslaan').addEventListener('click', async () => {
    const foutEl = $('#org-zones-fout'), okEl = $('#org-zones-ok');
    foutEl.hidden = true; okEl.hidden = true;
    let geparsed;
    try { geparsed = parseZones($('#org-zones').value); }
    catch (err) { foutEl.textContent = err.message; foutEl.hidden = false; return; }
    try {
      const res = await rpc('w_org_standaard_zones', { p_wachtwoord: sessie.orgWw() || '', p_zones: geparsed.zones });
      okEl.textContent = res.zones === 0
        ? 'Vaste indeling gewist: nieuwe wedstrijden loten per losse stek.'
        : `Vaste indeling opgeslagen: ${zonesPreview(geparsed)}. Elke nieuwe wedstrijd gebruikt deze automatisch.`;
      okEl.hidden = false;
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
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
        p_org_wachtwoord: sessie.orgWw() || '',
        p_max_teams: $('#nw-max').value ? parseInt($('#nw-max').value, 10) : null,
        p_regels: $('#nw-regels').value.trim() || null,
      });
      sessie.zetPin(res.code, res.pin);
      location.hash = '#/w/' + res.code;
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });
}

/* ---------- wedstrijd: state laden ---------- */
async function laadState(eerste) {
  if (!CODE) return;
  try {
    const s = KIJKER
      ? await rpc('w_get_state_kijker', { p_kijk_code: CODE })
      : await rpc('w_get_state', { p_code: CODE });
    if (!s?.wedstrijd) { toonNietGevonden(); return; }
    STATE = s;
    TIJD_OFFSET = new Date(s.server_now).getTime() - Date.now();
    if (eerste && !KIJKER && PENDING_TOKEN) {
      try {
        const team = await rpc('w_mijn_team', { p_code: CODE, p_token: PENDING_TOKEN });
        if (team) sessie.zetTeam(CODE, { id: team.id, token: PENDING_TOKEN, naam: team.naam });
      } catch { /* ongeldige teamlink: negeren */ }
      PENDING_TOKEN = null;
    }
    if (eerste && !KIJKER) {
      const pin = sessie.pin(CODE);
      if (pin) {
        try {
          await rpc('w_admin_check', { p_code: CODE, p_pin: pin });
          ROL = 'organisator'; ADMIN_OPEN = true;
        } catch { sessionStorage.removeItem('pin:' + CODE); ROL = 'deelnemer'; }
      } else { ROL = 'deelnemer'; }
      renderTabs();
    }
    meldNieuweVangsten();
    renderAlles(eerste);
    if (eerste && ROL === 'deelnemer' && !sessie.team(CODE) && s.wedstrijd.status === 'aanmelden') {
      // deelnemer met een gedeelde link start bij het invoeren van eigen gegevens
      activateTab('team');
    }
  } catch (err) {
    if (eerste) toonNietGevonden();
  }
}
function toonNietGevonden() {
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
  if (ROL === 'kijker') return; // kijkers zien alleen klok + klassement + meldingen
  renderKaart();
  renderLoting();
  renderVangsten();
  if (ROL === 'deelnemer') renderTeamTab();
  if (ROL === 'organisator') renderBeheer(eerste);
}

/* ---------- organisatie-omgeving ---------- */
let ORG_DATA = null;

async function laadOrg(eerste) {
  try {
    const res = await rpc('w_org_wedstrijden', { p_wachtwoord: sessie.orgWw() || '' });
    if (!res) { sessionStorage.removeItem('orgww'); location.hash = ''; return; }
    ORG_DATA = res;
    renderOrg();
  } catch { if (eerste) location.hash = ''; }
}

function orgWedstrijdKaart(w, nuMs) {
  const actief = new Date(w.eind_ts).getTime() >= nuMs;
  const live = actief && new Date(w.start_ts).getTime() <= nuMs;
  const vol = w.max_teams && w.teams >= w.max_teams;
  const teller = w.max_teams ? `${w.teams}/${w.max_teams}` : `${w.teams}`;
  const statusTekst = live ? (w.status === 'aanmelden' ? '● LIVE · nog niet geloot' : '● LIVE')
    : !actief ? 'afgelopen'
    : w.status === 'aanmelden' ? (vol ? `✅ compleet (${teller}) · klaar voor loting` : `aanmelden open · ${teller} aangemeld`)
    : w.status === 'stekkeuze' ? 'loting/stekkeuze bezig'
    : 'wacht op start';
  return `<div class="org-w">
    <div class="org-w-kop">
      <b>${esc(w.naam)}</b>
      <span class="chip${live ? ' live' : ''}${!actief ? ' voorbij' : ''}">${esc(statusTekst)}</span>
    </div>
    <div class="muted klein">${fmtDatumTijd(w.start_ts)} tot ${fmtDatumTijd(w.eind_ts)} ·
      ${w.mode === 'koppel' ? 'koppels' : 'individueel'}${w.heeft_zones ? ' · zones' : ''} ·
      ${w.max_teams ? `${w.teams}/${w.max_teams}` : w.teams} team${w.teams === 1 && !w.max_teams ? '' : 's'} · ${w.vangsten} vangst${w.vangsten === 1 ? '' : 'en'}</div>
    <div class="org-codes muted klein">deelnemerscode <b class="codegroot klein-code">${esc(w.code)}</b>
      · kijkcode <b class="codegroot klein-code">${esc(w.kijk_code)}</b></div>
    <div class="row org-acties">
      <button class="btn primary" data-org-open="${esc(w.code)}" data-pin="${esc(w.admin_pin)}">Openen &amp; beheren</button>
      ${w.status === 'aanmelden' && actief ? `<button class="btn" data-org-loting="${esc(w.code)}" data-pin="${esc(w.admin_pin)}">🎲 Start loting</button>` : ''}
    </div>
  </div>`;
}

function renderOrg() {
  if (!ORG_DATA) return;
  if (document.querySelector('#org-actief [data-scherp], #org-verleden [data-scherp]')) return;
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

  document.querySelectorAll('[data-org-open]').forEach((b) => {
    b.onclick = () => {
      sessie.zetPin(b.dataset.orgOpen, b.dataset.pin);
      location.hash = '#/w/' + b.dataset.orgOpen;
    };
  });
  document.querySelectorAll('[data-org-loting]').forEach((b) => {
    b.onclick = () => tikNogmaals(b, '⚠️ Tik nogmaals: loting starten', async () => {
      try {
        await rpc('w_start_stekkeuze', { p_code: b.dataset.orgLoting, p_pin: b.dataset.pin });
        sessie.zetPin(b.dataset.orgLoting, b.dataset.pin);
        location.hash = '#/w/' + b.dataset.orgLoting;
      } catch (err) { toast(foutTekst(err)); }
    });
  });
}

/* ---------- kop + klok ---------- */
function renderKop() {
  const w = STATE.wedstrijd;
  $('#w-naam').textContent = w.naam;
  const regelsCard = $('#regels-card');
  regelsCard.hidden = !w.regels;
  if (w.regels) $('#regels-tekst').textContent = w.regels;
  $('#w-tijden').textContent =
    `${fmtDatumTijd(w.start_ts)} tot ${fmtDatumTijd(w.eind_ts)}` +
    (w.mode === 'koppel' ? ' · koppelwedstrijd' : ' · individueel') +
    (heeftZones() ? ' · zones' : '');
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
    const z = e.target.closest('g.zoneletter');
    if (z) { klikZone(z.dataset.zone); return; }
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

  if (heeftZones()) {
    const zone = zoneVanStek(nr);
    if (!zone || zoneBezet(zone.naam)) return;
    SELECTIE_ZONE = (SELECTIE_ZONE === zone.naam) ? null : zone.naam;
    SELECTIE = SELECTIE_ZONE ? zone.stekken.map(Number) : [];
  } else {
    if (bezet) return;
    const i = SELECTIE.indexOf(nr);
    if (i >= 0) SELECTIE.splice(i, 1);
    else {
      SELECTIE.push(nr);
      if (SELECTIE.length > aantalNodig()) SELECTIE.shift();
    }
  }
  renderKaart();
}

// tik op een zoneletter: selecteert de hele zone (zelfde regels als tik op een stek)
function klikZone(naam) {
  const w = STATE?.wedstrijd;
  if (!w || w.status !== 'stekkeuze' || !heeftZones()) return;
  const mijn = mijnTeam();
  const beurt = teamAanBeurt();
  if (!mijn || !beurt || beurt.id !== mijn.id) return;
  const zone = STATE.wedstrijd.zones.find((z) => String(z.naam).toLowerCase() === String(naam).toLowerCase());
  if (!zone || zoneBezet(zone.naam)) return;
  SELECTIE_ZONE = (SELECTIE_ZONE === zone.naam) ? null : zone.naam;
  SELECTIE = SELECTIE_ZONE ? zone.stekken.map(Number) : [];
  renderKaart();
}

function renderKaart() {
  initKaart();
  const zonelaag = document.querySelector('#kaart-houder #zonelaag');
  if (zonelaag) zonelaag.style.display = zonesZijnStandaard() ? '' : 'none';
  const w = STATE.wedstrijd;
  const mijn = mijnTeam();
  const beurt = teamAanBeurt();
  const mijnBeurt = !!(mijn && beurt && mijn.id === beurt.id);
  if (!mijnBeurt) { SELECTIE = []; SELECTIE_ZONE = null; }

  const bezetDoor = {};
  for (const t of STATE.teams) for (const s of (t.stekken || [])) bezetDoor[s] = t;

  document.querySelectorAll('#kaart-houder g.stek').forEach((g) => {
    const nr = parseInt(g.dataset.stek, 10);
    g.classList.remove('bezet', 'mijn', 'keuze', 'kiesbaar');
    const eigenaar = bezetDoor[nr];
    const zone = zoneVanStek(nr);
    const titel = g.querySelector('title');
    const zLabel = (zone && String(zone.naam).trim() !== String(nr)) ? `${zoneLabel(zone.naam)} · ` : '';
    const doetMee = !heeftZones() || !!zone;
    g.classList.toggle('uit', !doetMee && !eigenaar);
    if (eigenaar) {
      g.classList.add(mijn && eigenaar.id === mijn.id ? 'mijn' : 'bezet');
      if (titel) titel.textContent = `Stek ${nr}: ${zLabel}${teamNaam(eigenaar)}`;
    } else if (!doetMee) {
      if (titel) titel.textContent = `Stek ${nr}: doet niet mee in deze wedstrijd`;
    } else {
      if (titel) titel.textContent = `Stek ${nr}: ${zLabel}vrij`;
      if (SELECTIE.includes(nr)) g.classList.add('keuze');
      else if (mijnBeurt && (!heeftZones() || (zone && !zoneBezet(zone.naam)))) g.classList.add('kiesbaar');
    }
  });

  // zoneletters kleuren mee: groen = mijn zone of mijn selectie, donker = bezet
  const zonesVanTeams = {};
  for (const t of STATE.teams) if (t.zone) zonesVanTeams[String(t.zone).toLowerCase()] = t;
  document.querySelectorAll('#kaart-houder g.zoneletter').forEach((g) => {
    g.classList.remove('bezet', 'mijn', 'keuze', 'kiesbaar');
    const naam = String(g.dataset.zone || '');
    const eigenaar = zonesVanTeams[naam.toLowerCase()];
    if (eigenaar) g.classList.add(mijn && eigenaar.id === mijn.id ? 'mijn' : 'bezet');
    else if (SELECTIE_ZONE && String(SELECTIE_ZONE).toLowerCase() === naam.toLowerCase()) g.classList.add('keuze');
    else if (mijnBeurt) g.classList.add('kiesbaar');
  });

  const melding = $('#kaart-melding');
  const actie = $('#stek-actie');
  const knop = $('#btn-kies');
  if (w.status === 'stekkeuze' && beurt) {
    melding.hidden = false;
    if (mijnBeurt) {
      actie.hidden = false;
      if (heeftZones()) {
        melding.className = 'melding groen';
        melding.textContent = SELECTIE_ZONE
          ? (/^\d+$/.test(SELECTIE_ZONE)
              ? `Stek ${SELECTIE_ZONE} geselecteerd.`
              : `${zoneLabel(SELECTIE_ZONE)} geselecteerd (stek ${SELECTIE.slice().sort((a, b) => a - b).join(', ')}).`)
          : 'Jij bent aan de beurt! Tik op een zoneletter (of een stek) om je zone te kiezen.';
        knop.disabled = !SELECTIE_ZONE;
        knop.textContent = SELECTIE_ZONE ? `Bevestig ${zoneLabel(SELECTIE_ZONE)}` : 'Selecteer een zone';
      } else {
        const n = aantalNodig();
        melding.className = 'melding groen';
        melding.textContent = n === 2
          ? `Jij bent aan de beurt! Kies 2 stekken naast elkaar (${SELECTIE.length}/2 geselecteerd).`
          : 'Jij bent aan de beurt! Tik op een vrije stek.';
        let ok = SELECTIE.length === n;
        if (ok && n === 2) {
          const p = SELECTIE.map((s) => STEK_POSITIE[String(s)]).sort((a, b) => a - b);
          ok = p[1] - p[0] === 1;
          if (!ok) melding.textContent = 'Deze stekken liggen niet naast elkaar. Kies 2 aangrenzende stekken.';
        }
        knop.disabled = !ok;
        knop.textContent = ok ? `Bevestig stek ${[...SELECTIE].sort((a, b) => a - b).join(' + ')}` : 'Selecteer je stek' + (n === 2 ? 'ken' : '');
      }
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

/* ---------- loting-lijst ---------- */
function renderLoting() {
  const el = $('#loting-lijst');
  const beurt = teamAanBeurt();
  if (!STATE.teams.length) {
    el.innerHTML = '<p class="muted">Nog geen deelnemers aangemeld.</p>';
    return;
  }
  const geloot = STATE.teams.some((t) => t.lot_nummer);
  const w2 = STATE.wedstrijd;
  const voortgang = (!geloot && w2.status === 'aanmelden' && w2.max_teams)
    ? (STATE.teams.length >= w2.max_teams
        ? `<p class="ok">✅ Compleet: ${STATE.teams.length} van ${w2.max_teams} aangemeld. De loting kan beginnen.</p>`
        : `<p class="muted klein"><b>${STATE.teams.length} van ${w2.max_teams}</b> deelnemers aangemeld.</p>`)
    : '';
  el.innerHTML = voortgang + (geloot ? '' : '<p class="muted klein">De loting is nog niet gestart. Volgorde hieronder is de aanmeldvolgorde.</p>') +
    STATE.teams.map((t) => {
      const isBeurt = beurt && beurt.id === t.id;
      const keuze = t.zone ? zoneLabel(t.zone)
        : (t.stekken || []).length ? 'stek ' + t.stekken.join(' + ')
        : (geloot ? (isBeurt ? 'aan de beurt…' : 'wacht') : '');
      return `<div class="loting-rij${isBeurt ? ' beurt' : ''}">
        <span class="lotnr">${t.lot_nummer ?? '·'}</span>
        <span>${teamNaamHtml(t)}</span>
        <span class="stekjes">${esc(keuze)}</span>
      </div>`;
    }).join('');
}

/* ---------- klassement ---------- */
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
  const plek = (t) => t.zone ? zoneLabel(t.zone) : (t.stekken?.length ? `stek ${t.stekken.join('+')}` : '');
  const rangKlas = (i) => 'rank' + (i === 0 ? ' goud' : i === 1 ? ' zilver' : i === 2 ? ' brons' : '');
  if (KLASSEMENT_MODE === 'totaal') {
    rijen.sort((a, b) => b.totaal - a.totaal || b.aantal - a.aantal);
    const vissenVan = (teamId) => STATE.vangsten
      .filter((v) => v.team_id === teamId)
      .slice().reverse()
      .map((v) => (v.gewicht_gram / 1000).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    el.innerHTML = `<table class="klassement">
      <tr><th>#</th><th>Team</th><th class="r">Vissen</th><th class="r">Totaal</th></tr>
      ${rijen.map((r, i) => `<tr>
        <td class="${rangKlas(i)}">${i + 1}</td>
        <td>${teamNaamHtml(r.team)} <span class="muted klein">${esc(plek(r.team))}</span>
          <div class="opbouw">${vissenVan(r.team.id).join(' + ')} kg</div></td>
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
        <td>${teamNaamHtml(r.team)}</td>
        <td class="r"><b>${fmtKg(r.grootste.gewicht_gram)}</b></td>
        <td><img class="thumb" src="${esc(fotoUrl(r.grootste.foto_path))}" alt="grootste vis" data-groot="${esc(fotoUrl(r.grootste.foto_path))}"></td>
      </tr>`).join('')}
    </table>`;
  }
}

/* ---------- vangstenfeed ---------- */
function renderVangsten() {
  const el = $('#vangsten-feed');
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
        <div class="wie">${t ? teamNaamHtml(t) : 'onbekend'}</div>
        <div class="tijd">${fmtDatumTijd(v.created_at)}</div>
      </div>
    </div>`;
  }).join('');
}

/* ---------- push-meldingen ---------- */
const pushKanHier = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

function pushAan(code) { return localStorage.getItem('push:' + code) === '1'; }

function renderPushKnop() {
  const knop = $('#btn-push'), tip = $('#push-tip');
  if (pushKanHier()) {
    knop.hidden = false; tip.hidden = true;
    knop.textContent = pushAan(CODE)
      ? '🔕 Zet meldingen over nieuwe vangsten uit'
      : '🔔 Zet meldingen over nieuwe vangsten aan';
  } else if (isIos() && !window.navigator.standalone) {
    knop.hidden = true;
    tip.hidden = false;
    tip.textContent = 'Meldingen bij nieuwe vangsten kunnen op iPhone alleen via de beginscherm-app: deel-knop → Zet op beginscherm. Open de app daarna vanaf je beginscherm en de meldingen-knop verschijnt hier.';
  } else {
    knop.hidden = true; tip.hidden = true;
  }
}

async function pushToggle() {
  const knop = $('#btn-push');
  knop.disabled = true;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (pushAan(CODE)) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await rpc('w_push_unsubscribe', { p_endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      localStorage.removeItem('push:' + CODE);
      toast('Meldingen over nieuwe vangsten staan uit.');
    } else {
      const perm = await Notification.requestPermission();
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
  });

  $('#kl-totaal').addEventListener('click', () => { KLASSEMENT_MODE = 'totaal'; renderKlassement(); });
  $('#kl-grootste').addEventListener('click', () => { KLASSEMENT_MODE = 'grootste'; renderKlassement(); });
  $('#btn-push').addEventListener('click', pushToggle);

  $('#btn-kies').addEventListener('click', async () => {
    const t = sessie.team(CODE);
    if (!t) return;
    const knop = $('#btn-kies');
    knop.disabled = true;
    try {
      if (heeftZones()) {
        await rpc('w_kies_zone', { p_code: CODE, p_token: t.token, p_zone: SELECTIE_ZONE });
      } else {
        await rpc('w_kies_stek', { p_code: CODE, p_token: t.token, p_stekken: [...SELECTIE].sort((a, b) => a - b) });
      }
      SELECTIE = []; SELECTIE_ZONE = null;
      await laadState(false);
    } catch (err) {
      toast(foutTekst(err));
      await laadState(false);
    }
  });

  $('#form-join').addEventListener('submit', async (e) => {
    e.preventDefault();
    const foutEl = $('#join-fout'); foutEl.hidden = true;
    try {
      const res = await rpc('w_join', {
        p_code: CODE,
        p_naam: $('#join-naam').value.trim(),
        p_naam2: $('#join-naam2').value.trim() || null,
        p_team_naam: $('#join-teamnaam').value.trim() || null,
      });
      sessie.zetTeam(CODE, { id: res.team_id, token: res.token, naam: $('#join-naam').value.trim(), code: res.deelnemer_code });
      if (res.deelnemer_code) toast(`🔑 Bewaar je persoonlijke inlogcode: ${res.deelnemer_code}`);
      await laadState(false);
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });

  const RAW_EXTENSIES = /\.(cr2|cr3|nef|nrw|arw|raf|dng|orf|rw2|pef|srw|raw)$/i;
  $('#v-foto').addEventListener('change', () => {
    const f = $('#v-foto').files[0];
    const img = $('#v-preview');
    const foutEl = $('#v-fout');
    foutEl.hidden = true;
    if (f && RAW_EXTENSIES.test(f.name)) {
      $('#form-vangst').reset();
      img.hidden = true;
      $('#v-foto-label').textContent = '📷 Foto maken of kiezen';
      foutEl.textContent = `RAW-bestanden (zoals ${f.name.split('.').pop().toUpperCase()}) kan de browser niet lezen. Kies de JPEG-versie uit je bibliotheek of maak een gewone foto.`;
      foutEl.hidden = false;
      return;
    }
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
    if (new Date(STATE.wedstrijd.eind_ts).getTime() - nu() < 15000) {
      foutEl.textContent = 'De wedstrijd is (bijna) afgelopen: registreren kan niet meer op tijd verwerkt worden.';
      foutEl.hidden = false; return;
    }
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

  $('#btn-herstel').addEventListener('click', async () => {
    const code = $('#team-code').textContent;
    if (!code || code === '…') return;
    const ok = await kopieerTekst(code);
    $('#btn-herstel').textContent = ok ? '✅ gekopieerd' : 'kopiëren mislukt';
    setTimeout(() => { $('#btn-herstel').textContent = 'kopieer'; }, 2500);
  });

  initBeheerKnoppen();

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
    $('#join-teamnaam-label').hidden = w.mode !== 'koppel';
    $('#join-uitleg').textContent = kanJoinen
      ? (w.mode === 'koppel' ? 'Vul eerst jullie gegevens in: beide namen, en eventueel een teamnaam.' : 'Vul eerst je naam in om mee te doen.')
      : 'Het aanmelden is gesloten (de loting is al geweest). Vraag de organisator om hulp als je mee had moeten doen.';
    dichtCard.hidden = true;
    return;
  }

  joinCard.hidden = true;
  teamCard.hidden = false;
  $('#team-titel').textContent = teamNaam(mijn);
  if (t.code) {
    $('#team-code').textContent = t.code;
  } else {
    $('#team-code').textContent = '…';
    rpc('w_mijn_team', { p_code: CODE, p_token: t.token }).then((mt) => {
      if (mt && mt.deelnemer_code) {
        sessie.zetTeam(CODE, { ...t, code: mt.deelnemer_code });
        $('#team-code').textContent = mt.deelnemer_code;
      }
    }).catch(() => {});
  }
  const plek = mijn.zone ? `Jullie plek: ${zoneLabel(mijn.zone)} (stek ${(mijn.stekken || []).join(', ')})`
    : (mijn.stekken || []).length ? `Jouw stek: ${mijn.stekken.join(' + ')}` :
    (w.status === 'stekkeuze' ? `Lotnummer ${mijn.lot_nummer}. Kies op de kaart zodra je aan de beurt bent.` :
     f === 'live' ? 'Je doet mee! Registreer je vangsten hieronder.' :
     f === 'voorbij' ? 'De wedstrijd is afgelopen.' :
     'De loting moet nog beginnen.');
  $('#team-info').textContent = (mijn.team_naam ? `${ledenNaam(mijn)} · ` : '') + plek;

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
        <div class="tijd">${fmtDatumTijd(v.created_at)}</div>
      </div>
    </div>`).join('') +
    '<p class="muted klein">Fout gemaakt? Alleen de organisator kan een vangst aanpassen of verwijderen.</p>';
}

/* ---------- beheer ---------- */
function initBeheerKnoppen() {
  $('#b-loting').addEventListener('click', () =>
    tikNogmaals($('#b-loting'), '⚠️ Tik nogmaals: loting starten', () => beheerActie('w_start_stekkeuze', {})));
  $('#b-reset').addEventListener('click', () =>
    tikNogmaals($('#b-reset'), '⚠️ Tik nogmaals: alles wissen', () => beheerActie('w_admin_reset_loting', {})));
  $('#b-tijden').addEventListener('click', async () => {
    await beheerActie('w_admin_tijden', {
      p_start: new Date($('#b-start').value).toISOString(),
      p_eind: new Date($('#b-eind').value).toISOString(),
    });
  });
  $('#b-kopieer').addEventListener('click', async () => {
    const ok = await kopieerTekst(location.origin + location.pathname + '#/w/' + CODE);
    $('#b-kopieer').textContent = ok ? 'gekopieerd!' : 'kopiëren mislukt';
    setTimeout(() => { $('#b-kopieer').textContent = 'kopieer'; }, 2000);
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
    const stekken = new Set();
    for (const deel of m[2].split(',').map((d) => d.trim()).filter(Boolean)) {
      const reeks = deel.match(/^(\d+)\s*-\s*(\d+)$/);
      if (reeks) {
        const van = parseInt(reeks[1], 10), tot = parseInt(reeks[2], 10);
        if (tot < van || tot - van > 100) throw new Error(`Ongeldige reeks: "${deel}"`);
        const stap = (van % 2 === tot % 2) ? 2 : 1;
        for (let s = van; s <= tot; s += stap) {
          if (STEK_POSITIE[String(s)]) stekken.add(s);
          else overgeslagen.add(s);
        }
      } else if (/^\d+$/.test(deel)) {
        const s = parseInt(deel, 10);
        if (!STEK_POSITIE[String(s)]) throw new Error(`Stek ${s} bestaat niet op de kaart.`);
        stekken.add(s);
      } else {
        throw new Error(`Niet begrepen: "${deel}"`);
      }
    }
    if (!stekken.size) throw new Error(`Zone "${naam}" heeft geen geldige stekken.`);
    zones.push({ naam, stekken: [...stekken].sort((a, b) => a - b) });
  }
  return { zones, overgeslagen: [...overgeslagen].sort((a, b) => a - b) };
}

function zonesPreview(res) {
  const delen = res.zones.map((z) => `${z.naam} (${z.stekken.length})`).join(', ');
  const weg = res.overgeslagen.length
    ? ` · overgeslagen want bestaan niet: ${res.overgeslagen.join(', ')}` : '';
  return delen + weg;
}

function zonesNaarTekst(zones) {
  if (!Array.isArray(zones)) return '';
  return zones.map((z) => `${z.naam}: ${(z.stekken || []).join(',')}`).join('\n');
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
  if (ROL !== 'organisator' || !ADMIN_OPEN) { $('#beheer-inhoud').hidden = true; $('#pin-card').hidden = false; return; }
  $('#pin-card').hidden = true;
  $('#beheer-inhoud').hidden = false;
  if (!magPrefill) {
    const actiefEl = document.activeElement;
    if (actiefEl && actiefEl.closest && actiefEl.closest('#beheer-inhoud')
        && (actiefEl.tagName === 'INPUT' || actiefEl.tagName === 'TEXTAREA')) return;
    if (document.querySelector('#beheer-inhoud [data-scherp]')) return;
  }

  const w = STATE.wedstrijd;
  $('#b-code').textContent = w.code;
  $('#b-link').textContent = location.origin + location.pathname + '#/w/' + w.code;
  const startEl = $('#b-start'), eindEl = $('#b-eind');
  if (magPrefill || (document.activeElement !== startEl && document.activeElement !== eindEl && !startEl.dataset.geraakt)) {
    startEl.value = naarLocalInput(w.start_ts);
    eindEl.value = naarLocalInput(w.eind_ts);
  }
  startEl.onfocus = eindEl.onfocus = () => { startEl.dataset.geraakt = '1'; };

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

  $('#b-teams').innerHTML = STATE.teams.length ? STATE.teams.map((t) => `
    <div class="b-rij">
      <span class="naam">${teamNaamHtml(t)}</span>
      <span class="muted klein">${t.lot_nummer ? 'lot ' + t.lot_nummer : ''} ${t.zone ? '· ' + esc(zoneLabel(t.zone)) : (t.stekken || []).length ? '· stek ' + t.stekken.join('+') : ''}</span>
      <span class="muted klein">🔑 <b class="codegroot klein-code" data-team-code="${t.id}">·····</b></span>
      ${w.status === 'aanmelden' ? `<button class="btn gevaar klein-btn" data-team-weg="${t.id}">verwijder</button>` : ''}
    </div>`).join('') : '<p class="muted">Nog geen deelnemers.</p>';
  rpc('w_admin_teamcodes', { p_code: CODE, p_pin: sessie.pin(CODE) }).then((codes) => {
    for (const c of codes || []) {
      const el = $('#b-teams').querySelector(`[data-team-code="${c.team_id}"]`);
      if (el) el.textContent = c.deelnemer_code;
    }
  }).catch(() => {});
  $('#b-teams').querySelectorAll('[data-team-weg]').forEach((b) => {
    b.onclick = () => tikNogmaals(b, 'zeker?', () => beheerActie('w_admin_verwijder_team', { p_team_id: b.dataset.teamWeg }));
  });

  const teamsBijId = new Map(STATE.teams.map((t) => [t.id, t]));
  $('#b-vangsten').innerHTML = STATE.vangsten.length ? STATE.vangsten.map((v) => `
    <div class="b-rij">
      <img class="thumb" src="${esc(fotoUrl(v.foto_path))}" data-groot="${esc(fotoUrl(v.foto_path))}" alt="">
      <span class="naam">${teamsBijId.get(v.team_id) ? teamNaamHtml(teamsBijId.get(v.team_id)) : '?'} · ${fmtDatumTijd(v.created_at)}</span>
      <input class="gewicht-edit" value="${(v.gewicht_gram / 1000).toFixed(2).replace('.', ',')}" data-vangst="${v.id}">
      <button class="btn klein-btn" data-vangst-opslaan="${v.id}">opslaan</button>
      <button class="btn gevaar klein-btn" data-vangst-weg="${v.id}">verwijder</button>
    </div>`).join('') : '<p class="muted">Nog geen vangsten.</p>';
  $('#b-vangsten').querySelectorAll('[data-vangst-opslaan]').forEach((b) => {
    b.onclick = async () => {
      const veld = $('#b-vangsten').querySelector(`input[data-vangst="${b.dataset.vangstOpslaan}"]`);
      const gram = parseGewicht(veld.value);
      if (!gram) { toast('Ongeldig gewicht.'); return; }
      await beheerActie('w_admin_vangst', { p_vangst_id: b.dataset.vangstOpslaan, p_gewicht_gram: gram });
    };
  });
  $('#b-vangsten').querySelectorAll('[data-vangst-weg]').forEach((b) => {
    b.onclick = () => tikNogmaals(b, 'zeker?', () => beheerActie('w_admin_vangst', { p_vangst_id: b.dataset.vangstWeg, p_verwijder: true }));
  });
}

/* Viswedstrijden Plas van der Ende - app-logica */
'use strict';

const APP_VERSION = 48; // gelijk houden met ELKE tenant-version.json (docs/*/version.json); verhogen bij elke release

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
  alleen_lezen: 'Deze omgeving staat op alleen-lezen: nieuwe wedstrijden aanmaken kan nu niet. Oude wedstrijden blijven gewoon te bekijken. Neem contact op via info@kemblinck.nl om weer te activeren.',
  meldingen_gesloten: 'Deze wedstrijd is afgelopen; meldingen aanzetten kan niet meer.',
  seizoen_niet_gevonden: 'Seizoen niet gevonden.',
  beheerder_wachtwoord_onjuist: 'Beheerderswachtwoord onjuist.',
  klant_niet_gevonden: 'Deze omgeving is nog niet gekoppeld aan een klant. Neem contact op via info@kemblinck.nl.',
  ongeldige_regels: 'Ongeldige seizoensinstellingen.',
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
  ongeldig_gewicht: 'Ongeldig gewicht: vul tussen 0,05 en 50 kg in.',
  team_heeft_vangsten: 'Dit team heeft (of had) vangsten en kan daarom niet verwijderd worden. Laat het team staan; vangsten corrigeren kan hieronder.',
  foto_al_gebruikt: 'Deze foto hoort al bij een andere vangst. Maak een nieuwe foto.',
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
let SEIZOEN = null;           // seizoensstand (w_seizoen_stand) of null
let DEEL_NIEUW = null;        // gegevens voor de deel-melding na wedstrijd aanmaken
let ADMIN_OPEN = false;
let KIJKER = false;          // true = kijkersweergave (alleen klassement)
let ROL = 'deelnemer';       // 'deelnemer' | 'kijker' | 'organisator' 
let ORG_POLL = null;
let BEKENDE_VANGSTEN = null; // Set van vangst-ids voor in-app meldingen
let PENDING_TOKEN = null;    // token uit een teamlink (#/w/CODE?t=...)
let INIT_KLAAR = false;      // eerste state-load gelukt (anders blijft de poll 'eerste' proberen)
let POLL_TELLER = 0;         // voor tragere polling met het scherm op de achtergrond
let ADMIN_KIES = null;       // {teamId, naam}: organisator kiest een plek namens dit team
let TEAMCODES_CACHE = { sleutel: null, codes: [] };

const sessie = {
  team(code) { try { return JSON.parse(localStorage.getItem('team:' + code)); } catch { return null; } },
  zetTeam(code, t) { localStorage.setItem('team:' + code, JSON.stringify(t)); },
  pin(code) { return sessionStorage.getItem('pin:' + code); },
  zetPin(code, pin) { sessionStorage.setItem('pin:' + code, pin); },
  orgWw() { return sessionStorage.getItem('orgww'); },
  zetOrgWw(ww) { sessionStorage.setItem('orgww', ww); },
  suWw() { return sessionStorage.getItem('suww'); },
  zetSuWw(ww) { sessionStorage.setItem('suww', ww); },
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
  $('#update-banner').addEventListener('click', () => location.reload());
  // terug in beeld: direct verversen (de poll loopt op de achtergrond op 1/10 tempo)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && CODE) laadState(!INIT_KLAAR);
  });
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
  if (location.hash !== '#/beheerder' && SU_DATA) wisSuScherm();
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
    INIT_KLAAR = false;
    ADMIN_KIES = null;
    POLL_TELLER = 0;
    laadState(true);
    SEIZOEN = null;
    laadSeizoen();
    POLL = setInterval(() => {
      POLL_TELLER += 1;
      if (document.hidden && POLL_TELLER % 10 !== 0) return; // op de achtergrond: 1x per minuut (accu)
      laadState(!INIT_KLAAR);
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
    CODE = null; KIJKER = false;
    $('#topcode').textContent = '';
    toonView('home');
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
  const b = document.querySelector(`#tabs button[data-tab=${naam}]`);
  if (b) b.click();
}

// welke tabs elke rol ziet
const TABS_PER_ROL = {
  kijker: ['klassement', 'seizoen'],
  deelnemer: ['kaart', 'klassement', 'vangsten', 'team', 'seizoen'],
  organisator: ['kaart', 'klassement', 'vangsten', 'seizoen', 'beheer'],
};
function renderTabs() {
  // de seizoen-tab bestaat alleen als deze wedstrijd bij een seizoen hoort
  const zichtbaar = (TABS_PER_ROL[ROL] || TABS_PER_ROL.deelnemer)
    .filter((naam) => naam !== 'seizoen' || !!SEIZOEN);
  $('#tabs').hidden = ROL === 'kijker' && !SEIZOEN;
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.hidden = !zichtbaar.includes(b.dataset.tab);
  });
  if (ROL === 'kijker' && !SEIZOEN) {
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
        p_klant: typeof TENANT !== 'undefined' ? TENANT : null,
      });
      sessie.zetPin(res.code, res.pin);
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
    INIT_KLAAR = true;
    if (eerste && ROL === 'deelnemer' && !sessie.team(CODE) && s.wedstrijd.status === 'aanmelden') {
      // deelnemer met een gedeelde link start bij het invoeren van eigen gegevens
      activateTab('team');
    }
  } catch (err) {
    // hier komen we alleen bij netwerk-/serverfouten; "bestaat niet" loopt via toonNietGevonden
    if (eerste && !STATE) {
      $('#w-naam').textContent = 'Geen verbinding';
      $('#klok').textContent = '--:--:--';
      $('#klok-sub').textContent = 'Controleer je internet. De app probeert het vanzelf opnieuw.';
    }
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
    if (eerste) laadOrgSeizoenen();
  } catch { if (eerste) location.hash = ''; }
}

/* ---------- seizoenenbeheer (organisatie) ---------- */
let ORG_SEIZOENEN = null;      // lijst uit w_org_seizoenen
let SEIZOEN_PER_CODE = {};     // wedstrijdcode -> { id, ex }

async function laadOrgSeizoenen() {
  try {
    ORG_SEIZOENEN = await rpc('w_org_seizoenen', { p_wachtwoord: sessie.orgWw() || '' });
    SEIZOEN_PER_CODE = {};
    for (const z of ORG_SEIZOENEN) {
      for (const w of z.wedstrijden) SEIZOEN_PER_CODE[w.code] = { id: z.id, ex: w.ex_aequo || '' };
    }
    renderOrgSeizoenen();
    renderOrg();
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
        await rpc('w_org_seizoen_verwijder', { p_wachtwoord: sessie.orgWw() || '', p_id: b.dataset.seizoenVerwijder });
        toast(`Seizoen "${b.dataset.naam}" verwijderd; de wedstrijden zelf blijven bestaan.`);
        laadOrgSeizoenen();
      } catch (err) { toast(foutTekst(err)); }
    });
  });
}

/* ---------- beheerdersomgeving (KemblincK support, route #/beheerder) ---------- */
let SU_DATA = null;
let SU_KLANT = null;  // geselecteerde klant-tab in het beheeroverzicht

// pins en overzicht horen niet in memory/DOM achter te blijven (Codex v6 P2-2)
function wisSuScherm() {
  SU_DATA = null;
  SU_KLANT = null;
  ['#su-stats'].forEach((s) => { const el = $(s); if (el) el.textContent = ''; });
  ['#su-instellingen', '#su-wedstrijden'].forEach((s) => { const el = $(s); if (el) el.innerHTML = ''; });
  ['#su-ww', '#su-ww-nieuw', '#su-orgww-nieuw'].forEach((s) => { const el = $(s); if (el) el.value = ''; });
}

function initSu() {
  $('#su-login').hidden = !!sessie.suWw();
  $('#su-omgeving').hidden = !sessie.suWw();
  if (sessie.suWw()) laadSu();
}

async function laadSu() {
  try {
    SU_DATA = await rpc('w_su_overzicht', { p_wachtwoord: sessie.suWw() || '' });
    renderSu();
  } catch (err) {
    sessionStorage.removeItem('suww');
    SU_DATA = null;
    initSu();
    const foutEl = $('#su-fout');
    if (foutEl) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  }
}

function suKaart(w, nuMs) {
  const actief = new Date(w.eind_ts).getTime() >= nuMs;
  const live = actief && new Date(w.start_ts).getTime() <= nuMs;
  return `<div class="org-w">
    <div class="org-w-kop"><b>${esc(w.naam)}</b>
      <span class="chip${live ? ' live' : ''}${!actief ? ' voorbij' : ''}">${!actief ? 'afgelopen' : live ? '\u25cf LIVE' : esc(w.status)}</span></div>
    <div class="muted klein">${fmtDatumTijd(w.start_ts)} tot ${fmtDatumTijd(w.eind_ts)} \u00b7
      ${w.mode === 'koppel' ? 'koppels' : 'individueel'} \u00b7 ${w.teams} team${w.teams === 1 ? '' : 's'} \u00b7
      ${w.vangsten} vangst${w.vangsten === 1 ? '' : 'en'} \u00b7 ${w.push_subs} push${w.seizoen_naam ? ' \u00b7 seizoen: ' + esc(w.seizoen_naam) : ''}</div>
    <div class="org-codes muted klein">deelnemer <b class="codegroot klein-code">${esc(w.code)}</b>
      \u00b7 kijk <b class="codegroot klein-code">${esc(w.kijk_code)}</b>
      \u00b7 pin <b class="codegroot klein-code">${esc(w.admin_pin)}</b></div>
    <div class="row org-acties">
      <button class="btn primary" data-su-open="${esc(w.code)}" data-pin="${esc(w.admin_pin)}">Openen &amp; beheren</button>
      <button class="btn" data-su-kopieer="${esc(w.admin_pin)}">\ud83d\udd11 kopieer pin</button>
    </div>
  </div>`;
}

function renderSu() {
  if (!SU_DATA) return;
  $('#su-login').hidden = true;
  $('#su-omgeving').hidden = false;
  const s = SU_DATA.stats, i = SU_DATA.instellingen;
  $('#su-stats').textContent = `${s.klanten} klanten \u00b7 ${s.wedstrijden} wedstrijden \u00b7 ${s.teams} teams \u00b7 ` +
    `${s.vangsten} vangsten \u00b7 ${s.push_subs} push-abonnementen \u00b7 ${s.seizoenen} seizoenen`;
  $('#su-instellingen').innerHTML = `
    <p class="muted klein">alleen-lezen: <b>${i.alleen_lezen ? 'AAN (nieuwe wedstrijden geblokkeerd)' : 'uit'}</b>
      \u00b7 vaste zones: ${i.heeft_standaard_zones ? 'ja' : 'nee'}
      \u00b7 push-sleutels: ${i.heeft_vapid && i.heeft_push_secret ? 'ok' : 'ONTBREKEN'}</p>
    <button id="su-alleen-lezen" class="btn${i.alleen_lezen ? '' : ' gevaar'}">${i.alleen_lezen
      ? 'Zet alleen-lezen UIT (weer activeren)' : 'Zet alleen-lezen AAN (abonnement verlopen)'}</button>`;
  const nuMs = new Date(SU_DATA.server_now).getTime();
  const klanten = SU_DATA.klanten || [];
  if (!klanten.some((k) => k.slug === SU_KLANT)) SU_KLANT = klanten.length ? klanten[0].slug : null;
  const actieve = klanten.find((k) => k.slug === SU_KLANT);
  const zonder = SU_DATA.zonder_klant || [];
  $('#su-wedstrijden').innerHTML = `
    <div class="schakel" style="flex-wrap:wrap">${klanten.map((k) =>
      `<button data-su-klant="${esc(k.slug)}" class="${k.slug === SU_KLANT ? 'actief' : ''}">${esc(k.naam)}
        <span class="muted klein">(${k.stats.wedstrijden})</span></button>`).join('')}</div>
    ${actieve ? `<p class="muted klein" style="margin-top:10px">/${esc(actieve.slug)} \u00b7
      ${actieve.stats.wedstrijden} wedstrijd${actieve.stats.wedstrijden === 1 ? '' : 'en'} \u00b7
      ${actieve.stats.teams} teams \u00b7 ${actieve.stats.vangsten} vangsten</p>` : ''}
    ${actieve && actieve.wedstrijden.length
      ? actieve.wedstrijden.map((w) => suKaart(w, nuMs)).join('')
      : '<p class="muted">Geen wedstrijden bij deze klant.</p>'}
    ${zonder.length ? `<p class="fout">LET OP: ${zonder.length} wedstrijd(en) zonder klant: ${zonder.map((w) => esc(w.naam)).join(', ')}</p>` : ''}`;
  document.querySelectorAll('[data-su-klant]').forEach((b) => {
    b.onclick = () => { SU_KLANT = b.dataset.suKlant; renderSu(); };
  });
  $('#su-alleen-lezen').onclick = () => tikNogmaals($('#su-alleen-lezen'), '\u26a0\ufe0f Tik nogmaals', async () => {
    try {
      await rpc('w_su_alleen_lezen', { p_wachtwoord: sessie.suWw() || '', p_aan: !SU_DATA.instellingen.alleen_lezen });
      laadSu();
    } catch (err) { toast(foutTekst(err)); }
  });
  document.querySelectorAll('[data-su-open]').forEach((b) => {
    b.onclick = () => { sessie.zetPin(b.dataset.suOpen, b.dataset.pin); location.hash = '#/w/' + b.dataset.suOpen; };
  });
  document.querySelectorAll('[data-su-kopieer]').forEach((b) => {
    b.onclick = async () => { await kopieerTekst(b.dataset.suKopieer); toast('Pin gekopieerd.'); };
  });
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
      <b>${esc(w.naam)}</b>
      <span class="chip${live ? ' live' : ''}${!actief ? ' voorbij' : ''}">${esc(statusTekst)}</span>
    </div>
    <div class="muted klein">${fmtDatumTijd(w.start_ts)} tot ${fmtDatumTijd(w.eind_ts)} ·
      ${w.mode === 'koppel' ? 'koppels' : 'individueel'}${w.heeft_zones ? ' · zones' : ''} ·
      ${w.max_teams ? `${w.teams}/${w.max_teams}` : w.teams} team${w.teams === 1 && !w.max_teams ? '' : 's'} · ${w.vangsten} vangst${w.vangsten === 1 ? '' : 'en'}</div>
    <div class="org-codes muted klein">deelnemerscode <b class="codegroot klein-code">${esc(w.code)}</b>
      · kijkcode <b class="codegroot klein-code">${esc(w.kijk_code)}</b></div>
    ${seizoenRegel}
    <div class="row org-acties">
      <button class="btn primary" data-org-open="${esc(w.code)}" data-pin="${esc(w.admin_pin)}">Openen &amp; beheren</button>
      ${w.status === 'aanmelden' && actief ? `<button class="btn" data-org-loting="${esc(w.code)}" data-pin="${esc(w.admin_pin)}">🎲 Start loting</button>` : ''}
      <button class="btn gevaar" data-org-verwijder="${esc(w.code)}" data-naam="${esc(w.naam)}">🗑️</button>
    </div>
  </div>`;
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
  document.querySelectorAll('[data-org-verwijder]').forEach((b) => {
    b.onclick = () => tikNogmaals(b, '⚠️ Definitief weg', async () => {
      try {
        const res = await rpc('w_org_verwijder_wedstrijd', {
          p_wachtwoord: sessie.orgWw() || '',
          p_code: b.dataset.orgVerwijder,
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

// organisator in "geef plek"-modus, met een geldig doel-team (nog zonder keuze)
function adminKiesActief() {
  if (!ADMIN_KIES || ROL !== 'organisator' || !ADMIN_OPEN) return null;
  if (STATE?.wedstrijd?.status !== 'stekkeuze') { ADMIN_KIES = null; return null; }
  const doel = STATE.teams.find((t) => t.id === ADMIN_KIES.teamId);
  if (!doel || (doel.stekken || []).length) { ADMIN_KIES = null; return null; }
  return ADMIN_KIES;
}
function magSelecteren() {
  if (adminKiesActief()) return true;
  const mijn = mijnTeam();
  const beurt = teamAanBeurt();
  return !!(mijn && beurt && beurt.id === mijn.id);
}

function klikStek(nr) {
  const w = STATE?.wedstrijd;
  if (!w || w.status !== 'stekkeuze') return;
  if (!magSelecteren()) return;
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
  if (!magSelecteren()) return;
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
  const namens = adminKiesActief();
  const mijnBeurt = !!(mijn && beurt && mijn.id === beurt.id);
  if (!mijnBeurt && !namens) { SELECTIE = []; SELECTIE_ZONE = null; }

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
      else if ((mijnBeurt || namens) && (!heeftZones() || (zone && !zoneBezet(zone.naam)))) g.classList.add('kiesbaar');
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
    else if (mijnBeurt || namens) g.classList.add('kiesbaar');
  });

  const melding = $('#kaart-melding');
  const actie = $('#stek-actie');
  const knop = $('#btn-kies');
  const annuleer = $('#btn-kies-annuleer');
  annuleer.hidden = !namens;
  if (w.status === 'stekkeuze' && (beurt || namens)) {
    melding.hidden = false;
    if (namens) {
      actie.hidden = false;
      melding.className = 'melding groen';
      const wat = heeftZones() ? SELECTIE_ZONE && zoneLabel(SELECTIE_ZONE) : SELECTIE.length === aantalNodig() && 'stek ' + [...SELECTIE].sort((a, b) => a - b).join(' + ');
      melding.textContent = wat
        ? `${wat} geselecteerd voor ${namens.naam}.`
        : `Kies op de kaart een plek voor ${namens.naam} (beheer-modus).`;
      knop.disabled = !wat;
      knop.textContent = wat ? `Bevestig ${wat} voor ${namens.naam}` : 'Selecteer een plek';
    } else if (mijnBeurt) {
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
// tiebreaks: gelijk totaal -> grootste vis wint; gelijk grootste -> vroegst gevangen wint
const klGrootsteVan = (r) => r.grootste ? r.grootste.gewicht_gram : 0;
const klTijdGrootste = (r) => r.grootste ? new Date(r.grootste.created_at).getTime() : Infinity;
// telt vangsten per team op; alleen teams met vangsten, nog ongesorteerd
function klassementRijen() {
  const perTeam = new Map();
  for (const t of STATE.teams) perTeam.set(t.id, { team: t, totaal: 0, aantal: 0, grootste: null });
  for (const v of STATE.vangsten) {
    const r = perTeam.get(v.team_id);
    if (!r) continue;
    r.totaal += v.gewicht_gram;
    r.aantal += 1;
    if (!r.grootste || v.gewicht_gram > r.grootste.gewicht_gram) r.grootste = v;
  }
  return [...perTeam.values()].filter((r) => r.aantal > 0);
}

function renderKlassement() {
  $('#kl-totaal').classList.toggle('actief', KLASSEMENT_MODE === 'totaal');
  $('#kl-grootste').classList.toggle('actief', KLASSEMENT_MODE === 'grootste');
  const el = $('#klassement-inhoud');
  const rijen = klassementRijen();
  // deel-knop alleen op een afgelopen wedstrijd met uitslag
  const deelRij = $('#deel-rij');
  if (deelRij) deelRij.hidden = !(fase() === 'voorbij' && rijen.length > 0);
  if (!rijen.length) {
    el.innerHTML = '<p class="muted">Nog geen vangsten geregistreerd.</p>';
    return;
  }
  const plek = (t) => t.zone ? zoneLabel(t.zone) : (t.stekken?.length ? `stek ${t.stekken.join('+')}` : '');
  const rangKlas = (rang) => 'rank' + (rang === 1 ? ' goud' : rang === 2 ? ' zilver' : rang === 3 ? ' brons' : '');
  const grootsteVan = klGrootsteVan;
  const tijdGrootste = klTijdGrootste;
  // volledig gelijke stand krijgt hetzelfde rangnummer
  const metRang = (sleutelVan) => {
    let rang = 0, vorige = null;
    return rijen.map((r, i) => {
      const sleutel = sleutelVan(r);
      if (sleutel !== vorige) { rang = i + 1; vorige = sleutel; }
      return { r, rang };
    });
  };
  if (KLASSEMENT_MODE === 'totaal') {
    rijen.sort((a, b) => b.totaal - a.totaal || grootsteVan(b) - grootsteVan(a) || tijdGrootste(a) - tijdGrootste(b));
    const vissenVan = (teamId) => {
      const alle = STATE.vangsten
        .filter((v) => v.team_id === teamId)
        .slice().reverse()
        .map((v) => (v.gewicht_gram / 1000).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      return alle.length > 10
        ? `${alle.slice(0, 10).join(' + ')} kg + nog ${alle.length - 10} vissen`
        : `${alle.join(' + ')} kg`;
    };
    el.innerHTML = `<table class="klassement">
      <tr><th>#</th><th>Team</th><th class="r">Vissen</th><th class="r">Totaal</th></tr>
      ${metRang((r) => `${r.totaal}|${grootsteVan(r)}|${tijdGrootste(r)}`).map(({ r, rang }) => `<tr>
        <td class="${rangKlas(rang)}">${rang}</td>
        <td>${teamNaamHtml(r.team)} <span class="muted klein">${esc(plek(r.team))}</span>
          <div class="opbouw">${vissenVan(r.team.id)}</div></td>
        <td class="r">${r.aantal}</td>
        <td class="r"><b>${fmtKg(r.totaal)}</b></td>
      </tr>`).join('')}
    </table>`;
  } else {
    rijen.sort((a, b) => grootsteVan(b) - grootsteVan(a) || tijdGrootste(a) - tijdGrootste(b));
    el.innerHTML = `<table class="klassement">
      <tr><th>#</th><th>Team</th><th class="r">Grootste vis</th><th></th></tr>
      ${metRang((r) => `${grootsteVan(r)}|${tijdGrootste(r)}`).map(({ r, rang }) => `<tr>
        <td class="${rangKlas(rang)}">${rang}</td>
        <td>${teamNaamHtml(r.team)}</td>
        <td class="r"><b>${fmtKg(r.grootste.gewicht_gram)}</b></td>
        <td>${r.grootste.foto_path
          ? `<img class="thumb" src="${esc(fotoUrl(r.grootste.foto_path))}" alt="grootste vis" data-groot="${esc(fotoUrl(r.grootste.foto_path))}">`
          : '<span class="foto-leeg thumb-maat">🎣</span>'}</td>
      </tr>`).join('')}
    </table>`;
  }
}

/* ---------- uitslag delen als afbeelding ---------- */
// tekent de einduitslag (totaal-klassement) op een canvas in de app-huisstijl
function tekenUitslag() {
  const w = STATE.wedstrijd;
  const rijen = klassementRijen();
  rijen.sort((a, b) => b.totaal - a.totaal
    || klGrootsteVan(b) - klGrootsteVan(a) || klTijdGrootste(a) - klTijdGrootste(b));
  const top = rijen.slice(0, 10);
  const rest = rijen.length - top.length;
  const kampioenVis = rijen.reduce((m, r) => (klGrootsteVan(r) > klGrootsteVan(m) ? r : m), rijen[0]);

  const B = 1080, KOP = 216, RIJ = 78, NA = rest > 0 ? 46 : 10, VIS = 92, VOET = 92;
  const H = KOP + 24 + top.length * RIJ + NA + VIS + VOET;
  const c = document.createElement('canvas');
  c.width = B; c.height = H;
  const ctx = c.getContext('2d');
  const { F, rond, kort } = canvasHulp(ctx);

  // achtergrond + kop
  ctx.fillStyle = '#edeadb'; ctx.fillRect(0, 0, B, H);
  ctx.fillStyle = '#353d2a'; ctx.fillRect(0, 0, B, KOP);
  ctx.fillStyle = '#E8871E'; ctx.font = F(26, true);
  ctx.fillText('EINDUITSLAG', 64, 74);
  ctx.fillStyle = '#ffffff'; ctx.font = F(46, true);
  ctx.fillText(kort(w.naam, B - 128), 64, 130);
  const orgNaam = (document.querySelector('.topbar .brand')?.textContent || '').trim();
  const datum = new Date(w.start_ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillStyle = '#d9dcc2'; ctx.font = F(26);
  ctx.fillText(kort(`${datum}${orgNaam ? ' · ' + orgNaam : ''}`, B - 128), 64, 174);

  // klassement-rijen
  const plek = (t) => t.zone ? zoneLabel(t.zone) : (t.stekken?.length ? `stek ${t.stekken.join('+')}` : '');
  const rangKleur = { 1: '#c9a227', 2: '#8f959c', 3: '#b5713f' };
  let y = KOP + 24;
  // gedeelde plaatsen exact zoals de klassement-tabel (volledig gelijke stand
  // = zelfde rangnummer, doortellen)
  let rang = 0, vorigeSleutel = null;
  top.forEach((r, i) => {
    const sleutel = `${r.totaal}|${klGrootsteVan(r)}|${klTijdGrootste(r)}`;
    if (sleutel !== vorigeSleutel) { rang = i + 1; vorigeSleutel = sleutel; }
    ctx.fillStyle = '#ffffff';
    rond(40, y, B - 80, RIJ - 12, 16); ctx.fill();
    ctx.fillStyle = rangKleur[rang] || '#e7e4d4';
    ctx.beginPath(); ctx.arc(88, y + (RIJ - 12) / 2, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rangKleur[rang] ? '#ffffff' : '#57543f';
    ctx.font = F(24, true); ctx.textAlign = 'center';
    ctx.fillText(String(rang), 88, y + (RIJ - 12) / 2 + 9);
    ctx.textAlign = 'left';
    const naamVeld = B - 500;              // naam + stek links; kg en vissen rechts
    ctx.fillStyle = '#29271e'; ctx.font = F(30, true);
    const naamTekst = kort(teamNaam(r.team), naamVeld - 110);
    ctx.fillText(naamTekst, 132, y + 42);
    const naamBreed = ctx.measureText(naamTekst).width;
    ctx.fillStyle = '#7a7660'; ctx.font = F(22);
    ctx.fillText(kort(plek(r.team), naamVeld - naamBreed - 14), 132 + naamBreed + 14, y + 42);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#353d2a'; ctx.font = F(32, true);
    ctx.fillText(fmtKg(r.totaal), B - 64, y + 44);
    ctx.fillStyle = '#7a7660'; ctx.font = F(20);
    ctx.fillText(`${r.aantal} ${r.aantal === 1 ? 'vis' : 'vissen'}`, B - 236, y + 44);
    ctx.textAlign = 'left';
    y += RIJ;
  });
  if (rest > 0) {
    ctx.fillStyle = '#7a7660'; ctx.font = F(22);
    ctx.fillText(`+ nog ${rest} ${rest === 1 ? 'deelnemer' : 'deelnemers'} met vangst`, 64, y + 18);
  }
  y += NA;

  // grootste vis
  if (kampioenVis && kampioenVis.grootste) {
    ctx.fillStyle = '#dfdcc6';
    rond(40, y, B - 80, VIS - 22, 16); ctx.fill();
    ctx.fillStyle = '#353d2a'; ctx.font = F(28, true);
    ctx.fillText(kort(`🏆 Grootste vis: ${fmtKg(kampioenVis.grootste.gewicht_gram)} · ${teamNaam(kampioenVis.team)}`, B - 160), 64, y + 45);
  }

  tekenVoet(ctx, B, H, VOET);
  return c;
}

function canvasHulp(ctx) {
  const F = (px, vet = false) => `${vet ? '800 ' : ''}${px}px system-ui, "Segoe UI", Arial, sans-serif`;
  const rond = (x, y, br, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + br, y, x + br, y + h, r);
    ctx.arcTo(x + br, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + br, y, r);
    ctx.closePath();
  };
  const kort = (tekst, maxB) => {
    let s = String(tekst);
    while (s.length > 3 && ctx.measureText(s).width > maxB) s = s.slice(0, -2).trimEnd() + '…';
    return s;
  };
  return { F, rond, kort };
}

const naarBestandsnaam = (voorvoegsel, naam) => voorvoegsel + '-' + String(naam).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) + '.png';

async function deelPng(canvas, bestandsnaam, titel) {
  const blob = await new Promise((klaar) => canvas.toBlob(klaar, 'image/png'));
  if (!blob) throw new Error('afbeelding_mislukt');
  const bestand = new File([blob], bestandsnaam, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [bestand] })) {
    await navigator.share({ files: [bestand], title: titel });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = bestandsnaam;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('Opgeslagen als afbeelding.');
  }
}

// duidelijke app-vermelding op ALLE deel-afbeeldingen: logo + adres in de voet
const APP_ICOON = new Image();
const APP_ICOON_KLAAR = new Promise((klaar) => {
  APP_ICOON.onload = klaar;
  APP_ICOON.onerror = klaar;
});
APP_ICOON.src = '/icon-192.png';

// kort wachten op het logo zodat de eerste deelactie het ook al heeft;
// na 1,5s delen we zonder logo in plaats van te blijven hangen (Codex v6 P2-4)
function wachtOpVoetLogo() {
  return Promise.race([APP_ICOON_KLAAR, new Promise((klaar) => setTimeout(klaar, 1500))]);
}

function tekenVoet(ctx, B, H, VOET, rechts = 'loting \u00b7 stekkeuze \u00b7 live klassement') {
  ctx.fillStyle = '#353d2a'; ctx.fillRect(0, H - VOET, B, VOET);
  let x = 64;
  if (APP_ICOON.complete && APP_ICOON.naturalWidth) {
    const m = 54, y = H - VOET + (VOET - m) / 2, r = 12;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + m, y, x + m, y + m, r);
    ctx.arcTo(x + m, y + m, x, y + m, r);
    ctx.arcTo(x, y + m, x, y, r);
    ctx.arcTo(x, y, x + m, y, r);
    ctx.closePath(); ctx.clip();
    ctx.drawImage(APP_ICOON, x, y, m, m);
    ctx.restore();
    x += m + 22;
  }
  ctx.fillStyle = '#E8871E'; ctx.font = '800 30px "Courier New", monospace';
  ctx.fillText('viswedstrijdapp.nl', x, H - VOET / 2 + 11);
  ctx.fillStyle = '#9ba183'; ctx.font = '22px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(rechts, B - 64, H - VOET / 2 + 8);
  ctx.textAlign = 'left';
}

function laadFoto(url, timeoutMs = 12000) {
  return new Promise((ok, nee) => {
    const img = new Image();
    // zonder timeout kan de deel-knop eeuwig disabled blijven bij een
    // hangende verbinding (Codex v6 P2-3)
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      nee(new Error('foto_laden_mislukt'));
    }, timeoutMs);
    img.crossOrigin = 'anonymous'; // bucket stuurt ACAO *, dus canvas blijft deelbaar
    img.onload = () => { clearTimeout(timer); ok(img); };
    img.onerror = () => { clearTimeout(timer); nee(new Error('foto_laden_mislukt')); };
    img.src = url;
  });
}

function tekenVangstPlaceholder(ctx, B, H) {
  ctx.fillStyle = '#2f4a2a'; ctx.fillRect(0, 0, B, H);
  if (APP_ICOON.complete && APP_ICOON.naturalWidth) {
    const m = 340;
    ctx.save(); ctx.globalAlpha = 0.9;
    ctx.drawImage(APP_ICOON, (B - m) / 2, (H - m) / 2 - 40, m, m);
    ctx.restore();
  }
}

// deelbare vangst-afbeelding: foto (of placeholder) + gewicht + visser + app-voet
async function tekenVangst(v, t) {
  const B = 1080, FOTO_H = 1010, INFO = 250, VOET = 92;
  const H = FOTO_H + INFO + VOET; // ~4:5, Instagram-vriendelijk
  const c = document.createElement('canvas');
  c.width = B; c.height = H;
  const ctx = c.getContext('2d');
  const { F, kort } = canvasHulp(ctx);
  if (v.foto_path) {
    try {
      const img = await laadFoto(fotoUrl(v.foto_path));
      const s = Math.max(B / img.width, FOTO_H / img.height); // cover-crop
      const w2 = img.width * s, h2 = img.height * s;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, B, FOTO_H); ctx.clip();
      ctx.drawImage(img, (B - w2) / 2, (FOTO_H - h2) / 2, w2, h2);
      ctx.restore();
    } catch { tekenVangstPlaceholder(ctx, B, FOTO_H); }
  } else {
    tekenVangstPlaceholder(ctx, B, FOTO_H);
  }
  ctx.fillStyle = '#353d2a'; ctx.fillRect(0, FOTO_H, B, INFO + VOET);
  ctx.fillStyle = '#E8871E'; ctx.font = F(72, true);
  ctx.fillText(fmtKg(v.gewicht_gram), 64, FOTO_H + 98);
  ctx.fillStyle = '#ffffff'; ctx.font = F(34, true);
  ctx.fillText(kort(t ? teamNaam(t) : 'vangst', B - 128), 64, FOTO_H + 154);
  ctx.fillStyle = '#d9dcc2'; ctx.font = F(26);
  const wanneer = new Date(v.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
  ctx.fillText(kort(`${STATE.wedstrijd.naam} \u00b7 ${wanneer}`, B - 128), 64, FOTO_H + 198);
  tekenVoet(ctx, B, H, VOET, 'volg de wedstrijd live');
  return c;
}

async function deelVangst(v, t, knop) {
  if (knop) knop.disabled = true;
  try {
    await wachtOpVoetLogo();
    const canvas = await tekenVangst(v, t);
    await deelPng(canvas, naarBestandsnaam('vangst', `${t ? teamNaam(t) : 'vis'}-${v.gewicht_gram}g`),
      `Vangst ${fmtKg(v.gewicht_gram)} \u00b7 ${STATE.wedstrijd.naam}`);
  } catch (err) {
    if (err && err.name !== 'AbortError') toast('Delen lukte niet: ' + (err.message || err));
  } finally {
    if (knop) knop.disabled = false;
  }
}

function koppelVangstDelen() {
  document.querySelectorAll('[data-deel-vangst]').forEach((b) => {
    b.onclick = () => {
      const v = STATE.vangsten.find((x) => x.id === b.dataset.deelVangst);
      if (!v) return;
      deelVangst(v, STATE.teams.find((x) => x.id === v.team_id), b);
    };
  });
}

async function deelUitslag() {
  const knop = $('#btn-deel-uitslag');
  if (knop) knop.disabled = true;
  try {
    await wachtOpVoetLogo();
    await deelPng(tekenUitslag(), naarBestandsnaam('uitslag', STATE.wedstrijd.naam),
      `Uitslag ${STATE.wedstrijd.naam}`);
  } catch (err) {
    if (err && err.name !== 'AbortError') toast('Delen lukte niet: ' + (err.message || err));
  } finally {
    if (knop) knop.disabled = false;
  }
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
  const opGewicht = regels.telling === 'totaalgewicht';
  const rangKlas = (r) => 'rank' + (r === 1 ? ' goud' : r === 2 ? ' zilver' : r === 3 ? ' brons' : '');
  const cel = (r) => {
    const inhoud = opGewicht ? fmtKg(r.gewicht) : String(Number(r.punten));
    return `<td class="r${r.gemist ? ' muted' : ''}">${r.vervallen ? `<s>${inhoud}</s>` : inhoud}</td>`;
  };
  el.innerHTML = `
    <p class="muted klein">${esc(s.seizoen.naam)} · na ${s.wedstrijden.length} wedstrijd${s.wedstrijden.length === 1 ? '' : 'en'} ·
      ${opGewicht ? 'telling op totaalgewicht' : 'plaatspunten: minste punten wint'}${regels.aftrek > 0 ? ` · beste ${Math.max(1, s.wedstrijden.length - regels.aftrek)} resultaten tellen` : ''}</p>
    <div style="overflow-x:auto"><table class="klassement">
      <tr><th>#</th><th>Deelnemer</th>${s.wedstrijden.map((w, i) => `<th class="r" title="${esc(w.naam)}">${i + 1}</th>`).join('')}<th class="r">${opGewicht ? 'Totaal' : 'Punten'}</th></tr>
      ${s.stand.map((d) => `<tr>
        <td class="${rangKlas(d.plaats)}">${d.plaats}</td>
        <td>${esc(d.naam)}<div class="opbouw">${fmtKg(d.gewicht_totaal)} gevangen</div></td>
        ${d.resultaten.map(cel).join('')}
        <td class="r"><b>${opGewicht ? fmtKg(d.gewicht_geteld) : Number(d.punten)}</b></td>
      </tr>`).join('')}
    </table></div>
    <p class="muted klein">${s.wedstrijden.map((w, i) => `${i + 1} = ${esc(w.naam)}`).join(' · ')}.
    Doorgestreept = vervalt (aftrek) · grijs = niet meegedaan.</p>`;
}

// tekent de seizoensstand op een canvas in de app-huisstijl
function tekenSeizoen() {
  const s = SEIZOEN;
  const opGewicht = s.seizoen.regels.telling === 'totaalgewicht';
  const top = s.stand.slice(0, 10);
  const rest = s.stand.length - top.length;
  const B = 1080, KOP = 216, RIJ = 78, NA = rest > 0 ? 46 : 10, VOET = 92;
  const H = KOP + 24 + top.length * RIJ + NA + VOET;
  const c = document.createElement('canvas');
  c.width = B; c.height = H;
  const ctx = c.getContext('2d');
  const { F, rond, kort } = canvasHulp(ctx);

  ctx.fillStyle = '#edeadb'; ctx.fillRect(0, 0, B, H);
  ctx.fillStyle = '#353d2a'; ctx.fillRect(0, 0, B, KOP);
  ctx.fillStyle = '#E8871E'; ctx.font = F(26, true);
  ctx.fillText('SEIZOENSSTAND', 64, 74);
  ctx.fillStyle = '#ffffff'; ctx.font = F(46, true);
  ctx.fillText(kort(s.seizoen.naam, B - 128), 64, 130);
  const orgNaam = (document.querySelector('.topbar .brand')?.textContent || '').trim();
  ctx.fillStyle = '#d9dcc2'; ctx.font = F(26);
  ctx.fillText(kort(`na ${s.wedstrijden.length} wedstrijd${s.wedstrijden.length === 1 ? '' : 'en'}${orgNaam ? ' · ' + orgNaam : ''}`, B - 128), 64, 174);

  const rangKleur = { 1: '#c9a227', 2: '#8f959c', 3: '#b5713f' };
  let y = KOP + 24;
  top.forEach((d) => {
    ctx.fillStyle = '#ffffff';
    rond(40, y, B - 80, RIJ - 12, 16); ctx.fill();
    ctx.fillStyle = rangKleur[d.plaats] || '#e7e4d4';
    ctx.beginPath(); ctx.arc(88, y + (RIJ - 12) / 2, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rangKleur[d.plaats] ? '#ffffff' : '#57543f';
    ctx.font = F(24, true); ctx.textAlign = 'center';
    ctx.fillText(String(d.plaats), 88, y + (RIJ - 12) / 2 + 9);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#29271e'; ctx.font = F(30, true);
    ctx.fillText(kort(d.naam, B - 520), 132, y + 42);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#353d2a'; ctx.font = F(32, true);
    ctx.fillText(opGewicht ? fmtKg(d.gewicht_geteld) : `${Number(d.punten)} pnt`, B - 64, y + 44);
    ctx.fillStyle = '#7a7660'; ctx.font = F(20);
    ctx.fillText(fmtKg(d.gewicht_totaal), B - 250, y + 44);
    ctx.textAlign = 'left';
    y += RIJ;
  });
  if (rest > 0) {
    ctx.fillStyle = '#7a7660'; ctx.font = F(22);
    ctx.fillText(`+ nog ${rest} deelnemer${rest === 1 ? '' : 's'}`, 64, y + 18);
  }

  tekenVoet(ctx, B, H, VOET);
  return c;
}

async function deelSeizoen() {
  const knop = $('#btn-deel-seizoen');
  if (knop) knop.disabled = true;
  try {
    await wachtOpVoetLogo();
    await deelPng(tekenSeizoen(), naarBestandsnaam('seizoensstand', SEIZOEN.seizoen.naam),
      `Stand ${SEIZOEN.seizoen.naam}`);
  } catch (err) {
    if (err && err.name !== 'AbortError') toast('Delen lukte niet: ' + (err.message || err));
  } finally {
    if (knop) knop.disabled = false;
  }
}

/* ---------- vangstenfeed ---------- */
function renderVangsten() {
  const el = $('#vangsten-feed');
  if (!STATE.vangsten.length) {
    el.innerHTML = '<p class="muted">Nog geen vangsten. De eerste vis komt eraan…</p>';
    return;
  }
  const teamsBijId = new Map(STATE.teams.map((t) => [t.id, t]));
  el.innerHTML = STATE.vangsten.map((v) => {
    const t = teamsBijId.get(v.team_id);
    return `<div class="vangst-kaart">
      ${vangstFotoHtml(v, 'groot')}
      <div class="info">
        <div class="gewicht">${fmtKg(v.gewicht_gram)}</div>
        <div class="wie">${t ? teamNaamHtml(t) : 'onbekend'}</div>
        <div class="tijd">${fmtDatumTijd(v.created_at)}</div>
        <div style="margin-top:6px"><button class="btn klein-btn" data-deel-vangst="${esc(v.id)}">\ud83d\udce4 deel</button></div>
      </div>
    </div>`;
  }).join('');
  koppelVangstDelen();
}

// foto of nette placeholder (vangsten die de organisator zonder foto invoerde)
function vangstFotoHtml(v, maat) {
  if (!v.foto_path) {
    return `<span class="foto-leeg ${maat === 'groot' ? 'foto-maat' : 'thumb-maat'}" title="ingevoerd door de organisator">🎣</span>`;
  }
  const url = esc(fotoUrl(v.foto_path));
  return maat === 'groot'
    ? `<img src="${url}" alt="vangst" data-groot="${url}" loading="lazy">`
    : `<img class="thumb" src="${url}" data-groot="${url}" alt="">`;
}

/* ---------- push-meldingen ---------- */
const pushKanHier = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

function pushAan(code) { return localStorage.getItem('push:' + code) === '1'; }

function renderPushKnop() {
  const knop = $('#btn-push'), tip = $('#push-tip');
  // afgelopen wedstrijd: aanmelden voor meldingen kan niet meer (server blokkeert
  // ook); alleen wie nog geabonneerd is ziet de knop om uit te zetten
  if (fase() === 'voorbij' && !(pushKanHier() && pushAan(CODE))) {
    knop.hidden = true; tip.hidden = true; return;
  }
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
  $('#btn-deel-uitslag')?.addEventListener('click', deelUitslag);
  $('#btn-deel-seizoen')?.addEventListener('click', deelSeizoen);
  $('#dn-sluit')?.addEventListener('click', () => { $('#deel-nieuw').hidden = true; });
  $('#dn-deel')?.addEventListener('click', async () => {
    const d = DEEL_NIEUW;
    if (!d) return;
    const tekst = `\ud83c\udfa3 ${d.naam}\n\ud83d\udcc5 ${fmtDatumTijd(d.start)} tot ${fmtDatumTijd(d.eind)}\n\n`
      + `Doe mee: open ${d.link} en meld je aan met code ${d.code}.\n`
      + `Thuis meekijken kan met kijkcode ${d.kijk} op ${location.origin}${location.pathname}\n\n`
      + `Tip: zet de app op je beginscherm voor meldingen bij elke vangst: ${location.origin}${location.pathname}instructies.html`;
    try {
      if (navigator.share) {
        await navigator.share({ text: tekst });
      } else {
        await kopieerTekst(tekst);
        toast('Uitnodiging gekopieerd; plak hem in de groepsapp.');
      }
    } catch (err) { if (err && err.name !== 'AbortError') toast(foutTekst(err)); }
  });
  document.querySelectorAll('[data-dn-kopieer]').forEach((b) => {
    b.addEventListener('click', async () => {
      const d = DEEL_NIEUW;
      if (!d) return;
      await kopieerTekst({ code: d.code, link: d.link, kijk: d.kijk }[b.dataset.dnKopieer]);
      toast('Gekopieerd.');
    });
  });
  $('#form-sulogin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const foutEl = $('#su-fout');
    foutEl.hidden = true;
    try {
      SU_DATA = await rpc('w_su_overzicht', { p_wachtwoord: $('#su-ww').value });
      sessie.zetSuWw($('#su-ww').value);
      $('#su-ww').value = '';
      renderSu();
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });
  $('#su-uitloggen')?.addEventListener('click', () => {
    sessionStorage.removeItem('suww');
    wisSuScherm();
    location.hash = '';
  });
  $('#su-ververs')?.addEventListener('click', () => laadSu());
  $('#form-su-orgww')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const foutEl = $('#su-instel-fout'); foutEl.hidden = true;
    try {
      await rpc('w_su_org_wachtwoord', { p_wachtwoord: sessie.suWw() || '', p_nieuw: $('#su-orgww-nieuw').value });
      $('#su-orgww-nieuw').value = '';
      toast('Organisatie-wachtwoord aangepast. Geef het door aan de organisator.');
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });
  $('#form-su-ww')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const foutEl = $('#su-instel-fout'); foutEl.hidden = true;
    try {
      await rpc('w_su_wachtwoord', { p_wachtwoord: sessie.suWw() || '', p_nieuw: $('#su-ww-nieuw').value });
      sessie.zetSuWw($('#su-ww-nieuw').value.trim());
      $('#su-ww-nieuw').value = '';
      toast('Beheerderswachtwoord gewijzigd.');
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });
  $('#form-seizoen')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const foutEl = $('#seizoen-fout');
    foutEl.hidden = true;
    try {
      await rpc('w_org_seizoen_maak', {
        p_wachtwoord: sessie.orgWw() || '',
        p_naam: $('#sz-naam').value.trim(),
        p_regels: {
          telling: $('#sz-telling').value,
          aftrek: Math.max(0, Math.min(20, parseInt($('#sz-aftrek').value, 10) || 0)),
          niet_vanger: $('#sz-nietvanger').value,
          gemist: $('#sz-gemist').value,
          ex_aequo: $('#sz-exaequo').value,
        },
      });
      $('#sz-naam').value = '';
      toast('Seizoen aangemaakt. Koppel nu wedstrijden via de wedstrijdkaarten hierboven.');
      laadOrgSeizoenen();
    } catch (err) { foutEl.textContent = foutTekst(err); foutEl.hidden = false; }
  });
  $('#btn-push').addEventListener('click', pushToggle);

  $('#btn-kies').addEventListener('click', async () => {
    const namens = adminKiesActief();
    const t = sessie.team(CODE);
    if (!namens && !t) return;
    const knop = $('#btn-kies');
    knop.disabled = true;
    try {
      if (namens) {
        await rpc('w_admin_kies', {
          p_code: CODE, p_pin: sessie.pin(CODE), p_team_id: namens.teamId,
          p_zone: heeftZones() ? SELECTIE_ZONE : null,
          p_stekken: heeftZones() ? null : [...SELECTIE].sort((a, b) => a - b),
        });
        toast(`Plek toegewezen aan ${namens.naam}.`);
        ADMIN_KIES = null;
      } else if (heeftZones()) {
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
  $('#btn-kies-annuleer').addEventListener('click', () => {
    ADMIN_KIES = null;
    SELECTIE = []; SELECTIE_ZONE = null;
    renderKaart();
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

  $('#btn-team-uitloggen').addEventListener('click', () =>
    tikNogmaals($('#btn-team-uitloggen'), '⚠️ Zeker? Bewaar eerst je inlogcode', () => {
      localStorage.removeItem('team:' + CODE);
      toast('Uitgelogd bij dit team. Met je persoonlijke code log je weer in.');
      laadState(false);
    }));

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
      ${vangstFotoHtml(v, 'groot')}
      <div class="info">
        <div class="gewicht">${fmtKg(v.gewicht_gram)}</div>
        <div class="tijd">${fmtDatumTijd(v.created_at)}</div>
        <div style="margin-top:6px"><button class="btn klein-btn" data-deel-vangst="${esc(v.id)}">\ud83d\udce4 deel op social media</button></div>
      </div>
    </div>`).join('') +
    '<p class="muted klein">Fout gemaakt? Alleen de organisator kan een vangst aanpassen of verwijderen.</p>';
  koppelVangstDelen();
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

  $('#b-wedstrijd-opslaan').addEventListener('click', async () => {
    const maxTekst = $('#b-max').value.trim();
    const gelukt = await beheerActie('w_admin_wedstrijd', {
      p_naam: $('#b-naam').value.trim() || null,
      p_max_teams: maxTekst ? parseInt(maxTekst, 10) : null,
      p_wis_max: !maxTekst,
    });
    if (gelukt) toast('Wedstrijd bijgewerkt.');
  });

  const bvFoto = $('#bv-foto');
  bvFoto.addEventListener('change', () => {
    const f = bvFoto.files[0];
    $('#bv-foto-label').textContent = f ? '📷 ' + (f.name.length > 30 ? f.name.slice(0, 30) + '…' : f.name) : '📷 Foto (optioneel)';
  });
  $('#form-b-vangst').addEventListener('submit', async (e) => {
    e.preventDefault();
    const foutEl = $('#bv-fout'), okEl = $('#bv-ok'), knop = $('#bv-submit');
    foutEl.hidden = true; okEl.hidden = true;
    const gram = parseGewicht($('#bv-gewicht').value);
    if (!gram) { foutEl.textContent = 'Vul een geldig gewicht in tussen 0,05 en 50 kg.'; foutEl.hidden = false; return; }
    if (!$('#bv-team').value) { foutEl.textContent = 'Kies een team.'; foutEl.hidden = false; return; }
    knop.disabled = true; knop.textContent = 'Bezig…';
    try {
      let pad = null;
      const f = bvFoto.files[0];
      if (f) {
        const blob = await compressFoto(f);
        pad = await uploadFoto(CODE, blob);
      }
      await rpc('w_admin_voeg_vangst', {
        p_code: CODE, p_pin: sessie.pin(CODE),
        p_team_id: $('#bv-team').value, p_gewicht_gram: gram, p_foto_path: pad,
      });
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
    return true;
  } catch (err) {
    foutEl.textContent = foutTekst(err); foutEl.hidden = false;
    return false;
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
  const naamEl = $('#b-naam'), maxEl = $('#b-max');
  if ((magPrefill || !naamEl.dataset.geraakt)
      && document.activeElement !== naamEl && document.activeElement !== maxEl) {
    naamEl.value = w.naam;
    maxEl.value = w.max_teams ?? '';
  }
  naamEl.onfocus = maxEl.onfocus = () => { naamEl.dataset.geraakt = '1'; };
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
      ${w.status === 'stekkeuze' && !(t.stekken || []).length ? `<button class="btn klein-btn" data-team-kies="${t.id}">📍 geef plek</button>` : ''}
      <button class="btn gevaar klein-btn" data-team-weg="${t.id}">verwijder</button>
    </div>`).join('') : '<p class="muted">Nog geen deelnemers.</p>';
  const codesSleutel = CODE + ':' + STATE.teams.length;
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
  $('#b-vangsten').innerHTML = STATE.vangsten.length ? STATE.vangsten.map((v) => `
    <div class="b-rij">
      ${vangstFotoHtml(v, 'thumb')}
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

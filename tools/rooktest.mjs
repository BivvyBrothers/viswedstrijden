// Rooktest: één volledige wedstrijd door de ECHTE app heen, in een headless
// Chrome met mobiele emulatie. Fase 7 van het ontwerpplan; het vangnet dat we
// nooit hadden (geen tests, geen CI sinds het begin).
//
// Wat hij doet, in deze volgorde, op de DEMO-omgeving:
//   1. organisator logt in en maakt een wedstrijd "ROOKTEST <tijd>" die NU loopt
//   2. leest de deelnemers- en kijkcode uit het deelvenster
//   3. deelnemer meldt zich aan en krijgt zijn persoonlijke code te zien
//   4. herladen: zit hij nog in de wedstrijd (sessie-herstel)?
//   5. deelnemer registreert een vangst MET foto (echte upload)
//   6. klassement toont die vangst
//   7. kijker opent de kijkcode en ziet klassement, kaart en vangsten
//   8. terugknop brengt naar het startscherm met de Verder-kaart, niet naar een inlogscherm
//   9. organisator verwijdert de wedstrijd weer (ook als er onderweg iets faalt)
// Console-fouten en mislukte netwerkverzoeken tellen als ROOD.
//
// Gebruik (het organisatiewachtwoord staat NOOIT in deze repo):
//   1. chrome --headless --disable-gpu --hide-scrollbars \
//        --remote-debugging-port=9333 --user-data-dir=/tmp/rooktest-profiel about:blank &
//   2. node tools/rooktest.mjs --orgww "<wachtwoord van de demo-organisatie>" \
//        [--basis https://viswedstrijdapp.nl/demo]
// Uitvoer: regels op de terminal en een verslag in review/rooktest-<datum>.md
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = process.env.CDP_PORT || 9333;
const args = process.argv.slice(2);
const arg = (naam, standaard = null) => {
  const i = args.indexOf(naam);
  return i >= 0 && args[i + 1] ? args[i + 1] : standaard;
};
const ORGWW = arg('--orgww') || process.env.VWA_ORGWW;
const BASIS = (arg('--basis', 'https://viswedstrijdapp.nl/demo')).replace(/\/$/, '');
const FOTO = arg('--foto', fileURLToPath(new URL('../docs/schermen/vangst-klein.jpg', import.meta.url)));
if (!ORGWW) { console.error('geef --orgww mee (of zet VWA_ORGWW)'); process.exit(1); }

const W = 390, H = 844;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const slaap = (ms) => new Promise((r) => setTimeout(r, ms));

async function nieuweTab() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  return (await r.json()).webSocketDebuggerUrl;
}
function verbind(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let id = 0; const wachters = new Map(); const luisteraars = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && wachters.has(m.id)) { wachters.get(m.id)(m); wachters.delete(m.id); }
      else if (m.method) luisteraars.forEach((f) => f(m));
    };
    ws.onerror = rej;
    ws.onopen = () => res({
      stuur: (method, params = {}) => new Promise((ok) => {
        const mijn = ++id; wachters.set(mijn, (m) => ok(m.result ?? m));
        ws.send(JSON.stringify({ id: mijn, method, params }));
      }),
      op: (f) => luisteraars.push(f),
      sluit: () => ws.close(),
    });
  });
}

const fouten = [];   // console- en netwerkfouten
const stappen = [];  // { naam, ok, info }
let cdp;

async function js(expressie, wacht = 0) {
  if (wacht) await slaap(wacht);
  const r = await cdp.stuur('Runtime.evaluate', {
    expression: `(async () => { ${expressie} })()`, awaitPromise: true, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'js-fout');
  return r.result?.value;
}
async function stap(naam, fn) {
  try {
    const info = await fn();
    stappen.push({ naam, ok: true, info: info === undefined ? '' : String(info) });
    console.log(`  ok   ${naam}${info ? ' | ' + info : ''}`);
    return info;
  } catch (e) {
    stappen.push({ naam, ok: false, info: e.message });
    console.log(`  FOUT ${naam} | ${e.message}`);
    throw e;
  }
}
const wachtTot = async (expressie, seconden = 15, stapMs = 400) => {
  for (let i = 0; i < (seconden * 1000) / stapMs; i++) {
    if (await js(`return !!(${expressie});`)) return true;
    await slaap(stapMs);
  }
  throw new Error(`wachtte tevergeefs op: ${expressie}`);
};

const tijdVeld = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

let CODE = null, KIJK = null;

async function main() {
  cdp = await verbind(await nieuweTab());
  await cdp.stuur('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await cdp.stuur('Emulation.setUserAgentOverride', { userAgent: UA });
  await cdp.stuur('Page.enable');
  await cdp.stuur('Runtime.enable');
  await cdp.stuur('Log.enable');
  await cdp.stuur('Network.enable');
  await cdp.stuur('DOM.enable');
  cdp.op((m) => {
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      fouten.push('console: ' + m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 200));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      fouten.push('log: ' + String(m.params.entry.text).slice(0, 200));
    }
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) {
      fouten.push(`http ${m.params.response.status}: ${m.params.response.url.split('?')[0]}`);
    }
  });

  console.log(`Rooktest op ${BASIS}`);
  const naam = 'ROOKTEST ' + new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

  await stap('app laadt en toont het startscherm', async () => {
    await cdp.stuur('Page.navigate', { url: `${BASIS}/?rooktest=${Date.now()}` });
    await slaap(3500);
    await js(`localStorage.clear(); sessionStorage.clear(); return 1;`);
    await cdp.stuur('Page.navigate', { url: `${BASIS}/?rooktest=${Date.now()}` });
    await wachtTot(`document.querySelector('#view-home') && !document.querySelector('#view-home').hidden`, 20);
    return await js(`return 'versie ' + APP_VERSION;`);
  });

  await stap('organisator logt in', async () => {
    await js(`document.querySelector('.rolknop[data-rol=org]').click(); return 1;`, 300);
    await js(`document.querySelector('#org-ww').value = ${JSON.stringify(ORGWW)};
              document.querySelector('#form-orglogin').requestSubmit(); return 1;`);
    await wachtTot(`!document.querySelector('#view-org').hidden`, 20);
    return 'organisatieomgeving open';
  });

  await stap('wedstrijd aanmaken die nu loopt', async () => {
    const start = tijdVeld(new Date(Date.now() - 20 * 60000));
    const eind = tijdVeld(new Date(Date.now() + 3 * 3600000));
    await js(`if (typeof toonOrgVak === 'function') toonOrgVak('nieuw'); return 1;`, 300);
    await js(`document.querySelector('#nw-naam').value = ${JSON.stringify(naam)};
              document.querySelector('#nw-start').value = ${JSON.stringify(start)};
              document.querySelector('#nw-eind').value = ${JSON.stringify(eind)};
              document.querySelector('#nw-max').value = '';
              document.querySelector('#form-nieuw').requestSubmit(); return 1;`);
    await wachtTot(`!document.querySelector('#deel-nieuw').hidden`, 25);
    const codes = await js(`return { code: document.querySelector('#dn-code').textContent.trim(),
                                     kijk: (document.querySelector('#dn-kijk') || {}).textContent }`);
    CODE = codes.code;
    KIJK = (codes.kijk || '').trim() || null;
    if (!/^[A-Z0-9]{4,8}$/.test(CODE)) throw new Error('geen bruikbare wedstrijdcode: ' + CODE);
    return `code ${CODE}${KIJK ? ', kijkcode ' + KIJK : ''}`;
  });

  await stap('deelnemer meldt zich aan en ziet zijn code', async () => {
    await js(`document.querySelector('#deel-nieuw .sluit, #deel-nieuw [data-sluit]')?.click();
              sessionStorage.clear(); localStorage.clear();
              location.hash = '#/w/' + ${JSON.stringify(CODE)}; return 1;`);
    await cdp.stuur('Page.navigate', { url: `${BASIS}/#/w/${CODE}` });
    await wachtTot(`document.querySelector('#join-naam')`, 20);
    await js(`document.querySelector('#join-naam').value = 'Rooktester';
              document.querySelector('#form-join').requestSubmit(); return 1;`);
    await wachtTot(`document.querySelector('#team-code') && document.querySelector('#team-code').textContent.trim().length >= 4`, 25);
    return 'persoonlijke code zichtbaar';
  });

  await stap('sessie-herstel: na herladen nog in de wedstrijd', async () => {
    await cdp.stuur('Page.navigate', { url: `${BASIS}/#/w/${CODE}` });
    await slaap(4000);
    const uit = await js(`return { hash: location.hash, team: !!localStorage.getItem('team:' + ${JSON.stringify(CODE)}),
                                   naam: (document.querySelector('#team-naam')||{}).textContent || '' }`);
    if (!uit.team) throw new Error('teamtoken weg na herladen');
    if (!uit.hash.includes(CODE)) throw new Error('niet meer in de wedstrijd: ' + uit.hash);
    return 'token bewaard';
  });

  await stap('vangst registreren met foto', async () => {
    await js(`activateTab('team'); return 1;`, 500);
    await wachtTot(`document.querySelector('#v-gewicht')`, 15);
    const doc = await cdp.stuur('DOM.getDocument', {});
    const node = await cdp.stuur('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#v-foto' });
    if (!node.nodeId) throw new Error('fotoveld niet gevonden');
    await cdp.stuur('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [FOTO] });
    await js(`document.querySelector('#v-foto').dispatchEvent(new Event('change', { bubbles: true }));
              document.querySelector('#v-gewicht').value = '4,20'; return 1;`, 500);
    await js(`document.querySelector('#form-vangst').requestSubmit(); return 1;`);
    try {
      await wachtTot(`(STATE && STATE.vangsten || []).some(v => v.gewicht_gram === 4200)`, 60);
    } catch (e) {
      const diag = await js(`return {
        fout: (document.querySelector('#v-fout')||{}).textContent || '',
        verborgen: (document.querySelector('#v-fout')||{}).hidden,
        wachtrij: (document.querySelector('#wachtrij')||{}).textContent?.slice(0,160) || '',
        foto: !!document.querySelector('#v-foto').files.length,
        gewicht: document.querySelector('#v-gewicht').value };`);
      throw new Error(e.message + ' | ' + JSON.stringify(diag));
    }
    return '4,20 kg staat in de state';
  });

  await stap('klassement toont de vangst', async () => {
    await js(`activateTab('klassement'); return 1;`, 800);
    await wachtTot(`/4,20/.test(document.querySelector('#klassement-inhoud').textContent)`, 20);
    return 'zichtbaar in het klassement';
  });

  await stap('kijker ziet klassement, kaart en vangsten', async () => {
    if (!KIJK) return 'overgeslagen: geen kijkcode uit het deelvenster';
    await cdp.stuur('Page.navigate', { url: `${BASIS}/#/k/${KIJK}` });
    await wachtTot(`typeof ROL !== 'undefined' && ROL === 'kijker' && STATE`, 25);
    const uit = await js(`
      const heeft = (n) => { activateTab(n); return !document.querySelector('#tab-' + n).hidden; };
      const k = heeft('klassement'), ka = heeft('kaart'), v = heeft('vangsten');
      return { k, ka, v, vangsten: (STATE.vangsten||[]).length };`);
    if (!uit.k || !uit.ka || !uit.v) throw new Error('kijker mist een tab: ' + JSON.stringify(uit));
    if (!uit.vangsten) throw new Error('kijker ziet geen vangsten');
    return `${uit.vangsten} vangst(en) zichtbaar`;
  });

  await stap('terugknop gaat naar het startscherm, niet naar een inlogscherm', async () => {
    await cdp.stuur('Page.navigate', { url: `${BASIS}/#/w/${CODE}` });
    await wachtTot(`STATE && !document.querySelector('#view-wedstrijd').hidden`, 25);
    await js(`document.querySelector('#btn-terug').click(); return 1;`, 800);
    const uit = await js(`return { home: !document.querySelector('#view-home').hidden,
                                   verder: !!document.querySelector('#verder-kaart') && !document.querySelector('#verder-kaart').hidden }`);
    if (!uit.home) throw new Error('niet op het startscherm beland');
    if (!uit.verder) throw new Error('de Verder-kaart ontbreekt, dan lijkt de visser uitgelogd');
    return 'Verder-kaart staat er';
  });
}

async function opruimen() {
  if (!CODE) return;
  try {
    await cdp.stuur('Page.navigate', { url: `${BASIS}/?op=${Date.now()}` });
    await slaap(3000);
    await js(`sessionStorage.setItem('orgww', ${JSON.stringify(ORGWW)}); location.hash = '#/org'; return 1;`);
    await slaap(4500);
    const weg = await js(`
      if (typeof toonOrgVak === 'function') toonOrgVak('actief');
      const knop = [...document.querySelectorAll('[data-org-verwijder]')]
        .find(b => b.dataset.orgVerwijder === ${JSON.stringify(CODE)});
      if (!knop) return 'knop niet gevonden';
      knop.click(); await new Promise(r => setTimeout(r, 400));
      knop.click();   // tweede tik bevestigt (tikNogmaals)
      return 'verwijderen aangevraagd';`);
    await slaap(3000);
    const nog = await js(`return (ORG_DATA?.wedstrijden || []).some(w => w.code === ${JSON.stringify(CODE)});`);
    console.log(`  opruimen: ${weg}${nog ? ' | LET OP: wedstrijd ' + CODE + ' staat er nog' : ' | wedstrijd weg'}`);
    stappen.push({ naam: 'wegwerpwedstrijd opgeruimd', ok: !nog, info: nog ? 'staat er nog: ' + CODE : CODE });
  } catch (e) {
    console.log('  opruimen mislukt:', e.message, '| verwijder', CODE, 'met de hand');
    stappen.push({ naam: 'wegwerpwedstrijd opgeruimd', ok: false, info: e.message + ' (code ' + CODE + ')' });
  }
}

let geslaagd = true;
try { await main(); } catch { geslaagd = false; }
await opruimen();

// ruis die niets zegt over de app: headless Chrome staat geen trilling toe zonder
// echte aanraking, en een gemiste favicon of versiecheck is geen storing
const RUIS = /favicon|version\.json|navigator\.vibrate/i;
const echteFouten = fouten.filter((f) => !RUIS.test(f));
const rood = !geslaagd || stappen.some((s) => !s.ok) || echteFouten.length > 0;
const datum = new Date().toISOString().slice(0, 16).replace('T', ' ');
const bestand = fileURLToPath(new URL(`../review/rooktest-${new Date().toISOString().slice(0, 10)}.md`, import.meta.url));
writeFileSync(bestand, `# Rooktest ${datum}

Omgeving: ${BASIS}
Uitslag: **${rood ? 'ROOD' : 'GROEN'}**

| Stap | Uitslag | Toelichting |
|---|---|---|
${stappen.map((s) => `| ${s.naam} | ${s.ok ? 'ok' : 'FOUT'} | ${s.info || ''} |`).join('\n')}

## Console- en netwerkfouten (${echteFouten.length})

${echteFouten.length ? echteFouten.map((f) => '- ' + f).join('\n') : 'geen'}
`);
console.log(`\n${rood ? 'ROOD' : 'GROEN'} | verslag: ${bestand}`);
process.exit(rood ? 1 : 0);

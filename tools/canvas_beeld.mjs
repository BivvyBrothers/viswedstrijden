// Haalt een deel-afbeelding (canvas) uit de LIVE app op en schrijft hem als PNG.
// Gebruikt voor docs/schermen/uitslag-gedeeld.png: dat is geen schermopname maar
// het beeld dat de app zelf tekent.
//
// Draaien (met dezelfde headless Chrome als mobiel_screenshot.mjs):
//   node tools/canvas_beeld.mjs <uit.png> <url> "<js die een canvas teruggeeft>"
// Voorbeeld:
//   node tools/canvas_beeld.mjs /tmp/uitslag.png "https://viswedstrijdapp.nl/demo/#/k/KIJKJE" \
//     "await wachtOpVoetLogo(); (await tekenUitslag()).toDataURL('image/png')"
import { writeFileSync } from 'node:fs';
const PORT = process.env.CDP_PORT || 9333;
const slaap = (ms) => new Promise((r) => setTimeout(r, ms));

async function nieuweTab() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  return (await r.json()).webSocketDebuggerUrl;
}
function verbind(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let id = 0; const wachters = new Map();
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && wachters.has(m.id)) { wachters.get(m.id)(m); wachters.delete(m.id); } };
    ws.onerror = rej;
    ws.onopen = () => res({
      stuur: (method, params = {}) => new Promise((ok) => { const mijn = ++id; wachters.set(mijn, (m) => ok(m.result ?? m)); ws.send(JSON.stringify({ id: mijn, method, params })); }),
      sluit: () => ws.close(),
    });
  });
}

const [uit, url, js, wacht] = process.argv.slice(2);
if (!uit || !url || !js) { console.error('gebruik: node tools/canvas_beeld.mjs <uit.png> <url> "<js>" [wacht-ms]'); process.exit(1); }

const cdp = await verbind(await nieuweTab());
await cdp.stuur('Page.enable');
await cdp.stuur('Page.navigate', { url });
await slaap(Number(wacht) || 7000);
const r = await cdp.stuur('Runtime.evaluate', {
  expression: `(async () => { ${js} })()`, awaitPromise: true, returnByValue: true,
});
const data = r?.result?.value;
if (typeof data !== 'string' || !data.startsWith('data:image')) {
  console.error('geen beeld terug:', JSON.stringify(r).slice(0, 300)); process.exit(1);
}
writeFileSync(uit, Buffer.from(data.split(',')[1], 'base64'));
console.log('geschreven:', uit);
cdp.sluit();

// Screenshots van de app in ECHTE telefoonverhouding (390x844 punten, 2x).
//
// Waarom niet gewoon `chrome --headless --screenshot --window-size=...`:
// zonder mobiele emulatie past Chrome de `<meta name="viewport">` niet toe.
// `width=device-width` wordt dan de breedte van het FYSIEKE scherm van deze Mac,
// niet die van het venster, dus de pagina wordt breed gerenderd en het beeld
// toont alleen de linkerkant: te grote tekst, halve tabbalk, afgekapte kolommen.
// Precies zo zijn de eerste mockups op de landingspagina ontstaan (860x1440,
// verhouding 1:1,67), en daardoor leken het tablets. Via CDP met
// Emulation.setDeviceMetricsOverride {mobile: true} klopt de layout wel.
//
// Gebruik:
//   1. chrome --headless --disable-gpu --hide-scrollbars \
//        --remote-debugging-port=9333 --user-data-dir=/tmp/shot-profiel about:blank &
//   2. node tools/mobiel_screenshot.mjs <uit.png> <url> ["js na laden"] [wacht-ms]
//
// Het derde argument draait in de pagina nadat die geladen is: tab kiezen,
// scrollen, of iets verbergen dat niet op een publieke site hoort (de
// wedstrijdcode in de topbar geeft toegang tot de deelnemerslijst, dus die
// wordt voor de landingspagina leeggemaakt: document.getElementById('topcode')).
// Deelnemercodes/teamtokens NOOIT in de repo of in commits zetten; haal ze uit
// de database op het moment dat je een opname maakt.
import { writeFileSync } from 'node:fs';

const PORT = process.env.CDP_PORT || 9333;
const W = 390, H = 844, DSF = 2;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const slaap = (ms) => new Promise((r) => setTimeout(r, ms));

async function nieuweTab() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  return (await r.json()).webSocketDebuggerUrl;
}

function verbind(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let id = 0;
    const wachters = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && wachters.has(m.id)) { wachters.get(m.id)(m); wachters.delete(m.id); }
    };
    ws.onerror = rej;
    ws.onopen = () => res({
      stuur: (method, params = {}) => new Promise((ok) => {
        const mijn = ++id;
        wachters.set(mijn, (m) => ok(m.result ?? m));
        ws.send(JSON.stringify({ id: mijn, method, params }));
      }),
      sluit: () => ws.close(),
    });
  });
}

const [uit, url, js, wacht] = process.argv.slice(2);
if (!uit || !url) {
  console.error('gebruik: node tools/mobiel_screenshot.mjs <uit.png> <url> ["js"] [wacht-ms]');
  process.exit(1);
}

const cdp = await verbind(await nieuweTab());
await cdp.stuur('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: DSF, mobile: true,
  screenWidth: W, screenHeight: H,
});
await cdp.stuur('Emulation.setUserAgentOverride', { userAgent: UA });
await cdp.stuur('Page.enable');
await cdp.stuur('Page.navigate', { url });
await slaap(Number(wacht) || 5000);   // de app pollt; even laten laden
if (js) {
  const r = await cdp.stuur('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
  console.log('js:', JSON.stringify(r.result?.value ?? r.exceptionDetails?.text ?? null));
  await slaap(2500);
}
const shot = await cdp.stuur('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(uit, Buffer.from(shot.data, 'base64'));
console.log('geschreven:', uit, `${W}x${H} @${DSF}x`);
cdp.sluit();
process.exit(0);

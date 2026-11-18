/* Service worker NPHV: web push + offline app-shell.
   Strategie: network-first met cache-fallback, dus altijd verse code als er
   internet is en een werkende app als het bereik aan het water wegvalt.
   Let op de paden: deze worker draait onder /nphv/; gedeelde assets staan op
   de root en MOETEN hier absoluut staan, tenant-bestanden relatief. */
const CACHE = 'nphv-shell-v1';
const SHELL = ['./', 'index.html', 'instructies.html', 'kaart.js', 'config.js', 'dieptekaart.jpg',
  'manifest.webmanifest',
  '/styles.css', '/app.js', '/icon-180.png', '/icon-192.png', '/icon-512.png', '/logo-rond-512.png',
  '/fonts/montserrat-latin.woff2', '/kemblinck-logo.png'];

self.addEventListener('install', (e) => {
  // per stuk cachen: één ontbrekende asset mag de rest van de shell niet blokkeren
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.allSettled(SHELL.map((pad) => c.add(pad)))));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  const sleutels = await caches.keys();
  await Promise.all(sleutels
    .filter((k) => k !== CACHE && (k.startsWith('nphv-shell') || k === 'shell'))
    .map((k) => caches.delete(k)));
  await self.clients.claim();
})()));

// Netwerk eerst, maar niet eindeloos: aan het water hangt een verzoek soms een halve
// minuut op één streepje bereik. Na NET_GEDULD_MS geven we wat er in de cache staat;
// het verse antwoord komt dan alsnog binnen en ligt klaar voor de volgende keer.
const NET_GEDULD_MS = 4000;
const OFFLINE_PAGINA = '<!doctype html><html lang="nl"><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<title>Geen verbinding</title><body style="font-family:sans-serif;padding:24px;background:#353d2a;color:#fff">'
  + '<h1>Geen verbinding</h1><p>De app kon niet geladen worden. Probeer het opnieuw zodra je weer bereik hebt.</p></body></html>';

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.url.includes('version.json')) return; // versiecheck altijd live, nooit uit cache
  // alleen de EIGEN tenantcache: caches.match zonder cache zoekt door alle caches
  // en kan zo een oudere gedeelde app.js van de andere tenant teruggeven
  const eigen = caches.open(CACHE);
  const uitCache = (wat) => eigen.then((c) => c.match(wat, { ignoreSearch: true }));
  const net = fetch(req);
  // bewaren hoort bij de levensduur van dit event, anders kan de browser de worker
  // stoppen voordat het antwoord in de cache staat
  e.waitUntil(net.then((r) => {
    if (!r.ok) return null;
    const kopie = r.clone();
    return eigen.then((c) => c.put(req, kopie));
  }).catch(() => {}));
  e.respondWith((async () => {
    let klok;
    const traag = new Promise((klaar) => { klok = setTimeout(() => klaar(null), NET_GEDULD_MS); });
    try {
      const r = await Promise.race([net, traag]);
      if (r && r.status < 500) return r;
      // netwerk hangt of de server geeft een storing: liever de bewaarde versie
      const bewaard = await uitCache(req);
      if (bewaard) return bewaard;
      return r || await net;
    } catch {
      const bewaard = await uitCache(req);
      if (bewaard) return bewaard;
      if (req.mode !== 'navigate') return Response.error();
      return (await uitCache('./')) || (await uitCache('index.html'))
        || new Response(OFFLINE_PAGINA, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } finally {
      clearTimeout(klok);
    }
  })());
});

// Alleen vensters van DEZE omgeving: alle omgevingen delen dezelfde origin, en een
// melding van de ene mag niet het tabblad van de andere (of de website) naar voren halen.
const vanDezeOmgeving = (c) => c.url.startsWith(self.registration.scope);

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    // alleen onderdrukken als DEZE wedstrijd zichtbaar in beeld staat
    // (dan volstaat de in-app toast); zonder route-info altijd tonen
    if (d.url) {
      const vensters = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (vensters.some((c) => vanDezeOmgeving(c) && c.visibilityState === 'visible' && c.url.includes(d.url))) return;
    }
    await self.registration.showNotification(d.title || 'Viswedstrijd', {
      body: d.body || 'Nieuwe vangst!',
      icon: '/logo-rond-512.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      tag: 'vangst',
      data: { url: d.url || null },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const route = e.notification.data && e.notification.data.url;
  e.waitUntil((async () => {
    const lijst = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(vanDezeOmgeving);
    // een venster dat al op deze wedstrijd staat gaat voor
    if (route) lijst.sort((a, b) => Number(b.url.includes(route)) - Number(a.url.includes(route)));
    for (const c of lijst) {
      // bestaand venster: eerst naar de juiste wedstrijd navigeren, dan focussen
      if (route && !c.url.includes(route) && 'navigate' in c) {
        try { await c.navigate('./' + route); } catch { /* navigatie geweigerd: alleen focus */ }
      }
      if ('focus' in c) return c.focus();
    }
    return self.clients.openWindow(route ? './' + route : '.');
  })());
});

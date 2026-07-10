/* Service worker NPHV: web push + offline app-shell.
   Strategie: network-first met cache-fallback, dus altijd verse code als er
   internet is en een werkende app als het bereik aan het water wegvalt.
   Let op de paden: deze worker draait onder /nphv/; gedeelde assets staan op
   de root en MOETEN hier absoluut staan, tenant-bestanden relatief. */
const CACHE = 'nphv-shell-v1';
const SHELL = ['./', 'index.html', 'instructies.html', 'kaart.js', 'config.js', 'manifest.webmanifest',
  '/styles.css', '/app.js', '/icon-180.png', '/icon-192.png', '/icon-512.png', '/kemblinck-logo.png'];

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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.url.includes('version.json')) return; // versiecheck altijd live, nooit uit cache
  e.respondWith(
    fetch(req).then((r) => {
      if (r.ok) {
        const kopie = r.clone();
        caches.open(CACHE).then((c) => c.put(req, kopie)).catch(() => {});
      }
      return r;
    }).catch(() =>
      caches.match(req, { ignoreSearch: true }).then((m) => m
        || (req.mode === 'navigate'
          ? caches.match('./').then((thuis) => thuis || caches.match('index.html'))
          : Response.error())))
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    // alleen onderdrukken als DEZE wedstrijd zichtbaar in beeld staat
    // (dan volstaat de in-app toast); zonder route-info altijd tonen
    if (d.url) {
      const vensters = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (vensters.some((c) => c.visibilityState === 'visible' && c.url.includes(d.url))) return;
    }
    await self.registration.showNotification(d.title || 'Viswedstrijd', {
      body: d.body || 'Nieuwe vangst!',
      icon: '/icon-192.png',
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
    const lijst = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
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

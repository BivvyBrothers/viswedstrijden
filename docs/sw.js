/* Service worker: web push + offline app-shell.
   Strategie: network-first met cache-fallback, dus altijd verse code als er
   internet is en een werkende app als het bereik aan het water wegvalt. */
const CACHE = 'shell';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'kaart.js', 'config.js',
  'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
        || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    // app zichtbaar in beeld: de in-app toast volstaat, geen dubbele melding
    const vensters = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (vensters.some((c) => c.visibilityState === 'visible')) return;
    await self.registration.showNotification(d.title || 'Viswedstrijd', {
      body: d.body || 'Nieuwe vangst!',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [100, 50, 100],
      tag: 'vangst',
      data: { url: d.url || null },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const route = e.notification.data && e.notification.data.url;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lijst) => {
    for (const c of lijst) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(route ? './' + route : '.');
  }));
});

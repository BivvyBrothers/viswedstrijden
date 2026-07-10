/* Oude service worker op de root-scope: ruimt zichzelf op.
   De app leeft per organisatie in een eigen map (bijv. /nphv/) met eigen worker. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  await self.registration.unregister();
  const sleutels = await caches.keys();
  await Promise.all(sleutels.map((k) => caches.delete(k)));
  const vensters = await self.clients.matchAll({ type: 'window' });
  vensters.forEach((c) => c.navigate(c.url));
})()));

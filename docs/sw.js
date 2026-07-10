/* Oude service worker op de root-scope: ruimt zichzelf op.
   De app leeft per organisatie in een eigen map (bijv. /nphv/) met eigen worker.
   Let op: Cache Storage is per origin; wis hier ALLEEN de oude root-cache en
   blijf van tenant-caches (nphv-shell-*) af. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  await self.registration.unregister();
  const sleutels = await caches.keys();
  await Promise.all(sleutels.filter((k) => k === 'shell').map((k) => caches.delete(k)));
  const vensters = await self.clients.matchAll({ type: 'window' });
  vensters.forEach((c) => c.navigate(c.url));
})()));

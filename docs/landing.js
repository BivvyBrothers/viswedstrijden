/* Keuzepagina: kale root-hashlinks (#/w/CODE of #/k/CODE) zijn LEGACY en horen
   bij NPHV (alle links van voor de multi-tenant-verbouwing). Nieuwe tenants
   delen ALTIJD links met tenantpad (viswedstrijdapp.nl/<slug>/#/...), dus deze
   redirect hoeft nooit tenant-bewust te worden; alleen de publieke demo-code
   krijgt een eigen mapping. Een teamtoken dat als ?t=... voor de hash staat
   verhuist mee de hash in (de vorm die app.js uitleest). */
'use strict';
function naarTenant() {
  // publieke demo-kijkcode: hoort in de demo-omgeving, niet in NPHV
  if (/^#\/k\/KIJKJE$/i.test(location.hash)) {
    location.replace('/demo/' + location.hash);
    return;
  }
  if (/^#\/(w|k)\//.test(location.hash) || location.hash === '#/org' || location.hash === '#/beheerder') {
    let hash = location.hash;
    const token = new URLSearchParams(location.search).get('t');
    if (token && /^#\/w\//.test(hash) && !/[?&]t=/.test(hash)) {
      hash += (hash.includes('?') ? '&' : '?') + 't=' + encodeURIComponent(token);
    }
    location.replace('/nphv/' + hash);
  }
}
naarTenant();
window.addEventListener('hashchange', naarTenant);

/* Keuzepagina: bestaande wedstrijd-links (#/w/CODE of #/k/CODE) horen bij de
   NPHV-omgeving (de enige organisatie tot nu toe) en gaan daar direct heen.
   Een teamtoken dat als ?t=... voor de hash staat verhuist mee de hash in
   (de vorm die app.js uitleest). */
'use strict';
function naarTenant() {
  if (/^#\/(w|k)\//.test(location.hash) || location.hash === '#/org') {
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

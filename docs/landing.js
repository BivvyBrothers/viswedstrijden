/* Keuzepagina: bestaande wedstrijd-links (#/w/CODE of #/k/CODE) horen bij de
   NPHV-omgeving (de enige organisatie tot nu toe) en gaan daar direct heen. */
'use strict';
function naarTenant() {
  if (/^#\/(w|k)\//.test(location.hash) || location.hash === '#/org') {
    location.replace('/nphv/' + location.hash);
  }
}
naarTenant();
window.addEventListener('hashchange', naarTenant);

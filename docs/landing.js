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

/* ---------- vormgeving (19 nov 2026) ----------
   Drie kleine dingen bovenop een pagina die ook zonder dit script werkt: het menu op een
   smal scherm, inhoud die rustig in beeld komt, en niets anders. Dit bestand laadt in de
   head, dus de klasse "js" staat er voordat de pagina getekend wordt; de rest wacht tot
   de pagina er is. Gaat er hier iets mis, dan haalt de vangregel de klasse weer weg en
   staat alles er gewoon. */
(function () {
  const wortel = document.documentElement;
  wortel.classList.add('js');
  function klaar() {
    try {
      const balk = document.querySelector('.topbar');
      const knop = document.querySelector('.menu-knop');
      const menu = document.getElementById('hoofdmenu');
      if (balk && knop && menu) {
        const sluit = () => { balk.classList.remove('open'); knop.setAttribute('aria-expanded', 'false'); };
        knop.addEventListener('click', () => {
          const open = balk.classList.toggle('open');
          knop.setAttribute('aria-expanded', String(open));
        });
        menu.addEventListener('click', (e) => { if (e.target.closest('a')) sluit(); });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && balk.classList.contains('open')) { sluit(); knop.focus(); }
        });
      }

      // In beeld komen: een eenvoudige scrollcontrole, die kan geen inhoud verborgen laten,
      // ook niet na een sprong naar een anker.
      let blokken = Array.from(document.querySelectorAll('[data-toon]'));
      let laatst = 0, wacht = null;
      const toon = () => {
        try {
          laatst = Date.now();
          const grens = window.innerHeight * 0.92;
          blokken = blokken.filter((el) => {
            if (el.getBoundingClientRect().top < grens) { el.classList.add('in'); return false; }
            return true;
          });
          if (!blokken.length) {
            window.removeEventListener('scroll', bijScroll);
            window.removeEventListener('resize', bijScroll);
          }
        } catch (e) {
          wortel.classList.remove('js');   // ook hier: bij een fout staat alles er gewoon
        }
      };
      const bijScroll = () => {
        if (Date.now() - laatst > 60) toon();
        clearTimeout(wacht);
        wacht = setTimeout(toon, 120);
      };
      window.addEventListener('scroll', bijScroll, { passive: true });
      window.addEventListener('resize', bijScroll);
      window.addEventListener('load', toon);
      toon();
    } catch (e) {
      wortel.classList.remove('js');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', klaar);
  else klaar();
})();

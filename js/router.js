/* =========================================================================
   router.js — minimal hash router (works on GitHub Pages, no server config).
   Routes:  #/                → home
            #/region/:id      → region catalog view
   ========================================================================= */
export function parseHash() {
  const h = (location.hash || '#/').replace(/^#/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'region' && parts[1]) return { name: 'region', id: decodeURIComponent(parts[1]) };
  return { name: 'home' };
}

export function createRouter(onRoute) {
  const fire = () => onRoute(parseHash());
  window.addEventListener('hashchange', fire);
  return { start: fire };
}

export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

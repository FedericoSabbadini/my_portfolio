/* =========================================================================
   router.js — minimal hash router (works on GitHub Pages, no server config).
   Routes:  #/                → home
            #/domain/:id      → domain graph view
            #/node/:id        → domain view focused on a node
   ========================================================================= */
export function parseHash() {
  const h = (location.hash || '#/').replace(/^#/, '');
  const parts = h.split('/').filter(Boolean);   // e.g. ['domain','ai']
  if (parts[0] === 'domain' && parts[1]) return { name: 'domain', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'node' && parts[1]) return { name: 'node', id: decodeURIComponent(parts[1]) };
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

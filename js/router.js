/* =========================================================================
   router.js — minimal hash router (works on GitHub Pages, no server config).
   Routes:  #/                    → home (the brain)
            #/region/:id          → region's knowledge tree
            #/region/:id/:nodeId  → tree focused on a node
   ========================================================================= */
export function parseHash() {
  const h = (location.hash || '#/').replace(/^#/, '');
  const parts = h.split('/').filter(Boolean);   // e.g. ['region','education','course:web']
  if (parts[0] === 'region' && parts[1]) {
    return { name: 'region', id: decodeURIComponent(parts[1]), node: parts[2] ? decodeURIComponent(parts[2]) : null };
  }
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

/* =========================================================================
   router.js — History API router (clean URLs, no hash).
   Routes:  /                → home
            /region/:id      → region catalog view
   The app is served from a directory (e.g. `/my_portfolio/` on GitHub Pages
   or `/` in local dev); all routes live under that base path. Deep links
   (page refresh / shared URLs on a `/region/:id` path) are served by the
   `404.html` fallback, which bounces back to the app shell and restores the
   clean URL before this module boots.
   ========================================================================= */

/* Directory the app is served from, always with leading + trailing slash.
   Detected at import time so helpers (homePath/regionPath) are correct even
   before the router starts; re-detected on start for safety. */
let base = detectBaseSafe();

function detectBase() {
  const p = window.location.pathname;
  // Inside a region path the base is everything before `/region/`.
  const m = p.match(/^(.*)\/region\/[^/]+\/?$/);
  if (m) return (m[1] || '') + '/';
  // Otherwise the current directory (handles both `/` and `/index.html`).
  return p.endsWith('/') ? p : p.slice(0, p.lastIndexOf('/') + 1);
}

function detectBaseSafe() {
  try {
    if (typeof window === 'undefined' || !window.location) return '/';
    return detectBase();
  } catch {
    return '/';
  }
}

/** Path (incl. base) of the home page. */
export function homePath() {
  return base;
}

/** Path (incl. base) of a region page. */
export function regionPath(id) {
  return base + 'region/' + encodeURIComponent(id);
}

/** Absolute URL of a path, for canonical / og:url tags. */
export function absoluteUrl(path) {
  return window.location.origin + path;
}

export function parsePath(pathname = window.location.pathname) {
  let rest = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  rest = rest.replace(/^\/+|\/+$/g, '');
  const parts = rest.split('/').filter(Boolean);
  if (parts[0] === 'region' && parts[1]) {
    return { name: 'region', id: decodeURIComponent(parts[1]) };
  }
  return { name: 'home' };
}

/** Current route for the live URL. */
export function currentRoute() {
  return parsePath();
}

export function createRouter(onRoute) {
  base = detectBase();
  let started = false;

  const fire = (isInitial = false) => onRoute(parsePath(), { initial: isInitial });

  // Back/forward buttons.
  window.addEventListener('popstate', () => fire(false));

  // Intercept same-origin clicks on in-app links so navigation stays
  // client-side (no reload), while hrefs remain real URLs for SEO,
  // right-click → copy link, and no-JS fallback.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    let url;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin || !url.pathname.startsWith(base)) return;
    e.preventDefault();
    go(url.pathname + url.search);
  });

  return {
    start: () => {
      if (started) return;
      started = true;
      fire(true);
    },
  };
}

/** Navigate to an in-app path (see homePath / regionPath). */
export function go(path) {
  const target = path.startsWith('/') ? path : base + path.replace(/^\/+/, '');
  if (window.location.pathname + window.location.search === target) {
    // Same URL (e.g. re-clicking a nav item): re-render without pushing.
    window.dispatchEvent(new PopStateEvent('popstate'));
  } else {
    window.history.pushState(null, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

/* =========================================================================
   main.js — bootstrap + orchestration.
   Loads content → mounts brain (6 regions) → wires sidebar/tour →
   handles region view rendering.
   ========================================================================= */
import { loadAll } from './data/store.js';
import { BrainScene, webglAvailable } from './brain/brain-scene.js';
import { BrainRegions } from './brain/brain-regions.js';
import { createRouter, go } from './router.js';
import { showRegion, showHome, hideBoot } from './ui/transitions.js';
import { renderRegion } from './ui/region-view.js';
import { initI18n, setLocale, getLocale, t, onLocaleChange, localize } from './i18n.js';

// Signals to the inline boot-watchdog in index.html that the ES module graph
// (three/gsap from the CDN) resolved and this script is executing. If the CDN
// is blocked/unreachable the module never runs, the flag stays false, and the
// watchdog swaps the boot loader for a static fallback instead of hanging.
window.__mindBooted = true;

const state = { view: 'home', scene: null, regions: null, data: null, domains: null };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tracks whether we've navigated within the app since load. Lets the "Back"
// button return to the actual previous page (history.back) when there is in-app
// history, and fall back to the mind when the region was the entry point (deep
// link) so Back can never leave the site.
let navigatedInApp = false;
window.addEventListener('hashchange', () => { navigatedInApp = true; });

boot();

async function boot() {
  let raw;
  try {
    raw = await loadAll();
  } catch (err) {
    console.error('[mind] failed to load content', err);
    document.getElementById('boot').innerHTML =
      '<p style="color:#7A8699;font-family:monospace">Could not load content data.</p>';
    return;
  }
  state.data = raw;
  state.domains = raw.domains;

  // Initialize i18n
  await initI18n();
  applyStaticTranslations();
  wireLanguageSwitcher();
  onLocaleChange(() => {
    applyStaticTranslations();
    // Re-render current view with new locale
    if (state.view === 'region') {
      const hash = location.hash;
      const match = hash.match(/^#\/region\/(.+)$/);
      if (match) renderRegion(match[1], state.data, state.domains);
    } else {
      // Update home view texts + region nav with the new locale
      updateHomeView();
      if (state.regions) state.regions.rebuildNav();
    }
    // Update document title
    updateDocumentTitle();
  });

  const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
  // Shares the 1024 breakpoint with brain.css + brain-scene._syncMode so the
  // lighter shader/geometry path matches the full-bleed tablet layout exactly.
  const mobile = vw > 0 && vw <= 1024;
  const canBrain = webglAvailable();

  if (canBrain) {
    try {
      state.scene = new BrainScene(document.getElementById('brain-canvas'), {
        domains: state.domains, reducedMotion: reducedMotion, mobile,
      });
      state.regions = new BrainRegions(state.scene, state.domains, { onDive });
      state.scene.start();
    } catch (err) {
      console.warn('[mind] WebGL init failed', err);
      state.scene = null;
    }
  }

  wireChrome();
  window.__mind = state;                 // debug handle (dev only)
  createRouter(route).start();

  requestAnimationFrame(() => setTimeout(hideBoot, state.scene ? 500 : 0));

  maybeAutoTour();
}

function applyStaticTranslations() {
  // Elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  // Elements with data-i18n-aria-label attribute
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    el.setAttribute('aria-label', t(key));
  });
  // Elements with data-i18n-title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.setAttribute('title', t(key));
  });
}

function updateHomeView() {
  // Update home intro
  const homeIntro = document.getElementById('home-intro');
  if (homeIntro) homeIntro.textContent = t('home.intro');
  
  // Update home lead
  const leadKicker = document.querySelector('.home-lead__kicker');
  if (leadKicker) leadKicker.textContent = t('home.leadKicker');
  const leadTitle = document.querySelector('.home-lead__title');
  if (leadTitle) leadTitle.textContent = t('home.leadTitle');
  const leadSub = document.querySelector('.home-lead__sub');
  if (leadSub) leadSub.textContent = t('home.leadSub');
  
  // Update home kicker
  const homeKicker = document.getElementById('home-kicker');
  if (homeKicker) homeKicker.textContent = t('home.kicker');
  
  // Update callout kicker
  const calloutKicker = document.getElementById('callout-kicker');
  if (calloutKicker) calloutKicker.textContent = t('home.calloutKicker');
}

function updateDocumentTitle() {
  if (state.view === 'region') {
    const domain = state.domains.find(d => d.id === location.hash.replace('#/region/', ''));
    if (domain) {
      document.title = `${localize(domain, 'label')} — Federico Sabbadini`;
    }
  } else {
    document.title = t('seo.siteTitle');
  }
}

function wireLanguageSwitcher() {
  const switcher = document.getElementById('lang-switcher');
  if (!switcher) return;

  switcher.addEventListener('click', async (e) => {
    const btn = e.target.closest('.lang-btn');
    if (!btn) return;
    const lang = btn.dataset.lang;
    if (lang === getLocale()) return;

    // Update button states
    switcher.querySelectorAll('.lang-btn').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.lang === lang);
    });

    await setLocale(lang);
  });

  // Set initial active state
  const currentLang = getLocale();
  switcher.querySelectorAll('.lang-btn').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.lang === currentLang);
  });
}

/* Play one automatic guided-tour lap when the portfolio opens on the home view.
   Respect reduced-motion preferences and let the user control later tours. */
function maybeAutoTour() {
  if (!state.regions || reducedMotion) return;
  const onHome = !location.hash || location.hash === '#' || location.hash === '#/';
  if (!onHome) return;
  setTimeout(() => {
    if (state.view === 'home' && state.regions) state.regions.autoTour();
  }, 1600);
}

/* ---- dive: play the brain zoom, then navigate to the region ------------- */
function onDive(id) {
  // reduced-motion users skip the cinematic zoom and go straight there
  if (state.scene && !reducedMotion) {
    const dom = state.domains.find((d) => d.id === id);
    state.scene.setInteractive(false);
    state.scene.zoomTo(id);                    // ~1.15s cinematic plunge
    // the accent bloom peaks late so it veils the brain→catalog swap
    setTimeout(() => playDiveFlash(dom ? dom.accent : '#22d3ee'), 520);
    setTimeout(() => go(`#/region/${id}`), 1000);
  } else {
    go(`#/region/${id}`);
  }
}

/* accent bloom that peaks as the brain fades and the region view rises */
function playDiveFlash(accent) {
  const el = document.getElementById('dive-flash');
  if (!el || reducedMotion) return;
  el.style.setProperty('--flash', accent);
  el.classList.remove('is-firing');
  void el.offsetWidth;                     // restart the animation
  el.classList.add('is-firing');
  setTimeout(() => el.classList.remove('is-firing'), 760);
}

/* ---- routing ------------------------------------------------------------ */
function route(r) {
  if (r.name === 'region') return enterRegion(r.id);
  return enterHome();
}

async function enterRegion(id) {
  const domain = state.domains.find((d) => d.id === id);
  if (!domain) return go('#/');

  if (state.regions) state.regions.stopTour();

  renderRegion(id, state.data, state.domains);
  await showRegion();
  if (state.scene) state.scene.stop();   // pause the loop while the catalog is up
  state.view = 'region';
  updateDocumentTitle();
  // move keyboard/SR focus to the new page's heading
  const h = document.getElementById('hero-title');
  if (h) h.focus({ preventScroll: true });
}

async function enterHome() {
  const fromRegion = state.view === 'region';
  if (fromRegion) await showHome();

  if (state.scene) {
    // the canvas was 0×0 while the region view was up. Force a reflow so it has
    // real dimensions again, then resize the renderer + camera BEFORE the loop
    // renders a single frame — otherwise the first frames stretch the old buffer
    // into the new box and the brain flashes up squashed.
    const cv = document.getElementById('brain-canvas');
    void cv.offsetWidth;
    state.scene.resize();
    state.scene.reset();
    state.scene.setInteractive(true);
    state.scene.start();
  }
  if (state.regions) state.regions.resume();
  // return keyboard focus to a sensible anchor when arriving back from a region
  if (fromRegion) {
    const t = document.getElementById('tour-btn');
    if (t) t.focus({ preventScroll: true });
  }
  state.view = 'home';
  updateDocumentTitle();
}

/* ---- chrome ------------------------------------------------------------- */
function wireChrome() {
  // "Back" → the previous page (region → region, or region → mind). Falls back to
  // the mind when there's no in-app history to step back to (direct deep link).
  document.getElementById('back-to-mind').addEventListener('click', (e) => {
    e.preventDefault();
    if (navigatedInApp && window.history.length > 1) window.history.back();
    else go('#/');
  });
  const headerHome = document.getElementById('header-home');
  if (headerHome) {
    headerHome.addEventListener('click', (e) => {
      e.preventDefault();
      go('#/');
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.view === 'region') go('#/');
  });
}

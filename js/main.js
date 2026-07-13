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

const state = { view: 'home', scene: null, regions: null, data: null, domains: null };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
  const mobile = (vw > 0 && vw <= 820) || (('ontouchstart' in window) && vw <= 1024);
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
  createRouter(route).start();

  requestAnimationFrame(() => setTimeout(hideBoot, state.scene ? 500 : 0));

  maybeAutoTour();
}

/* On the very first visit, play one automatic guided-tour lap so newcomers see
   what the six regions are. Runs once (localStorage), only when landing on the
   home view, and never for reduced-motion users. */
function maybeAutoTour() {
  if (!state.regions || reducedMotion) return;
  const onHome = !location.hash || location.hash === '#' || location.hash === '#/';
  if (!onHome) return;
  let seen = false;
  try { seen = localStorage.getItem('mind_tour_seen') === '1'; } catch (e) {}
  if (seen) return;
  try { localStorage.setItem('mind_tour_seen', '1'); } catch (e) {}
  setTimeout(() => {
    if (state.view === 'home' && state.regions) state.regions.autoTour();
  }, 1600);
}

/* ---- dive: play the brain zoom, then navigate to the region ------------- */
function onDive(id) {
  // reduced-motion users skip the cinematic zoom and go straight there
  if (state.scene && !reducedMotion) {
    const dom = state.domains.find((d) => d.id === id);
    playDiveFlash(dom ? dom.accent : '#22d3ee');
    state.scene.setInteractive(false);
    state.scene.zoomTo(id);
    setTimeout(() => go(`#/region/${id}`), 700);
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
  document.title = `${domain.label} — Federico Sabbadini`;
  // move keyboard/SR focus to the new page's heading
  const h = document.getElementById('hero-title');
  if (h) h.focus({ preventScroll: true });
}

async function enterHome() {
  const fromRegion = state.view === 'region';
  if (fromRegion) await showHome();

  if (state.scene) {
    state.scene.start();
    state.scene.setInteractive(true);
    // the canvas was 0×0 while the region view was up; re-measure now that it's
    // visible again before easing the camera back, so the brain never shows up
    // squashed. Double-rAF ensures the layout has flushed after hidden→visible.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        state.scene.resize();
        state.scene.reset();
      });
    });
  }
  if (state.regions) state.regions.resume();
  // return keyboard focus to a sensible anchor when arriving back from a region
  if (fromRegion) {
    const t = document.getElementById('tour-btn');
    if (t) t.focus({ preventScroll: true });
  }
  state.view = 'home';
  document.title = 'Federico Sabbadini — Digital Mind';
}

/* ---- chrome ------------------------------------------------------------- */
function wireChrome() {
  document.getElementById('back-to-mind').addEventListener('click', (e) => {
    e.preventDefault();
    go('#/');
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

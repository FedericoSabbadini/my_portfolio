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

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
  const mobile = (vw > 0 && vw <= 820) || (('ontouchstart' in window) && vw <= 1024);
  const canBrain = webglAvailable();

  if (canBrain) {
    try {
      state.scene = new BrainScene(document.getElementById('brain-canvas'), {
        domains: state.domains, reducedMotion: reduced, mobile,
      });
      state.regions = new BrainRegions(state.scene, state.domains);
      state.scene.start();
    } catch (err) {
      console.warn('[mind] WebGL init failed', err);
      state.scene = null;
    }
  }

  wireChrome();
  createRouter(route).start();

  requestAnimationFrame(() => setTimeout(hideBoot, state.scene ? 500 : 0));
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
  if (state.scene) state.scene.stop();

  renderRegion(id, state.data, state.domains);
  await showRegion();
  state.view = 'region';
  document.title = `${domain.label} — Federico Sabbadini`;
}

async function enterHome() {
  const fromRegion = state.view === 'region';
  if (fromRegion) await showHome();

  if (state.scene) {
    state.scene.start();
    state.scene.setInteractive(true);
    if (fromRegion) state.scene.reset();
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
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.view === 'region') go('#/');
  });
}

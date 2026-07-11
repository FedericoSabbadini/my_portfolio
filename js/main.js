/* =========================================================================
   main.js — bootstrap + orchestration.
   Loads content → builds the knowledge TREE → mounts the brain (or the
   accessible/guided region index) → wires the router and cinematic
   transitions between the brain (home) and a region's knowledge tree.
   ========================================================================= */
import { loadAll } from './data/store.js';
import { buildTree, getRegionStats } from './data/build-tree.js';
import { BrainScene, webglAvailable } from './brain/brain-scene.js';
import { BrainRegions } from './brain/brain-regions.js';
import { TreeView } from './graph/tree-view.js';
import { createRouter, go } from './router.js';
import { revealSection, hideSection, showHomeOverlay, hideBoot } from './ui/transitions.js';

const state = { view: 'home', scene: null, brainRegions: null, treeView: null, tree: null, regions: null };

boot();

async function boot() {
  let raw, tree;
  try {
    raw = await loadAll();
    tree = buildTree(raw);
  } catch (err) {
    console.error('[mind] failed to load content', err);
    document.getElementById('boot').innerHTML =
      '<p style="color:#7A8699;font-family:monospace">Could not load content data.</p>';
    return;
  }
  state.tree = tree;
  state.regions = raw.regions;
  console.info(`[mind] ${tree.nodes.length} nodes across ${tree.regions.length} regions`);

  renderRegionIndex(raw.regions, tree);
  renderRegionRail(raw.regions);
  addSkipLink();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
  const mobile = (vw > 0 && vw <= 820) || (('ontouchstart' in window) && vw <= 1024);
  state.mobile = mobile;
  const canBrain = webglAvailable();

  state.treeView = new TreeView(tree, { reducedMotion: reduced, mobile, onExit: () => go('#/') });

  // On touch/small screens we lead with guided navigation, not free hover.
  if (mobile) document.body.classList.add('is-mobile');

  if (canBrain) {
    try {
      state.scene = new BrainScene(document.getElementById('brain-canvas'), {
        regions: raw.regions, reducedMotion: reduced, mobile,
      });
      state.brainRegions = new BrainRegions(state.scene, raw.regions, tree, {
        onEnter: (id) => go(`#/region/${id}`),
      });
      state.scene.start();
    } catch (err) {
      console.warn('[mind] WebGL init failed, using accessible index', err);
      state.scene = null;
      document.body.classList.add('show-index');
    }
  } else {
    document.body.classList.add('show-index');
  }

  wireChrome();
  createRouter(route).start();

  const scheduleHide = () => setTimeout(hideBoot, state.scene ? 500 : 0);
  requestAnimationFrame(scheduleHide);
  setTimeout(scheduleHide, 2600);
}

/* ---- routing ------------------------------------------------------------ */
async function route(r) {
  if (r.name === 'region' && state.tree.byId.has(`region:${r.id}`)) return enterRegion(r.id, r.node);
  return enterHome();
}

async function enterRegion(id, nodeId) {
  const cameFromHome = state.view === 'home';
  if (state.scene && cameFromHome) {
    state.scene.setInteractive(false);
    state.scene.zoomTo(id);          // fire the dive; never await (must not block nav)
    await delay(760);
  }
  await revealSection();
  state.treeView.open(id, nodeId);
  state.treeView.resume();
  if (state.scene) state.scene.stop();
  state.view = 'section';
  const region = state.regions.find((d) => d.id === id);
  document.title = `${region ? region.label : 'Mind'} — Federico Sabbadini`;
}

async function enterHome() {
  const fromSection = state.view === 'section';
  if (fromSection) await hideSection();
  state.treeView.pause();
  showHomeOverlay();
  if (state.scene) {
    state.scene.start();
    state.scene.setInteractive(true);
    if (fromSection) state.scene.reset();
  }
  state.view = 'home';
  document.title = 'Federico Sabbadini — Digital Mind';
}

/* ---- chrome ------------------------------------------------------------- */
function wireChrome() {
  document.getElementById('back-to-mind')?.addEventListener('click', () => go('#/'));
  document.getElementById('brain-home')?.addEventListener('click', () => go('#/'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.view === 'section') {
      if (!state.treeView.handleEscape()) go('#/');
    }
  });
  window.addEventListener('resize', () => { if (state.view === 'section') state.treeView.refit(); });
}

/* ---- accessible / guided region index (fallback + mobile) --------------- */
function renderRegionIndex(regions, tree) {
  const list = document.getElementById('mind-index-list');
  if (!list) return;
  list.innerHTML = regions.map((d) => {
    const s = getRegionStats(tree, d.id);
    return `
      <li>
        <a class="mind-card" href="#/region/${d.id}" style="--mc:${d.accent}">
          <span class="mind-card__kicker">${escapeHtml(d.lobe)}</span>
          <span class="mind-card__title">${escapeHtml(d.label)}</span>
          <span class="mind-card__desc">${escapeHtml(d.blurb)}</span>
          <span class="mind-card__meta">${s.items} item${s.items === 1 ? '' : 's'} <span aria-hidden="true">→</span></span>
        </a>
      </li>`;
  }).join('');
}

function renderRegionRail(regions) {
  const rail = document.getElementById('region-rail');
  if (!rail) return;
  rail.innerHTML = regions.map((d) => `
    <a class="region-rail__item" href="#/region/${d.id}" style="--rc:${d.accent}">
      <span class="region-rail__dot"></span>${escapeHtml(d.label)}
    </a>`).join('');
}

function addSkipLink() {
  const a = document.createElement('button');
  a.className = 'sr-only';
  a.textContent = 'Browse knowledge regions as a list';
  a.style.cssText = 'position:fixed;top:8px;left:8px;z-index:60;';
  a.addEventListener('focus', () => { a.classList.remove('sr-only'); a.classList.add('link-btn'); });
  a.addEventListener('blur', () => { a.classList.add('sr-only'); a.classList.remove('link-btn'); });
  a.addEventListener('click', () => document.body.classList.add('show-index'));
  document.body.prepend(a);
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* =========================================================================
   main.js — bootstrap + orchestration.
   Loads content → builds the knowledge graph → mounts the brain (or the
   accessible fallback) → wires the router and cinematic view transitions.
   ========================================================================= */
import { loadAll } from './data/store.js';
import { buildGraph } from './data/build-graph.js';
import { BrainScene, webglAvailable } from './brain/brain-scene.js';
import { BrainRegions } from './brain/brain-regions.js';
import { GraphView } from './graph/graph-view.js';
import { createRouter, parseHash, go } from './router.js';
import { revealSection, hideSection, showHomeOverlay, hideBoot } from './ui/transitions.js';

const state = { view: 'home', scene: null, regions: null, graphView: null, graph: null };

boot();

async function boot() {
  let raw, graph;
  try {
    raw = await loadAll();
    graph = buildGraph(raw);
  } catch (err) {
    console.error('[mind] failed to load content', err);
    document.getElementById('boot').innerHTML =
      '<p style="color:#7A8699;font-family:monospace">Could not load content data.</p>';
    return;
  }
  state.graph = graph;
  console.info(`[mind] ${graph.nodes.length} nodes · ${graph.links.length} links across ${graph.domains.length} domains`);

  renderMindIndex(graph.domains);
  addSkipLink();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // guard against transient 0-width layouts (e.g. embedded preview frames)
  // wrongly triggering the low-detail mobile path.
  const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
  const mobile = (vw > 0 && vw <= 820) || (('ontouchstart' in window) && vw <= 1024);
  const canBrain = webglAvailable();

  state.graphView = new GraphView(graph, { reducedMotion: reduced });
  window.__mind = state;   // debug handle (dev only)

  if (canBrain) {
    try {
      state.scene = new BrainScene(document.getElementById('brain-canvas'), {
        domains: graph.domains, reducedMotion: reduced, mobile,
      });
      state.regions = new BrainRegions(state.scene, graph.domains, {
        onEnter: (id) => go(`#/domain/${id}`),
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

  // hide boot after first frames settle
  requestAnimationFrame(() => setTimeout(hideBoot, state.scene ? 500 : 0));
}

/* ---- routing ------------------------------------------------------------ */
async function route(r) {
  if (r.name === 'domain') return enterDomain(r.id);
  if (r.name === 'node') {
    const node = state.graph.byId.get(r.id);
    const dom = node && node.domains.find((d) => state.graph.domains.some((x) => x.id === d));
    if (dom) return enterDomain(dom, { selectNode: r.id });
    return enterHome();
  }
  return enterHome();
}

async function enterDomain(id, opts = {}) {
  const domain = state.graph.domains.find((d) => d.id === id);
  if (!domain) return go('#/');

  const cameFromHome = state.view === 'home';
  if (state.scene && cameFromHome) {
    state.scene.setInteractive(false);
    state.scene.zoomTo(id);          // fire the dive; never await animation (must not block nav)
    await delay(820);
  }
  await revealSection();
  state.graphView.open(id);
  state.graphView.resume();
  if (opts.selectNode) requestAnimationFrame(() => state.graphView.selectNode(opts.selectNode));
  if (state.scene) state.scene.stop();
  state.view = 'section';
  document.title = `${domain.label} — Federico Sabbadini`;
}

async function enterHome() {
  const fromSection = state.view === 'section';
  if (fromSection) await hideSection();
  state.graphView.pause();          // stop the graph loop while exploring the brain
  showHomeOverlay();
  if (state.scene) {
    state.scene.start();
    state.scene.setInteractive(true);
    if (fromSection) state.scene.reset();   // only re-fade when coming back from a dive
  }
  state.view = 'home';
  document.title = 'Federico Sabbadini — Digital Mind';
}

/* ---- chrome ------------------------------------------------------------- */
function wireChrome() {
  document.getElementById('back-to-mind').addEventListener('click', () => go('#/'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.view === 'section') go('#/');
  });
  window.addEventListener('resize', () => { if (state.view === 'section') state.graphView.refit(); });
}

/* ---- accessible index (fallback + keyboard) ----------------------------- */
function renderMindIndex(domains) {
  const list = document.getElementById('mind-index-list');
  list.innerHTML = domains.map((d) => `
    <li>
      <a class="mind-card" href="#/domain/${d.id}" style="--mc:${d.accent}">
        <span class="mind-card__kicker">${escapeHtml(d.region)}</span>
        <span class="mind-card__title">${escapeHtml(d.label)}</span>
        <span class="mind-card__desc">${escapeHtml(d.short)}</span>
        <span class="mind-card__meta">Enter domain →</span>
      </a>
    </li>`).join('');
}

function addSkipLink() {
  const a = document.createElement('button');
  a.className = 'sr-only';
  a.textContent = 'Browse knowledge domains as a list';
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

/* =========================================================================
   brain-regions.js — the brain IS the navigation.
   Seven high-level regions are painted on the cortex (shader) and labelled
   with small persistent chips (here). Hover/focus a region → its zone lights
   up, the others dim, and the chip expands into a recruiter card (blurb +
   item count + key threads). Click/Enter → dive into that region's tree.
   ========================================================================= */
import { getRegionStats } from '../data/build-tree.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class BrainRegions {
  constructor(scene, regions, tree, { onEnter } = {}) {
    this.scene = scene;
    this.regions = regions;
    this.tree = tree;
    this.byId = new Map(regions.map((d) => [d.id, d]));
    this.onEnter = onEnter || (() => {});
    this.canvas = scene.canvas;
    this.hovered = null;
    this.host = document.getElementById('region-labels');
    this.labels = new Map();

    this._buildLabels();
    this._bind();
    scene.onFrame(() => this._follow());
  }

  _buildLabels() {
    if (!this.host) return;
    this.host.innerHTML = '';
    for (const d of this.regions) {
      const s = getRegionStats(this.tree, d.id);
      const tech = s.tech.slice(0, 3).join(' · ');
      const el = document.createElement('button');
      el.className = 'rlabel';
      el.type = 'button';
      el.style.setProperty('--rc', d.accent);
      el.setAttribute('aria-label', `${d.label}: ${d.blurb}. ${s.items} items. Enter region.`);
      el.innerHTML = `
        <span class="rlabel__dot"></span>
        <span class="rlabel__body">
          <span class="rlabel__kicker">${esc(d.lobe)}</span>
          <span class="rlabel__title">${esc(d.label)}</span>
          <span class="rlabel__card">
            <span class="rlabel__blurb">${esc(d.blurb)}</span>
            <span class="rlabel__meta"><b>${s.items}</b> item${s.items === 1 ? '' : 's'}${tech ? ` · ${esc(tech)}` : ''}</span>
            <span class="rlabel__cta">Enter →</span>
          </span>
        </span>`;
      el.addEventListener('pointerenter', () => this._setHover(d.id));
      el.addEventListener('focus', () => this._setHover(d.id));
      el.addEventListener('pointerleave', () => { if (!this._overCanvas) this._setHover(null); });
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onEnter(d.id); });
      this.host.appendChild(el);
      this.labels.set(d.id, el);
    }
  }

  _bind() {
    const c = this.canvas;
    this._move = (e) => {
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      this._overCanvas = true;
      this.scene.setPointer((mx / rect.width) * 2 - 1, -((my / rect.height) * 2 - 1));
      this._pick(mx, my, rect);
    };
    this._leave = () => { this._overCanvas = false; this.scene.setPointer(0, 0); this._setHover(null); };
    this._click = () => { if (this.hovered) this.onEnter(this.hovered); };
    c.addEventListener('pointermove', this._move);
    c.addEventListener('pointerleave', this._leave);
    c.addEventListener('click', this._click);
  }

  _pick(mx, my, rect) {
    const threshold = Math.min(rect.width, rect.height) * 0.16;
    let best = null, bestD = threshold;
    for (const d of this.regions) {
      const p = this.scene.projectRegion(d.id);
      if (!p || !p.visible) continue;
      const dist = Math.hypot(p.x - mx, p.y - my);
      if (dist < bestD) { bestD = dist; best = d.id; }
    }
    this._setHover(best);
  }

  _setHover(id) {
    if (id === this.hovered) return;
    this.hovered = id;
    this.scene.setActiveRegion(id);
    this.canvas.classList.toggle('is-region', !!id);
    for (const [rid, el] of this.labels) {
      el.classList.toggle('is-active', rid === id);
      el.classList.toggle('is-dim', !!id && rid !== id);
    }
  }

  /** keep the labels pinned to their (rotating) anchors; hide back-facing ones */
  _follow() {
    if (!this.labels.size) return;
    for (const d of this.regions) {
      const el = this.labels.get(d.id);
      const p = this.scene.projectRegion(d.id);
      if (!p || !p.visible) { el.classList.add('is-hidden'); continue; }
      el.classList.remove('is-hidden');
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      // gentle depth cue, but keep labels comfortably legible
      el.style.setProperty('--depth', (1 - Math.min(Math.max(p.depth, 0), 1) * 0.18).toFixed(2));
    }
  }

  destroy() {
    const c = this.canvas;
    c.removeEventListener('pointermove', this._move);
    c.removeEventListener('pointerleave', this._leave);
    c.removeEventListener('click', this._click);
  }
}

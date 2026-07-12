/* =========================================================================
   brain-regions.js — sidebar nav, tour auto-rotation, callout positioning,
   and click → region catalog navigation.
   ========================================================================= */
import { go } from '../router.js';

export class BrainRegions {
  constructor(scene, domains, { onHover } = {}) {
    this.scene = scene;
    this.domains = domains;
    this.byId = new Map(domains.map((d) => [d.id, d]));
    this.canvas = scene.canvas;
    this.hovered = null;
    this._touring = false;
    this._tourTimer = null;
    this._tourIdx = 0;
    this._onHover = onHover || (() => {});

    // DOM refs
    this._nav = document.getElementById('region-nav');
    this._tourBtn = document.getElementById('tour-btn');
    this._tourLabel = document.getElementById('tour-label');
    this._tourIcon = document.getElementById('tour-icon');
    this._callout = document.getElementById('callout');
    this._calloutDot = document.getElementById('callout-dot');
    this._calloutKicker = document.getElementById('callout-kicker');
    this._calloutTitle = document.getElementById('callout-title');
    this._calloutDesc = document.getElementById('callout-desc');
    this._marker = document.getElementById('callout-marker');

    this._buildNav();
    this._bindTour();
    this._bindPointer();
    scene.onFrame(() => this._followMarker());
  }

  /* --- Sidebar nav --- */
  _buildNav() {
    this._nav.innerHTML = this.domains.map((d) => `
      <button class="region-nav__item" data-region="${d.id}" style="--item-accent:${d.accent}" type="button" aria-label="Explore ${d.label}">
        <span class="region-nav__dot"></span>
        <span class="region-nav__label">${d.label}</span>
        <span class="region-nav__lobe">${d.region}</span>
      </button>`).join('');

    this._nav.addEventListener('pointerenter', (e) => {
      const btn = e.target.closest('[data-region]');
      if (btn) this._focus(btn.dataset.region);
    }, true);
    this._nav.addEventListener('pointerleave', (e) => {
      const btn = e.target.closest('[data-region]');
      if (btn) this._unfocus();
    }, true);
    this._nav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-region]');
      if (btn) go(`#/region/${btn.dataset.region}`);
    });
  }

  /* --- Tour --- */
  _bindTour() {
    this._tourIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`;
    this._tourBtn.addEventListener('click', () => {
      this._touring ? this._stopTour() : this._startTour();
    });
  }

  _startTour() {
    this._touring = true;
    this._tourBtn.classList.add('is-playing');
    this._tourLabel.textContent = 'Stop';
    this._tourIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`;
    this._tourIdx = 0;
    this._tourStep();
  }

  _tourStep() {
    if (!this._touring) return;
    const d = this.domains[this._tourIdx % this.domains.length];
    this._focus(d.id);
    this.scene.rotateTo(d.id);
    this._tourTimer = setTimeout(() => {
      this._tourIdx++;
      this._tourStep();
    }, 3000);
  }

  _stopTour() {
    this._touring = false;
    this._tourBtn.classList.remove('is-playing');
    this._tourLabel.textContent = 'Tour';
    this._tourIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`;
    clearTimeout(this._tourTimer);
    this._unfocus();
  }

  stopTour() { if (this._touring) this._stopTour(); }

  /* --- Pointer interaction on canvas --- */
  _bindPointer() {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => {
      if (this._touring) return;
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      this.scene.setPointer((mx / rect.width) * 2 - 1, -((my / rect.height) * 2 - 1));
      this._pick(mx, my, rect);
    });
    c.addEventListener('pointerleave', () => {
      if (this._touring) return;
      this.scene.setPointer(0, 0);
      this._unfocus();
    });
    c.addEventListener('click', () => {
      if (this.hovered) go(`#/region/${this.hovered}`);
    });
  }

  _pick(mx, my, rect) {
    const threshold = Math.min(rect.width, rect.height) * 0.14;
    let best = null, bestD = threshold;
    for (const d of this.domains) {
      const p = this.scene.projectRegion(d.id);
      if (!p || !p.visible) continue;
      const dist = Math.hypot(p.x - mx, p.y - my);
      if (dist < bestD) { bestD = dist; best = d.id; }
    }
    if (best) this._focus(best);
    else this._unfocus();
  }

  /* --- Focus/unfocus --- */
  _focus(id) {
    if (id === this.hovered) return;
    this.hovered = id;
    this.scene.setActiveRegion(id);
    this.canvas.classList.toggle('is-region', true);

    // Active nav item
    this._nav.querySelectorAll('.region-nav__item').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.region === id);
    });

    // Callout
    const d = this.byId.get(id);
    this._calloutDot.style.background = d.accent;
    this._calloutDot.style.boxShadow = `0 0 10px ${d.accent}`;
    this._calloutKicker.textContent = d.region;
    this._calloutTitle.textContent = d.label;
    this._calloutDesc.textContent = d.short;
    this._callout.classList.add('is-visible');
    this._marker.classList.add('is-visible');
    this._onHover(id);
  }

  _unfocus() {
    if (!this.hovered) return;
    this.hovered = null;
    this.scene.setActiveRegion(null);
    this.canvas.classList.toggle('is-region', false);
    this._nav.querySelectorAll('.region-nav__item').forEach((btn) => btn.classList.remove('is-active'));
    this._callout.classList.remove('is-visible');
    this._marker.classList.remove('is-visible');
    this._onHover(null);
  }

  /* --- Position callout + marker to track brain rotation --- */
  _followMarker() {
    if (!this.hovered) return;
    const p = this.scene.projectRegion(this.hovered);
    if (!p || !p.visible) { this._unfocus(); return; }
    this._marker.style.left = `${p.x}px`;
    this._marker.style.top = `${p.y}px`;
    // Position callout offset from marker
    this._callout.style.left = `${p.x + 20}px`;
    this._callout.style.top = `${p.y - 30}px`;
  }

  destroy() {
    this._stopTour();
  }
}

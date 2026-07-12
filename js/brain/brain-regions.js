/* =========================================================================
   brain-regions.js — maps pointer interaction over the brain to mental
   domains. Hover → highlight region + floating label (which follows the
   rotating anchor). Click → dive into that domain.
   ========================================================================= */
export class BrainRegions {
  constructor(scene, domains, { onEnter } = {}) {
    this.scene = scene;
    this.domains = domains;
    this.byId = new Map(domains.map((d) => [d.id, d]));
    this.onEnter = onEnter || (() => {});
    this.canvas = scene.canvas;
    this.hovered = null;
    this._pointerInside = false;

    this.label = document.getElementById('region-label');
    this.elKicker = document.getElementById('region-kicker');
    this.elTitle = document.getElementById('region-title');
    this.elDesc = document.getElementById('region-desc');

    this._bind();
    scene.onFrame(() => this._follow());
  }

  _bind() {
    const c = this.canvas;
    this._move = (e) => {
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      this._mx = mx; this._my = my; this._pointerInside = true;
      // feed parallax (-1..1)
      this.scene.setPointer((mx / rect.width) * 2 - 1, -((my / rect.height) * 2 - 1));
      this._pick(mx, my, rect);
    };
    this._leave = () => {
      this._pointerInside = false;
      this.scene.setPointer(0, 0);
      this._setHover(null);
    };
    this._click = () => { if (this.hovered) this.onEnter(this.hovered); };
    this._touch = (e) => {
      if (!e.touches || !e.touches[0]) return;
      const rect = c.getBoundingClientRect();
      const mx = e.touches[0].clientX - rect.left, my = e.touches[0].clientY - rect.top;
      this._mx = mx; this._my = my; this._pointerInside = true;
      this._pick(mx, my, rect);
    };
    c.addEventListener('pointermove', this._move);
    c.addEventListener('pointerleave', this._leave);
    c.addEventListener('click', this._click);
    c.addEventListener('touchstart', this._touch, { passive: true });
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
    this._setHover(best);
  }

  _setHover(id) {
    if (id === this.hovered) return;
    this.hovered = id;
    this.scene.setActiveRegion(id);
    this.canvas.classList.toggle('is-region', !!id);
    if (id) {
      const d = this.byId.get(id);
      this.elKicker.textContent = d.region;
      this.elTitle.textContent = d.label;
      this.elDesc.textContent = d.short;
      this.label.style.setProperty('--region-accent', d.accent);
      this.label.hidden = false;
      requestAnimationFrame(() => this.label.classList.add('is-visible'));
    } else {
      this.label.classList.remove('is-visible');
    }
  }

  /** keep the label pinned to the (rotating) region anchor */
  _follow() {
    if (!this.hovered) return;
    const p = this.scene.projectRegion(this.hovered);
    if (!p || !p.visible) { this._setHover(null); return; }
    this.label.style.left = `${p.x}px`;
    this.label.style.top = `${p.y}px`;
  }

  destroy() {
    const c = this.canvas;
    c.removeEventListener('pointermove', this._move);
    c.removeEventListener('pointerleave', this._leave);
    c.removeEventListener('click', this._click);
    c.removeEventListener('touchstart', this._touch);
  }
}

/* =========================================================================
   brain-regions.js — sidebar nav, tour auto-rotation, callout positioning,
   and the dive animation into a region catalog.

   Hover a region (nav item or the cortex) → the brain turns to face it, a
   callout + surface marker appear. Click → the camera dives in, then we
   navigate. The tour cycles through the regions on a timer.
   ========================================================================= */
export class BrainRegions {
  constructor(scene, domains, { onDive } = {}) {
    this.scene = scene;
    this.domains = domains;
    this.byId = new Map(domains.map((d) => [d.id, d]));
    this.canvas = scene.canvas;
    this.hovered = null;
    this._onDive = onDive || (() => {});
    this._touring = false;
    this._tourTimer = null;
    this._tourIdx = -1;
    this._diving = false;

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
    scene.onFrame(() => this._follow());
  }

  /* --- Sidebar nav --- */
  _buildNav() {
    this._nav.innerHTML = this.domains.map((d) => `
      <button class="region-nav__item" data-region="${d.id}" style="--item-accent:${d.accent}" type="button" aria-label="Explore ${d.label}">
        <span class="region-nav__dot"></span>
        <span class="region-nav__col">
          <span class="region-nav__label">${d.label}</span>
          <span class="region-nav__lobe">${d.region}</span>
        </span>
      </button>`).join('');

    // pointer hover on an item focuses its region (unless touring / diving)
    this._nav.addEventListener('pointerover', (e) => {
      const btn = e.target.closest('[data-region]');
      if (btn && !this._touring && !this._diving) this._focus(btn.dataset.region, true);
    });
    this._nav.addEventListener('pointerout', (e) => {
      const btn = e.target.closest('[data-region]');
      const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-region]');
      if (btn && !to && !this._touring && !this._diving) this._unfocus();
    });
    this._nav.addEventListener('focusin', (e) => {
      const btn = e.target.closest('[data-region]');
      if (btn && !this._touring && !this._diving) this._focus(btn.dataset.region, true);
    });
    this._nav.addEventListener('focusout', (e) => {
      const to = e.relatedTarget;
      if (!this._touring && !this._diving && (!to || !this._nav.contains(to))) this._unfocus();
    });
    this._nav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-region]');
      if (btn) this._dive(btn.dataset.region);
    });
  }

  /* --- Tour --- */
  _bindTour() {
    this._setTourIcon(false);
    this._tourBtn.setAttribute('aria-pressed', 'false');
    this._tourBtn.addEventListener('click', () => {
      this._touring ? this._stopTour() : this._startTour();
    });
  }

  _startTour() {
    this._touring = true;
    this._tourBtn.classList.add('is-playing');
    this._tourBtn.setAttribute('aria-pressed', 'true');
    this._tourLabel.textContent = 'Touring';
    this._setTourIcon(true);
    document.body.classList.add('is-touring');
    this._tourIdx = -1;
    const step = () => {
      this._tourIdx = (this._tourIdx + 1) % this.domains.length;
      this._focus(this.domains[this._tourIdx].id, true);
    };
    step();
    this._tourTimer = setInterval(step, 3000);
  }

  _stopTour() {
    this._touring = false;
    this._tourBtn.classList.remove('is-playing');
    this._tourBtn.setAttribute('aria-pressed', 'false');
    this._tourLabel.textContent = 'Tour';
    this._setTourIcon(false);
    document.body.classList.remove('is-touring');
    clearInterval(this._tourTimer);
    this._tourTimer = null;
    if (this._autoStop) { clearTimeout(this._autoStop); this._autoStop = null; }
    this._unfocus(0.4);
  }

  stopTour() { if (this._touring) this._stopTour(); }

  /** run one automatic lap through every region, then stop (first-visit intro) */
  autoTour() {
    if (this._touring || this._diving) return;
    this._startTour();
    // end while the last region is still on screen, before it wraps to the first
    const ms = this.domains.length * 3000 - 700;
    this._autoStop = setTimeout(() => { if (this._touring) this._stopTour(); }, ms);
  }

  _setTourIcon(playing) {
    this._tourIcon.innerHTML = playing
      ? '<svg viewBox="0 0 15 15" width="15" height="15" fill="currentColor" aria-hidden="true"><rect x="3" y="2.5" width="3" height="10" rx="1"/><rect x="9" y="2.5" width="3" height="10" rx="1"/></svg>'
      : '<svg viewBox="0 0 15 15" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M4 2.6v9.8c0 .5.5.8 1 .5l7.4-4.9c.4-.3.4-.9 0-1.1L5 2c-.5-.3-1 0-1 .6Z"/></svg>';
  }

  /* --- Pointer interaction on the cortex --- */
  _bindPointer() {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => {
      if (this._touring || this._diving) return;
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      this.scene.setPointer((mx / rect.width) * 2 - 1, -((my / rect.height) * 2 - 1));
      this._pick(mx, my, rect);
    });
    c.addEventListener('pointerleave', () => {
      if (this._touring || this._diving) return;
      this.scene.setPointer(0, 0);
      this._unfocus();
    });
    c.addEventListener('click', () => {
      if (this.hovered && !this._diving) this._dive(this.hovered);
    });
    // touch: first tap focuses, second tap on the same region dives
    c.addEventListener('touchstart', (e) => {
      if (this._diving || !e.touches || !e.touches[0]) return;
      const rect = c.getBoundingClientRect();
      const mx = e.touches[0].clientX - rect.left, my = e.touches[0].clientY - rect.top;
      const prev = this.hovered;
      this._pick(mx, my, rect);
      if (this.hovered && this.hovered === prev) this._dive(this.hovered);
    }, { passive: true });
  }

  _pick(mx, my, rect) {
    const threshold = Math.min(rect.width, rect.height) * 0.16;
    let best = null, bestD = threshold;
    for (const d of this.domains) {
      const p = this.scene.projectRegion(d.id);
      if (!p || !p.visible) continue;
      const dist = Math.hypot(p.x - mx, p.y - my);
      if (dist < bestD) { bestD = dist; best = d.id; }
    }
    if (best) this._focus(best, true);
    else this._unfocus();
  }

  /* --- Focus / unfocus --- */
  _focus(id, showCallout) {
    if (id === this.hovered) return;
    this.hovered = id;
    this.scene.faceRegion(id);
    this.canvas.classList.add('is-region');

    this._nav.querySelectorAll('.region-nav__item').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.region === id);
    });

    const d = this.byId.get(id);
    this._calloutDot.style.background = d.accent;
    this._calloutDot.style.boxShadow = `0 0 10px ${d.accent}`;
    this._calloutKicker.style.color = d.accent;
    this._calloutKicker.textContent = d.region;
    this._calloutTitle.textContent = d.label;
    this._calloutDesc.textContent = d.short;
    this._showCallout = !!showCallout;
  }

  _unfocus(hold = 1.1) {
    if (!this.hovered) return;
    this.hovered = null;
    this.scene.releaseFocus(hold);
    this.canvas.classList.remove('is-region');
    this._nav.querySelectorAll('.region-nav__item').forEach((btn) => btn.classList.remove('is-active'));
    this._showCallout = false;
    this._callout.classList.remove('is-visible');
    this._marker.classList.remove('is-visible');
  }

  /* --- Dive into a region --- */
  _dive(id) {
    if (this._diving) return;
    this._diving = true;
    if (this._touring) this._stopTour();
    this._focus(id, false);
    this._callout.classList.remove('is-visible');
    this._marker.classList.remove('is-visible');
    this._onDive(id);
  }

  /** reset interaction state when we return to the home view */
  resume() {
    this._diving = false;
    this.hovered = null;
    this.canvas.classList.remove('is-region');
    this._nav.querySelectorAll('.region-nav__item').forEach((btn) => btn.classList.remove('is-active'));
  }

  /* --- Keep callout + marker pinned to the (rotating) region anchor --- */
  _follow() {
    if (!this.hovered || !this._showCallout || this._diving) return;
    // Mobile/tablet: the cortex marker never shows on the full-bleed backdrop.
    // The floating callout is desktop-only for hover — EXCEPT during the guided
    // tour, where CSS pins it as a fixed banner naming the current region (the
    // nav grid can't convey the description, and the brain has no label). Clear
    // any stale inline coordinates left by a prior desktop layout (orientation
    // change) so the CSS-centred position wins.
    if (this.scene.stacked) {
      this._marker.classList.remove('is-visible');
      if (this._touring) {
        this._callout.style.left = '';
        this._callout.style.top = '';
        this._callout.classList.add('is-visible');
      } else {
        this._callout.classList.remove('is-visible');
      }
      return;
    }
    const p = this.scene.projectRegion(this.hovered);
    if (!p || !p.visible) {
      this._callout.classList.remove('is-visible');
      this._marker.classList.remove('is-visible');
      return;
    }
    const d = this.byId.get(this.hovered);
    // marker on the cortex
    this._marker.style.left = `${p.x}px`;
    this._marker.style.top = `${p.y}px`;
    this._marker.classList.add('is-visible');
    const markSpan = this._marker.firstElementChild;
    if (markSpan) { markSpan.style.borderColor = d.accent; markSpan.style.boxShadow = `0 0 12px ${d.accent}`; }

    // callout card: to the side with the most room, clamped on-screen
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = this._callout.offsetWidth || 230;
    const ch = this._callout.offsetHeight || 120;
    const gap = 20;
    let left = p.x + gap;
    if (p.x > vw * 0.56) left = p.x - cw - gap;
    left = Math.max(14, Math.min(left, vw - cw - 14));
    let top = p.y - ch * 0.5;
    top = Math.max(70, Math.min(top, vh - ch - 18));
    this._callout.style.left = `${left}px`;
    this._callout.style.top = `${top}px`;
    this._callout.classList.add('is-visible');
  }

  destroy() {
    this._stopTour();
  }
}

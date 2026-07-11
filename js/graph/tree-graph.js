/* =========================================================================
   tree-graph.js — progressive hierarchical explorer (Canvas 2D + d3-force).
   The region sits at the centre; children fan out on concentric rings by
   depth (radial hierarchy → reads as a neural cluster, not a random web).
   Only expanded branches are shown, so the graph is always calm and legible.
   Parent→child links are strong; curated cross-links are faint.
   ========================================================================= */
import {
  forceSimulation, forceManyBody, forceLink, forceCollide, forceRadial, forceX, forceY,
} from 'd3-force';

const TYPE_COLORS = {
  region: null, degree: '#818CF8', course: '#8FA0FF', work: '#60A5FA',
  project: '#22D3EE', research: '#A78BFA', cert: '#2DD4BF', certgroup: '#2DD4BF',
  group: '#9AA7BD', skill: '#EAEEF6', language: '#7DD3FC', interest: '#94A3B8',
  tech: '#5B6B82', contact: '#38BDF8',
};
const RING = 132;            // px between hierarchy levels

export class TreeGraph {
  constructor(canvas, { onSelect, reducedMotion } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect || (() => {});
    this.reduced = !!reducedMotion;
    this.transform = { k: 1, x: 0, y: 0 };
    this.hover = null; this.selected = null;
    this.accent = '#22D3EE';
    this._t = 0; this._running = false;
    this._dragNode = null; this._panning = false;

    this._bind();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas);
  }

  /* ---- data / progressive state ---------------------------------------- */
  setTree(tree, regionId, accent) {
    this.tree = tree;
    this.accent = accent || '#22D3EE';
    this.rootId = `region:${regionId}`;
    this.visible = new Set([this.rootId]);
    this.expanded = new Set();
    this.selected = null; this.hover = null;
    this._nodePos = new Map();               // remember positions across rebuilds
    this._expand(this.rootId, false);        // reveal L1 immediately
    this._rebuild(true);
    this.resize();
    this._fitScheduled = true;
    if (!this._running) { this._running = true; this._loop(); }
  }

  _childrenOf(id) { return this.tree.childrenById.get(id) || []; }
  hasChildren(id) { return this._childrenOf(id).length > 0; }

  _expand(id, rebuild = true) {
    if (!this.hasChildren(id)) return false;
    this.expanded.add(id);
    for (const cid of this._childrenOf(id)) this.visible.add(cid);
    if (rebuild) { this._rebuild(); this._wake(); }
    return true;
  }
  _collapse(id, rebuild = true) {
    this.expanded.delete(id);
    const drop = (nid) => {
      for (const cid of this._childrenOf(nid)) {
        if (this.visible.has(cid)) { this.visible.delete(cid); this.expanded.delete(cid); drop(cid); }
      }
    };
    drop(id);
    if (rebuild) { this._rebuild(); this._wake(); }
  }
  toggle(id) {
    if (this.expanded.has(id)) this._collapse(id);
    else this._expand(id);
  }

  _depth(id) {
    let d = 0, p = this.tree.parentById.get(id);
    while (p != null && p !== this.rootId) { d++; p = this.tree.parentById.get(p); }
    return this.tree.parentById.get(id) == null || id === this.rootId ? 0 : d + 1;
  }

  _rebuild(seed = false) {
    const ids = [...this.visible];
    const prev = new Map((this.nodes || []).map((n) => [n.id, n]));
    this.nodes = ids.map((id) => {
      const meta = this.tree.byId.get(id);
      const depth = this._depth(id);
      const existing = prev.get(id) || this._nodePos.get(id);
      const parent = prev.get(this.tree.parentById.get(id));
      const n = {
        id, meta, depth,
        r: this._radius(meta, depth),
        expandable: this.hasChildren(id),
        expanded: this.expanded.has(id),
      };
      if (existing) { n.x = existing.x; n.y = existing.y; }
      else if (parent) { n.x = parent.x + (Math.random() - 0.5) * 40; n.y = parent.y + (Math.random() - 0.5) * 40; }
      else { n.x = 0; n.y = 0; }
      return n;
    });
    const byId = new Map(this.nodes.map((n) => [n.id, n]));

    // parent→child links among visible
    const links = [];
    for (const n of this.nodes) {
      const pid = this.tree.parentById.get(n.id);
      if (pid && byId.has(pid)) links.push({ source: pid, target: n.id, kind: 'child' });
    }
    // curated cross-links among visible
    for (const cl of this.tree.crossLinks) {
      if (byId.has(cl.a) && byId.has(cl.b)) links.push({ source: cl.a, target: cl.b, kind: 'cross', note: cl.note });
    }
    this.links = links;
    this.adj = new Map(this.nodes.map((n) => [n.id, new Set()]));
    for (const l of links) { this.adj.get(l.source)?.add(l.target); this.adj.get(l.target)?.add(l.source); }

    if (this.sim) this.sim.stop();
    this.sim = forceSimulation(this.nodes)
      .force('radial', forceRadial((n) => n.depth * RING, 0, 0).strength(0.92))
      .force('charge', forceManyBody().strength((n) => -70 - n.r * 6).distanceMax(460))
      .force('link', forceLink(links).id((d) => d.id)
        .distance((l) => (l.kind === 'cross' ? 150 : RING * 0.82)).strength((l) => (l.kind === 'cross' ? 0.03 : 0.16)))
      .force('collide', forceCollide().radius((n) => n.r + 16).strength(0.9).iterations(2))
      .force('x', forceX(0).strength(0.006)).force('y', forceY(0).strength(0.006))
      .velocityDecay(0.36).alpha(seed ? 1 : 0.7).alphaDecay(0.045);
  }

  _radius(meta, depth) {
    if (meta.type === 'region') return 20;
    const base = { degree: 13, work: 11, project: 11, research: 11, certgroup: 12, group: 11 }[meta.type] || 7.5;
    return Math.max(5.5, base - depth * 0.6);
  }
  _color(meta) { return meta.type === 'region' ? this.accent : (TYPE_COLORS[meta.type] || this.accent); }

  /* ---- view ------------------------------------------------------------- */
  fitView() {
    if (!this.nodes || !this.nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r);
    }
    const pad = 130;
    const k = Math.min((this.width - pad) / (maxX - minX || 1), (this.height - pad) / (maxY - minY || 1), 2.0);
    this.transform.k = Math.max(0.35, k);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    this.transform.x = this.width / 2 - cx * this.transform.k;
    this.transform.y = this.height / 2 - cy * this.transform.k;
  }
  focusNode(node) {
    if (!node) return;
    const k = Math.max(this.transform.k, 0.9);
    this.transform.k = k;
    this.transform.x = this.width * 0.5 - node.x * k;
    this.transform.y = this.height * 0.5 - node.y * k;
  }
  select(id) {
    const n = this.nodes.find((x) => x.id === id);
    if (n) { this.selected = n; this.focusNode(n); this._wake(); }
  }

  /** expand every ancestor so `id` is visible, then select + focus it */
  revealAndSelect(id) {
    if (!this.tree.byId.has(id)) return;
    const path = [];
    let cur = this.tree.parentById.get(id);
    while (cur != null) { path.unshift(cur); cur = this.tree.parentById.get(cur); }
    for (const pid of path) {
      if (this.hasChildren(pid)) { this.expanded.add(pid); for (const c of this._childrenOf(pid)) this.visible.add(c); }
    }
    this.visible.add(id);
    this._rebuild();
    const n = this.nodes.find((x) => x.id === id);
    if (n) { this.selected = n; this.focusNode(n); }
    this._fitScheduled = false;
    this._wake();
  }

  _toScreen(x, y) { return [x * this.transform.k + this.transform.x, y * this.transform.k + this.transform.y]; }
  _toWorld(sx, sy) { return [(sx - this.transform.x) / this.transform.k, (sy - this.transform.y) / this.transform.k]; }
  _nodeAt(sx, sy) {
    const [wx, wy] = this._toWorld(sx, sy);
    let best = null, bestD = Infinity;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - wx, n.y - wy);
      if (d < n.r + 10 / this.transform.k && d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  /* ---- interaction ------------------------------------------------------ */
  _bind() {
    const c = this.canvas;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('pointerdown', (e) => {
      const [sx, sy] = pos(e); const n = this._nodeAt(sx, sy);
      c.setPointerCapture(e.pointerId);
      this._downAt = [sx, sy]; this._moved = false;
      if (n) { this._dragNode = n; n.fx = n.x; n.fy = n.y; this.sim.alphaTarget(0.2).restart(); }
      else this._panning = true;
      this._wake();
    });
    c.addEventListener('pointermove', (e) => {
      const [sx, sy] = pos(e);
      if (this._dragNode) { const [wx, wy] = this._toWorld(sx, sy); this._dragNode.fx = wx; this._dragNode.fy = wy; this._moved = true; this._wake(); return; }
      if (this._panning) { this.transform.x += sx - this._downAt[0]; this.transform.y += sy - this._downAt[1]; this._downAt = [sx, sy]; this._moved = true; this._wake(); return; }
      const n = this._nodeAt(sx, sy);
      if (n !== this.hover) { this.hover = n; c.style.cursor = n ? 'pointer' : 'grab'; this._wake(); }
    });
    const up = (e) => {
      const [sx, sy] = pos(e);
      if (this._dragNode) { this._dragNode.fx = null; this._dragNode.fy = null; this.sim.alphaTarget(0); }
      if (!this._moved) {
        const n = this._nodeAt(sx, sy);
        if (n) { this.selected = n; this.onSelect(n.id); if (n.expandable && n.id !== this.rootId) this.toggle(n.id); }
      }
      this._dragNode = null; this._panning = false; this._wake();
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [sx, sy] = pos(e); const [wx, wy] = this._toWorld(sx, sy);
      const f = Math.exp(-e.deltaY * 0.0016);
      this.transform.k = Math.max(0.35, Math.min(3, this.transform.k * f));
      this.transform.x = sx - wx * this.transform.k; this.transform.y = sy - wy * this.transform.k;
      this._wake();
    }, { passive: false });
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = r.width; this.height = r.height;
    this.canvas.width = r.width * pr; this.canvas.height = r.height * pr;
    this.ctx.setTransform(pr, 0, 0, pr, 0, 0);
    this._wake();
  }

  pause() { this._running = false; }
  resume() { this._wake(); }
  _wake() { if (!this._running && this.sim) { this._running = true; this._loop(); } }

  _loop() {
    if (!this._running) return;
    this._t += 0.016;
    // remember positions for smooth rebuilds
    if (this.nodes) for (const n of this.nodes) this._nodePos.set(n.id, { x: n.x, y: n.y });
    if (this._fitScheduled && this.sim.alpha() < 0.6) { this.fitView(); this._fitScheduled = false; }
    this._draw();
    const keep = !this.reduced || this.sim.alpha() > 0.015 || this._dragNode || this._panning;
    if (keep) requestAnimationFrame(() => this._loop()); else this._running = false;
  }

  _draw() {
    const ctx = this.ctx, { k, x: tx, y: ty } = this.transform;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save(); ctx.translate(tx, ty); ctx.scale(k, k);

    const focus = this.selected || this.hover;
    const focusId = focus?.id;
    const nb = focusId ? this.adj.get(focusId) : null;
    const near = (id) => id === focusId || (nb && nb.has(id));
    const byId = new Map(this.nodes.map((n) => [n.id, n]));

    // links
    ctx.lineCap = 'round';
    for (const l of this.links) {
      const s = byId.get(l.source.id || l.source), t = byId.get(l.target.id || l.target);
      if (!s || !t) continue;
      const active = focusId && (s.id === focusId || t.id === focusId);
      const cross = l.kind === 'cross';
      ctx.beginPath();
      if (cross) {
        // curved, faint, dashed-feel connector for cross-domain relations
        const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
        const nx = -(t.y - s.y), ny = (t.x - s.x); const len = Math.hypot(nx, ny) || 1;
        ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(mx + nx / len * 26, my + ny / len * 26, t.x, t.y);
        ctx.strokeStyle = this._rgba(this._color(t.meta), active ? 0.6 : 0.16);
        ctx.lineWidth = (active ? 1.4 : 0.8) / k;
      } else {
        ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = active ? this._rgba(this._color(t.meta), 0.85) : 'rgba(120,140,175,0.32)';
        ctx.lineWidth = (active ? 2.0 : 1.3) / k;
      }
      ctx.globalAlpha = focusId && !active ? (cross ? 0.4 : 0.5) : 1;
      ctx.stroke();
      // travelling pulse along active parent links
      if (!this.reduced && active && !cross) {
        const p = (this._t * 0.5) % 1;
        const px = s.x + (t.x - s.x) * p, py = s.y + (t.y - s.y) * p;
        ctx.beginPath(); ctx.arc(px, py, 2.0 / k, 0, Math.PI * 2);
        ctx.fillStyle = this._rgba(this._color(t.meta), 0.9); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // nodes
    for (const n of this.nodes) {
      const dim = focusId ? !near(n.id) : false;
      const color = this._color(n.meta);
      const isFocus = n === this.selected || n === this.hover;
      const breathe = this.reduced ? 1 : 1 + Math.sin(this._t * 0.9 + (n.x + n.y) * 0.02) * 0.04;
      const r = n.r * breathe;
      ctx.globalAlpha = dim ? 0.28 : 1;
      // halo
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.2);
      g.addColorStop(0, this._rgba(color, isFocus ? 0.5 : 0.22)); g.addColorStop(1, this._rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, r * 3.2, 0, Math.PI * 2); ctx.fill();
      // body
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.meta.type === 'region' ? this._rgba(color, 0.95) : (n.expandable ? '#0b1017' : this._rgba(color, 0.92));
      ctx.fill();
      ctx.lineWidth = (isFocus ? 2.2 : 1.2) / k; ctx.strokeStyle = this._rgba(color, isFocus ? 1 : 0.7); ctx.stroke();
      // "expandable" affordance: a ring + dot when collapsed
      if (n.expandable && !n.expanded && n.meta.type !== 'region') {
        ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = this._rgba(color, 0.9); ctx.fill();
      }
    }
    ctx.restore();
    this._drawLabels(byId, near, focusId);
  }

  _drawLabels(byId, near, focusId) {
    const ctx = this.ctx;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const placed = [];
    const overlaps = (b) => placed.some((p) => !(b.x + b.w < p.x || b.x > p.x + p.w || b.y + b.h < p.y || b.y > p.y + p.h));
    // priority: region + focus + neighbours first, then the rest
    const ordered = [...this.nodes].sort((a, b) => (this._labelPrio(a, focusId, near) - this._labelPrio(b, focusId, near)));
    for (const n of ordered) {
      const [sx, sy] = this._toScreen(n.x, n.y);
      if (sx < -80 || sx > this.width + 80 || sy < -30 || sy > this.height + 30) continue;
      const prio = this._labelPrio(n, focusId, near);
      const isFocus = n === this.selected || n === this.hover;
      const size = n.meta.type === 'region' ? 14 : (isFocus ? 12.5 : 11);
      ctx.font = `${n.meta.type === 'region' || isFocus ? 600 : 400} ${size}px Inter, system-ui, sans-serif`;
      let label = n.meta.label; if (label.length > 30) label = label.slice(0, 28) + '…';
      const w = ctx.measureText(label).width;
      const top = sy + n.r * this.transform.k + 6;
      const box = { x: sx - w / 2 - 3, y: top - 1, w: w + 6, h: size + 4 };
      if (prio > 1 && overlaps(box)) continue;
      placed.push(box);
      ctx.shadowColor = 'rgba(3,6,12,0.9)'; ctx.shadowBlur = 8;
      ctx.fillStyle = isFocus || n.meta.type === 'region' ? '#F2F5FB' : 'rgba(196,206,222,0.88)';
      ctx.fillText(label, sx, top);
      ctx.shadowBlur = 0;
    }
  }
  _labelPrio(n, focusId, near) {
    if (n.meta.type === 'region') return 0;
    if (n.id === focusId) return 0;
    if (focusId && near(n.id)) return 1;
    if (n.depth <= 1) return 1;
    return 3;
  }

  _rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`;
  }

  destroy() { this._running = false; this.sim?.stop(); this._ro?.disconnect(); }
}

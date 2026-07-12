/* =========================================================================
   force-graph.js — d3-force physics + a custom Canvas 2D renderer.
   Links are drawn as glowing curved "synapses" with travelling pulses;
   nodes breathe and glow; full zoom / pan / drag / hover / click.
   ========================================================================= */
import {
  forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY,
} from 'd3-force';

const TYPE_COLORS = {
  project: null,            // filled with domain accent at runtime
  cert: '#2DD4BF',
  course: '#818CF8',
  education: '#38BDF8',
  work: '#60A5FA',
  person: '#EAEEF6',
  language: '#7DD3FC',
  interest: '#94A3B8',
  skill: '#5B6B82',
};

export class ForceGraph {
  constructor(canvas, { onNodeClick, onNodeHover, reducedMotion } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onNodeClick = onNodeClick || (() => {});
    this.onNodeHover = onNodeHover || (() => {});
    this.reduced = !!reducedMotion;
    this.nodes = []; this.links = [];
    this.transform = { k: 1, x: 0, y: 0 };
    this.hover = null; this.selected = null;
    this.accent = '#22D3EE';
    this._t = 0;
    this._running = false;
    this._dragNode = null; this._panning = false;

    this._bind();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas);
  }

  setData({ nodes, links, domain }) {
    this.accent = domain?.accent || '#22D3EE';
    this.domainId = domain?.id;
    // map link endpoints (ids) to node objects for d3
    const byId = new Map(nodes.map((n) => [n.id, n]));
    this.nodes = nodes;
    this.links = links
      .filter((l) => byId.has(l.source) && byId.has(l.target))
      .map((l) => ({ ...l }));

    // adjacency (for selection reaction + label priority)
    this.adj = new Map(nodes.map((n) => [n.id, new Set()]));
    for (const l of this.links) { this.adj.get(l.source).add(l.target); this.adj.get(l.target).add(l.source); }

    // hierarchy: heavier, more-connected nodes anchor near the centre
    nodes.forEach((n) => { n.r = this._radius(n); n.mass = 0.5 + (n.weight || 1) * 0.5 + Math.min(n.degree || 0, 10) * 0.15; });

    // seed positions: hubs near centre, leaves on the rim (calmer opening)
    const R = 150;
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2 + (i % 2) * 0.6;
      const rad = R * (n.type === 'skill' ? 0.9 : 0.4) * (0.5 + Math.random() * 0.6);
      n.x = Math.cos(a) * rad; n.y = Math.sin(a) * rad;
    });

    // priority nodes that always get a label (the domain's anchors)
    this.importantIds = new Set(nodes.filter((n) => n.type !== 'skill')
      .sort((a, b) => (b.weight + b.degree * 0.3) - (a.weight + a.degree * 0.3))
      .slice(0, 7).map((n) => n.id));

    this.sim = forceSimulation(this.nodes)
      .force('charge', forceManyBody().strength((n) => (n.type === 'skill' ? -55 : -300)).distanceMax(520))
      .force('link', forceLink(this.links).id((d) => d.id)
        .distance((l) => (l.kind === 'has' ? 52 : (l.source.type === 'skill' || l.target.type === 'skill' ? 74 : 116)))
        .strength((l) => (l.kind === 'has' ? 0.35 : 0.5)))
      .force('collide', forceCollide().radius((n) => n.r + 11).strength(0.92).iterations(2))
      .force('x', forceX(0).strength((n) => 0.02 + n.mass * 0.012))
      .force('y', forceY(0).strength((n) => 0.03 + n.mass * 0.012))
      .velocityDecay(0.32)
      .alpha(1).alphaDecay(0.03);

    this.resize();
    this._fitScheduled = true;
    if (!this._running) { this._running = true; this._loop(); }
  }

  _radius(n) {
    const base = { person: 17, education: 12.5, project: 9.5, work: 9, cert: 7.5, course: 7, language: 7, interest: 6, skill: 4.5 }[n.type] || 7;
    return base + Math.min(n.degree || 0, 10) * 0.55 + (n.weight || 1) * 0.5;
  }
  _color(n) { return n.type === 'project' ? this.accent : (TYPE_COLORS[n.type] || this.accent); }

  /* ---- view fitting ----------------------------------------------------- */
  fitView(animated = false) {
    if (!this.nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r);
    }
    const w = this.width, h = this.height;
    const pad = 80;
    const k = Math.min((w - pad) / (maxX - minX || 1), (h - pad) / (maxY - minY || 1), 2.2);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    this.transform.k = Math.max(0.3, k);
    this.transform.x = w / 2 - cx * this.transform.k;
    this.transform.y = h / 2 - cy * this.transform.k;
  }

  focusNode(node) {
    if (!node) return;
    const k = Math.max(this.transform.k, 1.1);
    this.transform.k = k;
    this.transform.x = this.width * 0.5 - node.x * k;
    this.transform.y = this.height * 0.5 - node.y * k;
  }

  /* ---- coordinate helpers ---------------------------------------------- */
  _toScreen(x, y) { return [x * this.transform.k + this.transform.x, y * this.transform.k + this.transform.y]; }
  _toWorld(sx, sy) { return [(sx - this.transform.x) / this.transform.k, (sy - this.transform.y) / this.transform.k]; }

  _nodeAt(sx, sy) {
    const [wx, wy] = this._toWorld(sx, sy);
    let best = null, bestD = Infinity;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - wx, n.y - wy);
      const hit = n.r + 6 / this.transform.k;
      if (d < hit && d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  /* ---- interaction ------------------------------------------------------ */
  _bind() {
    const c = this.canvas;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    c.addEventListener('pointerdown', (e) => {
      const [sx, sy] = pos(e);
      const n = this._nodeAt(sx, sy);
      c.setPointerCapture(e.pointerId);
      this._downAt = [sx, sy]; this._moved = false;
      if (n) { this._dragNode = n; n.fx = n.x; n.fy = n.y; this.sim.alphaTarget(0.15).restart(); }
      else { this._panning = true; }
      this._wake();
    });

    c.addEventListener('pointermove', (e) => {
      const [sx, sy] = pos(e);
      if (this._dragNode) {
        const [wx, wy] = this._toWorld(sx, sy);
        this._dragNode.fx = wx; this._dragNode.fy = wy; this._moved = true; this._wake(); return;
      }
      if (this._panning) {
        this.transform.x += sx - this._downAt[0]; this.transform.y += sy - this._downAt[1];
        this._downAt = [sx, sy]; this._moved = true; this._wake(); return;
      }
      const n = this._nodeAt(sx, sy);
      if (n !== this.hover) { this.hover = n; c.style.cursor = n ? 'pointer' : 'grab'; this.onNodeHover(n); this._wake(); }
    });

    const up = (e) => {
      const [sx, sy] = pos(e);
      if (this._dragNode) { this._dragNode.fx = null; this._dragNode.fy = null; this.sim.alphaTarget(0); }
      if (!this._moved) { const n = this._nodeAt(sx, sy); if (n) { this.selected = n; this.onNodeClick(n); } }
      this._dragNode = null; this._panning = false;
      this._wake();
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [sx, sy] = pos(e);
      const [wx, wy] = this._toWorld(sx, sy);
      const factor = Math.exp(-e.deltaY * 0.0016);
      this.transform.k = Math.max(0.3, Math.min(4, this.transform.k * factor));
      this.transform.x = sx - wx * this.transform.k;
      this.transform.y = sy - wy * this.transform.k;
      this._wake();
    }, { passive: false });
  }

  select(node) { this.selected = node; this.focusNode(node); this._wake(); }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = r.width; this.height = r.height;
    this.canvas.width = r.width * pr; this.canvas.height = r.height * pr;
    this.ctx.setTransform(pr, 0, 0, pr, 0, 0);
    this._wake();
  }

  /* ---- render loop ------------------------------------------------------ */
  pause() { this._running = false; }
  resume() { this._wake(); }
  _wake() { if (!this._running && this.sim) { this._running = true; this._loop(); } }

  _loop() {
    if (!this._running) return;
    this._t += 0.016;
    if (this._fitScheduled && this.sim.alpha() < 0.7) { this.fitView(); this._fitScheduled = false; }
    this._draw();
    // reduced-motion: settle then stop (no idle animation); interactions re-wake
    const keep = !this.reduced || this.sim.alpha() > 0.012;
    if (keep) requestAnimationFrame(() => this._loop());
    else this._running = false;
  }

  _draw() {
    const ctx = this.ctx, { k, x: tx, y: ty } = this.transform;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(tx, ty); ctx.scale(k, k);

    const sel = this.selected, hov = this.hover;
    const focusId = (sel || hov)?.id;
    const nb = focusId ? this.adj.get(focusId) : null;
    const near = (id) => id === focusId || (nb && nb.has(id));

    // --- links: curved synapses with a source→target colour gradient -------
    ctx.lineCap = 'round';
    for (const l of this.links) {
      const s = l.source, t = l.target;
      const active = focusId && (s.id === focusId || t.id === focusId);
      const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
      const nx = -(t.y - s.y), ny = (t.x - s.x);
      const len = Math.hypot(nx, ny) || 1;
      const bow = 9 + ((s.x * 13 + t.y * 7) % 6);
      const cx = mx + (nx / len) * bow, cy = my + (ny / len) * bow;

      if (active) {
        const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
        grad.addColorStop(0, this._rgba(this._color(s), 0.95));
        grad.addColorStop(1, this._rgba(this._color(t), 0.95));
        ctx.strokeStyle = grad; ctx.globalAlpha = 0.95; ctx.lineWidth = 1.6 / k;
      } else {
        ctx.strokeStyle = 'rgba(126,150,186,1)';
        ctx.globalAlpha = focusId ? 0.05 : 0.22;
        ctx.lineWidth = 0.75 / k;
      }
      ctx.beginPath();
      ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(cx, cy, t.x, t.y);
      ctx.stroke();

      // travelling signal — on selection it emanates outward from the focus
      if (!this.reduced && (!focusId || active)) {
        let p;
        if (active) {
          const outward = s.id === focusId;
          const raw = (this._t * 0.6 + (l.source.x + l.target.y) * 0.004) % 1;
          p = outward ? raw : 1 - raw;
        } else {
          p = (this._t * 0.18 + (s.x * 0.013 + t.y * 0.017)) % 1;
        }
        const px = (1 - p) * (1 - p) * s.x + 2 * (1 - p) * p * cx + p * p * t.x;
        const py = (1 - p) * (1 - p) * s.y + 2 * (1 - p) * p * cy + p * p * t.y;
        ctx.beginPath();
        ctx.arc(px, py, (active ? 2.3 : 1.3) / k, 0, Math.PI * 2);
        ctx.fillStyle = active ? this._rgba(this._color(sel || hov), 1) : 'rgba(150,190,230,0.5)';
        ctx.globalAlpha = active ? 1 : 0.4;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // --- nodes -------------------------------------------------------------
    for (const n of this.nodes) {
      const dim = focusId ? !near(n.id) : false;
      const color = this._color(n);
      const breathe = this.reduced ? 1 : 1 + Math.sin(this._t * (0.9 + n.mass * 0.15) + (n.x + n.y) * 0.03) * 0.05;
      const isFocus = n === sel || n === hov;
      const pulse = (!this.reduced && n === sel) ? 1 + Math.sin(this._t * 3) * 0.06 : 1;
      const r = n.r * breathe * pulse;

      ctx.globalAlpha = dim ? 0.22 : 1;
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.4);
      g.addColorStop(0, this._rgba(color, isFocus ? 0.55 : 0.26));
      g.addColorStop(1, this._rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(n.x, n.y, r * 3.4, 0, Math.PI * 2); ctx.fill();

      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.type === 'skill' ? '#0b1017' : this._rgba(color, 0.96);
      ctx.fill();
      ctx.lineWidth = (isFocus ? 2 : 1.1) / k;
      ctx.strokeStyle = this._rgba(color, isFocus ? 1 : 0.72);
      ctx.stroke();
    }
    ctx.restore();

    this._drawLabels(sel, hov, near, focusId);
  }

  /* labels in screen space with collision avoidance → no overlap, no noise */
  _drawLabels(sel, hov, near, focusId) {
    const ctx = this.ctx, k = this.transform.k;
    const placed = [];
    const overlaps = (b) => placed.some((p) => !(b.x + b.w < p.x || b.x > p.x + p.w || b.y + b.h < p.y || b.y > p.y + p.h));

    // priority order: focus → its neighbours → domain anchors
    const seen = new Set();
    const queue = [];
    const push = (n, prio) => { if (n && !seen.has(n.id)) { seen.add(n.id); queue.push({ n, prio }); } };
    if (sel) push(sel, 0);
    if (hov) push(hov, 0);
    if (focusId) for (const n of this.nodes) if (near(n.id)) push(n, 1);
    for (const n of this.nodes) if (this.importantIds.has(n.id)) push(n, 2);
    // when zoomed in, allow more labels to surface
    if (k > 1.2) for (const n of this.nodes) if (n.type !== 'skill') push(n, 3);
    queue.sort((a, b) => a.prio - b.prio);

    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const { n, prio } of queue) {
      const [sx, sy] = this._toScreen(n.x, n.y);
      if (sx < -60 || sx > this.width + 60 || sy < -20 || sy > this.height + 20) continue;
      const isFocus = n === sel || n === hov;
      const size = isFocus ? 13 : 11.5;
      ctx.font = `${isFocus ? 500 : 400} ${size}px Inter, system-ui, sans-serif`;
      let label = n.label;
      if (label.length > 30) label = label.slice(0, 28) + '…';
      const w = ctx.measureText(label).width;
      const top = sy + n.r * this.transform.k + 6;
      const box = { x: sx - w / 2 - 3, y: top - 1, w: w + 6, h: size + 4 };
      if (prio > 1 && overlaps(box)) continue;             // never hide focus/neighbour labels
      placed.push(box);
      ctx.shadowColor = 'rgba(3,6,12,0.85)'; ctx.shadowBlur = 8;
      ctx.fillStyle = isFocus ? '#F2F5FB' : 'rgba(196,206,222,0.9)';
      ctx.fillText(label, sx, top);
      ctx.shadowBlur = 0;
    }
  }

  _rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  clearSelection() { this.selected = null; }

  destroy() {
    this._running = false;
    this.sim?.stop();
    this._ro?.disconnect();
  }
}

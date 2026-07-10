/* =========================================================================
   force-graph.js — d3-force physics + a custom Canvas 2D renderer.
   Links are drawn as glowing curved "synapses" with travelling pulses;
   nodes breathe and glow; full zoom / pan / drag / hover / click.
   ========================================================================= */
import {
  forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide, forceX, forceY,
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
  constructor(canvas, { onNodeClick, onNodeHover } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onNodeClick = onNodeClick || (() => {});
    this.onNodeHover = onNodeHover || (() => {});
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

    // seed positions in a ring so the sim opens gracefully
    const R = 140;
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2;
      n.x = Math.cos(a) * R * (0.4 + Math.random() * 0.6);
      n.y = Math.sin(a) * R * (0.4 + Math.random() * 0.6);
      n.r = this._radius(n);
    });

    this.sim = forceSimulation(this.nodes)
      .force('charge', forceManyBody().strength((n) => (n.type === 'skill' ? -80 : -240)))
      .force('link', forceLink(this.links).id((d) => d.id)
        .distance((l) => (l.kind === 'has' ? 60 : 95)).strength(0.5))
      .force('collide', forceCollide().radius((n) => n.r + 6))
      .force('x', forceX(0).strength(0.05))
      .force('y', forceY(0).strength(0.05))
      .force('center', forceCenter(0, 0))
      .alpha(1).alphaDecay(0.028)
      .on('tick', () => { /* positions update; render loop draws */ });

    this.resize();
    this._fitScheduled = true;
    if (!this._running) { this._running = true; this._loop(); }
  }

  _radius(n) {
    const base = { person: 16, education: 12, project: 9, work: 9, cert: 7.5, course: 7, language: 7, interest: 6, skill: 5 }[n.type] || 7;
    return base + Math.min(n.degree || 0, 8) * 0.6 + (n.weight || 1) * 0.6;
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
    });

    c.addEventListener('pointermove', (e) => {
      const [sx, sy] = pos(e);
      if (this._dragNode) {
        const [wx, wy] = this._toWorld(sx, sy);
        this._dragNode.fx = wx; this._dragNode.fy = wy; this._moved = true; return;
      }
      if (this._panning) {
        this.transform.x += sx - this._downAt[0]; this.transform.y += sy - this._downAt[1];
        this._downAt = [sx, sy]; this._moved = true; return;
      }
      const n = this._nodeAt(sx, sy);
      if (n !== this.hover) { this.hover = n; c.style.cursor = n ? 'pointer' : 'grab'; this.onNodeHover(n); }
    });

    const up = (e) => {
      const [sx, sy] = pos(e);
      if (this._dragNode) { this._dragNode.fx = null; this._dragNode.fy = null; this.sim.alphaTarget(0); }
      if (!this._moved) { const n = this._nodeAt(sx, sy); if (n) { this.selected = n; this.onNodeClick(n); } }
      this._dragNode = null; this._panning = false;
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
    }, { passive: false });
  }

  select(node) { this.selected = node; this.focusNode(node); }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = r.width; this.height = r.height;
    this.canvas.width = r.width * pr; this.canvas.height = r.height * pr;
    this.ctx.setTransform(pr, 0, 0, pr, 0, 0);
  }

  /* ---- render loop ------------------------------------------------------ */
  _loop() {
    if (!this._running) return;
    requestAnimationFrame(() => this._loop());
    this._t += 0.016;
    if (this._fitScheduled && this.sim.alpha() < 0.7) { this.fitView(); this._fitScheduled = false; }
    this._draw();
  }

  _draw() {
    const ctx = this.ctx, { k, x: tx, y: ty } = this.transform;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(tx, ty); ctx.scale(k, k);

    const sel = this.selected, hov = this.hover;
    const neighbors = new Set();
    if (sel) { neighbors.add(sel.id); for (const l of this.links) { if (l.source.id === sel.id) neighbors.add(l.target.id); if (l.target.id === sel.id) neighbors.add(l.source.id); } }

    // --- links (curved glowing synapses) ---
    for (const l of this.links) {
      const s = l.source, t = l.target;
      const active = sel && (l.source.id === sel.id || l.target.id === sel.id);
      const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
      const nx = -(t.y - s.y), ny = (t.x - s.x);
      const len = Math.hypot(nx, ny) || 1;
      const bow = 10;
      const cx = mx + (nx / len) * bow, cy = my + (ny / len) * bow;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(cx, cy, t.x, t.y);
      ctx.strokeStyle = active ? this.accent : 'rgba(120,150,190,0.16)';
      ctx.globalAlpha = active ? 0.9 : (sel ? 0.06 : 0.5);
      ctx.lineWidth = (active ? 1.4 : 0.7) / k;
      ctx.stroke();

      // travelling pulse
      if (!sel || active) {
        const p = (this._t * 0.25 + (l.source.x * 0.013 + l.target.y * 0.017)) % 1;
        const px = (1 - p) * (1 - p) * s.x + 2 * (1 - p) * p * cx + p * p * t.x;
        const py = (1 - p) * (1 - p) * s.y + 2 * (1 - p) * p * cy + p * p * t.y;
        ctx.beginPath();
        ctx.arc(px, py, (active ? 2.2 : 1.4) / k, 0, Math.PI * 2);
        ctx.fillStyle = active ? this.accent : 'rgba(150,190,230,0.6)';
        ctx.globalAlpha = active ? 1 : 0.5;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // --- nodes ---
    for (const n of this.nodes) {
      const dim = sel ? !neighbors.has(n.id) : false;
      const color = this._color(n);
      const breathe = 1 + Math.sin(this._t * 1.4 + (n.x + n.y) * 0.03) * 0.06;
      const r = n.r * breathe;
      const isFocus = n === sel || n === hov;

      // glow
      ctx.globalAlpha = dim ? 0.28 : 1;
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.2);
      g.addColorStop(0, this._rgba(color, isFocus ? 0.5 : 0.28));
      g.addColorStop(1, this._rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(n.x, n.y, r * 3.2, 0, Math.PI * 2); ctx.fill();

      // core
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.type === 'skill' ? '#0c1119' : this._rgba(color, 0.95);
      ctx.fill();
      ctx.lineWidth = (isFocus ? 2 : 1.2) / k;
      ctx.strokeStyle = this._rgba(color, isFocus ? 1 : 0.8);
      ctx.stroke();

      // label
      const showLabel = isFocus || n.type === 'person' || n.type === 'education' || (n.r > 8 && k > 0.7) || (n.type === 'skill' && k > 1.4);
      if (showLabel && !dim) {
        ctx.font = `${(n.type === 'skill' ? 9.5 : 11) / k}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = isFocus ? '#EAEEF6' : 'rgba(183,192,208,0.85)';
        const label = n.label.length > 34 ? n.label.slice(0, 32) + '…' : n.label;
        ctx.fillText(label, n.x, n.y + r + 4 / k);
      }
    }
    ctx.restore();
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

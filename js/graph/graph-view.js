/* =========================================================================
   graph-view.js — controller for the 3-panel section view.
   Left = domain overview · Center = knowledge graph · Right = node detail.
   ========================================================================= */
import { getDomainSubgraph } from '../data/build-graph.js';
import { ForceGraph } from './force-graph.js';
import { renderDetail, renderEmpty } from './node-panel.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TYPE_COLORS = {
  cert: '#2DD4BF', course: '#818CF8', education: '#38BDF8', work: '#60A5FA',
  person: '#EAEEF6', language: '#7DD3FC', interest: '#94A3B8', skill: '#5B6B82',
};
const TYPE_LEGEND = [
  ['project', 'Project'], ['course', 'Course'], ['cert', 'Certification'],
  ['education', 'Education'], ['work', 'Experience'], ['skill', 'Shared thread'],
];

export class GraphView {
  constructor(graph, { reducedMotion } = {}) {
    this.graph = graph;
    this.canvas = document.getElementById('graph-canvas');
    this.leftHost = document.getElementById('left-content');
    this.rightHost = document.getElementById('right-content');
    this.legendHost = document.getElementById('graph-legend');
    this.panelRight = document.getElementById('panel-right');
    this.panelLeft = document.getElementById('panel-left');

    this.fg = new ForceGraph(this.canvas, {
      onNodeClick: (n) => this.selectNode(n),
      onNodeHover: () => {},
      reducedMotion,
    });
    this._ensureMobileToggles();
  }

  pause() { this.fg.pause(); }
  resume() { this.fg.resume(); }

  colorFor(node) {
    if (node.type === 'project') return this.domain.accent;
    return TYPE_COLORS[node.type] || this.domain.accent;
  }

  open(domainId) {
    const sub = getDomainSubgraph(this.graph, domainId);
    this.domain = sub.domain;
    this.sub = sub;
    document.documentElement.style.setProperty('--dom', sub.domain.accent);
    this._renderLeft(sub);
    this._renderLegend(sub);
    this.fg.setData(sub);
    renderEmpty(this.rightHost);
    this.panelRight.classList.remove('is-open');
    this.canvas.focus?.();
  }

  selectNode(nodeOrId) {
    const node = typeof nodeOrId === 'string' ? this.sub.nodes.find((n) => n.id === nodeOrId) : nodeOrId;
    if (!node) return;
    this.fg.select(node);
    const connections = this._connectionsOf(node);
    renderDetail(this.rightHost, node, this.domain, connections, (id) => this.selectNode(id));
    this.panelRight.classList.add('is-open');
    // mark active in left nav
    this.leftHost.querySelectorAll('.dom-nav__item').forEach((el) =>
      el.classList.toggle('is-active', el.dataset.node === node.id));
  }

  _connectionsOf(node) {
    const out = [];
    const seen = new Set();
    for (const l of this.sub.links) {
      let other = null;
      if (l.source.id === node.id) other = l.target;
      else if (l.target.id === node.id) other = l.source;
      else if (l.source === node.id) other = this.sub.nodes.find((n) => n.id === l.target);
      else if (l.target === node.id) other = this.sub.nodes.find((n) => n.id === l.source);
      if (other && !seen.has(other.id)) {
        seen.add(other.id);
        out.push({ id: other.id, label: other.label, color: this.colorFor(other) });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }

  _renderLeft(sub) {
    const d = sub.domain;
    const content = sub.nodes.filter((n) => n.type !== 'skill');
    const counts = {};
    for (const n of content) counts[n.type] = (counts[n.type] || 0) + 1;
    const skillCount = sub.nodes.filter((n) => n.type === 'skill').length;

    const statPairs = [];
    if (counts.project) statPairs.push([counts.project, 'Projects']);
    if (counts.course) statPairs.push([counts.course, 'Courses']);
    if (counts.cert) statPairs.push([counts.cert, 'Certs']);
    if (counts.education) statPairs.push([counts.education, 'Degrees']);
    if (counts.work) statPairs.push([counts.work, 'Roles']);
    statPairs.push([skillCount, 'Threads']);

    const stats = statPairs.slice(0, 4).map(([n, l]) =>
      `<div class="dom-stat"><div class="dom-stat__num">${n}</div><div class="dom-stat__lbl">${l}</div></div>`).join('');

    const anchors = content
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .map((n) => `<button class="dom-nav__item" data-node="${esc(n.id)}">
        <span class="dom-nav__dot" style="color:${this.colorFor(n)}"></span>
        <span>${esc(n.label)}</span></button>`).join('');

    this.leftHost.innerHTML = `
      <div class="dom-accent-bar"></div>
      <div class="dom-kicker">${esc(d.region)}</div>
      <h1 class="dom-title">${esc(d.label)}</h1>
      <div class="dom-region">${esc(d.short)}</div>
      <p class="dom-desc">${esc(d.description)}</p>
      <div class="dom-stats">${stats}</div>
      <div class="dom-section-title">Nodes in this domain</div>
      <div class="dom-nav">${anchors}</div>`;

    this.leftHost.querySelectorAll('.dom-nav__item').forEach((btn) => {
      btn.addEventListener('click', () => { this.selectNode(btn.dataset.node); this._closeMobilePanels('left'); });
    });
  }

  _renderLegend(sub) {
    const present = new Set(sub.nodes.map((n) => n.type));
    const items = TYPE_LEGEND.filter(([t]) => present.has(t));
    this.legendHost.innerHTML = items.map(([t, label]) => {
      const color = t === 'project' ? this.domain.accent : (TYPE_COLORS[t] || this.domain.accent);
      return `<span class="graph-legend__item"><span class="graph-legend__dot" style="background:${color}"></span>${label}</span>`;
    }).join('');
  }

  /* mobile: slide-in panels */
  _ensureMobileToggles() {
    const stage = this.canvas.parentElement;
    const rBtn = document.createElement('button');
    rBtn.className = 'mobile-panel-toggle';
    rBtn.textContent = 'Overview';
    rBtn.addEventListener('click', () => this.panelLeft.classList.toggle('is-open'));
    stage.appendChild(rBtn);
    // tap empty graph closes panels on mobile
    this.canvas.addEventListener('pointerdown', () => this._closeMobilePanels());
  }
  _closeMobilePanels(which) {
    if (which !== 'right') this.panelLeft.classList.remove('is-open');
    if (which !== 'left') this.panelRight.classList.remove('is-open');
  }

  refit() { this.fg.resize(); this.fg.fitView(); }
  destroy() { this.fg.destroy(); }
}

/* =========================================================================
   tree-view.js — controller for a region's knowledge view.
   Left = region overview · Center = progressive hierarchy · Right = detail.
   A breadcrumb (Mind ▸ Region ▸ … ▸ Node) always allows return.
   ========================================================================= */
import { TreeGraph } from './tree-graph.js';
import { renderDetail, renderEmpty } from './node-panel.js';
import { getChildren, getPath, getRegionStats } from '../data/build-tree.js';
import { go } from '../router.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TYPE_DOT = {
  degree: '#818CF8', course: '#8FA0FF', work: '#60A5FA', project: '#22D3EE',
  research: '#A78BFA', cert: '#2DD4BF', certgroup: '#2DD4BF', group: '#9AA7BD',
  skill: '#EAEEF6', language: '#7DD3FC', interest: '#94A3B8', tech: '#5B6B82', contact: '#38BDF8',
};

export class TreeView {
  constructor(tree, { reducedMotion, mobile, onExit } = {}) {
    this.tree = tree;
    this.mobile = !!mobile;
    this.onExit = onExit || (() => {});
    this.canvas = document.getElementById('graph-canvas');
    this.leftHost = document.getElementById('left-content');
    this.rightHost = document.getElementById('right-content');
    this.crumbHost = document.getElementById('breadcrumb');
    this.panelRight = document.getElementById('panel-right');
    this.panelLeft = document.getElementById('panel-left');

    this.fg = new TreeGraph(this.canvas, {
      onSelect: (id) => this.selectNode(id, false),
      reducedMotion,
    });
    this._ensureMobileToggles();
  }

  pause() { this.fg.pause(); }
  resume() { this.fg.resume(); }
  colorFor(node) { return node.type === 'region' ? this.region.accent : (TYPE_DOT[node.type] || this.region.accent); }

  open(regionId, nodeId) {
    this.regionId = regionId;
    this.region = this.tree.byId.get(`region:${regionId}`);
    document.documentElement.style.setProperty('--dom', this.region.accent);
    this._renderLeft();
    this.fg.setTree(this.tree, regionId, this.region.accent);
    renderEmpty(this.rightHost);
    this.panelRight.classList.remove('is-open');
    this._renderCrumb(null);
    if (nodeId && this.tree.byId.has(nodeId)) requestAnimationFrame(() => this.selectNode(nodeId, true));
    this.canvas.focus?.();
  }

  /** navigate to a node, hopping to its region's tree if it lives elsewhere */
  navigateToNode(id) {
    const n = this.tree.byId.get(id);
    if (!n) return;
    if (n.region && n.region !== this.regionId) go(`#/region/${n.region}/${id}`);
    else this.selectNode(id, true);
  }

  selectNode(id, reveal) {
    const node = this.tree.byId.get(id);
    if (!node) return;
    if (reveal) this.fg.revealAndSelect(id);
    else this.fg.select(id);
    const connections = this._connectionsOf(node);
    renderDetail(this.rightHost, node, this.region, connections, (cid) => this.navigateToNode(cid));
    this.panelRight.classList.add('is-open');
    this._renderCrumb(id);
    this.leftHost.querySelectorAll('.dom-nav__item').forEach((el) =>
      el.classList.toggle('is-active', el.dataset.node === id));
  }

  /* children (parent→child) + curated cross-links, for the detail panel */
  _connectionsOf(node) {
    const out = [];
    const seen = new Set();
    const push = (n, note) => {
      if (n && !seen.has(n.id)) { seen.add(n.id); out.push({ id: n.id, label: n.label, color: this.colorFor(n), note }); }
    };
    getChildren(this.tree, node.id).forEach((c) => push(c, null));
    (this.tree.crossByNode.get(node.id) || []).forEach((x) => push(this.tree.byId.get(x.id), x.note));
    const parent = this.tree.byId.get(this.tree.parentById.get(node.id));
    if (parent && parent.type !== 'region') push(parent, 'part of');
    return out;
  }

  _renderLeft() {
    const d = this.region;
    const s = getRegionStats(this.tree, this.regionId);
    const children = getChildren(this.tree, `region:${this.regionId}`);

    const stat = (num, lbl) => `<div class="dom-stat"><div class="dom-stat__num">${num}</div><div class="dom-stat__lbl">${lbl}</div></div>`;
    const stats = `<div class="dom-stats">${stat(s.items, 'Items')}${stat(children.length, 'Branches')}</div>`;

    const nav = children.map((n) => `
      <button class="dom-nav__item" data-node="${esc(n.id)}">
        <span class="dom-nav__dot" style="background:${this.colorFor(n)}"></span>
        <span class="dom-nav__lbl">${esc(n.label)}</span>
        ${this.tree.childrenById.get(n.id)?.length ? `<span class="dom-nav__count">${this.tree.childrenById.get(n.id).length}</span>` : ''}
      </button>`).join('');

    this.leftHost.innerHTML = `
      <div class="dom-accent-bar"></div>
      <div class="dom-kicker">${esc(d.sub)}</div>
      <h1 class="dom-title">${esc(d.label)}</h1>
      <p class="dom-desc">${esc(d.desc)}</p>
      ${stats}
      <div class="dom-section-title">Explore</div>
      <div class="dom-nav">${nav}</div>`;

    this.leftHost.querySelectorAll('.dom-nav__item').forEach((btn) =>
      btn.addEventListener('click', () => { this.selectNode(btn.dataset.node, true); this._closeMobilePanels('left'); }));
  }

  _renderCrumb(nodeId) {
    if (!this.crumbHost) return;
    const items = [{ label: 'The mind', href: '#/' }, { label: this.region.label, href: `#/region/${this.regionId}` }];
    if (nodeId) {
      const path = getPath(this.tree, nodeId).filter((n) => n.type !== 'region');
      path.forEach((n) => items.push({ label: n.label, node: n.id }));
    }
    this.crumbHost.innerHTML = items.map((it, i) => {
      const last = i === items.length - 1;
      const inner = `<span class="crumb__label">${esc(it.label)}</span>`;
      const el = it.href
        ? `<a class="crumb${last ? ' is-current' : ''}" href="${it.href}">${inner}</a>`
        : `<button class="crumb${last ? ' is-current' : ''}" data-node="${esc(it.node)}">${inner}</button>`;
      return el + (last ? '' : '<span class="crumb__sep" aria-hidden="true">›</span>');
    }).join('');
    this.crumbHost.querySelectorAll('button[data-node]').forEach((b) =>
      b.addEventListener('click', () => this.selectNode(b.dataset.node, true)));
  }

  /** Esc: step up one level (deselect → back to region). Returns true if handled. */
  handleEscape() {
    if (this.panelRight.classList.contains('is-open')) {
      this.panelRight.classList.remove('is-open');
      this.fg.selected = null;
      renderEmpty(this.rightHost);
      this._renderCrumb(null);
      this.leftHost.querySelectorAll('.dom-nav__item.is-active').forEach((el) => el.classList.remove('is-active'));
      return true;
    }
    return false;
  }

  _ensureMobileToggles() {
    const stage = this.canvas.parentElement;
    if (stage.querySelector('.mobile-panel-toggle')) return;
    const btn = document.createElement('button');
    btn.className = 'mobile-panel-toggle';
    btn.textContent = 'Overview';
    btn.addEventListener('click', () => this.panelLeft.classList.toggle('is-open'));
    stage.appendChild(btn);
    this.canvas.addEventListener('pointerdown', () => this._closeMobilePanels());
  }
  _closeMobilePanels(which) {
    if (which !== 'right') this.panelLeft.classList.remove('is-open');
    if (which !== 'left') this.panelRight.classList.remove('is-open');
  }

  refit() { this.fg.resize(); this.fg.fitView(); }
  destroy() { this.fg.destroy(); }
}

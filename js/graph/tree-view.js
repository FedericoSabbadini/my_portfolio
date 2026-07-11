/* =========================================================================
   tree-view.js — controller for a region's knowledge view.
   Left = region overview · Centre = one of four render modes · Right = detail.

   Centre stage adapts to the shape of the content (a graph is only right when
   there are real branches):
     • graph     → Education · Projects · Certifications (topic → item → tech)
     • timeline  → Work (a chronological path, not a star)
     • profile   → About (a real profile, not four terse nodes)
     • contacts  → Contacts (a clean channel card)
   ========================================================================= */
import { TreeGraph } from './tree-graph.js';
import { renderDetail, renderEmpty } from './node-panel.js';
import { getChildren, getPath, getRegionStats, getRegionMode } from '../data/build-tree.js';
import { go } from '../router.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TYPE_DOT = {
  degree: '#818CF8', course: '#8FA0FF', work: '#60A5FA', project: '#22D3EE',
  research: '#A78BFA', cert: '#2DD4BF', topicgroup: '#9AA7BD', group: '#9AA7BD',
  skill: '#EAEEF6', language: '#7DD3FC', interest: '#94A3B8', tech: '#5B6B82', contact: '#38BDF8',
};
const CONTACT_GLYPH = { email: '✉', github: '↗', linkedin: 'in', phone: '☎', 'curriculum-vitae': '▤', 'europass-cv': '▤', 'cover-letter': '▤' };

export class TreeView {
  constructor(tree, { reducedMotion, mobile, onExit } = {}) {
    this.tree = tree;
    this.mobile = !!mobile;
    this.onExit = onExit || (() => {});
    this.canvas = document.getElementById('graph-canvas');
    this.stage = this.canvas.parentElement;
    this.leftHost = document.getElementById('left-content');
    this.rightHost = document.getElementById('right-content');
    this.crumbHost = document.getElementById('breadcrumb');
    this.panelRight = document.getElementById('panel-right');
    this.panelLeft = document.getElementById('panel-left');
    this.sectionView = document.getElementById('section-view');
    this.hint = document.getElementById('graph-hint');

    // DOM container for the panel render modes (profile / timeline / contacts)
    this.stagePanel = document.getElementById('stage-panel');
    if (!this.stagePanel) {
      this.stagePanel = document.createElement('div');
      this.stagePanel.id = 'stage-panel';
      this.stagePanel.className = 'stage-panel';
      this.stagePanel.hidden = true;
      this.stage.appendChild(this.stagePanel);
    }

    this.fg = new TreeGraph(this.canvas, {
      onSelect: (id) => this.selectNode(id, false),
      reducedMotion,
    });
    this._ensureMobileToggles();
  }

  pause() { this.fg.pause(); }
  resume() { if (this.mode === 'graph') this.fg.resume(); }
  colorFor(node) { return node.type === 'region' ? this.region.accent : (TYPE_DOT[node.type] || this.region.accent); }

  open(regionId, nodeId) {
    this.regionId = regionId;
    this.region = this.tree.byId.get(`region:${regionId}`);
    this.mode = getRegionMode(regionId);
    document.documentElement.style.setProperty('--dom', this.region.accent);

    const panelMode = this.mode !== 'graph';
    this.sectionView.classList.toggle('is-panelmode', panelMode);
    this.canvas.hidden = panelMode;
    this.stagePanel.hidden = !panelMode;
    if (this.hint) this.hint.style.display = panelMode ? 'none' : '';

    this._renderLeft(panelMode);
    this._renderCrumb(null);

    if (panelMode) {
      this.fg.pause();
      if (this.mode === 'profile') this._renderProfile();
      else if (this.mode === 'timeline') this._renderTimeline();
      else if (this.mode === 'contacts') this._renderContacts();
      this.panelRight.classList.remove('is-open');
      this.stagePanel.scrollTop = 0;
    } else {
      this.fg.setTree(this.tree, regionId, this.region.accent);
      renderEmpty(this.rightHost);
      this.panelRight.classList.remove('is-open');
      if (nodeId && this.tree.byId.has(nodeId)) requestAnimationFrame(() => this.selectNode(nodeId, true));
      this.canvas.focus?.();
    }
  }

  navigateToNode(id) {
    const n = this.tree.byId.get(id);
    if (!n) return;
    if (n.region && n.region !== this.regionId) go(`#/region/${n.region}/${id}`);
    else if (this.mode === 'graph') this.selectNode(id, true);
  }

  selectNode(id, reveal) {
    if (this.mode !== 'graph') return;
    const node = this.tree.byId.get(id);
    if (!node) return;
    if (reveal) this.fg.revealAndSelect(id); else this.fg.select(id);
    const connections = this._connectionsOf(node);
    renderDetail(this.rightHost, node, this.region, connections, (cid) => this.navigateToNode(cid));
    this.panelRight.classList.add('is-open');
    this._renderCrumb(id);
    this.leftHost.querySelectorAll('.dom-nav__item').forEach((el) =>
      el.classList.toggle('is-active', el.dataset.node === id));
  }

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

  /* ---- left overview panel --------------------------------------------- */
  _renderLeft(panelMode) {
    const d = this.region;
    const s = getRegionStats(this.tree, this.regionId);
    const children = getChildren(this.tree, `region:${this.regionId}`);

    const stat = (num, lbl) => `<div class="dom-stat"><div class="dom-stat__num">${num}</div><div class="dom-stat__lbl">${lbl}</div></div>`;
    // stats only where they read as meaningful (a profile / contact card doesn't)
    const showStats = this.mode === 'graph' || this.mode === 'timeline';
    const branchLabel = this.mode === 'timeline' ? 'Steps' : 'Branches';
    const stats = showStats
      ? `<div class="dom-stats">${stat(s.items, 'Items')}${stat(children.filter((c) => c.type !== 'skill').length || children.length, branchLabel)}</div>`
      : '';

    let nav = '';
    if (!panelMode) {
      nav = `<div class="dom-section-title">Explore</div><div class="dom-nav">${children.map((n) => `
        <button class="dom-nav__item" data-node="${esc(n.id)}">
          <span class="dom-nav__dot" style="background:${this.colorFor(n)}"></span>
          <span class="dom-nav__lbl">${esc(n.label)}</span>
          ${this.tree.childrenById.get(n.id)?.length ? `<span class="dom-nav__count">${this.tree.childrenById.get(n.id).length}</span>` : ''}
        </button>`).join('')}</div>`;
    }

    this.leftHost.innerHTML = `
      <div class="dom-accent-bar"></div>
      <div class="dom-kicker">${esc(d.sub)}</div>
      <h1 class="dom-title">${esc(d.label)}</h1>
      <p class="dom-desc">${esc(d.desc)}</p>
      ${stats}
      ${nav}`;

    this.leftHost.querySelectorAll('.dom-nav__item').forEach((btn) =>
      btn.addEventListener('click', () => { this.selectNode(btn.dataset.node, true); this._closeMobilePanels('left'); }));
  }

  /* ---- PROFILE (About) ------------------------------------------------- */
  _renderProfile() {
    const m = this.region.meta || {};
    const bio = (m.bio || []).map((p) => `<p>${esc(p)}</p>`).join('');
    const stats = (m.stats || []).map((s) => `
      <div class="pf-stat"><span class="pf-stat__num">${esc(s.number)}</span>
      <span class="pf-stat__lbl">${esc(s.label)}${s.sublabel ? ` · ${esc(s.sublabel)}` : ''}</span></div>`).join('');
    const skills = (m.topSkills || []).map((s) => `<span class="chip chip--lg">${esc(s)}</span>`).join('');
    const langs = (m.languages || []).map((l) => `
      <div class="pf-lang">
        <div class="pf-lang__top"><span>${esc(`${l.flag || ''} ${l.name}`.trim())}</span><span class="pf-lang__lvl">${esc(l.level)}</span></div>
        <div class="pf-meter"><i style="width:${Math.max(6, l.percentage || 0)}%"></i></div>
        ${l.detail ? `<div class="pf-lang__detail">${esc(l.detail)}</div>` : ''}
      </div>`).join('');
    const interests = (m.interests || []).map((it) => `
      <div class="pf-interest"><span class="pf-interest__ico">${esc(it.icon || '')}</span>
      <div><div class="pf-interest__t">${esc(it.title)}</div><div class="pf-interest__d">${esc(it.description)}</div></div></div>`).join('');

    this.stagePanel.innerHTML = `
      <div class="stage-scroll">
        <div class="profile">
          <header class="pf-head">
            ${m.profileImage ? `<img class="pf-avatar" src="${esc(m.profileImage)}" alt="${esc(m.name)}" loading="lazy" onerror="this.remove()" />` : ''}
            <div>
              <h2 class="pf-name">${esc(m.name)}</h2>
              <p class="pf-title">${esc(m.title)}</p>
              ${m.location ? `<p class="pf-loc">◍ ${esc(m.location)}</p>` : ''}
            </div>
          </header>
          <div class="pf-bio">${bio}</div>
          ${stats ? `<div class="pf-stats">${stats}</div>` : ''}
          ${skills ? `<section class="pf-sec"><h3 class="pf-sec__t">Core skills</h3><div class="pf-chips">${skills}</div></section>` : ''}
          ${langs ? `<section class="pf-sec"><h3 class="pf-sec__t">Languages</h3><div class="pf-langs">${langs}</div></section>` : ''}
          ${interests ? `<section class="pf-sec"><h3 class="pf-sec__t">Beyond the screen</h3><div class="pf-interests">${interests}</div></section>` : ''}
        </div>
      </div>`;
  }

  /* ---- TIMELINE (Work) ------------------------------------------------- */
  _renderTimeline() {
    const ORDER = { Internship: 0, Academic: 1, Work: 2 };
    const items = getChildren(this.tree, `region:${this.regionId}`).slice().sort((a, b) =>
      (a.startKey || 0) - (b.startKey || 0) || ((ORDER[a.data?.type] ?? 9) - (ORDER[b.data?.type] ?? 9)));
    const rows = items.map((n) => {
      const w = n.data || {};
      const resp = (w.responsibilities || []).map((r) => `<li>${esc(r)}</li>`).join('');
      const tech = (n.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
      return `
        <li class="tl-item">
          <span class="tl-dot"></span>
          <div class="tl-card">
            <div class="tl-when">${esc(w.period || n.sub)}</div>
            <h3 class="tl-title">${esc(n.label)}</h3>
            <div class="tl-org">${esc(w.company || '')}${w.location ? ` · ${esc(w.location)}` : ''}${n.badge ? ` · <span class="tl-badge">${esc(n.badge)}</span>` : ''}</div>
            <p class="tl-desc">${esc(n.desc)}</p>
            ${resp ? `<ul class="tl-resp">${resp}</ul>` : ''}
            ${tech ? `<div class="tl-tech">${tech}</div>` : ''}
          </div>
        </li>`;
    }).join('');
    this.stagePanel.innerHTML = `
      <div class="stage-scroll">
        <ol class="timeline">${rows}</ol>
      </div>`;
  }

  /* ---- CONTACTS -------------------------------------------------------- */
  _renderContacts() {
    const chans = getChildren(this.tree, `region:${this.regionId}`);
    const m = this.region.meta || {};
    const cards = chans.map((n) => {
      const link = (n.links || [])[0] || {};
      const key = n.id.replace('contact:', '');
      const glyph = CONTACT_GLYPH[key] || (link.kind === 'pdf' ? '▤' : '↗');
      return `
        <a class="ct-card" href="${esc(link.url)}" ${/^https?:/i.test(link.url) ? 'target="_blank" rel="noopener noreferrer"' : ''}>
          <span class="ct-glyph">${esc(glyph)}</span>
          <span class="ct-body"><span class="ct-label">${esc(n.label)}</span><span class="ct-sub">${esc(n.sub)}</span></span>
          <span class="ct-go" aria-hidden="true">→</span>
        </a>`;
    }).join('');
    this.stagePanel.innerHTML = `
      <div class="stage-scroll">
        <div class="contacts">
          <p class="ct-lead">Open to internships & first roles in AI, Data Science and Machine Learning${m.location ? ` — based in ${esc(m.location)}` : ''}.</p>
          <div class="ct-grid">${cards}</div>
        </div>
      </div>`;
  }

  /* ---- breadcrumb ------------------------------------------------------ */
  _renderCrumb(nodeId) {
    if (!this.crumbHost) return;
    // return-home lives in the brain glyph; the crumb only shows location within
    const items = [{ label: this.region.label, href: `#/region/${this.regionId}` }];
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

  handleEscape() {
    if (this.mode === 'graph' && this.panelRight.classList.contains('is-open')) {
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
    if (this.stage.querySelector('.mobile-panel-toggle')) return;
    const btn = document.createElement('button');
    btn.className = 'mobile-panel-toggle';
    btn.textContent = 'Overview';
    btn.addEventListener('click', () => this.panelLeft.classList.toggle('is-open'));
    this.stage.appendChild(btn);
    this.canvas.addEventListener('pointerdown', () => this._closeMobilePanels());
  }
  _closeMobilePanels(which) {
    if (which !== 'right') this.panelLeft.classList.remove('is-open');
    if (which !== 'left') this.panelRight.classList.remove('is-open');
  }

  refit() { if (this.mode === 'graph') { this.fg.resize(); this.fg.fitView(); } }
  destroy() { this.fg.destroy(); }
}

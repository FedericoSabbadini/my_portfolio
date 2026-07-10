/* =========================================================================
   node-panel.js — renders the right-hand detail panel for a selected node.
   ========================================================================= */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TYPE_LABEL = {
  project: 'Project', cert: 'Certification', course: 'Course', education: 'Education',
  work: 'Experience', person: 'Identity', language: 'Language', interest: 'Interest', skill: 'Skill / concept',
};

const LINK_ICON = { repo: '⌥', pdf: '▤', dataset: '⛁', research: '❖', external: '↗' };

function linksHTML(links) {
  if (!links || !links.length) return '';
  return `<div class="detail__group-label">Links</div>
    <div class="detail__links">${links.map((l) => `
      <a class="link-btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
        <span class="link-btn__ico">${LINK_ICON[l.kind] || '↗'}</span>${esc(l.label)}
      </a>`).join('')}</div>`;
}

function tagsHTML(tags) {
  if (!tags || !tags.length) return '';
  return `<div class="detail__group-label">Threads</div>
    <div class="detail__tags">${tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>`;
}

function statsHTML(stats) {
  if (!stats || !stats.length) return '';
  return `<div class="dom-stats">${stats.map((s) => `
    <div class="dom-stat"><div class="dom-stat__num">${esc(s.number)}</div>
    <div class="dom-stat__lbl">${esc(s.label)} ${esc(s.sublabel || '')}</div></div>`).join('')}</div>`;
}

function connectionsHTML(connections) {
  if (!connections || !connections.length) return '';
  return `<div class="detail__group-label">Connected (${connections.length})</div>
    <div class="detail__connections">${connections.map((c) => `
      <button class="detail__conn" data-node="${esc(c.id)}">
        <span class="detail__conn-dot" style="background:${esc(c.color)}"></span>${esc(c.label)}
      </button>`).join('')}</div>`;
}

/**
 * @param {HTMLElement} host  right panel content container
 * @param {object} node       graph node
 * @param {object} domain     current domain (for accent)
 * @param {Array}  connections [{id,label,color}]
 * @param {function} onConnectionClick(id)
 */
export function renderDetail(host, node, domain, connections, onConnectionClick) {
  const accent = node.type === 'project' ? domain.accent : (node.type === 'skill' ? '#8aa0b8' : domain.accent);
  const badge = node.badge ? `<span class="detail__badge">${esc(node.badge)}</span>` : '';
  const desc = (node.desc || '').split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('');
  const stats = node.type === 'person' ? statsHTML(node.data?.stats) : '';

  host.innerHTML = `
    <article class="detail" style="--nd:${accent}">
      <div class="detail__type">${esc(TYPE_LABEL[node.type] || node.type)}</div>
      ${badge}
      <h2 class="detail__title">${esc(node.label)}</h2>
      ${node.sub ? `<div class="detail__meta">${esc(node.sub)}</div>` : ''}
      <div class="detail__desc">${desc}</div>
      ${stats}
      ${tagsHTML(node.tags)}
      ${linksHTML(node.links)}
      ${connectionsHTML(connections)}
    </article>`;

  host.querySelectorAll('.detail__conn').forEach((btn) => {
    btn.addEventListener('click', () => onConnectionClick(btn.dataset.node));
  });
  host.scrollTop = 0;
}

export function renderEmpty(host) {
  host.innerHTML = `
    <div class="detail-empty" id="detail-empty">
      <div class="detail-empty__orb"></div>
      <p>Select a node to inspect a fragment of this domain.</p>
    </div>`;
}

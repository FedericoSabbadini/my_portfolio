/* =========================================================================
   node-panel.js — renders the right-hand detail panel for a selected node.
   The most important terms (the key concepts / tech) are surfaced right under
   the title, prominent and accent-coloured, so they read at a glance.
   ========================================================================= */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TYPE_LABEL = {
  region: 'Region', project: 'Project', research: 'Research', cert: 'Certification',
  course: 'Course', degree: 'Degree', work: 'Experience', skill: 'Core skill',
  language: 'Language', interest: 'Interest', contact: 'Contact',
  topicgroup: 'Subject', group: 'Group', person: 'Identity',
};

const LINK_ICON = { repo: '⌥', pdf: '▤', dataset: '⛁', research: '❖', external: '↗' };

function keyConceptsHTML(tags) {
  if (!tags || !tags.length) return '';
  return `<div class="detail__keys">${tags.map((t) => `<span class="keychip">${esc(t)}</span>`).join('')}</div>`;
}

function linksHTML(links) {
  if (!links || !links.length) return '';
  return `<div class="detail__group-label">Links</div>
    <div class="detail__links">${links.map((l) => `
      <a class="link-btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
        <span class="link-btn__ico">${LINK_ICON[l.kind] || '↗'}</span>${esc(l.label)}
      </a>`).join('')}</div>`;
}

function connectionsHTML(connections) {
  if (!connections || !connections.length) return '';
  return `<div class="detail__group-label">Connected (${connections.length})</div>
    <div class="detail__connections">${connections.map((c) => `
      <button class="detail__conn" data-node="${esc(c.id)}">
        <span class="detail__conn-dot" style="background:${esc(c.color)}"></span>
        <span class="detail__conn-lbl">${esc(c.label)}</span>
        ${c.note ? `<span class="detail__conn-note">${esc(c.note)}</span>` : ''}
      </button>`).join('')}</div>`;
}

/**
 * @param {HTMLElement} host  right panel content container
 * @param {object} node       graph node
 * @param {object} domain     current region (for accent)
 * @param {Array}  connections [{id,label,color,note}]
 * @param {function} onConnectionClick(id)
 */
export function renderDetail(host, node, domain, connections, onConnectionClick) {
  const accent = node.type === 'skill' ? '#c7d0e0' : domain.accent;
  const badge = node.badge ? `<span class="detail__badge">${esc(node.badge)}</span>` : '';
  const desc = (node.desc || '').split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('');

  host.innerHTML = `
    <article class="detail" style="--nd:${accent}">
      <div class="detail__type">${esc(TYPE_LABEL[node.type] || node.type)}</div>
      ${badge}
      <h2 class="detail__title">${esc(node.label)}</h2>
      ${node.sub ? `<div class="detail__meta">${esc(node.sub)}</div>` : ''}
      ${keyConceptsHTML(node.tags)}
      <div class="detail__desc">${desc}</div>
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
      <p>Select a node to inspect it.</p>
    </div>`;
}

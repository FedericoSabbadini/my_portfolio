/* =========================================================================
   region-view.js — renders catalog content for a given region.
   ========================================================================= */
import { groupBySubject } from '../data/taxonomy.js';

const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function renderRegion(regionId, data, domains) {
  const domain = domains.find((d) => d.id === regionId);
  if (!domain) return;

  document.documentElement.style.setProperty('--region-accent', domain.accent);

  // Hero
  document.getElementById('hero-dot').style.background = domain.accent;
  document.getElementById('hero-dot').style.boxShadow = `0 0 14px ${domain.accent}`;
  document.getElementById('hero-lobe').textContent = domain.region;
  document.getElementById('hero-title').textContent = domain.label;
  document.getElementById('hero-intro').textContent = domain.description;

  // Main content
  const main = document.getElementById('region-main');
  switch (regionId) {
    case 'about':     main.innerHTML = renderAbout(data); break;
    case 'education': main.innerHTML = renderEducation(data); break;
    case 'work':      main.innerHTML = renderWork(data); break;
    case 'projects':  main.innerHTML = renderGrouped(data.projects, 'Projects'); break;
    case 'certifications': main.innerHTML = renderGrouped(data.certifications, 'Certifications'); break;
    case 'contacts':  main.innerHTML = renderContacts(data); break;
    default: main.innerHTML = '';
  }

  // Footer
  renderFooter(regionId, domains);
}

/* --- ABOUT --- */
function renderAbout(data) {
  const raw = data.personal;
  const p = raw.personal || {};
  const stats = raw.stats || [];
  const languages = raw.languages || [];
  const interests = raw.interests || [];
  let html = '';

  // Bio
  if (p.bio && p.bio.length) {
    html += `<section style="margin-bottom:48px">${p.bio.map((b) => `<p style="font-size:.95rem;line-height:1.7;color:var(--ink-mut);margin-bottom:12px;max-width:62ch">${esc(b)}</p>`).join('')}</section>`;
  }

  // Stats
  if (stats.length) {
    html += `<span class="section-kicker">Key Numbers</span><div class="stats-grid" style="margin-bottom:48px">`;
    for (const s of stats) {
      html += `<div class="stat-card"><div class="stat-card__num">${esc(s.number)}</div><div class="stat-card__lbl">${esc(s.label)}</div>${s.sublabel ? `<div class="stat-card__sub">${esc(s.sublabel)}</div>` : ''}</div>`;
    }
    html += `</div>`;
  }

  // Top skills
  if (p.topSkills && p.topSkills.length) {
    html += `<span class="section-kicker">Core Skills</span><div class="skills-wrap" style="margin-bottom:48px">`;
    for (const sk of p.topSkills) html += `<span class="skill-chip">${esc(sk)}</span>`;
    html += `</div>`;
  }

  // Languages
  if (languages.length) {
    html += `<span class="section-kicker">Languages</span><div style="display:flex;flex-direction:column;gap:18px;margin-bottom:48px">`;
    for (const l of languages) {
      const pct = l.percentage || 50;
      html += `<div class="lang-item"><span class="lang-flag">${l.flag || ''}</span><div class="lang-info"><div class="lang-row"><span class="lang-name">${esc(l.name)}</span><span class="lang-level">${esc(l.level || '')}</span></div><div class="lang-bar"><div class="lang-bar__fill" style="width:${pct}%"></div></div></div></div>`;
    }
    html += `</div>`;
  }

  // Interests
  if (interests.length) {
    html += `<span class="section-kicker">Interests</span><div class="interests-grid">`;
    for (const i of interests) {
      html += `<div class="interest-card"><span class="interest-icon">${i.icon || '✦'}</span><div><div class="interest-title">${esc(i.name || i.title || '')}</div>${i.description ? `<div class="interest-desc">${esc(i.description)}</div>` : ''}</div></div>`;
    }
    html += `</div>`;
  }

  return html;
}

/* --- EDUCATION --- */
function renderEducation(data) {
  let html = '<div class="edu-block">';
  for (const ed of data.education) {
    html += `<div class="edu-entry">`;
    html += `<div class="edu-degree-head"><span class="edu-accent-bar"></span><div>`;
    html += `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="edu-degree-title">${esc(ed.degree)}</span>`;
    if (ed.status === 'in-progress') html += `<span class="edu-badge-current">In progress</span>`;
    html += `</div>`;
    html += `<div class="edu-meta">${esc(ed.institution)} · ${esc(ed.period)}</div>`;
    if (ed.gpa) html += `<div class="edu-gpa"><span class="edu-gpa-label">GPA</span> ${esc(ed.gpa)}</div>`;
    html += `</div></div>`;
    if (ed.description) html += `<p class="edu-desc">${esc(ed.description)}</p>`;

    // Links
    const links = [];
    if (ed.url) links.push(`<a class="edu-link" href="${esc(ed.url)}" target="_blank" rel="noopener">Programme ↗</a>`);
    if (ed.hfUrl) links.push(`<a class="edu-link edu-link--secondary" href="${esc(ed.hfUrl)}" target="_blank" rel="noopener">HuggingFace ↗</a>`);
    if (links.length) html += `<div class="edu-links">${links.join('')}</div>`;

    // Courses
    const level = ed.id || '';
    const courses = getCourses(data.courses, level);
    if (courses.length) {
      html += `<div style="margin-top:28px"><span class="courses-label">Courses (${courses.length})</span><div class="courses-grid">`;
      for (const c of courses) {
        html += `<div class="course-card"><div class="course-card__head"><span class="course-card__name">${esc(c.name)}</span>`;
        if (c.grade) html += `<span class="course-card__grade">${esc(c.grade)}</span>`;
        html += `</div>`;
        if (c.description) html += `<p class="course-card__desc">${esc(c.description)}</p>`;
        if (c.tags && c.tags.length) {
          html += `<div class="course-card__tags">${c.tags.map((t) => `<span class="course-card__tag">${esc(t)}</span>`).join('')}</div>`;
        }
        const clinks = [];
        if (c.url) clinks.push(`<a class="course-link course-link--primary" href="${esc(c.url)}" target="_blank" rel="noopener">Syllabus ↗</a>`);
        if (c.hfUrl) clinks.push(`<a class="course-link course-link--secondary" href="${esc(c.hfUrl)}" target="_blank" rel="noopener">Notes ↗</a>`);
        if (clinks.length) html += `<div class="course-card__links">${clinks.join('')}</div>`;
        html += `</div>`;
      }
      html += `</div></div>`;
    }
    html += `</div>`;
  }
  html += '</div>';
  return html;
}

function getCourses(coursesData, level) {
  if (!coursesData) return [];
  if (level.includes('master') || level.includes('msc')) return coursesData.masters?.courses || [];
  if (level.includes('bachelor') || level.includes('bsc')) return coursesData.bachelors?.courses || [];
  if (level.includes('high')) return coursesData.highschools?.courses || [];
  // Try matching by id substring
  for (const key of Object.keys(coursesData)) {
    if (level.includes(key) || key.includes(level)) return coursesData[key]?.courses || [];
  }
  return [];
}

/* --- WORK --- */
function renderWork(data) {
  let html = '<div class="work-timeline"><div class="work-timeline__line"></div>';
  for (const w of data.work) {
    html += `<div class="work-item"><div class="work-item__dot"></div>`;
    if (w.type) html += `<span class="work-item__type">${esc(w.type)}</span>`;
    html += `<div class="work-item__title">${esc(w.title)} — ${esc(w.company)}</div>`;
    html += `<div class="work-item__meta">${esc(w.period)}${w.location ? ` · ${esc(w.location)}` : ''}</div>`;
    if (w.description) html += `<p class="work-item__desc">${esc(w.description)}</p>`;
    if (w.responsibilities && w.responsibilities.length) {
      html += `<div class="work-item__resp">${w.responsibilities.map((r) => `<div class="work-resp"><span class="work-resp__mark">→</span><span>${esc(r)}</span></div>`).join('')}</div>`;
    }
    html += `</div>`;
  }
  html += '</div>';
  return html;
}

/* --- GROUPED (Projects / Certifications) --- */
function renderGrouped(items, title) {
  const groups = groupBySubject(items);
  let html = `<div class="group-section">`;
  for (const g of groups) {
    html += `<div><div class="group-head"><span class="group-head__dot" style="background:var(--region-accent)"></span><span class="group-head__label">${esc(g.label)}</span><span class="group-head__count">${g.items.length}</span></div>`;
    html += `<div class="group-grid">`;
    for (const item of g.items) {
      const href = item.url ? ` href="${esc(item.url)}" target="_blank" rel="noopener"` : '';
      const tag = item.url ? 'a' : 'div';
      html += `<${tag} class="group-card"${href}>`;
      html += `<div class="group-card__head"><span class="group-card__title">${esc(item.title)}</span>`;
      if (item.badge) html += `<span class="group-card__badge">${esc(item.badge)}</span>`;
      if (item.issuer) html += `<span class="group-card__badge">${esc(item.issuer)}</span>`;
      html += `</div>`;
      const meta = item.period || item.date || '';
      if (meta) html += `<div class="group-card__meta">${esc(meta)}</div>`;
      if (item.description) html += `<p class="group-card__desc">${esc(item.description)}</p>`;
      if (item.tags && item.tags.length) {
        html += `<div class="group-card__tags">${item.tags.map((t) => `<span class="group-card__tag">${esc(t)}</span>`).join('')}</div>`;
      }
      if (item.url) html += `<span class="group-card__link">${esc(item.urlLabel || 'View')} ↗</span>`;
      html += `</${tag}>`;
    }
    html += `</div></div>`;
  }
  html += '</div>';
  return html;
}

/* --- CONTACTS --- */
function renderContacts(data) {
  const raw = data.personal;
  const p = raw.personal || {};
  const social = raw.social || {};
  let html = '<div class="contacts-section">';

  // Primary
  const primary = [];
  if (p.email) primary.push({ label: 'Email', value: p.email, href: `mailto:${p.email}`, icon: '✉' });
  if (p.location) primary.push({ label: 'Location', value: p.location, icon: '📍' });

  if (primary.length) {
    html += `<div><span class="contact-group-label">Primary</span><div class="contact-grid">`;
    for (const c of primary) {
      const tag = c.href ? 'a' : 'div';
      html += `<${tag} class="contact-card"${c.href ? ` href="${esc(c.href)}"` : ''}>`;
      html += `<span class="contact-card__icon">${c.icon}</span>`;
      html += `<div class="contact-card__body"><div class="contact-card__label">${esc(c.label)}</div><div class="contact-card__value">${esc(c.value)}</div></div>`;
      html += `</${tag}>`;
    }
    html += `</div></div>`;
  }

  // Social / links
  const entries = Object.entries(social);
  if (entries.length) {
    html += `<div><span class="contact-group-label">Links & Social</span><div class="contact-grid">`;
    for (const [key, info] of entries) {
      const url = info.url || info.address || (info.number ? `tel:${info.number}` : '');
      const value = info.username || info.address || info.number || info.label || key;
      const icon = info.icon || '🔗';
      const tag = url ? 'a' : 'div';
      html += `<${tag} class="contact-card"${url ? ` href="${esc(url)}" target="_blank" rel="noopener"` : ''}>`;
      html += `<span class="contact-card__icon">${icon}</span>`;
      html += `<div class="contact-card__body"><div class="contact-card__label">${esc(info.label || key)}</div><div class="contact-card__value">${esc(value)}</div></div>`;
      if (url) html += `<span class="contact-card__action">Open ↗</span>`;
      html += `</${tag}>`;
    }
    html += `</div></div>`;
  }

  html += '</div>';
  return html;
}

/* --- FOOTER --- */
function renderFooter(currentId, domains) {
  const links = document.getElementById('footer-links');
  links.innerHTML = domains
    .filter((d) => d.id !== currentId)
    .map((d) => `<a class="region-footer__link" href="#/region/${d.id}"><span class="region-footer__link-dot" style="background:${d.accent}"></span>${esc(d.label)}</a>`)
    .join('');
}

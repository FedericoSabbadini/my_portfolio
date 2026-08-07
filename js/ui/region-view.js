/* =========================================================================
   region-view.js — renders catalog content for a given region.
   ========================================================================= */
import { groupBySubject } from '../data/taxonomy.js';

const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

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
    case 'projects':  main.innerHTML = renderGrouped(data.projects); break;
    case 'certifications': main.innerHTML = renderGrouped(data.certifications); break;
    case 'contacts':  main.innerHTML = renderContacts(data); break;
    default: main.innerHTML = '';
  }

  // Footer
  renderFooter(regionId, domains);

  wireCollapsibles(main);
}

/* Collapsible course lists: one delegated listener, bound once per element.
   Height is measured and animated in JS so it works for any content size and
   settles to `auto` (responsive) once open. */
function wireCollapsibles(main) {
  if (main.dataset.collapsibleBound) return;
  main.dataset.collapsibleBound = '1';
  main.addEventListener('click', (e) => {
    const btn = e.target.closest('.courses-toggle');
    if (!btn) return;
    const block = btn.closest('.courses-block');
    if (!block) return;
    const collapse = block.querySelector('.courses-collapse');
    const inner = block.querySelector('.courses-collapse__inner');
    if (!collapse || !inner) return;

    const opening = block.getAttribute('data-collapsed') !== 'false';
    block.setAttribute('data-collapsed', opening ? 'false' : 'true');
    btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    const hint = btn.querySelector('.courses-toggle__hint');
    if (hint) hint.textContent = opening ? 'Hide' : 'Show';

    if (opening) {
      collapse.style.height = inner.offsetHeight + 'px';
      const done = (ev) => {
        if (ev.propertyName !== 'height') return;
        collapse.style.height = 'auto';            // let it reflow responsively
        collapse.removeEventListener('transitionend', done);
      };
      collapse.addEventListener('transitionend', done);
    } else {
      // from auto → a fixed px start, then to 0 on the next frame so it animates
      collapse.style.height = collapse.offsetHeight + 'px';
      void collapse.offsetHeight;
      requestAnimationFrame(() => { collapse.style.height = '0px'; });
    }
  });
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
    html += `<section class="about-bio">${p.bio.map((b) => `<p class="about-bio__p">${esc(b)}</p>`).join('')}</section>`;
  }

  // Stats
  if (stats.length) {
    html += `<h2 class="section-kicker">Key Numbers</h2><div class="stats-grid" style="margin-bottom:48px">`;
    for (const s of stats) {
      html += `<div class="stat-card"><div class="stat-card__num">${esc(s.number)}</div><div class="stat-card__lbl">${esc(s.label)}</div>${s.sublabel ? `<div class="stat-card__sub">${esc(s.sublabel)}</div>` : ''}</div>`;
    }
    html += `</div>`;
  }

  // Top skills
  if (p.topSkills && p.topSkills.length) {
    html += `<h2 class="section-kicker">Core Skills</h2><div class="skills-wrap" style="margin-bottom:48px">`;
    for (const sk of p.topSkills) html += `<span class="skill-chip">${esc(sk)}</span>`;
    html += `</div>`;
  }

  // Languages
  if (languages.length) {
    html += `<h2 class="section-kicker">Languages</h2><div style="display:flex;flex-direction:column;gap:18px;margin-bottom:48px">`;
    for (const l of languages) {
      const pct = l.percentage || 50;
      html += `<div class="lang-item"><span class="lang-flag" aria-hidden="true">${l.flag || ''}</span><div class="lang-info"><div class="lang-row"><span class="lang-name">${esc(l.name)}</span><span class="lang-level">${esc(l.level || '')}</span></div><div class="lang-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(l.name)} proficiency"><div class="lang-bar__fill" style="width:${pct}%"></div></div></div></div>`;
    }
    html += `</div>`;
  }

  // Interests
  if (interests.length) {
    html += `<h2 class="section-kicker">Interests</h2><div class="interests-grid">`;
    for (const i of interests) {
      html += `<div class="interest-card"><span class="interest-icon" aria-hidden="true">${i.icon || '✦'}</span><div><div class="interest-title">${esc(i.name || i.title || '')}</div>${i.description ? `<div class="interest-desc">${esc(i.description)}</div>` : ''}</div></div>`;
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
    html += `<div class="edu-degree-head"><span class="edu-accent-bar" aria-hidden="true"></span><div>`;
    html += `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 class="edu-degree-title">${esc(ed.degree)}</h2>`;
    if (ed.status === 'current') html += `<span class="edu-badge-current">${esc(ed.statusLabel || 'Current')}</span>`;
    html += `</div>`;
    html += `<div class="edu-meta">${esc(ed.institution)} · ${esc(ed.period)}</div>`;
    if (ed.gpa) html += `<div class="edu-gpa"><span class="edu-gpa-label">GPA</span> ${esc(ed.gpa)}</div>`;
    html += `</div></div>`;
    if (ed.description) html += `<p class="edu-desc">${esc(ed.description)}</p>`;

    // Links
    const links = [];
    if (ed.url) links.push(`<a class="edu-link" href="${esc(ed.url)}" target="_blank" rel="noopener">Programme ↗</a>`);
    if (ed.hfUrl) links.push(`<a class="edu-link edu-link--secondary" href="${esc(ed.hfUrl)}" target="_blank" rel="noopener">Study notes ↗</a>`);
    if (links.length) html += `<div class="edu-links">${links.join('')}</div>`;

    // Courses — collapsed by default (a degree can carry many), click to expand
    const courses = getCourses(data.courses, ed.id || '');
    if (courses.length) {
      const cid = `courses-${esc(ed.id || Math.random().toString(36).slice(2))}`;
      html += `<div class="courses-block" data-collapsed="true">
        <button class="courses-toggle" type="button" aria-expanded="false" aria-controls="${cid}">
          <span class="courses-toggle__label">Courses</span>
          <span class="courses-toggle__count">${courses.length}</span>
          <span class="courses-toggle__hint">Show</span>
          <svg class="courses-toggle__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="courses-collapse"><div class="courses-collapse__inner">
        <div class="courses-grid" id="${cid}">`;
      for (const c of courses) {
        const ongoing = /^current$/i.test(c.grade || '');
        html += `<div class="course-card"><div class="course-card__head"><h4 class="course-card__name">${esc(c.name)}</h4>`;
        if (c.grade) html += `<span class="course-card__grade${ongoing ? ' course-card__grade--ongoing' : ''}">${ongoing ? 'In progress' : esc(c.grade)}</span>`;
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
      html += `</div></div></div></div>`;
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
  for (const key of Object.keys(coursesData)) {
    if (level.includes(key) || key.includes(level)) return coursesData[key]?.courses || [];
  }
  return [];
}

/* --- WORK --- */
function renderWork(data) {
  let html = '<div class="work-timeline"><div class="work-timeline__line" aria-hidden="true"></div>';
  for (const w of data.work) {
    html += `<div class="work-item"><div class="work-item__dot" aria-hidden="true"></div>`;
    if (w.type || w.logo) {
      html += `<div class="work-item__head">`;
      html += w.type ? `<span class="work-item__type">${esc(w.type)}</span>` : `<span></span>`;
      if (w.logo) {
        const img = `<img class="work-item__logo" src="${esc(w.logo)}" alt="${esc(w.company || w.title)} logo" loading="lazy" />`;
        const logoHref = w.logoUrl || w.url;
        html += logoHref
          ? `<a class="work-item__logo-link" href="${esc(logoHref)}" target="_blank" rel="noopener" aria-label="${esc(w.company || w.title)} website">${img}</a>`
          : img;
      }
      html += `</div>`;
    }
    html += `<h2 class="work-item__title">${esc(w.title)}${w.company ? ` — ${esc(w.company)}` : ''}</h2>`;
    html += `<div class="work-item__meta">${esc(w.period)}${w.location ? ` · ${esc(w.location)}` : ''}</div>`;
    if (w.url) {
      const label = w.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      html += `<a class="work-item__link" href="${esc(w.url)}" target="_blank" rel="noopener">${esc(label)} <span aria-hidden="true">↗</span></a>`;
    }
    if (w.description) html += `<p class="work-item__desc">${esc(w.description)}</p>`;
    if (w.responsibilities && w.responsibilities.length) {
      html += `<ul class="work-item__resp">${w.responsibilities.map((r) => `<li class="work-resp"><span class="work-resp__mark" aria-hidden="true">→</span><span>${esc(r)}</span></li>`).join('')}</ul>`;
    }
    if (w.technologies && w.technologies.length) {
      html += `<ul class="work-tags">${w.technologies.map((t) => `<li class="work-tag">${esc(t)}</li>`).join('')}</ul>`;
    }
    html += `</div>`;
  }
  html += '</div>';
  return html;
}

/* --- GROUPED (Projects / Certifications) --- */
function renderGrouped(items) {
  const groups = groupBySubject(items || []);
  if (!groups.length) {
    return `<p class="region-empty">Nothing to show here yet — check back soon.</p>`;
  }
  let html = `<div class="group-section">`;
  for (const g of groups) {
    html += `<section><div class="group-head"><span class="group-head__dot" style="background:var(--region-accent)" aria-hidden="true"></span><h2 class="group-head__label">${esc(g.label)}</h2><span class="group-head__count">${g.items.length}</span></div>`;
    html += `<div class="group-grid">`;
    for (const item of g.items) {
      const href = item.url ? ` href="${esc(item.url)}" target="_blank" rel="noopener"` : '';
      const tag = item.url ? 'a' : 'div';
      const badge = item.badge || item.issuer;
      html += `<${tag} class="group-card"${href}>`;
      html += `<div class="group-card__head"><h3 class="group-card__title">${esc(item.title)}</h3>`;
      if (badge) html += `<span class="group-card__badge">${esc(badge)}</span>`;
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
    html += `</div></section>`;
  }
  html += '</div>';
  return html;
}

/* --- CONTACTS --- */
function renderContacts(data) {
  const raw = data.personal;
  const p = raw.personal || {};
  const social = raw.social || {};
  let html = '';

  // Lead: give the page a voice — who I am to reach, why, and one clear action.
  html += `<div class="contacts-lead">
    <p class="contacts-lead__title">Let's talk.</p>
    <p class="contacts-lead__text">Open to collaborations, a Master's-thesis internship and full-time roles from spring 2027 — in AI, Data &amp; Cybersecurity. Email is the surest way to reach me, and I reply to every message.</p>
    ${p.email ? `<a class="contacts-lead__cta" href="mailto:${esc(p.email)}">Write me <span aria-hidden="true">→</span></a>` : ''}
  </div>`;

  html += '<div class="contacts-section">';

  // Primary
  const primary = [];
  if (p.email) {
    // Display the domain only (e.g. "@icloud.com"); the mailto + title keep the full address.
    const shortEmail = p.email.includes('@') ? `@${p.email.split('@').pop()}` : p.email;
    primary.push({ label: 'Email', value: shortEmail, title: p.email, href: `mailto:${p.email}`, icon: '✉', action: 'Email' });
  }
  if (p.location) {
    const mapUrl = p.locationUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.location)}`;
    primary.push({ label: 'Location', value: p.location, title: `Open ${p.location} in Google Maps`, href: mapUrl, icon: '📍', action: 'Map' });
  }
  if (primary.length) html += contactGroup('Primary', primary);

  // Classify the rest of the entries into social links and downloadable docs
  const docKeys = new Set(['cv', 'europass', 'coverletter', 'resume']);
  const links = [], docs = [];
  for (const [key, info] of Object.entries(social)) {
    const k = key.toLowerCase();
    if (k === 'email') continue;                 // already shown in Primary
    const label = info.label || cap(key);
    const icon = info.icon || '🔗';
    if (docKeys.has(k) && info.url) {
      docs.push({ label, value: 'PDF document', href: info.url, icon, action: 'Download', download: true });
    } else {
      const href = info.url
        || (info.address ? `mailto:${info.address}` : '')
        || (info.number ? `tel:${info.number}` : '');
      const value = info.username || info.address || info.number || label;
      const action = href.startsWith('tel:') ? 'Call' : (href.startsWith('mailto:') ? 'Email' : 'Open');
      links.push({ label, value, href, icon, action });
    }
  }
  if (links.length) html += contactGroup('Links & Social', links);
  if (docs.length) html += contactGroup('Documents', docs);

  html += '</div>';
  return html;
}

function contactGroup(title, items) {
  let h = `<section><h2 class="contact-group-label">${esc(title)}</h2><div class="contact-grid">`;
  for (const c of items) {
    const tag = c.href ? 'a' : 'div';
    const external = /^https?:\/\//i.test(c.href || '') || c.download;
    let attrs = '';
    if (c.href) {
      attrs = ` href="${esc(c.href)}"`;
      if (external) attrs += ' target="_blank" rel="noopener"';
      if (c.download) attrs += ' download';
    }
    if (c.title) attrs += ` title="${esc(c.title)}"`;
    h += `<${tag} class="contact-card${c.wide ? ' contact-card--wide' : ''}"${attrs}>`;
    h += `<span class="contact-card__icon" aria-hidden="true">${c.icon}</span>`;
    h += `<div class="contact-card__body"><div class="contact-card__label">${esc(c.label)}</div><div class="contact-card__value">${esc(c.value)}</div></div>`;
    if (c.action) h += `<span class="contact-card__action">${esc(c.action)} ↗</span>`;
    h += `</${tag}>`;
  }
  h += `</div></section>`;
  return h;
}

/* --- FOOTER --- */
function renderFooter(currentId, domains) {
  const links = document.getElementById('footer-links');
  links.innerHTML = domains
    .filter((d) => d.id !== currentId)
    .map((d) => `<a class="region-footer__link" href="#/region/${d.id}"><span class="region-footer__link-dot" style="background:${d.accent}" aria-hidden="true"></span>${esc(d.label)}</a>`)
    .join('');
}

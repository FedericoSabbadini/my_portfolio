/* =========================================================================
   region-view.js — renders catalog content for a given region.
   ========================================================================= */
import { groupBySubject } from '../data/taxonomy.js';
import { regionPath } from '../router.js';
import { t, localize, localizeArray } from '../i18n.js';

const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

/* --- Linear icon set (24px grid, currentColor). One visual voice: hairline
   outlines for UI glyphs, solid paths only for brand marks. --- */
const STROKE_ATTRS = 'viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const FILL_ATTRS = 'viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"';
const ICONS = {
  email: `<svg ${STROKE_ATTRS}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>`,
  phone: `<svg ${STROKE_ATTRS}><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>`,
  pin: `<svg ${STROKE_ATTRS}><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>`,
  doc: `<svg ${STROKE_ATTRS}><path d="M7 3h7l5 5v13H7Z"/><path d="M14 3v5h5"/><path d="M9.5 13h5M9.5 16.5h5"/></svg>`,
  link: `<svg ${STROKE_ATTRS}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>`,
  globe: `<svg ${STROKE_ATTRS}><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z"/></svg>`,
  book: `<svg ${STROKE_ATTRS}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>`,
  sports: `<svg ${STROKE_ATTRS}><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>`,
  github: `<svg ${FILL_ATTRS}><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C16.4 4.9 17.4 5.2 17.4 5.2c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.6.8.5A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/></svg>`,
  linkedin: `<svg ${FILL_ATTRS}><path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5ZM.22 8.09h4.56V23H.22V8.09ZM8.34 8.09h4.37v2.04h.06c.61-1.15 2.1-2.37 4.32-2.37 4.62 0 5.47 3.04 5.47 7v8.24h-4.55v-7.3c0-1.74-.03-3.99-2.43-3.99-2.44 0-2.81 1.9-2.81 3.86V23H8.34V8.09Z"/></svg>`,
};
/* data files carry an icon key; unknown values fall back to the link glyph */
const icon = (key) => ICONS[key] || ICONS.link;

export function renderRegion(regionId, data, domains) {
  const domain = domains.find((d) => d.id === regionId);
  if (!domain) return;

  document.documentElement.style.setProperty('--region-accent', domain.accent);

  // Hero - use localized domain fields
  document.getElementById('hero-dot').style.background = domain.accent;
  document.getElementById('hero-dot').style.boxShadow = `0 0 14px ${domain.accent}`;
  document.getElementById('hero-lobe').textContent = localize(domain, 'region');
  document.getElementById('hero-title').textContent = localize(domain, 'label');
  document.getElementById('hero-intro').textContent = localize(domain, 'description');

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
  const bio = localizeArray(p, 'bio');
  if (bio.length) {
    html += `<section class="about-bio">${bio.map((b) => `<p class="about-bio__p">${esc(b)}</p>`).join('')}</section>`;
  }

  // Stats
  if (stats.length) {
    html += `<h2 class="section-kicker">${esc(t('about.statsLabel'))}</h2><div class="stats-grid" style="margin-bottom:48px">`;
    for (const s of stats) {
      html += `<div class="stat-card"><div class="stat-card__num">${esc(s.number)}</div><div class="stat-card__lbl">${esc(localize(s, 'label'))}</div>${s.sublabel ? `<div class="stat-card__sub">${esc(localize(s, 'sublabel'))}</div>` : ''}</div>`;
    }
    html += `</div>`;
  }

  // Top skills
  const topSkills = localizeArray(p, 'topSkills');
  if (topSkills.length) {
    html += `<h2 class="section-kicker">${esc(t('about.skillsLabel'))}</h2><div class="skills-wrap" style="margin-bottom:48px">`;
    for (const sk of topSkills) html += `<span class="skill-chip">${esc(sk)}</span>`;
    html += `</div>`;
  }

  // Languages
  if (languages.length) {
    html += `<h2 class="section-kicker">${esc(t('about.languagesLabel'))}</h2><div style="display:flex;flex-direction:column;gap:18px;margin-bottom:48px">`;
    for (const l of languages) {
      const pct = l.percentage || 50;
      html += `<div class="lang-item"><span class="lang-flag" aria-hidden="true">${l.flag || ''}</span><div class="lang-info"><div class="lang-row"><span class="lang-name">${esc(localize(l, 'name'))}</span><span class="lang-level">${esc(localize(l, 'level'))}</span></div><div class="lang-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(localize(l, 'name'))} proficiency"><div class="lang-bar__fill" style="width:${pct}%"></div></div></div></div>`;
    }
    html += `</div>`;
  }

  // Interests
  if (interests.length) {
    html += `<h2 class="section-kicker">${esc(t('about.interestsLabel'))}</h2><div class="interests-grid">`;
    for (const i of interests) {
      html += `<div class="interest-card"><span class="interest-icon" aria-hidden="true">${icon(i.icon)}</span><div><div class="interest-title">${esc(localize(i, 'title'))}</div>${i.description ? `<div class="interest-desc">${esc(localize(i, 'description'))}</div>` : ''}</div></div>`;
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
    html += `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 class="edu-degree-title">${esc(localize(ed, 'degree'))}</h2>`;
    if (ed.status === 'current') html += `<span class="edu-badge-current">${esc(localize(ed, 'statusLabel') || t('education.currentBadge'))}</span>`;
    html += `</div>`;
    html += `<div class="edu-meta">${esc(localize(ed, 'institution'))} · ${esc(localize(ed, 'period'))}</div>`;
    if (ed.gpa) html += `<div class="edu-gpa"><span class="edu-gpa-label">${esc(t('about.gpaLabel'))}</span> ${esc(ed.gpa)}</div>`;
    html += `</div></div>`;
    if (ed.description) html += `<p class="edu-desc">${esc(localize(ed, 'description'))}</p>`;

    // Links
    const links = [];
    if (ed.url) links.push(`<a class="edu-link" href="${esc(ed.url)}" target="_blank" rel="noopener">${esc(t('education.programmeLink'))} ↗</a>`);
    if (ed.hfUrl) links.push(`<a class="edu-link edu-link--secondary" href="${esc(ed.hfUrl)}" target="_blank" rel="noopener">${esc(t('education.studyNotesLink'))} ↗</a>`);
    if (links.length) html += `<div class="edu-links">${links.join('')}</div>`;

    // Courses — collapsed by default (a degree can carry many), click to expand
    const courses = getCourses(data.courses, ed.id || '');
    if (courses.length) {
      const cid = `courses-${esc(ed.id || Math.random().toString(36).slice(2))}`;
      html += `<div class="courses-block" data-collapsed="true">
        <button class="courses-toggle" type="button" aria-expanded="false" aria-controls="${cid}">
          <span class="courses-toggle__label">${esc(t('education.coursesLabel'))}</span>
          <span class="courses-toggle__count">${courses.length}</span>
          <span class="courses-toggle__hint">${esc(t('education.syllabusLink'))}</span>
          <svg class="courses-toggle__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="courses-collapse"><div class="courses-collapse__inner">
        <div class="courses-grid" id="${cid}">`;
      for (const c of courses) {
        const ongoing = /^current$/i.test(c.grade || '');
        html += `<div class="course-card"><div class="course-card__head"><h4 class="course-card__name">${esc(localize(c, 'name'))}</h4>`;
        if (c.grade) html += `<span class="course-card__grade${ongoing ? ' course-card__grade--ongoing' : ''}">${ongoing ? esc(t('about.ongoing')) : esc(c.grade)}</span>`;
        html += `</div>`;
        if (c.description) html += `<p class="course-card__desc">${esc(localize(c, 'description'))}</p>`;
        if (c.tags && c.tags.length) {
          const tags = localizeArray(c, 'tags');
          html += `<div class="course-card__tags">${tags.map((t) => `<span class="course-card__tag">${esc(t)}</span>`).join('')}</div>`;
        }
        const clinks = [];
        if (c.url) clinks.push(`<a class="course-link course-link--primary" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(t('education.syllabusLink'))} ↗</a>`);
        if (c.hfUrl) clinks.push(`<a class="course-link course-link--secondary" href="${esc(c.hfUrl)}" target="_blank" rel="noopener">${esc(t('education.notesLink'))} ↗</a>`);
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
      html += w.type ? `<span class="work-item__type">${esc(localize(w, 'type'))}</span>` : `<span></span>`;
      if (w.logo) {
        const img = `<img class="work-item__logo" src="${esc(w.logo)}" alt="${esc(localize(w, 'company') || localize(w, 'title'))} logo" loading="lazy" />`;
        const logoHref = w.logoUrl || w.url;
        html += logoHref
          ? `<a class="work-item__logo-link" href="${esc(logoHref)}" target="_blank" rel="noopener" aria-label="${esc(localize(w, 'company') || localize(w, 'title'))} website">${img}</a>`
          : img;
      }
      html += `</div>`;
    }
    html += `<h2 class="work-item__title">${esc(localize(w, 'title'))}${w.company ? ` — ${esc(localize(w, 'company'))}` : ''}</h2>`;
    html += `<div class="work-item__meta">${esc(localize(w, 'period'))}${w.location ? ` · ${esc(localize(w, 'location'))}` : ''}</div>`;
    if (w.url) {
      const label = w.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      html += `<a class="work-item__link" href="${esc(w.url)}" target="_blank" rel="noopener">${esc(label)} <span aria-hidden="true">↗</span></a>`;
    }
    if (w.description) html += `<p class="work-item__desc">${esc(localize(w, 'description'))}</p>`;
    const responsibilities = localizeArray(w, 'responsibilities');
    if (responsibilities.length) {
      html += `<ul class="work-item__resp">${responsibilities.map((r) => `<li class="work-resp"><span class="work-resp__mark" aria-hidden="true">→</span><span>${esc(r)}</span></li>`).join('')}</ul>`;
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
    return `<p class="region-empty">${esc(t('common.notFound'))}</p>`;
  }
  let html = `<div class="group-section">`;
  for (const g of groups) {
    const groupKey = `subjects.${g.id}`;
    const groupLabel = t(groupKey) === groupKey ? g.label : t(groupKey);
    html += `<section><div class="group-head"><span class="group-head__dot" style="background:var(--region-accent)" aria-hidden="true"></span><h2 class="group-head__label">${esc(groupLabel)}</h2><span class="group-head__count">${g.items.length}</span></div>`;
    html += `<div class="group-grid">`;
    for (const item of g.items) {
      const href = item.url ? ` href="${esc(item.url)}" target="_blank" rel="noopener"` : '';
      const tag = item.url ? 'a' : 'div';
      const badge = localize(item, 'badge') || item.issuer;
      html += `<${tag} class="group-card"${href}>`;
      html += `<div class="group-card__head"><h3 class="group-card__title">${esc(localize(item, 'title'))}</h3>`;
      if (badge) html += `<span class="group-card__badge">${esc(badge)}</span>`;
      html += `</div>`;
      const meta = localize(item, 'period') || localize(item, 'date') || '';
      if (meta) html += `<div class="group-card__meta">${esc(meta)}</div>`;
      if (item.description) html += `<p class="group-card__desc">${esc(localize(item, 'description'))}</p>`;
      if (item.tags && item.tags.length) {
        const tags = localizeArray(item, 'tags');
        html += `<div class="group-card__tags">${tags.map((t) => `<span class="group-card__tag">${esc(t)}</span>`).join('')}</div>`;
      }
      if (item.url) {
        const linkLabel = localize(item, 'urlLabel') || t('projects.viewLink');
        html += `<span class="group-card__link">${esc(linkLabel)} ↗</span>`;
      }
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
    <p class="contacts-lead__title">${esc(t('contacts.leadTitle'))}</p>
    <p class="contacts-lead__text">${esc(t('contacts.leadText'))}</p>
    ${p.email ? `<a class="contacts-lead__cta" href="mailto:${esc(p.email)}">${esc(t('contacts.ctaLabel'))} <span aria-hidden="true">→</span></a>` : ''}
  </div>`;

  html += '<div class="contacts-section">';

  // Primary
  const primary = [];
  if (p.email) {
    // Display the domain only (e.g. "@icloud.com"); the mailto + title keep the full address.
    const shortEmail = p.email.includes('@') ? `@${p.email.split('@').pop()}` : p.email;
    primary.push({ label: t('contacts.emailLabel'), value: shortEmail, title: p.email, href: `mailto:${p.email}`, icon: icon('email'), action: t('contacts.actionEmail') });
  }
  if (p.location) {
    const mapUrl = p.locationUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.location)}`;
    primary.push({ label: t('contacts.locationLabel'), value: p.location, title: `Open ${p.location} in Google Maps`, href: mapUrl, icon: icon('pin'), action: t('contacts.actionMap') });
  }
  if (primary.length) html += contactGroup(t('contacts.primaryLabel'), primary);

  // Classify the rest of the entries into social links and downloadable docs
  const docKeys = new Set(['cv', 'europass', 'coverletter', 'resume', 'worksafetycert']);
  const links = [], docs = [];
  for (const [key, info] of Object.entries(social)) {
    const k = key.toLowerCase();
    if (k === 'email') continue;                 // already shown in Primary
    const label = localize(info, 'label') || cap(key);
    const iconSvg = icon(info.icon);
    if (docKeys.has(k) && info.url) {
      const downloadable = !/^https?:\/\//i.test(info.url);
      docs.push({
        label,
        value: localize(info, 'value') || (downloadable ? t('contacts.actionDownload') : 'Online credential'),
        href: info.url,
        icon: iconSvg,
        action: info.action || (downloadable ? t('contacts.actionDownload') : t('contacts.actionVerify')),
        download: downloadable,
      });
    } else {
      const href = info.url
        || (info.address ? `mailto:${info.address}` : '')
        || (info.number ? `tel:${info.number}` : '');
      const value = info.username || info.address || info.number || label;
      const action = href.startsWith('tel:') ? t('contacts.actionCall') : (href.startsWith('mailto:') ? t('contacts.actionEmail') : t('contacts.actionOpen'));
      links.push({ label, value, href, icon: iconSvg, action });
    }
  }
  if (links.length) html += contactGroup(t('contacts.linksLabel'), links);
  if (docs.length) html += contactGroup(t('contacts.documentsLabel'), docs);

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
    .map((d) => `<a class="region-footer__link" href="${esc(regionPath(d.id))}"><span class="region-footer__link-dot" style="background:${d.accent}" aria-hidden="true"></span>${esc(localize(d, 'label'))}</a>`)
    .join('');
}
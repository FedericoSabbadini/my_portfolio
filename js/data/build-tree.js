/* =========================================================================
   build-tree.js — THE KNOWLEDGE HIERARCHY ENGINE

   Turns the raw content JSON into a strict parent → child TREE that mirrors
   the real structure of the portfolio (the same sections the old site had):

     Federico
     ├── About          → Core skills · Languages · Interests
     ├── Education       → Master's / Bachelor's / High School → their courses
     ├── Work            → Internship · Thesis · First role
     ├── Projects        → each project → the tech it used
     ├── Research        → each paper/thesis → methods
     ├── Certifications  → grouped by issuer → each credential
     └── Contacts        → GitHub · LinkedIn · Email · CV …

   Content is routed to a region deterministically BY SOURCE/TYPE — never by
   tag similarity. A short, hand-curated list of cross-links connects a few
   genuinely related nodes (a project ↔ the course that enabled it). No
   auto-generated "shared-tag" web.

   Add an item to any content JSON and it appears under the right parent with
   no code change.
   ========================================================================= */

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/* ---- link classification (reused by several factories) ------------------ */
function classifyUrl(url, fallbackLabel) {
  if (!url) return null;
  if (/github\.com/i.test(url)) return { label: 'Repository', url, kind: 'repo' };
  if (/huggingface\.co/i.test(url)) return { label: 'Dataset', url, kind: 'dataset' };
  if (/drive\.google|docs\.google/i.test(url)) return { label: fallbackLabel || 'View research', url, kind: 'research' };
  if (/\.pdf($|\?)/i.test(url)) return { label: fallbackLabel || 'Open PDF', url, kind: 'pdf' };
  return { label: fallbackLabel || 'Open link', url, kind: 'external' };
}

/* =========================================================================
   Curated cross-links: [projectOrItemId, relatedId, note]. Kept short and
   meaningful — these are the ONLY non-hierarchical edges in the graph.
   ========================================================================= */
const CROSS_LINKS = [
  ['project:f1-deepL', 'course:deep-learning', 'built on'],
  ['project:f1-deepL', 'course:machine-learning', 'built on'],
  ['project:talentscope', 'course:machine-learning', 'built on'],
  ['project:network-hardening', 'course:symbolic-ai', 'built on'],
  ['project:data-nexus', 'course:advanced-information-systems-big-data', 'built on'],
  ['project:oracool', 'course:web', 'built on'],
  ['project:gurobi', 'course:operative-research', 'built on'],
  ['project:pathfinding', 'course:algorithms-ds', 'built on'],
  ['research:openid-thesis', 'degree:bachelors', 'thesis of'],
  ['research:openid-thesis', 'course:network-security', 'built on'],
  ['research:electromagnetic', 'course:physics2', 'built on'],
  ['research:patch-aliasing-tsf', 'course:reinforcement-learning', 'related to'],
];

/* ========================================================================= */
export function buildTree(raw) {
  const regions = raw.regions;
  const nodes = [];
  const childrenById = new Map();   // id -> [childId]
  const parentById = new Map();     // id -> parentId

  const add = (node, parentId) => {
    nodes.push(node);
    if (!childrenById.has(node.id)) childrenById.set(node.id, []);
    if (parentId != null) {
      parentById.set(node.id, parentId);
      if (!childrenById.has(parentId)) childrenById.set(parentId, []);
      childrenById.get(parentId).push(node.id);
    }
    return node;
  };

  /* ---- L0: the seven regions ------------------------------------------- */
  for (const r of regions) {
    add({
      id: `region:${r.id}`, type: 'region', label: r.label, sub: r.lobe,
      desc: r.blurb, accent: r.accent, region: r.id, position: r.position,
      size: r.size, tags: [], links: [],
    }, null);
  }
  const REG = (id) => `region:${id}`;

  /* ---- About: core skills · languages · interests ---------------------- */
  {
    const p = raw.personal.personal || {};
    const about = nodes.find((n) => n.id === REG('about'));
    about.desc = p.description || about.desc;
    about.meta = { name: p.name, title: p.title, bio: p.bio, stats: raw.personal.stats, topSkills: p.topSkills };

    const skills = add({ id: 'group:skills', type: 'group', label: 'Core skills', region: 'about',
      desc: 'The competencies I lead with.', tags: [], links: [] }, REG('about'));
    (p.topSkills || []).forEach((s) => add({
      id: `skill:${slug(s)}`, type: 'skill', label: s, region: 'about',
      desc: `A core competency: ${s}.`, tags: [], links: [],
    }, skills.id));

    const langs = add({ id: 'group:languages', type: 'group', label: 'Languages', region: 'about',
      desc: 'Languages I speak.', tags: [], links: [] }, REG('about'));
    (raw.personal.languages || []).forEach((l) => add({
      id: `lang:${slug(l.name)}`, type: 'language', label: `${l.flag || ''} ${l.name}`.trim(),
      sub: l.level, desc: l.detail || l.level, region: 'about', tags: [], links: [], data: l,
    }, langs.id));

    const its = add({ id: 'group:interests', type: 'group', label: 'Interests', region: 'about',
      desc: 'What I do beyond the screen.', tags: [], links: [] }, REG('about'));
    (raw.personal.interests || []).forEach((it) => add({
      id: `interest:${slug(it.title)}`, type: 'interest', label: `${it.icon || ''} ${it.title}`.trim(),
      sub: 'Interest', desc: it.description, region: 'about', tags: [], links: [], data: it,
    }, its.id));
  }

  /* ---- Education: degrees → their courses ------------------------------ */
  {
    const levelKey = { masters: 'masters', bachelors: 'bachelors', highschools: 'highschools' };
    const levelLabel = { masters: "Master's", bachelors: "Bachelor's", highschools: 'High School' };
    for (const e of raw.education) {
      const degree = add({
        id: `degree:${e.id}`, type: 'degree', label: e.degree, sub: `${e.institution} · ${e.period}`,
        badge: e.gpa, desc: e.description, region: 'education', tags: e.tags || [],
        links: [e.url && { label: 'Course catalogue', url: e.url, kind: 'external' },
          e.hfUrl && { label: 'Notes dataset', url: e.hfUrl, kind: 'dataset' }].filter(Boolean),
        data: e,
      }, REG('education'));

      const bucket = raw.courses[levelKey[e.id]];
      if (bucket && bucket.courses) {
        for (const c of bucket.courses) {
          const done = c.grade && c.grade !== 'current';
          add({
            id: `course:${c.id}`, type: 'course', label: c.name,
            sub: `${levelLabel[e.id]}${c.grade ? ` · ${c.grade}` : ''}`,
            badge: c.grade === 'current' ? 'In progress' : (done ? c.grade : null),
            desc: c.description, region: 'education', tags: c.tags || [],
            links: [c.url && { label: 'Course page', url: c.url, kind: 'external' },
              c.hfUrl && { label: 'Notes', url: c.hfUrl, kind: 'dataset' }].filter(Boolean),
            data: { ...c, level: levelLabel[e.id] },
          }, degree.id);
        }
      }
    }
  }

  /* ---- Work: roles ----------------------------------------------------- */
  for (const w of raw.work) {
    add({
      id: `work:${w.id}`, type: 'work', label: w.title, sub: `${w.company} · ${w.period}`,
      badge: w.status === 'upcoming' ? 'Upcoming' : w.type,
      desc: w.description, region: 'work', tags: w.technologies || [], links: [], data: w,
    }, REG('work'));
  }

  /* ---- Projects & Research: project → its tech ------------------------- */
  for (const p of raw.projects) {
    const isResearch = p.badge === 'Research';
    const regionId = isResearch ? 'research' : 'projects';
    const idPrefix = isResearch ? 'research' : 'project';
    const main = classifyUrl(p.url, p.urlLabel);
    const proj = add({
      id: `${idPrefix}:${p.id}`, type: isResearch ? 'research' : 'project', label: p.title, sub: p.period,
      badge: p.badge, desc: p.description, region: regionId, tags: p.tags || [],
      links: main ? [main] : [], data: p,
    }, REG(regionId));
    // tech used → progressive L2 (only revealed when this project is expanded)
    (p.tags || []).forEach((t) => add({
      id: `${proj.id}::tech:${slug(t)}`, type: 'tech', label: t, region: regionId,
      desc: `Technology / method used in ${p.title}.`, tags: [], links: [],
    }, proj.id));
  }

  /* ---- Certifications: grouped by issuer → credential ------------------ */
  {
    const byIssuer = new Map();
    for (const c of raw.certifications) {
      if (!byIssuer.has(c.issuer)) byIssuer.set(c.issuer, []);
      byIssuer.get(c.issuer).push(c);
    }
    // EC-Council first (the strongest, hands-on credentials), then by count
    const order = [...byIssuer.entries()].sort((a, b) => {
      if (/EC-Council/i.test(a[0])) return -1;
      if (/EC-Council/i.test(b[0])) return 1;
      return b[1].length - a[1].length;
    });
    for (const [issuer, list] of order) {
      const grp = add({
        id: `certgroup:${slug(issuer)}`, type: 'certgroup', label: issuer, region: 'certifications',
        sub: `${list.length} credential${list.length > 1 ? 's' : ''}`,
        desc: `Certifications issued by ${issuer}.`, tags: [], links: [],
      }, REG('certifications'));
      for (const c of list) {
        add({
          id: `cert:${c.id}`, type: 'cert', label: c.title, sub: `${c.issuer} · ${c.date}`,
          badge: /EC-Council/i.test(c.issuer) ? 'Certified' : null,
          desc: c.description, region: 'certifications', tags: c.tags || [],
          links: c.url ? [{ label: 'View credential', url: c.url, kind: 'external' }] : [], data: c,
        }, grp.id);
      }
    }
  }

  /* ---- Contacts: channels ---------------------------------------------- */
  {
    const s = raw.personal.social || {};
    const p = raw.personal.personal || {};
    const chans = [];
    if (s.email) chans.push(['Email', `mailto:${s.email.address}`, 'external', s.email.address]);
    else if (p.email) chans.push(['Email', `mailto:${p.email}`, 'external', p.email]);
    if (s.github) chans.push(['GitHub', s.github.url, 'repo', `@${s.github.username}`]);
    if (s.linkedin) chans.push(['LinkedIn', s.linkedin.url, 'external', `in/${s.linkedin.username}`]);
    if (s.phone) chans.push(['Phone', `tel:${s.phone.number}`, 'external', s.phone.number]);
    if (s.cv) chans.push(['Curriculum Vitae', s.cv.url, 'pdf', 'PDF']);
    if (s.europass) chans.push(['Europass CV', s.europass.url, 'pdf', 'PDF']);
    if (s.coverLetter) chans.push(['Cover letter', s.coverLetter.url, 'pdf', 'PDF']);
    for (const [label, url, kind, sub] of chans) {
      add({
        id: `contact:${slug(label)}`, type: 'contact', label, sub, region: 'contacts',
        desc: `${label} — ${sub}`, tags: [], links: [{ label: `Open ${label}`, url, kind }], data: { url },
      }, REG('contacts'));
    }
  }

  /* ---- indexes + cross-links ------------------------------------------- */
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const crossLinks = CROSS_LINKS
    .filter(([a, b]) => byId.has(a) && byId.has(b))
    .map(([a, b, note]) => ({ a, b, note }));
  const crossByNode = new Map();
  for (const cl of crossLinks) {
    if (!crossByNode.has(cl.a)) crossByNode.set(cl.a, []);
    if (!crossByNode.has(cl.b)) crossByNode.set(cl.b, []);
    crossByNode.get(cl.a).push({ id: cl.b, note: cl.note });
    crossByNode.get(cl.b).push({ id: cl.a, note: cl.note });
  }

  // depth + descendant leaf counts (for region hover cards)
  const depthOf = (id) => { let d = 0, p = parentById.get(id); while (p != null) { d++; p = parentById.get(p); } return d; };
  for (const n of nodes) n.depth = depthOf(n.id);

  return {
    regions: nodes.filter((n) => n.type === 'region'),
    nodes, byId, childrenById, parentById, crossByNode, crossLinks,
  };
}

/* ---- consumer helpers --------------------------------------------------- */
export function getChildren(tree, id) {
  return (tree.childrenById.get(id) || []).map((cid) => tree.byId.get(cid)).filter(Boolean);
}
export function getParent(tree, id) {
  const p = tree.parentById.get(id);
  return p != null ? tree.byId.get(p) : null;
}
/** breadcrumb path root→node (excluding the synthetic root) */
export function getPath(tree, id) {
  const path = [];
  let cur = id;
  while (cur != null) { const n = tree.byId.get(cur); if (n) path.unshift(n); cur = tree.parentById.get(cur); }
  return path;
}
/** recruiter hover card: item count + a few representative child labels + key tech */
export function getRegionStats(tree, regionId) {
  const rootId = `region:${regionId}`;
  let items = 0; const tech = new Set(); const l1 = [];
  const walk = (id, depth) => {
    for (const c of getChildren(tree, id)) {
      if (depth === 0) l1.push(c.label);
      if (c.type !== 'group' && c.type !== 'certgroup' && c.type !== 'tech') items++;
      (c.tags || []).forEach((t) => tech.add(t));
      walk(c.id, depth + 1);
    }
  };
  walk(rootId, 0);
  return { items, l1, tech: [...tech].slice(0, 6) };
}

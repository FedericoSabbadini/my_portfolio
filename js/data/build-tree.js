/* =========================================================================
   build-tree.js — THE KNOWLEDGE HIERARCHY ENGINE

   Turns the raw content JSON into a strict parent → child TREE, all rendered
   in the same neural graph (About/Work/Contacts are NOT separate pages):

     Federico
     ├── About          → Core skills · Languages · Beyond code
     ├── Education      → each degree → its courses
     ├── Work           → internship → thesis → first role (a chain)
     ├── Projects       → grouped by subject → each project (leaf)
     ├── Certifications → grouped by subject → each credential
     └── Contacts       → email · GitHub · LinkedIn · CV …

   Research folds into Projects (a research project is a project with a
   "Research" badge, filed under its subject). Projects are LEAVES — they are
   not broken down into the tech they used (that lives in the detail panel).
   Content is routed to a region by SOURCE/TYPE; Projects & Certifications are
   then grouped by a small set of CONCRETE subjects (no vague "Theory" bucket).
   ========================================================================= */

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/* ---- subject taxonomy — concrete buckets only (no catch-all) ------------ */
export const TOPICS = [
  { id: 'ai', label: 'AI & Machine Learning', desc: 'Learning machines — deep networks, reinforcement, generative & symbolic AI.' },
  { id: 'security', label: 'Cybersecurity', desc: 'Offense & defense — cryptography, pentesting, network defense and digital identity.' },
  { id: 'data', label: 'Data & Big Data', desc: 'Data at scale — databases, distributed processing and analytics.' },
  { id: 'software', label: 'Software & Engineering', desc: 'The craft — languages, architecture, algorithms, optimization and full-stack.' },
  { id: 'business', label: 'Business & Soft Skills', desc: 'Strategy, management, communication and the human side of shipping work.' },
];

const TOPIC_KEYWORDS = [
  ['security', ['security', 'cyber', 'pentest', 'metasploit', 'wireshark', 'forensic', 'protocol analysis', 'cryptograph', 'vpn', 'ipsec', 'pki', 'wireless security', 'steganograph', 'exploit', 'openid', 'oauth', 'jwt', 'hardening', 'ec-council']],
  ['ai', ['reinforcement', 'deep learning', 'neural', 'transformer', 'generative', 'machine learning', 'scikit', 'xgboost', 'lstm', 'bayesian', 'csp', 'automated reasoning', 'planning', 'llm', 'rag', 'langchain', 'langgraph', 'agentic', 'keras', 'diffusion', 'time series', 'time-series', 'feature engineering', 'gan', 'cnn']],
  ['data', ['mongodb', 'influxdb', 'neo4j', 'nosql', 'map-reduce', 'mapreduce', 'distributed system', 'big data', 'hadoop', 'spark', 'data architect', 'numpy', 'pandas', 'analytics', 'data science', 'olap', 'warehouse', 'database', 'business intelligence']],
  ['software', ['java', 'python', 'design pattern', 'mvc', 'solid', 'junit', 'prolog', 'compiler', 'algorithm', 'graph theory', 'optimization', 'gurobi', 'operations research', 'linear programming', 'simplex', 'laravel', 'php', 'rest api', 'fastapi', 'sqlalchemy', 'git', 'full stack', 'software development', 'software engineering', 'automation', 'n8n', 'systems admin', 'linux', 'cloud', 'aws', 'ec2', 'devops', 'matlab', 'simulation']],
  ['business', ['strateg', 'porter', 'competitive', 'agile', 'scrum', 'project management', 'accounting', 'finance', 'econom', 'sustainab', 'esg', 'green it', 'marketing', 'content strategy', 'blockchain', 'smart contract', 'latex', 'technical writing', 'documentation', 'english', 'cefr']],
];

const TOPIC_OVERRIDE = {
  'data-hiding': 'security', 'openid-thesis': 'security', 'network-hardening': 'security',
  'patch-aliasing-tsf': 'ai', 'f1-deepL': 'ai', 'talentscope': 'ai',
  'electromagnetic': 'software', 'gurobi': 'software', 'pathfinding': 'software',
  'oracool': 'software', 'work-performance': 'software', 'data-nexus': 'data',
  'sustainability': 'business', 'agile': 'business', 'blockchain': 'business', 'smm': 'business',
  'english': 'business', 'latex-professional-publications': 'business',
  'aws-essentials': 'software', 'n8n-automation-master': 'software', 'git-github-zero-to-hero': 'software',
  'complete-fastapi-course-oauth-jwt': 'software', 'python-pro': 'software',
  'langchain-langgraph-crash-course': 'ai', 'python-data-science-sales': 'data',
};

function topicOf(rawId, tags, fallback = 'software') {
  if (rawId && TOPIC_OVERRIDE[rawId]) return TOPIC_OVERRIDE[rawId];
  const hay = (' ' + (tags || []).join(' ') + ' ').toLowerCase();
  for (const [topic, keys] of TOPIC_KEYWORDS) if (keys.some((k) => hay.includes(k))) return topic;
  return fallback;
}

/* hand-written blurbs so nothing reads auto-generated ---------------------- */
const SKILL_BLURB = {
  'machine-learning': 'From classical models to deep neural networks and reinforcement learning — the thread running through most of my work.',
  'data-science': 'Turning messy, real-world data into structure, insight and predictions worth acting on.',
  'cybersecurity': 'Breaking and defending systems — network security, penetration testing and digital identity, backed by hands-on EC-Council credentials.',
  'cloud-os': 'The layer underneath the code — cloud services, systems administration and operating-system internals.',
};

/* ---- link classification ------------------------------------------------ */
function classifyUrl(url, fallbackLabel) {
  if (!url) return null;
  if (/github\.com/i.test(url)) return { label: 'Repository', url, kind: 'repo' };
  if (/huggingface\.co/i.test(url)) return { label: 'Dataset', url, kind: 'dataset' };
  if (/drive\.google|docs\.google/i.test(url)) return { label: fallbackLabel || 'View research', url, kind: 'research' };
  if (/\.pdf($|\?)/i.test(url)) return { label: fallbackLabel || 'Open PDF', url, kind: 'pdf' };
  return { label: fallbackLabel || 'Open link', url, kind: 'external' };
}

/* ---- chronology for the Work chain -------------------------------------- */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const SEASONS = { spring: 4, summer: 7, autumn: 9, fall: 9, winter: 1 };
function startKey(period) {
  const s = String(period || '').toLowerCase();
  const year = (s.match(/(20\d{2})/) || [])[1];
  if (!year) return 9999;
  let month = 6;
  for (const [k, m] of Object.entries(MONTHS)) if (s.includes(k)) { month = m; break; }
  for (const [k, m] of Object.entries(SEASONS)) if (s.includes(k)) { month = m; break; }
  return Number(year) + month / 12;
}

/* curated cross-links: the only non-hierarchical edges (project ↔ its course) */
const CROSS_LINKS = [
  ['project:f1-deepL', 'course:deep-learning', 'built on'],
  ['project:f1-deepL', 'course:machine-learning', 'built on'],
  ['project:talentscope', 'course:machine-learning', 'built on'],
  ['project:network-hardening', 'course:symbolic-ai', 'built on'],
  ['project:data-nexus', 'course:advanced-information-systems-big-data', 'built on'],
  ['project:oracool', 'course:web', 'built on'],
  ['project:gurobi', 'course:operative-research', 'built on'],
  ['project:pathfinding', 'course:algorithms-ds', 'built on'],
  ['project:openid-thesis', 'degree:bachelors', 'thesis of'],
  ['project:openid-thesis', 'course:network-security', 'built on'],
  ['project:electromagnetic', 'course:physics2', 'built on'],
  ['project:patch-aliasing-tsf', 'course:reinforcement-learning', 'related to'],
];

/* layout hint per region (work reads as a chronological chain, not a star) */
export function getRegionLayout(regionId) { return regionId === 'work' ? 'chain' : 'radial'; }

/* ========================================================================= */
export function buildTree(raw) {
  const regions = raw.regions;
  const nodes = [];
  const childrenById = new Map();
  const parentById = new Map();

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
  const REG = (id) => `region:${id}`;

  for (const r of regions) {
    add({
      id: REG(r.id), type: 'region', label: r.label, sub: r.lobe, desc: r.blurb,
      accent: r.accent, region: r.id, position: r.position, size: r.size, tags: [], links: [],
    }, null);
  }

  const topicGroups = new Map();
  const ensureTopic = (regionId, topicId, accent) => {
    const key = `${regionId}:${topicId}`;
    if (topicGroups.has(key)) return topicGroups.get(key);
    const t = TOPICS.find((x) => x.id === topicId);
    const node = add({
      id: `topic:${key}`, type: 'topicgroup', label: t.label, sub: 'Subject', desc: t.desc,
      region: regionId, accent, topic: topicId, tags: [], links: [],
    }, REG(regionId));
    topicGroups.set(key, node);
    return node;
  };

  /* ---- About: skills · languages · interests --------------------------- */
  {
    const p = raw.personal.personal || {};
    const about = nodes.find((n) => n.id === REG('about'));
    about.desc = p.description || about.desc;
    about.meta = {
      name: p.name, title: p.title, bio: p.bio || [], location: p.location, email: p.email,
      stats: raw.personal.stats || [], topSkills: p.topSkills || [],
    };

    const skills = add({ id: 'group:skills', type: 'group', label: 'Core skills', sub: 'What I lead with',
      region: 'about', desc: 'The four areas I build in most.', tags: [], links: [] }, REG('about'));
    (p.topSkills || []).forEach((sname) => add({
      id: `skill:${slug(sname)}`, type: 'skill', label: sname, sub: 'Core skill', region: 'about',
      desc: SKILL_BLURB[slug(sname)] || `${sname} — one of the areas I work in most.`, tags: [], links: [],
    }, skills.id));

    const langs = add({ id: 'group:languages', type: 'group', label: 'Languages', sub: 'How I communicate',
      region: 'about', desc: 'Languages I speak.', tags: [], links: [] }, REG('about'));
    (raw.personal.languages || []).forEach((l) => add({
      id: `lang:${slug(l.name)}`, type: 'language', label: `${l.flag || ''} ${l.name}`.trim(),
      sub: l.level, desc: l.detail ? `${l.level}. ${l.detail}.` : `${l.level}.`, region: 'about',
      tags: [], links: [], data: l,
    }, langs.id));

    const its = add({ id: 'group:interests', type: 'group', label: 'Beyond code', sub: 'What drives me',
      region: 'about', desc: 'What I do away from the screen — and what it teaches me.', tags: [], links: [] }, REG('about'));
    (raw.personal.interests || []).forEach((it) => add({
      id: `interest:${slug(it.title)}`, type: 'interest', label: `${it.icon || ''} ${it.title}`.trim(),
      sub: 'Interest', desc: it.description, region: 'about', tags: [], links: [], data: it,
    }, its.id));
  }

  /* ---- Education: each degree → its courses ---------------------------- */
  {
    const levelLabel = { masters: "Master's", bachelors: "Bachelor's", highschools: 'High School' };
    for (const e of raw.education) {
      const degree = add({
        id: `degree:${e.id}`, type: 'degree', label: e.degree, sub: `${e.institution} · ${e.period}`,
        badge: e.gpa, desc: e.description, region: 'education', tags: e.tags || [],
        links: [e.url && { label: 'Course catalogue', url: e.url, kind: 'external' },
          e.hfUrl && { label: 'Notes dataset', url: e.hfUrl, kind: 'dataset' }].filter(Boolean),
        data: e,
      }, REG('education'));

      const bucket = raw.courses[e.id];
      if (bucket && bucket.courses) {
        for (const c of bucket.courses) {
          const done = c.grade && c.grade !== 'current';
          add({
            id: `course:${c.id}`, type: 'course', label: c.name,
            sub: `${levelLabel[e.id]}${done ? ` · ${c.grade}` : ''}`,
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

  /* ---- Work: roles (rendered as a chronological chain) ----------------- */
  const WORK_ORDER = { Internship: 0, Academic: 1, Work: 2 };
  const workSorted = raw.work.slice().sort((a, b) =>
    (startKey(a.period) - startKey(b.period)) || ((WORK_ORDER[a.type] ?? 9) - (WORK_ORDER[b.type] ?? 9)));
  for (const w of workSorted) {
    add({
      id: `work:${w.id}`, type: 'work', label: w.title, sub: `${w.company} · ${w.period}`,
      badge: w.status === 'upcoming' ? 'Upcoming' : w.type,
      desc: w.description, region: 'work', tags: w.technologies || [], links: [],
      data: w, startKey: startKey(w.period),
    }, REG('work'));
  }

  /* ---- Projects (incl. research), grouped by subject → project (leaf) -- */
  {
    const accent = nodes.find((n) => n.id === REG('projects')).accent;
    for (const p of raw.projects) {
      const isResearch = p.badge === 'Research';
      const topic = topicOf(p.id, p.tags, 'software');
      const grp = ensureTopic('projects', topic, accent);
      const main = classifyUrl(p.url, p.urlLabel);
      add({
        id: `project:${p.id}`, type: isResearch ? 'research' : 'project', label: p.title, sub: p.period,
        badge: p.badge, desc: p.description, region: 'projects', tags: p.tags || [],
        links: main ? [main] : [], data: p,
      }, grp.id);
    }
  }

  /* ---- Certifications grouped by subject ------------------------------- */
  {
    const accent = nodes.find((n) => n.id === REG('certifications')).accent;
    for (const c of raw.certifications) {
      const topic = topicOf(c.id, [...(c.tags || []), c.title], 'business');
      const grp = ensureTopic('certifications', topic, accent);
      add({
        id: `cert:${c.id}`, type: 'cert', label: c.title, sub: `${c.issuer} · ${c.date}`,
        badge: /EC-Council/i.test(c.issuer) ? 'Verified' : null,
        desc: c.description, region: 'certifications', tags: c.tags || [],
        links: c.url ? [{ label: 'View credential', url: c.url, kind: 'external' }] : [], data: c,
      }, grp.id);
    }
  }

  /* ---- Contacts -------------------------------------------------------- */
  {
    const s = raw.personal.social || {};
    const p = raw.personal.personal || {};
    const email = (s.email && s.email.address) || p.email;
    const chans = [];
    if (email) chans.push(['Email', `mailto:${email}`, 'external', email, 'The best way to reach me for opportunities & collaboration.']);
    if (s.github) chans.push(['GitHub', s.github.url, 'repo', `@${s.github.username}`, 'Code, projects and experiments — where the work lives.']);
    if (s.linkedin) chans.push(['LinkedIn', s.linkedin.url, 'external', `in/${s.linkedin.username}`, 'Professional profile and network.']);
    if (s.phone) chans.push(['Phone', `tel:${s.phone.number}`, 'external', s.phone.number, 'A direct line.']);
    if (s.cv) chans.push(['Curriculum Vitae', s.cv.url, 'pdf', 'PDF', 'The full CV, ready to download.']);
    if (s.europass) chans.push(['Europass CV', s.europass.url, 'pdf', 'PDF', 'EU-standard format.']);
    if (s.coverLetter) chans.push(['Cover letter', s.coverLetter.url, 'pdf', 'PDF', 'A short introduction in my own words.']);
    for (const [label, url, kind, sub, note] of chans) {
      add({
        id: `contact:${slug(label)}`, type: 'contact', label, sub, note, region: 'contacts',
        desc: note, tags: [], links: [{ label: `Open ${label}`, url, kind }], data: { url },
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
export function getPath(tree, id) {
  const path = [];
  let cur = id;
  while (cur != null) { const n = tree.byId.get(cur); if (n) path.unshift(n); cur = tree.parentById.get(cur); }
  return path;
}
const CONTAINER = new Set(['group', 'certgroup', 'topicgroup', 'tech']);
export function getRegionStats(tree, regionId) {
  const rootId = `region:${regionId}`;
  let items = 0; const tech = new Set(); const l1 = [];
  const walk = (id, depth) => {
    for (const c of getChildren(tree, id)) {
      if (depth === 0) l1.push(c.label);
      if (!CONTAINER.has(c.type)) items++;
      (c.tags || []).forEach((t) => tech.add(t));
      walk(c.id, depth + 1);
    }
  };
  walk(rootId, 0);
  return { items, l1, tech: [...tech].slice(0, 6) };
}

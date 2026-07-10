/* =========================================================================
   build-graph.js — THE KNOWLEDGE-BASE ENGINE
   Turns the raw content JSON into a unified knowledge graph:
   - one node per project / cert / course / degree / experience / person …
   - skill nodes synthesised from shared tags (the connective tissue)
   - item→skill links (shared skills bridge items = the Obsidian web)
   - every node is routed to one or MORE mental domains via domains.json rules

   Add an item to any content JSON (or, later, import a Markdown note that
   emits the same shape) and nodes + links appear automatically. No rebuild.
   ========================================================================= */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** fuzzy-ish tag/keyword match, punctuation-insensitive, with a length guard */
function tagHit(tag, rule) {
  const nt = norm(tag), nr = norm(rule);
  if (!nt || !nr) return false;
  if (nt === nr) return true;
  if (nr.length >= 4 && nt.includes(nr)) return true;
  if (nt.length >= 4 && nr.includes(nt)) return true;
  return false;
}

/** which domains does this node belong to? (additive — can be many) */
function matchDomains(node, domains, rawId) {
  const hits = [];
  for (const d of domains) {
    const m = d.match || {};
    let ok = false;
    if (m.types && m.types.includes(node.type)) ok = true;
    if (!ok && m.badges && node.badge && m.badges.includes(node.badge)) ok = true;
    if (!ok && m.idsAny && m.idsAny.includes(rawId)) ok = true;
    if (!ok && m.tagsAny && node.tags) {
      ok = node.tags.some((t) => m.tagsAny.some((r) => tagHit(t, r)));
    }
    if (ok) hits.push(d.id);
  }
  return hits;
}

/* ---- link normalisers per content type ---------------------------------- */
function classifyUrl(url, fallbackLabel) {
  if (!url) return null;
  if (/github\.com/i.test(url)) return { label: 'Repository', url, kind: 'repo' };
  if (/huggingface\.co/i.test(url)) return { label: 'Dataset', url, kind: 'dataset' };
  if (/drive\.google|docs\.google/i.test(url)) return { label: fallbackLabel || 'View research', url, kind: 'research' };
  if (/\.pdf($|\?)/i.test(url)) return { label: fallbackLabel || 'Open PDF', url, kind: 'pdf' };
  return { label: fallbackLabel || 'Open link', url, kind: 'external' };
}

/* ---- per-source node factories ------------------------------------------ */
function fromProject(p) {
  const links = [];
  const main = classifyUrl(p.url, p.urlLabel);
  if (main) links.push(main);
  return {
    id: `project:${p.id}`, type: 'project', label: p.title, sub: p.period,
    badge: p.badge, desc: p.description, tags: p.tags || [],
    weight: p.featured ? 2.2 : 1.4, links, data: p,
  };
}
function fromCert(c) {
  const links = [];
  if (c.url) links.push({ label: 'View credential', url: c.url, kind: 'external' });
  if (c.hfUrl) links.push({ label: 'Dataset', url: c.hfUrl, kind: 'dataset' });
  return {
    id: `cert:${c.id}`, type: 'cert', label: c.title, sub: `${c.issuer} · ${c.date}`,
    badge: /EC-Council/i.test(c.issuer) ? 'Certified' : null,
    desc: c.description, tags: c.tags || [], weight: 1.2, links, data: c,
  };
}
function fromEducation(e) {
  const links = [];
  if (e.url) links.push({ label: 'Course catalogue', url: e.url, kind: 'external' });
  if (e.hfUrl) links.push({ label: 'Notes dataset', url: e.hfUrl, kind: 'dataset' });
  return {
    id: `edu:${e.id}`, type: 'education', label: e.degree, sub: `${e.institution} · ${e.period}`,
    badge: e.gpa, desc: e.description, tags: e.tags || [], weight: 2.4, links, data: e,
  };
}
function fromWork(w) {
  return {
    id: `work:${w.id}`, type: 'work', label: w.title, sub: `${w.company} · ${w.period}`,
    badge: w.status === 'upcoming' ? 'Upcoming' : w.type,
    desc: w.description, tags: w.technologies || [], weight: 1.6, links: [], data: w,
  };
}
function fromCourse(c, level) {
  const links = [];
  if (c.url) links.push({ label: 'Course page', url: c.url, kind: 'external' });
  if (c.hfUrl) links.push({ label: 'Notes', url: c.hfUrl, kind: 'dataset' });
  return {
    id: `course:${c.id}`, type: 'course', label: c.name, sub: `${level} · ${c.grade}`,
    badge: c.grade && c.grade !== 'current' ? c.grade : (c.grade === 'current' ? 'In progress' : null),
    desc: c.description, tags: c.tags || [], weight: 1.05, links, data: { ...c, level },
  };
}

/* ---- identity nodes (person + languages + interests) -------------------- */
function identityNodes(personal) {
  const nodes = [], links = [];
  const p = personal.personal || {};
  const social = personal.social || {};
  const links4person = [];
  if (social.github) links4person.push({ label: 'GitHub', url: social.github.url, kind: 'repo' });
  if (social.linkedin) links4person.push({ label: 'LinkedIn', url: social.linkedin.url, kind: 'external' });
  if (social.cv) links4person.push({ label: 'Curriculum Vitae', url: social.cv.url, kind: 'pdf' });
  if (social.europass) links4person.push({ label: 'Europass CV', url: social.europass.url, kind: 'pdf' });
  if (social.coverLetter) links4person.push({ label: 'Cover letter', url: social.coverLetter.url, kind: 'pdf' });
  if (p.email) links4person.push({ label: 'Email', url: `mailto:${p.email}`, kind: 'external' });

  const person = {
    id: 'person:federico', type: 'person', label: p.name || 'Federico Sabbadini',
    sub: p.title, badge: 'The self', desc: (p.bio || []).join('\n\n'),
    tags: p.topSkills || [], weight: 3.2, links: links4person,
    data: { ...p, stats: personal.stats || [] },
  };
  nodes.push(person);

  (personal.languages || []).forEach((l, i) => {
    const id = `lang:${norm(l.name)}`;
    nodes.push({
      id, type: 'language', label: `${l.flag || ''} ${l.name}`.trim(), sub: l.level,
      badge: null, desc: l.detail || l.level, tags: [], weight: 1, links: [], data: l,
    });
    links.push({ source: person.id, target: id, kind: 'has' });
  });
  (personal.interests || []).forEach((it) => {
    const id = `interest:${norm(it.title)}`;
    nodes.push({
      id, type: 'interest', label: `${it.icon || ''} ${it.title}`.trim(), sub: 'Interest',
      badge: null, desc: it.description, tags: [], weight: 0.9, links: [], data: it,
    });
    links.push({ source: person.id, target: id, kind: 'has' });
  });
  return { nodes, links, person };
}

/* ========================================================================= */
export function buildGraph(raw) {
  const domains = raw.domains;
  const contentNodes = [];

  raw.projects.forEach((p) => contentNodes.push(fromProject(p)));
  raw.certifications.forEach((c) => contentNodes.push(fromCert(c)));
  raw.education.forEach((e) => contentNodes.push(fromEducation(e)));
  raw.work.forEach((w) => contentNodes.push(fromWork(w)));
  const levels = { masters: "Master's", bachelors: "Bachelor's", highschools: 'High School' };
  Object.entries(levels).forEach(([key, label]) => {
    const bucket = raw.courses[key];
    if (bucket && bucket.courses) bucket.courses.forEach((c) => contentNodes.push(fromCourse(c, label)));
  });

  // route every content node to its domain(s)
  const fallback = { project: 'programming', cert: 'academia' };
  for (const n of contentNodes) {
    const rawId = n.id.split(':')[1];
    let doms = matchDomains(n, domains, rawId);
    if (doms.length === 0) doms = [fallback[n.type] || 'academia'];
    n.domains = doms;
  }

  // identity
  const idn = identityNodes(raw.personal);
  idn.nodes.forEach((n) => { n.domains = ['identity']; });

  const nodes = [...contentNodes, ...idn.nodes];

  // ---- skill nodes from shared tags -------------------------------------
  const skillMap = new Map(); // normTag -> { label, count, domains:Set, items:[] }
  for (const n of contentNodes) {
    for (const t of n.tags || []) {
      const key = norm(t);
      if (!key) continue;
      if (!skillMap.has(key)) skillMap.set(key, { label: t, count: 0, domains: new Set(), items: [] });
      const s = skillMap.get(key);
      s.count++; s.items.push(n.id); n.domains.forEach((d) => s.domains.add(d));
    }
  }

  const links = [...idn.links];
  for (const [key, s] of skillMap) {
    if (s.count < 2) continue;                 // only shared skills become connectors
    const sid = `skill:${key}`;
    nodes.push({
      id: sid, type: 'skill', label: s.label, sub: 'Skill / concept',
      badge: null, desc: `A recurring thread across ${s.count} areas of my work.`,
      tags: [], weight: 0.8 + Math.min(s.count, 6) * 0.28,
      domains: [...s.domains], links: [], data: { usage: s.count, items: s.items },
    });
    for (const itemId of s.items) links.push({ source: itemId, target: sid, kind: 'skill' });
  }

  // indexes
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nodesByDomain = new Map(domains.map((d) => [d.id, []]));
  for (const n of nodes) for (const d of n.domains) if (nodesByDomain.has(d)) nodesByDomain.get(d).push(n);

  // degree → subtle weight boost
  const degree = new Map();
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) || 0) + 1);
    degree.set(l.target, (degree.get(l.target) || 0) + 1);
  }
  for (const n of nodes) n.degree = degree.get(n.id) || 0;

  return { nodes, links, byId, domains, nodesByDomain };
}

/**
 * Extract the subgraph for one domain: its content+identity nodes, the skill
 * nodes that connect to them, and every link among that set.
 */
export function getDomainSubgraph(graph, domainId) {
  const domain = graph.domains.find((d) => d.id === domainId);
  const inDomain = new Set(graph.nodesByDomain.get(domainId)?.map((n) => n.id) || []);

  // pull in skills linked to in-domain items (so shared threads show)
  const nodeSet = new Set(inDomain);
  for (const l of graph.links) {
    if (inDomain.has(l.source)) nodeSet.add(l.target);
    if (inDomain.has(l.target)) nodeSet.add(l.source);
  }
  // but keep only skills / in-domain content (avoid dragging other domains' items)
  const nodes = [...nodeSet]
    .map((id) => graph.byId.get(id))
    .filter((n) => n && (inDomain.has(n.id) || n.type === 'skill'));

  const keep = new Set(nodes.map((n) => n.id));
  const links = graph.links
    .filter((l) => keep.has(l.source) && keep.has(l.target))
    .map((l) => ({ ...l }));

  // deep-copy nodes so the physics sim can mutate x/y without touching the source
  const simNodes = nodes.map((n) => ({ ...n }));
  return { domain, nodes: simNodes, links };
}

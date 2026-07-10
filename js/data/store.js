/* =========================================================================
   store.js — loads and caches all content + domain config.
   The existing content JSON stays the single source of truth.
   ========================================================================= */

const BASE = 'data/';
const cache = new Map();

async function loadJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  const json = await res.json();
  cache.set(path, json);
  return json;
}

/**
 * Load every data file the mind is built from, in parallel.
 * @returns {Promise<object>} raw content keyed by kind
 */
export async function loadAll() {
  const [
    domainsWrap, personal, projects, work, education, certifications, courses,
  ] = await Promise.all([
    loadJSON('graph/domains.json'),
    loadJSON('personal.json'),
    loadJSON('projects.json'),
    loadJSON('work.json'),
    loadJSON('education.json'),
    loadJSON('certifications.json'),
    loadJSON('courses.json'),
  ]);

  return {
    domains: domainsWrap.domains,
    personal,          // { personal, social, stats, languages, interests }
    projects: projects.projects || [],
    work: work.work || [],
    education: education.education || [],
    certifications: certifications.certifications || [],
    courses,           // { masters, bachelors, highschools }
  };
}

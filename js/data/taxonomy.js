/* =========================================================================
   taxonomy.js — groups projects/certifications by subject area.
   ========================================================================= */

const SUBJECTS = [
  { id: 'ai',       label: 'AI & Machine Learning' },
  { id: 'security', label: 'Cybersecurity' },
  { id: 'data',     label: 'Data & Big Data' },
  { id: 'software', label: 'Software & Engineering' },
  { id: 'business', label: 'Business & Professional' },
];

const OVERRIDES = {
  // project/certification id → subject id
};

const KEYWORDS = [
  { id: 'ai',       words: ['ai', 'machine learning', 'deep learning', 'neural', 'nlp', 'llm', 'reinforcement', 'generative', 'transformer', 'computer vision', 'ml'] },
  { id: 'security', words: ['security', 'cyber', 'penetration', 'ctf', 'forensic', 'malware', 'vulnerability', 'threat', 'ethical hacking', 'osint'] },
  { id: 'data',     words: ['data', 'big data', 'analytics', 'database', 'sql', 'spark', 'hadoop', 'etl', 'pipeline', 'warehouse'] },
  { id: 'software', words: ['software', 'engineering', 'web', 'cloud', 'devops', 'docker', 'kubernetes', 'api', 'microservice', 'architecture', 'programming'] },
  { id: 'business', words: ['business', 'management', 'leadership', 'agile', 'scrum', 'professional', 'communication', 'strategy', 'project management'] },
];

function classify(item) {
  if (OVERRIDES[item.id]) return OVERRIDES[item.id];
  const text = `${item.title || ''} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
  for (const kw of KEYWORDS) {
    if (kw.words.some((w) => text.includes(w))) return kw.id;
  }
  return 'software';
}

export function groupBySubject(items) {
  const buckets = new Map(SUBJECTS.map((s) => [s.id, []]));
  for (const item of items) {
    const sid = classify(item);
    buckets.get(sid).push(item);
  }
  return SUBJECTS
    .filter((s) => buckets.get(s.id).length > 0)
    .map((s) => ({ ...s, items: buckets.get(s.id) }));
}

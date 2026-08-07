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

const VALID = new Set(SUBJECTS.map((s) => s.id));

const KEYWORDS = [
  { id: 'ai',       words: ['artificial intelligence', 'machine learning', 'deep learning', 'neural', 'nlp', 'llm', 'reinforcement', 'generative', 'transformer', 'computer vision'] },
  { id: 'security', words: ['security', 'cyber', 'penetration', 'pentest', 'ctf', 'forensic', 'malware', 'vulnerability', 'threat', 'ethical hacking', 'osint', 'steganography'] },
  { id: 'data',     words: ['big data', 'data science', 'analytics', 'database', 'sql', 'spark', 'hadoop', 'etl', 'pipeline', 'warehouse'] },
  { id: 'software', words: ['software', 'engineering', 'web', 'cloud', 'devops', 'docker', 'kubernetes', 'api', 'microservice', 'architecture', 'programming'] },
  { id: 'business', words: ['business', 'management', 'leadership', 'agile', 'scrum', 'professional', 'communication', 'strategy', 'project management', 'marketing'] },
];

/* Subject is authored per item (projects.json / certifications.json → `subject`).
   The keyword pass is only a fallback for items missing an explicit subject; it
   matches on whole words so short tokens ("ai", "ml") don't hit substrings like
   "tr-ai-ning" or "ht-ml". */
function classify(item) {
  if (item.subject && VALID.has(item.subject)) return item.subject;
  const text = ` ${`${item.title || ''} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  for (const kw of KEYWORDS) {
    if (kw.words.some((w) => text.includes(` ${w} `))) return kw.id;
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

// Flattening a question to a comparable form.
//
// Lives on its own because three things need it and none of them should have to
// import the whole matcher: the matcher itself, the profile lookup, and the
// learned cache in the service worker.

const NOISE_PHRASES = [
  /\(?\s*(?:max(?:imum)?|no more than|up to|within|limit(?:ed)? to|approx(?:imately)?)\s*\d{2,5}\s*(?:word|character|char)s?\s*\)?/gi,
  /\(?\s*\d{2,5}\s*(?:word|character|char)s?\s*(?:max(?:imum)?|or less|limit)?\s*\)?/gi,
  /\*+/g,
  /\(required\)|\(optional\)/gi,
];

/**
 * Lowercase, no punctuation, no word limits, no company name. This is the key
 * for the learned cache, so two forms asking the same thing about different
 * employers collapse to one entry.
 */
export function normalise(question, { company = '', role = '' } = {}) {
  let s = ` ${question || ''} `;
  for (const re of NOISE_PHRASES) s = s.replace(re, ' ');
  s = s.toLowerCase();
  for (const term of [company, role].filter(Boolean)) {
    s = s.split(term.toLowerCase()).join(' ');
  }
  return s
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fidelity guard: deterministic verification that extracted values are grounded in source text.
// Strips invented employers, institutions, etc. while preserving legitimate extractions.

const STOPWORDS = new Set([
  'of', 'the', 'and', 'pty', 'ltd', 'inc', 'llc', 'limited', 'private',
]);

/**
 * Normalize text for matching: lowercase, strip punctuation, collapse whitespace.
 */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Strip punctuation
    .replace(/\s+/g, ' ')       // Collapse whitespace
    .trim();
}

/**
 * How far a token may be from a source token and still count as the same word.
 * Short tokens are held to exact matching because one edit turns "csir" into
 * "csiro" - a different organisation. Longer tokens can absorb an edit or two
 * without becoming a different word.
 */
const FUZZY_MIN_LENGTH = 6;
const FUZZY_MIN_LENGTH_2 = 9;

/** Substring matching is only safe once a token is long enough to be distinctive. */
const FUSION_MIN_LENGTH = 5;

/**
 * Endings a token may gain or lose and still be the same word. Deliberately
 * only inflections: "age" -> "aged" is the same word, "csir" -> "csiro" is a
 * different organisation, and a bare length rule cannot tell them apart.
 */
const STEM_SUFFIXES = ['s', 'd', 'e', 'es', 'ed', 'ing'];
const STEM_MIN_LENGTH = 3;

/**
 * Damerau-Levenshtein distance, capped: stops counting once it exceeds `max`.
 *
 * Transpositions count as one edit, not two, because that is the single most
 * common way a resume typo differs from the real word ("Waverely" for
 * "Waverley"). Plain Levenshtein scored those as 2 and missed them.
 */
function editDistanceWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      row.push(v);
      if (v < best) best = v;
    }
    if (best > max) return false;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length] <= max;
}

/**
 * Does this token from the value appear in the source, allowing for the two
 * ways a real match gets missed?
 *
 *   1. PDF extraction fuses words together, so the resume literally reads
 *      "Metallurgical LaboratoryJuly 2017" and the token "laboratory" has no
 *      standalone match.
 *   2. The source resume has a typo the model correctly fixes, so the output
 *      says "Residential" where the resume says "Resdential".
 *
 * Both used to be reported as an employer that does not appear in the resume,
 * which triggered a full-price regeneration to "fix" correct work.
 */
function tokenAppearsInSource(token: string, sourceTokens: string[], sourceSet: Set<string>): boolean {
  if (sourceSet.has(token)) return true;

  if (token.length >= FUSION_MIN_LENGTH) {
    if (sourceTokens.some(st => st.length > token.length && st.includes(token))) return true;
  }

  // A shared stem covers the inflection the model corrects on the way past:
  // the resume says "Age Care centre", the output says "Aged Care Centre".
  // Prefix-only, so it cannot pull in an unrelated word of similar length.
  if (token.length >= STEM_MIN_LENGTH) {
    const stems = (a: string, b: string) =>
      b.length > a.length && b.startsWith(a) && STEM_SUFFIXES.includes(b.slice(a.length));
    if (sourceTokens.some(st =>
      st.length >= STEM_MIN_LENGTH && (stems(st, token) || stems(token, st)))) return true;
  }

  if (token.length >= FUZZY_MIN_LENGTH) {
    const max = token.length >= FUZZY_MIN_LENGTH_2 ? 2 : 1;
    if (sourceTokens.some(st => editDistanceWithin(token, st, max))) return true;
  }

  return false;
}

/**
 * Check if ALL significant tokens of `value` appear in `normalizedSource`.
 * Significant = length > 2 and not a stopword.
 * If value has zero significant tokens, treat as grounded (do not strip).
 *
 * Every significant token still has to be accounted for - an employer the
 * resume never mentions still fails. What changed is how a single token is
 * matched: see `tokenAppearsInSource`.
 */
export function isGroundedInSource(value: string, normalizedSource: string): boolean {
  const normalizedValue = normalizeForMatch(value);
  const valueTokens = normalizedValue.split(' ').filter(t => t.length > 0);

  // Extract significant tokens from the value
  const significantTokens = valueTokens.filter(t => t.length > 2 && !STOPWORDS.has(t));

  // If no significant tokens, treat as grounded (don't strip short/generic values)
  if (significantTokens.length === 0) {
    return true;
  }

  const sourceTokens = normalizedSource.split(' ').filter(t => t.length > 0);
  const sourceSet = new Set(sourceTokens);
  return significantTokens.every(t => tokenAppearsInSource(t, sourceTokens, sourceSet));
}

interface GroundedResult {
  cleaned: any;
  stripped: Array<{ field: string; value: string; reason: string }>;
}

/**
 * Ground extracted data against the original resume text.
 * Returns cleaned data and list of stripped values for logging.
 */
export function groundExtraction(stage1Data: any, resumeText: string): GroundedResult {
  const normalizedSource = normalizeForMatch(resumeText);
  const stripped: Array<{ field: string; value: string; reason: string }> = [];

  // Deep clone to avoid mutating input
  const cleaned = JSON.parse(JSON.stringify(stage1Data || {}));

  // Ground experience[].company
  if (Array.isArray(cleaned.experience)) {
    cleaned.experience.forEach((exp: any, idx: number) => {
      if (exp.company && typeof exp.company === 'string') {
        if (!isGroundedInSource(exp.company, normalizedSource)) {
          stripped.push({
            field: `experience[${idx}].company`,
            value: exp.company,
            reason: 'company name not found in source resume',
          });
          exp.company = null;
        }
      }
    });
  }

  // Ground projects[].org
  if (Array.isArray(cleaned.projects)) {
    cleaned.projects.forEach((proj: any, idx: number) => {
      if (proj.org && typeof proj.org === 'string') {
        if (!isGroundedInSource(proj.org, normalizedSource)) {
          stripped.push({
            field: `projects[${idx}].org`,
            value: proj.org,
            reason: 'organization name not found in source resume',
          });
          proj.org = null;
        }
      }
    });
  }

  // Ground education[].institution
  if (Array.isArray(cleaned.education)) {
    cleaned.education.forEach((edu: any, idx: number) => {
      if (edu.institution && typeof edu.institution === 'string') {
        if (!isGroundedInSource(edu.institution, normalizedSource)) {
          stripped.push({
            field: `education[${idx}].institution`,
            value: edu.institution,
            reason: 'institution name not found in source resume',
          });
          edu.institution = null;
        }
      }
    });
  }

  // Ground certifications[].issuer and certifications[].name
  if (Array.isArray(cleaned.certifications)) {
    cleaned.certifications = cleaned.certifications.filter((cert: any, idx: number) => {
      let keep = true;

      if (cert.issuer && typeof cert.issuer === 'string') {
        if (!isGroundedInSource(cert.issuer, normalizedSource)) {
          stripped.push({
            field: `certifications[${idx}].issuer`,
            value: cert.issuer,
            reason: 'issuer not found in source resume',
          });
          cert.issuer = null;
        }
      }

      if (cert.name && typeof cert.name === 'string') {
        if (!isGroundedInSource(cert.name, normalizedSource)) {
          stripped.push({
            field: `certifications[${idx}].name`,
            value: cert.name,
            reason: 'certification name not found in source resume',
          });
          keep = false; // Drop the whole cert entry
        }
      }

      return keep;
    });
  }

  // Ground languages[].name
  if (Array.isArray(cleaned.languages)) {
    cleaned.languages = cleaned.languages.filter((lang: any, idx: number) => {
      if (lang.name && typeof lang.name === 'string') {
        if (!isGroundedInSource(lang.name, normalizedSource)) {
          stripped.push({
            field: `languages[${idx}].name`,
            value: lang.name,
            reason: 'language name not found in source resume',
          });
          return false; // Drop the language entry
        }
      }
      return true;
    });
  }

  return { cleaned, stripped };
}

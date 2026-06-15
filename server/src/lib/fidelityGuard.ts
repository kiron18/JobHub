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
 * Check if ALL significant tokens of `value` appear in `normalizedSource`.
 * Significant = length > 2 and not a stopword.
 * If value has zero significant tokens, treat as grounded (do not strip).
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

  // Check that every significant token appears in the source
  const sourceTokens = new Set(normalizedSource.split(' ').filter(t => t.length > 0));
  return significantTokens.every(t => sourceTokens.has(t));
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

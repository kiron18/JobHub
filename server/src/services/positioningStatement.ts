/**
 * Positioning Statement derivation.
 *
 * The Positioning Statement is the "Floor" signal in Dual-Signal analysis
 * (docs/product-decisions/2026-05-12-Job Hub Revamped.md). It tells the
 * model what a candidate is *capable of* based on their role/experience
 * shape, even when no achievement names a specific skill. Pairs with the
 * Achievement Bank (the "Ceiling" — evidence to win) inside the analysis
 * prompt.
 *
 * Derivation is rule-based — no LLM. Cached on the profile and re-derived
 * when source fields change.
 */

export interface PositioningStatementComponents {
  title: string;
  seniority: 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'head' | 'manager' | 'director' | 'unknown';
  years: number;
  domain: string;
  education: 'phd' | 'masters' | 'bachelors' | 'diploma' | 'certificate' | 'unknown';
}

export interface PositioningStatement {
  raw: string;
  components: PositioningStatementComponents;
  derivedAt: string;
  profileVersion: number;
}

interface DerivationInput {
  experience: Array<{
    role: string;
    company: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
  }>;
  education: Array<{
    degree: string;
    institution: string;
  }>;
}

// ── Seniority ────────────────────────────────────────────────────────────────

const SENIORITY_PATTERNS: Array<{ rank: PositioningStatementComponents['seniority']; tokens: string[] }> = [
  { rank: 'director',   tokens: ['director', 'vp', 'vice president', 'chief'] },
  { rank: 'head',       tokens: ['head of', 'head '] },
  { rank: 'principal',  tokens: ['principal'] },
  { rank: 'lead',       tokens: ['lead ', ' lead', 'staff'] },
  { rank: 'manager',    tokens: ['manager'] },
  { rank: 'senior',     tokens: ['senior', 'sr.', 'sr '] },
  { rank: 'junior',     tokens: ['junior', 'jr.', 'jr ', 'graduate', 'associate', 'intern', 'trainee'] },
];

function detectSeniority(title: string): PositioningStatementComponents['seniority'] {
  const lower = ` ${title.toLowerCase()} `;
  for (const { rank, tokens } of SENIORITY_PATTERNS) {
    if (tokens.some(t => lower.includes(t))) return rank;
  }
  return 'mid';
}

// ── Years of experience ──────────────────────────────────────────────────────

function parseDateLoose(input: string | null | undefined): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // ISO-ish: 2020, 2020-01, 2020-01-15
  const iso = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(trimmed);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const m = iso[2] ? parseInt(iso[2], 10) - 1 : 0;
    const d = iso[3] ? parseInt(iso[3], 10) : 1;
    return new Date(Date.UTC(y, m, d));
  }

  // Free-form: try Date parser
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

function computeYears(experience: DerivationInput['experience']): number {
  if (!experience.length) return 0;
  let totalMs = 0;
  const now = new Date();
  for (const exp of experience) {
    const start = parseDateLoose(exp.startDate);
    if (!start) continue;
    const end = exp.isCurrent ? now : (parseDateLoose(exp.endDate) ?? now);
    if (end.getTime() > start.getTime()) totalMs += end.getTime() - start.getTime();
  }
  const years = totalMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.min(25, Math.round(years));
}

// ── Domain inference ─────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Array<{ domain: string; tokens: string[] }> = [
  { domain: 'banking',           tokens: ['bank', 'commonwealth', 'westpac', 'anz', 'macquarie', 'nab '] },
  { domain: 'fintech',           tokens: ['fintech', 'stripe', 'square', 'afterpay', 'zip co'] },
  { domain: 'technology',        tokens: ['tech', 'software', 'saas', 'atlassian', 'canva', 'google', 'meta', 'aws', 'microsoft'] },
  { domain: 'consulting',        tokens: ['consult', 'deloitte', 'pwc', 'kpmg', 'ey ', 'accenture', 'bain', 'mckinsey', 'bcg'] },
  { domain: 'government',        tokens: ['government', 'department of', 'commonwealth of', 'state of', 'aps ', 'council', 'ministry'] },
  { domain: 'education',         tokens: ['university', 'school', 'college', 'tafe', 'academy'] },
  { domain: 'healthcare',        tokens: ['hospital', 'health', 'medical', 'clinic', 'pharma', 'biotech'] },
  { domain: 'retail',            tokens: ['retail', 'coles', 'woolworths', 'kmart', 'bunnings'] },
  { domain: 'hospitality',       tokens: ['hospitality', 'hotel', 'restaurant', 'cafe'] },
  { domain: 'media',             tokens: ['media', 'news', 'publishing', 'broadcast', 'newscorp', 'abc '] },
  { domain: 'energy',            tokens: ['energy', 'oil', 'gas', 'renewable', 'solar', 'mining', 'bhp', 'rio tinto'] },
  { domain: 'construction',      tokens: ['construction', 'engineering', 'civil', 'infrastructure'] },
  { domain: 'nonprofit',         tokens: ['foundation', 'charity', 'red cross', 'oxfam', 'uniting'] },
  { domain: 'professional services', tokens: ['law firm', 'legal', 'accounting'] },
];

function inferDomain(experience: DerivationInput['experience']): string {
  const recent = experience.slice(0, 3); // Most recent three employers
  const counts = new Map<string, number>();
  for (const exp of recent) {
    const haystack = `${exp.company} ${exp.role}`.toLowerCase();
    for (const { domain, tokens } of DOMAIN_KEYWORDS) {
      if (tokens.some(t => haystack.includes(t))) {
        counts.set(domain, (counts.get(domain) ?? 0) + 1);
      }
    }
  }
  if (!counts.size) return 'general industry';
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// ── Education ────────────────────────────────────────────────────────────────

function highestEducation(education: DerivationInput['education']): PositioningStatementComponents['education'] {
  if (!education.length) return 'unknown';
  const combined = education.map(e => e.degree.toLowerCase()).join(' | ');

  if (/\b(phd|doctorate|doctoral|d\.?phil)\b/.test(combined)) return 'phd';
  if (/\b(master|m\.?sc|m\.?a\.|mba|m\.?ed|m\.?eng|llm|mpa|mpp)\b/.test(combined)) return 'masters';
  if (/\b(bachelor|b\.?sc|b\.?a\.|beng|bcom|llb)\b/.test(combined)) return 'bachelors';
  if (/\b(diploma|advanced diploma|graduate diploma)\b/.test(combined)) return 'diploma';
  if (/\b(certificate|cert\.|cert iii|cert iv)\b/.test(combined)) return 'certificate';
  return 'unknown';
}

// ── Normalisation ────────────────────────────────────────────────────────────

function normaliseTitle(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\b(\w)/g, (m) => m.toUpperCase())
    .trim();
}

function educationPhrase(level: PositioningStatementComponents['education']): string {
  switch (level) {
    case 'phd':         return 'PhD qualified';
    case 'masters':     return "Master's qualified";
    case 'bachelors':   return 'Bachelor qualified';
    case 'diploma':     return 'Diploma qualified';
    case 'certificate': return 'Certificate qualified';
    default:            return '';
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Derive a positioning statement from a candidate profile.
 *
 * Returns `null` when there's not enough source material to produce a
 * meaningful statement (no experience entries).
 */
export function derivePositioningStatement(
  input: DerivationInput,
  profileVersion: number,
): PositioningStatement | null {
  if (!input.experience.length) return null;

  const latest = input.experience[0];
  const title = normaliseTitle(latest.role);
  const seniority = detectSeniority(latest.role);
  const years = computeYears(input.experience);
  const domain = inferDomain(input.experience);
  const education = highestEducation(input.education);

  const yearsPhrase = years > 0 ? ` with ${years} year${years === 1 ? '' : 's'} in ${domain}` : ` in ${domain}`;
  const eduPhrase = educationPhrase(education);
  const raw = `${title}${yearsPhrase}${eduPhrase ? `, ${eduPhrase}` : ''}`;

  return {
    raw,
    components: { title, seniority, years, domain, education },
    derivedAt: new Date().toISOString(),
    profileVersion,
  };
}

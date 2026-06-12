/**
 * buildTemplateResume — server-side orchestration for the structured resume
 * generation path.
 *
 * Flows:
 *   1. Receive raw Prisma profile + validated LLM polish JSON
 *   2. Map Prisma profile shape → server-local ResumeData (profileToResumeData)
 *   3. Merge polish JSON into ResumeData by index (applyPolish)
 *   4. Run quality enforcers over the merged data (enforceResumeQuality)
 *   5. Render to markdown (profileToMarkdown)
 *   6. Return final markdown string
 *
 * This duplicates the canonical frontend implementations at src/lib/ because
 * the server tsconfig sets rootDir: ./src (server/src/) and cannot import
 * from ../../../src/lib/ (outside rootDir). The frontend files remain the
 * canonical source of origin for any future UI reads.
 */

import { enforceResumeQuality } from './resumeQualityEnforcers';
import { displayName } from './nameUtils';
import { selectFeaturedExperience, type ExperienceFlag } from './experienceSelection';
import type { ResumeData } from './resumeData';
import type { BridgedGap } from './bridgedGaps';

// =============================================================================
// PolishPayload — mirrors src/lib/applyPolish.ts
// =============================================================================
export interface PolishPayload {
  summary?: string;
  targetRoleTitle?: string;
  pageBudgetWarning?: boolean;
  experienceOrder?: string[];
  experience?: Array<{
    id: string;
    bullets: string[];
    casual?: boolean;
    australianLocal?: boolean;
    display?: 'full' | 'fold' | 'omit';
    tips?: Array<{ bulletIndex: number; suggestion: string }>;
  }>;
}

// =============================================================================
// ProfileWithRelations — minimal Prisma include shape
// =============================================================================
export interface ProfileWithRelations {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  location?: string | null;
  targetRole?: string | null;
  professionalSummary?: string | null;
  skills?: string | null;
  showReferees?: boolean | null;
  experience: Array<{
    id: string;
    role: string;
    company: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    isCurrent?: boolean;
    description?: string | null;
  }>;
  education: Array<{
    degree: string;
    field?: string | null;
    institution: string;
    location?: string | null;
    year?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  certifications?: Array<{
    name: string;
    issuingBody?: string | null;
    year?: string | null;
  }>;
  volunteering?: Array<{
    role: string;
    organization: string;
    description?: string | null;
  }>;
  languages?: Array<{
    name: string;
    proficiency: string;
  }>;
}

// =============================================================================
// Normalise skills — the DB stores skills as a JSON string like
// `{"technical":["Adobe"],"softSkills":["Writing"]}`. The markdown renderer
// expects newline-separated `Category: item1, item2` lines.
// =============================================================================
function normalizeSkillsString(skills: string | null | undefined): string | undefined {
  if (!skills) return undefined;
  // If it looks like JSON, parse and flatten
  const trimmed = skills.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.join(', ');
      }
      if (typeof parsed === 'object') {
        return Object.entries(parsed)
          .map(([key, vals]) => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            const items = Array.isArray(vals) ? vals.join(', ') : String(vals);
            return `${label}: ${items}`;
          })
          .join('\n');
      }
    } catch {
      // Not actually JSON — use as-is
    }
  }
  return skills;
}

/**
 * Appends concise bridged-gap skill labels to a normalised skills string under
 * a "Role-specific:" line, de-duplicated against existing skills. Labels longer
 * than 5 words are skipped (they reach the resume as experience bullets instead).
 */
export function mergeBridgedSkills(
  skills: string | undefined,
  bridgedGaps: BridgedGap[] | undefined,
): string {
  const base = (skills || '').trim();
  if (!bridgedGaps || bridgedGaps.length === 0) return base;
  const existingTokens = base.toLowerCase().split(/[,:\n]/).map(s => s.trim()).filter(Boolean);
  const concise = bridgedGaps
    .map(g => g.skill.trim())
    .filter(label => label.length > 0 && label.split(/\s+/).length <= 5)
    .filter(label => !existingTokens.includes(label.toLowerCase()));
  // De-dup within the new labels themselves (case-insensitive).
  const seen = new Set<string>();
  const unique = concise.filter(l => {
    const k = l.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length === 0) return base;
  const line = `Role-specific: ${unique.join(', ')}`;
  return base ? `${base}\n${line}` : line;
}

// =============================================================================
// reorderExperience — pure, testable
// =============================================================================

/**
 * Returns a new array with experiences sorted by the provided ID sequence.
 * Experiences whose IDs are not in orderIds are appended at the end in their
 * original relative order. The input array is never mutated.
 */
export function reorderExperience<T extends { id: string }>(
  experiences: T[],
  orderIds: string[],
): T[] {
  if (orderIds.length === 0) return [...experiences];
  const byId = new Map(experiences.map(e => [e.id, e]));
  const ordered: T[] = orderIds
    .map(id => byId.get(id))
    .filter((e): e is T => e !== undefined);
  const orderedIdSet = new Set(orderIds);
  const remaining = experiences.filter(e => !orderedIdSet.has(e.id));
  return [...ordered, ...remaining];
}

// =============================================================================
// enforceSummaryWordCount — pure, testable
// =============================================================================

/**
 * Hard-trims a professional summary to maxWords words.
 * The LLM is instructed to stay within bounds, but this is the backstop.
 */
export function enforceSummaryWordCount(summary: string, maxWords = 80): string {
  if (!summary) return summary;
  const words = summary.trim().split(/\s+/);
  if (words.length <= maxWords) return summary;
  return words.slice(0, maxWords).join(' ');
}

// =============================================================================
// profileToResumeData — maps Prisma profile shape to ResumeData
// =============================================================================
export function profileToResumeData(profile: ProfileWithRelations): ResumeData {
  return {
    name: profile.name || '',
    targetRole: profile.targetRole || undefined,
    email: profile.email || undefined,
    phone: profile.phone || undefined,
    linkedin: profile.linkedin || undefined,
    location: profile.location || undefined,
    professionalSummary: profile.professionalSummary || undefined,
    skills: normalizeSkillsString(profile.skills) || undefined,
    experience: profile.experience.map(exp => ({
      role: exp.role,
      company: exp.company,
      location: exp.location || undefined,
      startDate: exp.startDate,
      endDate: exp.endDate,
      isCurrent: exp.isCurrent ?? false,
      description: exp.description || undefined,
    })),
    education: profile.education.map(ed => ({
      degree: ed.degree,
      field: ed.field || undefined,
      institution: ed.institution,
      location: ed.location || undefined,
      year: ed.year || undefined,
      startDate: ed.startDate || undefined,
      endDate: ed.endDate || undefined,
    })),
    certifications: (profile.certifications || []).map(c => ({
      name: c.name,
      issuingBody: c.issuingBody || '',
      year: c.year || undefined,
    })),
    volunteering: (profile.volunteering || []).map(v => ({
      role: v.role,
      organization: v.organization,
      description: v.description || undefined,
    })),
    languages: (profile.languages || []).map(l => ({
      name: l.name,
      proficiency: l.proficiency,
    })),
    showReferees: profile.showReferees ?? true,
  };
}

// =============================================================================
// applyPolish — merges validated LLM polish JSON into ResumeData
// =============================================================================
export function applyPolish(data: ResumeData, polish: PolishPayload): ResumeData {
  return {
    ...data,
    professionalSummary: polish.summary ?? data.professionalSummary,
    experience: data.experience.map((exp, i) => {
      const match = (polish.experience ?? [])[i];
      if (!match) return exp;
      return {
        ...exp,
        description: match.bullets.join('\n'),
      };
    }),
  };
}

// =============================================================================
// profileToMarkdown — deterministic markdown renderer
// =============================================================================
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Render dates as "Feb 2024" / "Present", never "2024-02". Passes through values
// that are already human-formatted or that we cannot parse.
const formatMonthYear = (s?: string | null): string => {
  if (!s) return '';
  const t = String(s).trim();
  if (/^present$/i.test(t) || /^current$/i.test(t)) return 'Present';
  let m = t.match(/^(\d{4})[-/.](\d{1,2})$/);          // YYYY-MM
  if (m) { const i = +m[2] - 1; if (i >= 0 && i < 12) return `${MONTHS[i]} ${m[1]}`; }
  m = t.match(/^(\d{1,2})[-/.](\d{4})$/);               // MM-YYYY
  if (m) { const i = +m[1] - 1; if (i >= 0 && i < 12) return `${MONTHS[i]} ${m[2]}`; }
  return t; // bare year, "Feb 2024", or anything else — leave as-is
};

const dateRange = (start?: string, end?: string | null, isCurrent?: boolean) => {
  const left = formatMonthYear(start);
  const right = isCurrent ? 'Present' : formatMonthYear(end);
  if (left && right) return left === right ? left : `${left} - ${right}`;
  return left || right || '';
};

const cleanBullets = (description?: string): string[] => {
  if (!description) return [];
  return description
    .split('\n')
    .map(l => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
};

export function profileToMarkdown(d: ResumeData): string {
  const lines: string[] = [];
  const push = (...ls: string[]) => lines.push(...ls);
  const section = (title: string) => push('', `## ${title}`, '');

  // Header — name, target role, contact
  push(`# ${d.name}`);
  push('');
  if (d.targetRole) { push(`*${d.targetRole}*`); push(''); }
  const contactBits = [d.email, d.phone, d.linkedin, d.location].filter(Boolean);
  if (contactBits.length) push(contactBits.join(' | '));

  if (d.professionalSummary) {
    section('Professional Summary');
    push(d.professionalSummary.trim());
  }

  if (d.experience.length || d.additionalExperienceLine) {
    section('Work Experience');
    d.experience.forEach((exp, i) => {
      push(`### ${exp.role} | ${exp.company}`);
      const meta = [dateRange(exp.startDate, exp.endDate, exp.isCurrent), exp.location].filter(Boolean).join(' · ');
      if (meta) push(`*${meta}*`);
      const bullets = cleanBullets(exp.description);
      if (bullets.length) {
        push('');
        bullets.forEach(b => push(`- ${b}`));
      }
      if (i < d.experience.length - 1) push('');
    });
    if (d.additionalExperienceLine) {
      if (d.experience.length) push('');
      push(d.additionalExperienceLine);
    }
  }

  if (d.education.length) {
    section('Education');
    d.education.forEach(ed => {
      const right = ed.year || dateRange(ed.startDate, ed.endDate);
      const head = `**${ed.degree}${ed.field ? ` - ${ed.field}` : ''}**${right ? `  ·  ${right}` : ''}`;
      push(head);
      const sub = [ed.institution, ed.location].filter(Boolean).join(' - ');
      if (sub) push(sub);
      push('');
    });
  }

  const skillLines = (d.skills || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (skillLines.length) {
    section('Skills & Competencies');
    skillLines.forEach(line => {
      const colon = line.indexOf(':');
      if (colon === -1) { push(line); return; }
      const label = line.slice(0, colon).trim();
      const rest = line.slice(colon + 1).trim();
      push(`**${label}:** ${rest}`);
      push('');
    });
  }

  if (d.certifications?.length) {
    section('Certifications & Professional Development');
    d.certifications.forEach(c => {
      push(`- **${c.name}** - ${c.issuingBody}${c.year ? `  ·  ${c.year}` : ''}`);
    });
  }

  if (d.languages?.length) {
    section('Languages');
    push(d.languages.map(l => `${l.name} (${l.proficiency})`).join(' • '));
  }

  if (d.volunteering?.length) {
    section('Volunteering & Community Involvement');
    d.volunteering.forEach(v => {
      push(`**${v.role}** - ${v.organization}`);
      if (v.description) push(v.description.trim());
      push('');
    });
  }

  if (d.showReferees !== false) {
    section('Referees');
    push('Available upon request.');
  }

  // Trim trailing blanks, collapse 3+ consecutive newlines to 2
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// =============================================================================
// Two-page curation helpers
// =============================================================================
const TERTIARY_RE = /bachelor|master|phd|doctorate|doctor of|diploma|graduate certificate|degree|b\.?\s?tech|b\.?\s?sc|b\.?\s?eng|m\.?\s?sc|mba|honours|postgrad/i;
const SCHOOL_RE = /secondary school|high school|pre-?university|matriculation|\bhsc\b|\bssc\b|\bpcmb\b|school certificate|year 1[02]/i;

function curateEducationAndVolunteering(data: ResumeData): ResumeData {
  const hasTertiary = data.education.some(e => TERTIARY_RE.test(`${e.degree} ${e.field ?? ''}`));
  const education = hasTertiary
    ? data.education.filter(e => !SCHOOL_RE.test(`${e.degree} ${e.field ?? ''} ${e.institution}`))
    : data.education;
  const volunteering = (data.volunteering ?? []).slice(0, 3);
  return { ...data, education, volunteering };
}

// =============================================================================
// Build template resume — the main orchestrator
// =============================================================================

export interface BuildTemplateOptions {
  candidateName?: string | null;
  yearsOfExperience?: number | null;
  /** Resume-derived contact email; overrides the account email on the profile. */
  contactEmail?: string | null;
  /** Per-experience relevance/locality flags; when present, curates the experience list. */
  experienceFlags?: ExperienceFlag[] | null;
  achievementSources?: string[];
  bridgedGaps?: BridgedGap[];
}

/**
 * buildTemplateResume — orchestrator that:
 *   1. Reorders profile.experience + aligns polish.experience by polish.experienceOrder
 *   2. Converts Prisma profile to ResumeData (profileToResumeData)
 *   3. Merges LLM polish JSON (applyPolish)
 *   4. Enforces summary word count backstop
 *   5. Curates experience via display flags (new path) or experienceFlags (legacy path)
 *   6. Curates education + volunteering for two-page fit
 *   7. Runs quality enforcers (first-person, banned phrases, AI-tell scrub, provenance)
 *   8. Merges bridged-gap skills
 *   9. Renders to deterministic markdown
 *   10. Returns the final markdown string
 */
export function buildTemplateResume(
  profile: ProfileWithRelations,
  polish: PolishPayload | null,
  options?: BuildTemplateOptions
): string {
  // ── Step 0: Reorder profile.experience + align polish.experience ────────────
  // Both arrays must be in the same order before index-based applyPolish runs.
  let orderedProfile = profile;
  let orderedPolish = polish;

  if (polish?.experienceOrder && polish.experienceOrder.length > 0) {
    const reorderedProfileExps = reorderExperience(profile.experience, polish.experienceOrder);
    orderedProfile = { ...profile, experience: reorderedProfileExps };

    if (polish.experience && polish.experience.length > 0) {
      const reorderedPolishExps = reorderExperience(
        polish.experience as Array<{ id: string } & (typeof polish.experience)[number]>,
        polish.experienceOrder,
      );
      orderedPolish = { ...polish, experience: reorderedPolishExps };
    }
  }

  // ── Step 1: Profile → ResumeData ────────────────────────────────────────────
  let data = profileToResumeData(orderedProfile);

  // Contact email comes from the resume raw text, not the account/login email.
  if (options?.contactEmail) {
    data = { ...data, email: options.contactEmail };
  }

  // JD-derived role headline overrides the stored profileRole when provided.
  if (orderedPolish?.targetRoleTitle) {
    data = { ...data, targetRole: orderedPolish.targetRoleTitle };
  }

  // Preferred display name (first + last) so long legal names read cleanly.
  const headerName = displayName(profile.name);
  if (headerName) {
    data = { ...data, name: headerName };
  }

  // ── Step 2: Merge polish (bullets, summary) ─────────────────────────────────
  if (orderedPolish) {
    data = applyPolish(data, orderedPolish);
  }

  // ── Step 2.1: Enforce summary word count (hard backstop: 80 words max) ──────
  if (data.professionalSummary) {
    data = { ...data, professionalSummary: enforceSummaryWordCount(data.professionalSummary) };
  }

  // ── Step 2.5: Feature/fold/omit curation ────────────────────────────────────
  // Prefer display flags from polish (new path) over options.experienceFlags
  // (old wildcard path). Build flags from display when any entry has one set.
  const polishExps = orderedPolish?.experience ?? [];
  const hasDisplayFlags = polishExps.some(e => e.display !== undefined);

  let experienceFlagsToUse = options?.experienceFlags ?? null;

  if (hasDisplayFlags && polishExps.length === orderedProfile.experience.length) {
    const rawFlags = polishExps.map((e, i) => {
      if (e.display === 'omit') return { index: i, relevant: false, australianLocal: false };
      if (e.display === 'fold') return { index: i, relevant: false, australianLocal: true };
      // 'full' or undefined — treat as relevant; fall back to casual flag if present
      return {
        index: i,
        relevant: e.casual !== true,
        australianLocal: e.australianLocal === true,
      };
    });
    // Hard guard: never empty the work history section
    const featured = data.experience.filter((_, i) => rawFlags[i]?.relevant !== false);
    experienceFlagsToUse = featured.length > 0 ? rawFlags : null;
  }

  {
    const selection = selectFeaturedExperience(data.experience, experienceFlagsToUse);
    data = {
      ...data,
      experience: selection.featured,
      additionalExperienceLine: selection.additionalExperienceLine ?? undefined,
    };
  }

  // ── Step 2.6: Two-page curation (education + volunteering) ─────────────────
  data = curateEducationAndVolunteering(data);

  // ── Step 3: Quality enforcers ───────────────────────────────────────────────
  data = enforceResumeQuality(data, {
    candidateName: options?.candidateName,
    yearsOfExperience: options?.yearsOfExperience,
    achievementSources: options?.achievementSources,
  });

  // ── Step 4: Merge bridged-gap skills ────────────────────────────────────────
  data = { ...data, skills: mergeBridgedSkills(data.skills, options?.bridgedGaps) };

  // ── Step 5: Render to markdown ──────────────────────────────────────────────
  return profileToMarkdown(data);
}

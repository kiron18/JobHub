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
 * canonical source of truth for any future UI reads.
 */

import { enforceResumeQuality } from './resumeQualityEnforcers';
import type { ResumeData } from './resumeData';
import type { BridgedGap } from './bridgedGaps';

// =============================================================================
// PolishPayload — mirrors src/lib/applyPolish.ts
// =============================================================================
export interface PolishPayload {
  summary?: string;
  experience?: Array<{
    id: string;
    bullets: string[];
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
const dateRange = (start?: string, end?: string | null, isCurrent?: boolean) => {
  const right = isCurrent ? 'Present' : (end || '');
  if (start && right) return `${start} — ${right}`;
  return start || right || '';
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

  if (d.experience.length) {
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
  }

  if (d.education.length) {
    section('Education');
    d.education.forEach(ed => {
      const right = ed.year || dateRange(ed.startDate, ed.endDate);
      const head = `**${ed.degree}${ed.field ? ` — ${ed.field}` : ''}**${right ? `  ·  ${right}` : ''}`;
      push(head);
      const sub = [ed.institution, ed.location].filter(Boolean).join(' — ');
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
      push(`- **${c.name}** — ${c.issuingBody}${c.year ? `  ·  ${c.year}` : ''}`);
    });
  }

  if (d.languages?.length) {
    section('Languages');
    push(d.languages.map(l => `${l.name} (${l.proficiency})`).join(' • '));
  }

  if (d.volunteering?.length) {
    section('Volunteering & Community Involvement');
    d.volunteering.forEach(v => {
      push(`**${v.role}** — ${v.organization}`);
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
// Build template resume — the main orchestrator
// =============================================================================

export interface BuildTemplateOptions {
  candidateName?: string | null;
  yearsOfExperience?: number | null;
  achievementSources?: string[];
  bridgedGaps?: BridgedGap[];
}

/**
 * buildTemplateResume — orchestrator that:
 *   1. Converts Prisma profile to ResumeData
 *   2. Merges LLM polish JSON
 *   3. Runs quality enforcers (first-person, banned phrases, AI-tell scrub, provenance)
 *   4. Renders to deterministic markdown
 *   5. Returns the final markdown string
 */
export function buildTemplateResume(
  profile: ProfileWithRelations,
  polish: PolishPayload | null,
  options?: BuildTemplateOptions
): string {
  // Step 1: Profile → ResumeData
  let data = profileToResumeData(profile);

  // Step 2: Merge polish (if valid)
  if (polish) {
    data = applyPolish(data, polish);
  }

  // Step 3: Quality enforcers
  data = enforceResumeQuality(data, {
    candidateName: options?.candidateName,
    yearsOfExperience: options?.yearsOfExperience,
    achievementSources: options?.achievementSources,
  });

  // Step 4: Merge bridged-gap skills into the Skills section
  data = { ...data, skills: mergeBridgedSkills(data.skills, options?.bridgedGaps) };

  // Step 5: Render to markdown
  return profileToMarkdown(data);
}

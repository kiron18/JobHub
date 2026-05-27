/**
 * Resume quality enforcers — wire existing markdown-based enforcers
 * (voiceEnforcer, provenanceTagging) to operate on ResumeData text fields.
 *
 * Each enforcer returns a new ResumeData; the input is never mutated.
 */

import {
  enforceFirstPersonSummary,
  scrubAITells,
  scrubBannedPhrases,
} from './voiceEnforcer';
import { tagAIRewrites } from './provenanceTagging';

/**
 * Canonical definition: ../../../src/lib/resumeRender.tsx
 *
 * Duplicated here because the server tsconfig does not set `--jsx`, so
 * importing directly from a .tsx file would fail at compile time.
 */
export interface ResumeData {
  name: string;
  targetRole?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  location?: string;
  professionalSummary?: string;
  skills?: string;
  experience: Array<{
    role: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string | null;
    isCurrent?: boolean;
    description?: string;
  }>;
  education: Array<{
    degree: string;
    field?: string;
    institution: string;
    location?: string;
    year?: string;
    startDate?: string;
    endDate?: string;
  }>;
  certifications?: Array<{ name: string; issuingBody: string; year?: string }>;
  volunteering?: Array<{ role: string; organization: string; description?: string }>;
  languages?: Array<{ name: string; proficiency: string }>;
  showReferees?: boolean;
}

export interface QualityEnforcerOptions {
  candidateName?: string | null;
  yearsOfExperience?: number | null;
  achievementSources?: string[];
}

/**
 * Enforce first-person voice on the Professional Summary field.
 *
 * The underlying `enforceFirstPersonSummary` expects a full markdown document
 * with a `## Professional Summary` heading.  We simulate that by wrapping the
 * plain summary text in a `## Professional Summary\n` prefix, running the
 * enforcer, then stripping the prefix.
 */
function enforceSummaryVoice(
  summary: string | undefined,
  opts: QualityEnforcerOptions
): string | undefined {
  if (!summary || typeof summary !== 'string') return summary;

  const heading = '## Professional Summary\n';
  const wrapped = heading + summary;
  const result = enforceFirstPersonSummary(wrapped, {
    candidateName: opts.candidateName,
    yearsOfExperience: opts.yearsOfExperience,
  });

  // If the enforcer returned the same string, nothing changed.
  if (result === wrapped) return summary;

  // Strip the heading + exactly one newline
  const prefix = result.startsWith(heading) ? heading : '## Professional Summary\n';
  const stripped = result.startsWith(prefix)
    ? result.slice(prefix.length)
    : result;

  return stripped;
}

/**
 * Scrub AI-tell phrases from a single text string.
 * Returns the cleaned text.
 */
function applyScrubAITells(text: string | undefined): string | undefined {
  if (!text || typeof text !== 'string') return text;
  return scrubAITells(text).scrubbed;
}

/**
 * Scrub banned resume phrases from a single text string.
 * Returns the cleaned text.
 */
function applyScrubBannedPhrases(text: string | undefined): string | undefined {
  if (!text || typeof text !== 'string') return text;
  return scrubBannedPhrases(text).scrubbed;
}

/**
 * Tag AI-rewritten bullet lines in an experience description against the
 * user's original achievement sources.  Returns the description with `[AI] `
 * tokens added where needed.
 */
function applyTagAIRewrites(
  description: string | undefined,
  sources: string[]
): string | undefined {
  if (!description || typeof description !== 'string') return description;
  if (!sources || sources.length === 0) return description;
  return tagAIRewrites(description, sources);
}

/**
 * Apply all quality enforcers to a ResumeData object.
 *
 * - Professional Summary: first-person enforcement, AI-tell scrub, banned-phrase scrub
 * - Experience descriptions: AI-tell scrub, banned-phrase scrub, provenance tagging
 *
 * Returns a new ResumeData — the input is never mutated.
 */
export function enforceResumeQuality(
  data: ResumeData,
  opts: QualityEnforcerOptions
): ResumeData {
  const sources = opts.achievementSources ?? [];

  // ── Professional Summary ──────────────────────────────────────────────
  let summary = data.professionalSummary;
  summary = enforceSummaryVoice(summary, opts);
  summary = applyScrubAITells(summary);
  summary = applyScrubBannedPhrases(summary);

  // ── Experience ────────────────────────────────────────────────────────
  const experience = data.experience.map((exp) => {
    let desc = exp.description;
    desc = applyScrubAITells(desc);
    desc = applyScrubBannedPhrases(desc);
    desc = applyTagAIRewrites(desc, sources);

    // Only create a new object if something actually changed
    if (desc === exp.description) return exp;
    return { ...exp, description: desc };
  });

  // ── Build result ──────────────────────────────────────────────────────
  const summaryChanged = summary !== data.professionalSummary;

  if (!summaryChanged && experience.every((e, i) => e === data.experience[i])) {
    return data;
  }

  return {
    ...data,
    ...(summaryChanged ? { professionalSummary: summary } : {}),
    experience,
  };
}

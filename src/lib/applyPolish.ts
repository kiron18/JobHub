import type { ResumeData } from './resumeRender';

// NOTE: PolishPayload mirrors server/src/lib/validatePolish.ts's ValidatedPolish
// (Zod-inferred type). Keep both in sync — the Zod schema is the single source of truth.

export interface PolishPayload {
  summary?: string;
  experience?: Array<{
    id: string;
    bullets: string[];
  }>;
}

/**
 * Merges validated LLM polish JSON into a ResumeData struct.
 * Replace semantics: each field returned by the LLM fully replaces
 * the corresponding field in the profile data.
 *
 * Matching strategy: Since ResumeData.experience items don't have an `id`
 * field, the polish payload's `experience` array is matched by INDEX
 * with the ResumeData's `experience` array. An experience item with `bullets`
 * fully replaces the original item's `description` field.
 *
 * - If the polish payload has fewer experience entries than ResumeData,
 *   the remaining entries are kept unpolished.
 * - Extra entries in the payload are ignored.
 * - The `id` field in the polish payload is available for traceability
 *   (e.g. matching back to a DB record) but is NOT used for lookup.
 */
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

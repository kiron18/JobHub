import type { ResumeData } from './resumeData';

// NOTE: PolishPayload mirrors server/src/lib/validatePolish.ts's ValidatedPolish
// (Zod-inferred type). Keep both in sync — the Zod schema is the single source of truth.

export interface PolishPayload {
  summary?: string;
  skills?: string;
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
 * Matching strategy: matched by experience `id`, never by array position.
 * The LLM's response can omit, duplicate, or reorder entries relative to the
 * profile — matching by index let one job's bullets silently land on a
 * different, unrelated job whenever that happened. An id that doesn't
 * resolve to a real experience entry is dropped rather than misapplied.
 */
export function applyPolish(data: ResumeData, polish: PolishPayload): ResumeData {
  const polishById = new Map((polish.experience ?? []).map(e => [e.id, e]));
  return {
    ...data,
    professionalSummary: polish.summary ?? data.professionalSummary,
    skills: polish.skills ?? data.skills,
    experience: data.experience.map(exp => {
      const match = polishById.get(exp.id);
      if (!match) return exp;
      return {
        ...exp,
        description: match.bullets.join('\n'),
      };
    }),
  };
}

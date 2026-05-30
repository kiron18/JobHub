import { z } from 'zod';

export const CoverLetterPolishSchema = z.object({
  salutation: z.string().min(1).max(200),
  p1: z.string().min(1).max(1000),
  p2: z.string().min(1).max(1000),
  p3: z.string().min(1).max(1000),
  p4: z.string().min(1).max(1000),
  signoff: z.string().min(1).max(300),
}).strip();

export type ValidatedCoverLetterPolish = z.infer<typeof CoverLetterPolishSchema>;

export function parseCoverLetterPolishJson(raw: string): ValidatedCoverLetterPolish | null {
  try {
    // Models wrap JSON in code fences (json-tagged OR a bare fence) or add
    // preamble prose. Extract the object between the first { and last } rather
    // than stripping a fence prefix: a bare ``` fence slipped through the old
    // regex and made JSON.parse choke, so every letter fell back to baseline.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    return CoverLetterPolishSchema.parse(JSON.parse(raw.slice(start, end + 1)));
  } catch (err) {
    console.warn('[validateCoverLetterPolish] Failed to validate LLM polish JSON:', err instanceof Error ? err.message : err);
    return null;
  }
}

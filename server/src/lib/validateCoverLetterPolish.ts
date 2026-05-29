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
    const cleaned = raw.trim()
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    return CoverLetterPolishSchema.parse(JSON.parse(cleaned));
  } catch (err) {
    console.warn('[validateCoverLetterPolish] Failed to validate LLM polish JSON:', err instanceof Error ? err.message : err);
    return null;
  }
}

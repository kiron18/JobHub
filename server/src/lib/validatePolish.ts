import { z } from 'zod';

// NOTE: PolishPayload in src/lib/applyPolish.ts mirrors this shape.
// Keep both in sync — this Zod schema is the single source of truth.

export const PolishPayloadSchema = z.object({
  summary: z.string().optional(),
  experience: z
    .array(
      z.object({
        id: z.string(),
        bullets: z.array(z.string()),
      }),
    )
    .optional(),
}).strip(); // Strip extra fields from LLM output (LLM sometimes adds skills)

export type ValidatedPolish = z.infer<typeof PolishPayloadSchema>;

/**
 * Safely validates and parses raw LLM JSON string into a polish payload.
 * Returns null on any failure (invalid JSON, schema mismatch).
 * Caller should retry once, then fall back to unpolished.
 */
export function parsePolishJson(raw: string): ValidatedPolish | null {
  try {
    // Handle stray markdown fences around JSON
    const cleaned = raw.trim()
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    return PolishPayloadSchema.parse(JSON.parse(cleaned));
  } catch (err) {
    console.warn('[validatePolish] Failed to validate LLM polish JSON:', err instanceof Error ? err.message : err);
    return null;
  }
}

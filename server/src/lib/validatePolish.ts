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
        // Per-role curation: casual=true marks an odd/survival job to fold or drop.
        // Optional so older callers/output still validate.
        casual: z.boolean().optional(),
        australianLocal: z.boolean().optional(),
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
    // Models wrap JSON in code fences (json-tagged OR a bare fence) or add
    // preamble prose. Extract the object between the first { and last } rather
    // than stripping a fence prefix: a bare ``` fence slipped through the old
    // regex and made JSON.parse choke, falling back to an unpolished resume.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    return PolishPayloadSchema.parse(JSON.parse(raw.slice(start, end + 1)));
  } catch (err) {
    console.warn('[validatePolish] Failed to validate LLM polish JSON:', err instanceof Error ? err.message : err);
    return null;
  }
}

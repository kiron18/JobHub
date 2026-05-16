/**
 * Provenance tagging for generated resume bullets.
 *
 * After the LLM produces a resume, we walk each bullet line and compare it
 * against the user's source achievement text. Bullets that closely match a
 * source are left untouched (they're effectively the user's own words). Bullets
 * that have been heavily rewritten or synthesised get a sentinel `[AI] ` prefix
 * so the editor can render a "review before sending" badge next to them.
 *
 * Uses the same inline-token convention as `[VERIFY:]` and `[MISSING:]`
 * already shipped in `src/components/ApplicationWorkspace.tsx`. Exporters
 * strip the token before writing DOCX/PDF.
 */

export const AI_REWRITE_TOKEN = '[AI]';

const BULLET_LINE_REGEX = /^([ \t]*[-*•]\s+)(.+)$/;

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/\*\*/g, ' ')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2)
  );
}

/**
 * Token-set Jaccard similarity. Returns 0..1. We use a generous similarity
 * threshold (>= 0.7) to treat a bullet as "essentially preserved" — most
 * core nouns/verbs kept, only minor reword. Anything below counts as AI-rewrite.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 || B.size === 0) return 0;
  let intersect = 0;
  for (const t of A) if (B.has(t)) intersect++;
  return intersect / (A.size + B.size - intersect);
}

function isAIRewrite(line: string, sources: string[], threshold = 0.7): boolean {
  let best = 0;
  for (const src of sources) {
    const sim = jaccardSimilarity(line, src);
    if (sim > best) best = sim;
    if (best >= threshold) return false;
  }
  return best < threshold;
}

/**
 * Tag each bullet line in the markdown content with `[AI] ` if it does not
 * closely match any of the supplied source bullets. Non-bullet lines, section
 * headers, and bullets that already carry the token are left unchanged.
 */
export function tagAIRewrites(content: string, sources: string[]): string {
  if (!content) return content;
  const trimmedSources = sources.map(s => (s ?? '').trim()).filter(s => s.length > 0);
  if (trimmedSources.length === 0) return content;

  return content
    .split('\n')
    .map(line => {
      const match = line.match(BULLET_LINE_REGEX);
      if (!match) return line;
      const [, prefix, body] = match;
      if (body.startsWith(AI_REWRITE_TOKEN)) return line;
      // Strip markdown emphasis so similarity isn't thrown off by **bold**.
      const probe = body.replace(/\*\*/g, '').trim();
      if (probe.length < 8) return line;
      if (isAIRewrite(probe, trimmedSources)) {
        return `${prefix}${AI_REWRITE_TOKEN} ${body}`;
      }
      return line;
    })
    .join('\n');
}

/** Strip the AI token from anywhere it appears. Used by exporters. */
export function stripAIRewriteTokens(content: string): string {
  if (!content) return content;
  return content
    .split('\n')
    .map(line => {
      const match = line.match(BULLET_LINE_REGEX);
      if (!match) return line.replace(/\[AI\]\s*/g, '');
      const [, prefix, body] = match;
      if (body.startsWith(AI_REWRITE_TOKEN)) {
        return `${prefix}${body.slice(AI_REWRITE_TOKEN.length).trimStart()}`;
      }
      return line;
    })
    .join('\n');
}

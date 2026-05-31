export interface BridgedGap {
  skill: string;
  statement: string;
}

const MAX_GAPS = 8;

/**
 * Removes every bracketed placeholder (e.g. "[X]", "[X]%") and tidies the
 * surrounding prose. This is the integrity guarantee: no placeholder may reach
 * a prompt. Heuristic but bounded — worst case it leaves a slightly terse
 * sentence; it never fabricates a number and never leaves a bracket.
 */
export function stripPlaceholders(input: string): string {
  let s = (input || '').trim();
  if (!s) return '';
  // Remove the bracket token plus a single adjacent quantity word if present
  // ("[X] clients" -> "clients", "[X]%" -> "").
  s = s.replace(/\[[^\]]*\]%?/g, ' ');
  // Collapse whitespace, fix orphaned spaces before punctuation.
  s = s.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim();
  // Trim a trailing dangling connective/punctuation left by the removal.
  s = s.replace(/[\s,]+$/g, '').trim();
  s = s.replace(/\s+(?:by|to|for|in|of|and|a|an)$/i, '').trim();
  return s;
}

/**
 * Normalises an untrusted bridgedGaps payload from the client: strips
 * placeholders, drops empties, dedupes by statement, caps the count.
 */
export function normalizeBridgedGaps(raw: unknown): BridgedGap[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: BridgedGap[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const skill = typeof (item as any).skill === 'string' ? (item as any).skill.trim() : '';
    const statement = stripPlaceholders(typeof (item as any).statement === 'string' ? (item as any).statement : '');
    if (!skill || !statement) continue;
    const key = statement.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ skill, statement });
    if (out.length >= MAX_GAPS) break;
  }
  return out;
}

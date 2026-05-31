export interface BridgedGap {
  skill: string;
  statement: string;
}

/**
 * Derives the default committed statement for a ticked gap: removes a metric
 * clause that contains a "[…]" placeholder so the default reads as a clean
 * capability ("Developed and implemented a content strategy"). If there is no
 * placeholder, the suggestion is returned trimmed. The server applies its own
 * authoritative guard (normalizeBridgedGaps) on top of this.
 */
export function capabilityStatement(suggestion: string): string {
  let s = (suggestion || '').trim();
  if (!s) return '';
  if (!/\[[^\]]*\]/.test(s)) return s;
  s = s.replace(/\[[^\]]*\]%?/g, ' ');
  s = s.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim();
  s = s.replace(/[\s,]+$/g, '').trim();
  s = s.replace(/\s+(?:by|to|for|in|of|and|a|an)$/i, '').trim();
  return s;
}

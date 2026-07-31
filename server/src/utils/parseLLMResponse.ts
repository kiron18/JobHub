/**
 * Escapes raw control characters that appear INSIDE JSON string literals.
 *
 * JSON forbids literal tabs, newlines and other control characters inside a
 * string — they must be written as \t, \n and so on. Models break this whenever
 * they quote source material verbatim, and resumes are full of tabs used for
 * alignment, so a prompt that asks for an exact quote reliably produces invalid
 * JSON. This repairs the body instead of losing the whole response.
 *
 * Only characters inside strings are touched; outside a string a newline or tab
 * is legal whitespace and must be left alone.
 */
function escapeControlCharsInStrings(text: string): string {
  const ESCAPES: Record<string, string> = {
    '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t',
  };
  let out = '';
  let inString = false;
  let escaped = false;

  for (const ch of text) {
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === '\\' && inString) { out += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }

    if (inString && ch < ' ') {
      out += ESCAPES[ch] ?? `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
      continue;
    }
    out += ch;
  }
  return out;
}

export function parseLLMJson(raw: string): any {
  // Strip markdown fences
  let cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Direct parse
  try { return JSON.parse(cleaned); } catch {}

  // Extract outermost {...} block (handles leading/trailing prose)
  const objStart = cleaned.indexOf('{');
  const objEnd = cleaned.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    const candidate = cleaned.slice(objStart, objEnd + 1);
    try { return JSON.parse(candidate); } catch {}

    // Raw tabs/newlines inside string literals — the commonest failure when the
    // model quotes source text verbatim. Try this before the comment strip,
    // since it fixes bodies that are otherwise perfectly well formed.
    try { return JSON.parse(escapeControlCharsInStrings(candidate)); } catch {}

    // Remove single-line JS comments then retry (Llama sometimes adds them)
    const noComments = candidate.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    try { return JSON.parse(noComments); } catch {}
    try { return JSON.parse(escapeControlCharsInStrings(noComments)); } catch {}
  }

  // Extract outermost [...] block (for prompts that return arrays)
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    const candidate = cleaned.slice(arrStart, arrEnd + 1);
    try { return JSON.parse(candidate); } catch {}
  }

  // Dump the whole response, not the first 500 chars — a truncated log made a
  // malformed-JSON failure look like a token-limit failure and sent debugging
  // down the wrong path entirely.
  console.error(`[LLM Parse Failure] length=${raw.length} tail=${JSON.stringify(raw.slice(-220))}`);
  console.error('[LLM Parse Failure] head:', raw.substring(0, 400));
  throw new Error('LLM returned unparseable response');
}

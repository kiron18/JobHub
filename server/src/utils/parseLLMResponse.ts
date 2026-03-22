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

    // Remove single-line JS comments then retry (Llama sometimes adds them)
    const noComments = candidate.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    try { return JSON.parse(noComments); } catch {}
  }

  // Extract outermost [...] block (for prompts that return arrays)
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    const candidate = cleaned.slice(arrStart, arrEnd + 1);
    try { return JSON.parse(candidate); } catch {}
  }

  console.error('[LLM Parse Failure] Raw response:', raw.substring(0, 500));
  throw new Error('LLM returned unparseable response');
}

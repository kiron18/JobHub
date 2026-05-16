// A bullet is "duty-like" when it reads as a job responsibility (no measurable
// outcome). Heuristic: no digits, no monetary marker, and opens with one of
// the classic duty phrasings. Kept conservative — better to under-flag than to
// outline a legitimate achievement.
export function isDutyLikeBullet(bullet: string): boolean {
  const text = (bullet ?? '').trim();
  if (text.length < 8) return false;
  if (/\d/.test(text)) return false;
  if (/[$%]/.test(text)) return false;
  const lower = text.toLowerCase();
  const dutyOpeners = [
    'responsible for', 'managed', 'worked on', 'assisted', 'helped',
    'supported', 'was involved', 'collaborated', 'participated', 'contributed',
    'led', 'conducted', 'provided', 'delivered', 'performed', 'handled',
    'oversaw', 'coordinated',
  ];
  return dutyOpeners.some(opener => lower.startsWith(opener) || lower.includes(' ' + opener + ' '));
}

// Real metric: not empty, not the literal string "qualitative", and not one of
// the LLM-extracted placeholders that masquerade as values ("None", "N/A", etc.).
export function isRealMetric(metric: string | null | undefined): boolean {
  if (!metric) return false;
  const trimmed = metric.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed === 'qualitative') return false;
  if (['none', 'n/a', 'na', '-', '–', 'tbd', 'null', 'undefined'].includes(trimmed)) return false;
  return true;
}

export function isRealMetric(metric: string | null | undefined): boolean {
  if (!metric) return false;
  const trimmed = metric.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed === 'qualitative') return false;
  if (['none', 'n/a', 'na', '-', '–', 'tbd', 'null', 'undefined'].includes(trimmed)) return false;
  return true;
}

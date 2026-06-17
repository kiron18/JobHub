import { normalise } from '../../utils/deduplicateJobs';

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'at', 'with']);

function tokens(s: string): Set<string> {
  return new Set(normalise(s).split(' ').filter(t => t && !STOP.has(t)));
}

/** Jaccard-style overlap of role tokens present in the job title (0..1). */
export function relevanceScore(jobTitle: string, role: string): number {
  const t = tokens(jobTitle);
  const r = tokens(role);
  if (r.size === 0) return 0;
  let hit = 0;
  for (const tok of r) if (t.has(tok)) hit++;
  return hit / r.size;
}

export interface CacheEntry {
  analysis: any;
  at: number;
}
export type AnalysisCache = Record<string, CacheEntry>;

const MAX_ENTRIES = 10;

/** Returns the cached analysis for `hash` if present and within `ttlMs`, else null. */
export function readAnalysisCache(cache: unknown, hash: string, now: number, ttlMs: number): any | null {
  if (!cache || typeof cache !== 'object') return null;
  const entry = (cache as AnalysisCache)[hash];
  if (!entry || typeof entry.at !== 'number') return null;
  if (now - entry.at >= ttlMs) return null;
  return entry.analysis ?? null;
}

/** Returns a NEW cache object with `hash` written and bounded to the newest MAX_ENTRIES. */
export function writeAnalysisCache(cache: unknown, hash: string, analysis: any, now: number): AnalysisCache {
  const base: AnalysisCache = (cache && typeof cache === 'object') ? { ...(cache as AnalysisCache) } : {};
  base[hash] = { analysis, at: now };
  const trimmed = Object.entries(base).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
  return Object.fromEntries(trimmed);
}

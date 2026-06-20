import type { IngestionSource } from '../services/ingestion/types';

export const INGESTION_SOURCES: Record<IngestionSource, boolean> = {
  adzuna: true,
  jsearch: false, // Disabled: API returns empty results for AU queries (US-only data)
  seek: true,
  indeed: true,
  jora: true,
  linkedin: true,
  cache: true,
};

export const MAX_PAGES_PER_SOURCE = 1; // Single page for faster initial load
export const RELEVANCE_THRESHOLD = 0.34;
export const SEEK_SEARCH_MODE: 'keyword' | 'classification' = 'keyword';
export const CACHE_MIN_HITS = 1;

// Cache-quality gate: a cached day-result is only trusted as a HIT when it looks
// like a genuine multi-source scrape. A thin result (e.g. only Adzuna survived
// because the Firecrawl sources transiently failed) must NOT be pinned for the
// whole day — it should be re-scraped so the feed self-heals. A result is healthy
// if it spans >= MIN distinct platforms OR has >= MIN_JOBS jobs.
export const HEALTHY_CACHE_MIN_PLATFORMS = 2;
export const HEALTHY_CACHE_MIN_JOBS = 6;
// Don't re-scrape a thin key more than once per cooldown, to bound credit/latency
// cost on genuinely sparse roles where a fuller result will never appear.
export const THIN_CACHE_RESCRAPE_COOLDOWN_MS = 30 * 60 * 1000; // 30 min

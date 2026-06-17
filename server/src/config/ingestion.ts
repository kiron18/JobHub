import type { IngestionSource } from '../services/ingestion/types';

export const INGESTION_SOURCES: Record<IngestionSource, boolean> = {
  adzuna: true,
  jsearch: false, // Disabled: API returns empty results for AU queries (US-only data)
  seek: true,
};

export const MAX_PAGES_PER_SOURCE = 1; // Single page for faster initial load
export const RELEVANCE_THRESHOLD = 0.34;
export const SEEK_SEARCH_MODE: 'keyword' | 'classification' = 'keyword';
export const CACHE_MIN_HITS = 3;

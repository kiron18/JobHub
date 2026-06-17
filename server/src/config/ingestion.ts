import type { IngestionSource } from '../services/ingestion/types';

export const INGESTION_SOURCES: Record<IngestionSource, boolean> = {
  adzuna: true,
  jsearch: true,
  seek: true,
};

export const MAX_PAGES_PER_SOURCE = 2;
export const RELEVANCE_THRESHOLD = 0.34;
export const SEEK_SEARCH_MODE: 'keyword' | 'classification' = 'keyword';

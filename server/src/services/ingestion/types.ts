import type { RawJob } from '../jobFeed';

export type IngestionSource = 'adzuna' | 'jsearch' | 'seek' | 'indeed' | 'jora' | 'linkedin' | 'cache';

export interface SearchQuery {
  role: string;
  location: string;
  maxPages: number;
}

export interface SourceReport {
  source: IngestionSource;
  rawCount: number;
  blocked: boolean;
  errorMessage: string | null;
  latencyMs: number;
  creditsUsed: number;
}

export interface AdapterResult {
  jobs: RawJob[];
  report: SourceReport;
}

export interface SourceAdapter {
  readonly source: IngestionSource;
  search(query: SearchQuery): Promise<AdapterResult>;
}

import type { MergedJob } from './mergeSources';
import { mergeSources } from './mergeSources';
import { persistMergedJobs } from './persist';
import { seekAdapter } from './adapters/seek';
import { adzunaAdapter } from './adapters/adzuna';
import { jsearchAdapter } from './adapters/jsearch';
import type { SourceAdapter, SourceReport, IngestionSource } from './types';
import { INGESTION_SOURCES, MAX_PAGES_PER_SOURCE } from '../../config/ingestion';

const ALL: SourceAdapter[] = [adzunaAdapter, jsearchAdapter, seekAdapter];

export async function runIngestionForTitle(
  role: string, location: string, trigger: 'user_scan' | 'manual' | 'cron',
): Promise<{ jobs: MergedJob[]; reports: SourceReport[] }> {
  const adapters = ALL.filter(a => INGESTION_SOURCES[a.source as IngestionSource]);
  const results = await Promise.all(
    adapters.map(a => a.search({ role, location, maxPages: MAX_PAGES_PER_SOURCE })
      .catch((e): { jobs: []; report: SourceReport } => ({
        jobs: [], report: { source: a.source, rawCount: 0, blocked: false,
          errorMessage: e?.message ?? 'adapter error', latencyMs: 0, creditsUsed: 0 } }))),
  );
  const merged = mergeSources(results.map(r => ({ source: (r as any).report.source, jobs: r.jobs })), role);
  const reports = results.map(r => r.report);
  await persistMergedJobs({ merged, reports, trigger, role, location });
  return { jobs: merged, reports };
}

import type { RawJob } from './jobFeed';
import { runIngestionForTitle } from './ingestion/runIngestion';
import type { MergedJob } from './ingestion/mergeSources';
import type { SourceReport } from './ingestion/types';

function toRawJob(m: MergedJob): RawJob {
  const source = m.sources[0];
  return {
    title: m.title,
    company: m.company,
    location: m.location ?? '',
    salary: m.salary,
    description: m.description,
    sourceUrl: source?.sourceUrl ?? '',
    sourcePlatform: source?.source ?? 'seek',
    postedAt: m.postedAt,
  };
}

export interface ScrapeResult {
  jobs: RawJob[];
  reports: SourceReport[];
}

export async function scrapeJobsForTitles(titles: string[], location: string): Promise<ScrapeResult> {
  const allReports: SourceReport[] = [];
  const runs = await Promise.all(
    titles.map(t => runIngestionForTitle(t, location, 'user_scan')
      .catch((e) => {
        console.error(`[scrapeJobsForTitles] Failed for "${t}":`, e.message);
        return { jobs: [] as MergedJob[], reports: [] as SourceReport[] };
      })
    )
  );

  const allJobs: MergedJob[] = [];
  for (const run of runs) {
    allJobs.push(...run.jobs);
    allReports.push(...run.reports);
  }

  // Filter out low relevance and dedupe
  const filtered = allJobs.filter(m => !m.lowRelevance);
  const seen = new Set<string>();
  const deduped = filtered.filter(m => (seen.has(m.dedupKey) ? false : (seen.add(m.dedupKey), true)));

  console.log(`[scrapeJobsForTitles] ${titles.length} roles, ${deduped.length} unique jobs after dedupe`);
  console.log(`[scrapeJobsForTitles] Reports:`, allReports.map(r => `${r.source}=${r.rawCount}${r.source === 'cache' ? '(cached)' : ''}`).join(', '));

  return {
    jobs: deduped.map(toRawJob),
    reports: allReports,
  };
}

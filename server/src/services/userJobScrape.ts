import type { RawJob } from './jobFeed';
import { runIngestionForTitle } from './ingestion/runIngestion';
import type { MergedJob } from './ingestion/mergeSources';

function toRawJob(m: MergedJob): RawJob {
  return {
    title: m.title, company: m.company, location: m.location ?? '', salary: m.salary,
    description: m.description, sourceUrl: m.sources[0]?.sourceUrl ?? '',
    sourcePlatform: m.sources[0]?.source ?? 'seek', postedAt: m.postedAt,
  };
}

export async function scrapeJobsForTitles(titles: string[], location: string): Promise<RawJob[]> {
  const runs = await Promise.all(titles.map(t => runIngestionForTitle(t, location, 'user_scan').catch(() => ({ jobs: [] as MergedJob[], reports: [] }))));
  const all = runs.flatMap(r => r.jobs).filter(m => !m.lowRelevance);
  const seen = new Set<string>();
  return all.filter(m => (seen.has(m.dedupKey) ? false : (seen.add(m.dedupKey), true))).map(toRawJob);
}

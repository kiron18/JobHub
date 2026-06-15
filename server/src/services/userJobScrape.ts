import type { RawJob } from './jobFeed';
import { buildSeekClusterKey, fetchSeekJobsForCluster } from './seekScraper';

export async function scrapeJobsForTitles(titles: string[], location: string): Promise<RawJob[]> {
  // Scrape every title in parallel. Sequential awaits stacked the Seek actor
  // cold-starts back-to-back and blew past the claim wait window, so jobs never
  // landed in time. One slow title no longer blocks the others.
  const results = await Promise.all(
    titles.map(title =>
      fetchSeekJobsForCluster(buildSeekClusterKey(title, location, null)).catch(() => [] as RawJob[]),
    ),
  );
  const all = results.flat();
  // Local dedupe by sourceUrl (deduplicateJobs requires two arrays, see Phase 0.3).
  const seen = new Set<string>();
  return all.filter(j => (j.sourceUrl && !seen.has(j.sourceUrl)) ? (seen.add(j.sourceUrl), true) : false);
}

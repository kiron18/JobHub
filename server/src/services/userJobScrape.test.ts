import { describe, it, expect, vi } from 'vitest';
import type { MergedJob } from './ingestion/mergeSources';

// scrapeJobsForTitles fans out to runIngestionForTitle (the multi-source ingestion
// pipeline), so that is what we mock — no network is hit.
vi.mock('./ingestion/runIngestion', () => ({
  runIngestionForTitle: vi.fn(),
}));

async function getModule() {
  const { scrapeJobsForTitles } = await import('./userJobScrape');
  const { runIngestionForTitle } = await import('./ingestion/runIngestion');
  return { scrapeJobsForTitles, runIngestionForTitle };
}

function mj(partial: Partial<MergedJob> & { dedupKey: string }): MergedJob {
  return {
    dedupKey: partial.dedupKey,
    title: partial.title ?? 'Role',
    company: partial.company ?? 'Co',
    normalizedCompany: 'co',
    location: partial.location ?? 'Sydney, NSW',
    locationKey: null,
    salary: null,
    description: '',
    descriptionHydrated: false,
    postedAt: null,
    relevanceScore: partial.relevanceScore ?? 1,
    lowRelevance: partial.lowRelevance ?? false,
    searchRole: partial.searchRole ?? 'Role',
    // toRawJob reads sources[0].sourceUrl — use the dedupKey as the URL for assertions.
    sources: partial.sources ?? [{ source: 'seek', sourceUrl: partial.dedupKey, sourceJobId: null }],
  };
}

describe('scrapeJobsForTitles', () => {
  it('runs all titles concurrently, not one after another', async () => {
    const { scrapeJobsForTitles, runIngestionForTitle } = await getModule();
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(runIngestionForTitle).mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 20));
      inFlight--;
      return { jobs: [], reports: [] };
    });

    await scrapeJobsForTitles(['A', 'B', 'C'], 'Melbourne, VIC');
    expect(maxInFlight).toBe(3);
  });

  it('dedupes by dedupKey and drops low-relevance jobs', async () => {
    const { scrapeJobsForTitles, runIngestionForTitle } = await getModule();
    vi.mocked(runIngestionForTitle)
      .mockResolvedValueOnce({ jobs: [mj({ dedupKey: '1' }), mj({ dedupKey: '2' })], reports: [] })
      .mockResolvedValueOnce({ jobs: [mj({ dedupKey: '2' }), mj({ dedupKey: '3', lowRelevance: true })], reports: [] });

    const out = await scrapeJobsForTitles(['A', 'B'], 'Sydney, NSW');
    // '2' is a duplicate, '3' is low-relevance — both excluded.
    expect(out.jobs.map(j => j.sourceUrl).sort()).toEqual(['1', '2']);
  });

  it('drops jobs in a different state but keeps same-state, nearby, and unknown-location jobs', async () => {
    const { scrapeJobsForTitles, runIngestionForTitle } = await getModule();
    vi.mocked(runIngestionForTitle).mockResolvedValueOnce({
      jobs: [
        mj({ dedupKey: 'local', location: 'Griffith, NSW' }),
        mj({ dedupKey: 'nearby', location: 'Leeton NSW' }),     // same state, no comma
        mj({ dedupKey: 'wrongstate', location: 'Perth, WA' }),  // different state — dropped
        mj({ dedupKey: 'unknown', location: '' }),              // unknown — kept
      ],
      reports: [],
    });

    const out = await scrapeJobsForTitles(['A'], 'Griffith, NSW');
    expect(out.jobs.map(j => j.sourceUrl).sort()).toEqual(['local', 'nearby', 'unknown']);
  });
});

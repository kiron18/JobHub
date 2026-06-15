import { describe, it, expect, vi } from 'vitest';
import type { RawJob } from './jobFeed';

// Mock the Seek scraper so no network is hit.
vi.mock('./seekScraper', () => ({
  buildSeekClusterKey: (role: string, city: string) => `${role}|${city}`,
  fetchSeekJobsForCluster: vi.fn(),
}));

async function getModule() {
  const { scrapeJobsForTitles } = await import('./userJobScrape');
  const { fetchSeekJobsForCluster } = await import('./seekScraper');
  return { scrapeJobsForTitles, fetchSeekJobsForCluster };
}

const job = (url: string): RawJob => ({ sourceUrl: url } as RawJob);

describe('scrapeJobsForTitles', () => {
  it('scrapes all titles concurrently, not one after another', async () => {
    const { scrapeJobsForTitles, fetchSeekJobsForCluster } = await getModule();

    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(fetchSeekJobsForCluster).mockImplementation(async (cluster: any) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 20));
      inFlight--;
      return [job(`https://seek/${cluster}`)];
    });

    await scrapeJobsForTitles(['A', 'B', 'C'], 'Melbourne');

    // Sequential code peaks at 1 concurrent call; parallel peaks at 3.
    expect(maxInFlight).toBe(3);
  });

  it('concatenates results and dedupes by sourceUrl', async () => {
    const { scrapeJobsForTitles, fetchSeekJobsForCluster } = await getModule();

    vi.mocked(fetchSeekJobsForCluster)
      .mockResolvedValueOnce([job('https://seek/1'), job('https://seek/2')])
      .mockResolvedValueOnce([job('https://seek/2'), job('https://seek/3')]); // 2 is a dup

    const out = await scrapeJobsForTitles(['A', 'B'], 'Sydney');
    expect(out.map(j => j.sourceUrl).sort()).toEqual([
      'https://seek/1',
      'https://seek/2',
      'https://seek/3',
    ]);
  });
});

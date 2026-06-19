import type { RawJob } from '../../jobFeed';
import type { SourceAdapter, SearchQuery, AdapterResult } from '../types';
import { firecrawlScrape } from '../firecrawl';
import { parseLinkedInMarkdown } from '../parseLinkedInMarkdown';
import { normalizeLocation } from '../locationNormalize';

function buildUrl(role: string, location: string, page: number): string {
  // LinkedIn's public guest jobs API returns HTML job cards with no login.
  // It is the only reliably-parseable no-auth surface; expect frequent blocking.
  const kw = encodeURIComponent(role);
  const loc = encodeURIComponent(normalizeLocation(location));
  const start = (page - 1) * 25; // LinkedIn paginates in steps of 25
  return `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${kw}&location=${loc}&start=${start}`;
}

export const linkedinAdapter: SourceAdapter = {
  source: 'linkedin',
  async search({ role, location, maxPages }: SearchQuery): Promise<AdapterResult> {
    const started = Date.now();
    let blocked = false;
    let errorMessage: string | null = null;

    try {
      const urls = Array.from({ length: maxPages }, (_, i) => buildUrl(role, location, i + 1));
      console.log(`[LinkedIn] Scraping ${urls.length} pages for "${role}" in "${location}"`);

      const scrapeResults = await Promise.all(
        urls.map((url, idx) =>
          new Promise<{ markdown: string; blocked: boolean }>((resolve) => {
            setTimeout(() => { firecrawlScrape(url).then(resolve); }, idx * 150);
          })
        )
      );

      const allJobs: RawJob[] = [];
      for (let i = 0; i < scrapeResults.length; i++) {
        const { markdown, blocked: b } = scrapeResults[i];
        console.log(`[LinkedIn] Page ${i + 1}: blocked=${b}, length=${markdown?.length || 0}`);

        if (b) {
          if (i === 0) {
            blocked = true;
            errorMessage = 'LinkedIn is blocking scraping attempts';
          }
          break;
        }

        const parsed = await parseLinkedInMarkdown(markdown);
        console.log(`[LinkedIn] Page ${i + 1}: parsed ${parsed.length} jobs`);
        if (parsed.length === 0) break;
        allJobs.push(...parsed);
      }

      // Deduplicate by sourceUrl
      const seen = new Set<string>();
      const deduped = allJobs.filter(j => {
        if (seen.has(j.sourceUrl)) return false;
        seen.add(j.sourceUrl);
        return true;
      });

      console.log(`[LinkedIn] Total: ${deduped.length} unique jobs`);

      return {
        jobs: deduped,
        report: {
          source: 'linkedin',
          rawCount: deduped.length,
          blocked,
          errorMessage,
          latencyMs: Date.now() - started,
          creditsUsed: scrapeResults.length,
        },
      };
    } catch (e: any) {
      errorMessage = e?.message ?? 'linkedin adapter error';
      console.error(`[LinkedIn] Adapter error:`, e);
      return {
        jobs: [],
        report: {
          source: 'linkedin',
          rawCount: 0,
          blocked: true,
          errorMessage,
          latencyMs: Date.now() - started,
          creditsUsed: maxPages,
        },
      };
    }
  },
};

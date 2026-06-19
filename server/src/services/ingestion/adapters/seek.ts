import type { RawJob } from '../../jobFeed';
import type { SourceAdapter, SearchQuery, AdapterResult } from '../types';
import { firecrawlScrape } from '../firecrawl';
import { parseSeekMarkdown } from '../parseSeekMarkdown';
import { SEEK_SEARCH_MODE } from '../../../config/ingestion';
import { normalizeLocation } from '../locationNormalize';

function buildUrl(role: string, location: string, page: number): string {
  // Normalize location: trim, fix common typos, format for URL
  const loc = normalizeLocation(location).replace(/\s+/g, '-');

  if (SEEK_SEARCH_MODE === 'keyword') {
    const kw = encodeURIComponent(role);
    return `https://au.seek.com/jobs?keywords=${kw}&where=${encodeURIComponent(location)}&page=${page}`;
  }
  const slug = role.trim().toLowerCase().replace(/\s+/g, '-');
  return `https://au.seek.com/${slug}-jobs/in-${loc}?page=${page}`;
}

export const seekAdapter: SourceAdapter = {
  source: 'seek',
  async search({ role, location, maxPages }: SearchQuery): Promise<AdapterResult> {
    const started = Date.now();
    let blocked = false;
    let errorMessage: string | null = null;

    try {
      // Build all page URLs upfront
      const urls = Array.from({ length: maxPages }, (_, i) => buildUrl(role, location, i + 1));
      console.log(`[SEEK] Parallel scraping ${urls.length} pages for "${role}" in "${location}":`, urls);

      // Scrape all pages in parallel with staggered delays to avoid rate limiting
      const scrapeResults = await Promise.all(
        urls.map((url, idx) =>
          new Promise<{ markdown: string; blocked: boolean }>((resolve) => {
            // Add small stagger between requests (100ms per index)
            setTimeout(() => {
              firecrawlScrape(url).then(resolve);
            }, idx * 100);
          })
        )
      );

      // Process results - stop at first empty page or block
      const allJobs: RawJob[] = [];
      let blockedPages = 0;
      let emptyPages = 0;

      for (let i = 0; i < scrapeResults.length; i++) {
        const { markdown, blocked: b } = scrapeResults[i];
        console.log(`[SEEK] Page ${i + 1}: blocked=${b}, markdownLength=${markdown?.length || 0}`);

        if (b) {
          blockedPages++;
          if (i === 0) {
            blocked = true; // Only mark fully blocked if first page fails
            errorMessage = 'SEEK is blocking scraping attempts';
          }
          break;
        }

        const parsed = await parseSeekMarkdown(markdown);
        console.log(`[SEEK] Page ${i + 1}: parsed ${parsed.length} jobs`);

        if (parsed.length === 0) {
          emptyPages++;
          // Empty page means no more results
          break;
        }

        allJobs.push(...parsed);
      }

      // Deduplicate by sourceUrl in case of overlap between pages
      const seen = new Set<string>();
      const deduped = allJobs.filter(j => {
        if (seen.has(j.sourceUrl)) return false;
        seen.add(j.sourceUrl);
        return true;
      });

      console.log(`[SEEK] Total: ${deduped.length} unique jobs from ${maxPages} pages (blockedPages=${blockedPages}, emptyPages=${emptyPages})`);

      return {
        jobs: deduped,
        report: {
          source: 'seek',
          rawCount: deduped.length,
          blocked,
          errorMessage,
          latencyMs: Date.now() - started,
          creditsUsed: scrapeResults.length,
        },
      };
    } catch (e: any) {
      errorMessage = e?.message ?? 'seek adapter error';
      console.error(`[SEEK] Adapter error:`, e);
      return {
        jobs: [],
        report: {
          source: 'seek',
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

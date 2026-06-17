import type { RawJob } from '../../jobFeed';
import type { SourceAdapter, SearchQuery, AdapterResult } from '../types';
import { firecrawlScrape } from '../firecrawl';
import { parseSeekMarkdown } from '../parseSeekMarkdown';
import { SEEK_SEARCH_MODE } from '../../../config/ingestion';

function buildUrl(role: string, location: string, page: number): string {
  const loc = location.trim().replace(/\s+/g, '-');
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
    const jobs: RawJob[] = [];
    let credits = 0;
    let blocked = false;
    let errorMessage: string | null = null;
    try {
      for (let page = 1; page <= maxPages; page++) {
        const url = buildUrl(role, location, page);
        console.log(`[SEEK] Scraping: ${url}`);
        const { markdown, blocked: b } = await firecrawlScrape(url);
        console.log(`[SEEK] Result: blocked=${b}, markdownLength=${markdown?.length || 0}`);
        credits += 1;
        if (b) { blocked = page === 1; break; }
        const parsed = await parseSeekMarkdown(markdown);
        if (parsed.length === 0) break;
        jobs.push(...parsed);
      }
    } catch (e: any) {
      errorMessage = e?.message ?? 'seek adapter error';
    }
    return {
      jobs,
      report: { source: 'seek', rawCount: jobs.length, blocked, errorMessage,
                latencyMs: Date.now() - started, creditsUsed: credits },
    };
  },
};

import type { RawJob } from '../../jobFeed';
import type { SourceAdapter, SearchQuery, AdapterResult } from '../types';
import { firecrawlScrape } from '../firecrawl';
import { normalizeLocation } from '../locationNormalize';

function buildUrl(role: string, location: string, page: number): string {
  // Indeed AU uses q= and l= params
  const loc = normalizeLocation(location);
  const kw = encodeURIComponent(role);
  const where = encodeURIComponent(loc);
  // Page starts at 0 for Indeed (0, 10, 20... for pagination)
  const start = (page - 1) * 10;
  return `https://au.indeed.com/jobs?q=${kw}&l=${where}&start=${start}`;
}

function parseIndeedMarkdown(markdown: string): RawJob[] {
  const jobs: RawJob[] = [];

  // Indeed job cards pattern - look for job titles with company names
  // Pattern: job title link followed by company info
  const jobBlocks = markdown.split(/\n{2,}/);

  for (const block of jobBlocks) {
    // Look for job title patterns
    const titleMatch = block.match(/^#{1,3}\s*(.+)|^\*\*(.+)\*\*|^\[([^\]]+)\]\(https:\/\/au\.indeed\.com\/view_job[^)]*\)/m);
    if (!titleMatch) continue;

    const title = titleMatch[1] || titleMatch[2] || titleMatch[3];
    if (!title || title.length < 3) continue;

    // Extract company - usually follows the title
    let company = 'Unknown';
    const companyMatch = block.match(/(?:company|employer)[:\s]+([^\n]+)/i) ||
                        block.match(/\n([A-Za-z][A-Za-z0-9\s&]+)(?:\n|$)/);
    if (companyMatch) {
      company = companyMatch[1].trim();
    }

    // Extract location
    let location = '';
    const locMatch = block.match(/(?:location|in)[:\s]+([^\n,]+(?:,\s*[A-Z]{2,3})?)/i);
    if (locMatch) {
      location = locMatch[1].trim();
    }

    // Extract salary if present
    let salary: string | null = null;
    const salaryMatch = block.match(/\$[\d,]+(?:\.\d{2})?(?:\s*-\s*\$[\d,]+(?:\.\d{2})?)?/);
    const salaryTextMatch = block.match(/(?:salary|pay)[:\s]+([^\n]+)/i);
    if (salaryMatch) {
      salary = salaryMatch[0];
    } else if (salaryTextMatch) {
      salary = salaryTextMatch[1].trim();
    }

    // Extract job URL
    let sourceUrl = '';
    const urlMatch = block.match(/https:\/\/au\.indeed\.com\/view_job[^\s\)]+/);
    if (urlMatch) {
      sourceUrl = urlMatch[0];
    }

    // Extract posted date
    let postedAt: Date | null = null;
    const dateMatch = block.match(/(?:posted|days? ago|hours? ago)(?:[:\s]+)?([^\n]+)/i);
    if (dateMatch) {
      const dateText = dateMatch[1].trim().toLowerCase();
      if (dateText.includes('day')) {
        const days = parseInt(dateText);
        if (!isNaN(days)) {
          postedAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        }
      } else if (dateText.includes('hour')) {
        const hours = parseInt(dateText);
        if (!isNaN(hours)) {
          postedAt = new Date(Date.now() - hours * 60 * 60 * 1000);
        }
      }
    }

    // Only add if we have minimum data
    if (title && sourceUrl) {
      jobs.push({
        title: title.trim(),
        company: company.trim(),
        location,
        salary,
        description: block.slice(0, 500), // First 500 chars as preview
        sourceUrl,
        sourcePlatform: 'indeed',
        postedAt,
      });
    }
  }

  return jobs;
}

export const indeedAdapter: SourceAdapter = {
  source: 'indeed',
  async search({ role, location, maxPages }: SearchQuery): Promise<AdapterResult> {
    const started = Date.now();
    let blocked = false;
    let errorMessage: string | null = null;

    try {
      // Build all page URLs upfront
      const urls = Array.from({ length: maxPages }, (_, i) => buildUrl(role, location, i + 1));
      console.log(`[Indeed] Scraping ${urls.length} pages for "${role}" in "${location}"`);

      // Scrape all pages with staggered delays
      const scrapeResults = await Promise.all(
        urls.map((url, idx) =>
          new Promise<{ markdown: string; blocked: boolean }>((resolve) => {
            setTimeout(() => {
              firecrawlScrape(url).then(resolve);
            }, idx * 150);
          })
        )
      );

      // Process results
      const allJobs: RawJob[] = [];
      let blockedPages = 0;

      for (let i = 0; i < scrapeResults.length; i++) {
        const { markdown, blocked: b } = scrapeResults[i];
        console.log(`[Indeed] Page ${i + 1}: blocked=${b}, length=${markdown?.length || 0}`);

        if (b) {
          blockedPages++;
          if (i === 0) {
            blocked = true;
            errorMessage = 'Indeed is blocking scraping attempts';
          }
          break;
        }

        const parsed = parseIndeedMarkdown(markdown);
        console.log(`[Indeed] Page ${i + 1}: parsed ${parsed.length} jobs`);

        if (parsed.length === 0) {
          break;
        }

        allJobs.push(...parsed);
      }

      // Deduplicate by sourceUrl
      const seen = new Set<string>();
      const deduped = allJobs.filter(j => {
        if (seen.has(j.sourceUrl)) return false;
        seen.add(j.sourceUrl);
        return true;
      });

      console.log(`[Indeed] Total: ${deduped.length} unique jobs`);

      return {
        jobs: deduped,
        report: {
          source: 'indeed',
          rawCount: deduped.length,
          blocked,
          errorMessage,
          latencyMs: Date.now() - started,
          creditsUsed: scrapeResults.length,
        },
      };
    } catch (e: any) {
      errorMessage = e?.message ?? 'indeed adapter error';
      console.error(`[Indeed] Adapter error:`, e);
      return {
        jobs: [],
        report: {
          source: 'indeed',
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

import type { RawJob } from '../../jobFeed';
import type { SourceAdapter, SearchQuery, AdapterResult } from '../types';
import { firecrawlScrape } from '../firecrawl';
import { normalizeLocation } from '../locationNormalize';

function buildUrl(role: string, location: string, page: number): string {
  // Jora AU search URL format
  const kw = encodeURIComponent(role.toLowerCase().replace(/\s+/g, '-'));
  const loc = normalizeLocation(location).toLowerCase().replace(/,\s*/g, '-').replace(/\s+/g, '-');
  // Jora uses p= for pagination (p=2, p=3...)
  const pageParam = page > 1 ? `?p=${page}` : '';
  return `https://au.jora.com/j?q=${kw}&l=${loc}${pageParam}`;
}

function parseJoraMarkdown(markdown: string): RawJob[] {
  const jobs: RawJob[] = [];

  // Split into blocks and look for job patterns
  // Jora typically lists jobs with title, company, location, summary
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for job title - often bold or linked
    const titleMatch = line.match(/^\*\*([^*]+)\*\*\s*$/) ||
                      line.match(/^#{1,3}\s+(.+)$/) ||
                      line.match(/^\[([^\]]+)\]\(https:\/\/au\.jora\.com\/job[^)]*\)/);

    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    if (!title || title.length < 3 || title.length > 100) continue;

    // Look ahead for company and location (usually next 1-2 lines)
    let company = 'Unknown';
    let location = '';
    let salary: string | null = null;
    let sourceUrl = '';
    let postedAt: Date | null = null;

    // Check next few lines for metadata
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const nextLine = lines[j].trim();
      if (!nextLine) continue;

      // Extract URL from markdown link
      const urlMatch = nextLine.match(/\(https:\/\/au\.jora\.com\/job[^)]+\)/);
      if (urlMatch && !sourceUrl) {
        sourceUrl = urlMatch[0].slice(1, -1); // Remove parentheses
      }

      // Look for company - patterns like "at Company Name" or just company on its own line
      const companyMatch = nextLine.match(/(?:at|with)[:\s]+([A-Z][A-Za-z0-9\s&]+)/i) ||
                          nextLine.match(/^([A-Z][A-Za-z0-9\s&]{2,50})(?:\s*[\-\–]\s*|$)/);
      if (companyMatch && company === 'Unknown') {
        company = companyMatch[1].trim();
      }

      // Look for location
      const locMatch = nextLine.match(/(?:in|location)[:\s]+([^\n,]+(?:,\s*[A-Z]{2,3})?)/i) ||
                      nextLine.match(/([^\n,]+,\s*(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT))/i);
      if (locMatch && !location) {
        location = locMatch[1].trim();
      }

      // Look for salary
      const salaryMatch = nextLine.match(/\$[\d,]+(?:\s*k?)?(?:\s*-\s*\$?[\d,]+(?:\s*k?)?)?/i) ||
                         nextLine.match(/(?:salary|package)[:\s]+([^\n]+)/i);
      if (salaryMatch && !salary) {
        salary = salaryMatch[0].includes('$') ? salaryMatch[0] : salaryMatch[1].trim();
      }

      // Look for posted date
      const dateMatch = nextLine.match(/(\d+)\s*(minute|hour|day|week|month)s?\s+ago/i);
      if (dateMatch && !postedAt) {
        const num = parseInt(dateMatch[1]);
        const unit = dateMatch[2].toLowerCase();
        const multipliers: Record<string, number> = {
          minute: 60 * 1000,
          hour: 60 * 60 * 1000,
          day: 24 * 60 * 60 * 1000,
          week: 7 * 24 * 60 * 60 * 1000,
          month: 30 * 24 * 60 * 60 * 1000,
        };
        postedAt = new Date(Date.now() - num * (multipliers[unit] || 0));
      }

      // Stop if we've collected enough or hit a new job title
      if (nextLine.match(/^\*\*[^*]+\*\*/) || nextLine.match(/^#{1,3}\s+/)) {
        break;
      }
    }

    // Only add if we have minimum viable data
    if (title) {
      jobs.push({
        title: title.trim(),
        company: company.trim(),
        location,
        salary,
        description: '', // Will be fetched later if user clicks
        sourceUrl: sourceUrl || `https://au.jora.com/j?q=${encodeURIComponent(title)}`,
        sourcePlatform: 'jora',
        postedAt,
      });
    }
  }

  return jobs;
}

export const joraAdapter: SourceAdapter = {
  source: 'jora',
  async search({ role, location, maxPages }: SearchQuery): Promise<AdapterResult> {
    const started = Date.now();
    let blocked = false;
    let errorMessage: string | null = null;

    try {
      // Build all page URLs upfront
      const urls = Array.from({ length: maxPages }, (_, i) => buildUrl(role, location, i + 1));
      console.log(`[Jora] Scraping ${urls.length} pages for "${role}" in "${location}"`);

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
        console.log(`[Jora] Page ${i + 1}: blocked=${b}, length=${markdown?.length || 0}`);

        if (b) {
          blockedPages++;
          if (i === 0) {
            blocked = true;
            errorMessage = 'Jora is blocking scraping attempts';
          }
          break;
        }

        const parsed = parseJoraMarkdown(markdown);
        console.log(`[Jora] Page ${i + 1}: parsed ${parsed.length} jobs`);

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

      console.log(`[Jora] Total: ${deduped.length} unique jobs`);

      return {
        jobs: deduped,
        report: {
          source: 'jora',
          rawCount: deduped.length,
          blocked,
          errorMessage,
          latencyMs: Date.now() - started,
          creditsUsed: scrapeResults.length,
        },
      };
    } catch (e: any) {
      errorMessage = e?.message ?? 'jora adapter error';
      console.error(`[Jora] Adapter error:`, e);
      return {
        jobs: [],
        report: {
          source: 'jora',
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

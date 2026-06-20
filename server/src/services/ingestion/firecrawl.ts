import { callClaude } from '../llm';
import { CONCISE_JD_PROMPT } from './prompts/conciseJobDescriptionPrompt';

const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v1/scrape';
const FIRECRAWL_TIMEOUT_MS = 30_000; // 30s timeout
// Cheap, fast model for distilling a scraped page into the essential posting.
const CONCISE_JD_MODEL = process.env.JD_EXTRACT_MODEL || 'anthropic/claude-haiku-4-5';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// Global concurrency limiter. The free Firecrawl plan throttles parallel scrapes,
// and the feed fans out (up to 3 roles x 4 sources = 12 simultaneous calls) which
// causes the throttled ones to abort at the 30s timeout and silently return zero
// jobs — leaving only Adzuna (which never touches Firecrawl). Capping concurrency
// keeps every source within its time budget. Override with FIRECRAWL_MAX_CONCURRENCY.
const FIRECRAWL_MAX_CONCURRENT = Math.max(1, Number(process.env.FIRECRAWL_MAX_CONCURRENCY ?? 4));
let activeScrapes = 0;
const scrapeWaiters: Array<() => void> = [];

function acquireScrapeSlot(): Promise<void> {
  if (activeScrapes < FIRECRAWL_MAX_CONCURRENT) {
    activeScrapes++;
    return Promise.resolve();
  }
  // At capacity: queue and wait for a slot to be handed over on release.
  return new Promise<void>(resolve => scrapeWaiters.push(resolve));
}

function releaseScrapeSlot(): void {
  const next = scrapeWaiters.shift();
  if (next) {
    // Hand the held slot directly to the next waiter (count stays at the cap).
    next();
  } else {
    activeScrapes--;
  }
}

interface FirecrawlResult {
  markdown: string;
  blocked: boolean;
  isBotChallenge?: boolean;
}

/**
 * Detect if the content is a bot challenge/blocked page rather than actual job listings.
 * SEEK and other job boards return challenge pages with specific patterns.
 */
function detectBotChallenge(markdown: string): boolean {
  if (!markdown || markdown.length < 500) return true;

  const challengePatterns = [
    /verify\s*you.*human/i,
    /captcha/i,
    /security\s*check/i,
    /access\s*denied/i,
    /blocked/i,
    /please\s*wait/i,
    /challenge/i,
    /cloudflare/i,
    /ray\s*id/i,
  ];

  const lower = markdown.toLowerCase();
  return challengePatterns.some(p => p.test(lower));
}

/**
 * Detect if the content contains actual job listings.
 * For SEEK, we look for job posting patterns.
 */
function hasJobListings(markdown: string, source: 'seek' | 'generic' = 'generic'): boolean {
  if (!markdown || markdown.length < 1000) return false;

  if (source === 'seek') {
    // SEEK specific patterns
    return /au\.seek\.com\/job\/\d+/i.test(markdown) ||
           /job\/\d+/.test(markdown) && /apply\s*now/i.test(markdown);
  }

  // Generic patterns for job listings
  return /(job|position|role|hiring|apply)/i.test(markdown);
}

async function scrapeWithRetry(url: string, retries = 0): Promise<FirecrawlResult> {
  const start = Date.now();
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error('FIRECRAWL_API_KEY not set');

  console.log(`[Firecrawl] Starting scrape: ${url} (attempt ${retries + 1}/${MAX_RETRIES + 1})`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);

  try {
    const res = await fetch(FIRECRAWL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        // Add waitFor to allow JavaScript to render
        waitFor: 2000,
        // Add mobile user agent for better success rate
        mobile: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const elapsed = Date.now() - start;

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'unknown');
      console.error(`[Firecrawl] HTTP ${res.status} in ${elapsed}ms: ${errorText}`);

      // Retry on 5xx errors or rate limits
      if ((res.status >= 500 || res.status === 429) && retries < MAX_RETRIES) {
        console.log(`[Firecrawl] Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (retries + 1)));
        return scrapeWithRetry(url, retries + 1);
      }

      return { markdown: '', blocked: true };
    }

    const data = await res.json() as { data?: { markdown?: string } };
    const markdown: string = data?.data?.markdown ?? '';

    // Detect if this is a bot challenge page
    const isBotChallenge = detectBotChallenge(markdown);
    const hasJobs = hasJobListings(markdown, url.includes('seek.com') ? 'seek' : 'generic');
    const blocked = !markdown || (isBotChallenge && !hasJobs);

    console.log(`[Firecrawl] Completed in ${elapsed}ms: blocked=${blocked}, isBotChallenge=${isBotChallenge}, hasJobs=${hasJobs}, length=${markdown.length}`);

    return { markdown, blocked, isBotChallenge };
  } catch (e: any) {
    clearTimeout(timeout);
    const elapsed = Date.now() - start;

    if (e?.name === 'AbortError') {
      console.error(`[Firecrawl] TIMEOUT after ${elapsed}ms for ${url}`);
    } else {
      console.error(`[Firecrawl] ERROR after ${elapsed}ms: ${e?.message}`);
    }

    // Retry on network errors
    if (retries < MAX_RETRIES) {
      console.log(`[Firecrawl] Retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (retries + 1)));
      return scrapeWithRetry(url, retries + 1);
    }

    return { markdown: '', blocked: true };
  }
}

export async function firecrawlScrape(url: string): Promise<{ markdown: string; blocked: boolean }> {
  await acquireScrapeSlot();
  try {
    const result = await scrapeWithRetry(url);
    return { markdown: result.markdown, blocked: result.blocked };
  } finally {
    releaseScrapeSlot();
  }
}

/**
 * Fetch and clean a job description from a source URL.
 * Uses Firecrawl for reliable extraction, then cleans the markdown
 * to preserve paragraph structure while removing navigation/footer cruft.
 */
export async function fetchJobDescription(url: string): Promise<{ description: string; blocked: boolean }> {
  const { markdown, blocked } = await firecrawlScrape(url);
  if (blocked || !markdown) {
    return { description: '', blocked: true };
  }

  // Clean the markdown to extract just the job description
  let cleaned = markdown;

  // Remove common navigation/footer patterns
  const removePatterns = [
    /\[.*?\]\(.*?\)/g, // markdown links - keep text only
    /!\[.*?\]\(.*?\)/g, // markdown images
    /^#{1,6}\s*(Apply now|Save|Share|Report|Similar jobs|About the company|Company overview)/gim,
    /\*\s*Apply now\s*\*/gi,
    /\*\s*Save\s*job\s*\*/gi,
    /Copyright\s+\d{4}.*/gi,
    /All rights reserved.*/gi,
    /Privacy policy.*/gi,
    /Terms of (use|service).*/gi,
    /Powered by.*/gi,
  ];

  for (const pattern of removePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Collapse multiple newlines but preserve paragraph structure (max 2 consecutive)
  cleaned = cleaned
    .replace(/\n{4,}/g, '\n\n\n') // Cap at 3 newlines
    .replace(/[ \t]+/g, ' ') // Collapse horizontal whitespace
    .trim();

  // If result is too short, something went wrong
  if (cleaned.length < 200) {
    return { description: '', blocked: true };
  }

  // Distil the cleaned page into the essential posting: role summary, key
  // responsibilities, key requirements, plus salary/type/location when present.
  // This is what a job seeker reads AND what the generator tailors against, so we
  // keep the signal and drop the page chrome. Fall back to the cleaned text if the
  // LLM step fails, so a description always comes back.
  try {
    const { content } = await callClaude(
      CONCISE_JD_PROMPT(cleaned.slice(0, 12000)),
      false, // plain text, not JSON
      undefined,
      CONCISE_JD_MODEL,
    );
    const concise = (content ?? '').trim();
    if (concise.length >= 120) {
      return { description: concise, blocked: false };
    }
  } catch (e: any) {
    console.error('[fetchJobDescription] Concise extraction failed, using cleaned text:', e?.message ?? e);
  }

  // Fallback: the cleaned page, capped so it is never an overwhelming wall.
  return { description: cleaned.slice(0, 4000), blocked: false };
}

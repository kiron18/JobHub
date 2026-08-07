/**
 * Resolve a Seek URL the user pasted into a single job's description.
 *
 * The important case is the one people actually hit: Seek's split view keeps
 * you on a SEARCH results page and carries the selected job in `?jobId=`, e.g.
 *   https://au.seek.com/social-media-marketing-coordinator-jobs/in-All-Sydney-NSW?jobId=93620753
 * Fetching that URL returns the list of 898 jobs, not the job. Worse, the slug
 * lies: that URL's job is actually "Junior Marketing & Communications
 * Coordinator". So we never read the URL text — we pull the id out and refetch
 * the canonical /job/<id> page.
 *
 * Everything here is a plain public GET of a logged-out page. No credentials,
 * no session, nothing written back to Seek.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';

// Intentionally NOT imported from seekHtmlScraper: that module pulls in prisma
// from ../index, which boots the whole server (crons and all) the moment this
// file is imported. Keeping these local makes this module testable on its own.
const SEEK_CANONICAL_HOST = 'https://www.seek.com.au';
const SEEK_DETAIL_TIMEOUT = 12_000;

/**
 * Seek fingerprints the User-Agent. Measured 2026-08-07 against a live job page:
 * the four-part `Chrome/125.0.0.0` / `Chrome/126.0.0.0` form returns 403, while
 * the two-part `Chrome/126.0` form and Firefox both return 200. (Note that
 * seekHtmlScraper.USER_AGENT is a four-part string and is currently being
 * blocked — it just isn't visible because the job feed is shelved.)
 *
 * We try these in order and fall through on a block, so a future change to
 * Seek's rules degrades to "try the next one" instead of a dead feature.
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
];

/** Below this, whatever we scraped is not a job ad — don't let it reach generation. */
export const MIN_DESCRIPTION_CHARS = 400;

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;

export interface SeekJob {
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  workType: string | null;
  classification: string | null;
  description: string;
  sourceUrl: string;
}

/** Caller-facing failure. `code` lets the UI decide between retry and paste-instead. */
export type SeekUrlErrorCode =
  | 'not_a_url'
  | 'not_seek'
  | 'search_page'
  | 'not_found'
  | 'too_short'
  | 'fetch_failed';

export class SeekUrlError extends Error {
  constructor(readonly code: SeekUrlErrorCode, message: string) {
    super(message);
    this.name = 'SeekUrlError';
  }
}

const SEEK_HOST_RE = /(^|\.)seek\.com(\.au)?$/i;

/**
 * Pull the job id out of any Seek URL shape we've seen:
 *   /job/93620753                     canonical
 *   /job/93620753?type=standout       canonical + tracking
 *   /<slug>-jobs/in-Sydney?jobId=...  split view (the common one)
 *   /jobs?jobid=93620753              legacy casing
 */
export function parseSeekJobId(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    throw new SeekUrlError('not_a_url', 'Paste a Seek job link to continue.');
  }

  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    throw new SeekUrlError('not_a_url', "That doesn't look like a link. Copy the URL from your browser's address bar and paste it here.");
  }

  // `new URL()` happily accepts https://nonsense, so a hostname with no dot
  // means they pasted words, not a link — say that instead of "not from Seek".
  if (!url.hostname.includes('.')) {
    throw new SeekUrlError('not_a_url', "That doesn't look like a link. Copy the URL from your browser's address bar and paste it here.");
  }

  if (!SEEK_HOST_RE.test(url.hostname)) {
    throw new SeekUrlError('not_seek', 'That link isn’t from Seek. Paste a seek.com.au job link, or use "Paste the description instead".');
  }

  // Query param wins: on the split view the path is the search, the param is the job.
  for (const [key, value] of url.searchParams) {
    if (key.toLowerCase() === 'jobid' && /^\d{4,}$/.test(value)) return value;
  }

  const path = url.pathname.match(/\/job\/(\d{4,})/);
  if (path) return path[1];

  throw new SeekUrlError(
    'search_page',
    'That’s a Seek search results page, not a single job. Click the job you want first, then copy the URL from the address bar.',
  );
}

export function canonicalSeekUrl(jobId: string): string {
  return `${SEEK_CANONICAL_HOST}/job/${jobId}`;
}

function text($: cheerio.CheerioAPI, automation: string): string | null {
  const el = $(`[data-automation="${automation}"]`).first();
  if (!el.length) return null;
  const v = el.text().replace(/\s+/g, ' ').trim();
  return v || null;
}

/** Parse a canonical Seek job page. Exported so tests can run on a fixture. */
export function parseSeekJobPage(html: string, jobId: string): SeekJob {
  const $ = cheerio.load(html);

  const details = $('[data-automation="jobAdDetails"]').first();
  details.find('script, style').remove();
  // Keep block breaks — the generator reads these as bullet boundaries.
  details.find('li').each((_, el) => {
    $(el).replaceWith(`\n• ${$(el).text().trim()}`);
  });
  details.find('p, br, div, h1, h2, h3, h4').each((_, el) => {
    $(el).after('\n');
  });

  const description = details
    .text()
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  const title = text($, 'job-detail-title');

  if (!title || description.length < MIN_DESCRIPTION_CHARS) {
    throw new SeekUrlError(
      description.length ? 'too_short' : 'not_found',
      'We couldn’t read that job ad — it may have expired or been taken down. Open it on Seek to check, or use "Paste the description instead".',
    );
  }

  return {
    jobId,
    title,
    company: text($, 'advertiser-name') || 'Unknown company',
    location: text($, 'job-detail-location'),
    workType: text($, 'job-detail-work-type'),
    classification: text($, 'job-detail-classifications'),
    description,
    sourceUrl: canonicalSeekUrl(jobId),
  };
}

const cache = new Map<string, { at: number; job: SeekJob }>();

function cacheGet(jobId: string): SeekJob | null {
  const hit = cache.get(jobId);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(jobId);
    return null;
  }
  return hit.job;
}

function cacheSet(jobId: string, job: SeekJob): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(jobId, { at: Date.now(), job });
}

/** Fetch the canonical job page, trying each UA until one isn't blocked. */
async function fetchJobHtml(jobId: string): Promise<string> {
  const url = canonicalSeekUrl(jobId);
  let lastStatus = 0;

  for (const ua of USER_AGENTS) {
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': ua,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-AU,en;q=0.9',
        },
        timeout: SEEK_DETAIL_TIMEOUT,
        maxRedirects: 5,
        validateStatus: () => true,
      });

      if (res.status === 200 && typeof res.data === 'string') return res.data;
      lastStatus = res.status;

      // A missing job is a real answer, not a transport problem — say so plainly
      // rather than telling the user to try again on something that will never work.
      if (res.status === 404 || res.status === 410) {
        throw new SeekUrlError(
          'not_found',
          'That job isn’t on Seek anymore — it looks like the ad has expired or been taken down.',
        );
      }

      // 403/429 means this fingerprint is blocked — the next UA may not be.
      // Anything else won't be fixed by retrying, so stop.
      if (res.status !== 403 && res.status !== 429) break;
    } catch (err: any) {
      if (err instanceof SeekUrlError) throw err;
      console.error(`[seekJobUrl] fetch error for ${jobId}: ${err.message}`);
    }
  }

  console.error(`[seekJobUrl] all user-agents failed for ${jobId} (last status ${lastStatus})`);
  throw new SeekUrlError(
    'fetch_failed',
    'We couldn’t reach Seek just then. Try again in a moment, or use "Paste the description instead".',
  );
}

/** URL in, job out. Throws SeekUrlError with a message that is safe to show the user. */
export async function fetchSeekJobFromUrl(rawUrl: string): Promise<SeekJob> {
  const jobId = parseSeekJobId(rawUrl);

  const cached = cacheGet(jobId);
  if (cached) return cached;

  const html = await fetchJobHtml(jobId);
  const job = parseSeekJobPage(html, jobId);
  cacheSet(jobId, job);
  return job;
}

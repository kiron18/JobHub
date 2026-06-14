import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { prisma } from '../index';
import type { RawJob } from './jobFeed';

// ─── Constants ───────────────────────────────────────────────────────────────
export const SEEK_HOST = 'https://au.seek.com';
export const SEEK_CANONICAL_HOST = 'https://www.seek.com.au';
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
export const SEEK_REQUEST_TIMEOUT = 15_000;
export const SEEK_DETAIL_TIMEOUT = 12_000;
export const MAX_PAGES = 3;
export const DETAIL_CONCURRENCY = 4;

export const ENTRY_LEVEL_QUALIFIERS = 'entry level graduate junior starter';

export function buildEntryLevelSearchTerm(roles: string[]): string {
  const cleaned = roles.map((r) => r.trim()).filter((r) => r.length > 0);
  return `${ENTRY_LEVEL_QUALIFIERS} ${cleaned.join(' ')}`.trim();
}

export function stripEntryLevelQualifiers(role: string): string {
  const prefix = `${ENTRY_LEVEL_QUALIFIERS} `;
  if (role.toLowerCase().startsWith(prefix)) return role.slice(prefix.length).trim();
  return role.trim();
}

export interface SeekHtmlClusterKey {
  role: string;
  city: string;
  industry: string;
  hash: string;
}

export function buildSeekSearchUrl(role: string, city: string, dateRange?: number): string {
  const cleanRole = stripEntryLevelQualifiers(role);
  const roleSlug = cleanRole
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const citySlug = city
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('-');
  const dr = dateRange ?? 7;
  return `${SEEK_HOST}/${roleSlug}-jobs/in-${citySlug}?daterange=${dr}`;
}

export function buildSeekClusterKey(
  targetRole: string,
  targetCity: string,
  industry: string | null,
): SeekHtmlClusterKey {
  const role = targetRole.trim();
  const city = targetCity.trim().split(',')[0].trim().toLowerCase();
  const ind = (industry ?? '').trim().toLowerCase();
  const raw = `seek-html|${role.toLowerCase()}|${city}|${ind}`;
  return {
    role,
    city,
    industry: industry ?? '',
    hash: createHash('sha256').update(raw).digest('hex'),
  };
}

// ─── Relative date parsing ─────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

export function parseRelativeDate(text: string | null, now: Date = new Date()): Date | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\btoday\b/.test(t)) return now;
  if (/\byesterday\b/.test(t)) return new Date(now.getTime() - DAY_MS);
  const m = t.match(/(\d+)\s*\+?\s*(months?|mo|weeks?|w|days?|d|hours?|h|minutes?|min|m)\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  let ms = 0;
  if (unit.startsWith('mo') || unit.startsWith('month')) ms = n * 30 * DAY_MS;
  else if (unit.startsWith('w')) ms = n * 7 * DAY_MS;
  else if (unit.startsWith('d')) ms = n * DAY_MS;
  else if (unit.startsWith('h')) ms = n * 3_600_000;
  else if (unit === 'm' || unit.startsWith('min')) ms = n * 60_000;
  return ms ? new Date(now.getTime() - ms) : null;
}

// ─── Search card parsing ───────────────────────────────────────────────────────
export interface SeekHtmlJobCard {
  jobId: string;
  title: string;
  company: string;
  location: string;
  relativeDate: string | null;
  teaser: string | null;
  searchUrl: string; // au.seek.com host — used for the detail FETCH
  sourceUrl: string; // www.seek.com.au — stored for the user
}

function dedupeDoubledText(raw: string): string {
  const t = raw.trim();
  if (t.length > 1 && t.length % 2 === 0) {
    const half = t.slice(0, t.length / 2);
    if (half === t.slice(t.length / 2)) return half.trim();
  }
  return t;
}

export function parseSearchResultsPage(html: string): SeekHtmlJobCard[] {
  const $ = cheerio.load(html);
  const cards: SeekHtmlJobCard[] = [];
  $('article[data-testid="job-card"]').each((_, el) => {
    const a = $(el);
    const jobId = (a.attr('data-job-id') ?? '').trim();
    if (!jobId) return;

    const title = a.find('[data-automation="jobTitle"]').first().text().trim() || 'Untitled';
    const company = a.find('[data-automation="jobCompany"]').first().text().trim() || 'Unknown Company';

    const locs = new Set<string>();
    a.find('[data-automation="jobCardLocation"], [data-automation="jobLocation"]').each((_, le) => {
      const v = dedupeDoubledText($(le).text());
      if (v) locs.add(v);
    });
    const location = Array.from(locs).join(', ') || 'Australia';

    const rawDate = dedupeDoubledText(a.find('[data-automation="jobListingDate"]').first().text());
    const relativeDate = /ago|today|yesterday/i.test(rawDate) ? rawDate : null;

    const teaser = a.find('[data-automation="jobShortDescription"]').first().text().trim() || null;

    cards.push({
      jobId,
      title,
      company,
      location,
      relativeDate,
      teaser,
      searchUrl: `${SEEK_HOST}/job/${jobId}`,
      sourceUrl: `${SEEK_CANONICAL_HOST}/job/${jobId}`,
    });
  });
  return cards;
}

// ─── Pagination ────────────────────────────────────────────────────────────────
export interface PageInfo {
  totalCount: number;
  pageSize: number;
  totalPages: number;
}

export function extractPageInfo(html: string): PageInfo {
  const totalCount = Number(html.match(/"totalCount"\s*:\s*(\d+)/)?.[1] ?? 0);
  const pageSize = Number(html.match(/"pageSize"\s*:\s*(\d+)/)?.[1] ?? 32) || 32;
  const capped = Math.min(totalCount, MAX_PAGES * pageSize);
  const totalPages = Math.max(1, Math.ceil((capped || 0) / pageSize));
  return { totalCount: capped, pageSize, totalPages };
}

function buildPageUrl(baseUrl: string, page: number): string {
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}page=${page}`;
}

// ─── Detail page extraction ────────────────────────────────────────────────────
export interface JobDetail {
  description: string;
  workType: string | null;
  postedAt: Date | null;
}

// cardRelativeDate is the search-card date used as the primary postedAt source;
// the detail page's "Posted Nd ago" span is the fallback.
export function extractJobDetail(html: string, cardRelativeDate: string | null): JobDetail {
  const $ = cheerio.load(html);

  const detailsEl = $('[data-automation="jobAdDetails"]').first();
  detailsEl.find('script, style').remove();
  const description = detailsEl.text().replace(/\s+/g, ' ').trim();

  const workType = $('[data-automation="job-detail-work-type"]').first().text().trim() || null;

  let postedAt = parseRelativeDate(cardRelativeDate);
  if (!postedAt) {
    let postedText: string | null = null;
    $('span').each((_, el) => {
      if (postedText) return;
      const own = $(el).clone().children().remove().end().text().trim();
      if (/^posted\s+\d/i.test(own)) postedText = own;
    });
    postedAt = parseRelativeDate(postedText);
  }

  return { description, workType, postedAt };
}

// ─── Network layer ─────────────────────────────────────────────────────────────
async function fetchHtml(url: string, timeout: number): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
      },
      timeout,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return typeof res.data === 'string' ? res.data : null;
  } catch (err: any) {
    console.error(`[seekHtmlScraper] fetch failed ${url.slice(0, 90)}: ${err.message}`);
    return null;
  }
}

// Returns null ONLY on a first-page fetch failure (so the caller can avoid caching
// a transient failure as a genuine empty result). Returns [] for a real empty search.
async function fetchAllJobCards(
  role: string,
  city: string,
  dateRange?: number,
): Promise<SeekHtmlJobCard[] | null> {
  const baseUrl = buildSeekSearchUrl(role, city, dateRange);
  const firstHtml = await fetchHtml(baseUrl, SEEK_REQUEST_TIMEOUT);
  if (!firstHtml || firstHtml.length < 1000) return null;

  const seen = new Set<string>();
  const all: SeekHtmlJobCard[] = [];
  for (const c of parseSearchResultsPage(firstHtml)) {
    if (!seen.has(c.jobId)) {
      seen.add(c.jobId);
      all.push(c);
    }
  }

  const { totalPages } = extractPageInfo(firstHtml);
  const extraPages = Math.min(totalPages, MAX_PAGES) - 1;
  if (extraPages > 0) {
    const results = await Promise.allSettled(
      Array.from({ length: extraPages }, (_, i) =>
        fetchHtml(buildPageUrl(baseUrl, i + 2), SEEK_REQUEST_TIMEOUT),
      ),
    );
    for (const r of results) {
      if (r.status !== 'fulfilled' || !r.value) continue;
      for (const c of parseSearchResultsPage(r.value)) {
        if (!seen.has(c.jobId)) {
          seen.add(c.jobId);
          all.push(c);
        }
      }
    }
  }
  return all;
}

// Simple concurrency limiter — caps simultaneous detail fetches.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const cur = idx++;
      try {
        out[cur] = await fn(items[cur]);
      } catch {
        out[cur] = undefined as unknown as R;
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, worker);
  await Promise.all(workers);
  return out;
}

async function mapCardToRawJob(card: SeekHtmlJobCard): Promise<RawJob> {
  const html = await fetchHtml(card.searchUrl, SEEK_DETAIL_TIMEOUT);
  const detail = html
    ? extractJobDetail(html, card.relativeDate)
    : {
        description: card.teaser ?? '',
        workType: null,
        postedAt: parseRelativeDate(card.relativeDate),
      };
  const description =
    detail.description.length >= 50
      ? detail.description
      : card.teaser ?? detail.description;
  return {
    title: card.title,
    company: card.company,
    location: card.location,
    salary: null,
    description,
    sourceUrl: card.sourceUrl,
    sourcePlatform: 'seek',
    postedAt: detail.postedAt,
  };
}

// ─── Date helper ────────────────────────────────────────────────────────────────
function todayFeedDate(): string {
  const s = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [day, month, year] = s.split('/');
  return `${year}-${month}-${day}`;
}

// ─── Public API ────────────────────────────────────────────────────────────────
export async function fetchSeekJobsForCluster(
  cluster: SeekHtmlClusterKey,
  opts?: { maxResults?: number; dateRange?: number },
): Promise<RawJob[]> {
  const feedDate = todayFeedDate();

  const cached = await prisma.seekJobCache.findUnique({
    where: { queryHash_feedDate: { queryHash: cluster.hash, feedDate } },
  });
  if (cached) {
    const items = (cached.results as any[]) ?? [];
    return (Array.isArray(items) ? items : []).map((it: any): RawJob => ({
      title: it.title ?? 'Untitled',
      company: it.company ?? 'Unknown Company',
      location: it.location ?? cluster.city,
      salary: it.salary ?? null,
      description: it.description ?? '',
      sourceUrl: it.sourceUrl ?? '',
      sourcePlatform: 'seek',
      postedAt: it.postedAt ? new Date(it.postedAt) : null,
    }));
  }

  const cards = await fetchAllJobCards(cluster.role, cluster.city, opts?.dateRange);
  if (cards === null) return []; // transient fetch failure — do not cache

  const limited = opts?.maxResults != null ? cards.slice(0, opts.maxResults) : cards;
  const mapped = await mapWithConcurrency(limited, DETAIL_CONCURRENCY, mapCardToRawJob);
  const jobs = mapped.filter((j): j is RawJob => !!j);

  try {
    await prisma.seekJobCache.create({
      data: {
        queryHash: cluster.hash,
        queryMeta: {
          source: 'seek-html',
          role: cluster.role,
          city: cluster.city,
          industry: cluster.industry,
        },
        feedDate,
        results: jobs.map((j) => ({
          ...j,
          postedAt: j.postedAt?.toISOString() ?? null,
        })),
        resultCount: jobs.length,
      },
    });
  } catch (e: any) {
    console.warn('[seekHtmlScraper] cache write failed (non-fatal):', e.message);
  }

  return jobs;
}

export async function prewarmSeekClusters(
  users: {
    userId: string;
    targetRole: string;
    targetCity: string;
    industry: string | null;
  }[],
): Promise<void> {
  const seen = new Map<string, SeekHtmlClusterKey>();
  for (const u of users) {
    const key = buildSeekClusterKey(u.targetRole, u.targetCity, u.industry);
    if (!seen.has(key.hash)) seen.set(key.hash, key);
  }
  const clusters = Array.from(seen.values());
  console.log(`[seekHtmlScraper] Prewarming ${clusters.length} Seek cluster(s)`);
  for (const c of clusters) {
    try {
      const jobs = await fetchSeekJobsForCluster(c);
      console.log(`[seekHtmlScraper] ok ${c.role}/${c.city} -> ${jobs.length} jobs`);
    } catch (e: any) {
      console.error(`[seekHtmlScraper] fail ${c.role}/${c.city}:`, e.message);
    }
  }
}

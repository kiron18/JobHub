# Replace Apify Seek Scraper With Direct HTML Scrape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreliable Apify Seek scraper with a direct `axios` + `cheerio` HTML scraper that returns the same `RawJob[]` to all existing callers, and make the daily feed actively surface junior/entry-level roles.

**Architecture:** A new `server/src/services/seekHtmlScraper.ts` fetches Seek search-result pages from the `au.seek.com` host, parses job cards with cheerio, paginates up to 3 pages, then fetches each job's detail page (also on `au.seek.com`) for the full description. `seekScraper.ts` becomes a thin re-export so callers need no import changes. Junior bias is applied **post-fetch** in `jobFeed.ts` ranking (NOT in the search query — see the hard constraint below), and the search URL strips the entry-level qualifier prefix that `jobFeed` prepends.

**Tech Stack:** Node.js, TypeScript, `axios` (installed), `cheerio@1.2.0` (installed in Task 0), `crypto` (built-in), `vitest`, existing `RawJob` type, `SeekJobCache` Prisma model.

---

## CRITICAL GROUND TRUTH (verified live on 2026-06-14 — do not re-derive, do not "improve")

These facts were captured by fetching Seek directly and parsing the saved HTML. The selectors and hosts below are **verified**, not guessed. If your implementation contradicts any of these, you have a bug — fix the implementation, not these facts.

1. **Host matters.** `https://www.seek.com.au/job/{id}` returns **403** to axios. `https://au.seek.com/job/{id}` returns **200**. Use `au.seek.com` for **all fetches** (search and detail). Store `www.seek.com.au` only as the user-facing `sourceUrl` (it works in a browser).
2. **Junior CANNOT come from the search query.** Verified result counts for "laboratory technician / Sydney / daterange=7":
   - clean slug `/laboratory-technician-jobs/in-Sydney` → **65 jobs**
   - clean slug + `&keywords=junior graduate entry level` → **2 jobs**
   - qualifier slug `/entry-level-graduate-junior-starter-laboratory-technician-jobs/...` → **1 job**

   Seek treats slug words AND the `keywords` param as a **hard AND-filter**. Therefore junior bias is done **only** by post-fetch ranking (Task 7). The scraper must fetch the **bare-role clean slug** to get the full pool.
3. **Search card selectors (verified in fixture, 32 cards on page 1):**
   - container: `article[data-testid="job-card"]`
   - id attr: `data-job-id`
   - title: `[data-automation="jobTitle"]`
   - company: `[data-automation="jobCompany"]`
   - location: `[data-automation="jobCardLocation"]` and/or `[data-automation="jobLocation"]` (often **both present and identical** → must dedupe)
   - relative date: `[data-automation="jobListingDate"]` — text is **doubled** (e.g. `"6d ago6d ago"`) and is `"Featured"` for promoted cards (no usable date)
   - teaser: `[data-automation="jobShortDescription"]`
4. **Pagination:** the search HTML embeds `"totalCount":65` and `"pageSize":32`. Pages are fetched with `&page=N`. 65 jobs / 32 per page = 3 pages.
5. **Full descriptions are NOT in the search HTML** (only teasers). The detail page fetch is **mandatory**.
6. **Detail page selectors (verified live on `au.seek.com/job/92578601`):**
   - description: `[data-automation="jobAdDetails"]` (5269 chars on the sample)
   - title: `[data-automation="job-detail-title"]`
   - company: `[data-automation="advertiser-name"]`
   - location: `[data-automation="job-detail-location"]`
   - work type: `[data-automation="job-detail-work-type"]`
   - **No JSON-LD `JobPosting`, no ISO `datePosted`.** Posted date appears only as a `<span>` reading `"Posted 6d ago"` (no `data-automation` attr) → parse the relative string.
7. **City slug:** a bare `in-Sydney` 302-redirects to `in-All-Sydney-NSW` and returns results, so `maxRedirects` must be > 0. Do not try to construct the `in-All-...-STATE` form yourself.

---

## File Structure

```
server/
  src/
    services/
      seekHtmlScraper.ts                  — NEW: the scraper (one focused module)
      seekScraper.ts                      — REPLACE body with a re-export shim
      jobFeed.ts                          — MODIFY: add JUNIOR_SIGNALS boost in quickScore
      __fixtures__/
        seek-search.html                  — NEW: saved search page (offline test fixture)
        seek-detail.html                  — NEW: saved detail page (offline test fixture)
      seekHtmlScraper.test.ts             — NEW: offline unit + fixture tests
  scripts/
    test-html-scraper.ts                  — NEW: manual live smoke test (not run in CI)
    seek-page-clean_lab_technician.html   — DELETE after copying to __fixtures__
    seek-detail-sample.html               — DELETE after copying to __fixtures__
    seek-search-bundle.js                 — DELETE: stale artifact
  package.json                            — already has cheerio (Task 0)
```

Callers that stay UNCHANGED (verified imports):
- `server/src/services/jobFeed.ts` imports `buildSeekClusterKey, buildEntryLevelSearchTerm, fetchSeekJobsForCluster` from `./seekScraper` (the shim re-exports all three).
- `server/src/services/sponsorScan.ts` imports `buildSeekClusterKey, fetchSeekJobsForCluster`.
- `server/src/services/userJobScrape.ts` imports `buildSeekClusterKey, fetchSeekJobsForCluster`.
- `server/src/cron/jobFeedCron.ts` imports `prewarmSeekClusters`.
- `server/src/services/userJobScrape.test.ts` mocks `./seekScraper`.
- `server/src/utils/__tests__/seekScraper.test.ts` imports `buildSeekClusterKey` (asserts trim/lowercase/determinism, **not** a literal hash).

`RawJob` (exported from `jobFeed.ts`):
```ts
export interface RawJob {
  title: string; company: string; location: string;
  salary: string | null; description: string;
  sourceUrl: string; sourcePlatform: string; postedAt: Date | null;
}
```

---

### Task 0: Confirm cheerio is installed

**Files:** `server/package.json`

- [ ] **Step 1: Verify cheerio is present**

Run:
```bash
cd E:/AntiGravity/JobHub/server && node -e "console.log(require('cheerio/package.json').version)"
```
Expected: prints `1.2.0` (it was installed during planning). If it errors with MODULE_NOT_FOUND, run `npm install cheerio` then re-check.

**STOP-AND-REPORT:** if the version is not in the `1.x` range, stop and report — the cheerio API below assumes v1.

---

### Task 1: Copy the captured HTML into test fixtures

**Files:**
- Create: `server/src/services/__fixtures__/seek-search.html`
- Create: `server/src/services/__fixtures__/seek-detail.html`

- [ ] **Step 1: Create the fixtures directory and copy the saved HTML**

Run (Git Bash):
```bash
cd E:/AntiGravity/JobHub/server
mkdir -p src/services/__fixtures__
cp scripts/seek-page-clean_lab_technician.html src/services/__fixtures__/seek-search.html
cp scripts/seek-detail-sample.html src/services/__fixtures__/seek-detail.html
```

- [ ] **Step 2: Verify the fixtures are real**

Run:
```bash
cd E:/AntiGravity/JobHub/server
node -e "const fs=require('fs');const c=require('cheerio');const \$=c.load(fs.readFileSync('src/services/__fixtures__/seek-search.html','utf8'));console.log('cards',\$('article[data-testid=\"job-card\"]').length);console.log('detailDesc',c.load(fs.readFileSync('src/services/__fixtures__/seek-detail.html','utf8'))('[data-automation=\"jobAdDetails\"]').text().trim().length>1000)"
```
Expected: `cards 32` and `detailDesc true`.

**STOP-AND-REPORT:** if `cards` is not `32` or `detailDesc` is not `true`, the fixtures are wrong — stop and report.

---

### Task 2: Module skeleton — constants, qualifier helpers, URL + cluster key (pure functions, TDD)

> **Note on the existing `src/lib/seekSearchUrl.ts`:** the frontend (root `src/`, the React app) has a same-named `buildSeekSearchUrl` used for user-facing "view on Seek" fallback links. Do **NOT** import or reuse it. The server (`server/src/`) is a separate package and must not import frontend code; the frontend version also lacks `daterange`/`page`/qualifier-strip. The slug logic below is intentionally identical so both produce the same `au.seek.com/{slug}-jobs/in-{City}` format. Define the server's own `buildSeekSearchUrl` in `seekHtmlScraper.ts` as written here.

**Files:**
- Create: `server/src/services/seekHtmlScraper.ts`
- Create: `server/src/services/seekHtmlScraper.test.ts`

- [ ] **Step 1: Write the failing tests for the pure helpers**

Create `server/src/services/seekHtmlScraper.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  ENTRY_LEVEL_QUALIFIERS,
  buildEntryLevelSearchTerm,
  stripEntryLevelQualifiers,
  buildSeekSearchUrl,
  buildSeekClusterKey,
} from './seekHtmlScraper';

describe('qualifier helpers', () => {
  it('builds the entry-level search term', () => {
    expect(buildEntryLevelSearchTerm(['Laboratory Technician'])).toBe(
      'entry level graduate junior starter Laboratory Technician',
    );
  });
  it('strips the qualifier prefix back off', () => {
    const term = buildEntryLevelSearchTerm(['Laboratory Technician']);
    expect(stripEntryLevelQualifiers(term)).toBe('Laboratory Technician');
  });
  it('leaves a clean role untouched', () => {
    expect(stripEntryLevelQualifiers('Laboratory Technician')).toBe('Laboratory Technician');
  });
});

describe('buildSeekSearchUrl', () => {
  it('produces a clean au.seek.com slug from a qualifier-prefixed role', () => {
    const term = buildEntryLevelSearchTerm(['Laboratory Technician']);
    expect(buildSeekSearchUrl(term, 'sydney')).toBe(
      'https://au.seek.com/laboratory-technician-jobs/in-Sydney?daterange=7',
    );
  });
  it('honours a custom date range', () => {
    expect(buildSeekSearchUrl('Nurse', 'Melbourne', 14)).toBe(
      'https://au.seek.com/nurse-jobs/in-Melbourne?daterange=14',
    );
  });
});

describe('buildSeekClusterKey', () => {
  it('trims, lowercases the city, and is deterministic', () => {
    const a = buildSeekClusterKey('  Engineer  ', 'Melbourne, VIC', 'Tech');
    const b = buildSeekClusterKey('Engineer', 'Melbourne', 'Tech');
    expect(a.city).toBe('melbourne');
    expect(a.hash).toBe(b.hash);
  });
  it('differs by role', () => {
    expect(buildSeekClusterKey('A', 'Sydney', null).hash).not.toBe(
      buildSeekClusterKey('B', 'Sydney', null).hash,
    );
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services/seekHtmlScraper.test.ts
```
Expected: FAIL — cannot resolve `./seekHtmlScraper` / functions not defined.

- [ ] **Step 3: Create `seekHtmlScraper.ts` with constants and pure helpers**

Create `server/src/services/seekHtmlScraper.ts`:
```ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { prisma } from '../index';
import type { RawJob } from './jobFeed';

// ─── Constants ───────────────────────────────────────────────────────────────
// FETCH host. www.seek.com.au returns 403 to axios; au.seek.com returns 200.
const SEEK_HOST = 'https://au.seek.com';
// User-facing canonical host (works in a browser; only used for stored sourceUrl).
const SEEK_CANONICAL_HOST = 'https://www.seek.com.au';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const SEEK_REQUEST_TIMEOUT = 15_000;
const SEEK_DETAIL_TIMEOUT = 12_000;
const MAX_PAGES = 3;            // 32 jobs/page → up to ~96 jobs/scrape
const DETAIL_CONCURRENCY = 4;   // global cap on simultaneous detail fetches

// ─── Backward-compat exports (carried over from old seekScraper.ts) ──────────
// jobFeed.ts imports buildEntryLevelSearchTerm to build the search term that
// feeds the cluster hash. Keep it here so the re-export shim works.
export const ENTRY_LEVEL_QUALIFIERS = 'entry level graduate junior starter';

export function buildEntryLevelSearchTerm(roles: string[]): string {
  const cleaned = roles.map((r) => r.trim()).filter((r) => r.length > 0);
  return `${ENTRY_LEVEL_QUALIFIERS} ${cleaned.join(' ')}`.trim();
}

// Strip the qualifier prefix so the Seek URL slug is the BARE role.
// Seek treats slug/keyword words as a hard AND-filter (verified: qualifier slug
// returns 1 job vs 65 for the clean slug), so qualifiers must never reach the URL.
// Junior bias is applied post-fetch in jobFeed.quickScore instead.
export function stripEntryLevelQualifiers(role: string): string {
  const prefix = `${ENTRY_LEVEL_QUALIFIERS} `;
  if (role.toLowerCase().startsWith(prefix)) return role.slice(prefix.length).trim();
  return role.trim();
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface SeekHtmlClusterKey {
  role: string;
  city: string;
  industry: string;
  hash: string;
}

// ─── URL + cluster key ─────────────────────────────────────────────────────────
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
  // "seek-html" prefix → new cache keys won't read stale Apify-format rows on swap day.
  const raw = `seek-html|${role.toLowerCase()}|${city}|${ind}`;
  return {
    role,
    city,
    industry: industry ?? '',
    hash: createHash('sha256').update(raw).digest('hex'),
  };
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services/seekHtmlScraper.test.ts
```
Expected: PASS (all assertions in the three describe blocks).

- [ ] **Step 5: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/services/seekHtmlScraper.ts server/src/services/seekHtmlScraper.test.ts server/src/services/__fixtures__
git commit -m "feat(seek): scaffold direct HTML scraper helpers (url, cluster key, qualifier strip)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Relative-date parser (pure function, TDD)

**Files:**
- Modify: `server/src/services/seekHtmlScraper.ts`
- Modify: `server/src/services/seekHtmlScraper.test.ts`

- [ ] **Step 1: Add failing tests for `parseRelativeDate`**

Append to `seekHtmlScraper.test.ts`:
```ts
import { parseRelativeDate } from './seekHtmlScraper';

describe('parseRelativeDate', () => {
  const NOW = new Date('2026-06-14T00:00:00.000Z');
  it('parses "6d ago" to 6 days before now', () => {
    const d = parseRelativeDate('6d ago', NOW)!;
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-08');
  });
  it('parses "Posted 3d ago"', () => {
    const d = parseRelativeDate('Posted 3d ago', NOW)!;
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-11');
  });
  it('parses "Today" as now', () => {
    expect(parseRelativeDate('Today', NOW)!.toISOString()).toBe(NOW.toISOString());
  });
  it('parses "30+ days ago"', () => {
    const d = parseRelativeDate('30+ days ago', NOW)!;
    expect(d.toISOString().slice(0, 10)).toBe('2026-05-15');
  });
  it('returns null for "Featured" and empty input', () => {
    expect(parseRelativeDate('Featured', NOW)).toBeNull();
    expect(parseRelativeDate(null, NOW)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services/seekHtmlScraper.test.ts -t parseRelativeDate
```
Expected: FAIL — `parseRelativeDate` not exported.

- [ ] **Step 3: Implement `parseRelativeDate`**

Append to `seekHtmlScraper.ts`:
```ts
// ─── Relative date parsing ─────────────────────────────────────────────────────
// Seek only gives relative strings ("6d ago", "Today", "30+ days ago", "Posted 6d ago").
const DAY_MS = 86_400_000;

export function parseRelativeDate(text: string | null, now: Date = new Date()): Date | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\btoday\b/.test(t)) return now;
  if (/\byesterday\b/.test(t)) return new Date(now.getTime() - DAY_MS);
  // Longest units first so "month" is not eaten by "m".
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
```

- [ ] **Step 4: Run to confirm pass**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services/seekHtmlScraper.test.ts -t parseRelativeDate
```
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/services/seekHtmlScraper.ts server/src/services/seekHtmlScraper.test.ts
git commit -m "feat(seek): relative-date parser for Seek listing dates

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Search-page card parser + pagination (fixture-based TDD)

**Files:**
- Modify: `server/src/services/seekHtmlScraper.ts`
- Modify: `server/src/services/seekHtmlScraper.test.ts`

- [ ] **Step 1: Add failing fixture tests for `parseSearchResultsPage` and `extractPageInfo`**

Append to `seekHtmlScraper.test.ts`:
```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseSearchResultsPage, extractPageInfo } from './seekHtmlScraper';

const searchHtml = readFileSync(join(__dirname, '__fixtures__/seek-search.html'), 'utf8');

describe('parseSearchResultsPage (fixture)', () => {
  const cards = parseSearchResultsPage(searchHtml);
  it('extracts all 32 cards', () => {
    expect(cards.length).toBe(32);
  });
  it('extracts the first card fields', () => {
    const c = cards[0];
    expect(c.jobId).toBe('92646985');
    expect(c.title).toBe('Product Technologist - Gummies Development and Manufacturing');
    expect(c.company).toBe('Essence Group');
  });
  it('dedupes the doubled location text', () => {
    expect(cards[0].location).toBe('Sydney NSW'); // not "Sydney NSW, Sydney NSW"
  });
  it('keeps a parseable relative date and nulls "Featured"', () => {
    const dated = cards.find((c) => c.jobId === '92578601')!;
    expect(dated.relativeDate).toMatch(/ago/i);
    expect(cards[0].relativeDate).toBeNull(); // first card is Featured
  });
  it('builds the au.seek.com fetch url and www canonical sourceUrl', () => {
    expect(cards[0].searchUrl).toBe('https://au.seek.com/job/92646985');
    expect(cards[0].sourceUrl).toBe('https://www.seek.com.au/job/92646985');
  });
});

describe('extractPageInfo (fixture)', () => {
  it('reads totalCount/pageSize and computes 3 pages', () => {
    const info = extractPageInfo(searchHtml);
    expect(info.pageSize).toBe(32);
    expect(info.totalPages).toBe(3);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services/seekHtmlScraper.test.ts -t fixture
```
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement the parser + pagination**

Append to `seekHtmlScraper.ts`:
```ts
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

// Seek doubles responsive text, e.g. "6d ago6d ago" or "Sydney NSWSydney NSW".
// Collapse an exact two-halves repeat.
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
```

- [ ] **Step 4: Run to confirm pass**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services/seekHtmlScraper.test.ts -t fixture
```
Expected: PASS.

**STOP-AND-REPORT:** if `parseSearchResultsPage` returns anything other than 32 cards for the fixture, do **not** loosen the selector — stop and report. The selector is verified correct; a different count means a code bug.

- [ ] **Step 5: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/services/seekHtmlScraper.ts server/src/services/seekHtmlScraper.test.ts
git commit -m "feat(seek): parse search cards + pagination from Seek HTML

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Detail-page extractor (fixture-based TDD)

**Files:**
- Modify: `server/src/services/seekHtmlScraper.ts`
- Modify: `server/src/services/seekHtmlScraper.test.ts`

- [ ] **Step 1: Add failing test for `extractJobDetail`**

Append to `seekHtmlScraper.test.ts`:
```ts
import { extractJobDetail } from './seekHtmlScraper';

const detailHtml = readFileSync(join(__dirname, '__fixtures__/seek-detail.html'), 'utf8');

describe('extractJobDetail (fixture)', () => {
  const d = extractJobDetail(detailHtml, null);
  it('pulls the full description from jobAdDetails', () => {
    expect(d.description.length).toBeGreaterThan(1000);
    expect(d.description).toContain('Nucleus Network');
  });
  it('pulls the work type', () => {
    expect(d.workType).toBe('Full time');
  });
  it('parses the "Posted Nd ago" span into a date', () => {
    expect(d.postedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services/seekHtmlScraper.test.ts -t extractJobDetail
```
Expected: FAIL — `extractJobDetail` not exported.

- [ ] **Step 3: Implement the detail extractor (pure: HTML → fields)**

Append to `seekHtmlScraper.ts`. Note: this is the **pure parser**; the network fetch wraps it in Task 6.
```ts
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
```

- [ ] **Step 4: Run to confirm pass**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services/seekHtmlScraper.test.ts -t extractJobDetail
```
Expected: PASS.

**STOP-AND-REPORT:** if the description comes back shorter than 1000 chars from the fixture, do **not** add fallback selectors — stop and report. `[data-automation="jobAdDetails"]` is verified correct.

- [ ] **Step 5: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/services/seekHtmlScraper.ts server/src/services/seekHtmlScraper.test.ts
git commit -m "feat(seek): extract full description + work type + posted date from detail page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Network layer + public `fetchSeekJobsForCluster` + `prewarmSeekClusters`

**Files:**
- Modify: `server/src/services/seekHtmlScraper.ts`

No new unit tests here (these are network/DB functions; they are exercised by the manual smoke test in Task 9 and by the existing mocked caller tests in Task 8).

- [ ] **Step 1: Add the HTTP fetcher, concurrency mapper, and card→RawJob mapping**

Append to `seekHtmlScraper.ts`:
```ts
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
      maxRedirects: 5, // bare city slug 302-redirects to the canonical in-All-City-STATE form
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
      Array.from({ length: extraPages }, (_, i) => fetchHtml(buildPageUrl(baseUrl, i + 2), SEEK_REQUEST_TIMEOUT)),
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

// Simple global concurrency limiter — caps simultaneous detail fetches.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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
    : { description: card.teaser ?? '', workType: null, postedAt: parseRelativeDate(card.relativeDate) };
  const description = detail.description.length >= 50 ? detail.description : card.teaser ?? detail.description;
  return {
    title: card.title,
    company: card.company,
    location: card.location,
    salary: null, // Seek search/detail rarely expose salary; "add expected salary" is a CTA, not data
    description,
    sourceUrl: card.sourceUrl,
    sourcePlatform: 'seek',
    postedAt: detail.postedAt,
  };
}
```

- [ ] **Step 2: Add `todayFeedDate`, the public `fetchSeekJobsForCluster`, and `prewarmSeekClusters`**

Append to `seekHtmlScraper.ts`:
```ts
// ─── Date helper (matches old seekScraper.ts) ──────────────────────────────────
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

  // Cache even when jobs.length === 0 (a real empty search) to avoid re-scraping all day.
  try {
    await prisma.seekJobCache.create({
      data: {
        queryHash: cluster.hash,
        queryMeta: { source: 'seek-html', role: cluster.role, city: cluster.city, industry: cluster.industry },
        feedDate,
        results: jobs.map((j) => ({ ...j, postedAt: j.postedAt?.toISOString() ?? null })),
        resultCount: jobs.length,
      },
    });
  } catch (e: any) {
    console.warn('[seekHtmlScraper] cache write failed (non-fatal):', e.message);
  }

  return jobs;
}

// Prewarm runs clusters SEQUENTIALLY so total in-flight detail fetches stay bounded
// by DETAIL_CONCURRENCY (not DETAIL_CONCURRENCY × clusterCount). It is a daily cron,
// so latency is not a concern; politeness to Seek is.
export async function prewarmSeekClusters(
  users: { userId: string; targetRole: string; targetCity: string; industry: string | null }[],
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
```

- [ ] **Step 3: Type-check the module**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx tsc --noEmit
```
Expected: no errors.

**STOP-AND-REPORT:** if cheerio raises a type error on `.each`/`.find`/`.clone`, do not switch to `any`-casting everything — stop and report the exact error.

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/services/seekHtmlScraper.ts
git commit -m "feat(seek): network layer, throttled detail fetch, caching, sequential prewarm

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Junior bias — make the feed surface junior/entry-level roles

This is the "search for junior positions" requirement. Because Seek's query is a hard filter (see Ground Truth #2), junior bias lives in `jobFeed.ts`'s existing `quickScore` ranker, which already demotes senior roles. We add an explicit junior promotion.

**Files:**
- Modify: `server/src/services/jobFeed.ts` (the `SENIOR_SIGNALS` block at lines ~161-191)

- [ ] **Step 1: Read the current ranker**

Read `server/src/services/jobFeed.ts` lines 159-191 to confirm the `SENIOR_SIGNALS` array and `quickScore` function are still as described (senior match subtracts 1000).

- [ ] **Step 2: Add `JUNIOR_SIGNALS` and a promotion in `quickScore`**

In `server/src/services/jobFeed.ts`, immediately after the `SENIOR_SIGNALS` array declaration, add:
```ts
// Title/description signals that mark a listing as junior/entry-level. Matching
// listings are promoted up the feed. Seek's search query is a hard AND-filter, so
// junior bias must happen here in ranking, not in the search URL.
const JUNIOR_SIGNALS = [
  'junior', 'graduate', 'entry level', 'entry-level', 'trainee', 'apprentice',
  'cadet', 'no experience', 'early career', '0-2 years', '1-2 years', 'assistant',
];
```

Then, inside `quickScore`, locate:
```ts
    if (SENIOR_SIGNALS.some(sig => haystack.includes(sig))) {
      score -= 1000; // pushes senior roles to the bottom without dropping them
    }
    return score;
```
and change it to:
```ts
    if (SENIOR_SIGNALS.some(sig => haystack.includes(sig))) {
      score -= 1000; // pushes senior roles to the bottom without dropping them
    }
    if (JUNIOR_SIGNALS.some(sig => haystack.includes(sig))) {
      score += 25; // promotes junior/entry-level roles above neutral listings
    }
    return score;
```

- [ ] **Step 3: Type-check**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/services/jobFeed.ts
git commit -m "feat(feed): promote junior/entry-level roles in quickScore ranking

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Swap `seekScraper.ts` to a re-export shim and verify all callers

**Files:**
- Modify: `server/src/services/seekScraper.ts` (replace entire body)

- [ ] **Step 1: Replace `seekScraper.ts` with a re-export shim**

Replace the **entire contents** of `server/src/services/seekScraper.ts` with:
```ts
/**
 * RE-EXPORT SHIM: all Seek scraping now lives in seekHtmlScraper.ts (direct HTML
 * fetch via axios + cheerio). This file preserves the old public API so callers
 * (jobFeed, sponsorScan, userJobScrape, jobFeedCron) and their tests need zero
 * import changes. The old Apify implementation has been removed.
 *
 * Follow-up (optional, after ~1 week stable): delete this file, rename
 * seekHtmlScraper.ts to seekScraper.ts, update the 4 import sites, and remove
 * apify-client + APIFY_API_KEY.
 */
export {
  fetchSeekJobsForCluster,
  prewarmSeekClusters,
  buildSeekClusterKey,
  buildEntryLevelSearchTerm,
  ENTRY_LEVEL_QUALIFIERS,
  buildSeekSearchUrl,
  stripEntryLevelQualifiers,
} from './seekHtmlScraper';
export type { SeekHtmlClusterKey as ClusterKey } from './seekHtmlScraper';
```

- [ ] **Step 2: Type-check the whole server**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx tsc --noEmit
```
Expected: no errors across all callers (`jobFeed.ts`, `sponsorScan.ts`, `userJobScrape.ts`, `jobFeedCron.ts`).

**STOP-AND-REPORT:** if any caller fails to compile, report the exact error rather than editing the caller — the shim is designed for zero caller changes, so a failure means the shim export list is wrong.

- [ ] **Step 3: Run the existing Seek-related unit tests**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services/userJobScrape.test.ts src/utils/__tests__/seekScraper.test.ts src/services/seekHtmlScraper.test.ts
```
Expected: all pass. `userJobScrape.test.ts` mocks `./seekScraper` (still valid). `seekScraper.test.ts` asserts cluster-key behaviour, not literal hashes, so the `seek-html|` prefix change is fine.

**STOP-AND-REPORT:** if `seekScraper.test.ts` fails on a hard-coded hash value, report it — do not edit the test to match; we need to confirm the assertion intent first.

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/services/seekScraper.ts
git commit -m "refactor(seek): seekScraper.ts becomes a re-export shim over seekHtmlScraper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Live smoke test + artifact cleanup

**Files:**
- Create: `server/scripts/test-html-scraper.ts`
- Delete: stale `server/scripts` artifacts

- [ ] **Step 1: Create the manual smoke test**

Create `server/scripts/test-html-scraper.ts`:
```ts
// Manual live smoke test (hits Seek). Run: npx tsx scripts/test-html-scraper.ts
import { buildSeekClusterKey, fetchSeekJobsForCluster } from '../src/services/seekHtmlScraper';

async function main() {
  const key = buildSeekClusterKey('laboratory technician', 'sydney', null);
  console.log('cluster:', JSON.stringify(key));
  const jobs = await fetchSeekJobsForCluster(key, { maxResults: 8, dateRange: 7 });
  console.log(`\nFetched ${jobs.length} jobs:\n`);
  for (const [i, j] of jobs.entries()) {
    console.log(`${i + 1}. ${j.title}`);
    console.log(`   ${j.company} • ${j.location}`);
    console.log(`   ${j.sourceUrl}`);
    console.log(`   posted: ${j.postedAt?.toISOString() ?? 'unknown'}`);
    console.log(`   desc(${j.description.length}): ${j.description.slice(0, 100)}...`);
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the smoke test**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx tsx scripts/test-html-scraper.ts
```
Expected:
- `Fetched N jobs` with **N between 1 and 8**.
- Every job has a non-empty title, company, sourceUrl, and a description **longer than the teaser** (typically > 500 chars).
- Most jobs have a `posted` date (Featured ones may be `unknown`).

**STOP-AND-REPORT:** if `N` is 0, or descriptions are empty/teaser-length, stop and report the full console output. Do **not** start swapping selectors or hosts — capture a fresh page into `__fixtures__/` and report what changed.

> Note: this script writes a real row into `SeekJobCache` for today. That is expected and harmless. A second run returns the cached rows (descriptions intact) and makes no HTTP calls.

- [ ] **Step 3: Delete stale scripts artifacts (keep the fixtures already copied in Task 1)**

Run (Git Bash):
```bash
cd E:/AntiGravity/JobHub/server/scripts
rm -f seek-page-clean_lab_technician.html seek-detail-sample.html seek-search-bundle.js
```
Leave `test-seek-inspect.mjs` and `test-seek-scrape.mjs` in place (harmless probes).

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/scripts/test-html-scraper.ts
git rm --cached server/scripts/seek-page-clean_lab_technician.html server/scripts/seek-search-bundle.js 2>/dev/null || true
git commit -m "test(seek): live smoke test for the HTML scraper + remove stale artifacts

- New scripts/test-html-scraper.ts exercises the full fetch path against Seek
- Search HTML + detail HTML preserved as offline fixtures under __fixtures__
- Removed stale scrape artifacts from scripts/

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Optional follow-up (after ~1 week stable — NOT part of this plan's execution)

- Remove `apify-client` from `server/package.json`.
- Delete `seekScraper.ts`, rename `seekHtmlScraper.ts` → `seekScraper.ts`, update the 4 import sites.
- Remove `APIFY_API_KEY` from `server/.env` if unused elsewhere.

---

### Known risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Seek changes card/detail HTML structure | Selectors target verified `data-automation` / `data-testid` attributes. Offline fixture tests (`seekHtmlScraper.test.ts`) fail loudly if parsing breaks; the smoke test catches host/markup changes. |
| `au.seek.com` starts 403-ing like `www` | The smoke test surfaces it immediately. Re-capture a page into `__fixtures__/` and report (do not blindly swap hosts). |
| Detail fetch volume / rate limits | Global `DETAIL_CONCURRENCY = 4`, prewarm runs clusters sequentially, `maxResults` caps per-call. ~4 in-flight requests max. |
| Junior roles still buried | `JUNIOR_SIGNALS` promotes (+25) and `SENIOR_SIGNALS` demotes (−1000) in `quickScore`; the full clean pool is fetched (65 vs the old 1). |
| Swap-day cache collision with Apify rows | New `seek-html|` hash prefix means new cache keys never read old Apify-format rows. |
| Transient fetch failure cached as empty | `fetchAllJobCards` returns `null` (not `[]`) on first-page failure; the public fn skips caching in that case. |

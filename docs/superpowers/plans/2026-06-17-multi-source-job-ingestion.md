# Multi-Source Job Ingestion — Implementation Plan

> **For Kimi (executor):** Execute task-by-task, top to bottom. Each task is TDD: write the failing test, see it fail, implement, see it pass, commit. **Do NOT skip a STOP-and-report guard.** When a guard fires, stop and report to the user — do not improvise a workaround. **Do NOT rewrite any prompt constant** — transcribe it verbatim. Steps use `- [ ]` for tracking.

**Goal:** Make the existing per-user "3 ideal jobs at CV-scan" flow (`scrapeJobsForTitles`) pull stable, high-quality jobs from Adzuna (API) + JSearch (API) + SEEK (Firecrawl scrape), deduplicated and relevance-scored, with full SEEK descriptions fetched lazily on click.

**Architecture:** Three source adapters share one contract and emit the existing `RawJob` type. Their output is merged/deduped into canonical `Job` + `JobSource` rows (reusing the existing `deduplicateJobs` matcher), relevance-scored, persisted with per-run observability, and returned to the dashboard. SEEK jobs hydrate full descriptions on demand; API jobs arrive hydrated.

**Tech Stack:** TypeScript, Express, Prisma 6 (PostgreSQL), Vitest, Firecrawl HTTP API, Anthropic Haiku (`claude-haiku-4-5-20251001`), Adzuna API, JSearch (RapidAPI).

**Reference spec:** `docs/superpowers/specs/2026-06-17-multi-source-job-ingestion-design.md`

**Conventions:**
- Run a single test file: `cd server && npx vitest run <relative-path>`
- All new ingestion code lives under `server/src/services/ingestion/`.
- `RawJob` (from `server/src/services/jobFeed.ts`) = `{ title, company, location, salary, description, sourceUrl, sourcePlatform, postedAt }` with `location`/`salary`/`postedAt` nullable.
- Commit after every task with the message shown.

---

### Task 1: Prisma models + migration

**Files:**
- Modify: `server/prisma/schema.prisma` (append models)

- [ ] **Step 1: Append the four models** to the end of `server/prisma/schema.prisma`:

```prisma
model Job {
  id                  String      @id @default(uuid())
  dedupKey            String      @unique
  title               String
  company             String
  normalizedCompany   String
  location            String?
  salary              String?
  workMode            String?
  description         String
  descriptionHydrated Boolean     @default(false)
  postedAt            DateTime?
  relevanceScore      Float       @default(0)
  lowRelevance        Boolean     @default(false)
  searchRole          String
  firstSeenAt         DateTime    @default(now())
  lastSeenAt          DateTime    @updatedAt
  feedDate            String
  sources             JobSource[]
  @@index([normalizedCompany])
  @@index([feedDate])
  @@index([lowRelevance])
}

model JobSource {
  id          String   @id @default(uuid())
  jobId       String
  job         Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  source      String
  sourceUrl   String
  sourceJobId String?
  seenAt      DateTime @default(now())
  @@unique([source, sourceUrl])
  @@index([jobId])
}

model IngestionRun {
  id         String         @id @default(uuid())
  startedAt  DateTime       @default(now())
  finishedAt DateTime?
  trigger    String
  totalRaw   Int            @default(0)
  totalNew   Int            @default(0)
  totalDup   Int            @default(0)
  results    SourceResult[]
}

model SourceResult {
  id           String       @id @default(uuid())
  runId        String
  run          IngestionRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  source       String
  query        String
  status       String
  rawCount     Int          @default(0)
  newCount     Int          @default(0)
  dupCount     Int          @default(0)
  uniqueCount  Int          @default(0)
  blocked      Boolean      @default(false)
  errorMessage String?
  latencyMs    Int          @default(0)
  creditsUsed  Int          @default(0)
  @@index([runId])
  @@index([source])
}
```

- [ ] **Step 2: Create the migration.**

Run: `cd server && npx prisma migrate dev --name add_job_ingestion_models`
Expected: migration created under `prisma/migrations/`, client regenerated, no errors.

**STOP-and-report guard (migration approach):** If `npx prisma migrate dev` is not the project convention (the repo also has `scripts/migrate-safe.js`), STOP and report before applying. Do not force a migration the project doesn't use.

- [ ] **Step 3: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(ingestion): add Job, JobSource, IngestionRun, SourceResult models"
```

---

### Task 2: Adapter contract types + ingestion config

**Files:**
- Create: `server/src/services/ingestion/types.ts`
- Create: `server/src/config/ingestion.ts`

- [ ] **Step 1: Write the types file** `server/src/services/ingestion/types.ts`:

```ts
import type { RawJob } from '../jobFeed';

export type IngestionSource = 'adzuna' | 'jsearch' | 'seek';

export interface SearchQuery {
  role: string;
  location: string;
  maxPages: number;
}

export interface SourceReport {
  source: IngestionSource;
  rawCount: number;
  blocked: boolean;
  errorMessage: string | null;
  latencyMs: number;
  creditsUsed: number;
}

export interface AdapterResult {
  jobs: RawJob[];
  report: SourceReport;
}

export interface SourceAdapter {
  readonly source: IngestionSource;
  search(query: SearchQuery): Promise<AdapterResult>;
}
```

- [ ] **Step 2: Write the config file** `server/src/config/ingestion.ts`:

```ts
import type { IngestionSource } from '../services/ingestion/types';

export const INGESTION_SOURCES: Record<IngestionSource, boolean> = {
  adzuna: true,
  jsearch: true,
  seek: true,
};

export const MAX_PAGES_PER_SOURCE = 2;
export const RELEVANCE_THRESHOLD = 0.34;
export const SEEK_SEARCH_MODE: 'keyword' | 'classification' = 'keyword';
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/ingestion/types.ts server/src/config/ingestion.ts
git commit -m "feat(ingestion): add adapter contract types and config"
```

---

### Task 3: Shared text helpers — export matcher, add locationKey

**Files:**
- Modify: `server/src/utils/deduplicateJobs.ts` (export `normalise` and `isSimilar`)
- Create: `server/src/services/ingestion/locationKey.ts`
- Test: `server/src/services/ingestion/locationKey.test.ts`

- [ ] **Step 1: Export the existing matcher.** In `server/src/utils/deduplicateJobs.ts`, change `function normalise` to `export function normalise` and `function isSimilar` to `export function isSimilar`. Leave all logic unchanged.

- [ ] **Step 2: Write the failing test** `server/src/services/ingestion/locationKey.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { locationKey } from './locationKey';

describe('locationKey', () => {
  it('extracts the AU state token', () => {
    expect(locationKey('Mosman, Sydney NSW')).toBe('nsw');
    expect(locationKey('Sydney NSW (Hybrid)')).toBe('nsw');
    expect(locationKey('Melbourne VIC')).toBe('vic');
  });
  it('falls back to normalised full string when no state token', () => {
    expect(locationKey('Remote')).toBe('remote');
    expect(locationKey('')).toBe('');
    expect(locationKey(null)).toBe('');
  });
});
```

- [ ] **Step 3: Run it, verify it fails.** Run: `cd server && npx vitest run src/services/ingestion/locationKey.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 4: Implement** `server/src/services/ingestion/locationKey.ts`:

```ts
const STATES = ['nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt'];

export function locationKey(location: string | null | undefined): string {
  const norm = (location ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return '';
  const tokens = norm.split(' ');
  for (const s of STATES) {
    if (tokens.includes(s)) return s;
  }
  return norm;
}
```

- [ ] **Step 5: Run it, verify it passes.** Run: `cd server && npx vitest run src/services/ingestion/locationKey.test.ts` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/utils/deduplicateJobs.ts server/src/services/ingestion/locationKey.ts server/src/services/ingestion/locationKey.test.ts
git commit -m "feat(ingestion): export job matcher, add locationKey helper"
```

---

### Task 4: Relevance scorer

**Files:**
- Create: `server/src/services/ingestion/relevance.ts`
- Test: `server/src/services/ingestion/relevance.test.ts`

- [ ] **Step 1: Write the failing test** `server/src/services/ingestion/relevance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { relevanceScore } from './relevance';

describe('relevanceScore', () => {
  it('scores an exact title match at 1', () => {
    expect(relevanceScore('Marketing Coordinator', 'Marketing Coordinator')).toBeCloseTo(1, 5);
  });
  it('scores a partial overlap between 0 and 1', () => {
    const s = relevanceScore('Senior Marketing Coordinator', 'Marketing Coordinator');
    expect(s).toBeGreaterThan(0.5);
    expect(s).toBeLessThan(1);
  });
  it('scores an unrelated title low', () => {
    expect(relevanceScore('Content Producer', 'Marketing Coordinator')).toBeLessThan(0.34);
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** Run: `cd server && npx vitest run src/services/ingestion/relevance.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `server/src/services/ingestion/relevance.ts`:

```ts
import { normalise } from '../../utils/deduplicateJobs';

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'at', 'with']);

function tokens(s: string): Set<string> {
  return new Set(normalise(s).split(' ').filter(t => t && !STOP.has(t)));
}

/** Jaccard-style overlap of role tokens present in the job title (0..1). */
export function relevanceScore(jobTitle: string, role: string): number {
  const t = tokens(jobTitle);
  const r = tokens(role);
  if (r.size === 0) return 0;
  let hit = 0;
  for (const tok of r) if (t.has(tok)) hit++;
  return hit / r.size;
}
```

- [ ] **Step 4: Run it, verify it passes.** Run: `cd server && npx vitest run src/services/ingestion/relevance.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/ingestion/relevance.ts server/src/services/ingestion/relevance.test.ts
git commit -m "feat(ingestion): add deterministic relevance scorer"
```

---

### Task 5: mergeSources — dedup across N sources into Job + JobSource shapes

**Files:**
- Create: `server/src/services/ingestion/mergeSources.ts`
- Test: `server/src/services/ingestion/mergeSources.test.ts`

This produces plain objects (not DB rows). Persistence is Task 10.

- [ ] **Step 1: Write the failing test** `server/src/services/ingestion/mergeSources.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mergeSources } from './mergeSources';
import type { RawJob } from '../jobFeed';
import type { IngestionSource } from './types';

const job = (o: Partial<RawJob> = {}): RawJob => ({
  title: 'Marketing Coordinator', company: 'Acme Pty Ltd', location: 'Sydney NSW',
  salary: null, description: 'x', sourceUrl: 'https://au.seek.com/job/1',
  sourcePlatform: 'seek', postedAt: null, ...o,
});

describe('mergeSources', () => {
  it('collapses the same job from two sources into one canonical with two JobSources', () => {
    const input: Array<{ source: IngestionSource; jobs: RawJob[] }> = [
      { source: 'seek', jobs: [job({ sourceUrl: 'https://au.seek.com/job/1' })] },
      { source: 'adzuna', jobs: [job({ sourceUrl: 'https://adzuna/abc', company: 'Acme' })] },
    ];
    const merged = mergeSources(input, 'Marketing Coordinator');
    expect(merged).toHaveLength(1);
    expect(merged[0].sources.map(s => s.source).sort()).toEqual(['adzuna', 'seek']);
  });

  it('keeps genuinely different jobs separate', () => {
    const input = [
      { source: 'seek' as IngestionSource, jobs: [job({ title: 'Marketing Coordinator', sourceUrl: 'u1' })] },
      { source: 'adzuna' as IngestionSource, jobs: [job({ title: 'Warehouse Picker', company: 'Other Co', sourceUrl: 'u2' })] },
    ];
    expect(mergeSources(input, 'Marketing Coordinator')).toHaveLength(2);
  });

  it('marks the SEEK source unhydrated and API sources hydrated', () => {
    const merged = mergeSources(
      [{ source: 'adzuna', jobs: [job({ sourceUrl: 'u3', description: 'full text' })] }],
      'Marketing Coordinator',
    );
    expect(merged[0].descriptionHydrated).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** Run: `cd server && npx vitest run src/services/ingestion/mergeSources.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `server/src/services/ingestion/mergeSources.ts`:

```ts
import type { RawJob } from '../jobFeed';
import type { IngestionSource } from './types';
import { normalise, isSimilar } from '../../utils/deduplicateJobs';
import { locationKey } from './locationKey';
import { relevanceScore } from './relevance';
import { RELEVANCE_THRESHOLD } from '../../config/ingestion';

export interface MergedJobSource {
  source: IngestionSource;
  sourceUrl: string;
  sourceJobId: string | null;
}

export interface MergedJob {
  dedupKey: string;
  title: string;
  company: string;
  normalizedCompany: string;
  location: string | null;
  salary: string | null;
  description: string;
  descriptionHydrated: boolean;
  postedAt: Date | null;
  relevanceScore: number;
  lowRelevance: boolean;
  searchRole: string;
  sources: MergedJobSource[];
}

function sig(j: RawJob): string {
  return normalise(`${j.title} ${j.company} ${j.location ?? ''}`);
}
function dedupKey(j: RawJob): string {
  return `${normalise(j.company)}|${normalise(j.title)}|${locationKey(j.location)}`;
}
function jobId(url: string): string | null {
  const m = url.match(/(\d{5,})/);
  return m ? m[1] : null;
}

export function mergeSources(
  input: Array<{ source: IngestionSource; jobs: RawJob[] }>,
  role: string,
): MergedJob[] {
  const merged: MergedJob[] = [];

  for (const { source, jobs } of input) {
    for (const job of jobs) {
      const existing = merged.find(m =>
        m.sources.some(s => s.sourceUrl === job.sourceUrl) ||
        isSimilar(sig(job), normalise(`${m.title} ${m.company} ${m.location ?? ''}`)),
      );
      if (existing) {
        if (!existing.sources.some(s => s.sourceUrl === job.sourceUrl)) {
          existing.sources.push({ source, sourceUrl: job.sourceUrl, sourceJobId: jobId(job.sourceUrl) });
        }
        if (!existing.descriptionHydrated && source !== 'seek') {
          existing.description = job.description;
          existing.descriptionHydrated = true;
        }
        continue;
      }
      const score = relevanceScore(job.title, role);
      merged.push({
        dedupKey: dedupKey(job),
        title: job.title,
        company: job.company,
        normalizedCompany: normalise(job.company),
        location: job.location,
        salary: job.salary,
        description: job.description,
        descriptionHydrated: source !== 'seek',
        postedAt: job.postedAt,
        relevanceScore: score,
        lowRelevance: score < RELEVANCE_THRESHOLD,
        searchRole: role,
        sources: [{ source, sourceUrl: job.sourceUrl, sourceJobId: jobId(job.sourceUrl) }],
      });
    }
  }
  return merged;
}
```

- [ ] **Step 4: Run it, verify it passes.** Run: `cd server && npx vitest run src/services/ingestion/mergeSources.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/ingestion/mergeSources.ts server/src/services/ingestion/mergeSources.test.ts
git commit -m "feat(ingestion): merge/dedup across sources into canonical jobs"
```

---

### Task 6: SEEK markdown parser + locked Haiku prompt

**Files:**
- Create: `server/src/services/ingestion/prompts/parseSeekPrompt.ts` (LOCKED — transcribe verbatim)
- Create: `server/src/services/ingestion/parseSeekMarkdown.ts`
- Create: `server/src/services/ingestion/__fixtures__/seek-search.md` (saved real scrape)
- Test: `server/src/services/ingestion/parseSeekMarkdown.test.ts`

- [ ] **Step 1: Create the locked prompt** `server/src/services/ingestion/prompts/parseSeekPrompt.ts`. **Transcribe verbatim — do not edit the wording:**

```ts
// OWNED BY CLAUDE. Do not rewrite. Mechanics only may be wired around it.
export const PARSE_SEEK_PROMPT = (markdown: string): string => `You are extracting job listings from the markdown of a SEEK search-results page.

Return ONLY a JSON array. Each element is one job actually present on the page:
{
  "title": string,
  "company": string,
  "location": string | null,
  "salary": string | null,
  "workMode": "onsite" | "hybrid" | "remote" | null,
  "sourceUrl": string,   // the https://au.seek.com/job/<id> link for that card, id preserved
  "teaser": string | null // the short highlight text on the card, if any
}

Rules:
- Extract ONLY jobs that genuinely appear on the page. Never invent a job, company, or field.
- If a field is not present on a card, use null. Do not guess.
- sourceUrl MUST be the canonical https://au.seek.com/job/<numeric-id> form. Strip query strings and fragments.
- Do not include markdown, navigation links, related searches, or career-advice links.
- Output the JSON array and nothing else. No prose, no code fences.

PAGE MARKDOWN:
${markdown}`;
```

- [ ] **Step 2: Save a real fixture.** Save the markdown from a live SEEK search scrape to `server/src/services/ingestion/__fixtures__/seek-search.md`. (Use the same scrape mechanism as Task 7; a copy already exists at `.firecrawl/seek-test.md` from design validation — copy it if present, otherwise scrape one page.)

**STOP-and-report guard (fixture):** If you cannot obtain a real SEEK search-page markdown fixture, STOP and report. Do not fabricate a fixture — the parser test must run against real page structure.

- [ ] **Step 3: Write the failing test** `server/src/services/ingestion/parseSeekMarkdown.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Mock the Haiku caller so the parser test is deterministic and offline.
vi.mock('../callClaude', () => ({
  callClaude: vi.fn(async () => ({
    content: JSON.stringify([
      { title: 'Content Producer', company: 'VAMOS Strength Training', location: 'Mosman, Sydney NSW',
        salary: '$37.50 – $40 per hour', workMode: 'hybrid',
        sourceUrl: 'https://au.seek.com/job/92726696', teaser: 'Unique opportunity' },
    ]),
    usage: { promptTokens: 1, completionTokens: 1 },
  })),
}));

import { parseSeekMarkdown } from './parseSeekMarkdown';

describe('parseSeekMarkdown', () => {
  it('maps parsed cards to RawJob with sourcePlatform seek', async () => {
    const md = readFileSync(join(__dirname, '__fixtures__/seek-search.md'), 'utf8');
    const jobs = await parseSeekMarkdown(md);
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].sourcePlatform).toBe('seek');
    expect(jobs[0].sourceUrl).toMatch(/au\.seek\.com\/job\/\d+/);
  });
});
```

> **Note on the mock path:** `../callClaude` must match the real import path used in Step 4. If the project's Claude caller lives elsewhere (search for `export ... callClaude`), update BOTH the mock path here and the import in Step 4 to match. STOP-and-report if no `callClaude`-style helper exists; do not call the Anthropic SDK directly.

- [ ] **Step 4: Run it, verify it fails.** Run: `cd server && npx vitest run src/services/ingestion/parseSeekMarkdown.test.ts` — Expected: FAIL.

- [ ] **Step 5: Implement** `server/src/services/ingestion/parseSeekMarkdown.ts`:

```ts
import type { RawJob } from '../jobFeed';
import { callClaude } from '../callClaude';
import { PARSE_SEEK_PROMPT } from './prompts/parseSeekPrompt';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

interface ParsedCard {
  title: string; company: string; location: string | null; salary: string | null;
  workMode: string | null; sourceUrl: string; teaser: string | null;
}

function canonicalUrl(url: string): string {
  const m = url.match(/au\.seek\.com\/job\/(\d+)/);
  return m ? `https://au.seek.com/job/${m[1]}` : url.split('?')[0].split('#')[0];
}

export async function parseSeekMarkdown(markdown: string): Promise<RawJob[]> {
  const { content } = await callClaude(PARSE_SEEK_PROMPT(markdown), true, undefined, HAIKU_MODEL);
  let cards: ParsedCard[];
  try {
    const start = content.indexOf('[');
    const end = content.lastIndexOf(']');
    cards = JSON.parse(content.slice(start, end + 1));
  } catch {
    return [];
  }
  return cards
    .filter(c => c && c.title && c.company && c.sourceUrl)
    .map(c => ({
      title: c.title,
      company: c.company,
      location: c.location ?? null,
      salary: c.salary ?? null,
      description: c.teaser ?? '',
      sourceUrl: canonicalUrl(c.sourceUrl),
      sourcePlatform: 'seek',
      postedAt: null,
    }));
}
```

> **STOP-and-report guard A (RawJob shape):** confirm `callClaude`'s real signature `(prompt, jsonMode, system?, model?)` before wiring. If it differs, adapt the call and report. Do not invent a signature.

- [ ] **Step 6: Run it, verify it passes.** Run: `cd server && npx vitest run src/services/ingestion/parseSeekMarkdown.test.ts` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/ingestion/prompts/parseSeekPrompt.ts server/src/services/ingestion/parseSeekMarkdown.ts server/src/services/ingestion/parseSeekMarkdown.test.ts server/src/services/ingestion/__fixtures__/seek-search.md
git commit -m "feat(ingestion): SEEK markdown parser with locked Haiku prompt"
```

---

### Task 7: SeekAdapter (Firecrawl scrape + parse)

**Files:**
- Create: `server/src/services/ingestion/firecrawl.ts` (thin Firecrawl HTTP client)
- Create: `server/src/services/ingestion/adapters/seek.ts`
- Test: `server/src/services/ingestion/adapters/seek.test.ts`

- [ ] **Step 1: Write the Firecrawl client** `server/src/services/ingestion/firecrawl.ts`:

```ts
const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v1/scrape';

export async function firecrawlScrape(url: string): Promise<{ markdown: string; blocked: boolean }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error('FIRECRAWL_API_KEY not set');
  const res = await fetch(FIRECRAWL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
  });
  if (!res.ok) return { markdown: '', blocked: true };
  const data = await res.json();
  const markdown: string = data?.data?.markdown ?? '';
  const blocked = !markdown || !/au\.seek\.com\/job\/\d+/.test(markdown);
  return { markdown, blocked };
}
```

- [ ] **Step 2: Write the failing test** `server/src/services/ingestion/adapters/seek.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../firecrawl', () => ({
  firecrawlScrape: vi.fn(async () => ({ markdown: '# jobs\n[x](https://au.seek.com/job/1)', blocked: false })),
}));
vi.mock('../parseSeekMarkdown', () => ({
  parseSeekMarkdown: vi.fn(async () => ([{
    title: 'Marketing Coordinator', company: 'Acme', location: 'Sydney NSW', salary: null,
    description: '', sourceUrl: 'https://au.seek.com/job/1', sourcePlatform: 'seek', postedAt: null,
  }])),
}));

import { seekAdapter } from './seek';

describe('seekAdapter', () => {
  it('returns parsed jobs and a report', async () => {
    const r = await seekAdapter.search({ role: 'Marketing Coordinator', location: 'Sydney NSW', maxPages: 1 });
    expect(r.jobs).toHaveLength(1);
    expect(r.report.source).toBe('seek');
    expect(r.report.blocked).toBe(false);
    expect(r.report.creditsUsed).toBe(1);
  });
});
```

- [ ] **Step 3: Run it, verify it fails.** Run: `cd server && npx vitest run src/services/ingestion/adapters/seek.test.ts` — Expected: FAIL.

- [ ] **Step 4: Implement** `server/src/services/ingestion/adapters/seek.ts`:

```ts
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
        const { markdown, blocked: b } = await firecrawlScrape(buildUrl(role, location, page));
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
```

- [ ] **Step 5: Run it, verify it passes.** Run: `cd server && npx vitest run src/services/ingestion/adapters/seek.test.ts` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/ingestion/firecrawl.ts server/src/services/ingestion/adapters/seek.ts server/src/services/ingestion/adapters/seek.test.ts
git commit -m "feat(ingestion): SEEK adapter via Firecrawl"
```

---

### Task 8: AdzunaAdapter

**Files:**
- Create: `server/src/services/ingestion/adapters/adzuna.ts`
- Test: `server/src/services/ingestion/adapters/adzuna.test.ts`

- [ ] **Step 1: Write the failing test** `server/src/services/ingestion/adapters/adzuna.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sample = {
  results: [{
    title: 'Marketing Coordinator',
    company: { display_name: 'Acme' },
    location: { display_name: 'Sydney, NSW' },
    salary_min: 70000, salary_max: 90000,
    description: 'Full description text here.',
    redirect_url: 'https://www.adzuna.com.au/jobs/details/123',
    created: '2026-06-10T00:00:00Z',
  }],
};

beforeEach(() => {
  process.env.ADZUNA_APP_ID = 'id';
  process.env.ADZUNA_APP_KEY = 'key';
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sample })) as any);
});

import { adzunaAdapter } from './adzuna';

describe('adzunaAdapter', () => {
  it('maps Adzuna results to RawJob with full description', async () => {
    const r = await adzunaAdapter.search({ role: 'Marketing Coordinator', location: 'Sydney NSW', maxPages: 1 });
    expect(r.jobs[0].sourcePlatform).toBe('adzuna');
    expect(r.jobs[0].description).toBe('Full description text here.');
    expect(r.report.source).toBe('adzuna');
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** Run: `cd server && npx vitest run src/services/ingestion/adapters/adzuna.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `server/src/services/ingestion/adapters/adzuna.ts`:

```ts
import type { RawJob } from '../../jobFeed';
import type { SourceAdapter, SearchQuery, AdapterResult } from '../types';

interface AdzunaResult {
  title: string; company?: { display_name?: string }; location?: { display_name?: string };
  salary_min?: number; salary_max?: number; description: string; redirect_url: string; created?: string;
}

function salary(r: AdzunaResult): string | null {
  if (r.salary_min && r.salary_max) return `$${Math.round(r.salary_min)} - $${Math.round(r.salary_max)}`;
  return null;
}

export const adzunaAdapter: SourceAdapter = {
  source: 'adzuna',
  async search({ role, location }: SearchQuery): Promise<AdapterResult> {
    const started = Date.now();
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) {
      return { jobs: [], report: { source: 'adzuna', rawCount: 0, blocked: false,
        errorMessage: 'ADZUNA_APP_ID/ADZUNA_APP_KEY not set', latencyMs: Date.now() - started, creditsUsed: 0 } };
    }
    const url = `https://api.adzuna.com/v1/api/jobs/au/search/1?app_id=${appId}&app_key=${appKey}`
      + `&what=${encodeURIComponent(role)}&where=${encodeURIComponent(location)}&results_per_page=20&content-type=application/json`;
    let errorMessage: string | null = null;
    let jobs: RawJob[] = [];
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`adzuna ${res.status}`);
      const data = await res.json();
      jobs = (data.results as AdzunaResult[]).map(r => ({
        title: r.title,
        company: r.company?.display_name ?? 'Unknown',
        location: r.location?.display_name ?? null,
        salary: salary(r),
        description: r.description ?? '',
        sourceUrl: r.redirect_url,
        sourcePlatform: 'adzuna',
        postedAt: r.created ? new Date(r.created) : null,
      }));
    } catch (e: any) {
      errorMessage = e?.message ?? 'adzuna error';
    }
    return { jobs, report: { source: 'adzuna', rawCount: jobs.length, blocked: false,
      errorMessage, latencyMs: Date.now() - started, creditsUsed: 0 } };
  },
};
```

- [ ] **Step 4: Run it, verify it passes.** Run: `cd server && npx vitest run src/services/ingestion/adapters/adzuna.test.ts` — Expected: PASS.

**STOP-and-report guard C (live shape):** Before this adapter is trusted in a real run, make ONE live Adzuna call with real keys and report a 3-row sample. If the live JSON differs from the `AdzunaResult` shape above, STOP and report the actual shape; do not silently reshape mappings.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/ingestion/adapters/adzuna.ts server/src/services/ingestion/adapters/adzuna.test.ts
git commit -m "feat(ingestion): Adzuna API adapter"
```

---

### Task 9: JSearchAdapter

**Files:**
- Create: `server/src/services/ingestion/adapters/jsearch.ts`
- Test: `server/src/services/ingestion/adapters/jsearch.test.ts`

- [ ] **Step 1: Write the failing test** `server/src/services/ingestion/adapters/jsearch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sample = {
  data: [{
    job_title: 'Marketing Coordinator', employer_name: 'Acme',
    job_city: 'Sydney', job_state: 'NSW',
    job_description: 'Full JD text.', job_apply_link: 'https://example.com/apply/1',
    job_posted_at_datetime_utc: '2026-06-10T00:00:00Z',
    job_min_salary: 70000, job_max_salary: 90000,
  }],
};

beforeEach(() => {
  process.env.JSEARCH_API_KEY = 'key';
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sample })) as any);
});

import { jsearchAdapter } from './jsearch';

describe('jsearchAdapter', () => {
  it('maps JSearch data to RawJob with full description', async () => {
    const r = await jsearchAdapter.search({ role: 'Marketing Coordinator', location: 'Sydney NSW', maxPages: 1 });
    expect(r.jobs[0].sourcePlatform).toBe('jsearch');
    expect(r.jobs[0].description).toBe('Full JD text.');
    expect(r.jobs[0].location).toContain('Sydney');
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** Run: `cd server && npx vitest run src/services/ingestion/adapters/jsearch.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `server/src/services/ingestion/adapters/jsearch.ts`:

```ts
import type { RawJob } from '../../jobFeed';
import type { SourceAdapter, SearchQuery, AdapterResult } from '../types';

interface JSearchResult {
  job_title: string; employer_name?: string; job_city?: string; job_state?: string;
  job_description: string; job_apply_link: string; job_posted_at_datetime_utc?: string;
  job_min_salary?: number; job_max_salary?: number;
}

function salary(r: JSearchResult): string | null {
  if (r.job_min_salary && r.job_max_salary) return `$${Math.round(r.job_min_salary)} - $${Math.round(r.job_max_salary)}`;
  return null;
}

export const jsearchAdapter: SourceAdapter = {
  source: 'jsearch',
  async search({ role, location }: SearchQuery): Promise<AdapterResult> {
    const started = Date.now();
    const key = process.env.JSEARCH_API_KEY;
    if (!key) {
      return { jobs: [], report: { source: 'jsearch', rawCount: 0, blocked: false,
        errorMessage: 'JSEARCH_API_KEY not set', latencyMs: Date.now() - started, creditsUsed: 0 } };
    }
    const q = encodeURIComponent(`${role} in ${location}`);
    // OpenWeb Ninja DIRECT route (x-api-key). Identical params/response to the RapidAPI route, no transfer caps.
    const url = `https://api.openwebninja.com/jsearch/search?query=${q}&page=1&num_pages=1&country=au`;
    let errorMessage: string | null = null;
    let jobs: RawJob[] = [];
    try {
      const res = await fetch(url, { headers: { 'x-api-key': key } });
      if (!res.ok) throw new Error(`jsearch ${res.status}`);
      const data = await res.json();
      jobs = (data.data as JSearchResult[]).map(r => ({
        title: r.job_title,
        company: r.employer_name ?? 'Unknown',
        location: [r.job_city, r.job_state].filter(Boolean).join(', ') || null,
        salary: salary(r),
        description: r.job_description ?? '',
        sourceUrl: r.job_apply_link,
        sourcePlatform: 'jsearch',
        postedAt: r.job_posted_at_datetime_utc ? new Date(r.job_posted_at_datetime_utc) : null,
      }));
    } catch (e: any) {
      errorMessage = e?.message ?? 'jsearch error';
    }
    return { jobs, report: { source: 'jsearch', rawCount: jobs.length, blocked: false,
      errorMessage, latencyMs: Date.now() - started, creditsUsed: 0 } };
  },
};
```

- [ ] **Step 4: Run it, verify it passes.** Run: `cd server && npx vitest run src/services/ingestion/adapters/jsearch.test.ts` — Expected: PASS.

**STOP-and-report guard C (live shape):** Make ONE live JSearch call with the real key, report a 3-row sample. If the live JSON differs from `JSearchResult`, STOP and report the actual shape.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/ingestion/adapters/jsearch.ts server/src/services/ingestion/adapters/jsearch.test.ts
git commit -m "feat(ingestion): JSearch API adapter"
```

---

### Task 10: Persistence — upsert jobs + write run/source observability

**Files:**
- Create: `server/src/services/ingestion/persist.ts`
- Test: `server/src/services/ingestion/persist.test.ts`

Assumes a shared Prisma client at `server/src/lib/prisma.ts` (search for the existing `PrismaClient` export; if it lives elsewhere, import from there and report).

- [ ] **Step 1: Write the failing test** `server/src/services/ingestion/persist.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

const upsert = vi.fn(async () => ({ id: 'job1' }));
const createRun = vi.fn(async () => ({ id: 'run1' }));
const updateRun = vi.fn(async () => ({}));
const createSourceResult = vi.fn(async () => ({}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    job: { upsert },
    jobSource: { upsert: vi.fn(async () => ({})) },
    ingestionRun: { create: createRun, update: updateRun },
    sourceResult: { create: createSourceResult },
  },
}));

import { persistMergedJobs } from './persist';

describe('persistMergedJobs', () => {
  it('upserts each merged job and writes a run record', async () => {
    await persistMergedJobs({
      merged: [{
        dedupKey: 'k', title: 'T', company: 'C', normalizedCompany: 'c', location: null, salary: null,
        description: 'd', descriptionHydrated: true, postedAt: null, relevanceScore: 1, lowRelevance: false,
        searchRole: 'T', sources: [{ source: 'adzuna', sourceUrl: 'u', sourceJobId: null }],
      }],
      reports: [{ source: 'adzuna', rawCount: 1, blocked: false, errorMessage: null, latencyMs: 5, creditsUsed: 0 }],
      trigger: 'manual',
      role: 'T',
      location: 'Sydney NSW',
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(createRun).toHaveBeenCalledTimes(1);
    expect(createSourceResult).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** Run: `cd server && npx vitest run src/services/ingestion/persist.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `server/src/services/ingestion/persist.ts`:

```ts
import { prisma } from '../../lib/prisma';
import type { MergedJob } from './mergeSources';
import type { SourceReport, IngestionSource } from './types';

function today(): string { return new Date().toISOString().slice(0, 10); }

export async function persistMergedJobs(args: {
  merged: MergedJob[];
  reports: SourceReport[];
  trigger: 'user_scan' | 'manual' | 'cron';
  role: string;
  location: string;
}): Promise<{ runId: string; newJobs: number; dupJobs: number }> {
  const run = await prisma.ingestionRun.create({ data: { trigger: args.trigger } });
  const feedDate = today();
  let newJobs = 0, dupJobs = 0;
  const perSourceNew: Record<string, number> = {};

  for (const m of args.merged) {
    const existing = await prisma.job.findUnique({ where: { dedupKey: m.dedupKey } });
    if (existing) dupJobs++; else newJobs++;
    const job = await prisma.job.upsert({
      where: { dedupKey: m.dedupKey },
      create: {
        dedupKey: m.dedupKey, title: m.title, company: m.company, normalizedCompany: m.normalizedCompany,
        location: m.location, salary: m.salary, description: m.description,
        descriptionHydrated: m.descriptionHydrated, postedAt: m.postedAt, relevanceScore: m.relevanceScore,
        lowRelevance: m.lowRelevance, searchRole: m.searchRole, feedDate,
      },
      update: { relevanceScore: m.relevanceScore, lowRelevance: m.lowRelevance, feedDate },
    });
    for (const s of m.sources) {
      if (!existing) perSourceNew[s.source] = (perSourceNew[s.source] ?? 0) + 1;
      await prisma.jobSource.upsert({
        where: { source_sourceUrl: { source: s.source, sourceUrl: s.sourceUrl } },
        create: { jobId: job.id, source: s.source, sourceUrl: s.sourceUrl, sourceJobId: s.sourceJobId },
        update: { jobId: job.id },
      });
    }
  }

  for (const r of args.reports) {
    const unique = uniqueContribution(args.merged, r.source);
    await prisma.sourceResult.create({
      data: {
        runId: run.id, source: r.source, query: `${args.role} @ ${args.location}`,
        status: r.errorMessage ? 'error' : r.blocked ? 'blocked' : 'ok',
        rawCount: r.rawCount, newCount: perSourceNew[r.source] ?? 0, dupCount: 0,
        uniqueCount: unique, blocked: r.blocked, errorMessage: r.errorMessage,
        latencyMs: r.latencyMs, creditsUsed: r.creditsUsed,
      },
    });
  }

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), totalRaw: args.reports.reduce((a, b) => a + b.rawCount, 0),
            totalNew: newJobs, totalDup: dupJobs },
  });
  return { runId: run.id, newJobs, dupJobs };
}

function uniqueContribution(merged: MergedJob[], source: IngestionSource): number {
  return merged.filter(m => m.sources.length === 1 && m.sources[0].source === source).length;
}
```

- [ ] **Step 4: Run it, verify it passes.** Run: `cd server && npx vitest run src/services/ingestion/persist.test.ts` — Expected: PASS.

**STOP-and-report guard (prisma path):** If `../../lib/prisma` is not the real shared client path, find the real one (`grep -rl "new PrismaClient" server/src`), update both the import and the mock, and report.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/ingestion/persist.ts server/src/services/ingestion/persist.test.ts
git commit -m "feat(ingestion): persist merged jobs + run/source observability"
```

---

### Task 11: Lazy description hydration

**Files:**
- Create: `server/src/services/ingestion/hydrate.ts`
- Test: `server/src/services/ingestion/hydrate.test.ts`

- [ ] **Step 1: Write the failing test** `server/src/services/ingestion/hydrate.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn(async () => ({}));
vi.mock('../../lib/prisma', () => ({
  prisma: { job: { findUnique, update }, jobSource: { findFirst: vi.fn(async () => ({ sourceUrl: 'https://au.seek.com/job/1' })) } },
}));
vi.mock('./firecrawl', () => ({ firecrawlScrape: vi.fn(async () => ({ markdown: 'FULL JD '.repeat(50), blocked: false })) }));

import { hydrateJobDescription } from './hydrate';

describe('hydrateJobDescription', () => {
  it('no-ops when already hydrated', async () => {
    findUnique.mockResolvedValueOnce({ id: 'j', descriptionHydrated: true });
    const r = await hydrateJobDescription('j');
    expect(r.hydrated).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
  it('fetches and stores the full description for an unhydrated SEEK job', async () => {
    findUnique.mockResolvedValueOnce({ id: 'j', descriptionHydrated: false });
    const r = await hydrateJobDescription('j');
    expect(r.hydrated).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** Run: `cd server && npx vitest run src/services/ingestion/hydrate.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `server/src/services/ingestion/hydrate.ts`:

```ts
import { prisma } from '../../lib/prisma';
import { firecrawlScrape } from './firecrawl';

export async function hydrateJobDescription(jobId: string): Promise<{ hydrated: boolean }> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.descriptionHydrated) return { hydrated: false };
  const src = await prisma.jobSource.findFirst({ where: { jobId, source: 'seek' } });
  if (!src) return { hydrated: false };
  const { markdown, blocked } = await firecrawlScrape(src.sourceUrl);
  if (blocked || !markdown) return { hydrated: false };
  await prisma.job.update({ where: { id: jobId }, data: { description: markdown, descriptionHydrated: true } });
  return { hydrated: true };
}
```

> Note: the hydrate `firecrawlScrape` `blocked` heuristic (looks for `/job/<id>`) is tuned for search pages; a detail page also contains that link, so it passes. Keep as-is.

- [ ] **Step 4: Run it, verify it passes.** Run: `cd server && npx vitest run src/services/ingestion/hydrate.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/ingestion/hydrate.ts server/src/services/ingestion/hydrate.test.ts
git commit -m "feat(ingestion): lazy SEEK description hydration"
```

---

### Task 12: Orchestrator — extend scrapeJobsForTitles to fan out across sources

**Files:**
- Create: `server/src/services/ingestion/runIngestion.ts`
- Modify: `server/src/services/userJobScrape.ts`
- Test: `server/src/services/ingestion/runIngestion.test.ts`

- [ ] **Step 1: Write the failing test** `server/src/services/ingestion/runIngestion.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

const seekJobs = [{ title: 'Registered Nurse', company: 'Health Co', location: 'Sydney NSW', salary: null, description: '', sourceUrl: 'https://au.seek.com/job/1', sourcePlatform: 'seek', postedAt: null }];
vi.mock('./adapters/seek', () => ({ seekAdapter: { source: 'seek', search: vi.fn(async () => ({ jobs: seekJobs, report: { source: 'seek', rawCount: 1, blocked: false, errorMessage: null, latencyMs: 1, creditsUsed: 1 } })) } }));
vi.mock('./adapters/adzuna', () => ({ adzunaAdapter: { source: 'adzuna', search: vi.fn(async () => ({ jobs: [], report: { source: 'adzuna', rawCount: 0, blocked: false, errorMessage: null, latencyMs: 1, creditsUsed: 0 } })) } }));
vi.mock('./adapters/jsearch', () => ({ jsearchAdapter: { source: 'jsearch', search: vi.fn(async () => ({ jobs: [], report: { source: 'jsearch', rawCount: 0, blocked: false, errorMessage: null, latencyMs: 1, creditsUsed: 0 } })) } }));
vi.mock('./persist', () => ({ persistMergedJobs: vi.fn(async () => ({ runId: 'r', newJobs: 1, dupJobs: 0 })) }));

import { runIngestionForTitle } from './runIngestion';

describe('runIngestionForTitle', () => {
  it('fans out across enabled adapters, merges, persists, and returns merged jobs', async () => {
    const r = await runIngestionForTitle('Registered Nurse', 'Sydney NSW', 'manual');
    expect(r.jobs.length).toBe(1);
    expect(r.jobs[0].title).toBe('Registered Nurse');
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** Run: `cd server && npx vitest run src/services/ingestion/runIngestion.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `server/src/services/ingestion/runIngestion.ts`:

```ts
import type { MergedJob } from './mergeSources';
import { mergeSources } from './mergeSources';
import { persistMergedJobs } from './persist';
import { seekAdapter } from './adapters/seek';
import { adzunaAdapter } from './adapters/adzuna';
import { jsearchAdapter } from './adapters/jsearch';
import type { SourceAdapter, SourceReport, IngestionSource } from './types';
import { INGESTION_SOURCES, MAX_PAGES_PER_SOURCE } from '../../config/ingestion';

const ALL: SourceAdapter[] = [adzunaAdapter, jsearchAdapter, seekAdapter];

export async function runIngestionForTitle(
  role: string, location: string, trigger: 'user_scan' | 'manual' | 'cron',
): Promise<{ jobs: MergedJob[]; reports: SourceReport[] }> {
  const adapters = ALL.filter(a => INGESTION_SOURCES[a.source as IngestionSource]);
  const results = await Promise.all(
    adapters.map(a => a.search({ role, location, maxPages: MAX_PAGES_PER_SOURCE })
      .catch((e): { jobs: []; report: SourceReport } => ({
        jobs: [], report: { source: a.source, rawCount: 0, blocked: false,
          errorMessage: e?.message ?? 'adapter error', latencyMs: 0, creditsUsed: 0 } }))),
  );
  const merged = mergeSources(results.map(r => ({ source: (r as any).report.source, jobs: r.jobs })), role);
  const reports = results.map(r => r.report);
  await persistMergedJobs({ merged, reports, trigger, role, location });
  return { jobs: merged, reports };
}
```

- [ ] **Step 4: Run it, verify it passes.** Run: `cd server && npx vitest run src/services/ingestion/runIngestion.test.ts` — Expected: PASS.

- [ ] **Step 5: Rewire `scrapeJobsForTitles`.** Replace the body of `server/src/services/userJobScrape.ts` with:

```ts
import type { RawJob } from './jobFeed';
import { runIngestionForTitle } from './ingestion/runIngestion';
import type { MergedJob } from './ingestion/mergeSources';

function toRawJob(m: MergedJob): RawJob {
  return {
    title: m.title, company: m.company, location: m.location, salary: m.salary,
    description: m.description, sourceUrl: m.sources[0]?.sourceUrl ?? '',
    sourcePlatform: m.sources[0]?.source ?? 'seek', postedAt: m.postedAt,
  };
}

export async function scrapeJobsForTitles(titles: string[], location: string): Promise<RawJob[]> {
  const runs = await Promise.all(titles.map(t => runIngestionForTitle(t, location, 'user_scan').catch(() => ({ jobs: [] as MergedJob[], reports: [] }))));
  const all = runs.flatMap(r => r.jobs).filter(m => !m.lowRelevance);
  const seen = new Set<string>();
  return all.filter(m => (seen.has(m.dedupKey) ? false : (seen.add(m.dedupKey), true))).map(toRawJob);
}
```

- [ ] **Step 6: Verify the build compiles.** Run: `cd server && npx tsc --noEmit` — Expected: no errors in ingestion or userJobScrape files.

**STOP-and-report guard G:** Do NOT delete `seekScraper.ts` or `seekHtmlScraper.ts`. After rewiring, run `grep -rl "fetchSeekJobsForCluster\|seekHtmlScraper" server/src` and report remaining callers so cutover is deliberate.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/ingestion/runIngestion.ts server/src/services/ingestion/runIngestion.test.ts server/src/services/userJobScrape.ts
git commit -m "feat(ingestion): multi-source orchestrator wired into scrapeJobsForTitles"
```

---

### Task 13: Admin observability endpoint

**Files:**
- Create: `server/src/routes/admin-ingestion.ts`
- Modify: `server/src/index.ts` (mount the route — follow how `admin-funnel.ts` is mounted)
- Test: `server/src/routes/admin-ingestion.test.ts`

- [ ] **Step 1: Inspect** how `admin-funnel.ts` is defined and mounted in `server/src/index.ts` (auth middleware, router export style). Mirror it exactly.

- [ ] **Step 2: Write the failing test** `server/src/routes/admin-ingestion.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    sourceResult: { groupBy: vi.fn(async () => ([
      { source: 'seek', _sum: { rawCount: 30, newCount: 10, uniqueCount: 8, creditsUsed: 1 } },
    ])) },
    ingestionRun: { count: vi.fn(async () => 3) },
  },
}));

import { buildIngestionSummary } from './admin-ingestion';

describe('buildIngestionSummary', () => {
  it('rolls up per-source metrics including unique contribution', async () => {
    const summary = await buildIngestionSummary();
    expect(summary.sources[0].source).toBe('seek');
    expect(summary.sources[0].uniqueCount).toBe(8);
    expect(summary.totalRuns).toBe(3);
  });
});
```

- [ ] **Step 3: Run it, verify it fails.** Run: `cd server && npx vitest run src/routes/admin-ingestion.test.ts` — Expected: FAIL.

- [ ] **Step 4: Implement** `server/src/routes/admin-ingestion.ts` (router + the testable rollup; copy auth middleware usage from `admin-funnel.ts`):

```ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export async function buildIngestionSummary() {
  const grouped = await prisma.sourceResult.groupBy({
    by: ['source'],
    _sum: { rawCount: true, newCount: true, uniqueCount: true, creditsUsed: true },
  } as any);
  const totalRuns = await prisma.ingestionRun.count();
  return {
    totalRuns,
    sources: (grouped as any[]).map(g => ({
      source: g.source,
      rawCount: g._sum.rawCount ?? 0,
      newCount: g._sum.newCount ?? 0,
      uniqueCount: g._sum.uniqueCount ?? 0,
      creditsUsed: g._sum.creditsUsed ?? 0,
    })),
  };
}

const router = Router();
// Copy the exact auth middleware used by admin-funnel.ts:
router.get('/summary', async (_req, res) => {
  res.json(await buildIngestionSummary());
});
export default router;
```

- [ ] **Step 5: Mount it** in `server/src/index.ts` next to the funnel admin route, e.g. `app.use('/api/admin/ingestion', <sameAuthMiddleware>, adminIngestionRouter);` using whatever auth `admin-funnel` uses.

- [ ] **Step 6: Run it, verify it passes + compiles.** Run: `cd server && npx vitest run src/routes/admin-ingestion.test.ts && npx tsc --noEmit` — Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/admin-ingestion.ts server/src/index.ts server/src/routes/admin-ingestion.test.ts
git commit -m "feat(ingestion): admin observability endpoint with per-source rollup"
```

---

### Task 14: Manual run script + full-suite verification (guard F)

**Files:**
- Create: `server/src/scripts/run_ingestion.ts`

- [ ] **Step 1: Write the script** `server/src/scripts/run_ingestion.ts`:

```ts
import { runIngestionForTitle } from '../services/ingestion/runIngestion';

async function main() {
  const role = process.argv[2] ?? 'Registered Nurse';
  const location = process.argv[3] ?? 'Sydney NSW';
  const { jobs, reports } = await runIngestionForTitle(role, location, 'manual');
  console.log(JSON.stringify({
    role, location,
    totalMerged: jobs.length,
    lowRelevance: jobs.filter(j => j.lowRelevance).length,
    perSource: reports.map(r => ({ source: r.source, raw: r.rawCount, blocked: r.blocked, error: r.errorMessage, credits: r.creditsUsed })),
  }, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the full unit suite.** Run: `cd server && npx vitest run src/services/ingestion` — Expected: all ingestion tests PASS.

- [ ] **Step 3: STOP-and-report guard F (single live run).** With real env keys set (`FIRECRAWL_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JSEARCH_API_KEY`), run:

`cd server && npx tsx src/scripts/run_ingestion.ts "Registered Nurse" "Sydney NSW"`

**Then STOP and report the printed summary to the user** (per-source raw counts, blocks, errors, credits, total merged, low-relevance count) **before any wider use.** Do not loop many titles or schedule a cron. If any source is blocked or returns 0 unexpectedly, report it — do not attempt anti-bot workarounds.

- [ ] **Step 4: Commit**

```bash
git add server/src/scripts/run_ingestion.ts
git commit -m "feat(ingestion): manual run script for single-title verification"
```

---

## Self-Review (completed by author)

- **Spec coverage:** Adapters (T7–9), SEEK parser+locked prompt (T6), merge/dedup reusing existing matcher (T5), relevance (T4), store+observability (T10,T13), lazy hydration (T11), per-user orchestration reusing `scrapeJobsForTitles` (T12), config (T2), models (T1), single-source-first verification (T14). All spec sections mapped.
- **Guards present:** A (RawJob/callClaude shape), B (keys), C (live API shapes ×2), D (parse coverage), E (no new matcher), F (single live run first), G (don't delete old scrapers). All carried from spec.
- **Type consistency:** `RawJob`, `MergedJob`, `SourceReport`, `AdapterResult`, `SourceAdapter`, `IngestionSource` used consistently across tasks; `relevanceScore(title, role)`, `mergeSources(input, role)`, `runIngestionForTitle(role, location, trigger)`, `persistMergedJobs({...})`, `hydrateJobDescription(jobId)`, `firecrawlScrape(url)` signatures match every call site.
- **Reuse:** `normalise`/`isSimilar` exported from existing `deduplicateJobs.ts` and reused in T4/T5; no second matcher introduced.

## Open items the executor must surface (not blockers to coding, blockers to live run)
- Real env keys: `FIRECRAWL_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JSEARCH_API_KEY`.
- Confirm shared Prisma client path (`server/src/lib/prisma.ts`) and `callClaude` import path; adjust mocks/imports if different (guards in T6/T10).

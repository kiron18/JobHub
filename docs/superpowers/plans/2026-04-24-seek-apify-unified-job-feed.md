# Seek Apify Unified Job Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Seek job listings via Apify into the daily job feed alongside Adzuna, deduplicate across both sources, and redesign the Apply flow so users are guided from document generation to on-site application submission.

**Architecture:** A shared `SeekJobCache` table caches Apify results keyed by (cluster_hash, date), so users in the same role+city+industry cluster share one scrape per day. Both Seek and Adzuna results are merged and deduplicated (Seek preferred on conflict) per user. A persistent `ApplyContextBanner` in the workspace + a post-generation apply panel guide users to submit on the source job board after preparing their documents.

**Tech Stack:** Apify JS SDK (`apify-client`), Prisma/PostgreSQL, Express/TypeScript, React/TypeScript, Framer Motion, Lucide React, localStorage

**Spec:** `docs/superpowers/specs/2026-04-24-seek-apify-unified-job-feed-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server/prisma/schema.prisma` | Modify | Add `SeekJobCache` model + `JobApplication.sourceUrl` |
| `server/src/utils/deduplicateJobs.ts` | Create | Pure dedup function (Seek preferred) |
| `server/src/utils/__tests__/deduplicateJobs.test.ts` | Create | Unit tests for dedup |
| `server/src/services/seekScraper.ts` | Create | Cluster key, Apify call, cache, prewarm |
| `server/src/utils/__tests__/seekScraper.test.ts` | Create | Unit tests for buildClusterKey |
| `server/src/services/jobFeed.ts` | Modify | Integrate Seek + dedup into `buildDailyFeed` |
| `server/src/cron/jobFeedCron.ts` | Modify | Prewarm clusters before per-user feeds |
| `server/src/routes/job-feed.ts` | Modify | Store `sourceUrl` in save route |
| `src/lib/platforms.ts` | Create | Shared PLATFORM_CONFIG + apply instructions |
| `src/components/jobs/JobCard.tsx` | Modify | New "Prepare & Apply" CTA + write apply context |
| `src/components/ApplyContextBanner.tsx` | Create | Persistent workspace banner |
| `src/components/ApplicationWorkspace.tsx` | Modify | Mount banner + post-gen apply panel |
| `src/components/tracker/types.ts` | Modify | Add `sourceUrl` to `JobApplication` type |
| `src/components/tracker/JobCard.tsx` | Modify | Apply link in expanded card |

---

## Task 1: Install `apify-client`

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install the package**

```bash
cd server && npm install apify-client
```

- [ ] **Step 2: Verify installation**

```bash
grep "apify-client" server/package.json
```

Expected output: `"apify-client": "^x.x.x"` in dependencies.

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "chore(deps): install apify-client for Seek scraping"
```

---

## Task 2: Database Schema Changes

**Files:**
- Modify: `server/prisma/schema.prisma`

Add the `SeekJobCache` model and `sourceUrl` to `JobApplication`.

- [ ] **Step 1: Add `SeekJobCache` model and `sourceUrl` to `JobApplication`**

In `server/prisma/schema.prisma`, add after the `JobFeedItem` model (after line 214):

```prisma
model SeekJobCache {
  id          String   @id @default(cuid())
  queryHash   String
  queryMeta   Json
  feedDate    String
  results     Json
  resultCount Int
  fetchedAt   DateTime @default(now())

  @@unique([queryHash, feedDate])
  @@index([feedDate])
}
```

In the `JobApplication` model (around line 166), add `sourceUrl` after `description`:

```prisma
  sourceUrl           String?
```

The updated `JobApplication` model block for context:
```prisma
model JobApplication {
  id                  String            @id @default(uuid())
  userId              String
  candidateProfileId  String
  title               String
  company             String
  description         String
  sourceUrl           String?
  dateApplied         DateTime?
  ...
```

- [ ] **Step 2: Run migration**

```bash
cd server && npx prisma migrate dev --name seek-cache-and-sourceurl
```

Expected: migration file created, applied successfully, no errors.

- [ ] **Step 3: Generate Prisma client**

```bash
cd server && npx prisma generate
```

Expected: `✔ Generated Prisma Client`.

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): add SeekJobCache model and JobApplication.sourceUrl"
```

---

## Task 3: Create `deduplicateJobs` Utility

**Files:**
- Create: `server/src/utils/deduplicateJobs.ts`
- Create: `server/src/utils/__tests__/deduplicateJobs.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/src/utils/__tests__/deduplicateJobs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { deduplicateJobs } from '../deduplicateJobs'
import type { RawJob } from '../../services/jobFeed'

const makeJob = (overrides: Partial<RawJob> = {}): RawJob => ({
  title: 'Software Engineer',
  company: 'Acme Corp',
  location: 'Melbourne',
  salary: null,
  description: 'Test description for this role.',
  sourceUrl: 'https://www.seek.com.au/job/123',
  sourcePlatform: 'seek',
  postedAt: null,
  ...overrides,
})

describe('deduplicateJobs', () => {
  it('returns seek jobs unchanged when no adzuna jobs', () => {
    const seek = [
      makeJob(),
      makeJob({ sourceUrl: 'https://www.seek.com.au/job/456', title: 'Other Job' }),
    ]
    expect(deduplicateJobs(seek, [])).toHaveLength(2)
  })

  it('returns adzuna jobs when no seek jobs', () => {
    const adzuna = [
      makeJob({ sourceUrl: 'https://www.adzuna.com.au/job/1', sourcePlatform: 'other' }),
    ]
    expect(deduplicateJobs([], adzuna)).toHaveLength(1)
  })

  it('deduplicates by exact URL — prefers seek listing', () => {
    const url = 'https://www.seek.com.au/job/123'
    const seek = [makeJob({ sourceUrl: url, description: 'Full seek description.' })]
    const adzuna = [makeJob({ sourceUrl: url, sourcePlatform: 'other', description: 'Short.' })]
    const result = deduplicateJobs(seek, adzuna)
    expect(result).toHaveLength(1)
    expect(result[0].sourcePlatform).toBe('seek')
    expect(result[0].description).toBe('Full seek description.')
  })

  it('deduplicates by fuzzy title+company+location — prefers seek', () => {
    const seek = [makeJob({ title: 'Software Engineer', company: 'Acme Corp', location: 'Melbourne' })]
    const adzuna = [makeJob({
      title: 'Software Engineer',
      company: 'Acme Corp',
      location: 'Melbourne VIC',
      sourceUrl: 'https://www.adzuna.com.au/redirect/abc',
      sourcePlatform: 'other',
    })]
    const result = deduplicateJobs(seek, adzuna)
    expect(result).toHaveLength(1)
    expect(result[0].sourcePlatform).toBe('seek')
  })

  it('keeps genuinely distinct jobs from both sources', () => {
    const seek = [makeJob({ title: 'Frontend Engineer', sourceUrl: 'https://www.seek.com.au/job/1' })]
    const adzuna = [makeJob({
      title: 'Backend Engineer',
      company: 'Different Corp',
      sourceUrl: 'https://www.adzuna.com.au/job/2',
      sourcePlatform: 'other',
    })]
    expect(deduplicateJobs(seek, adzuna)).toHaveLength(2)
  })

  it('does not produce duplicates within seek list', () => {
    const seek = [
      makeJob({ sourceUrl: 'https://www.seek.com.au/job/1' }),
      makeJob({ sourceUrl: 'https://www.seek.com.au/job/1' }),
    ]
    expect(deduplicateJobs(seek, [])).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && npx vitest run src/utils/__tests__/deduplicateJobs.test.ts
```

Expected: FAIL — `Cannot find module '../deduplicateJobs'`

- [ ] **Step 3: Implement `deduplicateJobs.ts`**

Create `server/src/utils/deduplicateJobs.ts`:

```typescript
import type { RawJob } from '../services/jobFeed'

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function isSimilar(a: string, b: string): boolean {
  const na = normalise(a), nb = normalise(b)
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return true
  return levenshtein(na, nb) / maxLen <= 0.15
}

function jobSignature(job: RawJob): string {
  return normalise(`${job.title} ${job.company} ${job.location ?? ''}`)
}

/** Merges seek (preferred) and adzuna jobs, deduplicating by URL then by fuzzy title+company+location. */
export function deduplicateJobs(seekJobs: RawJob[], adzunaJobs: RawJob[]): RawJob[] {
  const urlSet = new Set<string>()
  const result: RawJob[] = []

  for (const job of seekJobs) {
    if (job.sourceUrl && urlSet.has(job.sourceUrl)) continue
    if (job.sourceUrl) urlSet.add(job.sourceUrl)
    result.push(job)
  }

  for (const job of adzunaJobs) {
    if (job.sourceUrl && urlSet.has(job.sourceUrl)) continue
    const sig = jobSignature(job)
    if (result.some(s => isSimilar(sig, jobSignature(s)))) continue
    if (job.sourceUrl) urlSet.add(job.sourceUrl)
    result.push(job)
  }

  return result
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd server && npx vitest run src/utils/__tests__/deduplicateJobs.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/deduplicateJobs.ts server/src/utils/__tests__/deduplicateJobs.test.ts
git commit -m "feat(utils): add deduplicateJobs utility (Seek preferred)"
```

---

## Task 4: Create Shared Frontend Platform Config

**Files:**
- Create: `src/lib/platforms.ts`
- Modify: `src/components/jobs/JobCard.tsx:29-35`

- [ ] **Step 1: Create `src/lib/platforms.ts`**

```typescript
export interface PlatformConfig {
  label: string
  color: string
  bg: string
}

export const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  seek:     { label: 'Seek',      color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
  indeed:   { label: 'Indeed',    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  jora:     { label: 'Jora',      color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  linkedin: { label: 'LinkedIn',  color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  other:    { label: 'Job Board', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
}

export const APPLY_INSTRUCTIONS: Record<string, string[]> = {
  seek: [
    'Click the link above to open the job listing on Seek',
    'Log in or create a free Seek account',
    'Upload your tailored resume',
    'Paste your cover letter into the application form',
    'Submit your application',
  ],
  linkedin: [
    'Click the link above to open the job on LinkedIn',
    'Sign in to your LinkedIn account',
    'Click "Apply" or "Easy Apply"',
    'Upload your resume and paste your cover letter',
    'Submit your application',
  ],
  indeed: [
    'Click the link above to open the listing on Indeed',
    'Sign in or create an Indeed account',
    'Upload your tailored resume',
    'Paste your cover letter and submit',
  ],
  jora: [
    'Click the link above — you may be redirected to the employer\'s site',
    'Upload your tailored resume',
    'Paste your cover letter into the application form',
    'Submit your application',
  ],
  other: [
    'Click the link above to open the job listing',
    'Upload your tailored resume',
    'Paste your cover letter into the application form',
    'Submit your application',
  ],
}

export function getPlatformConfig(platform: string): PlatformConfig {
  return PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG.other
}

export function getApplyInstructions(platform: string): string[] {
  return APPLY_INSTRUCTIONS[platform] ?? APPLY_INSTRUCTIONS.other
}
```

- [ ] **Step 2: Update `JobCard.tsx` to import from platforms.ts**

In `src/components/jobs/JobCard.tsx`, replace the inline `PLATFORM_CONFIG` definition (lines 29–35):

```typescript
// Remove this block:
const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  seek:     { label: 'Seek',     color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
  indeed:   { label: 'Indeed',   color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  jora:     { label: 'Jora',     color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  linkedin: { label: 'LinkedIn', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  other:    { label: 'Job Board', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};
```

Replace with:

```typescript
import { getPlatformConfig } from '../../lib/platforms';
```

Then update the usage at line 71:

```typescript
// Old:
const platform = PLATFORM_CONFIG[item.sourcePlatform] ?? PLATFORM_CONFIG.other;
// New:
const platform = getPlatformConfig(item.sourcePlatform);
```

- [ ] **Step 3: Verify the app still compiles**

```bash
cd E:\AntiGravity\JobHub && npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/platforms.ts src/components/jobs/JobCard.tsx
git commit -m "refactor(platforms): extract platform config to shared lib"
```

---

## Task 5: Create `seekScraper.ts` Service

**Files:**
- Create: `server/src/services/seekScraper.ts`
- Create: `server/src/utils/__tests__/seekScraper.test.ts`

- [ ] **Step 1: Write failing tests for `buildClusterKey`**

Create `server/src/utils/__tests__/seekScraper.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildClusterKey } from '../../services/seekScraper'

describe('buildClusterKey', () => {
  it('trims whitespace and lowercases city', () => {
    const k = buildClusterKey('  Software Engineer  ', '  Melbourne  ', 'Tech')
    expect(k.role).toBe('Software Engineer')
    expect(k.city).toBe('melbourne')
  })

  it('strips state suffix from city', () => {
    const k1 = buildClusterKey('Engineer', 'Melbourne, VIC', null)
    const k2 = buildClusterKey('Engineer', 'Melbourne', null)
    expect(k1.hash).toBe(k2.hash)
  })

  it('produces identical hashes for identical inputs', () => {
    const k1 = buildClusterKey('Software Engineer', 'Melbourne', 'Tech')
    const k2 = buildClusterKey('Software Engineer', 'Melbourne', 'Tech')
    expect(k1.hash).toBe(k2.hash)
  })

  it('produces different hashes for different roles', () => {
    const k1 = buildClusterKey('Software Engineer', 'Melbourne', 'Tech')
    const k2 = buildClusterKey('Data Scientist', 'Melbourne', 'Tech')
    expect(k1.hash).not.toBe(k2.hash)
  })

  it('produces different hashes for different cities', () => {
    const k1 = buildClusterKey('Engineer', 'Melbourne', 'Tech')
    const k2 = buildClusterKey('Engineer', 'Sydney', 'Tech')
    expect(k1.hash).not.toBe(k2.hash)
  })

  it('treats null industry same as empty string', () => {
    const k1 = buildClusterKey('Engineer', 'Melbourne', null)
    const k2 = buildClusterKey('Engineer', 'Melbourne', '')
    expect(k1.hash).toBe(k2.hash)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && npx vitest run src/utils/__tests__/seekScraper.test.ts
```

Expected: FAIL — `Cannot find module '../../services/seekScraper'`

- [ ] **Step 3: Create `server/src/services/seekScraper.ts`**

```typescript
import { createHash } from 'crypto'
import { ApifyClient } from 'apify-client'
import { prisma } from '../index'
import type { RawJob } from './jobFeed'

// ─── IMPORTANT: Before running ───────────────────────────────────────────────
// 1. Visit https://apify.com/actors and search "seek jobs scraper australia"
// 2. Choose the actor with the highest rating and recent updates
// 3. Update SEEK_ACTOR_ID below with the verified actor ID (e.g. "username/actor-name")
// 4. Check the actor's input schema and update buildActorInput() parameter names if needed
// 5. Check the actor's output schema and update mapActorResult() field names if needed
const SEEK_ACTOR_ID = 'bebity/seek-jobs-scraper'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClusterKey {
  role: string
  city: string
  industry: string
  hash: string
}

interface UserForCluster {
  userId: string
  targetRole: string
  targetCity: string
  industry: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function buildClusterKey(
  targetRole: string,
  targetCity: string,
  industry: string | null
): ClusterKey {
  const role = targetRole.trim()
  const city = targetCity.trim().split(',')[0].trim().toLowerCase()
  const ind = (industry ?? '').trim().toLowerCase()
  const raw = `${role.toLowerCase()}|${city}|${ind}`
  return {
    role,
    city,
    industry: industry ?? '',
    hash: createHash('sha256').update(raw).digest('hex'),
  }
}

function todayFeedDate(): string {
  const s = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const [day, month, year] = s.split('/')
  return `${year}-${month}-${day}`
}

function buildActorInput(role: string, city: string) {
  return {
    keyword: role,    // Verify param name in actor docs
    location: city,   // Verify param name in actor docs
    maxItems: 50,     // Verify param name in actor docs
  }
}

function mapActorResult(item: any, city: string): RawJob | null {
  const sourceUrl = item.jobUrl ?? item.url ?? item.link ?? ''
  if (!sourceUrl) return null
  return {
    title: item.title ?? item.jobTitle ?? 'Untitled',
    company: item.company ?? item.companyName ?? item.advertiser ?? 'Unknown Company',
    location: item.location ?? item.suburb ?? item.area ?? city,
    salary: item.salary ?? item.salaryRange ?? item.salaryDescription ?? null,
    description: item.description ?? item.jobDescription ?? item.jobSummary ?? '',
    sourceUrl,
    sourcePlatform: 'seek',
    postedAt: (item.listingDate ?? item.postedAt ?? item.datePosted)
      ? new Date(item.listingDate ?? item.postedAt ?? item.datePosted)
      : null,
  }
}

// ─── Core scrape (with cache) ─────────────────────────────────────────────────

export async function fetchSeekJobsForCluster(cluster: ClusterKey): Promise<RawJob[]> {
  const feedDate = todayFeedDate()

  const cached = await prisma.seekJobCache.findUnique({
    where: { queryHash_feedDate: { queryHash: cluster.hash, feedDate } },
  })

  if (cached) {
    const items = cached.results as any[]
    return items.flatMap(r => {
      const mapped = mapActorResult(r, cluster.city)
      return mapped ? [mapped] : []
    })
  }

  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) {
    console.warn('[seekScraper] APIFY_API_KEY not set — skipping Seek scrape')
    return []
  }

  const client = new ApifyClient({ token: apiKey })

  let items: any[] = []
  try {
    const run = await client.actor(SEEK_ACTOR_ID).call(
      buildActorInput(cluster.role, cluster.city),
      { waitSecs: 120 }
    )
    const dataset = await client.dataset(run.defaultDatasetId).listItems()
    items = dataset.items
  } catch (err: any) {
    console.error(`[seekScraper] Apify call failed for cluster ${cluster.hash}:`, err.message)
    return []
  }

  try {
    await prisma.seekJobCache.create({
      data: {
        queryHash: cluster.hash,
        queryMeta: { role: cluster.role, city: cluster.city, industry: cluster.industry },
        feedDate,
        results: items,
        resultCount: items.length,
      },
    })
  } catch (cacheErr: any) {
    console.warn('[seekScraper] Cache write failed (non-fatal):', cacheErr.message)
  }

  return items.flatMap(r => {
    const mapped = mapActorResult(r, cluster.city)
    return mapped ? [mapped] : []
  })
}

// ─── Prewarm all clusters in parallel (used by cron) ─────────────────────────

export async function prewarmSeekClusters(users: UserForCluster[]): Promise<void> {
  const seen = new Map<string, ClusterKey>()

  for (const u of users) {
    const key = buildClusterKey(u.targetRole, u.targetCity, u.industry)
    if (!seen.has(key.hash)) seen.set(key.hash, key)
  }

  const clusters = Array.from(seen.values())
  console.log(`[seekScraper] Prewarming ${clusters.length} cluster(s)`)

  await Promise.allSettled(
    clusters.map(c =>
      fetchSeekJobsForCluster(c).then(jobs =>
        console.log(`[seekScraper] ✓ cluster ${c.role}/${c.city} → ${jobs.length} jobs`)
      ).catch(err =>
        console.error(`[seekScraper] ✗ cluster ${c.role}/${c.city}:`, err.message)
      )
    )
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd server && npx vitest run src/utils/__tests__/seekScraper.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/seekScraper.ts server/src/utils/__tests__/seekScraper.test.ts
git commit -m "feat(scraper): add Seek Apify scraper service with cluster caching"
```

---

## Task 6: Update `jobFeed.ts` — Integrate Seek and Dedup

**Files:**
- Modify: `server/src/services/jobFeed.ts`

- [ ] **Step 1: Add imports for seekScraper and deduplicateJobs**

At the top of `server/src/services/jobFeed.ts`, after the existing imports (after line 4), add:

```typescript
import { buildClusterKey, fetchSeekJobsForCluster } from './seekScraper';
import { deduplicateJobs } from '../utils/deduplicateJobs';
```

- [ ] **Step 2: Update `buildDailyFeed` to include `industry` and integrate Seek**

Replace the entire `buildDailyFeed` function (lines 147–180) with:

```typescript
export async function buildDailyFeed(userId: string): Promise<void> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { targetRole: true, targetCity: true, industry: true },
  });

  if (!profile?.targetRole || !profile?.targetCity) {
    throw new Error('Profile incomplete — set a target role and city first');
  }

  const clusterKey = buildClusterKey(profile.targetRole, profile.targetCity, profile.industry);

  const [adzunaJobs, seekJobs] = await Promise.all([
    fetchAdzunaJobs(profile.targetRole, profile.targetCity),
    fetchSeekJobsForCluster(clusterKey).catch((err: Error) => {
      console.error(`[buildDailyFeed] Seek fetch failed for ${userId}:`, err.message);
      return [] as RawJob[];
    }),
  ]);

  const jobs = deduplicateJobs(seekJobs, adzunaJobs);

  if (jobs.length === 0) return;

  const today = todayAEST();

  await prisma.jobFeedItem.deleteMany({ where: { userId, feedDate: today } });

  await prisma.jobFeedItem.createMany({
    data: jobs.map(j => ({
      userId,
      feedDate: today,
      title: j.title,
      company: j.company,
      location: j.location,
      salary: j.salary,
      description: j.description,
      sourceUrl: j.sourceUrl,
      sourcePlatform: j.sourcePlatform,
      postedAt: j.postedAt,
    })),
  });
}
```

- [ ] **Step 3: Verify server compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/jobFeed.ts
git commit -m "feat(feed): integrate Seek scraper and dedup into buildDailyFeed"
```

---

## Task 7: Update `jobFeedCron.ts` — Prewarm Clusters Before Feeds

**Files:**
- Modify: `server/src/cron/jobFeedCron.ts`

- [ ] **Step 1: Replace `jobFeedCron.ts` with cluster-prewarm version**

Replace the entire file `server/src/cron/jobFeedCron.ts`:

```typescript
import cron from 'node-cron';
import { prisma } from '../index';
import { buildDailyFeed } from '../services/jobFeed';
import { prewarmSeekClusters } from '../services/seekScraper';

let cronStarted = false;

export function startJobFeedCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  cron.schedule('0 21 * * *', async () => {
    console.log('[jobFeedCron] Starting daily feed pre-fetch');

    let users: { userId: string; targetRole: string; targetCity: string; industry: string | null }[] = [];
    try {
      const profiles = await prisma.candidateProfile.findMany({
        where: { dashboardAccess: true, hasCompletedOnboarding: true },
        select: { userId: true, targetRole: true, targetCity: true, industry: true },
      });
      users = profiles.filter(
        (p): p is typeof users[number] => !!p.targetRole && !!p.targetCity
      );
    } catch (err) {
      console.error('[jobFeedCron] Failed to load users:', err);
      return;
    }

    console.log(`[jobFeedCron] Pre-fetching for ${users.length} users`);

    // Prewarm Seek cache for all unique clusters in parallel
    try {
      await prewarmSeekClusters(users);
    } catch (err) {
      console.error('[jobFeedCron] Seek prewarm failed (non-fatal):', err);
    }

    // Build per-user feeds — Seek uses cache, Adzuna fetched per user
    for (const { userId } of users) {
      try {
        await buildDailyFeed(userId);
        console.log(`[jobFeedCron] ✓ ${userId}`);
      } catch (err: any) {
        console.error(`[jobFeedCron] ✗ ${userId}:`, err instanceof Error ? err.message : String(err));
      }
    }

    console.log('[jobFeedCron] Complete');
  });
}
```

- [ ] **Step 2: Verify server compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/cron/jobFeedCron.ts
git commit -m "feat(cron): prewarm Seek clusters in parallel before per-user feeds"
```

---

## Task 8: Update Save Route — Store `sourceUrl` on `JobApplication`

**Files:**
- Modify: `server/src/routes/job-feed.ts:251-261`

- [ ] **Step 1: Add `sourceUrl` to the `jobApplication.create` call**

In `server/src/routes/job-feed.ts`, find the `POST /:id/save` route. In the `prisma.jobApplication.create` call (around line 251), add `sourceUrl`:

```typescript
// Old:
const jobApp = await prisma.jobApplication.create({
  data: {
    userId,
    candidateProfileId: profile.id,
    title: item.title,
    company: item.company,
    description: item.description,
    notes: `Source: ${item.sourceUrl}`,
    status: 'SAVED',
  },
});

// New:
const jobApp = await prisma.jobApplication.create({
  data: {
    userId,
    candidateProfileId: profile.id,
    title: item.title,
    company: item.company,
    description: item.description,
    sourceUrl: item.sourceUrl,
    notes: `Source: ${item.sourceUrl}`,
    status: 'SAVED',
  },
});
```

- [ ] **Step 2: Verify server compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/job-feed.ts
git commit -m "feat(jobs): store sourceUrl on JobApplication when saving from feed"
```

---

## Task 9: Update Feed `JobCard.tsx` — New Apply CTA

**Files:**
- Modify: `src/components/jobs/JobCard.tsx`

This replaces the "Apply on [Platform]" + "Generate Documents" dual-button with a "Prepare & Apply" primary CTA plus a secondary "View listing" text link.

- [ ] **Step 1: Update `handleGenerateDocs` → `handlePrepareAndApply`**

No import changes needed in `JobCard.tsx` for this task (the `getPlatformConfig` import from Task 4 is sufficient). Replace the `handleGenerateDocs` function (lines 150–162) with `handlePrepareAndApply`:

```typescript
const handlePrepareAndApply = (e: React.MouseEvent) => {
  e.stopPropagation();
  localStorage.setItem('jobhub_current_jd', item.description);
  localStorage.setItem('jobhub_current_job_context', JSON.stringify({
    company: item.company,
    title: item.title,
    suggestedAddressee: addresseeOverride ?? item.suggestedAddressee ?? null,
    matchScore: item.matchScore ?? null,
  }));
  localStorage.setItem('jobhub_apply_context', JSON.stringify({
    jobId: item.id,
    title: item.title,
    company: item.company,
    description: item.description,
    sourceUrl: item.sourceUrl,
    sourcePlatform: item.sourcePlatform,
  }));
  navigate('/');
  toast.success('Job loaded — generate your documents, then apply');
};
```

- [ ] **Step 2: Replace the apply section buttons (lines 377–413)**

Find the "Apply section" div in the expanded card (the `<div className="rounded-xl bg-slate-800/30 ...">` block starting around line 378) and replace its contents:

```typescript
{/* Apply section */}
<div className="rounded-xl bg-slate-800/30 border border-slate-700/40 p-3 space-y-2">
  <p className="text-xs text-slate-400 leading-relaxed">
    <span className="font-semibold text-slate-200">We build the documents. You make the move.</span>{' '}
    Applying directly signals genuine intent — hiring managers notice candidates who submit personally.
  </p>
  <div className="flex items-center gap-2 flex-wrap">
    <button
      onClick={handlePrepareAndApply}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-white transition-colors"
      style={{ background: platform.color }}
    >
      Prepare &amp; Apply →
    </button>
    <button
      onClick={handleSave}
      disabled={saving || item.isSaved}
      title={item.isSaved ? 'Already saved to tracker' : 'Save to tracker'}
      aria-label={item.isSaved ? 'Already saved to tracker' : 'Save to tracker'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors disabled:opacity-40"
    >
      {saving ? <Loader2 size={11} className="animate-spin" /> : item.isSaved ? <BookmarkCheck size={11} className="text-emerald-400" /> : <BookmarkPlus size={11} />}
      {item.isSaved ? 'Saved' : 'Save'}
    </button>
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
    >
      <ExternalLink size={10} />
      View on {platform.label}
    </a>
  </div>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `src/components/jobs/JobCard.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/jobs/JobCard.tsx
git commit -m "feat(feed): replace dual-CTA with Prepare & Apply + view link"
```

---

## Task 10: Create `ApplyContextBanner` Component

**Files:**
- Create: `src/components/ApplyContextBanner.tsx`

The banner is a **controlled component** — the workspace owns the state and passes it down. This ensures that dismissing the banner also clears the post-generation apply panel in the same render cycle.

- [ ] **Step 1: Create the component**

```typescript
import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import { getPlatformConfig } from '../lib/platforms';

export interface ApplyContext {
  jobId: string;
  title: string;
  company: string;
  description: string;
  sourceUrl: string;
  sourcePlatform: string;
}

interface Props {
  context: ApplyContext | null;
  onDismiss: () => void;
}

export const ApplyContextBanner: React.FC<Props> = ({ context, onDismiss }) => {
  if (!context) return null;

  const platform = getPlatformConfig(context.sourcePlatform);

  return (
    <div className="bg-slate-900/60 border-b border-slate-700/50 px-6 py-2 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ color: platform.color, background: platform.bg }}
        >
          {platform.label}
        </span>
        <p className="text-xs text-slate-400 truncate">
          <span className="text-slate-200 font-semibold">{context.title}</span>
          {' · '}{context.company}
        </p>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
        <a
          href={context.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-colors"
          style={{ color: platform.color }}
        >
          <ExternalLink size={10} />
          Apply on {platform.label}
        </a>
        <button
          onClick={onDismiss}
          aria-label="Dismiss application context"
          className="text-slate-600 hover:text-slate-400 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ApplyContextBanner.tsx
git commit -m "feat(workspace): add ApplyContextBanner component"
```

---

## Task 11: Update `ApplicationWorkspace.tsx` — Banner and Post-Gen Apply Panel

**Files:**
- Modify: `src/components/ApplicationWorkspace.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/ApplicationWorkspace.tsx`, add two imports.

After the `import { exportPdf } from '../lib/exportPdf';` line, add:

```typescript
import { ApplyContextBanner, type ApplyContext } from './ApplyContextBanner';
import { getPlatformConfig, getApplyInstructions } from '../lib/platforms';
```

Add `ExternalLink` to the existing lucide-react import block (which is at lines 5–20):

```typescript
// Add ExternalLink to the lucide-react import:
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Download,
    Database,
    Mail,
    List,
    RefreshCcw,
    PlusCircle,
    AlertCircle,
    BookOpen,
    FlaskConical,
    Loader2,
    Copy,
    CheckCircle,
    ExternalLink,
} from 'lucide-react';
```

- [ ] **Step 2: Add `applyContext` state and dismiss handler**

In the `ApplicationWorkspace` component body, after the existing `const [employerFramework, setEmployerFramework] = useState<string | null>(null);` line (around line 228), add:

```typescript
const [applyContext, setApplyContext] = useState<ApplyContext | null>(() => {
    try {
        const raw = localStorage.getItem('jobhub_apply_context');
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
});

const handleDismissApplyContext = () => {
    localStorage.removeItem('jobhub_apply_context');
    setApplyContext(null);
};
```

- [ ] **Step 3: Mount the banner between the profile warning and `<main>`**

Find the closing `)}` of the profile completion warning block (around line 746):

```typescript
            </div>
        )}

        <main className="flex-1 flex overflow-hidden">
```

Insert `<ApplyContextBanner>` with props between the two divs:

```typescript
            </div>
        )}

        <ApplyContextBanner context={applyContext} onDismiss={handleDismissApplyContext} />

        <main className="flex-1 flex overflow-hidden">
```

- [ ] **Step 4: Add the post-generation apply panel**

Find the `{state.blueprint && !state.isGenerating && (` block (around line 1249). Insert the apply panel immediately before it, after the closing `</div>` of the document white card (around line 1248):

```typescript
                        </div>

                        {/* Post-generation apply panel */}
                        {applyContext && !state.isGenerating && state.documents[state.activeTab] && (
                            <div className="w-full max-w-3xl mt-4 rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle size={14} className="text-teal-400" />
                                    <span className="text-xs font-bold text-teal-300">
                                        Documents ready — submit your application
                                    </span>
                                </div>
                                <a
                                    href={applyContext.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider text-white mb-3 transition-opacity hover:opacity-80"
                                    style={{ background: getPlatformConfig(applyContext.sourcePlatform).color }}
                                >
                                    <ExternalLink size={11} />
                                    Apply on {getPlatformConfig(applyContext.sourcePlatform).label}
                                </a>
                                <ol className="space-y-1.5">
                                    {getApplyInstructions(applyContext.sourcePlatform).map((step, i) => (
                                        <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-teal-500 font-bold flex-shrink-0 w-3">{i + 1}.</span>
                                            {step}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {state.blueprint && !state.isGenerating && (
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ApplicationWorkspace.tsx
git commit -m "feat(workspace): add apply context banner and post-gen apply panel"
```

---

## Task 12: Update Tracker — Apply Link in Job Cards

**Files:**
- Modify: `src/components/tracker/types.ts`
- Modify: `src/components/tracker/JobCard.tsx`

- [ ] **Step 1: Add `sourceUrl` to `JobApplication` type**

In `src/components/tracker/types.ts`, update the `JobApplication` interface. After `notes: string | null;`, add:

```typescript
export interface JobApplication {
    id: string;
    title: string;
    company: string;
    description: string;
    status: ApplicationStatus;
    dateApplied: string | null;
    closingDate: string | null;
    notes: string | null;
    sourceUrl: string | null;   // ← add this line
    priority: JobPriority;
    documents: TrackerDocument[];
    createdAt: string;
    matchScore?: number;
    overallGrade?: string;
}
```

- [ ] **Step 2: Add apply link to tracker `JobCard.tsx`**

In `src/components/tracker/JobCard.tsx`, add `ExternalLink` to the lucide imports at the top (line 7 area):

```typescript
import {
    FileText,
    Clock,
    X,
    Trophy,
    Calendar,
    Copy,
    ChevronDown,
    ChevronUp,
    Bell,
    Trash2,
    Mail,
    Loader2,
    Sparkles,
    HelpCircle,
    ExternalLink,   // ← add this
} from 'lucide-react';
```

In the expanded card, after the documents section (after the closing `</div>` of the `{job.documents.length > 0 && (` block, around line 739), add:

```typescript
                            {/* Apply link */}
                            {job.sourceUrl && (
                                <div className="flex items-center gap-2">
                                    <a
                                        href={job.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-300 border border-slate-700/50 hover:border-slate-600 rounded-lg px-3 py-1.5 transition-colors"
                                    >
                                        <ExternalLink size={10} />
                                        View listing →
                                    </a>
                                </div>
                            )}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/tracker/types.ts src/components/tracker/JobCard.tsx
git commit -m "feat(tracker): add sourceUrl field and apply link to job cards"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Start dev servers**

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd E:\AntiGravity\JobHub && npm run dev
```

- [ ] **Step 2: Verify Seek scraper manually**

In the server terminal, trigger a manual feed rebuild for a test user via the existing refresh endpoint (requires auth token):

```bash
curl -X POST http://localhost:3001/api/job-feed/refresh \
  -H "Authorization: Bearer <your-token>"
```

Expected: `{ "ok": true }`. Check server logs for `[seekScraper] ✓ cluster ...` output.

- [ ] **Step 3: Verify the feed UI**

1. Open the app and navigate to Job Feed
2. Confirm listings appear from both Seek (`seek` badge) and Adzuna
3. Expand a Seek listing — verify the description is full (no truncation warning)
4. Confirm the action buttons show "Prepare & Apply →" and "View on Seek" text link (not the old dual-button layout)

- [ ] **Step 4: Verify the Apply flow**

1. Click "Prepare & Apply →" on any job card
2. Confirm you are navigated to the workspace (`/`)
3. Confirm the `ApplyContextBanner` appears at the top showing job title, company, platform badge, and "Apply on Seek" link
4. Generate a cover letter
5. Confirm the post-generation apply panel appears below the document with the platform button and step-by-step instructions

- [ ] **Step 5: Verify tracker apply link**

1. Click "Save" on any job card in the feed (this triggers the updated save route)
2. Navigate to Application Tracker
3. Expand the saved job card
4. Confirm "View listing →" link appears and opens the correct URL in a new tab

- [ ] **Step 6: Run full test suite**

```bash
cd server && npm test
```

Expected: all tests pass, including the new deduplicateJobs and seekScraper tests.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: Seek Apify unified job feed complete

- Apify scraper with cluster-based caching (SeekJobCache)
- Parallel cluster prewarm in daily cron
- Seek + Adzuna deduplication (Seek preferred)
- New Apply CTA: Prepare & Apply -> workspace
- ApplyContextBanner + post-generation apply panel
- Apply link in Application Tracker cards"
```

---

## Apify Actor Setup Checklist

Before running in production, the implementer **must** complete this checklist:

- [ ] Visit https://apify.com/store and search "seek australia jobs"
- [ ] Select the highest-rated, recently-updated actor
- [ ] Note the exact actor ID (format: `username/actor-name`)
- [ ] Update `SEEK_ACTOR_ID` in `server/src/services/seekScraper.ts`
- [ ] Check the actor's input schema tab and verify `keyword`, `location`, `maxItems` parameter names — update `buildActorInput()` if different
- [ ] Check the actor's output schema and verify field names (`title`, `company`, `location`, `salary`, `description`, `jobUrl`, `listingDate`) — update `mapActorResult()` if different
- [ ] Run a test scrape from the Apify console with a real search (e.g. `keyword: "Software Engineer"`, `location: "Melbourne"`, `maxItems: 5`) and inspect the output JSON
- [ ] Confirm `APIFY_API_KEY` is set in the server `.env` file

# Visa-Sponsor Jobs — Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic pipeline that scrapes Seek's sponsorship job slugs, classifies each job against the existing 4,058-row sponsor registry + phrase signals, and stores the visa-sponsor-likely ones in a new `SponsorJob` table, refreshable weekly.

**Architecture:** Three units — (A) ingestion reuses the existing Apify Seek scraper with sponsorship keyword queries; (B) a pure, testable classifier (`sponsorClassifier.ts`) does normalization + registry match + phrase scan → confidence tier; (C) an orchestrator + gated weekly cron + manual CLI store the results. No new LLM, no LinkedIn/Indeed, no UI.

**Tech Stack:** TypeScript, Prisma (PostgreSQL), Apify (`websift/seek-job-scraper`), node-cron, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-04-visa-sponsor-jobs-data-pipeline-design.md`

---

## ⚠️ INSTRUCTIONS FOR DEEPSEEK — READ BEFORE STARTING

This is a **zero-latitude** plan. You are a careful executor, not a designer.

1. **Do exactly what each step says.** Copy the code blocks verbatim. Do not "improve," rename, refactor, or add features not in the plan.
2. **Do the tasks in order.** Each task ends with passing tests/build + a commit. Do not start the next task until the current one is committed green.
3. **STOP-and-report (do not improvise) if any of these happen:**
   - A test fails for a reason the step did not predict.
   - A command errors (build, migrate, generate, run).
   - A file's existing contents don't match what a "Modify" step expects to find.
   - You feel tempted to add fuzzy/Levenshtein company matching, regex/proximity phrase logic, extra scan queries, LinkedIn/Indeed scraping, or to register the new cron in `index.ts`. **All of these are explicitly forbidden.** Report and wait.
   - The manual scan (Task 10) shows obvious classification mistakes. Report 5 examples; do not silently change the matching logic.
4. **Never** regenerate `server/data/sponsors_enriched.json`, never auto-enable `SPONSOR_SCAN_ENABLED`, never wire `startSponsorJobScanCron()` into the boot sequence.
5. After each task, run the exact verification command shown and confirm the expected output before committing.

All paths are relative to repo root `E:\AntiGravity\JobHub`. The server package lives in `server/`; run all `npm`/`npx` commands from inside `server/`.

---

## File Structure

**New files:**
- `server/src/config/sponsorPhrases.ts` — positive + negation phrase lists (tunable).
- `server/src/config/sponsorScan.ts` — Seek sponsorship queries + scan params.
- `server/src/services/sponsorClassifier.ts` — pure normalization + classify logic.
- `server/src/services/sponsorClassifier.test.ts` — unit tests for the above.
- `server/src/db/ensureSponsorJobTable.ts` — idempotent `CREATE TABLE IF NOT EXISTS` for `SponsorJob`.
- `server/src/services/sponsorScan.ts` — orchestrator (`runSponsorScan`).
- `server/src/scripts/run_sponsor_scan.ts` — manual CLI runner (no server boot).
- `server/src/cron/sponsorJobScanCron.ts` — weekly cron, gated + NOT registered.

**Modified files:**
- `server/prisma/schema.prisma` — add `SponsorJob` model.
- `server/src/services/seekScraper.ts` — add optional `opts` arg to `fetchSeekJobsForCluster`.
- `server/src/index.ts` — `SKIP_SERVER` guard around `app.listen`; call `ensureSponsorJobTable` inside `ensureColumns`.

---

## Task 1: Config files (phrases + scan queries)

**Files:**
- Create: `server/src/config/sponsorPhrases.ts`
- Create: `server/src/config/sponsorScan.ts`

- [ ] **Step 1: Create `server/src/config/sponsorPhrases.ts`**

```ts
// Phrase lists for visa-sponsorship detection. All lowercase; matched after the
// job description is normalized (lowercased, punctuation stripped) by the classifier.
// Tunable without code changes. NEGATION always wins over POSITIVE (see classifier).

export const POSITIVE_PHRASES = [
  'visa sponsorship available', 'sponsorship available', 'visa sponsorship offered',
  'visa sponsorship provided', 'willing to sponsor', 'will sponsor', 'we can sponsor',
  'able to sponsor', 'open to sponsorship', 'sponsorship provided', 'sponsorship considered',
  'sponsorship for the right candidate', '482 sponsorship', 'tss sponsorship',
  'skills in demand visa', 'employer sponsored', 'visa support', 'pr pathway',
];

export const NEGATION_PHRASES = [
  'no visa sponsorship', 'no sponsorship', 'not able to sponsor', 'unable to sponsor',
  'cannot sponsor', 'do not offer sponsorship', 'does not offer sponsorship',
  'no sponsorship available', 'sponsorship not available', 'no visa support',
  'must have full working rights', 'must have unrestricted work rights',
  'must hold a valid visa', 'permanent residents only', 'citizens only',
  'must be an australian citizen', 'must have permanent residency',
];
```

- [ ] **Step 2: Create `server/src/config/sponsorScan.ts`**

```ts
// Seek sponsorship keyword searches, broad → narrow. Each searchTerm reproduces a
// Seek /{slug}-jobs/in-All-Australia result set. Whole national pool ≈600–700 deduped
// (measured 2026-06-04), so this is cheap. The broad 'sponsorship' query over-captures
// noise (event/marketing sponsorship); the classifier filters it out.

export const SPONSOR_SCAN_QUERIES = [
  { searchTerm: 'sponsorship',          label: 'broad' }, // ~614 — widest net, noisy
  { searchTerm: 'visa sponsorship',     label: 'visa'  }, // ~345
  { searchTerm: '482 visa sponsorship', label: '482'   }, // ~126
  { searchTerm: '457 visa sponsorship', label: '457'   }, // legacy 457, low volume
];

export const SPONSOR_SCAN_LOCATION    = 'All Australia';
export const SPONSOR_SCAN_MAX_RESULTS = 700; // full live pool per query; tiny cost
export const SPONSOR_SCAN_DATE_RANGE  = 30;  // capture the full live set, not just last 7d
```

- [ ] **Step 3: Type-check**

Run (from `server/`): `npx tsc --noEmit`
Expected: no errors referencing the two new files.

- [ ] **Step 4: Commit**

```bash
git add server/src/config/sponsorPhrases.ts server/src/config/sponsorScan.ts
git commit -m "feat(sponsor-jobs): add phrase + scan-query config"
```

---

## Task 2: Classifier — text normalization (TDD)

**Files:**
- Create: `server/src/services/sponsorClassifier.ts`
- Create: `server/src/services/sponsorClassifier.test.ts`

- [ ] **Step 1: Write the failing test** — create `server/src/services/sponsorClassifier.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeCompany } from './sponsorClassifier';

describe('normalizeText', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeText('Visa  Sponsorship-Available!')).toBe('visa sponsorship available');
  });
});

describe('normalizeCompany', () => {
  it('strips legal-entity suffix tokens', () => {
    expect(normalizeCompany('Acme Pty Ltd')).toBe('acme');
    expect(normalizeCompany('Globex Corporation')).toBe('globex');
  });
  it('keeps descriptive words (no over-stripping)', () => {
    expect(normalizeCompany('Sydney Water Group')).toBe('sydney water group');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `server/`): `npx vitest run src/services/sponsorClassifier.test.ts`
Expected: FAIL — `normalizeText`/`normalizeCompany` not exported (module not found / no export).

- [ ] **Step 3: Write minimal implementation** — create `server/src/services/sponsorClassifier.ts`

```ts
// Pure, deterministic visa-sponsorship classification. No LLM, no network, no prisma.

// Legal-entity suffix tokens stripped from BOTH job company names and registry names
// so "Acme Pty Ltd" matches registry "Acme". Conservative on purpose — descriptive
// words (Group, Services, Australia) are kept to avoid false-positive merges.
const LEGAL_SUFFIX_TOKENS = new Set([
  'pty', 'ltd', 'limited', 'inc', 'incorporated', 'llc', 'llp', 'co', 'corp', 'corporation',
]);

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCompany(input: string): string {
  const tokens = normalizeText(input).split(' ').filter(Boolean);
  return tokens.filter(t => !LEGAL_SUFFIX_TOKENS.has(t)).join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/sponsorClassifier.test.ts`
Expected: PASS (4 assertions).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/sponsorClassifier.ts server/src/services/sponsorClassifier.test.ts
git commit -m "feat(sponsor-jobs): classifier text + company normalization"
```

---

## Task 3: Classifier — registry index + classifyJob (TDD)

**Files:**
- Modify: `server/src/services/sponsorClassifier.ts`
- Modify: `server/src/services/sponsorClassifier.test.ts`

- [ ] **Step 1: Add the failing tests** — append to `server/src/services/sponsorClassifier.test.ts`

```ts
import { buildSponsorIndex, classifyJob } from './sponsorClassifier';
import type { RawJob } from './jobFeed';

const PHRASES = {
  positive: ['visa sponsorship available', 'sponsorship available', 'willing to sponsor'],
  negation: ['no sponsorship', 'no sponsorship available', 'must have full working rights'],
};

function job(partial: Partial<RawJob>): RawJob {
  return {
    title: 'Engineer', company: 'Acme Pty Ltd', location: 'Sydney NSW',
    salary: null, description: '', sourceUrl: 'https://au.seek.com/job/1',
    sourcePlatform: 'seek', postedAt: null, ...partial,
  };
}

describe('buildSponsorIndex', () => {
  it('maps normalized company name to original cleanName', () => {
    const idx = buildSponsorIndex(['Acme', 'Globex']);
    expect(idx.get('acme')).toBe('Acme');
  });
});

describe('classifyJob', () => {
  const idx = buildSponsorIndex(['Acme', 'Globex']);

  it('confirmed: registry employer + positive phrase, no negation', () => {
    const r = classifyJob(job({ company: 'Acme Pty Ltd', description: 'Visa sponsorship available for this role.' }), idx, PHRASES);
    expect(r.confidence).toBe('confirmed');
    expect(r.employerMatched).toBe(true);
    expect(r.sponsorCleanName).toBe('Acme');
  });

  it('likely: registry employer, no phrase, no negation', () => {
    const r = classifyJob(job({ company: 'Globex Pty Ltd', description: 'Great team, flexible hours.' }), idx, PHRASES);
    expect(r.confidence).toBe('likely');
  });

  it('keyword_only: not in registry, positive phrase present', () => {
    const r = classifyJob(job({ company: 'Unknown Co', description: 'We are willing to sponsor the right person.' }), idx, PHRASES);
    expect(r.confidence).toBe('keyword_only');
    expect(r.employerMatched).toBe(false);
  });

  it('excluded: negation wins even when employer is a registered sponsor', () => {
    const r = classifyJob(job({ company: 'Acme Pty Ltd', description: 'Sponsorship available? No — must have full working rights.' }), idx, PHRASES);
    expect(r.confidence).toBe('excluded');
    expect(r.negationPhraseHit).toBe(true);
  });

  it('none: not in registry, no phrases', () => {
    const r = classifyJob(job({ company: 'Unknown Co', description: 'Standard role, apply within.' }), idx, PHRASES);
    expect(r.confidence).toBe('none');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/services/sponsorClassifier.test.ts`
Expected: FAIL — `buildSponsorIndex` / `classifyJob` not exported.

- [ ] **Step 3: Implement** — append to `server/src/services/sponsorClassifier.ts`

```ts
import type { RawJob } from './jobFeed';

export type SponsorIndex = Map<string, string>; // normalizedCompany -> original cleanName

export type SponsorConfidence =
  | 'confirmed' | 'likely' | 'keyword_only' | 'excluded' | 'none';

export interface PhraseConfig {
  positive: string[];
  negation: string[];
}

export interface SponsorClassification {
  confidence: SponsorConfidence;
  employerMatched: boolean;
  sponsorCleanName: string | null;
  normalizedCompany: string;
  positivePhraseHit: boolean;
  negationPhraseHit: boolean;
  matchedPhrases: string[];
}

export function buildSponsorIndex(cleanNames: string[]): SponsorIndex {
  const idx: SponsorIndex = new Map();
  for (const name of cleanNames) {
    const norm = normalizeCompany(name);
    if (norm && !idx.has(norm)) idx.set(norm, name);
  }
  return idx;
}

export function classifyJob(
  job: RawJob,
  index: SponsorIndex,
  phrases: PhraseConfig,
): SponsorClassification {
  const normalizedCompany = normalizeCompany(job.company);
  const sponsorCleanName = index.get(normalizedCompany) ?? null;
  const employerMatched = sponsorCleanName !== null;

  const normDesc = normalizeText(job.description);
  const matchedNeg = phrases.negation.filter(p => normDesc.includes(normalizeText(p)));
  const matchedPos = phrases.positive.filter(p => normDesc.includes(normalizeText(p)));
  const negationPhraseHit = matchedNeg.length > 0;
  const positivePhraseHit = matchedPos.length > 0;

  let confidence: SponsorConfidence;
  if (negationPhraseHit) confidence = 'excluded';
  else if (employerMatched && positivePhraseHit) confidence = 'confirmed';
  else if (employerMatched) confidence = 'likely';
  else if (positivePhraseHit) confidence = 'keyword_only';
  else confidence = 'none';

  return {
    confidence,
    employerMatched,
    sponsorCleanName,
    normalizedCompany,
    positivePhraseHit,
    negationPhraseHit,
    matchedPhrases: [...matchedPos, ...matchedNeg],
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/services/sponsorClassifier.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/sponsorClassifier.ts server/src/services/sponsorClassifier.test.ts
git commit -m "feat(sponsor-jobs): registry index + classifyJob with negation precedence"
```

---

## Task 4: Add `opts` to `fetchSeekJobsForCluster` (reuse for high-volume sponsor sweep)

**Files:**
- Modify: `server/src/services/seekScraper.ts:73` (function signature) and `:99-105` (actor input)

- [ ] **Step 1: Modify the function signature** — in `server/src/services/seekScraper.ts`, replace:

```ts
export async function fetchSeekJobsForCluster(cluster: ClusterKey): Promise<RawJob[]> {
```

with:

```ts
export async function fetchSeekJobsForCluster(
  cluster: ClusterKey,
  opts?: { maxResults?: number; dateRange?: number },
): Promise<RawJob[]> {
```

- [ ] **Step 2: Modify the actor input** — in the same file, replace:

```ts
      {
        searchTerm: cluster.role,
        location: cluster.city,
        maxResults: 30,
        sortBy: 'date',
        dateRange: 7,
      },
```

with:

```ts
      {
        searchTerm: cluster.role,
        location: cluster.city,
        maxResults: opts?.maxResults ?? 30,
        sortBy: 'date',
        dateRange: opts?.dateRange ?? 7,
      },
```

- [ ] **Step 3: Verify the per-user feed is unchanged + it compiles**

Run (from `server/`): `npx tsc --noEmit`
Expected: no errors. (The `opts` arg is optional and defaults to the previous `30` / `7`, so existing callers like `prewarmSeekClusters` are unaffected. No behaviour change without an explicit opts arg — that is why no new unit test is added here.)

- [ ] **Step 4: Commit**

```bash
git add server/src/services/seekScraper.ts
git commit -m "feat(sponsor-jobs): optional maxResults/dateRange on fetchSeekJobsForCluster"
```

---

## Task 5: `SponsorJob` model + idempotent table guard

**Files:**
- Modify: `server/prisma/schema.prisma` (add model)
- Create: `server/src/db/ensureSponsorJobTable.ts`
- Modify: `server/src/index.ts` (call guard inside `ensureColumns`)

- [ ] **Step 1: Add the model** — append to `server/prisma/schema.prisma`

```prisma
model SponsorJob {
  id                String   @id @default(uuid())
  sourceUrl         String   @unique
  title             String
  company           String
  normalizedCompany String
  location          String?
  salary            String?
  description       String
  sourcePlatform    String
  postedAt          DateTime?
  confidence        String
  employerMatched   Boolean
  sponsorCleanName  String?
  positivePhraseHit Boolean
  negationPhraseHit Boolean
  matchedPhrases    Json?
  scanQuery         String
  firstSeenAt       DateTime @default(now())
  lastSeenAt        DateTime @updatedAt
  feedDate          String

  @@index([confidence])
  @@index([normalizedCompany])
  @@index([feedDate])
}
```

- [ ] **Step 2: Regenerate the Prisma client** (no DB connection required)

Run (from `server/`): `npx prisma generate`
Expected: "Generated Prisma Client" success. (If it errors on schema syntax, STOP and report.)

- [ ] **Step 3: Create the idempotent table guard** — `server/src/db/ensureSponsorJobTable.ts`

```ts
import type { PrismaClient } from '@prisma/client';

// Idempotent CREATE TABLE for SponsorJob, mirroring the repo's ensureColumns() boot
// pattern (raw SQL, IF NOT EXISTS) so the table exists even when prisma migrate is
// skipped in some environments. Safe to call repeatedly.
export async function ensureSponsorJobTable(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SponsorJob" (
      "id" TEXT PRIMARY KEY,
      "sourceUrl" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "company" TEXT NOT NULL,
      "normalizedCompany" TEXT NOT NULL,
      "location" TEXT,
      "salary" TEXT,
      "description" TEXT NOT NULL,
      "sourcePlatform" TEXT NOT NULL,
      "postedAt" TIMESTAMP(3),
      "confidence" TEXT NOT NULL,
      "employerMatched" BOOLEAN NOT NULL,
      "sponsorCleanName" TEXT,
      "positivePhraseHit" BOOLEAN NOT NULL,
      "negationPhraseHit" BOOLEAN NOT NULL,
      "matchedPhrases" JSONB,
      "scanQuery" TEXT NOT NULL,
      "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "feedDate" TEXT NOT NULL
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SponsorJob_sourceUrl_key" ON "SponsorJob"("sourceUrl");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SponsorJob_confidence_idx" ON "SponsorJob"("confidence");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SponsorJob_normalizedCompany_idx" ON "SponsorJob"("normalizedCompany");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SponsorJob_feedDate_idx" ON "SponsorJob"("feedDate");`);
}
```

- [ ] **Step 4: Wire the guard into `ensureColumns`** — in `server/src/index.ts`, add this import near the other top-of-file imports:

```ts
import { ensureSponsorJobTable } from './db/ensureSponsorJobTable';
```

Then, inside the `ensureColumns()` function `try { ... }` block, immediately **before** its closing `}` of the `try` (after the last existing `$executeRawUnsafe` statement), add:

```ts
    await ensureSponsorJobTable(prisma);
```

- [ ] **Step 5: Verify build**

Run (from `server/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add server/prisma/schema.prisma server/src/db/ensureSponsorJobTable.ts server/src/index.ts
git commit -m "feat(sponsor-jobs): SponsorJob model + idempotent table guard in ensureColumns"
```

---

## Task 6: `SKIP_SERVER` guard so the CLI can run without booting the server

**Files:**
- Modify: `server/src/index.ts:309-320` (`app.listen` block)

- [ ] **Step 1: Wrap `app.listen`** — in `server/src/index.ts`, replace the entire block:

```ts
app.listen(PORT, async () => {
    console.log(`Job Ready Backend running on http://localhost:${PORT}`);
    await ensureColumns();
    await ensureSponsorsSeeded();
    await loadSponsorFilterCache();
    startJobFeedCron();
    startTrialReminderCron();
    startFollowUpReminderCron();
    console.log('[cron] Job feed cron scheduled (21:00 UTC daily)');
    console.log('[cron] Trial reminder cron scheduled (10:00 UTC daily)');
    console.log('[cron] Follow-up reminder cron scheduled (09:00 UTC daily)');
});
```

with:

```ts
if (process.env.SKIP_SERVER === 'true') {
  console.log('[index] SKIP_SERVER=true — script mode, HTTP server not started.');
} else {
  app.listen(PORT, async () => {
      console.log(`Job Ready Backend running on http://localhost:${PORT}`);
      await ensureColumns();
      await ensureSponsorsSeeded();
      await loadSponsorFilterCache();
      startJobFeedCron();
      startTrialReminderCron();
      startFollowUpReminderCron();
      console.log('[cron] Job feed cron scheduled (21:00 UTC daily)');
      console.log('[cron] Trial reminder cron scheduled (10:00 UTC daily)');
      console.log('[cron] Follow-up reminder cron scheduled (09:00 UTC daily)');
  });
}
```

- [ ] **Step 2: Verify the normal server still starts** (from `server/`)

Run: `npx tsc --noEmit`
Expected: no errors.
Then sanity-check the guard does NOT trip in normal mode: confirm `SKIP_SERVER` is unset in your shell (`echo $env:SKIP_SERVER` on PowerShell → blank). Do not start the full server here.

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(sponsor-jobs): SKIP_SERVER guard to allow CLI scripts to import services"
```

---

## Task 7: Scan orchestrator (`runSponsorScan`)

**Files:**
- Create: `server/src/services/sponsorScan.ts`

- [ ] **Step 1: Create `server/src/services/sponsorScan.ts`**

```ts
import { prisma } from '../index';
import type { RawJob } from './jobFeed';
import { buildSeekClusterKey, fetchSeekJobsForCluster } from './seekScraper';
import { buildSponsorIndex, classifyJob } from './sponsorClassifier';
import { ensureSponsorJobTable } from '../db/ensureSponsorJobTable';
import { POSITIVE_PHRASES, NEGATION_PHRASES } from '../config/sponsorPhrases';
import {
  SPONSOR_SCAN_QUERIES,
  SPONSOR_SCAN_LOCATION,
  SPONSOR_SCAN_MAX_RESULTS,
  SPONSOR_SCAN_DATE_RANGE,
} from '../config/sponsorScan';

export interface ScanSummary {
  ingested: number;
  deduped: number;
  confirmed: number;
  likely: number;
  keyword_only: number;
  excluded: number;
  none: number;
  stored: number;
}

function feedDateAU(): string {
  const s = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [day, month, year] = s.split('/');
  return `${year}-${month}-${day}`;
}

export async function runSponsorScan(opts?: { onlyQuery?: string }): Promise<ScanSummary> {
  await ensureSponsorJobTable(prisma);

  // STOP guard: registry must be seeded (ensureSponsorsSeeded runs at app boot).
  const sponsors = await prisma.sponsor.findMany({ select: { cleanName: true } });
  if (sponsors.length < 1000) {
    throw new Error(
      `[sponsorScan] STOP: Sponsor table has ${sponsors.length} rows (<1000). ` +
      `Seed the sponsor registry (start the app once so ensureSponsorsSeeded runs) before scanning.`,
    );
  }
  const index = buildSponsorIndex(sponsors.map(s => s.cleanName));
  const phrases = { positive: POSITIVE_PHRASES, negation: NEGATION_PHRASES };

  const queries = SPONSOR_SCAN_QUERIES.filter(q => !opts?.onlyQuery || q.label === opts.onlyQuery);
  if (queries.length === 0) {
    throw new Error(`[sponsorScan] STOP: --only-query "${opts?.onlyQuery}" matched no SPONSOR_SCAN_QUERIES label.`);
  }

  // Ingest + dedupe across queries by sourceUrl (first query that surfaces a URL wins).
  const bySourceUrl = new Map<string, { job: RawJob; scanQuery: string }>();
  let ingested = 0;
  for (const q of queries) {
    const key = buildSeekClusterKey(q.searchTerm, SPONSOR_SCAN_LOCATION, null);
    const jobs = await fetchSeekJobsForCluster(key, {
      maxResults: SPONSOR_SCAN_MAX_RESULTS,
      dateRange: SPONSOR_SCAN_DATE_RANGE,
    });
    ingested += jobs.length;
    for (const job of jobs) {
      if (job.sourceUrl && !bySourceUrl.has(job.sourceUrl)) {
        bySourceUrl.set(job.sourceUrl, { job, scanQuery: q.searchTerm });
      }
    }
  }

  const summary: ScanSummary = {
    ingested, deduped: bySourceUrl.size,
    confirmed: 0, likely: 0, keyword_only: 0, excluded: 0, none: 0, stored: 0,
  };
  const feedDate = feedDateAU();

  for (const { job, scanQuery } of bySourceUrl.values()) {
    const c = classifyJob(job, index, phrases);
    summary[c.confidence] += 1;

    if (c.confidence === 'confirmed' || c.confidence === 'likely' || c.confidence === 'keyword_only') {
      await prisma.sponsorJob.upsert({
        where: { sourceUrl: job.sourceUrl },
        create: {
          sourceUrl: job.sourceUrl,
          title: job.title,
          company: job.company,
          normalizedCompany: c.normalizedCompany,
          location: job.location ?? null,
          salary: job.salary ?? null,
          description: job.description,
          sourcePlatform: job.sourcePlatform,
          postedAt: job.postedAt ?? null,
          confidence: c.confidence,
          employerMatched: c.employerMatched,
          sponsorCleanName: c.sponsorCleanName,
          positivePhraseHit: c.positivePhraseHit,
          negationPhraseHit: c.negationPhraseHit,
          matchedPhrases: c.matchedPhrases,
          scanQuery,
          feedDate,
        },
        update: {
          confidence: c.confidence,
          employerMatched: c.employerMatched,
          sponsorCleanName: c.sponsorCleanName,
          positivePhraseHit: c.positivePhraseHit,
          negationPhraseHit: c.negationPhraseHit,
          matchedPhrases: c.matchedPhrases,
          feedDate,
          // lastSeenAt auto-updates via @updatedAt
        },
      });
      summary.stored += 1;
    }
  }

  return summary;
}
```

- [ ] **Step 2: Verify build**

Run (from `server/`): `npx tsc --noEmit`
Expected: no errors. (If `prisma.sponsorJob` is not a known property, you skipped `npx prisma generate` in Task 5 Step 2 — run it, do not edit types by hand.)

- [ ] **Step 3: Commit**

```bash
git add server/src/services/sponsorScan.ts
git commit -m "feat(sponsor-jobs): runSponsorScan orchestrator (ingest → dedupe → classify → upsert)"
```

---

## Task 8: Manual CLI runner

**Files:**
- Create: `server/src/scripts/run_sponsor_scan.ts`

- [ ] **Step 1: Create `server/src/scripts/run_sponsor_scan.ts`**

```ts
/**
 * Manual visa-sponsor jobs scan. Runs WITHOUT booting the HTTP server.
 *   npx tsx src/scripts/run_sponsor_scan.ts                  # all queries
 *   npx tsx src/scripts/run_sponsor_scan.ts --only-query broad
 *
 * SKIP_SERVER is set BEFORE importing the service graph so that importing
 * index.ts (transitively, via seekScraper) does not call app.listen().
 */
process.env.SKIP_SERVER = 'true';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const i = args.indexOf('--only-query');
  const onlyQuery = i >= 0 ? args[i + 1] : undefined;

  const { runSponsorScan } = await import('../services/sponsorScan');
  const summary = await runSponsorScan({ onlyQuery });
  console.log('[run_sponsor_scan] summary:', JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('[run_sponsor_scan] FAILED:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify build**

Run (from `server/`): `npx tsc --noEmit`
Expected: no errors. (Do NOT run the script yet — that happens in Task 10 with the STOP guard.)

- [ ] **Step 3: Commit**

```bash
git add server/src/scripts/run_sponsor_scan.ts
git commit -m "feat(sponsor-jobs): manual run_sponsor_scan CLI (SKIP_SERVER, no boot)"
```

---

## Task 9: Weekly cron (gated + NOT registered)

**Files:**
- Create: `server/src/cron/sponsorJobScanCron.ts`

- [ ] **Step 1: Create `server/src/cron/sponsorJobScanCron.ts`**

```ts
import cron from 'node-cron';
import { runSponsorScan } from '../services/sponsorScan';

let started = false;

/**
 * Weekly visa-sponsor jobs scan. GATED and intentionally NOT wired into the app
 * boot sequence (see spec guard D). To activate, an operator must BOTH:
 *   1. set env SPONSOR_SCAN_ENABLED=true
 *   2. call startSponsorJobScanCron() from index.ts app.listen callback
 * Until then this is dormant.
 */
export function startSponsorJobScanCron(): void {
  if (started) return;
  if (process.env.SPONSOR_SCAN_ENABLED !== 'true') {
    console.log('[sponsorJobScanCron] SPONSOR_SCAN_ENABLED != true — not scheduling.');
    return;
  }
  started = true;

  // Mondays 20:00 UTC (~Tue 06:00–07:00 AEST)
  cron.schedule('0 20 * * 1', async () => {
    console.log('[sponsorJobScanCron] Starting weekly sponsor jobs scan');
    try {
      const summary = await runSponsorScan();
      console.log('[sponsorJobScanCron] Done:', JSON.stringify(summary));
    } catch (err) {
      console.error('[sponsorJobScanCron] Scan failed:', err);
    }
  });
  console.log('[sponsorJobScanCron] Weekly sponsor scan scheduled (20:00 UTC Mondays)');
}
```

- [ ] **Step 2: Verify build + confirm it is NOT registered**

Run (from `server/`): `npx tsc --noEmit`
Expected: no errors.
Then confirm `startSponsorJobScanCron` does **not** appear anywhere in `server/src/index.ts` (it must stay unwired). If it does, remove that registration — leaving it dormant is required.

- [ ] **Step 3: Commit**

```bash
git add server/src/cron/sponsorJobScanCron.ts
git commit -m "feat(sponsor-jobs): dormant weekly scan cron (gated, unregistered)"
```

---

## Task 10: Acceptance — single-query manual run (STOP-and-report gate)

**Files:** none (verification only)

- [ ] **Step 1: Ensure the registry + table exist.** Confirm a `.env` with `DATABASE_URL` and `APIFY_API_KEY` is present in `server/`. If you are unsure whether the `Sponsor` table is seeded, the scan's own guard will tell you (it STOPs if <1000 rows). Do not seed manually.

- [ ] **Step 2: Run ONLY the broad query first** (from `server/`)

Run: `npx tsx src/scripts/run_sponsor_scan.ts --only-query broad`
Expected: a summary JSON like
```
{ "ingested": <~hundreds>, "deduped": <≤ingested>, "confirmed": <n>, "likely": <n>, "keyword_only": <n>, "excluded": <n>, "none": <n>, "stored": <confirmed+likely+keyword_only> }
```
**STOP-and-report if:** the script throws the registry guard (<1000 sponsors), Apify returns 0 jobs, or `stored` is 0. Report the full output; do not change classifier logic.

- [ ] **Step 3: Eyeball the results.** Query a few stored rows and confirm they look like genuine sponsorship jobs:

Run (from `server/`):
```bash
npx tsx -e "import('@prisma/client').then(async ({PrismaClient})=>{const p=new PrismaClient();const rows=await p.sponsorJob.findMany({take:8,orderBy:{lastSeenAt:'desc'},select:{company:true,title:true,confidence:true,matchedPhrases:true}});console.log(JSON.stringify(rows,null,2));await p.$disconnect();})"
```
Expected: 8 rows; `confidence` values in {confirmed, likely, keyword_only}; `matchedPhrases` plausible.
**STOP-and-report if** you see ≥3 obvious false positives (e.g. "Sponsorship Coordinator" marketing roles) or false negatives — report 5 examples with suggested phrase edits. Do not edit phrase lists unilaterally.

- [ ] **Step 4: Confirm idempotent re-run (no duplicates).** Re-run the same command:

Run: `npx tsx src/scripts/run_sponsor_scan.ts --only-query broad`
Then count rows:
```bash
npx tsx -e "import('@prisma/client').then(async ({PrismaClient})=>{const p=new PrismaClient();console.log('rows:',await p.sponsorJob.count());await p.$disconnect();})"
```
Expected: row count is the same order as after the first run (updated in place, not doubled). `stored` in the second run's summary equals the first.
**STOP-and-report if** the row count roughly doubled (dedupe/upsert is broken).

- [ ] **Step 5: Final full-suite check + report**

Run (from `server/`): `npx vitest run`
Expected: all tests pass (including the classifier suite).
Then report to the human: the Task 10 Step 2 summary, the Step 3 sample, and the Step 4 counts. **Do not run all four queries or enable the cron** — that is the human's call after reviewing.

---

## Self-Review (done by plan author)

**Spec coverage:**
- §3 reuse registry/scraper/cron → Tasks 4, 5, 7. ✓
- §4 Unit A keyword-slug ingestion + opts param + guard B (broad query first) → Task 4, Task 7, Task 10 Step 2. ✓
- §4 Unit B classifier (normalization, signals, confidence table, negation-wins, no fuzzy) → Tasks 2, 3 + forbidden-list in DeepSeek instructions. ✓
- §4 Unit C store + weekly cron gated/unregistered + run script → Tasks 5, 8, 9 + guard D enforced in Task 9 Step 2. ✓
- §5 SponsorJob model (incl. scanQuery rename, dedupe on sourceUrl) → Task 5 + Task 7 upsert. ✓
- §6 config files → Task 1. ✓
- §7 weekly schedule → Task 9. ✓
- §8 acceptance criteria 1–5 → Tasks 2/3 (unit tests), Task 10 (manual run, idempotency, dormant cron). ✓
- §3 guard A (registry ≥1000) → Task 7 STOP guard. ✓
- §4 guard C (no fuzzy) / guard E (no silent heuristic changes) → DeepSeek instructions + Task 10 Step 3. ✓

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `RawJob` (from `jobFeed`), `SponsorClassification.normalizedCompany` (defined Task 3, consumed Task 7), `ScanSummary` keys match the `SponsorConfidence` union used to index `summary[c.confidence]`, `fetchSeekJobsForCluster(cluster, opts)` signature matches Task 7's call site, `ensureSponsorJobTable(prisma)` signature matches both call sites (Task 5 index.ts, Task 7). ✓

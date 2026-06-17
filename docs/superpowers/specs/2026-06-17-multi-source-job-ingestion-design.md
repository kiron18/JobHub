# Multi-Source Job Ingestion — Data Pipeline (Design Spec)

**Date:** 2026-06-17
**Status:** Approved — ready for implementation plan
**Executor:** Kimi (zero-latitude plan, STOP-and-report guards throughout)
**Scope of THIS build:** *Per-user job acquisition.* Make the "3 ideal jobs at the CV-scan moment" flow pull stable, high-quality jobs from multiple sources (Adzuna API + JSearch API + Firecrawl-scraped SEEK), deduplicated, relevance-scored, with full descriptions fetched lazily on click. Reuse existing code. Minimal admin observability page. No funnel, no monetization, no UI rebuild.

---

## 1. Why this build exists + current state

The per-user flow **already exists**: `scrapeJobsForTitles(titles, location)` (`server/src/services/userJobScrape.ts`) takes the 3 LLM-inferred job titles + location and returns `RawJob[]` to warm the dashboard. Today it pulls **SEEK only, via the Apify `websift/seek-job-scraper`**, which returned poor/off-target results in production. A self-built `seekHtmlScraper.ts` got blocked. `deduplicateJobs(scraped, adzuna)` (`server/src/utils/deduplicateJobs.ts`) is already built to merge scraped + Adzuna jobs, but Adzuna was never finished ("Phase 0.3").

**Proven live 2026-06-17:**
- Firecrawl scrapes SEEK search pages without being blocked — ~30 structured jobs/page, ~1 credit/page.
- A SEEK job detail page scrapes to the **full description (1,438 words)** vs the ~30-word card teaser → lazy hydration on click works.
- **API reality (verified):** only **Adzuna** offers an open AU job-search API. Indeed's search API is deprecated (posting-only survives), Jora has none, LinkedIn has none + is hostile to scraping. **JSearch** (RapidAPI, backed by Google for Jobs) is an aggregator API that legally covers Indeed + LinkedIn + the long tail in one call, with full descriptions in-response.

This build swaps the acquisition engine and finishes the multi-source merge. **Everything downstream — `sponsorClassifier.ts`, `SponsorJob`, the weekly sponsor scan — is unchanged and out of scope; it keeps consuming `RawJob[]`.**

---

## 2. What already exists — REUSE, do not rebuild

| Asset | Path | Use |
|---|---|---|
| `RawJob` type | `server/src/services/jobFeed.ts` | `{ title, company, location, salary, description, sourceUrl, sourcePlatform, postedAt }`. Every adapter emits exactly this. |
| Per-user entry point | `server/src/services/userJobScrape.ts` → `scrapeJobsForTitles(titles, location)` | **Extend this** to fan out across all adapters. Keep its signature so callers don't change. |
| Dedup util | `server/src/utils/deduplicateJobs.ts` | URL-exact + fuzzy (Levenshtein ≤0.15 on title+company+location). **Generalize** from `(scraped, adzuna)` to N source arrays; reuse its `normalise`/`isSimilar` logic, do not write a second matcher. |
| Sponsor classifier | `server/src/services/sponsorClassifier.ts` | Downstream consumer. **Do not touch.** |
| Apify SEEK scraper | `server/src/services/seekScraper.ts` | Being replaced by the Firecrawl SEEK adapter. **Do NOT delete** (guard G). |
| Blocked HTML scraper | `server/src/services/seekHtmlScraper.ts` | Dead. Do not extend; report callers (guard G). |
| Cron pattern | `server/src/cron/jobFeedCron.ts` | Copy structure if an optional warm-cron is added. |
| Admin route pattern | `server/src/routes/admin-funnel.ts` | Copy auth/shape for the observability endpoint. |
| Firecrawl CLI | skill `firecrawl-scrape` (`firecrawl scrape "<url>" --only-main-content`) | SEEK search-page + detail-page scraping. 1 credit/page. |

**STOP-and-report guard A:** If the real `RawJob` shape differs from the table above, STOP and report it before writing adapters. Conform to the real type.

---

## 3. Source stack (locked)

| Lane | Source | Mechanism | Role |
|---|---|---|---|
| API | **Adzuna** | Official AU API, free. Keys `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` (env). | Reliable backbone; survives even if scrapers die. |
| API | **JSearch** | RapidAPI / Google for Jobs, ~$25 USD/mo. Key `JSEARCH_API_KEY` (env). | Covers Indeed + LinkedIn + long tail, full JDs in-response. |
| Scrape | **SEEK** | Firecrawl on search pages + Haiku parse. | The one board no API reaches. |

No direct Indeed/LinkedIn/Jora scraping (no API, hostile, ToS risk — covered by JSearch instead).

**STOP-and-report guard B (key check):** If `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` or `JSEARCH_API_KEY` are missing from env, build the adapter but STOP and report that the user must supply the key before a live run. Do not hardcode keys.

---

## 4. Architecture — adapters → merge → score → store, with lazy hydration

```
 scrapeJobsForTitles(titles, location)              ← existing entry point, extended
        │  (per title, in parallel)
        ▼
 ┌─────────────┬──────────────┬───────────────┐
 │ AdzunaAdapter│ JSearchAdapter│  SeekAdapter  │     each: search(query) → { jobs: RawJob[], report }
 │   (API)      │    (API)      │ (Firecrawl+   │     SeekAdapter pages search results, Haiku-parses md
 │              │               │  Haiku parse) │
 └──────┬───────┴───────┬───────┴───────┬───────┘
        └───────RawJob[]─┴───────────────┘
                         ▼
              mergeSources([...])  ← generalized deduplicateJobs: URL-exact + fuzzy → Job + JobSource[]
                         ▼
              relevanceScore(job, role)  ← deterministic token overlap; flag lowRelevance
                         ▼
              persist Job/JobSource + write IngestionRun/SourceResult  (observability)
                         ▼
              return top jobs to caller (dashboard warm)   |   hydrateJobDescription(jobId) on click
```

### Unit 1 — Source Adapters
`server/src/services/ingestion/adapters/{adzuna,jsearch,seek}.ts`. One contract:

```ts
interface SourceAdapter {
  readonly source: 'adzuna' | 'jsearch' | 'seek';
  search(query: { role: string; location: string; maxPages: number }): Promise<{
    jobs: RawJob[];
    report: { source: string; rawCount: number; blocked: boolean;
              errorMessage: string | null; latencyMs: number; creditsUsed: number };
  }>;
}
```
- **Adzuna / JSearch:** HTTP call → map JSON to `RawJob`. Full `description` usually present in-response → these jobs ship `descriptionHydrated = true` and skip the hydration scrape.
- **SEEK:** build search URL from role + location (`SEEK_SEARCH_MODE` keyword preferred for precision), Firecrawl-scrape page 1..`maxPages`, pass each page's markdown to the Parser (Unit 2). `blocked = true` if no job-detail links found. SEEK jobs ship `descriptionHydrated = false`.

**STOP-and-report guard C:** SEEK is proven; Adzuna/JSearch are unproven against your account. Run ONE live call per API adapter first and report a 3-row sample + raw count before wiring them into the merge. If a JSON shape doesn't map cleanly to `RawJob`, STOP and report the actual response shape.

### Unit 2 — SEEK Parser (markdown → RawJob[])
`server/src/services/ingestion/parseSeekMarkdown.ts`. One **Haiku** pass per scraped search page → `RawJob[]`. Chosen over brittle regex and over Firecrawl's 5×-credit JSON extract (keeps SEEK at 1 credit/page, layout-robust).
- **The Haiku prompt is owned by Claude, lives in `server/src/services/ingestion/prompts/parseSeekPrompt.ts` as a locked constant, and Kimi transcribes it verbatim — does not rewrite it.** Rules: extract only jobs present, never invent, null unknown fields, preserve the numeric job ID into `sourceUrl`, no markdown in output.
- Card `description` is the teaser; full JD comes from hydration (Unit 5).

**STOP-and-report guard D (parse coverage):** After parsing one real SEEK page, report `parsedJobs / jobDetailLinksOnPage`. If < 80%, STOP and report sample misses — do not loosen the schema to fake coverage.

### Unit 3 — Merge / Dedup
`server/src/services/ingestion/mergeSources.ts`. **Generalize the existing `deduplicateJobs`** to accept N labelled source arrays and emit canonical `Job` rows each carrying a `JobSource[]` (one per board it appeared on). Reuse its `normalise` + `isSimilar` (URL-exact, then fuzzy title+company+location). Overlap is recorded as data, never silently dropped.

**STOP-and-report guard E:** Reuse the existing fuzzy thresholds (Levenshtein ≤0.15). Do NOT invent a new matching algorithm. If overlap stats look wrong on real data, report them; don't retune unilaterally.

### Unit 4 — Relevance Scorer
`server/src/services/ingestion/relevance.ts`. Pure, deterministic. Token-overlap of `Job.title` vs the originating `role` → `relevanceScore` (0–1). Below `RELEVANCE_THRESHOLD` (default 0.34) → store but flag `lowRelevance = true` so the dashboard can exclude without losing data. This fixes the "Content Producer when you searched Marketing Coordinator" problem at the display layer, source-agnostically.

**STOP-and-report guard F:** Report the score distribution on one real run before the threshold is trusted; don't tune blind.

### Unit 5 — Store + Lazy Hydration
- Persist canonical `Job` + `JobSource` (§5). Upsert on `dedupKey`; re-runs update `lastSeenAt`, `relevanceScore`, merge new `JobSource`.
- `hydrateJobDescription(jobId)` (`server/src/services/ingestion/hydrate.ts`): if `descriptionHydrated`, no-op; else Firecrawl-scrape the SEEK `sourceUrl` detail page → fill full `description`, set `descriptionHydrated = true`. **In scope: the function + contract. Out of scope: wiring it into UI.**

### Unit 6 — Observability
Persist `IngestionRun` + `SourceResult` (§5) every run. New admin endpoint `GET /api/admin/ingestion/summary` (copy `admin-funnel.ts` auth) + a minimal dashboard page. **Required metrics per source:** raw, new, duplicate, blocked/error, latency, credits/cost, and the headline **unique-contribution** (jobs only that source provided) — the number that says which sources to keep or kill.

---

## 5. Data models

```prisma
model Job {
  id                  String      @id @default(uuid())
  dedupKey            String      @unique  // normalise(company)|normalise(title)|locationKey(location)
  title               String
  company             String
  normalizedCompany   String
  location            String?
  salary              String?
  workMode            String?              // 'onsite'|'hybrid'|'remote'|null
  description         String               // teaser at ingest; full text after hydration
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
  source      String                       // 'adzuna'|'jsearch'|'seek'
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
  trigger    String                         // 'user_scan'|'manual'|'cron'
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
  query        String                        // "role @ location"
  status       String                        // 'ok'|'blocked'|'error'
  rawCount     Int          @default(0)
  newCount     Int          @default(0)
  dupCount     Int          @default(0)
  uniqueCount  Int          @default(0)       // jobs only this source provided this run
  blocked      Boolean      @default(false)
  errorMessage String?
  latencyMs    Int          @default(0)
  creditsUsed  Int          @default(0)
  @@index([runId])
  @@index([source])
}
```

`locationKey(location)` = AU state token (`NSW|VIC|QLD|WA|SA|TAS|ACT|NT`); fall back to full normalised location if absent. State-level keying merges the same role across boards without merging the same role in two different cities.

---

## 6. Config

`server/src/config/ingestion.ts`:
```ts
export const INGESTION_SOURCES = { adzuna: true, jsearch: true, seek: true };  // flip off without code edits
export const MAX_PAGES_PER_SOURCE = 2;          // SEEK pagination cap per title
export const RELEVANCE_THRESHOLD = 0.34;
export const SEEK_SEARCH_MODE: 'keyword' | 'classification' = 'keyword';
```

---

## 7. Cost model (drives lazy-hydration rule)

- Adzuna API: free. JSearch: ~$25 USD/mo (6k jobs). Firecrawl SEEK: ~1 credit/search page (~$0.03/1k jobs at listing level), 1 credit per hydration scrape (SEEK only — Adzuna/JSearch arrive hydrated).
- **Rule:** never bulk-hydrate. Surface from teasers/API; fetch full SEEK descriptions only on click.

---

## 8. Out of scope (STOP and report if tempted)

Sponsor classification / `SponsorJob` changes, wiring `Job`→`sponsorClassifier`, any funnel/dashboard/feed UI beyond the admin observability page, monetization, deleting `seekScraper.ts`/`seekHtmlScraper.ts`, scraping Indeed/LinkedIn/Jora directly, a new fuzzy-match algorithm, embeddings relevance, auto-registering any cron.

---

## 9. Acceptance criteria

1. `parseSeekMarkdown` unit-tested against a saved real SEEK search-page fixture → valid `RawJob[]` at ≥80% of on-page job links.
2. `mergeSources` unit-tested: the same job from two sources collapses to one `Job` with two `JobSource` rows, reusing the existing `normalise`/`isSimilar`.
3. `relevance` unit-tested: an off-target title scores below threshold and is flagged `lowRelevance`.
4. AdzunaAdapter + JSearchAdapter each return a 3-row real sample mapped to `RawJob` (guard C satisfied).
5. SeekAdapter via Firecrawl returns parsed jobs for a real title+location.
6. `scrapeJobsForTitles(['Registered Nurse','Software Engineer','Accountant'], 'Sydney NSW')` fans out across all enabled adapters, merges, scores, persists, and returns deduped jobs — with `IngestionRun`/`SourceResult` written.
7. `hydrateJobDescription(jobId)` fills a SEEK job's full description on demand and is a no-op for already-hydrated API jobs.
8. `GET /api/admin/ingestion/summary` returns per-source rollups including unique-contribution.
9. Re-running the same titles updates `lastSeenAt` and creates zero duplicate `Job` rows.

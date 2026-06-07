# Visa-Sponsor Jobs — Data Pipeline (Design Spec)

**Date:** 2026-06-04
**Status:** Approved-pending-review
**Scope of THIS build:** *Data acquisition only.* Produce a stored, queryable dataset of Australian jobs that are visa-sponsor-likely, refreshed **weekly**. No UI, no funnel, no monetization in this build.

---

## 1. Product context (NOT in this build's scope — recorded for continuity)

These were locked in brainstorming on 2026-06-04 and define the larger flow this dataset eventually feeds. **Do not build any of this here.** Listed only so the data model serves it later:

- Flow: landing → resume scan → brief free analysis → email → full CV-gap report → "Fix my Resume" → **modal-replaces-loading** (LLM infers 3 locally-attainable job titles + location; Apify/Seek scrape warms while the user reads) → dashboard pre-loaded with jobs.
- Monetization: 5 free done-for-you applications, gamified 1/5→5/5 → **7-day challenge**, **no card until day 7**, marathon framing, daily educational unlock + ~1-min video. Day-7 ask via frictionless one-tap.
- The **visa-sponsor jobs feed is the intended "crown jewel."** This data pipeline is what makes it real.

The rest of this document is the ONLY thing to implement now.

---

## 2. Goal

Given jobs scraped from Seek (existing infra), classify each as a visa-sponsor opportunity by combining **two signals** and store the qualifying ones in a dedicated pool, refreshed weekly.

- **Signal 1 — authoritative:** the advertising employer appears in the existing sponsor registry (4,058 companies).
- **Signal 2 — enrichment:** the job description contains explicit positive sponsorship phrasing and no negation.

---

## 3. What already exists — REUSE, do not rebuild

| Asset | Path | Use |
|---|---|---|
| Sponsor registry data (4,058 rows) | `server/data/sponsors_enriched.json` | Source of truth for Signal 1. Keys: `rawName, cleanName, website, careersUrl, careersSearchUrl, industry, locations, hiringProfile, confidence` |
| `Sponsor` DB model | `server/prisma/schema.prisma:344` | `cleanName` is `@unique`. Already indexed on `cleanName`. |
| Seek scraper (Apify `websift/seek-job-scraper`) | `server/src/services/seekScraper.ts` | `buildSeekClusterKey`, `fetchSeekJobsForCluster`, returns `RawJob[]` |
| `RawJob` type | `server/src/services/jobFeed.ts` | `{ title, company, location, salary, description, sourceUrl, sourcePlatform, postedAt }` |
| Cron pattern | `server/src/cron/jobFeedCron.ts` | `node-cron`, `cron.schedule('0 21 * * *', …)`. Copy this structure. |
| DeepSeek-via-OpenRouter pattern | `server/src/scripts/enrich_sponsor_fields.ts` | Reference only; this build needs **no LLM**. |

**STOP-and-report guard A:** If `server/data/sponsors_enriched.json` is missing or has <1,000 rows, STOP and report. Do not regenerate it.

---

## 4. Architecture — three units

```
[Config: scan clusters]                 [Config: phrase lists]
         │                                       │
         ▼                                       ▼
 (A) Job Ingestion  ──RawJob[]──►  (B) Sponsor Classifier  ──►  (C) SponsorJob store
   (reuse seekScraper)              (NEW — pure functions)        (NEW table + weekly cron)
```

### Unit A — Job Ingestion (reuse existing, keyword-slug sweep)
- **Measured 2026-06-04:** the entire national visa-sponsorship pool on Seek is only ~600–700 jobs deduped (`/sponsorship-jobs/in-All-Australia` = 614, `/visa-sponsorship-jobs` = 345, `/482-visa-sponsorship-jobs` = 126, `/visa-sponsorship-available-jobs` = 180). So we do **NOT** sweep by occupation. We fetch a small set of Seek **sponsorship keyword searches** defined in `SPONSOR_SCAN_QUERIES` (see §6), dedupe across them by `sourceUrl`, and pass the union to the classifier.
- Each query maps to the Apify actor's existing `searchTerm` + `location` inputs (`seekScraper.ts:100`). e.g. `searchTerm: 'sponsorship', location: 'All Australia'` reproduces Seek's `/sponsorship-jobs/in-All-Australia` set.
- The broad `sponsorship` query intentionally **over-captures** (includes non-visa noise like "sponsorship coordinator" / event sponsorship); the classifier (Unit B) filters that out. **Wide net in, clean signal out.**
- **Build change required:** `fetchSeekJobsForCluster` currently hardcodes `maxResults: 30` and `dateRange: 7` (`seekScraper.ts:102-104`). Add an optional second arg `opts?: { maxResults?: number; dateRange?: number }` that **defaults to the current 30 / 7** (so the per-user feed is untouched) and is overridden by the sponsor sweep with `SPONSOR_SCAN_MAX_RESULTS` / `SPONSOR_SCAN_DATE_RANGE`.
- Reuse `buildSeekClusterKey(query.searchTerm, 'All Australia', null)` to build the cache key per query — the existing `SeekJobCache` mechanism then caches each query/day for free.
- Seek only. Do **NOT** touch LinkedIn/Indeed (anti-bot, legal).
- **STOP-and-report guard B:** Run the **single broadest** query (`sponsorship`) end-to-end first and report the raw count + a 5-row sample before running the rest. Do not run all queries until that sample is confirmed.

### Unit B — Sponsor Classifier (NEW — the only real logic)
New file `server/src/services/sponsorClassifier.ts`. **Pure, deterministic, no LLM, no network.** Exposes:

```ts
classifyJob(job: RawJob, registry: SponsorIndex, phrases: PhraseConfig): SponsorClassification
```

where `SponsorClassification = { confidence: 'confirmed'|'likely'|'keyword_only'|'excluded'|'none', employerMatched: boolean, sponsorCleanName: string|null, positivePhraseHit: boolean, negationPhraseHit: boolean, matchedPhrases: string[] }`.

**Normalization (robustness — apply to BOTH company names and JD text):**
1. Lowercase.
2. Strip legal suffixes: `pty ltd, pty, ltd, limited, inc, incorporated, group, australia, aust, the` (token-level).
3. Strip punctuation; collapse internal whitespace to single spaces; trim.
4. Company match uses the normalized form of `RawJob.company` vs a pre-built `Map<normalizedCleanName, cleanName>` index of the registry (build once per run, not per job).

**Signal evaluation:**
- `employerMatched` = normalized company exists in the registry index → also capture `sponsorCleanName`.
- `negationPhraseHit` = any negation phrase (normalized substring) present in normalized JD text.
- `positivePhraseHit` = any positive phrase present in normalized JD text.

**Confidence rules (evaluate top-down, first match wins — negation always wins):**
| # | Condition | `confidence` | Stored? |
|---|---|---|---|
| 1 | `negationPhraseHit` | `excluded` | no |
| 2 | `employerMatched && positivePhraseHit` | `confirmed` | yes |
| 3 | `employerMatched` (no negation) | `likely` | yes |
| 4 | `positivePhraseHit` (no negation) | `keyword_only` | yes |
| 5 | otherwise | `none` | no |

Rationale: a job that explicitly says it won't sponsor is excluded **even if the employer is a registered sponsor** — the registry says the company *can* sponsor, the JD says this *role* won't.

**Out of scope for v1 (do NOT implement — STOP-and-report guard C):** fuzzy / Levenshtein / token-overlap company matching. v1 is exact normalized match only. If exact match feels too strict, STOP and report match-rate stats; do not add fuzzy matching unilaterally (false positives poison the crown-jewel feature).

### Unit C — Store + weekly cron (NEW)
- New Prisma model `SponsorJob` (see §5). Migration via the project's existing migration approach.
- New file `server/src/cron/sponsorJobScanCron.ts`, modeled on `jobFeedCron.ts`: `cron.schedule('0 20 * * 1', …)` (Mondays 20:00 UTC ≈ Tue 06:00–07:00 AEST), gated behind `process.env.SPONSOR_SCAN_ENABLED === 'true'`.
- New runnable script `server/src/scripts/run_sponsor_scan.ts` for manual/test runs (`npx tsx src/scripts/run_sponsor_scan.ts --only-query broad`).
- The scan: load registry index once → for each query in `SPONSOR_SCAN_QUERIES`: ingest (A) → dedupe the union by `sourceUrl` → classify (B) → upsert qualifying rows (C).
- **Dedupe:** upsert on unique `sourceUrl`. On re-scan, update `lastSeenAt` + `confidence`; do not create duplicates. A `sourceUrl` first seen via the `broad` query keeps `scanQuery = 'sponsorship'` even if a narrower query also returns it.

**STOP-and-report guard D:** Do NOT add `startSponsorJobScanCron()` to the server boot sequence in `server/src/index.ts`. Wire the cron file but leave it unregistered, and report that the user must register it + set `SPONSOR_SCAN_ENABLED=true` to activate. Default OFF.

---

## 5. Data model — `SponsorJob`

```prisma
model SponsorJob {
  id                String           @id @default(uuid())
  sourceUrl         String           @unique
  title             String
  company           String
  normalizedCompany String
  location          String?
  salary            String?
  description       String
  sourcePlatform    String           // 'seek' for v1
  postedAt          DateTime?
  // classification
  confidence        String           // 'confirmed' | 'likely' | 'keyword_only'
  employerMatched   Boolean
  sponsorCleanName  String?          // FK-by-name into Sponsor.cleanName when matched
  positivePhraseHit Boolean
  negationPhraseHit Boolean          // always false for stored rows; kept for audit
  matchedPhrases    Json?            // string[] of phrases that fired
  scanQuery         String           // searchTerm of the first SPONSOR_SCAN_QUERIES entry that surfaced it
  firstSeenAt       DateTime         @default(now())
  lastSeenAt        DateTime         @updatedAt
  feedDate          String           // yyyy-mm-dd of the scan run

  @@index([confidence])
  @@index([normalizedCompany])
  @@index([feedDate])
}
```

Only `confirmed | likely | keyword_only` rows are ever written. `excluded` / `none` are dropped (counted in the run summary, not stored).

---

## 6. Config files (tunable without code changes)

`server/src/config/sponsorScan.ts`:

```ts
// Seek sponsorship keyword searches to sweep weekly, broad → narrow.
// Each searchTerm reproduces a Seek /{slug}-jobs/in-All-Australia set.
// The whole national pool is ~600–700 jobs deduped, so this is cheap.
export const SPONSOR_SCAN_QUERIES = [
  { searchTerm: 'sponsorship',          label: 'broad' }, // ~614 — widest net, noisy (classifier filters)
  { searchTerm: 'visa sponsorship',     label: 'visa'  }, // ~345
  { searchTerm: '482 visa sponsorship', label: '482'   }, // ~126
  { searchTerm: '457 visa sponsorship', label: '457'   }, // legacy 457, low volume
];

export const SPONSOR_SCAN_LOCATION    = 'All Australia';
export const SPONSOR_SCAN_MAX_RESULTS = 700; // full live pool per query; tiny cost
export const SPONSOR_SCAN_DATE_RANGE  = 30;  // capture the full live set, not just last 7d
```

`server/src/config/sponsorPhrases.ts` (normalized, lowercase — matched after JD normalization):

```ts
export const POSITIVE_PHRASES = [
  'visa sponsorship available', 'sponsorship available', 'visa sponsorship offered',
  'willing to sponsor', 'will sponsor', 'we can sponsor', 'able to sponsor',
  'open to sponsorship', 'sponsorship provided', 'sponsorship considered',
  '482 sponsorship', 'tss sponsorship', 'skills in demand visa', 'visa sponsorship provided',
  'employer sponsored', 'sponsorship for the right candidate', 'pr pathway', 'visa support',
];

export const NEGATION_PHRASES = [
  'no visa sponsorship', 'no sponsorship', 'not able to sponsor', 'unable to sponsor',
  'cannot sponsor', 'do not offer sponsorship', 'does not offer sponsorship',
  'no sponsorship available', 'sponsorship not available', 'must have full working rights',
  'must have unrestricted work rights', 'must hold a valid visa', 'no visa support',
  'permanent residents only', 'citizens only', 'must be an australian citizen',
  'must have permanent residency', 'valid work rights required without sponsorship',
];
```

**STOP-and-report guard E:** If a real JD sample shows obvious false positives/negatives from these lists, STOP and report 5 example mismatches with suggested phrase edits. Do not silently invent new matching heuristics (regex/proximity) beyond the substring approach in v1.

---

## 7. Schedule

- **Weekly**, Mondays 20:00 UTC, gated OFF by default (guard D).
- Rationale: sponsor-tagged jobs don't churn fast enough to justify daily Apify cost; weekly keeps the pool fresh at low spend. (Daily/monthly were considered; weekly chosen.)

---

## 8. Acceptance criteria (how we verify this build is done)

1. `classifyJob` is unit-tested against fixtures covering every row of the §4 confidence table (incl. negation-wins-over-registry).
2. Company normalization is unit-tested (e.g. `"Acme Pty Ltd"` matches registry `"Acme"`).
3. A single-query manual run (`run_sponsor_scan.ts --only-query broad`) ingests Seek, classifies, and writes `SponsorJob` rows, printing a summary: `{ ingested, deduped, confirmed, likely, keyword_only, excluded, none }`.
4. Re-running the same query updates `lastSeenAt` and creates **zero** duplicate rows.
5. The cron file exists but is **not** registered in `index.ts`, and `SPONSOR_SCAN_ENABLED` defaults OFF.

---

## 9. Explicit out-of-scope (do not build)

Modal/funnel/dashboard, monetization, 7-day drip, videos, LinkedIn/Indeed/CareerOne/Workforce-Australia ingestion, fuzzy company matching, FOI-PDF parsing, auto-registering the cron, regenerating the sponsor registry. Any of these = STOP and report.

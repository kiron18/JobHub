# Seek Apify Scraper + Unified Job Feed Design

**Date:** 2026-04-24
**Status:** Approved

---

## Overview

Extend the daily job feed to include Seek.com.au listings scraped via Apify, merged with the existing Adzuna feed into a unified job pool. All listings display in full (no truncation). Redesign the Apply flow across the entire platform to guide users from document generation through to direct application on the job board.

---

## 1. Architecture

### 1.1 Unified Job Pool (Approach C)

Both Seek (Apify) and Adzuna run as daily data sources. Results are merged into a shared pool, deduplicated, scored by the existing AI match scorer, and served to each user as a ranked feed. Neither source is a fallback — both run in parallel and contribute independently.

```
Daily Cron (21:00 UTC)
  ├── fetchAdzunaJobs()          (existing)
  ├── fetchSeekJobsForClusters() (new — parallel per cluster)
  │     └── ApifyClient.actor('bebity/seek-jobs-scraper').call(...)
  └── mergeAndDedup()            (new)
        └── Store into JobFeedItem (existing table, sourcePlatform: 'seek' | 'adzuna')
```

### 1.2 Cluster-Based Seek Scraping

**Cluster key:** `normalised(jobTitleKeywords) + city + industry`

- At cron time, group all active premium users by cluster key
- Run one Apify actor call per unique cluster (parallel, `Promise.all`)
- Cache raw results in new `SeekJobCache` table keyed by `(queryHash, date)`
- If a cluster's cache entry exists for today, skip the Apify call entirely
- Cap: 50 results per cluster, `datePosted: last 24h` filter

**Cluster key normalisation:**
- Job title keywords: extract role nouns (strip seniority prefixes — "Senior", "Lead", "Junior" — to widen pool slightly), lowercase, sort alphabetically, join
- City: lowercase, strip state suffix
- Industry: use profile `industry` field directly

### 1.3 Deduplication

After merging Seek + Adzuna results, deduplicate by:
1. **Exact URL match** (same listing on both platforms)
2. **Fuzzy match:** `title + company + location` similarity ≥ 85% — normalise both strings (lowercase, strip punctuation, collapse whitespace), then check if one contains the other or if the Levenshtein distance is ≤ 15% of the longer string's length. No external library needed — implement inline.

When a duplicate is detected, prefer the **Seek listing** (full description, richer structured data). Adzuna entry is discarded.

### 1.4 Adzuna Full Descriptions

No change to existing behavior. Adzuna descriptions remain lazy-loaded on card expand via the existing `POST /api/job-feed/:id/fetch-description` endpoint. Seek descriptions arrive full from Apify — no secondary fetch required.

---

## 2. Data Layer

### 2.1 New Table: `SeekJobCache`

```prisma
model SeekJobCache {
  id          String   @id @default(cuid())
  queryHash   String   // SHA256 of (normalised cluster key)
  queryMeta   Json     // { keywords, city, industry } for debugging
  fetchedAt   DateTime @default(now())
  feedDate    String   // "YYYY-MM-DD"
  results     Json     // Raw Apify actor output array
  resultCount Int

  @@unique([queryHash, feedDate])
  @@index([feedDate])
}
```

### 2.2 `JobFeedItem` changes (existing table)

No schema migration required. `sourcePlatform` already exists and will be set to `'seek'` for Seek listings. `sourceUrl` already stores the listing URL. No new columns needed.

### 2.3 Job Context in localStorage (Apply Flow)

When user clicks "Prepare & Apply", store to localStorage:

```typescript
jobhub_apply_context: {
  jobId: string
  title: string
  company: string
  description: string
  sourceUrl: string        // direct link to listing (already in JobFeedItem)
  sourcePlatform: string   // 'seek' | 'linkedin' | 'adzuna' | etc.
}
```

Apply instructions are derived in the frontend from `sourcePlatform` via a static lookup (no DB storage needed). This replaces the existing `jobhub_current_jd` write (which remains for backward compat) and adds the apply context fields.

---

## 3. Backend

### 3.1 New Service: `seekScraper.ts`

```
server/src/services/seekScraper.ts
```

Responsibilities:
- Build cluster key from user profile fields
- Check `SeekJobCache` for today's entry (cache hit → return cached results)
- On cache miss: call Apify actor, store results in `SeekJobCache`, return results
- Map Apify actor output fields → `JobFeedItem` schema
- Expose `fetchSeekJobsForClusters(users: User[])` — groups users by cluster, runs parallel calls

**Apify actor call:**
```typescript
const client = new ApifyClient({ token: process.env.APIFY_API_KEY })
const run = await client.actor('bebity/seek-jobs-scraper').call({
  keywords: clusterKeywords,
  location: clusterCity,
  maxResults: 50,
  datePosted: '24h',
})
const { items } = await client.dataset(run.defaultDatasetId).listItems()
```

### 3.2 Updated `jobFeedCron.ts`

```
1. Fetch all active premium users
2. Group by cluster key
3. Run fetchSeekJobsForClusters(users) — parallel Apify calls
4. Run existing fetchAdzunaJobs() for each user
5. mergeAndDedup(seekResults, adzunaResults) per user
6. Upsert into JobFeedItem (existing logic)
7. Pre-generate match bullets for top 20 results per user
```

### 3.3 Pre-match Score Filter (Cost Optimisation)

Before sending jobs to Claude for AI scoring, filter out obvious mismatches:
- Salary max < user's minimum salary expectation × 0.7
- Location city doesn't match user's city AND remote flag is false

This reduces Claude token usage on irrelevant listings.

### 3.4 No New API Routes

All existing job-feed routes remain unchanged. The new Seek source is transparent to the frontend — jobs appear in the same feed regardless of source.

---

## 4. Frontend

### 4.1 JobCard — CTA Redesign

**Replace** the current "Apply on [Platform]" + "Generate Documents" dual-button layout with:

```
Primary CTA:   [Prepare & Apply →]          (full-width, prominent)
Secondary:     "View listing on Seek ↗"     (small text link, always visible when expanded)
Tertiary:      [Save]                        (unchanged)
```

"Prepare & Apply" saves the apply context to localStorage and navigates to the workspace. The secondary link opens `sourceUrl` directly in a new tab for users who want to skip document generation.

### 4.2 Workspace — Application Context Banner

When `jobhub_apply_context` is present in localStorage, show a persistent chip at the top of the workspace:

```
┌─────────────────────────────────────────────────────────┐
│ 📋  Preparing for: [Job Title] @ [Company] · [Platform] │
│                                          [Apply →]       │
└─────────────────────────────────────────────────────────┘
```

- "[Apply →]" opens `sourceUrl` in a new tab
- Chip is dismissible (clears `jobhub_apply_context`)
- Chip persists across workspace tabs (cover letter, resume, etc.)

### 4.3 Workspace — Post-Generation Apply Panel

After any document is generated (cover letter, resume tailoring, etc.), show a "Next Step" panel below the document output:

```
┌─────────────────────────────────────────────────────────┐
│  ✅  Your documents are ready                           │
│                                                         │
│  Submit your application on [Platform]:                 │
│  [Apply on Seek →]                                      │
│                                                         │
│  Instructions:                                          │
│  1. Click above to open the job listing                 │
│  2. Upload your tailored resume                         │
│  3. Paste your cover letter into the application form   │
└─────────────────────────────────────────────────────────┘
```

- Instructions are platform-aware (`applyInstructions` from the job record)
- Panel appears after generation, not before (don't interrupt the workflow)
- Panel is not dismissible — it remains as a persistent reminder

### 4.4 Application Tracker — Apply Link

Each `JobApplication` card in the tracker already has a `sourceUrl`. Add a persistent "Apply on [Platform] →" text link to each tracker card. Users can always return to the listing even after documents are generated.

### 4.5 Full Listings — No Truncation UI

- Remove truncation detection warning banner for all listings
- Seek listings: always full (Apify returns complete descriptions)
- Adzuna listings: lazy-load full description on expand (existing fetch-description endpoint, unchanged) — show a subtle loading state instead of a truncation warning

---

## 5. Error Handling

| Scenario | Behaviour |
|---|---|
| Apify actor call fails | Log error, fall back to Adzuna-only feed for affected cluster |
| Apify returns 0 results for cluster | Fall back to broader keyword search (remove industry from cluster key) |
| SeekJobCache write fails | Continue — non-fatal, next run will re-fetch |
| Dedup produces 0 results | Return Adzuna-only results unmodified |
| `jobhub_apply_context` missing in workspace | Hide apply banner and post-generation panel silently |
| Actor rate-limited by Apify | Retry once after 60s delay; if still failing, fall back to Adzuna |

---

## 6. Environment Variables

```env
APIFY_API_KEY=          # existing in .env — Apify personal API token
```

No new env vars required.

---

## 7. Testing Criteria

- [ ] Seek scrape runs and returns ≥ 1 result for a standard cluster (Software Engineer, Melbourne, Tech)
- [ ] Cache hit prevents a second Apify call for the same cluster on the same day
- [ ] Deduplication removes a manually injected duplicate (same title + company + location)
- [ ] Seek listings show full descriptions with no truncation warning
- [ ] "Prepare & Apply" saves correct context to localStorage and navigates to workspace
- [ ] Application context banner appears in workspace when context is set
- [ ] Post-generation apply panel appears after cover letter generation with correct platform name and URL
- [ ] Apply link in tracker opens correct source URL
- [ ] Cron job completes without error when both Seek and Adzuna are active
- [ ] Pre-match filter correctly excludes salary-mismatched listings before AI scoring

---

## 8. Out of Scope

- Multi-country Seek scraping (AU only for now)
- In-app resume upload to Seek (not technically feasible — Seek requires their own upload flow)
- Seek account integration / OAuth
- Real-time scraping on user request (daily cron only)

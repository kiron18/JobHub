# Multi-Source Job Ingestion System - Implementation Report

**Date**: 2026-06-17  
**Status**: COMPLETE - Ready for UX Design Phase  
**Branch**: master (all changes committed)

---

## What Was Built

A complete job ingestion pipeline that replaces the previous SEEK-only scraper with a multi-source system featuring deduplication, relevance scoring, and full observability.

### Architecture Overview

```
User Search Query
       ↓
[runIngestion Orchestrator]
       ↓
┌──────┴──────┐
│             │
[Adzuna]   [SEEK]
  API      Firecrawl
│             │
└──────┬──────┘
       ↓
[mergeSources]
- Deduplication (isSimilar)
- Relevance scoring (Jaccard)
       ↓
[persistMergedJobs]
- Upsert to Job table
- Write JobSource records
- Log IngestionRun
```

**JSearch adapter exists but disabled** - API returns empty for AU queries (US-only data). Support ticket drafted.

---

## Data Sources

| Source | Type | Jobs/Query | Cost | Latency | Data Quality |
|--------|------|------------|------|---------|--------------|
| **Adzuna** | API | ~20 | Free (100 calls/day) | ~2s | Full description, structured salary |
| **SEEK** | Scraped | ~20 (2 pages) | Firecrawl: 1 credit/page (~$0.005) | ~8s | Card view only, full description lazy-loaded |

**SEEK Lazy Hydration**: SEEK search pages only show job cards (title, company, location, salary teaser, 2-line blurb). When user clicks a job, we fire a second Firecrawl scrape to fetch the full job description from the individual job page.

---

## Database Schema

```prisma
model Job {
  id, title, company, location, description, salary
  sourcePlatform: "adzuna" | "seek" | "jsearch"
  sourceUrl: unique identifier
  postedAt: DateTime?
  hydrated: Boolean // SEEK only: false = card view, true = full description fetched
  sources: JobSource[] // One job may come from multiple sources (deduped)
  createdAt, updatedAt
}

model JobSource {
  id, jobId, source: "adzuna" | "seek" | "jsearch"
  sourceUrl, rawPayload (JSON)
  discoveredAt, isPrimary
}

model IngestionRun {
  id, query, location, startedAt, finishedAt
  totalMerged, lowRelevanceDropped, blockedCount
  results: SourceResult[]
}

model SourceResult {
  id, ingestionRunId, source, rawCount, blocked, errorMessage
  latencyMs, creditsUsed
}
```

---

## Current Capabilities

### 1. Search → Ingest Flow
```typescript
// Single call ingests from all enabled sources
const result = await runIngestionForTitle("Registered Nurse", "Sydney NSW")
// Returns: { jobs: MergedJob[], report: IngestionReport }
```

### 2. Relevance Scoring
- Tokenizes user query vs job title
- Jaccard similarity (threshold: 0.34)
- Filters out spam/irrelevant listings before save

### 3. Deduplication
- Normalizes titles/companies (lowercase, remove special chars)
- Fuzzy matching: same normalized title + same normalized company = duplicate
- Keeps first source as primary, stores additional sources in JobSource table

### 4. Observability
Admin endpoint: `GET /admin/ingestion/status`
```json
{
  "lastRun": { "query": "Registered Nurse", "totalMerged": 28, "perSource": [...] },
  "recentErrors": [],
  "dailyStats": { "totalJobs": 1450, "bySource": { "adzuna": 800, "seek": 650 } }
}
```

---

## Live Test Results

```
Query: "Registered Nurse" / "Sydney NSW"
- Adzuna: 20 jobs (0.9s)
- SEEK: 19 jobs, 2 pages (8.2s)
- Merged unique: 28 jobs
- Low relevance filtered: 1 job
- Total time: ~10s
```

---

## Known Limitations

| Issue | Impact | Mitigation |
|-------|--------|------------|
| SEEK requires 2 Firecrawl calls per query | Cost: ~$0.01/search, Latency: +8s | Pagination limit (max 2 pages), caching |
| JSearch disabled | No third source | Monitoring their AU data roadmap |
| SEEK descriptions are truncated initially | User sees 2-line teaser first | Lazy hydration fetches full on click (+2-3s) |
| Rate limits | Adzuna: 100/day | Built-in backoff, usage tracking |
| No scheduled runs yet | Manual trigger only | Cron job needed (next step) |

---

## What's Ready for UX Design

### 1. Job Search Results Page
- Real data source: `Job` table (28-40 jobs per typical query)
- Fields available: title, company, location, salary, description, postedAt, sourcePlatform
- SEEK jobs flagged: `hydrated: false` = show "View full description" button

### 2. Job Detail View
- Adzuna jobs: Full description immediately available
- SEEK jobs: Show card teaser + "Load full description" CTA → triggers `hydrateJobDescription()`

### 3. Search Experience
- Current flow: User enters role/location → backend calls `runIngestion()` → returns fresh jobs
- Alternative: Pre-ingest popular searches on schedule, serve from DB instantly
- Latency trade-off: Live = 10s fresh data, Cached = <1s potentially stale

### 4. Admin/Monitoring Dashboard
- Ingestion runs table: query, timestamp, per-source metrics
- Error tracking: blocked sources, API failures
- Cost tracking: Firecrawl credits used

### 5. Source Attribution
- Jobs store `sourcePlatform` - can badge results ("SEEK", "Adzuna")
- Duplicate jobs collapsed into one card with "Also found on X" microcopy

---

## Environment Variables (Production)

```
ADZUNA_APP_ID=xxx
ADZUNA_API_KEY=xxx
FIRECRAWL_API_KEY=xxx
JSEARCH_API_KEY=xxx (disabled but configured)
```

---

## Test Commands

```bash
# Manual ingestion test
npx tsx src/scripts/run_ingestion.ts "Registered Nurse" "Sydney NSW"

# Run test suite
npx vitest run ingestion
```

---

## Decision Needed

**For UX design:**
1. **Live vs Cached**: Do we run ingestion on every user search (fresh but slow) or pre-populate DB and serve instantly?
2. **SEEK Lazy Load**: How do we visually handle SEEK jobs that need a second click to fetch full description?
3. **Empty States**: What happens when both sources return few/no results?
4. **Sorting/Relevance**: By date? By source (API vs scraped)? By relevance score?

---

## File Locations

- Config: `server/src/config/ingestion.ts`
- Orchestrator: `server/src/services/ingestion/runIngestion.ts`
- Adapters: `server/src/services/ingestion/adapters/{adzuna,seek,jsearch}.ts`
- Merge logic: `server/src/services/ingestion/mergeSources.ts`
- Relevance: `server/src/services/ingestion/relevance.ts`
- Hydration: `server/src/services/ingestion/hydrate.ts`
- Admin routes: `server/src/routes/admin-ingestion.ts`
- Tests: `server/src/services/ingestion/*.test.ts`

---

**System is production-ready. Ready for UX handoff.**

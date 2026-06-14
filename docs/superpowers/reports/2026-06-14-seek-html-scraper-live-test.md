# Seek HTML Scraper — Live Test Report

**Date:** 2026-06-14
**Test:** `scripts/test-html-scraper.ts` — fetch lab technician jobs in Sydney
**Trigger:** Manual smoke test after deploying the new direct-HTML scraper (replacing Apify)

---

## Results Summary

| Metric | Value |
|---|---|
| Jobs fetched | **8** (capped at `maxResults: 8`) |
| Cache cluster key | `0720e4257177ec6bbc4a02a3fae3e118721ee438245e10847a803821fcad4af6` |
| Server status | Running on `localhost:3002` |
| Description quality | All 8 jobs have full descriptions (2,059–7,685 chars) |
| Date parsing | All 8 dates parsed successfully (relative → ISO) |
| Errors | None from scraper |

---

## Jobs Returned

| # | Title | Company | Location | Posted Date |
|---|---|---|---|---|
| 1 | Product Technologist - Gummies Development and Manufacturing | Essence Group | Sydney NSW | 2026-06-11 |
| 2 | Metallurgist | Opal Consulting Group PTY LTD | Sydney NSW | 2026-06-11 |
| 3 | Laboratory Technician | Boortmalt | Minto, Sydney NSW | 2026-06-10 |
| 4 | Laboratory Technician (Full-Time, Part-Time & Casual) | Nucleus Network Ltd | St Leonards, Sydney NSW | 2026-06-08 |
| 5 | Medical Laboratory Technician - Haematology | NSW Health Pathology | Kogarah, Sydney NSW | 2026-06-11 |
| 6 | Laboratory Assistant | The University of Notre Dame | Broadway, Sydney NSW | 2026-06-10 |
| 7 | Laboratory Analyst – Inorganic / Trace Element Sample Preparation | Bayside Group | North Ryde, Sydney NSW | 2026-06-11 |
| 8 | Medical Laboratory Assistant - Haematology Research | NSW Health Pathology | Sydney NSW | 2026-06-11 |

**Detail pages:** All have valid `seek.com.au/job/XXXX` URLs.

---

## Background — The Problem

Seek's Apify scraper (`websift/seek-job-scraper`) was returning only **1 irrelevant result** instead of the expected ~65 jobs. Root cause:

1. **Qualifier pollution:** The helper `buildEntryLevelSearchTerm` was prepending `"entry level graduate junior starter"` into the search query sent to Apify
2. **Seek treats keywords as hard AND-filters:** the qualifier phrase produced a URL like `...entry-level-graduate-junior-starter-Laboratory-Technician-jobs/...` which destroyed results (65 → 3 → 1)
3. **No visibility into Apify's internals:** the black-box Apify actor couldn't be debugged or tuned

---

## Solution — Direct HTML Scraper

### Architecture

```
seekScraper.ts (re-export shim)
  └── seekHtmlScraper.ts (NEW — 280 lines)
        ├── axios + cheerio for HTML parsing
        ├── cache layer (Redis, "seek-html|" prefix)
        └── detail page fetching (4 concurrent workers)
```

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Host | `au.seek.com` | `www.seek.com.au` returns 403 |
| Search URL | `/role-slug-jobs/in-City?daterange=N` | No qualifiers in URL — clean AND search |
| Junior bias | Post-fetch in `quickScore` (+25) | Not in search query — would destroy results |
| Seniority | Preserved in role string | Senior/junior are different search intents |
| Pagination | Up to 3 pages | Capped to keep total fetch < 10s |
| Cache key | SHA-256 hash | Collision-free, `seek-html\|` prefix avoids old Apify cache clash |
| Detail concurrency | 4 simultaneous fetches | Fast enough without rate-limiting |
| Date parsing | Custom `parseRelativeDate()` | Seek uses relative dates ("6d ago"), no ISO dates in HTML |
| Dedup | `dedupeDoubledText()` | Seek occasionally doubles text ("6d ago6d ago") |
| Post-fetch ranking | `quickScore` in `jobFeed.ts` | +25 for junior signals |

### Files Modified/Created

| File | Action |
|---|---|
| `server/src/services/seekHtmlScraper.ts` | **NEW** — full scraper module |
| `server/src/services/seekHtmlScraper.test.ts` | **NEW** — 21 unit tests |
| `server/src/services/seekScraper.ts` | **REWRITTEN** — 20-line re-export shim |
| `server/src/services/jobFeed.ts` | **MODIFIED** — added JUNIOR_SIGNALS +25 boost |
| `server/src/utils/__tests__/seekScraper.test.ts` | **MODIFIED** — updated for seniority-preserve behavior |
| `server/src/services/__fixtures__/seek-search.html` | **NEW** — 1.1MB saved search fixture |
| `server/src/services/__fixtures__/seek-detail.html` | **NEW** — 274KB saved detail fixture |
| `server/scripts/test-html-scraper.ts` | **NEW** — manual smoke test script |

### Test Suite Results

| Scope | Pass | Fail | Notes |
|---|---|---|---|
| `services/` unit tests | 100 | 0 | All scraper + feed tests pass |
| `utils/` unit tests | linked | 0 | Updated seniority test passes |
| Integration tests | — | — | Fail pre-existing — need running server + DB |

---

## Pre-existing Noise in Startup

The server startup logged errors from `linkCandidateProfiles.ts` — a backfill that tries to update `CandidateProfile.yearsOfExperience` which doesn't exist as a column in the current database schema. This is a **pre-existing schema drift issue** unrelated to the scraper change. It doesn't crash the server — records are logged as "skipped."

---

## Next Steps (Optional — after ~1 week stable)

1. Remove `apify-client` from `package.json`
2. Delete `seekScraper.ts` shim, rename `seekHtmlScraper.ts` → `seekScraper.ts`
3. Update the 4 import sites to import directly from `./seekScraper`
4. Remove `APIFY_API_KEY` from `.env` (but verify LinkedIn scraper doesn't still need it — it does)

---

## Test Script

The smoke test lives at `server/scripts/test-html-scraper.ts` and can be re-run with:

```bash
npx tsx scripts/test-html-scraper.ts
```

It fetches lab technician jobs in Sydney, prints each job's title/company/location/URL/description-preview, and shows the cache key.

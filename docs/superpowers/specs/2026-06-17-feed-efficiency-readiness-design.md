# Feed: 3-Role Persistence + Scrape Cache + Readiness (Design Spec)

**Date:** 2026-06-17
**Status:** Ready for implementation plan
**Executor:** Kimi (zero-latitude, STOP-and-report guards)

**Scope — three fixes to the job feed:**
1. **Persist the 3 scan titles (the bug).** The CV scan already generates exactly 3 target titles + location (`server/src/services/jobTitleSuggest.ts`, "Exactly 3 titles, most-attainable first") and the scan-time scrape uses all 3. But the claim flow (`server/src/routes/cv-scan.ts:338,348`) saves only `targetRole = cleanTitles[0]` and **never sets `targetRoles`**. The ongoing feed (`jobFeed.ts:163`) falls back to `[targetRole]`, so it scrapes **one** role, not three. Fix: persist all 3 titles to `targetRoles`.
2. **Scrape cache.** Kimi's `Job` table is written every run but **never read** (`prisma.job.findMany` appears nowhere). Read it before re-scraping a (role, city, day) so identical searches collapse into one scrape.
3. **Readiness states.** The focused view is gated `{feedJobs.length > 0 && …}` in `StrategyHub.tsx:848` with no else, so an empty/building feed renders blank. Show building / profile-incomplete / empty states instead.

**Settled:** the 3 roles are scraped **individually, then deduped** (`scrapeJobsForTitles` maps titles → one `runIngestionForTitle` each). They are NOT coupled into one query — coupling would muddy relevance and lose per-role attribution. Adjacency just means dedup collapses more, lowering effective cost.

**Out of scope:** changing how `jobTitleSuggest` generates titles; new UI to hand-pick roles (GetStartedModal already edits them); cross-day caching.

---

## Part 1 — Persist the 3 scan titles to `targetRoles`

**File:** `server/src/routes/cv-scan.ts` (the claim handler, ~line 336–354).

Today:
```ts
const targetRole = cleanTitles[0] || entry.result.inferredRole || null;
const profileData = { …, targetRole, targetCity: loc, … };   // targetRoles never set
```

Fix: also persist the full title list.
```ts
const targetRole = cleanTitles[0] || entry.result.inferredRole || null;
const targetRoles = cleanTitles.length > 0 ? cleanTitles : (targetRole ? [targetRole] : []);
const profileData = { …, targetRole, targetRoles, targetCity: loc, … };
```

`cleanTitles` is already `normalizeTitles(titles)` (the 3 scan titles, possibly user-edited). The feed (`jobFeed.ts:163`) already prefers `targetRoles` when non-empty, so no feed change is needed — it will scrape all 3 once they're stored.

**STOP-and-report guard A:** Also confirm `server/src/routes/onboarding.ts` (the other write path, lines 110/132) — it hard-codes `targetRoles: [answers.targetRole]`. If onboarding is still a live path that can overwrite the claim, update it to carry the 3 titles too (or report that it is dead/legacy). Do not leave two write paths that disagree.

**STOP-and-report guard B:** `targetRoles` is a Json/array column. Confirm its Prisma type accepts `string[]` before writing; if it is `Json`, write the array as-is and report the column type.

---

## Part 2 — Scrape cache (read-through the `Job` table)

The `Job` table already holds everything needed to reconstruct a `MergedJob` (title, company, normalizedCompany, location, salary, description, descriptionHydrated, postedAt, relevanceScore, lowRelevance, searchRole, feedDate, and `sources` via `JobSource`). Make `runIngestionForTitle` read it first.

**Behaviour in `server/src/services/ingestion/runIngestion.ts`:** before fanning out to adapters,
1. Query the cache:
   ```ts
   const cached = await prisma.job.findMany({
     where: { searchRole: role, locationKey: locationKey(location), feedDate: todayStr() },
     include: { sources: true },
   });
   ```
2. If `cached.length >= CACHE_MIN_HITS` (config, default 3), reconstruct `MergedJob[]` via a pure helper and **return without scraping** — `creditsUsed: 0`, and write a `SourceResult` with `status: 'cache'`.
3. Otherwise scrape + persist as today.

**Schema:** add `Job.locationKey String?` populated at persist time (in `persistMergedJobs`/`mergeSources` via the existing `locationKey()` helper), plus `@@index([searchRole, locationKey, feedDate])` so the cache lookup is indexed.

**Pure helper:** `jobRowToMergedJob(row)` in `server/src/services/ingestion/cache.ts`, unit-tested.

**TTL:** daily, via `feedDate`. Previous-day rows never match today's `feedDate`.

**STOP-and-report guard C:** confirm `feedDate` format written by `persistMergedJobs` (yyyy-mm-dd AEST) matches what `todayStr()` returns. A mismatch makes the cache silently always-miss — reconcile and report.

**STOP-and-report guard D:** after building, run one cache-MISS then one cache-HIT for the same (role, city) same-day and report both `SourceResult` rows (`status: 'ok'` credits>0, then `status: 'cache'` credits 0). Do not trust the cache until that round-trip is shown.

---

## Part 3 — Readiness states (never blank)

`JobFeedPage.tsx` already renders building / profileIncomplete (CTA) / empty / error from the feed response. The StrategyHub embed must too.

- Extract a shared `src/components/jobs/FeedStateNotice.tsx` (`props: { state: 'building' | 'profileIncomplete' | 'empty' }`, `warm` tokens) and use it in BOTH `JobFeedPage` and `StrategyHub`, so they cannot drift.
- In `StrategyHub.tsx:848`, replace the bare `{feedJobs.length > 0 && (…)}` with: building → notice; profileIncomplete → CTA notice ("Add your target role and city to start your feed"); jobs present → `<FocusedApplyView>`; built-but-empty → empty notice with refresh.

**STOP-and-report guard E:** confirm StrategyHub's feed query exposes `building` / `profileIncomplete` flags (as `JobFeedPage` reads `feedData.building` / `feedData.profileIncomplete`). If its query returns a different shape, adapt and report — do not invent flags.

---

## Config

`server/src/config/ingestion.ts` (extend): `export const CACHE_MIN_HITS = 3;`

---

## Acceptance criteria

1. After CV-scan claim, `profile.targetRoles` contains all 3 scan titles; the feed build scrapes each of the 3 (individually, deduped), verified by 3 distinct `searchRole` values in the run.
2. `onboarding.ts` no longer hard-codes a single-element `targetRoles` (or is confirmed dead) — no write path disagrees with the claim.
3. `jobRowToMergedJob` unit-tested: a `Job` + two `JobSource` rows reconstruct a `MergedJob` with both sources and correct `descriptionHydrated`.
4. A second same-day `runIngestionForTitle` for the same (role, city) returns cached jobs, `creditsUsed: 0`, `SourceResult.status: 'cache'` (guard D round-trip shown).
5. Fewer than `CACHE_MIN_HITS` fresh rows still scrapes; previous-`feedDate` rows are never served.
6. `FeedStateNotice` is used by BOTH JobFeedPage and StrategyHub; StrategyHub never renders blank where the feed would be; an incomplete profile shows the CTA on the home page.

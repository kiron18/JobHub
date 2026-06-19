# Jobs Scrape — Fan-Out & Slowness Fix Spec

Date: 2026-06-19
Author: Claude (diagnosis + spec). Executor: DeepSeek.
Status: READY FOR EXECUTION.

> **EXECUTION RULES (read first, non-negotiable)**
> 1. This is a ZERO-LATITUDE spec. Do exactly what each step says. Do not "improve",
>    refactor, rename, or add anything not written here.
> 2. Every step marked **[STOP]** means: stop, paste the requested output/diff into the
>    chat, and wait for human approval before continuing. Do NOT proceed past a [STOP].
> 3. Do NOT run any database write command (`migrate deploy`, `migrate resolve`, `db push`,
>    raw SQL) against ANY environment. DB section is read-only diagnostics + committing
>    FILES only. The human (kiron) runs all DB mutations.
> 4. If anything you find on disk does NOT match what this spec says to expect, **[STOP]**
>    and report the difference. Do not adapt.
> 5. All user-facing copy and LLM prompts are owned by Claude. This spec introduces NONE.
>    If you think copy is needed, **[STOP]** and ask.

---

## 1. Verified current state (do not re-investigate; this is ground truth)

- The previous `GET /api/jobs` 500 (missing `followUpSentAt` / `followUpDismissedAt`
  columns, Prisma P2022) is **already resolved on staging** (later logs show `GET /jobs 200`).
- Two migration changes are on disk but **uncommitted**:
  - `server/prisma/migrations/20250616000001_add_crm_email_system/migration.sql` — MODIFIED
    (made idempotent with `IF NOT EXISTS`). This was the migration that previously failed (P3009).
  - `server/prisma/migrations/20250619000001_add_followup_columns/` — UNTRACKED (new; adds the
    two follow-up columns with `IF NOT EXISTS`).
- Production DB migration state is UNKNOWN and must be checked (Section 4).
- The remaining live problem is **slowness / fan-out**: one user's single search fires
  ~12-21 Firecrawl scrapes that congest each other (individual scrapes ballooned to 20-84s;
  one `POST /claim` blocked 47s). Root cause: the scrape is triggered from FOUR places, each
  with a different, non-cache-aligned location string.

### The four trigger points (all confirmed)
| # | Location of trigger | Effect |
|---|---|---|
| 1 | `server/src/routes/cv-scan.ts:307` — `POST /cv-scan/job-titles` | fires scrape with LLM-inferred location |
| 2 | `server/src/routes/cv-scan.ts:318` — `POST /cv-scan/scrape-jobs`, called by modal on every debounced edit | fires scrape with mid-typed location (`Gosford,`, `Gosford, N`, …) |
| 3 | `server/src/routes/cv-scan.ts:400-401` — `POST /cv-scan/claim` | fires scrape AND blocks up to 45s (`waitForScrape`) |
| 4 | `server/src/routes/job-feed.ts` — `buildDailyFeedMultiSource` via `GET /api/job-feed/feed` | the intended single builder (normalized location) |

`server/src/services/ingestion/locationKey.ts` only collapses to a state code when a full
state token is present, so `Gosford,`, `Gosford, N`, `Gosford, NSW`, `Gosford, Australia`,
`, Australia` each produce a DIFFERENT cache key → every variant is a cache MISS → re-scrapes.

---

## 2. Locked decision (the design being implemented)

**Collapse to ONE builder.** The feed page (`buildDailyFeedMultiSource`, trigger #4) becomes
the single scrape path. Remove the cv-scan "head-start" scrape entirely (triggers #1, #2, #3).
`POST /cv-scan/claim` saves the profile and returns immediately; the dashboard's feed load
(`GET /api/job-feed/feed`) builds the feed once, with the final normalized location, cached.

Why this is safe (verified): claim sets `trialEndDate = now + 7 days`; `hasActiveAccess()`
(`server/src/middleware/accessControl.ts:16-22`) returns true for a future `trialEndDate`, so
`checkAccess(userId, 'job_search')` in the feed build gate returns `allowed: true` for a
freshly-claimed user. The feed will build.

Trade-off (accepted): jobs are no longer pre-warmed during the modal. The dashboard shows the
existing `FeedStateNotice` `building` state ("Your jobs are loading …") while the single build
runs (~3 parallel role scrapes, then cached). No new copy required.

**Out of scope for this spec** (do NOT touch): source reliability (SEEK blocking, JSearch
re-enable, adding Indeed/Jora), and the empty-state UX redesign. Those are a separate spec.

---

## 3. FIX 1 — Remove the scrape fan-out (server + frontend)

### 3a. `server/src/routes/cv-scan.ts`

**Edit A — `POST /cv-scan/job-titles`: remove the scrape side effect, keep the response.**
Find (around line 305-308):
```ts
    const { titles, location } = await suggestJobTitles(entry.resumeText, entry.result);
    const loc = location ?? 'All Australia';
    fireScrape(scanId, titles, loc);
    res.json({ titles, location: loc, firstName: entry.result.firstName ?? '' });
```
Replace with:
```ts
    const { titles, location } = await suggestJobTitles(entry.resumeText, entry.result);
    const loc = location ?? 'All Australia';
    res.json({ titles, location: loc, firstName: entry.result.firstName ?? '' });
```

**Edit B — delete the `POST /cv-scan/scrape-jobs` and `GET /cv-scan/scrape-jobs` endpoints.**
Delete the entire block (around lines 315-326):
```ts
router.post('/scrape-jobs', ipRateLimit, (req, res) => {
  const { scanId, titles, location } = req.body || {};
  if (!scanStore.has(scanId)) { res.status(404).json({ error: 'SESSION_EXPIRED' }); return; }
  fireScrape(scanId, normalizeTitles(titles), String(location || '').trim() || 'All Australia');
  res.json({ status: 'started' });
});

router.get('/scrape-jobs', (req, res) => {
  const e = jobScrapeStore.get(String(req.query.scanId || ''));
  if (!e) { res.json({ status: 'pending', count: 0 }); return; }
  res.json({ status: e.status, count: e.jobs.length });
});
```

**Edit C — `POST /cv-scan/claim`: stop firing/awaiting the scrape and stop writing feed items.**
Find (around lines 399-422):
```ts
    // make sure the head-start scrape exists; if the modal never fired it, fire now.
    if (!jobScrapeStore.has(scanId) && cleanTitles.length) fireScrape(scanId, cleanTitles, loc || 'All Australia');
    const jobs = await waitForScrape(scanId);

    // feedDate = AEST today, matching jobFeed.ts (reuse its exported helper).
    const today = todayAEST();
    await prisma.jobFeedItem.deleteMany({ where: { userId, feedDate: today } });
    if (jobs.length) {
      await prisma.jobFeedItem.createMany({
        data: jobs.map(j => ({
          userId, feedDate: today,
          title: j.title, company: j.company, location: j.location, salary: j.salary,
          description: j.description, sourceUrl: j.sourceUrl, sourcePlatform: j.sourcePlatform,
          postedAt: j.postedAt, matchScore: null,
        })),
      });
    }
    // Hand the first job back so the dashboard can preload it into the apply box
    // instantly, without waiting on the (slow) feed read.
    const f = jobs[0];
    const firstJob = f
      ? { title: f.title, company: f.company, location: f.location, description: f.description, sourceUrl: f.sourceUrl, sourcePlatform: f.sourcePlatform }
      : null;
    res.json({ jobCount: jobs.length, firstJob });
```
Replace with:
```ts
    // Feed building is owned solely by GET /api/job-feed/feed (single builder). The
    // claim just persists the profile and returns fast; the dashboard's feed load
    // triggers exactly one scrape with the final, normalized location.
    res.json({ ok: true });
```

**Edit D — delete the now-dead head-start machinery.** After Edits A-C, these are unused.
Delete each:
- The `ScrapeStatus` type and `ScrapeEntry` interface and `const jobScrapeStore` (around lines 81-83).
- `function trimJobScrapeStore() { … }` (around lines 85-90).
- `function fireScrape(scanId, titles, location) { … }` (around lines 98-105).
- `async function waitForScrape(scanId, maxMs = 45_000) { … }` and its leading comment
  (around lines 285-298).

**Edit E — remove imports left unused by the above.** Run `npx tsc --noEmit` from `server/`
and remove any import that tsc now reports as unused in `cv-scan.ts` (expected candidates:
`scrapeJobsForTitles`, `RawJob`, `todayAEST`, `randomUUID` — only remove the ones tsc flags).

**[STOP] after 3a.** Paste: the full `git diff server/src/routes/cv-scan.ts` and the output of
`npx tsc --noEmit` (run from `server/`). Do not continue to 3b until approved.

### 3b. `src/pages/GetStartedModal.tsx`

**Edit F — stop firing scrapes on edit; keep the state updates.**
Find (around lines 89-112):
```ts
  // ── Debounced scrape re-fire on role/location edit ────────────────────────

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fireScrape = useCallback((currentTitles: string[], currentLocation: string) => {
    if (!currentTitles.length) return;
    api.post('/cv-scan/scrape-jobs', { scanId, titles: currentTitles, location: currentLocation })
      .catch(() => {}); // fire-and-forget
  }, [scanId]);

  const onEditTitles = useCallback((newTitles: string[]) => {
    setTitles(newTitles);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fireScrape(newTitles, location), 600);
  }, [location, fireScrape]);

  const onEditLocation = useCallback((newLocation: string) => {
    setLocation(newLocation);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fireScrape(titles, newLocation), 600);
  }, [titles, fireScrape]);

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
```
Replace with:
```ts
  // Role/location edits update local state only. The actual job scrape is owned by
  // the dashboard feed build (GET /api/job-feed/feed), fired once after claim with
  // the final location — so editing here must NOT trigger any scrape.

  const onEditTitles = useCallback((newTitles: string[]) => {
    setTitles(newTitles);
  }, []);

  const onEditLocation = useCallback((newLocation: string) => {
    setLocation(newLocation);
  }, []);
```
If `useRef` / `useCallback` / `useEffect` become unused after this, leave their imports — they
are used elsewhere in the file (verify; do not remove imports that are still referenced).

**Edit G — remove the firstJob preload (claim no longer returns `firstJob`).**
Find (around lines 159-162):
```ts
      // Stash the first scraped job so the dashboard can preload it into the apply box.
      if (resp.data?.firstJob?.description) {
        localStorage.setItem('jobhub_preload_jd', JSON.stringify(resp.data.firstJob));
      }
```
Delete this block entirely. Leave the lines before and after it unchanged.

**[STOP] after 3b.** Paste `git diff src/pages/GetStartedModal.tsx` and the output of the
frontend type check (`npm run build` or `npx tsc --noEmit` from repo root, whichever the repo
uses). Do not continue until approved.

### 3c. No change to `job-feed.ts`

`buildDailyFeedMultiSource` is already the correct single builder (normalizes location, scrapes
3 roles in parallel, guarded by `buildingNow` + `builtToday === 0`). Do NOT modify it.

**[STOP] — Manual verification of FIX 1.** Provide these instructions to the human and wait:
1. Deploy FIX 1 to staging.
2. Fresh scan → modal → set location to a real city (e.g. "Gosford, NSW") → claim.
3. Confirm in logs: `POST /claim` returns in < 3s (NOT ~47s).
4. Confirm exactly ONE `[job-feed] FAST build` runs, and the only `[Ingestion]` scrapes are for
   the final location (no `Gosford,`, `Gosford, N`, `Gosford, Australia`, `, Australia` variants).
5. Confirm the dashboard shows the "building" state then the jobs.

---

## 4. FIX 2 — Migration hygiene (read-only diagnostics + commit files only)

> The human runs ALL DB mutations. DeepSeek only runs read-only `migrate status`, reports, and
> commits migration FILES. Editing a previously-applied migration's SQL causes a Prisma
> checksum mismatch, which is why a `migrate resolve` may be required — but that is a human step.

**Step 1 — [STOP] Diagnose staging.** Ask the human to run, against the STAGING database:
```
cd server && npx prisma migrate status
```
Paste the full output. Of particular interest: whether `20250616000001_add_crm_email_system` is
reported as failed, applied, or "modified after applied", and whether `20250619000001_add_followup_columns`
is applied. Do not proceed until the output is reviewed and a resolution path is approved.

**Step 2 — Commit the migration FILES (no DB commands).** Only after Step 1 is approved:
```
git add server/prisma/migrations/20250616000001_add_crm_email_system/migration.sql
git add server/prisma/migrations/20250619000001_add_followup_columns/
git status --short server/prisma/migrations/
```
**[STOP]** Paste `git status --short` and `git diff --cached --stat`. Wait for approval before
committing. (The human will decide the commit message and whether a `migrate resolve` is needed
on staging to clear the checksum mismatch.)

**Step 3 — [STOP] Diagnose production.** Ask the human to run `npx prisma migrate status`
against the PRODUCTION database and paste output. If prod still shows the failed CRM migration
(P3009) and/or missing follow-up columns, the human applies the same idempotent migrations +
any required `migrate resolve` themselves. DeepSeek does not run these.

---

## 5. FIX 3 — Correct the stale doc

Edit `docs/product-decisions/Jobs Scrape.txt`:

**Edit H — fix the adapter table (section 2).** Indeed and Jora adapters do NOT exist in the
codebase. The real adapters are: `adzuna.ts` (Adzuna API), `seek.ts` (Firecrawl), `jsearch.ts`
(disabled). Replace the table rows for Indeed and Jora with a note that they are not implemented,
and correct the `INGESTION_SOURCES` block to match `server/src/config/ingestion.ts`:
```
INGESTION_SOURCES = {
  adzuna: true,
  jsearch: false,  // Disabled (note in config: US-only data)
  seek: true,
  cache: true,
}
```
(There are no `indeed` or `jora` keys.)

**Edit I — fix the triggers table (section 4).** After FIX 1, the ONLY scrape trigger is the
job-feed builder. Replace the triggers table with:
```
| Route                                | File            | Trigger                          |
| POST /api/job-feed/refresh           | job-feed.ts     | User manually refreshes feed      |
| GET /api/job-feed/feed               | job-feed.ts     | Single builder; first daily load  |
| POST /api/job-feed/:id/start-apply   | job-feed.ts     | Hydrates one SEEK job description  |
| POST /api/job-feed/:id/fetch-desc.   | job-feed.ts     | Fetches one full description       |
```
Add a one-line note: "cv-scan.ts no longer triggers scraping (head-start removed 2026-06-19;
the feed builder is the single source)."

**[STOP] after FIX 3.** Paste `git diff "docs/product-decisions/Jobs Scrape.txt"`.

---

## 6. Final verification checklist (all must pass before declaring done)

- [ ] `npx tsc --noEmit` clean in `server/`.
- [ ] Frontend type check / build clean.
- [ ] Existing tests pass: `cd server && npm test` (esp. `userJobScrape.test.ts`,
      `runIngestion.test.ts`). If any test referenced the removed `/scrape-jobs` endpoint or
      head-start machinery, **[STOP]** and report — do not edit tests without approval.
- [ ] Manual staging check in Section 3 passed (single build, fast claim, no location variants).
- [ ] Migration files committed (Section 4 Step 2) after approval.
- [ ] Doc corrected (Section 5).

## 7. Out of scope (do NOT implement here)
- SEEK Firecrawl block mitigation (stealth proxy / geo).
- Re-enabling or fixing JSearch; adding Indeed/Jora adapters.
- Empty-state UX redesign / geographic fallback ladder / "notify me".
These belong to a separate spec and require Claude-owned copy + product decisions.

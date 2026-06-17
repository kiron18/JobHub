# Focused Apply View + Application Activity Metric (Design Spec)

**Date:** 2026-06-17
**Status:** Draft-pending-user-review
**Executor:** Kimi (zero-latitude plan, STOP-and-report guards)
**Scope:** The job-browsing surface becomes a **one-job-at-a-time focused apply view** (no list, no search, no filters), backed by a trustworthy **daily application metric** (progress bar) and a **GitHub-style activity heatmap** on the tracker page. Presentation layer over existing machinery; one new derived metric; one new heatmap. Dashboard stays minimal.

---

## 1. Product intent

The user should not *browse* jobs. They should be handed pre-vetted, most-relevant-first roles one at a time and either apply or skip — the fastest path to high-quality applications. Relevance is curated (sorted by a hidden score), so there is no need to look through search results. Progress toward a daily goal is shown as a thin bar; longer-term discipline is shown as a contribution heatmap on the tracker page (not the dashboard).

---

## 2. What already exists — REUSE, do not rebuild

| Capability | Existing endpoint / code | Use |
|---|---|---|
| Job data feed | `GET /api/job-feed/feed` → `jobFeedItem` rows (now fed multi-source via Kimi's `scrapeJobsForTitles`) | Source for the focused view. Sort client-side by `matchScore` desc. |
| Hidden relevance signal | `jobFeedItem.matchScore` / `matchDetails` | Sort key only. **Never displayed as a number.** |
| Preview (full JD) | `POST /api/job-feed/:id/fetch-description` | Hydrate on Preview click. |
| Apply → stepper | `handlePrepareAndApply` in `src/components/jobs/JobCard.tsx` → `navigate('/apply', …)` | Reuse verbatim for the Apply action. |
| Skip + undo | `PATCH /api/job-feed/:id/skip` + `GET/POST /api/job-feed/skipped(/restore)` | Reuse for "Not for me" + Undo toast. |
| Mark applied (metric trigger) | `POST /api/job-feed/:id/mark-applied` → creates `jobApplication` with `dateApplied` | The ONLY event that advances the metric. |
| Application records (metric source of truth) | `jobApplication` table (`userId`, `dateApplied`, `jobId`/`sourceUrl`, `status`) | Derived metric + heatmap read from here. |
| Revert | `POST /api/job-feed/application/:id/revert` | Clears `dateApplied` → metric decrements honestly. |
| Design tokens | `src/lib/theme/warmTokens.ts` (`warm.colors.*`) | All new UI uses these. Dashboard must match onboarding palette. |

**Resolved:** the metric counts `jobApplication.dateApplied` (DateTime?, null for SAVED-only rows; `status` defaults `SAVED`). **STOP-and-report guard A:** confirm `POST /:id/mark-applied` actually sets `dateApplied` (not only `status`). If apply sets only `status`, the metric must key off the status-change time instead — STOP and report rather than counting rows that were never truly applied.

---

## 3. The focused apply view

Replaces the multi-card list in the jobs surface (`src/pages/JobFeedPage.tsx`) with a single centred card. New component `src/components/jobs/FocusedApplyView.tsx`. Same data fetch as today (`/job-feed/feed`); render the highest-relevance unactioned job; advance on action.

**Card anatomy (uses `warm` tokens):**
- Title
- Company · Location · WorkMode · Salary (one meta line)
- **Factual chips (v1):** `via <source>` (from `sourcePlatform`, always present) and recency (`Posted today` / `2d ago` from `postedAt`). Facts only — no score, no judgement word. The `Matches: <keywords>` chip is **v1.1**: `matchDetails.keywords` is filled only by the entitlement-gated on-demand `/score` call, so it is not reliably present at feed load — do not render a match chip in v1. Multi-board (`on Seek + Indeed`) and visa-sponsor chips are also v1.1 (need `JobSource`/sponsor joins).
- **Actions:** `Apply →` (primary, loud — calls the existing `handlePrepareAndApply` flow), `Preview` (secondary, quiet — expands full JD inline, hydrating via `/fetch-description`), `Not for me` (tertiary — existing skip + Undo toast).
- A thin **daily progress bar** beneath the card (see §4).

**Flow:** Apply or skip → current card animates out, next-highest-relevance unactioned job slides in (Framer Motion, purposeful — drives toward the next application). Preview expands the JD inline with Apply at its foot; no route change until Apply is pressed (the deliberate jump into the `/apply` stepper).

**Sorting (resolved):** `jobFeedItem.matchScore` is populated at feed-build time by `quickScore(profile.skills, job)` (`server/src/services/jobFeed.ts:194`), and `GET /feed` already returns rows ordered `matchScore desc, postedAt desc, createdAt desc` (`server/src/routes/job-feed.ts:179`). The focused view therefore **renders the feed in the order received — no client re-sort.** Already-applied/skipped jobs are already excluded by `/feed`. (The richer, entitlement-gated `POST /:id/score` is a separate on-demand call that fills `matchDetails`; the base `matchScore` order does not depend on it.)

**States:** building ("Finding your matches…"), all-done ("That's your shortlist — N applications out today. Come back tomorrow."), empty ("No strong matches today — broaden your target role").

**Out of scope (v1):** the multi-board chip ("on Seek + Indeed") needs `JobSource[]` from Kimi's new `Job` table, which is not on `jobFeedItem`. Defer to v1.1. **Save-to-tracker** is removed from primary actions to keep two verbs (Apply / Skip); it stays reachable but de-emphasised. Do not add it back unless the user asks.

---

## 4. Daily application metric (progress bar)

**The invariant: the number is DERIVED on read, never stored or incremented.** Every render runs one query; there is no counter to drift or be gamed.

**Definition of one unit of progress:**
> A `jobApplication` for this user whose `dateApplied` falls within **today** (AEST), counted **distinct per job**.

**Period:** daily, midnight-to-midnight **AEST** (fixed timezone for deterministic bucketing). Default **goal = 5/day**.

**Goal storage:** new field `candidateProfile.dailyApplicationGoal Int @default(5)`. User-settable later; default is sufficient for v1.

**Display:** `applied / goal`, e.g. `3 of 5`. Bar fills to 100% at goal; beyond goal it shows an explicit over-state (`7 of 5 ✓ +2`) — never capped, never wrapped. Only `dateApplied`-today events move it; previews and skips never do.

**Integrity properties (all guaranteed by the definition):**
| Risk | Prevented because |
|---|---|
| Cheating by clicking | Only `dateApplied` being set counts; opening the stepper does nothing. |
| Double-counting | Distinct per job. |
| Bar ≠ tracker | Both read the same `jobApplication` rows. |
| Drift | Recomputed every read; nothing stored. |
| Un-apply | `/revert` clears `dateApplied` → leaves today's window → decrements. |

**New endpoint:** `GET /api/tracker/progress` → `{ appliedToday: number, goal: number }`, computed by counting distinct `jobApplication` where `dateApplied` is within today AEST.

**Resolved:** reuse `todayAEST()` (exported from `server/src/services/jobFeed.ts`, already used by `applicationCap.ts`) for the day boundary — query `dateApplied >= todayAEST()`. Do not introduce a second timezone convention.

---

## 5. Application activity heatmap (tracker page only)

GitHub-style contribution calendar on the tracker page (`src/pages/` tracker). New component `src/components/tracker/ActivityHeatmap.tsx`. **Same source of truth, different zoom:** each square = that day's distinct `dateApplied` count.

- **Range:** trailing 12 months, weeks as columns, weekday rows (Mon–Sun), matching the reference image.
- **Intensity tied to the daily goal (5):** 0 = empty/grey; 1–2 = light; 3–4 = mid; **5+ = darkest (goal met)**. A wall of dark green reads as "hit my target every day."
- Legend "Less ▢▢▢▣ More" and a small "What is this?" explainer, per the reference.
- Uses `warm` token greens for the scale.

**New endpoint:** `GET /api/tracker/activity` → `[{ date: 'yyyy-mm-dd', count: number }]` for the trailing 365 days, counts of distinct `jobApplication` per day (AEST), zero-filled for empty days.

**Dashboard cleanliness:** the heatmap appears ONLY on the tracker page. The dashboard and the focused apply surface show at most the thin daily bar. Do not place the heatmap on the dashboard.

---

## 6. Data model change

```prisma
// add to model CandidateProfile
dailyApplicationGoal Int @default(5)
```
No other schema change. `jobApplication` and `jobFeedItem` are reused as-is.

**STOP-and-report guard C:** Confirm the model is named `CandidateProfile` (the feed route reads `prisma.candidateProfile`). If different, adapt and report.

---

## 7. Out of scope (STOP and report if tempted)

Search/filter/sort UI, list view, multi-board chip, save-as-primary-action, changing the ingestion pipeline, the `/apply` stepper internals, monetization/funnel changes, putting the heatmap on the dashboard, any stored/incremented counter for the metric.

---

## 8. Acceptance criteria

1. The jobs surface renders ONE job at a time (`FocusedApplyView`), highest `matchScore` first, with factual chips and no visible score.
2. Apply triggers the existing prepare-and-apply → `/apply` navigation unchanged.
3. Preview expands the full JD inline, hydrating via `/fetch-description`.
4. "Not for me" skips with the existing Undo toast; skipped jobs leave the view and can be restored via the existing stash.
5. `GET /api/tracker/progress` returns `{ appliedToday, goal }` derived from `jobApplication.dateApplied` distinct-per-job within today AEST; unit-tested incl. distinct-dedup, the AEST boundary, and a reverted application decrementing the count.
6. Progress bar shows `applied / goal`, fills at goal, shows an over-state past goal, and never moves on preview or skip.
7. `GET /api/tracker/activity` returns trailing-365-day zero-filled per-day counts; the heatmap renders with goal-tied intensity buckets (5+ darkest) on the tracker page only.
8. The dashboard contains no heatmap and no relevance number.

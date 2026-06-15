# Streamlined Dashboard (Slice B) — Design Spec

**Date:** 2026-06-05
**Status:** Approved-pending-spec-review
**Part of:** [[project_apply_funnel_slices]]. Sibling of Slice C (de-frictioned apply). Builds toward [[project_monetization_model]].

---

## 0. Where this sits

The post-scan funnel decomposes into A (account seam), **B (this spec — streamlined dashboard)**, C (de-frictioned apply, in flight), D (video + 7-day challenge). B reshapes the authenticated dashboard (`StrategyHub` at `/`) into a single outcome: **apply to matched jobs, repeatedly.**

**Key finding that scopes B down:** a complete daily job-feed already exists and is **free-tier capable** — `GET /api/job-feed/feed` returns the user's matched `JobFeedItem`s and, when empty, `buildDailyFeed(userId)` scrapes for their profile (`targetRole` + `targetCity`). The feed *read* is not premium-gated (free tier gets 1 lifetime build via `checkAccess(userId, 'job_search')`). So **B needs no new backend and does not depend on Slice A.** A later just *seeds* this feed from the fix-resume scan. B is almost entirely frontend.

---

## 1. Goal

Replace `StrategyHub`'s seven-panel layout with a streamlined dashboard whose only job is to get the user applying: a list of matched roles, each with a prominent **Apply now** that drops straight into the Slice C workspace. Everything that isn't "apply to the next job" is hidden (drip-released later as tutorial unlocks).

**Locked product decisions (do not re-litigate):**
- The five strategy panels are **hidden, not deleted** — preserved behind a `false` feature-flag for later drip-release.
- **Keep** a secondary, de-emphasised "paste your own JD" safety net (for an empty/zero feed).
- **Hide** the per-card match score (reads as judgmental to an anxious user; the score machinery is also premium-gated per-item).
- Hero = **vertical list of lean Apply-now cards** (not one-at-a-time).
- **Keep** the greeting header + apply-goal counter (`GoalChip`) — it drives "apply to many."

**Honor:** [[feedback_dashboard_style]] (reuse `warm`/`warmT` tokens, match onboarding — no new aesthetic), [[feedback_purposeful_animation]], [[feedback_microcopy_latitude]], [[feedback_copy_ownership_split]] (Claude authors copy in a locked file), [[feedback_six_second_report]].

---

## 2. Dashboard composition (after)

```
StrategyHub (/)
├─ FirstApplicationCelebration          (kept — Slice D will build on this seam)
├─ HubHeader                            (kept; headline/subline copy rewritten to point at the feed)
│   ├─ identity line (role · city)
│   ├─ GoalChip (apply counter)         (kept)
│   └─ "Your applications →" link        (NEW — quiet link to /tracker)
│
├─ ── PRIMARY: Matched jobs ──          (NEW hero)
│   GET /api/job-feed/feed?offset=0
│   ├─ building   → "Finding roles that fit you…" + poll
│   ├─ profileIncomplete → nudge to add target role/city + show PasteJobBox
│   ├─ jobs[]     → vertical list of <ApplyNowCard>
│   └─ empty (built, 0) → "No live matches right now" + PasteJobBox
│
├─ ── SECONDARY: PasteJobBox ──         (NEW, de-emphasised)
│   "Have a specific job? Paste it" → textarea → /apply (sc:false)
│
└─ ── HIDDEN behind `false` flag ──     (drip-release later, preserved)
    AnalysisHeroCard, StrategicInsightsPanel, StaleApplicationsCard,
    StrategicIntelligenceCard, CoherenceCard, PipelineGlance
```

---

## 3. Components & changes

### 3.1 `ApplyNowCard.tsx` — NEW (`src/components/dashboard/`)
Lean card for one `JobFeedItem`. Renders title · company · location only. **No** match score, **no** premium per-card actions (save / find-addressee / fetch-description). One primary **Apply now** button.

**Props:** `{ item: JobFeedItem }` (type imported from `../jobs/JobCard`).

**Apply now** navigates exactly as `JobCard.handlePrepareAndApply` does (so Slice C receives the same context and auto-derives gaps):
```ts
navigate('/apply', {
  state: {
    jobDescription: item.description,
    company: item.company,
    role: item.title,
    feedItemId: item.id,
    sourceUrl: item.sourceUrl,
    sourcePlatform: item.sourcePlatform,
  },
});
```
It also mirrors `JobCard`'s `localStorage` writes (`jobhub_current_jd`, `jobhub_apply_context`) for continuity. No call to the premium-gated `/job-feed/:id/mark-applied` — marking applied happens later via the tracker (Slice C's TrackStep → `/jobs`, not premium-gated).

### 3.2 `PasteJobBox.tsx` — NEW (`src/components/dashboard/`)
The secondary safety net. A collapsed "Have a specific job? Paste it" affordance that expands to a textarea + Continue. On submit (≥ ~50 chars) → `navigate('/apply', { state: { jobDescription: trimmed, sc: false } })`. No analysis, no SC toggle, no bridged-gaps UI (Slice C auto-derives). All copy from `dashboardCopy.ts`.

### 3.3 `StrategyHub.tsx` — streamlined composition
- **Add** a feed query (`useQuery` on `/job-feed/feed`) with a **building poll** (refetch every ~4 s while `building` is true and no jobs yet — mirror `JobFeedPage`'s existing poll pattern; the plan will lift the exact interval/stop conditions from it).
- **Render** the new layout: `HubHeader` (with the new "Your applications →" link) → matched-jobs section (building / profileIncomplete / list / empty states) → `PasteJobBox`.
- **Hide the five panels + `AnalysisHeroCard`** behind a single module-level flag so `noUnusedLocals` stays satisfied and drip-release is a one-line flip:
  ```tsx
  // Drip-release flags — flip to true to resurface a panel as a tutorial unlock.
  const SHOW = { analyseHero: false, insights: false, staleApps: false, intelligence: false, coherence: false, pipeline: false } as const;
  // …
  {SHOW.insights && <StrategicInsightsPanel />}
  ```
  (The component definitions remain in the file, referenced inside `{SHOW.x && …}`, so they are not unused.)
- `HubHeader` headline + subline copy comes from `dashboardCopy.ts` (rewritten to point at matched jobs, not "paste any JD").

### 3.4 `dashboardCopy.ts` — NEW locked copy (`src/pages/`, Claude-authored)
All user-facing strings for B: header headline/subline, the matched-jobs section label, building/empty/profileIncomplete copy, the `PasteJobBox` label + placeholder + CTA, the "Your applications →" link label. DeepSeek imports + renders verbatim.

---

## 4. Data flow & contracts (all existing, reused)

- `GET /api/job-feed/feed?offset=0` → `{ jobs: JobFeedItem[]; total: number; hasMore: boolean; feedDate: string; building?: boolean; profileIncomplete?: boolean }`.
- `JobFeedItem` shape: `{ id, title, company, location?, description, sourceUrl, sourcePlatform, matchScore?, … }` (Prisma model; type already exported from `../jobs/JobCard` as `JobFeedItem`).
- Apply-now → `/apply` `location.state` (consumed by Slice C `StepperWorkspace`).
- "Your applications" → `/tracker` (existing route).

No new endpoints, no schema/Prisma changes, no env vars.

---

## 5. States & error handling

| Case | Behaviour |
|---|---|
| Feed `building: true` (or first load, 0 jobs, not profileIncomplete) | Show "Finding roles that fit you…" + poll `/feed` every ~4 s until jobs arrive or `profileIncomplete`. |
| `profileIncomplete: true` | Nudge: "Add your target role and city to see matched jobs" → link to `/workspace` (profile); also show `PasteJobBox` so the user is never stranded. |
| Built, `jobs: []` (genuinely none) | "No live matches right now" + `PasteJobBox`. |
| `/feed` 402 (free build limit reached, no jobs) | Show the existing jobs if any; else fall back to `PasteJobBox` with a calm line. Never a hard wall (free funnel). |
| `/feed` network/500 | Calm retry line + `PasteJobBox` fallback. |

---

## 6. Testing

- `npx tsc -p tsconfig.app.json --noEmit` clean (watch `noUnusedLocals` on the hidden panels).
- Manual `/` run for a free user with a complete profile: dashboard shows building → matched cards → **Apply now** drops into the Slice C workspace with the right job context; `PasteJobBox` also routes to `/apply`; the five panels are absent; `GoalChip` + "Your applications →" present.
- Manual `/` run for a profile missing target role/city: shows the profile nudge + `PasteJobBox`.

---

## 7. Files

**New:**
- `src/components/dashboard/ApplyNowCard.tsx`
- `src/components/dashboard/PasteJobBox.tsx`
- `src/pages/dashboardCopy.ts` (Claude-authored, locked)

**Modified:**
- `src/pages/StrategyHub.tsx` — streamlined composition, feed query + build poll, hide panels behind `SHOW` flags, header copy from `dashboardCopy.ts`.

**Untouched:** all `job-feed` / `jobs` / `analyze` / `generate` backend, `JobCard`, the tracker, auth, the hidden panel components' internals, Slice C.

---

## 8. Out of scope (do NOT build in B)

Account seam (A) and seeding the feed from the fix-resume scan; video + 7-day challenge (D); any `job-feed` backend change; resurrecting the disabled in-feed card scoring; the selection-criteria path on the secondary paste; deleting (vs hiding) the strategy panels.

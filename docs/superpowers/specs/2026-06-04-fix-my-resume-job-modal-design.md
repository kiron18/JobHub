# Fix-my-Resume → Job-Selection Modal → Background Scrape (Design Spec)

**Date:** 2026-06-04
**Status:** Approved-pending-review
**Scope of THIS build:** the slice **after the email/roadmap unlock**, ending the moment scraped jobs are stored server-side. Fully **anonymous**, keyed by `scanId`. **NO dashboard, NO auth, NO Stripe, NO generation.**

---

## 1. Context & decisions already locked

This continues the flow in [[project_fix_resume_flow_brainstorm]]. Today the post-email flow dead-ends: email → `POST /cv-scan/lead` → `runRoadmap` returns a 7-step roadmap rendered inline in `src/pages/MockLandingPage.tsx`, everything anonymous and keyed by `scanId` in an in-memory `scanStore` (60-min TTL, 100 cap) holding `{ resumeText, result }`.

**Locked in brainstorming (do not re-litigate, just implement):**
- **Modal-replaces-loading:** the job-selection modal IS the wait — the scrape warms in the background while the user reads/edits.
- **3 LLM-inferred, locally-attainable titles** (down-rank roles a foreign-only candidate gets auto-rejected for — reasoned in the prompt, not rule-based) + a location field.
- **Reuse the existing Apify/Seek pipeline** (`fetchSeekJobsForCluster`), not Firecrawl.
- Report screen = the **existing inline 7-step roadmap**; we only add the "Fix my Resume" CTA below it.
- Scope **ends at scrape kickoff**: results stored server-side by `scanId`, ready for a future dashboard slice to consume.

**Out of scope (do NOT build):** dashboard/StrategyHub changes, account creation, Stripe, document generation, sponsor-classification of these jobs (separate build), the single-screen report redesign.

**Honor:** [[feedback_purposeful_animation]] (motion drives toward the CTA), [[feedback_microcopy_latitude]] (write supporting copy), [[feedback_dashboard_style]] / visual consistency (reuse MockLandingPage's existing `colors` + `typeTokens` + `SlideIn` — do NOT invent a new aesthetic), [[feedback_six_second_report]].

---

## 2. End-to-end flow (this slice)

```
[existing 7-step roadmap]
   │  user clicks  ┌─────────────────────────┐
   └─────────────► │  "Fix my Resume  →"      │  (ETA ~1 min subtext)
                   └─────────────────────────┘
                          │ opens modal
                          ▼
   FixMyResumeModal opens with a skeleton
     1. POST /cv-scan/job-titles {scanId}
          → { titles:[3], location, firstName }     (~2–5s, LLM)
     2. chips + location populate; AUTO →
        POST /cv-scan/scrape-jobs {scanId, titles, location}  → {status:'started'}
     3. poll GET /cv-scan/scrape-jobs?scanId=  every 2s → {status, count}
     4. user may edit titles/location → re-POST scrape-jobs (supersedes)
     5. "See my jobs →" enables when status==='ready'
          → terminal success state for THIS slice
            ("Found N roles matching your profile" — jobs held by scanId)
```

---

## 3. Backend

All in `server/src/routes/cv-scan.ts` + two new services. LLM calls use the house pattern: `callLLMWithRetry(prompt, true, 3, 0)` (from `server/src/utils/callLLMWithRetry`) + `parseLLMJson` (from `server/src/utils/parseLLMResponse`), temperature 0 for determinism.

### 3.1 New in-memory store (mirror `scanStore`)
In `cv-scan.ts`, add alongside `scanStore`:

```ts
type ScrapeStatus = 'pending' | 'ready' | 'error';
interface ScrapeEntry {
  requestId: string;          // newest request wins (supersede stale completions)
  status: ScrapeStatus;
  titles: string[];
  location: string;
  jobs: RawJob[];             // RawJob from ../services/jobFeed
  error: string | null;
  at: number;
}
const jobScrapeStore = new Map<string, ScrapeEntry>();
```
Apply the **same eviction** helper pattern as `scanStore` (cap 100, keep most-recent by `at`). 60-min TTL semantics: entries older than 60 min are treated as absent on read.

### 3.2 `POST /cv-scan/job-titles`
- Body: `{ scanId: string }`.
- Look up `scanStore.get(scanId)`. If missing/expired → `404 { error: 'SESSION_EXPIRED' }`.
- Call new service `suggestJobTitles(entry.resumeText, entry.result)`.
- Respond `{ titles: string[] /* 1–3 */, location: string | null, firstName: string }` (firstName from `entry.result.firstName ?? ''`).
- IP-rate-limit with the existing `ipRateLimit` middleware (same as the scan route).

### 3.3 New service `server/src/services/jobTitleSuggest.ts`
```ts
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { parseLLMJson } from '../utils/parseLLMResponse';
import type { CvGapResult } from './cvGapScan';

export interface TitleSuggestion { titles: string[]; location: string | null; }

// PURE — unit-testable, no network. Builds the prompt.
export function buildTitlePrompt(resumeText: string, inferredRole: string): string {
  return [
    'You are an Australian recruitment strategist.',
    'Given a candidate resume, return the 3 job titles this person can REALISTICALLY land in Australia RIGHT NOW.',
    'Critical rule: candidates whose experience is entirely overseas get auto-rejected for senior/manager roles here (employers assume skills are not transferable and there is no local vouch).',
    'So if their experience is foreign-only or thin locally, down-rank seniority: suggest the realistic entry/bridge rung (e.g. "Marketing Coordinator", not "Head of Marketing"), reasoned from the resume — never a fixed rule.',
    'Also infer their most likely job-search location (city) from the resume, or null if genuinely unclear.',
    `Their inferred current role is: ${inferredRole || 'unknown'}.`,
    'Return STRICT JSON only: {"titles": ["..","..",".."], "location": "City, State" | null}. Exactly 3 titles, most-attainable first.',
    '--- RESUME ---',
    resumeText.slice(0, 12000),
  ].join('\n');
}

export async function suggestJobTitles(resumeText: string, result: CvGapResult): Promise<TitleSuggestion> {
  const inferredRole = result.inferredRole || '';
  try {
    const raw = await callLLMWithRetry(buildTitlePrompt(resumeText, inferredRole), true, 3, 0);
    const parsed = parseLLMJson(raw) as { titles?: unknown; location?: unknown };
    const titles = Array.isArray(parsed.titles)
      ? parsed.titles.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 3)
      : [];
    const location = typeof parsed.location === 'string' && parsed.location.trim() ? parsed.location.trim() : null;
    if (titles.length === 0) throw new Error('no titles');
    return { titles, location };
  } catch {
    // Robust fallback — never block the user on an LLM hiccup.
    return { titles: [inferredRole || 'Entry-level roles'], location: null };
  }
}
```

### 3.4 `POST /cv-scan/scrape-jobs`
- Body: `{ scanId: string, titles: string[], location: string }`.
- Validate `scanStore.has(scanId)` else `404 { error: 'SESSION_EXPIRED' }`.
- Normalize: `titles` trimmed, deduped, max 3, drop empties; `location` trimmed, default `'All Australia'` if empty.
- Generate `requestId = randomUUID()`. Write `jobScrapeStore.set(scanId, { requestId, status:'pending', titles, location, jobs:[], error:null, at:Date.now() })`.
- **Fire-and-forget** the scrape (do NOT `await` in the handler): call `scrapeJobsForTitles(titles, location)`, then **only if** `jobScrapeStore.get(scanId)?.requestId === requestId` (not superseded) write `{ status:'ready', jobs }`; on throw write `{ status:'error', error }` (same supersede check). Wrap in `.catch`.
- Respond immediately `200 { status: 'started' }`.

### 3.5 `GET /cv-scan/scrape-jobs?scanId=`
- Read `jobScrapeStore.get(scanId)`; if missing → `{ status: 'pending', count: 0 }` (scrape not started yet / expired).
- Else respond `{ status, count: entry.jobs.length, titles: entry.titles, location: entry.location, error: entry.error }`.

### 3.6 New service `server/src/services/userJobScrape.ts`
```ts
import type { RawJob } from './jobFeed';
import { buildSeekClusterKey, fetchSeekJobsForCluster } from './seekScraper';
import { deduplicateJobs } from '../utils/deduplicateJobs';

export async function scrapeJobsForTitles(titles: string[], location: string): Promise<RawJob[]> {
  const all: RawJob[] = [];
  for (const title of titles) {
    const key = buildSeekClusterKey(title, location, null);
    const jobs = await fetchSeekJobsForCluster(key); // default maxResults 30, dateRange 7
    all.push(...jobs);
  }
  return deduplicateJobs(all); // existing util; if signature differs, dedupe by sourceUrl
}
```
*(If `deduplicateJobs`'s signature/shape doesn't fit `RawJob[]`, fall back to a local dedupe by `sourceUrl` — STOP-and-report the mismatch rather than guessing.)*

---

## 4. Frontend

### 4.1 "Fix my Resume" CTA — `src/pages/MockLandingPage.tsx`
In the `{roadmap && ( ... )}` block (after the 7-step list, ~line 499+), append a CTA:
- Full-width button, label **"Fix my Resume →"**, sublabel **"ETA ~1 min"**.
- Reuse existing `colors.accentPetrol` / `typeTokens`; use the same `motion.button` pulse idiom already used by the "Unlock my roadmap" button so it draws the eye toward the next action (purposeful, not decorative — [[feedback_purposeful_animation]]).
- On click → `setShowFixModal(true)`. Pass `scanId={result.scanId}` and `firstName={result.firstName}` to the modal.

### 4.2 New component `src/pages/FixMyResumeModal.tsx`
A centered mainstage modal. Reuse MockLandingPage's `colors`, `typeTokens`, and motion conventions (same source module — do not introduce a new design system).

**Props:** `{ scanId: string; firstName?: string; onClose: () => void }`.

**State:** `titles: string[]`, `location: string`, `titlesLoading: boolean`, `scrapeStatus: 'idle'|'pending'|'ready'|'error'`, `count: number`.

**Lifecycle:**
1. On mount: `titlesLoading=true` → `POST /cv-scan/job-titles {scanId}`. On success set `titles` (≤3), `location = resp.location ?? 'All Australia'`, `titlesLoading=false`, then immediately call `startScrape()`. On `404 SESSION_EXPIRED` → show expired state (copy: "Your session timed out — re-run your scan to continue.") with a close button.
2. `startScrape()`: `POST /cv-scan/scrape-jobs {scanId, titles, location}` → `scrapeStatus='pending'`; begin polling `GET /cv-scan/scrape-jobs?scanId=` every **2000ms**; on `status==='ready'` set `count`, stop polling; on `'error'` set error state but still allow proceed.
3. Editing a title chip (edit/add/remove, **max 3**) or the location field → debounce **600ms** → `startScrape()` again (supersedes; button disables, spinner returns).

**Layout & copy (microcopy latitude — refine as needed):**
- Header: **"Hey {firstName} — while you check these, we're already searching."**
- Subhead: **"These are the roles you're most likely to land in Australia right now."**
- 3 editable **title chips** (pencil-to-edit, ✕ to remove, "+ add role" while <3). While `titlesLoading`, show 3 shimmer skeleton chips.
- **Location** input: pre-filled, free-text, with nudge microcopy: **"Local roles get more callbacks — but you can search anywhere."**
- Primary button **"See my jobs →"**: disabled while `scrapeStatus !== 'ready'`; shows a subtle searching pulse + "Finding your matches…" while `pending` (the modal-IS-the-wait moment — motion must point at this button).
- `error` / `count===0`: copy "We couldn't pull live matches right now — try a different title or location," but keep the button enabled to proceed.

**On "See my jobs →" (ready):** transition the modal to a **terminal success state for this slice**:
- Copy: **"Found {count} roles matching your profile."** + a muted line **"Your workspace is being prepared…"** (placeholder seam — the next slice wires the dashboard). Provide a close (✕) control.
- Do NOT navigate anywhere or call any dashboard/generation code. The jobs are already persisted server-side by `scanId`.

### 4.3 API calls
Use the existing `api` client (`src/lib/api`) as `MockLandingPage` already does. Poll with a `setInterval` cleared on unmount and on `ready`/`error`.

---

## 5. Error handling summary

| Case | Backend | Frontend |
|---|---|---|
| `scanId` expired/missing | `404 { error:'SESSION_EXPIRED' }` | Expired state + close |
| LLM title inference fails | `suggestJobTitles` returns `{titles:[inferredRole],location:null}` | Renders 1 chip; user can add more |
| Apify key missing / 0 results | scrape resolves, `status:'ready'`, `jobs:[]` | "couldn't pull live matches" + proceed allowed |
| Scrape throws | `status:'error'` (supersede-checked) | error copy + proceed allowed |
| User edits mid-scrape | new `requestId` supersedes; stale completion discarded | spinner resets, re-polls |

---

## 6. Testing

**Backend (Vitest, colocated `*.test.ts`):**
1. `buildTitlePrompt` (pure): asserts the prompt contains the resume text and the inferred role and the local-experience down-rank instruction.
2. `suggestJobTitles` fallback: stub `callLLMWithRetry` to throw → returns `{ titles:[inferredRole], location:null }`.
3. `suggestJobTitles` happy path: stub returns valid JSON → titles capped at 3, empty strings dropped.
4. Supersede logic: a helper or the handler writes results only when `requestId` matches (unit-test the guard as a small pure function if extracted).

**Frontend:** manual verification (no component-test harness required for this slice):
- Click "Fix my Resume" → modal opens with skeleton → chips + location populate → button shows "Finding your matches…" → enables → click → success state with a plausible count.
- Edit a title → button re-disables, spinner returns, re-enables.

**Acceptance:** end-to-end on `/mock-landing` with a real resume: scan → email → roadmap → Fix my Resume → modal → "See my jobs" → success state; confirm `GET /cv-scan/scrape-jobs?scanId=` returns `status:'ready'` with `count>0` for a common title.

---

## 7. Files

**New:**
- `server/src/services/jobTitleSuggest.ts` (+ `.test.ts`)
- `server/src/services/userJobScrape.ts`
- `src/pages/FixMyResumeModal.tsx`

**Modified:**
- `server/src/routes/cv-scan.ts` — `jobScrapeStore` + 3 endpoints (`job-titles`, `scrape-jobs` POST/GET).
- `src/pages/MockLandingPage.tsx` — "Fix my Resume" CTA + modal mount/state.

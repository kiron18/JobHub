# Account Seam (Slice A) — Get-Started Modal → Account → Jobs (Design Spec)

**Date:** 2026-06-06
**Status:** Approved-pending-spec-review
**Builds on:** [[project_fix_resume_flow_brainstorm]], [[project_monetization_model]], [[project_apply_funnel_slices]]. Implements **Subsystem A** ("Account seam: anonymous `scanId` → account") from `docs/superpowers/specs/2026-06-05-defrictioned-apply-workspace-design.md` §0, and absorbs the previously-unbuilt job-modal backend from `docs/superpowers/specs/2026-06-04-fix-my-resume-job-modal-design.md`.

---

## 0. What changed vs. the 2026-06-04 spec (read first)

The 2026-06-04 fix-my-resume modal was specced **anonymous, no auth**, ending at an in-memory scrape keyed by `scanId`. **That backend was never built.** Per the founder's 2026-06-06 decision, account creation now happens **at this step**: the user sets a password, the account is created **first**, and all data is saved to it. So this slice *supersedes* the 2026-06-04 spec's "no auth / ends at scrape" scoping and merges the job inference + scrape into one account-creating step.

**Founder decisions locked 2026-06-06 (do not re-litigate):**
- **Account first.** Capture password, create the user, *then* save data to that user. Email is already known (captured for the roadmap), so the only new field is the password.
- **One low-friction step.** The roles + location are pre-inferred and editable; the scrape warms in the background; the user's only required action is "type a password."
- **Land on the jobs view** (`/jobs`) with matches ready (the path that already feeds `/apply`).

**Honor:** [[feedback_no_em_dashes]] (NO em/en dashes in any copy or prompt), [[feedback_copy_ownership_split]] (Claude authors all copy + prompt text in a locked file; DeepSeek transcribes mechanics only), [[feedback_purposeful_animation]], [[feedback_six_second_report]], [[feedback_dashboard_style]] (reuse MockLandingPage `colors`/`typeTokens`, no new aesthetic), [[feedback_robust_over_quick]], [[feedback_deepseek_zero_latitude_plans]].

---

## 1. Current state (verified in code)

- `src/components/landing/ScanReveal.tsx` final roadmap beat now renders a primary CTA **"Start fixing my resume"** wired to `onEnterDashboard` (currently a stopgap `navigate('/auth?...')` in `MockLandingPage.tsx` — **this slice replaces that destination with the new modal**).
- `server/src/routes/cv-scan.ts` has only `POST /` (scan) and `POST /lead` (email → roadmap). It holds:
  - `scanStore: Map<scanId, { resumeText, result, at }>` (60-min TTL, cap 100). **This is the source of the resume + parsed result we persist.**
- Auth: `server/src/middleware/auth.ts` exports `authenticate`, which sets `req.user = { id, email }` (Supabase user id). DEV bypass exists.
- Profiles: `CandidateProfile` keyed by `userId` (`@unique`). Created via upsert (pattern in `server/src/routes/onboarding.ts:105`). Resume text lives in `resumeRawText`; target role/city in `targetRole`/`targetCity`.
- Jobs: per-user `JobFeedItem` rows (`userId`, `feedDate`, `title`, `company`, `location`, `salary`, `description`, `sourceUrl`, `sourcePlatform`, `postedAt`, `matchScore`). Written via `jobFeedItem.createMany` (pattern in `server/src/services/jobFeed.ts:220`).
- Scraper: `fetchSeekJobsForCluster(cluster, opts?)` + `buildSeekClusterKey(role, city, industry|null)` in `server/src/services/seekScraper.ts`; returns `RawJob[]` (`server/src/services/jobFeed.ts:11`). Uses Apify with `waitSecs: 180` (slow → must background).
- Client auth: `AuthPage` uses `supabase.auth.signUp({ email, password })`. `src/lib/supabase` exports the client. The `api` client attaches the Supabase session token to requests (used by all authed routes today).

---

## 2. End-to-end flow (this slice)

```
[7-step roadmap]  ── user clicks "Start fixing my resume" ──►  GetStartedModal opens
   │
   1. POST /cv-scan/job-titles { scanId }
        → { titles:[≤3], location, firstName }      (~2–5s, LLM; robust fallback)
        AND server fires the anonymous Seek scrape in the background (keyed by scanId).
   2. Modal shows: email (read-only, prefilled) + ONE password field
                   + 3 editable role chips + location (prefilled).
   3. User edits roles/location (optional) → debounced re-fire of the background scrape.
   4. User types password → clicks "Create my workspace".
        a. supabase.auth.signUp({ email, password })          ← ACCOUNT CREATED FIRST
        b. POST /cv-scan/claim { scanId, titles, location }    ← authenticated
             - upsert CandidateProfile (resume, name, targetRole/City, hasCompletedOnboarding=true)
             - await background scrape readiness (it usually finished during password entry)
             - persist jobs → JobFeedItem rows for this user
             - return { jobCount }
        c. set localStorage flags → navigate('/jobs')
   ▼
/jobs renders the freshly-persisted matches → "Apply" → /apply (Slice C, already built)
```

**Why account-first is clean here:** once the Supabase session exists, `claim` runs as the authenticated user and writes straight to that user's rows. No anonymous-jobs-then-reassign dance. The background scrape is only a head-start fetch (cached in `SeekJobCache` + an in-memory status store); `claim` is the single authoritative persistence step.

---

## 3. Backend (all in `server/src/routes/cv-scan.ts` + two services)

### 3.1 In-memory scrape store (mirror `scanStore`)
```ts
type ScrapeStatus = 'pending' | 'ready' | 'error';
interface ScrapeEntry {
  requestId: string;   // newest request wins (supersede stale completions)
  status: ScrapeStatus;
  titles: string[];
  location: string;
  jobs: RawJob[];      // RawJob from ../services/jobFeed
  error: string | null;
  at: number;
}
const jobScrapeStore = new Map<string, ScrapeEntry>();  // 60-min TTL, cap 100 (same eviction as scanStore)
```

### 3.2 `POST /cv-scan/job-titles` (public, ipRateLimit)
- Body `{ scanId }`. Look up `scanStore`; missing/expired → `404 { error:'SESSION_EXPIRED' }`.
- `const { titles, location } = await suggestJobTitles(entry.resumeText, entry.result)`.
- **Fire the background scrape immediately** (same logic as 3.3's fire-and-forget) using `titles` + `(location ?? 'All Australia')`.
- Respond `{ titles, location: location ?? 'All Australia', firstName: entry.result.firstName ?? '' }`.

### 3.3 `POST /cv-scan/scrape-jobs` (public, ipRateLimit) — re-fire on edit
- Body `{ scanId, titles, location }`. Validate `scanStore.has(scanId)` else `404 SESSION_EXPIRED`.
- Normalize titles (trim, dedupe, drop empty, max 3); location trim, default `'All Australia'`.
- `requestId = randomUUID()`; write `jobScrapeStore` entry `status:'pending'`.
- **Fire-and-forget** `scrapeJobsForTitles(titles, location)`; on resolve/throw, write `ready`/`error` **only if** `jobScrapeStore.get(scanId)?.requestId === requestId`.
- Respond `200 { status:'started' }`.

### 3.4 `GET /cv-scan/scrape-jobs?scanId=` (public) — optional progress UI
- Return `{ status, count: entry.jobs.length }` (missing → `{ status:'pending', count:0 }`).

### 3.5 `POST /cv-scan/claim` (AUTHENTICATED — `authenticate` middleware)
- `userId = req.user.id`, `email = req.user.email`.
- Body `{ scanId, titles, location }`.
- Look up `scanStore`; missing/expired → `410 { error:'Your scan expired, please scan again.' }`.
- **Upsert `CandidateProfile`** (create + update) with:
  `userId`, `email`, `name = result.fullName || null`, `resumeRawText = entry.resumeText`,
  `targetRole = titles[0] || result.inferredRole || null`, `targetCity = location || null`,
  `location = location || null`, `hasCompletedOnboarding = true`, `marketingConsent = true`, `marketingEmail = email`.
  *(Setting `hasCompletedOnboarding=true` keeps the dashboard from routing them back into onboarding.)*
- **Resolve jobs:** await scrape readiness via an internal bounded wait on `jobScrapeStore` (poll the in-memory entry every 1s up to 90s): if `ready` use `entry.jobs`; if `error`/timeout/missing use `[]` (never block account success on the scrape).
- **Persist jobs** → `jobFeedItem.deleteMany({ userId, feedDate: today })` then `createMany` mirroring `jobFeed.ts:220` (feedDate = AEST today; `matchScore: null` for this slice).
- Respond `200 { jobCount }`.

### 3.6 Services
- **`server/src/services/jobTitleSuggest.ts`** — `suggestJobTitles(resumeText, result)` + pure `buildTitlePrompt(...)`. Verbatim from the 2026-06-04 spec §3.3 (prompt is Claude-authored, em-dash-free). Robust fallback returns `{ titles:[inferredRole||'Entry-level roles'], location:null }`.
- **`server/src/services/userJobScrape.ts`** — `scrapeJobsForTitles(titles, location)`: for each title, `fetchSeekJobsForCluster(buildSeekClusterKey(title, location, null))`, concat, then dedupe. **STOP-and-report** if `deduplicateJobs`'s signature doesn't accept `RawJob[]` — fall back to local dedupe by `sourceUrl`.

---

## 4. Frontend

### 4.1 `src/pages/getStartedCopy.ts` — NEW locked copy file (Claude-authored)
Full contents in the implementation plan. DeepSeek creates it verbatim, imports + renders, never rewords. **No em/en dashes anywhere.**

### 4.2 `src/pages/GetStartedModal.tsx` — NEW
Centered modal, reuses MockLandingPage `colors` + `typeTokens` + motion idioms.
- **Props:** `{ scanId: string; firstName?: string; email: string; onClose: () => void }`.
- **State:** `titles`, `location`, `titlesLoading`, `password`, `submitting`, `error`, `expired`.
- **On mount:** `POST /cv-scan/job-titles {scanId}` → set titles/location; on `404` → expired state.
- **Editing** roles/location → debounce 600ms → `POST /cv-scan/scrape-jobs` (keeps the head-start warm; supersede on the server).
- **Submit "Create my workspace":** validate password (≥8 chars) → `supabase.auth.signUp({ email, password })`. On error → show error, stay. On success → `api.post('/cv-scan/claim', { scanId, titles, location })` → on success set `localStorage.jobhub_auth_email=email`, `localStorage.jobhub_report_seen='true'` → `navigate('/jobs')`. Button shows "Setting up your workspace…" while submitting.
- Email rendered **read-only** ("Saving to {email}"). Roles as editable chips (≤3, add/remove), location as a text input with the nudge line.

### 4.3 `MockLandingPage.tsx` wiring
- `ScanPanel`: add `showGetStarted` state. Change `handleEnterDashboard` to `setShowGetStarted(true)` (remove the `navigate('/auth?...')` stopgap). Render `<GetStartedModal scanId={result.scanId} firstName={result.firstName} email={email} onClose={() => setShowGetStarted(false)} />` when `showGetStarted && result`.
- Keep the AuthPage email-prefill and nav "Log in" → `/auth` from the prior commit (still correct).

---

## 5. Key risks / STOP-and-verify before/while building

1. **Supabase email confirmation.** If the project requires email confirmation, `signUp` returns **no session**, so the authenticated `claim` fails. `AuthPage` navigates to `/` straight after `signUp` today, implying auto-confirm is ON. **VERIFY this** (Supabase Auth settings). If confirmation is required, switch to the **deferred-claim** fallback: store `{ scanId, titles, location }` in `localStorage` at submit, navigate to `/auth` "check your email", and run `claim` from a client effect on the first authenticated app load (idempotent). Do NOT guess; confirm the setting first.
2. **`api` token attachment.** Confirm `src/lib/api` injects the current Supabase session token (it does for existing authed calls) so `claim` is authenticated immediately after `signUp`.
3. **Dashboard routing.** With `hasCompletedOnboarding=true` + `localStorage.jobhub_report_seen='true'`, `ReportOrDashboard` should start at `dashboard` and `/jobs` should render. **VERIFY** `OnboardingGate` does not force `ProcessingScreen`/from-scratch for this profile (it has `resumeRawText` + `targetRole`, so it is not "essentially empty"). Report if it intercepts.
4. **Scrape latency.** `claim`'s bounded wait (90s) must never throw on timeout; it persists `[]` and returns success. Account creation must succeed even if Seek yields nothing (Apify key missing → `[]`).

---

## 6. Error handling

| Case | Behaviour |
|---|---|
| `scanId` expired at job-titles | `404 SESSION_EXPIRED` → modal expired state + "re-run your scan" + close |
| LLM title inference fails | fallback single chip; user can add up to 3 |
| Apify key missing / 0 results | scrape `ready` with `[]`; claim persists `[]`; user still lands on `/jobs` (empty-state copy) |
| `signUp` fails (email in use, weak pw) | inline error; account not created; user retries |
| `claim` fails after signUp | account exists; show retryable error; on retry re-call claim (idempotent upsert + delete/createMany) |
| `scanId` expired at claim | `410`; account still created; show "scan expired, continue to dashboard" → navigate `/` |

---

## 7. Files

**New:**
- `server/src/services/jobTitleSuggest.ts` (+ `.test.ts`)
- `server/src/services/userJobScrape.ts`
- `src/pages/getStartedCopy.ts` (Claude-authored, locked)
- `src/pages/GetStartedModal.tsx`

**Modified:**
- `server/src/routes/cv-scan.ts` — `jobScrapeStore` + 4 endpoints (`job-titles`, `scrape-jobs` POST/GET, `claim`); import `authenticate`, `RawJob`, scrape services, `prisma` (already imported).
- `src/pages/MockLandingPage.tsx` — `showGetStarted` state, modal mount, `handleEnterDashboard` opens modal.

**Untouched:** `/apply` (Slice C), `/generate`, `/analyze`, dashboard internals, Stripe, the scan + lead endpoints.

---

## 8. Out of scope (do NOT build in A)

Slice B (streamlined dashboard / StrategyHub redesign), Slice D (video interstitial + 7-day challenge), sponsor-classification of these jobs, match-scoring of the claimed jobs (set `matchScore: null` now), magic-link/passwordless auth, the single-screen report redesign.

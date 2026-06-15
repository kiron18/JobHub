# Account Seam (Slice A) — Implementation Plan (zero-latitude)

**For:** DeepSeek execution. **Spec:** `docs/superpowers/specs/2026-06-06-account-seam-slice-a-design.md` (read it first).

**Rules for the executor:**
- Build **exactly** what is written. Do not add fields, endpoints, copy, or "improvements".
- All user-facing copy + the LLM prompt come from this plan **verbatim** (Claude owns them per [[feedback_copy_ownership_split]]). Never reword. **No em dashes (—) or en dashes (–) anywhere** ([[feedback_no_em_dashes]]).
- Where a step says **STOP-and-report**, stop and report the finding instead of guessing.
- After each phase run the stated check. Do not proceed past a failing check.

---

## Phase 0 — Verifications (ALREADY DONE 2026-06-06 — do not re-litigate)

All four pre-build gates were verified by Claude against the live code on 2026-06-06. Findings are locked below. Do NOT stop on these; proceed directly to Phase 1.

0.1 **Supabase email confirmation — VERIFIED: auto-confirm is ON (Confirm email = OFF in Supabase Auth settings).** `supabase.auth.signUp` returns an active session immediately. **Proceed with the primary path (this plan).** Do NOT build the deferred-claim fallback.

0.2 **`api` token attachment — VERIFIED ✓.** `src/lib/api.ts` has a request interceptor that reads `supabase.auth.getSession()` and sets `Authorization: Bearer <access_token>` on every request (plus a 401 refresh-and-retry). The authenticated `claim` call will carry the new session token. No action needed.

0.3 **`deduplicateJobs` signature — VERIFIED: it does NOT accept a single array.** The real export is `deduplicateJobs(scrapedJobs: RawJob[], adzunaJobs: RawJob[]): RawJob[]` (TWO required array args). The Phase 1.2 single-array call would break. **You MUST use the local-dedupe fallback in Phase 1.2 (already locked in below). Do not call `deduplicateJobs`.**

0.4 **LLM + auth helpers — VERIFIED ✓.** `../utils/callLLMWithRetry` exports `callLLMWithRetry(prompt, isJson, maxRetries=3, temperature=0)` (the Phase 1.1 call `(prompt, true, 3, 0)` matches). `../utils/parseLLMResponse` exports `parseLLMJson(raw): any`. `../middleware/auth` exports `authenticate` and `interface AuthRequest extends Request`. All imports in this plan are valid as written.

---

## Phase 1 — Backend services

### 1.1 NEW `server/src/services/jobTitleSuggest.ts`
Copy verbatim (prompt is Claude-authored, em-dash-free):

```ts
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { parseLLMJson } from '../utils/parseLLMResponse';
import type { CvGapResult } from './cvGapScan';

export interface TitleSuggestion { titles: string[]; location: string | null; }

// PURE, unit-testable, no network.
export function buildTitlePrompt(resumeText: string, inferredRole: string): string {
  return [
    'You are an Australian recruitment strategist.',
    'Given a candidate resume, return the 3 job titles this person can REALISTICALLY land in Australia RIGHT NOW.',
    'Critical rule: candidates whose experience is entirely overseas get auto-rejected for senior or manager roles here, because employers assume the skills are not transferable and there is no local vouch.',
    'So if their experience is foreign-only or thin locally, down-rank seniority: suggest the realistic entry or bridge rung (for example "Marketing Coordinator", not "Head of Marketing"), reasoned from the resume, never a fixed rule.',
    'Also infer their most likely job-search location (city) from the resume, or null if genuinely unclear.',
    'Never use an em dash or en dash in any output.',
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
    return { titles: [inferredRole || 'Entry-level roles'], location: null };
  }
}
```
_(Phase 0.4 VERIFIED: `callLLMWithRetry` and `parseLLMJson` exist with these exact exports. Import as written; no STOP needed.)_

### 1.2 NEW `server/src/services/userJobScrape.ts`
Per Phase 0.3 (VERIFIED): `deduplicateJobs` takes two array args, so do NOT import or call it. Use the local dedupe shown here. Copy verbatim:
```ts
import type { RawJob } from './jobFeed';
import { buildSeekClusterKey, fetchSeekJobsForCluster } from './seekScraper';

export async function scrapeJobsForTitles(titles: string[], location: string): Promise<RawJob[]> {
  const all: RawJob[] = [];
  for (const title of titles) {
    const jobs = await fetchSeekJobsForCluster(buildSeekClusterKey(title, location, null));
    all.push(...jobs);
  }
  // Local dedupe by sourceUrl (deduplicateJobs requires two arrays — see Phase 0.3).
  const seen = new Set<string>();
  return all.filter(j => (j.sourceUrl && !seen.has(j.sourceUrl)) ? (seen.add(j.sourceUrl), true) : false);
}
```

### 1.3 Unit test `server/src/services/jobTitleSuggest.test.ts`
- `buildTitlePrompt` contains the resume text, the inferred role, the local-experience down-rank instruction, and the no-em-dash line.
- `suggestJobTitles` fallback: stub `callLLMWithRetry` to throw → returns `{ titles:['<inferredRole>'], location:null }`.
- happy path: stub returns valid JSON with 4 titles → capped to 3, empties dropped.

**Check:** `cd server && npx vitest run jobTitleSuggest` green.

---

## Phase 2 — `server/src/routes/cv-scan.ts`

### 2.1 Imports + store
Add near the top imports:
```ts
import { authenticate, AuthRequest } from '../middleware/auth';   // confirm export names
import type { RawJob } from '../services/jobFeed';
import { suggestJobTitles } from '../services/jobTitleSuggest';
import { scrapeJobsForTitles } from '../services/userJobScrape';
```
Add alongside `scanStore`:
```ts
type ScrapeStatus = 'pending' | 'ready' | 'error';
interface ScrapeEntry { requestId: string; status: ScrapeStatus; titles: string[]; location: string; jobs: RawJob[]; error: string | null; at: number; }
const jobScrapeStore = new Map<string, ScrapeEntry>();
function trimJobScrapeStore() {
  if (jobScrapeStore.size <= 100) return;
  const sorted = [...jobScrapeStore.entries()].sort((a, b) => b[1].at - a[1].at);
  jobScrapeStore.clear();
  for (const [k, v] of sorted.slice(0, 100)) jobScrapeStore.set(k, v);
}
function normalizeTitles(t: unknown): string[] {
  const arr = Array.isArray(t) ? t : [];
  const cleaned = arr.map(x => String(x).trim()).filter(Boolean);
  return [...new Set(cleaned)].slice(0, 3);
}
function fireScrape(scanId: string, titles: string[], location: string) {
  const requestId = randomUUID();
  jobScrapeStore.set(scanId, { requestId, status: 'pending', titles, location, jobs: [], error: null, at: Date.now() });
  trimJobScrapeStore();
  scrapeJobsForTitles(titles, location)
    .then(jobs => { const e = jobScrapeStore.get(scanId); if (e && e.requestId === requestId) jobScrapeStore.set(scanId, { ...e, status: 'ready', jobs, at: Date.now() }); })
    .catch(err => { const e = jobScrapeStore.get(scanId); if (e && e.requestId === requestId) jobScrapeStore.set(scanId, { ...e, status: 'error', error: err?.message ?? 'scrape failed', at: Date.now() }); });
}
```
_(Phase 0.4 VERIFIED: `middleware/auth.ts` exports `authenticate` and `interface AuthRequest extends Request`. Import as written; no STOP needed.)_

### 2.2 `POST /job-titles`
```ts
router.post('/job-titles', ipRateLimit, async (req, res) => {
  try {
    const { scanId } = req.body || {};
    const entry = scanStore.get(scanId);
    if (!entry || Date.now() - entry.at >= SCAN_STORE_TTL) { res.status(404).json({ error: 'SESSION_EXPIRED' }); return; }
    const { titles, location } = await suggestJobTitles(entry.resumeText, entry.result);
    const loc = location ?? 'All Australia';
    fireScrape(scanId, titles, loc);
    res.json({ titles, location: loc, firstName: entry.result.firstName ?? '' });
  } catch (err) {
    console.error('[cv-scan/job-titles]', err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: 'Could not suggest roles, please try again.' });
  }
});
```

### 2.3 `POST /scrape-jobs` (re-fire on edit) and `GET /scrape-jobs`
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

### 2.4 `POST /claim` (AUTHENTICATED)
```ts
async function waitForScrape(scanId: string, maxMs = 90_000): Promise<RawJob[]> {
  const start = Date.now();
  for (;;) {
    const e = jobScrapeStore.get(scanId);
    if (e && e.status === 'ready') return e.jobs;
    if (e && e.status === 'error') return [];
    if (Date.now() - start >= maxMs) return e?.jobs ?? [];
    await new Promise(r => setTimeout(r, 1000));
  }
}

router.post('/claim', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email ?? null;
    const { scanId, titles, location } = req.body || {};
    const entry = scanStore.get(scanId);
    if (!entry || Date.now() - entry.at >= SCAN_STORE_TTL) { res.status(410).json({ error: 'Your scan expired, please scan again.' }); return; }

    const cleanTitles = normalizeTitles(titles);
    const loc = String(location || '').trim() || null;
    const targetRole = cleanTitles[0] || entry.result.inferredRole || null;

    const profileData = {
      email,
      name: entry.result.fullName || null,
      resumeRawText: entry.resumeText,
      targetRole,
      targetCity: loc,
      location: loc,
      hasCompletedOnboarding: true,
      marketingConsent: true,
      marketingEmail: email,
    };
    await prisma.candidateProfile.upsert({
      where: { userId },
      create: { userId, ...profileData },
      update: profileData,
    });

    // make sure the head-start scrape exists; if the modal never fired it, fire now.
    if (!jobScrapeStore.has(scanId) && cleanTitles.length) fireScrape(scanId, cleanTitles, loc || 'All Australia');
    const jobs = await waitForScrape(scanId);

    // feedDate = AEST today, matching jobFeed.ts (reuse its helper if exported; else inline).
    const today = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
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
    res.json({ jobCount: jobs.length });
  } catch (err) {
    console.error('[cv-scan/claim]', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    res.status(502).json({ error: 'Could not set up your workspace, please try again.' });
  }
});
```
**STOP-and-report** on the `feedDate` type: confirm `JobFeedItem.feedDate` is `@db.Date` and that `jobFeed.ts` writes it as a `Date` or a string. Match whatever `jobFeed.ts:223` (`feedDate: today`) actually passes (reuse its `todayAEST()` helper if exported, rather than the inline above). Do not invent a new date format.

**Check:** `cd server && npx tsc --noEmit` clean.

---

## Phase 3 — Frontend copy (NEW `src/pages/getStartedCopy.ts`)
Create verbatim. No em/en dashes. Do not reword.

```ts
/**
 * Get-Started modal (account seam) — ALL user-facing copy.
 * Single source of truth. Import and render verbatim. Do NOT reword or inline.
 * {firstName} / {email} / {count} are runtime values supplied via the functions.
 */
export const getStartedCopy = {
  header: (firstName: string): string =>
    firstName ? `One step left, ${firstName}.` : 'One step left.',
  subhead: "Set a password and we'll save your plan, then line up jobs you can actually land.",

  accountLabel: 'Your account',
  emailPrefix: 'Saving to',
  passwordLabel: 'Choose a password',
  passwordPlaceholder: 'At least 8 characters',

  rolesLabel: "Roles we'll search for you",
  rolesHint: 'Up to 3, tap to edit',
  addRole: '+ add a role',
  locationLabel: "Where you're looking",
  locationNudge: 'Local roles get more callbacks. You can search anywhere.',

  submit: 'Create my workspace',
  submitting: 'Setting up your workspace…',
  consent: "We'll email you job matches and tips. Unsubscribe anytime.",

  errPasswordShort: 'Use at least 8 characters.',
  errSignup: "Couldn't create your account. Try again, or log in if you already have one.",
  errClaim: "Your account is ready, but we hit a snag setting things up. Tap to retry.",
  expiredTitle: 'Your scan timed out.',
  expiredBody: "Re-run your scan and we'll pick up right where you left off.",
} as const;
```

---

## Phase 4 — Frontend modal (NEW `src/pages/GetStartedModal.tsx`)

Build with MockLandingPage's `colors` + `type as typeTokens` (from `../components/landing/tokens`), `framer-motion`, `react-router-dom` `useNavigate`, `../lib/api` as `api`, `../lib/supabase` `supabase`, `sonner` `toast`, and `getStartedCopy`. Render as a `createPortal` full-screen overlay matching `ScanReveal`'s surface (reuse its background + card idiom; do NOT invent a new aesthetic).

**Props:** `{ scanId: string; firstName?: string; email: string; onClose: () => void }`.

**State:** `titles: string[]`, `location: string`, `titlesLoading: boolean`, `password: string`, `submitting: boolean`, `error: string | null`, `expired: boolean`.

**Behaviour (exact):**
1. On mount: `titlesLoading=true`; `api.post('/cv-scan/job-titles', { scanId })`. Success → `setTitles(resp.data.titles.slice(0,3))`, `setLocation(resp.data.location || 'All Australia')`, `titlesLoading=false`. On `404` → `setExpired(true)`.
2. Edit/add/remove a title chip (max 3) or change location → debounce 600ms → `api.post('/cv-scan/scrape-jobs', { scanId, titles, location })` (fire-and-forget; ignore response). This only warms the head-start scrape.
3. Submit `Create my workspace`:
   - If `password.length < 8` → `setError(getStartedCopy.errPasswordShort)`; return.
   - `setSubmitting(true)`, `setError(null)`.
   - `const { error: signErr } = await supabase.auth.signUp({ email, password })`. If `signErr` → `setError(getStartedCopy.errSignup)`, `setSubmitting(false)`, return.
   - `await api.post('/cv-scan/claim', { scanId, titles, location })`. On throw → `setError(getStartedCopy.errClaim)`, `setSubmitting(false)`, return (button becomes a retry that re-calls only the claim, since the account now exists).
   - On success: `localStorage.setItem('jobhub_auth_email', email)`, `localStorage.setItem('jobhub_report_seen', 'true')`, `navigate('/jobs')`.
4. `expired` → render `expiredTitle` + `expiredBody` + a close button calling `onClose`.

**Layout:** header `getStartedCopy.header(firstName)`, subhead, the `Saving to {email}` line (read-only), one password input, the 3 title chips (shimmer placeholders while `titlesLoading`), location input + `locationNudge`, primary button (label swaps to `submitting` text + disabled while submitting; reuse the pulsing-shadow `motion.button` idiom from `ScanReveal`'s CTA so motion points at it), the `consent` line beneath. Inline `error` in the report-red used elsewhere (`#C2603F`).

---

## Phase 5 — Wire `MockLandingPage.tsx`

In `ScanPanel`:
- Add `const [showGetStarted, setShowGetStarted] = useState(false);`
- Replace the body of `handleEnterDashboard` (currently `navigate('/auth?...')`) with `setShowGetStarted(true);` (keep `navigate` import; it is still used by `Nav`).
- Where `<ScanReveal ... />` is rendered, after it add:
  ```tsx
  {showGetStarted && result && (
    <GetStartedModal
      scanId={result.scanId}
      firstName={result.firstName}
      email={email}
      onClose={() => setShowGetStarted(false)}
    />
  )}
  ```
- Import `GetStartedModal` at top.

**Do NOT** touch the AuthPage email-prefill or the `Nav` "Log in" → `/auth` wiring from the prior commit.

**Check:** `npx tsc --noEmit -p tsconfig.json` clean (root). `cd server && npx tsc --noEmit` clean.

---

## Phase 6 — Manual acceptance (on `/mock-landing`)
Real resume: scan → email → roadmap → "Start fixing my resume" → modal opens with 3 roles + location prefilled and a password field → type password → "Create my workspace" → "Setting up your workspace…" → lands on `/jobs` showing persisted matches. Confirm a `CandidateProfile` row (resume + targetRole) and `JobFeedItem` rows exist for the new user. Editing a role before submit still results in jobs for the edited role.

**If Phase 0.1 found email-confirmation is required:** STOP. Do not ship the in-modal claim; report back for the deferred-claim plan.

---

## Summary of files
**New:** `server/src/services/jobTitleSuggest.ts` (+test), `server/src/services/userJobScrape.ts`, `src/pages/getStartedCopy.ts`, `src/pages/GetStartedModal.tsx`.
**Modified:** `server/src/routes/cv-scan.ts`, `src/pages/MockLandingPage.tsx`.

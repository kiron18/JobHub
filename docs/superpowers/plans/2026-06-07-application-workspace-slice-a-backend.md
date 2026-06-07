# Application Workspace — Slice A (Backend: trial access + daily cap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put new users on a 7-day trial with unlimited-feeling generation, bounded only by a configurable daily cap of 25 applications, and stop the current 5-generation cap from blocking trial users.

**Architecture:** One shared `hasActiveAccess(profile)` helper recognises an active trial (`trialEndDate > now`) alongside paid plans; both `checkAccess` and `requirePremium` use it. `cv-scan/claim` starts the 7-day trial. A daily-application cap is enforced by counting today's `JobApplication` rows (AEST) at a new apply-start endpoint that also seeds the application row used later by the stream/mark-applied.

**Tech Stack:** Express, TypeScript, Prisma (Postgres), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-07-application-workspace-job-stream-design.md` (read §6, §4 first).

**Rules for the executor:**
- Build **exactly** what is written. Do not add fields, endpoints, copy, or "improvements".
- Where a step says **STOP-and-report**, stop and report instead of guessing.
- After each task run the stated check. Do not proceed past a failing check.
- No em dashes (—) or en dashes (–) anywhere ([[feedback_no_em_dashes]]).

---

## Phase 0 — Verifications (ALREADY DONE 2026-06-07 by Claude — do not re-litigate)

- **0.1 Trial users are `plan='free'` + `trialEndDate` set.** Confirmed via `server/src/routes/admin-funnel.ts:215` ("Trial users: trialEndDate set, plan='free', not yet converted"). The schema defaults are `plan='free'`, `planStatus='active'`, `trialEndDate DateTime?` (`server/prisma/schema.prisma:48-50`).
- **0.2 Both gates exclude trial users today.** `checkAccess` (`server/src/middleware/accessControl.ts:68`) only returns unlimited for `plan !== 'free'`. `requirePremium` (`server/src/routes/job-feed.ts:30-31`) requires `dashboardAccess` or `plan !== 'free'`. So a trial user falls through to `checkFree` (5-generation cap) / gets 403. This is the live 402/403 bug.
- **0.3 `JobApplication`** has `userId, candidateProfileId, title, company, description, sourceUrl, status (ApplicationStatus @default SAVED), createdAt, dateApplied`. `ApplicationStatus` = `SAVED | APPLIED | INTERVIEW | REJECTED | OFFER` (`schema.prisma:177-191, 302-308`).
- **0.4 `mark-applied`** (`POST /job-feed/:id/mark-applied`, `job-feed.ts`) matches an application by `title + company`, updates to `APPLIED` or creates one. It calls `requirePremium` first (so Task 2 must land or trial users cannot complete).
- **0.5 Helpers:** `todayAEST()` is exported from `server/src/services/jobFeed.ts:65`. `EXEMPT_EMAILS` from `server/src/routes/stripe.ts`.

---

## File Structure

- `server/src/middleware/accessControl.ts` — add `hasActiveAccess()`, use it in `checkAccess`; export it.
- `server/src/middleware/accessControl.test.ts` — NEW unit tests.
- `server/src/routes/job-feed.ts` — use `hasActiveAccess` in `requirePremium`; add `POST /:id/start-apply`.
- `server/src/routes/cv-scan.ts` — set `trialEndDate` on claim.
- `server/src/services/applicationCap.ts` — NEW: `DAILY_APPLICATION_CAP`, `countTodaysApplications()`.
- `server/src/services/applicationCap.test.ts` — NEW unit tests.

---

## Task 1: `hasActiveAccess` helper + trial recognition in `checkAccess`

**Files:**
- Modify: `server/src/middleware/accessControl.ts`
- Test: `server/src/middleware/accessControl.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { hasActiveAccess } from './accessControl';

describe('hasActiveAccess', () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it('true for an active trial (free plan, trialEndDate in the future)', () => {
    expect(hasActiveAccess({ plan: 'free', planStatus: 'active', trialEndDate: future, dashboardAccess: false, accessExpiresAt: null })).toBe(true);
  });
  it('false for an expired trial (free plan, trialEndDate in the past)', () => {
    expect(hasActiveAccess({ plan: 'free', planStatus: 'active', trialEndDate: past, dashboardAccess: false, accessExpiresAt: null })).toBe(false);
  });
  it('true for a paid active plan', () => {
    expect(hasActiveAccess({ plan: 'monthly', planStatus: 'active', trialEndDate: null, dashboardAccess: false, accessExpiresAt: null })).toBe(true);
  });
  it('true when dashboardAccess granted', () => {
    expect(hasActiveAccess({ plan: 'free', planStatus: 'active', trialEndDate: null, dashboardAccess: true, accessExpiresAt: null })).toBe(true);
  });
  it('false for a plain free user with no trial', () => {
    expect(hasActiveAccess({ plan: 'free', planStatus: 'active', trialEndDate: null, dashboardAccess: false, accessExpiresAt: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/middleware/accessControl.test.ts`
Expected: FAIL with "hasActiveAccess is not a function" / import error.

- [ ] **Step 3: Add the helper and export it**

In `server/src/middleware/accessControl.ts`, add near the top (after the interfaces):

```typescript
export interface AccessProfileLike {
  plan?: string | null;
  planStatus?: string | null;
  trialEndDate?: Date | null;
  dashboardAccess?: boolean | null;
  accessExpiresAt?: Date | null;
}

// True when the user should have unlimited feature access: an explicit grant,
// a live paid plan, or an active 7-day trial (free plan with a future trialEndDate).
export function hasActiveAccess(p: AccessProfileLike): boolean {
  if (p.dashboardAccess === true) return true;
  const plan = p.plan ?? 'free';
  const planStatus = p.planStatus ?? 'active';
  if (plan !== 'free' && (planStatus === 'active' || planStatus === 'trialing')) return true;
  if (p.trialEndDate && p.trialEndDate > new Date()) return true;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/middleware/accessControl.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Use it in `checkAccess`**

In `checkAccess`, the `select` already includes `plan, planStatus, accessExpiresAt`. Add `trialEndDate: true` and `dashboardAccess: true` to the `select`. Then, immediately after the `three_month` expiry block and before the existing `if (plan !== 'free' && ...)` line, add:

```typescript
  // Active trial or paid plan: unlimited feature access.
  if (hasActiveAccess(profile)) {
    return { allowed: true };
  }
```

(The existing `if (plan !== 'free' && (planStatus === 'active' || planStatus === 'trialing'))` block becomes redundant but leave it; it is covered by `hasActiveAccess`. Do not delete other branches.)

- [ ] **Step 6: Run the full middleware test + typecheck**

Run: `cd server && npx vitest run src/middleware/accessControl.test.ts && npx tsc --noEmit`
Expected: PASS, tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add server/src/middleware/accessControl.ts server/src/middleware/accessControl.test.ts
git commit -m "feat(access): recognise active 7-day trial as unlimited access"
```

---

## Task 2: Recognise trial in `requirePremium`

**Files:**
- Modify: `server/src/routes/job-feed.ts:25-37`

- [ ] **Step 1: Replace the `isPaid` computation with the shared helper**

At the top of `job-feed.ts`, add to the imports:

```typescript
import { hasActiveAccess } from '../middleware/accessControl';
```

Then change `requirePremium` to select the extra fields and use the helper:

```typescript
async function requirePremium(userId: string, res: Response): Promise<boolean> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { plan: true, planStatus: true, accessExpiresAt: true, dashboardAccess: true, trialEndDate: true },
  });
  if (!profile || !hasActiveAccess(profile)) {
    res.status(403).json({ error: 'Subscription required' });
    return false;
  }
  return true;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/job-feed.ts
git commit -m "feat(job-feed): trial users pass requirePremium"
```

---

## Task 3: Start the 7-day trial on claim

**Files:**
- Modify: `server/src/routes/cv-scan.ts` (the `/claim` handler, `profileData` object)

- [ ] **Step 1: Add `trialEndDate` to the claim profileData**

In the `/claim` handler, where `profileData` is built (currently sets `email, name, resumeRawText, targetRole, targetCity, location, hasCompletedOnboarding, marketingConsent, marketingEmail`), add a 7-day trial start. Just above `const profileData = {`, add:

```typescript
    const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
```

Then add to the `profileData` object:

```typescript
      trialEndDate,
```

(Keep `plan` as the schema default `'free'`; trial users are `plan='free'` + `trialEndDate` per Phase 0.1. Do NOT set `plan` here.)

- [ ] **Step 2: Typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Manual check (STOP-and-report if it fails)**

Restart the backend, run a full scan → signup → claim with a fresh email, then in the DB confirm the new `CandidateProfile` has `trialEndDate` ~7 days out and `plan='free'`. If `trialEndDate` is null, STOP and report.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/cv-scan.ts
git commit -m "feat(cv-scan): start a 7-day trial on claim"
```

---

## Task 4: Daily application cap config + counter

**Files:**
- Create: `server/src/services/applicationCap.ts`
- Test: `server/src/services/applicationCap.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../index', () => ({ prisma: { jobApplication: { count: vi.fn() } } }));
vi.mock('./jobFeed', () => ({ todayAEST: () => new Date('2026-06-07T00:00:00+10:00') }));

async function mod() {
  const m = await import('./applicationCap');
  const { prisma } = await import('../index');
  return { m, prisma };
}

describe('applicationCap', () => {
  it('DAILY_APPLICATION_CAP is 25', async () => {
    const { m } = await mod();
    expect(m.DAILY_APPLICATION_CAP).toBe(25);
  });

  it('countTodaysApplications counts JobApplications created since today AEST', async () => {
    const { m, prisma } = await mod();
    (prisma.jobApplication.count as any).mockResolvedValueOnce(3);
    const n = await m.countTodaysApplications('user-1');
    expect(n).toBe(3);
    expect((prisma.jobApplication.count as any)).toHaveBeenCalledWith({
      where: { userId: 'user-1', createdAt: { gte: new Date('2026-06-07T00:00:00+10:00') } },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/services/applicationCap.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
// server/src/services/applicationCap.ts
import { prisma } from '../index';
import { todayAEST } from './jobFeed';

// Daily safety cap on applications during the trial. One application = one Apply
// that generates a resume + cover letter pair. Resets each AEST day. Tunable.
export const DAILY_APPLICATION_CAP = 25;

// Number of applications the user has started today (AEST). Counts every
// JobApplication row created today regardless of status, so cost is bounded at
// generation start, not completion.
export async function countTodaysApplications(userId: string): Promise<number> {
  return prisma.jobApplication.count({
    where: { userId, createdAt: { gte: todayAEST() } },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/services/applicationCap.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/applicationCap.ts server/src/services/applicationCap.test.ts
git commit -m "feat(apply): daily application cap config + counter"
```

---

## Task 5: Apply-start endpoint (cap guard + seed application row)

**Files:**
- Modify: `server/src/routes/job-feed.ts` (add route)

**Why:** the frontend calls this on Apply click. It enforces the daily cap (bounding cost at generation start) and creates the `JobApplication` row the stream/mark-applied later finalise.

- [ ] **Step 1: Add the route**

Add imports at the top of `job-feed.ts`:

```typescript
import { DAILY_APPLICATION_CAP, countTodaysApplications } from '../services/applicationCap';
```

Add the route (place it near the other `/:id/...` routes):

```typescript
// POST /api/job-feed/:id/start-apply — enforce the daily cap and seed the
// application row before the user enters the generation flow.
router.post('/:id/start-apply', async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    if (!(await requirePremium(userId, res))) return;

    const used = await countTodaysApplications(userId);
    if (used >= DAILY_APPLICATION_CAP) {
      return res.status(429).json({ error: 'DAILY_CAP_REACHED', cap: DAILY_APPLICATION_CAP, used });
    }

    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Reuse an existing row for this job if present (avoids duplicates on retry),
    // else create one in SAVED status. mark-applied later flips it to APPLIED.
    let jobApp = await prisma.jobApplication.findFirst({
      where: { userId, title: item.title, company: item.company },
      orderBy: { createdAt: 'desc' },
    });
    if (!jobApp) {
      jobApp = await prisma.jobApplication.create({
        data: {
          userId,
          candidateProfileId: profile.id,
          title: item.title,
          company: item.company,
          description: item.description,
          sourceUrl: item.sourceUrl,
          status: 'SAVED',
        },
      });
    }

    return res.json({ ok: true, jobApplicationId: jobApp.id, used: used + 1, cap: DAILY_APPLICATION_CAP });
  } catch (err: any) {
    console.error('[job-feed/start-apply]', err?.message ?? err);
    return res.status(500).json({ error: 'Could not start the application' });
  }
});
```

- [ ] **Step 2: Typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Manual smoke (STOP-and-report on failure)**

With a trial user's session: `POST /api/job-feed/<feedItemId>/start-apply` returns `{ ok: true, jobApplicationId, used, cap: 25 }` and a `JobApplication` row exists. A 26th call the same day returns `429 DAILY_CAP_REACHED`. If a trial user gets `403` here, Task 2 did not land — STOP and report.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/job-feed.ts
git commit -m "feat(apply): start-apply endpoint enforces daily cap, seeds application"
```

---

## Self-Review (run before handoff)

- [ ] **Spec coverage:** §6.2 daily cap (Tasks 4, 5), §6.3 stop double-gate (Tasks 1, 2) + trial start (Task 3). Stream/animation, workspace UI, and the Apply→Seek→return loop are Slices B/C/D, not here.
- [ ] **Placeholder scan:** none.
- [ ] **Type consistency:** `hasActiveAccess` signature matches the `select`ed fields in both `checkAccess` and `requirePremium`; `countTodaysApplications(userId)` and `DAILY_APPLICATION_CAP` names match Task 5 usage; `start-apply` returns `{ ok, jobApplicationId, used, cap }` and `429 { error: 'DAILY_CAP_REACHED', cap, used }` (Slice C consumes these).

---

## Slice map (for the follow-on plans)

- **Slice A (this plan):** trial access + daily cap backend.
- **Slice B:** restructure `StrategyHub` into the job-stream Application Workspace (3 cards, blurb, two secondary buttons). Spec §3, copy §8.1/8.2.
- **Slice C:** Apply loop — Apply click calls `start-apply` (handles `429` with §8.6 copy), navigates to `/apply` with the full JD; cover-letter page gets "Download both" + the Seek banner (§8.3); Done marks applied (`mark-applied`) and returns. Spec §4, copy §8.3/8.6/8.7.
- **Slice D:** applied animation + refill stream. Spec §5, copy §8.4.

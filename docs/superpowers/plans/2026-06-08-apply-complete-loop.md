# Apply-Complete Loop + Self-Mark-Applied Implementation Plan

> **For agentic workers (DeepSeek):** This is a ZERO-LATITUDE plan. Implement it task-by-task, in order. Do NOT improvise, rename, restructure, or "improve" beyond what each step says. All user-facing copy is pre-written in Task 0 and is OWNED by the plan author — transcribe it verbatim, never reword it. If reality diverges from the plan (a file/line/symbol does not match), **STOP and report** the mismatch instead of guessing. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make "this application is done" reliable — every completed application (in-app or external) gets marked APPLIED in the tracker, drops out of the live stream, is replaced by the next role, and increments the momentum count.

**Architecture:** One robust server endpoint reconciles a feed item against the tracker (match by `sourceUrl`, then title+company) and reports whether it created a new row or promoted an existing one. A new revert endpoint powers Undo. A single shared client helper (`markFeedItemApplied`) is used by the stream cards, the workspace finish action, and the apply button, so every path behaves identically: mark → toast (retroactive Undo only when we created a fresh row) → invalidate both the feed and the tracker queries.

**Tech Stack:** Express + Prisma (PostgreSQL) backend; React + TanStack Query + sonner (toasts) frontend; vitest + supertest for server tests.

---

## Background facts (verified — do not re-investigate, just use)

- The stream component is `src/components/strategy/JobStream.tsx`. It reads the feed via `useQuery({ queryKey: ['job-feed', 0] })` and hides any job whose `applicationStatus` ∈ `{APPLIED, INTERVIEW, REJECTED, OFFER}`, showing the top 3 of the rest.
- The tracker is loaded in `src/pages/StrategyHub.tsx` via `useQuery({ queryKey: ['jobs'] })` → `GET /jobs`, returning `JobLite[]` where each has `status` and `dateApplied`. `GoalChip` already counts real APPLIED from this list.
- `JobFeedItem` and `JobApplication` are separate tables, linked only by `sourceUrl`. The feed read (`server/src/routes/job-feed.ts` GET `/feed`) computes each card's `applicationStatus` by matching `JobApplication.sourceUrl` to the feed item's `sourceUrl`.
- `JobApplication` columns: `id, userId, candidateProfileId, title, company, description, sourceUrl?, dateApplied?, status (enum ApplicationStatus, default SAVED), notes?` (and more, irrelevant here). `ApplicationStatus` values: `SAVED, APPLIED, INTERVIEW, OFFER, REJECTED`.
- `requirePremium` in `server/src/routes/job-feed.ts` uses `hasActiveAccess`, which returns `true` for trial users (`trialEndDate > now`). Keep this gate — trial users pass it.
- The existing `POST /:id/mark-applied` route is at `server/src/routes/job-feed.ts:319-367`. It currently matches the application by `title + company` only and returns `{ ok, jobApplicationId }`. We are replacing its body.
- The workspace finish handler `handleFinishApplication` is at `src/pages/StepperWorkspace.tsx:543-553`. It already `await`s `POST /job-feed/${feedItemId}/mark-applied` then `navigate('/', { state: { appliedFeedItemId } })`. Leave its shape; it benefits from the improved endpoint automatically.
- `src/pages/StrategyHub.tsx:408-414` reads `appliedFeedItemId` from `location.state` and (line 595) passes it to `<JobStream appliedId={appliedFeedItemId} />`. `JobStream` already invalidates `['job-feed']` after the applied beat (`JobStream.tsx:35-44`). It does NOT currently invalidate `['jobs']`.

---

## File Structure

**Create:**
- `server/src/lib/applicationReconcile.ts` — pure decision function: given an existing application (or null), decide create / promote / already-applied. Testable without a DB.
- `server/src/lib/applicationReconcile.test.ts` — vitest unit tests for the above.
- `src/lib/markApplied.ts` — shared client helper + the OWNED copy constants. One place that marks a feed item applied, toasts correctly, and invalidates queries.

**Modify:**
- `server/src/routes/job-feed.ts` — replace the `mark-applied` route body; add a `revert` route.
- `src/components/strategy/JobStreamCard.tsx` — add a subtle "Mark as applied" secondary action.
- `src/components/strategy/JobStream.tsx` — accept `onMarkApplied` + `appliedCount`; use the tracker count for the sent line; pass the handler to cards.
- `src/pages/StrategyHub.tsx` — compute `appliedCount`; provide the mark handler; invalidate `['jobs']` when returning with `appliedFeedItemId`.
- `src/components/strategy/ApplyDeepLinkButton.tsx` — route its mark-applied through the shared helper.

---

## Task 0: Lock the copy and result types (no logic yet)

**Files:**
- Create: `src/lib/markApplied.ts`

- [ ] **Step 1: Create the copy + types module (helper body filled in Task 5; stub it now)**

Create `src/lib/markApplied.ts` with EXACTLY this content:

```ts
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from './api';

// ─────────────────────────────────────────────────────────────────────────────
// COPY — owned by the plan author. Do NOT reword, expand, or "improve" these.
// ─────────────────────────────────────────────────────────────────────────────
export const MARK_APPLIED_COPY = {
  cardButton: 'Mark as applied',
  createdToast: 'Added to your tracker as applied',
  promotedToast: 'Marked as applied',
  undoLabel: 'Undo',
  undoneToast: 'Reverted',
  errorToast: 'Could not update your tracker. Try again.',
} as const;

// Server response from POST /api/job-feed/:id/mark-applied
export interface MarkAppliedResult {
  jobApplicationId: string;
  created: boolean;          // true = we created a fresh row (likely an external apply)
  previousStatus: string | null; // the status before this call (null when created)
  alreadyApplied: boolean;   // true = it was already APPLIED; nothing changed
}

// Implemented in Task 5.
export async function markFeedItemApplied(
  _feedItemId: string,
  _queryClient: QueryClient,
): Promise<MarkAppliedResult | null> {
  throw new Error('not implemented — see Task 5');
}

void api;
void toast;
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd E:/AntiGravity/JobHub && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep markApplied`
Expected: no output (the file compiles; the unrelated pre-existing `CoherenceCard` warning may appear elsewhere but must NOT reference `markApplied`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/markApplied.ts
git commit -m "feat(apply): scaffold markApplied helper + locked copy"
```

---

## Task 1: Pure reconciliation decision (server, TDD)

**Files:**
- Create: `server/src/lib/applicationReconcile.ts`
- Test: `server/src/lib/applicationReconcile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/lib/applicationReconcile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { reconcileApplication } from './applicationReconcile';

describe('reconcileApplication', () => {
  it('creates when no existing application', () => {
    expect(reconcileApplication(null)).toEqual({ kind: 'create' });
  });

  it('reports already_applied when existing is APPLIED', () => {
    expect(reconcileApplication({ status: 'APPLIED' })).toEqual({ kind: 'already_applied' });
  });

  it('promotes a SAVED application and keeps its previous status', () => {
    expect(reconcileApplication({ status: 'SAVED' })).toEqual({ kind: 'promote', previousStatus: 'SAVED' });
  });

  it('promotes any non-APPLIED status (e.g. REJECTED)', () => {
    expect(reconcileApplication({ status: 'REJECTED' })).toEqual({ kind: 'promote', previousStatus: 'REJECTED' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd E:/AntiGravity/JobHub/server && npx vitest run src/lib/applicationReconcile.test.ts`
Expected: FAIL — "Cannot find module './applicationReconcile'".

- [ ] **Step 3: Implement the pure function**

Create `server/src/lib/applicationReconcile.ts`:

```ts
/**
 * Pure decision for "mark this job applied": given the existing tracker row for a
 * job (or null when none exists), decide what the mark-applied route must do.
 * No DB access here — keeps the branching logic unit-testable.
 */
export type ReconcileAction =
  | { kind: 'create' }                              // no row exists → create an APPLIED row
  | { kind: 'already_applied' }                     // row exists and is already APPLIED → no-op
  | { kind: 'promote'; previousStatus: string };    // row exists, not APPLIED → flip to APPLIED

export function reconcileApplication(
  existing: { status: string } | null,
): ReconcileAction {
  if (!existing) return { kind: 'create' };
  if (existing.status === 'APPLIED') return { kind: 'already_applied' };
  return { kind: 'promote', previousStatus: existing.status };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd E:/AntiGravity/JobHub/server && npx vitest run src/lib/applicationReconcile.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/applicationReconcile.ts server/src/lib/applicationReconcile.test.ts
git commit -m "feat(apply): pure reconcileApplication decision + tests"
```

---

## Task 2: Rebuild the mark-applied route (server)

**Files:**
- Modify: `server/src/routes/job-feed.ts` (replace the existing `mark-applied` route body; add `reconcileApplication` import)

- [ ] **Step 1: Add the import**

In `server/src/routes/job-feed.ts`, find the import block near the top (the existing imports such as `import { scoreJobForFeed } from '../services/jobAnalysis';`). Add this line directly after that import:

```ts
import { reconcileApplication } from '../lib/applicationReconcile';
```

- [ ] **Step 2: Replace the mark-applied route**

Find the entire existing route block that starts with the comment `// POST /api/job-feed/:id/mark-applied — save (if needed) + mark as APPLIED in one step` and ends at the closing `});` of that `router.post('/:id/mark-applied', ...)` handler (currently lines ~318-367). Replace the WHOLE block with:

```ts
// POST /api/job-feed/:id/mark-applied — reconcile the feed item against the tracker
// and ensure it ends up APPLIED. Matches an existing application by sourceUrl first
// (the key the feed read uses), then title+company. Reports whether we created a
// fresh row (likely an external apply) so the client can offer Undo.
router.post('/:id/mark-applied', async (req: any, res: any) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    if (!(await requirePremium(userId, res))) return;

    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Match by sourceUrl first (what the feed uses to tag applicationStatus), then
    // fall back to title+company for older rows that never stored a sourceUrl.
    let existing = item.sourceUrl
      ? await prisma.jobApplication.findFirst({
          where: { userId, sourceUrl: item.sourceUrl },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    if (!existing) {
      existing = await prisma.jobApplication.findFirst({
        where: { userId, title: item.title, company: item.company },
        orderBy: { createdAt: 'desc' },
      });
    }

    const action = reconcileApplication(existing);

    if (action.kind === 'already_applied') {
      return res.json({
        ok: true,
        jobApplicationId: existing!.id,
        created: false,
        previousStatus: 'APPLIED',
        alreadyApplied: true,
      });
    }

    if (action.kind === 'promote') {
      await prisma.jobApplication.update({
        where: { id: existing!.id },
        data: {
          status: 'APPLIED',
          dateApplied: new Date(),
          // Backfill sourceUrl so future feed reads match this row by URL.
          ...(existing!.sourceUrl ? {} : { sourceUrl: item.sourceUrl }),
        },
      });
      return res.json({
        ok: true,
        jobApplicationId: existing!.id,
        created: false,
        previousStatus: action.previousStatus,
        alreadyApplied: false,
      });
    }

    // action.kind === 'create'
    const jobApp = await prisma.jobApplication.create({
      data: {
        userId,
        candidateProfileId: profile.id,
        title: item.title,
        company: item.company,
        description: item.description,
        sourceUrl: item.sourceUrl,
        notes: `Source: ${item.sourceUrl}`,
        status: 'APPLIED',
        dateApplied: new Date(),
      },
    });
    await prisma.jobFeedItem.update({ where: { id }, data: { isSaved: true } });

    return res.json({
      ok: true,
      jobApplicationId: jobApp.id,
      created: true,
      previousStatus: null,
      alreadyApplied: false,
    });
  } catch (err: any) {
    console.error('[job-feed/mark-applied]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to mark as applied' });
  }
});
```

- [ ] **Step 3: Verify the server typechecks**

Run: `cd E:/AntiGravity/JobHub/server && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/job-feed.ts
git commit -m "feat(apply): reconcile mark-applied by sourceUrl, report created vs promoted"
```

---

## Task 3: Add the revert (Undo) route (server)

**Files:**
- Modify: `server/src/routes/job-feed.ts` (add a new route directly AFTER the mark-applied route from Task 2)

- [ ] **Step 1: Add the revert route**

In `server/src/routes/job-feed.ts`, directly after the `mark-applied` route's closing `});` (from Task 2), insert:

```ts
// POST /api/job-feed/application/:applicationId/revert — Undo for a just-applied
// job. body.restore === 'DELETE' deletes the row we just created; any other value
// is treated as a status to restore (and clears dateApplied).
router.post('/application/:applicationId/revert', async (req: any, res: any) => {
  const userId = req.user.id;
  const { applicationId } = req.params;
  const restore = String((req.body?.restore ?? '')).trim();

  try {
    if (!(await requirePremium(userId, res))) return;

    const app = await prisma.jobApplication.findUnique({ where: { id: applicationId } });
    if (!app || app.userId !== userId) return res.status(404).json({ error: 'Not found' });

    if (restore === 'DELETE') {
      await prisma.jobApplication.delete({ where: { id: applicationId } });
      return res.json({ ok: true, deleted: true });
    }

    const allowed = new Set(['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED']);
    if (!allowed.has(restore)) return res.status(400).json({ error: 'Invalid restore status' });

    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: restore as any, dateApplied: restore === 'APPLIED' ? new Date() : null },
    });
    return res.json({ ok: true, status: restore });
  } catch (err: any) {
    console.error('[job-feed/revert]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to undo' });
  }
});
```

- [ ] **Step 2: Verify the server typechecks**

Run: `cd E:/AntiGravity/JobHub/server && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the full server test suite (nothing should break)**

Run: `cd E:/AntiGravity/JobHub/server && npx vitest run`
Expected: all tests PASS (including the new `applicationReconcile.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/job-feed.ts
git commit -m "feat(apply): add application revert route for Undo"
```

---

## Task 4: STOP — manual backend smoke test

- [ ] **Step 1: Restart the server and exercise the endpoints**

Restart the dev server (`cd server && npm run dev`). Using the running app or curl with a valid auth token, confirm:
1. `POST /api/job-feed/<feedItemId>/mark-applied` on a fresh job returns `created: true`.
2. Calling it again on the same job returns `alreadyApplied: true, created: false`.
3. `POST /api/job-feed/application/<jobApplicationId>/revert` with body `{ "restore": "DELETE" }` returns `{ deleted: true }`.
4. `server/server.log` shows `POST /api/job-feed/<id>/mark-applied 200`.

- [ ] **Step 2: If any of the four checks fails, STOP and report which one and the response body. Do not proceed.**

---

## Task 5: Implement the shared client helper

**Files:**
- Modify: `src/lib/markApplied.ts` (replace the stub `markFeedItemApplied` from Task 0)

- [ ] **Step 1: Replace the file body**

Replace the ENTIRE contents of `src/lib/markApplied.ts` with:

```ts
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from './api';

// ─────────────────────────────────────────────────────────────────────────────
// COPY — owned by the plan author. Do NOT reword, expand, or "improve" these.
// ─────────────────────────────────────────────────────────────────────────────
export const MARK_APPLIED_COPY = {
  cardButton: 'Mark as applied',
  createdToast: 'Added to your tracker as applied',
  promotedToast: 'Marked as applied',
  undoLabel: 'Undo',
  undoneToast: 'Reverted',
  errorToast: 'Could not update your tracker. Try again.',
} as const;

export interface MarkAppliedResult {
  jobApplicationId: string;
  created: boolean;
  previousStatus: string | null;
  alreadyApplied: boolean;
}

async function revert(applicationId: string, restore: string, queryClient: QueryClient): Promise<void> {
  try {
    await api.post(`/job-feed/application/${applicationId}/revert`, { restore });
    toast.success(MARK_APPLIED_COPY.undoneToast);
  } catch {
    toast.error(MARK_APPLIED_COPY.errorToast);
  } finally {
    queryClient.invalidateQueries({ queryKey: ['job-feed'] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  }
}

/**
 * Mark a feed item applied via the reconciling endpoint, then refresh the stream
 * and the tracker. Toast rules:
 *   - already APPLIED  → silent (nothing changed)
 *   - promoted (SAVED→APPLIED) → quiet success toast
 *   - created fresh (external apply) → success toast WITH an Undo action
 * Returns the server result, or null on error.
 */
export async function markFeedItemApplied(
  feedItemId: string,
  queryClient: QueryClient,
): Promise<MarkAppliedResult | null> {
  let result: MarkAppliedResult;
  try {
    const { data } = await api.post<MarkAppliedResult>(`/job-feed/${feedItemId}/mark-applied`);
    result = data;
  } catch {
    toast.error(MARK_APPLIED_COPY.errorToast);
    return null;
  }

  queryClient.invalidateQueries({ queryKey: ['job-feed'] });
  queryClient.invalidateQueries({ queryKey: ['jobs'] });

  if (result.alreadyApplied) {
    // Silent — it was already tracked.
  } else if (result.created) {
    const restore = 'DELETE';
    toast.success(MARK_APPLIED_COPY.createdToast, {
      action: {
        label: MARK_APPLIED_COPY.undoLabel,
        onClick: () => { void revert(result.jobApplicationId, restore, queryClient); },
      },
    });
  } else {
    const restore = result.previousStatus ?? 'SAVED';
    toast.success(MARK_APPLIED_COPY.promotedToast, {
      action: {
        label: MARK_APPLIED_COPY.undoLabel,
        onClick: () => { void revert(result.jobApplicationId, restore, queryClient); },
      },
    });
  }

  return result;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd E:/AntiGravity/JobHub && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v CoherenceCard`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/markApplied.ts
git commit -m "feat(apply): shared markFeedItemApplied helper with retroactive Undo"
```

---

## Task 6: Add "Mark as applied" to stream cards

**Files:**
- Modify: `src/components/strategy/JobStreamCard.tsx`

- [ ] **Step 1: Add the prop and the secondary button**

In `src/components/strategy/JobStreamCard.tsx`:

(a) Add the import at the top, after the existing `import { warm } ...` line:

```ts
import { MARK_APPLIED_COPY } from '../../lib/markApplied';
```

(b) Change the props interface from:

```ts
interface JobStreamCardProps {
  job: JobFeedItem;
  onApply: (job: JobFeedItem) => void;
  applying?: boolean;
}
```

to:

```ts
interface JobStreamCardProps {
  job: JobFeedItem;
  onApply: (job: JobFeedItem) => void;
  onMarkApplied: (job: JobFeedItem) => void;
  applying?: boolean;
}
```

(c) Change the function signature from:

```ts
export function JobStreamCard({ job, onApply, applying }: JobStreamCardProps) {
```

to:

```ts
export function JobStreamCard({ job, onApply, onMarkApplied, applying }: JobStreamCardProps) {
```

(d) Replace the final actions row. Find:

```tsx
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          onClick={() => onApply(job)}
          disabled={applying}
          style={{
            fontSize: 13.5, fontWeight: 700, padding: '9px 20px', borderRadius: 10,
            border: 'none', cursor: applying ? 'wait' : 'pointer',
            background: warm.colors.accentPetrol, color: warm.colors.textOnDeep,
            opacity: applying ? 0.7 : 1,
          }}
        >
          {applying ? 'Opening...' : 'Apply'}
        </button>
      </div>
```

Replace it with:

```tsx
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <button
          onClick={() => onMarkApplied(job)}
          disabled={applying}
          style={{
            fontSize: 12, fontWeight: 600, padding: '4px 0',
            background: 'transparent', border: 'none', cursor: applying ? 'wait' : 'pointer',
            color: warm.colors.textMuted, textDecoration: 'underline', textUnderlineOffset: 2,
          }}
        >
          {MARK_APPLIED_COPY.cardButton}
        </button>
        <button
          onClick={() => onApply(job)}
          disabled={applying}
          style={{
            fontSize: 13.5, fontWeight: 700, padding: '9px 20px', borderRadius: 10,
            border: 'none', cursor: applying ? 'wait' : 'pointer',
            background: warm.colors.accentPetrol, color: warm.colors.textOnDeep,
            opacity: applying ? 0.7 : 1,
          }}
        >
          {applying ? 'Opening...' : 'Apply'}
        </button>
      </div>
```

- [ ] **Step 2: Verify it typechecks (will error until Task 7 passes the new prop — that is expected)**

Run: `cd E:/AntiGravity/JobHub && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep JobStream`
Expected: an error in `JobStream.tsx` that `onMarkApplied` is missing. This is fixed in Task 7. Do NOT "fix" it inside JobStreamCard. Proceed to Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/components/strategy/JobStreamCard.tsx
git commit -m "feat(apply): mark-as-applied action on stream cards"
```

---

## Task 7: Wire the stream to mark-applied + tracker-based count

**Files:**
- Modify: `src/components/strategy/JobStream.tsx`

- [ ] **Step 1: Update the props, count source, and card wiring**

In `src/components/strategy/JobStream.tsx`:

(a) Change the props interface from:

```ts
interface JobStreamProps {
  onApply: (job: JobFeedItem) => void;
  applyingId?: string | null;
  appliedId?: string | null;
}
```

to:

```ts
interface JobStreamProps {
  onApply: (job: JobFeedItem) => void;
  onMarkApplied: (job: JobFeedItem) => void;
  applyingId?: string | null;
  appliedId?: string | null;
  /** APPLIED count from the real tracker (StrategyHub's ['jobs'] query). */
  appliedCount?: number;
}
```

(b) Change the function signature from:

```ts
export function JobStream({ onApply, applyingId, appliedId }: JobStreamProps) {
```

to:

```ts
export function JobStream({ onApply, onMarkApplied, applyingId, appliedId, appliedCount }: JobStreamProps) {
```

(c) Replace the `sentCount` derivation. Find:

```ts
  const allJobs = data?.jobs ?? [];
  const sentCount = useMemo(
    () => allJobs.filter(j => APPLIED_STATUSES.has(String(j.applicationStatus ?? ''))).length,
    [allJobs],
  );
```

Replace with:

```ts
  const allJobs = data?.jobs ?? [];
  // Prefer the tracker count (covers external + off-page applies); fall back to the
  // feed page when the tracker count isn't available yet.
  const feedSentCount = useMemo(
    () => allJobs.filter(j => APPLIED_STATUSES.has(String(j.applicationStatus ?? ''))).length,
    [allJobs],
  );
  const sentCount = typeof appliedCount === 'number' ? appliedCount : feedSentCount;
```

(d) Pass the handler to the card. Find:

```tsx
              <JobStreamCard job={job} onApply={onApply} applying={applyingId === job.id} />
```

Replace with:

```tsx
              <JobStreamCard job={job} onApply={onApply} onMarkApplied={onMarkApplied} applying={applyingId === job.id} />
```

- [ ] **Step 2: Verify it typechecks (JobStream will now error that StrategyHub must pass `onMarkApplied` — fixed in Task 8)**

Run: `cd E:/AntiGravity/JobHub && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep StrategyHub`
Expected: an error in `StrategyHub.tsx` that `onMarkApplied` is missing on `<JobStream>`. Fixed in Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/components/strategy/JobStream.tsx
git commit -m "feat(apply): stream uses tracker count + forwards mark-applied"
```

---

## Task 8: Wire StrategyHub (handler, count, tracker invalidation)

**Files:**
- Modify: `src/pages/StrategyHub.tsx`

- [ ] **Step 1: Import the helper and query client**

In `src/pages/StrategyHub.tsx`:

(a) Find the existing react-query import `import { useQuery } from '@tanstack/react-query';` and replace it with:

```ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
```

(b) Add this import next to the other `../lib` or `../components/strategy` imports (after the `import { JobStream } ...` line):

```ts
import { markFeedItemApplied } from '../lib/markApplied';
```

- [ ] **Step 2: Invalidate the tracker when returning with an applied job**

Find (around line 408-414):

```ts
    const appliedFeedItemId = (location.state as { appliedFeedItemId?: string } | null)?.appliedFeedItemId ?? null;
    useEffect(() => {
        if (appliedFeedItemId) {
            // clear so a refresh/re-render does not replay the beat
            window.history.replaceState({}, '');
        }
    }, [appliedFeedItemId]);
```

Replace with:

```ts
    const queryClient = useQueryClient();
    const appliedFeedItemId = (location.state as { appliedFeedItemId?: string } | null)?.appliedFeedItemId ?? null;
    useEffect(() => {
        if (appliedFeedItemId) {
            // Returning from the workspace finish: refresh the tracker so the momentum
            // count and GoalChip reflect the new APPLIED row (the stream refreshes
            // itself via the applied-beat effect).
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            // clear so a refresh/re-render does not replay the beat
            window.history.replaceState({}, '');
        }
    }, [appliedFeedItemId, queryClient]);
```

- [ ] **Step 3: Provide the handler and applied count to JobStream**

Find (around line 595):

```tsx
            <JobStream onApply={handleStreamApply} applyingId={applyingId} appliedId={appliedFeedItemId} />
```

Replace with:

```tsx
            <JobStream
                onApply={handleStreamApply}
                onMarkApplied={(job) => { void markFeedItemApplied(job.id, queryClient); }}
                applyingId={applyingId}
                appliedId={appliedFeedItemId}
                appliedCount={(jobs ?? []).filter((j: any) => j.status === 'APPLIED').length}
            />
```

NOTE: `jobs` is the existing `useQuery<JobLite[]>({ queryKey: ['jobs'] })` result already in scope in this component (defined at the bottom of `StrategyHub`). If `jobs` is NOT in scope at the JSX location where `<JobStream>` is rendered, STOP and report — do not refactor the queries.

- [ ] **Step 4: Verify the whole frontend typechecks**

Run: `cd E:/AntiGravity/JobHub && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v CoherenceCard`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/pages/StrategyHub.tsx
git commit -m "feat(apply): wire stream mark-applied handler + tracker count + invalidation"
```

---

## Task 9: Route ApplyDeepLinkButton through the shared helper

**Files:**
- Modify: `src/components/strategy/ApplyDeepLinkButton.tsx`

- [ ] **Step 1: Use the helper instead of the bare fire-and-forget call**

In `src/components/strategy/ApplyDeepLinkButton.tsx`:

(a) Add imports after the existing `import api from '../../lib/api';` line:

```ts
import { useQueryClient } from '@tanstack/react-query';
import { markFeedItemApplied } from '../../lib/markApplied';
```

(b) Inside the component body, after the existing `const [busy, setBusy] = useState...` line, add:

```ts
  const queryClient = useQueryClient();
```

(c) Find the existing mark step:

```ts
      // 3. Mark the feed item as applied (creates JobApplication if missing
      //    or updates the existing one to APPLIED with today's date).
      if (feedItemId) {
        api.post(`/job-feed/${feedItemId}/mark-applied`).catch(() => {
          // Tracker save isn't critical to the user's apply action; don't block.
        });
      }
```

Replace with:

```ts
      // 3. Mark the feed item as applied via the shared helper so the tracker +
      //    stream both refresh and the user gets consistent feedback.
      if (feedItemId) {
        void markFeedItemApplied(feedItemId, queryClient);
      }
```

(d) If `api` is now unused in the file, remove the `import api from '../../lib/api';` line. Verify by running step 2; if tsc reports `api` unused, remove that import and re-run.

- [ ] **Step 2: Verify it typechecks**

Run: `cd E:/AntiGravity/JobHub && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v CoherenceCard`
Expected: no output. (If it reports `'api' is declared but never read`, remove the `api` import per step 1d and re-run.)

- [ ] **Step 3: Commit**

```bash
git add src/components/strategy/ApplyDeepLinkButton.tsx
git commit -m "feat(apply): apply button marks applied via shared helper"
```

---

## Task 10: STOP — full manual verification of the loop

- [ ] **Step 1: Restart server + frontend, then run these scenarios**

1. **In-app apply:** From the stream, click **Apply** on a job → generate → finish. On return to the feed: the applied job is **gone**, the next role has **filled in**, and the "N applications sent" count **increased by 1**. The /tracker shows the job as APPLIED.
2. **External self-mark (created):** On a stream card, click **Mark as applied**. A toast appears: "Added to your tracker as applied" with an **Undo**. The card drops out and the count increments. Clicking **Undo** restores it (card returns on next refresh, count decrements).
3. **Self-mark of an already-applied job:** Mark a job that's already APPLIED → **no toast**, no double count.
4. `server/server.log` shows `POST /api/job-feed/<id>/mark-applied 200` for each mark.

- [ ] **Step 2: If any scenario fails, STOP and report exactly which scenario, what you saw, and the relevant `server.log` lines + browser console output. Do not attempt further fixes without reporting.**

---

## Self-Review (completed by plan author)

- **Spec coverage:** mark reliability (Task 2, sourceUrl matching + idempotency), stream refill (Tasks 5/7/8 invalidation), replacement (existing JobStream filter + invalidation), momentum from tracker (Tasks 7/8 `appliedCount` + `['jobs']` invalidation), external self-mark with retroactive Undo (Tasks 0/5/6, `created` branch + revert route Task 3), placement on cards + workspace (Task 6 cards; workspace finish unchanged but benefits from Task 2). All covered.
- **Placeholders:** none — every code step contains full content.
- **Type consistency:** `MarkAppliedResult` (created/previousStatus/alreadyApplied/jobApplicationId) is defined once in Task 0/5 and consumed unchanged; the server route (Task 2) returns exactly those fields; `reconcileApplication` action kinds (`create`/`promote`/`already_applied`) match between Task 1 and Task 2; `onMarkApplied` prop threads JobStreamCard (Task 6) → JobStream (Task 7) → StrategyHub (Task 8) with the same signature `(job: JobFeedItem) => void`.
- **Known intentional intermediate failures:** Tasks 6 and 7 each leave a typecheck error that the next task resolves; both are called out explicitly so the executor doesn't "fix" them locally.

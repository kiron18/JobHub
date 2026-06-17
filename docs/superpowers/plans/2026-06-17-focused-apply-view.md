# Focused Apply View + Activity Metric — Implementation Plan

> **For Kimi (executor):** Execute task by task, top to bottom. Backend logic is TDD (vitest, mocked prisma). This repo has **no React component test setup** (no testing-library) — so frontend components are verified by `npx tsc --noEmit` + a described manual check, and any non-trivial frontend logic is extracted into a pure util that IS vitest-tested. **Obey every STOP-and-report guard.** Don't rewrite reused code; call the existing endpoints. Commit after each task.

**Goal:** Replace the job list with a one-job-at-a-time focused apply view, add a trustworthy daily application metric (progress bar), and a GitHub-style activity heatmap on the tracker page.

**Architecture:** Presentation layer over existing machinery. The feed (`GET /job-feed/feed`) already returns jobs ordered by `matchScore` desc with applied/skipped excluded — render them one at a time. Apply/Preview/Skip reuse existing endpoints. The metric and heatmap are **derived-on-read** from `jobApplication.dateApplied` (never a stored counter), bucketed by `todayAEST()`.

**Tech Stack:** TypeScript, Express, Prisma 6, Vitest, React, Framer Motion, `warm` design tokens.

**Reference spec:** `docs/superpowers/specs/2026-06-17-focused-apply-view-design.md`

**Reuse (confirmed):**
- `GET /api/job-feed/feed` → `{ jobs: JobFeedItem[], ... }`, ordered `matchScore desc` (`job-feed.ts:179`).
- Preview hydrate: `POST /api/job-feed/:id/fetch-description`.
- Apply: pattern in `src/components/jobs/JobCard.tsx` `handlePrepareAndApply` → `navigate('/apply', {state})`.
- Skip + undo: `PATCH /api/job-feed/:id/skip` (`{skipped:boolean}`).
- Metric source: `jobApplication.dateApplied` (DateTime?), boundary `todayAEST()` from `server/src/services/jobFeed.ts`.
- Tokens: `src/lib/theme/warmTokens.ts` (`warm.colors.*`).

Run a single test: `cd server && npx vitest run <file>`.

---

### Task 1: Schema — daily goal field

**Files:** Modify `server/prisma/schema.prisma`

- [ ] **Step 1:** Add to `model CandidateProfile`:

```prisma
  dailyApplicationGoal Int @default(5)
```

- [ ] **Step 2:** `cd server && npx prisma migrate dev --name add_daily_application_goal`
Expected: migration created, client regenerated.
**STOP-and-report guard:** if `prisma migrate dev` isn't the project convention (there's `scripts/migrate-safe.js`), STOP and report before applying.

- [ ] **Step 3:** Commit
```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(tracker): add dailyApplicationGoal to CandidateProfile"
```

---

### Task 2: Pure metric helpers (TDD)

**Files:**
- Create: `server/src/services/tracker/metricHelpers.ts`
- Test: `server/src/services/tracker/metricHelpers.test.ts`

- [ ] **Step 1: Write the failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { countDistinctJobs, bucketByDay } from './metricHelpers';

describe('countDistinctJobs', () => {
  it('dedupes by sourceUrl', () => {
    expect(countDistinctJobs([
      { sourceUrl: 'a' }, { sourceUrl: 'a' }, { sourceUrl: 'b' },
    ])).toBe(2);
  });
  it('counts null sourceUrl rows individually by fallback id', () => {
    expect(countDistinctJobs([{ sourceUrl: null, id: '1' }, { sourceUrl: null, id: '2' }])).toBe(2);
  });
});

describe('bucketByDay', () => {
  it('zero-fills a trailing window and counts distinct jobs per AEST day', () => {
    const today = new Date('2026-06-17T00:00:00+10:00');
    const rows = [
      { sourceUrl: 'a', dateApplied: new Date('2026-06-17T03:00:00+10:00') },
      { sourceUrl: 'a', dateApplied: new Date('2026-06-17T05:00:00+10:00') }, // dup job, same day
      { sourceUrl: 'b', dateApplied: new Date('2026-06-16T09:00:00+10:00') },
    ];
    const out = bucketByDay(rows, 3, today);
    expect(out).toHaveLength(3);
    expect(out.find(d => d.date === '2026-06-17')!.count).toBe(1); // a counted once
    expect(out.find(d => d.date === '2026-06-16')!.count).toBe(1);
    expect(out.find(d => d.date === '2026-06-15')!.count).toBe(0); // zero-filled
  });
});
```

- [ ] **Step 2: Run, verify fail.** `cd server && npx vitest run src/services/tracker/metricHelpers.test.ts` → FAIL.

- [ ] **Step 3: Implement** `server/src/services/tracker/metricHelpers.ts`:

```ts
export interface JobRef { sourceUrl: string | null; id?: string; }
export interface AppliedRow extends JobRef { dateApplied: Date; }

function jobKey(r: JobRef): string {
  return r.sourceUrl ?? `__id:${r.id ?? Math.random()}`;
}

export function countDistinctJobs(rows: JobRef[]): number {
  return new Set(rows.map(jobKey)).size;
}

// yyyy-mm-dd in AEST (UTC+10, no DST handling — matches todayAEST convention).
function aestDateStr(d: Date): string {
  const aest = new Date(d.getTime() + 10 * 3600 * 1000);
  return aest.toISOString().slice(0, 10);
}

export function bucketByDay(rows: AppliedRow[], days: number, todayStartAest: Date): Array<{ date: string; count: number }> {
  const byDay = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = aestDateStr(r.dateApplied);
    if (!byDay.has(key)) byDay.set(key, new Set());
    byDay.get(key)!.add(jobKey(r));
  }
  const out: Array<{ date: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayStartAest.getTime() - i * 86400000);
    const key = aestDateStr(d);
    out.push({ date: key, count: byDay.get(key)?.size ?? 0 });
  }
  return out;
}
```

- [ ] **Step 4: Run, verify pass.** Same command → PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/tracker/metricHelpers.ts server/src/services/tracker/metricHelpers.test.ts
git commit -m "feat(tracker): pure metric helpers (distinct count, day bucketing)"
```

---

### Task 3: Tracker route — progress + activity endpoints (TDD)

**Files:**
- Create: `server/src/routes/tracker.ts`
- Modify: `server/src/index.ts` (mount route)
- Test: `server/src/routes/tracker.test.ts`

Use the same prisma import and auth middleware that `server/src/routes/job-feed.ts` uses.

- [ ] **Step 1: Inspect** `job-feed.ts` top: copy its `prisma` import and the auth middleware applied to its routes. Match exactly.

- [ ] **Step 2: Write the failing test** `server/src/routes/tracker.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const findUnique = vi.fn();
vi.mock('../lib/prisma', () => ({ prisma: {
  jobApplication: { findMany },
  candidateProfile: { findUnique },
} }));
vi.mock('../services/jobFeed', () => ({ todayAEST: () => new Date('2026-06-17T00:00:00+10:00') }));

import { getDailyProgress, getActivity } from './tracker';

beforeEach(() => { findMany.mockReset(); findUnique.mockReset(); });

describe('getDailyProgress', () => {
  it('counts distinct jobs applied today against the goal', async () => {
    findUnique.mockResolvedValue({ dailyApplicationGoal: 5 });
    findMany.mockResolvedValue([{ sourceUrl: 'a' }, { sourceUrl: 'a' }, { sourceUrl: 'b' }]);
    expect(await getDailyProgress('u1')).toEqual({ appliedToday: 2, goal: 5 });
  });
  it('defaults goal to 5 when profile missing', async () => {
    findUnique.mockResolvedValue(null);
    findMany.mockResolvedValue([]);
    expect(await getDailyProgress('u1')).toEqual({ appliedToday: 0, goal: 5 });
  });
});

describe('getActivity', () => {
  it('returns zero-filled trailing days', async () => {
    findMany.mockResolvedValue([{ sourceUrl: 'a', dateApplied: new Date('2026-06-17T03:00:00+10:00') }]);
    const out = await getActivity('u1', 7);
    expect(out).toHaveLength(7);
    expect(out[out.length - 1]).toEqual({ date: '2026-06-17', count: 1 });
  });
});
```

- [ ] **Step 3: Run, verify fail.** `cd server && npx vitest run src/routes/tracker.test.ts` → FAIL.

- [ ] **Step 4: Implement** `server/src/routes/tracker.ts`:

```ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { todayAEST } from '../services/jobFeed';
import { countDistinctJobs, bucketByDay } from '../services/tracker/metricHelpers';

export async function getDailyProgress(userId: string): Promise<{ appliedToday: number; goal: number }> {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { dailyApplicationGoal: true } });
  const goal = profile?.dailyApplicationGoal ?? 5;
  const rows = await prisma.jobApplication.findMany({
    where: { userId, dateApplied: { gte: todayAEST() } },
    select: { sourceUrl: true, id: true },
  });
  return { appliedToday: countDistinctJobs(rows), goal };
}

export async function getActivity(userId: string, days = 365): Promise<Array<{ date: string; count: number }>> {
  const since = new Date(todayAEST().getTime() - (days - 1) * 86400000);
  const rows = await prisma.jobApplication.findMany({
    where: { userId, dateApplied: { gte: since } },
    select: { sourceUrl: true, id: true, dateApplied: true },
  });
  return bucketByDay(rows as any, days, todayAEST());
}

const router = Router();
// Apply the SAME auth middleware job-feed.ts uses (req.user.id must be populated):
router.get('/progress', async (req: any, res: any) => {
  try { res.json(await getDailyProgress(req.user.id)); }
  catch (e) { console.error('[tracker/progress]', e); res.status(500).json({ error: 'failed' }); }
});
router.get('/activity', async (req: any, res: any) => {
  try { res.json(await getActivity(req.user.id)); }
  catch (e) { console.error('[tracker/activity]', e); res.status(500).json({ error: 'failed' }); }
});
export default router;
```

- [ ] **Step 5: Run, verify pass.** Same command → PASS.

- [ ] **Step 6: Mount** in `server/src/index.ts` next to the job-feed mount, with the same auth middleware: `app.use('/api/tracker', <sameAuth>, trackerRouter);`

**STOP-and-report guard A:** Confirm `POST /api/job-feed/:id/mark-applied` sets `dateApplied`. Grep: `grep -n "dateApplied" server/src/routes/job-feed.ts`. If apply sets only `status` and never `dateApplied`, STOP and report — the metric would read empty.

**STOP-and-report guard (prisma path):** if `../lib/prisma` is not the real client (match job-feed.ts's import), fix the import + mock and report.

- [ ] **Step 7: Verify compile.** `cd server && npx tsc --noEmit` → no new errors.

- [ ] **Step 8: Commit**
```bash
git add server/src/routes/tracker.ts server/src/index.ts server/src/routes/tracker.test.ts
git commit -m "feat(tracker): derived progress + activity endpoints"
```

---

### Task 4: DailyProgressBar component

**Files:** Create `src/components/jobs/DailyProgressBar.tsx`

- [ ] **Step 1: Implement** (uses `warm` tokens; shows `applied / goal`, fills at goal, over-state past goal):

```tsx
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

export function DailyProgressBar() {
  const { data } = useQuery({
    queryKey: ['tracker-progress'],
    queryFn: async () => (await api.get('/tracker/progress')).data as { appliedToday: number; goal: number },
    staleTime: 30_000,
  });
  const applied = data?.appliedToday ?? 0;
  const goal = data?.goal ?? 5;
  const pct = Math.min(applied / goal, 1) * 100;
  const over = applied > goal;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: warm.colors.textSecondary }}>
        <span>Today's applications</span>
        <span style={{ fontWeight: 700, color: warm.colors.textPrimary }}>
          {applied} of {goal}{over ? ` ✓ +${applied - goal}` : ''}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: warm.colors.borderWhisper, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: warm.colors.accentPetrol, borderRadius: 6, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compile.** `npx tsc --noEmit` (repo root) → no new errors.

- [ ] **Step 3: Commit**
```bash
git add src/components/jobs/DailyProgressBar.tsx
git commit -m "feat(focused-apply): daily progress bar"
```

---

### Task 5: FocusedApplyView component

**Files:** Create `src/components/jobs/FocusedApplyView.tsx`

Self-contained: holds the queue from `/feed`, renders one card, advances on action. Reuses existing endpoints. Does NOT modify `JobCard.tsx`.

- [ ] **Step 1: Implement**:

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { DailyProgressBar } from './DailyProgressBar';
import type { JobFeedItem } from './JobCard';

function recency(iso: string | null): string | null {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'Posted today' : d === 1 ? 'Posted yesterday' : `Posted ${d}d ago`;
}

export function FocusedApplyView({ jobs: initial }: { jobs: JobFeedItem[] }) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<JobFeedItem[]>(initial);
  const [expanded, setExpanded] = useState(false);
  const job = queue[0];

  if (!job) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: warm.colors.textSecondary }}>
        <p style={{ fontWeight: 700, color: warm.colors.textPrimary }}>That's your shortlist for today.</p>
        <p style={{ fontSize: 14 }}>Come back tomorrow for fresh matches.</p>
      </div>
    );
  }

  const advance = () => { setExpanded(false); setQueue(q => q.slice(1)); };

  const onPreview = async () => {
    const next = !expanded; setExpanded(next);
    if (next && (job.description?.length ?? 0) < 600) {
      try {
        const { data } = await api.post(`/job-feed/${job.id}/fetch-description`);
        setQueue(q => q.map((j, i) => i === 0 ? { ...j, description: data.description } : j));
      } catch { /* keep teaser */ }
    }
  };

  const onApply = () => {
    localStorage.setItem('jobhub_apply_context', JSON.stringify({
      jobId: job.id, title: job.title, company: job.company, description: job.description,
      sourceUrl: job.sourceUrl, sourcePlatform: job.sourcePlatform,
    }));
    navigate('/apply', { state: {
      jobDescription: job.description, company: job.company, role: job.title,
      feedItemId: job.id, sourceUrl: job.sourceUrl, sourcePlatform: job.sourcePlatform,
    }});
  };

  const onSkip = async () => {
    const skipped = job;
    advance();
    try {
      await api.patch(`/job-feed/${skipped.id}/skip`, { skipped: true });
      toast('Not for you', { action: { label: 'Undo', onClick: async () => {
        try { await api.patch(`/job-feed/${skipped.id}/skip`, { skipped: false }); setQueue(q => [skipped, ...q]); } catch {}
      }}});
    } catch { toast.error('Could not skip'); }
  };

  const chips = [job.sourcePlatform ? `via ${job.sourcePlatform === 'seek' ? 'Seek' : job.sourcePlatform}` : null, recency(job.postedAt)].filter(Boolean) as string[];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AnimatePresence mode="wait">
        <motion.div key={job.id}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22 }}
          style={{ border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 16, background: warm.colors.bgSurface, padding: 22 }}>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: warm.colors.textPrimary }}>{job.title}</p>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: warm.colors.textSecondary }}>
            {job.company}{job.location ? ` · ${job.location}` : ''}{job.salary ? ` · ${job.salary}` : ''}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
            {chips.map(c => (
              <span key={c} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                background: warm.colors.borderWhisper, color: warm.colors.textSecondary }}>{c}</span>
            ))}
          </div>
          {expanded && (
            <div style={{ fontSize: 13, lineHeight: 1.55, color: warm.colors.textSecondary, whiteSpace: 'pre-wrap',
              maxHeight: 320, overflowY: 'auto', margin: '8px 0 16px' }}>{job.description}</div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <button onClick={onApply} style={{ flex: 1, padding: '12px 18px', borderRadius: 12, border: 'none',
              cursor: 'pointer', fontWeight: 800, fontSize: 14.5, background: warm.colors.accentPetrol, color: warm.colors.textOnDeep }}>
              Apply →
            </button>
            <button onClick={onPreview} style={{ padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${warm.colors.borderWhisper}`, background: 'transparent', color: warm.colors.textSecondary, fontWeight: 700, fontSize: 13 }}>
              {expanded ? 'Hide' : 'Preview'}
            </button>
          </div>
          <button onClick={onSkip} style={{ marginTop: 10, width: '100%', padding: '8px', borderRadius: 10, cursor: 'pointer',
            border: 'none', background: 'transparent', color: warm.colors.textMuted, fontSize: 12.5 }}>
            Not for me
          </button>
        </motion.div>
      </AnimatePresence>
      <DailyProgressBar />
    </div>
  );
}
```

- [ ] **Step 2: Verify compile.** `npx tsc --noEmit` → no new errors. (If `warm.colors.textOnDeep` or `bgSurface` names differ, check `src/lib/theme/warmTokens.ts` and use the real token names — do not invent colors.)

- [ ] **Step 3: Commit**
```bash
git add src/components/jobs/FocusedApplyView.tsx
git commit -m "feat(focused-apply): one-job-at-a-time view"
```

---

### Task 6: Swap the job surface to the focused view

**Files:** Modify `src/pages/JobFeedPage.tsx`

- [ ] **Step 1:** Replace the job-cards block (the `{jobs.length > 0 && ( ... jobs.map(job => <JobCard .../>) ... )}` section, lines ~249–281) with a single render of the focused view:

```tsx
{jobs.length > 0 && <FocusedApplyView jobs={jobs} />}
```

Add the import at the top: `import { FocusedApplyView } from '../components/jobs/FocusedApplyView';`
Leave the loading/building/empty/error states and the header as they are. Remove the now-unused `JobCard` import and the `handleUpdate`/`handleLoadMore`/pagination wiring only if they become unused (tsc will flag unused vars — clean those up). Do NOT delete `JobCard.tsx` itself.

- [ ] **Step 2: Verify compile + manual.** `npx tsc --noEmit` → clean. Then manually: load the jobs page, confirm one card shows, Preview expands the JD, "Not for me" advances + Undo works, Apply navigates to `/apply`, and the daily bar renders.

**STOP-and-report guard:** if removing pagination/`handleLoadMore` cascades into other breakage, STOP and report rather than ripping out more than the card list.

- [ ] **Step 3: Commit**
```bash
git add src/pages/JobFeedPage.tsx
git commit -m "feat(focused-apply): replace job list with focused view"
```

---

### Task 7: Heatmap grid builder (TDD)

**Files:**
- Create: `src/components/tracker/heatmapGrid.ts`
- Test: `src/components/tracker/heatmapGrid.test.ts`

- [ ] **Step 1: Write the failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { intensityLevel } from './heatmapGrid';

describe('intensityLevel', () => {
  it('maps counts to 0..4 with goal as the top bucket', () => {
    expect(intensityLevel(0)).toBe(0);
    expect(intensityLevel(1)).toBe(1);
    expect(intensityLevel(2)).toBe(1);
    expect(intensityLevel(3)).toBe(2);
    expect(intensityLevel(4)).toBe(3);
    expect(intensityLevel(5)).toBe(4);
    expect(intensityLevel(9)).toBe(4); // goal met/exceeded = darkest
  });
});
```

- [ ] **Step 2: Run, verify fail.** `npx vitest run src/components/tracker/heatmapGrid.test.ts` → FAIL.

- [ ] **Step 3: Implement** `src/components/tracker/heatmapGrid.ts`:

```ts
// Intensity tied to the daily goal of 5: 0 / 1-2 / 3-4 / 5+ darkest.
export function intensityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 3) return 2;
  if (count <= 4) return 3;
  return 4;
}

export const HEATMAP_GREENS = ['#EBEDF0', '#C6E8C9', '#7DC98A', '#3FA34D', '#1E7A34'];
```

- [ ] **Step 4: Run, verify pass.** Same command → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/tracker/heatmapGrid.ts src/components/tracker/heatmapGrid.test.ts
git commit -m "feat(tracker): heatmap intensity buckets tied to daily goal"
```

---

### Task 8: ActivityHeatmap component + place on tracker page

**Files:**
- Create: `src/components/tracker/ActivityHeatmap.tsx`
- Modify: `src/components/ApplicationTracker.tsx` (render it)

- [ ] **Step 1: Implement** `src/components/tracker/ActivityHeatmap.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { intensityLevel, HEATMAP_GREENS } from './heatmapGrid';

export function ActivityHeatmap() {
  const { data } = useQuery({
    queryKey: ['tracker-activity'],
    queryFn: async () => (await api.get('/tracker/activity')).data as Array<{ date: string; count: number }>,
    staleTime: 5 * 60_000,
  });
  const days = data ?? [];
  // Chunk into weeks (columns of 7).
  const weeks: Array<Array<{ date: string; count: number }>> = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>Application activity</p>
      <div style={{ display: 'flex', gap: 3, overflowX: 'auto' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {week.map(d => (
              <div key={d.date} title={`${d.date}: ${d.count} application${d.count === 1 ? '' : 's'}`}
                style={{ width: 11, height: 11, borderRadius: 2, background: HEATMAP_GREENS[intensityLevel(d.count)] }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontSize: 11, color: warm.colors.textMuted }}>
        <span>Less</span>
        {HEATMAP_GREENS.map(c => <span key={c} style={{ width: 11, height: 11, borderRadius: 2, background: c }} />)}
        <span>More</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render it** inside `src/components/ApplicationTracker.tsx` — place `<ActivityHeatmap />` near the top of the tracker content (import it). Do not add it to the dashboard.

- [ ] **Step 3: Verify compile + manual.** `npx tsc --noEmit` → clean. Open the tracker page; confirm the heatmap renders with the Less/More legend and that applying to a job makes today's square darken on reload.

- [ ] **Step 4: Commit**
```bash
git add src/components/tracker/ActivityHeatmap.tsx src/components/ApplicationTracker.tsx
git commit -m "feat(tracker): GitHub-style application activity heatmap"
```

---

## Self-Review (by author)

- **Spec coverage:** focused one-at-a-time view (T5–6), factual chips via source+recency (T5), Preview/Apply/Skip reuse (T5), daily derived metric + bar (T2–4), activity heatmap goal-tied (T7–8), schema goal field (T1), dashboard untouched (heatmap only in ApplicationTracker). All mapped.
- **Integrity:** metric is computed-on-read from `jobApplication.dateApplied` via `todayAEST()`; no stored counter; distinct-per-job tested.
- **Test posture:** backend logic + pure frontend logic TDD'd in vitest; React components verified by tsc + manual (repo has no component test infra).
- **Guards:** migrate convention; `mark-applied` actually sets `dateApplied` (guard A — the metric's load-bearing assumption); prisma import path; warm token names; pagination-removal blast radius.
- **Type consistency:** `getDailyProgress(userId)→{appliedToday,goal}`, `getActivity(userId,days)→{date,count}[]`, `countDistinctJobs`, `bucketByDay`, `intensityLevel` consistent across tasks and call sites.

## Executor must surface (not coding blockers, live-behaviour blockers)
- **Guard A is the one to watch:** if `/mark-applied` doesn't set `dateApplied`, the bar and heatmap read empty even though everything compiles. Report what the grep finds.

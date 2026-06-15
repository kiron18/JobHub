# Application Workspace — Slice D (Applied beat + refill stream) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** When the user returns to the workspace after applying, the just-applied card plays a short "Applied" beat, animates out, and the next scraped job slides into its slot, with a positive running count of applications sent.

**Architecture:** `StrategyHub` reads `location.state.appliedFeedItemId` and passes it to `JobStream`. `JobStream` keeps the applied card visible with an "Applied" overlay for ~1.2s, then animates it out (Framer Motion `AnimatePresence` + `layout`), invalidates the feed so the applied job (now `APPLIED`) drops from the filtered list and the next un-applied job fills the slot. A momentum line shows the count of applications sent.

**Tech Stack:** React, TypeScript, framer-motion, react-query.

**Spec:** `docs/superpowers/specs/2026-06-07-application-workspace-job-stream-design.md` §5, copy §8.4. **Depends on Slices B + C.**

**Rules:** Build exactly this. No em dashes ([[feedback_no_em_dashes]]). Animation must be purposeful and under ~1.5s, pulling the eye to the next job, never a decorative loop ([[feedback_purposeful_animation]]). Reuse warm tokens.

---

## Phase 0 — Verifications (DONE 2026-06-07 by Claude)

- **0.1** Slice C navigates back with `navigate('/', { state: { appliedFeedItemId } })` after `mark-applied`. So on return, `useLocation().state.appliedFeedItemId` holds the id of the job just applied to.
- **0.2** `JobStream` (Slice B) filters out applied statuses and slices to 3; the feed query key is `['job-feed', 0]`. `mark-applied` (Slice C) flips the job's `applicationStatus` to `APPLIED`, so after a feed refetch the applied job is excluded by the existing filter.
- **0.3** framer-motion (`motion`, `AnimatePresence`) is already a dependency used across the app.

---

## File Structure

- Modify: `src/pages/StrategyHub.tsx` — read `appliedFeedItemId` from router state, pass to `JobStream`, clear it after consuming.
- Modify: `src/components/strategy/JobStream.tsx` — applied beat, exit animation, refill, momentum count.

---

## Task 1: Thread `appliedFeedItemId` from router state into the stream

**Files:** Modify `src/pages/StrategyHub.tsx`.

- [ ] **Step 1: Read and clear the applied id**

In the component that renders `AnalysisHeroCard` (or `AnalysisHeroCard` itself, wherever `useLocation`/`useNavigate` are available), read the applied id once and clear it from history so a refresh does not replay the beat:

```typescript
    const location = useLocation();
    const appliedFeedItemId = (location.state as { appliedFeedItemId?: string } | null)?.appliedFeedItemId ?? null;
    useEffect(() => {
        if (appliedFeedItemId) {
            // clear so a refresh/re-render does not replay the beat
            window.history.replaceState({}, '');
        }
    }, [appliedFeedItemId]);
```

Add `useLocation` to the `react-router-dom` import if not present.

- [ ] **Step 2: Pass it to the stream**

```tsx
                <JobStream onApply={handleStreamApply} applyingId={applyingId} appliedId={appliedFeedItemId} />
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit` (exit 0).

```bash
git add src/pages/StrategyHub.tsx
git commit -m "feat(workspace): pass applied job id into the stream on return"
```

---

## Task 2: Applied beat + exit animation + refill + momentum

**Files:** Modify `src/components/strategy/JobStream.tsx`.

- [ ] **Step 1: Rewrite `JobStream` to animate the applied card out and refill**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { JobStreamCard } from './JobStreamCard';
import type { JobFeedItem } from '../jobs/JobCard';

interface JobStreamProps {
  onApply: (job: JobFeedItem) => void;
  applyingId?: string | null;
  appliedId?: string | null;
}

const APPLIED_STATUSES = new Set(['APPLIED', 'INTERVIEW', 'REJECTED', 'OFFER']);

export function JobStream({ onApply, applyingId, appliedId }: JobStreamProps) {
  const queryClient = useQueryClient();
  const { data } = useQuery<{ jobs?: JobFeedItem[] }>({
    queryKey: ['job-feed', 0],
    queryFn: async () => (await api.get('/job-feed/feed?offset=0')).data,
    staleTime: 5 * 60 * 1000,
  });

  const allJobs = data?.jobs ?? [];
  const sentCount = useMemo(
    () => allJobs.filter(j => APPLIED_STATUSES.has(String((j as any).applicationStatus ?? ''))).length,
    [allJobs],
  );

  // The card currently playing the "Applied" beat (kept visible briefly before exit).
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  useEffect(() => {
    if (!appliedId) return;
    setCelebratingId(appliedId);
    const t = setTimeout(() => {
      setCelebratingId(null);
      // Refetch so the applied job (now APPLIED) drops out and the next fills in.
      queryClient.invalidateQueries({ queryKey: ['job-feed'] });
    }, 1200);
    return () => clearTimeout(t);
  }, [appliedId, queryClient]);

  const visible = useMemo(() => {
    const unApplied = allJobs.filter(j => !APPLIED_STATUSES.has(String((j as any).applicationStatus ?? '')));
    // While celebrating, keep the applied card in view so its beat is seen.
    if (celebratingId) {
      const celeb = allJobs.find(j => j.id === celebratingId);
      const rest = unApplied.filter(j => j.id !== celebratingId).slice(0, 2);
      return celeb ? [celeb, ...rest] : unApplied.slice(0, 3);
    }
    return unApplied.slice(0, 3);
  }, [allJobs, celebratingId]);

  if (visible.length === 0) {
    return (
      <div style={{ border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 14, background: warm.colors.bgSurface, padding: '24px 18px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>That is every fresh match for now.</p>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textSecondary }}>Paste your own job below, or check back soon for new roles.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sentCount > 0 && (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: warm.colors.textMuted }}>
          {sentCount} applications sent
        </p>
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map(job => (
          <motion.div
            key={job.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
            style={{ position: 'relative' }}
          >
            {celebratingId === job.id ? (
              <div style={{
                border: `1px solid ${warm.colors.success ?? '#2A9D6F'}`, borderRadius: 14,
                background: 'rgba(42,157,111,0.08)', padding: '20px 18px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Check size={18} color={warm.colors.success ?? '#2A9D6F'} />
                <span style={{ fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>Applied</span>
              </div>
            ) : (
              <JobStreamCard job={job} onApply={onApply} applying={applyingId === job.id} />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

(If `warm.colors.success` does not exist, STOP and report; do not invent a token. Use the existing success/green token name from `warmTokens`.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exit 0.

- [ ] **Step 3: Manual check**

Apply a job end to end. On return: the applied card shows a green "Applied" state for ~1.2s, then collapses out and the list shifts up with the next scraped job sliding into the third slot. The momentum line reads "{n} applications sent" and increments. Beat is under ~1.5s, no looping motion.

- [ ] **Step 4: Commit**

```bash
git add src/components/strategy/JobStream.tsx
git commit -m "feat(workspace): applied beat, exit animation, refill stream, momentum count"
```

---

## Self-Review

- [ ] Spec §5 (applied confirmation ~1.2s → animate out → refill to 3 → momentum count, purposeful and <1.5s) covered. Copy §8.4 ("Applied", "{n} applications sent") transcribed verbatim.
- [ ] Consumes Slice C's `{ appliedFeedItemId }` return state; relies on Slice B's filter + Slice A's `mark-applied` status flip. No new backend.
- [ ] Animation keyed by job id so only the applied card animates; `success` token verified in Step 1 (STOP-and-report guard).

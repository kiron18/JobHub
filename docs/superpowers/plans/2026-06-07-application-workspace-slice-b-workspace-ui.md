# Application Workspace — Slice B (Workspace UI: job stream) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the dashboard apply card into an Application Workspace whose hero is a stream of ~3 preloaded scraped jobs, with "Paste your own job" and "Selection criteria" as secondary buttons.

**Architecture:** A new `JobStream` component fetches the user's un-applied jobs and renders up to 3 `JobStreamCard`s. `StrategyHub`'s `AnalysisHeroCard` becomes: header → `JobStream` (hero) → two secondary buttons; the existing paste `textarea` + analyse flow is preserved but revealed only when "Paste your own job" is clicked. A pure `jobBlurb()` helper produces the one-line card blurb.

**Tech Stack:** React, TypeScript, @tanstack/react-query, framer-motion, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-07-application-workspace-job-stream-design.md` §3, copy §8.1/§8.2/§8.5. **Depends on Slice A** (not required to render, but Apply wiring is Slice C).

**Rules:** Build exactly this. No em dashes anywhere ([[feedback_no_em_dashes]]). Reuse the warm dashboard tokens (`src/lib/theme/warmTokens` / the `warm` import already used in StrategyHub), no new aesthetic ([[feedback_dashboard_style]]). STOP-and-report where told.

---

## Phase 0 — Verifications (DONE 2026-06-07 by Claude)

- **0.1** `src/pages/StrategyHub.tsx` → `AnalysisHeroCard` holds: `jd` state, the paste `<textarea data-process-step="paste">`, `handleAnalyse` (navigates to `/apply`), `<ApplyFeedStrip onPick={handleFeedPick} />`, and a localStorage preload effect (`jobhub_preload_jd`). The Apply/"Analyse" button calls `handleAnalyse`.
- **0.2** Feed read: `GET /api/job-feed/feed?offset=0` returns `{ jobs: JobFeedItem[], total, hasMore, building?, profileIncomplete? }`; each job has `applicationStatus` (matched by sourceUrl) and the full `description` + `sourceUrl`. `JobFeedItem` type is exported from `src/components/jobs/JobCard.tsx`.
- **0.3** Tokens: `import { warm } from '../lib/theme/warmTokens'` is already used in StrategyHub; cards must reuse `warm.colors.*`.

---

## File Structure

- Create: `src/lib/jobBlurb.ts` — pure one-line blurb helper.
- Test: `src/lib/jobBlurb.test.ts`.
- Create: `src/components/strategy/JobStreamCard.tsx` — one slim job card.
- Create: `src/components/strategy/JobStream.tsx` — fetch + render up to 3 un-applied jobs; empty state.
- Modify: `src/pages/StrategyHub.tsx` — `AnalysisHeroCard`: render `JobStream` as hero + two secondary buttons; gate the paste box behind a "Paste your own job" toggle.

---

## Task 1: `jobBlurb` helper (pure, TDD)

**Files:** Create `src/lib/jobBlurb.ts`, Test `src/lib/jobBlurb.test.ts`.

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { jobBlurb } from './jobBlurb';

describe('jobBlurb', () => {
  it('collapses whitespace/newlines to one line', () => {
    expect(jobBlurb('Line one\n\nLine two   tabbed')).toBe('Line one Line two tabbed');
  });
  it('truncates to ~120 chars with an ellipsis', () => {
    const long = 'a'.repeat(200);
    const out = jobBlurb(long);
    expect(out.length).toBeLessThanOrEqual(121);
    expect(out.endsWith('…')).toBe(true);
  });
  it('returns empty string for empty/nullish input', () => {
    expect(jobBlurb('')).toBe('');
    expect(jobBlurb(undefined as any)).toBe('');
  });
  it('does not add an ellipsis when under the limit', () => {
    expect(jobBlurb('Short and sweet')).toBe('Short and sweet');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/lib/jobBlurb.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
// One-line, ~120-char preview of a job description for a card. Never shows the
// full posting (the full text is reserved for generation).
export function jobBlurb(description: string | null | undefined, max = 120): string {
  if (!description) return '';
  const oneLine = description.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max).trimEnd() + '…';
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/lib/jobBlurb.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/jobBlurb.ts src/lib/jobBlurb.test.ts
git commit -m "feat(workspace): jobBlurb one-line description helper"
```

---

## Task 2: `JobStreamCard` component

**Files:** Create `src/components/strategy/JobStreamCard.tsx`.

Renders one job. The `onApply` handler is a prop (wired in Slice C). Salary line renders only when present. Source tag is `via Seek` when `sourcePlatform === 'seek'`, else `via ${sourcePlatform}`.

- [ ] **Step 1: Implement**

```tsx
import { ExternalLink } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { jobBlurb } from '../../lib/jobBlurb';
import type { JobFeedItem } from '../jobs/JobCard';

interface JobStreamCardProps {
  job: JobFeedItem;
  onApply: (job: JobFeedItem) => void;
  applying?: boolean;
}

export function JobStreamCard({ job, onApply, applying }: JobStreamCardProps) {
  const source = job.sourcePlatform === 'seek' ? 'via Seek' : `via ${job.sourcePlatform ?? 'the web'}`;
  return (
    <div style={{
      border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 14,
      background: warm.colors.bgSurface, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>{job.title}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: warm.colors.textSecondary }}>
            {job.company}{job.location ? ` · ${job.location}` : ''}
          </p>
        </div>
        <span style={{ fontSize: 11, color: warm.colors.textMuted, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ExternalLink size={11} /> {source}
        </span>
      </div>

      {job.salary ? (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: warm.colors.textPrimary }}>{job.salary}</p>
      ) : null}

      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: warm.colors.textSecondary }}>
        {jobBlurb(job.description)}
      </p>

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
          {applying ? 'Opening…' : 'Apply'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exit 0. (If `JobFeedItem` lacks `sourcePlatform`/`salary`/`location`, STOP and report — do not invent fields.)

- [ ] **Step 3: Commit**

```bash
git add src/components/strategy/JobStreamCard.tsx
git commit -m "feat(workspace): JobStreamCard"
```

---

## Task 3: `JobStream` component (fetch + 3 visible + empty state)

**Files:** Create `src/components/strategy/JobStream.tsx`.

Fetches the feed, shows the first 3 jobs whose `applicationStatus` is not applied. Exposes `onApply` upward (Slice C wires it). Empty state uses copy §8.5.

- [ ] **Step 1: Implement**

```tsx
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { JobStreamCard } from './JobStreamCard';
import type { JobFeedItem } from '../jobs/JobCard';

interface JobStreamProps {
  onApply: (job: JobFeedItem) => void;
  applyingId?: string | null;
}

const APPLIED_STATUSES = new Set(['APPLIED', 'INTERVIEW', 'REJECTED', 'OFFER']);

export function JobStream({ onApply, applyingId }: JobStreamProps) {
  const { data } = useQuery<{ jobs?: JobFeedItem[] }>({
    queryKey: ['job-feed', 0],
    queryFn: async () => (await api.get('/job-feed/feed?offset=0')).data,
    staleTime: 5 * 60 * 1000,
  });

  const visible = useMemo(() => {
    const all = data?.jobs ?? [];
    return all.filter(j => !APPLIED_STATUSES.has(String((j as any).applicationStatus ?? ''))).slice(0, 3);
  }, [data]);

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
      {visible.map(job => (
        <JobStreamCard key={job.id} job={job} onApply={onApply} applying={applyingId === job.id} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/strategy/JobStream.tsx
git commit -m "feat(workspace): JobStream list with empty state"
```

---

## Task 4: Restructure `AnalysisHeroCard` (stream hero + two buttons)

**Files:** Modify `src/pages/StrategyHub.tsx`.

- [ ] **Step 1: Imports**

Add to StrategyHub imports:

```typescript
import { JobStream } from '../components/strategy/JobStream';
```

- [ ] **Step 2: Add a "show paste box" toggle + a placeholder apply handler**

Inside `AnalysisHeroCard`, add state near the other `useState`s:

```typescript
    const [showPaste, setShowPaste] = useState(false);
    // Slice C replaces this with the real start-apply + navigate. For Slice B it
    // routes through the existing paste-and-analyse path so the card is testable.
    const handleStreamApply = (job: import('../components/jobs/JobCard').JobFeedItem) => {
        setJd(job.description ?? '');
        setPickedFeedItem(job);
        setShowPaste(true);
    };
```

- [ ] **Step 3: Render the stream as the hero + the two secondary buttons**

In the `AnalysisHeroCard` JSX, ABOVE the existing `Analyse a role` / `ApplyFeedStrip` / `textarea` block, insert the stream and the two buttons. Replace the `<ApplyFeedStrip onPick={handleFeedPick} />` line with the job stream, and wrap the existing paste `textarea` + its controls so they only render when `showPaste` is true. Concretely:

1. Insert before the eyebrow "Analyse a role":

```tsx
                <JobStream onApply={handleStreamApply} />

                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    <button
                        onClick={() => setShowPaste(v => !v)}
                        style={{
                            flex: 1, padding: '12px 16px', borderRadius: 12,
                            border: `1px solid ${warm.colors.borderDefined}`, background: 'transparent',
                            color: warm.colors.textSecondary, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Paste your own job
                    </button>
                    <button
                        onClick={() => { setShowPaste(true); /* SC default module is the existing paste flow */ }}
                        style={{
                            flex: 1, padding: '12px 16px', borderRadius: 12,
                            border: `1px solid ${warm.colors.borderDefined}`, background: 'transparent',
                            color: warm.colors.textSecondary, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Selection criteria
                    </button>
                </div>
```

2. Wrap the existing paste block (the `Analyse a role` eyebrow through the analyse button, including the `textarea`) in `{showPaste && ( ... )}` so it is hidden by default and revealed by the buttons. Do NOT delete the paste/analyse logic; only gate its visibility.

3. Remove the now-unused `<ApplyFeedStrip onPick={handleFeedPick} />` usage. If this makes the `ApplyFeedStrip` import or `handleFeedPick` unused, delete the import and the `handleFeedPick` function (noUnusedLocals will fail otherwise). The localStorage preload effect (`jobhub_preload_jd`) from the previous slice is now redundant with the stream; leave it for now (harmless) unless tsc flags it.

- [ ] **Step 4: Update the workspace subline copy**

Find the dashboard subline ("Paste any job description. Get a tailored resume and cover letter in 3 minutes.") and replace it verbatim with:

```
Real roles we found for you, ready to apply to in minutes. Pick one and we will tailor your resume and cover letter.
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exit 0. If `ApplyFeedStrip`/`handleFeedPick`/preload-effect now unused and flagged, remove them and re-run.

- [ ] **Step 6: Manual check**

Load the dashboard as a user with scraped jobs: 3 job cards show (title, salary if present, blurb, Apply), with "Paste your own job" + "Selection criteria" below. Clicking a button reveals the paste box. With no un-applied jobs, the empty state (§8.5) shows.

- [ ] **Step 7: Commit**

```bash
git add src/pages/StrategyHub.tsx
git commit -m "feat(workspace): job stream as dashboard hero, paste/SC as secondary"
```

---

## Self-Review

- [ ] Spec §3 (3-card hero, salary-if-present, blurb, two secondary buttons, empty state) covered by Tasks 2-4. Copy §8.1 (subline), §8.2 (Apply / button labels / via Seek), §8.5 (empty state) transcribed verbatim.
- [ ] No placeholders. `JobFeedItem` fields used (`id, title, company, location, salary, description, sourcePlatform, applicationStatus`) confirmed in Step 2 typecheck.
- [ ] Apply is a no-op-ish reveal in Slice B; Slice C replaces `handleStreamApply` with start-apply + navigate.

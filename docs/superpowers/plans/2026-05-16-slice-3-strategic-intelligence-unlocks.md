# Slice 3: Strategic Intelligence Unlock Track — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Strategic Intelligence" card to the dashboard that progressively unlocks insights as the user sends applications. Each unlock is a genuine analytic output that requires behaviour data — not a contrived gate. Ship the first two unlocks (Application Pattern at 1 app, Industry Fit Map at 3 apps) and the visual scaffolding for the deeper ones (Personal Playbook at 5, Response-Rate Analysis at 10).

**Architecture:** Pure frontend for the unlock card UI and the unlock-state tracking (localStorage per the spec's v1 decision). One new backend endpoint computes the analytic payload for each unlocked insight on demand. The applications-sent count is read from existing application-tracker data.

**Tech Stack:** React 19, TanStack Query 5, Framer Motion, lucide-react. Backend additions in Express/Prisma for the insight computation endpoint.

**Reference spec:** `docs/superpowers/specs/2026-05-16-post-diagnostic-flow-redesign.md` (section 7).

---

## File map

**New files:**
- `src/lib/strategicIntelligence.ts` — unlock track definitions, threshold checks, localStorage helpers
- `src/components/StrategicIntelligenceCard.tsx` — the dashboard card showing unlock progression
- `src/components/insights/ApplicationPatternInsight.tsx` — first unlock UI
- `src/components/insights/IndustryFitMapInsight.tsx` — second unlock UI
- `src/components/insights/InsightPlaceholder.tsx` — "coming soon" view for not-yet-built unlocks
- `server/src/routes/insights.ts` — new router for on-demand insight computation
  - `GET /insights/application-pattern`
  - `GET /insights/industry-fit-map`

**Modified files:**
- `src/pages/StrategyHub.tsx` — render the `StrategicIntelligenceCard`
- `server/src/index.ts` — mount the insights router

---

## Task list

### Task 1: Define the unlock track + localStorage helpers

**Files:**
- Create: `src/lib/strategicIntelligence.ts`

- [ ] **Step 1: Write the module**

```typescript
// src/lib/strategicIntelligence.ts

export type InsightKey =
  | 'diagnostic'
  | 'application-pattern'
  | 'industry-fit-map'
  | 'personal-playbook'
  | 'response-rate';

export interface InsightDef {
  key: InsightKey;
  label: string;
  description: string;
  /** Minimum applications-sent count to unlock. Diagnostic is always 0. */
  unlockThreshold: number;
  /** Whether the insight UI is built yet. Used to show "coming soon" placeholders. */
  implemented: boolean;
}

export const INSIGHT_TRACK: InsightDef[] = [
  { key: 'diagnostic',          label: 'Diagnostic',              description: 'Your starting baseline.',                              unlockThreshold: 0,  implemented: true },
  { key: 'application-pattern', label: 'Application pattern',     description: 'Where you apply vs. where your resume actually fits.', unlockThreshold: 1,  implemented: true },
  { key: 'industry-fit-map',    label: 'Industry fit map',        description: 'Your match strength across industries you target.',    unlockThreshold: 3,  implemented: true },
  { key: 'personal-playbook',   label: 'Personal playbook',       description: 'Your highest-leverage next move, given your history.', unlockThreshold: 5,  implemented: false },
  { key: 'response-rate',       label: 'Response-rate analysis',  description: 'Which application types open at higher rates.',        unlockThreshold: 10, implemented: false },
];

export function isUnlocked(insight: InsightDef, applicationsSent: number): boolean {
  return applicationsSent >= insight.unlockThreshold;
}

export function applicationsUntilUnlock(insight: InsightDef, applicationsSent: number): number {
  return Math.max(0, insight.unlockThreshold - applicationsSent);
}

const SEEN_KEY = 'jobhub_strategic_intel_seen';

/** Returns the set of insight keys the user has already opened in-app. */
export function loadSeenInsights(): Set<InsightKey> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as InsightKey[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function markInsightSeen(key: InsightKey) {
  const seen = loadSeenInsights();
  seen.add(key);
  localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)));
}

/** Returns the next insight the user will unlock, or null if all are unlocked. */
export function nextLockedInsight(applicationsSent: number): InsightDef | null {
  for (const i of INSIGHT_TRACK) {
    if (!isUnlocked(i, applicationsSent)) return i;
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
npm run build
git add src/lib/strategicIntelligence.ts
git commit -m "feat(intel): add Strategic Intelligence unlock track + localStorage helpers"
```

---

### Task 2: Build the placeholder insight view

**Files:**
- Create: `src/components/insights/InsightPlaceholder.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/components/insights/InsightPlaceholder.tsx
import { Sparkles } from 'lucide-react';

interface InsightPlaceholderProps {
  title: string;
  description: string;
}

export function InsightPlaceholder({ title, description }: InsightPlaceholderProps) {
  return (
    <div style={{
      padding: 24,
      borderRadius: 14,
      background: 'rgba(99,102,241,0.04)',
      border: '1px dashed rgba(99,102,241,0.25)',
      textAlign: 'center',
    }}>
      <Sparkles size={24} style={{ color: '#a5b4fc', marginBottom: 12 }} />
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#e5e7eb' }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.55 }}>
        {description}
      </p>
      <p style={{ margin: '14px 0 0', fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Coming soon — built when ready
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/insights/InsightPlaceholder.tsx
git commit -m "feat(intel): add InsightPlaceholder for not-yet-built unlocks"
```

---

### Task 3: Backend — application-pattern insight endpoint

**Files:**
- Create: `server/src/routes/insights.ts`
- Modify: `server/src/index.ts`

The "application pattern" insight compares the seniority + industry of jobs the user has applied to (from the application tracker) against the roles they're competitive for (top matches from the job feed).

- [ ] **Step 1: Write the router with `/application-pattern`**

```typescript
// server/src/routes/insights.ts
import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/**
 * GET /insights/application-pattern
 * Returns:
 *   {
 *     appliedTo: { seniority: string, industry: string, count: number }[],
 *     competitiveFor: { jobTitle: string, company: string, matchScore: number }[],
 *     applicationsTotal: number
 *   }
 */
router.get('/application-pattern', async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const applications = await prisma.application.findMany({
      where: { userId } as any,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Group applied-to by seniority + industry (best-effort from stored job data)
    const buckets = new Map<string, { seniority: string; industry: string; count: number }>();
    for (const app of applications) {
      const seniority = ((app as any).jobSeniority ?? 'Unknown') as string;
      const industry  = ((app as any).jobIndustry ?? 'Unknown') as string;
      const key = `${seniority}|${industry}`;
      const existing = buckets.get(key);
      if (existing) existing.count++;
      else buckets.set(key, { seniority, industry, count: 1 });
    }

    // Top matches from the job feed for "competitive for"
    const topJobs = await prisma.jobMatch.findMany({
      where: { userId } as any,
      orderBy: { matchScore: 'desc' },
      take: 5,
    }) as any[];

    res.json({
      appliedTo: Array.from(buckets.values()).sort((a, b) => b.count - a.count),
      competitiveFor: topJobs.map((j: any) => ({
        jobTitle: j.title ?? '',
        company: j.company ?? '',
        matchScore: j.matchScore ?? 0,
      })),
      applicationsTotal: applications.length,
    });
  } catch (err: any) {
    console.error('[insights/application-pattern] error:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to compute application pattern.' });
  }
});

export default router;
```

> **Field-name caveat:** the `jobSeniority`, `jobIndustry`, `JobMatch.title`, `JobMatch.company`, `JobMatch.matchScore` field names are assumptions. Inspect `server/prisma/schema.prisma` and `server/src/routes/job-feed.ts` and rename to the actual fields before committing.

- [ ] **Step 2: Mount the router**

In `server/src/index.ts`:

```typescript
import insightsRouter from './routes/insights';
// ...
app.use('/api/insights', insightsRouter);
```

- [ ] **Step 3: Build server + commit**

```bash
cd server && npm run build && cd ..
git add server/src/routes/insights.ts server/src/index.ts
git commit -m "feat(intel): add /insights/application-pattern endpoint"
```

---

### Task 4: Application Pattern insight UI

**Files:**
- Create: `src/components/insights/ApplicationPatternInsight.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/components/insights/ApplicationPatternInsight.tsx
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

interface PatternResponse {
  appliedTo: Array<{ seniority: string; industry: string; count: number }>;
  competitiveFor: Array<{ jobTitle: string; company: string; matchScore: number }>;
  applicationsTotal: number;
}

export function ApplicationPatternInsight() {
  const { data, isLoading, error } = useQuery<PatternResponse>({
    queryKey: ['insights', 'application-pattern'],
    queryFn: async () => (await api.get('/insights/application-pattern')).data,
    staleTime: 60 * 1000,
  });

  if (isLoading) return <p style={{ fontSize: 13, color: '#9ca3af' }}>Computing your pattern…</p>;
  if (error || !data) return <p style={{ fontSize: 13, color: '#fca5a5' }}>Could not load this insight.</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ padding: 18, borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#a5b4fc', textTransform: 'uppercase' }}>
          You're applying to
        </p>
        {data.appliedTo.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>No applications yet.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.appliedTo.slice(0, 5).map((b, i) => (
              <li key={i} style={{ fontSize: 13, color: '#e5e7eb' }}>
                <strong>{b.seniority}</strong> · {b.industry} <span style={{ color: '#6b7280' }}>({b.count})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ padding: 18, borderRadius: 12, background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.18)' }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#C5A059', textTransform: 'uppercase' }}>
          Your resume is actually competitive for
        </p>
        {data.competitiveFor.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>Apply a few times so we can compute this.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.competitiveFor.map((j, i) => (
              <li key={i} style={{ fontSize: 13, color: '#e5e7eb' }}>
                <strong>{j.jobTitle}</strong> · {j.company} <span style={{ color: '#C5A059' }}>{Math.round(j.matchScore)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
npm run build
git add src/components/insights/ApplicationPatternInsight.tsx
git commit -m "feat(intel): build ApplicationPatternInsight UI"
```

---

### Task 5: Backend + UI for Industry Fit Map

Mirror of Task 3 + 4 — add `/insights/industry-fit-map` returning a per-industry breakdown of match scores, and `IndustryFitMapInsight.tsx` rendering it (a horizontal bar list).

Detailed steps follow the same pattern as Tasks 3 + 4. Commit each in isolation.

---

### Task 6: Build the StrategicIntelligenceCard

**Files:**
- Create: `src/components/StrategicIntelligenceCard.tsx`

The card shows the unlock track, the user's current application count, and reveals each unlocked insight on click. Reads applications-sent from the application tracker via TanStack Query.

- [ ] **Step 1: Write the component**

```typescript
// src/components/StrategicIntelligenceCard.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import {
  INSIGHT_TRACK,
  isUnlocked,
  applicationsUntilUnlock,
  type InsightKey,
  type InsightDef,
} from '../lib/strategicIntelligence';
import { ApplicationPatternInsight } from './insights/ApplicationPatternInsight';
import { IndustryFitMapInsight } from './insights/IndustryFitMapInsight';
import { InsightPlaceholder } from './insights/InsightPlaceholder';

export function StrategicIntelligenceCard() {
  const { data: count } = useQuery({
    queryKey: ['applications', 'count'],
    queryFn: async () => (await api.get('/applications/count')).data?.count ?? 0,
    staleTime: 60 * 1000,
  });
  const applicationsSent: number = count ?? 0;

  const [expanded, setExpanded] = useState<InsightKey | null>(null);

  function toggle(key: InsightKey, insight: InsightDef) {
    if (!isUnlocked(insight, applicationsSent)) return;
    setExpanded(prev => (prev === key ? null : key));
  }

  function renderInsightBody(key: InsightKey, def: InsightDef) {
    if (key === 'diagnostic') {
      return (
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
          Use the Diagnostic link in the sidebar to revisit your starting baseline.
        </p>
      );
    }
    if (key === 'application-pattern') return <ApplicationPatternInsight />;
    if (key === 'industry-fit-map')    return <IndustryFitMapInsight />;
    return <InsightPlaceholder title={def.label} description={def.description} />;
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: 20,
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#a5b4fc', textTransform: 'uppercase' }}>
        Strategic Intelligence
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af' }}>
        Insights unlock as you apply. {applicationsSent} application{applicationsSent === 1 ? '' : 's'} sent so far.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {INSIGHT_TRACK.map(def => {
          const unlocked = isUnlocked(def, applicationsSent);
          const isOpen = expanded === def.key;
          const until = applicationsUntilUnlock(def, applicationsSent);

          return (
            <div key={def.key} style={{
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => toggle(def.key, def)}
                disabled={!unlocked}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: unlocked ? '#e5e7eb' : '#6b7280',
                  cursor: unlocked ? 'pointer' : 'default',
                  textAlign: 'left',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {unlocked
                  ? <Unlock size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                  : <Lock size={14} style={{ color: '#4b5563', flexShrink: 0 }} />
                }
                <span style={{ flex: 1 }}>{def.label}</span>
                {unlocked
                  ? <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                  : <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>
                      {until} app{until === 1 ? '' : 's'} to unlock
                    </span>
                }
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '4px 16px 16px' }}>
                      {renderInsightBody(def.key, def)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

> **Backend dependency:** the component reads `GET /applications/count`. Confirm that endpoint exists. If it does not, add it in `server/src/routes/profile/index.ts` or wherever the existing application-tracker endpoints live. Returns `{ count: <integer> }`.

- [ ] **Step 2: Commit**

```bash
npm run build
git add src/components/StrategicIntelligenceCard.tsx
git commit -m "feat(intel): build StrategicIntelligenceCard with unlock-track UI"
```

---

### Task 7: Render the card on the dashboard

**Files:**
- Modify: `src/pages/StrategyHub.tsx`

- [ ] **Step 1: Import and render below the existing hero**

Add an import:

```typescript
import { StrategicIntelligenceCard } from '../components/StrategicIntelligenceCard';
```

After the existing JD-paste hero block, before the close of the page, render:

```tsx
<div style={{ marginTop: 28 }}>
  <StrategicIntelligenceCard />
</div>
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run build
git add src/pages/StrategyHub.tsx
git commit -m "feat(intel): surface StrategicIntelligenceCard on the dashboard"
```

---

### Task 8: Manual smoke test

- [ ] **Step 1: New user, zero apps**
  - **Expected:** card shows; Diagnostic unlocked; rest locked with "N apps to unlock" counters

- [ ] **Step 2: After sending 1 application**
  - **Expected:** Application Pattern unlocked; click expands to show the two-column comparison

- [ ] **Step 3: After sending 3 applications**
  - **Expected:** Industry Fit Map unlocked

- [ ] **Step 4: Personal Playbook + Response-Rate still locked**
  - **Expected:** counters update; clicking either does nothing (button disabled)

---

## Self-review checklist

**Spec coverage** (`docs/superpowers/specs/2026-05-16-post-diagnostic-flow-redesign.md`, §7):
- ✅ Card UI with unlock track — Task 6 + 7
- ✅ Unlock thresholds match spec — Task 1
- ✅ First two unlocks shipped — Tasks 3–5
- ✅ Last two unlocks scaffolded as placeholders — Task 2 + Task 6 (renderInsightBody dispatch)
- ✅ localStorage-based seen tracking — Task 1 (loadSeenInsights/markInsightSeen — note: not currently surfaced in the UI; reserved for a follow-up that shows "NEW" badges)

**Placeholders:** none — every step has concrete code. The one explicit caveat in Task 3 (field-name verification against the actual Prisma schema) is documented inline and is not a plan failure — it's a genuine pre-build verification step.

**Type consistency:** `InsightKey`, `InsightDef`, and component prop interfaces are consistent throughout.

**Backend dependencies:** Tasks 3, 5, and 6 need backend endpoints. Task 3 + 5 explicitly add them; Task 6 has a dependency callout for `GET /applications/count` which may or may not exist already (engineer must verify before building).

**Out of scope for this slice:**
- Personal Playbook + Response-Rate Analysis full implementations — placeholders only; build in a follow-up plan when the unlock thresholds (5 and 10 applications) are reachable in production data
- Cross-device migration from localStorage to backend (tracked in project memory `project_strategic_intelligence_migration.md`)
- "NEW" badges on freshly-unlocked insights (the `markInsightSeen` helper exists but is unused; surface in a follow-up)

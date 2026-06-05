# Streamlined Dashboard (Slice B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` (or `superpowers:subagent-driven-development`). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Reshape the authenticated dashboard (`StrategyHub` at `/`) into one outcome — a list of matched-job **Apply now** cards (reusing the existing free-tier job-feed) plus a quiet paste-your-own-JD safety net. The five strategy panels are hidden behind drip-release flags.

**Architecture:** Pure frontend. Reuses `GET /api/job-feed/feed` (no backend change). New lean `ApplyNowCard` + `PasteJobBox` components; `StrategyHub` gets a feed query + build-poll (mirroring `JobFeedPage`) and a streamlined layout. Apply-now reuses `JobCard`'s exact `/apply` navigation so the Slice C workspace receives the same context.

**Tech Stack:** React/Vite/TypeScript (strict + `noUnusedLocals`), `@tanstack/react-query`, framer-motion.

**Spec:** `docs/superpowers/specs/2026-06-05-streamlined-dashboard-design.md`

---

## ⚠️ INSTRUCTIONS FOR THE EXECUTOR — READ BEFORE STARTING

Zero-latitude plan. You are a careful executor.

1. **You do NOT write or alter any user-facing copy.** Every string lives in `src/pages/dashboardCopy.ts` (pre-authored, committed). Import and render verbatim.
2. **Copy every code block verbatim.** No renames, refactors, restyles, added features, or token changes.
3. **Do tasks in order.** Each ends with a clean type-check + a commit. Don't start the next until the current is committed green.
4. **STOP-and-report (do not improvise) if:** a command errors, an `old_string` doesn't match the file exactly, an import path doesn't resolve, or a type error appears you can't fix by following the step literally.
5. Frontend type-check (from repo root): `npx tsc -p tsconfig.app.json --noEmit`.
6. **Task 3 is delicate** (refactor of `StrategyHub.tsx` under `noUnusedLocals`). After Task 3, **STOP and report the full `git diff` of `StrategyHub.tsx`** before committing.

Repo root: `E:\AntiGravity\JobHub`. Frontend is the root Vite app.

---

## File Structure

**Pre-authored (DO NOT EDIT):** `src/pages/dashboardCopy.ts`

**New:**
- `src/components/dashboard/ApplyNowCard.tsx`
- `src/components/dashboard/PasteJobBox.tsx`

**Modified:**
- `src/pages/StrategyHub.tsx` — feed query + build-poll, streamlined layout, hide panels behind `SHOW` flags.

---

## Task 1: ApplyNowCard component (new file)

**Files:**
- Create: `src/components/dashboard/ApplyNowCard.tsx`

- [ ] **Step 1: Create `src/components/dashboard/ApplyNowCard.tsx`** with EXACTLY this content:

```tsx
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import type { JobFeedItem } from '../jobs/JobCard';
import { dashboardCopy } from '../../pages/dashboardCopy';

/**
 * ApplyNowCard — one matched role on the streamlined dashboard. Lean by design:
 * title · company · location, and a single Apply-now that drops into the
 * de-frictioned /apply workspace (Slice C). No match score, no premium per-card
 * actions. Navigation mirrors JobCard.handlePrepareAndApply so Slice C receives
 * identical context and auto-derives gaps.
 */
export function ApplyNowCard({ item }: { item: JobFeedItem }) {
  const navigate = useNavigate();

  const handleApply = () => {
    localStorage.setItem('jobhub_current_jd', item.description);
    localStorage.setItem('jobhub_apply_context', JSON.stringify({
      jobId: item.id,
      title: item.title,
      company: item.company,
      description: item.description,
      sourceUrl: item.sourceUrl,
      sourcePlatform: item.sourcePlatform,
    }));
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
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '16px 20px',
        background: warm.colors.bgSurface,
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: 14,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: warm.colors.textMuted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: warm.colors.textSecondary }}>{item.company}</span>
          {item.location && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <MapPin size={12} style={{ color: warm.colors.textMuted }} />
              {item.location}
            </span>
          )}
        </p>
      </div>
      <button
        onClick={handleApply}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
          padding: '11px 20px',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: warm.colors.textOnDeep,
          background: warm.colors.accentPetrol,
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
          boxShadow: warm.shadow.soft,
        }}
      >
        {dashboardCopy.applyCard.cta}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run (from repo root): `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors referencing `ApplyNowCard.tsx`. (`JobFeedItem` is exported from `src/components/jobs/JobCard.tsx`; `warm.shadow.soft` and the `warm.colors.*` keys exist.)

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/ApplyNowCard.tsx
git commit -m "feat(dashboard): ApplyNowCard — lean matched-role card into /apply"
```

---

## Task 2: PasteJobBox component (new file)

**Files:**
- Create: `src/components/dashboard/PasteJobBox.tsx`

- [ ] **Step 1: Create `src/components/dashboard/PasteJobBox.tsx`** with EXACTLY this content:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { dashboardCopy } from '../../pages/dashboardCopy';

/**
 * PasteJobBox — the secondary safety net on the streamlined dashboard. For users
 * whose feed is empty/incomplete, or who have a specific role in mind. Routes
 * straight to /apply (no analysis screen); Slice C auto-derives gaps.
 */
export function PasteJobBox() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [jd, setJd] = useState('');
  const canSubmit = jd.trim().length >= 50;

  const handleContinue = () => {
    if (!canSubmit) return;
    navigate('/apply', { state: { jobDescription: jd.trim(), sc: false } });
  };

  return (
    <div style={{ marginTop: 28 }}>
      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          <motion.button
            key="toggle"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: warm.colors.textMuted,
              padding: 0,
            }}
          >
            {dashboardCopy.paste.toggle}
            <ChevronRight size={14} />
          </motion.button>
        ) : (
          <motion.div
            key="box"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder={dashboardCopy.paste.placeholder}
              rows={6}
              autoFocus
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 14,
                fontFamily: 'inherit',
                lineHeight: 1.6,
                color: warm.colors.textPrimary,
                background: warm.colors.bgSurface,
                border: `1px solid ${warm.colors.borderWhisper}`,
                borderRadius: 12,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleContinue}
                disabled={!canSubmit}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '11px 20px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: warm.colors.textOnDeep,
                  background: canSubmit ? warm.colors.accentPetrol : warm.colors.borderWhisper,
                  border: 'none',
                  borderRadius: 12,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.6,
                }}
              >
                {dashboardCopy.paste.cta}
                <ArrowRight size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run (from repo root): `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors referencing `PasteJobBox.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/PasteJobBox.tsx
git commit -m "feat(dashboard): PasteJobBox — secondary paste-JD safety net into /apply"
```

---

## Task 3: StrategyHub — streamlined layout + feed ⚠️ DELICATE

**Files:**
- Modify: `src/pages/StrategyHub.tsx`

> After the LAST step, STOP and report the full `git diff` of this file before committing.

### 3.1 — Imports

- [ ] **Step 1:** Replace this exact line:

```tsx
import { useQuery } from '@tanstack/react-query';
```

with:

```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query';
```

- [ ] **Step 2:** Immediately after this exact line:

```tsx
import { warm } from '../lib/theme/warmTokens';
```

add:

```tsx
import { ApplyNowCard } from '../components/dashboard/ApplyNowCard';
import { PasteJobBox } from '../components/dashboard/PasteJobBox';
import { dashboardCopy } from './dashboardCopy';
```

(`JobFeedItem`, `NavLink`, `ChevronRight`, `Loader2`, `useEffect`, `useRef`, `useState` are already imported in this file — confirm; do not re-import. If any is missing, STOP and report the existing import line.)

### 3.2 — Feed query + build-poll inside `StrategyHub`

- [ ] **Step 3:** Find this exact block (the top of the `StrategyHub` component):

```tsx
export function StrategyHub() {
    const { data: profile } = useQuery<ProfileLite>({
        queryKey: ['profile'],
        queryFn: async () => {
            const { data } = await api.get('/profile');
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: jobs } = useQuery<JobLite[]>({
        queryKey: ['jobs'],
        queryFn: async () => {
            const { data } = await api.get('/jobs');
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });
```

Replace it with (appends the feed query + poll; the two existing queries are unchanged):

```tsx
export function StrategyHub() {
    const queryClient = useQueryClient();

    const { data: profile } = useQuery<ProfileLite>({
        queryKey: ['profile'],
        queryFn: async () => {
            const { data } = await api.get('/profile');
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: jobs } = useQuery<JobLite[]>({
        queryKey: ['jobs'],
        queryFn: async () => {
            const { data } = await api.get('/jobs');
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    // ── Matched-jobs feed (reuses the free-tier job-feed) ────────────────────
    const [feedJobs, setFeedJobs] = useState<JobFeedItem[]>([]);
    const [feedBuilding, setFeedBuilding] = useState(false);
    const [feedProfileIncomplete, setFeedProfileIncomplete] = useState(false);
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollCount = useRef(0);

    const { data: feedData, isLoading: feedLoading, isError: feedError } = useQuery({
        queryKey: ['job-feed', 0],
        queryFn: async () => (await api.get('/job-feed/feed?offset=0')).data,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (!feedData) return;
        setFeedJobs(feedData.jobs ?? []);
        setFeedProfileIncomplete(feedData.profileIncomplete ?? false);
        setFeedBuilding(feedData.building ?? false);
    }, [feedData]);

    // Poll every 60s while building, up to 8 attempts (mirrors JobFeedPage).
    useEffect(() => {
        if (feedBuilding && !feedLoading) {
            if (pollCount.current < 8) {
                pollRef.current = setTimeout(() => {
                    pollCount.current += 1;
                    queryClient.invalidateQueries({ queryKey: ['job-feed'] });
                }, 60_000);
            }
        } else {
            pollCount.current = 0;
        }
        return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    }, [feedBuilding, feedLoading, queryClient]);
```

### 3.3 — Streamlined layout

- [ ] **Step 4:** Replace this exact block (the entire `return (...)` of `StrategyHub`):

```tsx
    return (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {/* Fires once when sent-count crosses 0 -> >=1. Self-managed via localStorage. */}
            <FirstApplicationCelebration />
            <DimRegion>
                <HubHeader profile={profile} jobs={jobs ?? []} />
                <DimTarget style={{ marginBottom: 40 }}>
                    <AnalysisHeroCard />
                </DimTarget>
                {profile?.coherence && profile.coherence.length > 0 && (
                    <DimPeer style={{ marginBottom: 32 }}>
                        <CoherenceCard signals={profile.coherence} />
                    </DimPeer>
                )}
                <DimPeer style={{ marginBottom: 32 }}>
                    <StrategicInsightsPanel />
                </DimPeer>
                <DimPeer style={{ marginBottom: 32 }}>
                    <StaleApplicationsCard />
                </DimPeer>
                <DimPeer style={{ marginBottom: 32 }}>
                    <StrategicIntelligenceCard />
                </DimPeer>
                <DimPeer>
                    <PipelineGlance jobs={jobs ?? []} />
                </DimPeer>
            </DimRegion>
        </div>
    );
}
```

with:

```tsx
    // Drip-release flags — flip a value to true to resurface a panel as a
    // tutorial unlock. The component definitions stay below, referenced here so
    // `noUnusedLocals` is satisfied while they're hidden.
    const SHOW = {
        analyseHero: false,
        coherence: false,
        insights: false,
        staleApps: false,
        intelligence: false,
        pipeline: false,
    } as const;

    const matchedBox: React.CSSProperties = {
        background: warmT.card,
        border: `1px solid ${warmT.cardBorder}`,
        borderRadius: 16,
        padding: '20px 22px',
    };

    return (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {/* Fires once when sent-count crosses 0 -> >=1. Self-managed via localStorage. */}
            <FirstApplicationCelebration />
            <DimRegion>
                <HubHeader profile={profile} jobs={jobs ?? []} />

                {/* PRIMARY — matched jobs */}
                <section style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: warmT.textMuted }}>
                            {dashboardCopy.matched.label}
                        </p>
                        <NavLink
                            to="/tracker"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: warmT.accentSecondary, textDecoration: 'none' }}
                        >
                            {dashboardCopy.header.applicationsLink}
                            <ChevronRight size={13} />
                        </NavLink>
                    </div>

                    {feedProfileIncomplete ? (
                        <div style={matchedBox}>
                            <p style={{ margin: '0 0 12px', fontSize: 14, color: warmT.text, lineHeight: 1.55 }}>
                                {dashboardCopy.matched.profileIncomplete}
                            </p>
                            <NavLink
                                to="/workspace"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: warmT.accentSecondary, textDecoration: 'none' }}
                            >
                                {dashboardCopy.matched.profileIncompleteCta}
                                <ChevronRight size={14} />
                            </NavLink>
                        </div>
                    ) : feedBuilding && feedJobs.length === 0 ? (
                        <div style={matchedBox}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Loader2 size={16} className="animate-spin" style={{ color: warmT.accentSecondary }} />
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: warmT.text }}>{dashboardCopy.matched.building}</p>
                            </div>
                            <p style={{ margin: '8px 0 0', fontSize: 12.5, color: warmT.textMuted, lineHeight: 1.5 }}>{dashboardCopy.matched.buildingSub}</p>
                        </div>
                    ) : feedJobs.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {feedJobs.map((item) => <ApplyNowCard key={item.id} item={item} />)}
                        </div>
                    ) : (
                        <div style={matchedBox}>
                            <p style={{ margin: 0, fontSize: 14, color: warmT.text, lineHeight: 1.55 }}>
                                {feedError ? dashboardCopy.matched.error : dashboardCopy.matched.empty}
                            </p>
                        </div>
                    )}
                </section>

                {/* SECONDARY — paste your own JD */}
                <PasteJobBox />

                {/* HIDDEN — drip-release later (flags above). Kept referenced so noUnusedLocals passes. */}
                {SHOW.analyseHero && (
                    <DimTarget style={{ marginBottom: 40 }}>
                        <AnalysisHeroCard />
                    </DimTarget>
                )}
                {SHOW.coherence && profile?.coherence && profile.coherence.length > 0 && (
                    <DimPeer style={{ marginBottom: 32 }}>
                        <CoherenceCard signals={profile.coherence} />
                    </DimPeer>
                )}
                {SHOW.insights && (
                    <DimPeer style={{ marginBottom: 32 }}>
                        <StrategicInsightsPanel />
                    </DimPeer>
                )}
                {SHOW.staleApps && (
                    <DimPeer style={{ marginBottom: 32 }}>
                        <StaleApplicationsCard />
                    </DimPeer>
                )}
                {SHOW.intelligence && (
                    <DimPeer style={{ marginBottom: 32 }}>
                        <StrategicIntelligenceCard />
                    </DimPeer>
                )}
                {SHOW.pipeline && (
                    <DimPeer>
                        <PipelineGlance jobs={jobs ?? []} />
                    </DimPeer>
                )}
            </DimRegion>
        </div>
    );
}
```

### 3.4 — Verify + report

- [ ] **Step 5: Type-check**

Run (from repo root): `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors. If `noUnusedLocals` flags any of `AnalysisHeroCard`, `CoherenceCard`, `StrategicInsightsPanel`, `StaleApplicationsCard`, `StrategicIntelligenceCard`, `PipelineGlance`, `DimTarget`, `DimPeer` — confirm each still appears inside a `{SHOW.x && …}` guard above (they must). If `React.CSSProperties` errors as undefined, change `const matchedBox: React.CSSProperties = {` to `const matchedBox = {` and re-run (the object is structurally a valid style). If anything else fails, STOP and report.

- [ ] **Step 6:** STOP and report the full `git diff -- src/pages/StrategyHub.tsx` for review. Do not commit until reviewed.

- [ ] **Step 7 (after review approval): Commit**

```bash
git add src/pages/StrategyHub.tsx
git commit -m "feat(dashboard): streamlined Apply-now feed + paste safety net; hide strategy panels behind drip-release flags"
```

---

## Task 4: Verification (report, do not fix beyond plan)

**Files:** none.

- [ ] **Step 1: Type-check clean**

Run (from repo root): `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 2: Manual `/` flow** (frontend + server running, logged-in free user **with** a complete profile — `targetRole` + `targetCity`):
  - Dashboard shows the greeting + goal chip + "Your applications →" link.
  - The matched section shows "Finding roles that fit you…" then resolves to a list of `ApplyNowCard`s (or the empty/error copy).
  - **Apply now** on a card navigates to `/apply` and the Slice C workspace receives the right job (title/company/JD).
  - The "paste your own JD" toggle expands a box → Continue → `/apply`.
  - None of the five strategy panels render.

- [ ] **Step 3: Manual `/` flow** for a profile **missing** target role/city:
  - Shows the "Add your target role and city…" nudge + the paste box. No crash.

- [ ] **Step 4: Report** the observed behaviour at each stage plus the `GET /job-feed/feed` response. **STOP-and-report** (do not patch) if: any hidden panel renders, the feed never resolves out of "building", or Apply-now lands without job context.

---

## Self-Review (by plan author)

**Spec coverage:** lean Apply-now cards from `/job-feed/feed` (Task 1 + Task 3.3 ↔ spec §2/§3.1) ✓; paste-JD safety net (Task 2 ↔ §3.2) ✓; hide panels behind drip-release flags, preserved (Task 3.3 `SHOW` ↔ §3.3) ✓; header copy + "Your applications →" link (Task 3.3 ↔ §3.3) ✓; build-poll mirroring JobFeedPage (Task 3.2 ↔ §3.3/§5) ✓; states building/profileIncomplete/empty/error (Task 3.3 ↔ §5) ✓; no match score, no premium per-card actions (Task 1) ✓; no backend change ✓.

**Placeholder scan:** none — all steps carry concrete code/commands.

**Type consistency:** `JobFeedItem` (imported from `JobCard`) used by `feedJobs` state + `ApplyNowCard` prop; feed response keys (`jobs`, `building`, `profileIncomplete`) match the `/job-feed/feed` route; `SHOW` is `as const` so each `SHOW.x` is literally `false` and the guarded panels are referenced (satisfying `noUnusedLocals`) without rendering; `warmT` keys (`text`, `textMuted`, `card`, `cardBorder`, `accentSecondary`) all exist in the local token map.

**Known seams (acceptable):** no pagination (first page only) — fine for the funnel MVP; the disabled `ApplyFeedStrip` stays referenced inside the hidden `AnalysisHeroCard`, so it remains used.

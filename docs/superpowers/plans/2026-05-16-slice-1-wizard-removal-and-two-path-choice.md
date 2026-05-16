# Slice 1: Wizard Removal + Two-Path Post-Diagnostic Choice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the 7-step Setup Wizard, replace its slot in the activation flow with a lightweight two-path choice screen ("Start applying" / "See what we found"), and add a parse-quality gate that catches users who uploaded a non-resume document.

**Architecture:** All changes are client-side. A new `ReportFlowStage` state machine inside `ReportOrDashboard` (`src/App.tsx`) decides whether the user sees the from-scratch capture, the post-diagnostic choice, the full diagnostic, or the dashboard. Two new components (`PostDiagnosticChoice`, `FromScratchCapture`) cover the new screens. The wizard file, route, and its `jobhub_setup_complete` localStorage flag are deleted entirely.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, React Router 7, TanStack Query 5, Framer Motion 12, Tailwind 4, `lucide-react` icons. No test framework in the project — verification is `npm run build` for type-checking + `npm run lint` + manual smoke tests via `npm run dev`.

**Reference spec:** `docs/superpowers/specs/2026-05-16-post-diagnostic-flow-redesign.md` (sections 1, 2, 3 — this slice covers slices 1's scope only; conversational JD-time enrichment and Strategic Intelligence are in later plans).

---

## File map

**New files:**
- `src/lib/parseQuality.ts` — pure helper that reports whether a fetched profile is "essentially empty"
- `src/components/PostDiagnosticChoice.tsx` — the two-path screen
- `src/components/FromScratchCapture.tsx` — 4-prompt minimal fallback for users with no usable resume

**Modified files:**
- `src/App.tsx` — replace `ReportOrDashboard`'s boolean `reportSeen` state with a `ReportFlowStage` machine; remove `SetupWizard` import and `/setup` route
- `src/components/ProcessingScreen.tsx` — update priming text that mentions the wizard

**Deleted files:**
- `src/pages/SetupWizard.tsx` — the entire 7-step wizard component (1,449 lines)

**Pre-existing helpers that move out of the deleted file:**

`SetupWizard.tsx` defines two pure helpers that are still needed in later slices (the JD-time enrichment uses them to decide which achievements are weak):

- `isRealMetric(metric)`
- `isDutyLikeBullet(bullet)`

This plan extracts both to `src/lib/achievementHeuristics.ts` so they survive the wizard's deletion.

---

## Backend dependency note

The from-scratch capture path needs the diagnostic to be (re)generated from the 4 prompts the user provides. The codebase already polls `GET /onboarding/report` for diagnostic status during the normal flow. This plan **does not add new backend endpoints**. Instead, the from-scratch path saves the 4 prompts via the existing `PATCH /profile` and `POST /experience` endpoints, then directly drops the user into `PostDiagnosticChoice`. The diagnostic for a from-scratch user is whatever the backend already produced (likely a thin diagnostic) — they can see it via the secondary "see what we found" path or skip straight to applying.

If a follow-up plan wants to trigger a full diagnostic regeneration from the synthesised profile, that is server-side work and out of scope here.

---

## Task list

### Task 1: Extract pure achievement heuristics so they survive wizard deletion

**Files:**
- Create: `src/lib/achievementHeuristics.ts`

- [ ] **Step 1: Create the new helper module with both functions copied verbatim from `SetupWizard.tsx`**

```typescript
// src/lib/achievementHeuristics.ts

// A bullet is "duty-like" when it reads as a job responsibility (no measurable
// outcome). Heuristic: no digits, no monetary marker, and opens with one of
// the classic duty phrasings. Kept conservative — better to under-flag than to
// outline a legitimate achievement.
export function isDutyLikeBullet(bullet: string): boolean {
  const text = (bullet ?? '').trim();
  if (text.length < 8) return false;
  if (/\d/.test(text)) return false;
  if (/[$%]/.test(text)) return false;
  const lower = text.toLowerCase();
  const dutyOpeners = [
    'responsible for', 'managed', 'worked on', 'assisted', 'helped',
    'supported', 'was involved', 'collaborated', 'participated', 'contributed',
    'led', 'conducted', 'provided', 'delivered', 'performed', 'handled',
    'oversaw', 'coordinated',
  ];
  return dutyOpeners.some(opener => lower.startsWith(opener) || lower.includes(' ' + opener + ' '));
}

// Real metric: not empty, not the literal string "qualitative", and not one of
// the LLM-extracted placeholders that masquerade as values ("None", "N/A", etc.).
export function isRealMetric(metric: string | null | undefined): boolean {
  if (!metric) return false;
  const trimmed = metric.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed === 'qualitative') return false;
  if (['none', 'n/a', 'na', '-', '–', 'tbd', 'null', 'undefined'].includes(trimmed)) return false;
  return true;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS (no usages elsewhere yet, so this is just a fresh module)

- [ ] **Step 3: Commit**

```bash
git add src/lib/achievementHeuristics.ts
git commit -m "chore(profile): extract duty + metric heuristics into shared module"
```

---

### Task 2: Add the parse-quality detection helper

**Files:**
- Create: `src/lib/parseQuality.ts`

- [ ] **Step 1: Write the helper module**

```typescript
// src/lib/parseQuality.ts

/**
 * Minimal shape of the profile fields parseQuality cares about.
 * Matches what /profile returns. Optional everywhere because a freshly-
 * created profile row may have nothing populated yet.
 */
export interface ParseQualityInput {
  name?: string | null;
  experience?: Array<unknown> | null;
  education?: Array<unknown> | null;
}

/**
 * Returns true when the profile is essentially empty — i.e., the resume
 * parser failed to extract anything usable. Used to route the user to
 * the "from scratch" fallback capture flow instead of dropping them into
 * the dashboard with empty data.
 *
 * Decision rule (per spec):
 *   name is empty AND no experience entries AND no education entries
 *
 * If any of the three is present, we consider the parse "OK enough" and
 * let the user proceed normally. The JD-time enrichment in Slice 2 will
 * fill in the gaps over time.
 */
export function isEssentiallyEmptyProfile(profile: ParseQualityInput | null | undefined): boolean {
  if (!profile) return true;
  const hasName = typeof profile.name === 'string' && profile.name.trim().length > 0;
  const hasExperience = Array.isArray(profile.experience) && profile.experience.length > 0;
  const hasEducation = Array.isArray(profile.education) && profile.education.length > 0;
  return !hasName && !hasExperience && !hasEducation;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/parseQuality.ts
git commit -m "feat(profile): add parse-quality helper for empty-parse detection"
```

---

### Task 3: Build the FromScratchCapture component (4-prompt minimal capture)

**Files:**
- Create: `src/components/FromScratchCapture.tsx`

This screen takes over the full viewport when the parsed resume is empty. Four sequential one-question screens save data via existing API endpoints, then call `onDone()` to hand control back to the parent.

- [ ] **Step 1: Create the component**

```typescript
// src/components/FromScratchCapture.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import api from '../lib/api';

interface FromScratchCaptureProps {
  /** Called once all four prompts are submitted and saved. */
  onDone: () => void;
}

type Step = 'name' | 'role' | 'achievement' | 'target';

interface Answers {
  name: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  achievement: string;
  targetRole: string;
  targetCity: string;
}

const EMPTY: Answers = {
  name: '', company: '', title: '', startDate: '', endDate: '',
  achievement: '', targetRole: '', targetCity: '',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#f3f4f6',
  fontSize: 15,
  padding: '13px 16px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#6b7280',
  textTransform: 'uppercase',
  marginBottom: 6,
};

export function FromScratchCapture({ onDone }: FromScratchCaptureProps) {
  const [step, setStep] = useState<Step>('name');
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Answers) => (value: string) =>
    setAnswers(prev => ({ ...prev, [key]: value }));

  const canAdvance = (() => {
    switch (step) {
      case 'name':        return answers.name.trim().length > 0;
      case 'role':        return answers.company.trim().length > 0 && answers.title.trim().length > 0;
      case 'achievement': return answers.achievement.trim().length > 0;
      case 'target':      return answers.targetRole.trim().length > 0 && answers.targetCity.trim().length > 0;
    }
  })();

  async function persistAndAdvance() {
    setError(null);
    setSaving(true);
    try {
      if (step === 'name') {
        await api.patch('/profile', { name: answers.name });
        setStep('role');
      } else if (step === 'role') {
        // Save the role as the first experience entry. Backend creates the row.
        await api.post('/experience', {
          company: answers.company,
          role: answers.title,
          startDate: answers.startDate || null,
          endDate: answers.endDate || null,
          description: '',
        });
        setStep('achievement');
      } else if (step === 'achievement') {
        // Achievement is stored on profile.professionalSummary as raw text for now —
        // JD-time enrichment in Slice 2 will sharpen it. We deliberately do not
        // create an Achievement row here to keep the path short.
        await api.patch('/profile', { professionalSummary: answers.achievement });
        setStep('target');
      } else if (step === 'target') {
        await api.patch('/profile', {
          targetRole: answers.targetRole,
          targetCity: answers.targetCity,
        });
        onDone();
      }
    } catch (err) {
      setError('Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const stepIndex = (['name', 'role', 'achievement', 'target'] as const).indexOf(step);
  const progress = ((stepIndex + 1) / 4) * 100;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080b12',
      paddingBottom: 80,
    }}>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.04)' }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
          style={{ height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
        />
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px 0' }}>
        <p style={{
          margin: '0 0 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
          color: '#4b5563', textTransform: 'uppercase',
        }}>
          BUILDING YOUR PROFILE · Step {stepIndex + 1} of 4
        </p>
        <p style={{ margin: '0 0 32px', fontSize: 13, color: '#9ca3af', lineHeight: 1.55 }}>
          We couldn't read a resume from your file, so let's set up the basics — takes about a minute.
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
          >
            {step === 'name' && (
              <div>
                <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 800, color: '#f3f4f6', letterSpacing: '-0.02em' }}>
                  What's your name?
                </h1>
                <label style={labelStyle}>Full name</label>
                <input
                  type="text"
                  autoFocus
                  value={answers.name}
                  onChange={e => set('name')(e.target.value)}
                  placeholder="e.g. Priya Singh"
                  style={inputStyle}
                  aria-label="Your full name"
                />
              </div>
            )}

            {step === 'role' && (
              <div>
                <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 800, color: '#f3f4f6', letterSpacing: '-0.02em' }}>
                  What's your most recent role?
                </h1>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Company</label>
                    <input type="text" autoFocus value={answers.company} onChange={e => set('company')(e.target.value)} placeholder="e.g. Canva" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Title</label>
                    <input type="text" value={answers.title} onChange={e => set('title')(e.target.value)} placeholder="e.g. Marketing Manager" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Start date</label>
                    <input type="text" value={answers.startDate} onChange={e => set('startDate')(e.target.value)} placeholder="e.g. Jan 2022" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>End date</label>
                    <input type="text" value={answers.endDate} onChange={e => set('endDate')(e.target.value)} placeholder="e.g. Present" style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {step === 'achievement' && (
              <div>
                <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: '#f3f4f6', letterSpacing: '-0.02em' }}>
                  One thing you delivered in that role
                </h1>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: '#9ca3af', lineHeight: 1.55 }}>
                  Just one. We'll help you sharpen and add more later when you apply to your first job.
                </p>
                <label style={labelStyle}>What changed because of you?</label>
                <textarea
                  autoFocus
                  value={answers.achievement}
                  onChange={e => set('achievement')(e.target.value)}
                  rows={5}
                  placeholder="e.g. Grew Instagram from 4k to 22k followers in 6 months"
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            )}

            {step === 'target' && (
              <div>
                <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 800, color: '#f3f4f6', letterSpacing: '-0.02em' }}>
                  What's your target?
                </h1>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Role you want</label>
                    <input type="text" autoFocus value={answers.targetRole} onChange={e => set('targetRole')(e.target.value)} placeholder="e.g. Senior Marketing Manager" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input type="text" value={answers.targetCity} onChange={e => set('targetCity')(e.target.value)} placeholder="e.g. Sydney" style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p style={{ margin: '16px 0 0', fontSize: 13, color: '#fca5a5' }}>
                {error}
              </p>
            )}

            <div style={{ marginTop: 28 }}>
              <button
                onClick={persistAndAdvance}
                disabled={!canAdvance || saving}
                aria-label="Save and continue to next step"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 11,
                  padding: '14px 28px',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: (!canAdvance || saving) ? 'not-allowed' : 'pointer',
                  opacity: (!canAdvance || saving) ? 0.5 : 1,
                  letterSpacing: '-0.01em',
                  transition: 'opacity 0.15s',
                }}
              >
                {saving ? 'Saving…' : (step === 'target' ? 'Finish setup' : 'Continue')}
                {!saving && <ChevronRight size={16} />}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS — no integrations yet so the component is unused but compiles standalone

- [ ] **Step 3: Commit**

```bash
git add src/components/FromScratchCapture.tsx
git commit -m "feat(onboarding): add FromScratchCapture for empty-parse fallback"
```

---

### Task 4: Build the PostDiagnosticChoice component (two-path screen)

**Files:**
- Create: `src/components/PostDiagnosticChoice.tsx`

The two-path screen shown after the diagnostic is computed, before the user enters the dashboard. Visual asymmetry: primary CTA dominant, secondary as a text link below.

- [ ] **Step 1: Create the component**

```typescript
// src/components/PostDiagnosticChoice.tsx
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface PostDiagnosticChoiceProps {
  /** Called when the user chooses to skip the diagnostic and start applying. */
  onApplyNow: () => void;
  /** Called when the user chooses to read the full diagnostic first. */
  onSeeDiagnostic: () => void;
  /** Optional first name for a personalised greeting. */
  firstName?: string | null;
}

export function PostDiagnosticChoice({ onApplyNow, onSeeDiagnostic, firstName }: PostDiagnosticChoiceProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#080b12',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
        style={{ maxWidth: 560, width: '100%' }}
      >
        <p style={{
          margin: '0 0 12px',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.12em',
          color: '#4b5563',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          Your diagnostic is ready
        </p>

        <h1 style={{
          margin: '0 0 18px',
          fontSize: 28,
          fontWeight: 800,
          color: '#E0E0E0',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          textAlign: 'center',
        }}>
          {firstName ? `${firstName}, your resume is parsed.` : 'Your resume is parsed.'}
          <br />
          <span style={{ color: '#C5A059' }}>We found 3 things quietly killing your applications.</span>
        </h1>

        <p style={{
          margin: '0 0 36px',
          fontSize: 15,
          color: '#A0A4A8',
          lineHeight: 1.6,
          textAlign: 'center',
          maxWidth: 440,
          marginInline: 'auto',
        }}>
          You can fix them right now by generating a tailored application — or read the full diagnostic first if you want the detail.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <button
            onClick={onApplyNow}
            aria-label="Start applying with your improved resume"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: '#2D5A6E',
              color: '#E0E0E0',
              border: 'none',
              borderRadius: 14,
              padding: '17px 36px',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
              boxShadow: '0 4px 24px rgba(45,90,110,0.35)',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Start applying with your improved resume
            <ArrowRight size={18} />
          </button>

          <button
            onClick={onSeeDiagnostic}
            aria-label="See the full diagnostic first"
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 12px',
              letterSpacing: '-0.01em',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e5e7eb'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
          >
            or see what we found  →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS — component is standalone and unused, compiles cleanly

- [ ] **Step 3: Commit**

```bash
git add src/components/PostDiagnosticChoice.tsx
git commit -m "feat(onboarding): add PostDiagnosticChoice two-path screen"
```

---

### Task 5: Update ProcessingScreen priming text (remove wizard reference)

**Files:**
- Modify: `src/components/ProcessingScreen.tsx:362-363`

The priming-shimmer text currently says *"Once your diagnosis lands, the resume wizard helps you turn every gap into a stronger application."* The wizard is going away — update the copy so it sets the right expectation.

- [ ] **Step 1: Replace the priming text**

Locate this block:

```tsx
            <p
              className="priming-shimmer"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: T.text,
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 1.55,
                maxWidth: 420,
                marginInline: 'auto',
              }}
            >
              Once your diagnosis lands, the resume wizard helps you turn every gap into a stronger application.
            </p>
```

Replace the text inside the `<p>` with:

```
              Once your diagnosis lands, you can read it in full — or jump straight to writing your first tailored application.
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ProcessingScreen.tsx
git commit -m "copy(processing): drop wizard reference from priming text"
```

---

### Task 6: Wire ReportOrDashboard to the new flow state machine

This is the integration task — the new components are wired into `App.tsx` and the old boolean `reportSeen` is replaced with a four-state machine.

**Files:**
- Modify: `src/App.tsx` (the `ReportOrDashboard` function, lines 269-333)

**New state machine:**

```
'choice'           → render PostDiagnosticChoice
'report'           → render ReportExperience (full diagnostic)
'from-scratch'     → render FromScratchCapture (empty-parse fallback)
'dashboard'        → render the existing DashboardLayout
```

**Decision logic on mount:**

1. If `?view=report` query param → force `'report'` (preserves the existing email-link behaviour)
2. Else if `jobhub_report_seen === 'true'` → `'dashboard'` (returning user)
3. Else fetch the profile; if `isEssentiallyEmptyProfile(profile)` → `'from-scratch'`
4. Else → `'choice'` (new user with a successfully-parsed resume)

**Handlers:**
- `PostDiagnosticChoice.onApplyNow` → set `'dashboard'`, mark `reportSeen=true`
- `PostDiagnosticChoice.onSeeDiagnostic` → set `'report'`
- `ReportExperience.onDone` (the old Section 5 CTA path) → set `'dashboard'`, mark `reportSeen=true`
- `FromScratchCapture.onDone` → invalidate profile query, set `'choice'`

- [ ] **Step 1: Add imports for the new components and helper**

In `src/App.tsx`, near the top with the other lazy imports, add:

```typescript
import { isEssentiallyEmptyProfile } from './lib/parseQuality';

const PostDiagnosticChoice = React.lazy(() =>
  import('./components/PostDiagnosticChoice').then(m => ({ default: m.PostDiagnosticChoice }))
);
const FromScratchCapture = React.lazy(() =>
  import('./components/FromScratchCapture').then(m => ({ default: m.FromScratchCapture }))
);
```

Also delete the now-unused `SetupWizard` lazy import (lines 28-30):

```typescript
const SetupWizard = React.lazy(() =>
  import('./pages/SetupWizard').then(m => ({ default: m.SetupWizard }))
);
```

- [ ] **Step 2: Replace the body of `ReportOrDashboard` (lines 269-333)**

Replace the entire `ReportOrDashboard` function with this version:

```typescript
type ReportFlowStage = 'loading' | 'choice' | 'report' | 'from-scratch' | 'dashboard';

function ReportOrDashboard() {
  const queryClient = useQueryClient();

  // Profile is needed both for the parse-quality decision and for the firstName
  // greeting on the PostDiagnosticChoice screen.
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data; },
    staleTime: 5 * 60 * 1000,
  });

  const [stage, setStage] = useState<ReportFlowStage>(() => {
    // Email link uses ?view=report to force the report to show even for returning users.
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'report') {
      window.history.replaceState({}, '', '/');
      localStorage.removeItem('jobhub_report_seen');
      return 'report';
    }
    if (localStorage.getItem('jobhub_report_seen') === 'true') return 'dashboard';
    return 'loading';
  });

  // Once profile resolves, decide between from-scratch and the two-path choice.
  // Only acts when we're in 'loading' state to avoid stomping on user choices.
  useEffect(() => {
    if (stage !== 'loading' || profileLoading) return;
    if (isEssentiallyEmptyProfile(profile)) {
      setStage('from-scratch');
    } else {
      setStage('choice');
    }
  }, [stage, profileLoading, profile]);

  function markReportSeen() {
    localStorage.setItem('jobhub_report_seen', 'true');
    localStorage.setItem('jobhub_tips_seen', 'false');
  }

  function handleApplyNow() {
    markReportSeen();
    setStage('dashboard');
  }

  function handleSeeDiagnostic() {
    setStage('report');
  }

  function handleReportDone() {
    markReportSeen();
    setStage('dashboard');
  }

  function handleFromScratchDone() {
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    setStage('choice');
  }

  const firstName: string | null = profile?.name ? String(profile.name).split(' ')[0] : null;

  const spinner = (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  if (stage === 'loading') return spinner;

  if (stage === 'from-scratch') {
    return (
      <React.Suspense fallback={spinner}>
        <FromScratchCapture onDone={handleFromScratchDone} />
      </React.Suspense>
    );
  }

  if (stage === 'choice') {
    return (
      <React.Suspense fallback={spinner}>
        <PostDiagnosticChoice
          firstName={firstName}
          onApplyNow={handleApplyNow}
          onSeeDiagnostic={handleSeeDiagnostic}
        />
      </React.Suspense>
    );
  }

  if (stage === 'report') {
    return (
      <React.Suspense fallback={spinner}>
        <ReportExperience onDone={handleReportDone} />
      </React.Suspense>
    );
  }

  // stage === 'dashboard'
  return (
    <DashboardGate>
      <motion.div
        key="dashboard"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      >
        <DashboardLayout>
          <ErrorBoundary>
            <React.Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>}>
              <Routes>
                <Route path="/" element={<StrategyHub />} />
                <Route path="/tracker" element={<ApplicationTracker />} />
                <Route path="/apply" element={<StepperWorkspace />} />
                <Route path="/application-workspace" element={<ApplicationWorkspace />} />
                <Route path="/workspace" element={<Workspace />} />
                <Route path="/documents" element={<DocumentLibrary />} />
                <Route path="/email-templates" element={<EmailTemplatesLibrary />} />
                <Route path="/linkedin" element={<LinkedInPage />} />
                <Route path="/jobs" element={<JobFeedPage />} />
                <Route path="/mindset" element={<MindsetPage />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/friday-brief" element={<FridayBriefPage />} />
                <Route path="*" element={<StrategyHub />} />
              </Routes>
            </React.Suspense>
          </ErrorBoundary>
        </DashboardLayout>
      </motion.div>
    </DashboardGate>
  );
}
```

- [ ] **Step 3: Remove the `/setup` route block from the main `<Routes>` (lines 351-358)**

Delete this block entirely:

```typescript
              {/* Setup wizard — full-screen, authenticated, no sidebar */}
              <Route path="/setup" element={
                <ProtectedRoute>
                  <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>}>
                    <SetupWizard />
                  </React.Suspense>
                </ProtectedRoute>
              } />
```

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: PASS — the `SetupWizard` reference is gone, the new lazy imports are wired up

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: PASS (or warnings only — no new errors)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(onboarding): replace SetupWizard with two-path choice + parse-quality gate"
```

---

### Task 7: Delete SetupWizard and clean up its localStorage flag

**Files:**
- Delete: `src/pages/SetupWizard.tsx`
- Audit: any reference to `jobhub_setup_complete`

- [ ] **Step 1: Delete the wizard file**

```bash
git rm src/pages/SetupWizard.tsx
```

- [ ] **Step 2: Grep for any remaining `jobhub_setup_complete` references**

Run: search for the literal string `jobhub_setup_complete` across `src/`

Expected: zero matches (the only references were inside `SetupWizard.tsx`, which has just been deleted). If any remain, delete those references too (they're unused branching code now).

- [ ] **Step 3: Grep for any remaining references to `/setup` route**

Run: search for the literal `/setup` across `src/`

Expected: one expected match in `src/lib/exportDocx.ts:124` — this is a marketing URL footer in exported resumes (`aussiegradcareers.com.au/setup`), which is **unrelated** to the in-app `/setup` route. Leave it alone. Also one match in `src/components/ProfileBank.tsx:1444` — `onClick={() => navigate('/setup')}` — this WAS routing to the wizard and is now dead. Remove that onClick handler (or replace with `navigate('/')` if the button needs to do something; check the surrounding context and pick the option that preserves user value).

- [ ] **Step 4: Inspect `ProfileBank.tsx` around line 1444 and remove the dead `/setup` navigation**

Open `src/components/ProfileBank.tsx`, find the button with `onClick={() => navigate('/setup')}`. Read the surrounding code. If the button's intent was "go re-run the wizard," delete the button entirely — the equivalent action no longer exists. If the button's intent was "go fix profile content," leave the button but change the handler to a no-op or remove it. Document the choice in the commit message.

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A src/pages/SetupWizard.tsx src/components/ProfileBank.tsx
git commit -m "chore(onboarding): delete SetupWizard.tsx and clean up dead /setup links"
```

---

### Task 8: Manual smoke test

There is no test framework in this project — verification of the flow is manual. The engineer must run through each of the four scenarios below in a browser before marking the slice complete.

**Files:**
- None modified

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open the URL printed in the terminal (typically `http://localhost:5173`).

- [ ] **Step 2: Scenario A — new user, normal resume**

  1. Clear all localStorage (`localStorage.clear()` in DevTools console).
  2. Sign up / sign in as a fresh user.
  3. Complete onboarding intake and upload a real PDF resume.
  4. Wait for `ProcessingScreen` to finish.
  5. **Expected:** lands on `PostDiagnosticChoice` (the two-path screen) — NOT the diagnostic, NOT the wizard.
  6. Click "Start applying with your improved resume."
  7. **Expected:** lands on the dashboard (`/`), `jobhub_report_seen` is `'true'` in localStorage, no `/setup` redirect.

- [ ] **Step 3: Scenario B — new user, choose "See diagnostic" first**

  1. Repeat steps 1–4 from Scenario A.
  2. Click "or see what we found →" on `PostDiagnosticChoice`.
  3. **Expected:** `ReportExperience` renders (the full diagnostic).
  4. Scroll to Section 5 and click its CTA.
  5. **Expected:** lands on the dashboard, no wizard, no `/setup`.

- [ ] **Step 4: Scenario C — empty parse (FromScratchCapture)**

  1. Clear localStorage.
  2. Sign up as a fresh user.
  3. In onboarding, upload a non-resume document (e.g., a blank PDF or random image renamed `.pdf` — anything that the parser returns as empty).
  4. After processing completes:
  5. **Expected:** `FromScratchCapture` renders (the 4-step minimal capture) — NOT `PostDiagnosticChoice`, NOT the wizard.
  6. Walk through all 4 steps with valid input.
  7. **Expected:** after step 4, lands on `PostDiagnosticChoice`. The profile now contains the four prompts' data.

- [ ] **Step 5: Scenario D — returning user (reportSeen=true)**

  1. After completing one of the above scenarios, refresh the page.
  2. **Expected:** lands directly on the dashboard. No choice screen, no diagnostic, no wizard.

- [ ] **Step 6: Scenario E — diagnostic email link**

  1. Manually navigate to `/?view=report`.
  2. **Expected:** `ReportExperience` renders. After Section 5 CTA, lands on dashboard.

- [ ] **Step 7: Final lint + build sweep**

```bash
npm run build
npm run lint
```

Expected: both pass. If lint surfaces unused-import warnings from earlier deletions, clean them up.

- [ ] **Step 8: Final commit if any cleanup was needed**

If steps 4 or 7 surfaced cleanup, commit it:

```bash
git add -A
git commit -m "chore(onboarding): post-smoke cleanup for slice 1"
```

---

## Self-review checklist (done — included for the executing engineer's reference)

**Spec coverage** (against `docs/superpowers/specs/2026-05-16-post-diagnostic-flow-redesign.md`):
- ✅ §1 Parse-quality gate — Task 2 (helper) + Task 6 (wiring)
- ✅ §2 From-scratch minimal capture — Task 3
- ✅ §3 Post-diagnostic two-path screen — Task 4 + Task 6 (wiring)
- ⬜ §4 JD-time conversational enrichment — **deferred to Slice 2 plan**
- ⬜ §5 AI-rewrite badge in resume editor — **deferred to Slice 2 plan**
- ⬜ §6 Diagnostic as persistent surface — **deferred to Slice 2 plan**
- ⬜ §7 Progressive Strategic Intelligence — **deferred to Slice 3 plan**
- ✅ "What gets retired" — Task 7 deletes `SetupWizard.tsx`, `/setup` route, `jobhub_setup_complete` flag, the routing in `App.tsx`, and the navigate-to-setup link in `ProfileBank.tsx`
- ✅ Achievement heuristics preserved for later slices — Task 1

**Placeholder scan:** clean — every step has exact code, exact commands, exact expected output.

**Type consistency:** the `ReportFlowStage` union, the helper function names (`isEssentiallyEmptyProfile`, `isRealMetric`, `isDutyLikeBullet`), and the component prop interfaces are consistent across all tasks.

**Scope check:** this plan covers Slice 1 only. Slices 2 and 3 are independently shippable and have their own plans.

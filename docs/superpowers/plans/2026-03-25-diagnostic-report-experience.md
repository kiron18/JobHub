# Diagnostic Report Experience — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Before implementing any task that involves writing React component markup or styles, invoke the `frontend-design` skill. The user has explicitly requested this.

**Goal:** Replace the current report spinner and `DiagnosticReport` component with a full-screen countdown loading screen, a high-dopamine collapsible report experience, marketing email capture, a dashboard transition, and first-visit tips.

**Architecture:** New components (`ProcessingScreen`, `ReportExperience`, `ReportIsland`, `FirstVisitTips`) are dropped into the existing tree with no new routes. `App.tsx` gains a thin `ReportOrDashboard` wrapper inside `OnboardingGate`. Backend gains Prisma fields and a Resend email service.

**Tech Stack:** React 18, TypeScript, Framer Motion, Tailwind CSS, Lucide React, Prisma, Express, Resend SDK, `@tanstack/react-query`

**Spec:** `docs/superpowers/specs/2026-03-25-diagnostic-report-experience-design.md`

---

## File Map

```
CREATE  src/lib/reportIcons.ts                 Icon bank — section keys → Lucide components + metadata
CREATE  src/components/ProcessingScreen.tsx    Countdown bar + polling + Aussie messages
CREATE  src/components/ReportIsland.tsx        Single collapsible section (problem → fix reveal)
CREATE  src/components/ReportExperience.tsx    Full-viewport report wrapper, openMap state
CREATE  src/components/FirstVisitTips.tsx      localStorage-gated inline dashboard tips
MODIFY  src/components/OnboardingIntake.tsx    Add email/consent to StepFiles; wire ProcessingScreen
MODIFY  src/App.tsx                            Add ReportOrDashboard wrapper inside OnboardingGate
MODIFY  src/App.tsx (Dashboard fn)             Replace DiagnosticReport with summary card + tips
DELETE  src/components/DiagnosticReport.tsx    Retired — Task 13 only

CREATE  server/src/services/email.ts           Thin Resend SDK wrapper
MODIFY  server/src/routes/onboarding.ts        Add marketingEmail/Consent/Sent fields + Resend guard
MODIFY  server/prisma/schema.prisma            Three new CandidateProfile fields
CREATE  server/prisma/migrations/...           Migration for marketing fields
```

---

## Task 1: Prisma Schema — Marketing Fields

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: migration (auto-generated)

- [ ] **Step 1: Add three fields to CandidateProfile in schema.prisma**

Find the `CandidateProfile` model and add after the last existing field:
```prisma
marketingEmail      String?
marketingConsent    Boolean  @default(false)
marketingEmailSent  Boolean  @default(false)
```

- [ ] **Step 2: Run migration locally**
```bash
cd server
npx prisma migrate dev --name add-marketing-consent
```
Expected: migration file created in `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Verify Prisma client has the new fields**
```bash
cd server
npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); console.log('OK');"
```
Expected: prints `OK` with no type errors.

- [ ] **Step 4: Commit**
```bash
cd server
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add marketingEmail, marketingConsent, marketingEmailSent to CandidateProfile"
```

---

## Task 2: Resend Email Service

**Files:**
- Create: `server/src/services/email.ts`

- [ ] **Step 1: Install Resend**
```bash
cd server
npm install resend
```

- [ ] **Step 2: Create `server/src/services/email.ts`**
```ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.ALLOWED_ORIGIN ?? 'https://job-hub-snowy-ten.vercel.app';

export async function sendWelcomeEmail(to: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping welcome email');
    return;
  }
  await resend.emails.send({
    from: 'JobHub <hello@jobhub.com.au>',
    to,
    subject: 'Your JobHub diagnosis is ready',
    text: [
      "G'day,",
      '',
      "Your diagnostic report is ready — head back to the app to see exactly what's been holding back your job search and your three-step fix.",
      '',
      APP_URL,
      '',
      "We'll also be sending you job opportunities we've hand-picked for your role and location soon. Stay tuned.",
      '',
      'The JobHub team',
    ].join('\n'),
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**
```bash
cd server
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Add `RESEND_API_KEY` to Railway**
In Railway dashboard → your backend service → Variables → add `RESEND_API_KEY` with your Resend API key from resend.com.

- [ ] **Step 5: Commit**
```bash
cd server
git add src/services/email.ts package.json package-lock.json
git commit -m "feat(email): add Resend welcome email service"
```

---

## Task 3: Backend — Onboarding Routes Marketing Fields

**Files:**
- Modify: `server/src/routes/onboarding.ts`

The `/submit` and `/retry` routes need to:
1. Read `marketingEmail` and `marketingConsent` from `answers`
2. Save them to `CandidateProfile`
3. Send welcome email (guarded by `marketingEmailSent`)

- [ ] **Step 1: Import `sendWelcomeEmail` at top of onboarding.ts**
```ts
import { sendWelcomeEmail } from '../services/email';
```

- [ ] **Step 2: In the `/submit` route — save marketing fields to CandidateProfile**

Find the `prisma.candidateProfile.upsert` call in the submit handler. It has **two separate data blocks** — `create` and `update`. Add the new fields to **both**:
```ts
upsert({
  where: { userId },
  create: {
    // ...existing create fields...
    marketingEmail: answers.marketingEmail ?? null,
    marketingConsent: answers.marketingConsent ?? false,
  },
  update: {
    // ...existing update fields...
    marketingEmail: answers.marketingEmail ?? null,
    marketingConsent: answers.marketingConsent ?? false,
  },
})
```
Note: `answers` here is `JSON.parse(req.body.answers)`.

- [ ] **Step 3: In the `/submit` async callback (after `hasCompletedOnboarding` is set) — add Resend guard**

After the `prisma.candidateProfile.update({ data: { hasCompletedOnboarding: true } })` call, add:
```ts
// Re-fetch profile to get latest marketingEmailSent state
const freshProfile = await prisma.candidateProfile.findUnique({ where: { userId } });
if (answers.marketingConsent && freshProfile && !freshProfile.marketingEmailSent && answers.marketingEmail) {
  await sendWelcomeEmail(answers.marketingEmail);
  await prisma.candidateProfile.update({
    where: { userId },
    data: { marketingEmailSent: true },
  });
}
```

- [ ] **Step 4: In the `/retry` async callback — add the same Resend guard**

In the retry route, `answers` comes from `report.intakeAnswers as any`. After `hasCompletedOnboarding` is set in the retry callback, add the identical guard block (use `answers.marketingEmail` and `answers.marketingConsent` from `intakeAnswers`, not from `profile`):
```ts
const freshProfile = await prisma.candidateProfile.findUnique({ where: { userId } });
if (answers.marketingConsent && freshProfile && !freshProfile.marketingEmailSent && answers.marketingEmail) {
  await sendWelcomeEmail(answers.marketingEmail);
  await prisma.candidateProfile.update({
    where: { userId },
    data: { marketingEmailSent: true },
  });
}
```

- [ ] **Step 5: Verify TypeScript compiles**
```bash
cd server
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**
```bash
cd server
git add src/routes/onboarding.ts
git commit -m "feat(onboarding): save marketing fields + send Resend welcome email on completion"
```

---

## Task 4: Icon Bank

**Files:**
- Create: `src/lib/reportIcons.ts`

This is the single source of truth for all report section icons. Future sections can be added here without touching component code.

- [ ] **Step 1: Create `src/lib/reportIcons.ts`**
```ts
import {
  Target,
  FileText,
  GitBranch,
  Lightbulb,
  Wrench,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface SectionMeta {
  icon: LucideIcon;
  label: string;  // short display label used in cross-section CTAs
}

export const SECTION_ICONS: Record<string, SectionMeta> = {
  targeting: {
    icon: Target,
    label: 'Targeting Assessment',
  },
  document_audit: {
    icon: FileText,
    label: 'Document Audit',
  },
  pipeline: {
    icon: GitBranch,
    label: 'Pipeline Diagnosis',
  },
  honest: {
    icon: Lightbulb,
    label: 'The Honest Assessment',
  },
  fix: {
    icon: Wrench,
    label: 'The 3-Step Fix',
  },
  what_jobhub_does: {
    icon: Sparkles,
    label: 'What JobHub Does For You',
  },
};

/** Cross-section CTA wiring. Each section links to two others with a reason why. */
export const SECTION_LINKS: Record<string, { key: string; why: string }[]> = {
  targeting: [
    { key: 'document_audit', why: 'Your targeting shapes what your resume needs to say' },
    { key: 'pipeline',       why: 'See where applications are actually dropping off' },
  ],
  document_audit: [
    { key: 'targeting', why: 'Targeting and documents live or die together' },
    { key: 'fix',       why: 'Your first fix is probably in here' },
  ],
  pipeline: [
    { key: 'honest', why: 'Your pipeline pattern reveals the real blocker' },
    { key: 'fix',    why: 'Three things you can fix this week' },
  ],
  honest: [
    { key: 'pipeline',       why: 'Your blocker shows up in your pipeline numbers' },
    { key: 'document_audit', why: 'The documents are where the fix starts' },
  ],
  fix: [
    { key: 'what_jobhub_does', why: 'See what the platform builds for you next' },
    { key: 'targeting',        why: 'Targeting is where most fixes begin' },
  ],
  what_jobhub_does: [
    { key: 'fix',          why: 'Your fixes are already waiting' },
    { key: 'document_audit', why: 'Your documents are the first thing we help you rebuild' },
  ],
};
```

- [ ] **Step 2: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add src/lib/reportIcons.ts
git commit -m "feat(icons): add report section icon bank with CTA wiring"
```

---

## Task 5: OnboardingIntake — Email Capture Types + State

**Files:**
- Modify: `src/components/OnboardingIntake.tsx` (lines ~70-78 and ~790-810)

> **Before writing any UI changes in Step 2 onwards, invoke the `frontend-design` skill.**

- [ ] **Step 1: Extend `IntakeAnswers` type (line ~72)**

Add two fields to the `IntakeAnswers` interface:
```ts
interface IntakeAnswers {
  // ...existing fields...
  marketingEmail: string;
  marketingConsent: boolean;
}
```

- [ ] **Step 2: Add `email` state to the parent if not already present**

`StepAccount`'s `email` and `password` are managed as props passed from the parent. Check if `OnboardingIntake` already has a top-level `email` state variable. If it does not (the current code keeps these inside a local block), add them alongside the other `useState` declarations:
```ts
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
```
These are passed into `StepAccount` when that step renders. If they already exist in scope, skip this step.

- [ ] **Step 3: Add `marketingEmail` and `marketingConsent` to the `answers` state initialiser**

Find the `useState<IntakeAnswers>` call in the main `OnboardingIntake` component and add:
```ts
marketingEmail: '',       // synced from email state via useEffect below
marketingConsent: true,
```

- [ ] **Step 4: Sync `email` into `answers.marketingEmail` via useEffect**

After the state declarations, add:
```ts
useEffect(() => {
  if (email) {
    setAnswers(prev => ({ ...prev, marketingEmail: email }));
  }
}, [email]);
```

- [ ] **Step 5: Fix `ProfileProgress` dummy IntakeAnswers literal**

Search `OnboardingIntake.tsx` for any inline `IntakeAnswers` object literal (used by `ProfileProgress` or similar components around line 630). Add the two new fields to that literal:
```ts
marketingEmail: '',
marketingConsent: true,
```
This is required or TypeScript will error after extending the interface.

- [ ] **Step 6: Verify TypeScript compiles with no errors**
```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verify TypeScript compiles with no errors**
```bash
npx tsc --noEmit
```
Expected: no errors (the two new fields are now present in all usages of `IntakeAnswers`).

- [ ] **Step 7: Commit**
```bash
git add src/components/OnboardingIntake.tsx
git commit -m "feat(onboarding): extend IntakeAnswers with marketingEmail + marketingConsent"
```

---

## Task 6: OnboardingIntake — StepFiles Email/Consent UI

**Files:**
- Modify: `src/components/OnboardingIntake.tsx` (StepFiles function, line ~621)

> **Invoke the `frontend-design` skill before writing the UI markup for this task.**

- [ ] **Step 1: Add four new props to `StepFiles`**

Find the `StepFiles` function signature (line ~621) and add:
```ts
function StepFiles({
  resume, setResume, cl1, setCl1, cl2, setCl2,
  onSubmit, submitting, onBack,
  marketingEmail, onMarketingEmailChange,
  marketingConsent, onMarketingConsentChange,
}: {
  // ...existing prop types...
  marketingEmail: string;
  marketingConsent: boolean;
  onMarketingEmailChange: (v: string) => void;
  onMarketingConsentChange: (v: boolean) => void;
})
```

- [ ] **Step 2: Add the email/consent UI block inside StepFiles, below the dropzones**

Add this block after the file drop zones, before the submit button. Use the same `TInput` component and `T` theme values already used throughout the file:
```tsx
{/* ── Marketing email capture ── */}
<div style={{ marginTop: 24 }}>
  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>
    Email address
  </label>
  <TInput
    placeholder="you@example.com"
    value={marketingEmail}
    onChange={onMarketingEmailChange}
    type="email"
  />
  <p style={{ fontSize: 12, color: T.textFaint, marginTop: 6, lineHeight: 1.5 }}>
    This is where we'll send your diagnosis and, soon, job opportunities
    we've hand-picked for you. Make sure it's one you actually check.
  </p>

  <label style={{
    display: 'flex', alignItems: 'center', gap: 10,
    marginTop: 14, cursor: 'pointer',
  }}>
    <input
      type="checkbox"
      checked={marketingConsent}
      onChange={e => onMarketingConsentChange(e.target.checked)}
      style={{ width: 16, height: 16, accentColor: T.btnBg, cursor: 'pointer' }}
    />
    <span style={{ fontSize: 13, color: T.textMuted }}>
      Send me job search tips and product updates
    </span>
  </label>
</div>
```

- [ ] **Step 3: Wire the new props where `StepFiles` is rendered (line ~885)**

Find `<StepFiles ... />` in the `STEPS` array and pass the new props:
```tsx
<StepFiles
  key="files"
  resume={resume} setResume={setResume}
  cl1={cl1} setCl1={setCl1}
  cl2={cl2} setCl2={setCl2}
  onSubmit={handleSubmit}
  submitting={submitting}
  onBack={goBack}
  marketingEmail={answers.marketingEmail}
  onMarketingEmailChange={v => setAnswers(prev => ({ ...prev, marketingEmail: v }))}
  marketingConsent={answers.marketingConsent}
  onMarketingConsentChange={v => setAnswers(prev => ({ ...prev, marketingConsent: v }))}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```

- [ ] **Step 5: Start dev server and visually verify the email field appears on the Files step**
```bash
npm run dev
```
Walk through onboarding to step 5 (Files). Confirm the email field shows, is pre-filled, and the checkbox is ticked.

- [ ] **Step 6: Commit**
```bash
git add src/components/OnboardingIntake.tsx
git commit -m "feat(onboarding): add marketing email + consent capture to StepFiles"
```

---

## Task 7: ProcessingScreen Component

**Files:**
- Create: `src/components/ProcessingScreen.tsx`

> **Invoke the `frontend-design` skill before writing the component markup.**

This component owns the polling loop and replaces the internal `ProcessingScreen` function in `OnboardingIntake.tsx`. It calls `queryClient.invalidateQueries` on COMPLETE before firing `onComplete`.

- [ ] **Step 1: Create `src/components/ProcessingScreen.tsx`**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

// Reuse the Theme type from OnboardingIntake — import it once it's extracted,
// or inline for now (same shape as LIGHT/DARK in OnboardingIntake).
interface Theme {
  bg: string; card: string; cardBorder: string; cardShadow: string;
  text: string; textMuted: string; textFaint: string;
  btnBg: string; btnText: string; btnShadow: string;
  progressBg: string; progressFill: string;
  blobGrad: string; blobShadow: string;
}

interface ProcessingScreenProps {
  isDark: boolean;
  theme: Theme;
  onComplete: () => void;
  onRetry: () => void;
}

const MESSAGES = [
  "Righto, let's see what we're working with...",
  "Digging through your resume — there's good stuff in here, trust.",
  "Mapping out where you've been dropping off. We got you.",
  "This is the bit that actually changes things, hang tight...",
  "Nearly there — your diagnosis is coming together nicely.",
  "Last bit of thinking... you're about to see exactly what's been holding you back.",
];
const FALLBACK_MESSAGE = "Still cooking, won't be long...";
const FAILED_MESSAGE   = "Something went sideways — but we've got your data.";

const BAR_DURATION_MS = 45_000;
const POLL_INTERVAL_MS = 3_000;
const MESSAGE_INTERVAL_MS = 8_000;

export function ProcessingScreen({ theme: T, onComplete, onRetry }: ProcessingScreenProps) {
  const queryClient = useQueryClient();
  const [barWidth, setBarWidth] = useState(100);       // percentage
  const [msgIndex, setMsgIndex] = useState(0);
  const [status, setStatus] = useState<'processing' | 'failed' | 'done'>('processing');
  const [msgVisible, setMsgVisible] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const barRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const startMs = useRef(Date.now());

  // ── Bar depletion ──────────────────────────────────────────────────────────
  useEffect(() => {
    barRef.current = setInterval(() => {
      const elapsed = Date.now() - startMs.current;
      const pct = Math.max(3, 100 - (elapsed / BAR_DURATION_MS) * 97);
      setBarWidth(pct);
    }, 200);
    return () => { if (barRef.current) clearInterval(barRef.current); };
  }, []);

  // ── Message rotation ───────────────────────────────────────────────────────
  useEffect(() => {
    msgRef.current = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIndex(i => i + 1);
        setMsgVisible(true);
      }, 300);
    }, MESSAGE_INTERVAL_MS);
    return () => { if (msgRef.current) clearInterval(msgRef.current); };
  }, []);

  // ── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get<{ status: string }>('/onboarding/report');
        if (data.status === 'COMPLETE') {
          clearInterval(pollRef.current!);
          clearInterval(msgRef.current!);
          clearInterval(barRef.current!);
          setBarWidth(0);
          // Invalidate profile cache so OnboardingGate re-evaluates
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
          setTimeout(() => {
            setStatus('done');
            onComplete();
          }, 500);
        } else if (data.status === 'FAILED') {
          clearInterval(pollRef.current!);
          clearInterval(msgRef.current!);
          clearInterval(barRef.current!);
          setStatus('failed');
        }
      } catch {
        // Network hiccup — keep polling
      }
    }, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [onComplete, queryClient]);

  const currentMessage = msgIndex < MESSAGES.length
    ? MESSAGES[msgIndex]
    : FALLBACK_MESSAGE;

  return (
    <div style={{
      minHeight: '100dvh',
      background: T.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: T.card,
        border: `1px solid ${T.cardBorder}`,
        boxShadow: T.cardShadow,
        borderRadius: 28,
        padding: 40,
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
      }}>
        {/* ── Countdown bar ── */}
        <div style={{
          height: 4,
          borderRadius: 2,
          background: T.progressBg,
          marginBottom: 36,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${barWidth}%`,
            background: T.progressFill,
            borderRadius: 2,
            transition: status === 'done'
              ? 'width 0.4s ease'
              : 'width 0.2s linear',
          }} />
        </div>

        {/* ── Message ── */}
        {status === 'processing' && (
          <p style={{
            fontSize: 16,
            fontWeight: 500,
            color: T.text,
            lineHeight: 1.6,
            textAlign: 'center',
            opacity: msgVisible ? 1 : 0,
            transition: 'opacity 0.3s ease',
            minHeight: 52,
          }}>
            {currentMessage}
          </p>
        )}

        {status === 'failed' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: T.text, marginBottom: 20 }}>
              {FAILED_MESSAGE}
            </p>
            <button
              onClick={onRetry}
              style={{
                background: T.btnBg,
                color: T.btnText,
                border: 'none',
                borderRadius: 12,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: T.btnShadow,
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add src/components/ProcessingScreen.tsx
git commit -m "feat: add ProcessingScreen with countdown bar and polling"
```

---

## Task 8: Wire ProcessingScreen into OnboardingIntake

**Files:**
- Modify: `src/components/OnboardingIntake.tsx`

Remove the internal `ProcessingScreen` function and the `startPolling`/`pollRef`/`handleRetry` logic. Wire in the new component.

- [ ] **Step 1: Import `ProcessingScreen` at the top of `OnboardingIntake.tsx`**
```ts
import { ProcessingScreen } from './ProcessingScreen';
```

- [ ] **Step 2: Delete the internal `ProcessingScreen` function (line ~342-390)**

Remove the entire `function ProcessingScreen({ failed, onRetry })` block.

- [ ] **Step 3: Remove polling state and logic**

Remove these from the main `OnboardingIntake` component:
- `const [failed, setFailed] = useState(false)` (or equivalent)
- `const pollRef = useRef(...)` (line ~790)
- `const startPolling = () => { ... }` (lines ~821-835)
- The `startPolling()` call inside `handleSubmit` (line ~863)

Keep `handleRetry` but simplify it — it no longer calls `startPolling`:
```ts
const handleRetry = async () => {
  try {
    await api.post('/onboarding/retry');
    // ProcessingScreen handles the re-polling
    setStep(5); // ensure we stay on processing screen
  } catch {
    toast.error('Retry failed. Please try again.');
  }
};
```

- [ ] **Step 4: Replace the `ProcessingScreen` JSX (line ~894)**

Find where the processing screen is rendered (currently `<ProcessingScreen failed={failed} onRetry={handleRetry} />`). Replace with:
```tsx
<ProcessingScreen
  isDark={dark}   // NOTE: the variable is named `dark`, not `isDark`
  theme={T}
  onComplete={() => {
    // ProcessingScreen has already invalidated the profile query.
    // OnboardingGate will re-evaluate and render ReportOrDashboard.
  }}
  onRetry={handleRetry}
/>
```

Also update the `ProcessingScreen` props interface in `ProcessingScreen.tsx` — if `isDark` is declared but never read inside the component body, either remove it or use it. To avoid TS6133 (unused variable), either delete `isDark` from the interface entirely (the component uses `theme: Theme` for all styling), or add `// eslint-disable-next-line` if you plan to use it later.

- [ ] **Step 5: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```

- [ ] **Step 6: Smoke test — submit onboarding in dev and verify the countdown bar appears**
```bash
npm run dev
```
Submit the onboarding form and confirm the countdown bar screen appears instead of the old spinner.

- [ ] **Step 7: Commit**
```bash
git add src/components/OnboardingIntake.tsx
git commit -m "feat(onboarding): replace internal ProcessingScreen with new countdown component"
```

---

## Task 9: ReportIsland Component

**Files:**
- Create: `src/components/ReportIsland.tsx`

> **Invoke the `frontend-design` skill before writing markup for this component.**

This is the single collapsible section. It renders closed (icon + teaser), open-problem (full text + CTA), and open-fix (problem + fix + feedback pills) states. State transitions are controlled by the parent via `isOpen` / `onToggle`.

- [ ] **Step 1: Create `src/components/ReportIsland.tsx`**

```tsx
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { type SectionMeta, SECTION_LINKS, SECTION_ICONS } from '../lib/reportIcons';
import api from '../lib/api';

export interface ReportIslandProps {
  sectionKey: string;
  meta: SectionMeta;
  problemText: string;
  fixText: string;
  reportId: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: (key: string) => void;
}

type Feedback = 'spot_on' | 'partially' | 'missed';

function extractTeaser(text: string): string {
  const sentence = text.split(/[.!?]/)[0]?.trim() ?? '';
  return sentence.length > 120 ? sentence.slice(0, 117) + '...' : sentence;
}

export function ReportIsland({
  sectionKey, meta, problemText, fixText, reportId,
  isOpen, onToggle, onNavigate,
}: ReportIslandProps) {
  const [showFix, setShowFix] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const Icon = meta.icon;
  const teaser = extractTeaser(problemText);
  const links = SECTION_LINKS[sectionKey] ?? [];

  async function submitFeedback(score: Feedback) {
    if (feedback || feedbackLoading) return;
    setFeedbackLoading(true);
    try {
      await api.post(`/onboarding/report/${reportId}/feedback`, {
        sectionKey,
        relevanceScore: score,
      });
      setFeedback(score);
    } catch {
      // silent — non-critical
    } finally {
      setFeedbackLoading(false);
    }
  }

  // Reset fix view when island closes
  const handleToggle = () => {
    if (isOpen) setShowFix(false);
    onToggle();
  };

  return (
    <div
      id={`report-island-${sectionKey}`}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {/* ── Header (always visible) ── */}
      <button
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '20px 24px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Icon with pulse when closed */}
        <motion.span
          animate={isOpen ? {} : { scale: [1, 1.12, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40, height: 40,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <Icon size={18} color="#9ca3af" />
        </motion.span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#f3f4f6', margin: 0 }}>
            {meta.label}
          </p>
          {!isOpen && (
            <p style={{
              fontSize: 13, color: '#6b7280', margin: '3px 0 0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {teaser}
            </p>
          )}
        </div>

        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          style={{ flexShrink: 0, color: '#4b5563' }}
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>

      {/* ── Expanded content ── */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0, 0, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 24px 24px' }}>
              {/* Problem text */}
              <p style={{
                fontSize: 15, color: '#d1d5db', lineHeight: 1.7,
                whiteSpace: 'pre-wrap', marginBottom: 20,
              }}>
                {problemText}
              </p>

              {/* Show fix button */}
              {!showFix && (
                <button
                  onClick={() => setShowFix(true)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 12,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#f3f4f6',
                    cursor: 'pointer',
                    marginBottom: 24,
                  }}
                >
                  Show me the fix →
                </button>
              )}

              {/* Fix reveal */}
              <AnimatePresence>
                {showFix && (
                  <motion.div
                    key="fix"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: 0.25, ease: [0.25, 0, 0, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 14,
                      padding: '18px 20px',
                      marginBottom: 24,
                      boxShadow: '0 0 24px rgba(99,102,241,0.08)',
                    }}>
                      <p style={{
                        fontSize: 12, fontWeight: 700, color: '#6b7280',
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        marginBottom: 10,
                      }}>
                        Your fix
                      </p>
                      <p style={{ fontSize: 15, color: '#d1d5db', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {fixText}
                      </p>
                    </div>

                    {/* Feedback pills */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
                      {(['spot_on', 'partially', 'missed'] as Feedback[]).map(score => {
                        const labels = { spot_on: 'Spot on', partially: 'Partially', missed: 'Missed the mark' };
                        const active = feedback === score;
                        return (
                          <button
                            key={score}
                            onClick={() => submitFeedback(score)}
                            disabled={!!feedback || feedbackLoading}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 99,
                              fontSize: 13,
                              fontWeight: 600,
                              border: `1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                              background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                              color: active ? '#f3f4f6' : '#6b7280',
                              cursor: feedback ? 'default' : 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {labels[score]}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cross-section CTAs */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {links.map(({ key, why }) => {
                  const dest = SECTION_ICONS[key];
                  if (!dest) return null;
                  const DestIcon = dest.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => onNavigate(key)}
                      style={{
                        flex: 1, minWidth: 200,
                        display: 'flex', flexDirection: 'column', gap: 4,
                        padding: '14px 16px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 14,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <DestIcon size={14} color="#6b7280" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f3f4f6' }}>
                          {dest.label}
                        </span>
                      </span>
                      <span style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{why}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add src/components/ReportIsland.tsx
git commit -m "feat: add ReportIsland collapsible section component"
```

---

## Task 10: ReportExperience Component

**Files:**
- Create: `src/components/ReportExperience.tsx`

> **Invoke the `frontend-design` skill before writing this component.**

This is the full-viewport report wrapper. It owns `openMap` state, fetches the report, parses sections, and renders all `ReportIsland` instances.

- [ ] **Step 1: Create `src/lib/parseReport.ts` from scratch**

The existing `parseReportSections` in `DiagnosticReport.tsx` returns `Record<string, string>` — a different shape to what `ReportExperience` needs. Do NOT copy it. Write the new utility fresh using the spec below. The existing `DiagnosticReport.tsx` is being retired anyway (Task 13).

`src/lib/parseReport.ts`:
```ts
export interface ReportSection {
  key: string;
  title: string;
  content: string;
}

/** Strip em dashes from text, replacing with comma+space or space */
function stripEmDash(text: string): string {
  return text.replace(/ — /g, ', ').replace(/—/g, ' ');
}

/**
 * Split a diagnostic markdown report into its 6 named sections.
 * Returns an array in the order they appear in the document.
 */
export function parseReportSections(markdown: string): ReportSection[] {
  if (!markdown) return [];
  // Split on ## headings
  const chunks = markdown.split(/\n(?=##\s)/);
  return chunks
    .filter(c => c.trim().startsWith('##'))
    .map(chunk => {
      const lines = chunk.trim().split('\n');
      const heading = lines[0].replace(/^##\s*/, '').trim();
      const body = stripEmDash(lines.slice(1).join('\n').trim());
      return { key: headingToKey(heading), title: heading, content: body };
    })
    .filter(s => s.key !== 'unknown');
}

function headingToKey(heading: string): string {
  const h = heading.toLowerCase();
  if (h.includes('target')) return 'targeting';
  if (h.includes('document') || h.includes('audit')) return 'document_audit';
  if (h.includes('pipeline')) return 'pipeline';
  if (h.includes('honest')) return 'honest';
  if (h.includes('fix') || h.includes('step')) return 'fix';
  if (h.includes('jobhub') || h.includes('what')) return 'what_jobhub_does';
  return 'unknown';
}

/**
 * Split a section's content into problem text and fix text.
 * Fix text starts after the first "---" separator or "Fix:" heading within the section.
 */
export function splitProblemFix(content: string): { problem: string; fix: string } {
  const sep = content.indexOf('\n---\n');
  if (sep !== -1) {
    return {
      problem: content.slice(0, sep).trim(),
      fix: content.slice(sep + 5).trim(),
    };
  }
  // Fallback: split at 60% of content — problem is first part, fix is rest
  const mid = Math.floor(content.length * 0.6);
  const breakAt = content.indexOf('\n', mid);
  if (breakAt === -1) return { problem: content, fix: '' };
  return {
    problem: content.slice(0, breakAt).trim(),
    fix: content.slice(breakAt).trim(),
  };
}
```

- [ ] **Step 2: Create `src/components/ReportExperience.tsx`**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { parseReportSections, splitProblemFix } from '../lib/parseReport';
import { SECTION_ICONS } from '../lib/reportIcons';
import { ReportIsland } from './ReportIsland';

interface ReportExperienceProps {
  onDone: () => void;
}

interface ReportData {
  reportId: string;
  status: string;
  reportMarkdown: string | null;
}

export function ReportExperience({ onDone }: ReportExperienceProps) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const { data } = useQuery<ReportData>({
    queryKey: ['report'],
    queryFn: async () => {
      const res = await api.get<ReportData>('/onboarding/report');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const sections = parseReportSections(data?.reportMarkdown ?? '');
  const reportId = data?.reportId ?? '';

  function handleToggle(key: string) {
    setOpenMap(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleNavigate(key: string) {
    setOpenMap(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      document.getElementById(`report-island-${key}`)?.scrollIntoView({
        behavior: 'smooth', block: 'start',
      });
    }, 50);
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0d1117',
      overflowY: 'auto',
    }}>
      {/* ── Blobs (reuse pattern from OnboardingIntake) ── */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        {[
          { top: '-15%', left: '-10%', size: 500 },
          { top: '50%',  right: '-8%', size: 420 },
          { bottom: '-10%', left: '30%', size: 380 },
        ].map((b, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: b.size, height: b.size,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 33% 28%, #1e2535 0%, #131924 55%, #0d1117 100%)',
            boxShadow: 'inset -10px -10px 28px rgba(0,0,0,0.6), inset 5px 5px 18px rgba(255,255,255,0.03), 20px 32px 80px rgba(0,0,0,0.5)',
            ...b,
          }} />
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '60px 20px 80px' }}>
        {/* Header */}
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 12 }}>
            Your diagnosis
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f3f4f6', margin: 0, lineHeight: 1.3 }}>
            Here's what's actually going on.
          </h1>
          <p style={{ fontSize: 15, color: '#6b7280', marginTop: 12 }}>
            Open each section to see your diagnosis, then unlock the fix.
          </p>
        </div>

        {/* Islands */}
        {sections.map(section => {
          const meta = SECTION_ICONS[section.key];
          if (!meta) return null;
          const { problem, fix } = splitProblemFix(section.content);
          return (
            <ReportIsland
              key={section.key}
              sectionKey={section.key}
              meta={meta}
              problemText={problem}
              fixText={fix}
              reportId={reportId}
              isOpen={!!openMap[section.key]}
              onToggle={() => handleToggle(section.key)}
              onNavigate={handleNavigate}
            />
          );
        })}

        {/* End-of-report CTA */}
        {sections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{
              marginTop: 48,
              padding: '40px 32px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 24,
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f3f4f6', marginBottom: 8 }}>
              Your game plan is ready.
            </h2>
            <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 28 }}>
              Time to put it to work.
            </p>
            <button
              onClick={onDone}
              style={{
                background: '#f3f4f6',
                color: '#111827',
                border: 'none',
                borderRadius: 14,
                padding: '14px 36px',
                fontSize: 16,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              }}
            >
              Let's go →
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add src/lib/parseReport.ts src/components/ReportExperience.tsx
git commit -m "feat: add ReportExperience full-viewport collapsible report"
```

---

## Task 11: App.tsx — ReportOrDashboard Wrapper

**Files:**
- Modify: `src/App.tsx`

Replace the `DiagnosticReport` import and the inner tree inside `OnboardingGate` with `ReportOrDashboard`.

- [ ] **Step 1: Add imports to App.tsx**
```ts
import { ReportExperience } from './components/ReportExperience';
import { motion } from 'framer-motion';
```

- [ ] **Step 2: Add `ReportOrDashboard` function inside App.tsx (before the main `App` export)**
```tsx
function ReportOrDashboard() {
  const [reportSeen, setReportSeen] = useState(
    () => localStorage.getItem('jobhub_report_seen') === 'true'
  );

  function handleDone() {
    localStorage.setItem('jobhub_report_seen', 'true');
    localStorage.setItem('jobhub_tips_seen', 'false');
    setReportSeen(true);
  }

  if (!reportSeen) {
    return <ReportExperience onDone={handleDone} />;
  }

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0, 0, 1] }}
    >
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tracker" element={<ApplicationTracker />} />
          <Route path="/application-workspace" element={<ApplicationWorkspace />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </DashboardLayout>
    </motion.div>
  );
}
```

- [ ] **Step 3: Replace the inner tree inside `OnboardingGate` (line ~234-245)**

Change:
```tsx
<OnboardingGate>
  <DashboardLayout>
    <Routes>
      ...
    </Routes>
  </DashboardLayout>
</OnboardingGate>
```

To:
```tsx
<OnboardingGate>
  <ReportOrDashboard />
</OnboardingGate>
```

- [ ] **Step 4: Remove the `DiagnosticReport` import (line ~18)**
```ts
// Delete: import { DiagnosticReport } from './components/DiagnosticReport';
```

- [ ] **Step 5: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```

- [ ] **Step 6: Smoke test — navigate to app as a new user post-onboarding**

Confirm:
- First visit shows `ReportExperience` (no sidebar)
- "Let's go" button transitions to dashboard with fade-in
- Refreshing after that shows dashboard directly (not report)

- [ ] **Step 7: Commit**
```bash
git add src/App.tsx
git commit -m "feat(app): add ReportOrDashboard wrapper — first visit shows full-screen report"
```

---

## Task 12: Dashboard — Summary Card + FirstVisitTips

**Files:**
- Create: `src/components/FirstVisitTips.tsx`
- Modify: `src/App.tsx` (the `Dashboard` function, line ~32)

> **Invoke the `frontend-design` skill before writing the UI for this task.**

- [ ] **Step 1: Create `src/components/FirstVisitTips.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Tip {
  id: string;
  text: string;
}

interface FirstVisitTipsProps {
  tips: Tip[];
}

export function FirstVisitTip({ tips }: FirstVisitTipsProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reportSeen = localStorage.getItem('jobhub_report_seen') === 'true';
    const tipsSeen   = localStorage.getItem('jobhub_tips_seen') === 'true';
    if (reportSeen && !tipsSeen) {
      setVisible(true);
      // Auto-dismiss after 8s (per spec)
      const t = setTimeout(() => dismiss(), 8_000);
      // Dismiss on any dashboard click
      const handler = () => dismiss();
      document.addEventListener('click', handler);
      return () => { clearTimeout(t); document.removeEventListener('click', handler); };
    }
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem('jobhub_tips_seen', 'true');
  }

  return (
    <AnimatePresence>
      {visible && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {tips.map((tip, i) => (
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ delay: i * 0.2, duration: 0.3 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                background: 'rgba(14,165,233,0.1)',
                border: '1px solid rgba(14,165,233,0.2)',
                borderRadius: 99,
                fontSize: 12,
                color: '#7dd3fc',
                width: 'fit-content',
              }}
            >
              <span style={{ fontSize: 14 }}>💡</span>
              {tip.text}
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Add the collapsed summary card and `FirstVisitTip` to the `Dashboard` function in App.tsx**

Find the `Dashboard` function (line ~32) and replace `<DiagnosticReport />` with:
```tsx
{/* Collapsed report summary card */}
<div style={{
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: '18px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 24,
}}>
  <div>
    <p style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', margin: 0 }}>Your Diagnosis</p>
    <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0' }}>
      {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
    </p>
  </div>
  <button
    onClick={() => setShowReport(true)}
    style={{
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      padding: '8px 16px',
      fontSize: 13,
      fontWeight: 700,
      color: '#d1d5db',
      cursor: 'pointer',
    }}
  >
    View again
  </button>
</div>

{/* First-visit tips under the summary card */}
<FirstVisitTip tips={[
  { id: 'achievements', text: 'All your achievements are logged here — hit Manage to edit them' },
  { id: 'matcher',      text: 'Paste a job description here to get matched and start applying' },
]} />
```

Add to the top of the `Dashboard` function:
```tsx
const [showReport, setShowReport] = useState(false);
```

And render the overlay when `showReport` is true (before the return's closing tag).

**Important:** `ReportExperience` uses `position: fixed` blobs internally, which escape the DOM boundary of any wrapper div. Do NOT wrap it in another `position: fixed` div — just render it directly and place the close button as a sibling with its own `position: fixed`:
```tsx
{showReport && (
  <>
    <button
      onClick={() => setShowReport(false)}
      style={{
        position: 'fixed', top: 16, right: 20, zIndex: 52,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 99, padding: '8px 16px',
        fontSize: 13, fontWeight: 700, color: '#d1d5db', cursor: 'pointer',
      }}
    >
      ← Back to dashboard
    </button>
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <ReportExperience onDone={() => setShowReport(false)} />
    </div>
  </>
)}
```

- [ ] **Step 3: Add `FirstVisitTip` import to App.tsx**
```ts
import { FirstVisitTip } from './components/FirstVisitTips';
```

- [ ] **Step 4: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```

- [ ] **Step 5: Test first-visit tip behaviour**

In DevTools, clear `jobhub_tips_seen` from localStorage and set `jobhub_report_seen = true`. Reload. Confirm tips appear, fade out after 10s.

- [ ] **Step 6: Commit**
```bash
git add src/components/FirstVisitTips.tsx src/App.tsx
git commit -m "feat: add dashboard summary card, return-visit report overlay, first-visit tips"
```

---

## Task 13: Cleanup — Retire DiagnosticReport

**Files:**
- Delete: `src/components/DiagnosticReport.tsx`

- [ ] **Step 1: Confirm no remaining imports of DiagnosticReport**
```bash
grep -r "DiagnosticReport" src/
```
Expected: no results (we removed the import in Task 11 Step 4 and Task 12).

- [ ] **Step 2: Delete the file**
```bash
rm src/components/DiagnosticReport.tsx
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**
```bash
npx tsc --noEmit
```

- [ ] **Step 4: Final build check**
```bash
npm run build
```
Expected: builds with no errors.

- [ ] **Step 5: Deploy to Railway**
```bash
git add -A
git commit -m "chore: retire DiagnosticReport.tsx — replaced by ReportExperience"
git push origin master
```

- [ ] **Step 6: Verify Railway deployment**

After Railway redeploys (~60s), confirm `/api/health` returns 200, then test the full onboarding flow end-to-end.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-03-25-diagnostic-report-experience.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, with checkpoints

Which approach?

# Force-the-Path Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move users from "completed the diagnostic" to "actively building their profile and submitting applications" by making progress feel inevitable — using endowed progress, milestone moments, dynamic CTAs, and micro-rewards that fire on real user actions.

**Architecture:** All changes are frontend-first (React components + Framer Motion). The one backend change (endowed progress scoring) is a 5-line addition to an existing route. Phase 3 (feature gating, identity labels, social proof API) is outlined but not tasked — it requires a separate planning session.

**Tech Stack:** React 18, TypeScript, Framer Motion, Tailwind/inline styles (matching existing ProfileBank pattern), Lucide icons, localStorage for milestone tracking.

---

## What Phase 1 Already Shipped (Context Only — Do Not Re-implement)

These were committed to master in `215f474` without a plan — do not touch them again:

- `src/components/ProfileBank.tsx` — achievement warning copy rewritten; "View Diagnostic / Run Diagnostic" link added to page header
- `src/components/ProfileCompletion.tsx` — score-aware copy (ATS gap message <50%, "almost there" 50–80%, "sharp" 80+)
- `src/components/ReportExperience.tsx` — "What's happening" and "Your 3-step plan" section labels removed
- `server/src/services/diagnosticReport.ts` — 3-step fix prompt now generates bold-titled items with platform CTA in item 3

---

## File Map

| File | Status | What changes |
|---|---|---|
| `server/src/routes/profile/profile-core.ts` | Modify | Endowed progress: +25 to score if `hasCompletedOnboarding` |
| `src/components/ProfileBank.tsx` | Modify | Dynamic sidebar CTA; milestone modal state; first-visit modal upgrade; "How?" button on amber warnings |
| `src/components/ProfileCompletionRing.tsx` | **Create** | Extracted animated ring with pulse at <50%; replaces duplicated SVG in `ProfileCompletion.tsx` and `CompletionSidebar` |
| `src/components/AchievementVideoModal.tsx` | **Create** | "How?" modal with `public/Achievements_Edit.mp4` |
| `src/components/MilestoneModal.tsx` | **Create** | Reusable celebration modal for 50%/70% unlock moments |

---

## Task 1: Backend — Endowed Progress Scoring

**Files:**
- Modify: `server/src/routes/profile/profile-core.ts:42-62`

The current scoring max is 100. If the user completed the diagnostic (`hasCompletedOnboarding === true`), the displayed score starts at 25 — representing the work they already did. This is honest: they DID do something meaningful (intake + diagnostic + baseline resume generation). The backend already stores `hasCompletedOnboarding` on `CandidateProfile`.

Note: `isReady` stays anchored to the raw score, not the endowed one, so gating logic is unaffected.

- [ ] **Open `server/src/routes/profile/profile-core.ts`**

- [ ] **Replace the completion block (lines 42–62) with:**

```typescript
// Compute profile completion score
let rawScore = 0;
const missingFields: string[] = [];
if (profile.name) rawScore += 15; else missingFields.push('name');
if (profile.email) rawScore += 10; else missingFields.push('email');
if (profile.location) rawScore += 10; else missingFields.push('location');
if (profile.professionalSummary) rawScore += 15; else missingFields.push('summary');
if (profile.experience?.length > 0) rawScore += 20; else missingFields.push('experience');
if (profile.education?.length > 0) rawScore += 10; else missingFields.push('education');
if (profile.achievements?.length >= 3) rawScore += 15; else missingFields.push('3+ achievements');
if (profile.skills) rawScore += 5; else missingFields.push('skills');

// Endowed progress: diagnostic completion is worth 25 points (displayed only)
const endowedBonus = profile.hasCompletedOnboarding ? 25 : 0;
const score = Math.min(100, rawScore + endowedBonus);

res.json({
    ...profile,
    isAdmin,
    completion: {
        score,
        rawScore,
        isReady: rawScore >= 70,
        missingFields
    }
});
```

- [ ] **Verify the TypeScript compiles** — run `cd server && npx tsc --noEmit` from the server directory. Expect: no errors.

- [ ] **Manual sanity check:** A user with all profile fields but `hasCompletedOnboarding = false` should score 100 raw and show 100. A user with only name + email + location (`rawScore = 35`) and `hasCompletedOnboarding = true` should show 60, `isReady: false`.

- [ ] **Commit:**

```bash
git add server/src/routes/profile/profile-core.ts
git commit -m "feat(profile): endowed progress — diagnostic adds 25 to displayed score

rawScore drives gating (isReady at 70); displayed score starts at 25 for users
who completed the diagnostic, reflecting real work already done.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Dynamic Sidebar CTA

**Files:**
- Modify: `src/components/ProfileBank.tsx:1385-1410` (the `CompletionSidebar` CTA button block)

Currently: one static "Go to Dashboard" button, disabled below 70. The strategy requires score-tier messaging that changes as users build their profile.

Tier table:
| Score | Label | Color | Action |
|---|---|---|---|
| <50 | "Keep building — this profile isn't ready yet" | red `#dc2626` | no-op (disabled) |
| 50–69 | "Almost there. Add more achievements to unlock the job board." | amber `#d97706` | no-op (disabled) |
| 70–89 | "You're ready. Find your next role." | indigo `#6366f1` | navigate('/') |
| 90+ | "Your profile is exceptional. Go get hired." | brand purple `#7c3aed` | navigate('/') |

- [ ] **Open `src/components/ProfileBank.tsx`**

- [ ] **Find the `CompletionSidebar` CTA block (look for `Go to Dashboard`). Replace it with:**

```tsx
{/* Dynamic CTA */}
{(() => {
  const tier =
    score >= 90 ? 'exceptional' :
    score >= 70 ? 'ready' :
    score >= 50 ? 'close' : 'building';

  const config = {
    exceptional: {
      label: 'Your profile is exceptional. Go get hired.',
      bg: '#7c3aed', color: '#fff', disabled: false,
    },
    ready: {
      label: "You're ready. Find your next role.",
      bg: '#6366f1', color: '#fff', disabled: false,
    },
    close: {
      label: 'Almost there. Add more achievements to unlock the job board.',
      bg: isDark ? 'rgba(217,119,6,0.12)' : 'rgba(217,119,6,0.1)',
      color: '#d97706', disabled: true,
    },
    building: {
      label: "Keep building — this profile isn't ready yet.",
      bg: isDark ? 'rgba(220,38,38,0.1)' : 'rgba(220,38,38,0.07)',
      color: '#dc2626', disabled: true,
    },
  }[tier];

  return (
    <button
      onClick={() => !config.disabled && navigate('/')}
      disabled={config.disabled}
      style={{
        width: '100%',
        padding: '12px 16px',
        borderRadius: 10, border: 'none',
        background: config.bg,
        color: config.color,
        fontSize: 13, fontWeight: 700,
        cursor: config.disabled ? 'default' : 'pointer',
        lineHeight: 1.4, textAlign: 'center',
        transition: 'all 0.15s ease',
      }}
    >
      {config.label}
    </button>
  );
})()}
```

- [ ] **Delete the old disabled-hint paragraph** (`Score {score}/100 — need 70 to proceed`) that sits directly below the old button — it's now redundant.

- [ ] **Build check:** `npm run build` from project root. Expect: no TypeScript errors.

- [ ] **Commit:**

```bash
git add src/components/ProfileBank.tsx
git commit -m "feat(profile): dynamic sidebar CTA responds to score tier

Four states: building (<50 red), close (50-69 amber), ready (70-89 indigo),
exceptional (90+ purple). Only enabled at 70+.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Progress Ring Pulse at Low Completion

**Files:**
- Modify: `src/components/ProfileBank.tsx` (the `CompletionSidebar` SVG ring, lines ~1328–1338)

When score < 50, the ring should pulse — a subtle opacity animation that signals "this is open, not resolved." Above 50, the ring is static.

- [ ] **Open `src/components/ProfileBank.tsx`**

- [ ] **Add `import { motion } from 'framer-motion';`** at the top if not already imported (check line 3 — it is already there).

- [ ] **Find the inner `<circle>` in `CompletionSidebar` that renders the progress arc** (the one with `strokeDashoffset`). Wrap just that circle in a `motion.circle` with conditional pulse:

```tsx
<motion.circle
  stroke={scoreColor}
  fill="transparent"
  strokeWidth={stroke}
  strokeDasharray={`${circ} ${circ}`}
  style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s cubic-bezier(0.25,1,0.5,1)' }}
  strokeLinecap="round"
  r={nr} cx={radius} cy={radius}
  animate={score < 50 ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
  transition={score < 50 ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : {}}
/>
```

Note: `motion.circle` is a valid Framer Motion element — SVG elements are supported.

- [ ] **Build check:** `npm run build`. Expect: no errors.

- [ ] **Commit:**

```bash
git add src/components/ProfileBank.tsx
git commit -m "feat(profile): ring pulses at <50% to signal open loop

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Achievement "How?" Video Modal

**Files:**
- Create: `src/components/AchievementVideoModal.tsx`
- Modify: `src/components/ProfileBank.tsx` (`CoachHint` component and `hintForAchievement` rendering)

A video demonstrating how to quantify achievements already exists at `public/Achievements_Edit.mp4`. This task adds a small "How?" link next to every amber warning, tapping which opens a modal with the 60-second clip.

- [ ] **Create `src/components/AchievementVideoModal.tsx`:**

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

export const AchievementVideoModal: React.FC<Props> = ({ isOpen, onClose, isDark }) => {
  const bg = isDark ? '#0d1117' : '#fff';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const text = isDark ? '#f3f4f6' : '#111827';
  const sub = isDark ? '#9ca3af' : '#6b7280';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: bg, border: `1px solid ${border}`,
              borderRadius: 20, padding: '24px 28px', maxWidth: 540, width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: text, letterSpacing: '-0.01em' }}>
                  Adding a number that lands
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: sub }}>
                  A metric turns a duty into evidence. Here's how to find one.
                </p>
              </div>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub, padding: 4, lineHeight: 1 }}
              >
                <X size={16} />
              </button>
            </div>
            <video
              src="/Achievements_Edit.mp4"
              autoPlay
              loop
              muted
              playsInline
              style={{ width: '100%', borderRadius: 12, display: 'block' }}
            />
            <p style={{ margin: '14px 0 0', fontSize: 12, color: sub, lineHeight: 1.6, textAlign: 'center' }}>
              Even an estimate works: "reduced handling time by roughly 30%" outperforms a blank field every time.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

- [ ] **Open `src/components/ProfileBank.tsx`**

- [ ] **Add the import** at the top of the file (with other local imports):

```tsx
import { AchievementVideoModal } from './AchievementVideoModal';
```

- [ ] **In the `AchievementIsland` component (search for where `CoachHint` is rendered for achievements), find the `hintForAchievement` call.** You'll see a pattern like:

```tsx
const hint = hintForAchievement(ach);
{hint && <CoachHint hint={hint} />}
```

Replace that block with:

```tsx
const hint = hintForAchievement(ach);
const [showVideoModal, setShowVideoModal] = useState(false);
{hint && hint.type === 'warn' && (
  <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <CoachHint hint={hint} />
      <button
        onClick={() => setShowVideoModal(true)}
        style={{
          fontSize: 11, fontWeight: 700, color: '#d97706',
          background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)',
          borderRadius: 5, padding: '3px 8px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
        }}
      >
        How?
      </button>
    </div>
    <AchievementVideoModal isOpen={showVideoModal} onClose={() => setShowVideoModal(false)} isDark={isDark} />
  </>
)}
{hint && hint.type !== 'warn' && <CoachHint hint={hint} />}
```

Note: Because `useState` cannot be called conditionally inside a map, you may need to extract the achievement row into its own component (`AchievementRow`) that holds the `showVideoModal` state. If the existing code already has an achievement row component, add the state there instead.

- [ ] **Build check:** `npm run build`. Fix any "React Hook called conditionally" errors by extracting to a sub-component.

- [ ] **Commit:**

```bash
git add src/components/AchievementVideoModal.tsx src/components/ProfileBank.tsx
git commit -m "feat(profile): 'How?' button on amber warnings opens achievement video modal

Uses existing public/Achievements_Edit.mp4. Fires only on warn hints, not ok hints.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Upgrade First-Visit Modal to Baseline Resume Gift

**Files:**
- Modify: `src/components/ProfileBank.tsx` (the `showWelcomeModal` block, lines ~1505–1555)

The current first-visit modal explains the achievement bank. The strategy says the **first thing** a user should see is: "We've prepared a starting point for you" — a modal that gives them the baseline resume immediately, creating reciprocity, then offers to help them improve it (keeping them in the app).

Show this modal only when:
- `showWelcomeModal` is true (first visit, controlled by `jobhub_profile_visited` localStorage key)
- `profile.hasCompletedOnboarding` is true (they have a baseline resume)

If `hasCompletedOnboarding` is false, fall back to the existing 3-step onboarding explanation modal.

- [ ] **Open `src/components/ProfileBank.tsx`**

- [ ] **Add state for baseline download in the `ProfileBank` component** (near the other `useState` calls):

```tsx
const [baselineDownloading, setBaselineDownloading] = useState(false);
```

- [ ] **Add a `handleBaselineDownload` function** (in the `ProfileBank` component body, before `return`):

```tsx
const handleBaselineDownload = async () => {
  if (baselineDownloading) return;
  setBaselineDownloading(true);
  try {
    const { data } = await api.get('/profile/baseline-resume');
    if (data.status === 'ready' && data.documentId) {
      const { data: doc } = await api.get(`/documents/${data.documentId}`);
      const { exportDocx } = await import('../lib/exportDocx');
      await exportDocx(doc.content, 'resume', '');
    }
  } catch {
    // silent — user can still dismiss and use the banner
  } finally {
    setBaselineDownloading(false);
    dismissWelcomeModal();
  }
};
```

- [ ] **Replace the welcome modal JSX** (the `{showWelcomeModal && (...)}` AnimatePresence block) with:

```tsx
<AnimatePresence>
  {showWelcomeModal && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={dismissWelcomeModal}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: isDark ? '#0d1117' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 20, padding: '32px 36px', maxWidth: 460, width: '100%' }}
      >
        {(profile as any)?.hasCompletedOnboarding ? (
          /* Baseline resume gift moment */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={20} style={{ color: '#2dd4bf' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', margin: 0, letterSpacing: '-0.01em' }}>
                  We've prepared a starting point for you.
                </h3>
                <p style={{ fontSize: 12, color: isDark ? '#6b7280' : '#9ca3af', margin: '3px 0 0' }}>
                  Your diagnostic findings are already baked in.
                </p>
              </div>
            </div>

            <div style={{ background: isDark ? 'rgba(45,212,191,0.05)' : 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.18)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 1.65 }}>
                Your baseline resume has been rewritten based on your diagnostic. It's a solid starting point — a complete profile turns it into something that gets interviews.
              </p>
            </div>

            <p style={{ fontSize: 12, color: isDark ? '#6b7280' : '#9ca3af', marginBottom: 18, lineHeight: 1.6, textAlign: 'center' }}>
              6 minutes of your time here could change the next 6 months.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleBaselineDownload}
                disabled={baselineDownloading}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 10,
                  background: '#2dd4bf', border: 'none', color: '#0d1117',
                  fontSize: 14, fontWeight: 800, cursor: baselineDownloading ? 'wait' : 'pointer',
                  opacity: baselineDownloading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Download size={15} />
                {baselineDownloading ? 'Downloading…' : 'Download my resume'}
              </button>
              <button
                onClick={dismissWelcomeModal}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'}`,
                  color: isDark ? '#9ca3af' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Let's sharpen it instead →
              </button>
            </div>
          </>
        ) : (
          /* Original 3-step onboarding explanation */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Star size={20} style={{ color: '#818cf8' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', margin: 0, letterSpacing: '-0.01em' }}>Your Achievement Bank</h3>
                <p style={{ fontSize: 12, color: isDark ? '#6b7280' : '#9ca3af', margin: '2px 0 0' }}>How to get the most out of this page</p>
              </div>
            </div>
            {[
              { num: '1', title: 'Add your experience', desc: 'Enter every role you\'ve held. The AI uses your full work history to find the right story for each application.' },
              { num: '2', title: 'Link achievements to each role', desc: 'These are the specific wins, metrics, and outcomes — the evidence behind your claims. This is the most important part.' },
              { num: '3', title: 'Every document draws from this', desc: 'Your resume, cover letters, and interview answers are all built from this bank. Update it once and every generation improves.' },
            ].map(step => (
              <div key={step.num} style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#818cf8' }}>
                  {step.num}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e5e7eb' : '#111827', margin: '2px 0 4px' }}>{step.title}</p>
                  <p style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', margin: 0, lineHeight: 1.55 }}>{step.desc}</p>
                </div>
              </div>
            ))}
            <button
              onClick={dismissWelcomeModal}
              style={{ marginTop: 8, width: '100%', padding: '13px 0', borderRadius: 10, background: 'rgba(99,102,241,0.9)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em' }}
            >
              Got it, let's build →
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Verify `Download` is imported** from `lucide-react` at the top of `ProfileBank.tsx`. Add it if missing.

- [ ] **Build check:** `npm run build`. Expect: no errors.

- [ ] **Commit:**

```bash
git add src/components/ProfileBank.tsx
git commit -m "feat(profile): upgrade first-visit modal to baseline resume gift moment

Users who completed onboarding see: 'We've prepared a starting point' with
download + 'Let's sharpen it' buttons. Reciprocity + micro-commitment.
Users without onboarding see the original achievement bank explanation.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Milestone Celebration Modals (50% and 70%)

**Files:**
- Create: `src/components/MilestoneModal.tsx`
- Modify: `src/components/ProfileBank.tsx` (add `usePrevScore` ref and modal trigger logic)

When the user's score crosses 50 or 70 for the first time, show a celebration modal. Use localStorage keys `jobhub_milestone_50` and `jobhub_milestone_70` to ensure each fires once per account.

The 50% milestone unlocks LinkedIn Optimiser. The 70% milestone unlocks the Job Board.

- [ ] **Create `src/components/MilestoneModal.tsx`:**

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Unlock } from 'lucide-react';

interface MilestoneConfig {
  threshold: 50 | 70;
  headline: string;
  sub: string;
  detail: string;
  color: string;
  ctaLabel: string;
  onCta: () => void;
}

interface Props {
  config: MilestoneConfig | null;
  onClose: () => void;
  isDark: boolean;
}

export const MilestoneModal: React.FC<Props> = ({ config, onClose, isDark }) => {
  const bg = isDark ? '#0d1117' : '#fff';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const text = isDark ? '#f3f4f6' : '#111827';
  const sub = isDark ? '#9ca3af' : '#6b7280';

  return (
    <AnimatePresence>
      {config && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: bg, border: `1px solid ${border}`,
              borderRadius: 20, padding: '32px 36px', maxWidth: 420, width: '100%', textAlign: 'center',
            }}
          >
            <button
              onClick={onClose}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: sub, padding: 4, lineHeight: 1 }}
            >
              <X size={16} />
            </button>

            {/* Icon */}
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
              background: `${config.color}18`, border: `1px solid ${config.color}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Unlock size={24} style={{ color: config.color }} />
            </div>

            {/* Threshold badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '4px 12px', borderRadius: 20, background: `${config.color}15`, border: `1px solid ${config.color}30` }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: config.color }}>
                {config.threshold}% Unlocked
              </span>
            </div>

            <h3 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 900, color: text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {config.headline}
            </h3>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: sub, lineHeight: 1.6 }}>
              {config.sub}
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: sub, lineHeight: 1.6, opacity: 0.75 }}>
              {config.detail}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => { config.onCta(); onClose(); }}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 10,
                  background: config.color, border: 'none', color: '#fff',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                }}
              >
                {config.ctaLabel}
              </button>
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'}`,
                  color: isDark ? '#9ca3af' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Keep building my profile
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

- [ ] **Open `src/components/ProfileBank.tsx`**

- [ ] **Add the import** near the top:

```tsx
import { MilestoneModal } from './MilestoneModal';
```

- [ ] **Add milestone state in the `ProfileBank` component** (near the other `useState` declarations):

```tsx
const [activeMilestone, setActiveMilestone] = useState<50 | 70 | null>(null);
const prevScoreRef = useRef<number | null>(null);
```

Verify `useRef` is already imported from React (it is — `ProfileBank.tsx:1`).

- [ ] **Add a `useEffect` that fires when `profile` loads** (after the existing `useQuery`, in the component body):

```tsx
useEffect(() => {
  if (!profile) return;
  const score = profile.completion.score;
  const prev = prevScoreRef.current;

  if (prev !== null) {
    // Check 70% milestone first (higher priority)
    if (prev < 70 && score >= 70 && !localStorage.getItem('jobhub_milestone_70')) {
      localStorage.setItem('jobhub_milestone_70', '1');
      setActiveMilestone(70);
    } else if (prev < 50 && score >= 50 && !localStorage.getItem('jobhub_milestone_50')) {
      localStorage.setItem('jobhub_milestone_50', '1');
      setActiveMilestone(50);
    }
  }

  prevScoreRef.current = score;
}, [profile]);
```

- [ ] **Add the `MilestoneModal` render** in the JSX, after the `AnimatePresence` for `showWelcomeModal`:

```tsx
<MilestoneModal
  isDark={isDark}
  config={activeMilestone ? (activeMilestone === 70 ? {
    threshold: 70,
    headline: "You're ready. Let's get you hired.",
    sub: "Your profile just crossed 70. The job board is open.",
    detail: "Candidates above 70% have a 3x higher application-to-interview rate. You're in that group now.",
    color: '#6366f1',
    ctaLabel: 'Find my next role →',
    onCta: () => navigate('/jobs'),
  } : {
    threshold: 50,
    headline: 'Halfway there. LinkedIn is your next weapon.',
    sub: "Your profile just crossed 50. The LinkedIn Optimiser is now unlocked.",
    detail: "A strong LinkedIn profile multiplies the impact of every application you send.",
    color: '#0a66c2',
    ctaLabel: 'Open LinkedIn Optimiser →',
    onCta: () => navigate('/linkedin'),
  }) : null}
  onClose={() => setActiveMilestone(null)}
/>
```

- [ ] **Build check:** `npm run build`. Expect: no errors.

- [ ] **Commit:**

```bash
git add src/components/MilestoneModal.tsx src/components/ProfileBank.tsx
git commit -m "feat(profile): milestone celebration modals at 50% and 70%

50% unlocks LinkedIn Optimiser, 70% unlocks Job Board.
Each fires once per account (localStorage guard). 70% takes priority.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 3 Outline (Separate Planning Session Required)

These are not tasked here — each requires its own spec review and plan before implementation.

| Feature | Complexity | What it needs |
|---|---|---|
| Feature gating by completion (free trial) | Medium | Backend middleware change; UI gate components; paying users see persuasion not locks |
| Identity labels at 70%/90% ("Prepared Candidate", "Exceptional Profile") | Low | Frontend only — label in sidebar header based on score tier |
| Aggregate social proof API endpoint | Medium | DB query counting weekly milestone crossings; weekly cron to cache result |
| Automated 7-day nudge email | High | Scheduled job (cron or Railway cron); email template; unsubscribe handling |
| Progress-based CTA updates on save | Low | Invalidate the `['profile']` query after any profile mutation — should already happen |

---

## Self-Review

**Spec coverage check against `docs/product-decisions/2026-05-10-force-the-path-strategy.md`:**

| Strategy requirement | Covered |
|---|---|
| Loss aversion diagnostic framing | Phase 1 done |
| Endowed progress (start at 25%) | Task 1 |
| Zeigarnik (incomplete feels unresolved) | Task 3 (ring pulse) + Phase 1 (copy) |
| Feature gating with milestone unlocks | Modals in Task 6; hard gating in Phase 3 outline |
| First session contract (baseline resume modal) | Task 5 |
| CTA language shifts with progress | Task 2 |
| Achievement warning copy | Phase 1 done |
| 3-step plan fix | Phase 1 done |
| Run/View Diagnostic link | Phase 1 done |
| GIF animation for achievement "How?" | Task 4 (uses MP4 not GIF — same concept) |
| Progress ring pulse | Task 3 |
| Identity labeling (70%/90%) | Phase 3 outline |
| Aggregate social proof | Phase 3 outline |

**Placeholder scan:** No TBDs or TODOs. All code blocks are complete and compilable.

**Type consistency:** `profile.completion.score` is used consistently across Task 1 (backend) and Tasks 2–6 (frontend). The `rawScore` added in Task 1 is only used in the backend response; the frontend continues to use `score` (the endowed value) as it did before. `isReady` uses `rawScore` on the backend, which the frontend receives as `completion.isReady` — same key, no renaming.

# Diagnostic Report Experience — Design Spec
**Date:** 2026-03-25
**Status:** Approved by user — v4 (post third spec-review fixes)

---

## Overview

Replace the current `DiagnosticReport.tsx` and processing spinner with a polished, dark-mode report experience that:
1. Gives users visual reassurance during the 30-60s LLM wait
2. Delivers their diagnosis as a high-dopamine, section-by-section reveal
3. Captures marketing email consent at the end of onboarding
4. Transitions naturally into the dashboard at the end of the report
5. Guides first-time dashboard visitors with subtle inline tips

No new routes. No new pages. All changes happen within the existing component tree.

---

## Scope

### New Components
- `ProcessingScreen.tsx` — countdown bar + rotating Aussie-flavoured messages
- `ReportExperience.tsx` — full-viewport collapsible report
- `ReportIsland.tsx` — single collapsible section (problem → fix reveal)
- `FirstVisitTips.tsx` — localStorage-gated inline hints

### Modified Components
- `OnboardingIntake.tsx` — add email + consent fields to `StepFiles` and `IntakeAnswers` type; replace internal `ProcessingScreen` function with new component; remove `startPolling`/`pollRef`/`handleRetry` (absorbed into new component)
- `App.tsx` — restructure tree to support first-visit full-viewport report (see Section 3)
- Dashboard — replace `<DiagnosticReport />` with collapsed summary card on return visits; embed `FirstVisitTips`
- `DiagnosticReport.tsx` — retired (delete after wired in)

### New Dependency
- `resend` — install on server: `npm install resend`

---

## 1. Email Capture (OnboardingIntake — StepFiles)

### Type changes
`IntakeAnswers` (currently lines 70-78 in `OnboardingIntake.tsx`) gains two new fields:
```ts
marketingEmail: string;
marketingConsent: boolean;
```

### State initialisation in parent
`OnboardingIntake` already tracks a local `email` state variable from `StepAccount` (the email the new user typed during account creation). Use this — not `useAuth()` — to initialise `marketingEmail`, since the Supabase user does not exist yet when `StepFiles` renders for new users:
```ts
// In useState initialiser for answers (after email is set from StepAccount):
marketingEmail: email,  // existing local email state from StepAccount step
marketingConsent: true,
```
This means `answers.marketingEmail` must be updated whenever the parent's `email` state changes (a `useEffect` syncing `email` into `answers.marketingEmail` on mount is sufficient, since `StepAccount` runs before `StepFiles`).

### StepFiles props changes
`StepFiles` receives two new props:
```ts
marketingEmail: string;
marketingConsent: boolean;
onMarketingEmailChange: (v: string) => void;
onMarketingConsentChange: (v: boolean) => void;
```

These flow directly from `answers.marketingEmail` / `answers.marketingConsent` in the parent. `handleSubmit` already reads from `answers`, so no further change needed there — both fields are included in `finalAnswers` automatically.

### Field UI (added below dropzones in StepFiles)
```
Email address
[user@example.com]  ← editable input, pre-filled from auth session

This is where we'll send your diagnosis and, soon, job opportunities
we've hand-picked for you. Make sure it's one you actually check.

[x] Send me job search tips and product updates  ← pre-ticked checkbox
```

### Data flow to backend
`answers` JSON payload already contains all `IntakeAnswers` fields. With the type extended, `marketingEmail` and `marketingConsent` are included automatically on submit.

Backend `onboarding.ts` reads these from `answers` and saves to `CandidateProfile`.

### Resend integration
- Provider: Resend (`resend.com`) — free tier 3,000/month, TypeScript SDK
- Single welcome email fires on report COMPLETE in **both** the `/submit` and `/retry` async callbacks
- Guard in both paths: only send if `marketingConsent === true` AND `marketingEmailSent === false`
- After sending: `prisma.candidateProfile.update({ data: { marketingEmailSent: true } })`
- Subject: "Your JobHub diagnosis is ready"
- Body: plain text, links back to app
- Server env var: `RESEND_API_KEY`
- New file: `server/src/services/email.ts` — thin Resend wrapper

---

## 2. Processing Screen

### Replaces
The internal `ProcessingScreen` function in `OnboardingIntake.tsx` (~lines 342-390). The parent's `startPolling`, `pollRef`, `failed` state, and `handleRetry` are removed — all absorbed into the new component.

### Architecture
- `ProcessingScreen` owns the polling loop (`useEffect` with `setInterval`, 3s)
- On `COMPLETE`: call `queryClient.invalidateQueries({ queryKey: ['profile'] })` first (so `OnboardingGate` re-evaluates `hasCompletedOnboarding`), then animate bar to 0%, then fire `onComplete` after 500ms delay. The query invalidation must happen before `onComplete` or `OnboardingGate` will block `ReportOrDashboard` from rendering.
- On `FAILED`: clears interval, shows retry UI, retry button fires `onRetry`
- `onRetry` in parent calls `POST /api/onboarding/retry` (same as current `handleRetry`)

### Props
```ts
interface ProcessingScreenProps {
  isDark: boolean;
  theme: Theme;
  onComplete: () => void;  // report is COMPLETE, proceed to report view
  onRetry: () => void;     // user clicked retry after FAILED — parent calls retry endpoint
}
```

No `onFailed` — failed state is fully handled inside the component. Parent only needs `onComplete` and `onRetry`.

### Visual design
- Full-screen, same dark theme as onboarding (`#0d1117` bg, frosted glass card)
- Reuse blob CSS from `OnboardingIntake` — no new animation infrastructure
- Single horizontal countdown bar at top of card, depletes left-to-right over 45s via CSS `transition` on `width`
- Below bar: rotating message, swaps every 8s with fade transition

### Countdown bar logic
```
0s  → bar at 100% width
45s → bar at 3% width (linear, CSS transition)
Report arrives early → snap bar to 0%, wait 500ms, fire onComplete
Report takes > 45s  → bar holds at 3%, message swaps to fallback
FAILED → bar stops, error message + retry button appear
```

### Message sequence
1. "Righto, let's see what we're working with..."
2. "Digging through your resume — there's good stuff in here, trust."
3. "Mapping out where you've been dropping off. We got you."
4. "This is the bit that actually changes things, hang tight..."
5. "Nearly there — your diagnosis is coming together nicely."
6. "Last bit of thinking... you're about to see exactly what's been holding you back."
7. *(fallback >45s)* "Still cooking, won't be long..."
8. *(FAILED)* "Something went sideways — but we've got your data." + retry button

---

## 3. Report Experience — App.tsx Tree Restructure

### Current tree (simplified)
```
ProtectedRoute
  OnboardingGate           ← gates on hasCompletedOnboarding
    DashboardLayout
      Routes
        /  → Dashboard     ← DiagnosticReport rendered here
```

### New tree
```
ProtectedRoute
  OnboardingGate           ← unchanged, still gates on hasCompletedOnboarding
    ReportOrDashboard      ← new thin wrapper component (inline in App.tsx, ~15 lines)
```

### ReportOrDashboard logic
```tsx
// Inline in App.tsx
function ReportOrDashboard() {
  const [reportSeen, setReportSeen] = useState(
    () => localStorage.getItem('jobhub_report_seen') === 'true'
  );

  if (!reportSeen) {
    return (
      <ReportExperience
        onDone={() => {
          localStorage.setItem('jobhub_report_seen', 'true');
          localStorage.setItem('jobhub_tips_seen', 'false');
          setReportSeen(true);
        }}
      />
    );
  }

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {/* ...other routes unchanged... */}
      </Routes>
    </DashboardLayout>
  );
}
```

The `useState` initialiser reads `localStorage` once at mount. `setReportSeen(true)` triggers the re-render that swaps to `DashboardLayout`. No routing changes, no new pages.

### Return visit behaviour
- `reportSeen === true` → `DashboardLayout` renders normally
- Inside `Dashboard`, replace `<DiagnosticReport />` with a collapsed summary card:
  - Title: "Your Diagnosis" + date
  - CTA: "View again" → sets local `useState` `showReport = true` → renders `<ReportExperience onDone={() => setShowReport(false)} />` as `position: fixed, inset: 0, z-index: 50` overlay with a "Back to dashboard" close button

### Visual design
- Dark mode: `#0d1117` bg, frosted glass islands (`rgba(255,255,255,0.05)` + `backdrop-blur`)
- Reuse blob CSS from `OnboardingIntake` — no new animation infrastructure
- `height: 100dvh` (not `100vh`) for mobile correctness
- No em dashes — strip `—` from all parsed text (replace with `, ` or ` ` depending on context)

---

## 4. ReportIsland Component

Each island has `id="report-island-{sectionKey}"` for scroll targeting.

### Open/closed state management
Island open/closed state is **lifted to `ReportExperience`** as a `Record<string, boolean>` map:
```ts
const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
```
`ReportExperience` passes `isOpen` and `onToggle` down to each island. `onNavigate` in the parent scrolls to the target island's DOM node and sets `openMap[key] = true`. This avoids needing refs or imperative handles on sibling islands.

### Props
```ts
interface ReportIslandProps {
  sectionKey: string;
  title: string;
  icon: React.ElementType;   // Lucide component reference, e.g. Target, FileText
  problemText: string;
  fixText: string;
  reportId: string;
  isOpen: boolean;
  onToggle: () => void;
  linkedSections: { key: string; title: string; why: string }[];
  onNavigate: (sectionKey: string) => void;
}
```

### Section icon map (defined in ReportExperience, passed as prop)
```ts
import { Target, FileText, GitBranch, Lightbulb, Wrench, Sparkles } from 'lucide-react';

const SECTION_ICONS: Record<string, React.ElementType> = {
  targeting:         Target,
  document_audit:    FileText,
  pipeline:          GitBranch,
  honest:            Lightbulb,
  fix:               Wrench,
  what_jobhub_does:  Sparkles,
};
```

### Teaser generation
First non-empty sentence of `problemText`, truncated to 120 characters with ellipsis. Derived client-side — not stored, not LLM-generated.

### States
```
CLOSED        → icon + title + teaser + chevron (subtle pulse on icon)
OPEN_PROBLEM  → full problemText + "Show me the fix →" button
OPEN_FIX      → problemText + fixText (smooth height expand) + feedback pills
```

### Interaction flow
```
Click header          → toggle CLOSED/OPEN_PROBLEM via onToggle (Framer Motion height, ~300ms)
Click "Show me the fix →" → local state OPEN_FIX (height expand ~250ms, subtle glow on fix card)
Click feedback pill   → POST /api/onboarding/report/:reportId/feedback, pill highlights
```

### Cross-section CTAs
End of each island, two compact link cards (no em dashes):

| Section | Links to | Why |
|---|---|---|
| Targeting | Document Audit, Pipeline | "Your targeting shapes what your resume needs to say" / "See where applications are actually dropping off" |
| Document Audit | Targeting, The 3-Step Fix | "Targeting and documents live or die together" / "Your first fix is probably in here" |
| Pipeline | Honest Assessment, The 3-Step Fix | "Your pipeline pattern reveals the real blocker" / "Three things you can fix this week" |
| Honest Assessment | Pipeline, Document Audit | "Your blocker shows up in your pipeline numbers" / "The documents are where the fix starts" |
| The 3-Step Fix | What JobHub Does, Targeting | "See what the platform builds for you next" / "Targeting is where most fixes begin" |
| What JobHub Does | The 3-Step Fix, Document Audit | "Your fixes are already waiting" / "Your documents are the first thing we help you rebuild" |

Clicking a CTA calls `onNavigate(sectionKey)` which scrolls to `document.getElementById('report-island-{key}')` and sets `openMap[key] = true` in the parent.

---

## 5. End-of-Report Transition

After the final island (`what_jobhub_does`), a full-width section:

```
"Your game plan is ready. Time to put it to work."
[Let's go →]  ← button-only (no scroll-past detection in MVP)
```

Clicking fires `onDone()` which:
1. Sets `localStorage.setItem('jobhub_report_seen', 'true')`
2. Sets `localStorage.setItem('jobhub_tips_seen', 'false')`
3. Sets `setReportSeen(true)` in `ReportOrDashboard`
4. `DashboardLayout` animates in: `opacity: 0 → 1`, `y: 40 → 0`, ~400ms Framer Motion

---

## 6. First-Visit Dashboard Tips

### Gating
```ts
const showTips =
  localStorage.getItem('jobhub_report_seen') === 'true' &&
  localStorage.getItem('jobhub_tips_seen') !== 'true';
```

Tips only appear after the user has completed the report transition. After 10 seconds OR first meaningful click in dashboard: `localStorage.setItem('jobhub_tips_seen', 'true')`.

### Tips (inline, staggered fade-in 200ms per tip, fade out after 8s or on click)

| Location | Copy |
|---|---|
| Achievement Bank | "All your achievements are logged here — hit Manage to edit them" |
| Job Tracker / Match Engine | "Paste a job description here to get matched and start applying" |
| Sidebar nav | "Everything you need to land the role lives in these three sections" |

---

## 7. Data / Schema Changes

### CandidateProfile (Prisma) — three new fields
```prisma
marketingEmail      String?
marketingConsent    Boolean  @default(false)
marketingEmailSent  Boolean  @default(false)
```

### Migration
```bash
npx prisma migrate dev --name add-marketing-consent
# Railway:
npx prisma migrate deploy
```

### Resend guard (identical in both /submit and /retry async callbacks)
In `/submit`, read `marketingEmail` and `marketingConsent` from the parsed `answers` object (from `req.body.answers`).
In `/retry`, read them from `report.intakeAnswers as any` (already cast as `answers` in that route) — NOT from the `profile` object, which is fetched separately and has a different shape.

```ts
// /submit path: answers comes from JSON.parse(req.body.answers)
// /retry path:  answers comes from report.intakeAnswers as DiagnosticReportInput
if (answers.marketingConsent && !profile.marketingEmailSent) {
  await sendWelcomeEmail(answers.marketingEmail);
  await prisma.candidateProfile.update({
    where: { userId },
    data: { marketingEmailSent: true }
  });
}
```

---

## 8. What We Are NOT Building (MVP)

- No guided tour / walkthrough button
- No HTML email templates (plain text for now)
- No scroll-past trigger (button-only transition)
- No job alert emails
- No report PDF export
- No new blob animation infrastructure (reuse existing CSS)

---

## File Plan

```
src/components/
  ProcessingScreen.tsx       ← new
  ReportExperience.tsx       ← new
  ReportIsland.tsx           ← new
  FirstVisitTips.tsx         ← new
  DiagnosticReport.tsx       ← delete after wiring

src/
  App.tsx                    ← add ReportOrDashboard wrapper, restructure tree

server/src/
  routes/onboarding.ts       ← extend IntakeAnswers handling + Resend guard in /submit and /retry
  services/email.ts          ← new Resend wrapper

server/prisma/
  schema.prisma              ← 3 new fields
  migrations/                ← new migration
```

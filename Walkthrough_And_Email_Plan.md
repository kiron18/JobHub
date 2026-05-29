# JobHub — Email Templates Refactor + In-Product Walkthrough Plan

**Audience:** DeepSeek (executing agent).
**Author:** Architecture handoff from the planning session.
**Status:** Ready to execute. Build in the order below.

---

## 0. Why this exists

Two coupled problems were identified in QA:

1. **Email templates have drifted.** The Application Tracker has its own copy of the follow-up email (`JobCard.tsx:38-51 buildFollowUpEmail`) that does not match the canonical version in the Email Templates Library (`EmailTemplatesLibrary.tsx:36-53 application-followup`). The "Thank-you email" button in the tracker calls the wrong backend endpoint (`/generate/followup-email`) — users clicking "Thank-you" today receive a follow-up-after-silence email by mistake.
2. **Feature discoverability is poor.** Quantitative + qualitative signal shows users are not finding the tracker, the follow-up nudge, the thank-you template, the LinkedIn outreach templates, or the email templates library. JobHub's ICP — Australian migrants — is also culturally unfamiliar with the local norm of sending thank-you emails after interviews, which is one of the highest-leverage moves in the Australian recruiting funnel.

The fix is two-part: **(A) consolidate email templates** to one canonical source with job-context substitution, and **(B) build an in-product walkthrough** that guides every new user through every feature in a value-first, action-based way — so the user isn't *taught* the product, they *use* it to ship their first real application.

---

## 1. Guiding principles (read before writing any code)

These constrain every design choice below.

1. **Calm ally voice.** Never aggressive, never salesy. Tone should feel like a doctor reading a scan: warm, specific, on the user's side. No exclamation marks in walkthrough copy. No "Click here!" / "Don't miss out!".
2. **Value-first, not feature-tour.** Each walkthrough step delivers a *win*, not a tour stop. The user walks away with a tailored CV in their tracker, not a memory of "where the menu is."
3. **Action-based completion.** Steps complete because the user *did the thing*, not because they clicked "Next." If a step says "paste a job," it completes when a job appears in the tracker — not when a tooltip is dismissed.
4. **Skippable but resumable.** Every step has a "skip for now" affordance. The walkthrough panel is collapsible to a small pill. Nothing is mandatory. But once skipped, the user can resume from the pill.
5. **Frictionless.** Tooltips never block input. The panel never covers the content the user is meant to interact with. Modal sequences are forbidden.
6. **Single source of truth.** Email templates live in one place: `src/lib/emailTemplates.ts`. The walkthrough step config lives in one place: `src/lib/walkthrough/steps.ts`. Every other file imports from these.
7. **No new dependencies** unless explicitly approved. Use Framer Motion (already installed), React Context, and localStorage. Do not add Floating UI, Reactour, Intro.js, Shepherd, or similar.

---

## 2. PART A — Email Templates Refactor

### 2.1 Scope decisions (locked)

- **Follow-up email**: static template with deterministic substitution. **No** AI refinement step. The user's actual feedback: *"why add an additional step of refine with AI"* — drop it.
- **Thank-you email**: static template only for now. AI personalisation is out of scope (current backend doesn't have the prompt for it and we don't capture interview notes). Ship the static template + cultural-context messaging that tells the user *why* the thank-you matters.
- **Substitution scope**: auto-fill everything deterministic from the job record + user profile. Leave only human-judgment placeholders for the user to fill.

| Field | Source | Behaviour |
|---|---|---|
| `[Job Title]` | `job.title` | Auto-fill |
| `[Company]` | `job.company` | Auto-fill |
| `[date]` (applied date) | `job.dateApplied` formatted as `D MMM YYYY` | Auto-fill |
| `[Your Name]` | `profile.name` | Auto-fill (if present, else leave placeholder) |
| `[Phone]` | `profile.phone` | Auto-fill (if present) |
| `[Email]` | `profile.email` | Auto-fill (if present) |
| `[Hiring Manager Name]` | — | Leave placeholder |
| `[Interviewer Name]` | — | Leave placeholder |
| `[specific reason — e.g., …]` | — | Leave placeholder with hint intact |
| `[specific topic discussed — e.g., …]` | — | Leave placeholder with hint intact |
| `[specific detail]` | — | Leave placeholder |
| `[brief relevant example]` | — | Leave placeholder |
| `[team/project goal]` | — | Leave placeholder |

### 2.2 Files to create

#### `src/lib/emailTemplates.ts` (NEW)

Canonical email template module. Exports:

```ts
import type { JobApplication } from '../components/tracker/types';

export type EmailTemplateId =
  | 'application-followup'
  | 'interview-thankyou'
  // (future: other tracker-relevant template ids from EmailTemplatesLibrary)
  ;

export interface UserProfileLite {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface RenderedEmail {
  subject: string;
  body: string;
  /** Full text including "Subject: ..." prefix, for one-click copy. */
  full: string;
}

/**
 * Render a canonical email template with job + user context substituted.
 * Placeholders that require human judgment are left intact.
 */
export function renderTemplate(
  id: EmailTemplateId,
  job: JobApplication,
  profile?: UserProfileLite,
): RenderedEmail;

/** Return the unrendered (placeholders-only) template — used by EmailTemplatesLibrary. */
export function getRawTemplate(id: EmailTemplateId): { subject: string; body: string };
```

**Template bodies** are the verbatim text from `EmailTemplatesLibrary.tsx:36-72` (the `application-followup` and `interview-thankyou` entries). Copy them across exactly. Then have `EmailTemplatesLibrary.tsx` import from this module so there is only one source.

Substitution logic:
- Replace `[Job Title]` (and `[Job Title]` inside subject) with `job.title`.
- Replace `[Company]` with `job.company`.
- Replace `[date]` with a friendly format of `job.dateApplied` (e.g., `12 May 2026`). Use `new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(...)`.
- Replace `[Your Name]`, `[Phone]`, `[Email]` from `profile` if values are present and non-empty. Otherwise leave the placeholder.
- All other placeholders untouched.

Substitution must be a simple string replace; do not introduce a template engine.

### 2.3 Files to modify

#### `src/components/EmailTemplatesLibrary.tsx`

- Remove the inline `TEMPLATES` array bodies for `application-followup` and `interview-thankyou`.
- Import them from `src/lib/emailTemplates.ts` via `getRawTemplate`.
- All other templates (LinkedIn, networking, offer, etc.) stay where they are for now.

#### `src/components/tracker/JobCard.tsx`

**Follow-up email path (around line 38, 346, 363, 421):**

- Delete the local `buildFollowUpEmail(job)` function.
- Replace with `renderTemplate('application-followup', job, profile).full` (you'll need to thread the user's profile down — get it from `useQuery(['profile'])` at the top of `JobCard` or pass it as a prop from `ApplicationTracker`).
- Delete the **"Generate AI version"** button entirely (`JobCard.tsx:467-483` — the `handleGenerateAI` button). Also delete `handleGenerateAI`, `aiEmails` state, `generatingFor` state, and the `api.post('/generate/followup-email', …)` call. Per locked decision: no AI refinement step.
- The expanded follow-up area now always shows the static rendered template. The single action is "Copy". Update copy button label to just "Copy" and remove the "AI-personalised" toast variant — toast message is always `'Copied to clipboard'`.

**Thank-you email path (around line 558, 580-596, 994-1053):**

- Delete `thankYouEmail` state, `generatingEmail` state, `handleGenerateThankYou`, and the `/generate/followup-email` call that was incorrectly being used here.
- Replace the entire INTERVIEW-status block (`JobCard.tsx:994-1053`) with a static disclosure that renders `renderTemplate('interview-thankyou', job, profile).full`.
- Default state: collapsed; click row to expand and view; copy button copies the rendered template.
- Add a **cultural context note** *above* the template body inside the expanded block (see copy in §2.5).

### 2.4 New component: `<ThankYouNudge />`

Mirror the existing `FollowUpNudge` pattern (`JobCard.tsx:330`).

**Location:** export from `src/components/tracker/JobCard.tsx` alongside `FollowUpNudge`.

**Trigger condition:** any job with `status === 'INTERVIEW'`.

**Placement in tracker:** `ApplicationTracker.tsx`, render `<ThankYouNudge jobs={jobs} />` immediately *below* `<FollowUpNudge jobs={jobs} />` (line 202).

**Visual treatment:** identical structure to `FollowUpNudge` (gold accent, `Bell` icon, collapsible rows per job, copy button). Use the same color tokens.

**Eyebrow copy:**
> **THANK-YOU DUE**
> Interview scheduled or just had one? Australian recruiters expect a thank-you note within 24 hours. Click any job to copy your template.

### 2.5 Cultural context copy (inside the expanded thank-you block)

Place this *above* the template body, styled as an italic note in `textMuted`:

> *Why this matters:* In Australia, sending a thank-you email within 24 hours of an interview is the standard. Recruiters notice when it's missing — it's one of the lowest-effort moves with the highest signal. Most people from outside Australia don't know it's expected.

Style: 12px font, italic, muted color, 16px margin-bottom, no border.

### 2.6 Backend cleanup (optional, not blocking)

The `/generate/followup-email` endpoint is no longer called by the frontend after this work. Leave the route in place for now — flag for removal in a follow-up cleanup PR. Do not delete in this work.

### 2.7 Acceptance criteria for Part A

- [ ] `npm run build` succeeds with no TypeScript errors.
- [ ] In the tracker, an APPLIED job 7+ days old surfaces `FollowUpNudge`, which when expanded shows the canonical Library `application-followup` template with `[Job Title]`, `[Company]`, `[date]`, `[Your Name]`, `[Phone]`, `[Email]` substituted. Other placeholders (`[Hiring Manager Name]`, `[specific reason]`) remain intact.
- [ ] A job in INTERVIEW status surfaces `<ThankYouNudge />` at the top of the tracker, identical visual treatment to FollowUpNudge.
- [ ] The expanded thank-you template shows the cultural context note above the body.
- [ ] No button in the tracker calls `/generate/followup-email` anymore.
- [ ] The Email Templates Library page still renders `application-followup` and `interview-thankyou` with their original placeholder-only bodies.

---

## 3. PART B — In-Product Walkthrough System

### 3.1 Design philosophy (read before any walkthrough work)

We are NOT building a traditional "feature tour." We are building a **value-first, action-based onboarding workflow** that uses the walkthrough as a vehicle to get the user to their first real win.

**Research baseline — what we are deliberately copying / not copying:**

| Pattern | Source | Verdict |
|---|---|---|
| Mandatory modal sequence ("Welcome! Click next to continue…") | Old Intro.js / Reactour | **Avoid.** High bounce. Feels like a EULA. |
| Persistent right-rail checklist + inline tooltips | Linear's "Inbox tour", Notion's "Getting started" | **Adopt.** Always visible, never blocking. |
| Action-based step completion (step closes when user does the thing) | Stripe Dashboard onboarding, Pitch | **Adopt.** Steps complete because of behaviour, not clicks. |
| Empty-state coaching (the empty state IS the tutorial) | Cron, Linear, Notion's empty workspace | **Adopt.** Where there's no data, the empty state guides. |
| Forced keyboard-shortcut walkthrough | Superhuman | **Avoid for v1.** Too heavy for our ICP (job seekers under stress). |
| Gamified mandatory mini-quizzes | Duolingo | **Avoid.** Wrong context. |
| Floating chat-bot ("Hi! I'm Maya, your assistant") | Intercom default | **Avoid.** Cringe, slows page. |
| Hover-discovery tooltips that reveal on `?` press | Linear, Figma | **Adopt as v2.** Out of scope for first pass. |

**Net pattern for v1:** Collapsible right-side panel acts as the master tutorial UI. Inline tooltips appear contextually at action points. Completion is action-based. Skip / dismiss is always available. Everything persists in localStorage.

### 3.2 Architecture overview

```
┌────────────────────────────────────────────────────────────────────┐
│ WalkthroughProvider (React Context)                                │
│  - currentStepId, completedStepIds, isPanelOpen, isDismissedForever│
│  - reads/writes localStorage `jobhub_walkthrough_state`            │
│  - exposes actions: completeStep(id), skipStep(id), nextStep(),    │
│    openPanel(), collapsePanel(), dismissForever(), reset()         │
└────────────────────────────────────────────────────────────────────┘
              │
              ├──> <WalkthroughPanel />          (right-side persistent UI)
              ├──> <WalkthroughTooltip />        (contextual, anchored to elements)
              ├──> <WalkthroughResumePill />     (floating bottom-right when panel collapsed)
              └──> useWalkthroughTrigger(eventName)
                       │
                       └─── fired by feature code to advance steps
```

**State schema (localStorage key `jobhub_walkthrough_state`):**

```ts
interface WalkthroughState {
  version: 1;
  startedAt: string;            // ISO timestamp
  completedStepIds: string[];   // ordered by completion time
  skippedStepIds: string[];
  panelOpen: boolean;
  dismissedForever: boolean;
  lastSeenStepId: string | null;
}
```

If the schema version ever bumps, treat any older schema as "needs reset" and discard.

### 3.3 Step definitions

Steps live in `src/lib/walkthrough/steps.ts` as a single ordered array. Each step is self-describing.

```ts
export interface WalkthroughStep {
  /** Stable unique id. Used in localStorage and analytics. Never rename. */
  id: string;
  /** Short label for the checklist in the panel. */
  label: string;
  /** One-sentence description shown when this step is active in the panel. */
  panelDescription: string;
  /** Copy shown in the inline tooltip when active. */
  tooltipTitle: string;
  tooltipBody: string;
  /** CSS selector (data-walkthrough-id attribute) the tooltip anchors to.
   *  If null, no tooltip — panel-only step. */
  targetSelector: string | null;
  /** Position of the tooltip relative to the target. */
  placement: 'top' | 'bottom' | 'left' | 'right';
  /** Event name fired by feature code to mark this step complete. */
  completionEvent: string | null;
  /** Optional: condition checked on render to auto-complete. */
  autoCompleteIf?: (ctx: WalkthroughContextSnapshot) => boolean;
  /** Optional: route the panel should be active on. If user navigates away,
   *  the tooltip hides but the step remains active. */
  activeOnRoute?: string | RegExp;
}
```

The full step config follows in §3.4.

### 3.4 The actual steps (build in this order)

> **For each step below:** add a `data-walkthrough-id="<step-id>"` attribute on the target DOM element in the corresponding feature file. The tooltip component will use this attribute to anchor.

#### Step 1 — `diagnostic-complete`
- **Trigger:** auto-completes when user lands on `/` (StrategyHub) for the first time after onboarding.
- **Panel label:** Your diagnostic is in your library
- **Panel description:** Everything we identified is already fixed in your documents. Let's get them out into the world.
- **Tooltip:** none (panel-only).
- **Target:** none.
- **Completion event:** auto via `autoCompleteIf: ctx => ctx.route === '/' && ctx.profile?.hasCompletedOnboarding`.

#### Step 2 — `paste-first-job`
- **Trigger:** active when on the dashboard.
- **Panel label:** Paste your first job
- **Panel description:** Find a job you actually want. Copy the listing, paste it below, and we'll write your CV, cover letter, and selection criteria.
- **Tooltip title:** Paste a job listing here
- **Tooltip body:** Find a job on Seek, LinkedIn, or Indeed. Copy the listing (Ctrl+A then Ctrl+C). Paste here. We'll do the rest.
- **Target:** the job paste input on StrategyHub. Add `data-walkthrough-id="paste-first-job"` to that input element.
- **Placement:** `bottom`.
- **Completion event:** `walkthrough:pasted-first-job` — fired from the paste handler when the input becomes non-empty AND the user clicks "Generate" (or whatever the existing CTA is).

#### Step 3 — `see-tracker`
- **Trigger:** activates after Step 2 completes.
- **Panel label:** Meet your ATS
- **Panel description:** Every job you apply to lives here. Your tailored CV, cover letter, and follow-ups are all attached.
- **Tooltip title:** This is your ATS
- **Tooltip body:** The friendly kind. Click your job to see the documents we just built for you.
- **Target:** the first `<JobCard />` in the tracker list. Add `data-walkthrough-id="see-tracker"` to the outermost `<JobCard>` wrapper div.
- **Placement:** `top`.
- **Completion event:** auto-completes when the user navigates to `/tracker` AND the tracker has ≥ 1 job.

#### Step 4 — `open-job-card`
- **Trigger:** after Step 3.
- **Panel label:** See what we wrote for you
- **Panel description:** Open the job to see the tailored CV, cover letter, and selection-criteria responses.
- **Tooltip title:** Open your application
- **Tooltip body:** Click the job to expand it. Your documents are inside, ready to copy.
- **Target:** the same first `<JobCard />` (already tagged).
- **Placement:** `right` (so it doesn't cover the card itself).
- **Completion event:** `walkthrough:opened-job-card` — fired by `JobCard.tsx` when `setExpanded(true)` is called.

#### Step 5 — `follow-up-awareness`
- **Trigger:** after Step 4.
- **Panel label:** Follow-ups are automatic
- **Panel description:** In 7 days, a follow-up email will appear at the top of your tracker. Recruiters expect it. Most people forget.
- **Tooltip title:** Follow-ups land here in 7 days
- **Tooltip body:** Australian recruiters expect a follow-up after a week of silence. We'll surface it at the top of the tracker automatically.
- **Target:** the area where `<FollowUpNudge />` would render — add `data-walkthrough-id="follow-up-area"` to the wrapping div in `ApplicationTracker.tsx` (line 202 region). If the user has no overdue follow-up yet, the tooltip anchors to that empty area.
- **Placement:** `bottom`.
- **Completion event:** auto-completes after 8 seconds of tooltip visibility, OR on dismiss.

#### Step 6 — `thank-you-awareness`
- **Trigger:** after Step 5.
- **Panel label:** Thank-yous matter in Australia
- **Panel description:** When you mark a job as INTERVIEW, a thank-you template appears at the top of the tracker. Australian recruiters expect a thank-you within 24 hours — it's one of the highest-leverage moves most international candidates miss.
- **Tooltip title:** This one is a sleeper.
- **Tooltip body:** When you have an interview, mark the job as INTERVIEW. We'll surface a thank-you template here. In Australia, sending one within 24 hours is the norm — and the candidates who skip it lose ground they didn't know they were losing.
- **Target:** `data-walkthrough-id="thank-you-area"` on the `<ThankYouNudge />` wrapper.
- **Placement:** `bottom`.
- **Completion event:** auto-completes after 12 seconds OR on dismiss. Longer dwell because of the cultural-context payload.

#### Step 7 — `linkedin-outreach`
- **Trigger:** after Step 6.
- **Panel label:** Networking gets you most jobs
- **Panel description:** Around 70% of Australian roles are filled via networking, not job boards. Our LinkedIn templates are built for that — relationship-first, ask-last.
- **Tooltip title:** This is where the real game happens
- **Tooltip body:** Job boards are 30% of the funnel. The other 70% is networking. Our LinkedIn outreach templates walk you through the relationship-build, week by week.
- **Target:** the nav link to `/linkedin` in `DashboardLayout.tsx`. Add `data-walkthrough-id="linkedin-nav"`.
- **Placement:** `right`.
- **Completion event:** `walkthrough:opened-linkedin` — fired when the user navigates to `/linkedin`.

#### Step 8 — `email-templates`
- **Trigger:** after Step 7.
- **Panel label:** Every email you'll ever need
- **Panel description:** Application follow-ups, post-interview thank-yous, salary negotiations, offer acceptances. All written, all proven, all in your library.
- **Tooltip title:** Your email arsenal
- **Tooltip body:** Nine battle-tested templates for every stage. Copy, personalise, send.
- **Target:** the nav link to `/email-templates`. Add `data-walkthrough-id="email-templates-nav"`.
- **Placement:** `right`.
- **Completion event:** `walkthrough:opened-email-templates`.

#### Step 9 — `mindset-strategy`
- **Trigger:** after Step 8.
- **Panel label:** When you're stuck
- **Panel description:** The job search punishes consistency exactly when consistency matters most. When you're tired, come here. We've got you.
- **Tooltip title:** The hardest part isn't the work, it's the weight.
- **Tooltip body:** When you need to remember why, this is where you come.
- **Target:** the nav link to `/mindset`. Add `data-walkthrough-id="mindset-nav"`.
- **Placement:** `right`.
- **Completion event:** `walkthrough:opened-mindset`.

#### Step 10 — `tour-complete`
- **Trigger:** after Step 9.
- **Panel label:** You're set.
- **Panel description:** Everything you need is in your sidebar. Send your first application. We'll catch you on the other side.
- **Tooltip:** none.
- **Target:** none.
- **Completion event:** explicit "Finish" button in the panel. On click → set `dismissedForever = true`.

### 3.5 Components to build

All inside `src/components/walkthrough/`.

#### `WalkthroughProvider.tsx`
- React Context provider wrapping the app (mount inside `App.tsx`, just under `AuthProvider`).
- Hydrates `WalkthroughState` from localStorage on mount.
- Persists every state change.
- Exposes a `useWalkthrough()` hook returning state + actions.
- Listens for window CustomEvents matching `completionEvent` strings (e.g., `walkthrough:opened-job-card`) and advances the corresponding step.

#### `WalkthroughPanel.tsx`
- Fixed right-edge panel, 320px wide, full viewport height, slides in from the right with Framer Motion.
- z-index 60 (below modal but above content).
- Header: "Your first application" + subtle close (collapses, doesn't dismiss forever) + a kebab menu with "Don't show again" (dismisses forever).
- Body: scrollable checklist of all steps, current one expanded with `panelDescription` + "Show me" button (if there's a tooltip, jumps focus to it; if not, just continues).
- Footer: progress bar `X of 10 complete`.
- Style: matches `warmTokens`. Background `bgSurface`, 1px border `borderWhisper`, soft shadow.
- Empty state: when `dismissedForever`, never renders.
- Collapsed state: renders nothing; `WalkthroughResumePill` shows instead.

#### `WalkthroughResumePill.tsx`
- Tiny floating pill, bottom-right, 16px from edges, z-index 60.
- Shows `Resume tour · X / 10` with the existing gold accent on the X/10 count.
- Click → expands the panel.
- Hides when `dismissedForever === true` OR `panelOpen === true`.

#### `WalkthroughTooltip.tsx`
- Renders a single contextual tooltip for the *current active step*.
- Uses `document.querySelector('[data-walkthrough-id="<id>"]')` to find the anchor.
- Position with `getBoundingClientRect()` + viewport edge collision (you've already built this for the math tooltip — reuse the same positioning logic; do not add a positioning library).
- Animation: fade + 8px slide-in from the placement direction, Framer Motion, 180ms.
- Inside: `tooltipTitle` (Fraunces, 16px, bold) + `tooltipBody` (Geist, 14px) + "Got it" button (advances/skips this specific step) + a soft "Skip tour" link.
- z-index 70 (above panel, below modals).
- Cleanup: re-checks anchor on window resize and on scroll (`requestAnimationFrame`-throttled).

#### Helper: `useWalkthroughTrigger.ts`
- Small hook: `useWalkthroughTrigger(eventName: string)` returns a `fire()` function that dispatches `window.dispatchEvent(new CustomEvent(eventName))`.
- Used by feature code to mark steps complete without coupling to the walkthrough internals.

### 3.6 Feature-file integrations

Tag each anchor element with `data-walkthrough-id`. These are the *only* changes to feature files — do not add walkthrough logic inside them.

| File | Element | `data-walkthrough-id` |
|---|---|---|
| `src/pages/StrategyHub.tsx` | The job-paste input/textarea | `paste-first-job` |
| `src/components/tracker/JobCard.tsx` | Outer wrapper of each card | `see-tracker` (only on first card via index check, OR put on the tracker list container — pick whichever is simplest) |
| `src/components/ApplicationTracker.tsx` | The FollowUpNudge wrapper area | `follow-up-area` |
| `src/components/ApplicationTracker.tsx` | The ThankYouNudge wrapper area | `thank-you-area` |
| `src/layouts/DashboardLayout.tsx` | LinkedIn nav item | `linkedin-nav` |
| `src/layouts/DashboardLayout.tsx` | Email Templates nav item | `email-templates-nav` |
| `src/layouts/DashboardLayout.tsx` | Mindset nav item | `mindset-nav` |

**Event firings to add:**

| File | Where | Event |
|---|---|---|
| `StrategyHub.tsx` | After successful paste-and-generate | `walkthrough:pasted-first-job` |
| `JobCard.tsx` | When `setExpanded(true)` is called | `walkthrough:opened-job-card` |
| `LinkedInPage.tsx` | In a `useEffect(() => fire(), [])` on mount | `walkthrough:opened-linkedin` |
| `EmailTemplatesLibrary.tsx` | Same | `walkthrough:opened-email-templates` |
| `MindsetPage.tsx` | Same | `walkthrough:opened-mindset` |

Each event-firing site uses `useWalkthroughTrigger('walkthrough:event-name')` and calls `fire()` at the appropriate moment.

### 3.7 Visual / motion spec

- Panel: warm card style, paper grain via the existing SVG noise filter, 24px padding, 16px border-radius.
- Step item in checklist: 12px gap, completed steps show a subtle gold tick + 60% opacity. Active step: gold left-border, full opacity, expanded description.
- Tooltip: 280px wide, white background, 1px `borderDefined` border, 4px border-radius, soft shadow (`0 12px 32px -8px rgba(26,24,20,0.18)`).
- Pill: 36px tall, gold left-dot indicator, `bgSurface` background, sentence-case label.
- Reduced-motion: respect `prefers-reduced-motion: reduce` — disable slide animations, keep fades only.

### 3.8 Accessibility

- All tooltips include `role="dialog"` + `aria-labelledby` pointing to the title.
- Panel: keyboard accessible. `Esc` collapses (not dismisses). Tab order: header → checklist → footer.
- Tooltip "Got it" button: keyboard-focusable; closes on Enter or Space.
- Screen readers should receive a polite live-region announcement when the active step changes (`<div aria-live="polite">`).

### 3.9 Analytics

Add to `src/lib/analytics.ts`:

```ts
export function trackWalkthroughStepEntered(stepId: string) { /* posthog.capture */ }
export function trackWalkthroughStepCompleted(stepId: string, source: 'event' | 'auto' | 'skip') {}
export function trackWalkthroughDismissed(atStepId: string, kind: 'collapse' | 'forever') {}
export function trackWalkthroughCompleted() {}
```

The Provider fires `trackWalkthroughStepEntered` whenever `currentStepId` changes. Each completion goes through `trackWalkthroughStepCompleted` with the appropriate `source`. The pill click fires `posthog.capture('walkthrough_resumed', { step: currentStepId })`.

### 3.10 Reset / debugging

Add `window.jobhub.resetWalkthrough()` in dev mode (gated by `import.meta.env.DEV`). Clears localStorage + reloads. Useful for QA.

### 3.11 Acceptance criteria for Part B

- [ ] On first dashboard visit after diagnostic, the WalkthroughPanel slides in from the right.
- [ ] Step 1 auto-completes on render.
- [ ] Pasting a job + generating advances to Step 3.
- [ ] Navigating to tracker shows the "see-tracker" tooltip anchored to the first card.
- [ ] Expanding a job card advances to Step 5.
- [ ] Each nav-link tooltip appears when its step is active and the user is on the dashboard.
- [ ] Clicking the nav link fires the completion event and advances the step.
- [ ] User can collapse the panel via the close button — pill appears bottom-right.
- [ ] Clicking the pill re-opens the panel.
- [ ] Kebab menu → "Don't show again" hides everything; localStorage persists `dismissedForever: true`.
- [ ] `prefers-reduced-motion: reduce` disables slide animations.
- [ ] Every step transition fires `trackWalkthroughStepEntered` in PostHog.
- [ ] `window.jobhub.resetWalkthrough()` works in dev.
- [ ] No new npm dependencies.
- [ ] TypeScript compiles clean.

---

## 4. Build order

Phases run sequentially. Each phase must pass its acceptance criteria before the next begins.

### Phase 1 — Email templates refactor (Part A)
**Estimated: 2–3 hours.**

1. Create `src/lib/emailTemplates.ts` with `renderTemplate` and `getRawTemplate`.
2. Update `EmailTemplatesLibrary.tsx` to import from the new module.
3. Update `JobCard.tsx` — replace `buildFollowUpEmail`, delete AI follow-up button + state.
4. Update `JobCard.tsx` — replace thank-you AI flow with static rendering + cultural context note.
5. Add `<ThankYouNudge />` component, mount in `ApplicationTracker.tsx`.
6. Manual QA: APPLIED 7+ days → follow-up shows correctly; INTERVIEW → thank-you nudge appears with correct copy.

### Phase 2 — Walkthrough core (Provider + Panel + Pill + Tooltip)
**Estimated: 4–6 hours.**

1. Create `WalkthroughContext` + `WalkthroughProvider`. Wire up localStorage hydration + persistence.
2. Build `WalkthroughPanel` with the static layout (no live data yet — hard-code "Step 2 of 10" while testing).
3. Build `WalkthroughResumePill`.
4. Build `WalkthroughTooltip` with positioning + edge collision.
5. Build `useWalkthroughTrigger` hook.
6. Mount `<WalkthroughProvider>` and `<WalkthroughPanel>` in `App.tsx`.

### Phase 3 — Step config + feature integration
**Estimated: 3–4 hours.**

1. Create `src/lib/walkthrough/steps.ts` with all 10 step definitions.
2. Add `data-walkthrough-id` attributes to all feature files in §3.6.
3. Add event-firing calls in the feature files per §3.6.
4. Run through the full walkthrough end-to-end manually.

### Phase 4 — Analytics + polish
**Estimated: 1–2 hours.**

1. Add walkthrough events to `src/lib/analytics.ts`.
2. Wire `trackWalkthroughStepEntered` etc. inside the Provider.
3. Add reduced-motion handling.
4. Add `window.jobhub.resetWalkthrough()` debug hook.

### Phase 5 — QA pass
**Estimated: 1 hour.**

1. Verify every acceptance criterion in §2.7 and §3.11.
2. Test on mobile viewport (panel becomes bottom-sheet or hides — confirm v1 behaviour: hides on `< 768px`, only the pill shows).
3. Test "dismiss forever" → reload → confirms nothing shows.
4. Test `window.jobhub.resetWalkthrough()` in dev.

---

## 5. What NOT to build

These are deliberately out of scope for this work. Do not pre-empt them.

- AI personalisation for the thank-you template (requires backend prompt + interview-notes capture — separate work).
- AI refinement of follow-up emails (explicitly dropped per locked decision).
- Mobile-optimised walkthrough panel (v1 hides panel on mobile, only the pill shows).
- Multi-user / cross-device sync of walkthrough state (localStorage only for v1).
- Tooltip hover-discovery layer for power users (v2 candidate).
- Replay-walkthrough-from-settings UI (v2 — for now, only the dev hook).
- Renaming the user-facing tracker label to "ATS" anywhere — that's a separate marketing-copy call.

---

## 6. Open questions for the user (flag back if any are unclear)

None at this point. All decisions in §2.1 and §3.1 are locked from the planning session. If anything in this document is ambiguous to DeepSeek during execution, pause and ask before writing code rather than guessing.

---

## 7. Done definition

This work is "done" when:

1. A new user landing on `/` for the first time after onboarding sees the walkthrough panel.
2. They can complete the entire 10-step walkthrough using only in-product actions (no docs needed).
3. By Step 4 they have a real job in their tracker with tailored documents.
4. By Step 10 they have visited every major feature.
5. Their localStorage shows `dismissedForever: true` after they click Finish.
6. The follow-up and thank-you templates in the tracker match the Library bytes-for-bytes after substitution.
7. PostHog shows step-by-step funnel data for every walkthrough event.

Ship that, and the qualitative feedback gap — *"users don't know features exist"* — should close.

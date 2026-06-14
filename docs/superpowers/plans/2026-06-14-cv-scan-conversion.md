# CV Scan Conversion Rebuild Implementation Plan

> **For DeepSeek (executing agent):** ZERO-LATITUDE plan. Do EXACTLY what each task says. Every string inside quotes in this plan is FINAL COPY authored by the product owner: transcribe it VERBATIM, character for character, including capitalisation and the deliberate absence of em dashes and en dashes. Do NOT reword, "improve", or add copy of your own. Do NOT touch files or behaviour not named here. If the live code does not match what a task describes, STOP and report what you actually found rather than guessing or forcing the edit.
>
> **Absolute copy rules (apply to every string you write):** No em dashes (—). No en dashes (–). Use a comma, full stop, colon, or the word "and". Australian English. No exclamation marks. These are conversion-tuned lines, not decoration.

**Goal:** Rebuild the CV scan reveal so it converts uploads into email leads and then app signups. The scan gives the diagnosis away free and brutally, then gates the cure (the fixes) behind email, then bridges to the app (the visa-sponsor job search) behind signup.

**The conversion arc (the spine of every change):** wound, then stakes, then the wall, then (after email) relief and the fixes, then the bridge to the app. Each gate asks only for what the user has just been given a reason to give.

**What is FREE (before email):** the diagnosis. The headline verdict, the specific gap items, and the insider layer (the hiring manager view and the cultural translations). This is the part that proves the tool sees them.

**What is GATED behind email:** the cure. The quick wins (fixes), the reassurance line, and the roadmap.

**What is GATED behind signup:** the app doing it for them, plus the visa-sponsor job feed.

**Tech stack:** React + TypeScript + Framer Motion (frontend), Express + Claude via OpenRouter (backend). The live reveal component is `ScanReveal` inside `src/pages/MockLandingPage.tsx`.

---

## Orientation (read before you touch anything)

- The live reveal is the `ScanReveal` component, rendered at `src/pages/MockLandingPage.tsx` around line 409.
- There is a large `SHOW_LEGACY_REVEAL` block in the same file (the constant is `false`). It is DEAD CODE. Do not use it as your source of truth and do not edit it. Read and edit only the live `ScanReveal` component.
- `ScanReveal` drives the reveal with a `revealStep` state machine: `'gaps' | 'wins' | 'big_reveal' | 'email'`. It currently shows the quick wins FREE during the `'wins'` step. The core of this plan is moving the quick wins, reassurance, and roadmap to AFTER the email is submitted (when `roadmap` is truthy), and leading the free section with the verdict instead of the score.
- The backend already returns everything you need on the scan response (`buildScanResponse` in `server/src/routes/cv-scan.ts`): `score`, `firstName`, `inferredRole`, `items`, `quickWins`, `firstImpression`, `reassurance`, `hiringManager`, `culturalTranslations`, `lockedGapCount`. Do not change the backend response shape.
- The email submit calls `POST /cv-scan/lead` and sets `roadmap`. Keep that. The "claim / set up the app" flow is the existing `GetStartedModal` plus the `/cv-scan/claim` route. Do not rebuild those; you only add the bridge copy and CTA that opens `GetStartedModal`.

- [ ] **Step 0: Read `src/pages/MockLandingPage.tsx` in full, locate the live `ScanReveal` component, and confirm the `revealStep` states and where `quickWins`, `firstImpression`, `reassurance`, `hiringManager`, `culturalTranslations`, the score ring, and the email input render. If `ScanReveal` does not exist or its structure differs materially from the description above, STOP and report what you found before making any change.**

---

## Task 1: Create the locked copy file

All static scan copy lives in one Claude-authored file so it is never reworded inline.

**Files:**
- Create: `src/pages/cvScanCopy.ts`

- [ ] **Step 1.1: Create `src/pages/cvScanCopy.ts` with exactly this content:**

```ts
// =============================================================================
// cvScanCopy — locked, product-owner-authored copy for the CV scan reveal.
// Do not reword inline. No em or en dashes anywhere. Australian English.
// =============================================================================

export const cvScanCopy = {
  // Free section — the diagnosis.
  woundKicker: (firstName?: string) =>
    firstName ? `${firstName}, here is what a recruiter sees first` : 'Here is what a recruiter sees first',
  diagnosisHeading: 'What is costing you callbacks',
  insiderHeading: 'What they are not telling you',

  // Stakes — static, honest, no invented numbers about this person.
  stakes:
    'Right now most of these applications end in silence. Not because you are not good enough, but because your resume never makes the case in the six seconds it gets.',

  // The wall — gate the cure, not more problems.
  wall: {
    heading: 'You can see what is wrong. Here is how to fix all of it.',
    sub: 'The full fix list, step by step, plus the Australian hiring rules nobody tells you. Career coaches charge hundreds for this read. Yours is free, I just need an email to send it.',
    placeholder: 'Enter your email',
    button: 'Send me the fixes',
    buttonLoading: 'Building your fixes',
    privacy: 'We email your fix list and job-search tips. No spam, unsubscribe anytime.',
    scanAnother: 'Scan a different CV',
  },

  // Post-email — the cure.
  reassuranceFallback:
    'This is not a talent problem. Your experience is real, it is just written in a way Australian employers do not read. That is learnable, and you are about to.',
  fixesHeading: 'Your fixes, in order',

  // Bridge to the app — gate the machine and the jobs behind signup.
  bridge: {
    heading: 'Fixing this once is the easy part.',
    body: 'The real reason good people stay stuck here is they fix one resume, then send it into a void, to jobs that may not even sponsor a visa. We rewrite your resume for every job automatically, and show you the Australian employers hiring and sponsoring right now.',
    button: 'Set up my job search',
    subtext: 'Free to start. No card needed.',
  },
} as const;
```

- [ ] **Step 1.2: Type-check.** Run from repo root: `npx tsc --noEmit -p tsconfig.app.json` (or the frontend tsconfig the project uses). Expected: exit 0. If the project has no such config, STOP and report the correct frontend type-check command.

- [ ] **Step 1.3: Commit.**

```bash
git add src/pages/cvScanCopy.ts
git commit -m "feat(scan): locked copy file for the CV scan conversion reveal"
```

---

## Task 2: Lead the free reveal with the verdict, demote the score

**Goal:** The first thing the user sees is the brutal verdict (`firstImpression`), not a number. The score ring stays in the product but is demoted: small and secondary, never the headline.

**Files:**
- Modify: `src/pages/MockLandingPage.tsx` (the live `ScanReveal` component only)

- [ ] **Step 2.1:** In `ScanReveal`, import the copy: add `import { cvScanCopy } from './cvScanCopy';` near the other imports at the top of the file if it is not already imported.

- [ ] **Step 2.2:** Make the FREE section (visible immediately on `status === 'done'`, before any email) render in this order:
  1. `cvScanCopy.woundKicker(result.firstName)` as a small uppercase kicker label.
  2. `result.firstImpression` as the large headline verdict (the biggest text in the panel). If `result.firstImpression` is empty, fall back to the first `result.items[0].text`.
  3. The gap items (`result.items`) exactly as they render today (the staggered list with severity dots), under the `cvScanCopy.diagnosisHeading` label.
  4. The insider layer under `cvScanCopy.insiderHeading`: the `result.hiringManager.view` (prefixed with the manager `name` and `archetype` as it renders today) and the `result.culturalTranslations` entries. If these already render in the live component, keep their markup, just ensure they sit in the free section.

- [ ] **Step 2.3:** Demote the score. Remove `<ScoreRing score={result.score} />` from the headline/top position. Re-render it small and secondary at the BOTTOM of the free diagnosis section (after the items), with a muted caption. Do not delete the `ScoreRing` component itself. If you cannot cleanly relocate it, leave it rendered but visually de-emphasised (smaller, muted), and report this in your final notes.

- [ ] **Step 2.4: Type-check and commit.**

```bash
git add src/pages/MockLandingPage.tsx
git commit -m "feat(scan): lead reveal with the verdict, demote the score"
```

---

## Task 3: Add the stakes beat, then gate the cure behind email

**Goal:** After the free diagnosis, show the static stakes line, then the email wall. Move the quick wins, the reassurance, and the roadmap so they appear ONLY after the email is submitted (when `roadmap` is truthy).

**Files:**
- Modify: `src/pages/MockLandingPage.tsx` (the live `ScanReveal` component only)

- [ ] **Step 3.1:** Directly after the free diagnosis section and before the email input, render `cvScanCopy.stakes` as a single emphasised line (not a list, one sentence, calm but heavy weight).

- [ ] **Step 3.2:** Replace the current pre-email wall copy with the locked wall copy:
  - Heading: `cvScanCopy.wall.heading`
  - Sub: `cvScanCopy.wall.sub`
  - Input placeholder: `cvScanCopy.wall.placeholder`
  - Submit button label: `emailLoading ? cvScanCopy.wall.buttonLoading : cvScanCopy.wall.button`
  - Privacy line: `cvScanCopy.wall.privacy` (keep the existing Privacy link)
  - "Scan a different CV" link label: `cvScanCopy.wall.scanAnother`
  Keep the existing email state, `onEmailSubmit` handler, error handling, and the pulsing button animation. Only the copy changes.

- [ ] **Step 3.3:** Move the QUICK WINS so they render only when `roadmap` is truthy (i.e. after a successful email submit), NOT during the `'wins'` step. The quick wins are part of the cure. Under the heading `cvScanCopy.fixesHeading`, render `result.quickWins` (same card markup as today). If the live component gates quick wins on `revealStep`, change that gate to `roadmap` truthiness.

- [ ] **Step 3.4:** Move the REASSURANCE so it renders only when `roadmap` is truthy, immediately above the quick wins. Use `result.reassurance` and fall back to `cvScanCopy.reassuranceFallback` when it is empty.

- [ ] **Step 3.5:** Keep the roadmap rendering (the numbered steps) where it is, in the `roadmap` truthy branch, below the quick wins.

- [ ] **Step 3.6:** Remove the old `'big_reveal'` copy that says "These 2 fixes will help, but there are 7 other gaps" if it still renders in the live component. It is replaced by the stakes line plus the wall. If removing it breaks the `revealStep` machine, simplify the machine so the free section shows immediately and the wall shows after a short delay, but do not change the email submit behaviour. If this requires more than a localised change, STOP and report.

- [ ] **Step 3.7: Type-check and commit.**

```bash
git add src/pages/MockLandingPage.tsx
git commit -m "feat(scan): add stakes beat, gate quick wins and reassurance behind email"
```

---

## Task 4: Bridge from the cure to the app

**Goal:** After the roadmap, end on the app, not a dead report. The bridge connects the scan's pain (invisible resume) to the app's promise (a resume that gets seen, against jobs that exist for them).

**Files:**
- Modify: `src/pages/MockLandingPage.tsx` (the live `ScanReveal` component only)

- [ ] **Step 4.1:** In the `roadmap` truthy branch, BELOW the roadmap steps, render the bridge block:
  - Heading: `cvScanCopy.bridge.heading`
  - Body: `cvScanCopy.bridge.body`
  - A primary CTA button labelled `cvScanCopy.bridge.button` that triggers the existing "get started / set up the app" path. In the live code this opens `GetStartedModal` (look for the existing `setShowGetStarted(true)` or the `onEnterDashboard` / claim trigger and reuse it). Do NOT invent a new signup flow.
  - Subtext: `cvScanCopy.bridge.subtext`
  - The bridge CTA is now the primary action after the roadmap. Keep the "Scan a different CV" link but make it secondary (small, muted text link).

- [ ] **Step 4.2:** If `ScanReveal` does not already have access to whatever opens `GetStartedModal` (a prop or handler), wire the existing handler through. Reuse the existing prop/handler that the panel already passes (for example `onEnterDashboard`); do not create a parallel mechanism. If no such handler reaches `ScanReveal`, STOP and report how `GetStartedModal` is currently opened.

- [ ] **Step 4.3: Type-check and commit.**

```bash
git add src/pages/MockLandingPage.tsx
git commit -m "feat(scan): bridge from roadmap to app signup with visa-sponsor hook"
```

---

## Task 5: Confirm the scan prompt is brutal and unhedged (verify only)

The scan prompt in `server/src/services/cvGapScan.ts` was already tightened: a NO HEDGING rule, a brutal ATS-fail verdict, and a direct `firstImpression`. This task is verification, not new copy.

- [ ] **Step 5.1:** Open `server/src/services/cvGapScan.ts` and confirm all of the following strings are present in `buildScanInstructions`: `NO HEDGING (absolute)`, `Your resume fails the ATS, no one sees it`, and `Be brutally honest, never abusive`. If any is missing, STOP and report; do not re-author them.

- [ ] **Step 5.2:** No code change. If all present, this task is complete.

---

## Task 6 (OPTIONAL, needs a decision): Funnel instrumentation

We currently cannot see where users drop in the funnel. This is worth fixing, but it needs an analytics tool decision the product owner must make.

- [ ] **Step 6.1:** Search the frontend for an existing analytics or event-tracking utility (search for `track(`, `posthog`, `gtag`, `analytics`, `mixpanel`, `amplitude`). 
  - If one EXISTS: fire these six events from `ScanReveal`/`MockLandingPage` at the matching beats, with no other change: `scan_uploaded`, `scan_reveal_shown`, `scan_wall_shown`, `scan_email_submitted`, `scan_bridge_shown`, `scan_signup_started`. Then commit.
  - If NONE exists: STOP and report. Do not invent an analytics backend or add a tracking dependency. The product owner will choose the tool first.

---

## Final verification (after all tasks)

- [ ] Frontend type-check passes (exit 0).
- [ ] `cd server && npx tsc --noEmit` passes (exit 0) and `npx vitest run` shows no NEW failures versus before this plan (pre-existing failures in `analyze`/clustering and stale `dist` test artifacts are not yours).
- [ ] Manually confirm the reveal order in the running app: verdict and items and insider layer are visible BEFORE email; quick wins, reassurance, and roadmap appear only AFTER email; the bridge CTA appears after the roadmap and opens the existing signup flow.
- [ ] Report the commit range and a one-line summary of any STOP-and-report points you hit.

## Notes for the product owner (not DeepSeek)
- Stakes is intentionally static copy, not an LLM field, to avoid fabricated per-person numbers.
- The score is demoted, not deleted, so it can be reused later as an in-app progress meter.
- The biggest remaining lever not in this plan is model tier (Sonnet vs Opus) for sharper verdicts, and making the ATS-fail judgment robust so the strongest hook always fires. Both are separate decisions.

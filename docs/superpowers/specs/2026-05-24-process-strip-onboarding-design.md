# Process Strip Onboarding — Implementation Spec

**Author:** Kiron + Claude (Opus 4.7)
**Date:** 2026-05-24
**Status:** Approved, ready for execution
**Target executor:** DeepSeek agent (one-shot)
**Branch:** work on the current branch (`feat/landing-redesign-b1`)

---

## 0. Read this section first

This spec is the **complete, authoritative specification** for a feature called the **Process Strip**. It replaces the existing walkthrough system entirely (panel + tooltips + resume pill). You are expected to:

1. Implement the strip and the inline section-intro banners.
2. Delete the walkthrough subsystem.
3. Wire all the targets, events, and `data-process-step` attributes listed below.
4. Verify against the acceptance criteria at the end.

**Constraints you MUST follow:**

- **DO NOT** invent file paths, hooks, or APIs that aren't named in this spec. Every existing file referenced below has been verified to exist on this branch.
- **DO NOT** add features, refactor unrelated code, or "improve" the design beyond what's specified. YAGNI.
- **DO NOT** silently leave dangling imports of deleted files. After deleting the walkthrough folder, search the codebase for `walkthrough/WalkthroughProvider`, `walkthrough/WalkthroughPanel`, `walkthrough/WalkthroughTooltip`, `walkthrough/WalkthroughResumePill`, `useWalkthroughTrigger`, `data-walkthrough-id`, and `useWalkthrough` and remove every reference.
- **DO NOT** modify any file not explicitly named in §4 ("Files to modify") or §5 ("Files to delete").
- **DO NOT** introduce new third-party dependencies. The project already uses `framer-motion`, `lucide-react`, `react-router-dom`, `@tanstack/react-query` — use those.
- **DO NOT** use `any` in TypeScript. Every prop, hook return value, and event payload below is typed; honor the types literally.
- **All copy strings must be reproduced verbatim** from §9. Do not paraphrase, "improve", or shorten them.

If anything is genuinely ambiguous, STOP, do not guess, leave a TODO comment with `// TODO(spec): <question>` and continue. Do not invent behavior.

---

## 1. Context and goal

### What we have now
A walkthrough subsystem with 10 chained tooltips, anchored to `data-walkthrough-id` attributes scattered across the codebase, fronted by a right-edge panel and a bottom-right "resume" pill. It targets multiple pages, requires complex state tracking, and (per industry data on multi-step tours) loses >50% of users at every step.

### Why it's being replaced
We want first-time users to complete one full application (status reaches `APPLIED`) without any chained tooltips. The replacement is a single persistent UI element — the **Process Strip** — that visualizes the 5-stage core loop and pulses the relevant on-page target. After first `APPLIED`, the strip retires forever. Discovery of other sections (Documents, Profile, Job Feed, LinkedIn, Email Templates, Mindset) happens via single-line, dismissible inline banners shown the first time each page is visited.

### Success metric
First application sent (`ApplicationStatus === 'APPLIED'` on at least one job for at least one user). The strip optimises for this metric; everything else is secondary.

---

## 2. The five steps

The strip has exactly five nodes, in this order, with these exact labels and captions:

| # | Label    | Caption (shown only when this step is current)                                  | Pulse target on page                                          |
|---|----------|---------------------------------------------------------------------------------|---------------------------------------------------------------|
| 1 | Paste    | Paste a job listing — we'll tailor your CV and cover letter in 3 minutes.       | The JD textarea on `/`                                        |
| 2 | Analyse  | Hit Analyse. We'll build your tailored resume and cover letter.                 | The Analyse button on `/`                                     |
| 3 | Tailor   | Review the documents we drafted. Tweak anything that doesn't feel like you.     | The Review/Edit area on `/application-workspace`              |
| 4 | Save     | Save your edits — this creates the application in your tracker.                 | The Save button on `/application-workspace`                   |
| 5 | Track    | Mark the role as APPLIED once you've sent it. We'll automate the follow-ups.    | The first job card's status pill on `/tracker`                |

The labels and captions are **content**, not placeholders. Use them verbatim.

---

## 3. Files to CREATE

Create the following four files. Each section below gives the **complete contract** for that file. The implementation may exceed what's shown (e.g., internal helpers), but the exported API must match exactly.

### 3.1 `src/components/processStrip/types.ts`

```ts
export type ProcessStep = 'paste' | 'analyse' | 'tailor' | 'save' | 'track';

export const PROCESS_STEPS: readonly ProcessStep[] = ['paste', 'analyse', 'tailor', 'save', 'track'] as const;

export interface ProcessProgress {
  /** The step the user is currently on. null = all done (about to retire). */
  currentStep: ProcessStep | null;
  /** Steps the user has finished (in order). */
  completedSteps: ProcessStep[];
  /** True when the strip should not render at all (retired forever, or manually hidden). */
  isHidden: boolean;
  /** True only when the user has explicitly hidden via the hide button (not when retired). */
  isManuallyHidden: boolean;
  /** True when status >= APPLIED has been observed. */
  isRetired: boolean;
}

export type SectionId =
  | 'applications'
  | 'documents'
  | 'profile'
  | 'jobs'
  | 'linkedin'
  | 'emailTemplates'
  | 'mindset';
```

### 3.2 `src/components/processStrip/useProcessProgress.ts`

A hook that derives strip state from real data + a small localStorage layer. **No new context/provider** — the hook reads `useQuery({ queryKey: ['jobs'] })` directly (matching the existing `ApplicationTracker.tsx:30+` pattern) and listens to specific window events.

**Required exports:**

```ts
import type { ProcessProgress, ProcessStep } from './types';

export function useProcessProgress(): ProcessProgress & {
  hide: () => void;
  show: () => void;
};
```

**Behavior contract:**

1. **localStorage keys (these exact names):**
   - `jobhub_strip_hidden` — value `'true'` or absent.
   - `jobhub_strip_retired` — value `'true'` or absent. Once set, never unset by this hook.
   - `jobhub_step_save_done` — value `'true'` or absent. Set by the save event listener.

2. **Job fetch:** Use the same query key as the existing tracker. Inspect `src/components/ApplicationTracker.tsx` to find the exact queryKey and adopt it. Do **not** invent a new endpoint. If the tracker uses `useQuery({ queryKey: ['jobs'], ... })`, do the same. The fetched data must conform to `JobApplication[]` from `src/components/tracker/types.ts`.

3. **Step completion rules (in order; first false stops the cascade):**

   | Step      | Completion rule                                                                                                                       |
   |-----------|----------------------------------------------------------------------------------------------------------------------------------------|
   | `paste`   | At least one job exists OR `localStorage.jobhub_step_paste_done === 'true'` OR a `process:pasted` window event has fired this session. |
   | `analyse` | At least one job exists.                                                                                                              |
   | `tailor`  | At least one job exists (every analysed job has draft documents — the act of analysing it counts).                                    |
   | `save`    | `localStorage.jobhub_step_save_done === 'true'` (set when the editor's save handler fires; see §4.4).                                 |
   | `track`   | At least one job has `status` in `{ 'APPLIED', 'INTERVIEW', 'OFFER' }`.                                                                |

4. **`currentStep` derivation:** The first step in `PROCESS_STEPS` order whose completion rule is false. If all five are true, `currentStep = null`.

5. **`isRetired`:** Becomes `true` (and persisted to `localStorage.jobhub_strip_retired`) the first time the hook observes any job with `status ∈ {'APPLIED', 'INTERVIEW', 'OFFER'}`. Once `true`, this latches — even if the user later deletes all their applications, the strip stays retired.

6. **`isManuallyHidden`:** Reads `localStorage.jobhub_strip_hidden === 'true'`.

7. **`isHidden`:** `isRetired || isManuallyHidden`.

8. **`hide()`:** Writes `jobhub_strip_hidden = 'true'` to localStorage and triggers a re-render of consumers (use `useSyncExternalStore`, a tiny custom event, or a local `useState` lifted via context — your choice, but it MUST update immediately on call).

9. **`show()`:** Removes `jobhub_strip_hidden` from localStorage and triggers a re-render. Does NOT undo `isRetired`. If the user is already retired, `show()` has no effect on `isHidden`.

10. **Listen for window events** (use `useEffect` with cleanup):
    - `process:pasted` — marks step 1 done in the current session (also writes `jobhub_step_paste_done = 'true'`).
    - `process:saved` — writes `jobhub_step_save_done = 'true'` and triggers re-render.

11. **Do NOT read the textarea's DOM value directly to derive state.** Only listen to events. The `process:pasted` event + the persisted `jobhub_step_paste_done` flag are the only signals you need for step 1's completion.

### 3.3 `src/components/processStrip/ProcessStrip.tsx`

The visual component. Exports:

```ts
export const ProcessStrip: React.FC;
```

No props. It internally calls `useProcessProgress()` and renders based on the result.

**Render contract:**

1. If `isHidden === true`, render the **show-pill fallback** instead of the strip (see §3.3.4 below).
2. Otherwise, render a horizontal row containing:
   - One node per step (5 nodes total).
   - Connector segments between adjacent nodes.
   - A caption beneath the row that displays the **current step's caption** from §2's table.
   - A small "Hide" button at the right edge (icon: `lucide-react` `EyeOff`, size 14).

**Node visual states:**

| State           | Background                                  | Border                                              | Text/icon color                        | Size  |
|-----------------|---------------------------------------------|-----------------------------------------------------|----------------------------------------|-------|
| Completed       | `warm.colors.accentGold` (`#C5A059`)        | none                                                | `#FFFFFF` (rendered icon: `Check` 14px) | 28×28 |
| Current         | `warm.colors.accentPetrol` (`#2D5A6E`)      | 2px ring `warm.colors.ringFocus`, pulsing (see §6) | `#FFFFFF` (rendered text: step number) | 28×28 |
| Future          | transparent                                 | 1.5px solid `warm.colors.borderWhisper`             | `warm.colors.textMuted`                | 28×28 |

Each node is a circle (`borderRadius: '50%'`). Step number is rendered inside the circle in `12px / 700 weight / fontFamily: warm.type.fontBody`.

**Connector segments:**

- Thin horizontal bar between adjacent nodes, `height: 2px`, `flex: 1`.
- Color: `warm.colors.accentGold` if both adjacent steps are completed; `warm.colors.borderWhisper` otherwise.

**Label beneath each node** (always rendered, not only when current):

- Text from the step's `label` column in §2.
- `fontSize: 11px, fontWeight: 600, color: warm.colors.textMuted, textAlign: center`.
- Current step's label uses `warm.colors.textPrimary` instead of muted.

**Caption** (below the row of nodes):

- Single line, rendered only when `currentStep !== null`. Use the caption text from §2's table for the current step.
- `fontSize: 12px, color: warm.colors.textSecondary, lineHeight: 1.5, marginTop: 12px, textAlign: center`.

**Container:**

```tsx
// Pseudocode shape, adapt to JSX:
<motion.div
  initial={{ opacity: 0, y: -4 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -4 }}
  transition={{ duration: 0.2 }}
  role="region"
  aria-label="Application progress"
  style={{
    width: '100%',
    maxWidth: 720,
    margin: '0 auto',
    padding: '16px 20px',
    background: warm.colors.bgSurface,
    border: `1px solid ${warm.colors.borderWhisper}`,
    borderRadius: warm.radius.card, // 16
    boxShadow: warm.shadow.soft,
  }}
>
  {/* row of 5 nodes with connectors */}
  {/* hide button absolutely-positioned top-right inside container, 8px from edges */}
  {/* caption below */}
</motion.div>
```

#### 3.3.4 Show-pill fallback (when manually hidden, NOT when retired)

If `isManuallyHidden === true && isRetired === false`, render a small pill that lets the user re-show the strip. If `isRetired === true`, render NOTHING (return `null`).

```tsx
// When isHidden && !isRetired:
<motion.button
  onClick={() => show()}
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0.8, opacity: 0 }}
  style={{
    position: 'fixed',
    bottom: 16,
    right: 16,
    zIndex: 60,
    background: warm.colors.bgSurface,
    border: `1px solid ${warm.colors.borderWhisper}`,
    borderRadius: warm.radius.pill, // 9999
    padding: '8px 14px',
    fontSize: 11,
    fontWeight: 700,
    color: warm.colors.textSecondary,
    boxShadow: warm.shadow.soft,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  }}
  aria-label="Show progress strip"
>
  <Eye size={12} />
  Show progress
</motion.button>
```

### 3.4 `src/components/processStrip/SectionIntroBanner.tsx`

Single-line dismissible banner used at the top of each section page.

**Exported component:**

```tsx
import type { SectionId } from './types';

interface SectionIntroBannerProps {
  sectionId: SectionId;
  /** Single-line body copy. Pulled from §9.2 by the caller. */
  children: React.ReactNode;
}

export const SectionIntroBanner: React.FC<SectionIntroBannerProps>;
```

**Behavior:**

- On mount, read `localStorage.jobhub_section_intros_seen` (JSON-parsed object, default `{}`).
- If `parsed[sectionId] === true`, render nothing (`return null`).
- Otherwise render the banner. On dismiss (click of the X), merge `{ [sectionId]: true }` into the object, write back to localStorage, then unmount the banner (animate out via `AnimatePresence`).
- Do **not** auto-dismiss on any other event. Only the X click dismisses.

**Visual:**

```tsx
<AnimatePresence>
  {!dismissed && (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        marginBottom: 20,
        background: warm.colors.bgAlt,    // #F4EFE8
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: warm.radius.card,
        color: warm.colors.textSecondary,
        fontSize: 13,
        lineHeight: 1.55,
      }}
      role="note"
    >
      <span style={{ flex: 1 }}>{children}</span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: warm.colors.textMuted,
          padding: 4,
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </motion.div>
  )}
</AnimatePresence>
```

Use `lucide-react` `X` icon. Use `framer-motion` `AnimatePresence` and `motion.div`.

### 3.5 `src/components/processStrip/index.ts`

Barrel export:

```ts
export { ProcessStrip } from './ProcessStrip';
export { SectionIntroBanner } from './SectionIntroBanner';
export { useProcessProgress } from './useProcessProgress';
export type { ProcessStep, SectionId, ProcessProgress } from './types';
export { PROCESS_STEPS } from './types';
```

---

## 4. Files to MODIFY

For each file below, the spec gives the **exact change** to make. Do not modify any other part of these files.

### 4.1 `src/App.tsx`

**Find** (line 61):
```ts
import { WalkthroughProvider } from './components/walkthrough/WalkthroughProvider';
```

**Delete this line entirely.** Do not replace it.

**Find** (around line 348, the `return ( <WalkthroughProvider> ... </WalkthroughProvider> )` block):

```tsx
  return (
    <WalkthroughProvider>
      <DashboardGate>
        <motion.div ...>
          <DashboardLayout>
            ...
          </DashboardLayout>
        </motion.div>
      </DashboardGate>
    </WalkthroughProvider>
  );
```

**Replace with** (remove the WalkthroughProvider wrapper entirely; do NOT add a ProcessStripProvider — the strip is rendered inside DashboardLayout, not wrapped at provider level):

```tsx
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
            <React.Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(45,90,110,0.2)', borderTopColor: '#2D5A6E' }} /></div>}>
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
                <Route path="/admin/funnel" element={<AdminFunnel />} />
                <Route path="/admin/friday-brief" element={<FridayBriefPage />} />
                <Route path="*" element={<StrategyHub />} />
              </Routes>
            </React.Suspense>
          </ErrorBoundary>
        </DashboardLayout>
      </motion.div>
    </DashboardGate>
  );
```

### 4.2 `src/layouts/DashboardLayout.tsx`

**Goal:** Render `<ProcessStrip />` once at the top of the dashboard main content area, above the `{children}` slot. This makes it appear on every dashboard route automatically.

**Find** (around line 343, the `<main>` block):

```tsx
            {/* Main content */}
            <main className="flex-1 overflow-y-auto" style={{ background: 'transparent' }}>
                <div
                    className="max-w-5xl mx-auto px-6 md:px-10 pt-10 pb-6"
                    style={{ paddingTop: isTouch ? 64 : 40 }}
                >
                    {children}
                </div>
```

**Replace the inner `<div>` body to insert the strip ABOVE `{children}`:**

```tsx
            {/* Main content */}
            <main className="flex-1 overflow-y-auto" style={{ background: 'transparent' }}>
                <div
                    className="max-w-5xl mx-auto px-6 md:px-10 pt-10 pb-6"
                    style={{ paddingTop: isTouch ? 64 : 40 }}
                >
                    <div style={{ marginBottom: 24 }}>
                        <ProcessStrip />
                    </div>
                    {children}
                </div>
```

**Add the import at the top of the file** (with the other component imports, around line 1–20):

```ts
import { ProcessStrip } from '../components/processStrip';
```

**Also in this file:** the previous walkthrough nav-id attributes that we added on `feat/landing-redesign-b1` are now obsolete. **Remove** the following two `walkthroughId` references:

- The `walkthroughId: 'linkedin-nav'` and `walkthroughId: 'email-templates-nav'` keys in the `navItems` array (around lines 130–131).
- The `data-walkthrough-id={item.walkthroughId}` attribute on `<NavLink>`.
- The `data-walkthrough-id="mindset-nav"` attribute on the `<Link to="/mindset">`.
- Remove the `walkthroughId?: string` field from the `navItems` TypeScript shape.

### 4.3 `src/pages/StrategyHub.tsx`

**Goal:** Replace the old `data-walkthrough-id="paste-first-job"` with `data-process-step="paste"` on the textarea, add `data-process-step="analyse"` to the Analyse button, and dispatch `process:pasted` events when the textarea content transitions empty→non-empty.

**Find** (around line 540, the textarea):

```tsx
            <textarea
                data-walkthrough-id="paste-first-job"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the job description here…"
                ...
```

**Replace `data-walkthrough-id="paste-first-job"` with `data-process-step="paste"`.** Then modify `onChange` so it dispatches the `process:pasted` event the first time the value transitions from empty to non-empty:

```tsx
            <textarea
                data-process-step="paste"
                value={jd}
                onChange={(e) => {
                    const next = e.target.value;
                    if (jd.length === 0 && next.length > 0) {
                        window.dispatchEvent(new CustomEvent('process:pasted'));
                    }
                    setJd(next);
                }}
                placeholder="Paste the job description here…"
                ...
```

**Find** (around line 629, the Analyse button):

```tsx
                <button
                    onClick={handleAnalyse}
                    disabled={!canSubmit}
```

**Add `data-process-step="analyse"`:**

```tsx
                <button
                    data-process-step="analyse"
                    onClick={handleAnalyse}
                    disabled={!canSubmit}
```

### 4.4 `src/components/ApplicationWorkspace.tsx`

**Goal:** When the editor's save handler completes successfully, dispatch `process:saved`. Also add `data-process-step="tailor"` to a suitable container and `data-process-step="save"` to the Save button.

**Find the existing save handler.** From a search of the file, the save status flows through `setState(prev => ({ ...prev, saveStatus: 'saving' }))` around line 496. Locate the function that initiates saving (it likely awaits an API call and then sets `saveStatus: 'saved'` on success). At the point where `saveStatus` is set to `'saved'`, add:

```ts
window.dispatchEvent(new CustomEvent('process:saved'));
```

If there are multiple save paths (e.g., resume save and cover-letter save), fire the event from each.

**Find the main editor surface.** This is the outer container that holds the Review/Edit panes. Add `data-process-step="tailor"` to that container's outermost element.

**Find the Save button.** Add `data-process-step="save"` to it.

> ⚠️ This file is large (~2200 lines). If you cannot find the precise Save button or container after reading the file, **leave a `// TODO(spec): add data-process-step="save"` comment near `saveStatus` and stop**. Do not guess.

### 4.5 `src/components/ApplicationTracker.tsx`

**Goal:** Add `data-process-step="track"` to the first job card's status pill (the badge that displays `'SAVED' | 'APPLIED' | ...`).

**Find** (around line 202, the existing follow-up/thank-you nudge wrappers):

```tsx
            {!isLoading && <div data-walkthrough-id="follow-up-area"><FollowUpNudge jobs={jobs} /></div>}
            {!isLoading && <div data-walkthrough-id="thank-you-area"><ThankYouNudge jobs={jobs} /></div>}
```

**Replace with** (remove the walkthrough wrappers entirely — these are no longer used):

```tsx
            {!isLoading && <FollowUpNudge jobs={jobs} />}
            {!isLoading && <ThankYouNudge jobs={jobs} />}
```

**Find** where job cards are rendered (a `<JobCard ... />` inside a `.map()` over `jobs`). The `JobCard` component itself is the right target — but tagging the WHOLE card is too aggressive. The pulse target should be the **status pill inside the first card**, which is `data-process-step="track"`. Since `JobCard` is in `src/components/tracker/JobCard.tsx`, edit there instead — see §4.6.

**Also insert the SectionIntroBanner** at the top of the tracker page's main content. Find the JSX returned by the `ApplicationTracker` component and add immediately inside its outer wrapper, before any other content:

```tsx
<SectionIntroBanner sectionId="applications">
  {/* exact copy from §9.2 */}
</SectionIntroBanner>
```

**Add the import** at the top of the file:

```ts
import { SectionIntroBanner } from './processStrip';
```

### 4.6 `src/components/tracker/JobCard.tsx`

**Goal:** Replace the dev-only `data-walkthrough-id="see-tracker"` with `data-process-step="track"` on the **status pill** of the first card only (`isFirst === true`).

**Step 1 — find the existing attribute** (around line 755):

```tsx
                {...(isFirst ? { 'data-walkthrough-id': 'see-tracker' } : {})}
```

**Delete this line from the `motion.div`.**

**Step 2 — locate the status pill.** Inside this file, the job's `status` is rendered as a coloured badge somewhere (look for usage of `STATUS_CONFIG` from `./constants` or similar — likely inside the card header). On that badge's outermost element, add:

```tsx
{...(isFirst ? { 'data-process-step': 'track' } : {})}
```

If you cannot uniquely identify the status pill, fall back to placing the attribute on the `<motion.div>` outer card wrapper (still gated on `isFirst`).

### 4.7 Section pages — insert `SectionIntroBanner`

Insert one `<SectionIntroBanner>` at the top of each section page's main returned JSX, **as the first child inside the outermost wrapper**, before any existing content. Use the exact `sectionId` and copy from §9.2.

| Page file                                       | `sectionId`        |
|-------------------------------------------------|--------------------|
| `src/components/DocumentLibrary.tsx`            | `documents`        |
| `src/components/ProfileBank.tsx`                | `profile`          |
| `src/pages/JobFeedPage.tsx`                     | `jobs`             |
| `src/pages/LinkedInPage.tsx`                    | `linkedin`         |
| `src/components/EmailTemplatesLibrary.tsx`      | `emailTemplates`   |
| `src/pages/MindsetPage.tsx`                     | `mindset`          |
| `src/components/ApplicationTracker.tsx`         | `applications`     |

For each file:
1. Add the import: `import { SectionIntroBanner } from '<correct-relative-path>/processStrip';` (relative path varies: `./processStrip` for files in `src/components/`, `../components/processStrip` for files in `src/pages/`).
2. Insert the banner with the copy from §9.2 as the first child inside the page's outermost layout wrapper.

---

## 5. Files to DELETE

Delete the entire `src/components/walkthrough/` directory and all five files inside it:

```
src/components/walkthrough/WalkthroughProvider.tsx
src/components/walkthrough/WalkthroughPanel.tsx
src/components/walkthrough/WalkthroughTooltip.tsx
src/components/walkthrough/WalkthroughResumePill.tsx
src/components/walkthrough/useWalkthroughTrigger.ts
```

After deletion, run a grep for residual references and remove every match outside markdown docs:

- `WalkthroughProvider`
- `WalkthroughPanel`
- `WalkthroughTooltip`
- `WalkthroughResumePill`
- `useWalkthroughTrigger`
- `useWalkthrough`
- `data-walkthrough-id`
- `walkthrough:` (event names like `walkthrough:pasted-first-job`)
- `WALKTHROUGH_STORAGE_KEY`
- `jobhub_walkthrough_state`

Do NOT modify markdown files in `docs/` or `Walkthrough_And_Email_Plan.md` — those are historical references.

---

## 6. The pulse animation

The current step's node on the strip pulses, AND the on-page target element (matched by `data-process-step="<currentStep>"`) gets a subtle outer glow. Both pulses run at the same cadence.

**Strip node pulse** (inside `ProcessStrip.tsx`):

Use Framer Motion's `animate` prop on the current node:

```tsx
animate={{
  boxShadow: [
    '0 0 0 0 rgba(45,90,110,0.45)',
    '0 0 0 6px rgba(45,90,110,0)',
  ],
}}
transition={{
  duration: 1.6,
  repeat: Infinity,
  ease: 'easeOut',
}}
```

**On-page target glow:**

Inside `ProcessStrip.tsx`, after rendering, run an effect that finds `document.querySelector(\`[data-process-step="\${currentStep}"]\`)` and toggles a CSS class on it. The class is defined globally in `src/index.css` (do NOT add it inline — see §6.1).

```ts
useEffect(() => {
  if (!currentStep) return;
  const el = document.querySelector(`[data-process-step="${currentStep}"]`);
  if (!el) return;
  el.classList.add('process-pulse-target');
  return () => el.classList.remove('process-pulse-target');
}, [currentStep, /* and a dep that re-fires on route change */ location.pathname]);
```

Use `useLocation()` from `react-router-dom` to read `location.pathname` so the effect re-fires when the user navigates. The query must run AFTER the new page has rendered — wrap in a `requestAnimationFrame` or a small `setTimeout(0)` if needed to give the DOM time.

### 6.1 Add this CSS to `src/index.css`

Append to the existing file (do not replace it):

```css
@keyframes process-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(45, 90, 110, 0.0);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(45, 90, 110, 0.18);
  }
}

.process-pulse-target {
  animation: process-pulse 1.8s ease-in-out infinite;
  border-radius: inherit;
  position: relative;
  z-index: 1;
}
```

The `border-radius: inherit` ensures the pulse follows whatever border-radius the target element has (textarea, button, badge — they're all different).

---

## 7. State model — exhaustive

### 7.1 localStorage keys

| Key                                | Type             | Set by                                                              | Cleared by                  |
|------------------------------------|------------------|---------------------------------------------------------------------|-----------------------------|
| `jobhub_strip_hidden`              | `'true'` or absent | `hide()` in `useProcessProgress`                                  | `show()` in `useProcessProgress` |
| `jobhub_strip_retired`             | `'true'` or absent | `useProcessProgress` when it observes a job with status ≥ APPLIED | **never** (latched forever) |
| `jobhub_step_paste_done`           | `'true'` or absent | The `process:pasted` event handler                                | never                       |
| `jobhub_step_save_done`            | `'true'` or absent | The `process:saved` event handler                                 | never                       |
| `jobhub_section_intros_seen`       | JSON: `{ [SectionId]: true }` | `SectionIntroBanner` dismiss handler                              | never                       |

Any old walkthrough localStorage keys (`jobhub_walkthrough_state`) are obsolete; do NOT migrate them, just stop reading them.

### 7.2 Window events

| Event name        | Dispatched by                                                | Listened by                   |
|-------------------|--------------------------------------------------------------|-------------------------------|
| `process:pasted`  | `StrategyHub.tsx` textarea onChange (empty → non-empty)      | `useProcessProgress`          |
| `process:saved`   | `ApplicationWorkspace.tsx` save handler on success           | `useProcessProgress`          |

Use `window.dispatchEvent(new CustomEvent(<name>))`. Use `window.addEventListener(<name>, handler)` in `useProcessProgress`, with a cleanup that removes the listener.

---

## 8. Visual reference

ASCII mockup of the strip on `/` with the user on step 2 (Analyse):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                          [👁 Hide]      │
│                                                                         │
│    ✓──────● ⟵ pulsing──○────────○────────○                              │
│   Paste    Analyse     Tailor    Save     Track                         │
│                                                                         │
│       Hit Analyse. We'll build your tailored resume and cover letter.   │
└─────────────────────────────────────────────────────────────────────────┘

[ANALYSE A ROLE card below, with Analyse button glowing (process-pulse-target)]
```

ASCII of the `SectionIntroBanner` on first LinkedIn visit:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 70% of Aussie roles are filled via networking. This is your LinkedIn toolkit:      [ × ] │
│ profile rewrite, outreach templates, headline drafts.                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Copy — verbatim

### 9.1 Strip step labels and captions

(Already given in §2. Do not paraphrase.)

### 9.2 Section intro banner copy

Use these strings exactly. Each is a single sentence followed by a fragment — render as one continuous text node inside `<SectionIntroBanner>`:

| sectionId          | Body copy |
|--------------------|-----------|
| `applications`     | Every job you've started or applied to lives here. Track status, set follow-up reminders, and surface interview notes in one place. |
| `documents`        | Your library of tailored CVs, cover letters, and selection-criteria responses. Reuse anything you've already polished. |
| `profile`          | Your master profile. Update it once and every future application pulls from here — no more rewriting your story. |
| `jobs`             | Curated Australian roles matched against your profile. Skim daily; analyse the ones worth your time. |
| `linkedin`         | Around 70% of Aussie roles are filled via networking. This is your LinkedIn toolkit: profile rewrite, outreach templates, and headline drafts. |
| `emailTemplates`   | Battle-tested email templates for every stage — application follow-ups, post-interview thank-yous, salary negotiation. Copy, personalise, send. |
| `mindset`          | Quick-reference mindset prompts for when the job search wears you down. Read one when you need it. |

---

## 10. Edge cases (handle these explicitly)

1. **User pastes JD on `/`, then navigates away before clicking Analyse.** Strip stays on step `analyse` (because no job exists yet, but `process:pasted` has fired this session and `jobhub_step_paste_done` is persisted). When they return to `/`, current step is still `analyse`. If they later clear the textarea entirely, the strip stays on `analyse` (paste is committed once it's been seen) — the existing Analyse button's disabled state handles the empty-input case.

2. **Generation latency.** Clicking Analyse takes several seconds for the AI call. The strip should transition `analyse → tailor` **only** when the job actually exists in tracker data (i.e., next render after the query refetches). Do not transition on click.

3. **User has an existing draft from before this feature ships.** The hook reads tracker data; if a job already exists with `status === 'SAVED'`, completed steps are `[paste, analyse, tailor]` and current is `save`. No migration needed.

4. **User deletes their only APPLIED job after retiring.** `isRetired` is latched — strip stays hidden. Correct behavior.

5. **User refreshes mid-edit.** All state is derived from tracker + localStorage, so refresh is safe. Pulse re-anchors on next render.

6. **Hide button clicked while on the editor page.** The strip vanishes immediately, the show-pill appears bottom-right. Reload preserves the hidden state.

7. **`SectionIntroBanner` is mounted on a page that the user has already dismissed.** It returns `null` synchronously — no flash.

8. **No tracker data yet (first ever visit, query in flight).** Treat as `jobs.length === 0` — strip shows step `paste` as current. Do NOT render a loading skeleton inside the strip.

9. **`document.querySelector` for the pulse target returns null.** This is fine — the strip still renders normally, the on-page glow just doesn't apply. Don't throw, don't log.

10. **Mobile viewport (<480px).** The strip becomes horizontally scrollable: `overflow-x: auto` on the row of nodes, `scroll-snap-type: x mandatory`. Captions wrap. The hide button stays in the top-right corner of the container.

---

## 11. Acceptance criteria

This is the **exact checklist** to verify before considering the work done. Run through it in order.

### Build & static checks

- [ ] `npx tsc --noEmit` exits 0 with no errors.
- [ ] `npm run build` completes without errors.
- [ ] A repository-wide search for `data-walkthrough-id` returns ZERO matches in `.ts`/`.tsx` files (markdown is fine).
- [ ] A repo-wide search for `WalkthroughProvider`, `WalkthroughPanel`, `WalkthroughTooltip`, `WalkthroughResumePill`, `useWalkthroughTrigger`, `useWalkthrough` returns ZERO matches in `.ts`/`.tsx` files.
- [ ] `src/components/walkthrough/` directory no longer exists.

### Runtime — fresh user (cleared localStorage)

- [ ] Land on `/`. Strip is visible above the analyse card. Step 1 "Paste" is filled petrol (current), pulsing. Other steps are dim/hollow.
- [ ] Textarea has a subtle outer glow (`process-pulse-target`).
- [ ] Type any character into the textarea. Strip's step 1 turns gold + check, step 2 becomes current/pulsing. Glow moves from textarea to Analyse button.
- [ ] Click Analyse. After the AI call completes and the job appears in tracker data, step 2 turns gold + check, step 3 becomes current.
- [ ] Navigate to `/application-workspace`. Strip's step 3 "Tailor" is current/pulsing. The editor container has the glow.
- [ ] Click Save (or whichever button triggers the save handler). After success, step 4 turns gold + check, step 5 becomes current.
- [ ] Navigate to `/tracker`. Strip's step 5 "Track" is current/pulsing. The first job card's status pill (or card wrapper, per fallback) has the glow.
- [ ] Click the status pill, change to APPLIED. On next render: strip disappears entirely. Reload the page — strip still gone.
- [ ] `localStorage.jobhub_strip_retired === 'true'` confirms retirement.

### Runtime — hide/show

- [ ] Reset localStorage. Reload. Strip is back at step 1.
- [ ] Click the hide button. Strip disappears, a "Show progress" pill appears bottom-right.
- [ ] Reload. Strip stays hidden, pill stays visible. `localStorage.jobhub_strip_hidden === 'true'`.
- [ ] Click the show pill. Strip reappears, pill disappears.

### Runtime — section banners

- [ ] Reset localStorage. Visit `/linkedin` for the first time. The intro banner shows with the LinkedIn copy from §9.2.
- [ ] Dismiss the banner via the X. It animates out.
- [ ] Reload `/linkedin`. Banner does NOT re-appear. `localStorage.jobhub_section_intros_seen.linkedin === true`.
- [ ] Visit the other six section pages. Each shows its own banner once, with the correct copy from §9.2.

### Runtime — no regressions

- [ ] All existing pages render. Sidebar still works.
- [ ] Editor save flow still saves and toasts.
- [ ] Application tracker still loads jobs and supports status changes.

---

## 12. Out of scope (explicitly)

Do not work on any of these in this change:

- "Day 2" / time-based behavior — no calendar logic, no "returning user" detection beyond what the latched `isRetired` flag already gives us.
- Any analytics / telemetry events.
- A separate "Tour" menu item or "Restart tour" affordance.
- Server-side persistence of strip state (everything is localStorage).
- Migrating users from the old walkthrough state (`jobhub_walkthrough_state`). Just stop reading it; it'll sit in localStorage harmlessly.
- Mobile drawer / touch-specific affordances beyond the basic responsive notes in §10.10.
- Replacing the existing `FirstApplicationCelebration.tsx` modal. Leave it alone.
- Adding any new tests. The verification is the acceptance checklist above, executed manually.

---

## 13. If something blocks you

If during execution you encounter ANY of the following, **stop and surface a TODO with the question**. Do not improvise.

- Can't find the Save button or save handler in `ApplicationWorkspace.tsx`.
- Can't find the status pill in `JobCard.tsx`.
- The job query in `ApplicationTracker.tsx` uses an unexpected shape or queryKey.
- A `SectionIntroBanner` insertion point is genuinely ambiguous on a page (e.g., the page has multiple top-level wrappers).
- An import path doesn't resolve.

Leave a comment `// TODO(spec): <specific question>` in place of a guess. The human reviewer can resolve it in one round.

---

## 14. Order of execution (recommended)

1. Create `src/components/processStrip/` and all four files in §3.
2. Add the CSS in §6.1 to `src/index.css`.
3. Modify `src/App.tsx` (§4.1) to drop the WalkthroughProvider.
4. Modify `src/layouts/DashboardLayout.tsx` (§4.2) to render `<ProcessStrip />` and strip out the walkthrough nav attrs.
5. Modify `src/pages/StrategyHub.tsx` (§4.3) for the textarea and Analyse button.
6. Modify `src/components/ApplicationWorkspace.tsx` (§4.4) for the editor save event.
7. Modify `src/components/ApplicationTracker.tsx` (§4.5) and `src/components/tracker/JobCard.tsx` (§4.6) for the track step.
8. Insert all `<SectionIntroBanner>` instances (§4.7).
9. Delete `src/components/walkthrough/` (§5).
10. Run `npx tsc --noEmit` and fix any errors.
11. Manually walk through §11's acceptance checklist.

---

End of spec.

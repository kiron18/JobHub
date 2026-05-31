# Draft Modal Simplification + Orphan Fix + Apply CTA

**Date:** 2026-05-31
**Status:** Approved (design)
**Theme:** warm light palette (`src/lib/theme/warmTokens.ts`) — matches the existing Analysis/Draft UI, NOT the slate dark theme.

## Problem (from QA 4 — SHFPACT run)

The new bridged-gaps build works for **ticked** gaps (they reached the résumé bullet + Skills). But the gap the user **drafted** in the modal — *"I coordinated multiple tasks… achieving a 25% increase in productivity"* — **never reached either document**. The drafted sentence (the user's best, real-metric content) was saved to the Profile Bank but orphaned from the current application.

Root cause: two divergent bridging paths.
- **Tick (+ inline edit)** → `bridgedGaps` pipe → reaches docs ✓
- **Draft modal** → `POST /achievements` (Profile Bank, staged) → NOT pulled into this generation ✗

Plus two UX issues the user raised:
- The draft modal is a full-achievement editor (Title + Description + Metric) but the artifact is **one sentence** — the design should match.
- After bridging gaps, the **Apply** button isn't visually the obvious next step.

## Goal

1. **Fix the orphan:** a drafted sentence reaches the current application's documents AND stays reusable in the Profile Bank.
2. **Simplify the draft modal** to a single-sentence editor, with the placeholder-variable shown **in red** plus instruction copy.
3. **Differentiate the Apply CTA** so that once ≥1 gap is bridged, "Apply now" is unmistakably the next step.

Out of scope: analysis determinism (#4), Pinecone null-metric bug, raw-prose quality (Llama-vs-Claude execution is a separate pricing decision).

## 1. Orphan fix — reuse the existing pipe

`AnalysisResult` already derives `bridgedGaps` from `bridgedIndices` using
`bridgedText.get(i) ?? capabilityStatement(item.suggestion)`. The modal just needs to
feed `bridgedText`.

- `AchievementDraftModal` `onSaved` signature changes from `() => void` to
  `(finalDescription: string) => void`. In `handleSave`, after the successful
  `POST /achievements`, call `onSaved?.(description.trim())`.
- In `AnalysisResult`'s `onSaved` handler: set `bridgedText[draftIndex] = finalDescription`
  AND add `draftIndex` to `bridgedIndices` (it already adds to `bridgedIndices`; add the
  text write). The existing `bridgedGaps` effect then emits the **edited** sentence.

Result: drafted sentence (with the user's real metric) flows to both documents via the
pipe, and the `/achievements` POST is unchanged so it remains reusable on future jobs.

## 2. Draft modal → single-sentence editor

File: `src/components/strategy/AchievementDraftModal.tsx`.

- **Remove the Title field and the Metric field from the UI.** Keep `title` state,
  auto-set to `skill` (still sent to `POST /achievements` for Profile Bank reuse). Send
  `metric: null` (the metric now lives inside the sentence).
- The **Description** textarea becomes the single hero field (relabel to e.g.
  "Your achievement" / keep "Description (first person)" — keep it one field).
- **Placeholder-in-red + instruction.** Compute
  `const placeholder = (description.match(/\[[^\]]*\]/) || [])[0]`. Render a status line
  under the textarea:
  - If `placeholder` truthy → a callout using `warm.colors.danger` (`#B85C5C`) text on
    `warm.colors.dangerSoft` background: the literal `{placeholder}` in a `danger`-coloured
    span, then copy: *"Replace this with a real number — a metric makes this far stronger."*
  - Else → a positive line using `warm.colors.success` (`#2A9D6F`): *"Looks strong —
    ready to add."*
- Keep the existing "Suggested measure: …" helper (from `metricPlaceholder`) as a subtle
  hint under the field — it still guides what number to add.
- **Primary button** label → "Add to application". Add a caption beneath the action row:
  *"Also saved to your profile for future jobs."* Keep Cancel.
- Loading/disabled/saving states stay as-is (the 8-state coverage already exists).

The save behaviour is unchanged structurally (still POSTs to `/achievements`); only the
fields shown and the `onSaved` payload change.

## 3. Apply CTA differentiation

File: `src/components/strategy/AnalysisResult.tsx` (the sticky apply bar, ~line 123).

`bridgedIndices.size` is already in scope. Let `bridgedCount = bridgedIndices.size`.

- **`bridgedCount === 0` (default):** keep the current bar exactly (calm, secondary
  presence). Subtext: role · company.
- **`bridgedCount > 0` (elevated):**
  - Button gains an accent **glow ring** — `boxShadow: 0 0 0 4px rgba(<accentPetrol>,0.18), <existing soft shadow>` and slightly larger padding (`12px 26px`).
  - Subtext flips to: `✓ {bridgedCount} strength{bridgedCount > 1 ? 's' : ''} added — you're ready to apply`.
  - Smooth CSS transition on padding + box-shadow (`0.3s cubic-bezier(0.25,1,0.5,1)`).
    NOT a Framer keyframe pulse — the inline gap editor re-renders `AnalysisResult` on
    every keystroke, so a keyframe `animate` would replay constantly. Plain `<button>`
    with CSS transitions is the reliable choice.
  - Label stays "Apply now" + `ArrowRight`.

Accessibility: the button remains a real `<button>`, ≥44px tall, focus-visible ring
preserved.

## Files touched

| File | Change |
|---|---|
| `src/components/strategy/AchievementDraftModal.tsx` | Single-sentence editor; red placeholder + instruction; `onSaved(finalDescription)`; button copy |
| `src/components/strategy/AnalysisResult.tsx` | `onSaved` writes `bridgedText[draftIndex]`; sticky bar elevated state when `bridgedCount > 0` |

No backend changes. No schema changes. No test runner on the client — verified by `tsc` + `npm run build` + the manual smoke below.

## Testing

- **Typecheck/build:** `npx tsc --noEmit -p tsconfig.json` exit 0; `npm run build` succeeds.
- **Manual smoke (SHFPACT or any job):**
  1. Click **Draft** on a gap, edit the sentence to add a real number (e.g. "25%").
  2. The red placeholder line disappears and turns to the green "ready" line as the
     `[…]` is removed.
  3. Click **Add to application** → the gap shows as bridged with YOUR edited sentence.
  4. Apply bar elevates ("✓ 1 strength added — you're ready to apply").
  5. Generate résumé/cover letter → the **25% sentence appears** in a bullet/prose.
  6. Profile Bank still contains the saved achievement (reusable next job).

## Risks

- Rendering the placeholder in red is done via a separate status line (not inside the
  textarea), because a `<textarea>` cannot style substrings. This is the reliable choice;
  a contentEditable overlay was rejected as fragile.
- The Apply CTA uses CSS transitions, not a Framer keyframe — because the inline gap
  editor re-renders the component on every keystroke, a keyframe pulse would replay
  constantly. CSS transitions animate only on the actual style change.

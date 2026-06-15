# Selection Criteria — Frontend Flow (DeepSeek execution plan)

> **Zero-latitude plan.** Do exactly what each step says. Where a step says **STOP and report**, do not improvise — stop and surface the finding. Do not refactor anything not named here. Do not touch the backend.

**Goal:** Make the Selection Criteria (SC) experience detection-driven and single-action: detect SC from the job, route to it only when relevant, paste once, generate with one button on the new backend route, and show a live word counter. Remove the redundant toggle.

**Already done (backend — do not change):**
- Route `POST /generate/selection-criteria-structured` exists. Body: `{ jobDescription, selectionCriteriaText, jobApplicationId }`. Returns `{ content, id }`.
- It is the only route the SC step should call.

---

## Task 1 — Replace the redundant toggle with JD detection (`src/pages/StrategyHub.tsx`)

Context: line ~764 renders a toggle labelled **"Generate selection criteria responses"** backed by a `scToggle` state. Navigation to `/apply` passes `sc: scToggle` (lines ~522 and ~550). We are deleting the toggle and deriving `sc` from the job text.

- [ ] Step 1.1 — Add this helper near the top of the component file (module scope, after imports):
```ts
export const jdMentionsSelectionCriteria = (jd: string): boolean =>
  /selection criteria|key selection criteria|statement of claims|address the following criteria|capability statement/i.test(jd || '');
```
- [ ] Step 1.2 — Delete the `scToggle` state declaration and the toggle JSX block at ~line 764 (the row reading "Generate selection criteria responses" and its switch control). **STOP and report** if the toggle JSX is not a self-contained block you can remove without breaking surrounding layout.
- [ ] Step 1.3 — At both navigation sites (~522, ~550) replace `sc: scToggle` with `sc: jdMentionsSelectionCriteria(<the job description variable used in that scope>)`. Use the exact JD variable already in scope at each site; do not introduce a new fetch.
- [ ] Step 1.4 — Run `npx tsc -b` from repo root. Expected: no new errors. Fix any unused-import/variable errors caused by removing `scToggle`.

## Task 2 — SC step calls the new route (`src/pages/StepperWorkspace.tsx`)

Context: the manual generate function builds `let endpoint = '/generate/' + stepId;` then special-cases `resume` and `cover-letter`. SC currently falls through to the wildcard `/generate/selection-criteria`.

- [ ] Step 2.1 — Find the block (around line ~600) that sets `endpoint` for `resume` and `cover-letter`. Add an `else if` for SC:
```ts
} else if (stepId === 'selection-criteria') {
    endpoint = '/generate/selection-criteria-structured';
    payload.selectionCriteriaText = criteriaText.trim();
}
```
Use the existing SC criteria text state. There is already a line `if (isSC) payload.selectionCriteriaText = criteriaText.trim();` near the top of this function — if present, you may instead just change the endpoint and leave that line. **STOP and report** if `criteriaText` is not in scope in this function.
- [ ] Step 2.2 — Confirm the SC step no longer posts to `/generate/selection-criteria` (the wildcard). Grep the file for `selection-criteria'` usages in `api.post` and ensure only `selection-criteria-structured` remains for generation.
- [ ] Step 2.3 — `npx tsc -b`. Expected: clean.

## Task 3 — SC step is always reachable; show a "not found" note when the job has no SC (`src/pages/StepperWorkspace.tsx` + `src/components/CriteriaInputPanel.tsx`)

Context: `wantsSC = state.sc === true` (line ~167) controls whether the SC step is in the stepper. We keep that: when the job mentions SC, the step is in the flow after the cover letter. When it does not, the user can still open SC manually and must see a gentle note.

- [ ] Step 3.1 — Keep the SC step in the steps array when `wantsSC` (unchanged). Do NOT auto-add it when `!wantsSC`.
- [ ] Step 3.2 — Provide a discreet manual entry to SC when `!wantsSC`: in the workspace footer/secondary nav (find where step chips render, near the `steps.map`), render a small, low-emphasis text link "Responding to selection criteria?" that, when clicked, navigates to the SC step (set the current index to a SC step that you append as a hidden/optional step, OR set a local `scManual` boolean that forces the SC panel to render). **STOP and report** the exact mechanism you chose before implementing further, so the approach can be confirmed.
- [ ] Step 3.3 — In `CriteriaInputPanel.tsx`, when the panel is shown and the job did NOT mention SC (`!wantsSC`), render at the top of the panel this note (muted style, matching `warm.colors.textMuted`):
  > "We didn't find a selection criteria requirement in this job. If the role asks for one, paste it below. Otherwise you're done — focus on getting your application in."
  Pass `wantsSC` (or a `jobHasSC` boolean) into `CriteriaInputPanel` as a prop to drive this.
- [ ] Step 3.4 — Ensure the panel has exactly ONE primary action button: "Generate". Remove any secondary toggle/switch inside the panel if one exists. The paste field + one button only.

## Task 4 — Live word counter that turns red over a stated limit (`src/components/CriteriaInputPanel.tsx`)

- [ ] Step 4.1 — Add a helper to detect a stated word limit from the pasted criteria text:
```ts
const detectWordLimit = (t: string): number | null => {
  const m = (t || '').match(/(\d{2,4})\s*words?\b/i) || (t || '').match(/\bwords?\s*[:-]?\s*(\d{2,4})/i);
  return m ? parseInt(m[1], 10) : null;
};
```
- [ ] Step 4.2 — Below the generated response area (or below the criteria field if no response yet), show a live count: `${wordCount} words${limit ? ' / ' + limit + ' limit' : ''}`. Compute `wordCount` from the generated SC response text (split on whitespace, filter empties).
- [ ] Step 4.3 — When `limit` is set and `wordCount > limit`, render the counter in a red colour (use `warm.colors.danger` if it exists, else `#c0392b`). Otherwise use `warm.colors.textMuted`.
- [ ] Step 4.4 — `npx tsc -b`. Expected: clean.

## Final verification (do all, report results)
- [ ] `npx tsc -b` clean (frontend).
- [ ] Manual: apply to a job whose text contains "Selection Criteria" → after the cover letter the SC step appears; pasting criteria + Generate calls `/generate/selection-criteria-structured` and renders STAR responses with bold S:/T:/A:/R: labels.
- [ ] Manual: apply to a job with no SC mention → flow ends at Track; opening SC manually shows the "not found" note; the word counter appears and turns red when a limit is exceeded.
- [ ] Report any step where the existing code did not match this plan's assumptions.

# Resume Draft Modal Fix — Design

**Date:** 2026-05-11
**Status:** Approved (pending spec review)
**Scope:** ProfileBank welcome modal, baseline resume prompt, milestone modal removal

## Problem

Three issues are surfacing together for users who just completed the diagnostic and land on the Achievement Bank:

1. **"Resume not ready yet — check back in a moment."** error toast appears when the baseline resume is still generating in the background. Clicking the download button before generation completes produces a dead-end failure.
2. **Two modals stack.** The 70% milestone popup (`MilestoneModal`) fires when the completion score crosses 70 while the welcome modal is still open, rendering one on top of the other.
3. **Downloaded resume contains placeholder text** like `[Add: e.g. reduced processing time by X%]`. The generation prompt explicitly instructs the LLM to insert these. Users download the document and present it as-is to recruiters.

Additionally, the current welcome modal uses negative framing ("You know it's not working") and branches behaviour by completion score (≥ 75 vs. < 75). Strong-resume users can dismiss the wizard entirely.

## Goals

- Everyone goes through the optimisation wizard, regardless of resume quality.
- The welcome modal uses confident, positive framing.
- The baseline resume download never produces a dead-end error.
- Downloaded resumes contain no placeholder markers.
- No competing modals on the Achievement Bank page.

## Non-goals

- Backfilling existing baseline resumes in the database that already contain placeholders. Fresh users get clean output; existing documents stay as-is.
- Touching the wizard's per-section coaching content.
- Removing the wizard's per-step affirmations or feedback.

## Design

### 1. Baseline resume prompt — `server/src/services/baselineResume.ts`

Replace the placeholder instruction with a clean-formatting instruction. Current text:

```
- Where a quantified metric is absent, insert a placeholder in this EXACT format: [Add: e.g. reduced processing time by X%]
- Do NOT fabricate metrics or details not present in the original resume.
```

New text:

```
- Use only information explicitly present in the candidate's resume above.
  Do NOT insert placeholder text, bracketed prompts, or fill-in markers of any kind.
  If a metric is missing, write the bullet without it — clean, factual, action-led.
- Clean up formatting: consistent dates, proper section hierarchy, ATS-safe markdown headings,
  parallel bullet structure across roles.
- Do NOT fabricate metrics or details not present in the original resume.
- The output is a polished draft ready for immediate use as-is.
```

No other changes to that file. The function signature, DB write, and error handling stay the same.

### 2. Welcome modal — `src/components/ProfileBank.tsx`

The modal renders inside `showWelcomeModal && ...` at roughly line 1603. The branch for `hasCompletedOnboarding === true` is rewritten end to end. The `hasCompletedOnboarding === false` branch (the 3-step Achievement Bank explainer) is unchanged.

**Removed:**
- The "Here's your resume" / "You know it's not working. Ready to fix it?" copy block
- The competitive-gap framed sub-panel
- The `baselineDownloaded` state and its post-download success sub-modal ("Your resume is ready" with the "Start applying" / "Stay here" buttons)
- The conditional branching on `profile.completion.score >= 75`

**New copy:**

> **Claim your Personalised Resume Draft.**
>
> This is your strong foundation, built from your diagnostic and ready to use.
>
> Want to make it truly exceptional? Our optimisation wizard helps you add specific achievements and formats that get you noticed by hiring managers.
>
> Turn a strong start into an unstoppable application.
>
> **[ ↓ Let's get unstoppable ]** *(gradient button)*

**Structural notes:**
- No file icon at the top of the modal (the previous `<FileText>` icon block is removed).
- "Personalised Resume Draft" is bolded inline within the heading sentence.
- The button uses the existing orange → pink → violet gradient (`linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)`).
- Download icon is the only icon on the button. No trailing arrow.
- The close (×) button in the top-right is retained so the modal is dismissable, but the in-modal flow has a single primary CTA only.

### 3. Click handler — `handleBaselineDownload` in ProfileBank.tsx

The single button performs download then navigate, with no dead-end errors. New behaviour:

```
Click "Let's get unstoppable"
   │
   ▼
Button label → "Preparing your resume…"  +  spinner
Button disabled, baselineDownloading = true
   │
   ▼
GET /profile/baseline-resume
   │
   ├── status === 'ready'  ──►  fetch document  ──►  exportDocx  ──►  navigate('/setup')
   │
   └── status === 'pending'
            │
            ▼
       POST /profile/baseline-resume/generate   (idempotent, returns 'ready' or 'generating')
            │
            ▼
       Poll GET /profile/baseline-resume every 2s, up to 15 attempts (~30s)
            │
            ├── becomes 'ready'  ──►  fetch document  ──►  exportDocx  ──►  navigate('/setup')
            │
            └── timeout
                    │
                    ▼
               toast.info("Still preparing — opening your wizard so you can get started.")
               navigate('/setup')
```

**Implementation notes:**
- The polling loop uses a simple `for` with `await new Promise(r => setTimeout(r, 2000))`. No new dependencies.
- If the network call itself errors (5xx, connection drop), surface a brief toast ("Couldn't reach the server. Opening your wizard.") and still navigate to `/setup`. The user is never stranded on this modal.
- `setBaselineDownloading(false)` runs in `finally`.
- `dismissWelcomeModal()` is called before navigation so the modal closes cleanly on return.

### 4. Milestone modal removal

The 70% / 50% threshold popups are deprecated and stack on top of the welcome modal in some cases.

**Deleted from `src/components/ProfileBank.tsx`:**
- `activeMilestone` state (around line 1512)
- The `React.useEffect` that watches `profile.completion.score` and calls `setActiveMilestone` (around lines 1520–1533)
- The `<MilestoneModal milestone={…} … />` render at the bottom of the component (around line 1741)
- The `MilestoneModal` import
- The `prevScoreRef` ref (only used by the deleted effect)
- The `localStorage` keys `jobhub_milestone_50` and `jobhub_milestone_70` — no cleanup needed for existing users; they become inert reads.

**Deleted file:** `src/components/MilestoneModal.tsx`. Grep confirms no other importers.

**Preserved:** all per-section coaching and affirmations inside `SetupWizard.tsx` (the `COACHING` const and any congratulatory copy between steps). The wizard's own milestone-style feedback is unrelated and stays untouched.

## Files touched

| File | Change |
|---|---|
| `server/src/services/baselineResume.ts` | Replace placeholder instruction with clean-formatting instruction |
| `src/components/ProfileBank.tsx` | Rewrite the `hasCompletedOnboarding` modal branch; rewrite `handleBaselineDownload` with polling-then-advance; delete milestone state, effect, and render |
| `src/components/MilestoneModal.tsx` | Delete file |

## Out of scope

- No DB migration. Old documents with `[Add: …]` markers are left untouched.
- No changes to the wizard route, the wizard steps, or the wizard completion flow.
- No changes to the `/profile/baseline-resume` or `/profile/baseline-resume/generate` route handlers — they already support the polling pattern.
- No changes to the score-computation logic; the milestone removal is purely UI.

## Risks

- **Timeout users still see the wizard but no document.** Mitigated by the toast message and the fact that the wizard itself will let them generate documents downstream. Acceptable trade-off.
- **Existing users with placeholder-laden baseline resumes won't be auto-fixed.** Acceptable per the non-goals; if a user re-runs the diagnostic the new prompt applies. We can revisit if support requests come in.
- **The single-button flow couples download and navigation.** If a user wants the document without entering the wizard, they have to either close the modal (no download) or accept the auto-navigation. This is the intended product behaviour ("EVERYBODY goes through this process"), not a bug.

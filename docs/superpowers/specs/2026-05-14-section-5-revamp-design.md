# Section 5 Revamp: Diagnostic to Action Bridge

**Date:** 2026-05-14
**Status:** Draft for review

## Goal

Transform the diagnostic page from a static report into a conversational answer-and-action experience that:

1. Frames each section as the user's own implicit question (Q&A wrapper above all 5 cards).
2. Replaces the current Section 5 ("Your Next Three Moves") with a personalised solution-and-CTA block that connects each diagnosed problem to the specific JobHub capability that addresses it.
3. Removes friction between diagnosis and the user's first application.

## Non-goals

- Do not change the diagnostic LLM for sections 1 to 4. They keep their current personalised content.
- Do not introduce visual demo media (GIFs, screenshots) in this iteration. Copy-only first pass.
- Do not rebuild ProfileBank. Only modify the welcome-modal flow and the baseline-resume trigger point.
- Do not combine wizard steps in this iteration. Cert + volunteering combine is deferred to a later spec.

## Voice rules (calm-ally)

- **Avoid:** brutal, killing, crushing, rocket / fire emojis, "stop guessing", "stop getting rejected".
- **Prefer:** refine, optimise, streamline, guide, support, effective, precise, clear.
- The word lists are baselines, not ultimatums. Better alternatives in tone are welcome.
- **No em dashes anywhere in user-facing copy or LLM output.** Replace with commas, periods, or parentheses.
- No high-pressure sales. No FOMO bands. No competitor name-drops (no ChatGPT objection block).
- **Pattern for Section 5 moves:** acknowledge effort, pivot to JobHub capability framed against the user's situation, outcome.

---

## Architecture

### 1. Q&A wrapper for all 5 section cards

A new constant `SECTION_QUESTIONS` in `src/components/ReportExperience.tsx`, parallel to `SECTION_META`:

```ts
const SECTION_QUESTIONS: Record<string, string> = {
  targeting:      'Am I going after the right jobs?',
  document_audit: 'Is my resume actually doing its job?',
  pipeline:       'Where am I getting stuck?',
  honest:         "What's really holding me back?",
  fix:            'So how do I actually fix this?',
};
```

**Rendering:**

- Position: above each card, outside the card border.
- Font size: `clamp(22px, 4vw, 30px)`; weight 600; colour `theme.heading`; letter-spacing `-0.02em`.
- Margin: 36px top / 12px bottom (visually couples with the card below).
- Static text. Same for every user. No LLM involvement.
- The existing `SECTION_META` label chip ("01 TARGETING") stays inside each card. Different layers: chip = identification and progress, question = emotional context.

### 2. New Section 5 layout

Replace the current Section 5 card body. The new layout, top to bottom:

```
   Q: So how do I actually fix this?            (above the card)

  ┌─────────────────────────────────────────────────────────┐
  │  05  THE FIX                                          •  │
  │                                                          │
  │  Hey {firstName},                                        │
  │  Here is the path forward. Three moves, each tied to     │
  │  something the platform handles for you.                 │
  │                                                          │
  │  ┌─────────────────────────────────────────────────┐    │
  │  │  1. {LLM headline}                                │    │
  │  │                                                   │    │
  │  │  {LLM situation paragraph}                        │    │
  │  │                                                   │    │
  │  │  {LLM "how JobHub helps" paragraph}               │    │
  │  │                                                   │    │
  │  │  {LLM outcome line}                               │    │
  │  └─────────────────────────────────────────────────┘    │
  │  ┌─────────────────────────────────────────────────┐    │
  │  │  2. {LLM headline}                                │    │
  │  │  ... (same shape) ...                             │    │
  │  └─────────────────────────────────────────────────┘    │
  │  ┌─────────────────────────────────────────────────┐    │
  │  │  3. {LLM headline}                                │    │
  │  │  ... (same shape) ...                             │    │
  │  └─────────────────────────────────────────────────┘    │
  │                                                          │
  │   [ Start with your professional summary  →  ]           │
  │   First five tailored applications free. No card.        │
  └─────────────────────────────────────────────────────────┘

   [ Feedback widget: "How accurate was your diagnosis?" ]
```

The CTA button sits **inside** the Section 5 outer card but **outside** the three solution sub-cards, so it is always visible without expansion.

### 3. Per-move content generation (fully LLM-driven)

**No client-side templating of body copy.** Every paragraph the user reads in the three moves is produced by the diagnostic LLM, framed against the user's specific situation. This avoids mismatch where a stock paragraph asserts something the user's diagnosis does not support.

The diagnostic prompt is extended with two pieces:

**(A) Platform capability brief** in the system prompt. This grounds the LLM in what JobHub actually does so it can describe real capabilities without drift or hallucination:

```
JobHub platform capabilities:

- TARGETING: A Job Match Engine that scores live job descriptions against
  the user's specific profile. It identifies which roles align with the
  user's strengths, surfaces the points in their background that fit each
  role, and flags the gap between requirement and fit so the user can decide
  where to invest effort. (Lives in the JobFeed and Match Engine.)

- RESUME: A Resume Tailoring engine that rebuilds the user's resume against
  the language of a specific role, using a library of resumes that have
  landed interviews in Australia. The user's Achievement Bank supplies the
  substance; the engine handles framing, structure, and language.

- APPLICATIONS: A Document Generation engine that produces tailored cover
  letters and selection-criteria responses in roughly three minutes per
  application, drawing from the user's Achievement Bank. The user reviews
  and adjusts before sending.
```

**(B) Per-move emission instructions** appended to the existing report prompt:

```
For Section 5, emit three moves in this exact format. Use plain text labels.

### MOVE_TARGETING
HEADLINE: <4 to 7 word action-led headline grounded in this user's targeting situation>
SITUATION: <1 to 2 sentences naming this user's specific situation in this area. Acknowledge what they are already doing or attempting. No agitation, no jargon.>
JOBHUB: <1 to 2 sentences explaining how the TARGETING capability helps THIS user with THIS situation. Frame against their specific need, not generic AI claims.>
OUTCOME: <1 sentence describing the concrete change for them>

### MOVE_RESUME
HEADLINE: ...
SITUATION: ...
JOBHUB: ...
OUTCOME: ...

### MOVE_APPLICATIONS
HEADLINE: ...
SITUATION: ...
JOBHUB: ...
OUTCOME: ...

Voice rules: calm, plain language, calm-ally tone. Use "you" not "the user".
No em dashes, no exclamations, no words from the avoid list (brutal, killing,
crushing, etc.). Each paragraph short and independent.
```

**Client-side parsing:** a new helper `parseFixMoves(markdown)` returns:

```ts
type Move = { headline: string; situation: string; jobhub: string; outcome: string };
type FixMoves = { targeting: Move; resume: Move; applications: Move };
```

The parser is regex-based and tolerant. If a key is missing or malformed, that move falls back to a generic placeholder ("Here is how we would approach this part for your situation.") and a console warning is logged. The diagnostic still renders.

**Rendering:** the four parts of each move stack vertically inside the sub-card. The headline sits as a small section header (size `clamp(16px, 2.6vw, 18px)`, weight 700). `SITUATION`, `JOBHUB`, and `OUTCOME` render as plain paragraphs separated by 10px spacing. The labels themselves (`SITUATION:`, etc.) are stripped during parsing and never shown to the user.

**Worked example (illustrative LLM output, not a template):**

> **1. Aim sharper at the right roles**
>
> Your background in financial modelling positions you well for analyst roles that bridge finance and marketing.
>
> JobHub's Match Engine reads job descriptions against your profile and surfaces the analyst-flavoured roles where your existing analytical foundation is the unlock, along with the specific lines from your background that fit each one.
>
> You stop scanning postings blind and start seeing which ones you are already competitive for.

**Future iteration (out of scope here):** an optional second-pass validator LLM call that checks each emitted move for shape compliance and tone violations before the report is shown. For now, primary emit + tolerant parser is sufficient.

### 4. Removals from `ReportExperience.tsx`

- Generic CTA block ("You have the experience. Now let's build the narrative."). Currently lines ~1099 to 1149.
- Referral block ("Know someone in the same boat?"). Currently lines ~1152 to 1199.
- Dashboard-skip link ("Already have an account? Go to the dashboard →"). Relocate to a small text link in the diagnostic header (next to or below the existing theme toggle) so returning users can still escape without scrolling to the bottom.
- Sticky bar: **keep for now**, but update its CTA copy and styling to match the new button (no gradient). Reassess after telemetry.

### 5. Skip the ProfileBank welcome modal

**Today:** diagnostic CTA -> `navigate('/workspace')` -> `ProfileBank` renders -> welcome modal opens -> "Download & Continue Building →" triggers baseline-resume generation via `POST /profile/baseline-resume/generate` -> modal dismisses -> user enters wizard.

**New:** diagnostic CTA -> wizard step 1 (Professional Summary) renders immediately. No modal.

To preserve the baseline-resume artifact:

- **Server-side:** kick off `POST /profile/baseline-resume/generate` automatically on diagnostic completion (when `report.status` flips to `COMPLETE`). The job runs in the background while the user reads the diagnostic.
- **Client-side:** the wizard chrome gains a small "Download my baseline resume" link (top-right). It shows "Generating…" while the job is in flight, "Download" when ready, "Retry" on failure. Available throughout the wizard, no gating.

---

## Components touched

| File | Change |
|---|---|
| `src/components/ReportExperience.tsx` | Add Q&A wrapper above each card, replace Section 5 layout, remove old CTA + referral blocks, relocate feedback widget, update sticky-bar copy and styling. |
| `src/lib/parseReport.ts` | Add `parseFixMoves` helper that splits Section 5 markdown into three structured `Move` objects with tolerant fallbacks. |
| `src/components/ProfileBank.tsx` | Suppress the welcome modal when arriving from the diagnostic flow (see Open Question #1). Remove the modal-driven baseline-resume trigger if it becomes orphan. |
| `src/pages/SetupWizard.tsx` | Add baseline-resume download link to wizard chrome with Generating / Download / Retry states. |
| `src/App.tsx` | Diagnostic CTA route target. See Open Question #1. |
| `server/src/routes/onboarding.ts` (or wherever the diagnostic prompt lives) | Extend prompt with platform capability brief and `MOVE_*` emission spec. Trigger baseline-resume generation when `report.status` flips to `COMPLETE`. |
| `src/lib/analytics.ts` | Add events: `section_5_cta_clicked`, `baseline_resume_downloaded_from_wizard`. |

---

## Data flow

```
intake submit
   ↓
POST /onboarding/start
   ↓
diagnostic LLM (emits 5 sections; Section 5 emits structured MOVE_TARGETING / MOVE_RESUME / MOVE_APPLICATIONS)
   ↓
report.status = COMPLETE
   ├─→ background: POST /profile/baseline-resume/generate
   ↓
client polls GET /onboarding/report
   ↓
ReportExperience renders:
   • Q&A-wrapped sections 1 to 4 (existing personalised content)
   • New Section 5: parsed MOVE_* objects rendered as 3 sub-cards + always-visible CTA
   • Feedback widget below the CTA
   ↓
user clicks "Start with your professional summary →"
   ↓
navigate to wizard step 1 (no welcome modal)
   ↓
wizard chrome shows download link for the (likely-ready) baseline resume
```

---

## Testing

- **Visual walkthrough** in light + dark mode: intake -> diagnostic -> wizard step 1. Confirm Q&A wrapper renders correctly, Section 5 reads in calm-ally voice with personalised content, CTA always visible, no welcome modal appears.
- **Voice audit:** run the new prompt against 3 to 5 sample profiles. Confirm no em dashes, no avoid-list words, no generic-sounding paragraphs.
- **Edge cases:**
  - LLM emits malformed `MOVE_*` subsection (missing key, wrong order): that move falls back to "Here is how we would approach this part for your situation." Warning logged. Other moves and the rest of the report still render.
  - Baseline-resume generation fails: wizard download link shows "Retry".
  - User reaches wizard before diagnostic completes (race): wizard renders normally; download link shows "Generating…".
- **Analytics:** confirm `section_5_cta_clicked` fires before navigation.
- **Type-check + existing tests pass.**

---

## Open questions for implementation

1. **Wizard route.** Today there is no `/wizard` route. Wizard renders inside `/workspace` after ProfileBank. Pick one:
   - Add a dedicated `/wizard` route that mounts `SetupWizard` directly, OR
   - Keep `/workspace` but pass `?from=diagnostic` and have ProfileBank suppress its welcome modal when that param is present.

   **Recommendation:** option 2 for this iteration (smaller blast radius), option 1 in a later cleanup.

2. **Sticky bar copy and styling.** Current sticky bar uses gradient buttons that violate the calm-ally palette. Update its CTA copy and visual treatment to match the new button. Confirm the change is in scope here, or split into a follow-up.

3. **Validator pass.** The "scan by an LLM as a check" idea: defer to a future iteration once we see real LLM output quality from the new prompt. Add it only if shape failures or voice drift show up in production.

---

## Out of scope (future iterations)

- Visual demo media (GIFs / screenshots) per move.
- Video introductions per move.
- A/B test of the calm-ally Section 5 vs a high-agitation variant.
- Pricing-page section that explains JobHub vs ChatGPT in detail.
- Combining certifications + volunteering into a single wizard step.
- Optional second-pass LLM validator on Section 5 emit.

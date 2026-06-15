# De-frictioned Apply Workspace (Slice C) — Design Spec

**Date:** 2026-06-05
**Status:** Approved-pending-spec-review
**Builds on:** [[project_fix_resume_flow_brainstorm]], [[project_monetization_model]]. Picks up the seam left by `docs/superpowers/specs/2026-06-04-fix-my-resume-job-modal-design.md` ("your workspace is being prepared…").

---

## 0. Where this sits in the epic

The full funnel the user described decomposes into four subsystems:

| # | Subsystem | Status |
|---|-----------|--------|
| **A** | Account seam (anonymous `scanId` → account) | later slice |
| **B** | Streamlined dashboard (`StrategyHub` → one Apply-now outcome) | later slice |
| **C** | **De-frictioned apply workspace** | **THIS SPEC** |
| **D** | Video interstitial + 7-day challenge on first Apply | later slice |

**C is self-contained inside `StepperWorkspace.tsx` + the two generation prompts + one new modal.** It changes only what happens *inside* `/apply`; it does not touch auth, the dashboard, or the entry points. `/apply` stays reachable from its current callers (`StrategyHub`, `JobCard`) throughout.

---

## 1. Goal

A free user lands on `/apply` and gets **finished, high-quality resume + cover letter with effectively zero work**: no analysis screen, no "Generate" button, no `[VERIFY]` placeholder chips. The instant they arrive, analysis runs; a quick modal double-checks 2–3 strengths; then both documents generate in parallel and reveal **pristine**. Their only job is to read once, optionally trim, and download.

**Locked product decisions (do not re-litigate):**
- **Keep the existing Stepper steps** (Resume → Cover Letter → [SC] → Track), but **pre-generate resume + cover letter in parallel** on entry so each step is already finished when reached.
- **No-placeholder rule = omit/soften, never fabricate.** When a specific detail (a metric, a cert) is genuinely unknown, the generator omits or rephrases around it. It NEVER invents a number/credential, and it NEVER emits a bracketed placeholder.
- The upfront modal collects **only** the highest-value gaps (the bridgeable skills already surfaced by `/analyze/dual`). No extra fields.
- **Gaps precede generation** (not overlapping) — deliberately, so documents never visibly rewrite themselves.
- **Regenerate stays** as a quiet secondary button.

**Honor:** [[feedback_six_second_report]] (tight copy), [[feedback_purposeful_animation]] (motion points at the next action), [[feedback_dashboard_style]] (reuse `warm` tokens — no new aesthetic), [[feedback_copy_ownership_split]] (Claude authors all copy + prompt text in a locked file; DeepSeek transcribes mechanics), [[feedback_robust_over_quick]].

---

## 2. End-to-end flow (this slice)

```
User navigates to /apply  (from JobCard today; from dashboard in Slice B)
   │  location.state = { jobDescription, company, role, sc?, feedItemId, sourceUrl, sourcePlatform, bridgedGaps? }
   ▼
StepperWorkspace mounts
   │
   ├─ IF state.bridgedGaps present (legacy path from StrategyHub analysis screen)
   │     → use them verbatim; SKIP derivation + modal; go straight to parallel generation.
   │
   └─ ELSE (the live path — JobCard / future dashboard pass no gaps)
         1. Resume step shows an "assembling" shimmer immediately.        ← perceived "already working"
         2. POST /analyze/dual { jobDescription }  (background)
              → DualSignalResult; take fitBands.bridgeableGap.items (top 3).
         3a. IF ≥1 gap → open GapConfirmModal over the workspace.
              user confirms / unticks / lightly edits → confirmedGaps.
         3b. IF 0 gaps OR analyze fails/404 → no modal; confirmedGaps = [].
         4. Fire BOTH generations in parallel with confirmedGaps:
              POST /generate/resume-structured
              POST /generate/cover-letter-structured
            Persist + reveal each as it lands. Cover finishes in the background,
            so advancing Resume → Cover Letter is instant.
   ▼
Steps: Resume (done) → Cover Letter (done) → [Selection Criteria, manual, unchanged] → Track (unchanged)
```

**Sequencing rationale:** the instant-on work is the **analysis**, not generation. Generation fires the moment gaps are confirmed. This avoids a generate-then-regenerate flicker and the placeholder problem (generating without the confirmed strengths would force omissions we'd then have to redo).

---

## 3. Components & changes

### 3.1 `StepperWorkspace.tsx` — orchestration (the core refactor)

**A workspace-level generation orchestrator.** Generation is lifted out of per-step button clicks into an entry-driven flow:

- New state at the `StepperWorkspace` level: `gaps: BridgedGap[]`, `gapsPhase: 'deriving' | 'confirming' | 'ready'`, and a generation kickoff that runs **both** resume + cover-letter generations once `gapsPhase === 'ready'`.
- On mount (live path): set `gapsPhase='deriving'`, call `/analyze/dual`. On result, set `gaps` + `gapsPhase='confirming'` (opens modal) — or `gapsPhase='ready'` with `gaps=[]` if none/error.
- On modal confirm: store confirmedGaps, set `gapsPhase='ready'`.
- When `gapsPhase==='ready'`: kick off resume + cover-letter generation in parallel, writing each to the existing `saveDraft(workspaceKey, step, …)` localStorage slots as they resolve. (Re-uses the existing `/generate/resume-structured` and `/generate/cover-letter-structured` endpoints and payload shapes — including `bridgedGaps`, `analysisContext`, `companyIntel` — unchanged.)
- Legacy path (`state.bridgedGaps` present): set `gaps` from state, `gapsPhase='ready'` immediately (no analyze, no modal).

**`DocumentStep` changes:**
- Remove the **Generate** button, the empty-state "Click Generate…" block, and `handleContinueWithVerifyCheck`'s "continue anyway" warning. The continue button just continues.
- The step reads draft state from localStorage as today, but also reflects the orchestrator's **assembling** state: if this step has no draft yet and generation is in-flight, show `GenerationProgress` (existing component) instead of the empty state.
- **Keep:** inline Edit (the trim pass), Copy, Download split, Review/critique, Regenerate (quiet ghost button — manual redo only), Back-never-regenerates.
- SC step: unchanged (manual paste → generate). It is NOT pre-generated.

**Remove the VERIFY UI entirely** (lines ~60–276 region):
- Delete `VerifyMarker`, `replaceVerifyMarkersInString`, `processMarkers`, `VERIFY_MARKER_RE`, `VERIFY_TOKEN_RE`, `hasVerifyTokens`, and the marker-aware `MARKDOWN_COMPONENTS` overrides — render markdown plainly with default components (keep the `HEADING_COLOR`/`STRONG_COLOR` styling, just drop the `processMarkers` wrapping).
- Extend `sanitizeContent` to **strip** any stray bracketed placeholder token entirely (belt-and-suspenders so nothing bracketed can ever render even if a model slips):
  ```
  .replace(/\[(?:VERIFY|ADD|INSERT|TBD|PLACEHOLDER)\b[^\]]*\]/gi, '')
  ```
  (collapse any doubled spaces left behind).

### 3.2 `GapConfirmModal.tsx` — NEW component

A centered modal over the workspace, built with `warm` tokens + framer-motion to match the existing surface.

**Props:** `{ gaps: BridgedGap[]; onConfirm: (confirmed: BridgedGap[]) => void; }` (no dismiss-to-cancel; closing = confirm-with-current).

**Behaviour:**
- Renders up to **3** gap cards. Each is **pre-checked** with the default `statement` (callers pass `capabilityStatement(suggestion)`-derived defaults — machinery already in `src/lib/bridgedGaps.ts`).
- Each card: skill label + a single editable line bound to that gap's `statement`; a checkbox to untick (excludes it).
- One primary **"Looks right →"** button → `onConfirm(checkedGaps)`. Dumbest-customer taps once.
- All copy from `applyWorkspaceCopy.ts`.

### 3.3 Generation prompts — no-placeholder rewrite (server)

**`server/src/services/prompts/resumeStructuredPrompt.ts`** — replace the CONSTRAINTS line 199:
- REMOVE: `- Only use a [VERIFY: ...] token when a needed fact is genuinely absent…`
- REPLACE WITH a no-placeholder rule (exact text authored by Claude in the plan): never emit `[VERIFY]`, `[ADD]`, `[TBD]`, `[PLACEHOLDER]`, or any bracketed gap marker; when a needed specific is absent from CANDIDATE DATA, omit it or rephrase around it; never fabricate a number/metric/credential.

**`server/src/services/prompts/coverLetterSlotsPrompt.ts`** — replace the CONSTRAINTS line 203 identically.

Both prompts already carry strong anti-fabrication guards (resume:201, cover:121/190) and a "Do not write placeholder text" rule for missing sections (resume:133) — the change only removes the explicit *instruction to emit* `[VERIFY]` tokens and forbids them outright. The `CONFIRMED CAPABILITIES` block (resume:113–121, cover:108–113) that consumes `bridgedGaps` is unchanged.

### 3.4 `applyWorkspaceCopy.ts` — NEW locked copy file (Claude-authored)

All user-facing strings for this slice: the GapConfirmModal header/sub/CTA, the "assembling" line, and the workspace "read once, trim, download" framing. Single source of truth; DeepSeek imports + renders verbatim, never inlines or rewords. (Mirrors the `fixMyResumeCopy.ts` convention.)

---

## 4. Data flow & contracts (all existing, reused)

- `POST /analyze/dual` → `DualSignalResult` (see `AnalysisResult.tsx:34`). Consume only `fitBands.bridgeableGap.items: Array<{ skill, suggestion }>`.
- `BridgedGap = { skill: string; statement: string }` (`src/lib/bridgedGaps.ts`). Default statement = `capabilityStatement(item.suggestion)`.
- `POST /generate/resume-structured` body: `{ jobDescription, bridgedGaps }`.
- `POST /generate/cover-letter-structured` body: `{ jobDescription, analysisContext:{tone,company,title}, companyIntel, bridgedGaps }`.
- Persistence: `saveDraft(workspaceKey, 'resume'|'cover-letter', { content, generatedAt, edited })` — unchanged localStorage keys.

No new endpoints, no schema/Prisma changes, no new env vars.

---

## 5. Error handling

| Case | Behaviour |
|---|---|
| `/analyze/dual` 404 (no profile) | No modal; `gaps=[]`; generation proceeds. (Profile-less generation already handled by existing 404 toast on generate.) |
| `/analyze/dual` 402 / 503 / network | No modal; `gaps=[]`; generation proceeds. Non-fatal — analysis is an enhancer here, not a gate. |
| 0 bridgeable gaps returned | No modal; generation proceeds immediately. |
| Generation fails (resume or cover) | Existing per-step error toast (402/404/other). The failed step shows its empty/error path; Regenerate available. The other doc is unaffected. |
| `state.bridgedGaps` present (legacy) | Skip analyze + modal entirely; generate with those gaps. |
| Model slips a `[VERIFY]` token through | `sanitizeContent` strips it on load + on save; never renders. |

---

## 6. Testing

**Server (Vitest, colocated):**
1. `resumeStructuredPrompt` builder: assert output does NOT contain `[VERIFY` and DOES contain the no-placeholder phrase.
2. `coverLetterSlotsPrompt` builder: same two assertions.
3. Existing `server/src/tests/bridgedGapsGeneration.test.ts` stays green (CONFIRMED CAPABILITIES block unchanged).

**Client:**
4. `npx tsc -p tsconfig.json --noEmit` clean.
5. Manual `/apply` run (from a JobCard "Prepare & apply"): land → Resume shimmer → GapConfirmModal with ≤3 pre-checked cards → "Looks right" → both docs reveal finished with **zero brackets** → advance to Cover Letter is instant → trim/download works.

---

## 7. Files

**New:**
- `src/components/GapConfirmModal.tsx`
- `src/pages/applyWorkspaceCopy.ts` (Claude-authored, locked)

**Modified:**
- `src/pages/StepperWorkspace.tsx` — entry orchestration (analyze → modal → parallel gen), remove Generate button + VERIFY UI, extend `sanitizeContent`.
- `server/src/services/prompts/resumeStructuredPrompt.ts` — no-placeholder rule.
- `server/src/services/prompts/coverLetterSlotsPrompt.ts` — no-placeholder rule.
- (+ two new colocated prompt-builder tests.)

**Untouched:** all entry points (`JobCard`, `StrategyHub`), all `/generate` + `/analyze` routes, Track step, SC step, exporters, auth, dashboard.

---

## 8. Out of scope (do NOT build in C)

Account seam (A), dashboard streamlining (B), video + 7-day challenge (D), the SC step flow, any backend route/schema changes, removing the legacy `state.bridgedGaps` path (it stays as a compatibility seam until Slice B retires the analysis screen).

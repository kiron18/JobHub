# Generators Use All Their Data (Bridged Gaps + Faithfulness Bundle)

**Date:** 2026-05-31
**Status:** Approved (design)
**Owner:** apply flow

## Problem

The analysis screen lets a user "bridge" their skill gaps — either by **ticking** a
suggested capability or by **editing** one into a personalised statement. This is a
core interaction. But the bridged gaps never reach the generated documents:

- `AnalysisResult.tsx` keeps the ticked set (`bridgedIndices`) as **local component
  state**. It is never lifted to `StrategyHub`, so it is lost the moment the user
  navigates to `/apply`.
- `StepperWorkspace` generates the résumé with a payload of just `{ jobDescription }`
  and the cover letter with `{ jobDescription, analysisContext, companyIntel }`.
  Neither carries gap data.

Observed consequences in QA (`QA test 3.txt`):
- Résumé skills/bullets are nearly identical across four very different jobs.
- A cover letter **contradicted** a bridged Adobe gap ("Although I have not had
  direct experience with Adobe Creative Suite…") because the bridge never arrived.
- Manually-edited bridges with real metrics (21% productivity, 150% output) were
  dropped entirely.

## Goal

Make the two generators **faithfully use all the data they are given**. Concretely this
bundles five tightly-coupled QA findings that all live in the same generator surface
(`resume-structured`, `cover-letter-structured`, and their prompt files):

1. **(QA #1)** Thread bridged gaps from the analysis screen through to both documents,
   **without ever fabricating a metric**, surviving a page refresh.
2. **(QA #2)** Contradiction guard — the cover letter never disclaims claimed experience.
3. **(QA #3)** Résumé actually tailors — JD tools/skills reach the Skills section.
4. **(QA #5)** Salutation cleanup — always use the suggested contact, cleanly formatted.
5. **(QA #6)** Stop `[VERIFY:]` firing when the data exists; best-effort proofread pass.

Doing these together avoids contradictory prompt edits and one risky second pass through
the same files.

**Out of scope (separate follow-up spec):** QA #4 — analysis determinism (the
`/analyze/dual` endpoint + `StrategyHub`). That is a *different subsystem* (re-running a
job reshuffles the gaps); folding it in would mix two unrelated machines and reduce build
stability. This spec's sessionStorage persistence handles *refresh* randomness; #4 handles
*re-analyse* randomness and gets its own spec → plan. Company Insight JSON reliability was
already addressed (commit `808c837`); only the salutation *usage* (#5) is in scope here.

## Data model

A bridged gap is one object:

```ts
// src/lib/bridgedGaps.ts (new shared module)
export interface BridgedGap {
  skill: string;      // the gap label, e.g. "Experience using website CMS platforms"
  statement: string;  // the committed sentence (see derivation below)
}
```

### Deriving `statement`

| User action | `statement` value |
|---|---|
| Ticked, not edited | The suggestion with any **metric clause that contains a `[…]` placeholder removed** → a clean capability. e.g. `"Developed and implemented a comprehensive social media strategy that increased brand engagement by [X]%"` → `"Developed and implemented a comprehensive social media strategy"` |
| Edited (draft) | Exactly what the user typed, verbatim (e.g. `"…increased brand engagement by 20%"`) |

The stripper is a small, unit-tested pure function `capabilityStatement(suggestion)`
in the shared module. It removes a trailing clause introduced by `by`, `resulting in`,
`reaching`, `for`, or a comma, **only when that clause contains a `[…]` placeholder**.
If no placeholder is present, the suggestion is returned unchanged. This guarantees no
`[X]` ever survives into a document and no real metric is ever stripped.

### Integrity rule

No fabricated numbers reach any document. Enforced in two places:
1. UI default = capability phrasing (placeholder stripped).
2. Backend prompt instruction: "These are capabilities the candidate has confirmed.
   Weave them in as genuine experience. **Never invent numbers or metrics** — use only
   metrics already present in the statement text."

### Contradiction guard (cover letter)

QA showed a cover letter that *denied* a capability the user had just bridged
("Although I have not had direct experience with Adobe Creative Suite…"). Passing the
bridged gap (above) removes the root cause, but we also add an explicit guard so the
letter can never disclaim claimed experience:

- The cover-letter prompt gets a hard rule: **never state, imply, or hedge that the
  candidate lacks, has not used, is unfamiliar with, or is only "eager to learn" any
  skill that appears in the candidate's confirmed profile skills OR the bridged gaps.**
- Banned phrasings include "although I have not…", "while I don't have direct
  experience with…", "I lack…", "I am eager to learn…". The model must **omit** a
  weakness rather than narrate it — a hard gap the candidate genuinely lacks is simply
  not mentioned, never explicitly disclaimed.

Scope decision (stated, not asked): the guard covers **confirmed profile skills + bridged
gaps**, not every keyword in the JD — so the model still won't over-claim a skill the
candidate has never indicated.

## UI: nudge to add a metric

On the Bridgeable Gap card (`AnalysisResult.tsx`), when an item is bridged, show a
one-line hint beneath it: **"Tip: edit in a real metric to stand out."** The edit path
already exists via `AchievementDraftModal`; this design only adds the hint and wires the
default (ticked-but-unedited) statement to the capability-stripped text. No new modal.

## Data flow (4 hops)

```
AnalysisResult ──onBridgedGapsChange(gaps)──▶ StrategyHub
StrategyHub ──navigate('/apply', { state: { …, bridgedGaps } })──▶ StepperWorkspace
StepperWorkspace ──payload.bridgedGaps──▶ /generate/resume-structured
                 └─payload.bridgedGaps──▶ /generate/cover-letter-structured
generate.ts ──inject into prompts──▶ documents
```

1. **`AnalysisResult.tsx`** — add prop `onBridgedGapsChange?: (gaps: BridgedGap[]) => void`.
   On every tick/untick/edit, recompute the `BridgedGap[]` (using `capabilityStatement`
   for un-edited items) and call the callback. Add the metric hint line.
2. **`StrategyHub.tsx`** — hold `bridgedGaps` state, pass `onBridgedGapsChange`, and
   include `bridgedGaps` in the `/apply` navigation `state` in `handleContinue`.
3. **`StepperWorkspace.tsx`** — read `state.bridgedGaps`; add `bridgedGaps` to **both**
   the `resume-structured` and `cover-letter-structured` payloads.
4. **`server/src/routes/generate.ts`** — both endpoints accept `bridgedGaps?: BridgedGap[]`.

## Refresh survival

`location.state` is wiped on a hard refresh, which today bounces `/apply` back home and
would lose the bridged gaps. To make the flow deterministic:

- On `StepperWorkspace` mount, when `location.state` is **present**, persist the full
  entry context (`jobDescription`, `sc`, `company`, `role`, `feedItemId`, `sourceUrl`,
  `sourcePlatform`, `bridgedGaps`) to **`sessionStorage`** under a single key
  (`apply:context`).
- When `location.state` is **empty** (a refresh), rehydrate the context from
  `sessionStorage` instead of treating the JD as empty and navigating away.
- `sessionStorage` (not `localStorage`) so the context is tab-scoped and naturally
  cleared when the tab closes — it should not resurface in an unrelated future visit.

This is a holistic fix: the entire apply flow (and its bridged gaps) survives refresh,
not just the gaps.

## Backend prompt injection

### Cover letter (`/cover-letter-structured` → `COVER_LETTER_SLOTS_PROMPT`)
Add a `bridgedGaps` section to the prompt: a bullet list of `statement` values under a
header explaining they are confirmed capabilities to weave in naturally, with the
no-fabrication instruction above. The model already receives `companyIntel`; this slots
in alongside. The prompt also gains the **contradiction guard** (see Integrity rule) —
the rule applies whether or not any gaps were bridged, since the denial anti-pattern can
surface for plain profile skills too.

### Résumé (`/resume-structured`, two-stage pipeline)
- **Stage 1 (Blueprint, Claude):** pass the bridged `statement`s into the blueprint
  input so the strategy accounts for them (coherence — so a bullet and the summary don't
  conflict).
- **Stage 2 (structured JSON, Llama → `RESUME_STRUCTURED_PROMPT`):** instruct the model
  that each bridged gap should become **a tailored work-experience bullet under the most
  relevant role**, and that any **named tool/skill** in a statement (Adobe Creative
  Suite, Mailchimp, a CMS, etc.) should also be **added to the Skills section**. This is
  the "bullet + skill" decision and directly fixes the static-résumé problem.

## Bundled generator-faithfulness fixes

### QA #3 — Résumé Skills section reflects the JD (beyond bridged gaps)
QA showed an identical Skills block across four very different jobs. Independently of
bridged gaps, the Stage-2 résumé prompt instruction is strengthened: the Skills section
must **surface tools/platforms named in the job description that the candidate
legitimately holds** (from profile skills, experience, or bridged gaps). It must **not**
invent a tool the candidate has never indicated. Net effect: a Mailchimp/Adobe/CMS role
produces a Skills block that names those tools when the candidate has them, instead of a
frozen default list.

### QA #5 — Salutation from the suggested contact
`companyIntel.suggestedContact.title` is sometimes ignored (generic "Dear Hiring
Manager") and, when used, was pasted verbatim including a clunky parenthetical
("…(National Partnership Office, Surry Hills)"). Fix:
- When `companyIntel.suggestedContact.title` is present, the cover-letter prompt **must**
  use it for the salutation rather than defaulting to "Dear Hiring Manager".
- Strip any trailing parenthetical and collapse an "X or Y" title to the first option, so
  the greeting reads "Dear Head of Marketing," not the full descriptor. Done as a small
  helper applied to the title before it enters the prompt (sits next to the existing
  `clean()` citation-stripping in `companyIntel.ts`).

### QA #6 — `[VERIFY:]` only when data is genuinely missing; proofread
- The generators currently emit `[VERIFY: number of]` even when the figure ("150+
  assets") is present in the achievements. Prompt instruction: **only** emit a
  `[VERIFY:]` token when the needed fact is absent from the provided
  profile/achievements/JD — never when a value is already available.
- Add a closing proofread instruction to both prompts: "Re-read the final text; every
  sentence must be grammatical and complete." This is **best-effort** quality nudging
  (model-dependent), not a guaranteed fix for fragments like "I am a who is…".

## Files touched

| File | Change |
|---|---|
| `src/lib/bridgedGaps.ts` (new) | `BridgedGap` type + `capabilityStatement()` helper |
| `src/lib/bridgedGaps.test.ts` (new) | Unit tests for the stripper |
| `src/components/strategy/AnalysisResult.tsx` | Lift bridged gaps via callback; metric hint; default statement = capability |
| `src/pages/StrategyHub.tsx` | Hold `bridgedGaps`; include in `/apply` nav state |
| `src/pages/StepperWorkspace.tsx` | Read `bridgedGaps`; add to both payloads; sessionStorage persist/rehydrate of entry context |
| `server/src/routes/generate.ts` | Accept `bridgedGaps` on both structured endpoints; pass to prompts/blueprint |
| `server/src/services/prompts/coverLetterSlotsPrompt.ts` | Bridged-gaps section; contradiction guard; salutation-from-contact rule (#5); `[VERIFY:]`-only-when-missing + proofread (#6) |
| `server/src/services/prompts/resumeStructuredPrompt.ts` | Bridged-gaps → bullets + skills; JD-tool surfacing (#3); `[VERIFY:]` + proofread (#6) |
| `server/src/services/companyIntel.ts` | `salutationTitle()` helper — strip parenthetical / "X or Y" → first option (#5) |
| `server/src/services/generation.ts` (blueprint) | Accept bridged statements into blueprint input |

## Testing

- **Unit:** `capabilityStatement()` — placeholder clause stripped; no-placeholder
  unchanged; multiple clause forms (`by`, `resulting in`, `reaching`, comma).
- **Unit:** `salutationTitle()` (#5) — strips trailing parenthetical; "Head of Marketing
  or Marketing Manager" → "Head of Marketing"; empty/undefined → falls back to null.
- **Integration (API):** POST both structured endpoints with `bridgedGaps`; assert the
  statements/skills surface in output and no `[…]` placeholder appears. For the cover
  letter, assert the output contains **no denial phrasing** ("have not had experience",
  "I lack", "eager to learn") for any confirmed/bridged skill, and that the salutation
  uses the suggested-contact title when present (#5).
- **Manual:** re-run a QA job (e.g. Temperzone): tick Adobe gap → confirm résumé Skills
  lists Adobe and the cover letter no longer denies Adobe experience; refresh `/apply` →
  confirm gaps persist. Confirm Skills block differs across two different-domain jobs
  (#3) and that a known figure ("150+ assets") is not replaced by `[VERIFY:]` (#6).

## Risks / notes

- The stripper is heuristic. Mitigated by: only stripping clauses that contain a `[…]`
  placeholder, plus full unit coverage. Worst case it leaves a slightly long sentence —
  never fabricates and never drops a real metric.
- No schema/migration changes. Pure request-payload + prompt + client-state work.

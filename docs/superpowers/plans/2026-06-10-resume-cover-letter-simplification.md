# Resume + Cover Letter Simplification Plan

> **Status:** Decisions locked (section 7). Executable breakdown in Part B.
> **Progress:** Phase 0 done (dead components deleted, frontend typecheck clean). Phase 1 done (both structured routes collapsed to one Claude pass, blueprint + classifier removed, contract frozen, server typecheck clean, generation tests green, no new regressions vs baseline). Wildcard `/generate/resume` dead block deferred to final sweep (unreachable, harmless). Prompt rewrite (Phase 2) is next — output quality is still intermediate until then.

**Goal:** A user clicks Apply on a job and gets a genuinely good, well-formatted resume and cover letter, fast. Nothing else.

**Core move:** Stop using two models (a Claude "strategist" plus a weak Llama "executor") with a wall of patches to babysit the weak one. Use one capable model that reads the full resume and the job description and writes both documents in a single pass, output as structured JSON, rendered by the template code you already have.

---

## 0. Hard constraints (non-negotiable, gate every task)

**C1 — The output must look exactly as it does today**, both in the editor and on download. We like the current look and keep it.
- *How this is guaranteed by construction:* the look is produced entirely by the deterministic renderers (`buildTemplateResume`, `coverLetterToMarkdown`) and their downstream editor/export code. **We do not touch any of them.** We only change what feeds them.
- *The load-bearing detail:* the rewritten prompts must emit the **same output JSON schema** the renderers already consume — resume `{ summary, experience: [{ id, bullets }] }` (`PolishPayloadSchema`), cover letter `{ salutation, p1, p2, p3, p4, signoff }`. Same schema in, same markdown out, same formatting. The prompts change the *words*, never the *shape*.

**C2 — The live user is never interrupted.** There is a real user on production right now.
- All work happens on a branch off `staging`, verified there before anything reaches the production deploy the live user is on.
- The **route contracts are frozen**: `/generate/resume-structured` and `/generate/cover-letter-structured` keep the exact same request body and the exact same response shape (`{ content, id, costBreakdown, blueprint, polishAccepted }`). The frontend (`StepperWorkspace`) is not forced to change. `blueprint` can return `null` once the stage is gone; callers already treat it as optional.
- **Phase 0 (dead-code deletion) is provably safe** because every target has zero live references (verified). Phases 1-4 change generation internals only, behind the frozen contract.
- Each phase is independently shippable and verified before the next. Nothing half-migrated reaches the live user.

**C3 — Strip, do not add.** No new abstractions, no feature flags, no config frameworks, no "while we're here" extras. The only net-new code is the two rewritten prompt bodies (replacing existing ones) and a one-line model switch. Every other change is a deletion.

---

## 1. The big picture (read this first)

### What happens today when a user clicks Apply

```
User clicks Apply
   │
   ├─ /analyze/dual ............ LLM call: derives "bridgeable gaps"
   ├─ confirmation modal ....... user confirms 2-3 strengths   (FRICTION)
   ├─ /research/company-intel .. Perplexity call (background)
   │
   └─ then, per document:
        1. generateBlueprint ... CLAUDE call: writes a "DIRECTOR'S BRIEF"
        2. classifyExperiences . LLAMA call: picks which past roles show
        3. document generation . LLAMA call: writes the JSON
        4. Zod validate + buildTemplateResume render
        5. enforcer gauntlet ... first-person, AI-tells, banned phrases,
                                 contradiction guard, em-dash strip,
                                 ATTACH-TO-ID binding, ATS check...
```

Three to four LLM calls across **two different models** per document, plus a stack of deterministic patches.

### Why it produces worse output than pasting into Claude.ai

The web UI gives **one strong model** the **whole resume** and the **whole job description** and lets it think and write in one pass. Your pipeline does the opposite: it shreds the resume into database rows, has Claude write abstract strategic directives, then hands those directives to a **weaker model** (Llama 3.3 70B) to execute against the shredded data.

**Every patch in the pipeline exists to compensate for the weak executor:**

| Patch | The Llama failure it was bolted on to fix |
|---|---|
| Claude blueprint stage | Llama can't position on its own |
| `ATTACH TO EXPERIENCE ID` directives | Llama put bullets under the wrong job |
| `enforceFirstPersonSummary` | Llama wrote the summary in third person |
| `scrubAITells` / `scrubBannedPhrases` | Llama leaked "passionate", "team player" |
| CONTRADICTION GUARD block | Llama hedged about skills the candidate has |
| COMPLIANCE block | Llama fabricated vaccination/visa status |
| Quality gate (2nd Claude call) | Llama output needed a senior review pass |

That stack of patches **is** the "contradictory rules" feeling. They fight each other because each was added in isolation to fix one symptom. Replace the weak executor with one capable model and most of them simply stop being necessary.

### What it becomes

```
User clicks Apply
   │
   ├─ company intel (background, non-blocking — for the cover letter only)
   │
   └─ ONE capable-model call per document (resume + cover letter, in parallel):
        full RAW resume text + job description
        →  structured JSON  →  buildTemplateResume / coverLetterToMarkdown
        →  3 cheap deterministic safety nets (years, first-person, referees)
```

One model. One pass. Clean JSON rendered by code you already trust. The blueprint, the quality gate, the experience-classifier call, the gap-derivation pre-call, the gap modal, and most enforcers are all deleted. No pre-generation friction: clicking Apply goes straight to writing.

---

## 2. What we keep vs. delete

### Keep (these are the genuinely good parts)
- **The candidate profile / achievements bank** as the source of truth.
- **Structured JSON output + Zod validation** (`validatePolish`, `validateCoverLetterPolish`).
- **Deterministic rendering** (`buildTemplateResume`, `coverLetterToMarkdown`). This is the part that already eliminates formatting drift. It stays.
- **Three free, deterministic safety nets** that can never hurt and run in code, not as LLM rules:
  - verbatim years-of-experience number (`resolveYearsOfExperience`)
  - first-person summary check (`enforceFirstPersonSummary`)
  - referees line + Australian English
- **The structured routes** (`/generate/resume-structured`, `/generate/cover-letter-structured`) as the only generation paths.

### Delete
- **The Claude blueprint stage** (`generateBlueprint`, `STRATEGY_BLUEPRINT_PROMPT`, `blueprint-cache`, `blueprintJson` column usage). Confirmed self-contained: nothing outside `generate.ts` + one test reads it.
- **The quality gate** (`reviewDocument` / `quality-gate.ts`) from the generation path.
- **The separate experience-classifier LLM call** — folded into the single generation pass as an instruction.
- **Most enforcers/scrubbers** — a capable model on a tight prompt does not make these mistakes. Keep only the three free safety nets above.
- **The achievements bank / Pinecone retrieval** as an input to these two prompts (decision 7.1 — raw resume in, rearrange only). The bank stays in the schema for other features; it just stops feeding the resume and cover letter prompts.
- **The gap-confirmation flow in `/apply`** — the `GapConfirmModal`, the blocking `/analyze/dual` pre-call, and the bridged-gaps prompt plumbing (`CONFIRMED CAPABILITIES`, the contradiction guard). The `/analyze/dual` endpoint and `dualSignal` prompt stay (the Strategy Hub still uses them); only the apply-flow caller is removed.
- **Dead frontend components:** `ApplicationWorkspace.tsx` and `GenerationPanel.tsx` (zero references anywhere — already orphaned).
- **Dead backend branches:** the `RESUME` and `COVER_LETTER` branches of the wildcard `/generate/:type` route, and the embedded structured-resume path inside it (lines ~280-374 of `generate.ts`). Nothing calls `/generate/resume` or `/generate/cover-letter` anymore; the live flow uses the `-structured` routes. The wildcard route stays only for the STAR family (cold-outreach, rejection-response, offer-negotiation, selection-criteria).

---

## 3. The specific quality problem you raised: quantification

You said: "sometimes an achievement can be quantified, not always, and I want to solve for that simply."

Today the cover letter prompt literally says **"Paragraph 2 MUST include at least one numerical metric."** That is a fabrication trap: a candidate without a clean number gets a forced or invented one, which violates your own never-invent rule.

**The fix is a permissive instruction, not a mandate** — the exact thing a capable model handles naturally and a weak one cannot:

> Lead every achievement with its concrete outcome and scale. Use a specific number only when it is present in the candidate's source data. When no number exists, lead with the real result, scope, or before/after change in plain language. Never invent, estimate, or round up a figure.

This single rule, given to one strong model, is what makes the output read like the web UI: quantified where the data supports it, confidently concrete where it doesn't, fabricated nowhere.

---

## 4. The plan in phases

Each phase leaves the app working and shippable on its own. Ordered lowest-risk first.

### Phase 0 — Delete dead weight (zero behaviour change)
Pure deletion. Nothing live calls any of it. Instant reduction in surface area.
- Remove `ApplicationWorkspace.tsx`, `GenerationPanel.tsx`.
- Remove the `RESUME`/`COVER_LETTER` branches and the embedded structured-resume block from `/generate/:type`.
- Verify the test suite and the `/apply` flow still pass.

### Phase 1 — Collapse generation to one model
The heart of the change. In `/generate/resume-structured` and `/generate/cover-letter-structured`:
- Delete the `generateBlueprint` Stage 1 call and the blueprint plumbing.
- Delete the separate `classifyExperiences` call; fold curation into the prompt.
- Point Stage 2 at one capable model (see decision 7.1) given the **full raw resume text** + JD + structured experience list (for id-binding) + evidence bank.
- Keep the existing Zod parse + `buildTemplateResume` / `coverLetterToMarkdown` render unchanged.

### Phase 2 — Rewrite the two prompts, lean
Replace `RESUME_STRUCTURED_PROMPT` and `COVER_LETTER_SLOTS_PROMPT` with clean templates that drop everything tied to the weak executor:
- **Delete:** blueprint injection (positioningStatement, proofPoints, messagingAngles, structureNotes, pitfallFlags, sector switch blocks), the ATTACH directives, the CONTRADICTION GUARD and COMPLIANCE walls, the metric mandate.
- **Keep, tightly:** first-person summary, Australian English, referees line, the permissive quantification rule (section 3), never-fabricate, exact-years number, output-only-JSON.
- Fold experience curation in as one line: feature roles relevant to this JD; condense old or casual roles to a single line.

### Phase 3 — Thin the post-processing
- Keep the three free deterministic safety nets (years, first-person, referees + AU English).
- Remove the now-redundant scrubbers and the quality gate from the generation path.

### Phase 4 — Speed
- Company intel already runs in the background; confirm it never blocks the resume.
- Resolve the gap-confirmation modal (decision 7.3): the `/analyze/dual` call plus the modal is the single biggest delay between click and resume.
- Target: resume visible after exactly one model call, not a sequential chain.

---

## 5. Files this touches

**Backend**
- `server/src/routes/generate.ts` — gut the two structured routes down to: load profile, call one model, validate, render, persist. Delete dead branches.
- `server/src/services/prompts/resumeStructuredPrompt.ts` — rewrite lean.
- `server/src/services/prompts/coverLetterSlotsPrompt.ts` — rewrite lean.
- `server/src/services/llm.ts` — generation points at the chosen capable model.
- **Delete:** `services/strategy.ts`, `services/prompts/strategy.ts`, `services/blueprint-cache.ts`, `services/quality-gate.ts` (verify no other importers first), `services/experienceRelevance.ts` if curation is fully folded in.
- Keep: `lib/buildTemplateResume.ts`, `lib/coverLetterToMarkdown.ts`, `lib/validatePolish.ts`, `lib/validateCoverLetterPolish.ts`, `lib/profileMath.ts`, the first-person enforcer.

**Frontend**
- **Delete:** `src/components/ApplicationWorkspace.tsx`, `src/components/GenerationPanel.tsx`.
- `src/pages/StepperWorkspace.tsx` — only if we change the gap modal (decision 7.3). Otherwise untouched; it already calls the right routes.

---

## 6. What this buys you

- **Quality:** one strong model reasoning over the whole resume = the web-UI result, inside your app.
- **Simplicity:** one generation path, one model, two lean prompts. The Frankenstein layers are gone.
- **Speed:** resume appears after one model call instead of blueprint → classifier → executor.
- **Fewer moving parts to break:** delete a Claude call, a quality-gate Claude call, a Llama classifier call, two dead components, and a dead route family.

---

## 7. Locked decisions

**7.1 — Evidence: full web-UI style.** Pass the **full raw resume text + the job description** and let the model rearrange what is already there. No Pinecone achievement retrieval, no decompose-reassemble. The resume is the source of truth; the model reorders and tailors it, inventing nothing. Hard constraint: the output resume must never exceed **2 pages**, and in practice less — the prompt enforces a tight word budget, not just a page count.

**7.2 — Gap step: removed entirely from the apply flow.** The `GapConfirmModal` and the blocking `/analyze/dual` pre-call are cut from `/apply`. They add a call plus a click before the resume appears, and they inject claims not in the resume, which fights the rearrange-only model. The `/analyze/dual` endpoint and `dualSignal` prompt stay (the Strategy Hub hero card still uses them); only the apply-flow caller and the bridged-gaps prompt plumbing are removed. Clicking Apply goes straight to generation; company intel still pre-warms in the background for the cover letter.

**7.3 — Model: one Sonnet-4.6-class pass, with Opus 4.8 as the quality escape hatch.** Sonnet 4.6 ($3/$15 per million tokens) is the workhorse: strong positioning judgment, half the price of Opus, fast. The whole design is one config line (`CLAUDE_MODEL`), so if blind testing shows the positioning is not matching web-UI quality, we flip to Opus 4.8 ($5/$25) with zero structural change. Full numbers in section 9. (Generation currently routes Llama via `callLLM`; the change is to route the single pass through the Claude path with `CLAUDE_MODEL` set to the chosen model.)

---

## 8. After this
Next step is the bite-sized, test-first task breakdown: exact files, exact code, exact commands, ordered by the four phases, written zero-latitude so it can be executed directly.

---

## 9. Cost evaluation

All figures are per **application** (one resume + one cover letter), generated as two parallel calls that each receive the raw resume + JD. Token assumptions, stated so you can sanity-check them: ~4,000 input tokens per call (≈1,500 resume + ≈1,000 JD + ≈1,200 prompt scaffolding + schema), ~1,200 output tokens for the resume JSON, ~600 for the cover letter JSON. These are estimates; they should be re-baselined against real `count_tokens` once wired, but they are the right order of magnitude for a 2-page resume.

**New design — Sonnet 4.6 ($3 in / $15 out per million):**
| Call | Input | Output | Cost |
|---|---|---|---|
| Resume | 4,000 | 1,200 | $0.030 |
| Cover letter | 4,000 | 600 | $0.021 |
| **Per application** | | | **~$0.051** |

**New design — Opus 4.8 ($5 in / $25 out per million):**
| Call | Input | Output | Cost |
|---|---|---|---|
| Resume | 4,000 | 1,200 | $0.050 |
| Cover letter | 4,000 | 600 | $0.035 |
| **Per application** | | | **~$0.085** |

**Current Frankenstein pipeline, for comparison (rough):**
| Stage | Model | ~Cost |
|---|---|---|
| Strategy blueprint (shared across both docs) | Claude Sonnet | ~$0.031 |
| Experience classifier | Llama 3.3 70B | ~$0.001 |
| Resume generation | Llama 3.3 70B | ~$0.001 |
| Cover letter generation | Llama 3.3 70B | ~$0.001 |
| Gap derivation (`/analyze/dual`) | Llama 3.3 70B | ~$0.002 |
| **Per application (ex company intel)** | | **~$0.036** |

**Read of the numbers:**
- Sonnet 4.6 is **~$0.015 more per application** than today (~$0.051 vs ~$0.036). For that you delete four LLM calls from the critical path (blueprint, classifier, gap derivation, and the quality gate when it fires), cut the time-to-resume, and lift output to web-UI quality. The dominant cost today is the Claude *blueprint*; you are essentially redirecting that spend into the model that actually writes the document.
- Opus 4.8 is **~2.4x today** (~$0.085). Worth it only if Sonnet's positioning judgment proves insufficient in testing. Start on Sonnet, measure, upgrade only if needed.
- Company intel (Perplexity, ~$0.003–0.01) is unchanged and excluded above; it already runs in the background.
- **Cheap optimisation available later:** generating resume + cover letter in one combined call (shared resume+JD context) drops Sonnet to **~$0.039/application** and natively prevents the summary/opening-line duplication the old rules policed. Deferred to keep v1's diff small and the two-tab streaming UX intact.

**Bottom line:** the simplification is roughly cost-neutral on Sonnet (a cent and a half), faster, and materially higher quality. Cost is not the constraint here; quality and simplicity are the wins.

---

# Part B — Executable task breakdown

Ordering: each phase leaves the app working, the route contracts frozen, and the output format identical. Verify before moving on. Verification commands: frontend typecheck `npx tsc -b`; backend suite `cd server && npm test`. Manual smoke: run `/apply` locally and generate a resume + cover letter, confirm they render and download exactly as before.

## Phase 0 — Delete dead frontend components (zero live impact)

**Files**
- Delete: `src/components/ApplicationWorkspace.tsx`
- Delete: `src/components/GenerationPanel.tsx`

Both have zero importers anywhere in the codebase (verified across the whole repo; references exist only in docs/specs/testsprite fixtures, plus one stale comment in `server/src/lib/provenanceTagging.ts` which is harmless). `ApplicationWorkspace` is confirmed retired and unrouted; the live flow is `/apply` → `StepperWorkspace`.

**Steps**
1. Delete the two files.
2. Run `npx tsc -b` — expect no new errors (nothing imports them).
3. Manual: load `/apply`, generate resume + cover letter, confirm unchanged.

## Phase 1 — Collapse the two structured routes to one capable-model pass

**File:** `server/src/routes/generate.ts` (the `/resume-structured` and `/cover-letter-structured` handlers only).

Per route, keep the request parse, the profile load, the Zod validate + render + persist, and the **response shape** exactly as they are. Change only the middle:
- Remove the `generateBlueprint` (Stage 1) call and all blueprint plumbing (`blueprintResult`, DB blueprint cache pre-populate, `blueprintJson` persist, `setCachedBlueprint`).
- Remove the `classifyExperiences` + `selectFeaturedExperience` pre-call from `/resume-structured`; the single pass curates inline. Keep `resolveYearsOfExperience` computed over `profile.experience` (deterministic years stays).
- Replace the Stage-2 model call: route the new prompt through the Claude path (`callClaude`) instead of `callLLMWithRetry` (Llama). Keep `parsePolishJson` / `parseCoverLetterPolishJson` + `buildTemplateResume` / `coverLetterToMarkdown` unchanged.
- `blueprint` in the response becomes `null` (callers treat it as optional; `StepperWorkspace` ignores it).
- Remove the now-dead `RESUME`/`COVER_LETTER` branches and the embedded structured-resume block from the wildcard `/:type` route in the same file. Leave the wildcard's `STAR_RESPONSE` path fully intact (cold-outreach, rejection-response, offer-negotiation, selection-criteria are live).

**Verify:** `cd server && npm test`; manual `/apply` resume + cover letter still generate and render identically.

## Phase 2 — Rewrite the two prompts (raw resume in, same JSON schema out)

**Files:** `server/src/services/prompts/resumeStructuredPrompt.ts`, `server/src/services/prompts/coverLetterSlotsPrompt.ts`.

Hard rule: the output JSON schema each prompt instructs is **unchanged** — resume `{ summary, experience: [{ id, bullets }] }`, cover letter `{ salutation, p1, p2, p3, p4, signoff }` — so the renderers and the output format are untouched (constraint C1).

Rewrite the prompt bodies to:
- Take the **full raw resume text** (`profile.resumeRawText`) + the structured `profile.experience` (for id-binding only) + the JD. Drop the blueprint inputs (positioningStatement, proofPoints, messagingAngles, structureNotes, pitfallFlags, sector switches), the ATTACH directives, the CONTRADICTION GUARD, the COMPLIANCE wall, and the bridged-gaps block.
- Keep: first-person summary, exact years number, Australian English, referees line, never-fabricate, output-only-JSON, the 2-page word budget, and the **permissive quantification rule** (lead with a real number only when the source has one; otherwise lead with the real outcome; invent nothing).
- Fold experience curation into one instruction: feature roles relevant to this JD; condense old or casual roles to a single line; never exceed 2 pages.
- Update the prompt-construction tests (`*.test.ts`) to assert the new required strings and the unchanged schema; drop assertions tied to deleted blueprint inputs.

**Verify:** `cd server && npm test`; manual generation, eyeball quality + format.

## Phase 3 — Thin the post-processing

**File:** `server/src/routes/generate.ts` (structured routes).
- Keep the three deterministic safety nets only: years verbatim, `enforceFirstPersonSummary`, referees/AU English (already in the renderers/enforcers).
- Remove redundant scrubbers and any remaining quality-gate references on the structured paths. Do not touch the STAR path's processing.

**Verify:** `cd server && npm test`; manual `/apply`.

## Phase 4 — Remove pre-generation friction in `/apply`

**File:** `src/pages/StepperWorkspace.tsx`.
- Remove the `/analyze/dual` gap-derivation effect, the `GapConfirmModal` render, and the `gaps` / `gapPhase` / `bridgedGaps` plumbing. Generation fires immediately on entry once the JD is present.
- Keep the background company-intel prewarm (cover letter uses it).
- Leave `/analyze/dual` and `dualSignal` server-side untouched (Strategy Hub still uses them).

**Verify:** `npx tsc -b`; manual `/apply` — resume appears with no modal, company intel still feeds the cover letter.

## Dead code to remove once Phases 1-4 land (final sweep)
- `server/src/services/strategy.ts`, `server/src/services/prompts/strategy.ts`, `server/src/services/blueprint-cache.ts` (blueprint).
- `server/src/services/quality-gate.ts` (if no other importer — verify first).
- `server/src/services/experienceRelevance.ts` + `src/components/GapConfirmModal.tsx` (if no other importer — verify first).
Each deletion gated on a zero-importer grep, same as Phase 0.

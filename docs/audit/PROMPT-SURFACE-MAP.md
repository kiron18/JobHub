# JobHub — Prompt & Rule Surface: Map and Evaluation

Companion to `PROMPT-SURFACE-BUNDLE.md` (the full text of every file below).

Evaluated against one goal: **a user uploads their resume once, we fix it once, and from then on they fire out applications that get read.**

---

## Part 1 — What actually runs

There are **three generations of generation engine** in this codebase. All three are wired. Only the third is reachable.

### The live path — this is your entire product

**Resume** — `StepperWorkspace.tsx:334` → `POST /generate/resume-structured` (`generate.ts:573`)

```
RESUME_V2_PROMPT  (generationV2.ts:1)
  → passesShapeCheck        markdown headings present?
  → checkStyle(text, false) 15 banned phrases + em dashes
  → one retry if violations, keep whichever draft has fewer
  → EMPHASIS_PASS_PROMPT    adds bold to results
```

**Cover letter** — `StepperWorkspace.tsx:336` → `POST /generate/cover-letter-structured` (`generate.ts:829`)

```
COVER_LETTER_V2_PROMPT  (generationV2.ts:94)
  → passesShapeCheck
  → checkStyle(text, true)  same 15 phrases + word count 400–500
  → one retry
```

That is the whole quality apparatus for every document a user sends: **one prompt, one regex list of 15 phrases, one retry.**

### The intake path — the fix-it-once step you described

```
resume upload → cvGapScan → DiagnosticReport
              → generateBaselineResume(userId, resumeRawText, reportMarkdown)
                  ← injects the full 397-line resume_rules.md
                  → saves Document{ type: BASELINE_RESUME, title: "Your Improved Resume" }
```

### The orphaned engine — built, wired, unreachable

| Component | Lines | Where it dies |
|---|---|---|
| `generation.ts` `DOCUMENT_GENERATION_PROMPT` | 668 | legacy `POST /:type`, still live for other doc types only |
| `resumeStructuredPrompt.ts` + `buildTemplateResume` | ~675 | only via `POST /generate/resume` — nothing calls it |
| `quality-gate.ts` `reviewDocument()` | 82 | `generate.ts:413`, legacy path only |
| `strategy.ts` blueprint stage | 174 | `generate.ts:205`, legacy path only |
| `atsKeywords.ts` ATS scoring | 243 | `generate.ts:494`, legacy path only |
| `cover_letter_rules.md` | 423 | `readRules()` loads it; the frontend never routes there |
| `Resume_ATS_Template.md` | 52 | nothing references it |

**~2,300 lines of your best doctrine and every automated safety net you built sits behind routes the frontend stopped calling.** Nobody deleted them, so from the outside the system looks far more governed than it is.

---

## Part 2 — The finding that matters

**The fix-once-at-intake model you just described is already built, and its output is thrown away.**

`generateBaselineResume` produces the cleaned resume using your good doctrine plus the diagnostic findings. It saves it as a `Document`. That document is read in exactly two places: a status check (`profile-core.ts:507`) and the Document Library, where the user can download it as "Starter Resume."

Then generation runs:

```ts
// generate.ts:598  (resume)     and  generate.ts:858  (cover letter)
select: { id: true, name: true, resumeRawText: true },
```

`resumeRawText` is the **original messy upload** — written at `onboarding.ts:119` / `welcome.ts:125` / `cv-scan.ts:287`. The only thing that ever updates it afterwards is a **user manually re-uploading a resume file** (`profile/source-documents.ts:62`, which also re-runs profile extraction). `BASELINE_RESUME` never touches it.

So: you diagnose the resume, you fix the resume, you show the user the fix — and then every application they ever generate is built from the unfixed original. **Garbage-in is currently permanent by design.** Your stated architecture is right and the wire is missing.

**Two consequences, one of them useful right now:**

*The workaround you can use today.* Because `source-documents.ts` already replaces `resumeRawText` and re-extracts the profile, a client can download "Your Improved Resume" from the Document Library and re-upload it as their resume. From that point on, every generation runs off the clean version. **That is the intended architecture, executed by hand.** Worth doing for every client you onboard until the wire lands — and worth testing on one client first, because it's the same code path the real fix will use.

*The fix.* It doesn't need a new field. `generateBaselineResume` already has the text and the `userId`; it can write `resumeRawText` (and call `forceAutoExtract`) the same way `source-documents.ts` does. The only real decision is whether to preserve the original — I'd add `originalResumeText` for audit and diagnostics rather than lose it, since `cvGapScan` should keep scanning what the user actually wrote. That's the highest-leverage change in the repo and it touches nothing about how documents are written.

**Correction to what I told you earlier:** I framed the cover letter word count as rules-vs-linter contradiction. That was wrong about the cause. `COVER_LETTER_V2_PROMPT:110` says "400 to 500 words" and `styleLint.ts:70` says 400–500 — they agree. It's the *doctrine* (300–400, 218-word worked example) that's disconnected. Same conclusion about the number being wrong for this market, different location, and not a code inconsistency.

---

## Part 3 — Coach's evaluation of what's live

### What's genuinely strong — don't touch this

**The honesty architecture is better than anything commercial I've seen.** `generationV2.ts:10-18`: every employer, title, date, qualification and number must appear in the source; never invent, estimate, round or extrapolate; never import facts from the JD into the candidate's history; never use outside knowledge about a company. This is the #1 failure mode of AI resume tools and the reason candidates get destroyed in interviews. It's handled seriously and it's the thing that makes the product defensible.

**The emphasis rules show real craft.** "Never bold a skill, tool, company, job title or date — that reads as keyword stuffing and is the fastest way to make a resume look machine-written" (`generationV2.ts:75`). Correct, and almost nobody knows it.

**The completeness rule is right for this market.** "Never fit the budget by deleting an entry or a section" (`:26`) — because a deleted job creates a date gap, and AU recruiters ask about gaps.

**The casual/survival-job handling in the orphaned Gen-2 prompt is the single smartest thing in the codebase** (`resumeStructuredPrompt.ts:116, 167`): fold a kitchen-hand job to one line, never omit an Australian role, never mark a real professional role casual just because it doesn't match this job, and "a restaurant MANAGER is NOT casual." That is exactly the migrant-market judgement your ICP needs, and **it is not on the live path.** Most tools either delete the hospitality job and create a gap, or give it equal billing with the professional work.

**The cover letter specificity test** — "no paragraph may be reusable in a letter to a different company" (`:120`) — is the correct single test for whether a letter is worth sending.

### What's actually weak on the live path

**1. Section order is left to the model, per generation.** `generationV2.ts:61` — "All other sections mirror the source resume's own content… placed in the order that best serves this application."

This is the real answer to your skills-at-the-end question. The app didn't decide to put skills last. **The model decided, on that run.** Run it again on the same inputs and it may differ. Your instinct that something was off was correct — you were seeing non-determinism, not a rule.

For the AU market I'd fix the order rather than argue about it: Summary → Experience → Education → Skills as the default, with skills promoted above experience only for tool-gated roles or thin/stale experience. But the fix is *determinism first*, position second.

**2. Length discipline is broken by construction.** "Aim for 2 A4 pages" (`:45`) versus "never fit the budget by deleting an entry or a section" (`:27`), which is marked equal priority to honesty. For a career changer with ten roles those instructions cannot both hold, and the completeness rule wins because it's the one with teeth. Result: three-page resumes.

The orphaned Gen-2 prompt solved this properly (`resumeStructuredPrompt.ts:118`): a hard total bullet budget, 3–4 bullets for the most relevant roles, 1–2 for the rest, "roughly 10 to 14 bullets in total, never more." That intelligence existed and was lost in the migration to Gen 3.

**3. The cover letter is too long for this market.** 400–500 words and 4–5 paragraphs, with "a letter under 400 words is too short" (`:110`) actively pushing toward the ceiling. As a coach: 250–350 words is the sweet spot. A hiring manager reads the first two lines and the last one. 500 words at 11pt is a wall of text and it reads as someone who couldn't prioritise.

Your own dead doctrine had this right, and its 218-word worked example is better than what the live prompt will produce.

**4. The CTA exists but is unspecified and unenforced.** Live prompt says only "close briefly and confidently, inviting a conversation." The excellent approved patterns ("happy to connect at a time that works for you") and the banned passive closes ("I look forward to hearing from you", "Thank you for your time and consideration") are all in `cover_letter_rules.md` — dead. `styleLint` enforces 15 phrases, of which **two** relate to cover letters and **none** are closes.

So to answer what you asked directly: yes there's a CTA instruction, no it isn't specified, and nothing stops the model producing the passive close you were worried about.

**5. "Dear Hiring Manager" is the default with no nudge to find a name.** The dead doctrine treated this as a missed opportunity and told the candidate to check LinkedIn or ring the main line. That's genuine coaching value and it's gone.

**6. No AU structural guardrails on the live path.** Nothing about A4, nothing about the two-referee convention, and — the one that actually costs your clients interviews — **nothing telling candidates to strip photo, date of birth, marital status, and nationality.** Candidates from India, Pakistan and the Middle East routinely include all four because it's standard at home, and in Australia it's a quiet screen-out. Some of this lives in `resume_rules.md`, which reaches the baseline but never a generated application.

---

## Part 4 — What this implies for the architecture you described

Your instinct splits the work correctly, and it means **the generation path barely needs to change.**

**Intake, once per user — this is where doctrine belongs.** It runs once, so you can afford a large prompt, the full rule base, a real quality gate, and even a human review pass. This is where you fix structure, strip the photo and DOB, enforce A4, normalise dates, label engagement types, add company context lines, and settle section order. It already exists and already loads `resume_rules.md`.

**Generation, every application — this should stay small.** From a clean baseline, tailoring is a genuinely small job: reorder by relevance, mirror the ad's vocabulary where honest, pick the right evidence, retarget the summary. It does not need 400 lines of doctrine, because the structural quality is already baked into the input.

Which is the answer to your worry about following a list of changes and breaking everything: **most of the orphaned doctrine should not be moved onto the live path.** It should be pointed at intake, where it already is, and then intake's output should actually be used.

Ranked by leverage per unit of risk:

1. **Wire the baseline into generation.** Small, testable, and it makes every other quality problem downstream of a clean input. Nothing about document writing changes.
2. **Cover letter length: 250–380.** One number in the prompt, one in the linter, three tests. Directly improves read-through rate.
3. **Fix the section order in `RESUME_V2_PROMPT`.** Removes the non-determinism you spotted.
4. **Resolve the length contradiction** by porting Gen-2's bullet budget into the live prompt.
5. **Specify the close** in the live cover letter prompt and add the banned closes to a cover-letter-only lint list.
6. **Archive the orphaned engine** — move it to `server/_archive/` with a README, or delete it. Right now it makes the system look governed when it isn't, and it cost this audit most of its time.

Items 1–3 are close to riskless. 4 changes output shape and wants eyeballs on ten resumes before and after. 5 raises the retry rate, so it costs tokens. 6 is housekeeping but it's what stops the next audit — mine or anyone's — from starting from a false picture.

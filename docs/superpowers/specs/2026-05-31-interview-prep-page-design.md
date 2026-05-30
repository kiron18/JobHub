# Interview Prep — Dedicated Page + Calm Layer

**Date:** 2026-05-31
**Status:** Draft — awaiting review
**Related:** `docs/superpowers/specs/2026-05-09-interview-prep-redesign.md` (the prior redesign this corrects), `docs/product-decisions/2026-05-12-retention-roadmap.md` (#1 Interview Prep Generator), `C:\Users\Kiron\Downloads\Ananya_Interview_Prep.docx` (the reference document this realigns to)

---

## Problem

Three things are wrong today:

1. **The module is orphaned.** `InterviewPrepView` is imported only by `ApplicationWorkspace.tsx`, which is retired and unrouted (canonical flow is `/apply` → `StepperWorkspace`). `InterviewQuestionsPanel` is imported nowhere. Both the dead `navigate('/application-workspace')` calls in `MatchEngine.tsx` go nowhere. **Nothing surfaces when a user marks an application INTERVIEW** — only a thank-you email block renders on the tracker card.

2. **We promise a feature that doesn't appear.** `StepperWorkspace.tsx:1238` tells users the tracker "unlocks the Interview Prep generator the moment you mark a role as Interview." It doesn't. Broken promise.

3. **The implemented content diverged from the reference doc.** The 2026-05-09 redesign replaced Ananya's calm, comprehensive guide with a leaner "Story Bank / Prove It" model and explicitly stripped the calm layer (`interview_prep_rules.md` ends with *"Do NOT include generic tips"*). The emotional core of the reference document — Mindset Anchors, On The Day, Final Checklist — is absent.

## What already works (keep it)

The expensive intelligence is built and correct: a single `/generate` call (`type: 'interview-prep'`) produces, from the candidate's real profile against the JD:

- **Story Bank** — 5–6 CAR story cards tied to the candidate's achievements
- **Prove It** — behavioural / situational / motivation / role-specific questions, mapped to stories, with reveal-able CAR scaffolds
- **Know the Stage** — Company Intelligence, What They're Looking For, Watch-Outs
- **Questions to Ask** — smart closing questions

`InterviewPrepView.tsx` already parses and renders all of this. **None of this changes.**

## Goals

1. Give interview prep **its own page** (not a modal/popup), reachable from a snappy pill on the INTERVIEW tracker card.
2. Add the **calm layer** from Ananya's doc — the single most important addition, per product intent: a candidate's calm, grounded confidence is what they most need to carry in.
3. **Consolidate to one module.** Delete `InterviewQuestionsPanel`; the page is the single surface.
4. Pill appears **immediately**; generation happens on the page, behind calm loading copy; the result **persists** so re-entry doesn't regenerate.

## Non-goals

- **Not** rewriting Part 2 into Ananya's fully-written-out 7-answer format. The existing Story Bank + Prove It question intelligence stays. (This is the one change that would add real runtime token cost and parser work — explicitly out of scope.)
- **Not** scraping per-company knowledge. The candidate supplies any role research they want, as today.
- No score, no "interview readiness 7/10". Just the guide.

---

## Content model — the page, top to bottom

Ordering follows Ananya's doc and the "calm ally, not a wall of information" intent. Each section is marked **[generated]** (comes from the LLM doc, already built unless noted) or **[static]** (frontend copy, parameterised with role/company/name).

| # | Section | Source | Notes |
|---|---|---|---|
| 1 | **Header** — Role · Organisation · Why You | [generated] | "Organisation" is a 2-line summary; "Why You" is a 2–3 line personalised fit statement (NEW small field, see Server). |
| 2 | **Before You Walk In** — Five Mindset Anchors | [static + 1 generated] | Anchors 1–4 are universal calm/mindset copy ("you are not auditioning… pause before you answer… use CAR… address them as a peer"). Anchor 5 is **personalised** to the candidate's strength, generated. |
| 3 | **Know the Stage** — Company Intelligence · What They're Really Looking For · Watch-Outs | [generated] | The full existing Know the Stage block. Sits here so all "read the room" intel is in one place before the stories. |
| 4 | **Know Your Stories** (Story Bank) | [generated] | Existing. The centrepiece. |
| 5 | **Prove It** (likely questions + practice) | [generated] | Existing. Absorbs the flashcard/practice interaction that used to live in `InterviewQuestionsPanel` — same data, no separate API call. |
| 6 | **Questions to Ask** | [generated] | Existing. |
| 7 | **On The Day** — Dress · Arrive · The pause · Eye contact · First sentence · The smile | [static] | Universal copy from Ananya's doc. Parameterise dress note with role seniority if available, else generic. |
| 8 | **Final Checklist** — night before · morning of · in the room, + closing affirmation | [static] | Universal copy. Ends on *"You are ready for this."* |

**Calm-ally pacing.** The page is not a dump. It opens with the header and the mindset anchors (calm first), keeps the heavy tactical material (Stories, Prove It) in the middle with sensible collapse defaults, and closes with On The Day + the checklist + affirmation. Generous whitespace, one idea per block, warm tokens throughout. Tone: calm, direct, second-person, no exclamation marks, no "you've got this!" — matches the reference doc's voice.

---

## Architecture

### Route + page (NEW)

- Route: `/interview/:jobId` added to `src/App.tsx` (lazy-loaded, same pattern as `StepperWorkspace`).
- Page: `src/pages/InterviewPrepWorkspace.tsx`. Responsibilities:
  - Load the job application (`GET /jobs` cache or by id) → role, company, JD, `jobApplicationId`.
  - Look for an existing `INTERVIEW_PREP` document for this job. If present → render. If absent → trigger generation with calm loading copy, then render and persist.
  - Compose the page: static sections (Header chrome, Mindset Anchors, On The Day, Final Checklist) + the generated body via `InterviewPrepView`.
- The static calm-layer sections live in small focused components under `src/components/interview/` (e.g. `MindsetAnchors.tsx`, `OnTheDay.tsx`, `FinalChecklist.tsx`) so each has one clear purpose and the page file stays readable.

### Renderer (MODIFY)

- `InterviewPrepView.tsx` gains parsing for the two new generated fields (`Why You`, personalised anchor) and renders the existing four generated sections in their slots within the page. The flashcard/practice interaction (formerly `InterviewQuestionsPanel`) is folded into the Prove It section, driven by the already-parsed questions.

### Consolidation (DELETE)

- Delete `src/components/InterviewQuestionsPanel.tsx`.
- Remove the unused `/analyze/interview-questions` route from `server/src/routes/ai-tools.ts` (nothing else calls it) — or leave it dead; deletion preferred for a clean single source of truth.
- Remove the dead `navigate('/application-workspace')` calls in `MatchEngine.tsx` (point them at the canonical flow or remove).

### Server (MODIFY)

- `server/rules/interview_prep_rules.md`: add two small generated outputs with exact headings the parser can read — a `### Your Edge` block (the "Why You" lines + the one personalised mindset anchor). Remove the `Do NOT include generic tips` constraint only insofar as it blocks these two fields; the universal calm copy stays static in the frontend, NOT generated. Net runtime token add: small (~500–1k output tokens).
- `server/src/routes/generate.ts:156`: map `type === 'interview-prep'` to the new `INTERVIEW_PREP` document type instead of `STAR_RESPONSE`.

### Schema (MIGRATION)

- Add `INTERVIEW_PREP` to the `DocumentType` enum (`server/prisma/schema.prisma:309`). One additive migration, no data backfill (existing prep docs, if any, remain `STAR_RESPONSE`; cosmetic only).
- Update the tracker badge map (`BADGE_COLORS` in `tracker/JobCard.tsx:40`) so the doc shows as "Interview Prep", not "Selection Criteria".

### Entry pill (NEW)

- In `tracker/JobCard.tsx`, when `job.status === 'INTERVIEW'`, render a pill (next to / above the existing thank-you block) that is a router `Link` to `/interview/:jobId`.
- Copy reflects state, derived from whether an `INTERVIEW_PREP` doc exists in `job.documents`:
  - Not generated: **"Prepare for your interview →"**
  - Generated: **"Open your interview prep →"**
- The pill appears **immediately** on status change. No generation on the tracker. Generation is deferred to the page open.

---

## Data flow

```
Tracker card (status = INTERVIEW)
  └─ Pill "Prepare for your interview →"   (renders instantly, no generation)
        └─ click → /interview/:jobId
              ├─ existing INTERVIEW_PREP doc?
              │     ├─ yes → render immediately
              │     └─ no  → POST /generate {type:'interview-prep', jobApplicationId, jobDescription, ...}
              │                 ├─ calm loading copy while waiting
              │                 └─ persist as Document(type=INTERVIEW_PREP, jobApplicationId)
              └─ page renders: static calm sections + InterviewPrepView(generated body)
```

Regeneration: a quiet "Regenerate" affordance on the page re-runs `/generate` and overwrites the stored doc (roadmap calls for regenerable prep).

## Loading & empty states

- **Loading copy** (calm, rotating, while the doc generates): e.g. *"Building your prep from your real experience…"*, *"Mapping your stories to the questions they'll ask…"*, *"Almost there — your guide is nearly ready."* No spinners-only; the wait should already feel like the calm ally.
- **Generation failure:** show a calm toast and keep the "Build my interview prep" call-to-action so the user can retry. (Note: in the v1 build the calm sections render inside `InterviewPrepView` alongside the generated body, so on a hard failure the page falls back to the retry CTA rather than showing the static sections alone. Splitting the static sections to survive a failed generation is a deliberate later refinement, not v1.)

## Visual / tone direction

Run the **frontend-design** skill before building the page (standing rule). Direction: warm tokens, generous whitespace, sectioned single-column scroll, calm pacing, progressive disclosure on the tactical sections. The page must *feel* like reassurance, not a dashboard.

---

## Files changed

| File | Change |
|---|---|
| `src/App.tsx` | Add lazy route `/interview/:jobId` |
| `src/pages/InterviewPrepWorkspace.tsx` | **New** page: load job, generate-or-fetch, compose sections |
| `src/components/interview/MindsetAnchors.tsx` | **New** static calm section (anchors 1–4 + slot for generated anchor 5) |
| `src/components/interview/OnTheDay.tsx` | **New** static section |
| `src/components/interview/FinalChecklist.tsx` | **New** static section + affirmation |
| `src/components/InterviewPrepView.tsx` | Parse `Your Edge` (Why You + personalised anchor); fold in practice interaction |
| `src/components/InterviewQuestionsPanel.tsx` | **Delete** |
| `src/components/tracker/JobCard.tsx` | Add INTERVIEW pill linking to page; update `BADGE_COLORS` for Interview Prep |
| `src/components/MatchEngine.tsx` | Remove dead `/application-workspace` navigations |
| `server/rules/interview_prep_rules.md` | Add `### Your Edge` (Why You + 1 personalised anchor); relax the "no tips" rule only for those fields |
| `server/src/routes/generate.ts` | Map `interview-prep` → `INTERVIEW_PREP` doc type |
| `server/src/routes/ai-tools.ts` | Remove `/interview-questions` route |
| `server/prisma/schema.prisma` + migration | Add `INTERVIEW_PREP` to `DocumentType` |

## Complexity / cost (recap)

- **Runtime tokens:** ~flat. Calm layer is static; only "Why You" + one personalised anchor are new generation (~500–1k output tokens). Story Bank/Prove It generation already exists.
- **Build:** moderate, ~1–2 days, design-dominated. No new AI architecture. Biggest piece is the page design. One small additive migration.

## Resolved decisions

- **Surface:** dedicated page at `/interview/:jobId`, not modal. (User directive.)
- **Content:** keep generated Story Bank + Prove It; add calm layers mostly as static copy; do **not** rewrite Part 2.
- **Doc type:** clean dedicated `INTERVIEW_PREP` enum (one migration) over reusing `STAR_RESPONSE`, so tracker badges and feedback stay semantically correct.
- **Mindset anchors:** 4 universal (static) + 1 personalised (generated), to keep runtime cost flat while still feeling tailored.

## Out of scope (future)

- Ananya-style fully-written 7-answer Part 2.
- Multi-role comparison table (roadmap mentions it for parallel interviews).
- Auto-save to Profile Bank as a permanent asset (roadmap #1) — the doc persists per job here; a Profile Bank surface is a later increment.
- Dashboard "Your interview is Tuesday → Open prep" surfacing (roadmap #2 dashboard).

## Testing

- Status → INTERVIEW renders the pill instantly with no network call.
- First page open generates, persists `INTERVIEW_PREP`, renders; second open does not regenerate.
- Generation failure shows a calm toast + keeps the retry CTA; page does not crash.
- Deleting the app/doc clears the prep; badge reads "Interview Prep".
- `InterviewQuestionsPanel` and `/analyze/interview-questions` fully removed with no dangling imports/usages.

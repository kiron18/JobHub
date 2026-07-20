# QC8 — Resume & Cover Letter Generation Evaluation

**Date:** 2026-07-20
**Sample:** Vaibhav Singh → Capgemini Data & AI Consultant (Quality Check 8.txt)
**Live pipeline:** `POST /generate/resume-structured` and `/cover-letter-structured` — single Claude pass on raw resume text + JD (`generationV2.ts`), then deterministic `groundingGate` + `styleLint`, one retry, keep the better draft. Old 3-stage blueprint/Llama path is dead (410) for these types.

---

## Verdict

**Ship it. This is enough.** The output is in the top few percent of what candidates send, and the factual-grounding discipline puts it ahead of every AI resume tool I know of. Continued prompt tuning is now diminishing returns. There is exactly one remaining failure class worth an engineering response, and the right response is **user review, not more automation** — details below.

---

## What QC8 got right (and why the architecture deserves credit)

1. **Zero fabrication.** Every number (75%, 90%, 50x, 1M logs, 65%, 86%, 10ms), employer, date, cert, and publication traces to the source resume. The grounding gate's contract is being honoured.
2. **The phone number recovery is the system working.** Source header says `04XX XXX XXX (add correct number)` — a placeholder — but the real number `0467 333 893` sits in a stray PDF-extraction fragment mid-document. The generator omitted the placeholder per the contact rule and used the real number. That's exactly the judgment the prompt asks for.
3. **Correct strategic reordering.** MediaTek (relevant, 5 years) leads; the hotel job is compressed to 2 bullets and reframed as "applied data analysis to venue operations" — the only honest angle it has. Thesis + NLP projects front the projects section.
4. **The cover letter has an actual thesis.** "Applied ML that has actually shipped" is the one thing a hiring manager would repeat to a colleague, and the letter builds on it instead of walking the resume. Opens on fit, not "I am writing to apply." Passes the specificity test — no paragraph is reusable for another company.
5. **Silent, correct triage of MLOps.** The JD marks MLOps "missing fit"; the letter doesn't mention it at all rather than bluffing. That's the right move and most humans get it wrong.

## Where it stretches (the residual failure class)

These are **judgment-level inflations** — no fabricated fact, so no deterministic gate can catch them:

1. **"Overseeing client engagements … is familiar ground"** (letter, para 4). He reported to customer stakeholders as a validation engineer. He never oversaw a client engagement. This is JD language mirrored into a capability claim the resume doesn't support — precisely what the prompt forbids, but the gate only checks entities and numbers, so it sailed through.
2. **"I am fluent in how these systems are put together"** — sourced from one Coursera course. "Familiar with" is defensible; "fluent" is an interview landmine. The JD's #1 criterion is *proven GenAI experience applied to real problems*, flagged "missing fit," and the letter papers over the gap with course-plus-embeddings adjacency. A sharp interviewer will probe it and the candidate needs to know that's coming.
3. **Structural blind spot, confirmed by design:** the grounding gate accepts any number found in *resume OR JD* (`groundingGate.ts:128`). A JD metric can therefore leak into the candidate's history and pass. Didn't happen here, but it's the one real hallucination corridor left open. Also, numbers written as words ("five years", "90 per cent") bypass the digit extractor entirely — true here, unchecked in general.

## Known trade-offs I would NOT change

- **Completeness beats tailoring.** The radio-interferometry, rocketry, and Azure-lab projects are noise for a consulting JD, and a top human writer would cut them. But the "never delete an entry" rule is what makes the system trustworthy — users forgive verbosity, never disappearance. Correct default.
- **Garbage-in stays.** "SDN-based transmitter" for rocket telemetry is almost certainly a typo for SDR (software-defined *radio*) in the *user's own resume*. The system faithfully copied it, as the honesty rules demand. Fixing source errors is the user's job — but see recommendation 2.
- **Non-reverse-chronological experience.** Some recruiters will notice the current job listed second. For this candidate it's the right call; leave the model the discretion.

---

## Recommendations — in priority order, and where to stop

### 1. Ship a "claims to verify" panel (the one change worth making) — ✅ SHIPPED 2026-07-20 as "Coach's advice"
Implemented by extending the existing draft-critique pass rather than adding a new one:
- `draftCritique.ts` now receives the **source resume** and audits failure mode 8, *Inflation beyond the resume* — honest facts stretched into capability claims an interviewer would collapse ("overseeing client engagements is familiar ground", "fluent" from one course). Inflation issues are always severity-high and outrank all other categories.
- `/analyze/critique` runs on **Haiku** with the old Llama path as fallback.
- The panel is rebranded **"Coach's advice"**, **auto-runs once per fresh generation** (result cached on the draft in localStorage — revisits and reloads never re-spend the call), stays advisory and non-blocking, and fails silently. Edited drafts are never auto-critiqued; the toolbar button covers manual re-runs.

### 2. Surface source-resume smells at upload, not at generation
The pipeline already reads the raw resume. One-time flags at profile upload — "placeholder phone found", "date typo? (award Q1 2024 predates Aug 2024 start)", "SDN vs SDR?" — fix problems at the root, once, instead of in every document. Est. <1 day, reuses the same judge call.

### 3. Close the JD-number leak (cheap, do whenever)
In `groundingGate.ts`, numbers appearing *only* in the JD and not the resume should produce a **warning** (not a violation) when they occur inside a Work Experience bullet. Keeps keyword mirroring, closes the corridor.

### Do NOT do
- More banned-phrase entries, more regex gates, more prompt paragraphs. The prompt is already at the length where additions dilute compliance.
- An LLM rewrite/polish stage. The single-pass output is coherent because it's single-pass; a second writer reintroduces drift.
- Trying to automate the inflation judgment to zero. That's an asymptote; recommendation 1 gets 95% of the value for 1% of the effort.

**Bottom line:** QC8 would get this candidate an interview if the fit is real, and nothing in it would embarrass him under cross-examination except two sentences — which recommendation 1 would have flagged. Freeze the generator, add the review panel, move on.

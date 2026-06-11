# QA14 Working Checklist

Short, checkable statements. I refer to this so nothing is missed. Not started until we align. `[ ]` open, `[x]` done, `[~]` in progress.

## 0. Headline problem (from QA14 doc)
- [ ] The product fabricated a defence/EVM career for an agriculture grad. Confirm root cause = bridged-gaps "confirm these strengths" feeding fake qualifications into resume + cover letter.
- [ ] No document (resume, cover letter, SC) may ever claim experience the candidate does not have.

## 1. CV Scan
- [x] Quick-win cards no longer truncated (word-safe clamp). [verify in app]
- [x] Roadmap step titles/descriptions: word-safe clamp + realistic limits.
- [x] ATS feedback reads right: hiring-manager voice + explicit cost (looks good but never reaches a human).
- [x] Hiring-manager personas: even men/women mix (separate name pools, no female default).

## 2. Resume generation
- [x] Date format renders "Feb 2024" / "Nov 2022", never "2022-11". Also removed em dashes from the renderer.
- [x] Summary grammar: "over 1 years" now reads "1 year".
- [x] Bullets must state an OUTCOME and never copy the source verbatim (resume prompt rule 5).
- [x] "Add a real number to a result" tip above the resume editor (resume step only).
- [ ] Resume must fit 2 pages. Shabareesh's was 3. Curate beyond work casual-folding: trim education (drop secondary school for postgrads), cap volunteering, cap languages line. [BIG]
- [ ] No fabricated skills: kill the "Role-specific: <bridged gap>" skill injection. [ties to §3]

## 3. Bridged gaps ("Quick check before we write")
- [x] Removed the bridged-gaps / confirm-strengths step from the apply flow (frontend: derivation effect, GapConfirmModal, state, imports).
- [x] Both structured routes no longer read or pass bridgedGaps; no "Role-specific: <gap>" skill injection; prompts get no invented capabilities. Cover-letter test repurposed to guard against re-introduction.

## 4. Cover letter (crown jewel) — must be flawless
- [x] Rewrote the cover-letter prompt (raw resume + JD + real company insight); same JSON the renderer consumes. Tests updated/green.
- [x] Never fabricates: the QA mismatch case (agri grad -> ASC defence EVM) now makes zero EVM/defence claims; honestly bridges transferable strengths.
- [x] Tightened against embellishment (no invented grants, tools, or "advanced Excel"); re-verified on the mismatch case.
- [x] Strong company-insight integration (ASC Beyond Benchmark / sovereign mission woven in honestly).
- [ ] Eyeball one in the live app to confirm render + tone (user check).

## 5. Selection criteria (SC)
- [x] SC engine: new `POST /generate/selection-criteria-structured` — one Claude pass over resume + JD + criteria. Self-contained `SELECTION_CRITERIA_PROMPT`.
- [x] SC format: explicit bold **S:/T:/A:/R:** labels, in the new prompt (supersedes the old "no labels" rule).
- [x] SC word limits + brevity: prompt detects/respects a stated limit, aims 200-350 words otherwise, never pads or truncates.
- [x] No fabrication: same source-of-truth rules as resume/cover letter.
- [ ] FRONTEND (DeepSeek): detection-driven flow, remove the StrategyHub toggle, paste-once + one Generate button, "not found" note, live word counter. → `docs/superpowers/plans/2026-06-11-sc-frontend-deepseek.md`

## 6. Carried-over refactor items
- [x] Gap modal removed from /apply (done in §3).
- [x] Dead-code sweep: GapConfirmModal.tsx, experienceRelevance.ts, eval-resume.ts deleted. (strategy.ts / blueprint-cache / quality-gate STAY — still used by the wildcard STAR route for cold-outreach / rejection / offer.)
- [x] Throwaway eval scripts deleted.

## Decisions needed before building
- D1. STAR labels in SC: you want explicit "S:/T:/A:/R:". Current rules forbid labels ("amateurish"). My lean: agree with you — labels help panels score, update the rules.
- D2. SC button placement on the workspace.
- D3. 2-page enforcement: confirm it's OK to drop secondary-school education and cap volunteering/languages for length.
- D4. Confirm we fully remove bridged gaps (no "confirm your strengths" step at all).

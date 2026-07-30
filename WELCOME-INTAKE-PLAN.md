# /welcome — fix-the-resume-once intake

## The one thing that matters

Generation reads `profile.resumeRawText`. Whatever we build must land **in that field**.
Anywhere else (a Document, a JSON blob, a new column) = invisible to generation.

Keep the original in a new `resumeOriginalText` column for audit/diff. Never overwrite it.

---

## Flow

```
upload → [1 LLM call: analyse] → brief + 8 questions
       → question screens (one at a time, skippable)
       → [1 LLM call: rebuild] → clean resume
       → show it to them → save to resumeRawText → dashboard
```

Two LLM calls total. ~40–60s. Same as today's wait, more value in it.

## The two kinds of fixing

**Silent** (no input needed — just do it): strip photo / DOB / marital status /
nationality, suburb+state only, standardise dates, kill the objective statement,
reorder sections, outcome-lead the bullets, AU spelling.

**Asked** (facts only they know — never guess): missing metrics, engagement type
(contract/casual/full-time), context on unknown overseas employers, team size,
scope, what actually changed.

## Question object

```
{ anchor:   the exact line from their resume this is about,
  question: "Roughly how many customers did you serve a week at Coles?",
  why:      one line — why an AU employer cares,
  example:  "e.g. about 80",
  type:     number | short_text | choice }
```

Show the anchor line above the question so they see what they're answering about.
Cap at **8**, ranked by impact. Progress indicator ("3 of 8"). One per screen.

## "I don't know" is not an accepted first answer

This is the most important part of the flow. A blank bullet is a worse outcome than
an honest estimate, so the screen **coaches, then accepts** — it does not just offer
a skip button.

When they say they don't know, we push **once**, with actual help:

- **Tell them where to look** — old payslip, a rostering app, sent email, LinkedIn
  post, the job ad they applied to, a former manager they can text.
- **Show them how to estimate honestly** — "you don't need the exact figure. Think
  about a normal week and round. About 80 a week is a real answer."
- **Give a range as a fallback** — chips like `under 20 / 20–50 / 50–100 / 100+`.
  Far easier to answer than an open number box, and still true.
- **Name the stake once** — "this line is the difference between a duty and a result.
  It's worth 30 seconds."

Only after that push do we let it go. Then:

- **Answered** → fact goes into the rebuild.
- **Range given** → rebuild uses the honest hedge ("around 80 a week").
- **"I'll find out"** → bullet stays unquantified, becomes a dashboard to-do that
  re-offers the same question later.
- **Genuinely doesn't know** → bullet stays unquantified. Never guessed, never bracketed.

Frame it once at the top: *"This is the only time we ask. Every number you give here
makes every application after this stronger."*

---

## Build order

**Phase 1 — the wire (do this first, no UI change)**
1. `welcome/finish` → new `buildCleanResume()` → write result to `resumeRawText`.
2. Add `resumeOriginalText` column; keep the upload there.
3. Run `autoExtractAchievements` on the **clean** text, not the raw.
4. Verify on a real client CV that a generated application grounds on clean text.

**Phase 2 — the questions**
5. New `server/src/services/intakeAnalysis.ts`. One call, returns
   `{ firstName, currentRole, brief, questions[] }`. Replaces `WELCOME_BRIEF_PROMPT`.
6. `welcome/brief` returns questions; stash with the token in `welcomeStore`.
7. New `WelcomePage` step `questions` between `brief` and `roles`.
8. `welcome/finish` takes answers → `buildCleanResume(text, answers)` → `resumeRawText`.

**Phase 3 — the close**
9. Show the finished resume before the dashboard: *"Here's what we built. Download it."*
   This is the trust moment and it's the "is it good enough now" verdict we don't have.
10. Unanswered questions → dashboard to-do list.

**Phase 4 — dedupe**
11. `/welcome` and `OnboardingIntake` are two parallel onboardings. Pick one.
    `/welcome` is the paid path — retire the other or point it at the same service.

---

## Guardrails (non-negotiable)

- **EVIDENCE RULE in both prompts.** Copy it verbatim from `diagnosticReport.ts:38`.
  The 30 Jul fabrication bug happened *because* a prompt in this chain didn't have it.
- **Hard gate before writing `resumeRawText`:** reject if the output contains `[`
  bracket blanks. A blank that leaks into the stored resume poisons every future
  generation. Fail loud, keep the previous text.
- **Do not re-ship the single-digit grounding gate.** Paused on purpose.
- **Resume stays TEXT.** Q&A answers stored as a JSON supplement — never as
  structured resume fields.

## Risk

Question fatigue immediately after payment. Mitigations: hard cap of 8, visible
progress, every question skippable, and the "only time we ask" framing.

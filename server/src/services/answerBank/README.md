# The answer bank

Application forms keep asking the same dozen open-ended questions in different
words. This builds a bank of the candidate's own stories, once, so those
questions are answered from material a human wrote and approved.

Two consumers: the browser extension that fills in forms (`JobHub/extension`),
and the interview tab, which today generates answers off the resume and should
be selecting from here instead.

## The one rule

**The model never writes an answer.** It reads what the candidate said, decides
what is missing, and asks for the missing part. Every word banked was spoken by
them.

This is not a style preference. A resume has no failures in it, so a model
asked to write a failure story invents one. JobHub has already lost a client's
IEEE publication to a system that believed its own output, and the diagnostic
used to fabricate numbers. The rule is enforced in two places:

| Where | What it guarantees |
|---|---|
| `interviewer.ts` → `probeIsSafe` | A follow-up that leads the witness, praises, or bundles questions is discarded for the written fallback |
| `clean.ts` → `checkSubtractive` | A tidy-up that adds a word or changes a number is discarded for the mechanical one |

Both are checks, not instructions. An instruction is a request.

## The files

| | |
|---|---|
| `intake.ts` | Resume in, interview out. Mines seeds, finds the themes a resume structurally cannot evidence, writes the anchored questions and their reach/shape/avoid hints. No model. |
| `interviewer.ts` | Scores a spoken answer for situation / action / obstacle / outcome, and decides the single next thing to ask. Deterministic. The model only phrases the follow-up, and there is a written fallback for every gap. |
| `clean.ts` | Filler removal, and the proof that a clean only removed. Also cuts the four length variants. |
| `transcribe.ts` | AssemblyAI. Boosted with the nouns from the candidate's own resume. |

Routes are in `routes/answer-bank.ts`. The page is `src/pages/AnswerBankIntakePage.tsx`.

## Why not the browser's speech API

It is free and needs no key, and it is wrong for this. Our candidates speak
accented Australian English, mostly second-language, and the browser recogniser
is trained hardest on the accents they do not have. A misheard word is not
cosmetic here: the cleaning step will smooth it into a confident wrong one, and
the candidate proof-reads a fluent sentence and never notices the noun changed.

## Setup

```
npx prisma migrate deploy        # creates AnswerBankIntake + AnswerBankEntry
ASSEMBLYAI_API_KEY=...           # without it, voice is off and typing still works
```

The page degrades honestly: no key means the record button is hidden and the
same intake runs by typing.

## Things that are true and easy to get wrong

- **The plan is never regenerated.** Rebuilding it renumbers the questions under
  answers already filed against them. The resume is snapshotted for the same reason.
- **`spoken` is never overwritten.** `cleaned` and `approved` sit beside it. If a
  variant is ever found to have drifted, their actual words are still there.
- **Only approved answers export.** A draft pasted into a real application is the
  thing this whole design exists to prevent.
- **`ethics` is never asked of a lab or trades candidate.** It is an industry addon
  theme, unlike `failure` and `conflict` which are always asked. Pinned by a test
  in `intake.test.ts`; moving it into the core set changes the matcher's theme
  pool for every existing bank.
- **The anchor is the employer with the most resume bullets**, which for a
  candidate whose casual jobs are one-liners is not their most recent work.

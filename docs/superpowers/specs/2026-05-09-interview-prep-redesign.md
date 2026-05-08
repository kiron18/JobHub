# Interview Prep Redesign

**Date:** 2026-05-09
**Status:** Approved — building

## Problem

The current interview prep output is generic: it predicts specific questions and generates STAR-format answer templates that don't reference the candidate's actual achievements. The sidebar "Likely Questions" panel makes a separate API call and returns only generic talking-point skeletons. The two panels are disconnected data sources. Neither prepares a candidate to answer questions they didn't predict.

## Design Philosophy

You cannot predict every interview question. But a candidate who knows 5-6 of their own stories deeply can answer anything — every behavioural, situational, or motivation question is an invitation to deploy a story they've already internalised. The system's job is to build that readiness, not script specific answers.

## Framework Change: CAR replaces STAR for Interview Prep

STAR stays for SC written responses (space permits thorough structure). CAR is used in interview prep because spoken delivery demands speed — "Situation" and "Task" together burn 30% of answer time before anything interesting is said. Context collapses them into a single breath.

- **C** — Context: One sentence. Sets the scene, establishes stakes.
- **A** — Action: 70% of the answer. Specific, first-person, demonstrates the competency.
- **R** — Result: Quantified where possible. Impact on team, org, or customer.

## Document Format (LLM Output)

The generation prompt instructs the LLM to output four sections with exact headings. The client parses these headings to build the structured UI — no markdown prose renderer is used for interview prep.

```
### 1. Know the Stage

#### Company Intelligence
[3-5 bullet facts from the JD]

#### What They're Looking For
[2-3 sentences on the hidden criteria]

#### Watch-Outs
[2-3 gaps with reframe strategies]

### 2. Story Bank

#### Story: [Short title]
**Hook:** [One sentence — action-first, result-anchored, memorisable]
**C:** [Context hint — 1 sentence max]
**A:** [3-4 action beats as short bullets]
**R:** [Result — specific, quantified if possible]
**Covers:** [competency1, competency2, competency3]

[5-6 story blocks total]

### 3. Prove It

#### Behavioural
**What these are:** Past behaviour predicts future performance. Expect "Tell me about a time when..."
**Use:** [Story title(s)]
1. [Question]
2. [Question]
3. [Question]

#### Situational
**What these are:** Hypothetical scenarios testing judgment. Expect "What would you do if..."
**Use:** [Story title(s)]
1. [Question]
2. [Question]
3. [Question]

#### Motivation
**What these are:** Why you, this role, this organisation. Expect "What draws you to..."
**Use:** [Story title(s)]
1. [Question]
2. [Question]
3. [Question]

#### Role-Specific
**What these are:** Technical and functional fit — drawn directly from the JD requirements.
**Use:** [Story title(s)]
1. [Question]
2. [Question]
3. [Question]

### 4. Questions to Ask
[4-5 bullet questions]
```

## Client Architecture

### Remove
- `InterviewQuestionsPanel.tsx` — replaced entirely. The separate `/analyze/interview-questions` call is eliminated.
- Interview prep sidebar content (the panel at line ~938 in ApplicationWorkspace.tsx)

### Add
- `InterviewPrepView.tsx` — standalone component receiving `doc: string` and `profileName: string`. Handles all parsing and rendering. Keeps ApplicationWorkspace clean.

### InterviewPrepView Sections

**Section 1 — Know the Stage**
Three collapsible sub-panels: Company Intelligence, What They're Looking For, Watch-Outs. Default: Company Intelligence expanded, others collapsed. Visual treatment: muted — `slate-800` border, `slate-500` heading text. Watch-outs uses amber accent.

**Section 2 — Your Story Bank**
Expanded by default. Brand-600 accent treatment — visually the centrepiece.

Each story card:
- **Hook sentence** — large, bold, `slate-100`. The one line to memorise.
- **CAR scaffold** — three rows (C / A / R) in smaller muted type. Hint format, not prose.
- **Competency chips** — small `slate-700` tags listing covered competencies.

Above the story cards: an inline educational panel (collapsed by default, expandable):
- Contrast example showing weak vs strong delivery of the same story
- One-line principle: "Know these stories and you can answer anything — every question is an invitation to use one."

**Section 3 — Prove It**
Four question-type panels, each collapsible. Default: all collapsed (user opens what they want to test).

Each panel:
- Type label (Behavioural / Situational / Motivation / Role-Specific)
- One-line explanation of the type
- "Use story:" tag mapping to a Story Bank entry
- 3-4 questions listed
- Each question has a "Reveal" toggle — hidden by default
- Revealed state shows: which story to open with, the CAR scaffold for that story, then a future-pacing coaching note: *"After landing the result — connect it forward: how does this experience make you the right fit for [Role] at [Company]?"*

Colour coding by type: Behavioural = indigo, Situational = amber, Motivation = pink, Role-Specific = emerald.

**Section 4 — Questions to Ask**
Collapsible, clean bullet list. Low visual prominence.

## Visual Hierarchy

| Section | Treatment | Default |
|---|---|---|
| Know the Stage | Muted, slate borders | Company Intel open |
| Story Bank | Brand-600 accent, elevated | Expanded |
| Prove It | Interactive, colour-coded by type | All collapsed |
| Questions to Ask | Plain list | Collapsed |

## Server Changes

1. **`server/rules/interview_prep_rules.md`** — complete rewrite to CAR format, Story Bank structure, and typed question lists
2. **`server/src/services/prompts/generation.ts`** — update interview-prep specific sections to reference new rules structure

## Files Changed

- `server/rules/interview_prep_rules.md` — rewrite
- `server/src/services/prompts/generation.ts` — minor interview-prep references
- `src/components/InterviewPrepView.tsx` — new component
- `src/components/ApplicationWorkspace.tsx` — swap InterviewQuestionsPanel for InterviewPrepView, remove old interview-prep rendering block
- `src/components/InterviewQuestionsPanel.tsx` — delete

# Phase 1 — Output Quality Design Spec
**Date:** 2026-03-27
**Status:** Approved by user

---

## Overview

Phase 1 makes the core generation output exceptional before any acquisition or discovery features are added. The thesis: Australian job seekers will judge JobHub entirely on whether the documents it produces actually help them land interviews. Everything in this phase serves that goal.

Four workstreams, in dependency order:

1. **Selection criteria prompt audit** — verify the implementation honours the rules
2. **Document feedback loop** — simple rating mechanism that feeds continuous improvement
3. **PDF + DOCX export** — professional templates for both formats
4. **Workspace UX** — tighten the paste-JD → generate → rate → export flow

---

## Scope

### Not in this phase
- Browser extension (phase 1 step 2 — separate spec)
- Firecrawl URL extraction (phase 3)
- Job recommendations (phase 3)
- Voice profile injection (explicitly removed — service provides professional output, not style mimicry)
- Application tracker outcome learning (phase 2)

---

## 1. Selection Criteria Prompt Audit

### Problem
The rules file (`selection_criteria_rules.md`) is comprehensive and correct. The risk is that the prompt implementation in `generate.ts` and `prompts.ts` does not enforce the rules — particularly:
- Word count per seniority level (200–800 words depending on level)
- STAR proportions (Action = 40–50%, Result = 20–25%)
- No component labels (Situation:, Task:, etc.) in final output
- Distinct examples per criterion — no reuse flagged
- Australian English throughout

### What gets audited
- `server/src/services/prompts.ts` — the `DOCUMENT_GENERATION_PROMPT` and `DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT` functions for `selection-criteria` type
- `server/src/services/strategy.ts` — the blueprint layer to confirm it handles SC correctly
- `server/src/services/quality-gate.ts` — confirm SC is evaluated against the rules file

### Fixes applied
Any gaps found between the rules file and the implementation get corrected in the prompt. No new infrastructure — just alignment.

---

## 2. Document Feedback Loop

### Design principle
Simple. Non-ML. Store signal now, use it to improve rules manually on a sprint cadence. No automatic prompt mutation.

### Data model

New Prisma model added to `schema.prisma`:

```prisma
model DocumentFeedback {
  id           String   @id @default(uuid())
  documentId   String
  userId       String
  rating       Int      // 1–5
  weakSection  String?  // "opening" | "evidence" | "company_connection" | "closing" | "star_situation" | "star_action" | "star_result" | "overall"
  freeText     String?
  createdAt    DateTime @default(now())
}
```

### API

New route: `POST /api/feedback/document`

Request body:
```ts
{
  documentId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  weakSection?: string;
  freeText?: string;
}
```

Returns `{ success: true }`.

### UI

After document generation, a compact feedback bar appears below the output:

```
How did this land?  ★ ★ ★ ☆ ☆   [What was weakest? ▾]  [Submit]
```

- Star rating (1–5, tap to set)
- Optional dropdown: weakest section (options vary by document type)
- Optional free text (single line, placeholder: "Anything specific?")
- Submits silently — no modal, no interruption
- Once submitted, feedback bar collapses to a checkmark

The feedback bar is rendered inside `GenerationPanel.tsx` or `ApplicationWorkspace.tsx` — wherever the generated content is displayed — after a document ID is returned from the API.

### Improvement cadence
Every sprint (or weekly): review aggregate ratings and weak section flags. If a section consistently scores low across multiple users, update the corresponding rules file. The rules files already carry the comment "Review quarterly or when market standards shift" — this changes the cadence to active.

---

## 3. PDF + DOCX Export

### Current state
`server/src/services/pdf.ts` handles *extraction* (reading uploaded PDFs). There is no export generation. `generate.ts` returns raw markdown/text content only.

### What gets built

**Server: export route**
New route: `POST /api/export/:documentId`

Query param: `?format=pdf` or `?format=docx`

Returns the generated file as a binary response with appropriate `Content-Disposition` header.

**Server: export service** (`server/src/services/export.ts`)

Two functions:
- `exportToPDF(content: string, type: DocumentType, profile: CandidateProfile): Promise<Buffer>`
- `exportToDOCX(content: string, type: DocumentType, profile: CandidateProfile): Promise<Buffer>`

**Libraries**
- DOCX: `docx` npm package — generates `.docx` with proper paragraph styles, fonts, margins
- PDF: render via `puppeteer` (headless Chrome) from a styled HTML template, OR use `@react-pdf/renderer` server-side

The export skill the user has downloaded will be invoked at implementation time to determine the preferred approach.

**Template spec (AU market standard)**

All templates follow the resume rules file formatting:
- Font: Calibri 11pt body, 13pt name
- Margins: 2cm all sides
- No tables, columns, or decorative elements
- ATS-safe structure (no text boxes, no headers/footers with critical content)
- Section order matches the rules file exactly

One template per document type:
- `resume` — standard reverse-chronological with CAR bullets
- `cover-letter` — 5-paragraph structure per rules
- `selection-criteria` — criterion-headed STAR responses with dividers

**Client: export buttons**

Two buttons added to the document output area in `GenerationPanel.tsx` / `ApplicationWorkspace.tsx`:

```
[Download PDF]  [Download Word]
```

Both trigger `GET /api/export/:documentId?format=pdf|docx`.

Loading state on click (export takes ~1-3s for PDF). No page navigation — file downloads in background.

---

## 4. Workspace UX

### Current state
`ApplicationWorkspace.tsx` (729 lines), `MatchEngine.tsx` (461 lines), `GenerationPanel.tsx` (220 lines) handle the paste-JD → analyse → select achievements → generate flow.

### Audit goal
Ensure the user flow is:
1. Paste JD → trigger analysis
2. View analysis results + achievement matches
3. Select/deselect achievements
4. Choose document type (cover letter / resume bullets / selection criteria)
5. Generate
6. Rate output (feedback bar)
7. Export (PDF / DOCX)

No dead ends. No ambiguous states (loading without feedback, errors without recovery). Each step has a clear affordance for what comes next.

### What gets fixed (audit findings drive this)
- Any step with no loading indicator
- Any error state with no recovery action
- Any generated output that doesn't show the export buttons
- Any generated output that doesn't show the feedback bar

No visual redesign — this is a flow audit and patch, not a rebuild. The frontend-design skill will be invoked only if specific UI components need to be built from scratch.

---

## Architecture Summary

```
Client
  ApplicationWorkspace / GenerationPanel
    → POST /api/generate/:type       (existing)
    → POST /api/feedback/document    (new)
    → GET  /api/export/:documentId   (new)

Server
  routes/generate.ts       (existing — no changes unless SC audit finds gaps)
  routes/feedback.ts       (new)
  routes/export.ts         (new)
  services/export.ts       (new — PDF + DOCX generation)
  services/prompts.ts      (existing — SC prompt fixes if needed)
  services/quality-gate.ts (existing — SC gate fixes if needed)

Database
  DocumentFeedback         (new model)
```

---

## Definition of Done

- [ ] Selection criteria prompt verified against rules — all checklist items enforced
- [ ] `DocumentFeedback` model migrated and route live
- [ ] Feedback bar renders after generation, submits silently, collapses on success
- [ ] `POST /api/export/:documentId` returns valid PDF and DOCX binaries
- [ ] PDF template passes ATS-safe checks (no tables, text boxes, proper heading structure)
- [ ] DOCX template opens correctly in Microsoft Word and Google Docs
- [ ] Export buttons wired in client, file downloads work
- [ ] Workspace flow has no dead ends or missing loading/error states

---

*Rules files updated as part of this phase: `resume_rules.md` (AU English default), `cover_letter_rules.md` (market scope and AU English enforcement).*

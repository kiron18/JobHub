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

New Prisma model added to `schema.prisma`. Uses an explicit relation to `Document` with cascade delete so feedback is cleaned up when a document is removed. Includes `documentType` so aggregate feedback is filterable by document type (cover letter low ratings vs SC low ratings point to different rules files).

```prisma
model DocumentFeedback {
  id           String       @id @default(uuid())
  documentId   String
  document     Document     @relation(fields: [documentId], references: [id], onDelete: Cascade)
  userId       String
  rating       Int          // 1–5
  documentType DocumentType // matches the document's type — for aggregate filtering
  weakSection  String?      // see per-type options below
  freeText     String?
  createdAt    DateTime     @default(now())
}
```

Also add to `Document` model:
```prisma
feedback DocumentFeedback[]
```

### weakSection options by document type

| DocumentType | Valid weakSection values |
|---|---|
| `RESUME` | `opening` (summary), `evidence` (bullet quality), `overall` |
| `COVER_LETTER` | `opening`, `evidence`, `company_connection`, `closing`, `overall` |
| `STAR_RESPONSE` | `star_situation`, `star_action`, `star_result`, `evidence`, `overall` |
| `SELECTION_CRITERIA` | `criterion_address`, `evidence_quality`, `word_count`, `star_proportion`, `overall` |

The UI renders only the relevant options for the document type being rated. The `weakSection` stored value is always one of the above strings.

### API

New route: `POST /api/feedback/document`

Requires `authenticate` middleware. The server fetches the `Document` record first (needed for the ownership check). It derives `documentType` from the fetched record — the client does not supply it, preventing spoofing. Returns 403 if `document.userId !== req.user.id`.

Request body:
```ts
{
  documentId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  weakSection?: string;
  freeText?: string;
}
```

Server inserts `DocumentFeedback` with `documentType` taken from `document.type`.

Returns `{ success: true }`.

### UI

After document generation, a compact feedback bar appears below the output:

```
How did this land?  ★ ★ ★ ☆ ☆   [What was weakest? ▾]  [Submit]
```

- Star rating (1–5, tap to set)
- Optional dropdown: weakest section (options from the per-type table above)
- Optional free text (single line, placeholder: "Anything specific?")
- Submits silently — no modal, no interruption
- Once submitted, feedback bar collapses to a checkmark

The feedback bar is rendered inside `GenerationPanel.tsx` or `ApplicationWorkspace.tsx` — wherever the generated content is displayed — after a document ID is returned from the API.

### Improvement cadence
Every sprint (or weekly): review aggregate ratings and weak section flags. If a section consistently scores low across multiple users, update the corresponding rules file. The rules files already carry the comment "Review quarterly or when market standards shift" — this changes the cadence to active.

---

## 3. PDF + DOCX Export

### Current state
`server/src/services/pdf.ts` handles *extraction* (reading uploaded PDFs/DOCXs for intake). There is no export generation. `generate.ts` returns raw markdown/text content only.

### Library selection
**PDF: `@react-pdf/renderer`** — runs in Node without system-level browser binaries. This is the correct choice for Railway/Nixpacks deployment. Puppeteer requires Chromium (~300MB) and system packages (`libnss3`, `libxss1`, etc.) not present in the Nixpacks Node 20 environment and would require a custom Dockerfile to install. Do not use puppeteer.

**DOCX: `docx`** npm package — generates `.docx` with programmatic paragraph styles, fonts, and margins. No binary dependencies.

### What gets built

**Server: export route** (`server/src/routes/export.ts`)

```
POST /api/export/:documentId?format=pdf|docx
```

Requires `authenticate` middleware. Must verify `document.userId === req.user.id` before generating — return 403 if mismatch (IDOR prevention).

Fetches the document by ID, fetches the user's `CandidateProfile`, calls the appropriate export service function, and streams the binary response with headers:
- `Content-Type: application/pdf` or `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `Content-Disposition: attachment; filename="[document-title].[ext]"`

**Server: export service** (`server/src/services/export.ts`)

```ts
exportToPDF(content: string, type: DocumentType, profile: CandidateProfile): Promise<Buffer>
exportToDOCX(content: string, type: DocumentType, profile: CandidateProfile): Promise<Buffer>
```

Both functions receive the stored document content (text/markdown from DB), the document type, and the profile (for the candidate header: name, email, phone, LinkedIn, location).

**Template spec (AU market standard)**

All templates follow the resume rules file formatting exactly:
- Font: Calibri 11pt body, 13pt name
- Margins: 2cm all sides
- No tables, columns, text boxes, or decorative elements
- ATS-safe structure (no headers/footers containing critical content)
- Section order matches the rules file exactly for each document type

One template per document type:
- `RESUME` — standard reverse-chronological with CAR bullets
- `COVER_LETTER` — 5-paragraph structure per rules
- `STAR_RESPONSE` — criterion-headed STAR responses with dividers between each criterion

**Client: export buttons**

Two buttons added to the document output area in `GenerationPanel.tsx` / `ApplicationWorkspace.tsx`:

```
[Download PDF]  [Download Word]
```

Both trigger `POST /api/export/:documentId?format=pdf|docx` using `responseType: 'blob'`. Loading state on click (export takes ~1–3s). No page navigation — file downloads in the background via a temporary blob URL.

### Setup steps
1. `npm install docx @react-pdf/renderer` (server)
2. `npx prisma migrate dev --name add_document_feedback` (after schema changes in section 2)
3. No new environment variables required for either library

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
    → POST /api/export/:documentId   (new — blob response)

Server
  routes/generate.ts       (existing — no changes unless SC audit finds gaps)
  routes/feedback.ts       (new)
  routes/export.ts         (new)
  services/export.ts       (new — PDF via @react-pdf/renderer, DOCX via docx)
  services/prompts.ts      (existing — SC prompt fixes if needed)
  services/quality-gate.ts (existing — SC gate fixes if needed)

Database
  DocumentFeedback         (new model — cascades on Document delete)
```

---

## Definition of Done

- [ ] Selection criteria prompt verified against rules — all checklist items enforced
- [ ] `DocumentFeedback` model migrated (with Prisma relation + cascade), route live, ownership check in place
- [ ] Feedback bar renders after generation, shows correct weakSection options per document type, submits silently, collapses on success
- [ ] `POST /api/export/:documentId` returns binary with correct `Content-Type` and `Content-Disposition` headers; PDF response > 1KB; DOCX response > 5KB and `Content-Type` is `application/vnd.openxmlformats-officedocument.wordprocessingml.document`; DOCX opens without error in Word and Google Docs (manual acceptance check)
- [ ] Export route rejects requests where `document.userId !== req.user.id` with 403
- [ ] PDF template is ATS-safe (no tables, text boxes, correct heading structure)
- [ ] Export buttons wired in client, file downloads in background without page navigation
- [ ] Workspace flow has no dead ends or missing loading/error states

---

*Rules files updated as part of this phase: `resume_rules.md` (AU English default, added behaviour/travelling/skilful), `cover_letter_rules.md` (market scope and AU English enforcement).*

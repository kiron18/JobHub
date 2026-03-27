# Phase 1 — Output Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make JobHub's document generation exceptional — SC prompt rules enforcement, document feedback loop, PDF/DOCX export, and workspace UX tightening.

**Architecture:** Four sequential workstreams: (1) fix SC prompt gaps in `prompts.ts`, (2) add `DocumentFeedback` Prisma model + feedback API + React component, (3) add PDF/DOCX export service + API route + client buttons, (4) wire everything into `ApplicationWorkspace.tsx` and audit for dead ends.

**Tech Stack:** TypeScript, Express, Prisma (PostgreSQL), React 18, Framer Motion, `@react-pdf/renderer` (PDF), `docx` (DOCX), Tailwind CSS.

---

## File Map

### Files to create
| File | Purpose |
|------|---------|
| `server/src/routes/feedback.ts` | POST /api/feedback/document — ownership-checked feedback write |
| `server/src/routes/export.ts` | POST /api/export/:documentId — binary PDF or DOCX response |
| `server/src/services/exportService.ts` | `exportToPDF()` and `exportToDOCX()` functions |
| `src/components/DocumentFeedbackBar.tsx` | Star rating + weak section dropdown + submit; collapsible |

### Files to modify
| File | What changes |
|------|-------------|
| `server/prisma/schema.prisma` | Add `DocumentFeedback` model + `feedback` relation on `Document` + add `SELECTION_CRITERIA` to `DocumentType` enum |
| `server/src/services/prompts.ts` | Fix 3 SC gaps: seniority word count, no-reuse rule, fallback tone |
| `server/src/index.ts` | Register `feedbackRouter` and `exportRouter` |
| `src/components/ApplicationWorkspace.tsx` | Add `DocumentFeedbackBar` below output; add PDF/DOCX download buttons |

---

## Task 1: SC Prompt Audit Fixes

**Files:**
- Modify: `server/src/services/prompts.ts`

### Context — gaps found between `selection_criteria_rules.md` and prompt implementation

Three gaps identified:

1. **Word count per seniority** — rules file mandates 200–800 words/criterion by seniority level. Neither prompt enforces this. Profile has `seniority` field.
2. **No achievement reuse across criteria** — rules file explicitly flags reuse as a failure mode. Neither prompt instructs the model to use distinct evidence per criterion.
3. **Fallback tone not Australian** — `DOCUMENT_GENERATION_PROMPT` falls back to `"Professional, direct English."` — missing "Australian".

- [ ] **Step 1: Verify the three gap locations in prompts.ts**

Read `server/src/services/prompts.ts`. Confirm:
- Line ~606: `DOCUMENT_GENERATION_PROMPT` fallback tone is `"Professional, direct English."` (missing "Australian")
- Line ~560: `DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT` STAR_RESPONSE block has no word count or no-reuse instruction
- Line ~651: `DOCUMENT_GENERATION_PROMPT` STAR_RESPONSE block has no word count or no-reuse instruction

- [ ] **Step 2: Fix fallback tone in `DOCUMENT_GENERATION_PROMPT`**

In `DOCUMENT_GENERATION_PROMPT`, change:
```ts
// Before (around line 606):
${analysisContext?.tone ? `Mirror this style: ${analysisContext.tone}` : "Professional, direct English."}

// After:
${analysisContext?.tone ? `Mirror this style: ${analysisContext.tone}` : "Professional, direct Australian English."}
```

- [ ] **Step 3: Add seniority word count helper above `DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT`**

Add this helper function before the `DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT` export (around line 422):

```ts
function scWordCountGuidance(seniority?: string): string {
  if (!seniority) return '300–500 words per criterion.';
  const s = seniority.toLowerCase();
  if (s.includes('graduate') || s.includes('entry') || s.includes('junior')) return '200–300 words per criterion.';
  if (s.includes('senior') || s.includes('el1') || s.includes('el 1') || s.includes('principal')) return '400–600 words per criterion.';
  if (s.includes('executive') || s.includes('ses') || s.includes('director') || s.includes('manager')) return '600–800 words per criterion.';
  return '300–500 words per criterion.';
}
```

- [ ] **Step 4: Add word count + no-reuse block in `DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT` for STAR_RESPONSE**

In `DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT`, replace the STAR_RESPONSE branch of step 4 (around line 559–560):

```ts
// Before:
? 'STAR FORMAT: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%). Flowing prose. First person active voice. Do NOT use Situation/Task/Action/Result as subheadings.'

// After:
? `STAR FORMAT: Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%). Flowing prose. First person active voice. Do NOT use Situation/Task/Action/Result as subheadings.
   WORD COUNT: Target ${scWordCountGuidance(profile.seniority)} Do not pad — if a criterion is addressed in fewer words with strong evidence, that is acceptable.
   EVIDENCE REUSE: Each criterion response MUST draw on different achievements or different aspects of the same role. Do NOT repeat the same example, metric, or achievement title across multiple criterion responses. Flag where evidence is genuinely thin with [MISSING: brief description].`
```

Note: This requires passing `profile` into the template string — `profile.seniority` is already available in scope as `profile` is a parameter.

- [ ] **Step 5: Add the same word count + no-reuse block in `DOCUMENT_GENERATION_PROMPT` for STAR_RESPONSE**

In `DOCUMENT_GENERATION_PROMPT`, replace the STAR_RESPONSE branch of step 4 (around line 650–651):

```ts
// Before:
? `STAR FORMAT REQUIRED: Each criterion response must follow Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%). Do NOT label these components as subheadings. Write in flowing prose, first person, active voice.`

// After:
? `STAR FORMAT REQUIRED: Each criterion response must follow Situation (10-15%) → Task (10-15%) → Action (40-50%) → Result (20-25%). Do NOT label these components as subheadings. Write in flowing prose, first person, active voice.
   WORD COUNT: Target ${scWordCountGuidance(profile.seniority)} Do not pad with filler — if the evidence supports a shorter response, that is acceptable.
   EVIDENCE REUSE: Each criterion response MUST draw on different achievements or different role evidence. Do NOT repeat the same example, metric, or achievement title across multiple criterion responses.`
```

- [ ] **Step 6: Confirm TypeScript compiles clean**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/prompts.ts
git commit -m "fix(prompts): SC seniority word count, no-reuse rule, AU English fallback"
```

---

## Task 2: Schema Migration — DocumentFeedback

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Install export dependencies first (needed for subsequent tasks)**

```bash
cd server && npm install docx @react-pdf/renderer
```

Expected: packages added to server/package.json. No build errors.

- [ ] **Step 2: Add `SELECTION_CRITERIA` to `DocumentType` enum**

In `schema.prisma`, update the enum (around line 180):

```prisma
// Before:
enum DocumentType {
  RESUME
  COVER_LETTER
  STAR_RESPONSE
}

// After:
enum DocumentType {
  RESUME
  COVER_LETTER
  STAR_RESPONSE
  SELECTION_CRITERIA
}
```

Note: `STAR_RESPONSE` remains for backward compatibility with existing stored documents. New selection criteria docs will use `SELECTION_CRITERIA`. Update `generate.ts` line 83: change `'STAR_RESPONSE'` to `'SELECTION_CRITERIA'` for the `selection-criteria` route type.

- [ ] **Step 3: Add `feedback` relation to `Document` model**

In `schema.prisma`, inside the `Document` model (after `updatedAt`):

```prisma
  feedback  DocumentFeedback[]
```

- [ ] **Step 4: Add `DocumentFeedback` model**

After the `DocumentType` enum, add:

```prisma
model DocumentFeedback {
  id           String       @id @default(uuid())
  documentId   String
  document     Document     @relation(fields: [documentId], references: [id], onDelete: Cascade)
  userId       String
  rating       Int
  documentType DocumentType
  weakSection  String?
  freeText     String?
  createdAt    DateTime     @default(now())
}
```

- [ ] **Step 5: Run migration**

```bash
cd server && npx prisma migrate dev --name add_document_feedback_and_selection_criteria
```

Expected: migration file created in `server/prisma/migrations/`, Prisma client regenerated, no errors.

- [ ] **Step 6: Update `generate.ts` — map `selection-criteria` to `SELECTION_CRITERIA` type**

In `server/src/routes/generate.ts`, line 83:

```ts
// Before:
const docType = type === 'selection-criteria' ? 'STAR_RESPONSE' : (type === 'cover-letter' ? 'COVER_LETTER' : 'RESUME');

// After:
const docType = type === 'selection-criteria' ? 'SELECTION_CRITERIA' : (type === 'cover-letter' ? 'COVER_LETTER' : 'RESUME');
```

Also update the `generateBlueprint` call's `docType` parameter — it accepts `'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE'`. Update the type in `strategy.ts` to accept `'SELECTION_CRITERIA'` as well, mapping it to `'STAR_RESPONSE'` internally for blueprint generation:

In `server/src/services/strategy.ts`, update the function signature:
```ts
// Before:
docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE'

// After:
docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'SELECTION_CRITERIA'
```

Also update `STRATEGY_BLUEPRINT_PROMPT` in `prompts.ts` to accept the new type in its signature if it has a union type parameter.

- [ ] **Step 7: Confirm TypeScript compiles clean**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/ server/src/routes/generate.ts server/src/services/strategy.ts server/src/services/prompts.ts
git commit -m "feat(schema): add DocumentFeedback model, SELECTION_CRITERIA type, cascade relation"
```

---

## Task 3: Feedback API Route

**Files:**
- Create: `server/src/routes/feedback.ts`
- Modify: `server/src/index.ts`

The `weakSection` valid values per `DocumentType` are:
- `RESUME`: `opening`, `evidence`, `overall`
- `COVER_LETTER`: `opening`, `evidence`, `company_connection`, `closing`, `overall`
- `STAR_RESPONSE`: `star_situation`, `star_action`, `star_result`, `evidence`, `overall`
- `SELECTION_CRITERIA`: `criterion_address`, `evidence_quality`, `word_count`, `star_proportion`, `overall`

- [ ] **Step 1: Create `server/src/routes/feedback.ts`**

```ts
import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const WEAK_SECTIONS: Record<string, string[]> = {
  RESUME: ['opening', 'evidence', 'overall'],
  COVER_LETTER: ['opening', 'evidence', 'company_connection', 'closing', 'overall'],
  STAR_RESPONSE: ['star_situation', 'star_action', 'star_result', 'evidence', 'overall'],
  SELECTION_CRITERIA: ['criterion_address', 'evidence_quality', 'word_count', 'star_proportion', 'overall'],
};

// POST /api/feedback/document
router.post('/document', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { documentId, rating, weakSection, freeText } = req.body;

  if (!documentId || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'documentId and rating (1–5) are required' });
  }

  try {
    const document = await prisma.document.findUnique({ where: { id: documentId } });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const validWeakSections = WEAK_SECTIONS[document.type] ?? [];
    if (weakSection && !validWeakSections.includes(weakSection)) {
      return res.status(400).json({ error: `Invalid weakSection for document type ${document.type}` });
    }

    await prisma.documentFeedback.create({
      data: {
        documentId,
        userId,
        rating,
        documentType: document.type,
        weakSection: weakSection ?? null,
        freeText: freeText?.trim() ?? null,
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('[Feedback] Error:', error);
    return res.status(500).json({ error: 'Failed to save feedback' });
  }
});

export default router;
```

- [ ] **Step 2: Register the feedback router in `server/src/index.ts`**

Add the import near the other route imports:
```ts
import feedbackRouter from './routes/feedback';
```

Add the route registration after the existing routes:
```ts
app.use('/api/feedback', feedbackRouter);
```

- [ ] **Step 3: Confirm TypeScript compiles clean**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/feedback.ts server/src/index.ts
git commit -m "feat(api): POST /api/feedback/document with ownership check"
```

---

## Task 4: Export Service

**Files:**
- Create: `server/src/services/exportService.ts`

The export service receives stored markdown content and converts it to PDF or DOCX. The markdown format from the LLM is consistent: `# Name`, `## Section`, `- bullet`, `**bold**`, `*italic*`, plain paragraphs.

### Markdown parser (internal, no external dep)

A simple line-by-line parser classifies each line into:
- `h1` — `# text`
- `h2` — `## text`
- `h3` — `### text`
- `bullet` — `- text`
- `blank` — empty line
- `paragraph` — everything else

Bold (`**text**`) and italic (`*text*`) are handled inline within each line.

- [ ] **Step 1: Create `server/src/services/exportService.ts`**

```ts
import { Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { pdf, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import React from 'react';

// ── Markdown line types ──────────────────────────────────────────────────────

interface ParsedLine {
  type: 'h1' | 'h2' | 'h3' | 'bullet' | 'blank' | 'paragraph';
  text: string; // raw text after stripping the marker
}

function parseMarkdownLines(markdown: string): ParsedLine[] {
  return markdown.split('\n').map(raw => {
    const line = raw.trimEnd();
    if (line.startsWith('### ')) return { type: 'h3', text: line.slice(4) };
    if (line.startsWith('## ')) return { type: 'h2', text: line.slice(3) };
    if (line.startsWith('# ')) return { type: 'h1', text: line.slice(2) };
    if (line.startsWith('- ')) return { type: 'bullet', text: line.slice(2) };
    if (line.trim() === '') return { type: 'blank', text: '' };
    return { type: 'paragraph', text: line };
  });
}

// Strip inline markdown from a string (used for DOCX plain text)
function stripInline(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
}

// Build DOCX TextRun array from a string with **bold** and *italic*
function buildRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) runs.push(new TextRun({ text: text.slice(last, match.index) }));
    if (match[1] !== undefined) runs.push(new TextRun({ text: match[1], bold: true }));
    else if (match[2] !== undefined) runs.push(new TextRun({ text: match[2], italics: true }));
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last) }));
  return runs.length > 0 ? runs : [new TextRun({ text })];
}

// ── DOCX Export ──────────────────────────────────────────────────────────────

export async function exportToDOCX(content: string): Promise<Buffer> {
  const lines = parseMarkdownLines(content);

  const children: Paragraph[] = [];

  for (const line of lines) {
    switch (line.type) {
      case 'h1':
        children.push(new Paragraph({
          text: stripInline(line.text),
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 80 },
        }));
        break;
      case 'h2':
        children.push(new Paragraph({
          text: stripInline(line.text),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 80 },
        }));
        break;
      case 'h3':
        children.push(new Paragraph({
          text: stripInline(line.text),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 40 },
        }));
        break;
      case 'bullet':
        children.push(new Paragraph({
          children: buildRuns(line.text),
          bullet: { level: 0 },
          spacing: { after: 40 },
        }));
        break;
      case 'paragraph':
        children.push(new Paragraph({
          children: buildRuns(line.text),
          spacing: { after: 80 },
        }));
        break;
      case 'blank':
        // Skip blank lines — spacing is handled via paragraph spacing
        break;
    }
  }

  const doc = new DocxDocument({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 }, // ~2cm in twips
        },
      },
      children,
    }],
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 }, // 11pt in half-points
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}

// ── PDF Export ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingLeft: 57,
    paddingRight: 57,
    fontFamily: 'Helvetica',
    fontSize: 11,
  },
  h1: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#aaa', paddingBottom: 2 },
  h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 2 },
  bullet: { fontSize: 11, marginBottom: 2, paddingLeft: 14 },
  paragraph: { fontSize: 11, lineHeight: 1.5, marginBottom: 4 },
});

// Render inline bold/italic as nested Text elements for @react-pdf/renderer
function renderInlinePdf(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(React.createElement(Text, { key: i++ }, text.slice(last, match.index)));
    if (match[1] !== undefined) nodes.push(React.createElement(Text, { key: i++, style: { fontFamily: 'Helvetica-Bold' } }, match[1]));
    else if (match[2] !== undefined) nodes.push(React.createElement(Text, { key: i++, style: { fontFamily: 'Helvetica-Oblique' } }, match[2]));
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(React.createElement(Text, { key: i++ }, text.slice(last)));
  return nodes;
}

function buildPdfDocument(content: string): React.ReactElement {
  const lines = parseMarkdownLines(content);
  const children: React.ReactElement[] = [];
  let i = 0;

  for (const line of lines) {
    switch (line.type) {
      case 'h1':
        children.push(React.createElement(Text, { key: i++, style: styles.h1 }, stripInline(line.text)));
        break;
      case 'h2':
        children.push(React.createElement(Text, { key: i++, style: styles.h2 }, stripInline(line.text)));
        break;
      case 'h3':
        children.push(React.createElement(Text, { key: i++, style: styles.h3 }, stripInline(line.text)));
        break;
      case 'bullet':
        children.push(React.createElement(Text, { key: i++, style: styles.bullet },
          ['• ', ...renderInlinePdf(line.text)]
        ));
        break;
      case 'paragraph':
        children.push(React.createElement(Text, { key: i++, style: styles.paragraph },
          renderInlinePdf(line.text)
        ));
        break;
      default:
        break;
    }
  }

  return React.createElement(Document, {},
    React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(View, {}, ...children)
    )
  );
}

export async function exportToPDF(content: string): Promise<Buffer> {
  const doc = buildPdfDocument(content);
  const stream = await pdf(doc).toBuffer();
  return stream;
}
```

- [ ] **Step 2: Confirm TypeScript compiles clean**

```bash
cd server && npx tsc --noEmit
```

If @react-pdf/renderer types cause issues, check that `@types/react` is installed in the server package.json. The server needs React as a peer dep for `@react-pdf/renderer`:
```bash
cd server && npm install --save-dev @types/react react
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/exportService.ts server/package.json server/package-lock.json
git commit -m "feat(export): PDF via @react-pdf/renderer, DOCX via docx package"
```

---

## Task 5: Export API Route

**Files:**
- Create: `server/src/routes/export.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create `server/src/routes/export.ts`**

```ts
import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { exportToPDF, exportToDOCX } from '../services/exportService';

const router = Router();

// POST /api/export/:documentId?format=pdf|docx
router.post('/:documentId', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { documentId } = req.params;
  const format = (req.query['format'] as string)?.toLowerCase();

  if (format !== 'pdf' && format !== 'docx') {
    return res.status(400).json({ error: 'format must be pdf or docx' });
  }

  try {
    const document = await prisma.document.findUnique({ where: { id: documentId } });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const safeName = (document.title ?? 'document')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (format === 'pdf') {
      const buffer = await exportToPDF(document.content);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
      return res.send(buffer);
    }

    // docx
    const buffer = await exportToDOCX(document.content);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.docx"`);
    return res.send(buffer);

  } catch (error) {
    console.error('[Export] Error:', error);
    return res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
```

- [ ] **Step 2: Register the export router in `server/src/index.ts`**

Add import:
```ts
import exportRouter from './routes/export';
```

Add route registration:
```ts
app.use('/api/export', exportRouter);
```

- [ ] **Step 3: Confirm TypeScript compiles clean**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/export.ts server/src/index.ts
git commit -m "feat(api): POST /api/export/:documentId with ownership check, pdf/docx format"
```

---

## Task 6: DocumentFeedbackBar Component

**Files:**
- Create: `src/components/DocumentFeedbackBar.tsx`

This component renders below the generated document. It shows: 5 stars → optional weak section dropdown → optional free text → Submit. On success it collapses to a check mark. It is invisible until a `documentId` is provided (i.e., after generation).

- [ ] **Step 1: Create `src/components/DocumentFeedbackBar.tsx`**

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import api from '../lib/api';

type DocumentType = 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'SELECTION_CRITERIA';

const WEAK_SECTIONS: Record<DocumentType, Array<{ value: string; label: string }>> = {
  RESUME: [
    { value: 'opening', label: 'Opening summary' },
    { value: 'evidence', label: 'Bullet quality' },
    { value: 'overall', label: 'Overall' },
  ],
  COVER_LETTER: [
    { value: 'opening', label: 'Opening' },
    { value: 'evidence', label: 'Evidence' },
    { value: 'company_connection', label: 'Company connection' },
    { value: 'closing', label: 'Closing' },
    { value: 'overall', label: 'Overall' },
  ],
  STAR_RESPONSE: [
    { value: 'star_situation', label: 'Situation/Task' },
    { value: 'star_action', label: 'Action' },
    { value: 'star_result', label: 'Result' },
    { value: 'evidence', label: 'Evidence quality' },
    { value: 'overall', label: 'Overall' },
  ],
  SELECTION_CRITERIA: [
    { value: 'criterion_address', label: 'How criteria are addressed' },
    { value: 'evidence_quality', label: 'Evidence quality' },
    { value: 'word_count', label: 'Word count / length' },
    { value: 'star_proportion', label: 'STAR proportions' },
    { value: 'overall', label: 'Overall' },
  ],
};

interface Props {
  documentId: string;
  documentType: DocumentType;
}

export function DocumentFeedbackBar({ documentId, documentType }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [weakSection, setWeakSection] = useState('');
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const options = WEAK_SECTIONS[documentType] ?? WEAK_SECTIONS['RESUME'];
  const displayRating = hovered ?? rating ?? 0;

  async function handleSubmit() {
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/feedback/document', {
        documentId,
        rating,
        weakSection: weakSection || undefined,
        freeText: freeText.trim() || undefined,
      });
      setSubmitted(true);
    } catch {
      // silent — feedback is non-critical
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {submitted ? (
        <motion.div
          key="done"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', color: '#6b7280', fontSize: 13 }}
        >
          <CheckCircle size={16} color="#10b981" />
          Thanks for the feedback
        </motion.div>
      ) : (
        <motion.div
          key="bar"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: '1px solid rgba(0,0,0,0.06)' }}
        >
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, flexShrink: 0 }}>How did this land?</span>

          {/* Stars */}
          <div style={{ display: 'flex', gap: 3 }} onMouseLeave={() => setHovered(null)}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onMouseEnter={() => setHovered(n)}
                onClick={() => setRating(n)}
                style={{
                  fontSize: 18,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: n <= displayRating ? '#f59e0b' : '#d1d5db',
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ★
              </button>
            ))}
          </div>

          {/* Weak section — only show after a rating */}
          {rating && (
            <select
              value={weakSection}
              onChange={e => setWeakSection(e.target.value)}
              style={{
                fontSize: 12,
                padding: '4px 8px',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                color: '#6b7280',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <option value="">What was weakest?</option>
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}

          {/* Free text */}
          {rating && (
            <input
              type="text"
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Anything specific?"
              style={{
                fontSize: 12,
                padding: '4px 10px',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                color: '#374151',
                flexGrow: 1,
                minWidth: 140,
              }}
            />
          )}

          {rating && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '5px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#6366f1',
                color: '#fff',
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              {submitting ? '...' : 'Submit'}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Confirm TypeScript compiles clean (client)**

```bash
cd E:/AntiGravity/JobHub && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DocumentFeedbackBar.tsx
git commit -m "feat(ui): DocumentFeedbackBar — star rating, weak section, silent submit"
```

---

## Task 7: Wire Feedback Bar + Export Buttons into ApplicationWorkspace

**Files:**
- Modify: `src/components/ApplicationWorkspace.tsx`

`ApplicationWorkspace.tsx` already tracks `state.documentIds` (a map of `activeTab → documentId | null`) and `state.documents` (the content). Export and feedback should appear when `state.documentIds[state.activeTab]` is non-null and `state.isGenerating` is false.

The document type mapping (for feedback bar props):
```ts
const DOC_TYPE_MAP: Record<string, 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'SELECTION_CRITERIA'> = {
  'resume': 'RESUME',
  'cover-letter': 'COVER_LETTER',
  'selection-criteria': 'SELECTION_CRITERIA',
};
```

The export buttons trigger `POST /api/export/:documentId?format=pdf|docx` with `responseType: 'blob'`, then create a temporary anchor element to trigger the download.

- [ ] **Step 1: Add imports to `ApplicationWorkspace.tsx`**

At the top of the file, add:
```tsx
import { DocumentFeedbackBar } from './DocumentFeedbackBar';
```

- [ ] **Step 2: Add `handleExport` function inside `ApplicationWorkspace`**

Inside the component (near the other handler functions), add:

```tsx
async function handleExport(format: 'pdf' | 'docx') {
  const docId = state.documentIds[state.activeTab];
  if (!docId) return;
  try {
    const response = await api.post(
      `/export/${docId}?format=${format}`,
      {},
      { responseType: 'blob' }
    );
    const url = URL.createObjectURL(response.data);
    // Use filename from Content-Disposition header if present
    const disposition = response.headers?.['content-disposition'] ?? '';
    const nameMatch = disposition.match(/filename="([^"]+)"/);
    const a = document.createElement('a');
    a.href = url;
    a.download = nameMatch?.[1] ?? `document.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Export failed. Try again.');
  }
}
```

- [ ] **Step 3: Locate the export button area and add PDF/DOCX buttons**

In the document header toolbar (the row that contains "Edit Inline", "Re-generate" buttons — around line 540–590 based on the file), add two export buttons when `state.documentIds[state.activeTab]` is non-null:

```tsx
{state.documentIds[state.activeTab] && !state.isGenerating && (
  <>
    <button
      onClick={() => handleExport('pdf')}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
        fontSize: 12, fontWeight: 700, color: '#d1d5db', cursor: 'pointer',
      }}
    >
      <Download size={12} />
      PDF
    </button>
    <button
      onClick={() => handleExport('docx')}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
        fontSize: 12, fontWeight: 700, color: '#d1d5db', cursor: 'pointer',
      }}
    >
      <Download size={12} />
      Word
    </button>
  </>
)}
```

Note: `Download` is already imported from `lucide-react` in this file (line 7).

- [ ] **Step 4: Add `DocumentFeedbackBar` below the document output area**

In the document output area (around line 703–712, after the `</div>` that wraps the prose article and before the `StrategistDebrief`), add:

```tsx
{state.documentIds[state.activeTab] && !state.isGenerating && (
  <div style={{ padding: '0 12px 8px' }}>
    <DocumentFeedbackBar
      documentId={state.documentIds[state.activeTab]!}
      documentType={DOC_TYPE_MAP[state.activeTab] ?? 'RESUME'}
    />
  </div>
)}
```

Add the `DOC_TYPE_MAP` constant at the top of the component body (before the `state` declarations):

```tsx
const DOC_TYPE_MAP: Record<string, 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'SELECTION_CRITERIA'> = {
  'resume': 'RESUME',
  'cover-letter': 'COVER_LETTER',
  'selection-criteria': 'SELECTION_CRITERIA',
};
```

- [ ] **Step 5: Confirm TypeScript compiles clean**

```bash
cd E:/AntiGravity/JobHub && npx tsc --noEmit
```

Fix any type errors. Common issue: `state.documentIds[state.activeTab]` may be `string | null` — use `!` non-null assertion where guarded by the conditional check.

- [ ] **Step 6: Commit**

```bash
git add src/components/ApplicationWorkspace.tsx
git commit -m "feat(workspace): export PDF/DOCX buttons, DocumentFeedbackBar after generation"
```

---

## Task 8: Workspace UX Audit

**Files:**
- Modify: `src/components/ApplicationWorkspace.tsx` (targeted fixes only)

Walk through the user flow step-by-step and fix any dead ends or missing states.

- [ ] **Step 1: Verify step 1 — JD paste triggers analysis**

In the workspace, confirm: when the user pastes a JD and triggers analysis, there is a visible loading state. Check that `state.isGenerating` or an equivalent `isAnalysing` flag is used and a spinner is shown. If analysis (not generation) lacks a loading indicator, add one.

Look for the `handleAnalyse` function (or similar) in `ApplicationWorkspace.tsx`. Check if it sets a loading flag. If the analysis button has no disabled/loading state, add `disabled={isAnalysing}` and a spinner icon.

- [ ] **Step 2: Verify step 5 — generation errors have recovery**

Check `state.hasFailed`. Confirm that when `state.hasFailed[state.activeTab]` is true, a visible error message is shown with a "Try again" button that calls `handleGenerate`. Read lines 610–655 of ApplicationWorkspace to confirm the error state is rendered.

If the error state is missing or shows only text with no retry action, add a retry button:

```tsx
{state.hasFailed[state.activeTab] && (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
    <p style={{ color: '#ef4444', fontSize: 14, fontWeight: 600 }}>Generation failed</p>
    <button onClick={() => handleGenerate(state.activeTab, true)} style={{ ... }}>Try again</button>
  </div>
)}
```

- [ ] **Step 3: Confirm no dead ends in the generate → rate → export flow**

With the changes from Tasks 6 and 7, the flow should be:
1. Paste JD → analysis loading → results ✓
2. Select achievements ✓
3. Choose tab → Generate ✓
4. Generating loading indicator ✓ (already present)
5. Document rendered + feedback bar + export buttons ✓ (added in Task 7)
6. Re-generate available ✓ (already present)

If any step lacks the expected UI, fix it now.

- [ ] **Step 4: Commit if any fixes were made**

```bash
git add src/components/ApplicationWorkspace.tsx
git commit -m "fix(workspace): UX audit — error recovery, loading states"
```

---

## Definition of Done Checklist

After all tasks are complete, verify each item manually:

- [ ] **SC prompt**: Generate a selection criteria document, confirm no component labels (Situation:, Task: etc.) in output, confirm evidence differs between criteria
- [ ] **Feedback bar**: Generates a document, feedback bar appears below output, 5 stars selectable, weak section dropdown shows correct options for document type, submit collapses to checkmark, no page navigation
- [ ] **Feedback API**: POST `/api/feedback/document` with a valid `documentId` returns `{ success: true }`. POST with another user's `documentId` returns 403.
- [ ] **PDF export**: Download PDF button appears after generation, click triggers file download, file size > 1KB, opens in PDF reader
- [ ] **DOCX export**: Download Word button appears, file size > 5KB, Content-Type is `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, opens without error in Word or Google Docs
- [ ] **Export security**: POST `/api/export/:documentId` for another user's document returns 403
- [ ] **No dead ends**: Every step from JD paste to export has a visible loading state and error recovery

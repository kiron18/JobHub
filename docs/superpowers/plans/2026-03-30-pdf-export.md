# PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side PDF download to ApplicationWorkspace, DocumentLibrary, and all document viewer surfaces — alongside the existing .docx export.

**Architecture:** `@react-pdf/renderer` is already installed on the frontend (`package.json` confirms v4.3.2). DOCX export already works via `src/lib/exportDocx.ts`. PDF export follows the same client-side pattern: a new `src/lib/exportPdf.ts` that takes markdown content + doc type and returns a blob — no new server routes required. ApplicationWorkspace adds a "Download PDF" button next to the existing "Export .docx" button. DocumentLibrary downloads via the same function.

**Tech Stack:** `@react-pdf/renderer` v4.3.2 (already installed), React 19, TypeScript, existing `DocType` type from `exportDocx.ts`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/exportPdf.ts` | **Create** | Parse markdown → `@react-pdf/renderer` Document → Blob download |
| `src/components/ApplicationWorkspace.tsx` | **Modify** | Import `exportPdf`, add "Download PDF" button next to existing DOCX button |
| `src/components/DocumentLibrary.tsx` | **Modify** | Import `exportPdf`, add PDF download action alongside existing copy/delete |

---

## Task 1: Create `src/lib/exportPdf.ts`

**Files:**
- Create: `src/lib/exportPdf.ts`

- [ ] **Step 1: Scaffold the file and check the import works**

Create `src/lib/exportPdf.ts` with the full implementation:

```typescript
/**
 * PDF export for generated documents.
 *
 * Uses @react-pdf/renderer (already installed, v4.3.2) to produce
 * ATS-safe, AU market-standard PDFs entirely client-side.
 * No server round-trip, no binary dependencies.
 */
import React from 'react';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';

export type DocType = 'resume' | 'cover-letter' | 'selection-criteria' | 'interview-prep' | 'teaching-philosophy' | 'research-statement';

// -------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------

const MARGIN_PT = 56.7; // ~20mm in points

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    paddingTop: MARGIN_PT,
    paddingBottom: MARGIN_PT,
    paddingHorizontal: MARGIN_PT,
    lineHeight: 1.4,
    color: '#111827',
  },
  // Headings
  h1: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    marginTop: 0,
    color: '#111827',
  },
  h2: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 14,
    marginBottom: 4,
    color: '#4B5563',
    textTransform: 'uppercase',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 2,
  },
  h3: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 2,
    color: '#111827',
  },
  // Body
  para: {
    fontSize: 11,
    marginBottom: 4,
    color: '#111827',
  },
  bullet: {
    fontSize: 11,
    marginBottom: 3,
    marginLeft: 12,
    color: '#111827',
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#D1D5DB',
    marginVertical: 8,
  },
  spacer: {
    marginBottom: 6,
  },
});

// -------------------------------------------------------------------
// Markdown parser (same logic as exportDocx.ts)
// -------------------------------------------------------------------

interface ParsedLine {
  type: 'h1' | 'h2' | 'h3' | 'bullet' | 'para' | 'divider' | 'blank';
  text: string;
}

function parseLine(line: string): ParsedLine {
  const t = line.trim();
  if (!t) return { type: 'blank', text: '' };
  if (t.startsWith('# '))  return { type: 'h1',  text: t.slice(2).trim() };
  if (t.startsWith('## ')) return { type: 'h2',  text: t.slice(3).trim() };
  if (t.startsWith('### ')) return { type: 'h3', text: t.slice(4).trim() };
  if (t === '---' || t === '***') return { type: 'divider', text: '' };
  if (t.startsWith('- ') || t.startsWith('• ')) return { type: 'bullet', text: t.replace(/^[-•]\s/, '') };
  return { type: 'para', text: t };
}

/** Strip markdown bold/italic markers — @react-pdf/renderer Text doesn't parse inline markdown */
function stripInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
}

// -------------------------------------------------------------------
// PDF Document component
// -------------------------------------------------------------------

function buildPdfDocument(markdown: string, _docType: DocType): React.ReactElement {
  const lines = markdown.split('\n');
  const elements: React.ReactElement[] = [];

  lines.forEach((line, i) => {
    const parsed = parseLine(line);
    switch (parsed.type) {
      case 'h1':
        elements.push(
          <Text key={i} style={styles.h1}>{stripInline(parsed.text)}</Text>
        );
        break;
      case 'h2':
        elements.push(
          <Text key={i} style={styles.h2}>{stripInline(parsed.text).toUpperCase()}</Text>
        );
        break;
      case 'h3':
        elements.push(
          <Text key={i} style={styles.h3}>{stripInline(parsed.text)}</Text>
        );
        break;
      case 'bullet':
        elements.push(
          <Text key={i} style={styles.bullet}>{'• ' + stripInline(parsed.text)}</Text>
        );
        break;
      case 'divider':
        elements.push(<View key={i} style={styles.divider} />);
        break;
      case 'blank':
        // Collapse consecutive blanks
        if (i > 0 && parseLine(lines[i - 1]).type !== 'blank') {
          elements.push(<View key={i} style={styles.spacer} />);
        }
        break;
      case 'para':
      default:
        elements.push(
          <Text key={i} style={styles.para}>{stripInline(parsed.text)}</Text>
        );
    }
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {elements}
      </Page>
    </Document>
  );
}

// -------------------------------------------------------------------
// Public export function
// -------------------------------------------------------------------

const DOC_LABELS: Record<DocType, string> = {
  'resume': 'Resume',
  'cover-letter': 'Cover_Letter',
  'selection-criteria': 'Selection_Criteria',
  'interview-prep': 'Interview_Prep',
  'teaching-philosophy': 'Teaching_Philosophy',
  'research-statement': 'Research_Statement',
};

export async function exportPdf(
  content: string,
  docType: DocType,
  candidateName: string,
  jobTitle?: string,
): Promise<void> {
  const doc = buildPdfDocument(content, docType);
  const blob = await pdf(doc).toBlob();
  const dateStr = new Date().toISOString().slice(0, 10);
  const namePart = candidateName.replace(/\s+/g, '_') || 'document';
  const rolePart = jobTitle ? `_${jobTitle.replace(/\s+/g, '_').slice(0, 30)}` : '';
  const label = DOC_LABELS[docType];
  saveAs(blob, `${namePart}${rolePart}_${label}_${dateStr}.pdf`);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/AntiGravity/JobHub && npx tsc --noEmit
```

Expected: No errors on the new file. If `@react-pdf/renderer` types have issues, add `// @ts-ignore` above the `import` line.

- [ ] **Step 3: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/lib/exportPdf.ts
git commit -m "feat(export): client-side PDF export via @react-pdf/renderer"
```

---

## Task 2: Add PDF button to ApplicationWorkspace

**Files:**
- Modify: `src/components/ApplicationWorkspace.tsx`

The existing DOCX export button lives around line 695–702. Find it by searching for `Export .docx`.

- [ ] **Step 1: Add import for `exportPdf`**

In `ApplicationWorkspace.tsx`, find the existing import line:
```typescript
import { exportDocx, DocType } from '../lib/exportDocx';
```

Add a second import:
```typescript
import { exportPdf } from '../lib/exportPdf';
```

- [ ] **Step 2: Add `exportingPdf` state**

Near the `isEditing` state declaration, add:
```typescript
const [exportingPdf, setExportingPdf] = useState(false);
```

- [ ] **Step 3: Add `handleDownloadPdf` handler**

Directly after the existing `handleDownload` function, add:
```typescript
const handleDownloadPdf = async () => {
    const content = state.documents[state.activeTab];
    if (!content) return;
    setExportingPdf(true);
    try {
        const candidateName = profile?.name || '';
        const jobTitle = state.metadata?.role || state.metadata?.company || '';
        await exportPdf(content, state.activeTab as DocType, candidateName, jobTitle);
        toast.success('Downloaded as PDF');
    } catch (err) {
        console.error('[PDF Export] failed:', err);
        toast.error('PDF export failed — try .docx instead');
    } finally {
        setExportingPdf(false);
    }
};
```

- [ ] **Step 4: Add the button in JSX**

Find the existing Export .docx button block (around line 695):
```tsx
<button
    onClick={handleDownload}
    className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-600/20"
>
    <Download size={14} />
    Export .docx
</button>
```

Add a PDF button immediately after it (same parent flex container):
```tsx
<button
    onClick={handleDownloadPdf}
    disabled={exportingPdf}
    className="flex items-center gap-2 px-4 py-1.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-rose-700/20"
>
    {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
    Export .pdf
</button>
```

`Loader2` and `FileText` are already imported in this file.

- [ ] **Step 5: Verify TypeScript**

```bash
cd E:/AntiGravity/JobHub && npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/components/ApplicationWorkspace.tsx
git commit -m "feat(export): add PDF download button to ApplicationWorkspace"
```

---

## Task 3: Add PDF download to DocumentLibrary

**Files:**
- Modify: `src/components/DocumentLibrary.tsx`

DocumentLibrary shows generated documents in a list. Each card has copy/delete actions. Add a PDF download action.

- [ ] **Step 1: Find the download/action area in DocumentLibrary**

Search for the existing copy or delete button:
```bash
grep -n "copy\|delete\|Download\|DocType" E:/AntiGravity/JobHub/src/components/DocumentLibrary.tsx | head -20
```

- [ ] **Step 2: Add imports**

At the top of `DocumentLibrary.tsx`, add:
```typescript
import { exportPdf, DocType as PdfDocType } from '../lib/exportPdf';
```

- [ ] **Step 3: Add a `handlePdfDownload` function**

Inside the component (near other action handlers), add:
```typescript
const handlePdfDownload = async (doc: { content: string; type: string }) => {
    // Reuse the existing DOC_TYPE_MAP already defined in DocumentLibrary
    const pdfType = (DOC_TYPE_MAP[doc.type as keyof typeof DOC_TYPE_MAP] ?? 'resume') as PdfDocType;
    await exportPdf(doc.content, pdfType, '', '');
    toast.success('Downloaded as PDF');
};
```

- [ ] **Step 4: Add PDF download button to the doc card action area**

Find the copy/delete button area in DocCard (or wherever card actions are rendered). Add:
```tsx
<button
    onClick={() => handlePdfDownload(doc)}
    title="Download PDF"
    className="p-2 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
>
    <FileText size={14} />
</button>
```

Ensure `FileText` is imported from `lucide-react` in DocumentLibrary.

- [ ] **Step 5: Verify TypeScript**

```bash
cd E:/AntiGravity/JobHub && npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/components/DocumentLibrary.tsx
git commit -m "feat(export): add PDF download to DocumentLibrary card actions"
```

---

## Task 4: Smoke test

- [ ] **Step 1: Start dev server**

```bash
cd E:/AntiGravity/JobHub && npm run dev
```

- [ ] **Step 2: Navigate to /workspace, generate a document, click "Export .pdf"**

Expected:
- Button shows spinner while generating
- Browser downloads a `.pdf` file
- PDF opens and shows formatted content (not a blank page)
- File size > 10KB

- [ ] **Step 3: Navigate to /documents, find a document, click the PDF icon**

Expected: PDF downloads with correct content.

- [ ] **Step 4: Verify .docx download still works**

Click "Export .docx" — should still download a Word file as before.

---

## Definition of Done

- [ ] `src/lib/exportPdf.ts` exists, TypeScript compiles clean
- [ ] "Export .pdf" button visible in ApplicationWorkspace when a document is generated
- [ ] Button shows loading state during export
- [ ] Downloaded PDF is > 10KB and readable (not blank)
- [ ] PDF headings match document structure
- [ ] .docx export still works unmodified
- [ ] DocumentLibrary has PDF download action on each doc card
- [ ] `npx tsc --noEmit` passes in both frontend and backend

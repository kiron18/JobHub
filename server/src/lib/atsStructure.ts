import JSZip from 'jszip';

/**
 * Deterministic ATS-structure check for an uploaded resume.
 *
 * The CV scan otherwise only sees extracted TEXT, and our own extractor
 * (LlamaParse) is smarter than a typical employer ATS: it reorders columns and
 * recovers layout, which HIDES the very problems we must warn about. So for PDFs
 * we deliberately re-read the file with the basic pdf-parse engine, the "dumb
 * ATS" view, and analyse that. For DOCX we inspect the raw XML. The result is a
 * plain-language list of parsing problems the scan feeds to the LLM so it can
 * raise the issue in its own voice, only when the problem is real.
 */
export interface AtsStructure {
  risk: boolean;
  reasons: string[]; // plain-language, ready for the LLM to phrase in tone
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

/**
 * Pure, testable: derive ATS-parsing problems from how a BASIC extractor sees a
 * file's text. Conservative on purpose, a false "your resume fails the ATS" is a
 * lie to the user, so each rule needs strong evidence before it fires.
 */
export function analyzeRawTextLayout(rawText: string): string[] {
  const reasons: string[] = [];
  const text = rawText || '';

  // 1. Image-based / scanned: a basic extractor pulls almost no words from it.
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 0 && wordCount < 80) {
    reasons.push('the file is image-based or built as graphics, so a standard applicant tracking system extracts almost no readable text from it');
  }

  // 2. Reading order: contact details belong at the very top. When the email
  // parses well below the start, the file does not read top to bottom.
  const emailIdx = text.search(EMAIL_RE);
  if (emailIdx > 700) {
    reasons.push('the contact details do not parse at the top, so the file does not read top to bottom the way an applicant tracking system scans it');
  }

  // 3. Multi-column tell: a column gutter shows up as a wide run of spaces in the
  // middle of many lines. Thresholds are deliberately high so a single right-
  // aligned date (which a clean single-column resume legitimately uses) never
  // trips it: it needs a wide gutter on a large fraction of substantial lines.
  const lines = text.split('\n');
  const substantial = lines.filter(l => l.trim().length >= 20);
  const gutter = substantial.filter(l => /\S {5,}\S/.test(l)).length;
  if (substantial.length >= 12 && gutter >= 6 && gutter / substantial.length > 0.35) {
    reasons.push('it uses a multi-column layout, which applicant tracking systems often read in the wrong order or merge into nonsense');
  }

  return reasons;
}

/**
 * Count embedded image XObjects from raw PDF bytes. Object dictionaries are
 * usually uncompressed even when their streams are, so the `/Subtype /Image`
 * marker is visible. One logo is fine; several images means a graphics-led design
 * an ATS will not read.
 */
export function countPdfImages(buffer: Buffer): number {
  const bytes = buffer.toString('latin1');
  return (bytes.match(/\/Subtype\s*\/Image/g) || []).length;
}

export async function detectAtsStructure(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
  extractedText: string,
): Promise<AtsStructure> {
  const reasons: string[] = [];
  const ext = (originalname || '').toLowerCase();

  // Format-agnostic reading-order check on the text we already have (covers DOCX
  // and any case where a raw re-parse is unavailable).
  const emailIdx = extractedText.search(EMAIL_RE);
  if (emailIdx > 700) {
    reasons.push('the contact details parse out below the first section, so the file does not read top to bottom the way an ATS scans it');
  }

  // DOCX structural inspection (a .docx is a zip of XML).
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext.endsWith('.docx')) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
      const textBoxes = (xml.match(/<w:txbxContent/g) || []).length;
      const tables = (xml.match(/<w:tbl[ >]/g) || []).length;
      const images = Object.keys(zip.files).filter(n => n.startsWith('word/media/')).length;

      if (textBoxes >= 3) reasons.push('it is built largely inside text boxes, which many applicant tracking systems cannot read at all');
      if (tables >= 1) reasons.push('it uses tables to lay out content, which can scramble the order an ATS reads it in');
      if (images >= 3) reasons.push('it leans on graphics and icons, which applicant tracking systems ignore entirely');
    } catch {
      // Non-fatal: if we cannot inspect the file, we raise no structural flag.
    }
  }

  // PDF structural inspection: re-extract with the basic pdf-parse engine (the
  // "dumb ATS" view) and analyse THAT, not our cleaned text.
  if (mimetype === 'application/pdf' || ext.endsWith('.pdf')) {
    try {
      const pdfModule = await import('pdf-parse/lib/pdf-parse.js' as any);
      const pdfParse = (pdfModule as any).default || pdfModule;
      const data = await pdfParse(buffer);
      reasons.push(...analyzeRawTextLayout(data?.text || ''));
    } catch {
      // Non-fatal: we already have valid text from the main extractor, so a
      // pdf-parse hiccup here is not itself proof of an ATS problem. Stay silent
      // rather than risk a false "fails the ATS" verdict.
    }
    try {
      if (countPdfImages(buffer) >= 4) {
        reasons.push('it leans on images or icons, which applicant tracking systems ignore entirely');
      }
    } catch {
      // Non-fatal.
    }
  }

  // De-duplicate exact repeats (overlapping checks can phrase the same problem).
  const unique = [...new Set(reasons)];
  return { risk: unique.length > 0, reasons: unique };
}

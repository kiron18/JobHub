import JSZip from 'jszip';

/**
 * Deterministic ATS-structure check for an uploaded resume.
 *
 * The CV scan otherwise only sees extracted TEXT, so it cannot see the layout
 * features that break applicant tracking systems (text boxes, tables, images,
 * non top-to-bottom reading order). This inspects the raw file and returns a
 * plain-language list of parsing problems, which the scan feeds to the LLM so it
 * can raise the issue in its own voice — only when the problem is real.
 */
export interface AtsStructure {
  risk: boolean;
  reasons: string[]; // plain-language, ready for the LLM to phrase in tone
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

export async function detectAtsStructure(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
  extractedText: string,
): Promise<AtsStructure> {
  const reasons: string[] = [];
  const ext = (originalname || '').toLowerCase();

  // Format-agnostic: if the contact details land well below the top of the
  // parsed text, the file does not read top-to-bottom — a classic text-box or
  // multi-column tell that ATS parsers stumble on.
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
      // Non-fatal: if we cannot inspect the file, we simply raise no structural flag.
    }
  }

  return { risk: reasons.length > 0, reasons };
}

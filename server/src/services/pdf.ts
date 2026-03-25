import mammoth from 'mammoth';

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
        // Dynamic import prevents server crash on environments missing browser globals (Node 18)
        const pdfModule = await import('pdf-parse');
        const pdfParse = (pdfModule as any).default || pdfModule;
        const data = await pdfParse(buffer);
        return data.text;
    } catch (error) {
        console.error('PDF Extraction Error:', error);
        throw new Error('Failed to parse PDF file.');
    }
}

/**
 * Extracts plain text from a PDF or DOCX buffer.
 * Uses dynamic import for pdf-parse to avoid Railway DOMMatrix crash.
 * Returns empty string on failure — a missing document is not fatal.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimetype: string,
  originalname: string
): Promise<string> {
  try {
    const ext = originalname.toLowerCase();
    if (mimetype === 'application/pdf' || ext.endsWith('.pdf')) {
      // Reuse existing extractTextFromPDF which already uses dynamic import
      return (await extractTextFromPDF(buffer)).trim();
    }
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    }
    // Fallback: try PDF
    return (await extractTextFromPDF(buffer)).trim();
  } catch (e) {
    console.error('[extractText] Failed to extract text:', e);
    return '';
  }
}

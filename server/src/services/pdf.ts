import mammoth from 'mammoth';
import { parseWithLlamaParse } from './llamaparse';
import { restorePdfLinks } from './pdfLinks';

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const pdfModule = await import('pdf-parse/lib/pdf-parse.js' as any);
    const pdfParse = (pdfModule as any).default || pdfModule;
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF Extraction Error:', error);
    throw new Error('Failed to parse PDF file.');
  }
}

/**
 * Extracts text from a PDF or DOCX buffer.
 *
 * For PDFs: tries LlamaParse first (structured Markdown, handles multi-column
 * layouts and section headers). Falls back to pdf-parse if LLAMA_CLOUD_API_KEY
 * is not set or the LlamaParse call fails.
 *
 * For DOCX: uses mammoth (unchanged).
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): Promise<string> {
  const ext = originalname.toLowerCase();

  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext.endsWith('.docx')) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    } catch (e) {
      console.error('[extractText] DOCX extraction failed:', e);
      return '';
    }
  }

  // PDF path — try LlamaParse, fall back to pdf-parse.
  //
  // Both return the words of a hyperlink and drop the address behind it, so the
  // recovered URLs are put back before the text goes anywhere. Doing it here
  // rather than at one call site means every consumer of a PDF gets a contact
  // block with real links in it.
  if (process.env.LLAMA_CLOUD_API_KEY) {
    try {
      const markdown = await parseWithLlamaParse(buffer, originalname);
      console.log('[extractText] LlamaParse succeeded for:', originalname);
      return restorePdfLinks(markdown.trim(), buffer);
    } catch (e) {
      console.warn('[extractText] LlamaParse failed, falling back to pdf-parse:', (e as Error).message);
    }
  }

  try {
    return restorePdfLinks((await extractTextFromPDF(buffer)).trim(), buffer);
  } catch (e) {
    console.error('[extractText] pdf-parse also failed:', e);
    return '';
  }
}

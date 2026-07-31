/**
 * Structure-preserving view of a DOCX, for the intake analysis prompt.
 *
 * PDFs get sent to the model natively, so it sees the rendered pages. Word files
 * have no such path, and `extractRawText` — what the rest of the app uses —
 * flattens everything: a three-column table of work history comes out as a run
 * of bare lines, indistinguishable from paragraphs. The model then cannot say
 * "your entire work history is inside a table", which is one of the single most
 * damaging things on an Australian resume because the automated screens that
 * parse it routinely mangle or drop table cells.
 *
 * mammoth.convertToHtml keeps tables, headings, lists and emphasis, so the model
 * can see and judge the document's actual structure.
 *
 * This deliberately does NOT replace extractTextFromBuffer. That function feeds
 * resumeRawText, generation, and autoExtract, all of which want clean prose;
 * changing it would alter what every future application is grounded on. This is
 * an additional view used only for the analysis read.
 */
import mammoth from 'mammoth';

/** Rough guard so a pathological document cannot blow up the prompt. */
const MAX_HTML_CHARS = 60_000;

export interface DocxStructure {
  html: string;
  tableCount: number;
  /** Cells in the largest table — a layout table is wide, a data table is not. */
  largestTableCells: number;
  imageCount: number;
}

/**
 * Images are stripped to a marker rather than inlined. mammoth would otherwise
 * emit the whole picture as a base64 data URI, which would swamp the prompt with
 * tokens that carry nothing the model can read. The marker still tells it where
 * in the document an image sits, and detectDocumentSignals reports what it is.
 */
const IMAGE_PLACEHOLDER = mammoth.images.imgElement(() =>
  Promise.resolve({ src: '', alt: 'EMBEDDED IMAGE' }),
);

function countTables(html: string): { tableCount: number; largestTableCells: number } {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  let largest = 0;
  for (const t of tables) {
    const cells = (t.match(/<t[dh][\s>]/gi) ?? []).length;
    if (cells > largest) largest = cells;
  }
  return { tableCount: tables.length, largestTableCells: largest };
}

export async function extractDocxStructure(buffer: Buffer): Promise<DocxStructure | null> {
  try {
    const result = await mammoth.convertToHtml(
      { buffer },
      { convertImage: IMAGE_PLACEHOLDER },
    );

    let html = (result.value || '').trim();
    if (!html) return null;

    // Empty src attributes left by the image placeholder are noise.
    html = html.replace(/<img[^>]*>/gi, '[EMBEDDED IMAGE]');
    if (html.length > MAX_HTML_CHARS) html = `${html.slice(0, MAX_HTML_CHARS)}\n<!-- truncated -->`;

    const { tableCount, largestTableCells } = countTables(html);
    const imageCount = (html.match(/\[EMBEDDED IMAGE\]/g) ?? []).length;

    return { html, tableCount, largestTableCells, imageCount };
  } catch (err) {
    // Never break an upload over this — the text read still works.
    console.warn('[docxStructure] conversion failed (non-fatal):', (err as Error).message);
    return null;
  }
}

/** Prompt block describing what the structured view does and does not show. */
export function describeDocxStructure(s: DocxStructure): string {
  const tableNote = s.tableCount > 0
    ? `\n\nThis document contains ${s.tableCount} table${s.tableCount === 1 ? '' : 's'}`
      + `${s.largestTableCells > 0 ? ` (the largest has ${s.largestTableCells} cells)` : ''}`
      + `. Tables are a serious problem on an Australian resume: the automated systems that parse applications frequently mangle or silently drop table cells, so content laid out in a table can vanish before a human ever sees it. Judge how much of this resume depends on table layout, and say so plainly if it matters.`
    : '';

  return `THE RESUME'S STRUCTURE — this is the Word document converted to HTML, so the tables, headings, lists and emphasis below are exactly as they appear in the candidate's file. Judge the structure as well as the words.

You CAN see from this: tables and what is inside them, heading levels, list structure, bold and italic, paragraph breaks, and where embedded images sit (marked [EMBEDDED IMAGE]).

You CANNOT see: fonts, colours, margins, column widths, page count, or page breaks. Do not comment on those or guess at them.${tableNote}

STRUCTURED DOCUMENT:
"""
${s.html}
"""`;
}

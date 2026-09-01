/**
 * Renders the rebuilt resume as a PDF the candidate can actually send.
 *
 * The welcome email already shows the resume as HTML, which is fine for reading
 * and useless for applying: nobody attaches an email to a job application. They
 * need a file. Without one the first thing they do with the thing we just built
 * is copy it out of an email and re-format it by hand, which undoes the
 * formatting work and is where a clean single-column layout goes to die.
 *
 * pdfkit rather than a headless browser. Puppeteer would render the existing
 * HTML more faithfully but pulls a Chromium download into the deploy, and this
 * runs on Railway where that is a real cost for one attachment. The resume
 * markdown we generate is a known, narrow shape - a name, a title line, a
 * contact line, ## headings, ### role headings, bold runs and hyphen bullets -
 * so drawing it directly is a few dozen lines and no binary.
 *
 * Single column, no tables, no graphics, one common font. Same reason the
 * rewrite is told to produce that: it has to survive the automated screen.
 */
import PDFDocument from 'pdfkit';

const INK = '#1A1814';
const MUTED = '#5C5750';
const RULE = '#D6D2C8';
const FOOTER = '#9B9488';

/** A4 in points, with margins wide enough to read and tight enough to fit. */
const PAGE = { size: 'A4' as const, margins: { top: 54, bottom: 54, left: 54, right: 54 } };

export interface RenderedResume {
  buffer: Buffer;
  /** Real page count, off the rendered document. Not an estimate from length. */
  pages: number;
}

export interface RenderOptions {
  /**
   * A footer line naming Aussie Grad Careers on every page.
   *
   * OFF by default, deliberately. The body of the resume is the one surface an
   * employer reads closely, and it is the candidate's document, not ours. A mark
   * there reads as an advertisement on somebody's job application, or worse as a
   * sign they did not write it, and either way it spends their credibility
   * rather than adding to it.
   *
   * Kept as a switch rather than deleted so the decision stays reversible, and
   * because a coach-facing or sample copy is a legitimate reason to want it.
   */
  brand?: boolean;

  /**
   * "Page 1 of 2" in the bottom margin, ON by default.
   *
   * A resume that runs to a second page gets printed, stapled, dropped on a
   * desk and picked up in the wrong order, and a page with no number is the one
   * that goes missing without anyone noticing. Unlike the brand line this is
   * part of the document rather than a mark on it, which is why the defaults
   * differ.
   *
   * A one-page resume is never numbered: "Page 1 of 1" tells the reader nothing
   * they cannot see, and it is the sort of detail that makes a document look
   * automated.
   */
  pageNumbers?: boolean;
}

/**
 * Appended to the filename, which is where the mark now lives.
 *
 * Short on purpose. The filename travels with the attachment, so an employer may
 * see it too, and a full company name in a job application's filename is the
 * loud version of the thing we just took off the page. Set to '' to remove it
 * entirely and leave branding to the email and the file properties.
 */
const FILENAME_SUFFIX = '_AGC';

/** Strip markdown emphasis for measuring and for the plain runs. */
function stripMarks(s: string): string {
  return s.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
}

/**
 * Write one line, honouring **bold** runs inside it.
 *
 * pdfkit has no inline markup, so the line is split on the bold delimiters and
 * each run is written with `continued`, which keeps them on the same line and
 * lets pdfkit do the wrapping.
 */
function writeRich(doc: PDFKit.PDFDocument, text: string, size: number, colour: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  if (parts.length === 0) return;

  doc.fontSize(size).fillColor(colour);
  parts.forEach((part, i) => {
    const bold = part.startsWith('**') && part.endsWith('**');
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .text(bold ? part.slice(2, -2) : part, { continued: i < parts.length - 1 });
  });
}

/**
 * Start a new page if `needed` points of vertical space are not left on this one.
 *
 * pdfkit breaks pages on its own, but only between the pieces it is asked to
 * draw. A bullet is drawn as two pieces, the dot and then the text beside it, so
 * a bullet that starts far enough down the page put the dot on one page and its
 * sentence on the next. That is how a resume came out with a page carrying a
 * single "•" and nothing else.
 *
 * Deciding before drawing rather than repairing afterwards is what fixes it: ask
 * whether the whole bullet fits, and if it does not, turn the page first.
 */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

/**
 * Markdown in, PDF bytes out.
 *
 * Anything it does not recognise is written as body text rather than dropped. A
 * resume that renders a line plainly is a small flaw; a resume silently missing
 * one of the candidate's bullets is the failure the whole retention gate exists
 * to prevent, and it must not be reintroduced here at the last step.
 */
export function renderResumePdf(markdown: string, opts: RenderOptions = {}): Promise<RenderedResume> {
  const { brand = false, pageNumbers = true } = opts;
  const wantsFooter = brand || pageNumbers;

  return new Promise((resolve, reject) => {
    // bufferPages only where it earns its place: it holds every page open so the
    // footer can be written across all of them, and nothing else here needs it.
    //
    // The page count is taken from pageAdded rather than from the buffer, so it
    // is correct in both modes. The constructor's own first page fires before
    // this listener exists, so the count starts at one and this counts the rest.
    const doc = new PDFDocument({ ...PAGE, bufferPages: wantsFooter });
    const chunks: Buffer[] = [];
    let pages = 1;
    doc.on('pageAdded', () => { pages++; });
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), pages }));
    doc.on('error', reject);

    // Shows in the file's properties, and in the tab title when an employer
    // opens it in a browser. Branding that never competes with the content.
    const candidate = markdown.match(/^#\s+(.+)$/m)?.[1].replace(/\*\*/g, '').trim() ?? '';
    doc.info.Title = candidate ? `${candidate} - Resume` : 'Resume';
    if (candidate) doc.info.Author = candidate;
    doc.info.Creator = 'Aussie Grad Careers';
    doc.info.Producer = 'Aussie Grad Careers';

    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    let firstHeading = true;

    for (const raw of lines) {
      const line = raw.trimEnd();

      if (!line.trim()) { doc.moveDown(0.45); continue; }

      // # Name — the one big thing on the page.
      if (/^#\s+/.test(line)) {
        doc.font('Helvetica-Bold').fontSize(22).fillColor(INK)
          .text(stripMarks(line), { align: 'left' });
        doc.moveDown(0.25);
        continue;
      }

      // ## Section heading, with a rule under it.
      if (/^##\s+/.test(line) && !/^###/.test(line)) {
        if (!firstHeading) doc.moveDown(0.7);
        firstHeading = false;
        doc.font('Helvetica-Bold').fontSize(11).fillColor(INK)
          .text(stripMarks(line).toUpperCase(), { characterSpacing: 0.8 });
        doc.moveDown(0.25);
        const y = doc.y;
        doc.moveTo(doc.page.margins.left, y)
          .lineTo(doc.page.width - doc.page.margins.right, y)
          .strokeColor(RULE).lineWidth(0.8).stroke();
        doc.moveDown(0.5);
        continue;
      }

      // ### Role | Employer
      if (/^###\s+/.test(line)) {
        doc.moveDown(0.35);
        // A role heading alone at the foot of a page is a widow: the employer on
        // one page and everything they did on the next. 46pt is the heading plus
        // its date line plus a first bullet.
        ensureSpace(doc, 46);
        doc.font('Helvetica-Bold').fontSize(11.5).fillColor(INK).text(stripMarks(line));
        doc.moveDown(0.15);
        continue;
      }

      // - bullet
      if (/^[-*]\s+/.test(line)) {
        const body = line.replace(/^[-*]\s+/, '');
        const left = doc.page.margins.left;
        doc.font('Helvetica').fontSize(10).fillColor(INK);

        // Measured on the stripped text at the same width the bullet will wrap
        // to. Bold runs shift this by a hair, never by a line, and erring early
        // costs nothing but a slightly shorter page.
        const textWidth = doc.page.width - left - doc.page.margins.right - 14;
        ensureSpace(doc, doc.heightOfString(stripMarks(body), { width: textWidth }));

        const startY = doc.y;
        doc.text('•', left, startY, { width: 12, continued: false });
        doc.y = startY;
        doc.x = left + 14;
        writeRich(doc, body, 10, INK);
        doc.x = left;
        doc.moveDown(0.18);
        continue;
      }

      // A date span or other italic line renders as quiet body text.
      const italic = /^\*[^*].*\*$/.test(line);
      writeRich(doc, line, italic ? 9.5 : 10, italic ? MUTED : INK);
      doc.moveDown(0.18);
    }

    /*
     * The footer, written after the body so it lands on every page including the
     * ones the content created.
     *
     * Deliberately quiet: 7.5pt, in the muted grey, sitting inside the bottom
     * margin where nothing else goes. An employer reading this should register a
     * document that was professionally prepared, not an advertisement stapled to
     * somebody's application. That is the whole difference between branding that
     * adds to the candidate's credibility and branding that spends it.
     */
    if (wantsFooter) {
      const range = doc.bufferedPageRange();
      // One page needs no number; see the pageNumbers option.
      const numbering = pageNumbers && range.count > 1;

      if (brand || numbering) {
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          // The footer sits BELOW the bottom margin, and pdfkit treats anything
          // past that margin as overflow and starts a new page for it — which
          // silently doubled a two-page resume to four. Dropping the margin for
          // the width of this one line, and restoring it, keeps the text where it
          // belongs and the page count honest.
          const bottom = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          const y = doc.page.height - bottom + 20;
          const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
          doc.font('Helvetica').fontSize(7.5).fillColor(FOOTER);

          if (brand) {
            doc.text(
              'Prepared with Aussie Grad Careers  ·  aussiegradcareers.com.au',
              doc.page.margins.left, y,
              { width, align: 'center', lineBreak: false },
            );
          }
          if (numbering) {
            // Centred when it is the only thing down here, pushed to the right
            // when the brand line already owns the middle.
            doc.text(
              `Page ${i - range.start + 1} of ${range.count}`,
              doc.page.margins.left, y,
              { width, align: brand ? 'right' : 'center', lineBreak: false },
            );
          }
          doc.page.margins.bottom = bottom;
        }
      }
    }

    // No flushPages() here: end() flushes the buffered pages itself.
    doc.end();
  });
}

/**
 * A filename a person is willing to attach to an application.
 *
 * Their name first, because that is what a recruiter with forty attachments in a
 * folder is scanning for. Punctuation stripped: apostrophes and slashes are what
 * break a download or get mangled by an applicant tracking system.
 */
export function resumeFilename(fullName?: string | null): string {
  const clean = (fullName || '').trim().replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, '_');
  return clean ? `${clean}_Resume${FILENAME_SUFFIX}.pdf` : `Resume${FILENAME_SUFFIX}.pdf`;
}

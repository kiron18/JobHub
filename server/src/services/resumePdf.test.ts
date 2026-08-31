import { describe, it, expect, beforeAll } from 'vitest';
import { renderResumePdf, resumeFilename } from './resumePdf';

/**
 * pdf-parse ships a webpacked pdf.js bundle that carries state between calls,
 * and intermittently throws "bad XRef entry" on a document it will parse
 * perfectly a moment later. Confirmed by parsing one rejected buffer three times
 * in a fresh process: it succeeded every time. The documents are fine, the
 * reader is not reentrant.
 *
 * So every parse in this file retries. Without it these tests fail on the
 * parser's mood rather than on anything they are meant to be checking.
 */
let rawParse: (b: Buffer) => Promise<{ text: string; numpages: number }>;

beforeAll(async () => {
  const mod = await import('pdf-parse/lib/pdf-parse.js' as any);
  rawParse = (mod as any).default ?? mod;
});

async function parse(buf: Buffer): Promise<{ text: string; numpages: number }> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try { return await rawParse(buf); } catch (err) { last = err; }
  }
  throw last;
}

async function pdfText(buf: Buffer): Promise<string> {
  return (await parse(buf)).text.replace(/\s+/g, ' ');
}

const RESUME = `# **Swastik Kaushik**
Operations Manager | Business Analytics

Sydney, NSW | +61 426 543 014 | swastik@example.com | http://www.linkedin.com/in/swastik

## Professional Summary

Business Analytics professional with over 3 years of experience.

## Work Experience

### Operations Manager | Domino's Pizza, Australia
*March 2023 - Present*

- Achieved a **5-star OER inspection rating** for three consecutive quarters
- Analysed store performance data using Power BI and Excel
- Reduced costs through usage tracking and daily system audits

## Education

### Master of Business Analytics, Macquarie University
`;

describe('renderResumePdf', () => {
  it('produces a real PDF, and reports how many pages it is', async () => {
    const { buffer, pages } = await renderResumePdf(RESUME);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
    // A real count off the rendered document, never a guess from length.
    expect(pages).toBe(1);
  });

  it('counts the pages a longer resume actually runs to', async () => {
    const filler = '- A further bullet of real content that takes up room\n'.repeat(70);
    const long = `${RESUME}\n\n## More\n\n${filler}`;
    const { pages } = await renderResumePdf(long);
    expect(pages).toBeGreaterThan(1);
  });

  it('reports the page count the file actually has, footer and all', async () => {
    // The footer is drawn below the bottom margin, and pdfkit treats anything
    // past that margin as overflow: it quietly turned a 2-page resume into 4
    // while still reporting 2. The count on the review screen and the document
    // the candidate sends have to agree.
    const filler = '- A further bullet of real content that takes up room\n'.repeat(70);
    for (const md of [RESUME, `${RESUME}\n\n## More\n\n${filler}`]) {
      const { buffer, pages } = await renderResumePdf(md);
      expect(pages).toBe((await parse(buffer)).numpages);
    }
  });

  it('puts no branding on the document itself by default', async () => {
    // The resume body is the candidate's, and it is what an employer reads. A
    // mark there reads as an advertisement on their job application. Branding
    // lives in the filename and the file properties instead.
    expect(await pdfText((await renderResumePdf(RESUME)).buffer))
      .not.toContain('Aussie Grad Careers');
  });

  it('can still be asked for the footer, for a coach or sample copy', async () => {
    expect(await pdfText((await renderResumePdf(RESUME, { brand: true })).buffer))
      .toContain('Prepared with Aussie Grad Careers');
  });

  it('loses nothing: every bullet survives into the document', async () => {
    const text = await pdfText((await renderResumePdf(RESUME)).buffer);
    // The whole retention gate exists to stop content vanishing in the rewrite.
    // Dropping it at the last step, on the way into the file they actually send,
    // would be the same failure with a different cause.
    expect(text).toContain('Achieved a 5-star OER inspection rating');
    expect(text).toContain('Analysed store performance data using Power BI');
    expect(text).toContain('Reduced costs through usage tracking');
  });

  it('keeps the contact details, including the recovered LinkedIn URL', async () => {
    const text = await pdfText((await renderResumePdf(RESUME)).buffer);
    expect(text).toContain('+61 426 543 014');
    expect(text).toContain('swastik@example.com');
    expect(text.replace(/\s/g, '')).toContain('linkedin.com/in/swastik');
  });

  it('keeps employers and qualifications', async () => {
    const text = await pdfText((await renderResumePdf(RESUME)).buffer);
    expect(text).toContain("Domino's Pizza");
    expect(text).toContain('Macquarie University');
  });

  it('renders bold runs as text rather than leaving asterisks in', async () => {
    const text = await pdfText((await renderResumePdf(RESUME)).buffer);
    expect(text).not.toContain('**');
  });

  it('survives an empty or markdown-free document without throwing', async () => {
    expect((await renderResumePdf('')).buffer).toBeInstanceOf(Buffer);
    const plain = await pdfText((await renderResumePdf('Just one line of text.')).buffer);
    expect(plain).toContain('Just one line of text.');
  });
});

describe('resumeFilename', () => {
  it('is something a person would attach to an application', () => {
    expect(resumeFilename('Swastik Kaushik')).toBe('Swastik_Kaushik_Resume_AGC.pdf');
  });

  it('strips punctuation that breaks downloads', () => {
    expect(resumeFilename("Mary-Jane O'Brien")).toBe('MaryJane_OBrien_Resume_AGC.pdf');
  });

  it('falls back rather than producing a nameless file', () => {
    expect(resumeFilename('')).toBe('Resume_AGC.pdf');
    expect(resumeFilename(null)).toBe('Resume_AGC.pdf');
  });
});

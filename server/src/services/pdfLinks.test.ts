import { describe, it, expect } from 'vitest';
import zlib from 'zlib';
import { extractPdfLinks, restoreLinkUrls } from './pdfLinks';

/** A minimal PDF carrying one link annotation, as an uncompressed object. */
function pdfWithPlainLink(url: string): Buffer {
  return Buffer.from(
    `%PDF-1.4\n`
    + `4 0 obj\n<< /Type /Annot /Subtype /Link /Rect [72 700 200 715] `
    + `/A << /S /URI /URI (${url}) >> >>\nendobj\n`
    + `trailer\n<< /Root 1 0 R >>\n%%EOF\n`,
    'latin1',
  );
}

/** The same annotation, packed into a FlateDecode stream the way newer writers do. */
function pdfWithCompressedLink(url: string): Buffer {
  const inner = `<< /Type /Annot /Subtype /Link /A << /S /URI /URI (${url}) >> >>`;
  const deflated = zlib.deflateSync(Buffer.from(inner, 'latin1'));
  return Buffer.concat([
    Buffer.from('%PDF-1.7\n5 0 obj\n<< /Filter /FlateDecode >>\nstream\n', 'latin1'),
    deflated,
    Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
  ]);
}

/** Swastik Kaushik's contact line, as LlamaParse actually returned it on 29 Aug 2026. */
const REAL_CONTACT_LINE =
  'Sydney, NSW | +61 426 543 014 | swastik.kaushik99@gmail.com | <font color="blue">LinkedIn Profile</font>';

const resume = (contact: string) =>
  `# **SWASTIK KAUSHIK**\n\n${contact}\n\n## **PROFESSIONAL SUMMARY**\n\nAnalytical and detail-oriented.\n`;

describe('extractPdfLinks', () => {
  it('reads a URI out of a plain annotation', () => {
    const url = 'https://www.linkedin.com/in/swastik-kaushik';
    expect(extractPdfLinks(pdfWithPlainLink(url))).toEqual([url]);
  });

  it('reads a URI out of a compressed object stream', () => {
    const url = 'https://www.linkedin.com/in/swastik-kaushik';
    expect(extractPdfLinks(pdfWithCompressedLink(url))).toContain(url);
  });

  it('unescapes parentheses inside the PDF string', () => {
    expect(extractPdfLinks(pdfWithPlainLink('https://example.com/a\\(b\\)c')))
      .toEqual(['https://example.com/a(b)c']);
  });

  it('ignores schemes that have no business on a resume', () => {
    expect(extractPdfLinks(pdfWithPlainLink('javascript:alert(1)'))).toEqual([]);
    expect(extractPdfLinks(pdfWithPlainLink('file:///etc/passwd'))).toEqual([]);
  });

  it('returns nothing rather than throwing on a file with no links', () => {
    expect(extractPdfLinks(Buffer.from('not a pdf at all'))).toEqual([]);
  });
});

describe('restoreLinkUrls', () => {
  const li = 'https://www.linkedin.com/in/swastik-kaushik';

  it('puts the URL back into the exact line that deadlocked the rebuild', () => {
    const out = restoreLinkUrls(resume(REAL_CONTACT_LINE), [li]);
    expect(out).toContain(li);
    // The <font> wrapper goes with the label, so no empty tag pair is left.
    expect(out).not.toContain('LinkedIn Profile');
    expect(out).not.toContain('<font');
    // Nothing else on the contact line may be disturbed.
    expect(out).toContain('+61 426 543 014');
    expect(out).toContain('swastik.kaushik99@gmail.com');
  });

  it('handles the label without any markup around it', () => {
    const out = restoreLinkUrls(resume('Sydney, NSW | LinkedIn Profile'), [li]);
    expect(out).toContain(li);
  });

  it('leaves the text alone when the URL is already written out', () => {
    const text = resume('Sydney | linkedin.com/in/swastik-kaushik');
    expect(restoreLinkUrls(text, [li])).toBe(text);
  });

  it('never rewrites a LinkedIn Learning course into a profile URL', () => {
    const text = resume('Sydney, NSW | swastik.kaushik99@gmail.com')
      + '\n- Accelerated MATLAB — LinkedIn Learning\n';
    expect(restoreLinkUrls(text, [li])).toBe(text);
  });

  it('leaves a label alone when it sits far below the contact block', () => {
    const text = `${resume('Sydney, NSW | +61 426 543 014')}${'filler. '.repeat(400)}\nLinkedIn Profile\n`;
    expect(restoreLinkUrls(text, [li])).toBe(text);
  });

  it('restores GitHub as well, and both together', () => {
    const gh = 'https://github.com/swastik';
    const out = restoreLinkUrls(resume('LinkedIn Profile | GitHub'), [li, gh]);
    expect(out).toContain(li);
    expect(out).toContain(gh);
  });

  it('ignores hosts it has no label for', () => {
    const text = resume('Sydney, NSW | Portfolio');
    expect(restoreLinkUrls(text, ['https://some-personal-site.example'])).toBe(text);
  });

  it('is a no-op with no URLs', () => {
    const text = resume(REAL_CONTACT_LINE);
    expect(restoreLinkUrls(text, [])).toBe(text);
  });
});

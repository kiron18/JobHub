import { describe, it, expect } from 'vitest';
import { parseResume } from '../resumeStructure';

/**
 * The page count must come from the real renderer, not a line-count estimate.
 * Wrapping, headings and bold runs all change how much fits on a page, so an
 * estimate puts the marker in the wrong place — and a wrong marker is worse
 * than none, because someone will cut content to fix a break that is not there.
 *
 * The renderer itself needs a browser/font environment, so what is asserted
 * here is the contract around it: the counting regex distinguishes a page
 * object from the /Pages node that lists them.
 */
describe('page counting', () => {
  const countPages = (pdfText: string) => (pdfText.match(/\/Type\s*\/Page[^s]/g) ?? []).length;

  it('counts page objects, not the /Pages catalogue node', () => {
    const twoPages = '/Type /Pages /Count 2 ... /Type /Page /Contents ... /Type /Page /Contents';
    expect(countPages(twoPages)).toBe(2);
  });

  it('is not fooled by a single-page document', () => {
    expect(countPages('/Type /Pages /Count 1 ... /Type /Page /Contents')).toBe(1);
  });

  it('tolerates the spacing variants react-pdf emits', () => {
    expect(countPages('/Type/Page ... /Type  /Page ')).toBe(2);
  });

  it('parses the content it will measure', () => {
    // Guards the pairing: whatever we count pages for must parse first.
    const sections = parseResume('# Jane\n\n## Work Experience\n\n### Role | Co\n- did a thing');
    expect(sections.length).toBeGreaterThan(0);
  });
});

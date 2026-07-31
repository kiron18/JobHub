import { describe, it, expect } from 'vitest';
import { detectDocumentSignals, describeSignals, DocumentSignals } from './documentSignals';

/**
 * Builds a minimal byte sequence shaped like a PDF image XObject dictionary.
 * The detector reads raw bytes, so this is enough to exercise it.
 */
function pdfWithImage(width: number, height: number, filter = 'DCTDecode'): Buffer {
  return Buffer.from(
    `%PDF-1.4\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
      `/ColorSpace /DeviceRGB /Filter /${filter} >>\nstream\n...\nendstream\n%%EOF`,
    'latin1',
  );
}

describe('detectDocumentSignals — PDF', () => {
  it('flags a square headshot as a likely photo', () => {
    // The real case: MAHRUKHA LAMIA.pdf carries a 323x323 DCTDecode image.
    const s = detectDocumentSignals(pdfWithImage(323, 323), 'application/pdf', 'cv.pdf');
    expect(s.images).toHaveLength(1);
    expect(s.images[0]).toMatchObject({ width: 323, height: 323, filter: 'DCTDecode' });
    expect(s.likelyPhoto).toBe(true);
  });

  it('flags a portrait-oriented photo', () => {
    expect(detectDocumentSignals(pdfWithImage(200, 300), 'application/pdf', 'cv.pdf').likelyPhoto).toBe(true);
  });

  it('does not mistake a small logo or icon for a photo', () => {
    const s = detectDocumentSignals(pdfWithImage(48, 48), 'application/pdf', 'cv.pdf');
    expect(s.images).toHaveLength(1);
    expect(s.likelyPhoto).toBe(false);
  });

  it('does not mistake a wide banner or divider rule for a photo', () => {
    expect(detectDocumentSignals(pdfWithImage(1200, 80), 'application/pdf', 'cv.pdf').likelyPhoto).toBe(false);
  });

  it('reports no images for a text-only PDF', () => {
    const s = detectDocumentSignals(Buffer.from('%PDF-1.4\nplain text resume\n%%EOF', 'latin1'), 'application/pdf', 'cv.pdf');
    expect(s.images).toEqual([]);
    expect(s.likelyPhoto).toBe(false);
  });

  it('never throws on a malformed file — a bad upload must not break intake', () => {
    const s = detectDocumentSignals(Buffer.from([0x00, 0xff, 0x00, 0xff]), 'application/pdf', 'cv.pdf');
    expect(s).toEqual({ images: [], likelyPhoto: false });
  });
});

describe('detectDocumentSignals — DOCX', () => {
  it('finds embedded media entries in the zip headers', () => {
    const buf = Buffer.from('PK....word/media/image1.jpeg....word/media/image2.png....', 'latin1');
    const s = detectDocumentSignals(buf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'cv.docx');
    expect(s.images).toHaveLength(2);
    // Dimensions are unrecoverable from a header scan, so stay conservative.
    expect(s.likelyPhoto).toBe(false);
  });
});

describe('describeSignals', () => {
  const photo: DocumentSignals = { images: [{ width: 323, height: 323, filter: 'DCTDecode' }], likelyPhoto: true };

  it('states the photo as fact and says the text does not contain it', () => {
    const out = describeSignals(photo);
    expect(out).toContain('embedded photograph');
    expect(out).toContain('323 x 323');
    // Without this the model may assume it simply missed it while reading.
    expect(out).toContain('does NOT include the photo');
  });

  it('says nothing when there are no images, keeping the common prompt clean', () => {
    expect(describeSignals({ images: [], likelyPhoto: false })).toBe('');
  });

  it('describes non-photo images without calling them a photograph', () => {
    const out = describeSignals({ images: [{ width: 40, height: 40, filter: 'FlateDecode' }], likelyPhoto: false });
    expect(out).toContain('embedded image');
    expect(out).not.toContain('photograph of the candidate');
  });
});

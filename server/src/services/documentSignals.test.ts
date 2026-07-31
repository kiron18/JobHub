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
  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  /** Builds a real (stored, uncompressed) zip carrying one word/media entry. */
  function docxWith(filename: string, image: Buffer): Buffer {
    const name = Buffer.from(`word/media/${filename}`, 'latin1');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(0, 8);                 // stored, no compression
    local.writeUInt32LE(image.length, 18);     // compressed size
    local.writeUInt32LE(image.length, 22);     // uncompressed size
    local.writeUInt16LE(name.length, 26);
    const localBlock = Buffer.concat([local, name, image]);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(image.length, 20);
    central.writeUInt32LE(image.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 42);              // local header offset
    const centralBlock = Buffer.concat([central, name]);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 10);                 // entry count
    eocd.writeUInt32LE(localBlock.length, 16); // central directory offset
    return Buffer.concat([localBlock, centralBlock, eocd]);
  }

  /** Minimal PNG whose IHDR declares the given dimensions. */
  function png(width: number, height: number): Buffer {
    const b = Buffer.alloc(33);
    b.writeUInt32BE(0x89504e47, 0);
    b.writeUInt32BE(width, 16);
    b.writeUInt32BE(height, 20);
    return b;
  }

  it('reads real dimensions and flags a headshot in a Word file', () => {
    // Regression: the original name-only scan reported every DOCX image at 0x0,
    // so a Word resume with a photo was never flagged while the same photo in a
    // PDF was. Verified against a real .docx carrying the 323x323 headshot.
    const s = detectDocumentSignals(docxWith('image1.png', png(323, 323)), DOCX_MIME, 'cv.docx');
    expect(s.images).toEqual([{ width: 323, height: 323, filter: 'png' }]);
    expect(s.likelyPhoto).toBe(true);
  });

  it('does not flag a small logo in a Word file', () => {
    const s = detectDocumentSignals(docxWith('image1.png', png(48, 48)), DOCX_MIME, 'cv.docx');
    expect(s.images).toHaveLength(1);
    expect(s.likelyPhoto).toBe(false);
  });

  it('treats vector graphics as non-photos — emf/wmf are logos and rules', () => {
    const s = detectDocumentSignals(docxWith('image1.emf', Buffer.alloc(64)), DOCX_MIME, 'cv.docx');
    expect(s.images).toEqual([{ width: 0, height: 0, filter: 'emf' }]);
    expect(s.likelyPhoto).toBe(false);
  });

  it('reads JPEG dimensions from the start-of-frame marker', () => {
    // SOI, then a SOF0 segment declaring height 400, width 300.
    const jpeg = Buffer.from([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x90, 0x01, 0x2c,
      0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    ]);
    const s = detectDocumentSignals(docxWith('image1.jpeg', jpeg), DOCX_MIME, 'cv.docx');
    expect(s.images[0]).toMatchObject({ width: 300, height: 400 });
    expect(s.likelyPhoto).toBe(true);
  });

  it('ignores non-media zip entries', () => {
    const s = detectDocumentSignals(docxWith('notes.txt', Buffer.alloc(8)), DOCX_MIME, 'cv.docx');
    expect(s.images).toEqual([]);
    expect(s.likelyPhoto).toBe(false);
  });

  it('never throws on a truncated or corrupt Word file', () => {
    const s = detectDocumentSignals(Buffer.from('PKgarbage', 'latin1'), DOCX_MIME, 'cv.docx');
    expect(s).toEqual({ images: [], likelyPhoto: false });
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

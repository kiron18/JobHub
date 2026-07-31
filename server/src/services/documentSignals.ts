/**
 * Facts about an uploaded document that TEXT EXTRACTION CANNOT SEE.
 *
 * extractTextFromBuffer returns text and nothing else. A photo, a logo, a
 * signature image — none of them produce a single character, so every prompt
 * downstream is structurally blind to them. Telling the model "mention the
 * photo" can never work, because the photo was never in its input.
 *
 * A photo on a resume is one of the most consequential things to flag for this
 * client base: Australian employers do not expect one, and it creates real
 * discrimination exposure. So we detect it here, from the raw bytes, and pass
 * it into the prompts as a stated fact.
 *
 * This is deliberately a cheap structural scan, not image analysis. It reports
 * what is in the file; the prompt decides how to talk about it.
 */

import zlib from 'zlib';

export interface EmbeddedImage {
  width: number;
  height: number;
  /** DCTDecode = JPEG, FlateDecode = PNG-ish, etc. */
  filter: string;
}

export interface DocumentSignals {
  images: EmbeddedImage[];
  /** An image whose shape and size match a personal photo rather than a logo. */
  likelyPhoto: boolean;
}

/**
 * A headshot is square-ish and reasonably large. A logo or icon is small; a
 * banner or divider rule is extremely wide. Both bounds matter — being wrong in
 * either direction means telling someone to remove a photo they do not have,
 * or missing one they do.
 */
function isPhotoShaped({ width, height }: EmbeddedImage): boolean {
  if (width < 100 || height < 100) return false; // icon, bullet glyph, logo mark
  const aspect = width / height;
  return aspect >= 0.5 && aspect <= 2.0;
}

/**
 * PDF images are XObjects carrying /Subtype /Image with /Width and /Height in
 * the same dictionary. Scanning the raw bytes catches them regardless of how
 * the PDF was produced, without needing to decompress page content streams.
 */
function scanPdf(buffer: Buffer): EmbeddedImage[] {
  const bytes = buffer.toString('latin1');
  const images: EmbeddedImage[] = [];

  for (const match of bytes.matchAll(/\/Subtype\s*\/Image/g)) {
    // The dictionary keys can sit either side of /Subtype, so look both ways.
    const from = Math.max(0, match.index - 800);
    const to = Math.min(bytes.length, match.index + 800);
    const dict = bytes.slice(from, to);

    const width = Number(/\/Width\s+(\d+)/.exec(dict)?.[1] ?? 0);
    const height = Number(/\/Height\s+(\d+)/.exec(dict)?.[1] ?? 0);
    const filter = /\/Filter\s*\/(\w+)/.exec(dict)?.[1] ?? 'unknown';

    if (width > 0 && height > 0) images.push({ width, height, filter });
  }

  return images;
}

/** Reads width/height out of an image's own header bytes. 0x0 if unrecognised. */
function imageDimensions(data: Buffer): { width: number; height: number } {
  // PNG — IHDR is always the first chunk, width/height at fixed offsets.
  if (data.length > 24 && data.readUInt32BE(0) === 0x89504e47) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  // GIF — logical screen descriptor, little-endian.
  if (data.length > 10 && data.toString('latin1', 0, 3) === 'GIF') {
    return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
  }
  // BMP — DIB header.
  if (data.length > 26 && data.toString('latin1', 0, 2) === 'BM') {
    return { width: Math.abs(data.readInt32LE(18)), height: Math.abs(data.readInt32LE(22)) };
  }
  // JPEG — walk the marker segments to the start-of-frame, which carries the size.
  if (data.length > 4 && data.readUInt16BE(0) === 0xffd8) {
    let i = 2;
    while (i + 9 < data.length) {
      if (data[i] !== 0xff) { i++; continue; }
      const marker = data[i + 1]!;
      // SOF0-3, SOF5-7, SOF9-11, SOF13-15 — every non-differential frame type.
      const isSOF = (marker >= 0xc0 && marker <= 0xcf)
        && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { width: data.readUInt16BE(i + 7), height: data.readUInt16BE(i + 5) };
      i += 2 + data.readUInt16BE(i + 2);
    }
  }
  // EMF/WMF are vector graphics — logos and rules, never a headshot.
  return { width: 0, height: 0 };
}

/**
 * DOCX is a zip; embedded pictures live under word/media/. Read the central
 * directory, inflate each media entry, and pull its real dimensions from the
 * image header — a name-only scan cannot tell a headshot from a logo, which
 * would leave photo detection working on PDFs and silently broken on Word
 * files. Word resumes with photos are common for this client base.
 */
function scanDocx(buffer: Buffer): EmbeddedImage[] {
  // End-of-central-directory record, scanned backwards (it has a variable-length
  // trailing comment, so its position is not fixed).
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 66_000; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return [];

  const entries = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  const images: EmbeddedImage[] = [];

  for (let n = 0; n < entries && p + 46 <= buffer.length; n++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(p + 10);
    const compressedSize = buffer.readUInt32LE(p + 20);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('latin1', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (!/^word\/media\/.+\.(jpe?g|png|gif|bmp|emf|wmf)$/i.test(name)) continue;

    try {
      // The local header's extra-field length can differ from the central one,
      // so the data offset must be computed from the local header itself.
      const localNameLen = buffer.readUInt16LE(localOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const raw = buffer.subarray(start, start + compressedSize);
      const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
      const { width, height } = imageDimensions(data);
      images.push({ width, height, filter: name.split('.').pop()!.toLowerCase() });
    } catch {
      // A single unreadable entry must not lose the others.
      images.push({ width: 0, height: 0, filter: 'unreadable' });
    }
  }

  return images;
}

export function detectDocumentSignals(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): DocumentSignals {
  const name = (originalname || '').toLowerCase();
  let images: EmbeddedImage[] = [];

  try {
    if (name.endsWith('.docx') || mimetype.includes('wordprocessingml')) {
      images = scanDocx(buffer);
    } else if (name.endsWith('.pdf') || mimetype.includes('pdf')) {
      images = scanPdf(buffer);
    }
  } catch (err) {
    // A malformed file must never break the upload — worst case we simply do
    // not mention the photo, which is where we were before this existed.
    console.warn('[documentSignals] scan failed (non-fatal):', (err as Error).message);
    return { images: [], likelyPhoto: false };
  }

  return { images, likelyPhoto: images.some(isPhotoShaped) };
}

/**
 * Renders the signals as a prompt block. Returns '' when there is nothing worth
 * saying, so prompts stay clean for the common case.
 */
export function describeSignals(signals: DocumentSignals): string {
  if (!signals.images.length) return '';

  if (signals.likelyPhoto) {
    const photo = signals.images.find(isPhotoShaped)!;
    return `DOCUMENT SIGNALS — established by inspecting the file itself, not by reading the text. Treat these as fact:
- This resume contains an embedded photograph of the candidate (${photo.width} x ${photo.height} pixels). Australian employers do not expect a photo on a resume, it is not standard practice here, and it invites unconscious bias and discrimination risk before anyone reads a word of the content. This is one of the most important things to raise.
- The text you were given below does NOT include the photo, so it is not something you could have noticed by reading. It is there.`;
  }

  return `DOCUMENT SIGNALS — established by inspecting the file itself, not by reading the text:
- This resume contains ${signals.images.length} embedded image${signals.images.length === 1 ? '' : 's'} (likely a logo, icon or graphic rather than a photograph). Graphics and image-based content are invisible to the automated systems that screen resumes, and anything conveyed only in an image is lost.`;
}

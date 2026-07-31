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

/**
 * DOCX is a zip; embedded pictures live under word/media/. Filenames appear in
 * plain text in the local file headers, so a substring scan is enough to know
 * whether images exist. Dimensions are not recoverable this cheaply, so a media
 * entry that is not obviously an icon is reported at unknown size.
 */
function scanDocx(buffer: Buffer): EmbeddedImage[] {
  const bytes = buffer.toString('latin1');
  const names = new Set(
    [...bytes.matchAll(/word\/media\/([A-Za-z0-9_.-]+\.(?:jpe?g|png|gif|bmp|emf|wmf))/g)].map((m) => m[1]!),
  );
  // Size unknown from a header scan — reported as 0 so isPhotoShaped stays
  // conservative and the prompt is told "an image" rather than "a photo".
  return [...names].map(() => ({ width: 0, height: 0, filter: 'docx-media' }));
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

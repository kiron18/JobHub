/**
 * Putting a resume against a person by hand.
 *
 * Most resumes arrive through the signup form. Some do not: someone emails a
 * CV, or hands it over on a call, and until now there was nowhere to put it.
 * The board reads resumes off `SessionRegistration`, so that is where a
 * hand-uploaded one has to land too.
 *
 * ⚠️ WHICH MEANS IT CAN HAVE TO CREATE A REGISTRATION ROW, AND A REGISTRATION
 * ROW IS A CLAIM. Filing it against the upcoming session would put a person who
 * never signed up on tonight's roster and in line for the reminder email. So a
 * row created purely to hold a document is filed under `MANUAL_UPLOAD_SESSION`,
 * which no roster query and no cron ever asks for. Do not "tidy" that into a
 * real session key.
 */
import { prisma } from '../index';
import { extractTextFromBuffer } from './pdf';

/**
 * The session key for a registration that exists only to hold a document.
 *
 * Deliberately not a date, so it can never collide with a real session and so
 * anything filtering by date silently excludes it, which is the point.
 */
export const MANUAL_UPLOAD_SESSION = 'manual-upload';

export interface AttachResult {
  filename: string;
  /** How much text came out. Zero means the file is an image scan. */
  chars: number;
  /** True when this created the registration rather than updating one. */
  createdRegistration: boolean;
}

/**
 * Attach a resume to whoever owns `email`.
 *
 * Extraction failure is not upload failure. The bytes are the thing worth
 * keeping: the ATS structural check reads the real document, and a resume we
 * can hand back on a call is worth having even when nothing could be pulled out
 * of it as text. The caller is told how many characters came out so it can say
 * so rather than pretending the upload was clean.
 */
export async function attachResumeToLead(params: {
  email: string;
  /** Used only when a registration has to be created. */
  fallbackName: string;
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}): Promise<AttachResult> {
  const email = params.email.trim().toLowerCase();

  let text = '';
  try {
    text = (await extractTextFromBuffer(params.buffer, params.mimetype, params.originalname))?.trim() ?? '';
  } catch (err) {
    console.error('[leadResume] extraction failed, keeping the bytes anyway', err);
  }

  const existing = await prisma.sessionRegistration.findUnique({
    where: { email },
    select: { id: true },
  });

  const resume = {
    // Copied into a plain Uint8Array: Prisma's Bytes field wants a view over a
    // real ArrayBuffer, and a Node Buffer can sit on a SharedArrayBuffer.
    resumeFile: new Uint8Array(params.buffer),
    resumeMimetype: params.mimetype,
    resumeFilename: params.originalname,
    // An empty extraction must not wipe text we already had from a better run.
    ...(text ? { resumeText: text } : {}),
  };

  if (existing) {
    await prisma.sessionRegistration.update({ where: { email }, data: resume });
  } else {
    await prisma.sessionRegistration.create({
      data: {
        email,
        name: params.fallbackName.trim() || email.split('@')[0],
        answers: {},
        sessionKey: MANUAL_UPLOAD_SESSION,
        ...resume,
      },
    });
  }

  // The board's own flag, so a row shows a resume without joining across.
  await prisma.salesLead.updateMany({ where: { email }, data: { hasResume: true } });

  return { filename: params.originalname, chars: text.length, createdRegistration: !existing };
}

/**
 * The gate on profile.resumeRawText.
 *
 * resumeRawText is the ground truth for everything downstream. Every generated
 * resume and cover letter is built from it, and checkGrounding measures every
 * generation against it. Nothing measured the field itself, which meant a figure
 * that got into it was true by definition, permanently, and the generation gate
 * would defend it rather than catch it.
 *
 * Three writers reach the field: the /welcome rebuild, an onboarding upload, and
 * a candidate editing their own bank. Only the rebuild was gated at all, and that
 * gate (retentionGate) proves nothing was LOST. Nothing proved nothing was ADDED.
 *
 * So the gate belongs to the field, not to any one writer. Every path calls
 * assertResumeSource before the write.
 *
 * Two modes, because who wrote it changes what a bad figure means:
 *
 *   'authored' — a model produced this text. An ungrounded figure is a
 *                fabrication and must never reach the field. Throws.
 *   'human'    — the candidate typed this themselves. It is their resume and
 *                their history, and the original upload is not the limit of what
 *                is true about them, so a new figure is not a defect. It is
 *                returned as an advisory for the UI to ask them to confirm.
 *
 * Length and placeholders throw in BOTH modes: those are defects in the
 * document, not claims about the person, and neither a model nor a candidate has
 * a good reason to put "[how many]" into the file every future application is
 * built from.
 */
import { findUngroundedFigures } from './groundingGate';
import { findBlanks } from '../services/buildCleanResume';

/** Below this it is not a resume, it is a fragment or a failed extraction. */
export const MIN_RESUME_LENGTH = 200;

export type ResumeSourceMode = 'authored' | 'human';

export interface ResumeSourceCheck {
  /** False when something must block the write. Mode-dependent. */
  ok: boolean;
  tooShort: boolean;
  /** Square-bracket placeholders, e.g. "[how many]". Always fatal. */
  placeholders: string[];
  /**
   * Figures present in the text and in none of the sources. Fatal when authored,
   * advisory when human, and the thing to put in front of the candidate.
   */
  ungroundedFigures: string[];
}

export class ResumeSourceError extends Error {
  constructor(public readonly check: ResumeSourceCheck, public readonly writer: string) {
    const parts: string[] = [];
    if (check.tooShort) parts.push('text too short to be a resume');
    if (check.placeholders.length) parts.push(`placeholders: ${check.placeholders.slice(0, 5).join(', ')}`);
    if (check.ungroundedFigures.length) parts.push(`figures not in any source: ${check.ungroundedFigures.slice(0, 5).join(', ')}`);
    super(`Refused to write resumeRawText from ${writer}: ${parts.join('; ')}`);
    this.name = 'ResumeSourceError';
  }
}

/**
 * `sources` is everything the text is allowed to draw on: the original upload,
 * and for the rebuild, the answers the candidate gave. Pass the raw strings; the
 * figure check normalises both sides.
 */
export function checkResumeSource(
  text: string,
  sources: string[],
  mode: ResumeSourceMode,
): ResumeSourceCheck {
  const body = (text ?? '').trim();
  const tooShort = body.length < MIN_RESUME_LENGTH;
  const placeholders = findBlanks(body, sources);
  // A short or placeholder-ridden document is already being rejected; running the
  // figure check on it would just add noise to the error.
  const ungroundedFigures = tooShort ? [] : findUngroundedFigures(body, sources);

  const ok = !tooShort
    && placeholders.length === 0
    && (mode === 'human' || ungroundedFigures.length === 0);

  return { ok, tooShort, placeholders, ungroundedFigures };
}

/**
 * Run the gate and throw if the write must not happen. Returns the check so a
 * caller in 'human' mode can surface the advisory figures to the candidate.
 *
 * `writer` names the call site and appears in the error, because when this fires
 * in production the first question is always which path produced it.
 */
export function assertResumeSource(
  text: string,
  sources: string[],
  mode: ResumeSourceMode,
  writer: string,
): ResumeSourceCheck {
  const check = checkResumeSource(text, sources, mode);
  if (!check.ok) throw new ResumeSourceError(check, writer);
  if (mode === 'human' && check.ungroundedFigures.length > 0) {
    console.log(
      `[resumeSourceGate] ${writer}: ${check.ungroundedFigures.length} figure(s) not in the original, `
      + `flagged for confirmation: ${check.ungroundedFigures.slice(0, 5).join(', ')}`,
    );
  }
  return check;
}

/**
 * Is what someone pasted a job link rather than a job description?
 *
 * This exists because of where the employer name lives. Seek renders the
 * advertiser in the page header, outside the block people select when they copy
 * an ad, so a pasted description almost never contains it. 36% of the tracker
 * had no employer for exactly that reason. A link does contain it, because the
 * server can read the header.
 *
 * So the box takes both, and this decides which one arrived.
 */

/** A Seek job link, in any of the shapes Seek actually hands out. */
const SEEK_JOB = /(?:^|\s)(?:https?:\/\/)?(?:www\.)?(?:au\.seek\.com|seek\.com\.au)\/[^\s]*/i;

/** Anything at all that looks like a link, so we can tell "wrong site" from "prose". */
const ANY_URL = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?$/i;

export type PastedInput =
  | { kind: 'seek-url'; url: string }
  | { kind: 'other-url'; url: string }
  | { kind: 'description' };

/**
 * Classify the contents of the paste box.
 *
 * Only a paste that is *nothing but* a link counts as a link. A description
 * that happens to quote a URL somewhere in its body is still a description, and
 * treating it as a link would throw away the text the person actually pasted.
 */
export function classifyPaste(raw: string): PastedInput {
  const text = (raw ?? '').trim();
  if (!text) return { kind: 'description' };

  // More than one line of real content means prose, even if line one is a link.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length !== 1) return { kind: 'description' };

  const only = lines[0];
  if (/\s/.test(only)) return { kind: 'description' };

  if (SEEK_JOB.test(only)) return { kind: 'seek-url', url: normaliseUrl(only) };
  if (ANY_URL.test(only)) return { kind: 'other-url', url: normaliseUrl(only) };
  return { kind: 'description' };
}

/** Seek links get pasted without a scheme often enough to be worth handling. */
export function normaliseUrl(url: string): string {
  const t = url.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/**
 * Is this ready to submit?
 *
 * A description needs to be long enough to be an ad. A link is short by nature,
 * and the old 50-character floor rejected every one of them, which is the
 * reason the link path could not simply be dropped into the existing box.
 */
export function isSubmittable(raw: string): boolean {
  const input = classifyPaste(raw);
  if (input.kind === 'seek-url') return true;
  if (input.kind === 'other-url') return false;
  return (raw ?? '').trim().length >= 50;
}

/** What to tell someone whose paste cannot be used yet, or null if it can. */
export function pasteHint(raw: string): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;

  const input = classifyPaste(text);
  if (input.kind === 'seek-url') return null;
  if (input.kind === 'other-url') {
    return 'Links only work for Seek right now. For any other site, paste the job description instead.';
  }
  if (text.length < 100) {
    return 'Paste the full job description, or a Seek link. The more text, the sharper the analysis.';
  }
  return null;
}

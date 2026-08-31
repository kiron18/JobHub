/**
 * Puts back the URLs that PDF text extraction throws away.
 *
 * A PDF hyperlink is two separate things: the words you see, and a link
 * annotation sitting invisibly over them holding the actual address. Every text
 * extractor we use returns the words and drops the annotation. So a resume
 * whose contact line reads "LinkedIn Profile" in blue arrives as the literal
 * string "LinkedIn Profile", with the URL gone.
 *
 * On 29 Aug 2026 that deadlocked a real rebuild. The intake inventory is told to
 * record contacts "exactly as written", so it recorded "LinkedIn Profile". The
 * rewrite is told never to write a bare "LinkedIn" with no URL behind it, so it
 * correctly left it out. The retention gate then demanded a string the rewrite
 * was forbidden to produce, failed all three attempts and returned a 502. Two
 * prompts, each right on its own, made a rebuild that could never pass. It hit
 * every resume whose LinkedIn is a link rather than a typed-out address, which
 * is most of them.
 *
 * Fixing it in a prompt would have meant teaching one model to tolerate what
 * another was told to remove. The information was never missing, only discarded,
 * so it is recovered here instead and every prompt downstream is left alone.
 */
import zlib from 'zlib';

/** Only these ever go into a resume, and anything else is not worth the risk. */
const SAFE_SCHEME = /^(https?:\/\/|mailto:)/i;

/**
 * Every URL behind a link annotation in the file.
 *
 * Read straight off the bytes rather than through a PDF library, the same way
 * documentSignals reads embedded images. Annotations live in ordinary objects in
 * older files and inside compressed object streams in newer ones, so both are
 * scanned; a file that yields nothing simply returns an empty list and the
 * caller carries on with the text exactly as it was.
 */
export function extractPdfLinks(buffer: Buffer): string[] {
  const found = new Set<string>();

  const scan = (chunk: string) => {
    // /URI (https://example.com) — the literal-string form, which is almost all
    // of them. Backslash escapes are legal inside, so they are unescaped after.
    const re = /\/URI\s*\(((?:\\.|[^\\)])*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk)) !== null) {
      const url = m[1].replace(/\\([()\\])/g, '$1').trim();
      if (SAFE_SCHEME.test(url)) found.add(url);
    }
  };

  try {
    const raw = buffer.toString('latin1');
    scan(raw);

    // Newer writers pack objects into FlateDecode streams, so the annotation is
    // not in the plain bytes. Inflate what we can and scan that too. A stream
    // that will not inflate is skipped, never fatal.
    const streamRe = /stream\r?\n?/g;
    let s: RegExpExecArray | null;
    while ((s = streamRe.exec(raw)) !== null) {
      const start = s.index + s[0].length;
      const end = raw.indexOf('endstream', start);
      if (end < 0) continue;
      // Cheap guard: object streams holding annotations are small. Inflating
      // every font and image in a large resume is wasted work.
      if (end - start > 2_000_000) continue;
      try {
        scan(zlib.inflateSync(buffer.subarray(start, end)).toString('latin1'));
      } catch { /* not a flate stream, or truncated. Nothing to recover. */ }
    }
  } catch (err) {
    console.warn('[pdfLinks] scan failed (non-fatal):', (err as Error).message);
    return [];
  }

  return [...found];
}

/**
 * What a link's visible words look like when the URL has been lost.
 *
 * Only the cases that actually appear on a resume contact line. `avoid` exists
 * because "LinkedIn" is not always a link to a profile: "LinkedIn Learning"
 * courses are a real qualification on real resumes, and rewriting one of those
 * into somebody's profile URL would be a corruption, not a repair.
 */
const LABELS: Array<{ host: RegExp; label: RegExp; avoid?: RegExp }> = [
  { host: /(^|\.)linkedin\.com$/i, label: /LinkedIn(?:\s+(?:Profile|Page|Link))?/i, avoid: /^\s*Learning/i },
  { host: /(^|\.)github\.com$/i, label: /GitHub(?:\s+(?:Profile|Page|Link|Repo(?:sitory)?))?/i },
  { host: /(^|\.)behance\.net$/i, label: /Behance(?:\s+(?:Profile|Page))?/i },
  { host: /(^|\.)gitlab\.com$/i, label: /GitLab(?:\s+(?:Profile|Page))?/i },
];

/** The bit of a URL that proves it is already written out in the text. */
function urlCore(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase();
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./i, ''); } catch { return ''; }
}

/**
 * Only the contact block. A profile link is written at the top of a resume, and
 * a label word appearing four pages down is prose, not a hyperlink we lost.
 */
const HEAD_CHARS = 1200;

/**
 * Swap each lost link's visible words for the URL that was behind them.
 *
 * Deliberately timid. A URL already spelled out in the text is left alone, a
 * label it cannot find is left alone, and anything outside the contact block is
 * left alone. The worst case is that nothing changes, which is exactly where we
 * were before this existed.
 */
export function restoreLinkUrls(text: string, urls: string[]): string {
  if (!text || urls.length === 0) return text;

  let head = text.slice(0, HEAD_CHARS);
  const tail = text.slice(HEAD_CHARS);
  const lower = () => head.toLowerCase();

  for (const url of urls) {
    const host = hostOf(url);
    if (!host) continue;
    const rule = LABELS.find((l) => l.host.test(host));
    if (!rule) continue;

    // Already written out. Nothing was lost, so nothing to repair.
    if (lower().includes(urlCore(url))) continue;

    // The extractor may have wrapped the words in markup of its own -
    // LlamaParse emits <font color="blue">LinkedIn Profile</font> - so the tags
    // around the label go with it, otherwise an empty <font> pair is left behind.
    const wrapped = new RegExp(`<font[^>]*>\\s*(${rule.label.source})\\s*</font>`, 'i');
    const bare = new RegExp(`\\b(${rule.label.source})`, 'i');

    const m = wrapped.exec(head) ?? bare.exec(head);
    if (!m) continue;
    if (rule.avoid && rule.avoid.test(head.slice(m.index + m[0].length))) continue;

    head = head.slice(0, m.index) + url + head.slice(m.index + m[0].length);
  }

  return head + tail;
}

/**
 * The whole repair, for the PDF path of text extraction. Never throws: a file we
 * cannot read links out of returns the text untouched.
 */
export function restorePdfLinks(text: string, buffer: Buffer): string {
  try {
    const urls = extractPdfLinks(buffer);
    if (urls.length === 0) return text;
    const restored = restoreLinkUrls(text, urls);
    if (restored !== text) console.log(`[pdfLinks] restored ${urls.length} link(s) into the contact block`);
    return restored;
  } catch (err) {
    console.warn('[pdfLinks] restore failed (non-fatal):', (err as Error).message);
    return text;
  }
}

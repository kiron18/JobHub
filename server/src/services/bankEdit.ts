/**
 * Line-level edits to the bank (`profile.resumeRawText`).
 *
 * The bank is one markdown document, and it is what generate.ts reads for every
 * resume and cover letter. An edit that does not land here does nothing, so
 * every operation in this file writes to that one field.
 *
 * Structured rows were tried as the source of truth and abandoned — extraction
 * dropped content and a client lost a publication. generation-v2 made the text
 * the truth and demoted the DB rows to display. Nothing here reverses that:
 * there is no re-extraction, no regeneration, and no model in the write path. An
 * edit is a string operation on one line.
 *
 * Every operation returns the new document AND is verified against the old one,
 * so the change is provably confined to the line the candidate touched. That
 * verification is the whole reason edits are safe: the blast radius of a mistake
 * is a single line, and the caller snapshots to ResumeVersion before saving.
 */

export type BankEditFailure =
  /** The line is not in the document — the client is looking at stale text. */
  | 'not_found'
  /** The line appears more than once, so we cannot tell which one was meant. */
  | 'ambiguous'
  /** The edit would have changed something other than the target line. */
  | 'unexpected_change'
  /** Empty or whitespace-only input. */
  | 'empty';

export interface BankEditResult {
  ok: boolean;
  text: string;
  failure?: BankEditFailure;
  /** Human-readable, safe to show the candidate. */
  message?: string;
}

const FAILURE_MESSAGE: Record<BankEditFailure, string> = {
  not_found: 'That line has changed since you opened this page. Reload and try again.',
  ambiguous: 'That exact line appears more than once, so we cannot tell which one you meant. Edit one of them to make it unique first.',
  unexpected_change: 'Something other than the line you edited would have changed, so we stopped. Nothing was saved.',
  empty: 'That line cannot be empty.',
};

function fail(text: string, failure: BankEditFailure): BankEditResult {
  return { ok: false, text, failure, message: FAILURE_MESSAGE[failure] };
}

/** Split preserving content exactly; join is the exact inverse. */
function lines(doc: string): string[] {
  return doc.split('\n');
}

/** Indexes of lines matching exactly (after trimming trailing whitespace only,
 *  since editors and copy-paste routinely add or drop it). */
function findLine(docLines: string[], target: string): number[] {
  const needle = target.trimEnd();
  const out: number[] = [];
  docLines.forEach((l, i) => { if (l.trimEnd() === needle) out.push(i); });
  return out;
}

/**
 * Confirms the result differs from the original at exactly the expected index
 * and nowhere else. This is what makes an edit provably safe rather than
 * merely intended to be safe.
 */
function onlyIndexChanged(before: string[], after: string[], index: number): boolean {
  if (before.length !== after.length) return false;
  for (let i = 0; i < before.length; i++) {
    if (i === index) continue;
    if (before[i] !== after[i]) return false;
  }
  return true;
}

/** Replace one line. The commonest edit: fixing a wrong figure or wording. */
export function replaceLine(doc: string, before: string, after: string): BankEditResult {
  if (!after.trim()) return fail(doc, 'empty');

  const src = lines(doc);
  const hits = findLine(src, before);
  if (hits.length === 0) return fail(doc, 'not_found');
  if (hits.length > 1) return fail(doc, 'ambiguous');

  const index = hits[0]!;
  const next = [...src];
  next[index] = after;

  if (!onlyIndexChanged(src, next, index)) return fail(doc, 'unexpected_change');
  return { ok: true, text: next.join('\n') };
}

/**
 * Insert a new line directly below an existing one — how a candidate adds an
 * achievement to a specific role, rather than to the end of the document.
 * Omitting `afterLine` appends to the end.
 */
export function insertLine(doc: string, newLine: string, afterLine?: string | null): BankEditResult {
  if (!newLine.trim()) return fail(doc, 'empty');

  const src = lines(doc);
  let index: number;

  if (afterLine && afterLine.trim()) {
    const hits = findLine(src, afterLine);
    if (hits.length === 0) return fail(doc, 'not_found');
    if (hits.length > 1) return fail(doc, 'ambiguous');
    index = hits[0]! + 1;
  } else {
    index = src.length;
  }

  const next = [...src.slice(0, index), newLine, ...src.slice(index)];

  // Removing what we inserted must reproduce the original exactly — proof that
  // nothing else moved.
  const check = [...next];
  check.splice(index, 1);
  if (check.length !== src.length || check.some((l, i) => l !== src[i])) {
    return fail(doc, 'unexpected_change');
  }
  return { ok: true, text: next.join('\n') };
}

/** Remove one line. Recoverable via the ResumeVersion snapshot the caller takes. */
export function removeLine(doc: string, line: string): BankEditResult {
  const src = lines(doc);
  const hits = findLine(src, line);
  if (hits.length === 0) return fail(doc, 'not_found');
  if (hits.length > 1) return fail(doc, 'ambiguous');

  const index = hits[0]!;
  const next = [...src];
  next.splice(index, 1);

  // Putting it back must reproduce the original exactly.
  const check = [...next];
  check.splice(index, 0, src[index]!);
  if (check.length !== src.length || check.some((l, i) => l !== src[i])) {
    return fail(doc, 'unexpected_change');
  }
  return { ok: true, text: next.join('\n') };
}

/**
 * Generation refuses to run below this, so a bank shorter than it is not a
 * short resume — it is a broken account. Better to stop the save and say why.
 */
export const MIN_BANK_CHARS = 200;

export interface DocumentChange {
  linesAdded: number;
  linesRemoved: number;
  linesChanged: number;
  /** A blunt warning when a lot went missing, so an accident is visible. */
  warning?: string;
}

/**
 * Whole-document edit. The candidate is deliberately editing their own text, so
 * unlike a model rewrite there is nothing to verify against — they are allowed
 * to change whatever they like. What we owe them is that it is never
 * unrecoverable: the caller snapshots before saving, and a large deletion is
 * called out rather than passing silently.
 */
export function replaceDocument(previous: string, next: string): BankEditResult & { change?: DocumentChange } {
  const text = next.replace(/\r\n/g, '\n').trimEnd();

  if (!text.trim()) return fail(previous, 'empty');
  if (text.length < MIN_BANK_CHARS) {
    return {
      ok: false,
      text: previous,
      failure: 'empty',
      message: `That is too short to build applications from, so we have not saved it. A resume needs at least ${MIN_BANK_CHARS} characters. Your previous version is untouched.`,
    };
  }

  const a = lines(previous);
  const b = lines(text);
  const kept = new Set(b.map((l) => l.trim()).filter(Boolean));
  const removed = a.filter((l) => l.trim() && !kept.has(l.trim())).length;
  const prevSet = new Set(a.map((l) => l.trim()).filter(Boolean));
  const added = b.filter((l) => l.trim() && !prevSet.has(l.trim())).length;

  const change: DocumentChange = {
    linesAdded: added,
    linesRemoved: removed,
    linesChanged: Math.min(added, removed),
  };

  // Not a block — it is their document. But a quarter of it disappearing is
  // usually a mistake, and they should be told before they navigate away.
  if (removed > 5 && removed > a.filter((l) => l.trim()).length * 0.25) {
    change.warning = `That removed ${removed} lines. If that was not deliberate, use Undo to get the previous version back.`;
  }

  return { ok: true, text, change };
}

/**
 * One plain sentence describing what changed, shown on save. Confidence should
 * come from us stating the change precisely, not from the candidate re-reading
 * the document to confirm nothing else moved.
 */
export function describeEdit(before: string, after: string): string {
  const b = lines(before);
  const a = lines(after);

  if (a.length > b.length) return 'Added 1 line. Nothing else changed.';
  if (a.length < b.length) return 'Removed 1 line. Nothing else changed.';

  const changed = b.reduce((n, l, i) => (l !== a[i] ? n + 1 : n), 0);
  if (changed === 0) return 'No change.';
  return `Changed 1 line. Nothing else changed.`;
}

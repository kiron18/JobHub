/**
 * Verifies that a rebuilt resume did not silently lose anything.
 *
 * The rebuild is the one moment in this pipeline where a model writes an entire
 * document, and that is exactly where content loss happens. A real client's
 * current job — "Mont Albert Manor, Food Safety Assistant, 02/2024 - Present" —
 * was dropped from a generated resume while less relevant casual roles survived.
 * Nothing caught it.
 *
 * The safety property comes from splitting the work so the risky half cannot
 * cause loss:
 *
 *   the model only LISTS  — it reads the original and names what must survive
 *   this code only VERIFIES — plain string matching, no judgement
 *
 * The model never decides whether something may be dropped. If its list is
 * incomplete we simply check less; we can never lose something *because of* the
 * check. It fails safe in the only direction that matters.
 *
 * Matching is deliberately forgiving. A false positive here blocks a good
 * rebuild and costs the candidate a retry, so "Mont Albert Manor (Age Care
 * Centre)" must still match when the rebuild sensibly writes "Mont Albert
 * Manor". We check a small set of acceptable keys per item and pass on any.
 */

export interface MustKeep {
  /** Employers, organisations, clients — anything that names a place of work. */
  employers: string[];
  /** Degrees, certifications, institutions, publications, awards. */
  qualifications: string[];
  /** Email, phone, LinkedIn — losing one of these makes the resume unusable. */
  contacts: string[];
}

export interface MissingItem {
  item: string;
  kind: 'employer' | 'qualification' | 'contact';
}

export interface RetentionResult {
  /** False when anything in the hard categories went missing. */
  passed: boolean;
  missing: MissingItem[];
  /** Years present in the original but absent from the rebuild. Advisory only. */
  missingYears: string[];
  /** How many items were verified, for the sign-off summary. */
  checked: number;
}

/** Lowercase, strip punctuation to spaces, collapse runs. Makes matching robust
 *  to the dash, quote and spacing variations that differ between documents. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The acceptable ways an item may appear. A rebuild legitimately shortens
 * "Mont Albert Manor (Age Care Centre) - Food Safety Assistant" to "Mont Albert
 * Manor", so the shortened core has to count as a match.
 */
function keysFor(item: string): string[] {
  const keys = new Set<string>();
  const full = normalise(item);
  if (full.length >= 4) keys.add(full);

  // Drop parentheticals: "Acme (Holdings) Pty Ltd" -> "Acme Pty Ltd"
  const noParens = normalise(item.replace(/\([^)]*\)/g, ' '));
  if (noParens.length >= 4) keys.add(noParens);

  // Take the part before the first separator, which is usually the name itself:
  // "Mont Albert Manor - Food Safety Assistant" -> "mont albert manor"
  const core = normalise(item.replace(/\([^)]*\)/g, ' ').split(/[,|–—]|\s-\s/)[0] ?? '');
  if (core.length >= 4) keys.add(core);

  return [...keys];
}

/** Words too common to prove anything on their own. */
const STOPWORDS = new Set([
  'the', 'and', 'of', 'for', 'at', 'in', 'on', 'to', 'a', 'an', 'from', 'with',
  'pty', 'ltd', 'inc', 'llc', 'limited', 'services', 'group', 'company',
]);

/** Distinctive words in an item — what actually identifies it. */
function distinctiveTokens(item: string): string[] {
  return normalise(item)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function isPresent(item: string, haystack: string): boolean {
  // Contiguous match first — the common, unambiguous case.
  if (keysFor(item).some((k) => haystack.includes(k))) return true;

  // Otherwise every distinctive word must appear somewhere. A rebuild
  // legitimately reorders and rewords: "BSc, Deakin University" may become
  // "BSc from Deakin University", and "Acme Corp - Analyst" may become
  // "Analyst | Acme Corp". Requiring contiguity there would fail a perfectly
  // good rebuild and cost the candidate a retry for nothing. Whole-item removal
  // is still caught, because then none of the words are present at all.
  const tokens = distinctiveTokens(item);
  if (tokens.length === 0) return false;
  return tokens.every((t) => haystack.includes(t));
}

/** Distinct 19xx/20xx years, in order of appearance. */
function years(text: string): string[] {
  return [...new Set(text.match(/\b(?:19|20)\d{2}\b/g) ?? [])];
}

export function checkRetention(
  original: string,
  rebuilt: string,
  mustKeep: Partial<MustKeep> | null | undefined,
): RetentionResult {
  const haystack = normalise(rebuilt);
  const missing: MissingItem[] = [];
  let checked = 0;

  const categories: Array<[MissingItem['kind'], string[]]> = [
    ['employer', mustKeep?.employers ?? []],
    ['qualification', mustKeep?.qualifications ?? []],
    ['contact', mustKeep?.contacts ?? []],
  ];

  for (const [kind, items] of categories) {
    for (const raw of items) {
      const item = String(raw ?? '').trim();
      if (!item) continue;
      checked++;
      if (!isPresent(item, haystack)) missing.push({ item, kind });
    }
  }

  // Years need no model to identify, so this runs even when the inventory is
  // empty. Advisory rather than blocking: a rebuild can legitimately drop a year
  // that only appeared in something merged or reworded.
  const rebuiltYears = new Set(years(rebuilt));
  const missingYears = years(original).filter((y) => !rebuiltYears.has(y));

  return { passed: missing.length === 0, missing, checked, missingYears };
}

/**
 * The corrective instruction appended to a retry. Naming exactly what went
 * missing fixes it the overwhelming majority of the time, which keeps the
 * candidate out of it entirely.
 */
export function retentionRetryInstruction(missing: MissingItem[]): string {
  const lines = missing.map((m) => `- ${m.item} (${m.kind})`).join('\n');
  return `YOUR PREVIOUS ATTEMPT DROPPED CONTENT. These appear in the candidate's original resume but are missing from what you produced:

${lines}

Rewrite the resume with every one of them included, in the right place, alongside everything you already had. Do not remove anything else to make room. Losing a real role or qualification is a serious failure — it is the candidate's actual history.`;
}

/** One plain sentence for the sign-off summary. */
export function describeRetention(result: RetentionResult): string {
  if (result.checked === 0) return 'We rebuilt your resume from the file you uploaded.';
  return `We checked all ${result.checked} ${result.checked === 1 ? 'item' : 'items'} from your original resume are still here.`;
}

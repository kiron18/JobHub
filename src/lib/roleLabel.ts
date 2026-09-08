/**
 * How a target role is allowed to appear inside a sentence on a button.
 *
 * "Browse ___ jobs" prints whatever is in the candidate's profile, and that
 * string is typed once at signup and then repeated on that button forever. Two
 * different things go wrong with it:
 *
 *   Case      "BUsiness analyst" on a real account, so the button read
 *             "Browse BUsiness analyst jobs".
 *   Length    "Marketing Communications Intern" made the button read "Browse
 *             marketing communications intern jobs", which wraps to three lines
 *             on a phone beside "Check eligibility" and looks broken.
 *
 * Both are cosmetic, neither is worth a support conversation, and neither is
 * fixable by asking the candidate to retype their role. So the label is derived,
 * deterministically, in four passes: case, rung, length, floor.
 *
 * The label is DISPLAY ONLY. Every search URL is still built from the full
 * stored role (see buildSeekSearchUrl), so shortening the words on the button
 * never narrows what the candidate is actually shown.
 */

/**
 * Rung words that can be dropped off the end of a role.
 *
 * Mirrors TRAILING_QUALIFIERS in server/src/lib/targetRoleSeed.ts, which does
 * the same job at the other end of the flow — that one cleans the role before
 * it is stored, this one cleans it on the way to a button, and an account
 * created before that rule shipped still has the rung in the database. Keep the
 * two lists in step.
 */
const TRAILING_RUNGS = [
  'intern', 'interns', 'internship', 'internships',
  'trainee', 'cadet', 'apprentice',
];

/** Words already implied by the sentence the label sits in. */
const REDUNDANT_TAIL = ['job', 'jobs', 'role', 'roles', 'position', 'positions', 'vacancy', 'vacancies'];

/**
 * How many characters the ROLE gets, per place the label is printed.
 *
 * A budget rather than one constant, because the constraint is never the role
 * on its own — it is the whole rendered sentence in the box it has to fit.
 * "Browse ___ jobs" spends 12 characters before the role gets any, so a 24
 * character role is a 36 character line, and at 14px semibold that is 492px of
 * button. No phone is 492px wide. Shipped exactly that on 8 Sep 2026: the pair
 * of buttons on the dashboard ran off the right of the card at every width
 * under 620, because the cap had been applied to the role and the promise not
 * to wrap had been made about the sentence.
 *
 * So each caller says how much room it actually has, and the numbers below are
 * measured at 320px — the narrowest phone still in use — not estimated.
 * scripts/_widthcheck.mjs is what measures them.
 */
export const ROLE_BUDGET = {
  /** "Browse ___ jobs" on a button that has to hold one line on a 320px phone. */
  button: 16,
  /** A full-width row with the sentence and nothing else competing for it. */
  row: 24,
} as const;

/** Below two words a label stops naming a craft: "communications", not "officer". */
const MIN_LABEL_WORDS = 2;

/**
 * Words that cannot start a label.
 *
 * Cutting "Marketing Communications and Engagement Officer" from the left lands
 * on "and engagement officer", which is under the cap and reads as a sentence
 * that lost its beginning. A label has to look chosen, not truncated.
 */
const LEADING_CONNECTIVES = ['and', '&', 'of', 'the', 'or', 'in', 'for', '/', '-', '–', '—'];

/** What the button says when there is no usable role at all. */
export const GENERIC_ROLE_LABEL = 'more';

/**
 * Pass 1 — case.
 *
 * Lowercased word by word, because this sits mid-sentence and every ordinary
 * role reads correctly there whatever case it was stored in. An all-uppercase
 * word is left exactly as it is: "IT", "HR" and "UX" are acronyms, and "Browse
 * it support jobs" is a worse bug than the one being fixed.
 */
function normaliseCase(role: string): string {
  return role
    .split(/\s+/)
    .map((word) => (word === word.toUpperCase() ? word : word.toLowerCase()))
    .join(' ');
}

/** Pass 2 — drop a rung or a redundant noun sitting bare on the end. */
function dropTail(words: string[]): string[] {
  let out = words;
  // Twice, because "data analyst intern roles" carries one of each.
  for (let pass = 0; pass < 2; pass++) {
    if (out.length <= 1) break;
    const last = out[out.length - 1].toLowerCase().replace(/[^a-z]/g, '');
    if (!TRAILING_RUNGS.includes(last) && !REDUNDANT_TAIL.includes(last)) break;
    out = out.slice(0, -1);
  }
  return out;
}

/**
 * Pass 3 — length, by dropping words from the LEFT.
 *
 * English job titles are head-final: the last words name the craft and the
 * leading ones qualify it. So "marketing communications and engagement officer"
 * loses "marketing" and then "communications and" before it loses "engagement
 * officer", and what survives is always a true generalisation of what they
 * typed rather than a fragment of it.
 */
function fitLength(words: string[], maxChars: number): string[] {
  let out = words;
  while (out.join(' ').length > maxChars && out.length > MIN_LABEL_WORDS) {
    out = out.slice(1);
  }
  // Never start on a joining word, whatever the length worked out to.
  while (out.length > 1 && LEADING_CONNECTIVES.includes(out[0].toLowerCase())) {
    out = out.slice(1);
  }
  // Down to two words and still over budget means two long words. One of them
  // is the craft and the other qualifies it, so the qualifier goes and a single
  // word carries the label: "Browse communications jobs" beats a line that runs
  // off the screen, and beats an ellipsis in the middle of a sentence.
  if (out.join(' ').length > maxChars && out.length > 1) out = out.slice(-1);
  return out;
}

/**
 * The role as it should read inside "Browse ___ jobs".
 *
 * `maxChars` is the room the caller has for the role itself — see ROLE_BUDGET,
 * and pass one of its members rather than a bare number, so the reason for the
 * size stays attached to it.
 *
 * Returns GENERIC_ROLE_LABEL when there is nothing usable, so the caller's
 * sentence still reads ("Browse more jobs") rather than collapsing.
 */
export function browseRoleLabel(
  targetRole?: string | null,
  maxChars: number = ROLE_BUDGET.row,
): string {
  const trimmed = (targetRole ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return GENERIC_ROLE_LABEL;

  const words = fitLength(dropTail(normaliseCase(trimmed).split(' ')), maxChars);
  const label = words.join(' ').replace(/[\s,;:|/–—-]+$/, '').trim();

  return label.length >= 2 ? label : GENERIC_ROLE_LABEL;
}

/**
 * The role with an intern-family rung taken off the end, in the candidate's own
 * case. For the target-role FIELD, where what they see has to stay editable
 * text rather than become a button label.
 *
 * Returns the input unchanged when there is nothing safe to strip, so a caller
 * can compare the two and tell whether anything happened.
 */
export function stripRung(role: string): string {
  const trimmed = (role ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;

  const words = trimmed.split(' ');
  if (words.length < 2) return trimmed;

  const last = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, '');
  if (!TRAILING_RUNGS.includes(last)) return trimmed;

  const kept = words.slice(0, -1).join(' ').replace(/[\s,;:|/–—-]+$/, '').trim();
  // Same over-strip guard as the server's: "IT Intern" keeps its rung rather
  // than becoming "IT".
  return kept.length >= 3 ? kept : trimmed;
}

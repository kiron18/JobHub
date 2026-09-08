/**
 * The role the /welcome flow puts in the "where are we aiming" box before the
 * candidate touches it.
 *
 * The box used to be seeded with their CURRENT title, verbatim, which is a
 * different thing entirely. On 25 Aug 2026 Emmanuel Fasan uploaded a CV whose
 * current role was "Data Analyst (Intern)", so the flow proposed that he aim
 * for an internship. That is not a cosmetic slip: buildCleanResume prints the
 * target title on the line directly under the candidate's name, so his rebuilt
 * resume would have been headlined "Data Analyst (Intern)", and every
 * application generated from it afterwards would have been aimed at the rung
 * he is trying to leave.
 *
 * So: seed the CRAFT and drop the rung. "Data Analyst (Intern)" seeds
 * "Data Analyst".
 *
 * Deliberately narrow. A qualifier is stripped only where it sits in a MODIFIER
 * POSITION: inside brackets, as its own segment after a separator, or — for the
 * intern family alone — as a bare word on the END of the title. A LEADING bare
 * word is left alone even when it is on the list, because "Contract
 * Administrator", "Student Advisor" and "Volunteer Coordinator" are real jobs
 * whose first word is the craft, and mangling a title is a worse failure than
 * leaving a slightly junior one in a box the candidate is about to edit. This
 * is a seed, not a decision.
 */

/**
 * Words that name the rung or the engagement rather than the work. Safe to drop
 * in a modifier position because nobody's target job is "Intern" as a
 * profession.
 */
const QUALIFIERS = [
  'intern', 'interns', 'internship', 'internships',
  'trainee', 'apprentice', 'apprenticeship', 'cadet', 'cadetship',
  'volunteer', 'voluntary',
  'casual', 'part time', 'part-time', 'full time', 'full-time',
  'contract', 'contractor', 'temporary', 'temp', 'fixed term', 'fixed-term',
  'placement', 'work experience', 'student', 'work integrated learning',
];

/**
 * A separator between title segments. A dash only counts when it has whitespace
 * beside it, so the hyphen inside "Part-time" is never mistaken for one.
 */
const SEPARATOR = /\s*[,;:|]\s*|\s+[-–—/]+\s+/;

/**
 * The subset of QUALIFIERS safe to drop from the END of a title with no bracket
 * and no separator in front of it.
 *
 * A bare trailing word is the weakest position to strip from, because the last
 * word of a title is usually the noun that names the job. So this list is much
 * narrower than QUALIFIERS: only words that are never themselves the craft.
 * "Marketing Communications Intern" is a marketing communications job; "Contract
 * Administrator" and "Support Student" would both be wrecked by the full list,
 * which is why `contract`, `student`, `casual` and the rest stay out of it.
 */
const TRAILING_QUALIFIERS = [
  'intern', 'interns', 'internship', 'internships',
  'trainee', 'cadet', 'apprentice',
];

/** Nothing shorter than this survives as a target role — it means we over-stripped. */
const MIN_KEPT_LENGTH = 3;

/**
 * How many words have to survive the trailing strip.
 *
 * One, deliberately. "Marketing Intern" becomes "Marketing", which is a vaguer
 * seed than we would like and still a far better one than an internship: the
 * rung word is the single thing on a title that actively aims the rebuild at
 * the level the candidate is trying to leave. MIN_KEPT_LENGTH still catches the
 * genuinely destroyed cases ("IT Intern" keeps its rung rather than becoming
 * "IT"), and this is a box they are about to edit either way.
 */
const MIN_KEPT_WORDS = 1;

/**
 * Drop a rung word sitting bare on the end: "Marketing Communications Intern".
 *
 * The bracket and separator passes cannot see this shape — there is no bracket
 * and no separator — and it is the shape that reaches us most often, because it
 * is how the title is actually printed on a resume. Real case, 8 Sep 2026:
 * "Marketing Communications Intern" seeded the target role box verbatim, which
 * aimed the whole rebuild at another internship.
 *
 * Word boundaries do the work on the near-misses. "Internal Communications"
 * ends in "Communications", and "Internal" is never the last word, so neither
 * of the internal-* titles is ever touched.
 */
function stripTrailingQualifier(title: string): string {
  const words = title.split(' ');
  if (words.length <= MIN_KEPT_WORDS) return title;

  const last = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, '');
  if (!TRAILING_QUALIFIERS.includes(last)) return title;

  // Titles ending "... - Intern" have already lost the rung to the segment
  // pass; anything left dangling here is punctuation we should not keep.
  return words.slice(0, -1).join(' ').replace(/[\s,;:|/–—-]+$/, '').trim();
}

function isQualifier(fragment: string): boolean {
  const f = fragment.toLowerCase().replace(/[^a-z\s-]/g, '').trim().replace(/\s+/g, ' ');
  return f.length > 0 && QUALIFIERS.includes(f);
}

/**
 * Turn a current job title into the role to aim at. Returns the input unchanged
 * when there is nothing safe to strip, and '' when the input is empty.
 */
export function targetRoleSeed(currentRole: string | null | undefined): string {
  const original = (currentRole ?? '').trim().replace(/\s+/g, ' ');
  if (!original) return '';

  // Bracketed qualifiers anywhere: "Data Analyst (Intern)", "Analyst [Casual]".
  // A bracket holding anything else ("Analyst (Risk & Compliance)") is content
  // and stays.
  const debracketed = original
    .replace(/[([{]([^)\]}]*)[)\]}]/g, (whole, inner: string) => (isQualifier(inner) ? ' ' : whole))
    .replace(/\s+/g, ' ')
    .trim();

  // Whole segments that are nothing but a qualifier: "Data Analyst - Intern",
  // "Marketing Coordinator / Part-time".
  const segments = debracketed.split(SEPARATOR).map((s) => s.trim()).filter(Boolean);
  const kept = segments.filter((s) => !isQualifier(s));

  // Reassembling a multi-segment title would invent punctuation the candidate
  // did not write, so only a clean single survivor is used.
  const desegmented = kept.length === 1 ? kept[0] : debracketed;

  // Last, because it is the weakest of the three positions: by here the title
  // is a single clean segment, so a rung word on the end really is on the end.
  const out = stripTrailingQualifier(desegmented);

  // Over-stripping would hand them a blank or a fragment. The real title, rung
  // and all, beats that every time.
  return out.length >= MIN_KEPT_LENGTH ? out : original;
}

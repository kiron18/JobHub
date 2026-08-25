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
 * POSITION: inside brackets, or as its own segment after a separator. A leading
 * bare word is left alone even when it is on the list, because "Contract
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

/** Nothing shorter than this survives as a target role — it means we over-stripped. */
const MIN_KEPT_LENGTH = 3;

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
  const out = kept.length === 1 ? kept[0] : debracketed;

  // Over-stripping would hand them a blank or a fragment. The real title, rung
  // and all, beats that every time.
  return out.length >= MIN_KEPT_LENGTH ? out : original;
}

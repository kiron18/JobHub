/**
 * Over-experience, stated not judged.
 *
 * The second instance of the pattern in workRights.ts, and it follows the same
 * rules: read the ad deterministically, return one pre-written passage, never
 * touch the score, never change what the screen tells them to do next.
 *
 * Why it exists. A sixteen-year engineer arriving in Australia gets marked down
 * against a three-year role, and the arithmetic is right: employers do screen
 * those applications out. But the advice that falls out of it ("look for
 * something at your level") is the wrong advice for someone with no local
 * history, because a first Australian role below your level is often exactly
 * how the local history gets started. The report keeps its verdict. This adds
 * the context the verdict cannot see.
 *
 * Two things it is careful about.
 *
 * It never prints the candidate's own years. That figure is derived from parsed
 * resume dates and is good to a year or two, not to the year. The ad's number
 * we read off the ad and can quote. Theirs we describe. Being wrong by two
 * years then costs nothing, where a printed "you have 16 years" that should
 * read 14 makes the whole report look broken.
 *
 * And it stays silent on a hard gate. A graduate program that requires a degree
 * finished in the last two years is not a job you are too good for, it is a job
 * you cannot be hired into. Telling someone to consider stepping down into a
 * locked door costs them the week this product exists to save them.
 */

/**
 * The ad's stated minimum, in years.
 *
 * Ordered longest-first so "3-5 years" is read as a 3 rather than the 5 that a
 * looser pattern would grab from the tail of the range. The minimum is what
 * matters: it is the bar they are asking you to clear.
 */
const YEARS_PATTERNS: RegExp[] = [
  // "3-5 years", "3 to 5 years", "3 – 5 years"
  /\b(\d{1,2})\s*(?:-|–|—|to)\s*\d{1,2}\s*\+?\s*years?\b/i,
  // "minimum 3 years", "at least 3 years", "3+ years", "3 years'"
  /\b(?:minimum|min\.?|at least|no less than)\s+(?:of\s+)?(\d{1,2})\s*\+?\s*years?\b/i,
  /\b(\d{1,2})\s*\+\s*years?\b/i,
  /\b(\d{1,2})\s*years?['’]?\s+(?:of\s+)?(?:relevant\s+|professional\s+|industry\s+|post[- ]?qualification\s+)?experience\b/i,
];

const WRITTEN_YEARS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const WRITTEN_YEARS_PATTERN =
  /\b(?:minimum|min\.?|at least|no less than)?\s*(one|two|three|four|five|six|seven|eight|nine|ten)\s*\+?\s*years?\b/i;

/**
 * The ad is closed to them regardless of how good they are.
 *
 * Every one of these is a rule an employer applies before reading a resume, not
 * a preference they can be talked out of. When one matches, this module says
 * nothing at all.
 */
const HARD_GATE_PATTERNS: RegExp[] = [
  // "Graduate Analyst Program", "Grad Engineering Scheme": the discipline
  // sits between the two words that matter, so the gap has to be allowed.
  /\b(graduate|grad)\s+(?:\w+\s+){0,3}(program(me)?|scheme|intake|pathway)\b/i,
  /\b(recent|new)\s+graduates?\s+(only|program|scheme)\b/i,
  /\bfinal[- ]year\s+students?\b/i,
  /\bdegree\s+(completed|obtained|awarded|finishing|finished)\s+(with)?in\s+the\s+(last|past)\s+\w+\s+years?\b/i,
  /\bgraduat(ed|ing)\s+(with)?in\s+the\s+(last|past)\s+\w+\s+years?\b/i,
  /\bmust\s+have\s+graduated\s+(with)?in\b/i,
  /\bno\s+more\s+than\s+\w+\s+years?\s+(of\s+)?(work\s+)?experience\b/i,
  /\b(internship|cadetship|apprenticeship|traineeship)\b/i,
];

export interface SeniorityNotice {
  /** The pre-written passage, ready to render. */
  sentence: string;
  /** The ad's own stated minimum, for logging and for anyone auditing later. */
  adMinimumYears: number;
}

/**
 * How far past the ad's ask someone has to be before this is worth saying.
 *
 * Both conditions have to hold. The multiple catches the junior end, where
 * three years against a one-year ad is not a story. The flat margin catches the
 * senior end, where twelve against ten is inside the error bars of a figure
 * derived from parsed dates. Deliberately conservative: a banner that fires on
 * a near-miss is worse than one that never fires.
 */
const MIN_MULTIPLE = 2;
const MIN_MARGIN_YEARS = 5;

/** The ad's stated minimum years, or null when it never says. */
export function adMinimumYears(jobText: string): number | null {
  const jd = jobText ?? '';
  if (!jd.trim()) return null;

  for (const pattern of YEARS_PATTERNS) {
    const m = jd.match(pattern);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n < 40) return n;
    }
  }

  const written = jd.match(WRITTEN_YEARS_PATTERN);
  if (written) {
    const n = WRITTEN_YEARS[written[1].toLowerCase()];
    if (n !== undefined) return n;
  }

  return null;
}

/** True when the ad rules them out on career stage rather than on ability. */
export function hasHardGate(jobText: string): boolean {
  const jd = jobText ?? '';
  if (!jd.trim()) return false;
  return HARD_GATE_PATTERNS.some((p) => p.test(jd));
}

/**
 * One passage, or null.
 *
 * Null is the normal answer and every uncertainty resolves to it: no figure on
 * the profile, no figure in the ad, a hard gate, or a margin too narrow to be
 * sure about. The feature's failure mode is not existing.
 */
export function detectSeniorityGap(
  jobText: string,
  candidateYears: number | null | undefined,
): SeniorityNotice | null {
  if (typeof candidateYears !== 'number' || !Number.isFinite(candidateYears)) return null;
  if (hasHardGate(jobText)) return null;

  const asked = adMinimumYears(jobText);
  if (asked === null) return null;

  if (candidateYears < asked * MIN_MULTIPLE) return null;
  if (candidateYears - asked < MIN_MARGIN_YEARS) return null;

  return {
    adMinimumYears: asked,
    sentence:
      `This ad asks for ${asked}+ years and you are well past that. ` +
      'For a first Australian role that is common and usually fine, but expect to be asked why you want it. ' +
      'Have the answer ready: you are here, you want local runs on the board, and you are not treating it as a stopgap.',
  };
}

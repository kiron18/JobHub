/**
 * Work rights, stated not judged.
 *
 * Some ads require Australian citizenship, permanent residency, or full working
 * rights. A resume never states any of those, so the evaluator is explicitly
 * told to ignore the topic (see fitReport.ts) — otherwise a silent resume gets
 * marked down for a "gap" nobody puts on a resume in the first place.
 *
 * That leaves the candidate uninformed, which is its own problem. An
 * international graduate who applies to a citizenship-only job loses a week.
 * So this reads the ad deterministically and returns one plain sentence saying
 * what the ad asks for. No LLM call, no score change, no disqualification. The
 * report shows it; the person decides.
 *
 * Deliberately not a filter. Nothing downstream may branch on this value.
 */

export type WorkRightsKind = 'citizenship' | 'permanent-residency' | 'working-rights' | 'clearance';

interface Rule {
  kind: WorkRightsKind;
  /** What the sentence calls it. */
  phrase: string;
  pattern: RegExp;
}

/**
 * Ordered because the sentence reads in this order. Kept as data so the wording
 * can be tuned without touching the matching, and vice versa.
 */
export const WORK_RIGHTS_RULES: Rule[] = [
  {
    kind: 'citizenship',
    phrase: 'Australian citizenship',
    pattern: /\b(australian citizen(ship)?s?|citizens? of australia|must be an? australian citizen)\b/i,
  },
  {
    kind: 'permanent-residency',
    phrase: 'permanent residency',
    pattern: /\b(permanent residen(t|cy|ts)|\bPR\b(?=[^a-z]*(status|holder|only|required))|australian residen(t|cy|ts))\b/i,
  },
  {
    kind: 'working-rights',
    phrase: 'full working rights in Australia',
    pattern: /\b(full working rights|unrestricted work(ing)? rights|unlimited working rights|full work rights|permanent work(ing)? rights)\b/i,
  },
  {
    kind: 'clearance',
    phrase: 'a government security clearance',
    pattern: /\b(baseline|negative vetting|nv1|nv2|positive vetting|security)\s+clearance\b|\bafp\s+clearance\b/i,
  },
];

/**
 * Sponsorship being ruled out is the same fact from the other side, and ads say
 * it this way often enough to be worth catching on its own.
 */
const NO_SPONSORSHIP = /\b(no|not|unable to|cannot|can't|does not|do not|will not)\b[^.\n]{0,40}\b(sponsor(ship)?|visa sponsor(ship)?|472|482|sponsor(ing)? visas?)\b/i;

export interface WorkRightsNotice {
  /** The pre-written sentence, ready to render. */
  sentence: string;
  /** What matched, for logging and for anyone auditing a report later. */
  kinds: WorkRightsKind[];
  /** True when the ad separately rules out sponsoring a visa. */
  noSponsorship: boolean;
}

function joinPhrases(phrases: string[]): string {
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} or ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(', ')}, or ${phrases[phrases.length - 1]}`;
}

/**
 * One sentence, or null when the ad never raises it.
 *
 * The wording is deliberately flat. It says what the ad asks for and stops.
 * It does not tell them to apply, not to apply, or how to feel about it,
 * because this file has no idea what their status is.
 */
export function detectWorkRights(jobText: string): WorkRightsNotice | null {
  const jd = jobText ?? '';
  if (!jd.trim()) return null;

  const matched = WORK_RIGHTS_RULES.filter((r) => r.pattern.test(jd));
  const noSponsorship = NO_SPONSORSHIP.test(jd);

  if (matched.length === 0 && !noSponsorship) return null;

  const parts: string[] = [];
  if (matched.length > 0) {
    parts.push(`This ad asks for ${joinPhrases(matched.map((r) => r.phrase))}.`);
  }
  if (noSponsorship) {
    parts.push('It also states that visa sponsorship is not available.');
  }

  return {
    sentence: parts.join(' '),
    kinds: matched.map((r) => r.kind),
    noSponsorship,
  };
}

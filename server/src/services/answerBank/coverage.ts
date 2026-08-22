/**
 * What the answers already cover, as opposed to what the resume did.
 *
 * The intake planner reads a resume and decides which themes are unevidenced.
 * That reading is made ONCE, before the candidate has said a word, and it is
 * the reason a plan comes out at twelve questions: every gap gets its own.
 *
 * But a told story is not a resume bullet. One account of a bad week carries
 * failure, pressure, teamwork, change and learning at the same time, because
 * that is how people actually talk. Asking about those four separately, after
 * they have already been described, is how a fifteen minute job becomes an
 * hour, and it is why people stop at question four.
 *
 * So this module re-reads the gap analysis against the BANKED ANSWERS after
 * every confirmation, and marks the questions that no longer have anything to
 * find out. It never deletes a question: `plan` is immutable by design (see
 * routes/answer-bank.ts /start) because renumbering would strand answers on
 * the wrong questions. A covered question is skipped, not removed, and stays
 * reachable if somebody wants to answer it anyway.
 *
 * Scoring is deterministic, no model and no network, for the same reason the
 * interviewer's audit is: an outage must degrade this to "asks more questions
 * than it needed to", never to "decides coverage by guesswork".
 */
import { THEMES, ADDON_THEMES, INDUSTRY_THEMES } from './taxonomy';
import { MIN_WORDS } from './interviewer';

interface RawTheme { id: string; label: string; signals: unknown[]; against?: unknown[] }

/**
 * The bar a theme has to clear to be claimed from an answer the candidate was
 * not asked about. Signals are weighted in taxonomy.ts, decisive phrases at 3
 * and ordinary words at 1, so this is either one phrase that settles it
 * ("went wrong", "cut corners") or three separate ordinary hits.
 *
 * Set deliberately high. The cost of missing a theme is one extra question;
 * the cost of claiming one wrongly is a gap in their bank they never find out
 * about, which surfaces later as a form question they cannot answer.
 */
export const MIN_SIGNAL_SCORE = 3;

/**
 * How people talk when they are TELLING a story, as opposed to being asked for
 * one.
 *
 * taxonomy.ts exists to classify a form's question, and its signals are the
 * vocabulary of questions: "conflict", "adaptability", "attention to detail".
 * Nobody narrating a bad week says any of those words. Run the question
 * signals over a real answer and a story that plainly covers teamwork,
 * learning and a customer scores one apiece, off the bare nouns "team",
 * "learn" and "client", which is under the bar and rightly so.
 *
 * These are the answer-side equivalents. They are kept HERE rather than added
 * to taxonomy.ts on purpose: that table is shared with the extension's form
 * matcher (extension/matcher/matcher.js), and widening it to catch narration
 * would change which stored answer gets picked for a form. Two jobs, two
 * vocabularies, scored together.
 *
 * Like ASK_FREQUENCY in intake.ts these are a considered guess rather than
 * data, and the intake's own captures are what should correct them.
 */
const ANSWER_SIGNALS: Record<string, [string, number][]> = {
  failure: [
    ['my fault', 3], ['i got it wrong', 3], ['i should have', 3], ['i had missed', 3],
    ['i messed', 3], ['went wrong', 3], ['i was wrong', 3], ['put it right', 2],
    ['next time i', 2], ['i apologised', 2], ['i owned', 2],
  ],
  conflict: [
    ['disagreed', 3], ['did not agree', 3], ['pushed back', 3], ['we clashed', 3],
    ['difficult to work with', 3], ['he refused', 2], ['she refused', 2],
    ['they refused', 2], ['saw it differently', 3], ['took it up with', 2],
    ['heated', 2], ['tense', 2],
  ],
  teamwork: [
    ['the team', 2], ['my colleague', 2], ['a colleague', 2], ['the other', 1],
    ['relied on', 3], ['could not have done it', 3], ['between us', 2],
    ['helped me', 2], ['i asked', 1], ['we split', 3], ['we agreed', 2],
    ['handed over', 2], ['my supervisor', 1], ['my manager', 1],
  ],
  customer: [
    ['the customer', 3], ['the client', 2], ['a client', 2], ['the patient', 3],
    ['complained', 3], ['angry', 2], ['upset', 2], ['apologised', 2],
    ['refund', 3], ['she wanted', 1], ['he wanted', 1], ['they wanted', 1],
    ['calmed', 3],
  ],
  leadership: [
    ['i took charge', 3], ['i made the call', 3], ['i decided', 2],
    ['showed them how', 3], ['i trained', 3], ['nobody else', 2],
    ['i stepped in', 3], ['it fell to me', 3], ['i delegated', 3],
  ],
  pressure: [
    ['flat out', 3], ['run off', 3], ['back to back', 3], ['no time', 2],
    ['we were short', 3], ['short staffed', 3], ['understaffed', 3],
    ['the deadline', 2], ['due that', 2], ['ran out of time', 3],
    ['behind', 1], ['stressed', 2], ['peak', 1],
  ],
  initiative: [
    ['nobody asked me', 3], ['off my own', 3], ['i suggested', 3],
    ['i set up', 2], ['i put together', 2], ['i noticed that', 2],
    ['it used to', 2], ['before that we', 2], ['i started doing', 3],
  ],
  learning: [
    ['i had never', 3], ['i did not know how', 3], ['taught myself', 3],
    ['picked it up', 3], ['figured out', 2], ['first time i', 2],
    ['i learned to', 2], ['i learnt to', 2], ['watched how', 2],
    ['no training', 3], ['thrown in', 3],
  ],
  priorities: [
    ['all at once', 3], ['had to drop', 3], ['put off', 2], ['left the', 1],
    ['first thing i did', 2], ['more important', 2], ['what could wait', 3],
    ['too much on', 3], ['juggl', 2],
  ],
  detail: [
    ['i noticed', 2], ['i spotted', 3], ['i double', 3], ['checked it again', 3],
    ['did not add up', 3], ['nobody had picked', 3], ['would have gone out', 3],
    ['i caught', 3], ['typo', 2], ['wrong figure', 3],
  ],
  change: [
    ['changed the', 2], ['changed at', 2], ['plans changed', 3],
    ['last minute', 3], ['short notice', 3], ['fell through', 3],
    ['had to redo', 3], ['started over', 3], ['out of nowhere', 3],
    ['suddenly', 2], ['pulled out', 2],
  ],
  safety: [
    ['i reported', 3], ['unsafe', 3], ['near miss', 3], ['someone could have', 3],
    ['i raised it', 3], ['hazard', 3],
  ],
  procedure: [
    ['the process', 2], ['supposed to', 2], ['cut corners', 3],
    ['signed off', 2], ['the policy', 2], ['skipped the', 3],
  ],
  ethics: [
    ['the right thing', 3], ['nobody would have known', 3], ['i could have', 2],
    ['i told them anyway', 3], ['confidential', 3], ['not honest', 3],
  ],
};

export interface ThemeScore { theme: string; label: string; score: number; hits: string[] }

/** An answer as coverage sees it. */
export interface BankedAnswer {
  questionId: string;
  /** The themes the question was asked about. Covered outright by answering it. */
  themes: string[];
  /** The confirmed text. */
  text: string;
}

export interface CoveredTheme {
  theme: string;
  /** Question ids that covered it by being asked about it. */
  asked: string[];
  /** Question ids whose answer covered it without being asked. */
  volunteered: string[];
}

export type Coverage = Map<string, CoveredTheme>;

// ----------------------------------------------------------------- scoring

const signalCache = new Map<string, RegExp>();

/**
 * Word-prefix match on a boundary, so `learn` catches learned and learning
 * without `lead` matching "misleading". Identical to the extension matcher's
 * rule (extension/matcher/matcher.js) so the two agree about what a theme is.
 */
function signalRegex(signal: string): RegExp {
  let cached = signalCache.get(signal);
  if (!cached) {
    const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    cached = new RegExp(`\\b${escaped}`, 'i');
    signalCache.set(signal, cached);
  }
  return cached;
}

const asPair = (s: unknown): { text: string; weight: number } =>
  Array.isArray(s) ? { text: String(s[0]), weight: Number(s[1]) || 1 } : { text: String(s), weight: 1 };

export function themePool(industry: string | null): RawTheme[] {
  const pool = [...(THEMES as unknown as RawTheme[])];
  const wanted = (INDUSTRY_THEMES as Record<string, string[] | undefined>)[industry || ''] || [];
  for (const theme of ADDON_THEMES as unknown as RawTheme[]) {
    if (wanted.includes(theme.id) && !pool.some((t) => t.id === theme.id)) pool.push(theme);
  }
  return pool;
}

/** Weighted signal scoring over spoken text. Highest first, positives only. */
export function scoreThemes(text: string, industry: string | null = null): ThemeScore[] {
  const normalised = (text || '').toLowerCase();
  const scored: ThemeScore[] = [];

  for (const theme of themePool(industry)) {
    let score = 0;
    const hits: string[] = [];
    for (const raw of theme.signals || []) {
      const { text: signal, weight } = asPair(raw);
      if (signalRegex(signal).test(normalised)) {
        score += weight;
        hits.push(signal);
      }
    }
    for (const [signal, weight] of ANSWER_SIGNALS[theme.id] || []) {
      if (signalRegex(signal).test(normalised)) {
        score += weight;
        hits.push(signal);
      }
    }
    // `against` still subtracts. A story about a proud achievement is not a
    // story about a failure, however many times it says "wrong".
    for (const raw of theme.against || []) {
      const { text: signal, weight } = asPair(raw);
      if (signalRegex(signal).test(normalised)) score -= weight;
    }
    if (score > 0) scored.push({ theme: theme.id, label: theme.label, score, hits });
  }

  return scored.sort((a, b) => b.score - a.score);
}

const wordCount = (text: string) => ((text || '').trim().match(/\S+/g) || []).length;

/**
 * The themes one answer evidences.
 *
 * Its own themes come free: they were asked about and answered. Anything else
 * has to earn it by clearing MIN_SIGNAL_SCORE, and only from an answer with
 * enough words to mean anything. A twelve word reply mentioning "the team"
 * has not covered teamwork, it has mentioned it.
 */
export function themesEvidencedBy(
  answer: BankedAnswer,
  industry: string | null = null,
): { asked: string[]; volunteered: string[] } {
  const asked = (answer.themes || []).filter(Boolean);
  if (wordCount(answer.text) < MIN_WORDS) return { asked, volunteered: [] };

  const volunteered = scoreThemes(answer.text, industry)
    .filter((t) => t.score >= MIN_SIGNAL_SCORE && !asked.includes(t.theme))
    .map((t) => t.theme);

  return { asked, volunteered };
}

/** Fold every banked answer into one picture of what is now covered. */
export function buildCoverage(
  answers: BankedAnswer[],
  industry: string | null = null,
): Coverage {
  const coverage: Coverage = new Map();

  const record = (theme: string, questionId: string, how: 'asked' | 'volunteered') => {
    let row = coverage.get(theme);
    if (!row) {
      row = { theme, asked: [], volunteered: [] };
      coverage.set(theme, row);
    }
    if (!row[how].includes(questionId)) row[how].push(questionId);
  };

  for (const answer of answers) {
    const { asked, volunteered } = themesEvidencedBy(answer, industry);
    for (const theme of asked) record(theme, answer.questionId, 'asked');
    for (const theme of volunteered) record(theme, answer.questionId, 'volunteered');
  }

  return coverage;
}

// -------------------------------------------------------- what is left to ask

export interface RedundancyVerdict {
  redundant: boolean;
  /** The themes that made it redundant, and which answer covered each. */
  by: { theme: string; questionId: string }[];
}

/**
 * Whether a question has nothing left to find out.
 *
 * Three rules, and the second two are what stop this from quietly hollowing
 * out somebody's bank:
 *
 *   1. Every theme it asks about is already covered by ANOTHER answer.
 *   2. A question with no themes is never redundant. It cannot be reasoned
 *      about, so it gets asked.
 *   3. Its own answer never counts. Otherwise answering a question would make
 *      it retrospectively unnecessary, which is nonsense, and would also let
 *      a skipped-then-resumed question mark itself done.
 */
export function isRedundant(
  question: { id: string; themes?: string[] },
  coverage: Coverage,
): RedundancyVerdict {
  const themes = (question.themes || []).filter(Boolean);
  if (!themes.length) return { redundant: false, by: [] };

  const by: { theme: string; questionId: string }[] = [];
  for (const theme of themes) {
    const row = coverage.get(theme);
    const source = [...(row?.asked || []), ...(row?.volunteered || [])]
      .find((id) => id !== question.id);
    if (!source) return { redundant: false, by: [] };
    by.push({ theme, questionId: source });
  }

  return { redundant: true, by };
}

/**
 * How much of the interview is genuinely left.
 *
 * `live` is what the candidate still has to do and is the only number worth
 * showing them. Counting the covered ones back in is how a progress bar ends
 * up saying "4 of 12" to somebody who is actually finished.
 */
export function remainingWork<T extends { id: string; themes?: string[] }>(
  questions: T[],
  coverage: Coverage,
  isAnswered: (q: T) => boolean,
): { live: T[]; covered: T[]; answered: T[] } {
  const live: T[] = [];
  const covered: T[] = [];
  const answered: T[] = [];

  for (const question of questions) {
    if (isAnswered(question)) answered.push(question);
    else if (isRedundant(question, coverage).redundant) covered.push(question);
    else live.push(question);
  }

  return { live, covered, answered };
}

// ------------------------------------------------------------ when it is enough

/**
 * The themes worth having before the bank is usable at all.
 *
 * Without a finishing line an intake runs until the questions run out, which
 * is how a session designed around "answer what we cannot work out ourselves"
 * ends up asking about `change` (asked on roughly four forms in a hundred)
 * with the same weight as `failure` (asked on nearly all of them).
 *
 * These are the themes scoring 8 or more in intake.ts ASK_FREQUENCY, plus
 * whatever the candidate's industry treats as non-negotiable, since a support
 * worker with no safety story has a hole a marketing graduate does not.
 * intake.test.ts asserts this list still matches that table, because the two
 * cannot import each other without a cycle.
 *
 * Everything outside it is real and worth capturing, but it is an extra, and
 * saying so is what lets somebody stop at fifteen minutes without being told
 * they left the job half done.
 */
export const CORE_THEMES = ['failure', 'teamwork', 'pressure', 'customer', 'conflict'];

export interface CoreStatus {
  /** Core themes with a story behind them. */
  covered: string[];
  /** Core themes still missing. These are what is worth asking next. */
  missing: string[];
  /** True once the bank answers the questions forms actually ask. */
  enough: boolean;
}

/** Which of the themes that matter are done, and whether that is all of them. */
export function coreStatus(coverage: Coverage, industry: string | null = null): CoreStatus {
  const industryCore = (INDUSTRY_THEMES as Record<string, string[] | undefined>)[industry || ''] || [];
  const core = [...new Set([...CORE_THEMES, ...industryCore])];

  const covered = core.filter((t) => coverage.has(t));
  const missing = core.filter((t) => !coverage.has(t));

  return { covered, missing, enough: missing.length === 0 };
}

/**
 * Whether a question is an extra rather than part of the job.
 *
 * An optional question is still asked, still answerable, and still worth
 * having. It just does not count towards the number the candidate was
 * promised, and it does not stop the intake being finished.
 */
export function isOptional(
  question: { kind?: string; themes?: string[] },
  industry: string | null = null,
): boolean {
  // The warm-ups are never extras. They are the two easiest questions in the
  // session and they exist to get somebody talking before the hard ones, so
  // presenting them as skippable defeats the point of having them first.
  if (question.kind === 'seed') return false;

  const themes = (question.themes || []).filter(Boolean);
  if (!themes.length) return false;
  const industryCore = (INDUSTRY_THEMES as Record<string, string[] | undefined>)[industry || ''] || [];
  const core = new Set([...CORE_THEMES, ...industryCore]);
  return !themes.some((t) => core.has(t));
}

/**
 * Minutes left, honestly.
 *
 * The planner's original figure was five minutes a question, which produced a
 * sixty minute estimate nobody was ever going to sit through and which was
 * never shown to the candidate anyway. Measured against the audit's own bar
 * (MIN_WORDS, four elements, up to three follow-ups) a told story runs about
 * forty five seconds of talking, half a minute of deciding what to talk about,
 * and one follow-up round. Two and a half minutes, and it is better to say
 * that and be a little over than to say nothing.
 */
export const MINUTES_PER_QUESTION = 2.5;

export const minutesFor = (count: number) => Math.max(1, Math.round(count * MINUTES_PER_QUESTION));

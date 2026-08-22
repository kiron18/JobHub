/**
 * Cleaning a spoken answer, and cutting it to length.
 *
 * Speech transcribes badly: "um", false starts, the same sentence begun three
 * times, tangents that go nowhere. It has to be tidied before it can be pasted
 * into an application. But tidying is the exact point where a language model
 * starts helping, and help here means inventing. It rounds "a couple of
 * hundred" up to "$2,000", it promotes "I helped out" to "I led", it adds the
 * satisfying ending the story did not have.
 *
 * So cleaning here is SUBTRACTIVE ONLY, and that is enforced rather than
 * requested: every content word in the cleaned text must already appear in the
 * spoken text. A model that adds a noun, a number, or a claim fails the check
 * and its output is thrown away.
 *
 * This is the same doctrine as bankEdit.ts, which confines an edit to a single
 * line and verifies it touched nothing else. The reason is the same too: a
 * client already lost a publication to a system that believed its own output.
 * An instruction is a request. A check is a guarantee.
 */

/** Words allowed to appear in the clean text without appearing in the raw. */
const CONNECTIVES = new Set([
  // Speech drops these and writing needs them back. None of them can carry a fact.
  'a', 'an', 'the', 'and', 'but', 'or', 'so', 'then', 'that', 'this', 'these',
  'those', 'it', 'its', 'is', 'was', 'were', 'are', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'did', 'does', 'to', 'of', 'in', 'on', 'at',
  'for', 'with', 'from', 'by', 'as', 'if', 'when', 'while', 'because',
  'which', 'who', 'what', 'i', 'me', 'my', 'we', 'our', 'us', 'they', 'them',
  'their', 'he', 'she', 'him', 'her', 'his', 'you', 'your', 'not', 'no',
  'there', 'here', 'up', 'out', 'about', 'into', 'over', 'after', 'before',
  'would', 'could', 'should', 'will', 'can', 'am', 'more', 'most', 'all',
  'some', 'any', 'one', 'also', 'just', 'very', 'than', 'too', 'own',
]);

const FILLERS = /\b(?:um+|uh+|er+|ah+|like|you know|i mean|sort of|kind of|basically|actually|literally|obviously|right\?|yeah|okay|so yeah)\b/gi;

/**
 * Strips inflection so "checked" and "checking" count as the same word.
 *
 * Plurals are handled before verb endings, and separately, because a blanket
 * "es" rule turns "lines" into "lin" while leaving "line" alone, and the two
 * then read as different words. A stemmer that disagrees with itself raises a
 * fabrication alarm on an honest clean, which trains everyone to click through
 * the alarm, which is worse than having no alarm.
 */
function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9$%]/g, '');
  if (w.length <= 3) return w;

  if (/ies$/.test(w) && w.length > 4) return `${w.slice(0, -3)}y`;
  if (/(?:ss|sh|ch|x|z)es$/.test(w)) w = w.slice(0, -2);
  else if (/[^s]s$/.test(w)) w = w.slice(0, -1);

  for (const suffix of ['ingly', 'edly', 'ing', 'ed', 'ly', 'er']) {
    if (w.length - suffix.length >= 3 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
}

function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'$%.,-]*/gi) || [])
    .map((w) => w.replace(/^[^a-z0-9$]+|[^a-z0-9%]+$/gi, ''))
    .filter(Boolean)
    .filter((w) => !CONNECTIVES.has(w.toLowerCase()));
}

/** Every number in the text, normalised, because a changed number is the worst failure. */
export function numbersIn(text: string): string[] {
  return (text.match(/\$?\d[\d,]*(?:\.\d+)?%?/g) || [])
    .map((n) => n.replace(/,/g, '').replace(/\.0+$/, ''));
}

export interface CleanCheck {
  ok: boolean;
  /** Words in the clean text that were never spoken. */
  invented: string[];
  /** Numbers in the clean text that were never spoken. */
  inventedNumbers: string[];
  /** Clean text longer than the raw, which means it grew rather than tightened. */
  grew: boolean;
  problem?: 'invented_words' | 'invented_numbers' | 'grew' | 'empty' | 'gutted';
}

/**
 * Whether a cleaned answer only removed.
 *
 * Deliberately strict about numbers and lenient about connectives: a candidate
 * whose "$2,000" became "$20,000" is actively harmed by this product, whereas a
 * candidate whose "and then" was tidied into "then" is not.
 */
export function checkSubtractive(raw: string, cleaned: string): CleanCheck {
  const clean = (cleaned || '').trim();
  if (!clean) return { ok: false, invented: [], inventedNumbers: [], grew: false, problem: 'empty' };

  const rawStems = new Set(contentWords(raw).map(stem));
  const invented = [...new Set(
    contentWords(clean).filter((w) => !rawStems.has(stem(w))),
  )];

  const rawNumbers = new Set(numbersIn(raw));
  const inventedNumbers = [...new Set(numbersIn(clean).filter((n) => !rawNumbers.has(n)))];

  const rawWordCount = (raw.trim().match(/\S+/g) || []).length;
  const cleanWordCount = (clean.match(/\S+/g) || []).length;
  // Tidying speech legitimately adds words back: the connectives people drop
  // when talking have to return before it reads as writing. So growth alone is
  // not the signal. Growth of a fifth AND more than six words is, because by
  // then it is not punctuation being restored, it is text being padded. Adding
  // new FACTS is caught above and does not rely on this at all.
  const grew = cleanWordCount > rawWordCount * 1.2 && cleanWordCount > rawWordCount + 6;
  // Cleaning that removes four fifths of the answer has not tidied it, it has
  // summarised it, and the detail that makes a story usable is what went.
  const gutted = cleanWordCount < rawWordCount * 0.2;

  let problem: CleanCheck['problem'];
  if (inventedNumbers.length) problem = 'invented_numbers';
  else if (invented.length) problem = 'invented_words';
  else if (grew) problem = 'grew';
  else if (gutted) problem = 'gutted';

  return { ok: !problem, invented, inventedNumbers, grew, problem };
}

/**
 * A first pass with no model in it at all.
 *
 * Most of what makes a transcript unreadable is mechanical, and removing it
 * mechanically means the model has less to do and fewer chances to embellish.
 * If the model is unavailable this is what the candidate sees, and it is
 * genuinely usable.
 */
export function stripFillers(text: string): string {
  return (text || '')
    .replace(FILLERS, ' ')
    // "I went, I went back" -> "I went back"
    .replace(/\b(\w+(?:\s+\w+){0,2}),?\s+\1\b/gi, '$1')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,.!?;:])\1+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*[,.;:]\s*/, '')
    .trim();
}

export const CLEAN_PROMPT = [
  'You are tidying a transcript of somebody speaking about their own work experience, so they can paste it into a job application.',
  '',
  'Remove ONLY:',
  '- filler words and verbal tics',
  '- false starts and repeated phrases',
  '- tangents that are not part of the story',
  '',
  'You MUST NOT:',
  '- add any fact, name, number, date, job title or outcome that is not already in the transcript',
  '- change any number, however obviously wrong it looks',
  '- make a claim stronger (if they said "helped with", it stays "helped with", never "led")',
  '- add a conclusion, a lesson, or a tidy ending they did not say',
  '- change their vocabulary to more formal words',
  '',
  'Keep their voice. It should read like them on a good day, not like a consultant.',
  'Use ordinary punctuation and paragraph breaks. Fix obvious transcription errors in ordinary words only.',
  '',
  'Return only the tidied text.',
].join('\n');

// ------------------------------------------------------------------ variants

export type VariantName = 'headline' | 'short' | 'medium' | 'full';

/** Roughly what each length is for, and the word budget a form implies. */
export const VARIANT_SPEC: Record<VariantName, { words: number; purpose: string }> = {
  headline: { words: 25, purpose: 'a one-line answer, or the opening line of a longer one' },
  short: { words: 80, purpose: 'a small text box, or a 100 word limit' },
  medium: { words: 180, purpose: 'the usual open-ended application question' },
  full: { words: 400, purpose: 'a generous box, or saying it out loud in an interview' },
};

export function buildVariantPrompt(approved: string, name: VariantName): string {
  const spec = VARIANT_SPEC[name];
  return [
    `Cut the following account down to about ${spec.words} words, for ${spec.purpose}.`,
    '',
    'Rules, all of them absolute:',
    '- Use only what is in the text below. Add nothing.',
    '- Do not add a fact, number, name or outcome that is not already there.',
    '- Do not make any claim stronger than it is written.',
    '- Keep the first person and keep their voice.',
    '- If something has to go, drop background detail before dropping what they did.',
    '',
    'The account:',
    '"""',
    approved,
    '"""',
    '',
    'Return only the shortened text.',
  ].join('\n');
}

/**
 * A variant is checked the same way as a clean, minus the length rules, since
 * a variant is supposed to be much shorter than its source.
 */
export function checkVariant(approved: string, variant: string): CleanCheck {
  const result = checkSubtractive(approved, variant);
  if (result.problem === 'gutted' || result.problem === 'grew') {
    return { ...result, ok: result.invented.length === 0 && result.inventedNumbers.length === 0, problem: undefined };
  }
  return result;
}

// Years claim detector: pure detection, no mutation.
// Violations trigger regeneration via analysisContext.regenerateFeedback.

const WRITTEN_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12,
};

export interface YearsClaimDetection {
  found: boolean;
  value: number | null;
  violates: boolean;
  matches: Array<{
    phrase: string;
    value: number;
    start: number;
    end: number;
  }>;
}

/**
 * Detect year claims in text. Pure detection — never mutates.
 * A claim VIOLATES when:
 * - storedYears is null/<2 and any number is present
 * - storedYears is set and the stated number != storedYears
 */
export function detectYearsClaim(text: string, storedYears: number | null): YearsClaimDetection {
  if (!text || typeof text !== 'string') {
    return { found: false, value: null, violates: false, matches: [] };
  }

  const matches: Array<{ phrase: string; value: number; start: number; end: number }> = [];

  // Pattern 1: digit + years (e.g., "5 years", "5+ years", "over 5 years")
  const digitPattern = /(\b(?:over|more than|less than|nearly|almost|about|around|approximately)\s+)?(\d{1,2})\s*\+?\s*years?\b/gi;

  // Pattern 2: written number + years (e.g., "five years", "over ten years")
  const writtenPattern = new RegExp(
    `\\b(over|more than|less than|nearly|almost|about|around|approximately\\s+)?(${Object.keys(WRITTEN_NUMBERS).join('|')})\\s*years?\\b`,
    'gi'
  );

  let m: RegExpExecArray | null;

  // Find digit matches
  while ((m = digitPattern.exec(text)) !== null) {
    const fullMatch = m[0];
    const numStr = m[2];
    const value = parseInt(numStr, 10);
    matches.push({
      phrase: fullMatch,
      value,
      start: m.index,
      end: m.index + fullMatch.length,
    });
  }

  // Find written matches
  while ((m = writtenPattern.exec(text)) !== null) {
    const fullMatch = m[0];
    const numWord = m[2].toLowerCase();
    const value = WRITTEN_NUMBERS[numWord];
    if (value !== undefined) {
      matches.push({
        phrase: fullMatch,
        value,
        start: m.index,
        end: m.index + fullMatch.length,
      });
    }
  }

  if (matches.length === 0) {
    return { found: false, value: null, violates: false, matches: [] };
  }

  // Determine if any match violates the storedYears constraint
  let violates = false;

  if (storedYears === null || storedYears < 2) {
    // Any year claim is a violation when we don't have validated years
    violates = matches.length > 0;
  } else {
    // Violation if any stated number != storedYears
    violates = matches.some(m => m.value !== storedYears);
  }

  // Return the first violating value (for feedback), or first match if none violate
  const representativeValue = violates
    ? matches.find(m => storedYears === null || storedYears < 2 || m.value !== storedYears)?.value ?? matches[0].value
    : matches[0].value;

  return {
    found: true,
    value: representativeValue,
    violates,
    matches,
  };
}

/**
 * Get the Claude-owned regeneration feedback instruction.
 * Paste verbatim per plan specification.
 */
export function getYearsFeedbackInstruction(storedYears: number | null): string {
  if (storedYears === null || storedYears < 2) {
    // COPY: Claude-owned — do not modify
    return 'Do not state any number of years of professional experience anywhere in the document. Lead with the qualification and the nature of the experience instead.';
  } else {
    // COPY: Claude-owned — do not modify
    return `State the candidate's professional experience as exactly ${storedYears} years wherever length of experience is mentioned. Do not state any other figure.`;
  }
}

/**
 * Remove complete sentence(s) containing year claims.
 * Last resort only — removes entire sentences, never blanks phrases.
 */
export function removeSentencesWithYears(text: string): string {
  // Split into sentences (rough approximation)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  const kept: string[] = [];

  for (const sentence of sentences) {
    // Check if this sentence contains a year claim
    const digitMatch = /\b\d{1,2}\s*\+?\s*years?\b/i.test(sentence);
    const writtenMatch = new RegExp(`\\b(${Object.keys(WRITTEN_NUMBERS).join('|')})\\s*years?\\b`, 'i').test(sentence);

    if (!digitMatch && !writtenMatch) {
      kept.push(sentence);
    }
  }

  return kept.join(' ').trim();
}

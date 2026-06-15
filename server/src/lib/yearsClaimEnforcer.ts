// Years claim enforcer: backstop to ensure generated content states correct years figure.

const WRITTEN_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12,
};

interface YearsEnforcerResult {
  text: string;
  changed: boolean;
}

/**
 * Detect year claims in text and enforce they match the stored years value.
 * - If storedYears is null or < 2: remove the smallest phrase carrying any year number
 * - If storedYears is set: any stated number must equal it; otherwise rewrite to storedYears
 */
export function enforceYearsClaim(text: string, storedYears: number | null): YearsEnforcerResult {
  if (!text || typeof text !== 'string') {
    return { text: text || '', changed: false };
  }

  let changed = false;
  let result = text;

  // Pattern 1: digit + years (e.g., "5 years", "5+ years", "over 5 years")
  const digitPattern = /(\b(?:over|more than|less than|nearly|almost|about|around|approximately)\s+)?(\d{1,2})\s*\+?\s*years?\b/gi;

  // Pattern 2: written number + years (e.g., "five years", "over ten years")
  const writtenPattern = new RegExp(
    `\\b(over|more than|less than|nearly|almost|about|around|approximately\\s+)?(${Object.keys(WRITTEN_NUMBERS).join('|')})\\s*years?\\b`,
    'gi'
  );

  // Collect all matches to determine what to do
  const matches: Array<{ start: number; end: number; value: number; fullMatch: string; type: 'digit' | 'written' }> = [];

  let m: RegExpExecArray | null;

  // Find digit matches
  while ((m = digitPattern.exec(text)) !== null) {
    const fullMatch = m[0];
    const numStr = m[2];
    const value = parseInt(numStr, 10);
    matches.push({
      start: m.index,
      end: m.index + fullMatch.length,
      value,
      fullMatch,
      type: 'digit',
    });
  }

  // Find written matches
  while ((m = writtenPattern.exec(text)) !== null) {
    const fullMatch = m[0];
    const numWord = m[2].toLowerCase();
    const value = WRITTEN_NUMBERS[numWord];
    if (value !== undefined) {
      matches.push({
        start: m.index,
        end: m.index + fullMatch.length,
        value,
        fullMatch,
        type: 'written',
      });
    }
  }

  if (matches.length === 0) {
    return { text, changed: false };
  }

  // Sort by position (descending) so we can modify from end to start without affecting indices
  matches.sort((a, b) => b.start - a.start);

  if (storedYears === null || storedYears < 2) {
    // Remove the smallest phrase carrying the number (the entire match)
    // COPY: pending Claude — determine exact replacement text for removal case
    for (const match of matches) {
      // Remove the year claim phrase entirely
      const before = result.slice(0, match.start).trimEnd();
      const after = result.slice(match.end).trimStart();

      // Handle punctuation: if before ends with comma and after starts with lowercase,
      // or if there's awkward punctuation, clean it up
      result = before;
      if (after) {
        // Add space if needed
        if (before && !/[\s.,;:!?]$/.test(before) && !after.match(/^[\s.,;:!?]/)) {
          result += ' ';
        }
        result += after;
      }
      changed = true;
    }
  } else {
    // Rewrite any mismatched number to storedYears
    for (const match of matches) {
      if (match.value !== storedYears) {
        // Rewrite the number while preserving the surrounding phrase structure
        // COPY: pending Claude — determine exact replacement text for rewrite case
        const replacement = `${storedYears} years`;
        result = result.slice(0, match.start) + replacement + result.slice(match.end);
        changed = true;
      }
    }
  }

  // Clean up any double spaces or awkward punctuation left behind
  result = result
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s+\./g, '.')
    .trim();

  return { text: result, changed };
}

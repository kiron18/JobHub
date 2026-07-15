// Style lint for generated documents — Phase 2
// Checks em dashes, banned phrases, and cover letter word count

export interface StyleViolation {
  type: 'em-dash' | 'banned-phrase' | 'word-count';
  message: string;
}

// Banned phrases from the prompts (clichés to avoid)
const BANNED_PHRASES = [
  // From resume prompt
  'results-driven',
  'passionate',
  'dynamic',
  'proven track record',
  'leverage',
  'spearheaded',
  'synergy',
  // From cover letter prompt
  'align with your values',
  'I believe I would be a great fit',
  // Variants
  'result driven',
  'proven trackrecord',
  'track record',
  'team player',
  'detail-oriented',
  'detail oriented',
];

/**
 * Count em dashes (U+2014) in text.
 * The prompt bans em dashes — use " - " instead.
 */
function countEmDashes(text: string): number {
  const emDashPattern = /[—]/g;
  const matches = text.match(emDashPattern);
  return matches ? matches.length : 0;
}

/**
 * Check for banned phrases (case-insensitive).
 */
function checkBannedPhrases(text: string): StyleViolation[] {
  const violations: StyleViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    // Use word boundaries for multi-word phrases
    const pattern = phrase.includes(' ')
      ? new RegExp(phrase.replace(/\s+/g, '\\s+'), 'gi')
      : new RegExp(`\\b${phrase}\\b`, 'gi');

    const matches = text.match(pattern);
    if (matches) {
      violations.push({
        type: 'banned-phrase',
        message: `Banned phrase "${phrase}" appears ${matches.length} time(s)`,
      });
    }
  }

  return violations;
}

/**
 * Check cover letter word count.
 * Expected: 400-500 words per the prompt.
 */
function checkWordCount(text: string, minWords = 400, maxWords = 500): StyleViolation | null {
  // Count words (split on whitespace)
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const count = words.length;

  if (count < minWords) {
    return {
      type: 'word-count',
      message: `Word count ${count} is below minimum ${minWords}`,
    };
  }

  if (count > maxWords) {
    return {
      type: 'word-count',
      message: `Word count ${count} exceeds maximum ${maxWords}`,
    };
  }

  return null;
}

export interface StyleCheckResult {
  violations: StyleViolation[];
  emDashCount: number;
  wordCount: number;
}

/**
 * Check document style for violations.
 *
 * @param text The document content to check
 * @param isCoverLetter Whether this is a cover letter (triggers word count check)
 * @returns StyleCheckResult with all violations found
 */
export function checkStyle(
  text: string,
  isCoverLetter = false,
): StyleCheckResult {
  const violations: StyleViolation[] = [];

  // Check em dashes
  const emDashCount = countEmDashes(text);
  if (emDashCount > 0) {
    violations.push({
      type: 'em-dash',
      message: `Contains ${emDashCount} em dash(es) — use " - " instead`,
    });
  }

  // Check banned phrases
  const bannedViolations = checkBannedPhrases(text);
  violations.push(...bannedViolations);

  // Check word count for cover letters
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  if (isCoverLetter) {
    const wordCountViolation = checkWordCount(text);
    if (wordCountViolation) {
      violations.push(wordCountViolation);
    }
  }

  return {
    violations,
    emDashCount,
    wordCount,
  };
}

/**
 * Convert style violations to strings for the retry mechanism.
 * These feed into the same violation comparison as grounding errors.
 */
export function formatStyleViolationsForRetry(violations: StyleViolation[]): string[] {
  return violations.map(v => `[STYLE] ${v.message}`);
}

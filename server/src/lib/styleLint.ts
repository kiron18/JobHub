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
  // From SlopMonster (github.com/ItsssssJack/SlopMonster, MIT), added 30 Oct
  // 2026: its marketing vocabulary, cut to the words that never belong in a
  // resume or a letter. Left out on purpose: anything that can be an employer
  // or product name (Elevate, Beacon, Empower, Holistic), because a retry told
  // to drop the word could drop a real job with it, and plain resume verbs
  // (streamline, foster, showcase, innovate) that read fine in a bullet.
  'delve',
  'delves',
  'delved',
  'seamless',
  'seamlessly',
  'unparalleled',
  'game-changer',
  'game-changing',
  'cutting-edge',
  'state-of-the-art',
  'meticulous',
  'meticulously',
  'unleash',
  'supercharge',
  'revolutionise',
  'revolutionize',
  'tapestry',
  'ever-evolving',
];

/**
 * Sentence shapes, also from SlopMonster. These are constructions rather than
 * words, so they cannot be a name, and they are the loudest tell a reader has:
 * "not just X, but Y" reads as a machine in any document.
 */
const BANNED_PATTERNS: Array<[RegExp, string]> = [
  [/(?:\bnot|n['’]t)\s+(?:just|only|merely|simply)\b[^.!?]{0,80}\bbut\b/gi, "the 'not just X, but Y' construction"],
  [/\bwhether you(?:['’]?re| are)\b[^.!?]{0,40}\bor\b/gi, "the 'whether you're X or Y' opener"],
  [/\bmore than just\b/gi, "'more than just'"],
  [/\b(?:that|this)(?:['’]?s| is) where\b[^.!?]{0,30}\bcomes? in\b/gi, "'that's where X comes in'"],
  [/\bin today['’]s\b/gi, "'in today's...' opener"],
  [/\bfast-paced\b/gi, "'fast-paced'"],
  [/\bwhen it comes to\b/gi, "'when it comes to' filler"],
  [/\bat the end of the day\b/gi, "'at the end of the day'"],
  [/\b(?:may|could) potentially\b|\bmight possibly\b/gi, 'stacked hedging'],
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
 * Replace em dashes with the spaced hyphen the prompt asks for.
 *
 * This is the deterministic half of the em dash rule. The rule below still
 * stands and still fires - this just stops us paying for a full LLM retry to
 * perform a one-character substitution. The em dash usually is not even the
 * model's invention: it arrives in the job ad's own title line, gets copied
 * into the header correctly, and then trips the gate.
 */
export function normalizeEmDashes(text: string): string {
  return text
    .replace(/\s*—\s*/g, ' - ')
    .replace(/ +$/gm, '');
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

  for (const [pattern, label] of BANNED_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      violations.push({
        type: 'banned-phrase',
        message: `Reads as AI-written: ${label} appears ${matches.length} time(s). Say it plainly instead`,
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

// Employer grounding check for generated cover letters — report only.
// Flags capitalized multi-word employer-like phrases whose tokens are absent
// from the grounded employer set.

import { normalizeForMatch } from './fidelityGuard';

interface EmployerGroundingResult {
  flagged: Array<{
    phrase: string;
    reason: string;
  }>;
}

/**
 * Extract grounded employer set from profile's structured experience.
 * Returns normalized tokens for matching.
 */
function extractGroundedEmployers(profile: any): Set<string> {
  const employers = new Set<string>();

  if (profile?.experience && Array.isArray(profile.experience)) {
    for (const exp of profile.experience) {
      if (exp.company && typeof exp.company === 'string') {
        const normalized = normalizeForMatch(exp.company);
        // Add all significant tokens (>2 chars, not stopwords)
        const tokens = normalized.split(' ').filter(t => t.length > 2);
        for (const t of tokens) {
          employers.add(t);
        }
      }
    }
  }

  return employers;
}

/**
 * Find capitalized multi-word phrases in text that look like employer names
 * but whose tokens are not in the grounded employer set.
 *
 * This is REPORT ONLY — it logs findings but does not modify the text.
 * STOP and report the flag list before any auto-removal.
 */
export function checkEmployerGrounding(text: string, profile: any): EmployerGroundingResult {
  const flagged: Array<{ phrase: string; reason: string }> = [];

  if (!text || typeof text !== 'string') {
    return { flagged };
  }

  const groundedEmployers = extractGroundedEmployers(profile);

  // Pattern: Capitalized multi-word sequences (2-4 words) that look like names
  // Avoids common false positives like "I", "The Job", "My Experience"
  const capitalizedPhrasePattern = /\b([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){1,3})\b/g;

  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = capitalizedPhrasePattern.exec(text)) !== null) {
    const phrase = match[0];

    // Skip if already seen
    if (seen.has(phrase)) continue;
    seen.add(phrase);

    // Skip common false positives
    const falsePositives = [
      'I Am', 'I Have', 'I Will', 'My Experience', 'The Job',
      'The Role', 'The Company', 'This Position', 'Your Organization',
      'My Career', 'The Industry', 'My Skills', 'The Team',
      'Best Regards', 'Yours Sincerely', 'Kind Regards',
    ];
    if (falsePositives.some(fp => phrase.toLowerCase() === fp.toLowerCase())) {
      continue;
    }

    // Normalize the phrase and check tokens against grounded employers
    const normalizedPhrase = normalizeForMatch(phrase);
    const tokens = normalizedPhrase.split(' ').filter(t => t.length > 2);

    // If no significant tokens, skip
    if (tokens.length === 0) continue;

    // Check if ANY token from this phrase is in the grounded set
    const hasGroundedToken = tokens.some(t => groundedEmployers.has(t));

    if (!hasGroundedToken) {
      flagged.push({
        phrase,
        reason: `No tokens from "${phrase}" found in grounded employer set [${Array.from(groundedEmployers).slice(0, 5).join(', ')}${groundedEmployers.size > 5 ? '...' : ''}]`,
      });
    }
  }

  return { flagged };
}

/**
 * Log employer grounding check results.
 * Call this after generating cover letter content.
 */
export function logEmployerGroundingCheck(text: string, profile: any, context: string): void {
  const result = checkEmployerGrounding(text, profile);

  if (result.flagged.length > 0) {
    console.warn(`[EmployerGrounding] ${context}: Found ${result.flagged.length} ungrounded employer-like phrases:`);
    for (const item of result.flagged) {
      console.warn(`  - "${item.phrase}": ${item.reason}`);
    }
  } else {
    console.log(`[EmployerGrounding] ${context}: All employer-like phrases grounded ✓`);
  }
}

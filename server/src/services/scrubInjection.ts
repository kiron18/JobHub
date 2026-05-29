/**
 * scrubInjection — strips known prompt-injection patterns from job description text.
 *
 * For each matched pattern, the entire containing sentence is removed.
 * Returns the scrubbed text and a list of patterns that were flagged.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /respond\s+with\s+the\s+word/i,
  /say\s+the\s+word/i,
  /include\s+the\s+word/i,
  /ignore\s+previous\s+instructions/i,
  /ignore\s+all\s+prior/i,
  /disregard\s+the\s+above/i,
  /you\s+are\s+now/i,
  /act\s+as/i,
  /pretend\s+to\s+be/i,
  /print\s+the\s+following/i,
  /output\s+exactly/i,
  /<system>/i,
  /<\/system>/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
];

export interface ScrubResult {
  scrubbed: string;
  flagged: string[];
}

export function scrubInjection(text: string): ScrubResult {
  const flagged: string[] = [];
  let scrubbed = text;

  for (const pattern of INJECTION_PATTERNS) {
    const match = scrubbed.match(pattern);
    if (match) {
      flagged.push(match[0].trim());
      // Remove the entire sentence containing the match
      scrubbed = scrubbed.replace(
        new RegExp(`[^.!?]*${pattern.source}[^.!?]*[.!?]`, 'gi'),
        '',
      ).trim();
    }
  }

  // Clean up whitespace
  scrubbed = scrubbed.replace(/  +/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  if (flagged.length > 0) {
    console.log(`[scrubInjection] flagged: ${flagged.join(', ')}`);
  }

  return { scrubbed, flagged };
}

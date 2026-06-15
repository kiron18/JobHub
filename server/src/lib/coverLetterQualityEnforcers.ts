import { enforceFirstPersonSummary, scrubAITells, scrubBannedPhrases } from './voiceEnforcer';
import { tagAIRewrites } from './provenanceTagging';
import { displayName } from './nameUtils';
import type { CoverLetterData } from './coverLetterData';

export interface CoverLetterEnforcerOptions {
  candidateName?: string | null;
}

function applyScrubAITells(text: string | undefined): string | undefined {
  if (!text) return text;
  return scrubAITells(text).scrubbed;
}

function applyScrubBannedPhrases(text: string | undefined): string | undefined {
  if (!text) return text;
  return scrubBannedPhrases(text).scrubbed;
}

// Common abbreviations that legitimately end with a period mid-sentence — the word
// after them must NOT be capitalised.
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'etc', 'vs', 'mr', 'mrs', 'ms', 'dr', 'jr', 'sr', 'inc', 'ltd', 'co', 'st', 'no', 'approx', 'dept']);

/**
 * Deterministic sentence-case repair. Llama 70B occasionally ends a paragraph with
 * a lowercase fragment ("...compliance programs. leverage my skills..."), which
 * reads as broken. Capitalise the first letter of the text and of any sentence
 * that begins after terminal punctuation, guarding common abbreviations and
 * decimals (which never have a space after the period).
 */
function fixSentenceCase(text: string | undefined): string | undefined {
  if (!text) return text;
  let out = text.replace(/^(\s*)([a-z])/, (_m, ws: string, ch: string) => ws + ch.toUpperCase());
  out = out.replace(/([.?!])(\s+)([a-z])/g, (match: string, punct: string, ws: string, ch: string, offset: number, full: string) => {
    const preceding = full.slice(0, offset).match(/([A-Za-z.]+)$/)?.[1]?.toLowerCase().replace(/\.$/, '') ?? '';
    if (ABBREVIATIONS.has(preceding)) return match;
    return punct + ws + ch.toUpperCase();
  });
  return out;
}

/**
 * Replace the name line of the signoff with the preferred display name (first +
 * last), so a long legal name like "Pawan Kanthaka Lokugan Hewage" signs off as
 * "Pawan Hewage". The name is the last non-empty line of the signoff block.
 */
function fixSignoffName(signoff: string, fullName: string | null | undefined): string {
  const display = displayName(fullName);
  if (!display) return signoff;
  const lines = signoff.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) { lines[i] = display; break; }
  }
  return lines.join('\n');
}

export function enforceCoverLetterQuality(
  data: CoverLetterData,
  opts: CoverLetterEnforcerOptions
): CoverLetterData {
  return {
    salutation: data.salutation,
    p1: fixSentenceCase(applyScrubBannedPhrases(applyScrubAITells(data.p1))) ?? data.p1,
    p2: fixSentenceCase(applyScrubBannedPhrases(applyScrubAITells(data.p2))) ?? data.p2,
    p3: fixSentenceCase(applyScrubBannedPhrases(applyScrubAITells(data.p3))) ?? data.p3,
    p4: fixSentenceCase(applyScrubBannedPhrases(applyScrubAITells(data.p4))) ?? data.p4,
    signoff: fixSignoffName(data.signoff, opts.candidateName),
  };
}

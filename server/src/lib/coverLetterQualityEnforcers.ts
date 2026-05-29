import { enforceFirstPersonSummary, scrubAITells, scrubBannedPhrases } from './voiceEnforcer';
import { tagAIRewrites } from './provenanceTagging';
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

export function enforceCoverLetterQuality(
  data: CoverLetterData,
  opts: CoverLetterEnforcerOptions
): CoverLetterData {
  return {
    salutation: data.salutation,
    p1: applyScrubBannedPhrases(applyScrubAITells(data.p1)) ?? data.p1,
    p2: applyScrubBannedPhrases(applyScrubAITells(data.p2)) ?? data.p2,
    p3: applyScrubBannedPhrases(applyScrubAITells(data.p3)) ?? data.p3,
    p4: applyScrubBannedPhrases(applyScrubAITells(data.p4)) ?? data.p4,
    signoff: data.signoff,
  };
}

// Pure, deterministic visa-sponsorship classification. No LLM, no network, no prisma.
import type { RawJob } from './jobFeed';

// Legal-entity suffix tokens stripped from BOTH job company names and registry names
// so "Acme Pty Ltd" matches registry "Acme". Conservative on purpose — descriptive
// words (Group, Services, Australia) are kept to avoid false-positive merges.
const LEGAL_SUFFIX_TOKENS = new Set([
  'pty', 'ltd', 'limited', 'inc', 'incorporated', 'llc', 'llp', 'co', 'corp', 'corporation',
]);

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCompany(input: string): string {
  const tokens = normalizeText(input).split(' ').filter(Boolean);
  return tokens.filter(t => !LEGAL_SUFFIX_TOKENS.has(t)).join(' ');
}

export type SponsorIndex = Map<string, string>; // normalizedCompany -> original cleanName

export type SponsorConfidence =
  | 'confirmed' | 'likely' | 'keyword_only' | 'excluded' | 'none';

export interface PhraseConfig {
  positive: string[];
  negation: string[];
}

export interface SponsorClassification {
  confidence: SponsorConfidence;
  employerMatched: boolean;
  sponsorCleanName: string | null;
  normalizedCompany: string;
  positivePhraseHit: boolean;
  negationPhraseHit: boolean;
  matchedPhrases: string[];
}

export function buildSponsorIndex(cleanNames: string[]): SponsorIndex {
  const idx: SponsorIndex = new Map();
  for (const name of cleanNames) {
    const norm = normalizeCompany(name);
    if (norm && !idx.has(norm)) idx.set(norm, name);
  }
  return idx;
}

export function classifyJob(
  job: RawJob,
  index: SponsorIndex,
  phrases: PhraseConfig,
): SponsorClassification {
  const normalizedCompany = normalizeCompany(job.company);
  const sponsorCleanName = index.get(normalizedCompany) ?? null;
  const employerMatched = sponsorCleanName !== null;

  const normDesc = normalizeText(job.description);
  const matchedNeg = phrases.negation.filter(p => normDesc.includes(normalizeText(p)));
  const matchedPos = phrases.positive.filter(p => normDesc.includes(normalizeText(p)));
  const negationPhraseHit = matchedNeg.length > 0;
  const positivePhraseHit = matchedPos.length > 0;

  let confidence: SponsorConfidence;
  if (negationPhraseHit) confidence = 'excluded';
  else if (employerMatched && positivePhraseHit) confidence = 'confirmed';
  else if (employerMatched) confidence = 'likely';
  else if (positivePhraseHit) confidence = 'keyword_only';
  else confidence = 'none';

  return {
    confidence,
    employerMatched,
    sponsorCleanName,
    normalizedCompany,
    positivePhraseHit,
    negationPhraseHit,
    matchedPhrases: [...matchedPos, ...matchedNeg],
  };
}

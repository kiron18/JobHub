// Pure, deterministic visa-sponsorship classification. No LLM, no network, no prisma.

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

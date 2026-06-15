import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeCompany } from './sponsorClassifier';

describe('normalizeText', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeText('Visa  Sponsorship-Available!')).toBe('visa sponsorship available');
  });
});

describe('normalizeCompany', () => {
  it('strips legal-entity suffix tokens', () => {
    expect(normalizeCompany('Acme Pty Ltd')).toBe('acme');
    expect(normalizeCompany('Globex Corporation')).toBe('globex');
  });
  it('keeps descriptive words (no over-stripping)', () => {
    expect(normalizeCompany('Sydney Water Group')).toBe('sydney water group');
  });
});

import { buildSponsorIndex, classifyJob } from './sponsorClassifier';
import type { RawJob } from './jobFeed';

const PHRASES = {
  positive: ['visa sponsorship available', 'sponsorship available', 'willing to sponsor'],
  negation: ['no sponsorship', 'no sponsorship available', 'must have full working rights'],
};

function job(partial: Partial<RawJob>): RawJob {
  return {
    title: 'Engineer', company: 'Acme Pty Ltd', location: 'Sydney NSW',
    salary: null, description: '', sourceUrl: 'https://au.seek.com/job/1',
    sourcePlatform: 'seek', postedAt: null, ...partial,
  };
}

describe('buildSponsorIndex', () => {
  it('maps normalized company name to original cleanName', () => {
    const idx = buildSponsorIndex(['Acme', 'Globex']);
    expect(idx.get('acme')).toBe('Acme');
  });
});

describe('classifyJob', () => {
  const idx = buildSponsorIndex(['Acme', 'Globex']);

  it('confirmed: registry employer + positive phrase, no negation', () => {
    const r = classifyJob(job({ company: 'Acme Pty Ltd', description: 'Visa sponsorship available for this role.' }), idx, PHRASES);
    expect(r.confidence).toBe('confirmed');
    expect(r.employerMatched).toBe(true);
    expect(r.sponsorCleanName).toBe('Acme');
  });

  it('likely: registry employer, no phrase, no negation', () => {
    const r = classifyJob(job({ company: 'Globex Pty Ltd', description: 'Great team, flexible hours.' }), idx, PHRASES);
    expect(r.confidence).toBe('likely');
  });

  it('keyword_only: not in registry, positive phrase present', () => {
    const r = classifyJob(job({ company: 'Unknown Co', description: 'We are willing to sponsor the right person.' }), idx, PHRASES);
    expect(r.confidence).toBe('keyword_only');
    expect(r.employerMatched).toBe(false);
  });

  it('excluded: negation wins even when employer is a registered sponsor', () => {
    const r = classifyJob(job({ company: 'Acme Pty Ltd', description: 'Sponsorship available? No — must have full working rights.' }), idx, PHRASES);
    expect(r.confidence).toBe('excluded');
    expect(r.negationPhraseHit).toBe(true);
  });

  it('none: not in registry, no phrases', () => {
    const r = classifyJob(job({ company: 'Unknown Co', description: 'Standard role, apply within.' }), idx, PHRASES);
    expect(r.confidence).toBe('none');
  });
});

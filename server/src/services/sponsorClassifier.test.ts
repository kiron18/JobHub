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

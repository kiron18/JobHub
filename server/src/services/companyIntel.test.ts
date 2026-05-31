import { describe, it, expect } from 'vitest';
import { salutationTitle } from './companyIntel';

describe('salutationTitle', () => {
  it('strips a trailing parenthetical', () => {
    expect(salutationTitle('Head of Marketing (National Partnership Office, Surry Hills)'))
      .toBe('Head of Marketing');
  });
  it('collapses "X or Y" to the first option', () => {
    expect(salutationTitle('Head of Marketing or Marketing Manager')).toBe('Head of Marketing');
  });
  it('handles both together', () => {
    expect(salutationTitle('Marketing Manager or Head of Marketing ANZ (Sydney)'))
      .toBe('Marketing Manager');
  });
  it('returns null for empty/undefined', () => {
    expect(salutationTitle('')).toBeNull();
    expect(salutationTitle(undefined)).toBeNull();
    expect(salutationTitle(null)).toBeNull();
  });
  it('passes a clean title through', () => {
    expect(salutationTitle('Hiring Manager')).toBe('Hiring Manager');
  });
});

import { describe, it, expect } from 'vitest';
import { locationKey } from './locationKey';

describe('locationKey', () => {
  it('keys on the full normalised city + state (no state collapse)', () => {
    // Different cities in the same state must produce DIFFERENT keys so a
    // Newcastle search never reuses Sydney's cached jobs.
    expect(locationKey('Newcastle, NSW')).toBe('newcastle nsw');
    expect(locationKey('Sydney NSW')).toBe('sydney nsw');
    expect(locationKey('Melbourne VIC')).toBe('melbourne vic');
    expect(locationKey('Newcastle, NSW')).not.toBe(locationKey('Sydney, NSW'));
  });
  it('normalises punctuation/whitespace and handles empties', () => {
    expect(locationKey('Sydney NSW (Hybrid)')).toBe('sydney nsw hybrid');
    expect(locationKey('Remote')).toBe('remote');
    expect(locationKey('')).toBe('');
    expect(locationKey(null)).toBe('');
  });
});

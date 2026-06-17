import { describe, it, expect } from 'vitest';
import { locationKey } from './locationKey';

describe('locationKey', () => {
  it('extracts the AU state token', () => {
    expect(locationKey('Mosman, Sydney NSW')).toBe('nsw');
    expect(locationKey('Sydney NSW (Hybrid)')).toBe('nsw');
    expect(locationKey('Melbourne VIC')).toBe('vic');
  });
  it('falls back to normalised full string when no state token', () => {
    expect(locationKey('Remote')).toBe('remote');
    expect(locationKey('')).toBe('');
    expect(locationKey(null)).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { enforceYearsClaim } from './yearsClaimEnforcer';

describe('enforceYearsClaim', () => {
  describe('when storedYears is null', () => {
    it('removes digit year claims', () => {
      const result = enforceYearsClaim('Software developer with 5 years of experience', null);
      // COPY: pending Claude — exact expected output for null case
      expect(result.changed).toBe(true);
      expect(result.text).not.toContain('5 years');
    });

    it('removes written year claims', () => {
      const result = enforceYearsClaim('Over ten years in the industry', null);
      expect(result.changed).toBe(true);
      expect(result.text).not.toContain('ten years');
    });

    it('removes qualifier + year claims', () => {
      const result = enforceYearsClaim('Developer with over 3 years experience', null);
      expect(result.changed).toBe(true);
      expect(result.text).not.toContain('over 3 years');
    });
  });

  describe('when storedYears is set', () => {
    it('rewrites mismatched digit claims to stored value', () => {
      const result = enforceYearsClaim('Developer with 7 years of experience', 5);
      // COPY: pending Claude — exact expected output for rewrite case
      expect(result.changed).toBe(true);
      expect(result.text).toContain('5 years');
      expect(result.text).not.toContain('7 years');
    });

    it('rewrites mismatched written claims to stored value', () => {
      const result = enforceYearsClaim('Developer with seven years of experience', 5);
      expect(result.changed).toBe(true);
      expect(result.text).toContain('5 years');
      expect(result.text).not.toContain('seven years');
    });

    it('keeps correct year claims unchanged', () => {
      const result = enforceYearsClaim('Developer with 5 years of experience', 5);
      expect(result.changed).toBe(false);
      expect(result.text).toBe('Developer with 5 years of experience');
    });

    it('handles "5+ years" format', () => {
      const result = enforceYearsClaim('Developer with 5+ years of experience', 5);
      expect(result.changed).toBe(false);
    });

    it('rewrites "3+ years" to stored 5', () => {
      const result = enforceYearsClaim('Developer with 3+ years of experience', 5);
      expect(result.changed).toBe(true);
      expect(result.text).toContain('5 years');
    });
  });

  describe('edge cases', () => {
    it('returns unchanged for empty text', () => {
      const result = enforceYearsClaim('', 5);
      expect(result.changed).toBe(false);
      expect(result.text).toBe('');
    });

    it('returns unchanged when no year claims', () => {
      const text = 'Software developer with strong skills in TypeScript';
      const result = enforceYearsClaim(text, 5);
      expect(result.changed).toBe(false);
      expect(result.text).toBe(text);
    });

    it('handles storedYears < 2 same as null', () => {
      const result = enforceYearsClaim('Developer with 1 year of experience', 1);
      expect(result.changed).toBe(true);
    });
  });
});

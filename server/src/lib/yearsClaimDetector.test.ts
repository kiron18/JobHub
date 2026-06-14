import { describe, it, expect } from 'vitest';
import { detectYearsClaim, getYearsFeedbackInstruction, removeSentencesWithYears } from './yearsClaimDetector';

describe('detectYearsClaim', () => {
  describe('detection only — never mutates', () => {
    it('detects digit year claims', () => {
      const result = detectYearsClaim('Software developer with 5 years of experience', null);
      expect(result.found).toBe(true);
      expect(result.value).toBe(5);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].phrase).toContain('5 years');
    });

    it('detects written year claims', () => {
      const result = detectYearsClaim('Over ten years in the industry', null);
      expect(result.found).toBe(true);
      expect(result.value).toBe(10);
      expect(result.matches[0].phrase).toContain('ten years');
    });

    it('detects qualifier + year claims', () => {
      const result = detectYearsClaim('Developer with over 3 years experience', null);
      expect(result.found).toBe(true);
      expect(result.value).toBe(3);
    });

    it('returns no violation when no year claims', () => {
      const result = detectYearsClaim('Software developer with strong skills', 5);
      expect(result.found).toBe(false);
      expect(result.violates).toBe(false);
    });
  });

  describe('violation detection — storedYears = null/<2', () => {
    it('ANY year claim violates when storedYears is null', () => {
      const result = detectYearsClaim('Developer with 5 years experience', null);
      expect(result.violates).toBe(true);
    });

    it('ANY year claim violates when storedYears < 2', () => {
      const result = detectYearsClaim('Developer with 1 year experience', 1);
      expect(result.violates).toBe(true);
    });
  });

  describe('violation detection — storedYears set', () => {
    it('no violation when claim matches storedYears', () => {
      const result = detectYearsClaim('Developer with 5 years of experience', 5);
      expect(result.found).toBe(true);
      expect(result.violates).toBe(false);
    });

    it('violates when claim != storedYears', () => {
      const result = detectYearsClaim('Developer with 7 years of experience', 5);
      expect(result.found).toBe(true);
      expect(result.violates).toBe(true);
      expect(result.value).toBe(7);
    });

    it('handles written numbers', () => {
      const result = detectYearsClaim('Developer with seven years of experience', 5);
      expect(result.violates).toBe(true);
      expect(result.value).toBe(7);
    });

    it('handles "5+ years" format matching stored 5', () => {
      const result = detectYearsClaim('Developer with 5+ years of experience', 5);
      expect(result.found).toBe(true);
      expect(result.violates).toBe(false);
    });
  });
});

describe('getYearsFeedbackInstruction', () => {
  it('returns no-number instruction for null storedYears', () => {
    const instruction = getYearsFeedbackInstruction(null);
    expect(instruction).toContain('Do not state any number of years');
    expect(instruction).toContain('Lead with the qualification');
  });

  it('returns no-number instruction for storedYears < 2', () => {
    const instruction = getYearsFeedbackInstruction(1);
    expect(instruction).toContain('Do not state any number of years');
  });

  it('returns exact-N instruction for storedYears = N', () => {
    const instruction = getYearsFeedbackInstruction(5);
    expect(instruction).toContain('exactly 5 years');
    expect(instruction).toContain('Do not state any other figure');
  });
});

describe('removeSentencesWithYears', () => {
  it('removes complete sentences containing year claims', () => {
    const text = 'I am a developer. I have 5 years of experience. I know TypeScript.';
    const result = removeSentencesWithYears(text);
    expect(result).not.toContain('5 years');
    expect(result).toContain('I am a developer');
    expect(result).toContain('I know TypeScript');
  });

  it('removes sentences with written year claims', () => {
    const text = 'Developer with seven years of experience. Skilled in React.';
    const result = removeSentencesWithYears(text);
    expect(result).not.toContain('seven years');
    expect(result).toContain('Skilled in React');
  });

  it('returns empty string if all sentences contain years', () => {
    const text = 'I have 5 years of experience. Worked for 3 years at Google.';
    const result = removeSentencesWithYears(text);
    expect(result.trim()).toBe('');
  });
});

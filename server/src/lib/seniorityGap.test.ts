import { describe, it, expect } from 'vitest';
import { adMinimumYears, hasHardGate, detectSeniorityGap } from './seniorityGap';

describe('adMinimumYears — the bar the ad asks you to clear', () => {
  it('reads the low end of a range, not the high end', () => {
    expect(adMinimumYears('We want 3-5 years of site experience.')).toBe(3);
    expect(adMinimumYears('4 to 6 years in a similar role.')).toBe(4);
  });

  it('reads the common phrasings', () => {
    expect(adMinimumYears('Minimum 3 years experience required.')).toBe(3);
    expect(adMinimumYears('At least 7 years of relevant experience.')).toBe(7);
    expect(adMinimumYears('8+ years building enterprise systems.')).toBe(8);
    expect(adMinimumYears("5 years' experience in construction.")).toBe(5);
    expect(adMinimumYears('At least three years of experience.')).toBe(3);
  });

  it('returns null when the ad never says', () => {
    expect(adMinimumYears('We are looking for a motivated site engineer.')).toBeNull();
    expect(adMinimumYears('')).toBeNull();
  });
});

describe('hasHardGate — closed doors, not high bars', () => {
  it('catches the shapes that rule someone out on career stage', () => {
    expect(hasHardGate('Graduate Analyst Program 2027')).toBe(true);
    expect(hasHardGate('Open to recent graduates only.')).toBe(true);
    expect(hasHardGate('You must have graduated within the last two years.')).toBe(true);
    expect(hasHardGate('Degree completed within the last 2 years.')).toBe(true);
    expect(hasHardGate('This is a 12-month internship.')).toBe(true);
  });

  it('does not fire on an ordinary senior ad', () => {
    expect(hasHardGate('Site Engineer, 3+ years on major infrastructure.')).toBe(false);
  });
});

describe('detectSeniorityGap — conservative by design', () => {
  const SITE_ENGINEER = 'Site Engineer, Infrastructure. We are after 3+ years on major projects.';

  it('fires for the sixteen-year engineer against a three-year ad', () => {
    const notice = detectSeniorityGap(SITE_ENGINEER, 16);
    expect(notice).not.toBeNull();
    expect(notice!.adMinimumYears).toBe(3);
  });

  it('never prints the candidate figure', () => {
    const notice = detectSeniorityGap(SITE_ENGINEER, 16);
    expect(notice!.sentence).not.toMatch(/\b16\b/);
    expect(notice!.sentence).toContain('3+ years');
  });

  it('stays silent on a hard gate even when the margin is huge', () => {
    const grad = 'Graduate Analyst Program 2027. Some exposure over 1+ years is a plus.';
    expect(detectSeniorityGap(grad, 16)).toBeNull();
  });

  it('stays silent on a near miss', () => {
    // Twelve against ten clears neither the multiple nor the margin.
    expect(detectSeniorityGap('At least 10 years required.', 12)).toBeNull();
    // Six against three clears the multiple but not the five-year margin.
    expect(detectSeniorityGap(SITE_ENGINEER, 6)).toBeNull();
  });

  it('stays silent when we hold no figure for them', () => {
    expect(detectSeniorityGap(SITE_ENGINEER, null)).toBeNull();
    expect(detectSeniorityGap(SITE_ENGINEER, undefined)).toBeNull();
  });

  it('stays silent when the ad states no figure', () => {
    expect(detectSeniorityGap('A motivated site engineer wanted.', 16)).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { mergeBridgedSkills } from './buildTemplateResume';

describe('mergeBridgedSkills', () => {
  it('appends a concise label not already present', () => {
    const out = mergeBridgedSkills('Technical: Excel, Word', [
      { skill: 'Adobe Creative Suite', statement: 'Used Adobe to design collateral' },
    ]);
    expect(out).toContain('Adobe Creative Suite');
    expect(out).toMatch(/Role-specific:/);
  });

  it('skips sentence-like labels (> 5 words)', () => {
    const out = mergeBridgedSkills('Technical: Excel', [
      { skill: 'Experience using website CMS platforms and tools', statement: 's' },
    ]);
    expect(out).not.toMatch(/Role-specific:/);
    expect(out).toBe('Technical: Excel');
  });

  it('dedupes case-insensitively against existing skills', () => {
    const out = mergeBridgedSkills('Technical: Adobe Creative Suite', [
      { skill: 'adobe creative suite', statement: 's' },
    ]);
    expect(out).toBe('Technical: Adobe Creative Suite');
  });

  it('returns the original string when no gaps qualify', () => {
    expect(mergeBridgedSkills('Technical: Excel', [])).toBe('Technical: Excel');
  });

  it('handles undefined skills string', () => {
    const out = mergeBridgedSkills(undefined, [{ skill: 'Trade Shows', statement: 's' }]);
    expect(out).toMatch(/Role-specific: Trade Shows/);
  });
});

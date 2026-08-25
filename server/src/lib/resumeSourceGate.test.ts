import { describe, it, expect } from 'vitest';
import { checkResumeSource, assertResumeSource, ResumeSourceError } from './resumeSourceGate';

const ORIGINAL = `Emmanuel Fasan
fasanadeolu@gmail.com | 0450 033 561

WORK EXPERIENCE
OnCall Group Australia
Clinical Support Associate, Jul 2022 to Present
- Improved reporting accuracy, as measured by 100% compliance in operational reports.
- Maintained secure databases with zero data breaches.

EDUCATION
Torrens University Australia, Master of Business Information Systems.`;

describe('checkResumeSource', () => {
  it('passes a rebuild whose figures all come from the original', () => {
    const rebuilt = ORIGINAL.replace('Improved reporting accuracy', 'Hit 100% compliance');
    expect(checkResumeSource(rebuilt, [ORIGINAL], 'authored').ok).toBe(true);
  });

  it('catches a figure the model invented', () => {
    const inflated = ORIGINAL.replace('100% compliance', '100% compliance across 47 sites');
    const check = checkResumeSource(inflated, [ORIGINAL], 'authored');
    expect(check.ok).toBe(false);
    expect(check.ungroundedFigures).toContain('47');
  });

  it('accepts a figure the candidate supplied in an answer', () => {
    const withAnswer = ORIGINAL.replace('operational reports.', 'operational reports across 12 systems.');
    expect(checkResumeSource(withAnswer, [ORIGINAL], 'authored').ok).toBe(false);
    expect(checkResumeSource(withAnswer, [ORIGINAL, 'around 12 systems'], 'authored').ok).toBe(true);
  });

  it('does not flag years, which are structure rather than claims', () => {
    const check = checkResumeSource(ORIGINAL + '\nCertificate, 2025.', [ORIGINAL], 'authored');
    expect(check.ungroundedFigures).not.toContain('2025');
  });

  it('lets a human add a real figure but reports it for confirmation', () => {
    const edited = ORIGINAL.replace('secure databases', 'secure databases for 340 clients');
    const check = checkResumeSource(edited, [ORIGINAL], 'human');
    expect(check.ok).toBe(true);
    expect(check.ungroundedFigures).toContain('340');
  });

  it('rejects placeholders from a human too — a defect, not a claim', () => {
    const leaked = ORIGINAL.replace('operational reports.', 'operational reports for [how many] teams.');
    expect(checkResumeSource(leaked, [ORIGINAL], 'human').ok).toBe(false);
    expect(checkResumeSource(leaked, [ORIGINAL], 'authored').ok).toBe(false);
  });

  it('rejects a failed extraction that produced a fragment', () => {
    const check = checkResumeSource('Emmanuel Fasan', ['Emmanuel Fasan'], 'human');
    expect(check.ok).toBe(false);
    expect(check.tooShort).toBe(true);
  });
});

describe('assertResumeSource', () => {
  it('names the writer in the error, because that is the first question', () => {
    const inflated = ORIGINAL.replace('100% compliance', '100% compliance across 47 sites');
    expect(() => assertResumeSource(inflated, [ORIGINAL], 'authored', 'welcome/finish'))
      .toThrow(ResumeSourceError);
    try {
      assertResumeSource(inflated, [ORIGINAL], 'authored', 'welcome/finish');
    } catch (e) {
      expect((e as Error).message).toContain('welcome/finish');
      expect((e as Error).message).toContain('47');
    }
  });

  it('returns the check instead of throwing when a human wrote it', () => {
    const edited = ORIGINAL.replace('secure databases', 'secure databases for 340 clients');
    expect(assertResumeSource(edited, [ORIGINAL], 'human', 'bank/edit').ungroundedFigures)
      .toContain('340');
  });
});

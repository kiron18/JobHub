import { describe, it, expect } from 'vitest';
import { checkRetention, retentionRetryInstruction, describeRetention } from './retentionGate';

const ORIGINAL = `Pawan Hewage
pawan@example.com | 0412 345 678

WORK EXPERIENCE
Mont Albert Manor (Age Care Centre) -  Food Safety Assistant
02/2024 - Present
Elgar Homes Supported Residential Services -  Food Hygiene Worker
06/2024 - 06/2025

EDUCATION
Bachelor of Science (Chemistry), Deakin University, 2023 - 2025`;

const MUST_KEEP = {
  employers: ['Mont Albert Manor (Age Care Centre)', 'Elgar Homes Supported Residential Services'],
  qualifications: ['Bachelor of Science (Chemistry), Deakin University'],
  contacts: ['pawan@example.com', '0412 345 678'],
};

describe('checkRetention', () => {
  it('passes when everything survives the rebuild', () => {
    const rebuilt = `# Pawan Hewage
pawan@example.com | 0412 345 678
## Work Experience
**Food Safety Assistant | Mont Albert Manor**
Feb 2024 - Present
**Food Hygiene Worker | Elgar Homes Supported Residential Services**
Jun 2024 - Jun 2025
## Education
**Bachelor of Science (Chemistry)** Deakin University, 2023 - 2025`;

    const r = checkRetention(ORIGINAL, rebuilt, MUST_KEEP);
    expect(r.passed).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.checked).toBe(5);
  });

  it('catches the real failure — a dropped current role', () => {
    // This is the actual incident: Mont Albert Manor (02/2024 - Present) was
    // dropped from a generated resume while less relevant casual roles survived.
    const rebuilt = `# Pawan Hewage
pawan@example.com | 0412 345 678
## Work Experience
**Food Hygiene Worker | Elgar Homes Supported Residential Services**
Jun 2024 - Jun 2025
## Education
**Bachelor of Science (Chemistry)** Deakin University, 2023 - 2025`;

    const r = checkRetention(ORIGINAL, rebuilt, MUST_KEEP);
    expect(r.passed).toBe(false);
    expect(r.missing).toEqual([
      { item: 'Mont Albert Manor (Age Care Centre)', kind: 'employer' },
    ]);
  });

  it('tolerates a shortened employer name — a false positive costs a retry', () => {
    // The rebuild sensibly writes "Mont Albert Manor" without the parenthetical.
    // Failing that would block a perfectly good rebuild.
    const rebuilt = 'Mont Albert Manor. Elgar Homes Supported Residential Services. '
      + 'Bachelor of Science Chemistry Deakin University. pawan@example.com 0412 345 678';
    expect(checkRetention(ORIGINAL, rebuilt, MUST_KEEP).passed).toBe(true);
  });

  it('tolerates different dashes, case and spacing', () => {
    const rebuilt = 'MONT   ALBERT   MANOR — elgar homes supported residential services — '
      + 'bachelor of science (chemistry), deakin university — pawan@example.com — 0412 345 678';
    expect(checkRetention(ORIGINAL, rebuilt, MUST_KEEP).passed).toBe(true);
  });

  it('flags a lost qualification', () => {
    const rebuilt = 'Mont Albert Manor. Elgar Homes Supported Residential Services. pawan@example.com 0412 345 678';
    const r = checkRetention(ORIGINAL, rebuilt, MUST_KEEP);
    expect(r.passed).toBe(false);
    expect(r.missing.map(m => m.kind)).toContain('qualification');
  });

  it('flags a lost contact detail — a resume without a phone number is unusable', () => {
    const rebuilt = 'Mont Albert Manor. Elgar Homes Supported Residential Services. '
      + 'Bachelor of Science (Chemistry), Deakin University. pawan@example.com';
    const r = checkRetention(ORIGINAL, rebuilt, MUST_KEEP);
    expect(r.passed).toBe(false);
    expect(r.missing).toEqual([{ item: '0412 345 678', kind: 'contact' }]);
  });

  it('reports missing years as advisory, without failing the gate', () => {
    const rebuilt = 'Mont Albert Manor. Elgar Homes Supported Residential Services. '
      + 'Bachelor of Science (Chemistry), Deakin University. pawan@example.com 0412 345 678';
    const r = checkRetention(ORIGINAL, rebuilt, MUST_KEEP);
    expect(r.passed).toBe(true);                 // years never block
    expect(r.missingYears).toEqual(expect.arrayContaining(['2024', '2025', '2023']));
  });

  it('still runs the year check when there is no inventory at all', () => {
    const r = checkRetention(ORIGINAL, 'nothing here', undefined);
    expect(r.checked).toBe(0);
    expect(r.passed).toBe(true);                 // cannot fail what it was not told about
    expect(r.missingYears.length).toBeGreaterThan(0);
  });

  it('ignores blank and whitespace-only inventory entries', () => {
    const r = checkRetention(ORIGINAL, 'anything', { employers: ['', '   '], qualifications: [], contacts: [] });
    expect(r.checked).toBe(0);
    expect(r.passed).toBe(true);
  });

  it('tolerates reordered or reworded items — contiguity is not required', () => {
    // A rebuild legitimately writes "BSc from Deakin University" where the
    // original said "BSc, Deakin University", or flips "Acme - Analyst" to
    // "Analyst | Acme". Failing those would block a good rebuild.
    const mk = { employers: ['Acme Corp - Senior Analyst'], qualifications: ['BSc, Deakin University'], contacts: [] };
    const rebuilt = 'Senior Analyst | Acme Corp. BSc from Deakin University.';
    expect(checkRetention('x', rebuilt, mk).passed).toBe(true);
  });

  it('still catches a whole item being removed, despite the looser matching', () => {
    const mk = { employers: ['Acme Corp - Senior Analyst'], qualifications: ['BSc, Deakin University'], contacts: [] };
    const rebuilt = 'BSc from Deakin University. Nothing else.';
    const r = checkRetention('x', rebuilt, mk);
    expect(r.passed).toBe(false);
    expect(r.missing).toEqual([{ item: 'Acme Corp - Senior Analyst', kind: 'employer' }]);
  });

  it('does not match on a too-short fragment', () => {
    // A 3-character item would match almost any document by accident, so it is
    // never treated as present on the strength of its core alone.
    const r = checkRetention('x', 'completely unrelated text', { employers: ['IBM Australia Pty Ltd'], qualifications: [], contacts: [] });
    expect(r.passed).toBe(false);
  });
});

describe('retentionRetryInstruction', () => {
  it('names exactly what went missing so the retry can fix it', () => {
    const msg = retentionRetryInstruction([
      { item: 'Mont Albert Manor (Age Care Centre)', kind: 'employer' },
    ]);
    expect(msg).toContain('Mont Albert Manor (Age Care Centre)');
    expect(msg).toContain('employer');
    expect(msg).toMatch(/do not remove anything else/i);
  });
});

describe('describeRetention', () => {
  it('states the count for the sign-off summary', () => {
    const r = checkRetention(ORIGINAL, ORIGINAL, MUST_KEEP);
    expect(describeRetention(r)).toBe('We checked all 5 items from your original resume are still here.');
  });

  it('says something sensible when nothing could be checked', () => {
    const r = checkRetention(ORIGINAL, ORIGINAL, undefined);
    expect(describeRetention(r)).toMatch(/rebuilt your resume/i);
  });
});

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
    const source = 'Acme Corp - Senior Analyst, 2019 - 2023. BSc, Deakin University.';
    const mk = { employers: ['Acme Corp - Senior Analyst'], qualifications: ['BSc, Deakin University'], contacts: [] };
    const rebuilt = 'Senior Analyst | Acme Corp. BSc from Deakin University.';
    expect(checkRetention(source, rebuilt, mk).passed).toBe(true);
  });

  it('still catches a whole item being removed, despite the looser matching', () => {
    const source = 'Acme Corp - Senior Analyst, 2019 - 2023. BSc, Deakin University.';
    const mk = { employers: ['Acme Corp - Senior Analyst'], qualifications: ['BSc, Deakin University'], contacts: [] };
    const rebuilt = 'BSc from Deakin University. Nothing else.';
    const r = checkRetention(source, rebuilt, mk);
    expect(r.passed).toBe(false);
    expect(r.missing).toEqual([{ item: 'Acme Corp - Senior Analyst', kind: 'employer' }]);
  });

  it('does not match on a too-short fragment', () => {
    // A 3-character item would match almost any document by accident, so it is
    // never treated as present on the strength of its core alone.
    const r = checkRetention(
      'IBM Australia Pty Ltd, Analyst',
      'completely unrelated text',
      { employers: ['IBM Australia Pty Ltd'], qualifications: [], contacts: [] },
    );
    expect(r.passed).toBe(false);
  });

  /*
    The 4 Sep 2026 deadlock, from the logs: six attempts, twice, on one link.

    The item was "http://www.linkedin.com/in/fasane". The rebuild wrote
    "linkedin.com/in/fasane", which is the same link and is how a resume writes a
    LinkedIn. The check split the item into words and demanded every one back,
    including "http" and "www", so it failed a rebuild that had done nothing
    wrong. The retry instruction named the URL, the model included the link
    again, and the check rejected it again. Six times, then a 502 after 105
    seconds, then the candidate hit retry and lost another 105 seconds.
  */
  const LINK = 'http://www.linkedin.com/in/fasane';
  const LINK_SOURCE = 'Emmanuel Fasan | emmanuel@example.com | ' + LINK;

  it('does not demand a URL scheme or www back', () => {
    const rebuilt = '# Emmanuel Fasan | emmanuel@example.com | linkedin.com/in/fasane';
    const r = checkRetention(LINK_SOURCE, rebuilt, { employers: [], qualifications: [], contacts: [LINK] });
    expect(r.passed).toBe(true);
    expect(r.checked).toBe(1);   // still checked, just not on the boilerplate
  });

  it('still catches the link actually going missing', () => {
    // The protocol is boilerplate; the domain and the path are the identity, so
    // dropping the link entirely has to keep failing.
    const r = checkRetention(LINK_SOURCE, '# Emmanuel Fasan | emmanuel@example.com', {
      employers: [], qualifications: [], contacts: [LINK],
    });
    expect(r.passed).toBe(false);
    expect(r.missing).toEqual([{ item: LINK, kind: 'contact' }]);
  });

  /*
    The deadlock this gate could not previously get out of.

    mustKeep is written by a model reading the original, so its entries are not
    guaranteed to be quotations from it — it expands acronyms, spells out legal
    names, tidies a certification title. The rebuild then writes what the resume
    actually says, the gate calls that content loss, and no retry can fix it
    because there is nothing to put back. Three attempts fail identically and the
    candidate gets a 502 telling them to try again.
  */
  it('does not enforce an inventory entry that is not in the original', () => {
    // The resume says QUT; the model wrote the expansion into the inventory.
    const source = 'Bachelor of Information Technology, QUT, 2020 - 2023';
    const mk = { employers: [], qualifications: ['Queensland University of Technology'], contacts: [] };
    const r = checkRetention(source, 'Bachelor of Information Technology, QUT, 2020 - 2023', mk);
    expect(r.passed).toBe(true);
    expect(r.checked).toBe(0);   // unverifiable, so not counted as checked either
  });

  it('does not enforce an item with nothing distinctive to match on', () => {
    // Two letters survive neither the key minimum nor the token minimum, so
    // isPresent is false against any text — including the original. Left in, it
    // would fail every attempt forever.
    const r = checkRetention('EY, Assurance Graduate, 2022', 'EY, Assurance Graduate, 2022', {
      employers: ['EY'], qualifications: [], contacts: [],
    });
    expect(r.passed).toBe(true);
    expect(r.checked).toBe(0);
  });

  it('still enforces everything the original does contain', () => {
    // The filter must not become a way for real loss to slip through: one
    // unverifiable entry alongside a real one leaves the real one enforced.
    const mk = {
      employers: ['Mont Albert Manor (Age Care Centre)', 'Never Mentioned Holdings'],
      qualifications: [], contacts: [],
    };
    const r = checkRetention(ORIGINAL, 'Elgar Homes only.', mk);
    expect(r.passed).toBe(false);
    expect(r.missing).toEqual([{ item: 'Mont Albert Manor (Age Care Centre)', kind: 'employer' }]);
    expect(r.checked).toBe(1);
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

import { describe, it, expect } from 'vitest';
import { parseRequirements, normaliseFitReport, buildFitPrompt, adHeader } from './fitReport';

describe('parseRequirements — the ad, read literally', () => {
  // The bug this exists to prevent: a candidate marked down for lacking
  // "industry experience" by an ad whose own heading said it did not expect any.
  it('tags each bullet with the heading it sits under', () => {
    const jd = `Graduate Analyst Program 2027

What we are looking for:
- A completed bachelor or master degree in any discipline
- Clear written English and comfort speaking in front of a room

Nice to have:
- Any exposure to Excel beyond the basics, or to SQL, Python or R

We do not expect:
- Industry experience
- A technical degree`;

    const reqs = parseRequirements(jd);

    expect(reqs).toHaveLength(5);
    expect(reqs[0].section).toBe('What we are looking for');
    expect(reqs[2].section).toBe('Nice to have');
    expect(reqs[3].section).toBe('We do not expect');
    expect(reqs[3].text).toBe('Industry experience');
  });

  it('keeps a negative section rather than filtering it out', () => {
    // Deliberate: the model decides what "we do not expect" means, because a
    // filter heuristic misfires on ads worded differently.
    const reqs = parseRequirements('We do not expect:\n- Knowledge of our tools before you arrive');
    expect(reqs).toHaveLength(1);
    expect(reqs[0].section).toBe('We do not expect');
  });

  it('reads bullets, dashes and asterisks alike', () => {
    const reqs = parseRequirements('Requirements:\n- Three years of SQL\n• Power BI dashboards\n* Stakeholder reporting');
    expect(reqs.map((r) => r.text)).toEqual([
      'Three years of SQL',
      'Power BI dashboards',
      'Stakeholder reporting',
    ]);
  });

  it('drops bullets too short to be a requirement', () => {
    const reqs = parseRequirements('Requirements:\n- SQL\n- Three years of hands-on SQL');
    expect(reqs.map((r) => r.text)).toEqual(['Three years of hands-on SQL']);
  });

  it('does not mistake a long sentence ending in a colon for a heading', () => {
    const jd = 'You will be joining a team that owns the reporting layer end to end, which means:\n- Building dashboards';
    const reqs = parseRequirements(jd);
    expect(reqs[0].section).toBe('');
  });

  it('carries a heading forward until the next one', () => {
    const jd = 'Requirements:\n- One thing that is long enough\n- Another thing that is long enough';
    expect(parseRequirements(jd).every((r) => r.section === 'Requirements')).toBe(true);
  });
});

describe('normaliseFitReport — never trust the model with the screen', () => {
  const base = {
    jobTitle: 'Data Analyst',
    company: 'Telstra',
    verdict: 'You can do this job.',
    fit: 72,
    band: 'stretch',
    youHave: ['SQL', 'Python'],
    missing: ['Power BI'],
    outcome: 'apply',
    searchRoles: [],
  };

  it('passes a well-formed report through', () => {
    const r = normaliseFitReport(base);
    expect(r.fit).toBe(72);
    expect(r.band).toBe('stretch');
    expect(r.outcome).toBe('apply');
    expect(r.jobTitle).toBe('Data Analyst');
  });

  it('clamps a fit score outside 0-100', () => {
    expect(normaliseFitReport({ ...base, fit: 140 }).fit).toBe(100);
    expect(normaliseFitReport({ ...base, fit: -20 }).fit).toBe(0);
    expect(normaliseFitReport({ ...base, fit: 'nonsense' }).fit).toBe(0);
  });

  it('derives the band from the number when the model invents a word', () => {
    expect(normaliseFitReport({ ...base, band: 'INELIGIBLE', fit: 15 }).band).toBe('mismatch');
    expect(normaliseFitReport({ ...base, band: 'excellent', fit: 88 }).band).toBe('strong');
    expect(normaliseFitReport({ ...base, band: 'maybe', fit: 60 }).band).toBe('stretch');
  });

  it('accepts a band in any casing', () => {
    expect(normaliseFitReport({ ...base, band: 'Strong' }).band).toBe('strong');
  });

  it('drops search roles when the verdict is apply', () => {
    const r = normaliseFitReport({ ...base, outcome: 'apply', searchRoles: ['Data Engineer'] });
    expect(r.searchRoles).toEqual([]);
  });

  it('keeps search roles when the verdict is search', () => {
    const r = normaliseFitReport({ ...base, outcome: 'search', searchRoles: ['Data Engineer', 'ETL Developer'] });
    expect(r.searchRoles).toEqual(['Data Engineer', 'ETL Developer']);
  });

  it('treats anything that is not apply as search', () => {
    expect(normaliseFitReport({ ...base, outcome: 'maybe' }).outcome).toBe('search');
    expect(normaliseFitReport({ ...base, outcome: undefined }).outcome).toBe('search');
  });

  it('caps the lists so the screen cannot overflow', () => {
    const r = normaliseFitReport({ ...base, missing: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(r.missing).toHaveLength(3);
  });

  it('strips em dashes out of every string it returns', () => {
    const r = normaliseFitReport({
      ...base,
      verdict: 'You are close—but not there.',
      missing: ['Power BI—specifically dashboards'],
    });
    expect(r.verdict).not.toContain('—');
    expect(r.missing[0]).not.toContain('—');
  });

  it('turns a missing or literal-null title into null, not the string', () => {
    expect(normaliseFitReport({ ...base, company: 'null' }).company).toBeNull();
    expect(normaliseFitReport({ ...base, company: undefined }).company).toBeNull();
    expect(normaliseFitReport({ ...base, jobTitle: '' }).jobTitle).toBeNull();
  });

  it('survives a response that is missing every field', () => {
    const r = normaliseFitReport({});
    expect(r.fit).toBe(0);
    expect(r.band).toBe('mismatch');
    expect(r.youHave).toEqual([]);
  });
});

describe('buildFitPrompt', () => {
  it('numbers the requirements and shows the heading beside each', () => {
    const prompt = buildFitPrompt(
      [
        { section: 'We do not expect', text: 'Industry experience' },
        { section: '', text: 'Three years of SQL' },
      ],
      'RESUME TEXT HERE',
    );
    expect(prompt).toContain('1. [We do not expect] Industry experience');
    expect(prompt).toContain('2. [From the ad] Three years of SQL');
    expect(prompt).toContain('RESUME TEXT HERE');
  });

  it('states the band definitions, without which stretch disappears', () => {
    const prompt = buildFitPrompt([{ section: '', text: 'x' }], 'r');
    expect(prompt).toContain('"stretch" if it is winnable but only once the resume is written properly');
  });

  // Load-bearing. An ad asking for "Australian citizenship, PR or full working
  // rights" had a strong graduate marked down to 35/mismatch for not stating
  // her visa status on a resume, which is not a thing anyone puts on a resume.
  it('says that a silent resume is not a gap on work rights', () => {
    const prompt = buildFitPrompt([{ section: '', text: 'x' }], 'r');
    expect(prompt).toContain('Silence on those is not a gap');
  });

  it('tells the model the ad header is for naming, not for judging', () => {
    const prompt = buildFitPrompt([{ section: '', text: 'x' }], 'r', 'Analyst\nDeloitte | Sydney');
    expect(prompt).toContain('Do not judge fit on anything in this block');
  });
});

describe('adHeader - where the title and employer live', () => {
  it('takes the ad opening, not the bullets', () => {
    const jd = `Graduate Analyst Program 2027
Deloitte Australia | Sydney, Melbourne, Brisbane

About the program:
Our Graduate Analyst Program is a two-year rotation.

What we are looking for:
- A completed bachelor or master degree in any discipline`;

    const header = adHeader(jd);
    expect(header).toContain('Graduate Analyst Program 2027');
    expect(header).toContain('Deloitte Australia');
    expect(header).not.toContain('bachelor or master degree');
  });

  it('is short enough that it cannot become the thing being judged', () => {
    const jd = Array.from({ length: 50 }, (_, i) => `Line ${i} of a very long preamble that rambles on`).join('\n');
    expect(adHeader(jd).length).toBeLessThanOrEqual(400);
  });
});

describe('work rights on the report', () => {
  it('is never taken from the model, whatever the model sends', () => {
    // The field is a deterministic read of the ad. If the model invents one it
    // must not reach the screen.
    const r = normaliseFitReport({ fit: 70, workRights: 'You need a visa, sorry.' });
    expect(r.workRights).toBeNull();
  });
});

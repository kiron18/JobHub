import { describe, it, expect } from 'vitest';
import { reorderExperience, enforceSummaryWordCount, applyPolish } from '../buildTemplateResume';

describe('reorderExperience', () => {
  const exps = [
    { id: 'a', role: 'Manager' },
    { id: 'b', role: 'Intern' },
    { id: 'c', role: 'Operator' },
  ];

  it('reorders by provided ID sequence', () => {
    const result = reorderExperience(exps, ['c', 'b', 'a']);
    expect(result.map(e => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('appends experiences not in the order array at the end', () => {
    const result = reorderExperience(exps, ['c']);
    expect(result[0].id).toBe('c');
    expect(result).toHaveLength(3);
  });

  it('returns original order when orderIds is empty', () => {
    const result = reorderExperience(exps, []);
    expect(result.map(e => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('skips IDs not found in experiences', () => {
    const result = reorderExperience(exps, ['UNKNOWN', 'b']);
    expect(result[0].id).toBe('b');
    expect(result).toHaveLength(3);
  });

  it('does not mutate the original array', () => {
    const original = [...exps];
    reorderExperience(exps, ['c', 'a', 'b']);
    expect(exps.map(e => e.id)).toEqual(original.map(e => e.id));
  });
});

describe('enforceSummaryWordCount', () => {
  it('returns summary unchanged when at or under 80 words', () => {
    const s = 'word '.repeat(80).trim();
    expect(enforceSummaryWordCount(s)).toBe(s);
  });

  it('trims to exactly 80 words when over', () => {
    const s = 'word '.repeat(90).trim();
    const result = enforceSummaryWordCount(s);
    expect(result.split(/\s+/).length).toBe(80);
  });

  it('returns empty string unchanged', () => {
    expect(enforceSummaryWordCount('')).toBe('');
  });

  it('respects a custom maxWords argument', () => {
    const s = 'word '.repeat(10).trim();
    expect(enforceSummaryWordCount(s, 5).split(/\s+/).length).toBe(5);
  });

  it('trims to a complete sentence rather than breaking mid-clause', () => {
    // Two full sentences (~20 words) then a third that runs past the budget and
    // would otherwise be chopped on a comma, like "...GMP-regulated settings,".
    const s =
      'I am a chemistry graduate with hands on laboratory experience. ' +
      'I bring strong analytical and quality control skills. ' +
      'My technical foundation in chemical analysis, paired with experience in GMP regulated settings, prepares me well.';
    const result = enforceSummaryWordCount(s, 20);
    expect(result.endsWith('.')).toBe(true);
    expect(/[,;:]$/.test(result)).toBe(false);
    expect(result.split(/\s+/).length).toBeLessThanOrEqual(20);
  });
});

describe('applyPolish skills override', () => {
  const base: any = { name: 'X', experience: [], education: [], skills: 'Technical: Chemistry' };

  it('overrides skills when polish provides them', () => {
    const out = applyPolish(base, { skills: 'Technical: SAP, Excel' } as any);
    expect(out.skills).toBe('Technical: SAP, Excel');
  });

  it('keeps existing skills when polish omits them', () => {
    const out = applyPolish(base, { summary: 'hi' } as any);
    expect(out.skills).toBe('Technical: Chemistry');
  });
});

describe('applyPolish experience matching', () => {
  const dataWithJobs: any = {
    name: 'X',
    education: [],
    experience: [
      { id: 'a', role: 'Engineer', company: 'Acme', startDate: '2021', description: 'orig A' },
      { id: 'b', role: 'Analyst', company: 'Beta', startDate: '2019', description: 'orig B' },
      { id: 'c', role: 'Intern', company: 'Gamma', startDate: '2017', description: 'orig C' },
    ],
  };

  it('matches bullets to the correct job by id even when the polish array is reordered', () => {
    // LLM returned job C's bullets first, then A, then B — the opposite of profile order.
    const out = applyPolish(dataWithJobs, {
      experience: [
        { id: 'c', bullets: ['Used tool X for Gamma work'] },
        { id: 'a', bullets: ['Used tool Y for Acme work'] },
        { id: 'b', bullets: ['Used tool Z for Beta work'] },
      ],
    } as any);
    expect(out.experience.find((e: any) => e.id === 'a').description).toBe('Used tool Y for Acme work');
    expect(out.experience.find((e: any) => e.id === 'b').description).toBe('Used tool Z for Beta work');
    expect(out.experience.find((e: any) => e.id === 'c').description).toBe('Used tool X for Gamma work');
  });

  it('leaves a job unpolished rather than misattributing bullets when the LLM drops its id', () => {
    // LLM only returned 2 of 3 jobs — with index-based matching this used to shift
    // job C's slot to receive job B's bullets. With id-based matching, B and C are
    // each handled independently: B gets its bullets, C is left unpolished.
    const out = applyPolish(dataWithJobs, {
      experience: [
        { id: 'a', bullets: ['Used tool Y for Acme work'] },
        { id: 'b', bullets: ['Used tool Z for Beta work'] },
      ],
    } as any);
    expect(out.experience.find((e: any) => e.id === 'c').description).toBe('orig C');
  });

  it('ignores an id in the polish payload that does not match any real job', () => {
    const out = applyPolish(dataWithJobs, {
      experience: [
        { id: 'hallucinated-id', bullets: ['Used tool from nowhere'] },
        { id: 'a', bullets: ['Used tool Y for Acme work'] },
      ],
    } as any);
    expect(out.experience.find((e: any) => e.id === 'b').description).toBe('orig B');
    expect(out.experience.find((e: any) => e.id === 'c').description).toBe('orig C');
    expect(out.experience.find((e: any) => e.id === 'a').description).toBe('Used tool Y for Acme work');
  });
});

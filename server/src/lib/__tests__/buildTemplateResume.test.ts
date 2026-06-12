import { describe, it, expect } from 'vitest';
import { reorderExperience, enforceSummaryWordCount } from '../buildTemplateResume';

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
});

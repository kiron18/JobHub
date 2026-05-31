import { describe, it, expect } from 'vitest';
import { normalizeBridgedGaps } from './bridgedGaps';

describe('normalizeBridgedGaps', () => {
  it('strips every bracketed placeholder', () => {
    const out = normalizeBridgedGaps([
      { skill: 'A', statement: 'Increased engagement by [X]%' },
      { skill: 'B', statement: 'Managed content for [X] clients using tools' },
    ]);
    for (const g of out) expect(g.statement).not.toMatch(/\[/);
  });

  it('keeps a clean statement unchanged', () => {
    const out = normalizeBridgedGaps([
      { skill: 'A', statement: 'Coordinated a team of 5 marketers' },
    ]);
    expect(out[0].statement).toBe('Coordinated a team of 5 marketers');
  });

  it('drops empty / whitespace-only statements and missing skills', () => {
    const out = normalizeBridgedGaps([
      { skill: '', statement: 'x' },
      { skill: 'A', statement: '   ' },
      { skill: 'B', statement: 'Real capability' },
    ]);
    expect(out).toEqual([{ skill: 'B', statement: 'Real capability' }]);
  });

  it('dedupes by statement (case-insensitive) and caps at 8', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ skill: `S${i}`, statement: `Cap ${i}` }));
    many.push({ skill: 'dup', statement: 'cap 0' }); // dup of "Cap 0"
    const out = normalizeBridgedGaps(many);
    expect(out.length).toBe(8);
  });

  it('returns [] for non-array input', () => {
    expect(normalizeBridgedGaps(undefined as any)).toEqual([]);
    expect(normalizeBridgedGaps(null as any)).toEqual([]);
  });

  it('collapses whitespace left by placeholder removal and trims trailing punctuation', () => {
    const out = normalizeBridgedGaps([
      { skill: 'A', statement: 'Reached [X] new followers,' },
    ]);
    expect(out[0].statement).toBe('Reached new followers');
  });
});

import { describe, it, expect } from 'vitest';
import { computeComposite, scoreToGrade, addGrades } from '../services/compositeScoring';
import type { DimensionScores } from '../services/compositeScoring';

function makeDimensions(overrides: Partial<Record<keyof DimensionScores, number>> = {}): DimensionScores {
  const defaults: Record<keyof DimensionScores, number> = {
    roleMatch: 4, skillsAlignment: 4, seniorityFit: 4, compensation: 3,
    interviewLikelihood: 4, geographicFit: 5, companyStage: 4,
    marketFit: 3, growthTrajectory: 4, timelineAlignment: 5,
  };
  const scores = { ...defaults, ...overrides };
  const dims = {} as DimensionScores;
  for (const key of Object.keys(scores) as Array<keyof DimensionScores>) {
    dims[key] = { score: scores[key], grade: scoreToGrade(scores[key]), note: 'test note' };
  }
  return dims;
}

describe('scoreToGrade', () => {
  it('maps 5 to A', () => expect(scoreToGrade(5)).toBe('A'));
  it('maps 4 to B', () => expect(scoreToGrade(4)).toBe('B'));
  it('maps 3 to C', () => expect(scoreToGrade(3)).toBe('C'));
  it('maps 2 to D', () => expect(scoreToGrade(2)).toBe('D'));
  it('maps 1 to F', () => expect(scoreToGrade(1)).toBe('F'));
  it('maps 4.6 to A', () => expect(scoreToGrade(4.6)).toBe('A'));
  it('maps 3.6 to B', () => expect(scoreToGrade(3.6)).toBe('B'));
});

describe('computeComposite', () => {
  it('returns matchScore between 0 and 100', () => {
    const { matchScore } = computeComposite(makeDimensions());
    expect(matchScore).toBeGreaterThanOrEqual(0);
    expect(matchScore).toBeLessThanOrEqual(100);
  });

  it('all 5s => matchScore 100 and grade A', () => {
    const dims = makeDimensions({ roleMatch: 5, skillsAlignment: 5, seniorityFit: 5,
      compensation: 5, interviewLikelihood: 5, geographicFit: 5, companyStage: 5,
      marketFit: 5, growthTrajectory: 5, timelineAlignment: 5 });
    const { matchScore, overallGrade } = computeComposite(dims);
    expect(matchScore).toBe(100);
    expect(overallGrade).toBe('A');
  });

  it('all 1s => matchScore 20 and grade F', () => {
    const dims = makeDimensions({ roleMatch: 1, skillsAlignment: 1, seniorityFit: 1,
      compensation: 1, interviewLikelihood: 1, geographicFit: 1, companyStage: 1,
      marketFit: 1, growthTrajectory: 1, timelineAlignment: 1 });
    const { matchScore, overallGrade } = computeComposite(dims);
    expect(matchScore).toBe(20);
    expect(overallGrade).toBe('F');
  });

  it('caps overallGrade at C when roleMatch is D (score 2)', () => {
    const dims = makeDimensions({ roleMatch: 2, skillsAlignment: 5 });
    const { overallGrade } = computeComposite(dims);
    expect(overallGrade).toBe('C');
  });

  it('caps overallGrade at C when skillsAlignment is D (score 2)', () => {
    const dims = makeDimensions({ roleMatch: 5, skillsAlignment: 2 });
    const { overallGrade } = computeComposite(dims);
    expect(overallGrade).toBe('C');
  });

  it('does NOT cap when both gate-pass scores are >= 3', () => {
    const dims = makeDimensions({ roleMatch: 5, skillsAlignment: 5 });
    const { overallGrade } = computeComposite(dims);
    // mixed scores (3s and 4s and 5s) should give B range
    expect(overallGrade).toBe('B');
  });
});

describe('addGrades', () => {
  it('adds grade field to each dimension score', () => {
    const raw = { roleMatch: { score: 4, note: 'good' } } as any;
    const result = addGrades(raw);
    expect(result.roleMatch.grade).toBe('B');
  });
});

describe('scoreToGrade — exact boundary values', () => {
  it('maps exactly 4.5 to A', () => expect(scoreToGrade(4.5)).toBe('A'));
  it('maps exactly 3.5 to B', () => expect(scoreToGrade(3.5)).toBe('B'));
  it('maps exactly 2.5 to C', () => expect(scoreToGrade(2.5)).toBe('C'));
  it('maps exactly 1.5 to D', () => expect(scoreToGrade(1.5)).toBe('D'));
});

describe('computeComposite — gate-pass with score 1', () => {
  it('caps overallGrade at C when roleMatch is F (score 1)', () => {
    const dims = makeDimensions({ roleMatch: 1, skillsAlignment: 5 });
    const { overallGrade } = computeComposite(dims);
    expect(overallGrade).toBe('C');
  });
});

describe('addGrades — missing dimension safety', () => {
  it('fills missing dimensions with score 1 and grade F', () => {
    const raw = { roleMatch: { score: 4, note: 'good' } } as any;
    const result = addGrades(raw);
    expect(result.roleMatch.grade).toBe('B');
    expect(result.skillsAlignment.grade).toBe('F'); // missing → default
    expect(result.skillsAlignment.score).toBe(1);
  });
});

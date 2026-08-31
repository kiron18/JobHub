import { describe, it, expect } from 'vitest';
import { computeYearsOfExperience, resolveYearsOfExperience } from './profileMath';

describe('computeYearsOfExperience — sums actual time worked, not career span', () => {
  it('returns null for empty or missing experience', () => {
    expect(computeYearsOfExperience([])).toBeNull();
    expect(computeYearsOfExperience(null)).toBeNull();
    expect(computeYearsOfExperience(undefined)).toBeNull();
  });

  it('sums durations and EXCLUDES gaps (the MBA-break case)', () => {
    // Two 2-year roles with a 4-year study gap between them. Career span would
    // be 8 years; actual time worked is 4.
    const years = computeYearsOfExperience([
      { startDate: '2010-01', endDate: '2012-01' },
      { startDate: '2016-01', endDate: '2018-01' },
    ]);
    expect(years).toBe(4);
  });

  it('does NOT double-count overlapping concurrent roles', () => {
    // 2020-01..2022-01 and 2021-01..2023-01 overlap → union is 3 years, not 4.
    const years = computeYearsOfExperience([
      { startDate: '2020-01', endDate: '2022-01' },
      { startDate: '2021-01', endDate: '2023-01' },
    ]);
    expect(years).toBe(3);
  });

  it('Pawan: intern + trainee + project (professional roles only) ≈ 2 years', () => {
    // The honest figure the candidate himself states. Earliest-to-today span
    // would have returned ~7. Casual roles are excluded by the caller before
    // this is called.
    const years = computeYearsOfExperience([
      { startDate: '2019-06', endDate: '2019-07' },   // intern, ~1 month
      { startDate: '2021-11', endDate: '2023-03' },   // trainee, ~16 months
      { startDate: '2025-03', endDate: '2025-06' },   // uni project, ~3 months
    ]);
    expect(years).toBe(2);
  });

  it('Sharon: continuous-ish professional history with one study gap ≈ 9 years', () => {
    const years = computeYearsOfExperience([
      { startDate: '2014-08', endDate: '2016-05' },   // graduate engineer
      { startDate: '2018-08', endDate: '2020-05' },   // business analyst
      { startDate: '2020-06', endDate: '2022-06' },   // senior BA
      { startDate: '2022-07', endDate: '2024-09' },   // associate consultant
      { startDate: '2024-10', endDate: '2026-05' },   // product specialist
    ]);
    expect(years).toBe(9);
  });

  it('skips non-work entries (type !== "work")', () => {
    const years = computeYearsOfExperience([
      { startDate: '2018-01', endDate: '2022-01', type: 'work' },
      { startDate: '2010-01', endDate: '2014-01', type: 'volunteering' },
    ]);
    expect(years).toBe(4);
  });

  it('counts a same-month stint as a real (short) role rather than zero', () => {
    const years = computeYearsOfExperience([
      { startDate: '2025-11', endDate: '2025-11' },
    ]);
    expect(years).toBe(1); // floored to a minimum of 1
  });
});

describe('resolveYearsOfExperience — a stated figure has to survive a cross-check', () => {
  // Sixteen years of real dates, and a bullet somewhere in the body that is
  // about the people he trained, not about him. This is the shape that turned
  // a senior engineer into a junior one.
  const SIXTEEN_YEARS = [
    { startDate: '2010-01', endDate: '2018-01' },
    { startDate: '2018-02', endDate: '2026-02' },
  ];

  it('takes the professional summary at face value', () => {
    expect(
      resolveYearsOfExperience(['Site engineer with 16 years of experience.', 'noise'], SIXTEEN_YEARS),
    ).toBe(16);
  });

  it('ignores a figure in the body that the dates contradict', () => {
    const years = resolveYearsOfExperience(
      [null, 'Trained 12 staff with 3 years experience across two sites.'],
      SIXTEEN_YEARS,
    );
    expect(years).toBe(16);
  });

  it('keeps a figure in the body that the dates agree with', () => {
    const years = resolveYearsOfExperience(
      [null, 'Brings 15 years of experience in tunnelling.'],
      SIXTEEN_YEARS,
    );
    expect(years).toBe(15);
  });

  it('falls back to the body figure when there are no dates to check against', () => {
    expect(resolveYearsOfExperience([null, 'Around 4 years of experience.'], [])).toBe(4);
  });

  it('returns the computed figure when nothing is stated anywhere', () => {
    expect(resolveYearsOfExperience([null, 'No figures here.'], SIXTEEN_YEARS)).toBe(16);
  });

  it('returns null when there is nothing to go on at all', () => {
    expect(resolveYearsOfExperience([null, null], [])).toBeNull();
  });
});

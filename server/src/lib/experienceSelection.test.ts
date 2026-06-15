import { describe, it, expect } from 'vitest';
import { selectFeaturedExperience, type ExperienceLike, type ExperienceFlag } from './experienceSelection';

const exp = (role: string, startDate: string, endDate: string | null): ExperienceLike => ({
  role, company: 'X', startDate, endDate, location: null, isCurrent: false, description: '',
});

describe('selectFeaturedExperience', () => {
  it('keeps relevant roles as featured and drops nothing when all relevant', () => {
    const experience = [exp('Lab Tech', '2021-01', '2023-01'), exp('Analyst', '2019-01', '2020-01')];
    const flags: ExperienceFlag[] = [
      { index: 0, relevant: true, australianLocal: false },
      { index: 1, relevant: true, australianLocal: false },
    ];
    const out = selectFeaturedExperience(experience, flags);
    expect(out.featured).toHaveLength(2);
    expect(out.additionalExperienceLine).toBeNull();
  });

  it('condenses irrelevant Australian-local roles into one line and drops irrelevant non-local', () => {
    const experience = [
      exp('Lab Tech', '2021-01', '2023-01'),       // relevant
      exp('Food Handler', '2024-02', '2024-06'),    // irrelevant, local
      exp('Kitchen Hand', '2024-06', '2025-06'),    // irrelevant, local
      exp('Street Vendor', '2017-01', '2018-01'),   // irrelevant, non-local
    ];
    const flags: ExperienceFlag[] = [
      { index: 0, relevant: true, australianLocal: false },
      { index: 1, relevant: false, australianLocal: true },
      { index: 2, relevant: false, australianLocal: true },
      { index: 3, relevant: false, australianLocal: false },
    ];
    const out = selectFeaturedExperience(experience, flags);
    expect(out.featured.map(f => f.role)).toEqual(['Lab Tech']);
    expect(out.additionalExperienceLine).toBe('**Additional Australian experience:** Food Handler, Kitchen Hand (2024-2025)');
  });

  it('de-duplicates role titles and caps at 5 with "and more"', () => {
    const experience = [
      exp('Cleaner', '2024-01', '2024-02'), exp('Cleaner', '2024-03', '2024-04'),
      exp('Cashier', '2024-01', '2024-02'), exp('Waiter', '2024-01', '2024-02'),
      exp('Driver', '2024-01', '2024-02'), exp('Packer', '2024-01', '2024-02'),
      exp('Usher', '2024-01', '2024-02'),
    ];
    const flags: ExperienceFlag[] = experience.map((_, index) => ({ index, relevant: false, australianLocal: true }));
    const out = selectFeaturedExperience(experience, flags);
    expect(out.additionalExperienceLine).toBe('**Additional Australian experience:** Cleaner, Cashier, Waiter, Driver, Packer, and more (2024)');
  });

  it('falls back to keeping ALL experience when flags are missing or length-mismatched', () => {
    const experience = [exp('A', '2021-01', '2022-01'), exp('B', '2020-01', '2021-01')];
    const out = selectFeaturedExperience(experience, null);
    expect(out.featured).toHaveLength(2);
    expect(out.additionalExperienceLine).toBeNull();
  });

  it('omits the year range when no year is parseable', () => {
    const experience = [exp('Volunteer', 'Unknown', null)];
    const flags: ExperienceFlag[] = [{ index: 0, relevant: false, australianLocal: true }];
    const out = selectFeaturedExperience(experience, flags);
    expect(out.additionalExperienceLine).toBe('**Additional Australian experience:** Volunteer');
  });
});

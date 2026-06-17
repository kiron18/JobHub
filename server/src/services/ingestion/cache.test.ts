import { describe, it, expect } from 'vitest';
import { jobRowToMergedJob } from './cache';

describe('jobRowToMergedJob', () => {
  it('reconstructs a MergedJob from a Job row + sources', () => {
    const row = {
      dedupKey: 'k', title: 'Registered Nurse', company: 'Health Co', normalizedCompany: 'health co',
      location: 'Sydney NSW', salary: null, description: 'd', descriptionHydrated: false, postedAt: null,
      relevanceScore: 0.9, lowRelevance: false, searchRole: 'Registered Nurse',
      sources: [
        { source: 'seek', sourceUrl: 'https://au.seek.com/job/1', sourceJobId: '1' },
        { source: 'adzuna', sourceUrl: 'https://adzuna/2', sourceJobId: null },
      ],
    };
    const m = jobRowToMergedJob(row as any);
    expect(m.title).toBe('Registered Nurse');
    expect(m.sources.map(s => s.source).sort()).toEqual(['adzuna', 'seek']);
    expect(m.descriptionHydrated).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { mergeSources } from './mergeSources';
import type { RawJob } from '../jobFeed';
import type { IngestionSource } from './types';

const job = (o: Partial<RawJob> = {}): RawJob => ({
  title: 'Marketing Coordinator', company: 'Acme Pty Ltd', location: 'Sydney NSW',
  salary: null, description: 'x', sourceUrl: 'https://au.seek.com/job/1',
  sourcePlatform: 'seek', postedAt: null, ...o,
});

describe('mergeSources', () => {
  it('collapses the same job from two sources into one canonical with two JobSources', () => {
    const input: Array<{ source: IngestionSource; jobs: RawJob[] }> = [
      { source: 'seek', jobs: [job({ sourceUrl: 'https://au.seek.com/job/1' })] },
      { source: 'adzuna', jobs: [job({ sourceUrl: 'https://adzuna/abc' })] },
    ];
    const merged = mergeSources(input, 'Marketing Coordinator');
    expect(merged).toHaveLength(1);
    expect(merged[0].sources.map(s => s.source).sort()).toEqual(['adzuna', 'seek']);
  });

  it('keeps genuinely different jobs separate', () => {
    const input = [
      { source: 'seek' as IngestionSource, jobs: [job({ title: 'Marketing Coordinator', sourceUrl: 'u1' })] },
      { source: 'adzuna' as IngestionSource, jobs: [job({ title: 'Warehouse Picker', company: 'Other Co', sourceUrl: 'u2' })] },
    ];
    expect(mergeSources(input, 'Marketing Coordinator')).toHaveLength(2);
  });

  it('marks the SEEK source unhydrated and API sources hydrated', () => {
    const merged = mergeSources(
      [{ source: 'adzuna', jobs: [job({ sourceUrl: 'u3', description: 'full text' })] }],
      'Marketing Coordinator',
    );
    expect(merged[0].descriptionHydrated).toBe(true);
  });
});

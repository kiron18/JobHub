import { describe, it, expect, vi } from 'vitest';

const seekJobs = [{ title: 'Registered Nurse', company: 'Health Co', location: 'Sydney NSW', salary: null, description: '', sourceUrl: 'https://au.seek.com/job/1', sourcePlatform: 'seek' as const, postedAt: null }];
vi.mock('./adapters/seek', () => ({ seekAdapter: { source: 'seek', search: vi.fn(async () => ({ jobs: seekJobs, report: { source: 'seek', rawCount: 1, blocked: false, errorMessage: null, latencyMs: 1, creditsUsed: 1 } })) } }));
vi.mock('./adapters/adzuna', () => ({ adzunaAdapter: { source: 'adzuna', search: vi.fn(async () => ({ jobs: [], report: { source: 'adzuna', rawCount: 0, blocked: false, errorMessage: null, latencyMs: 1, creditsUsed: 0 } })) } }));
vi.mock('./adapters/jsearch', () => ({ jsearchAdapter: { source: 'jsearch', search: vi.fn(async () => ({ jobs: [], report: { source: 'jsearch', rawCount: 0, blocked: false, errorMessage: null, latencyMs: 1, creditsUsed: 0 } })) } }));
vi.mock('./persist', () => ({ persistMergedJobs: vi.fn(async () => ({ runId: 'r', newJobs: 1, dupJobs: 0 })) }));

import { runIngestionForTitle } from './runIngestion';

describe('runIngestionForTitle', () => {
  it('fans out across enabled adapters, merges, persists, and returns merged jobs', async () => {
    const r = await runIngestionForTitle('Registered Nurse', 'Sydney NSW', 'manual');
    expect(r.jobs.length).toBe(1);
    expect(r.jobs[0].title).toBe('Registered Nurse');
  });
});

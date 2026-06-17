import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db', () => {
  const mockUpsert = vi.fn(async () => ({ id: 'job1' }));
  const mockCreateRun = vi.fn(async () => ({ id: 'run1' }));
  const mockUpdateRun = vi.fn(async () => ({}));
  const mockCreateSourceResult = vi.fn(async () => ({}));
  const mockJobSourceUpsert = vi.fn(async () => ({}));

  return {
    prisma: {
      job: { upsert: mockUpsert, findUnique: vi.fn(async () => null) },
      jobSource: { upsert: mockJobSourceUpsert },
      ingestionRun: { create: mockCreateRun, update: mockUpdateRun },
      sourceResult: { create: mockCreateSourceResult },
    },
    _mocks: { mockUpsert, mockCreateRun, mockUpdateRun, mockCreateSourceResult }
  };
});

import { persistMergedJobs } from './persist';
import { prisma } from '../../db';

describe('persistMergedJobs', () => {
  it('upserts each merged job and writes a run record', async () => {
    await persistMergedJobs({
      merged: [{
        dedupKey: 'k', title: 'T', company: 'C', normalizedCompany: 'c', location: null, salary: null,
        description: 'd', descriptionHydrated: true, postedAt: null, relevanceScore: 1, lowRelevance: false,
        searchRole: 'T', sources: [{ source: 'adzuna' as const, sourceUrl: 'u', sourceJobId: null }],
      }],
      reports: [{ source: 'adzuna' as const, rawCount: 1, blocked: false, errorMessage: null, latencyMs: 5, creditsUsed: 0 }],
      trigger: 'manual',
      role: 'T',
      location: 'Sydney NSW',
    });
    expect(prisma.job.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.ingestionRun.create).toHaveBeenCalledTimes(1);
    expect(prisma.sourceResult.create).toHaveBeenCalledTimes(1);
  });
});

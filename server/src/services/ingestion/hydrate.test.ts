import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mutable state that works with hoisting
const mockState = {
  job: { descriptionHydrated: false },
  updateCalled: false,
};

vi.mock('../../db', () => ({
  prisma: {
    job: {
      findUnique: vi.fn(async () => mockState.job),
      update: vi.fn(async () => { mockState.updateCalled = true; return {}; }),
    },
    jobSource: { findFirst: vi.fn(async () => ({ sourceUrl: 'https://au.seek.com/job/1' })) },
  },
}));

vi.mock('./firecrawl', () => ({
  firecrawlScrape: vi.fn(async () => ({ markdown: 'FULL JD '.repeat(50), blocked: false })),
}));

import { hydrateJobDescription } from './hydrate';
import { prisma } from '../../db';

describe('hydrateJobDescription', () => {
  beforeEach(() => {
    mockState.job = { descriptionHydrated: false };
    mockState.updateCalled = false;
    vi.clearAllMocks();
  });

  it('no-ops when already hydrated', async () => {
    mockState.job = { descriptionHydrated: true };
    const r = await hydrateJobDescription('j');
    expect(r.hydrated).toBe(false);
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('fetches and stores the full description for an unhydrated SEEK job', async () => {
    mockState.job = { descriptionHydrated: false };
    const r = await hydrateJobDescription('j');
    expect(r.hydrated).toBe(true);
    expect(prisma.job.update).toHaveBeenCalledTimes(1);
  });
});

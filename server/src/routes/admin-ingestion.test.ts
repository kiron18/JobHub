import { describe, it, expect, vi } from 'vitest';

vi.mock('./stripe', () => ({
  EXEMPT_EMAILS: ['admin@test.com'],
}));

// The real one imports the whole server through ../index.
vi.mock('../middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../db', () => ({
  prisma: {
    sourceResult: { groupBy: vi.fn(async () => ([
      { source: 'seek', _sum: { rawCount: 30, newCount: 10, uniqueCount: 8, creditsUsed: 1 } },
    ])) },
    ingestionRun: { count: vi.fn(async () => 3) },
  },
}));

import { buildIngestionSummary } from './admin-ingestion';

describe('buildIngestionSummary', () => {
  it('rolls up per-source metrics including unique contribution', async () => {
    const summary = await buildIngestionSummary();
    expect(summary.sources[0].source).toBe('seek');
    expect(summary.sources[0].uniqueCount).toBe(8);
    expect(summary.totalRuns).toBe(3);
  });
});

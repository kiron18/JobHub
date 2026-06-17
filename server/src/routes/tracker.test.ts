import { describe, it, expect, vi } from 'vitest';

vi.mock('../index', () => ({
  prisma: {
    jobApplication: { findMany: vi.fn() },
    candidateProfile: { findUnique: vi.fn() },
  }
}));

vi.mock('../services/jobFeed', () => ({
  todayAEST: () => new Date('2026-06-17T00:00:00+10:00')
}));

async function mod() {
  const m = await import('./tracker');
  const { prisma } = await import('../index');
  return { m, prisma };
}

describe('getDailyProgress', () => {
  it('counts distinct jobs applied today against the goal', async () => {
    const { m, prisma } = await mod();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({ dailyApplicationGoal: 5 });
    (prisma.jobApplication.findMany as any).mockResolvedValue([{ sourceUrl: 'a' }, { sourceUrl: 'a' }, { sourceUrl: 'b' }]);
    expect(await m.getDailyProgress('u1')).toEqual({ appliedToday: 2, goal: 5 });
  });

  it('defaults goal to 5 when profile missing', async () => {
    const { m, prisma } = await mod();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue(null);
    (prisma.jobApplication.findMany as any).mockResolvedValue([]);
    expect(await m.getDailyProgress('u1')).toEqual({ appliedToday: 0, goal: 5 });
  });
});

describe('getActivity', () => {
  it('returns zero-filled trailing days', async () => {
    const { m, prisma } = await mod();
    (prisma.jobApplication.findMany as any).mockResolvedValue([{ sourceUrl: 'a', dateApplied: new Date('2026-06-17T03:00:00+10:00') }]);
    const out = await m.getActivity('u1', 7);
    expect(out).toHaveLength(7);
    expect(out[out.length - 1]).toEqual({ date: '2026-06-17', count: 1 });
  });
});

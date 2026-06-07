import { describe, it, expect, vi } from 'vitest';

vi.mock('../index', () => ({ prisma: { jobApplication: { count: vi.fn() } } }));
vi.mock('./jobFeed', () => ({ todayAEST: () => new Date('2026-06-07T00:00:00+10:00') }));

async function mod() {
  const m = await import('./applicationCap');
  const { prisma } = await import('../index');
  return { m, prisma };
}

describe('applicationCap', () => {
  it('DAILY_APPLICATION_CAP is 25', async () => {
    const { m } = await mod();
    expect(m.DAILY_APPLICATION_CAP).toBe(25);
  });

  it('countTodaysApplications counts JobApplications created since today AEST', async () => {
    const { m, prisma } = await mod();
    (prisma.jobApplication.count as any).mockResolvedValueOnce(3);
    const n = await m.countTodaysApplications('user-1');
    expect(n).toBe(3);
    expect((prisma.jobApplication.count as any)).toHaveBeenCalledWith({
      where: { userId: 'user-1', createdAt: { gte: new Date('2026-06-07T00:00:00+10:00') } },
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../index', () => ({
  prisma: { sessionLog: { findUnique: vi.fn(), upsert: vi.fn() } },
}));
const TODAY = new Date('2026-09-09T00:00:00.000Z');
vi.mock('../jobFeed', () => ({ todayAEST: () => TODAY }));

async function mod() {
  const m = await import('./sessionLog');
  const { prisma } = await import('../../index');
  return { m, prisma: prisma as any };
}

beforeEach(() => vi.clearAllMocks());

describe('saveSessionLog', () => {
  it('keeps only known ids, once each', async () => {
    const { m, prisma } = await mod();
    prisma.sessionLog.upsert.mockImplementation(({ create }: any) => Promise.resolve({ ...create, updatedAt: new Date() }));
    const r = await m.saveSessionLog('u1', { outcomes: ['hit_number', 'hit_number', 'made_up'], tomorrow: ['same_time', 42] });
    expect(r.outcomes).toEqual(['hit_number']);
    expect(r.tomorrow).toEqual(['same_time']);
    expect(prisma.sessionLog.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_date: { userId: 'u1', date: TODAY } },
    }));
  });

  it('refuses an empty check-out', async () => {
    const { m } = await mod();
    await expect(m.saveSessionLog('u1', { outcomes: [], tomorrow: ['nope'] })).rejects.toMatchObject({ status: 400 });
  });
});

describe('getTodaySessionLog', () => {
  it('is empty before anything is saved today', async () => {
    const { m, prisma } = await mod();
    prisma.sessionLog.findUnique.mockResolvedValue(null);
    expect(await m.getTodaySessionLog('u1')).toEqual({ outcomes: [], tomorrow: [], savedAt: null });
  });
});

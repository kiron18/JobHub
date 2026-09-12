import { describe, it, expect, vi } from 'vitest';

vi.mock('../../index', () => ({
  prisma: {
    candidateProfile: { findUnique: vi.fn(), updateMany: vi.fn() },
    jobApplication: { findMany: vi.fn() },
    goalChange: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}));

// todayAEST is the real Sydney "today" — pin it so streak-day math is deterministic.
// Wednesday, so a 60-day lookback crosses several weekends.
const TODAY = new Date('2026-09-09T00:00:00.000Z');
vi.mock('../jobFeed', () => ({ todayAEST: () => TODAY }));

async function mod() {
  const m = await import('./closeout');
  const { prisma } = await import('../../index');
  return { m, prisma };
}

function app(daysAgo: number, opts: { sourceUrl?: string } = {}) {
  const d = new Date(TODAY.getTime() - daysAgo * 86400000);
  return { id: `id-${daysAgo}-${opts.sourceUrl ?? ''}`, sourceUrl: opts.sourceUrl ?? `url-${daysAgo}`, dateApplied: d };
}

describe('computeDailyStreak', () => {
  it('is zero with no applications', async () => {
    const { m, prisma } = await mod();
    (prisma.jobApplication.findMany as any).mockResolvedValue([]);
    expect(await m.computeDailyStreak('u1')).toBe(0);
  });

  it('counts consecutive floor-clearing days, skipping weekends', async () => {
    const { m, prisma } = await mod();
    // TODAY is a Wednesday. Wed, Tue, Mon (0-2 days ago) and the Friday
    // before that (5 days ago) all clear the floor; the Sat/Sun between
    // them (3-4 days ago) have no applications and must be skipped rather
    // than treated as a break.
    const rows = [0, 1, 2, 5].flatMap(daysAgo =>
      Array.from({ length: 5 }, (_, i) => app(daysAgo, { sourceUrl: `d${daysAgo}-${i}` })),
    );
    (prisma.jobApplication.findMany as any).mockResolvedValue(rows);
    expect(await m.computeDailyStreak('u1')).toBe(4);
  });

  it('breaks on the first weekday below the floor', async () => {
    const { m, prisma } = await mod();
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => app(0, { sourceUrl: `t${i}` })),
      ...Array.from({ length: 2 }, (_, i) => app(1, { sourceUrl: `y${i}` })), // below floor
      ...Array.from({ length: 5 }, (_, i) => app(4, { sourceUrl: `p${i}` })), // earlier day, never reached
    ];
    (prisma.jobApplication.findMany as any).mockResolvedValue(rows);
    expect(await m.computeDailyStreak('u1')).toBe(1);
  });

  it('dedupes the same job logged twice within a day', async () => {
    const { m, prisma } = await mod();
    const rows = [
      app(0, { sourceUrl: 'same' }),
      app(0, { sourceUrl: 'same' }),
      app(0, { sourceUrl: 'other1' }),
      app(0, { sourceUrl: 'other2' }),
      app(0, { sourceUrl: 'other3' }),
    ];
    (prisma.jobApplication.findMany as any).mockResolvedValue(rows);
    // Only 4 distinct jobs today — below the floor of 5.
    expect(await m.computeDailyStreak('u1')).toBe(0);
  });
});

describe('getCloseoutState', () => {
  it('is not eligible below goal', async () => {
    const { m, prisma } = await mod();
    // getCloseoutState calls candidateProfile.findUnique twice concurrently
    // (once directly, once inside promoteAndGetSettings) — one merged mock
    // avoids depending on which call lands first.
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({
      dailyApplicationGoal: 5, applicationGoalType: 'daily',
      dailyOutreachGoal: 4, outreachGoalType: 'daily',
      closeoutSeenDate: null,
    });
    (prisma.goalChange.findFirst as any).mockResolvedValue(null);
    (prisma.jobApplication.findMany as any).mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => app(0, { sourceUrl: `a${i}` })),
    );
    const state = await m.getCloseoutState('u1');
    expect(state.eligible).toBe(false);
    expect(state.appliedToday).toBe(3);
    expect(state.goal).toBe(5);
  });

  it('is eligible once goal is met and not yet seen today', async () => {
    const { m, prisma } = await mod();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({
      dailyApplicationGoal: 5, applicationGoalType: 'daily',
      dailyOutreachGoal: 4, outreachGoalType: 'daily',
      closeoutSeenDate: null,
    });
    (prisma.goalChange.findFirst as any).mockResolvedValue(null);
    (prisma.jobApplication.findMany as any).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => app(0, { sourceUrl: `a${i}` })),
    );
    const state = await m.getCloseoutState('u1');
    expect(state.eligible).toBe(true);
  });

  it('is not eligible again once already seen today', async () => {
    const { m, prisma } = await mod();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({
      dailyApplicationGoal: 5, applicationGoalType: 'daily',
      dailyOutreachGoal: 4, outreachGoalType: 'daily',
      closeoutSeenDate: TODAY,
    });
    (prisma.goalChange.findFirst as any).mockResolvedValue(null);
    (prisma.jobApplication.findMany as any).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => app(0, { sourceUrl: `a${i}` })),
    );
    const state = await m.getCloseoutState('u1');
    expect(state.eligible).toBe(false);
  });

  it('falls back to the daily floor for weekly-goal candidates', async () => {
    const { m, prisma } = await mod();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({
      dailyApplicationGoal: 20, applicationGoalType: 'weekly',
      dailyOutreachGoal: 20, outreachGoalType: 'weekly',
      closeoutSeenDate: null,
    });
    (prisma.goalChange.findFirst as any).mockResolvedValue(null);
    (prisma.jobApplication.findMany as any).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => app(0, { sourceUrl: `a${i}` })),
    );
    const state = await m.getCloseoutState('u1');
    expect(state.goal).toBe(5);
    expect(state.eligible).toBe(true);
  });
});

describe('ackCloseout', () => {
  it('only advances the seen marker forward', async () => {
    const { m, prisma } = await mod();
    await m.ackCloseout('u1');
    expect(prisma.candidateProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', OR: [{ closeoutSeenDate: null }, { closeoutSeenDate: { lt: TODAY } }] },
      data: { closeoutSeenDate: TODAY },
    });
  });
});

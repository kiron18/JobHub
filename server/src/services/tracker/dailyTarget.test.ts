import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../index', () => ({
  prisma: {
    candidateProfile: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    jobApplication: { findMany: vi.fn() },
    goalChange: { findFirst: vi.fn(), updateMany: vi.fn() },
    dailyTarget: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  },
}));

const TODAY = new Date('2026-09-09T00:00:00.000Z');
vi.mock('../jobFeed', () => ({ todayAEST: () => TODAY }));

async function mod() {
  const m = await import('./dailyTarget');
  const { prisma } = await import('../../index');
  return { m, prisma: prisma as any };
}

/** A member whose program goal is `goal`, with `filed` applications sent today. */
function setup(prisma: any, opts: {
  goal?: number;
  filed?: number;
  row?: { target: number; locked: boolean; undoUsed: boolean } | null;
  explainerSeenAt?: Date | null;
} = {}) {
  const { goal = 5, filed = 0, row = null, explainerSeenAt = null } = opts;
  prisma.goalChange.findFirst.mockResolvedValue(null);
  prisma.candidateProfile.findUnique.mockImplementation(({ select }: any) =>
    Promise.resolve(select?.commitExplainerSeenAt !== undefined
      ? { commitExplainerSeenAt: explainerSeenAt }
      : {
          dailyApplicationGoal: goal, applicationGoalType: 'daily',
          dailyOutreachGoal: 4, outreachGoalType: 'daily',
        }),
  );
  prisma.jobApplication.findMany.mockResolvedValue(
    Array.from({ length: filed }, (_, i) => ({ id: `j${i}`, sourceUrl: `url-${i}` })),
  );
  prisma.dailyTarget.findUnique.mockResolvedValue(row);
  prisma.dailyTarget.upsert.mockResolvedValue({});
  prisma.dailyTarget.update.mockResolvedValue({});
}

beforeEach(() => vi.clearAllMocks());

describe('getDailyTargetState', () => {
  it('defaults to the program goal before anything is committed', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { goal: 5 });
    const s = await m.getDailyTargetState('u1');
    expect(s).toMatchObject({ target: 5, committed: null, locked: false, undoAvailable: true, min: 5, max: 10 });
  });

  it('raises the target to match work already done', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { goal: 5, filed: 8, row: { target: 6, locked: true, undoUsed: false } });
    const s = await m.getDailyTargetState('u1');
    // Committed 6, sent 8 -> the target is 8. Nobody is told they overshot.
    expect(s.target).toBe(8);
    expect(s.committed).toBe(6);
  });

  it('stops raising at the ceiling', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { goal: 5, filed: 14, row: { target: 6, locked: true, undoUsed: false } });
    expect((await m.getDailyTargetState('u1')).target).toBe(10);
  });

  it('never offers a max below a program goal above the ceiling', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { goal: 15 });
    const s = await m.getDailyTargetState('u1');
    expect(s.min).toBe(15);
    expect(s.max).toBe(15);
  });

  it('reports the undo as spent once it has been used', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { row: { target: 7, locked: true, undoUsed: true } });
    expect((await m.getDailyTargetState('u1')).undoAvailable).toBe(false);
  });
});

describe('setDailyTarget', () => {
  it('commits and locks', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { goal: 5 });
    await m.setDailyTarget('u1', 7);
    expect(prisma.dailyTarget.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ target: 7, locked: true }),
    }));
  });

  it('refuses while today is locked', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { row: { target: 6, locked: true, undoUsed: false } });
    await expect(m.setDailyTarget('u1', 9)).rejects.toMatchObject({ status: 409 });
    expect(prisma.dailyTarget.upsert).not.toHaveBeenCalled();
  });

  it('allows a new number after the undo unlocked the day', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { row: { target: 6, locked: false, undoUsed: true } });
    await m.setDailyTarget('u1', 8);
    // The spent undo is carried over, so unlocking twice is impossible.
    expect(prisma.dailyTarget.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ undoUsed: true }),
    }));
  });

  it('refuses below the program goal — the dodge this whole design prevents', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { goal: 5 });
    await expect(m.setDailyTarget('u1', 3)).rejects.toMatchObject({ status: 400 });
  });

  it('refuses above the ceiling', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { goal: 5 });
    await expect(m.setDailyTarget('u1', 11)).rejects.toMatchObject({ status: 400 });
  });

  it('refuses a number below what has already been sent today', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { goal: 5, filed: 8 });
    // Otherwise someone eight in could "commit" to five and be instantly done.
    await expect(m.setDailyTarget('u1', 5)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a non-numeric target', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { goal: 5 });
    await expect(m.setDailyTarget('u1', 'seven' as any)).rejects.toMatchObject({ status: 400 });
  });
});

describe('useDailyUndo', () => {
  it('unlocks and spends the undo', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { row: { target: 6, locked: true, undoUsed: false } });
    await m.useDailyUndo('u1');
    expect(prisma.dailyTarget.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { locked: false, undoUsed: true },
    }));
  });

  it('refuses a second undo on the same day', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { row: { target: 6, locked: true, undoUsed: true } });
    await expect(m.useDailyUndo('u1')).rejects.toMatchObject({ status: 409 });
  });

  it('refuses when nothing is set yet', async () => {
    const { m, prisma } = await mod();
    setup(prisma, { row: null });
    await expect(m.useDailyUndo('u1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('markCommitExplainerSeen', () => {
  it('only ever stamps the first time', async () => {
    const { m, prisma } = await mod();
    prisma.candidateProfile.updateMany.mockResolvedValue({ count: 1 });
    await m.markCommitExplainerSeen('u1');
    expect(prisma.candidateProfile.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', commitExplainerSeenAt: null },
    }));
  });
});

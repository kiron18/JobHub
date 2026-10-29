import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../index', () => ({
  prisma: {
    candidateProfile: { findUnique: vi.fn(), update: vi.fn() },
    goalChange: { findFirst: vi.fn() },
  },
}));

beforeEach(() => { vi.clearAllMocks(); });

async function mod() {
  const m = await import('./goals');
  const { prisma } = await import('../../index');
  return { m, prisma };
}

describe('requestGoalChange', () => {
  it('rejects a weekly goalType before touching the database — weekly goals are retired', async () => {
    const { m } = await mod();
    await expect(m.requestGoalChange('u1', {
      appGoal: 20, appGoalType: 'weekly' as any,
      outreachGoal: 4, outreachGoalType: 'daily',
    })).rejects.toThrow(/weekly goals were retired/i);
  });
});

describe('promoteAndGetSettings', () => {
  it('self-heals a profile still on a weekly goal to its daily equivalent', async () => {
    const { m, prisma } = await mod();
    (prisma.goalChange.findFirst as any).mockResolvedValue(null);
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({
      dailyApplicationGoal: 50, applicationGoalType: 'weekly',
      dailyOutreachGoal: 4, outreachGoalType: 'daily',
    });
    (prisma.candidateProfile.update as any).mockResolvedValue({});

    const settings = await m.promoteAndGetSettings('u1');

    expect(settings).toEqual({ appGoal: 10, appGoalType: 'daily', outreachGoal: 4, outreachGoalType: 'daily' });
    expect(prisma.candidateProfile.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: {
        dailyApplicationGoal: 10, applicationGoalType: 'daily',
        dailyOutreachGoal: 4, outreachGoalType: 'daily',
      },
    });
  });

  it('never converts a weekly-equivalent below the daily floor', async () => {
    const { m, prisma } = await mod();
    (prisma.goalChange.findFirst as any).mockResolvedValue(null);
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({
      // 5/week would round to 1/day, well under the 5/day floor.
      dailyApplicationGoal: 5, applicationGoalType: 'weekly',
      dailyOutreachGoal: 4, outreachGoalType: 'daily',
    });
    (prisma.candidateProfile.update as any).mockResolvedValue({});

    const settings = await m.promoteAndGetSettings('u1');
    expect(settings.appGoal).toBe(5);
    expect(settings.appGoalType).toBe('daily');
  });

  it('leaves an already-daily profile untouched', async () => {
    const { m, prisma } = await mod();
    (prisma.goalChange.findFirst as any).mockResolvedValue(null);
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({
      dailyApplicationGoal: 5, applicationGoalType: 'daily',
      dailyOutreachGoal: 4, outreachGoalType: 'daily',
    });

    const settings = await m.promoteAndGetSettings('u1');
    expect(settings).toEqual({ appGoal: 5, appGoalType: 'daily', outreachGoal: 4, outreachGoalType: 'daily' });
    expect(prisma.candidateProfile.update).not.toHaveBeenCalled();
  });
});

describe('proratedPace from the day they joined', () => {
  it('counts the whole week for someone who joined before it', async () => {
    const { proratedPace } = (await mod()).m;
    expect(proratedPace(20, 4)).toBe(16);
    expect(proratedPace(20, 4, 1)).toBe(16);
  });

  it('counts only the days since joining this week', async () => {
    const { proratedPace } = (await mod()).m;
    // Joined Thursday, looking on Thursday: one working day, not four.
    expect(proratedPace(20, 4, 4)).toBe(4);
    expect(proratedPace(20, 5, 4)).toBe(8);
  });

  it('asks nothing of someone who joined at the weekend until Monday', async () => {
    const { proratedPace } = (await mod()).m;
    expect(proratedPace(20, 6, 6)).toBe(0);
    expect(proratedPace(20, 7, 7)).toBe(0);
  });

  it('paceStartDay is Monday unless they joined this week', async () => {
    const { paceStartDay } = (await mod()).m;
    const monday = new Date('2026-10-26T00:00:00Z'); // AEST date token
    expect(paceStartDay(null, monday)).toBe(1);
    expect(paceStartDay(new Date('2026-10-20T03:00:00Z'), monday)).toBe(1);
    // 29 Oct 2026, 10am AEST = 00:00 UTC
    expect(paceStartDay(new Date('2026-10-29T00:00:00Z'), monday)).toBe(4);
  });
});

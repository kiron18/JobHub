import { describe, it, expect, vi, beforeEach } from 'vitest';

const trialChallenge = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};
const trialChallengeDay = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};
const jobApplication = { count: vi.fn() };
const candidateProfile = { findUnique: vi.fn() };

vi.mock('../../index', () => ({
  prisma: { trialChallenge, trialChallengeDay, jobApplication, candidateProfile },
}));

// engine.ts imports isPaidOrExempt from accessControl.ts, which imports
// hasComplimentaryAccess from routes/stripe.ts — importing that for real would
// construct the Stripe client and load email.ts's Resend client at module
// load, both of which need real API keys. Stub it the same way
// accessControl.test.ts does.
vi.mock('../../routes/stripe', () => ({
  EXEMPT_EMAILS: [],
  hasComplimentaryAccess: () => false,
}));

async function mod() {
  return import('./engine');
}

const DAY1_WINDOW_START = new Date('2026-06-07T00:00:00+10:00');
const DAY1_WINDOW_END = new Date('2026-06-07T00:30:00+10:00');

function baseTrial(overrides: Partial<any> = {}) {
  return {
    id: 'trial-1',
    userId: 'user-1',
    currentDay: 1,
    status: 'day_in_progress',
    windowStartedAt: DAY1_WINDOW_START,
    windowEndsAt: DAY1_WINDOW_END,
    linkedinUnlocked: false,
    passedDayAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  trialChallenge.update.mockImplementation(async ({ data }: any) => ({ ...data }));
});

describe('countApplicationsInWindow', () => {
  it('counts sent (non-SAVED) applications with dateApplied since the window started', async () => {
    const { countApplicationsInWindow } = await mod();
    jobApplication.count.mockResolvedValueOnce(3);
    const n = await countApplicationsInWindow('user-1', DAY1_WINDOW_START);
    expect(n).toBe(3);
    expect(jobApplication.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: { not: 'SAVED' }, dateApplied: { gte: DAY1_WINDOW_START } },
    });
  });
});

describe('forfeitureDeadline', () => {
  it('is the real instant of midnight AEST at the start of the day after next', async () => {
    const { forfeitureDeadline } = await mod();
    // Passed on 7 June (AEST, standard time, UTC+10) — deadline is real
    // midnight AEST starting the 9th, i.e. 2026-06-08T14:00:00Z.
    const deadline = forfeitureDeadline(new Date('2026-06-07T05:00:00Z')); // 15:00 AEST on the 7th
    expect(deadline.toISOString()).toBe('2026-06-08T14:00:00.000Z');
  });

  it('accounts for daylight saving (AEDT, UTC+11)', async () => {
    const { forfeitureDeadline } = await mod();
    // Passed on 7 January (AEDT, UTC+11) — deadline is real midnight AEDT
    // starting the 9th, i.e. 2026-01-08T13:00:00Z.
    const deadline = forfeitureDeadline(new Date('2026-01-07T04:00:00Z')); // 15:00 AEDT on the 7th
    expect(deadline.toISOString()).toBe('2026-01-08T13:00:00.000Z');
  });
});

describe('resolveTrialState', () => {
  it('returns null when the user has never started', async () => {
    const { resolveTrialState } = await mod();
    trialChallenge.findUnique.mockResolvedValueOnce(null);
    expect(await resolveTrialState('user-1')).toBeNull();
  });

  it('stays day_in_progress and unlocks LinkedIn the moment the minimum is crossed mid-window', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-07T00:10:00+10:00')); // 10 min into a 30-min window
    const { resolveTrialState } = await mod();
    trialChallenge.findUnique.mockResolvedValueOnce(baseTrial());
    jobApplication.count.mockResolvedValueOnce(2); // day 1 minimum is 2
    trialChallengeDay.findUnique.mockResolvedValueOnce({
      id: 'day-1', crossedMinimumAt: null, outcome: null,
    });

    const state = await resolveTrialState('user-1');

    expect(state?.status).toBe('day_in_progress');
    expect(state?.linkedinUnlocked).toBe(true);
    expect(state?.appliedThisWindow).toBe(2);
    expect(trialChallengeDay.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'day-1' },
      data: expect.objectContaining({ crossedMinimumAt: expect.any(Date) }),
    }));
    expect(trialChallenge.updateMany).toHaveBeenCalledWith({
      where: { id: 'trial-1', linkedinUnlocked: false },
      data: { linkedinUnlocked: true },
    });
    vi.useRealTimers();
  });

  it('passes a day whose minimum was crossed once the window elapses, and does not roll over to day 3 numbering', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-07T00:31:00+10:00')); // 1 min past the 30-min window
    const { resolveTrialState } = await mod();
    trialChallenge.findUnique.mockResolvedValueOnce(baseTrial({ linkedinUnlocked: true }));
    jobApplication.count.mockResolvedValueOnce(2);
    trialChallengeDay.findUnique.mockResolvedValueOnce({ id: 'day-1', crossedMinimumAt: DAY1_WINDOW_START, outcome: null });

    const state = await resolveTrialState('user-1');

    expect(state?.status).toBe('day_passed_waiting');
    expect(state?.forfeitureDeadline).not.toBeNull();
    expect(trialChallengeDay.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'day-1' },
      data: expect.objectContaining({ outcome: 'pass' }),
    }));
    vi.useRealTimers();
  });

  it('fails a day whose minimum was never crossed once the window elapses', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-07T00:31:00+10:00'));
    const { resolveTrialState } = await mod();
    trialChallenge.findUnique.mockResolvedValueOnce(baseTrial());
    jobApplication.count.mockResolvedValueOnce(1); // below the minimum of 2
    trialChallengeDay.findUnique.mockResolvedValueOnce({ id: 'day-1', crossedMinimumAt: null, outcome: null });

    const state = await resolveTrialState('user-1');

    expect(state?.status).toBe('day_failed');
    expect(trialChallengeDay.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ outcome: 'fail' }),
    }));
    vi.useRealTimers();
  });

  it('day 3 always completes when its window ends, regardless of application count', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-09T01:01:00+10:00'));
    const { resolveTrialState } = await mod();
    trialChallenge.findUnique.mockResolvedValueOnce(baseTrial({
      currentDay: 3,
      windowStartedAt: new Date('2026-06-09T00:00:00+10:00'),
      windowEndsAt: new Date('2026-06-09T01:00:00+10:00'),
      linkedinUnlocked: true,
    }));
    jobApplication.count.mockResolvedValueOnce(0);
    trialChallengeDay.findUnique.mockResolvedValueOnce({ id: 'day-3', crossedMinimumAt: null, outcome: null });

    const state = await resolveTrialState('user-1');
    expect(state?.status).toBe('completed');
    vi.useRealTimers();
  });

  it('forfeits a day_passed_waiting trial once the AEST-day-after deadline has passed', async () => {
    const { resolveTrialState, forfeitureDeadline } = await mod();
    const passedDayAt = new Date('2026-06-07T00:30:00+10:00');
    vi.useFakeTimers().setSystemTime(new Date(forfeitureDeadline(passedDayAt).getTime() + 1000));
    trialChallenge.findUnique.mockResolvedValueOnce(baseTrial({
      status: 'day_passed_waiting', passedDayAt, windowStartedAt: null, windowEndsAt: null,
    }));

    const state = await resolveTrialState('user-1');
    expect(state?.status).toBe('forfeited');
    vi.useRealTimers();
  });

  it('leaves a day_passed_waiting trial untouched while still inside the forfeiture window', async () => {
    const { resolveTrialState, forfeitureDeadline } = await mod();
    const passedDayAt = new Date('2026-06-07T00:30:00+10:00');
    vi.useFakeTimers().setSystemTime(new Date(forfeitureDeadline(passedDayAt).getTime() - 1000));
    trialChallenge.findUnique.mockResolvedValueOnce(baseTrial({
      status: 'day_passed_waiting', passedDayAt, windowStartedAt: null, windowEndsAt: null,
    }));

    const state = await resolveTrialState('user-1');
    expect(state?.status).toBe('day_passed_waiting');
    expect(trialChallenge.update).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('hasLinkedinTrialAccess', () => {
  it('is true only once linkedinUnlocked is set', async () => {
    const { hasLinkedinTrialAccess } = await mod();
    trialChallenge.findUnique.mockResolvedValueOnce({ linkedinUnlocked: true });
    expect(await hasLinkedinTrialAccess('user-1')).toBe(true);

    trialChallenge.findUnique.mockResolvedValueOnce({ linkedinUnlocked: false });
    expect(await hasLinkedinTrialAccess('user-1')).toBe(false);

    trialChallenge.findUnique.mockResolvedValueOnce(null);
    expect(await hasLinkedinTrialAccess('user-1')).toBe(false);
  });
});

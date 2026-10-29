import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const update = vi.fn();
const findFirst = vi.fn();
const send = vi.fn();

vi.mock('../index', () => ({
  prisma: {
    welcomeSession: { findMany: (...a: unknown[]) => findMany(...a), update: (...a: unknown[]) => update(...a) },
    candidateProfile: { findFirst: (...a: unknown[]) => findFirst(...a) },
  },
}));
vi.mock('../services/email', () => ({ sendWelcomeClaimReminderEmail: (...a: unknown[]) => send(...a) }));

beforeEach(() => { vi.clearAllMocks(); });

describe('runWelcomeRecovery', () => {
  it('asks only for captured, unclaimed, built sessions inside the window', async () => {
    findMany.mockResolvedValue([]);
    const { runWelcomeRecovery } = await import('./welcomeRecoveryCron');
    const now = new Date('2026-10-29T10:00:00Z');
    await runWelcomeRecovery(now);
    const where = findMany.mock.calls[0][0].where;
    expect(where.claimedByUserId).toBeNull();
    expect(where.claimReminderSentAt).toBeNull();
    expect(where.resumeCleanText).toEqual({ not: null });
    expect(where.emailCapturedAt.lte.toISOString()).toBe('2026-10-29T09:00:00.000Z');
    expect(where.createdAt.gte.toISOString()).toBe('2026-10-28T12:00:00.000Z');
  });

  it('marks before sending, and skips anyone who already has an account', async () => {
    findMany.mockResolvedValue([
      { id: 'a', token: 'ta', email: 'new@x.com', firstName: 'Ann' },
      { id: 'b', token: 'tb', email: 'member@x.com', firstName: 'Bo' },
    ]);
    findFirst.mockImplementation(({ where }: any) => Promise.resolve(where.email.equals === 'member@x.com' ? { id: 'p' } : null));
    send.mockResolvedValue(true);
    const { runWelcomeRecovery } = await import('./welcomeRecoveryCron');
    const r = await runWelcomeRecovery(new Date());
    expect(r).toEqual({ sent: 1, skipped: 1 });
    expect(update).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'new@x.com', token: 'ta' });
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
  });
});

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../index', () => ({ prisma: {} }));
vi.mock('../tracker/closeout', () => ({ computeDailyStreakBatch: vi.fn() }));

import { challengeDay } from './context';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('challengeDay', () => {
  it('is null until a start date is set', () => {
    expect(challengeDay(null, at('2026-10-01'))).toBeNull();
    expect(challengeDay(undefined, at('2026-10-01'))).toBeNull();
  });

  it('is day 1 on the start date and counts up', () => {
    // A start at noon AEST (02:00 UTC) is still that AEST calendar day.
    const start = new Date('2026-09-01T02:00:00.000Z');
    expect(challengeDay(start, at('2026-09-01'))).toBe(1);
    expect(challengeDay(start, at('2026-09-18'))).toBe(18);
  });

  it('is null once the 90 days are over, and before it begins', () => {
    const start = new Date('2026-09-01T02:00:00.000Z');
    expect(challengeDay(start, at('2026-11-29'))).toBe(90);
    expect(challengeDay(start, at('2026-11-30'))).toBeNull();
    expect(challengeDay(start, at('2026-08-30'))).toBeNull();
  });
});

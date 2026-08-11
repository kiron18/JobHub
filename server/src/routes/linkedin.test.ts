import { describe, it, expect } from 'vitest';
import { checkHeadshotRateLimit, getNextTouchDate, isOverdue } from './linkedin';

const DAY = 86_400_000;
const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY);

describe('checkHeadshotRateLimit', () => {
  it('allows generation when no prior usage', () => {
    expect(checkHeadshotRateLimit(0, null, 3)).toEqual({ allowed: true, usedToday: 0 });
  });

  it('allows generation when under limit today', () => {
    expect(checkHeadshotRateLimit(2, new Date(), 3)).toEqual({ allowed: true, usedToday: 2 });
  });

  it('blocks when limit reached today', () => {
    expect(checkHeadshotRateLimit(3, new Date(), 3)).toEqual({ allowed: false, usedToday: 3 });
  });

  it('resets counter when last generation was on a different day', () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    expect(checkHeadshotRateLimit(3, yesterday, 3)).toEqual({ allowed: true, usedToday: 0 });
  });
});

describe('outreach ladder cadence', () => {
  const last = new Date('2026-01-01T00:00:00Z');

  it('schedules the first message 4 days after the connection note', () => {
    expect(daysBetween(last, getNextTouchDate(last, 2)!)).toBe(4);
  });

  it('schedules the third touch 6 days later', () => {
    expect(daysBetween(last, getNextTouchDate(last, 3)!)).toBe(6);
  });

  // The whole point of the fifth template: it is useless unless something
  // reminds you three weeks after the thread went quiet.
  it('schedules the re-contact 21 days after the previous touch', () => {
    expect(daysBetween(last, getNextTouchDate(last, 4)!)).toBe(21);
  });

  it('stops reminding once the re-contact has been sent', () => {
    expect(getNextTouchDate(last, 5)).toBeNull();
    expect(getNextTouchDate(last, 9)).toBeNull();
  });

  it('treats a finished ladder as not overdue rather than permanently due', () => {
    expect(isOverdue(getNextTouchDate(last, 5))).toBe(false);
  });

  it('marks a past date overdue and a future date not', () => {
    expect(isOverdue(new Date(Date.now() - DAY))).toBe(true);
    expect(isOverdue(new Date(Date.now() + DAY))).toBe(false);
  });

  it('does not make the re-contact due before 3 weeks have passed', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * DAY);
    expect(isOverdue(getNextTouchDate(twoWeeksAgo, 4))).toBe(false);
    const fourWeeksAgo = new Date(Date.now() - 28 * DAY);
    expect(isOverdue(getNextTouchDate(fourWeeksAgo, 4))).toBe(true);
  });
});

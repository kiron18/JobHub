import { describe, it, expect } from 'vitest';
import { statusEmailDue, APPLIED_SUBJECT, REJECTED_SUBJECT } from './statusEmailGate';

const NOW = new Date('2026-10-19T09:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe('statusEmailDue', () => {
  it('sends the applied email for a first application', () => {
    expect(statusEmailDue('APPLIED', [], NOW)).toBe(true);
  });

  it('never sends the applied email twice, whatever the gap', () => {
    expect(statusEmailDue('APPLIED', [{ subject: APPLIED_SUBJECT, sentAt: daysAgo(60) }], NOW)).toBe(false);
  });

  it('counts the old per-role subject as already sent', () => {
    const old = { subject: 'Following up on your Data Analyst application: a reminder', sentAt: daysAgo(10) };
    expect(statusEmailDue('APPLIED', [old], NOW)).toBe(false);
  });

  it('sends a rejection once a week at most', () => {
    expect(statusEmailDue('REJECTED', [{ subject: REJECTED_SUBJECT, sentAt: daysAgo(3) }], NOW)).toBe(false);
    expect(statusEmailDue('REJECTED', [{ subject: REJECTED_SUBJECT, sentAt: daysAgo(8) }], NOW)).toBe(true);
  });

  it('a rejection is not held back by an old applied email', () => {
    expect(statusEmailDue('REJECTED', [{ subject: APPLIED_SUBJECT, sentAt: daysAgo(2) }], NOW)).toBe(true);
  });

  it('sends nothing within a day of the last status email', () => {
    expect(statusEmailDue('REJECTED', [{ subject: APPLIED_SUBJECT, sentAt: daysAgo(0.5) }], NOW)).toBe(false);
  });
});

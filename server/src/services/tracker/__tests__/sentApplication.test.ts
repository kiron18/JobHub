import { describe, it, expect } from 'vitest';
import { SENT_APPLICATION_FILTER, SENT_STATUSES, isSentStatus, countDistinctJobs } from '../metricHelpers';

describe('the definition of a sent application', () => {
  it('counts everything that left SAVED, not only APPLIED', () => {
    // The bug this locks out: counting status === 'APPLIED' dropped every
    // application that progressed to interview, rejection or offer.
    expect(isSentStatus('APPLIED')).toBe(true);
    expect(isSentStatus('INTERVIEW')).toBe(true);
    expect(isSentStatus('REJECTED')).toBe(true);
    expect(isSentStatus('OFFER')).toBe(true);
  });

  it('does not count a saved job as sent', () => {
    expect(isSentStatus('SAVED')).toBe(false);
  });

  it('keeps SENT_STATUSES and the prisma filter in step', () => {
    expect(SENT_APPLICATION_FILTER).toEqual({ status: { not: 'SAVED' } });
    expect([...SENT_STATUSES].every(isSentStatus)).toBe(true);
    expect(SENT_STATUSES).not.toContain('SAVED');
  });
});

describe('countDistinctJobs', () => {
  it('collapses repeat applications to the same job URL', () => {
    expect(countDistinctJobs([
      { sourceUrl: 'https://x/1', id: 'a' },
      { sourceUrl: 'https://x/1', id: 'b' },
      { sourceUrl: 'https://x/2', id: 'c' },
    ])).toBe(2);
  });

  it('treats rows with no URL as distinct, never merging them', () => {
    // Every paying client's applications currently have a null sourceUrl.
    // Falling back to the row id is what stops them collapsing into one.
    expect(countDistinctJobs([
      { sourceUrl: null, id: 'a' },
      { sourceUrl: null, id: 'b' },
      { sourceUrl: null, id: 'c' },
    ])).toBe(3);
  });
});

import { describe, it, expect } from 'vitest';
import { countDistinctJobs, bucketByDay } from './metricHelpers';

describe('countDistinctJobs', () => {
  it('dedupes by sourceUrl', () => {
    expect(countDistinctJobs([
      { sourceUrl: 'a' }, { sourceUrl: 'a' }, { sourceUrl: 'b' },
    ])).toBe(2);
  });
  it('counts null sourceUrl rows individually by fallback id', () => {
    expect(countDistinctJobs([{ sourceUrl: null, id: '1' }, { sourceUrl: null, id: '2' }])).toBe(2);
  });
});

describe('bucketByDay', () => {
  it('zero-fills a trailing window and counts distinct jobs per AEST day', () => {
    const today = new Date('2026-06-17T00:00:00+10:00');
    const rows = [
      { sourceUrl: 'a', dateApplied: new Date('2026-06-17T03:00:00+10:00') },
      { sourceUrl: 'a', dateApplied: new Date('2026-06-17T05:00:00+10:00') }, // dup job, same day
      { sourceUrl: 'b', dateApplied: new Date('2026-06-16T09:00:00+10:00') },
    ];
    const out = bucketByDay(rows, 3, today);
    expect(out).toHaveLength(3);
    expect(out.find(d => d.date === '2026-06-17')!.count).toBe(1); // a counted once
    expect(out.find(d => d.date === '2026-06-16')!.count).toBe(1);
    expect(out.find(d => d.date === '2026-06-15')!.count).toBe(0); // zero-filled
  });
});

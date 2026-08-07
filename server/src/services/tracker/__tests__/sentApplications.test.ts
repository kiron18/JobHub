import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryRaw = vi.fn();

vi.mock('../../../index', () => ({
  prisma: {
    get $queryRaw() { return queryRaw; },
  },
}));

import { sentApplicationTotals, sentApplicationCounts } from '../sentApplications';

/** Reassemble the SQL a tagged-template call would send. */
function capturedSql(): string {
  const [strings] = queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
  return strings.join(' ? ').replace(/\s+/g, ' ');
}

describe('sentApplicationTotals', () => {
  beforeEach(() => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([]);
  });

  it('does not touch the database for an empty cohort', async () => {
    expect(await sentApplicationTotals([])).toEqual(new Map());
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('counts distinct jobs, not rows', async () => {
    // The defect this locks out: the roster counted rows while the coach view
    // deduplicated, so the same client showed two different totals. Logging
    // one advert twice has to collapse in SQL exactly as countDistinctJobs
    // collapses it in Node.
    await sentApplicationTotals(['u1']);
    expect(capturedSql()).toContain('COUNT(DISTINCT COALESCE("sourceUrl", "id"))');
  });

  it('only counts applications that left SAVED', async () => {
    await sentApplicationTotals(['u1']);
    expect(capturedSql()).toContain(`"status" <> 'SAVED'`);
  });

  it('does not filter on dateApplied — an undated send is still a send', async () => {
    // Counting on dateApplied was the old trap: the field is only set when a
    // date is supplied, so real applications went missing from the total.
    await sentApplicationTotals(['u1']);
    expect(capturedSql()).not.toMatch(/WHERE[\s\S]*"dateApplied" IS NOT NULL/);
  });

  it('reports undated sends separately so the gap is visible', async () => {
    queryRaw.mockResolvedValue([{ userId: 'u1', sent: 82n, undated: 6n }]);
    const totals = await sentApplicationTotals(['u1']);
    expect(totals.get('u1')).toEqual({ sent: 82, undated: 6 });
  });

  it('returns plain numbers, not the bigints postgres COUNT hands back', async () => {
    queryRaw.mockResolvedValue([{ userId: 'u1', sent: 3n, undated: 0n }]);
    const counts = await sentApplicationCounts(['u1']);
    expect(counts.get('u1')).toBe(3);
    expect(typeof counts.get('u1')).toBe('number');
  });

  it('omits users with nothing sent rather than reporting a wrong zero row', async () => {
    queryRaw.mockResolvedValue([{ userId: 'u1', sent: 1n, undated: 0n }]);
    const counts = await sentApplicationCounts(['u1', 'u2']);
    expect(counts.has('u2')).toBe(false);
  });
});

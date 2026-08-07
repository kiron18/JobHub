import { Prisma } from '@prisma/client';
import { prisma } from '../../index';

/**
 * The database side of the one definition of a sent application.
 *
 * metricHelpers owns the *rules* — status must have left SAVED
 * (SENT_APPLICATION_FILTER) and the same job logged twice counts once
 * (countDistinctJobs). This owns the *totals*, so the coach view, the client's
 * own tracker and the admin roster all quote a number computed the same way
 * instead of each rolling their own query.
 *
 * The counting is pushed into Postgres because the callers are whole-cohort:
 * pulling every application row back into Node to build a Set was the reason
 * the roster and the coach view drifted apart in the first place — one of them
 * deduplicated, the other did not, and nothing made that visible.
 */
export interface SentApplicationTotals {
  /** Distinct jobs the member has actually sent, all time. */
  sent: number;
  /**
   * Of those, how many carry no dateApplied.
   *
   * These are real applications that cannot be placed in a week, so they are
   * missing from every weekly count, the streak and the activity heatmap while
   * still being part of the lifetime total. Reported rather than hidden: a
   * non-zero number here is the exact gap between the coach's weekly columns
   * and the lifetime column, and it means a row needs its date repaired.
   */
  undated: number;
}

export async function sentApplicationTotals(
  userIds: string[],
): Promise<Map<string, SentApplicationTotals>> {
  if (userIds.length === 0) return new Map();

  // COALESCE("sourceUrl", "id") is countDistinctJobs' jobKey in SQL: two rows
  // for the same advert collapse, and a row with no sourceUrl falls back to its
  // own id so it still counts once.
  const rows = await prisma.$queryRaw<Array<{ userId: string; sent: bigint; undated: bigint }>>`
    SELECT "userId",
           COUNT(DISTINCT COALESCE("sourceUrl", "id")) AS sent,
           COUNT(DISTINCT CASE WHEN "dateApplied" IS NULL
                               THEN COALESCE("sourceUrl", "id") END) AS undated
    FROM "JobApplication"
    WHERE "userId" IN (${Prisma.join(userIds)})
      AND "status" <> 'SAVED'
    GROUP BY "userId"
  `;

  return new Map(
    rows.map(r => [r.userId, { sent: Number(r.sent), undated: Number(r.undated) }]),
  );
}

/** Convenience wrapper for callers that only need the headline number. */
export async function sentApplicationCounts(userIds: string[]): Promise<Map<string, number>> {
  const totals = await sentApplicationTotals(userIds);
  return new Map([...totals].map(([userId, t]) => [userId, t.sent]));
}

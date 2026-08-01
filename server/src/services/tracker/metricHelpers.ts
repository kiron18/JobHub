export interface JobRef { sourceUrl: string | null; id?: string; }
export interface AppliedRow extends JobRef { dateApplied: Date; }

/**
 * The single definition of "this application was sent".
 *
 * An application is sent the moment it leaves SAVED. APPLIED, INTERVIEW,
 * REJECTED and OFFER all mean the client put it in front of an employer —
 * interview and rejection are what happens *after* sending, not instead of it.
 *
 * This exists because three different definitions were live at once and the
 * admin panel disagreed with the client's own tracker for the same person:
 *
 *   - admin user-usage counted status === 'APPLIED', so every application that
 *     progressed to interview, rejection or offer silently vanished from the
 *     total;
 *   - the funnel counted status !== 'SAVED';
 *   - the client tracker, leaderboard and coach view counted dateApplied,
 *     ignoring status entirely.
 *
 * Anything counting sent applications must use this filter. Counting on
 * dateApplied alone is the trap: the field is only populated when the client
 * happens to supply a date, so it under-reports real applications.
 */
export const SENT_APPLICATION_FILTER = { status: { not: 'SAVED' } } as const;

/** Statuses that mean the application was sent. Keep in step with SENT_APPLICATION_FILTER. */
export const SENT_STATUSES = ['APPLIED', 'INTERVIEW', 'REJECTED', 'OFFER'] as const;

export function isSentStatus(status: string): boolean {
  return status !== 'SAVED';
}

function jobKey(r: JobRef): string {
  return r.sourceUrl ?? `__id:${r.id ?? Math.random()}`;
}

export function countDistinctJobs(rows: JobRef[]): number {
  return new Set(rows.map(jobKey)).size;
}

// yyyy-mm-dd in AEST (UTC+10, no DST handling — matches todayAEST convention).
function aestDateStr(d: Date): string {
  const aest = new Date(d.getTime() + 10 * 3600 * 1000);
  return aest.toISOString().slice(0, 10);
}

export function bucketByDay(rows: AppliedRow[], days: number, todayStartAest: Date): Array<{ date: string; count: number }> {
  const byDay = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = aestDateStr(r.dateApplied);
    if (!byDay.has(key)) byDay.set(key, new Set());
    byDay.get(key)!.add(jobKey(r));
  }
  const out: Array<{ date: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayStartAest.getTime() - i * 86400000);
    const key = aestDateStr(d);
    out.push({ date: key, count: byDay.get(key)?.size ?? 0 });
  }
  return out;
}

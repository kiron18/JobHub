export interface JobRef { sourceUrl: string | null; id?: string; }
export interface AppliedRow extends JobRef { dateApplied: Date; }

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

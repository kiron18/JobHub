import { prisma } from '../../index';
import { SENT_APPLICATION_FILTER } from './metricHelpers';

/**
 * Every hundred sent applications, the daily grind gets a moment of real
 * feedback instead of another day of the same form. See GoalCard/applause.ts
 * for the same honesty-over-hype rule: the card only ever reflects the
 * candidate's own data back, never a manufactured benchmark.
 */
export const MILESTONE_STEP = 100;

/** A tag needs this many applications before its interview rate means anything. */
const MIN_TAG_SAMPLE = 3;

export interface TagBreakdown {
  tag: string;
  applied: number;
  interviewed: number;
  interviewRate: number; // 0..1
}

export interface MilestoneState {
  eligible: boolean;
  milestone: number; // the milestone this state describes (0 if none crossed yet)
  totalSent: number;
  overall: { interviewed: number; offered: number; interviewRate: number };
  byTag: TagBreakdown[];
}

function jobKey(r: { sourceUrl: string | null; id: string }): string {
  return r.sourceUrl ?? `__id:${r.id}`;
}

/**
 * One row per distinct job, most-recent kept when the same job was logged
 * twice — matches the dedup rule in metricHelpers.countDistinctJobs.
 */
function dedupeByJob<T extends { sourceUrl: string | null; id: string }>(rows: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const r of rows) byKey.set(jobKey(r), r);
  return [...byKey.values()];
}

export async function getMilestoneState(userId: string): Promise<MilestoneState> {
  const [profile, rows] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { userId }, select: { applicationMilestoneSeen: true } }),
    prisma.jobApplication.findMany({
      where: { userId, ...SENT_APPLICATION_FILTER },
      select: { id: true, sourceUrl: true, matchedIdentityCard: true, interviewReachedAt: true, offerReachedAt: true },
    }),
  ]);

  const applications = dedupeByJob(rows);
  const totalSent = applications.length;
  const milestone = Math.floor(totalSent / MILESTONE_STEP) * MILESTONE_STEP;
  const seen = profile?.applicationMilestoneSeen ?? 0;
  const eligible = milestone > 0 && milestone > seen;

  const interviewedRows = applications.filter(a => a.interviewReachedAt !== null);
  const overall = {
    interviewed: interviewedRows.length,
    offered: applications.filter(a => a.offerReachedAt !== null).length,
    interviewRate: totalSent > 0 ? interviewedRows.length / totalSent : 0,
  };

  const byTagMap = new Map<string, { applied: number; interviewed: number }>();
  for (const a of applications) {
    const tag = a.matchedIdentityCard?.trim();
    if (!tag) continue; // untagged applications don't inform "what's converting"
    const entry = byTagMap.get(tag) ?? { applied: 0, interviewed: 0 };
    entry.applied++;
    if (a.interviewReachedAt !== null) entry.interviewed++;
    byTagMap.set(tag, entry);
  }

  const byTag: TagBreakdown[] = [...byTagMap.entries()]
    .filter(([, v]) => v.applied >= MIN_TAG_SAMPLE)
    .map(([tag, v]) => ({ tag, applied: v.applied, interviewed: v.interviewed, interviewRate: v.interviewed / v.applied }))
    .sort((a, b) => b.interviewRate - a.interviewRate || b.applied - a.applied);

  return { eligible, milestone: eligible ? milestone : seen, totalSent, overall, byTag };
}

/**
 * Marks a milestone as shown. Only moves forward — a stale/older ack from a
 * slow client can never roll the seen marker backwards.
 */
export async function ackMilestone(userId: string, milestone: number): Promise<void> {
  await prisma.candidateProfile.updateMany({
    where: { userId, applicationMilestoneSeen: { lt: milestone } },
    data: { applicationMilestoneSeen: milestone },
  });
}

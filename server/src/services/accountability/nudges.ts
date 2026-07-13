import { prisma } from '../../index';
import { todayAEST } from '../jobFeed';
import { getRealUserIds } from '../../routes/admin';
import {
  mondayAEST,
  aestDayOfWeek,
  proratedPace,
  weeklyEquivalent,
  computeStreak,
  getWeeklyCountsBatch,
  WEEKLY_MINIMUM,
  type GoalType,
  type WeekCounts,
} from '../tracker/goals';
import { sendPaceNudgeEmail, sendWeeklyWrapEmail, sendCoachDigestEmail } from '../email';

const DAY_MS = 86400000;

export type NudgeKind = 'daily_pace' | 'weekly_wrap' | 'coach_digest';

/** Master switch — nothing is ever emailed unless this env var is exactly 'true'. */
export function accountabilityEmailsEnabled(): boolean {
  return process.env.ACCOUNTABILITY_EMAILS === 'true';
}

export interface NudgeRunResult {
  kind: NudgeKind;
  dryRun: boolean;
  enabled: boolean;
  sent: Array<{ email: string; name: string; reason: string }>;
  skipped: Array<{ email: string; reason: string }>;
}

interface Member {
  userId: string;
  name: string;
  email: string;
  weeklyAppTarget: number;
  weeklyOutreachTarget: number;
  weekly: WeekCounts[];
}

/**
 * Who accountability emails go to. Default: paying/trialing members only
 * (plan !== 'free'), since nudges are a coaching feature, not marketing.
 * Set ACCOUNTABILITY_EMAILS_AUDIENCE=all to include free accounts.
 */
async function getMembers(): Promise<Member[]> {
  const userIds = await getRealUserIds();
  if (userIds.length === 0) return [];
  const includeFree = process.env.ACCOUNTABILITY_EMAILS_AUDIENCE === 'all';

  const [profiles, weeklyMap] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { userId: { in: userIds }, email: { not: null } },
      select: {
        userId: true, name: true, email: true, plan: true,
        dailyApplicationGoal: true, applicationGoalType: true,
        dailyOutreachGoal: true, outreachGoalType: true,
      },
    }),
    getWeeklyCountsBatch(userIds, 8),
  ]);

  return profiles
    .filter(p => p.email && !p.email.endsWith('@jobhub-test.local'))
    .filter(p => includeFree || p.plan !== 'free')
    .map(p => ({
      userId: p.userId,
      name: (p.name ?? '').split(/\s+/)[0] || (p.email ?? '').split('@')[0],
      email: p.email!,
      weeklyAppTarget: weeklyEquivalent(p.dailyApplicationGoal, (p.applicationGoalType === 'weekly' ? 'weekly' : 'daily') as GoalType),
      weeklyOutreachTarget: weeklyEquivalent(p.dailyOutreachGoal, (p.outreachGoalType === 'weekly' ? 'weekly' : 'daily') as GoalType),
      weekly: weeklyMap.get(p.userId)!,
    }));
}

/** True if this (userId, kind, periodKey) was already sent; otherwise records it. */
async function claimNudge(userId: string, kind: NudgeKind, periodKey: string): Promise<boolean> {
  try {
    await prisma.nudgeLog.create({ data: { userId, kind, periodKey } });
    return true;
  } catch {
    return false; // unique violation → already sent this period
  }
}

/**
 * 5pm AEST weekday nudge for anyone behind the prorated weekly pace.
 * Idempotent per (user, day) via NudgeLog, so a restart can never double-send.
 */
export async function runPaceNudges(opts: { dryRun?: boolean; force?: boolean } = {}): Promise<NudgeRunResult> {
  const dryRun = opts.dryRun ?? false;
  const result: NudgeRunResult = { kind: 'daily_pace', dryRun, enabled: accountabilityEmailsEnabled(), sent: [], skipped: [] };
  const dow = aestDayOfWeek();
  if (dow > 5 && !opts.force) {
    result.skipped.push({ email: '*', reason: 'weekend — no pace nudges' });
    return result;
  }

  const todayKey = todayAEST().toISOString().slice(0, 10);
  const members = await getMembers();

  for (const m of members) {
    const week = m.weekly[m.weekly.length - 1];
    if (week.paused) { result.skipped.push({ email: m.email, reason: 'paused week' }); continue; }

    const appsPace = proratedPace(m.weeklyAppTarget, dow);
    const outreachPace = proratedPace(m.weeklyOutreachTarget, dow);
    const behindApps = week.applications < appsPace;
    const behindOutreach = week.outreach < outreachPace;
    if (!behindApps && !behindOutreach) { result.skipped.push({ email: m.email, reason: 'on pace' }); continue; }

    const reason = `apps ${week.applications}/${appsPace}, outreach ${week.outreach}/${outreachPace} (pace for ${todayKey})`;
    if (dryRun) { result.sent.push({ email: m.email, name: m.name, reason }); continue; }
    if (!result.enabled) { result.skipped.push({ email: m.email, reason: 'ACCOUNTABILITY_EMAILS not enabled' }); continue; }
    if (!(await claimNudge(m.userId, 'daily_pace', todayKey))) {
      result.skipped.push({ email: m.email, reason: 'already sent today' });
      continue;
    }
    try {
      await sendPaceNudgeEmail({
        to: m.email, name: m.name,
        applications: week.applications, applicationsPace: appsPace,
        outreach: week.outreach, outreachPace,
        weeklyAppTarget: m.weeklyAppTarget, weeklyOutreachTarget: m.weeklyOutreachTarget,
      });
      result.sent.push({ email: m.email, name: m.name, reason });
    } catch (err: any) {
      console.error(`[nudges] pace email failed for ${m.email}:`, err?.message ?? err);
      result.skipped.push({ email: m.email, reason: `send failed: ${err?.message ?? 'unknown'}` });
    }
  }
  return result;
}

/** Misses in a row counting backwards from the last completed week (pause weeks skipped). */
function consecutiveMisses(weekly: WeekCounts[]): number {
  let misses = 0;
  for (let i = weekly.length - 2; i >= 0; i--) {
    const w = weekly[i];
    if (w.paused) continue;
    if (w.applications >= WEEKLY_MINIMUM.applications && w.outreach >= WEEKLY_MINIMUM.outreach) break;
    misses++;
  }
  return misses;
}

/**
 * Monday-morning wrap of the completed week: congratulations + streak, or a
 * miss email that escalates in tone at 2+ consecutive missed weeks.
 */
export async function runWeeklyWraps(opts: { dryRun?: boolean } = {}): Promise<NudgeRunResult> {
  const dryRun = opts.dryRun ?? false;
  const result: NudgeRunResult = { kind: 'weekly_wrap', dryRun, enabled: accountabilityEmailsEnabled(), sent: [], skipped: [] };
  const lastWeekKey = new Date(mondayAEST().getTime() - 7 * DAY_MS).toISOString().slice(0, 10);
  const members = await getMembers();

  for (const m of members) {
    const lastWeek = m.weekly[m.weekly.length - 2];
    if (!lastWeek) { result.skipped.push({ email: m.email, reason: 'no completed week' }); continue; }
    if (lastWeek.paused) { result.skipped.push({ email: m.email, reason: 'paused week' }); continue; }

    const hit = lastWeek.applications >= WEEKLY_MINIMUM.applications && lastWeek.outreach >= WEEKLY_MINIMUM.outreach;
    // Streak as of the end of last week (exclude the just-started current week).
    const streak = computeStreak(m.weekly.slice(0, -1));
    const misses = hit ? 0 : consecutiveMisses(m.weekly);
    const reason = hit ? `hit (${lastWeek.applications} apps, ${lastWeek.outreach} outreach, streak ${streak})` : `missed (${lastWeek.applications} apps, ${lastWeek.outreach} outreach, ${misses} in a row)`;

    if (dryRun) { result.sent.push({ email: m.email, name: m.name, reason }); continue; }
    if (!result.enabled) { result.skipped.push({ email: m.email, reason: 'ACCOUNTABILITY_EMAILS not enabled' }); continue; }
    if (!(await claimNudge(m.userId, 'weekly_wrap', lastWeekKey))) {
      result.skipped.push({ email: m.email, reason: 'already sent for this week' });
      continue;
    }
    try {
      await sendWeeklyWrapEmail({
        to: m.email, name: m.name, hit,
        applications: lastWeek.applications, outreach: lastWeek.outreach,
        appsTarget: WEEKLY_MINIMUM.applications, outreachTarget: WEEKLY_MINIMUM.outreach,
        streak, consecutiveMisses: misses,
      });
      result.sent.push({ email: m.email, name: m.name, reason });
    } catch (err: any) {
      console.error(`[nudges] weekly wrap failed for ${m.email}:`, err?.message ?? err);
      result.skipped.push({ email: m.email, reason: `send failed: ${err?.message ?? 'unknown'}` });
    }
  }
  return result;
}

/** Monday-morning digest to the coach: who missed, who hit, flags, goal changes. */
export async function runCoachDigest(opts: { dryRun?: boolean } = {}): Promise<NudgeRunResult> {
  const dryRun = opts.dryRun ?? false;
  const result: NudgeRunResult = { kind: 'coach_digest', dryRun, enabled: accountabilityEmailsEnabled(), sent: [], skipped: [] };
  const coachEmail = process.env.ADMIN_EMAIL ?? 'kiron@aussiegradcareers.com.au';
  const lastWeekKey = new Date(mondayAEST().getTime() - 7 * DAY_MS).toISOString().slice(0, 10);
  const members = await getMembers();

  const missed: Array<{ name: string; email: string; applications: number; outreach: number; consecutiveMisses: number }> = [];
  const hit: Array<{ name: string; applications: number; outreach: number; streak: number }> = [];
  for (const m of members) {
    const lastWeek = m.weekly[m.weekly.length - 2];
    if (!lastWeek || lastWeek.paused) continue;
    const ok = lastWeek.applications >= WEEKLY_MINIMUM.applications && lastWeek.outreach >= WEEKLY_MINIMUM.outreach;
    if (ok) hit.push({ name: m.name, applications: lastWeek.applications, outreach: lastWeek.outreach, streak: computeStreak(m.weekly.slice(0, -1)) });
    else missed.push({ name: m.name, email: m.email, applications: lastWeek.applications, outreach: lastWeek.outreach, consecutiveMisses: consecutiveMisses(m.weekly) });
  }

  const memberIds = members.map(m => m.userId);
  const nameById = new Map(members.map(m => [m.userId, m.name]));
  const [recentCreated, recentChanges] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { userId: { in: memberIds }, createdAt: { gte: new Date(Date.now() - 14 * DAY_MS) }, dateApplied: { not: null } },
      select: { userId: true, createdAt: true, dateApplied: true },
    }),
    prisma.goalChange.findMany({
      where: { userId: { in: memberIds }, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const backdatedByUser = new Map<string, number>();
  for (const r of recentCreated) {
    if (r.createdAt.getTime() - (r.dateApplied!.getTime() - 10 * 3600 * 1000) > 2.5 * DAY_MS) {
      backdatedByUser.set(r.userId, (backdatedByUser.get(r.userId) ?? 0) + 1);
    }
  }
  const backdated = [...backdatedByUser.entries()].map(([userId, count]) => ({ name: nameById.get(userId) ?? userId, count }));
  const goalChanges = recentChanges.map(c => ({
    name: nameById.get(c.userId) ?? c.userId,
    summary: `${c.appGoal}/${c.appGoalType === 'weekly' ? 'wk' : 'day'} apps, ${c.outreachGoal}/${c.outreachGoalType === 'weekly' ? 'wk' : 'day'} outreach${c.byCoach ? ' (coach)' : ''}`,
  }));

  const reason = `${missed.length} missed, ${hit.length} hit, ${backdated.length} backdating flags`;
  if (dryRun) { result.sent.push({ email: coachEmail, name: 'coach', reason }); return result; }
  if (!result.enabled) { result.skipped.push({ email: coachEmail, reason: 'ACCOUNTABILITY_EMAILS not enabled' }); return result; }
  if (!(await claimNudge('coach', 'coach_digest', lastWeekKey))) {
    result.skipped.push({ email: coachEmail, reason: 'already sent for this week' });
    return result;
  }
  try {
    await sendCoachDigestEmail({ to: coachEmail, weekLabel: lastWeekKey, missed, hit, backdated, goalChanges });
    result.sent.push({ email: coachEmail, name: 'coach', reason });
  } catch (err: any) {
    console.error('[nudges] coach digest failed:', err?.message ?? err);
    result.skipped.push({ email: coachEmail, reason: `send failed: ${err?.message ?? 'unknown'}` });
  }
  return result;
}

// server/src/services/applicationCap.ts
import { prisma } from '../index';
import { todayAEST } from './jobFeed';

// Daily safety cap on applications during the trial. One application = one Apply
// that generates a resume + cover letter pair. Resets each AEST day. Tunable.
export const DAILY_APPLICATION_CAP = 25;

// Number of applications the user has started today (AEST). Counts every
// JobApplication row created today regardless of status, so cost is bounded at
// generation start, not completion.
export async function countTodaysApplications(userId: string): Promise<number> {
  return prisma.jobApplication.count({
    where: { userId, createdAt: { gte: todayAEST() } },
  });
}

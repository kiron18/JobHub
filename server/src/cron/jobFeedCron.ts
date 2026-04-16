import cron from 'node-cron';
import { prisma } from '../index';
import { buildDailyFeed } from '../services/jobFeed';

// 21:00 UTC daily = 7:00 AEST
export function startJobFeedCron(): void {
  cron.schedule('0 21 * * *', async () => {
    console.log('[jobFeedCron] Starting daily feed pre-fetch');

    let users: { userId: string }[] = [];
    try {
      users = await prisma.candidateProfile.findMany({
        where: { dashboardAccess: true, hasCompletedOnboarding: true },
        select: { userId: true },
      });
    } catch (err) {
      console.error('[jobFeedCron] Failed to load users:', err);
      return;
    }

    console.log(`[jobFeedCron] Pre-fetching for ${users.length} users`);

    for (const { userId } of users) {
      try {
        await buildDailyFeed(userId);
        console.log(`[jobFeedCron] ✓ ${userId}`);
      } catch (err: any) {
        console.error(`[jobFeedCron] ✗ ${userId}:`, err.message);
      }
    }

    console.log('[jobFeedCron] Complete');
  });
}

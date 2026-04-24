import cron from 'node-cron';
import { prisma } from '../index';
import { buildDailyFeed } from '../services/jobFeed';
import { prewarmSeekClusters } from '../services/seekScraper';

// 21:00 UTC daily = 7:00 AEST
let cronStarted = false;

export function startJobFeedCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  cron.schedule('0 21 * * *', async () => {
    console.log('[jobFeedCron] Starting daily feed pre-fetch');

    let users: { userId: string; targetRole: string | null; targetCity: string | null; industry: string | null }[] = [];
    try {
      users = await prisma.candidateProfile.findMany({
        where: { dashboardAccess: true, hasCompletedOnboarding: true },
        select: { userId: true, targetRole: true, targetCity: true, industry: true },
      });
    } catch (err) {
      console.error('[jobFeedCron] Failed to load users:', err);
      return;
    }

    const eligibleUsers = users.filter(
      (u): u is { userId: string; targetRole: string; targetCity: string; industry: string | null } =>
        !!u.targetRole && !!u.targetCity
    );

    console.log(`[jobFeedCron] Pre-fetching for ${eligibleUsers.length} users`);

    // Prewarm Seek cache for all unique clusters in parallel
    try {
      await prewarmSeekClusters(eligibleUsers);
    } catch (err) {
      console.error('[jobFeedCron] Seek prewarm failed (non-fatal):', err);
    }

    // Build per-user feeds — Seek now uses cache, Adzuna fetched per user
    for (const { userId } of eligibleUsers) {
      try {
        await buildDailyFeed(userId);
        console.log(`[jobFeedCron] ✓ ${userId}`);
      } catch (err: any) {
        console.error(`[jobFeedCron] ✗ ${userId}:`, err instanceof Error ? err.message : String(err));
      }
    }

    console.log('[jobFeedCron] Complete');
  });
}

import cron from 'node-cron';
import { prisma } from '../index';
import { buildDailyFeed } from '../services/jobFeed';
import { prewarmSeekClusters } from '../services/seekScraper';
import { prewarmLinkedInClusters } from '../services/linkedinScraper';

let cronStarted = false;

export function startJobFeedCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // 21:00 UTC daily = 7:00 AEST
  cron.schedule('0 21 * * *', async () => {
    console.log('[jobFeedCron] Starting daily feed pre-fetch');

    let users: { userId: string; targetRole: string; targetCity: string; industry: string | null }[] = [];
    try {
      const profiles = await prisma.candidateProfile.findMany({
        where: {
          hasCompletedOnboarding: true,
          plan: { not: 'free' },
          planStatus: { in: ['active', 'trialing'] },
        },
        select: { userId: true, targetRole: true, targetCity: true, industry: true },
      });
      users = profiles.filter(
        (p): p is typeof users[number] => !!p.targetRole && !!p.targetCity
      );
    } catch (err) {
      console.error('[jobFeedCron] Failed to load users:', err);
      return;
    }

    // Prewarm Seek and LinkedIn caches in parallel across unique clusters
    try {
      await Promise.all([
        prewarmSeekClusters(users),
        prewarmLinkedInClusters(users),
      ]);
    } catch (err) {
      console.error('[jobFeedCron] Prewarm failed (non-fatal):', err);
    }

    // Build per-user feeds — scrapers use cache, Adzuna fetched per user
    for (const { userId } of users) {
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

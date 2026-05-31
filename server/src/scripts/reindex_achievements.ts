/**
 * Re-index every achievement into Pinecone.
 *
 * Why: a bug passed null metadata (metric/metricType) to Pinecone, which rejects
 * null values — so every metric-less achievement silently failed to index and was
 * invisible to search. After fixing indexAchievement to strip nulls, existing
 * achievements still need to be pushed in. This backfills them.
 *
 * Usage:  npx tsx src/scripts/reindex_achievements.ts
 * Requires: DATABASE_URL, PINECONE_API_KEY, and the embedding API key in env.
 */
import { PrismaClient } from '@prisma/client';
import { indexAchievement } from '../services/vector';

const prisma = new PrismaClient();

async function main() {
  const achievements = await prisma.achievement.findMany({
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      metric: true,
      metricType: true,
      skills: true,
    },
  });

  console.log(`[reindex] ${achievements.length} achievements to index`);

  let ok = 0;
  let failed = 0;
  for (const a of achievements) {
    try {
      await indexAchievement(
        a.userId,
        a.id,
        `${a.title}: ${a.description}`,
        { metric: a.metric, metricType: a.metricType, skills: a.skills }
      );
      ok++;
    } catch (err: any) {
      failed++;
      console.error(`[reindex] FAILED ${a.id} (user ${a.userId}): ${err?.message ?? err}`);
    }
    if ((ok + failed) % 25 === 0) {
      console.log(`[reindex] progress: ${ok + failed}/${achievements.length} (ok=${ok}, failed=${failed})`);
    }
  }

  console.log(`[reindex] done. indexed=${ok}, failed=${failed}, total=${achievements.length}`);
}

main()
  .catch((err) => {
    console.error('[reindex] fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

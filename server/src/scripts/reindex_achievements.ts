/**
 * Rebuild Pinecone from Postgres (the source of truth).
 *
 * Why: achievements used to be stored one Pinecone namespace per user, which hit
 * the serverless 100-namespace cap once we crossed 100 users — every user past
 * 100 silently failed to index. We moved to a single shared namespace isolated by
 * a userId metadata filter (see services/vector.ts). This script migrates: it
 * PURGES every old per-user namespace (freeing the 100 slots), then re-indexes all
 * achievements into the shared namespace. Safe to re-run — it always rebuilds from
 * Postgres.
 *
 * Usage:  npx tsx src/scripts/reindex_achievements.ts
 * Requires: DATABASE_URL, PINECONE_API_KEY, and the embedding API key in env.
 */
import { PrismaClient } from '@prisma/client';
import { Pinecone } from '@pinecone-database/pinecone';
import { indexAchievement, SHARED_NAMESPACE } from '../services/vector';

const prisma = new PrismaClient();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'jobhub-achievements';

/**
 * Delete every namespace in the index — both the old per-user namespaces and any
 * prior shared namespace — so the rebuild starts from a clean slate and frees all
 * 100 serverless slots.
 */
async function purgeAllNamespaces() {
  if (!PINECONE_API_KEY) throw new Error('PINECONE_API_KEY env var is not set');
  const index = new Pinecone({ apiKey: PINECONE_API_KEY }).index(PINECONE_INDEX_NAME);

  const names: string[] = [];
  let paginationToken: string | undefined;
  do {
    const page: any = await index.listNamespaces({ paginationToken } as any);
    for (const ns of page.namespaces ?? []) {
      if (ns?.name !== undefined && ns.name !== null) names.push(ns.name);
    }
    paginationToken = page.pagination?.next;
  } while (paginationToken);

  console.log(`[reindex] purging ${names.length} existing namespace(s)`);
  let purged = 0;
  for (const name of names) {
    try {
      await index.deleteNamespace(name);
      purged++;
    } catch (err: any) {
      console.error(`[reindex] failed to delete namespace "${name}": ${err?.message ?? err}`);
    }
  }
  console.log(`[reindex] purged ${purged}/${names.length} namespace(s)`);
}

async function main() {
  await purgeAllNamespaces();
  console.log(`[reindex] rebuilding into shared namespace "${SHARED_NAMESPACE}"`);

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

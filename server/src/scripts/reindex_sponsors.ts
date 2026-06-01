/**
 * Embed every sponsor's hiring profile into the Pinecone 'sponsors' namespace so
 * the directory's hybrid search can match by meaning ("lab analyst" → pathology/
 * laboratory/scientist employers), not just literal substrings.
 *
 * Idempotent: upserts by sponsor id, so safe to re-run after the directory grows.
 *
 * Usage:  npx tsx src/scripts/reindex_sponsors.ts
 * Requires: DATABASE_URL, PINECONE_API_KEY, and OPENROUTER_API_KEY in env.
 */
import { PrismaClient } from '@prisma/client';
import { indexSponsor } from '../services/vector';

const prisma = new PrismaClient();

async function main() {
  const sponsors = await prisma.sponsor.findMany({
    select: { id: true, cleanName: true, industry: true, hiringProfile: true },
  });
  console.log(`[reindex-sponsors] ${sponsors.length} sponsors to index`);

  let ok = 0;
  let failed = 0;
  for (const s of sponsors) {
    try {
      await indexSponsor(s.id, `${s.cleanName} — ${s.industry}. ${s.hiringProfile}`);
      ok++;
    } catch (err: any) {
      failed++;
      console.error(`[reindex-sponsors] FAILED ${s.id} (${s.cleanName}): ${err?.message ?? err}`);
    }
    if ((ok + failed) % 50 === 0) {
      console.log(`[reindex-sponsors] progress: ${ok + failed}/${sponsors.length} (ok=${ok}, failed=${failed})`);
    }
  }

  console.log(`[reindex-sponsors] done. indexed=${ok}, failed=${failed}, total=${sponsors.length}`);
}

main()
  .catch((err) => {
    console.error('[reindex-sponsors] fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

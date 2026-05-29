import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SponsorSeed {
  rawName: string;
  cleanName: string;
  website: string | null;
  careersUrl: string | null;
  careersSearchUrl: string | null;
  industry: string;
  locations: string[];
  hiringProfile: string;
  confidence: 'high' | 'medium' | 'low';
}

async function seed() {
  const dataPath = process.argv[2];
  if (!dataPath) {
    console.error('Usage: npx ts-node src/scripts/seed_sponsors.ts <path-to-json>');
    process.exit(1);
  }

  const records: SponsorSeed[] = JSON.parse(
    require('fs').readFileSync(dataPath, 'utf-8')
  );

  // Deduplicate by cleanName (take last occurrence, which is the enriched version)
  const deduped = new Map<string, SponsorSeed>();
  for (const r of records) {
    const key = r.cleanName.trim();
    if (key) deduped.set(key, r);
  }
  const unique = Array.from(deduped.values());

  console.log(`Loaded ${records.length} records, ${unique.length} unique by cleanName`);

  // Batch insert — createMany is much faster than one-at-a-time upsert.
  // For re-runs, delete existing rows first.
  const existing = await prisma.sponsor.count();
  if (existing > 0) {
    console.log(`Database already has ${existing} sponsors. Replacing...`);
    await prisma.sponsor.deleteMany();
  }

  // Insert in batches of 500 to avoid query size limits
  const BATCH = 500;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    await prisma.sponsor.createMany({
      data: batch.map(r => ({
        cleanName: r.cleanName,
        rawName: r.rawName,
        website: r.website,
        careersUrl: r.careersUrl,
        careersSearchUrl: r.careersSearchUrl,
        industry: r.industry,
        locations: r.locations,
        hiringProfile: r.hiringProfile,
        confidence: r.confidence as any,
      })),
      skipDuplicates: true,
    });
    console.log(`  Inserted ${Math.min(i + BATCH, unique.length)}/${unique.length}`);
  }

  console.log(`Seeded ${unique.length} sponsors`);
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});

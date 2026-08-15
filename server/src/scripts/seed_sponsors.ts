import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Shape of sponsor_registry.json, produced by data/sponsor-source/build_registry.py.
interface SponsorSeed {
  name: string;
  tier: 'accredited' | 'standard';
  industry: string | null;
  website: string | null;
  careersUrl: string | null;
  abn: string | null;
  state: string | null;
  postcode: string | null;
  tradingName?: string | null;
  // Present only on rows carried over from the older enriched dataset.
  rawName?: string;
  locations?: string[];
  hiringProfile?: string | null;
  careersSearchUrl?: string | null;
}

/**
 * Every sponsor needs at least one working link behind the email gate.
 *
 * Only the ~3.9k enriched rows have a real website or careers page; the other 33k are
 * a company name and nothing else. Without this the gate would take a visitor's email
 * and then reveal an empty card, which is worse than not asking. A prepared Google
 * search is honest about what it is and actually gets them to the careers page.
 */
function careersSearch(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} careers Australia`)}`;
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

  // Deduplicate by name (take last occurrence, which is the enriched version)
  const deduped = new Map<string, SponsorSeed>();
  for (const r of records) {
    const key = r.name.trim();
    if (key) deduped.set(key, r);
  }
  const unique = Array.from(deduped.values());

  const accredited = unique.filter((r) => r.tier === 'accredited').length;
  console.log(
    `Loaded ${records.length} records, ${unique.length} unique ` +
    `(${accredited} accredited, ${unique.length - accredited} standard)`
  );

  // Batch insert: createMany is much faster than one-at-a-time upsert.
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
        cleanName: r.name,
        rawName: r.rawName ?? r.name,
        website: r.website,
        careersUrl: r.careersUrl,
        careersSearchUrl: r.careersSearchUrl ?? careersSearch(r.name),
        industry: r.industry,
        // Fall back to the ABR's registered state so unenriched rows are still
        // findable through the location filter.
        locations: r.locations ?? (r.state ? [r.state] : []),
        hiringProfile: r.hiringProfile ?? null,
        tier: r.tier as any,
        abn: r.abn,
        state: r.state,
        postcode: r.postcode,
        tradingName: r.tradingName ?? null,
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

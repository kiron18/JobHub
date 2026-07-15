import type { PrismaClient } from '@prisma/client';

// Idempotent CREATE TABLE for SponsorJob, mirroring the repo's ensureColumns() boot
// pattern (raw SQL, IF NOT EXISTS) so the table exists even when prisma migrate is
// skipped in some environments. Safe to call repeatedly.
export async function ensureSponsorJobTable(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SponsorJob" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "sourceUrl" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "company" TEXT NOT NULL,
        "normalizedCompany" TEXT NOT NULL,
        "location" TEXT,
        "salary" TEXT,
        "description" TEXT NOT NULL,
        "sourcePlatform" TEXT NOT NULL,
        "postedAt" TIMESTAMP(3),
        "confidence" TEXT NOT NULL,
        "employerMatched" BOOLEAN NOT NULL,
        "sponsorCleanName" TEXT,
        "positivePhraseHit" BOOLEAN NOT NULL,
        "negationPhraseHit" BOOLEAN NOT NULL,
        "matchedPhrases" JSONB,
        "scanQuery" TEXT NOT NULL,
        "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "feedDate" TEXT NOT NULL
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SponsorJob_sourceUrl_key" ON "SponsorJob"("sourceUrl");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SponsorJob_confidence_idx" ON "SponsorJob"("confidence");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SponsorJob_normalizedCompany_idx" ON "SponsorJob"("normalizedCompany");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SponsorJob_feedDate_idx" ON "SponsorJob"("feedDate");`);
  } catch (err) {
    // A pre-migration SponsorJob table shape must not abort the caller's whole
    // ensureColumns() run; migrations own fixing the table. Log and move on.
    console.warn('[startup] ensureSponsorJobTable skipped:', err);
  }
}

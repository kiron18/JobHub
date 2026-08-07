import type { PrismaClient } from '@prisma/client';

// Idempotent CREATE TABLE for DocumentQcReview, mirroring the repo's ensureColumns()
// boot pattern so the coach's quality control still works in an environment where
// prisma migrate has not run. Safe to call repeatedly.
export async function ensureQcReviewTable(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DocumentQcReview" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "documentId" TEXT NOT NULL,
        "contentHash" TEXT NOT NULL,
        "verdict" JSONB NOT NULL,
        "model" TEXT NOT NULL,
        "promptTokens" INTEGER NOT NULL DEFAULT 0,
        "outputTokens" INTEGER NOT NULL DEFAULT 0,
        "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "reviewedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // The unique pair is what makes a cached verdict a cache rather than a log:
    // without it the same document would be re-judged, and paid for, every time.
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "DocumentQcReview_documentId_contentHash_key" ON "DocumentQcReview"("documentId", "contentHash");`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "DocumentQcReview_documentId_idx" ON "DocumentQcReview"("documentId");`,
    );
  } catch (err) {
    // Never abort boot over the quality-control table; migrations own fixing it.
    console.warn('[startup] ensureQcReviewTable skipped:', err);
  }
}

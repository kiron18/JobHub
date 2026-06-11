import type { PrismaClient } from '@prisma/client';

// Idempotent CREATE TABLE IF NOT EXISTS for all contact-centric email automation tables.
// Mirrors the ensureSponsorJobTable pattern (raw SQL, IF NOT EXISTS).
// Safe to call repeatedly on startup.
export async function ensureEmailTables(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Contact" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "email" TEXT NOT NULL,
      "firstName" TEXT,
      "lastName" TEXT,
      "source" TEXT NOT NULL DEFAULT 'manual',
      "metadata" JSONB,
      "emailOptIn" BOOLEAN NOT NULL DEFAULT true,
      "unsubscribedAt" TIMESTAMP(3),
      "lastActivityAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Contact_email_key" ON "Contact"("email");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ContactNote" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "contactId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactNote_contactId_idx" ON "ContactNote"("contactId");`);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactNote_contactId_fkey') THEN
        ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Tag" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "label" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Tag_name_key" ON "Tag"("name");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ContactTag" (
      "contactId" TEXT NOT NULL,
      "tagId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ContactTag" ADD PRIMARY KEY ("contactId", "tagId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactTag_tagId_idx" ON "ContactTag"("tagId");`);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactTag_contactId_fkey') THEN
        ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactTag_tagId_fkey') THEN
        ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailTemplate" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "bodyText" TEXT,
      "bodyHtml" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_name_key" ON "EmailTemplate"("name");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailSequence" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "EmailSequence_name_key" ON "EmailSequence"("name");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SequenceStep" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "sequenceId" TEXT NOT NULL,
      "stepOrder" INTEGER NOT NULL,
      "delayDays" INTEGER NOT NULL,
      "templateId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SequenceStep_sequenceId_stepOrder_key" ON "SequenceStep"("sequenceId", "stepOrder");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SequenceStep_sequenceId_idx" ON "SequenceStep"("sequenceId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SequenceStep_templateId_idx" ON "SequenceStep"("templateId");`);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SequenceStep_sequenceId_fkey') THEN
        ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SequenceStep_templateId_fkey') THEN
        ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id");
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ContactSequence" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "contactId" TEXT NOT NULL,
      "sequenceId" TEXT NOT NULL,
      "currentStep" INTEGER NOT NULL DEFAULT 0,
      "completed" BOOLEAN NOT NULL DEFAULT false,
      "lastStepSentAt" TIMESTAMP(3),
      "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      "unenrolledAt" TIMESTAMP(3),
      "unenrolledReason" TEXT
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ContactSequence_contactId_sequenceId_key" ON "ContactSequence"("contactId", "sequenceId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactSequence_contactId_currentStep_completed_idx" ON "ContactSequence"("contactId", "currentStep", "completed");`);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactSequence_contactId_fkey') THEN
        ALTER TABLE "ContactSequence" ADD CONSTRAINT "ContactSequence_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactSequence_sequenceId_fkey') THEN
        ALTER TABLE "ContactSequence" ADD CONSTRAINT "ContactSequence_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailSend" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "contactId" TEXT NOT NULL,
      "sequenceId" TEXT,
      "sequenceStepId" TEXT,
      "templateId" TEXT,
      "broadcastId" TEXT,
      "resendEmailId" TEXT,
      "subject" TEXT NOT NULL,
      "fromEmail" TEXT NOT NULL,
      "toEmail" TEXT NOT NULL,
      "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailSend_contactId_sentAt_idx" ON "EmailSend"("contactId", "sentAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailSend_sentAt_idx" ON "EmailSend"("sentAt");`);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailSend_contactId_fkey') THEN
        ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailOpen" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "emailSendId" TEXT NOT NULL,
      "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userAgent" TEXT,
      "ipAddress" TEXT
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailOpen_emailSendId_idx" ON "EmailOpen"("emailSendId");`);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailOpen_emailSendId_fkey') THEN
        ALTER TABLE "EmailOpen" ADD CONSTRAINT "EmailOpen_emailSendId_fkey" FOREIGN KEY ("emailSendId") REFERENCES "EmailSend"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailClick" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "emailSendId" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userAgent" TEXT,
      "ipAddress" TEXT
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailClick_emailSendId_idx" ON "EmailClick"("emailSendId");`);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailClick_emailSendId_fkey') THEN
        ALTER TABLE "EmailClick" ADD CONSTRAINT "EmailClick_emailSendId_fkey" FOREIGN KEY ("emailSendId") REFERENCES "EmailSend"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Broadcast" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "bodyText" TEXT,
      "bodyHtml" TEXT,
      "targetCriteria" JSONB,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "sentAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add contactId column + FK to CandidateProfile (idempotent)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "CandidateProfile"
      ADD COLUMN IF NOT EXISTS "contactId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CandidateProfile_contactId_fkey') THEN
        ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id");
      END IF;
    END $$;
  `);

  console.log('[ensureEmailTables] all email tables verified');
}

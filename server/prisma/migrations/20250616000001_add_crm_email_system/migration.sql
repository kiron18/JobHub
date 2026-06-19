-- Add CRM/Email system models (idempotent version)

-- CreateTable Contact
CREATE TABLE IF NOT EXISTS "Contact" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "metadata" JSONB,
    "emailOptIn" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_email_key" ON "Contact"("email");

-- CreateTable ContactNote
CREATE TABLE IF NOT EXISTS "ContactNote" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContactNote_contactId_idx" ON "ContactNote"("contactId");

-- CreateTable Tag
CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_name_key" ON "Tag"("name");

-- CreateTable ContactTag
CREATE TABLE IF NOT EXISTS "ContactTag" (
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("contactId", "tagId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContactTag_tagId_idx" ON "ContactTag"("tagId");

-- CreateTable EmailTemplate
CREATE TABLE IF NOT EXISTS "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_name_key" ON "EmailTemplate"("name");

-- CreateTable EmailSequence
CREATE TABLE IF NOT EXISTS "EmailSequence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmailSequence_name_key" ON "EmailSequence"("name");

-- CreateTable SequenceStep
CREATE TABLE IF NOT EXISTS "SequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SequenceStep_sequenceId_stepOrder_key" ON "SequenceStep"("sequenceId", "stepOrder");
CREATE INDEX IF NOT EXISTS "SequenceStep_sequenceId_idx" ON "SequenceStep"("sequenceId");
CREATE INDEX IF NOT EXISTS "SequenceStep_templateId_idx" ON "SequenceStep"("templateId");

-- CreateTable ContactSequence
CREATE TABLE IF NOT EXISTS "ContactSequence" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "lastStepSentAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "unenrolledAt" TIMESTAMP(3),
    "unenrolledReason" TEXT,

    CONSTRAINT "ContactSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContactSequence_contactId_sequenceId_key" ON "ContactSequence"("contactId", "sequenceId");
CREATE INDEX IF NOT EXISTS "ContactSequence_contactId_currentStep_completed_idx" ON "ContactSequence"("contactId", "currentStep", "completed");

-- CreateTable EmailSend
CREATE TABLE IF NOT EXISTS "EmailSend" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sequenceId" TEXT,
    "sequenceStepId" TEXT,
    "templateId" TEXT,
    "broadcastId" TEXT,
    "resendEmailId" TEXT,
    "subject" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailSend_contactId_sentAt_idx" ON "EmailSend"("contactId", "sentAt");
CREATE INDEX IF NOT EXISTS "EmailSend_sentAt_idx" ON "EmailSend"("sentAt");

-- CreateTable EmailOpen
CREATE TABLE IF NOT EXISTS "EmailOpen" (
    "id" TEXT NOT NULL,
    "emailSendId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "EmailOpen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailOpen_emailSendId_idx" ON "EmailOpen"("emailSendId");

-- CreateTable EmailClick
CREATE TABLE IF NOT EXISTS "EmailClick" (
    "id" TEXT NOT NULL,
    "emailSendId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "EmailClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailClick_emailSendId_idx" ON "EmailClick"("emailSendId");

-- CreateTable Broadcast
CREATE TABLE IF NOT EXISTS "Broadcast" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "targetCriteria" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (wrapped in DO block for idempotency)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ContactNote_contactId_fkey'
    ) THEN
        ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ContactTag_contactId_fkey'
    ) THEN
        ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ContactTag_tagId_fkey'
    ) THEN
        ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SequenceStep_sequenceId_fkey'
    ) THEN
        ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SequenceStep_templateId_fkey'
    ) THEN
        ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ContactSequence_contactId_fkey'
    ) THEN
        ALTER TABLE "ContactSequence" ADD CONSTRAINT "ContactSequence_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ContactSequence_sequenceId_fkey'
    ) THEN
        ALTER TABLE "ContactSequence" ADD CONSTRAINT "ContactSequence_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmailSend_contactId_fkey'
    ) THEN
        ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmailSend_sequenceId_fkey'
    ) THEN
        ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmailSend_templateId_fkey'
    ) THEN
        ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmailOpen_emailSendId_fkey'
    ) THEN
        ALTER TABLE "EmailOpen" ADD CONSTRAINT "EmailOpen_emailSendId_fkey" FOREIGN KEY ("emailSendId") REFERENCES "EmailSend"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmailClick_emailSendId_fkey'
    ) THEN
        ALTER TABLE "EmailClick" ADD CONSTRAINT "EmailClick_emailSendId_fkey" FOREIGN KEY ("emailSendId") REFERENCES "EmailSend"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

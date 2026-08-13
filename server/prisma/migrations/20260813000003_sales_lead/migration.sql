-- The sales pipeline, moved off the local Python CRM.
CREATE TABLE "SalesLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "headline" TEXT,
    "company" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'Lead',
    "source" TEXT NOT NULL DEFAULT 'linkedin-import',
    "sourceAsset" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" TIMESTAMP(3),
    "attendedAt" TIMESTAMP(3),
    "reportSentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "hasResume" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "nextBest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesLead_email_key" ON "SalesLead"("email");
CREATE INDEX "SalesLead_archived_stage_idx" ON "SalesLead"("archived", "stage");
CREATE INDEX "SalesLead_updatedAt_idx" ON "SalesLead"("updatedAt");

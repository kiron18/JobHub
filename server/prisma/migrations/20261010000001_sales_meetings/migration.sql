-- /admin/sales: contact details read off the resume, and booked meetings. Additive only.

-- AlterTable
ALTER TABLE "SalesLead" ADD COLUMN "location" TEXT,
ADD COLUMN "jobTitle" TEXT,
ADD COLUMN "profession" TEXT,
ADD COLUMN "visaStatus" TEXT,
ADD COLUMN "education" TEXT;

-- CreateTable
CREATE TABLE "SalesMeeting" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 30,
    "notify" BOOLEAN NOT NULL DEFAULT true,
    "googleEventId" TEXT,
    "meetLink" TEXT,
    "calendarLink" TEXT,
    "calendarError" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "reminderDaySentAt" TIMESTAMP(3),
    "reminderHourSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesMeeting_startsAt_idx" ON "SalesMeeting"("startsAt");

-- CreateIndex
CREATE INDEX "SalesMeeting_leadId_idx" ON "SalesMeeting"("leadId");

-- AddForeignKey
ALTER TABLE "SalesMeeting" ADD CONSTRAINT "SalesMeeting_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

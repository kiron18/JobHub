-- Add contactId to CandidateProfile

-- AddColumn
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "contactId" TEXT;

-- CreateIndex
CREATE INDEX "CandidateProfile_contactId_idx" ON "CandidateProfile"("contactId");

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

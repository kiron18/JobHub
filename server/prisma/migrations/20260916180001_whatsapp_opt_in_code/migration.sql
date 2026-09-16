-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN "whatsappOptInCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_whatsappOptInCode_key" ON "CandidateProfile"("whatsappOptInCode");

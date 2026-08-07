-- AlterTable
ALTER TABLE "Document" ADD COLUMN "jobDescriptionHash" TEXT;

-- CreateIndex
CREATE INDEX "Document_userId_jobDescriptionHash_idx" ON "Document"("userId", "jobDescriptionHash");

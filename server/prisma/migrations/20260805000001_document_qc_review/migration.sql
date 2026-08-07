-- CreateTable
CREATE TABLE "DocumentQcReview" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "verdict" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentQcReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentQcReview_documentId_contentHash_key" ON "DocumentQcReview"("documentId", "contentHash");

-- CreateIndex
CREATE INDEX "DocumentQcReview_documentId_idx" ON "DocumentQcReview"("documentId");

-- AddForeignKey
ALTER TABLE "DocumentQcReview" ADD CONSTRAINT "DocumentQcReview_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

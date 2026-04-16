CREATE TABLE "JobFeedItem" (
  "id"                  TEXT NOT NULL,
  "userId"              TEXT NOT NULL,
  "feedDate"            DATE NOT NULL,
  "title"               TEXT NOT NULL,
  "company"             TEXT NOT NULL,
  "location"            TEXT,
  "salary"              TEXT,
  "description"         TEXT NOT NULL,
  "bullets"             JSONB,
  "sourceUrl"           TEXT NOT NULL,
  "sourcePlatform"      TEXT NOT NULL,
  "postedAt"            TIMESTAMP(3),
  "suggestedAddressee"  TEXT,
  "addresseeTitle"      TEXT,
  "addresseeConfidence" TEXT,
  "addresseeSource"     TEXT,
  "matchScore"          INTEGER,
  "matchDetails"        JSONB,
  "isRead"              BOOLEAN NOT NULL DEFAULT false,
  "isSaved"             BOOLEAN NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobFeedItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobFeedItem_userId_feedDate_idx" ON "JobFeedItem"("userId", "feedDate");

ALTER TABLE "JobFeedItem"
  ADD CONSTRAINT "JobFeedItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "CandidateProfile"("userId")
  ON DELETE CASCADE ON UPDATE CASCADE;

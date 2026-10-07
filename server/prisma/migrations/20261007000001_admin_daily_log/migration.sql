-- The /admin/daily checklist: one row per Sydney calendar day. Additive only.

-- CreateTable
CREATE TABLE "AdminDailyLog" (
    "date" TEXT NOT NULL,
    "done" JSONB NOT NULL DEFAULT '{}',
    "welcomed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminDailyLog_pkey" PRIMARY KEY ("date")
);

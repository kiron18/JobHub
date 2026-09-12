-- CreateTable
CREATE TABLE "ManualLeaderboardEntry" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "applications" INTEGER NOT NULL DEFAULT 0,
    "outreach" INTEGER NOT NULL DEFAULT 0,
    "interviews" INTEGER NOT NULL DEFAULT 0,
    "offers" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualLeaderboardEntry_pkey" PRIMARY KEY ("id")
);

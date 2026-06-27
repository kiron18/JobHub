CREATE TABLE "BookingIntake" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "currentRole" TEXT,
    "targetRole" TEXT,
    "visaStatus" TEXT,
    "biggestChallenge" TEXT,
    "resumeText" TEXT,
    "calendlyEventId" TEXT,
    "callScheduledAt" TIMESTAMP(3),
    "battleCard" TEXT,
    "battleCardAt" TIMESTAMP(3),
    "obsidianSynced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingIntake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingIntake_email_key" ON "BookingIntake"("email");

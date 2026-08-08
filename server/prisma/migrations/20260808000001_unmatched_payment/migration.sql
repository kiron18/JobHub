-- CreateTable
CREATE TABLE "UnmatchedPayment" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" TEXT,
    "amount" DOUBLE PRECISION,
    "reason" TEXT,
    "stripeCustomerId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "alertedAt" TIMESTAMP(3),
    "alertCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "UnmatchedPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnmatchedPayment_email_key" ON "UnmatchedPayment"("email");

-- CreateIndex
CREATE INDEX "UnmatchedPayment_resolvedAt_alertedAt_idx" ON "UnmatchedPayment"("resolvedAt", "alertedAt");

-- Billing hold: pause a client's access when an installment goes unpaid.
-- Nullable and defaulting to NULL, so every existing profile is un-held.
ALTER TABLE "CandidateProfile"
  ADD COLUMN IF NOT EXISTS "billingHoldAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "billingHoldInvoiceUrl" TEXT;

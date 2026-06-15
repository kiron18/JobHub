# Contact-Centric Email Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready contact-centric email automation system with tags, sequences, broadcasts, open/click tracking, and an admin interface.

**Architecture:** Six Prisma models (Contact, Tag, ContactTag, EmailSequence, SequenceStep, EmailTemplate, ContactSequence, EmailSend, EmailOpen, EmailClick, Broadcast, ContactNote) managed via raw SQL `CREATE TABLE IF NOT EXISTS` in the existing `ensureColumns()` boot pattern. A daily node-cron drives the sequence engine. Tracking endpoints are Express routes. The admin UI is React pages under `/admin/contacts`.

**Tech Stack:** TypeScript, Express, Prisma/PostgreSQL, Resend, node-cron, React/TanStack Query

**Key constraint — existing migration pattern:** This project does NOT use `prisma migrate`. All new tables are created via raw SQL `CREATE TABLE IF NOT EXISTS` in `server/src/index.ts`'s `ensureColumns()` function. Follow the pattern in `server/src/db/ensureSponsorJobTable.ts` exactly. The Prisma schema file is kept in sync for type generation only — `npx prisma generate` produces the client types.

---

### Task 1: Schema — Prisma models + raw SQL migration

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/src/db/ensureEmailTables.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Add all new Prisma models to schema.prisma**

```prisma
// Add these models AFTER the existing SponsorPhoto model (before the closing generator)

model Contact {
  id              String    @id @default(uuid())
  email           String    @unique
  firstName       String?
  lastName        String?
  source          String    @default("manual")
  metadata        Json?
  emailOptIn      Boolean   @default(true)
  unsubscribedAt  DateTime?
  lastActivityAt  DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  tags              ContactTag[]
  sequences         ContactSequence[]
  emailSends        EmailSend[]
  notes             ContactNote[]
  candidateProfile  CandidateProfile?
}

model ContactNote {
  id        String   @id @default(uuid())
  contactId String
  content   String
  createdAt DateTime @default(now())

  contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  @@index([contactId])
}

model Tag {
  id        String       @id @default(uuid())
  name      String       @unique
  label     String?
  createdAt DateTime     @default(now())
  contacts  ContactTag[]
}

model ContactTag {
  contactId String
  tagId     String
  createdAt DateTime @default(now())

  contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  tag     Tag     @relation(fields: [tagId], references: [id], onDelete: Restrict)

  @@id([contactId, tagId])
  @@index([tagId])
}

model EmailTemplate {
  id        String   @id @default(uuid())
  name      String   @unique
  subject   String
  bodyText  String?
  bodyHtml  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  steps     SequenceStep[]
}

model EmailSequence {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  priority    Int      @default(0)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())

  steps SequenceStep[]
}

model SequenceStep {
  id         String   @id @default(uuid())
  sequenceId String
  stepOrder  Int
  delayDays  Int
  templateId String
  createdAt  DateTime @default(now())

  sequence EmailSequence  @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  template EmailTemplate  @relation(fields: [templateId], references: [id])

  @@unique([sequenceId, stepOrder])
  @@index([sequenceId])
  @@index([templateId])
}

model ContactSequence {
  id              String    @id @default(uuid())
  contactId       String
  sequenceId      String
  currentStep     Int       @default(0)
  completed       Boolean   @default(false)
  lastStepSentAt  DateTime?
  enrolledAt      DateTime  @default(now())
  completedAt     DateTime?
  unenrolledAt    DateTime?
  unenrolledReason String?

  contact  Contact       @relation(fields: [contactId], references: [id], onDelete: Cascade)
  sequence EmailSequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)

  @@unique([contactId, sequenceId])
  @@index([contactId, currentStep, completed])
}

model EmailSend {
  id              String   @id @default(uuid())
  contactId       String
  sequenceId      String?
  sequenceStepId  String?
  templateId      String?
  broadcastId     String?
  resendEmailId   String?
  subject         String
  fromEmail       String
  toEmail         String
  sentAt          DateTime @default(now())

  contact     Contact        @relation(fields: [contactId], references: [id], onDelete: Cascade)
  sequence    EmailSequence?  @relation(fields: [sequenceId], references: [id])
  template    EmailTemplate?  @relation(fields: [templateId], references: [id])
  opens       EmailOpen[]
  clicks      EmailClick[]

  @@index([contactId, sentAt])
  @@index([sentAt])
}

model EmailOpen {
  id          String   @id @default(uuid())
  emailSendId String
  openedAt    DateTime @default(now())
  userAgent   String?
  ipAddress   String?

  emailSend EmailSend @relation(fields: [emailSendId], references: [id], onDelete: Cascade)
  @@index([emailSendId])
}

model EmailClick {
  id          String   @id @default(uuid())
  emailSendId String
  url         String
  clickedAt   DateTime @default(now())
  userAgent   String?
  ipAddress   String?

  emailSend EmailSend @relation(fields: [emailSendId], references: [id], onDelete: Cascade)
  @@index([emailSendId])
}

model Broadcast {
  id        String   @id @default(uuid())
  name      String
  subject   String
  bodyText  String?
  bodyHtml  String?
  targetCriteria Json?
  status    String   @default("draft")
  sentAt    DateTime?
  createdAt DateTime @default(now())
}
```

Then add `contactId` to CandidateProfile:

```prisma
model CandidateProfile {
  // ... ALL existing fields remain unchanged, just add these two lines:
  contactId String?
  contact   Contact?    @relation(fields: [contactId], references: [id])
}
```

Add it after the existing `visaStatus String?` line (around line 40 in the current file). The `contact` field is optional — leave all existing relations untouched.

- [ ] **Step 2: Create the raw SQL migration file**

Save as `server/src/db/ensureEmailTables.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';

export async function ensureEmailTables(prisma: PrismaClient): Promise<void> {
  // Contact
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Contact" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "email" TEXT NOT NULL,
      "firstName" TEXT,
      "lastName" TEXT,
      "source" TEXT NOT NULL DEFAULT 'manual',
      "metadata" JSONB,
      "emailOptIn" BOOLEAN NOT NULL DEFAULT true,
      "unsubscribedAt" TIMESTAMP(3),
      "lastActivityAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Contact_email_key" ON "Contact"("email");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Contact_source_idx" ON "Contact"("source");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Contact_createdAt_idx" ON "Contact"("createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Contact_lastActivityAt_idx" ON "Contact"("lastActivityAt");`);

  // ContactNote
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ContactNote" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "contactId" TEXT NOT NULL REFERENCES "Contact"("id") ON DELETE CASCADE,
      "content" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactNote_contactId_idx" ON "ContactNote"("contactId");`);

  // Tag
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Tag" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "label" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Tag_name_key" ON "Tag"("name");`);

  // ContactTag (many-to-many)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ContactTag" (
      "contactId" TEXT NOT NULL REFERENCES "Contact"("id") ON DELETE CASCADE,
      "tagId" TEXT NOT NULL REFERENCES "Tag"("id") ON DELETE RESTRICT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("contactId", "tagId")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactTag_tagId_idx" ON "ContactTag"("tagId");`);

  // EmailTemplate
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailTemplate" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "bodyText" TEXT,
      "bodyHtml" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_name_key" ON "EmailTemplate"("name");`);

  // EmailSequence
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailSequence" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "EmailSequence_name_key" ON "EmailSequence"("name");`);

  // SequenceStep
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SequenceStep" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "sequenceId" TEXT NOT NULL REFERENCES "EmailSequence"("id") ON DELETE CASCADE,
      "stepOrder" INTEGER NOT NULL,
      "delayDays" INTEGER NOT NULL,
      "templateId" TEXT NOT NULL REFERENCES "EmailTemplate"("id"),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("sequenceId", "stepOrder")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SequenceStep_sequenceId_idx" ON "SequenceStep"("sequenceId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SequenceStep_templateId_idx" ON "SequenceStep"("templateId");`);

  // ContactSequence
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ContactSequence" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "contactId" TEXT NOT NULL REFERENCES "Contact"("id") ON DELETE CASCADE,
      "sequenceId" TEXT NOT NULL REFERENCES "EmailSequence"("id") ON DELETE CASCADE,
      "currentStep" INTEGER NOT NULL DEFAULT 0,
      "completed" BOOLEAN NOT NULL DEFAULT false,
      "lastStepSentAt" TIMESTAMP(3),
      "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      "unenrolledAt" TIMESTAMP(3),
      "unenrolledReason" TEXT,
      UNIQUE ("contactId", "sequenceId")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactSequence_contactId_idx" ON "ContactSequence"("contactId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactSequence_currentStep_idx" ON "ContactSequence"("currentStep") WHERE "completed" = false;`);

  // EmailSend
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailSend" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "contactId" TEXT NOT NULL REFERENCES "Contact"("id") ON DELETE CASCADE,
      "sequenceId" TEXT REFERENCES "EmailSequence"("id"),
      "sequenceStepId" TEXT,
      "templateId" TEXT REFERENCES "EmailTemplate"("id"),
      "broadcastId" TEXT,
      "resendEmailId" TEXT,
      "subject" TEXT NOT NULL,
      "fromEmail" TEXT NOT NULL,
      "toEmail" TEXT NOT NULL,
      "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailSend_contactId_sentAt_idx" ON "EmailSend"("contactId", "sentAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailSend_sentAt_idx" ON "EmailSend"("sentAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailSend_broadcastId_idx" ON "EmailSend"("broadcastId");`);

  // EmailOpen
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailOpen" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "emailSendId" TEXT NOT NULL REFERENCES "EmailSend"("id") ON DELETE CASCADE,
      "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userAgent" TEXT,
      "ipAddress" TEXT
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailOpen_emailSendId_idx" ON "EmailOpen"("emailSendId");`);

  // EmailClick
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailClick" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "emailSendId" TEXT NOT NULL REFERENCES "EmailSend"("id") ON DELETE CASCADE,
      "url" TEXT NOT NULL,
      "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userAgent" TEXT,
      "ipAddress" TEXT
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailClick_emailSendId_idx" ON "EmailClick"("emailSendId");`);

  // Broadcast
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Broadcast" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "bodyText" TEXT,
      "bodyHtml" TEXT,
      "targetCriteria" JSONB,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "sentAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add contactId to CandidateProfile
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "CandidateProfile"
      ADD COLUMN IF NOT EXISTS "contactId" TEXT,
      ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CandidateProfile_contactId_fkey'
      ) THEN
        ALTER TABLE "CandidateProfile"
          ADD CONSTRAINT "CandidateProfile_contactId_fkey"
          FOREIGN KEY ("contactId") REFERENCES "Contact"("id");
      END IF;
    END
    $$;
  `);
}
```

- [ ] **Step 3: Wire ensureEmailTables into server/src/index.ts**

Find the `ensureColumns()` function (around line 175). Add at the top of it:

```typescript
import { ensureEmailTables } from './db/ensureEmailTables';
```

Inside `ensureColumns()`, add AFTER the existing sponsor/CvScanLead table creation block:

```typescript
try {
  await ensureEmailTables(prisma);
  console.log('[startup] email tables verified');
} catch (err) {
  console.warn('[startup] ensureEmailTables skipped:', err);
}
```

Find the listener block (around line 315-327) and register the sequence cron after the other crons:

```typescript
import { startSequenceCron } from './cron/sequenceCron';
```

```typescript
startSequenceCron();
```

Add it after `startFollowUpReminderCron()`.

- [ ] **Step 4: Seed tags and sequences**

Create `server/src/email/admin/seedData.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';

export async function seedTags(prisma: PrismaClient): Promise<void> {
  const tags = [
    { name: 'signed_up', label: 'Signed Up' },
    { name: 'cv_scanned', label: 'CV Scanned' },
    { name: 'cv_fixed', label: 'CV Fixed' },
    { name: 'sales_call_booked', label: 'Sales Call Booked' },
    { name: 'sales_call_completed', label: 'Sales Call Completed' },
    { name: 'hot_lead', label: 'Hot Lead' },
    { name: 'client', label: 'Client' },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: { label: tag.label },
      create: tag,
    });
  }
  console.log('[seed] tags done');
}

export async function seedTemplates(prisma: PrismaClient): Promise<void> {
  // Welcome email — sent immediately on signup
  await prisma.emailTemplate.upsert({
    where: { name: 'welcome_step0' },
    update: { subject: 'Welcome to Aussie Grad Careers', bodyText: 'Welcome aboard!\n\nGet started by optimising your resume and finding the right roles.'],
    create: { name: 'welcome_step0', subject: 'Welcome to Aussie Grad Careers', bodyText: 'Welcome aboard!\n\nGet started by optimising your resume and finding the right roles.' },
  });

  // CV scan follow-up — day 3
  await prisma.emailTemplate.upsert({
    where: { name: 'cv_scan_followup_day3' },
    update: { subject: 'Your CV roadmap — 3 day check-in', bodyText: 'Hi,\n\nIt\'s been a few days since your CV scan. Have you started on the first fix?' },
    create: { name: 'cv_scan_followup_day3', subject: 'Your CV roadmap — 3 day check-in', bodyText: 'Hi,\n\nIt\'s been a few days since your CV scan. Have you started on the first fix?' },
  });

  console.log('[seed] templates done');
}

export async function seedSequences(prisma: PrismaClient): Promise<void> {
  // welcome_sequence: priority 4 (lowest nurture)
  const welcomeSeq = await prisma.emailSequence.upsert({
    where: { name: 'welcome_sequence' },
    update: { description: 'Welcome drip for new signups', priority: 4, active: true },
    create: { name: 'welcome_sequence', description: 'Welcome drip for new signups', priority: 4, active: true },
  });
  await seedStep(prisma, welcomeSeq.id, 0, 0, 'welcome_step0');

  // cv_scan_followup: priority 3
  const cvSeq = await prisma.emailSequence.upsert({
    where: { name: 'cv_scan_followup' },
    update: { description: 'Follow-up sequence after CV scan', priority: 3, active: true },
    create: { name: 'cv_scan_followup', description: 'Follow-up sequence after CV scan', priority: 3, active: true },
  });
  await seedStep(prisma, cvSeq.id, 0, 3, 'cv_scan_followup_day3');

  // sales_nurture: priority 2 (reserved for later template creation)
  await prisma.emailSequence.upsert({
    where: { name: 'sales_nurture' },
    update: { description: 'Nurture sequence for sales call booked contacts', priority: 2, active: true },
    create: { name: 'sales_nurture', description: 'Nurture sequence for sales call booked contacts', priority: 2, active: true },
  });

  // client_onboarding: priority 1 (highest)
  await prisma.emailSequence.upsert({
    where: { name: 'client_onboarding' },
    update: { description: 'Onboarding sequence for paying clients', priority: 1, active: true },
    create: { name: 'client_onboarding', description: 'Onboarding sequence for paying clients', priority: 1, active: true },
  });

  console.log('[seed] sequences done');
}

async function seedStep(prisma: PrismaClient, sequenceId: string, stepOrder: number, delayDays: number, templateName: string): Promise<void> {
  const template = await prisma.emailTemplate.findUnique({ where: { name: templateName } });
  if (!template) { console.warn(`[seed] template ${templateName} not found`); return; }

  try {
    await prisma.sequenceStep.upsert({
      where: { sequenceId_stepOrder: { sequenceId, stepOrder } },
      update: { delayDays, templateId: template.id },
      create: { sequenceId, stepOrder, delayDays, templateId: template.id },
    });
  } catch {
    // Race condition on upsert in concurrent seed — safe to ignore
  }
}
```

Call `seedTags(prisma)` and `seedTemplates(prisma)` and `seedSequences(prisma)` inside `ensureColumns()` after `ensureEmailTables()`, wrapped in try/catch.

- [ ] **Step 5: Run prisma generate to update the client types**

```bash
cd server && npx prisma generate
```

Expected output: Prisma Client regenerated with all new models.

- [ ] **Step 6: Commit**

```bash
git add server/prisma/schema.prisma server/src/db/ensureEmailTables.ts server/src/index.ts server/src/email/
git commit -m "feat(email): add contact-centric email schema, tables, seed data"
```

---

### Task 2: Enrollment engine — tag → sequence mapping with priority resolution

**Files:**
- Create: `server/src/email/engine/enrollment.ts`

- [ ] **Step 1: Write the enrollment module**

```typescript
import { prisma } from '../../index';

const TAG_SEQUENCE_MAP: Record<string, { sequenceName: string; cleanupTags?: string[] }> = {
  signed_up:         { sequenceName: 'welcome_sequence' },
  cv_scanned:        { sequenceName: 'cv_scan_followup' },
  sales_call_booked: { sequenceName: 'sales_nurture' },
  client:            { sequenceName: 'client_onboarding', cleanupTags: ['sales_call_booked', 'sales_call_completed', 'hot_lead'] },
};

export async function handleTagAssigned(contactId: string, tagName: string): Promise<void> {
  const mapping = TAG_SEQUENCE_MAP[tagName];
  if (!mapping) return; // no sequence maps to this tag

  // If this tag requires cleanup, remove those tags first
  if (mapping.cleanupTags) {
    const tagsToRemove = await prisma.tag.findMany({
      where: { name: { in: mapping.cleanupTags } },
    });
    if (tagsToRemove.length > 0) {
      await prisma.contactTag.deleteMany({
        where: {
          contactId,
          tagId: { in: tagsToRemove.map(t => t.id) },
        },
      });
    }
  }

  await enrollInSequence(contactId, mapping.sequenceName);
}

export async function enrollInSequence(contactId: string, sequenceName: string): Promise<void> {
  const sequence = await prisma.emailSequence.findUnique({ where: { name: sequenceName } });
  if (!sequence || !sequence.active) {
    console.warn(`[enrollment] sequence "${sequenceName}" not found or inactive`);
    return;
  }

  // Check if already enrolled
  const existing = await prisma.contactSequence.findUnique({
    where: { contactId_sequenceId: { contactId, sequenceId: sequence.id } },
  });
  if (existing && !existing.completed && !existing.unenrolledAt) {
    // Already active — no-op
    return;
  }

  // Find currently active sequences sorted by priority (lower number = higher priority)
  const activeSequences = await prisma.contactSequence.findMany({
    where: {
      contactId,
      completed: false,
      unenrolledAt: null,
    },
    include: { sequence: true },
  });

  const newPriority = sequence.priority;

  for (const active of activeSequences) {
    if (active.sequenceId === sequence.id) continue; // skip self (already checked above)

    if (active.sequence.priority < newPriority) {
      // Contact is in a higher-priority sequence — do NOT enroll
      return;
    }

    // Unenroll from lower-priority sequences
    await prisma.contactSequence.update({
      where: { id: active.id },
      data: {
        unenrolledAt: new Date(),
        unenrolledReason: 'upgraded_sequence',
        completed: true,
      },
    });
  }

  // Enroll
  // If previously enrolled and completed/unenrolled, re-enroll as fresh
  if (existing) {
    await prisma.contactSequence.update({
      where: { id: existing.id },
      data: {
        currentStep: 0,
        completed: false,
        lastStepSentAt: null,
        enrolledAt: new Date(),
        unenrolledAt: null,
        unenrolledReason: null,
        completedAt: null,
      },
    });
  } else {
    await prisma.contactSequence.create({
      data: { contactId, sequenceId: sequence.id },
    });
  }

  // Update lastActivityAt on contact
  await prisma.contact.update({
    where: { id: contactId },
    data: { lastActivityAt: new Date() },
  });

  console.log(`[enrollment] enrolled contact ${contactId} in "${sequenceName}"`);
}

export async function unenrollFromSequence(contactId: string, sequenceName: string, reason: string = 'manual'): Promise<void> {
  const sequence = await prisma.emailSequence.findUnique({ where: { name: sequenceName } });
  if (!sequence) return;

  await prisma.contactSequence.updateMany({
    where: { contactId, sequenceId: sequence.id, completed: false },
    data: { completed: true, unenrolledAt: new Date(), unenrolledReason: reason },
  });
}

export async function unenrollFromAllSequences(contactId: string, reason: string = 'manual'): Promise<void> {
  await prisma.contactSequence.updateMany({
    where: { contactId, completed: false },
    data: { completed: true, unenrolledAt: new Date(), unenrolledReason: reason },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/email/engine/enrollment.ts
git commit -m "feat(email): enrollment engine with priority resolution"
```

---

### Task 3: Send engine — Resend wrapper, open/click tracking pixel

**Files:**
- Create: `server/src/email/send/sendEmail.ts`
- Create: `server/src/email/tracking/openTracker.ts`
- Create: `server/src/email/tracking/clickTracker.ts`
- Modify: `server/src/index.ts` (register tracking routes)

- [ ] **Step 1: Create the send wrapper**

```typescript
// server/src/email/send/sendEmail.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'Aussie Grad Careers <kiron@aussiegradcareers.com.au>';

export interface SendEmailParams {
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  trackingId?: string; // emailSendId — appended as tracking pixel if HTML
}

export async function sendEmail(params: SendEmailParams): Promise<{ resendEmailId: string | null; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[sendEmail] RESEND_API_KEY not set — skipping send');
    return { resendEmailId: null, error: 'RESEND_API_KEY not set' };
  }

  let html = params.bodyHtml;
  if (html && params.trackingId) {
    // Append tracking pixel
    const baseUrl = process.env.API_URL ?? 'http://localhost:3002/api';
    const pixelUrl = `${baseUrl}/email/track/open/${params.trackingId}`;
    html += `\n<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`;

    // Rewrite links for click tracking
    html = html.replace(/href="(https?:\/\/[^"]+)"/g, (_match, url: string) => {
      const encoded = encodeURIComponent(url);
      return `href="${baseUrl}/email/track/click/${params.trackingId}?url=${encoded}"`;
    });
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: params.subject,
      text: params.bodyText,
      html: html ?? undefined,
    });
    return { resendEmailId: result.data?.id ?? null };
  } catch (err: any) {
    console.error('[sendEmail] Resend error:', err.message);
    return { resendEmailId: null, error: err.message };
  }
}
```

- [ ] **Step 2: Create open tracker route**

```typescript
// server/src/email/tracking/openTracker.ts
import { Router } from 'express';
import { prisma } from '../../index';

const router = Router();

// Tracking pixel — 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

router.get('/track/open/:emailSendId', async (req, res) => {
  const { emailSendId } = req.params;

  try {
    // Record the open (fire-and-forget — don't block the pixel)
    await prisma.emailOpen.create({
      data: {
        emailSendId,
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      },
    });

    // Update Contact lastActivityAt
    const emailSend = await prisma.emailSend.findUnique({
      where: { id: emailSendId },
      select: { contactId: true },
    });
    if (emailSend) {
      await prisma.contact.update({
        where: { id: emailSend.contactId },
        data: { lastActivityAt: new Date() },
      }).catch(() => {});
    }
  } catch {
    // Tracking failures are non-critical — don't break the pixel
  }

  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_GIF.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  });
  res.end(TRANSPARENT_GIF);
});

export default router;
```

- [ ] **Step 3: Create click tracker route**

```typescript
// server/src/email/tracking/clickTracker.ts
import { Router } from 'express';
import { prisma } from '../../index';

const router = Router();

router.get('/track/click/:emailSendId', async (req, res) => {
  const { emailSendId } = req.params;
  const targetUrl = req.query.url as string;

  if (!targetUrl) {
    res.status(400).send('Missing url param');
    return;
  }

  try {
    await prisma.emailClick.create({
      data: {
        emailSendId,
        url: targetUrl,
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      },
    });

    const emailSend = await prisma.emailSend.findUnique({
      where: { id: emailSendId },
      select: { contactId: true },
    });
    if (emailSend) {
      await prisma.contact.update({
        where: { id: emailSend.contactId },
        data: { lastActivityAt: new Date() },
      }).catch(() => {});
    }
  } catch {
    // Tracking failures are non-critical — redirect still works
  }

  res.redirect(302, targetUrl);
});

export default router;
```

- [ ] **Step 4: Register tracking routes in index.ts**

Add after the other route registrations:

```typescript
import emailOpenRouter from './email/tracking/openTracker';
import emailClickRouter from './email/tracking/clickTracker';

app.use('/api', emailOpenRouter);
app.use('/api', emailClickRouter);
```

- [ ] **Step 5: Commit**

```bash
git add server/src/email/send/sendEmail.ts server/src/email/tracking/ server/src/index.ts
git commit -m "feat(email): send wrapper, open tracking pixel, click tracking redirect"
```

---

### Task 4: Sequence engine — daily cron drive

**Files:**
- Create: `server/src/email/engine/sequenceEngine.ts`
- Create: `server/src/cron/sequenceCron.ts`

- [ ] **Step 1: Create the sequence engine**

```typescript
// server/src/email/engine/sequenceEngine.ts
import { prisma } from '../../index';
import { sendEmail } from '../send/sendEmail';
import { unenrollFromSequence } from './enrollment';

export async function processSequenceEmails(): Promise<void> {
  const now = new Date();
  let sent = 0;

  // Fetch all active enrollments
  const enrollments = await prisma.contactSequence.findMany({
    where: { completed: false, unenrolledAt: null },
    include: {
      contact: true,
      sequence: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
    },
  });

  for (const enrollment of enrollments) {
    try {
      // Skip unsubscribed contacts
      if (enrollment.contact.unsubscribedAt || !enrollment.contact.emailOptIn) {
        await unenrollFromSequence(enrollment.contactId, enrollment.sequence.name, 'unsubscribed');
        continue;
      }

      const step = enrollment.sequence.steps.find(s => s.stepOrder === enrollment.currentStep);
      if (!step) {
        // No step found — mark complete
        await prisma.contactSequence.update({
          where: { id: enrollment.id },
          data: { completed: true, completedAt: now, unenrolledReason: 'completed' },
        });
        continue;
      }

      // Compute scheduled send time
      const baseDate = enrollment.lastStepSentAt ?? enrollment.enrolledAt;
      const scheduledSendAt = new Date(baseDate.getTime() + step.delayDays * 24 * 60 * 60 * 1000);

      if (now < scheduledSendAt) continue; // not yet time

      // Check dedup — was this step already sent manually?
      const alreadySent = await prisma.emailSend.findFirst({
        where: {
          contactId: enrollment.contactId,
          sequenceStepId: step.id,
        },
      });
      if (alreadySent) {
        // Already sent — advance to next step
        await advanceStep(enrollment.id, step, now);
        continue;
      }

      // Send the email
      const template = await prisma.emailTemplate.findUnique({ where: { id: step.templateId } });
      if (!template) {
        console.warn(`[sequenceEngine] template ${step.templateId} not found for step ${step.id}`);
        await advanceStep(enrollment.id, step, now);
        continue;
      }

      const { resendEmailId, error } = await sendEmail({
        to: enrollment.contact.email,
        subject: template.subject,
        bodyText: template.bodyText ?? undefined,
        bodyHtml: template.bodyHtml ?? undefined,
      });

      if (error) {
        console.error(`[sequenceEngine] send error for contact ${enrollment.contactId}:`, error);
        continue; // Don't advance — retry next cron run
      }

      // Create EmailSend record
      const emailSend = await prisma.emailSend.create({
        data: {
          contactId: enrollment.contactId,
          sequenceId: enrollment.sequenceId,
          sequenceStepId: step.id,
          templateId: template.id,
          resendEmailId,
          subject: template.subject,
          fromEmail: process.env.EMAIL_FROM ?? 'Aussie Grad Careers <kiron@aussiegradcareers.com.au>',
          toEmail: enrollment.contact.email,
        },
      });

      // Update Contact lastActivityAt
      await prisma.contact.update({
        where: { id: enrollment.contactId },
        data: { lastActivityAt: now },
      });

      await advanceStep(enrollment.id, step, now);
      sent++;

      console.log(`[sequenceEngine] sent step ${step.stepOrder} of "${enrollment.sequence.name}" to ${enrollment.contact.email}`);
    } catch (err) {
      console.error(`[sequenceEngine] error processing enrollment ${enrollment.id}:`, err);
    }
  }

  console.log(`[sequenceEngine] done — ${sent} email(s) sent`);
}

async function advanceStep(enrollmentId: string, currentStep: { stepOrder: number }, now: Date): Promise<void> {
  await prisma.contactSequence.update({
    where: { id: enrollmentId },
    data: {
      currentStep: currentStep.stepOrder + 1,
      lastStepSentAt: now,
    },
  });
}
```

- [ ] **Step 2: Create the cron wrapper**

```typescript
// server/src/cron/sequenceCron.ts
import cron from 'node-cron';
import { processSequenceEmails } from '../email/engine/sequenceEngine';

let cronStarted = false;

export function startSequenceCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // Every hour — frequent enough that day-0 steps don't feel delayed,
  // infrequent enough to not hammer the DB
  cron.schedule('0 * * * *', async () => {
    console.log('[sequenceCron] Starting email sequence processing');
    try {
      await processSequenceEmails();
    } catch (err) {
      console.error('[sequenceCron] Error:', err);
    }
  });

  console.log('[sequenceCron] Scheduled (hourly)');
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/email/engine/sequenceEngine.ts server/src/cron/sequenceCron.ts
git commit -m "feat(email): sequence engine + hourly cron for automated sends"
```

---

### Task 5: Contact CRUD API + tag assignment endpoints

**Files:**
- Create: `server/src/email/admin/contactRoutes.ts`
- Create: `server/src/email/admin/tagRoutes.ts`
- Modify: `server/src/index.ts` (register routes)

- [ ] **Step 1: Contact CRUD routes**

```typescript
// server/src/email/admin/contactRoutes.ts
import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();

// All admin routes require auth
router.use(authenticate);

// List contacts (searchable)
router.get('/admin/contacts', async (req: AuthRequest, res) => {
  const search = (req.query.search as string) || '';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const skip = (page - 1) * limit;

  const where = search
    ? { OR: [{ email: { contains: search, mode: 'insensitive' as const } }, { firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } }] }
    : {};

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: limit,
      orderBy: { lastActivityAt: { sort: 'desc', nulls: 'last' } },
      include: {
        tags: { include: { tag: true } },
        sequences: { where: { completed: false, unenrolledAt: null }, include: { sequence: true } },
        emailSends: { orderBy: { sentAt: 'desc' }, take: 1 },
        _count: { select: { emailSends: true } },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  res.json({
    contacts: contacts.map(c => ({
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      source: c.source,
      emailOptIn: c.emailOptIn,
      unsubscribedAt: c.unsubscribedAt,
      lastActivityAt: c.lastActivityAt,
      tags: c.tags.map(ct => ({ id: ct.tag.id, name: ct.tag.name, label: ct.tag.label })),
      activeSequence: c.sequences[0] ? { name: c.sequences[0].sequence.name, currentStep: c.sequences[0].currentStep } : null,
      lastEmailSent: c.emailSends[0]?.sentAt ?? null,
      totalSends: c._count.emailSends,
      createdAt: c.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// Get single contact with full details
router.get('/admin/contacts/:id', async (req: AuthRequest, res) => {
  const contact = await prisma.contact.findUnique({
    where: { id: req.params.id },
    include: {
      tags: { include: { tag: true } },
      notes: { orderBy: { createdAt: 'desc' } },
      sequences: {
        orderBy: { enrolledAt: 'desc' },
        include: { sequence: true },
      },
      emailSends: {
        orderBy: { sentAt: 'desc' },
        take: 50,
        include: {
          opens: { orderBy: { openedAt: 'desc' } },
          clicks: { orderBy: { clickedAt: 'desc' } },
          sequence: { select: { name: true } },
        },
      },
    },
  });

  if (!contact) { res.status(404).json({ error: 'Contact not found' }); return; }

  res.json(contact);
});

// Create contact
router.post('/admin/contacts', async (req: AuthRequest, res) => {
  const { email, firstName, lastName, source, tagIds } = req.body;
  if (!email) { res.status(400).json({ error: 'Email is required' }); return; }

  const contact = await prisma.contact.create({
    data: {
      email,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      source: source ?? 'manual',
      tags: tagIds?.length
        ? { create: tagIds.map((tagId: string) => ({ tagId })) }
        : undefined,
    },
    include: { tags: { include: { tag: true } } },
  });

  res.status(201).json(contact);
});

// Update contact
router.patch('/admin/contacts/:id', async (req: AuthRequest, res) => {
  const { firstName, lastName, email, emailOptIn, source, metadata } = req.body;
  const contact = await prisma.contact.update({
    where: { id: req.params.id },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && { email }),
      ...(emailOptIn !== undefined && { emailOptIn }),
      ...(source !== undefined && { source }),
      ...(metadata !== undefined && { metadata }),
      lastActivityAt: new Date(),
    },
  });
  res.json(contact);
});

// Add note to contact
router.post('/admin/contacts/:id/notes', async (req: AuthRequest, res) => {
  const { content } = req.body;
  if (!content) { res.status(400).json({ error: 'Content is required' }); return; }

  const note = await prisma.contactNote.create({
    data: { contactId: req.params.id, content },
  });

  await prisma.contact.update({
    where: { id: req.params.id },
    data: { lastActivityAt: new Date() },
  });

  res.status(201).json(note);
});

export default router;
```

- [ ] **Step 2: Tag assignment routes**

```typescript
// server/src/email/admin/tagRoutes.ts
import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { handleTagAssigned } from '../engine/enrollment';

const router = Router();
router.use(authenticate);

// List all tags
router.get('/admin/tags', async (_req: AuthRequest, res) => {
  const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } });
  res.json(tags);
});

// Assign tag to contact
router.post('/admin/contacts/:contactId/tags', async (req: AuthRequest, res) => {
  const { tagId } = req.body;
  if (!tagId) { res.status(400).json({ error: 'tagId is required' }); return; }

  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) { res.status(404).json({ error: 'Tag not found' }); return; }

  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId: req.params.contactId, tagId } },
    update: {},
    create: { contactId: req.params.contactId, tagId },
  });

  await prisma.contact.update({
    where: { id: req.params.contactId },
    data: { lastActivityAt: new Date() },
  });

  // Trigger enrollment logic
  await handleTagAssigned(req.params.contactId, tag.name).catch(err => {
    console.error('[tags] enrollment error:', err);
  });

  res.status(201).json({ success: true });
});

// Remove tag from contact
router.delete('/admin/contacts/:contactId/tags/:tagId', async (req: AuthRequest, res) => {
  await prisma.contactTag.delete({
    where: { contactId_tagId: { contactId: req.params.contactId, tagId: req.params.tagId } },
  });

  await prisma.contact.update({
    where: { id: req.params.contactId },
    data: { lastActivityAt: new Date() },
  });

  res.json({ success: true });
});

export default router;
```

- [ ] **Step 3: Register routes in index.ts**

```typescript
import emailContactRouter from './email/admin/contactRoutes';
import emailTagRouter from './email/admin/tagRoutes';

app.use('/api', emailContactRouter);
app.use('/api', emailTagRouter);
```

- [ ] **Step 4: Commit**

```bash
git add server/src/email/admin/ server/src/index.ts
git commit -m "feat(email): contact CRUD + tag assignment API routes"
```

---

### Task 6: Broadcast and analytics API routes

**Files:**
- Create: `server/src/email/broadcast/broadcastService.ts`
- Create: `server/src/email/admin/broadcastRoutes.ts`
- Create: `server/src/email/admin/analyticsRoutes.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Broadcast service**

```typescript
// server/src/email/broadcast/broadcastService.ts
import { prisma } from '../../index';
import { sendEmail } from '../send/sendEmail';

export async function sendBroadcast(broadcastId: string): Promise<{ total: number; sent: number; errors: number }> {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) throw new Error('Broadcast not found');

  const criteria = (broadcast.targetCriteria as { tag?: string }) ?? {};
  const tagName = criteria.tag;
  if (!tagName) throw new Error('Broadcast targetCriteria missing tag');

  const tag = await prisma.tag.findUnique({ where: { name: tagName } });
  if (!tag) throw new Error(`Tag "${tagName}" not found`);

  // Find all contacts with this tag, opted in, not unsubscribed
  const contactTags = await prisma.contactTag.findMany({
    where: {
      tagId: tag.id,
      contact: { emailOptIn: true, unsubscribedAt: null },
    },
    include: { contact: true },
  });

  let sent = 0;
  let errors = 0;

  for (const ct of contactTags) {
    try {
      const { resendEmailId, error } = await sendEmail({
        to: ct.contact.email,
        subject: broadcast.subject,
        bodyText: broadcast.bodyText ?? undefined,
        bodyHtml: broadcast.bodyHtml ?? undefined,
      });

      await prisma.emailSend.create({
        data: {
          contactId: ct.contactId,
          broadcastId: broadcast.id,
          resendEmailId,
          subject: broadcast.subject,
          fromEmail: process.env.EMAIL_FROM ?? 'Aussie Grad Careers <kiron@aussiegradcareers.com.au>',
          toEmail: ct.contact.email,
        },
      });

      await prisma.contact.update({
        where: { id: ct.contactId },
        data: { lastActivityAt: new Date() },
      });

      if (error) { errors++; continue; }
      sent++;
    } catch {
      errors++;
    }
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: 'sent', sentAt: new Date() },
  });

  console.log(`[broadcast] "${broadcast.name}" — ${sent} sent, ${errors} errors`);
  return { total: contactTags.length, sent, errors };
}
```

- [ ] **Step 2: Broadcast API routes**

```typescript
// server/src/email/admin/broadcastRoutes.ts
import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { sendBroadcast } from '../broadcast/broadcastService';

const router = Router();
router.use(authenticate);

// List broadcasts
router.get('/admin/broadcasts', async (_req: AuthRequest, res) => {
  const broadcasts = await prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(broadcasts);
});

// Create broadcast (draft or send immediately)
router.post('/admin/broadcasts', async (req: AuthRequest, res) => {
  const { name, subject, bodyText, bodyHtml, targetCriteria, sendNow } = req.body;
  if (!name || !subject || !targetCriteria) {
    res.status(400).json({ error: 'name, subject, and targetCriteria are required' });
    return;
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      name,
      subject,
      bodyText: bodyText ?? null,
      bodyHtml: bodyHtml ?? null,
      targetCriteria,
      status: sendNow ? 'sending' : 'draft',
    },
  });

  if (sendNow) {
    // Fire and forget
    sendBroadcast(broadcast.id).catch(err => {
      console.error('[broadcast] send error:', err);
    });
    res.json({ ...broadcast, status: 'sending' });
  } else {
    res.status(201).json(broadcast);
  }
});

// Send a draft broadcast
router.post('/admin/broadcasts/:id/send', async (req: AuthRequest, res) => {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: req.params.id } });
  if (!broadcast) { res.status(404).json({ error: 'Broadcast not found' }); return; }
  if (broadcast.status === 'sent') { res.status(400).json({ error: 'Already sent' }); return; }

  await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: { status: 'sending' },
  });

  // Fire and forget
  sendBroadcast(broadcast.id).catch(err => console.error('[broadcast] send error:', err));
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 3: Analytics routes**

```typescript
// server/src/email/admin/analyticsRoutes.ts
import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/admin/email-analytics', async (_req: AuthRequest, res) => {
  // Per-sequence stats
  const sequences = await prisma.emailSequence.findMany({
    include: {
      steps: true,
      _count: { select: { steps: true } },
    },
  });

  const sequenceStats = await Promise.all(
    sequences.map(async (seq) => {
      const sends = await prisma.emailSend.count({
        where: { sequenceId: seq.id },
      });
      const opens = await prisma.emailOpen.count({
        where: { emailSend: { sequenceId: seq.id } },
      });
      const clicks = await prisma.emailClick.count({
        where: { emailSend: { sequenceId: seq.id } },
      });
      const enrollments = await prisma.contactSequence.count({
        where: { sequenceId: seq.id },
      });
      const active = await prisma.contactSequence.count({
        where: { sequenceId: seq.id, completed: false, unenrolledAt: null },
      });

      return {
        id: seq.id,
        name: seq.name,
        priority: seq.priority,
        active,
        enrollments,
        sends,
        opens,
        clicks,
        openRate: sends > 0 ? Math.round((opens / sends) * 100) : 0,
        clickRate: sends > 0 ? Math.round((clicks / sends) * 100) : 0,
      };
    })
  );

  // Per-broadcast stats
  const broadcasts = await prisma.broadcast.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const broadcastStats = await Promise.all(
    broadcasts.map(async (b) => {
      const sends = await prisma.emailSend.count({
        where: { broadcastId: b.id },
      });
      const opens = await prisma.emailOpen.count({
        where: { emailSend: { broadcastId: b.id } },
      });
      const clicks = await prisma.emailClick.count({
        where: { emailSend: { broadcastId: b.id } },
      });
      return {
        id: b.id,
        name: b.name,
        subject: b.subject,
        status: b.status,
        sentAt: b.sentAt,
        sends,
        opens,
        clicks,
        openRate: sends > 0 ? Math.round((opens / sends) * 100) : 0,
        clickRate: sends > 0 ? Math.round((clicks / sends) * 100) : 0,
      };
    })
  );

  // Totals
  const totalContacts = await prisma.contact.count();
  const optedIn = await prisma.contact.count({ where: { emailOptIn: true, unsubscribedAt: null } });
  const totalSends = await prisma.emailSend.count();
  const totalOpens = await prisma.emailOpen.count();
  const totalClicks = await prisma.emailClick.count();

  res.json({
    totals: { totalContacts, optedIn, totalSends, totalOpens, totalClicks },
    sequences: sequenceStats,
    broadcasts: broadcastStats,
  });
});

export default router;
```

- [ ] **Step 4: Register in index.ts**

```typescript
import emailBroadcastRouter from './email/admin/broadcastRoutes';
import emailAnalyticsRouter from './email/admin/analyticsRoutes';

app.use('/api', emailBroadcastRouter);
app.use('/api', emailAnalyticsRouter);
```

- [ ] **Step 5: Commit**

```bash
git add server/src/email/broadcast/ server/src/email/admin/broadcastRoutes.ts server/src/email/admin/analyticsRoutes.ts server/src/index.ts
git commit -m "feat(email): broadcast service + analytics API routes"
```

---

### Task 7: Admin frontend — contacts list page

**Files:**
- Create: `src/pages/AdminContacts.tsx`
- Create: `src/pages/AdminContactDetail.tsx`
- Create: `src/pages/AdminBroadcasts.tsx`
- Create: `src/pages/EmailAnalytics.tsx`
- Modify: `src/App.tsx` (add routes)

- [ ] **Step 1: Create the contacts list page**

```tsx
// src/pages/AdminContacts.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Mail, Tag, Users } from 'lucide-react';
import api from '../lib/api';

export default function AdminContacts() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-contacts', search],
    queryFn: () => api.get('/admin/contacts', { params: { search } }).then(r => r.data),
  });

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          <Users size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Contacts
        </h1>
        <Link to="/admin/contacts/new" style={{
          padding: '8px 16px', background: '#2d5a6e', color: '#fff',
          borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14,
        }}>
          + New Contact
        </Link>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#999' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or name..."
          style={{
            width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8,
            border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box',
          }}
        />
      </div>

      {isLoading ? (
        <p>Loading contacts...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
              <th style={{ padding: '10px 8px' }}>Email</th>
              <th style={{ padding: '10px 8px' }}>Name</th>
              <th style={{ padding: '10px 8px' }}>Tags</th>
              <th style={{ padding: '10px 8px' }}>Active Sequence</th>
              <th style={{ padding: '10px 8px' }}>Last Email</th>
              <th style={{ padding: '10px 8px' }}>Sends</th>
              <th style={{ padding: '10px 8px' }}>Opt-In</th>
            </tr>
          </thead>
          <tbody>
            {data?.contacts?.map((c: any) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 8px' }}>
                  <Link to={`/admin/contacts/${c.id}`} style={{ color: '#2d5a6e', textDecoration: 'none' }}>
                    {c.email}
                  </Link>
                </td>
                <td style={{ padding: '10px 8px' }}>{c.firstName || c.lastName ? `${c.firstName ?? ''} ${c.lastName ?? ''}` : '—'}</td>
                <td style={{ padding: '10px 8px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {c.tags?.map((t: any) => (
                      <span key={t.id} style={{
                        background: '#e8edf0', padding: '2px 8px', borderRadius: 12,
                        fontSize: 12, color: '#2d5a6e', fontWeight: 600,
                      }}>
                        {t.label || t.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '10px 8px', fontSize: 13 }}>
                  {c.activeSequence ? `${c.activeSequence.name} (step ${c.activeSequence.currentStep})` : '—'}
                </td>
                <td style={{ padding: '10px 8px', fontSize: 13, color: '#888' }}>
                  {c.lastEmailSent ? new Date(c.lastEmailSent).toLocaleDateString() : '—'}
                </td>
                <td style={{ padding: '10px 8px' }}>{c.totalSends}</td>
                <td style={{ padding: '10px 8px' }}>
                  {c.emailOptIn ? <span style={{ color: '#2a9d6f' }}>Yes</span> : <span style={{ color: '#c2603f' }}>No</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create contact detail page**

```tsx
// src/pages/AdminContactDetail.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Plus, X, Send, Clock, Eye, MousePointer } from 'lucide-react';
import api from '../lib/api';

export default function AdminContactDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [noteContent, setNoteContent] = useState('');

  const { data: contact, isLoading } = useQuery({
    queryKey: ['admin-contact', id],
    queryFn: () => api.get(`/admin/contacts/${id}`).then(r => r.data),
  });

  const { data: allTags } = useQuery({
    queryKey: ['admin-tags'],
    queryFn: () => api.get('/admin/tags').then(r => r.data),
  });

  const addTag = useMutation({
    mutationFn: (tagId: string) => api.post(`/admin/contacts/${id}/tags`, { tagId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-contact'] }); toast.success('Tag added'); },
  });

  const removeTag = useMutation({
    mutationFn: (tagId: string) => api.delete(`/admin/contacts/${id}/tags/${tagId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-contact'] }); toast.success('Tag removed'); },
  });

  const addNote = useMutation({
    mutationFn: (content: string) => api.post(`/admin/contacts/${id}/notes`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-contact'] });
      setNoteContent('');
      toast.success('Note added');
    },
  });

  if (isLoading) return <p>Loading...</p>;
  if (!contact) return <p>Contact not found</p>;

  const availableTags = allTags?.filter((t: any) => !contact.tags?.some((ct: any) => ct.tag?.id === t.id || ct.id === t.id)) ?? [];

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <Link to="/admin/contacts" style={{ color: '#2d5a6e', textDecoration: 'none', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <ArrowLeft size={16} /> Back to contacts
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>{contact.email}</h1>
      <p style={{ color: '#888', margin: '0 0 20px', fontSize: 14 }}>
        {contact.firstName || contact.lastName ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}` : 'No name'} · {contact.source} · Created {new Date(contact.createdAt).toLocaleDateString()}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left column */}
        <div>
          {/* Tags */}
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={16} /> Tags</h3>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {contact.tags?.map((ct: any) => {
                const tag = ct.tag || ct;
                return (
                  <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e8edf0', padding: '4px 8px', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#2d5a6e' }}>
                    {tag.label || tag.name}
                    <button onClick={() => removeTag.mutate(tag.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#888', fontSize: 14, lineHeight: 1 }}><X size={14} /></button>
                  </span>
                );
              })}
            </div>
            {availableTags.length > 0 && (
              <select
                value=""
                onChange={e => { if (e.target.value) addTag.mutate(e.target.value); }}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
              >
                <option value="">+ Add tag...</option>
                {availableTags.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.label || t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Sequence enrollment */}
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Send size={16} /> Sequences</h3>
            {contact.sequences?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contact.sequences.map((cs: any) => (
                  <div key={cs.id} style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #eee' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{cs.sequence.name}</div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      Step {cs.currentStep} · {cs.completed ? 'Completed' : 'Active'} · Enrolled {new Date(cs.enrolledAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: 13, color: '#888' }}>Not enrolled in any sequences</p>}
          </div>

          {/* Email history */}
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={16} /> Email History</h3>
            {contact.emailSends?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {contact.emailSends.map((send: any) => (
                  <div key={send.id} style={{ background: '#fff', borderRadius: 8, padding: 10, border: '1px solid #eee', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{send.subject}</div>
                    <div style={{ color: '#888', fontSize: 12 }}>
                      {new Date(send.sentAt).toLocaleString()} · {send.sequence?.name || 'Broadcast'}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12 }}>
                      <span><Eye size={12} style={{ verticalAlign: 'middle' }} /> {send.opens?.length || 0} opens</span>
                      <span><MousePointer size={12} style={{ verticalAlign: 'middle' }} /> {send.clicks?.length || 0} clicks</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: 13, color: '#888' }}>No emails sent yet</p>}
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Notes timeline */}
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={16} /> Notes</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <textarea
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, resize: 'vertical' }}
              />
              <button
                onClick={() => { if (noteContent.trim()) addNote.mutate(noteContent.trim()); }}
                disabled={addNote.isPending}
                style={{ padding: '8px 12px', background: '#2d5a6e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, alignSelf: 'flex-end' }}
              >
                <Plus size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
              {contact.notes?.map((n: any) => (
                <div key={n.id} style={{ background: '#fff', borderRadius: 8, padding: 10, border: '1px solid #eee' }}>
                  <p style={{ margin: 0, fontSize: 13 }}>{n.content}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#888' }}>{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {(!contact.notes || contact.notes.length === 0) && <p style={{ fontSize: 13, color: '#888' }}>No notes yet</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create broadcast page**

```tsx
// src/pages/AdminBroadcasts.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, Save, Eye, MousePointer } from 'lucide-react';
import api from '../lib/api';

export default function AdminBroadcasts() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [targetTag, setTargetTag] = useState('');
  const [preview, setPreview] = useState(false);

  const { data: allTags } = useQuery({
    queryKey: ['admin-tags'],
    queryFn: () => api.get('/admin/tags').then(r => r.data),
  });

  const { data: broadcasts } = useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: () => api.get('/admin/broadcasts').then(r => r.data),
  });

  const saveDraft = useMutation({
    mutationFn: () => api.post('/admin/broadcasts', { name, subject, bodyText, bodyHtml, targetCriteria: { tag: targetTag } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-broadcasts'] }); toast.success('Draft saved'); resetForm(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to save'),
  });

  const sendNow = useMutation({
    mutationFn: () => api.post('/admin/broadcasts', { name, subject, bodyText, bodyHtml, targetCriteria: { tag: targetTag }, sendNow: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-broadcasts'] }); toast.success('Broadcast sending!'); resetForm(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to send'),
  });

  const sendDraft = useMutation({
    mutationFn: (id: string) => api.post(`/admin/broadcasts/${id}/send`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-broadcasts'] }); toast.success('Sending'); },
  });

  function resetForm() { setName(''); setSubject(''); setBodyText(''); setBodyHtml(''); setTargetTag(''); }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        <Send size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Broadcasts
      </h1>

      <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>New Broadcast</h2>
        
        <div style={{ display: 'grid', gap: 12 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Broadcast name (internal)" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }} />
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }} />
          <select value={targetTag} onChange={e => setTargetTag(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}>
            <option value="">Select target tag...</option>
            {allTags?.map((t: any) => <option key={t.id} value={t.name}>{t.label || t.name}</option>)}
          </select>

          <textarea
            value={bodyText}
            onChange={e => setBodyText(e.target.value)}
            placeholder="Plain text body..."
            rows={6}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, resize: 'vertical', fontFamily: 'monospace' }}
          />
          <textarea
            value={bodyHtml}
            onChange={e => setBodyHtml(e.target.value)}
            placeholder="HTML body (optional)..."
            rows={8}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, resize: 'vertical', fontFamily: 'monospace' }}
          />
        </div>

        {preview && bodyHtml && (
          <div style={{ marginTop: 12, border: '1px solid #ddd', borderRadius: 8, padding: 16, background: '#fff' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>HTML Preview:</div>
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPreview(!preview)} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            {preview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button onClick={() => saveDraft.mutate()} disabled={!name || !subject || !targetTag} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Save size={14} /> Save Draft
          </button>
          <button onClick={() => sendNow.mutate()} disabled={!name || !subject || !targetTag || sendNow.isPending} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#2d5a6e', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Send size={14} /> Send Now
          </button>
        </div>
      </div>

      {/* Past broadcasts */}
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>Past Broadcasts</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Target</th>
            <th style={{ padding: '8px' }}>Status</th>
            <th style={{ padding: '8px' }}>Sends</th>
            <th style={{ padding: '8px' }}>Opens</th>
            <th style={{ padding: '8px' }}>Clicks</th>
            <th style={{ padding: '8px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {broadcasts?.map((b: any) => (
            <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px' }}>{b.name}</td>
              <td style={{ padding: '8px', fontSize: 13 }}>{b.targetCriteria?.tag || '—'}</td>
              <td style={{ padding: '8px' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: b.status === 'sent' ? '#e8f5e9' : b.status === 'draft' ? '#fff8e1' : '#e3f2fd',
                  color: b.status === 'sent' ? '#2e7d32' : b.status === 'draft' ? '#f57f17' : '#1565c0',
                }}>{b.status}</span>
              </td>
              <td style={{ padding: '8px' }}>{b.totalSends || '—'}</td>
              <td style={{ padding: '8px' }}>{b.totalOpens || '—'}</td>
              <td style={{ padding: '8px' }}>{b.totalClicks || '—'}</td>
              <td style={{ padding: '8px' }}>
                {b.status === 'draft' && (
                  <button onClick={() => sendDraft.mutate(b.id)} style={{ padding: '4px 10px', border: '1px solid #2d5a6e', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#2d5a6e' }}>Send</button>
                )}
              </td>
            </tr>
          ))}
          {(!broadcasts || broadcasts.length === 0) && (
            <tr><td colSpan={7} style={{ padding: '16px', color: '#888', textAlign: 'center' }}>No broadcasts yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create analytics page**

```tsx
// src/pages/EmailAnalytics.tsx
import { useQuery } from '@tanstack/react-query';
import { Send, Eye, MousePointer, Users } from 'lucide-react';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';

export default function EmailAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['email-analytics'],
    queryFn: () => api.get('/admin/email-analytics').then(r => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <p style={{ padding: 24 }}>Loading analytics...</p>;

  const statCard = (icon: any, label: string, value: number | string, sub?: string) => (
    <div style={{ background: warm.surface, borderRadius: 12, padding: '16px 20px', border: `1px solid ${warm.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: 13, color: warm.muted }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: warm.muted }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        Email Analytics
      </h1>

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {statCard(<Users size={18} color={warm.muted} />, 'Total Contacts', data?.totals?.totalContacts ?? 0, `${data?.totals?.optedIn ?? 0} opted in`)}
        {statCard(<Send size={18} color={warm.muted} />, 'Emails Sent', data?.totals?.totalSends ?? 0)}
        {statCard(<Eye size={18} color={warm.muted} />, 'Opens', data?.totals?.totalOpens ?? 0)}
        {statCard(<MousePointer size={18} color={warm.muted} />, 'Clicks', data?.totals?.totalClicks ?? 0)}
      </div>

      {/* Per-sequence */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Sequences</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 32 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Priority</th>
            <th style={{ padding: '8px' }}>Active</th>
            <th style={{ padding: '8px' }}>Enrolled</th>
            <th style={{ padding: '8px' }}>Sends</th>
            <th style={{ padding: '8px' }}>Open Rate</th>
            <th style={{ padding: '8px' }}>Click Rate</th>
          </tr>
        </thead>
        <tbody>
          {data?.sequences?.map((s: any) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>{s.name}</td>
              <td style={{ padding: '8px' }}>{s.priority === 1 ? 'Highest' : s.priority === 4 ? 'Lowest' : s.priority}</td>
              <td style={{ padding: '8px' }}>{s.active}</td>
              <td style={{ padding: '8px' }}>{s.enrollments}</td>
              <td style={{ padding: '8px' }}>{s.sends}</td>
              <td style={{ padding: '8px' }}>{s.openRate}%</td>
              <td style={{ padding: '8px' }}>{s.clickRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Per-broadcast */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Broadcasts</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Status</th>
            <th style={{ padding: '8px' }}>Sent</th>
            <th style={{ padding: '8px' }}>Sends</th>
            <th style={{ padding: '8px' }}>Open Rate</th>
            <th style={{ padding: '8px' }}>Click Rate</th>
          </tr>
        </thead>
        <tbody>
          {data?.broadcasts?.map((b: any) => (
            <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>{b.name}</td>
              <td style={{ padding: '8px' }}>{b.status}</td>
              <td style={{ padding: '8px', fontSize: 13 }}>{b.sentAt ? new Date(b.sentAt).toLocaleDateString() : '—'}</td>
              <td style={{ padding: '8px' }}>{b.sends}</td>
              <td style={{ padding: '8px' }}>{b.openRate}%</td>
              <td style={{ padding: '8px' }}>{b.clickRate}%</td>
            </tr>
          ))}
          {(!data?.broadcasts || data.broadcasts.length === 0) && (
            <tr><td colSpan={6} style={{ padding: '16px', color: '#888', textAlign: 'center' }}>No broadcasts</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Add routes to App.tsx**

Find the admin routes in `src/App.tsx` (search for `AdminDashboard` or similar) and add:

```tsx
import AdminContacts from './pages/AdminContacts';
import AdminContactDetail from './pages/AdminContactDetail';
import AdminBroadcasts from './pages/AdminBroadcasts';
import EmailAnalytics from './pages/EmailAnalytics';

// Inside the router, add:
<Route path="/admin/contacts" element={<AdminContacts />} />
<Route path="/admin/contacts/new" element={<AdminContactDetail />} />
<Route path="/admin/contacts/:id" element={<AdminContactDetail />} />
<Route path="/admin/broadcasts" element={<AdminBroadcasts />} />
<Route path="/admin/email-analytics" element={<EmailAnalytics />} />
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminContacts.tsx src/pages/AdminContactDetail.tsx src/pages/AdminBroadcasts.tsx src/pages/EmailAnalytics.tsx src/App.tsx
git commit -m "feat(admin): contacts, broadcast, and analytics admin pages"
```

---

### Task 8: Backfill — link anonymous CV scan contacts + existing profiles

**Files:**
- Modify: `server/src/lib/supabase.ts` (already exists — no change needed)
- Modify: `server/src/services/email.ts` (already exists — no change needed yet)
- Create: `server/src/email/sync/linkCandidateProfiles.ts`

- [ ] **Step 1: Create backfill script for existing CandidateProfiles**

```typescript
// server/src/email/sync/linkCandidateProfiles.ts
// One-time script to create Contact records for existing CandidateProfiles
// that have email addresses. Safe to run multiple times.
import { prisma } from '../../index';

export async function backfillContactsFromProfiles(): Promise<number> {
  const profiles = await prisma.candidateProfile.findMany({
    where: {
      email: { not: null },
      contactId: null,
    },
    select: { userId: true, email: true, name: true },
  });

  let count = 0;
  for (const profile of profiles) {
    if (!profile.email) continue;

    // Upsert contact
    const contact = await prisma.contact.upsert({
      where: { email: profile.email },
      update: { firstName: profile.name ?? undefined, lastActivityAt: new Date() },
      create: {
        email: profile.email,
        firstName: profile.name ?? null,
        source: 'signup',
        lastActivityAt: new Date(),
      },
    });

    // Link profile
    await prisma.candidateProfile.update({
      where: { userId: profile.userId },
      data: { contactId: contact.id },
    });

    // Assign signed_up tag if exists
    const tag = await prisma.tag.findUnique({ where: { name: 'signed_up' } });
    if (tag) {
      await prisma.contactTag.upsert({
        where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
        update: {},
        create: { contactId: contact.id, tagId: tag.id },
      }).catch(() => {});
    }

    count++;
  }

  console.log(`[backfill] linked ${count} CandidateProfile(s) to Contacts`);
  return count;
}
```

- [ ] **Step 2: Run the backfill on startup**

In `ensureColumns()` after `ensureEmailTables()` and seed calls:

```typescript
import { backfillContactsFromProfiles } from './email/sync/linkCandidateProfiles';

// After seedTags/templates calls:
try {
  await backfillContactsFromProfiles();
} catch (err) {
  console.warn('[startup] contact backfill skipped:', err);
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/email/sync/linkCandidateProfiles.ts server/src/index.ts
git commit -m "feat(email): backfill Contacts from existing CandidateProfiles"
```

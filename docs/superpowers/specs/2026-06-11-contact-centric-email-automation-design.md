# Contact-Centric Email Automation System

**Date:** 2026-06-11
**Status:** Draft
**Project:** JobHub (Aussie Grad Careers)

## 1. Philosophy

Every person we communicate with exists as a **Contact** — the single source of truth for email recipients. Contacts are identified by email address and exist independently of Supabase auth or CandidateProfile. Tags, sequences, and email history all hang off Contact, not auth.

## 2. Schema

### 2.1 Core Models

```prisma
model Contact {
  id              String    @id @default(uuid())
  email           String    @unique
  firstName       String?
  lastName        String?
  source          String    @default("manual")
  // "signup", "sales_call", "lead_magnet", "manual", "import"
  metadata        Json?
  emailOptIn      Boolean   @default(true)
  unsubscribedAt  DateTime?
  lastActivityAt  DateTime?
  // Tracks last meaningful interaction (email sent, open, click, note added, tag
  // changed). Enables queries like "contacts inactive for 30 days" without scanning
  // multiple tables. Updated by the engine on every contact-touching operation.
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
```

### 2.2 Template & Sequence Models

```prisma
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
  // "welcome_sequence", "cv_scan_followup", "sales_nurture", "client_onboarding"
  description String?
  priority    Int      @default(0)
  // Lower number = higher priority. 1=client_onboarding, 2=sales_nurture,
  // 3=cv_scan_followup, 4=welcome_sequence
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())

  steps SequenceStep[]
}

model SequenceStep {
  id         String   @id @default(uuid())
  sequenceId String
  stepOrder  Int
  delayDays  Int
  // 0 = send immediately on enrollment
  templateId String
  createdAt  DateTime @default(now())

  sequence EmailSequence  @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  template EmailTemplate  @relation(fields: [templateId], references: [id])

  @@unique([sequenceId, stepOrder])
  @@index([sequenceId])
}
```

### 2.3 Enrollment & Send Tracking

```prisma
model ContactSequence {
  id                String    @id @default(uuid())
  contactId         String
  sequenceId        String
  currentStep       Int       @default(0)
  completed         Boolean   @default(false)
  lastStepSentAt    DateTime?
  // When the previous step was actually sent. Used by the sequence engine to
  // compute scheduledSendAt = lastStepSentAt + step.delayDays. Null if no
  // step has been sent yet (falls back to enrolledAt).
  enrolledAt        DateTime  @default(now())
  completedAt       DateTime?
  unenrolledAt      DateTime?
  unenrolledReason  String?
  // "completed", "upgraded_sequence", "manual", "converted", "unsubscribed"

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
  // null = sequence email; non-null = broadcast
  resendEmailId   String?
  subject         String
  fromEmail       String
  toEmail         String
  sentAt          DateTime @default(now())

  contact     Contact       @relation(fields: [contactId], references: [id], onDelete: Cascade)
  sequence    EmailSequence? @relation(fields: [sequenceId], references: [id])
  template    EmailTemplate? @relation(fields: [templateId], references: [id])
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
  // V1 supports single-tag targeting. JSON object for future flexibility:
  //   { "tag": "cv_scanned" }
  // Future: { "includeTags": ["cv_scanned"], "excludeTags": ["client"] }
  status    String   @default("draft")
  // "draft", "scheduled", "sent"
  sentAt    DateTime?
  createdAt DateTime @default(now())
}
```

### 2.4 CandidateProfile Changes

```prisma
model CandidateProfile {
  // ... all existing fields remain ...
  contactId String?
  contact   Contact?  @relation(fields: [contactId], references: [id])
}
```

### 2.5 Seed Tags

Seeded on first deploy or migration:
- `signed_up`
- `cv_scanned`
- `cv_fixed`
- `sales_call_booked`
- `sales_call_completed`
- `hot_lead`
- `client`

## 3. Business Rules

### 3.1 Nurture Sequence Mutual Exclusion

A contact may only be enrolled in **one** active nurture sequence at a time.

| Priority | Sequence | Trigger Tag |
|----------|----------|-------------|
| 1 (highest) | `client_onboarding` | `client` |
| 2 | `sales_nurture` | `sales_call_booked` |
| 3 | `cv_scan_followup` | `cv_scanned` |
| 4 | `welcome_sequence` | `signed_up` |

**Rule:** When enrolling in a sequence:
1. Find all currently-active sequences for this contact.
2. If any has higher priority (lower number), do NOT enroll — the existing sequence takes precedence.
3. If the new sequence has equal or higher priority, unenroll from all lower-priority sequences first.
4. Then enroll in the new sequence.

**Examples:**
- `sales_call_booked` → unenroll from `welcome_sequence` and `cv_scan_followup`, enroll in `sales_nurture`
- `client` → unenroll from ALL sequences, enroll in `client_onboarding`

### 3.2 Reactivation

Not automated in V1. Manual through admin UI only.

### 3.3 Broadcasts

Separate from sequences. One-off sends to all contacts with a given tag. Tracked through the same `EmailSend`/`EmailOpen`/`EmailClick` tables for unified reporting.

### 3.4 Extensibility

New sequence types and reactivation logic can be added without schema changes — they're data, not code. Add a new `EmailSequence` row and its `SequenceStep` rows, then add the tag → sequence mapping in the enrollment code.

## 4. User Journeys

### 4.1 Anonymous CV Scan → Lead

```
Visitor lands on landing page
  ↓
Scans CV → result reveals
  ↓
Enters email to receive roadmap
  ↓
Upsert Contact (keyed on email)
  ↓
Add tag: cv_scanned
  ↓
Send roadmap email (immediate one-off via broadcast)
  ↓
Enroll in: cv_scan_followup_sequence
```

### 4.2 Signup (post-CV-scan or direct)

```
User signs up via Supabase auth
  ↓
Find or create Contact (by email)
  ↓
Link CandidateProfile.contactId → Contact
  ↓
Add tag: signed_up
  ↓
Already in cv_scan_followup_sequence?
  ├─ YES → leave it (higher priority than welcome)
  └─ NO  → enroll in welcome_sequence
```

### 4.3 Sales Call Booked

```
Admin books call
  ↓
Add tag: sales_call_booked
  ↓
auto → unenroll from welcome_sequence / cv_scan_followup
  ↓
auto → enroll in sales_nurture
```

### 4.4 Sales Call Completed

```
Admin marks call done
  ↓
Add tag: sales_call_completed
  ↓
Remove tag: sales_call_booked

Outcome:
  ├─ Hot lead → add tag: hot_lead (stays in sales_nurture)
  └─ Cold/no-show → manual admin action
```

### 4.5 Becomes Client

```
Payment received / access granted
  ↓
Add tag: client
  ↓
auto → remove tags: sales_call_booked, sales_call_completed, hot_lead
  ↓
auto → unenroll from ALL sequences
  ↓
auto → enroll in client_onboarding
```

**Rationale for tag cleanup:** Prevents accumulation of conflicting tags like `client` + `hot_lead` + `sales_call_booked`. If a client later becomes inactive, future re-engagement queries won't need to filter out the noise.

### 4.6 Manual Contact Creation

```
Admin creates Contact via admin UI
  ↓
Assign tags manually
  ↓
Optionally enroll in sequence
```

## 5. Architecture

### 5.1 Folder Structure

```
server/src/
├── email/
│   ├── engine/
│   │   ├── sequenceEngine.ts       // Daily cron: determine who to email
│   │   ├── enrollment.ts           // Enroll/unenroll with priority resolution
│   │   └── deduplication.ts        // Guard: never send same step twice
│   ├── send/
│   │   ├── sendEmail.ts            // Resend API wrapper
│   │   └── trackEmail.ts           // Inject tracking pixel + link wrapper
│   ├── tracking/
│   │   ├── openTracker.ts          // Endpoint for tracking pixel
│   │   └── clickTracker.ts         // Redirect endpoint for tracked links
│   ├── templates/
│   │   ├── renderTemplate.ts       // Merge variables into template
│   │   └── seedTemplates.ts        // Seed initial templates
│   ├── broadcast/
│   │   └── broadcastService.ts     // Send broadcast to tag-matched contacts
│   └── admin/
│       ├── contactRoutes.ts         // CRUD contacts, tags, notes
│       ├── sequenceRoutes.ts        // View/manage enrollment
│       ├── broadcastRoutes.ts       // Trigger broadcasts
│       └── analyticsRoutes.ts       // Send/open/click stats
├── cron/
│   ├── sequenceCron.ts             // Daily cron calling sequenceEngine
│   └── index.ts                    // Register all crons
```

### 5.2 Sequence Engine — Timing Model (Critical Design Decision)

**Problem:** Delays must be relative to the *previous send*, not enrollment. If cron misses a day or a send fails, timing drifts under the `days_since(enrolledAt)` model.

**Solution:** Each `ContactSequence` tracks when the last step was sent, and the engine computes `scheduledSendAt` from that.

```prisma
model ContactSequence {
  // ... existing fields ...
  lastStepSentAt DateTime?
  // When the previous step was actually sent (or null if no step sent yet).
  // The next step's scheduled date = lastStepSentAt + delayDays (or enrolledAt
  // if lastStepSentAt is null).
}
```

**Algorithm:**

```
for each active ContactSequence where completed = false:
    step = SequenceStep where stepOrder = currentStep
    
    // Compute when this step should send
    baseDate = contactSequence.lastStepSentAt ?? contactSequence.enrolledAt
    scheduledSendAt = baseDate + step.delayDays days
    
    if now < scheduledSendAt:
        continue  // not yet time; check again tomorrow
    
    if already sent this step (EmailSend exists for this contact + step):
        // deduplication guard — move past it
        advance to next step
        continue
    
    if contact is unsubscribed or opted out:
        unenroll(contact, sequence, reason: "unsubscribed")
        continue
    
    send email via Resend
    create EmailSend record
    update ContactSequence.lastStepSentAt = now
    advance currentStep by 1
    if step was the last step:
        mark ContactSequence.completed = true
```

**Edge cases the engine must handle:**
- **Cron missed a day:** Timing self-corrects because `scheduledSendAt` only checks if `now >= scheduledSendAt`. A missed day means it sends next run.
- **Resend API fails:** Send fails without creating an EmailSend → `lastStepSentAt` is not updated → next cron run retries the same step.
- **Contact already sent this step** (e.g. manual send): Dedup guard skips and advances — no duplicate.
- **Delay of 0:** Sends on the next cron run after enrollment (immediate relative to cron cadence, not wall-clock instant).

### 5.3 Tracking

**Open tracking:** A 1×1 transparent pixel appended to each HTML email body. The pixel URL is `{API_URL}/email/track/open/{emailSendId}`. On load, creates an `EmailOpen` record and returns a transparent GIF.

**Click tracking:** All links in emails are rewritten to `{API_URL}/email/track/click/{emailSendId}?url={encoded_target}`. On request, creates an `EmailClick` record and redirects to the target URL.

### 5.4 Admin Interface

React pages at `/admin/contacts`:

| View | Content |
|------|---------|
| **Contacts list** | Table: email, name, tags (as chips), active sequence, last email sent. Searchable by email/name. |
| **Contact detail** | Tags (add/remove with dropdown), notes timeline (text input + submit), sequence enrollment (current step, progress bar, unenroll button), email history (table of sends with open/click indicators) |
| **Broadcast composer** | Dropdown for target tag (stored as `targetCriteria`), subject input, body textarea (with preview), "Send to all" and "Save as draft" buttons. Drafts are saved with `status: "draft"` and can be sent later. |
| **Analytics** | Per-sequence send/open/click rates. Per-broadcast stats. Simple date range filter. |

## 6. Non-Goals (V1)

- A/B testing email variants
- Automated reactivation / re-engagement sequences
- Drag-and-drop sequence builder
- CSV import of contacts
- Webhook notifications on email events
- Preference center page for contacts

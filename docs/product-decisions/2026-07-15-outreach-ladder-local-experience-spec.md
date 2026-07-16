# Spec: Outreach Follow-Up Ladder + Local Experience Log

> Written 2026-07-15 for implementation by Kimi. Self-contained; no prior conversation
> context needed. Two features, both in JobHub (Express + Prisma server, React client).
> Read `AGC-SYSTEM-OVERVIEW.md` at repo root for the wider system map.

## Design philosophy (applies to both features)

**Zero additional work for the student.** Logging must be a side effect of actions they
already take, never a separate chore. The student types a name, gets a default message,
edits it if they want, presses Copy, and pastes it into LinkedIn themselves. The Copy
press IS the log entry. No "save" buttons, no forms after the fact.

**No automated sending.** Messages are always copy-pasted manually by the student.
This is deliberate: auto-sending LinkedIn messages violates LinkedIn ToS and risks
student accounts. Do not add any send integration.

---

## Feature A: Outreach follow-up ladder

### Problem
Students send one LinkedIn message, get no reply, and stop. The existing `OutreachLog`
model records only the first message (`firstMessage` field) with no follow-ups and no
outcome, so nobody (student or coach) can see reply rates or whether conversations go
anywhere.

### Behaviour
Each outreach becomes a 3-touch ladder:

| Touch | When | Default message intent |
|---|---|---|
| 1 | Day 0 | The existing opener (personalised: name, company, topic, specific question) |
| 2 | Touch 1 + 4 days, no reply | Short, friendly bump: "just floating this back up" |
| 3 | Touch 2 + 6 days, no reply | Graceful close: "I get it, you're busy, won't bug you again, door's open" |

- Cadence lives in one constants object (e.g. `OUTREACH_CADENCE = [0, 4, 6]` day offsets)
  so it can be tuned without hunting.
- After touch 3 plus 7 days with no reply, the outreach auto-closes as `CLOSED_NO_REPLY`
  (computed lazily on read is fine; no cron needed).
- At any point one tap on "They replied" stops the ladder and sets status `REPLIED`.
  From a replied state the student can later mark `CALL_BOOKED` or `REFERRAL` (one tap
  each). A manual "Close" sets `CLOSED_MANUAL`.
- Students can edit any default message before copying. The logged body is whatever was
  actually on the clipboard when they pressed Copy. Deviating from the script is fine
  and expected; the log captures reality.

### Schema (Prisma migration)

Extend `OutreachLog` (server/prisma/schema.prisma, currently ~line 218):

```prisma
enum OutreachStatus {
  ACTIVE          // in the ladder, awaiting reply or next touch
  REPLIED
  CALL_BOOKED
  REFERRAL
  CLOSED_NO_REPLY
  CLOSED_MANUAL
}

model OutreachLog {
  // existing fields stay: id, userId, personName, company, topic,
  // specificQuestion, firstMessage, createdAt
  status    OutreachStatus    @default(ACTIVE)
  messages  OutreachMessage[]
}

model OutreachMessage {
  id            String      @id @default(uuid())
  outreachLogId String
  touchNumber   Int         // 1, 2, or 3
  body          String      // what was actually copied
  copiedAt      DateTime    @default(now())
  outreachLog   OutreachLog @relation(fields: [outreachLogId], references: [id])

  @@unique([outreachLogId, touchNumber])
  @@index([outreachLogId])
}
```

Migration backfill: for each existing `OutreachLog` row with a non-empty `firstMessage`,
create an `OutreachMessage` with `touchNumber: 1`, `body: firstMessage`,
`copiedAt: createdAt`. Keep the `firstMessage` column for now (no destructive change).

If the student re-copies the same touch (edited the text and copied again), upsert:
last copy wins for that touch number.

### API
Outreach routes live with the tracker (check `server/src/routes/tracker.ts` for the
existing outreach endpoints and follow their conventions and auth middleware):

- `POST /outreach/:id/copy` body `{ touchNumber, body }` — upserts the OutreachMessage,
  returns updated ladder state. Called when the client Copy button fires.
- `POST /outreach/:id/status` body `{ status }` — one-tap status changes. Validate legal
  transitions (anything → REPLIED/CLOSED_MANUAL; REPLIED → CALL_BOOKED/REFERRAL).
- `GET /outreach/due` — outreaches where the next touch is due today or overdue
  (status ACTIVE, last touch older than the cadence offset). This powers the
  "follow-ups due" list.

### Client UX
In the existing outreach/tracker area:

1. **New outreach** (mostly exists): name, company, topic, specific question in →
   default opener rendered → editable textarea → big Copy button. Copy writes touch 1.
2. **Follow-ups due** list: each due item shows the person, days since last touch, and
   the pre-filled next message (touch 2 or 3 template with name substituted) → edit →
   Copy logs it. This list should sit where the student starts their session; it is the
   whole point of the feature.
3. Each outreach row shows: ladder dots (sent/due/pending per touch), status chip, and
   the one-tap buttons: "Replied", then "Call booked" / "Referral" once replied.
4. Default templates for touches 2 and 3: short, warm, no guilt-tripping. Touch 3 must
   close with dignity ("no worries at all, I won't follow up again — if things change,
   my door's open"). Keep templates in one file next to the cadence constants.

### Reporting hook (small but required)
Extend `GET /api/admin/coach/overview` (`server/src/routes/coach.ts`) per-member payload
with an outreach funnel: `{ sent, replied, callsBooked, referrals, closedNoReply }`
counted over the last 4 completed weeks plus current week. The external Pulse dashboard
consumes this; do not build any UI for it in JobHub beyond the data.

---

## Feature B: Local Experience Log + playbook page

### Problem
For international grads, the fastest fix for "no local experience" is acquiring any
local experience (volunteering, temp work, internships, part-time in-field, projects).
The system doesn't track this channel at all, so it can't be coached or evaluated.

### Behaviour
A deliberately simple log. Everyone's path is different, so this is a catch-all: the
student logs an activity when it starts, updates it when it ends. Low ceremony, no
weekly forms.

### Schema

```prisma
enum LocalExperienceType {
  VOLUNTEERING
  TEMP_WORK
  INTERNSHIP
  PART_TIME
  PROJECT      // portfolio work, hackathons, open source
  COMMUNITY    // clubs, meetups with a role/responsibility
  OTHER
}

model LocalExperienceEntry {
  id           String              @id @default(uuid())
  userId       String
  type         LocalExperienceType
  organisation String
  role         String
  description  String              @default("")
  hoursPerWeek Int?
  startedAt    DateTime
  endedAt      DateTime?           // null = ongoing
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  @@index([userId])
}
```

### API
Standard authenticated CRUD, following the conventions of the nearest existing route
(likely `tracker.ts`): create, list own entries, update (mainly to set `endedAt`),
delete. Plus extend the coach overview per-member payload with
`localExperience: { activeCount, entries: [{ type, organisation, role, startedAt, endedAt }] }`.

### Client UX
- A "Local Experience" section in the tracker area: a short form (type dropdown,
  organisation, role, optional description/hours, start date) and a list of entries
  with an "ended" action. That's it. No gamification, no streaks for this one.
- Above the form, the **playbook**: a static content page (markdown or simple JSX)
  with slots for embedded videos (coach will supply video links later; leave clearly
  marked placeholders). Outline the coach will flesh out:
  1. Temp agencies: register with temp/contract desks (Hays, Randstad, etc.) — temp
     placements are a legitimate fast route to local experience even though agency
     perm recruiters don't handle entry-level.
  2. Volunteering: where to find it, how to pick roles adjacent to your target field.
  3. Internships and unpaid work: include a caution box on Australian Fair Work rules —
     unpaid trials/internships are only legal in narrow cases (e.g. vocational
     placements); don't get exploited.
  4. Part-time in-field and adjacent work.
  5. Projects, hackathons, open source: what counts as evidence.
  6. How to put each of these on a resume immediately (don't wait until it's over).

---

## Out of scope (do not build)

- Any automated message sending or LinkedIn integration.
- The mandatory student intake/self-assessment note (separate idea, parked, not
  approved for build).
- Any Pulse/dashboard UI outside JobHub (lives in the Daekwon repo, owned separately).
- Nudge emails/cron automation.

## Definition of done

- Migrations apply cleanly against a copy of prod data; existing OutreachLog rows
  backfilled into OutreachMessage.
- A student can: create an outreach, copy touch 1, see it appear in follow-ups due
  4 days later (fake the clock in a test), copy touch 2, tap Replied, mark Referral.
- Auto-close produces CLOSED_NO_REPLY after the full ladder plus 7 quiet days.
- Coach overview returns the outreach funnel and local experience blocks per member.
- Tests follow the existing patterns in `tracker.test.ts`.

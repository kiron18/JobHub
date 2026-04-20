# Skool Gate + Friday Brief — Design Spec
**Date:** 2026-04-21

---

## Overview

Two related features that turn the diagnostic report into a community and coaching funnel:

1. **Skool Gate** — a soft gate shown after onboarding that requires users to join the free Skool community before reading their report. Collects their Skool email for the Friday call.
2. **Friday Brief** — an admin-only page that generates a full spoken call script from that week's first-time diagnostic reports, ready for Kiron to use on the Friday live call.

---

## Feature 1 — Skool Gate

### Flow

1. User completes onboarding → diagnostic report generates in the background (unchanged)
2. `ReportOrDashboard` checks `profile.skoolJoined` before rendering `ReportExperience`
3. If `skoolJoined === true`: proceed directly to report (unchanged)
4. If `skoolJoined === false`: render `SkoolGate` component
5. `SkoolGate` shows the blurred report behind an overlay
6. User clicks "Join free on Skool →" — opens `https://www.skool.com/aussiegradcareers` in a new tab
7. Email input appears: user enters the email they signed up with on Skool
8. Submit → POST `/api/profile/skool-join` → saves `skoolCommunityEmail`, flips `skoolJoined = true`
9. Gate dissolves with a fade transition → `ReportExperience` renders

### Schema Changes

Two new fields on `CandidateProfile`:

```prisma
skoolJoined           Boolean  @default(false)
skoolCommunityEmail   String?
```

### New API Endpoint

**POST `/api/profile/skool-join`** (authenticated)

Request body:
```json
{ "skoolEmail": "user@example.com" }
```

- Finds profile by `userId`
- Updates `skoolCommunityEmail` and `skoolJoined = true`
- Returns `{ ok: true }`
- Skool email is optional — if blank, sets `skoolJoined = true` with no email (user may have same email)

### SkoolGate Component

**Background:** `ReportExperience` renders behind the gate at `filter: blur(8px); opacity: 0.35` — users sense content exists but cannot read it.

**Overlay states:**

**State 1 — Initial (join prompt):**
- Eyebrow: `AUSSIE GRAD CAREERS — FREE COMMUNITY`
- Headline (dynamic): `"Your diagnosis is ready, [name]."`
- Body:
  > "We've gone through your situation and put together an honest breakdown of what's actually holding back your [targetRole] search. Before you read it — one quick step.
  >
  > Join the free Aussie Grad Careers community on Skool. It takes 30 seconds and costs nothing. Inside you'll find videos and resources built around exactly the kinds of problems in your report.
  >
  > Every Friday I run a live call where I go through that week's reports personally. Yours will be in this week's batch. Come with questions — I'll answer them by name."
- Primary CTA: `"Join free on Skool →"` — opens Skool URL in new tab, then transitions to State 2

**State 2 — Email capture (after clicking join):**
- Heading: `"Almost there."`
- Body: `"Drop the email you signed up with below so I know to include your report in Friday's discussion."`
- Input: email field, placeholder `"Email you used on Skool"`
- Note below input: `"(Leave blank if it's the same as this account)"`
- Submit button: `"Open my report →"`

**State 3 — Success:**
- Brief confirmation: `"You're in. Opening your report now."`
- 1.2s pause → gate fades out, report fades in

### Friday Call Banner (inside ReportExperience)

For users whose report falls within the current Thursday 19:00 → Thursday 19:00 Sydney window, a banner appears at the top of the report:

> "Your report is in this week's Friday call batch. Come with questions — I'll address it personally."

This is determined client-side by checking `report.createdAt` against the current window boundaries (calculated from Sydney time).

---

## Feature 2 — Friday Brief

### Admin Page

Route: `/admin/friday-brief`

Access control: only accessible to users where `profile.dashboardAccess === true`. Since Kiron is the only authorised user, this is the admin gate for now.

### Weekly Window Definition

- Window: **Thursday 19:00 AEST (UTC+10) → following Thursday 18:59 AEST**
- AEST is used year-round (no AEDT adjustment needed for simplicity — the 1-hour drift is acceptable)
- Window boundary calculation is done server-side in the API

### Eligible Reports

A report is included in the brief if ALL of the following are true:
- `DiagnosticReport.status === 'COMPLETED'`
- `DiagnosticReport.createdAt` falls within the current window
- It is the user's **first** completed report — determined by checking no earlier `COMPLETED` report exists for that `userId`

### New API Endpoint

**GET `/api/admin/friday-brief`** (authenticated, `dashboardAccess` required)

Response:
```json
{
  "window": { "from": "ISO string", "to": "ISO string" },
  "reportCount": 5,
  "cached": true,
  "script": "Full generated script text...",
  "generatedAt": "ISO string"
}
```

- If a cached script exists for the current window (stored on a new `FridayBrief` model), return it with `cached: true`
- If no cache exists, return `{ reportCount: N, cached: false, script: null }`

**POST `/api/admin/friday-brief/generate`** (authenticated, `dashboardAccess` required)

- Fetches all eligible reports for the current window including profile data (`name`, `targetRole`, `searchDuration`, `perceivedBlocker`, `reportMarkdown`)
- Calls Claude (`claude-sonnet-4-6`) with a structured prompt (see below)
- Saves result to `FridayBrief` table (upsert on window start date)
- Returns `{ script: "..." }`

### Schema Addition

```prisma
model FridayBrief {
  id          String   @id @default(uuid())
  windowStart DateTime @unique
  windowEnd   DateTime
  script      String
  reportCount Int
  generatedAt DateTime @default(now())
}
```

### LLM Prompt Structure

System: You are writing a spoken call script for Kiron, a career coach running a Friday live call for Australian graduate job seekers. The script should feel warm, direct, and personal — like a coach who has genuinely read every report. Use first person ("I've looked at your report..."). Australian English.

User prompt includes:
- Window dates
- Number of reports
- Per-person block: name, target role, search duration, perceived blocker, full report markdown
- Instructions: produce a full script with:
  1. **Opening** — welcome, how many reports this week, general themes teaser
  2. **Common themes** — 3–5 patterns across all reports with talking points for each
  3. **Individual callouts** — one paragraph per person: name them, state what their report revealed, give one specific piece of advice
  4. **Close** — encourage questions, hype next week, remind them what the community is for

### Frontend — FridayBriefPage

- Route: `/admin/friday-brief` inside `DashboardLayout`
- On load: calls `GET /api/admin/friday-brief`
  - If `cached: true`: renders script, shows "Generated [time]" + "Regenerate" button
  - If `cached: false`: shows report count for the week + "Generate brief" button
- Script renders as pre-formatted text in a readable card, with a "Copy to clipboard" button
- "Regenerate" triggers `POST /api/admin/friday-brief/generate` and refreshes

---

## What Is Not In Scope

- Skool API verification of join — trust-based, email capture is for Friday call inclusion only
- Email delivery of the Friday brief — admin page only
- Make/webhook automation for free Skool joins
- Per-user report emails at this stage

---

## Implementation Order

1. Prisma migration — add `skoolJoined`, `skoolCommunityEmail` to `CandidateProfile`, add `FridayBrief` model
2. Server — `POST /api/profile/skool-join` endpoint
3. Server — `GET /api/admin/friday-brief` + `POST /api/admin/friday-brief/generate`
4. Frontend — `SkoolGate` component
5. Frontend — wire `SkoolGate` into `ReportOrDashboard` flow
6. Frontend — Friday call banner inside `ReportExperience`
7. Frontend — `FridayBriefPage` + route

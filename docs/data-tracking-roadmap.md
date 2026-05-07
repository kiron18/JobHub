# Data Tracking Roadmap

Everything we can instrument to understand where users succeed, drop off, and churn —
anchored to what already exists in the app.

---

## 1. Onboarding Funnel Drop-off

**What we want to know:** Which step loses the most people before they submit?

**Steps that already exist (no schema change needed):**
- StepWelcome → StepRole → StepTimeline → StepResponses → StepFiles → StepAuth → Submit

**What to build:**
- Fire an event to a tracking table (or Posthog/Mixpanel) each time a user advances a step
- Record: `userId` (or anonymous session ID), `step`, `timestamp`
- On backend submission, mark the funnel complete

**Queries this unlocks:**
- % of users who start but never reach StepFiles (biggest drop — asking for documents feels high-stakes)
- % who reach StepAuth but don't create an account
- % who create an account but don't trigger the LLM diagnostic

**Priority:** High — this is the top of the funnel and we have zero visibility right now.

---

## 2. Report Engagement

**What we want to know:** Do people read the report or skim it and leave?

**What already exists:**
- 6 accordion sections in the report (Targeting, Document Audit, Pipeline, Honest Assessment, Fix, What JobHub Does)
- Each section has an expand/collapse interaction

**What to build:**
- Track which sections a user opens, and in what order
- Track time-to-first-open (how long before they expand anything)
- Track whether they scroll to the upgrade section at the bottom
- Track whether they click "Start using the tools →" vs "Join free Skool community"

**Queries this unlocks:**
- Do users open "Fix" without reading "Honest Assessment"? (confirms the expectation problem)
- Do people who open all 6 sections convert at a higher rate?
- Which section do most people open first?

**Priority:** High — directly answers whether the "they think the report IS the fix" hypothesis is true.

---

## 3. Trial Activity Tracking (Day-by-Day)

**What we want to know:** What do trial users actually do in their 7 days?

**What already exists:**
- `document.createdAt` — we know when docs are generated
- `jobApplication.createdAt` — we know when analyses are run
- `candidateProfile.plan` and `planStatus` — we know trial vs paid

**What to build:**
- A query that buckets trial users by activity in their first 7 days:
  - Days 1–2: Did they run an analysis?
  - Days 1–2: Did they generate a document?
  - Days 3–7: Did they return at all?
- A "trial cohort" view in the admin dashboard showing this breakdown

**Queries this unlocks:**
- Do users who generate a doc in day 1 convert at a higher rate? (activation metric)
- Do users who never run an analysis in trial convert? (probably not)
- What % of trial users are "ghosts" (sign up, never use a feature)?

**Priority:** High — the trial is 7 days, every day of inactivity is a conversion lost.

---

## 4. Non-Converter Exit Survey

**What we want to know:** Why did trial users not pay?

**What already exists:** Nothing. No survey, no exit trigger.

**What to build:**
- Email trigger: when a trial expires without conversion, send a single-question email:
  > "What would need to change for JobHub to be worth $97/month?"
- OR: show a modal on the day the trial expires asking the same question
- Store responses as free text in a new `ExitSurvey` table: `userId`, `response`, `createdAt`

**Minimum viable version:** A Resend email that fires on trial expiry with a Typeform/Tally link. No new database table needed.

**Priority:** Medium — we need volume first (20+ expired trials) before patterns emerge.

---

## 5. Visa-Aware Urgency Personalisation

**What we already have:**
- `workRights` field captured in onboarding Step 1 (StepRole)
- This is stored on `CandidateProfile`

**What to build:**
- Use `workRights` to personalise the trial banner:
  - Student visa / 485 Graduate visa → "Your visa window is finite — every week not applying is a week of earnings lost"
  - PR / Citizen → neutral messaging
- Personalise upgrade modal subheading based on visa status
- In the report's upgrade section, reference the user's specific situation

**This requires zero new data** — the data already exists. It's a copy/display change.

**Priority:** High. Highest-leverage quick win on the list.

---

## 6. Document Quality Feedback Loop

**What already exists:**
- `DocumentFeedback` model in schema (`rating`, `documentType`, `weakSection`, `freeText`)
- Model exists but no UI to capture ratings yet (feedback data will be empty)

**What to build:**
- After a document is generated, show a 1–5 star rating prompt
- Optional: "What was weakest?" dropdown (Cover letter opening / Achievement framing / Keyword match / Length)
- Store in `DocumentFeedback`

**Queries this unlocks:**
- Which document type (resume vs cover letter vs selection criteria) gets the lowest ratings?
- Do paid users rate documents higher than trial users? (proxy for engagement quality)
- Does the quality gate (Claude Sonnet pass/fail) correlate with user rating?

**Priority:** Medium — needs the DocumentFeedback UI to be built first.

---

## 7. Match Score → Application Rate Correlation

**What we want to know:** Do users with higher match scores actually apply?

**What already exists:**
- `jobApplication.overallGrade` — match score per analysis
- `jobApplication.status` — whether they progressed past "SAVED"

**What to build:**
- A query comparing `overallGrade` buckets (e.g. <40%, 40–60%, 60–80%, 80%+) to
  `status != 'SAVED'` rate (i.e. they actually applied)
- Add this view to the admin dashboard

**Queries this unlocks:**
- Do users apply to low-match roles? (indicates they don't trust or understand the score)
- Do high-match roles convert to applications at a higher rate?

**Priority:** Low — interesting but not immediately actionable.

---

## 8. Diagnostic Report → First Action Timing

**What we want to know:** How long after reading the report does a user take their first action?

**What already exists:**
- `diagnosticReport.createdAt` — when the report was generated
- `document.createdAt` — when the first doc was made
- `jobApplication.createdAt` — when the first analysis was run

**What to build:**
- Calculate `time_to_first_action = MIN(firstDoc.createdAt, firstAnalysis.createdAt) - report.createdAt`
- Bucket users by this: <1hr, 1–24hr, 1–7 days, >7 days, never
- Correlate with conversion to paid

**This requires no schema change** — just a query joining existing tables.

**Priority:** Medium — good signal for whether the report-to-tool transition is working.

---

## 9. Job Feed Engagement

**What already exists:**
- Jobs are served via the job feed (`/jobs` route)
- `jobApplication` is created when a user saves/analyses a job

**What's missing:**
- No tracking of how many jobs were shown vs how many were clicked/saved
- No impression-to-action rate

**What to build:**
- Log job impressions (job shown in feed) to a lightweight `JobImpression` table: `userId`, `jobId`, `timestamp`
- Calculate click-through rate per role type, per match score bucket

**Priority:** Low — useful once job feed volume is higher.

---

## Implementation Order (Recommended)

| Priority | Item | Effort | Data already available |
|----------|------|--------|------------------------|
| 1 | Visa-aware urgency copy | XS | Yes — just use `workRights` |
| 2 | Onboarding funnel events | S | No — need event table or analytics SDK |
| 3 | Report section open tracking | S | No — need frontend events |
| 4 | Trial day-by-day activity (admin view) | S | Yes — query existing tables |
| 5 | Document feedback UI | M | Schema exists, UI missing |
| 6 | Non-converter exit survey (email) | S | No — need Resend trigger |
| 7 | Diagnostic → first action timing | XS | Yes — pure query |
| 8 | Match score vs apply rate | XS | Yes — pure query |
| 9 | Job feed impressions | M | No — need new table |

---

## Note on Timing

Most of the high-value insights (non-converter reasons, trial cohort behaviour) require
enough volume to be meaningful — roughly 50+ trial starts. Until then, the highest-ROI
actions are the ones that use data already collected:

- Visa personalisation (item 1)
- Trial activity query in admin (item 4)
- Diagnostic → first action timing (item 7)
- Match score vs apply rate (item 8)

These can be built and ready before the data volume arrives.

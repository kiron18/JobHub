# Baseline Resume Quick Win

**Date:** 2026-05-05
**Status:** Approved for implementation

## Problem

New users complete onboarding, read their diagnostic, and land on the platform with no immediate tangible output. The existing resume tool requires a job description to generate against. This creates friction at the highest-value conversion moment — the first 10 minutes after diagnosis.

## Goal

Deliver a genuinely improved, downloadable resume the moment the user lands on the platform. Use it as a hook to drive trial usage (5 free generations). Psychology: "we already did the work, just come claim it."

---

## Architecture

Three new pieces plugging into existing infrastructure:

```
POST /api/onboarding/submit
  ├── generateDiagnosticReport()   ← existing
  ├── autoExtractAchievements()    ← existing
  ├── buildDailyFeed()             ← existing
  └── generateBaselineResume()     ← NEW (fire-and-forget)
        ↓
   Document { type: 'BASELINE_RESUME', userId }
        ↓
GET /api/profile/baseline-resume   ← NEW
        ↓
   Profile page banner             ← NEW component
```

`generateBaselineResume` fires after onboarding in the same pattern as `autoExtractAchievements` — non-blocking, logs on failure, never crashes the onboarding response.

---

## 1. Backend — Service (`generateBaselineResume`)

**File:** `server/src/services/baselineResume.ts` (new)

**Inputs:**
- `userId: string`
- `resumeRawText: string` — from onboarding upload
- `reportMarkdown: string` — the completed diagnostic report

**Process:**
1. Call LLM with resume text + diagnostic findings
2. Convert response to DOCX via existing document generation pipeline
3. Store in `Document` table: `{ userId, type: 'BASELINE_RESUME', content: docxBuffer }`
4. Log success or failure — never throws

**LLM Prompt — Australian resume best practices:**
- 2 pages maximum, reverse chronological order
- No photo, no DOB, no marital status, no nationality
- Contact block: name, phone, email, LinkedIn, city/state only
- Professional summary: 3–4 lines, written for the Australian market, speaks to the target role identified in the diagnostic
- Achievement bullets in CAR format (Context → Action → Result)
- Wherever a metric is absent: insert `[Add: e.g. reduced processing time by X%]` — specific and actionable, not generic
- ATS-safe formatting: no tables, no text boxes, no columns, no headers in header/footer fields
- Australian English throughout (organisation, programme, behaviour, etc.)
- Skills section: pruned to relevant, no keyword dump
- Education: institution, degree, year — no GPA unless exceptional
- No "References available on request"

**Prompt explicitly references diagnostic findings** — if the report flagged "no Australian context," the rewrite addresses that directly. This is targeted, not cosmetic.

---

## 2. Backend — Trigger (onboarding.ts)

After the diagnostic report generation fires, add:

```typescript
generateBaselineResume(userId, resumeText, reportMarkdown).catch(err =>
  console.error('[Onboarding] Baseline resume generation failed:', err)
);
```

Fired after `generateDiagnosticReport` resolves (needs the report markdown as input). Does not block the onboarding response.

**Note:** The diagnostic already runs concurrently with `autoExtractAchievements` and `buildDailyFeed`. The baseline resume needs the report output, so it fires after the diagnostic resolves — still non-blocking to the user.

---

## 3. Backend — Endpoint

**`GET /api/profile/baseline-resume`**

Checks whether a `BASELINE_RESUME` document exists for the authenticated user.

**Response (ready):**
```json
{ "status": "ready", "documentId": "abc123" }
```

**Response (not ready / failed):**
```json
{ "status": "pending" }
```

**`POST /api/profile/baseline-resume/generate`**

On-demand fallback. Triggers generation if it failed during onboarding. Same service call, returns immediately with `{ "status": "generating" }`. Frontend polls the GET endpoint until ready.

**`GET /api/documents/:id/download`**

Already exists — serves DOCX. Used as-is for the baseline resume download.

---

## 4. Quota Exemption

`BASELINE_RESUME` document type is excluded from the free generation counter in `accessControl.ts`. It does not consume any of the user's 5 free generations. It is a free gift.

Implementation: in the `checkAccess` function, skip the increment and limit check when `documentType === 'BASELINE_RESUME'`.

---

## 5. Frontend — Banner (Profile Page)

**Location:** Top of the candidate profile page, above all existing content. Only shown when:
- User has a completed diagnostic report, AND
- `freeGenerationsUsed === 0` (never generated anything — genuinely new), AND
- User has not dismissed the banner (tracked in localStorage)

**States:**

| State | What user sees |
|-------|---------------|
| Ready | "Your improved resume is ready" + Download button |
| Generating | "Preparing your resume…" + spinner, polls every 3s |
| Failed | Same as generating — triggers on-demand, polls until done |

**On download click:**
1. File download begins immediately (document already exists)
2. Modal fires simultaneously

**Banner copy:**
> **Your improved resume is ready**
> We've rewritten it based on your diagnostic findings.
> `[ Download free resume → ]`

Banner is dismissible. State persisted in localStorage so it doesn't reappear.

---

## 6. Frontend — Download Modal

Fires on download click. Does not block the download.

**Copy:**
> **Your resume is downloading**
>
> Want to tailor it to a real job? You have 5 free generations — resumes and cover letters included.
>
> `[ Start matching jobs → ]`  `[ Maybe later ]`

- "Start matching jobs" → navigates to Job Feed
- "Maybe later" → dismisses modal
- Modal does not reappear after either action

---

## Out of Scope

- Banner 2 (video walkthrough) — deferred
- Metric capture flow before generation — deferred (placeholders used instead)
- Regeneration / "upgrade" pass after metrics are added — deferred

---

## Success Criteria

- Baseline resume exists in the Document table by the time the user finishes reading their diagnostic (happy path)
- Download works first click, no errors
- Modal fires on every download, navigates correctly
- Document does not count against free generation quota
- On generation failure, fallback triggers cleanly with no error state visible to user

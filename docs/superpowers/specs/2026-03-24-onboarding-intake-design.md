# Onboarding Intake & Diagnostic Report — Design Spec
**Date:** 2026-03-24
**Status:** Approved for implementation
**Session context:** Pre-launch lightweight v1. Full autonomy granted.

---

## What we are building

A mandatory full-screen onboarding intake that appears on first login before dashboard access. Five steps, no skip. Collects job search context and documents, generates a modular AI diagnostic report, then collects per-section relevance feedback to power continuous improvement.

**Emotional design brief:** Every moment should feel like unwrapping a Christmas gift — anticipation, progressive reveal, warmth, delight. Copy must be specific and human. Transitions must feel considered. The report reveal is the bow coming off the box.

---

## Architecture

### Frontend

`OnboardingIntake` component mounts on the root layout. On mount, checks `candidateProfile.hasCompletedOnboarding`. If `false`, renders a full-screen overlay over everything — no dashboard access until submission completes.

**Visual direction:** Glassmorphism. Dark blurred backdrop, layered frosted glass card, subtle animated gradient borders, smooth Framer Motion step transitions. Each step is one deliberate slide. Progress shown as minimal dot indicator (5 dots). The `frontend-design` skill governs all visual decisions during implementation.

**Step state machine:** Local React state manages current step (0–4). Forward-only navigation (no back button — each answer is a commitment). Final submission triggers a full-screen processing animation before transitioning to dashboard.

### Backend

New endpoint: `POST /api/onboarding/submit`
- Uses `multer` middleware for multipart form data — `express.json()` does NOT parse this route
- Intake answers are submitted as a JSON string in a field named `answers`, parsed by the route handler after upload
- Files: `resume` (required), `coverLetter1` (optional), `coverLetter2` (optional) — max 5MB per file
- Extracts text from uploaded files: use `pdf-parse` for PDFs, `mammoth` for `.docx` — both are already installed
- Stores intake answers and raw extracted text to `CandidateProfile`
- Calls `diagnosticReport` service (modular — see below)
- Marks `hasCompletedOnboarding = true`
- Returns `{ reportId, status }`

New endpoint: `GET /api/onboarding/report`
- Authenticated by JWT — looks up report by `userId` (one report per user, `@unique` constraint)
- Returns immediately with current `{ reportId, status, reportMarkdown }` — does NOT block
- Client polls this endpoint every 3 seconds until `status === COMPLETE` or `status === FAILED`
- Frontend stores `reportId` from the initial `POST /api/onboarding/submit` response and uses it for feedback submission

New endpoint: `POST /api/onboarding/retry`
- Re-triggers diagnostic report generation using stored intake data on the user's profile
- Used when `status === FAILED`; sets status back to PROCESSING and re-invokes the diagnostic service

New endpoint: `POST /api/onboarding/report/:reportId/feedback`
- Accepts per-section relevance feedback
- Stores to `DiagnosticReportFeedback`

---

## The 5 Steps

### Step 1 — Welcome
**Copy (exact):**
> "Your job search isn't broken. Your positioning is."
>
> "In the next few minutes, we're going to figure out exactly where things are breaking down — and build you a plan to fix it."
>
> "Answer honestly. The more specific you are, the more powerful what comes next."

Single CTA button: **"Let's find out"**

Visually: the card animates in from slight scale-down + fade. The headline appears word by word with a subtle stagger. Feels like a curtain rising.

### Step 2 — Role + Location
**Question (exact user wording):**
> "What roles + which city are you targeting?"

Fields:
- `targetRole` — free text (placeholder: "e.g. Senior Product Manager")
- `targetCity` — free text (placeholder: "e.g. Sydney")
- `seniority` — dropdown: Graduate / Mid-level / Senior / Lead / Executive
- `industry` — dropdown: pre-populated list (Tech / FinTech / Consulting / Marketing / Finance / Healthcare / Education / Government / Other)

### Step 3 — Search Timeline
**Question (exact user wording):**
> "How long applying + roughly how many applications + main channels?"

Fields:
- `searchDuration` — dropdown: Less than a month / 1–3 months / 3–6 months / 6–12 months / Over a year
- `applicationsCount` — dropdown: Under 10 / 10–30 / 30–60 / 60–100 / 100+
- `channels` — multi-select chips: LinkedIn / Seek / Indeed / Recruiters / Direct applications / Referrals / Other

### Step 4 — Response Pattern + Blocker
**Questions (exact user wording):**
> "What responses are you getting?"
> "What's your biggest blocker right now?"

Fields:
- `responsePattern` — radio cards (not radio buttons — full styled cards with brief description):
  - Mostly silence — "Applications go in and nothing comes back"
  - Mostly rejections — "Getting responses, but they're nos"
  - Interviews that stall — "Getting interviews but they go nowhere"
  - Interviews but no offers — "Getting far but not closing"
  - Mix of everything
- `perceivedBlocker` — free text area (placeholder: "Be honest — is it your resume? Your experience? Interview nerves? There's no wrong answer here.")

### Step 5 — File Upload
**Copy:**
> "Now show us what you've been sending out."
>
> "We're not judging the documents. We're using them to understand how you've been positioning yourself — and where the gap is."

Fields:
- Resume — required (PDF or Word). Label: "Your resume"
- Cover letter 1 — optional. Label: "A recent cover letter" with subtext: "If you don't have one, that's useful information too."
- Cover letter 2 — optional. Label: "Another one if you have it"

**Submit button:** "Build my diagnosis"

On submit: transition to full-screen processing animation.

### Processing Screen
Full-screen animated state. Rotating copy (one line at a time, fading in/out):
- "Reading your documents..."
- "Mapping where applications are likely dropping off..."
- "Cross-referencing your experience against your targets..."
- "Building your diagnosis..."

Visually: slow-breathing glow effect on the card. Feels like something alive is working on their behalf. Duration: real processing time (typically 20–60s). Do NOT fake-complete early.

**Error/FAILED state:** If polling returns `status === FAILED`, replace the processing animation with a warm error screen:
> "Something went wrong on our end — your documents were saved. Refresh the page and we'll pick up where we left off."
CTA: "Try again" — re-triggers the report generation call (calls `POST /api/onboarding/retry` which re-invokes the diagnostic service using stored intake data). The user is never stuck with no exit.

---

## Report Display

After processing completes, the dashboard unlocks and a `DiagnosticReport` panel is prominently displayed at the top.

**Report reveal animation:** The panel expands from collapsed to full height with a spring animation. The heading fades in first, then each section appears sequentially with a 150ms stagger. This is the bow coming off the box.

**Report sections** (generated by `diagnosticReport` service) — canonical keys used for feedback storage:

| # | Section Name | `sectionKey` |
|---|---|---|
| 1 | Targeting Assessment | `targeting` |
| 2 | Document Audit | `document_audit` |
| 3 | Pipeline Diagnosis | `pipeline` |
| 4 | The Honest Assessment | `honest` |
| 5 | The 3-Step Fix | `fix` |
| 6 | What JobHub Will Do For You | `what_jobhub_does` |

Each section is rendered as styled markdown. The report is stored as markdown in the DB and rendered client-side. The `reportId` returned from `POST /api/onboarding/submit` is stored in React state and passed to the report display component for use in feedback submissions.

### Per-Section Relevance Feedback

After each section, a subtle inline prompt appears (not a modal, not intrusive — just a quiet row beneath the section content):

> "Did this reflect your situation?" — **Spot on** / **Partially** / **Missed the mark**

These are small pill buttons, muted by default, with a gentle hover state. Selecting one dims the row and moves on. Not blocking — the user can skip any section's feedback by scrolling past.

Feedback is stored per-section in `DiagnosticReportFeedback`. Over time, sections that consistently score "Missed the mark" surface as prompt improvement signals.

---

## Database Schema Changes

### Add to `CandidateProfile`:
```prisma
hasCompletedOnboarding  Boolean   @default(false)
targetRole              String?
targetCity              String?
seniority               String?
industry                String?
searchDuration          String?
applicationsCount       String?
channels                Json?     // string array e.g. ["LinkedIn", "Seek"]
responsePattern         String?
perceivedBlocker        String?
resumeRawText           String?   // extracted from uploaded resume
coverLetterRawText      String?   // extracted from first cover letter
coverLetterRawText2     String?   // extracted from second cover letter
```

### New model `DiagnosticReport`:
```prisma
model DiagnosticReport {
  id              String                    @id @default(uuid())
  userId          String                    @unique
  status          DiagnosticStatus          @default(PROCESSING)
  intakeAnswers   Json
  reportMarkdown  String?
  createdAt       DateTime                  @default(now())
  updatedAt       DateTime                  @updatedAt
  feedback        DiagnosticReportFeedback[]
}

enum DiagnosticStatus {
  PROCESSING
  COMPLETE
  FAILED
}

model DiagnosticReportFeedback {
  id               String           @id @default(uuid())
  reportId         String
  report           DiagnosticReport @relation(fields: [reportId], references: [id])
  sectionKey       String           // canonical values: "targeting" | "document_audit" | "pipeline" | "honest" | "fix" | "what_jobhub_does"
  relevanceScore   String           // "spot_on" | "partially" | "missed"
  createdAt        DateTime         @default(now())
}
```

---

## Modular Diagnostic Service

File: `server/src/services/diagnosticReport.ts`

This file is the only place the diagnostic prompt lives. It exports one function:

```typescript
generateDiagnosticReport(input: DiagnosticReportInput): Promise<string>
```

Where `DiagnosticReportInput` contains all intake answers and extracted document text.

**`DiagnosticReportInput` interface:**
```typescript
interface DiagnosticReportInput {
  targetRole: string;
  targetCity: string;
  seniority: string;
  industry: string;
  searchDuration: string;
  applicationsCount: string;
  channels: string[];
  responsePattern: string;
  perceivedBlocker: string;
  resumeText: string;
  coverLetterText1?: string;
  coverLetterText2?: string;
}
```

**Architecture principle:** The prompt is a pure function of the input. It has no side effects and no DB access. The route handler is responsible for storing results. This makes prompt iteration zero-risk — you open this file, update the prompt, redeploy. Nothing else changes.

**Initial prompt design (v1):** Structured prompt that receives the 4 intake answers + resume text + cover letter text(s) and produces a 6-section markdown report following the section structure above. Honest but warm. Every identified problem is paired with a fix. The emotional arc is: recognition → relief → excitement.

**Important:** The prompt must never be crushing. Problems are positioning gaps, not character flaws. "Your resume is duty-led rather than achievement-led" — fine. "Your resume is weak" — not acceptable.

---

## Context Injection (Generation Pipeline)

After intake completes, modify `server/src/services/prompts.ts` and the `generateBlueprint` call in `server/src/routes/generate.ts` to prepend a search context block. Note: `server/src/services/generation.ts` handles achievement ranking — it is NOT the prompt assembly layer and should not be touched for this change.

```
--- CANDIDATE SEARCH CONTEXT ---
Target role: [targetRole]
Target city: [targetCity]
Seniority: [seniority]
Industry: [industry]
Search duration: [searchDuration]
Applications sent: [applicationsCount]
Response pattern: [responsePattern]
Self-identified blocker: [perceivedBlocker]
--- END CONTEXT ---
```

This block is fetched from the user's `CandidateProfile` at generation time and prepended to the blueprint prompt. If `hasCompletedOnboarding` is false, this block is omitted (graceful degradation — generation still works, just less targeted).

---

## Build Order

1. **DB schema migration** — add new fields to `CandidateProfile`, add `DiagnosticReport` and `DiagnosticReportFeedback` models
2. **File extraction** — wire up file-handling skill for PDF + Word support in the onboarding endpoint
3. **Modular diagnostic service** — `diagnosticReport.ts` with initial v1 prompt
4. **Backend endpoint** — `POST /api/onboarding/submit`, `GET /api/onboarding/report`, `POST /api/onboarding/report/:id/feedback`
5. **Frontend intake UI** — 5-step flow with glassmorphism + Framer Motion (invoke `frontend-design` skill)
6. **Report display + feedback UI** — dashboard panel, section stagger animation, per-section relevance pills
7. **Context injection** — modify generation pipeline to prepend search context block
8. **Integration test** — end-to-end: signup → intake → report displays → generation uses context

---

## Notes

- `onboarding_intake_plan.md` in the repo root is a precursor planning document. It is superseded by this spec. It can be left in place or moved to `docs/superpowers/` — do not delete it as it contains additional prompt design notes useful for the separate report prompt session.

---

## What is NOT in scope for this session

- Voice extraction / style profiling from cover letters (separate session)
- Gap analysis UI in achievement bank (separate session)
- Re-intake cadence / 30-day prompts (separate session)
- Automated prompt improvement from feedback data (separate session — feedback collection is in scope, acting on it is not)

---

## Key constraints

- No skip option. The intake is mandatory.
- Resume upload is required. Cover letters are optional but encouraged.
- The diagnostic report is generated once at intake. It is not regenerated automatically.
- File support: PDF and Word (.docx) via the file-handling skills installed from Anthropic GitHub.
- The report prompt lives only in `diagnosticReport.ts`. It must never be inlined into a route handler.

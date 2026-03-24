# Onboarding Intake & Diagnostic Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mandatory full-screen onboarding intake that appears on first login, collects job search context + documents, generates a modular AI diagnostic report, displays it with per-section relevance feedback, and injects the collected context into the generation pipeline.

**Architecture:** Full-screen glassmorphism overlay gated by `hasCompletedOnboarding` on `CandidateProfile`. Backend fires diagnostic generation asynchronously so the submit endpoint returns immediately; frontend polls `GET /api/onboarding/report` every 3 seconds. Diagnostic prompt lives exclusively in `diagnosticReport.ts` — modular, zero-risk to iterate.

**Tech Stack:** React + Framer Motion + react-markdown (frontend), Express + multer v2 + pdf-parse + mammoth + Prisma (backend), Claude via OpenRouter (diagnostic report), Supabase JWT auth.

**Spec:** `docs/superpowers/specs/2026-03-24-onboarding-intake-design.md`

**Emotional brief:** Every step feels like unwrapping a Christmas gift. Awe, anticipation, progressive reveal. The report reveal is the bow coming off the box.

---

## File Map

### Backend — Create
- `server/src/services/diagnosticReport.ts` — modular diagnostic service; only place the Claude prompt lives
- `server/src/routes/onboarding.ts` — all onboarding endpoints (submit, report, retry, feedback)

### Backend — Modify
- `server/prisma/schema.prisma` — add fields to CandidateProfile + new DiagnosticReport + DiagnosticReportFeedback models
- `server/src/index.ts` — register onboarding router at `/api/onboarding`
- `server/src/routes/generate.ts` — fetch search context from profile, prepend to blueprint call
- `server/src/services/prompts.ts` — add `buildSearchContextBlock()` helper used by generate route

### Frontend — Create
- `src/components/OnboardingIntake.tsx` — 5-step glassmorphism intake flow
- `src/components/DiagnosticReport.tsx` — report display with per-section relevance feedback pills
- `src/components/OnboardingGate.tsx` — thin wrapper that checks `hasCompletedOnboarding` and either renders `OnboardingIntake` or its children

### Frontend — Modify
- `src/App.tsx` — wrap `DashboardLayout` with `OnboardingGate`

---

## Task 1: Database Schema Migration

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add fields to CandidateProfile and new models**

Open `server/prisma/schema.prisma`. Add these fields to the `CandidateProfile` model (after the existing `updatedAt` field):

```prisma
  hasCompletedOnboarding  Boolean   @default(false)
  targetRole              String?
  targetCity              String?
  seniority               String?
  industry                String?
  searchDuration          String?
  applicationsCount       String?
  channels                Json?
  responsePattern         String?
  perceivedBlocker        String?
  resumeRawText           String?
  coverLetterRawText      String?
  coverLetterRawText2     String?
  diagnosticReport        DiagnosticReport?
```

Then add the new models and enum at the end of the file (after the `DocumentType` enum):

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
  candidateProfile CandidateProfile         @relation(fields: [userId], references: [userId])
}

enum DiagnosticStatus {
  PROCESSING
  COMPLETE
  FAILED
}

model DiagnosticReportFeedback {
  id             String           @id @default(uuid())
  reportId       String
  report         DiagnosticReport @relation(fields: [reportId], references: [id])
  sectionKey     String
  relevanceScore String
  createdAt      DateTime         @default(now())
}
```

- [ ] **Step 2: Run migration**

```bash
cd server && npx prisma migrate dev --name add_onboarding_intake
```

Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 3: Verify migration**

```bash
cd server && npx prisma studio
```

Open browser to `http://localhost:5555`. Confirm `CandidateProfile` has the new fields and `DiagnosticReport` table exists. Close Studio (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat: add onboarding intake schema — DiagnosticReport + profile fields"
```

---

## Task 2: Modular Diagnostic Service

**Files:**
- Create: `server/src/services/diagnosticReport.ts`

- [ ] **Step 1: Create the service file**

Create `server/src/services/diagnosticReport.ts`:

```typescript
import { callClaude } from './llm';

export interface DiagnosticReportInput {
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

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC PROMPT v1
// This is the only place the diagnostic prompt lives. To iterate: edit here
// only. No other files need to change.
// Emotional arc: recognition → relief → excitement.
// Rule: every identified problem is IMMEDIATELY followed by a fix.
// Rule: never use language that implies a character flaw. "Duty-led" not "weak".
// ─────────────────────────────────────────────────────────────────────────────
function buildDiagnosticPrompt(input: DiagnosticReportInput): string {
  const coverLetterSection = [
    input.coverLetterText1 ? `Cover Letter 1:\n"""\n${input.coverLetterText1}\n"""` : '',
    input.coverLetterText2 ? `Cover Letter 2:\n"""\n${input.coverLetterText2}\n"""` : '',
  ].filter(Boolean).join('\n\n');

  return `You are a senior career strategist conducting a personalised job search diagnosis for a candidate.

Your output is a structured markdown report with exactly 6 sections. Each section must be honest, specific, and warm. Every problem you identify must be immediately followed by a concrete fix. The emotional arc the candidate should feel reading this report is: recognition → relief → excitement. Never imply a character flaw. "Duty-led resume" is fine. "Weak resume" is not.

---

CANDIDATE INTAKE DATA:
Target role: ${input.targetRole}
Target city: ${input.targetCity}
Seniority level: ${input.seniority}
Industry: ${input.industry}
Search duration: ${input.searchDuration}
Applications sent: ${input.applicationsCount}
Channels used: ${input.channels.join(', ')}
Response pattern: ${input.responsePattern}
Self-identified blocker: "${input.perceivedBlocker}"

RESUME:
"""
${input.resumeText}
"""

${coverLetterSection ? `COVER LETTERS:\n${coverLetterSection}` : 'No cover letters provided.'}

---

Write the report now. Use this EXACT structure with these EXACT markdown headings:

## Targeting Assessment

Is the role + city combination realistic given their experience? Are they too broad or too narrow? Does their resume actually reflect the roles they want? Be specific about any misalignment. Then tell them exactly how to fix it.

## Document Audit

Resume: Is it achievement-led or duty-led? Does the opening hook pass a 6-second scan? Are there quantifiable outcomes? Identify 1–2 specific improvements with exact examples.

${coverLetterSection ? 'Cover letters: Is the opening line generic or compelling? Is there a positioning narrative? Does the tone match the target industry?' : 'No cover letters were provided — note this as a gap and explain what it signals.'}

## Pipeline Diagnosis

Based on their response pattern ("${input.responsePattern}"), diagnose what stage they are dropping off and why. Be specific:
- Mostly silence → ATS/keyword/targeting problem
- Mostly rejections → fit or positioning problem
- Interviews that stall → presentation or expectation gap
- Interviews but no offers → closing, compensation, or interview technique

## The Honest Assessment

Cross-reference their self-identified blocker ("${input.perceivedBlocker}") against what their documents actually reveal. If they are right, validate it and say why. If the documents reveal a different problem, say so warmly and specifically.

## The 3-Step Fix

Three concrete, prioritised actions they can take this week. Not "improve your resume." For example: "Your resume opens with a 4-line objective. Replace it with a 2-line summary that names your speciality and your biggest proof point." Each fix should be something they can act on today.

## What JobHub Will Do For You

Close with warmth and forward momentum. Based on their specific situation, explain what the platform will help them build. Make them feel like the hard part is over and the work is about to begin.`;
}

export async function generateDiagnosticReport(input: DiagnosticReportInput): Promise<string> {
  const prompt = buildDiagnosticPrompt(input);
  const { content } = await callClaude(prompt, false);
  return content;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: No errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/diagnosticReport.ts
git commit -m "feat: add modular diagnostic report service (v1 prompt)"
```

---

## Task 3: File Text Extraction Utility

**Files:**
- Modify: `server/src/services/pdf.ts` (extend with Word support, or add extraction logic inline in route)

- [ ] **Step 1: Check existing pdf service**

Read `server/src/services/pdf.ts`. If it already exports a `extractTextFromBuffer` or similar, use it. Otherwise:

- [ ] **Step 2: Extend pdf.ts with extractTextFromBuffer**

The existing `server/src/services/pdf.ts` exports `extractTextFromPDF(buffer: Buffer)` using a dynamic import to avoid the Railway DOMMatrix crash. **Do NOT use a static `import pdfParse from 'pdf-parse'`** — this crashes on Railway (confirmed by commit b5c9cd1). Add `extractTextFromBuffer` to the existing file without removing `extractTextFromPDF`:

```typescript
import mammoth from 'mammoth';

/**
 * Extracts plain text from a PDF or DOCX buffer.
 * Uses dynamic import for pdf-parse to avoid Railway DOMMatrix crash.
 * Returns empty string on failure — a missing document is not fatal.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimetype: string,
  originalname: string
): Promise<string> {
  try {
    const ext = originalname.toLowerCase();
    if (mimetype === 'application/pdf' || ext.endsWith('.pdf')) {
      // Reuse existing extractTextFromPDF which already uses dynamic import
      return (await extractTextFromPDF(buffer)).trim();
    }
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    }
    // Fallback: try PDF
    return (await extractTextFromPDF(buffer)).trim();
  } catch (e) {
    console.error('[extractText] Failed to extract text:', e);
    return '';
  }
}
```

Note: `mammoth` is already in `server/package.json`. The import for `mammoth` goes at the top of `pdf.ts` alongside the existing code.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/src/services/pdf.ts
git commit -m "feat: add extractTextFromBuffer utility for PDF and DOCX files"
```

---

## Task 4: Onboarding Route

**Files:**
- Create: `server/src/routes/onboarding.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create the onboarding route**

Create `server/src/routes/onboarding.ts`:

```typescript
import { Router, Response } from 'express';
import multer from 'multer';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { extractTextFromBuffer } from '../services/pdf';
import { generateDiagnosticReport, DiagnosticReportInput } from '../services/diagnosticReport';

const router = Router();

// multer: memory storage, 5MB per file limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── POST /api/onboarding/submit ───────────────────────────────────────────────
// Accepts multipart form data. Intake answers arrive as a JSON string in the
// `answers` field. Files: resume (required), coverLetter1, coverLetter2 (optional).
// Fires diagnostic generation asynchronously — returns immediately.
router.post(
  '/submit',
  authenticate,
  upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter1', maxCount: 1 },
    { name: 'coverLetter2', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    // Parse answers from the JSON string field
    let answers: DiagnosticReportInput;
    try {
      answers = JSON.parse(req.body.answers || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid answers format — must be JSON string' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const resumeFile = files?.['resume']?.[0];

    if (!resumeFile) {
      return res.status(400).json({ error: 'Resume file is required' });
    }

    try {
      // Extract text from uploaded files
      const resumeText = await extractTextFromBuffer(
        resumeFile.buffer,
        resumeFile.mimetype,
        resumeFile.originalname
      );

      const cl1File = files?.['coverLetter1']?.[0];
      const cl2File = files?.['coverLetter2']?.[0];

      const coverLetterText1 = cl1File
        ? await extractTextFromBuffer(cl1File.buffer, cl1File.mimetype, cl1File.originalname)
        : undefined;

      const coverLetterText2 = cl2File
        ? await extractTextFromBuffer(cl2File.buffer, cl2File.mimetype, cl2File.originalname)
        : undefined;

      // Get the candidate profile
      const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found — complete profile setup first' });
      }

      // Store intake data on profile.
      // NOTE: hasCompletedOnboarding is set to true only AFTER the report is COMPLETE
      // (in the .then() callback below). Setting it here would unlock the dashboard
      // while the report is still processing, causing a broken experience on page refresh.
      await prisma.candidateProfile.update({
        where: { userId },
        data: {
          targetRole: answers.targetRole,
          targetCity: answers.targetCity,
          seniority: answers.seniority,
          industry: answers.industry,
          searchDuration: answers.searchDuration,
          applicationsCount: answers.applicationsCount,
          channels: answers.channels,
          responsePattern: answers.responsePattern,
          perceivedBlocker: answers.perceivedBlocker,
          resumeRawText: resumeText,
          coverLetterRawText: coverLetterText1 ?? null,
          coverLetterRawText2: coverLetterText2 ?? null,
          // hasCompletedOnboarding deliberately NOT set here — set in .then() below
        },
      });

      // Create DiagnosticReport record (status: PROCESSING)
      const report = await prisma.diagnosticReport.create({
        data: {
          userId,
          status: 'PROCESSING',
          intakeAnswers: answers as any,
        },
      });

      // Fire generation asynchronously — do NOT await
      const reportInput: DiagnosticReportInput = {
        ...answers,
        resumeText,
        coverLetterText1,
        coverLetterText2,
      };

      generateDiagnosticReport(reportInput)
        .then(async (markdown) => {
          await prisma.diagnosticReport.update({
            where: { id: report.id },
            data: { status: 'COMPLETE', reportMarkdown: markdown },
          });
          // Set hasCompletedOnboarding only after report is ready.
          // This ensures the OnboardingGate stays up until the dashboard is fully ready.
          await prisma.candidateProfile.update({
            where: { userId },
            data: { hasCompletedOnboarding: true },
          });
          console.log(`[Onboarding] Diagnostic complete for userId: ${userId}`);
        })
        .catch(async (err) => {
          console.error('[Onboarding] Diagnostic generation failed:', err);
          await prisma.diagnosticReport.update({
            where: { id: report.id },
            data: { status: 'FAILED' },
          });
        });

      // Return immediately
      return res.json({ reportId: report.id, status: 'PROCESSING' });

    } catch (error) {
      console.error('[Onboarding] Submit error:', error);
      return res.status(500).json({ error: 'Failed to process intake submission' });
    }
  }
);

// ── GET /api/onboarding/report ────────────────────────────────────────────────
// Returns immediately with current report status. Client polls every 3s.
router.get('/report', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const report = await prisma.diagnosticReport.findUnique({ where: { userId } });
    if (!report) {
      return res.status(404).json({ error: 'No diagnostic report found' });
    }
    return res.json({
      reportId: report.id,
      status: report.status,
      reportMarkdown: report.reportMarkdown ?? null,
    });
  } catch (error) {
    console.error('[Onboarding] Report fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// ── POST /api/onboarding/retry ────────────────────────────────────────────────
// Re-triggers diagnostic generation using stored profile data.
router.post('/retry', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const [report, profile] = await Promise.all([
      prisma.diagnosticReport.findUnique({ where: { userId } }),
      prisma.candidateProfile.findUnique({ where: { userId } }),
    ]);

    if (!report || !profile) {
      return res.status(404).json({ error: 'Report or profile not found' });
    }

    await prisma.diagnosticReport.update({
      where: { id: report.id },
      data: { status: 'PROCESSING' },
    });

    const answers = report.intakeAnswers as any;
    const reportInput: DiagnosticReportInput = {
      ...answers,
      resumeText: profile.resumeRawText ?? '',
      coverLetterText1: profile.coverLetterRawText ?? undefined,
      coverLetterText2: profile.coverLetterRawText2 ?? undefined,
    };

    generateDiagnosticReport(reportInput)
      .then(async (markdown) => {
        await prisma.diagnosticReport.update({
          where: { id: report.id },
          data: { status: 'COMPLETE', reportMarkdown: markdown },
        });
        // Must also set hasCompletedOnboarding here — same as submit route.
        // Without this, a successful retry leaves the dashboard permanently locked.
        await prisma.candidateProfile.update({
          where: { userId },
          data: { hasCompletedOnboarding: true },
        });
      })
      .catch(async (err) => {
        console.error('[Onboarding] Retry failed:', err);
        await prisma.diagnosticReport.update({
          where: { id: report.id },
          data: { status: 'FAILED' },
        });
      });

    return res.json({ reportId: report.id, status: 'PROCESSING' });
  } catch (error) {
    console.error('[Onboarding] Retry error:', error);
    return res.status(500).json({ error: 'Failed to retry report generation' });
  }
});

// ── POST /api/onboarding/report/:reportId/feedback ────────────────────────────
router.post(
  '/report/:reportId/feedback',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const { reportId } = req.params;
    const { sectionKey, relevanceScore } = req.body;

    const validSections = ['targeting', 'document_audit', 'pipeline', 'honest', 'fix', 'what_jobhub_does'];
    const validScores = ['spot_on', 'partially', 'missed'];

    if (!validSections.includes(sectionKey) || !validScores.includes(relevanceScore)) {
      return res.status(400).json({ error: 'Invalid sectionKey or relevanceScore' });
    }

    try {
      await prisma.diagnosticReportFeedback.create({
        data: { reportId, sectionKey, relevanceScore },
      });
      return res.json({ ok: true });
    } catch (error) {
      console.error('[Onboarding] Feedback error:', error);
      return res.status(500).json({ error: 'Failed to save feedback' });
    }
  }
);

export default router;
```

- [ ] **Step 2: Register the router in index.ts**

Open `server/src/index.ts`. Add the import after the existing router imports:

```typescript
import onboardingRouter from './routes/onboarding';
```

Add the route registration after `app.use('/api', documentsRouter);`:

```typescript
app.use('/api/onboarding', onboardingRouter);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Smoke test the endpoints**

Start the dev server:
```bash
cd server && npm run dev
```

In a separate terminal, test the report endpoint (should 404 since no report exists yet):
```bash
curl -s http://localhost:3002/api/onboarding/report \
  -H "Authorization: Bearer $(cat .dev-token 2>/dev/null || echo 'test')" | cat
```

With DEV_BYPASS_AUTH=true in .env, you can test without a real token:
```bash
curl -s http://localhost:3002/api/onboarding/report | cat
```

Expected: `{"error":"No diagnostic report found"}` (404).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/onboarding.ts server/src/index.ts
git commit -m "feat: add onboarding routes — submit, report, retry, feedback"
```

---

## Task 5: Context Injection into Generation Pipeline

**Files:**
- Modify: `server/src/services/prompts.ts`
- Modify: `server/src/routes/generate.ts`

- [ ] **Step 1: Add buildSearchContextBlock to prompts.ts**

Open `server/src/services/prompts.ts`. Add this function at the top (before existing exports):

```typescript
export function buildSearchContextBlock(profile: any): string {
  if (!profile?.hasCompletedOnboarding) return '';
  return `
--- CANDIDATE SEARCH CONTEXT ---
Target role: ${profile.targetRole || 'Not specified'}
Target city: ${profile.targetCity || 'Not specified'}
Seniority: ${profile.seniority || 'Not specified'}
Industry: ${profile.industry || 'Not specified'}
Search duration: ${profile.searchDuration || 'Not specified'}
Applications sent: ${profile.applicationsCount || 'Not specified'}
Response pattern: ${profile.responsePattern || 'Not specified'}
Self-identified blocker: ${profile.perceivedBlocker || 'Not specified'}
--- END CONTEXT ---

Use the above context to calibrate positioning, tone, and emphasis. A candidate who has sent 100+ applications and is getting silence needs ATS-optimised language and sharp keyword alignment. A candidate getting interviews that stall needs stronger proof points and narrative specificity. Weight the document accordingly.

`;
}
```

- [ ] **Step 2: Verify generateBlueprint handles concatenation safely**

Before writing any code, read `server/src/services/strategy.ts` lines 16–55 and `server/src/services/prompts.ts` to confirm that `STRATEGY_BLUEPRINT_PROMPT` receives `jd` as the raw job description string and does not perform keyword extraction or structured parsing on it that would be confused by the prepended context block. The context block is clearly delimited (`--- CANDIDATE SEARCH CONTEXT ---`), so Claude will parse it separately from the JD. Confirm this before proceeding.

- [ ] **Step 3: Inject context into blueprint prompt in generate.ts**

Open `server/src/routes/generate.ts`. Add the import at the top:

```typescript
import { DOCUMENT_GENERATION_PROMPT_WITH_BLUEPRINT, DOCUMENT_GENERATION_PROMPT, buildSearchContextBlock } from '../services/prompts';
```

Find the `generateBlueprint` call (around line 93). The `jd` variable passed to `STRATEGY_BLUEPRINT_PROMPT` is what gets the context. Modify the blueprint call to include context:

```typescript
// Build search context block from intake data (empty string if not onboarded)
const searchContext = buildSearchContextBlock(profile);

blueprintResult = await generateBlueprint(
    cacheKey,
    searchContext + jobDescription,  // prepend context to JD
    profile,
    selectedAchievements,
    docType
);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/src/services/prompts.ts server/src/routes/generate.ts
git commit -m "feat: inject search context into generation pipeline from onboarding intake"
```

---

## Task 6: Frontend — OnboardingGate

**Files:**
- Create: `src/components/OnboardingGate.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create OnboardingGate.tsx**

Create `src/components/OnboardingGate.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { OnboardingIntake } from './OnboardingIntake';

interface OnboardingGateProps {
  children: React.ReactNode;
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile');
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile?.hasCompletedOnboarding) {
    return <OnboardingIntake />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Wrap DashboardLayout in App.tsx**

Open `src/App.tsx`. Add the import:

```tsx
import { OnboardingGate } from './components/OnboardingGate';
```

Find the `ProtectedRoute` render (around line 228). Change:

```tsx
<ProtectedRoute>
  <DashboardLayout>
```

to:

```tsx
<ProtectedRoute>
  <OnboardingGate>
    <DashboardLayout>
```

And close:

```tsx
    </DashboardLayout>
  </OnboardingGate>
</ProtectedRoute>
```

- [ ] **Step 3: Verify app still compiles**

```bash
cd E:/AntiGravity/JobHub && npm run build 2>&1 | tail -20
```

Expected: Build succeeds (OnboardingIntake doesn't exist yet — it's OK if there's an import error; fix by creating a placeholder first if needed).

**Placeholder if needed** — create `src/components/OnboardingIntake.tsx` temporarily:

```tsx
export function OnboardingIntake() {
  return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Onboarding coming soon...</div>;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/OnboardingGate.tsx src/App.tsx
git commit -m "feat: add OnboardingGate — blocks dashboard until onboarding complete"
```

---

## Task 7: Frontend — OnboardingIntake Component

**Files:**
- Create: `src/components/OnboardingIntake.tsx`

> **IMPORTANT:** Invoke the `frontend-design` skill before writing this component. The visual design must feel like a completely different product from generic AI tools — glassmorphism, deliberate motion, Christmas-gift emotional arc.

- [ ] **Step 1: Invoke frontend-design skill**

Use the Skill tool with `frontend-design` before writing the component. Follow its visual guidance for the glassmorphism treatment.

- [ ] **Step 2: Create OnboardingIntake.tsx**

Create `src/components/OnboardingIntake.tsx`. This is the most complex component in the plan — build it in full:

```tsx
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface IntakeAnswers {
  targetRole: string;
  targetCity: string;
  seniority: string;
  industry: string;
  searchDuration: string;
  applicationsCount: string;
  channels: string[];
  responsePattern: string;
  perceivedBlocker: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SENIORITY_OPTIONS = ['Graduate', 'Mid-level', 'Senior', 'Lead', 'Executive'];
const INDUSTRY_OPTIONS = ['Tech', 'FinTech', 'Consulting', 'Marketing', 'Finance', 'Healthcare', 'Education', 'Government', 'Other'];
const DURATION_OPTIONS = ['Less than a month', '1–3 months', '3–6 months', '6–12 months', 'Over a year'];
const COUNT_OPTIONS = ['Under 10', '10–30', '30–60', '60–100', '100+'];
const CHANNEL_OPTIONS = ['LinkedIn', 'Seek', 'Indeed', 'Recruiters', 'Direct applications', 'Referrals', 'Other'];
const RESPONSE_OPTIONS = [
  { value: 'mostly_silence', label: 'Mostly silence', sub: 'Applications go in and nothing comes back' },
  { value: 'mostly_rejections', label: 'Mostly rejections', sub: "Getting responses, but they're nos" },
  { value: 'interviews_stall', label: 'Interviews that stall', sub: 'Getting interviews but they go nowhere' },
  { value: 'no_offers', label: 'Interviews but no offers', sub: 'Getting far but not closing' },
  { value: 'mix', label: 'Mix of everything', sub: '' },
];

const PROCESSING_LINES = [
  'Reading your documents...',
  'Mapping where applications are likely dropping off...',
  'Cross-referencing your experience against your targets...',
  'Building your diagnosis...',
];

// ── Shared style primitives ──────────────────────────────────────────────────

const glassCard = `
  relative rounded-2xl border border-white/10
  bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/50
`;

const inputBase = `
  w-full rounded-xl border border-white/10 bg-white/5
  px-4 py-3 text-white placeholder-white/30
  focus:outline-none focus:ring-2 focus:ring-indigo-500/60
  transition-all duration-200
`;

const labelText = 'block text-xs font-bold tracking-[0.15em] uppercase text-white/50 mb-2';

// ── Sub-components ───────────────────────────────────────────────────────────

function DotProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-2 items-center justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === step ? 24 : 8,
            backgroundColor: i <= step ? '#6366f1' : 'rgba(255,255,255,0.15)',
          }}
          transition={{ duration: 0.3 }}
          className="h-2 rounded-full"
        />
      ))}
    </div>
  );
}

function FileDropZone({
  label,
  subtext,
  required,
  file,
  onFile,
}: {
  label: string;
  subtext?: string;
  required?: boolean;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className={`
        relative rounded-xl border-2 border-dashed cursor-pointer
        px-6 py-5 transition-all duration-200 group
        ${file
          ? 'border-indigo-500/60 bg-indigo-500/10'
          : 'border-white/15 bg-white/3 hover:border-white/30 hover:bg-white/5'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-center gap-3">
        <div className={`text-2xl ${file ? 'text-indigo-400' : 'text-white/30'}`}>
          {file ? '✓' : '↑'}
        </div>
        <div>
          <p className="text-sm font-semibold text-white/80">
            {file ? file.name : label}
            {required && !file && <span className="text-indigo-400 ml-1">*</span>}
          </p>
          {subtext && !file && (
            <p className="text-xs text-white/40 mt-0.5">{subtext}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Processing Screen ────────────────────────────────────────────────────────

function ProcessingScreen({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const [lineIndex, setLineIndex] = useState(0);

  // useEffect (not useState) — useState callbacks are not effect hooks and do not support cleanup
  useEffect(() => {
    if (failed) return;
    const interval = setInterval(() => {
      setLineIndex((i) => (i + 1) % PROCESSING_LINES.length);
    }, 3000);
    return () => clearInterval(interval); // cleanup on unmount
  }, [failed]);

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-6">
        <div className={`${glassCard} p-10 max-w-md w-full text-center`}>
          <div className="text-4xl mb-4">⚠</div>
          <h2 className="text-xl font-bold text-white mb-3">Something went wrong on our end</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-6">
            Your documents were saved. Refresh the page and we'll pick up where we left off.
          </p>
          <button
            onClick={onRetry}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-6">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className={`${glassCard} p-10 max-w-md w-full text-center relative`}>
        <motion.div
          className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full mx-auto mb-6"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />

        <AnimatePresence mode="wait">
          <motion.p
            key={lineIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="text-white/70 text-base font-medium"
          >
            {PROCESSING_LINES[lineIndex]}
          </motion.p>
        </AnimatePresence>

        <p className="text-white/25 text-xs mt-4">This takes 30–60 seconds</p>
      </div>
    </div>
  );
}

// ── Step Components ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="max-w-xl w-full mx-auto px-6 flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <motion.h1
          className="text-4xl md:text-5xl font-black text-white leading-tight mb-6"
        >
          Your job search isn't broken.{' '}
          <span className="text-indigo-400">Your positioning is.</span>
        </motion.h1>

        <p className="text-white/60 text-lg leading-relaxed mb-4">
          In the next few minutes, we're going to figure out exactly where things are breaking down — and build you a plan to fix it.
        </p>

        <p className="text-white/40 text-sm leading-relaxed mb-10">
          Answer honestly. The more specific you are, the more powerful what comes next.
        </p>

        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg tracking-tight shadow-lg shadow-indigo-600/30 transition-colors"
        >
          Let's find out
        </motion.button>
      </motion.div>
    </div>
  );
}

function StepRole({ answers, onChange, onNext }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: any) => void;
  onNext: () => void;
}) {
  const valid = answers.targetRole.trim() && answers.targetCity.trim() && answers.seniority && answers.industry;
  return (
    <div className="max-w-xl w-full mx-auto px-6">
      <h2 className="text-3xl font-black text-white mb-2">What roles + which city are you targeting?</h2>
      <p className="text-white/40 text-sm mb-8">Be specific — this anchors everything we generate for you.</p>

      <div className="space-y-5">
        <div>
          <label className={labelText}>Role</label>
          <input className={inputBase} placeholder="e.g. Senior Product Manager" value={answers.targetRole} onChange={e => onChange('targetRole', e.target.value)} />
        </div>
        <div>
          <label className={labelText}>City</label>
          <input className={inputBase} placeholder="e.g. Sydney" value={answers.targetCity} onChange={e => onChange('targetCity', e.target.value)} />
        </div>
        <div>
          <label className={labelText}>Seniority</label>
          <select className={inputBase} value={answers.seniority} onChange={e => onChange('seniority', e.target.value)}>
            <option value="">Select level</option>
            {SENIORITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelText}>Industry</label>
          <select className={inputBase} value={answers.industry} onChange={e => onChange('industry', e.target.value)}>
            <option value="">Select industry</option>
            {INDUSTRY_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!valid}
        className="mt-8 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-base transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

function StepTimeline({ answers, onChange, onNext }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: any) => void;
  onNext: () => void;
}) {
  const toggleChannel = (ch: string) => {
    const current = answers.channels;
    onChange('channels', current.includes(ch) ? current.filter(c => c !== ch) : [...current, ch]);
  };
  const valid = answers.searchDuration && answers.applicationsCount && answers.channels.length > 0;

  return (
    <div className="max-w-xl w-full mx-auto px-6">
      <h2 className="text-3xl font-black text-white mb-2">How long applying + roughly how many applications + main channels?</h2>
      <p className="text-white/40 text-sm mb-8">This tells us whether it's a volume problem, a targeting problem, or something else.</p>

      <div className="space-y-5">
        <div>
          <label className={labelText}>How long searching</label>
          <select className={inputBase} value={answers.searchDuration} onChange={e => onChange('searchDuration', e.target.value)}>
            <option value="">Select duration</option>
            {DURATION_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelText}>Applications sent</label>
          <select className={inputBase} value={answers.applicationsCount} onChange={e => onChange('applicationsCount', e.target.value)}>
            <option value="">Select range</option>
            {COUNT_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelText}>Channels used</label>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map(ch => (
              <button
                key={ch}
                type="button"
                onClick={() => toggleChannel(ch)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  answers.channels.includes(ch)
                    ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!valid}
        className="mt-8 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-base transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

function StepResponses({ answers, onChange, onNext }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: any) => void;
  onNext: () => void;
}) {
  const valid = answers.responsePattern && answers.perceivedBlocker.trim();

  return (
    <div className="max-w-xl w-full mx-auto px-6">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-white mb-2">What responses are you getting?</h2>
        <p className="text-white/40 text-sm mb-4">Pick whichever best describes your pattern.</p>
        <div className="space-y-2">
          {RESPONSE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange('responsePattern', opt.value)}
              className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                answers.responsePattern === opt.value
                  ? 'bg-indigo-600/20 border-indigo-500/60 text-white'
                  : 'bg-white/3 border-white/10 text-white/60 hover:border-white/25'
              }`}
            >
              <span className="font-bold block">{opt.label}</span>
              {opt.sub && <span className="text-xs text-white/40">{opt.sub}</span>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-black text-white mb-2">What's your biggest blocker right now?</h2>
        <textarea
          className={`${inputBase} resize-none`}
          rows={3}
          placeholder="Be honest — is it your resume? Your experience? Interview nerves? There's no wrong answer here."
          value={answers.perceivedBlocker}
          onChange={e => onChange('perceivedBlocker', e.target.value)}
        />
      </div>

      <button
        onClick={onNext}
        disabled={!valid}
        className="mt-8 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-base transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

function StepFiles({
  resume, setResume,
  cl1, setCl1,
  cl2, setCl2,
  onSubmit, submitting,
}: {
  resume: File | null; setResume: (f: File | null) => void;
  cl1: File | null; setCl1: (f: File | null) => void;
  cl2: File | null; setCl2: (f: File | null) => void;
  onSubmit: () => void; submitting: boolean;
}) {
  return (
    <div className="max-w-xl w-full mx-auto px-6">
      <h2 className="text-3xl font-black text-white mb-2">Now show us what you've been sending out.</h2>
      <p className="text-white/40 text-sm mb-2">
        We're not judging the documents. We're using them to understand how you've been positioning yourself — and where the gap is.
      </p>
      <p className="text-white/25 text-xs mb-8">PDF or Word accepted.</p>

      <div className="space-y-3">
        <FileDropZone label="Your resume" required file={resume} onFile={setResume} />
        <FileDropZone
          label="A recent cover letter"
          subtext="If you don't have one, that's useful information too."
          file={cl1}
          onFile={setCl1}
        />
        <FileDropZone label="Another one if you have it" file={cl2} onFile={setCl2} />
      </div>

      <motion.button
        onClick={onSubmit}
        disabled={!resume || submitting}
        whileHover={resume && !submitting ? { scale: 1.02 } : {}}
        whileTap={resume && !submitting ? { scale: 0.98 } : {}}
        className="mt-8 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-lg tracking-tight shadow-lg shadow-indigo-600/30 transition-colors"
      >
        {submitting ? 'Sending...' : 'Build my diagnosis'}
      </motion.button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function OnboardingIntake() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0); // 0=welcome, 1=role, 2=timeline, 3=responses, 4=upload, 5=processing
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null); // ref to clear on unmount

  // On mount: detect if intake was already submitted but report is still processing
  // (handles page refresh during processing). If a PROCESSING or FAILED report exists,
  // skip straight to the processing/error screen.
  useEffect(() => {
    api.get('/onboarding/report').then(({ data }) => {
      if (data.status === 'PROCESSING') {
        setStep(5);
        startPolling();
      } else if (data.status === 'FAILED') {
        setStep(5);
        setFailed(true);
      }
    }).catch(() => {
      // No report found — fresh intake, proceed normally
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const [answers, setAnswers] = useState<IntakeAnswers>({
    targetRole: '', targetCity: '', seniority: '', industry: '',
    searchDuration: '', applicationsCount: '', channels: [],
    responsePattern: '', perceivedBlocker: '',
  });

  const [resume, setResume] = useState<File | null>(null);
  const [cl1, setCl1] = useState<File | null>(null);
  const [cl2, setCl2] = useState<File | null>(null);

  const onChange = (k: keyof IntakeAnswers, v: any) =>
    setAnswers(prev => ({ ...prev, [k]: v }));

  // Extracted polling logic — stores interval in ref so it can be cleared on unmount
  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data: report } = await api.get('/onboarding/report');
        if (report.status === 'COMPLETE') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          // Invalidate profile — OnboardingGate re-checks hasCompletedOnboarding
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
        } else if (report.status === 'FAILED') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setFailed(true);
        }
      } catch {
        // Transient errors — keep polling
      }
    }, 3000);
  };

  const handleSubmit = async () => {
    if (!resume) return;
    setSubmitting(true);

    const formData = new FormData();
    formData.append('answers', JSON.stringify(answers));
    formData.append('resume', resume);
    if (cl1) formData.append('coverLetter1', cl1);
    if (cl2) formData.append('coverLetter2', cl2);

    try {
      const { data } = await api.post('/onboarding/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      setReportId(data.reportId);
      setStep(5); // processing screen
      startPolling();
    } catch (err) {
      console.error('[OnboardingIntake] Submit failed:', err);
      toast.error('Something went wrong uploading your files. Please try again.');
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    setFailed(false);
    try {
      await api.post('/onboarding/retry');
      startPolling();
    } catch {
      setFailed(true);
    }
  };

  // Processing screen
  if (step === 5) {
    return <ProcessingScreen failed={failed} onRetry={handleRetry} />;
  }

  const STEPS = [
    <StepWelcome onNext={() => setStep(1)} />,
    <StepRole answers={answers} onChange={onChange} onNext={() => setStep(2)} />,
    <StepTimeline answers={answers} onChange={onChange} onNext={() => setStep(3)} />,
    <StepResponses answers={answers} onChange={onChange} onNext={() => setStep(4)} />,
    <StepFiles
      resume={resume} setResume={setResume}
      cl1={cl1} setCl1={setCl1}
      cl2={cl2} setCl2={setCl2}
      onSubmit={handleSubmit}
      submitting={submitting}
    />,
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden py-12">
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      {/* Progress dots — hidden on welcome */}
      {step > 0 && <DotProgress step={step - 1} total={4} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="w-full"
        >
          {STEPS[step]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -30
```

Expected: Clean build or only pre-existing warnings.

- [ ] **Step 4: Commit**

```bash
git add src/components/OnboardingIntake.tsx
git commit -m "feat: add OnboardingIntake — 5-step glassmorphism flow with Framer Motion"
```

---

## Task 8: Frontend — DiagnosticReport Component

**Files:**
- Create: `src/components/DiagnosticReport.tsx`
- Modify: `src/App.tsx` (Dashboard component — add report panel at top)

- [ ] **Step 1: Create DiagnosticReport.tsx**

Create `src/components/DiagnosticReport.tsx`:

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../lib/api';

const SECTIONS = [
  { key: 'targeting', heading: 'Targeting Assessment' },
  { key: 'document_audit', heading: 'Document Audit' },
  { key: 'pipeline', heading: 'Pipeline Diagnosis' },
  { key: 'honest', heading: 'The Honest Assessment' },
  { key: 'fix', heading: 'The 3-Step Fix' },
  { key: 'what_jobhub_does', heading: 'What JobHub Will Do For You' },
];

function RelevancePills({
  reportId,
  sectionKey,
}: {
  reportId: string;
  sectionKey: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (score: string) =>
      api.post(`/onboarding/report/${reportId}/feedback`, {
        sectionKey,
        relevanceScore: score,
      }),
  });

  if (selected) {
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xs text-white/20 mt-3 pl-1"
      >
        Noted — thanks.
      </motion.p>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-4">
      <span className="text-xs text-white/30">Did this reflect your situation?</span>
      {[
        { score: 'spot_on', label: 'Spot on' },
        { score: 'partially', label: 'Partially' },
        { score: 'missed', label: 'Missed the mark' },
      ].map(({ score, label }) => (
        <button
          key={score}
          onClick={() => {
            setSelected(score);
            mutation.mutate(score);
          }}
          className="px-3 py-1 rounded-full text-xs font-semibold border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 transition-all"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ReportSection({
  content,
  reportId,
  sectionKey,
  delay,
}: {
  content: string;
  reportId: string;
  sectionKey: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      className="border-b border-white/5 pb-8 mb-8 last:border-0 last:mb-0"
    >
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      <RelevancePills reportId={reportId} sectionKey={sectionKey} />
    </motion.div>
  );
}

/**
 * Parses the flat markdown report into sections by heading.
 * Expects headings like "## Targeting Assessment".
 */
function parseReportSections(markdown: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = markdown.split('\n');
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentKey) result[currentKey] = buffer.join('\n').trim();
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      flush();
      const headingText = headingMatch[1].trim();
      const section = SECTIONS.find(s => s.heading === headingText);
      currentKey = section?.key ?? null;
    } else if (currentKey) {
      buffer.push(line);
    }
  }
  flush();
  return result;
}

export function DiagnosticReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['diagnosticReport'],
    queryFn: async () => {
      const { data } = await api.get('/onboarding/report');
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading || !data?.reportMarkdown) return null;

  const sections = parseReportSections(data.reportMarkdown);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-8 mb-10">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-indigo-400/70 mb-1">Your Diagnosis</p>
          <h2 className="text-3xl font-black text-white">Here's what we found.</h2>
          <p className="text-white/40 text-sm mt-1">
            Read through each section. Use the feedback buttons — they help us improve the accuracy of this report over time.
          </p>
        </motion.div>

        {SECTIONS.map((section, i) => {
          const content = sections[section.key];
          if (!content) return null;
          return (
            <ReportSection
              key={section.key}
              content={`## ${section.heading}\n\n${content}`}
              reportId={data.reportId}
              sectionKey={section.key}
              delay={0.1 + i * 0.15}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Add DiagnosticReport to Dashboard in App.tsx**

Open `src/App.tsx`. In the `Dashboard` component, add the import at the top of the file:

```tsx
import { DiagnosticReport } from './components/DiagnosticReport';
```

Inside the `Dashboard` JSX, add `<DiagnosticReport />` as the first child of the `space-y-10` div, before the `<header>`:

```tsx
return (
  <div className="space-y-10">
    <DiagnosticReport />
    <header className="space-y-2">
    ...
```

- [ ] **Step 3: Build and verify**

```bash
npm run build 2>&1 | tail -20
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/DiagnosticReport.tsx src/App.tsx
git commit -m "feat: add DiagnosticReport panel with per-section relevance feedback"
```

---

## Task 9: End-to-End Integration Test

**Files:** None (manual verification)

- [ ] **Step 1: Start both servers**

Terminal 1 (backend):
```bash
cd server && npm run dev
```

Terminal 2 (frontend):
```bash
npm run dev
```

- [ ] **Step 2: Test with a new user account**

Create a fresh account at `http://localhost:5173/auth`. Verify:
- [ ] After login, `OnboardingIntake` renders (not the dashboard)
- [ ] Welcome screen appears with correct copy
- [ ] Progress dots appear from Step 2 onwards
- [ ] All steps advance correctly, validation prevents skipping empty fields
- [ ] File upload accepts PDF and DOCX
- [ ] Submit transitions to processing screen
- [ ] Processing screen shows rotating copy
- [ ] After report generates (~30–60s), profile query invalidates and dashboard renders
- [ ] `DiagnosticReport` panel appears at top of dashboard with all 6 sections
- [ ] Relevance feedback pills appear under each section
- [ ] Clicking a pill sends request to `/api/onboarding/report/:id/feedback` (check Network tab)
- [ ] Generating a document (resume or cover letter) — check server logs confirm search context block is prepended to blueprint prompt

- [ ] **Step 3: Test the FAILED state**

Temporarily cause the diagnostic service to throw (e.g., blank out the OPENROUTER_API_KEY in .env for one request). Verify:
- [ ] Processing screen transitions to error state with "Something went wrong" copy
- [ ] "Try again" button calls `/api/onboarding/retry` and resumes polling

- [ ] **Step 4: Test existing user**

For the dev user (DEV_BYPASS_AUTH=true) who already has `hasCompletedOnboarding = false` (default), verify the gate shows. Then set `hasCompletedOnboarding = true` in the DB directly:

```bash
cd server && npx ts-node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.candidateProfile.updateMany({ data: { hasCompletedOnboarding: true } }).then(console.log);
"
```

Reload — dashboard should render normally without the intake.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: onboarding intake complete — intake, report, feedback, context injection"
```

---

## Done

At this point the following is live:
- Mandatory onboarding intake (no skip, glassmorphism, Framer Motion, Christmas-gift emotional arc)
- Async diagnostic report generation via Claude
- Per-section relevance feedback stored for future prompt improvement
- Search context injected into every document generation call
- Modular `diagnosticReport.ts` ready for prompt iteration in a separate session

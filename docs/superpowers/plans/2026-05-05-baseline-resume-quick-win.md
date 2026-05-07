# Baseline Resume Quick Win — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a polished, diagnostic-driven resume in the background after onboarding and surface it on the profile page as a free downloadable gift that drives trial usage.

**Architecture:** After the diagnostic report resolves, `generateBaselineResume` fires fire-and-forget, stores the result in the existing `Document` table as type `BASELINE_RESUME`, and a new banner on `ProfileBank` polls for it and triggers the download + conversion modal on click.

**Tech Stack:** TypeScript, Prisma, Express, React, `docx` (frontend DOCX export via `src/lib/exportDocx.ts`), OpenRouter (`callLLM`), `@tanstack/react-query`

---

## File Map

| Action | File |
|--------|------|
| Modify | `server/prisma/schema.prisma` — add `BASELINE_RESUME` to `DocumentType` enum |
| Create | `server/prisma/migrations/<timestamp>_add_baseline_resume_type/migration.sql` — auto-generated |
| Create | `server/src/services/baselineResume.ts` — generation service |
| Modify | `server/src/routes/onboarding.ts` — wire in fire-and-forget call |
| Modify | `server/src/routes/profile/profile-core.ts` — add status + generate endpoints |
| Create | `src/components/BaselineResumeBanner.tsx` — banner + modal component |
| Modify | `src/components/ProfileBank.tsx` — render banner at top |

---

## Task 1: Schema — Add BASELINE_RESUME to DocumentType enum

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add the enum value**

Open `server/prisma/schema.prisma`. Find the `DocumentType` enum (currently at the bottom of the file):

```prisma
enum DocumentType {
  RESUME
  COVER_LETTER
  STAR_RESPONSE
}
```

Replace with:

```prisma
enum DocumentType {
  RESUME
  COVER_LETTER
  STAR_RESPONSE
  BASELINE_RESUME
}
```

- [ ] **Step 2: Run the migration**

```bash
cd server
npx prisma migrate dev --name add_baseline_resume_type
```

Expected output:
```
✔ Your database is now in sync with your schema.
Generated Prisma Client
```

- [ ] **Step 3: Verify the client was regenerated**

```bash
cd server
npx prisma generate
```

Expected: no errors, Prisma Client regenerated.

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(schema): add BASELINE_RESUME to DocumentType enum"
```

---

## Task 2: Service — generateBaselineResume

**Files:**
- Create: `server/src/services/baselineResume.ts`

- [ ] **Step 1: Create the file**

Create `server/src/services/baselineResume.ts` with this exact content:

```typescript
import { callLLM } from './llm';
import { prisma } from '../index';
import fs from 'fs';
import path from 'path';

export async function generateBaselineResume(
  userId: string,
  resumeRawText: string,
  reportMarkdown: string,
): Promise<void> {
  try {
    const existing = await prisma.document.findFirst({
      where: { userId, type: 'BASELINE_RESUME' },
    });
    if (existing) {
      console.log(`[BaselineResume] Already exists for userId=${userId} — skipping`);
      return;
    }

    const rules = fs.readFileSync(
      path.join(__dirname, '..', '..', 'rules', 'resume_rules.md'),
      'utf-8'
    );

    const prompt = `You are a professional Australian resume writer rewriting a candidate's resume based on a diagnostic report that identified exactly what is wrong with it.

RESUME RULES — follow every rule in this document:
${rules}

DIAGNOSTIC FINDINGS — these identify exactly what needs fixing. Address every issue directly:
${reportMarkdown}

CANDIDATE'S EXISTING RESUME:
${resumeRawText}

TASK:
Rewrite the resume above into a polished, ATS-optimised Australian resume. This is a general-purpose version (no job description) targeting the candidate's stated role.

ADDITIONAL RULES:
- Where a quantified metric is absent, insert a placeholder in this EXACT format: [Add: e.g. reduced processing time by X%]
- Do NOT fabricate metrics or details not present in the original resume.
- Fix every weakness identified in the diagnostic findings.
- Australian English throughout (organisation, programme, behaviour, recognise, etc.)
- Output the complete resume in clean markdown only. No preamble, no meta-commentary, no explanations — just the resume.`;

    const raw = await callLLM(prompt, false);
    const content = typeof raw === 'string' ? raw : JSON.stringify(raw);

    await prisma.document.create({
      data: {
        title: 'Your Improved Resume',
        content,
        type: 'BASELINE_RESUME',
        userId,
      },
    });

    console.log(`[BaselineResume] Generated and saved for userId=${userId}`);
  } catch (err) {
    console.error('[BaselineResume] Generation failed:', err);
    // Never throw — caller is fire-and-forget
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/baselineResume.ts
git commit -m "feat(service): generateBaselineResume — diagnostic-driven resume generation"
```

---

## Task 3: Onboarding — Wire in the background call

**Files:**
- Modify: `server/src/routes/onboarding.ts`

- [ ] **Step 1: Add the import**

At the top of `server/src/routes/onboarding.ts`, add after the existing imports:

```typescript
import { generateBaselineResume } from '../services/baselineResume';
```

- [ ] **Step 2: Fire after diagnostic resolves**

Find this block inside `onboarding.ts` (around line 177):

```typescript
generateDiagnosticReport(reportInput)
  .then(async (markdown) => {
    await prisma.diagnosticReport.update({
      where: { id: report.id },
      data: { status: 'COMPLETE', reportMarkdown: markdown },
    });
    await prisma.candidateProfile.update({
      where: { userId },
      data: { hasCompletedOnboarding: true },
    });
    const freshProfile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if ((answers as any).marketingConsent && freshProfile && !freshProfile.marketingEmailSent && (answers as any).marketingEmail) {
      await sendWelcomeEmail((answers as any).marketingEmail);
      await prisma.candidateProfile.update({
        where: { userId },
        data: { marketingEmailSent: true },
      });
    }
    console.log(`[Onboarding] Diagnostic complete for userId: ${userId}`);
  })
```

Add the baseline resume call at the end of the `.then` block, just before the closing `console.log`:

```typescript
generateDiagnosticReport(reportInput)
  .then(async (markdown) => {
    await prisma.diagnosticReport.update({
      where: { id: report.id },
      data: { status: 'COMPLETE', reportMarkdown: markdown },
    });
    await prisma.candidateProfile.update({
      where: { userId },
      data: { hasCompletedOnboarding: true },
    });
    const freshProfile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if ((answers as any).marketingConsent && freshProfile && !freshProfile.marketingEmailSent && (answers as any).marketingEmail) {
      await sendWelcomeEmail((answers as any).marketingEmail);
      await prisma.candidateProfile.update({
        where: { userId },
        data: { marketingEmailSent: true },
      });
    }
    generateBaselineResume(userId, resumeText, markdown).catch(err =>
      console.error('[Onboarding] Baseline resume failed:', err)
    );
    console.log(`[Onboarding] Diagnostic complete for userId: ${userId}`);
  })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/onboarding.ts
git commit -m "feat(onboarding): fire baseline resume generation after diagnostic completes"
```

---

## Task 4: API Endpoints — status check + on-demand fallback

**Files:**
- Modify: `server/src/routes/profile/profile-core.ts`

- [ ] **Step 1: Add the import at the top of profile-core.ts**

Add after the existing imports:

```typescript
import { generateBaselineResume } from '../../services/baselineResume';
```

- [ ] **Step 2: Add the two endpoints**

Add these two routes at the end of the router, before the `export default router` line:

```typescript
// GET /api/profile/baseline-resume — check if ready
router.get('/profile/baseline-resume', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const doc = await prisma.document.findFirst({
      where: { userId, type: 'BASELINE_RESUME' },
      select: { id: true },
    });
    if (doc) {
      return res.json({ status: 'ready', documentId: doc.id });
    }
    return res.json({ status: 'pending' });
  } catch (err) {
    console.error('[BaselineResume] Status check failed:', err);
    return res.status(500).json({ error: 'Failed to check baseline resume status' });
  }
});

// POST /api/profile/baseline-resume/generate — on-demand fallback trigger
router.post('/profile/baseline-resume/generate', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const existing = await prisma.document.findFirst({
      where: { userId, type: 'BASELINE_RESUME' },
      select: { id: true },
    });
    if (existing) {
      return res.json({ status: 'ready', documentId: existing.id });
    }

    const [profile, report] = await Promise.all([
      prisma.candidateProfile.findUnique({ where: { userId }, select: { resumeRawText: true } }),
      prisma.diagnosticReport.findUnique({ where: { userId }, select: { reportMarkdown: true, status: true } }),
    ]);

    if (!profile?.resumeRawText || !report?.reportMarkdown) {
      return res.status(400).json({ error: 'Resume or diagnostic report not available' });
    }

    generateBaselineResume(userId, profile.resumeRawText, report.reportMarkdown).catch(err =>
      console.error('[BaselineResume] On-demand generation failed:', err)
    );

    return res.json({ status: 'generating' });
  } catch (err) {
    console.error('[BaselineResume] On-demand trigger failed:', err);
    return res.status(500).json({ error: 'Failed to start generation' });
  }
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/profile/profile-core.ts
git commit -m "feat(api): baseline resume status and on-demand generate endpoints"
```

---

## Task 5: Frontend — BaselineResumeBanner component

**Files:**
- Create: `src/components/BaselineResumeBanner.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/BaselineResumeBanner.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, X, Sparkles } from 'lucide-react';
import api from '../lib/api';

interface Props {
  isDark: boolean;
}

type BannerStatus = 'checking' | 'pending' | 'generating' | 'ready' | 'dismissed';

const DISMISSED_KEY = 'jobhub_baseline_resume_dismissed';

export function BaselineResumeBanner({ isDark }: Props) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<BannerStatus>('checking');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const check = useCallback(async () => {
    try {
      const { data } = await api.get('/profile/baseline-resume');
      if (data.status === 'ready') {
        setDocumentId(data.documentId);
        setStatus('ready');
      } else {
        setStatus('pending');
      }
    } catch {
      setStatus('pending');
    }
  }, []);

  // Initial check
  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) {
      setStatus('dismissed');
      return;
    }
    check();
  }, [check]);

  // Poll every 3s while pending or generating
  useEffect(() => {
    if (status !== 'pending' && status !== 'generating') return;
    const id = setInterval(async () => {
      try {
        const { data } = await api.get('/profile/baseline-resume');
        if (data.status === 'ready') {
          setDocumentId(data.documentId);
          setStatus('ready');
          clearInterval(id);
        }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(id);
  }, [status]);

  // If still pending after initial check, trigger on-demand generation
  useEffect(() => {
    if (status !== 'pending') return;
    api.post('/profile/baseline-resume/generate').catch(() => {});
    setStatus('generating');
  }, [status]);

  const handleDownload = async () => {
    if (!documentId || downloading) return;
    setDownloading(true);
    try {
      const { data } = await api.get(`/documents/${documentId}`);
      const { exportDocx } = await import('../lib/exportDocx');
      await exportDocx(data.content, 'resume', '', '');
      setShowModal(true);
    } catch {
      // silent — user can try again
    } finally {
      setDownloading(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setStatus('dismissed');
  };

  if (status === 'dismissed' || status === 'checking') return null;

  const accent = '#2dd4bf';
  const bg = isDark ? 'rgba(45,212,191,0.06)' : 'rgba(45,212,191,0.08)';
  const border = isDark ? 'rgba(45,212,191,0.2)' : 'rgba(45,212,191,0.3)';
  const text = isDark ? '#f3f4f6' : '#111827';
  const sub = isDark ? '#9ca3af' : '#6b7280';

  return (
    <>
      {/* Banner */}
      <div style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `${accent}18`, border: `1px solid ${accent}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Sparkles size={17} style={{ color: accent }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: text, letterSpacing: '-0.01em' }}>
              {status === 'ready' ? 'Your improved resume is ready' : 'Preparing your improved resume…'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: sub }}>
              {status === 'ready'
                ? 'Rewritten based on your diagnostic findings — free to download'
                : 'We\'re rewriting it based on your diagnostic findings'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {status === 'ready' ? (
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: accent, color: '#0d1117',
                border: 'none', borderRadius: 9, padding: '9px 18px',
                fontSize: 13, fontWeight: 800, cursor: downloading ? 'wait' : 'pointer',
                opacity: downloading ? 0.7 : 1,
              }}
            >
              {downloading
                ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Downloading…</>
                : <><Download size={13} /> Download free resume</>
              }
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: sub, fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', color: accent }} />
              <span>Generating…</span>
            </div>
          )}

          <button
            onClick={dismiss}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub, padding: 4, lineHeight: 1 }}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Download modal */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? '#0d1117' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: 20, padding: '32px 36px', maxWidth: 400, width: '100%',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${accent}18`, border: `1px solid ${accent}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <Download size={20} style={{ color: accent }} />
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: text, letterSpacing: '-0.01em' }}>
              Your resume is downloading
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: sub, lineHeight: 1.6 }}>
              Want to tailor it to a real job? You have 5 free generations — resumes and cover letters included.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => { setShowModal(false); navigate('/'); }}
                style={{
                  background: accent, color: '#0d1117',
                  border: 'none', borderRadius: 10, padding: '12px 20px',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer', width: '100%',
                }}
              >
                Start matching jobs →
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent',
                  color: sub,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 10, padding: '11px 20px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%',
                }}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Check that `GET /documents/:id` exists**

Run:
```bash
grep -n "documents/:id\|documents\/:id" server/src/routes/documents.ts server/src/index.ts
```

If the route does not exist, add it to `server/src/routes/documents.ts`:
```typescript
router.get('/documents/:id', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  try {
    const doc = await prisma.document.findFirst({ where: { id, userId } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/BaselineResumeBanner.tsx
git commit -m "feat(ui): BaselineResumeBanner — polls for ready, downloads, shows conversion modal"
```

---

## Task 6: Wire Banner into ProfileBank

**Files:**
- Modify: `src/components/ProfileBank.tsx`

- [ ] **Step 1: Add the import**

At the top of `src/components/ProfileBank.tsx`, add:

```typescript
import { BaselineResumeBanner } from './BaselineResumeBanner';
```

- [ ] **Step 2: Find the render location**

In `ProfileBank`, find the return block (around line 1462). It starts like:

```tsx
return (
  <div style={{ background: pageBg, minHeight: '100%', padding: '24px 0', color: textMain, fontFamily: 'system-ui, sans-serif' }}>
    {/* First-visit welcome modal */}
    <AnimatePresence>
      {showWelcomeModal && (
```

- [ ] **Step 3: Add the banner**

The banner should render inside the page's content container, above all the islands. Find where the main content `<div>` starts (the one with `maxWidth` or similar). Add the banner at the very top of the content column, but only when `freeGenerationsUsed === 0` and the user has completed onboarding.

Locate the inner content wrapper. It will look something like:
```tsx
<div style={{ maxWidth: ..., margin: '0 auto', padding: '0 24px' }}>
```

Add the banner as the first child:
```tsx
<div style={{ maxWidth: ..., margin: '0 auto', padding: '0 24px' }}>
  {profile.hasCompletedOnboarding && (profile.freeGenerationsUsed ?? 0) === 0 && (
    <BaselineResumeBanner isDark={isDark} />
  )}
  {/* rest of content */}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: no TypeScript or build errors.

- [ ] **Step 5: Manual smoke test**

1. Log in as a test account with `freeGenerationsUsed === 0` and a completed diagnostic.
2. Navigate to `/workspace`.
3. Confirm the banner renders.
4. Confirm it shows "Generating…" initially, then "Download free resume" when the document exists (or after ~30–90s if testing end-to-end).
5. Click download — confirm DOCX downloads and modal appears.
6. Click "Start matching jobs" — confirm navigation to `/`.
7. Dismiss the banner — confirm it doesn't reappear on refresh.
8. Log in as an account with `freeGenerationsUsed > 0` — confirm banner does not show.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProfileBank.tsx
git commit -m "feat(ui): show baseline resume banner on profile page for new users"
```

---

## Task 7: Deploy to production

- [ ] **Step 1: Push to master**

```bash
git push origin master
```

- [ ] **Step 2: Run migration on production**

Railway runs `prisma migrate deploy` on build if configured. Verify by checking Railway build logs for:
```
Running prisma migrate deploy
✔ Applied migration add_baseline_resume_type
```

If not configured, connect to Railway shell and run:
```bash
npx prisma migrate deploy
```

- [ ] **Step 3: Verify in production**

Log into production as `kiron182@gmail.com`, navigate to `/workspace`, confirm no banner (since `freeGenerationsUsed > 0` for admin account). Then check the database for any existing users who onboarded after today — they should get banners on next visit.

---

## Self-Review Notes

- `BASELINE_RESUME` documents are not exempt from the quota counter in `accessControl.ts` because the baseline resume is generated server-side directly (not via the `POST /generate/:type` route that calls `checkAccess`). No quota change is needed — the endpoint bypasses `checkAccess` entirely.
- The `callLLM` return type is `any` but always returns a string when `jsonMode: false`. The `typeof raw === 'string' ? raw : JSON.stringify(raw)` guard handles any edge case.
- The banner polling stops immediately when `status === 'ready'` — no memory leak risk.
- `DISMISSED_KEY` in localStorage means the banner never re-appears after dismiss, even for users who regenerate. This is intentional.
- The "Start matching jobs" modal button navigates to `/` (Dashboard). If the Job Feed lives at a different route, update the `navigate('/')` call in Task 5.

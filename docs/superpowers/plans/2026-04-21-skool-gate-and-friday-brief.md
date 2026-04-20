# Skool Gate + Friday Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the diagnostic report behind a free Skool community join, and give Kiron an admin page that generates a spoken Friday call script from that week's reports.

**Architecture:** Two largely independent features sharing one Prisma migration. The Skool gate is a React overlay component that sits above `ReportExperience` and self-dismisses once the server confirms join. The Friday brief is a new admin route + LLM generation endpoint using `callClaude`.

**Tech Stack:** Prisma (PostgreSQL), Express/TypeScript, React/TanStack Query, Framer Motion, `callClaude` via OpenRouter.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `server/prisma/schema.prisma` | Add `skoolJoined`, `skoolCommunityEmail` to `CandidateProfile`; add `FridayBrief` model |
| Create | `server/src/routes/skool.ts` | `POST /api/skool/join` endpoint |
| Create | `server/src/routes/admin.ts` | `GET /api/admin/friday-brief` + `POST /api/admin/friday-brief/generate` |
| Modify | `server/src/routes/onboarding.ts` | Add `createdAt` to `GET /api/onboarding/report` response |
| Modify | `server/src/index.ts` | Register `skoolRouter` and `adminRouter` |
| Create | `src/components/SkoolGate.tsx` | Full-screen gate overlay with join flow |
| Modify | `src/App.tsx` | Render `SkoolGate` alongside `ReportExperience`; add `/admin/friday-brief` route |
| Modify | `src/components/ReportExperience.tsx` | Add Friday call banner for current-window reports |
| Create | `src/pages/FridayBriefPage.tsx` | Admin page: view + generate call script |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add fields to CandidateProfile**

In `server/prisma/schema.prisma`, add these two lines inside the `CandidateProfile` model after the `dashboardAccessRequested` field (line ~41):

```prisma
  skoolJoined           Boolean  @default(false)
  skoolCommunityEmail   String?
```

- [ ] **Step 2: Add FridayBrief model**

At the end of `server/prisma/schema.prisma`, add:

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

- [ ] **Step 3: Run migration**

```bash
cd server
npx prisma migrate dev --name add_skool_gate_and_friday_brief
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 4: Verify generated client has new fields**

```bash
npx prisma generate
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): add skool gate fields and FridayBrief model"
```

---

## Task 2: Skool Join Endpoint

**Files:**
- Create: `server/src/routes/skool.ts`
- Create: `server/src/routes/skool.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/skool.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
const mockUpdate = vi.fn();
vi.mock('../index', () => ({
  prisma: {
    candidateProfile: {
      update: mockUpdate,
    },
  },
}));

// Mock authenticate middleware to inject a test user
vi.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

import express from 'express';
import request from 'supertest';
import skoolRouter from './skool';

const app = express();
app.use(express.json());
app.use('/api/skool', skoolRouter);

describe('POST /api/skool/join', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves skool email and flips skoolJoined to true', async () => {
    mockUpdate.mockResolvedValue({});
    const res = await request(app)
      .post('/api/skool/join')
      .send({ skoolEmail: 'member@skool.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId: 'test-user-id' },
      data: { skoolJoined: true, skoolCommunityEmail: 'member@skool.com' },
    });
  });

  it('sets skoolJoined true with no email when skoolEmail is blank', async () => {
    mockUpdate.mockResolvedValue({});
    const res = await request(app)
      .post('/api/skool/join')
      .send({ skoolEmail: '' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId: 'test-user-id' },
      data: { skoolJoined: true, skoolCommunityEmail: null },
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd server
npx vitest run src/routes/skool.test.ts
```

Expected: FAIL — `Cannot find module './skool'`

- [ ] **Step 3: Create the endpoint**

Create `server/src/routes/skool.ts`:

```typescript
import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/skool/join
router.post('/join', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { skoolEmail } = req.body as { skoolEmail?: string };

  const email = skoolEmail?.trim() || null;

  try {
    await prisma.candidateProfile.update({
      where: { userId },
      data: {
        skoolJoined: true,
        skoolCommunityEmail: email,
      },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[skool/join] error:', err);
    return res.status(500).json({ error: 'Failed to record join' });
  }
});

export default router;
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run src/routes/skool.test.ts
```

Expected: PASS — 2 tests passing

- [ ] **Step 5: Register route in server/src/index.ts**

Add import after the webhooks import:

```typescript
import skoolRouter from './routes/skool';
```

Add mount after `app.use('/api/webhooks', webhooksRouter);`:

```typescript
app.use('/api/skool', skoolRouter);
```

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/skool.ts server/src/routes/skool.test.ts server/src/index.ts
git commit -m "feat(api): add POST /api/skool/join endpoint"
```

---

## Task 3: Admin Friday Brief Endpoints

**Files:**
- Create: `server/src/routes/admin.ts`

- [ ] **Step 1: Create window calculation helper and GET endpoint**

Create `server/src/routes/admin.ts`:

```typescript
import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { callClaude } from '../services/llm';

const router = Router();

/**
 * Returns the start and end of the current weekly window.
 * Window: Thursday 19:00 AEST (09:00 UTC) → next Thursday 09:00 UTC
 */
function getCurrentWindow(): { from: Date; to: Date } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun,1=Mon,...,4=Thu,...,6=Sat
  const hour = now.getUTCHours();

  // How many days ago was the last Thursday 09:00 UTC?
  let daysSince = (day - 4 + 7) % 7;
  // If today is Thursday but before 09:00 UTC, use last Thursday
  if (day === 4 && hour < 9) daysSince = 7;

  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - daysSince);
  from.setUTCHours(9, 0, 0, 0);
  from.setUTCMilliseconds(0);

  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);

  return { from, to };
}

async function requireAdmin(req: any, res: any, next: any) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorised' });
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { dashboardAccess: true },
  });
  if (!profile?.dashboardAccess) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// GET /api/admin/friday-brief
// Returns cached script for current window, or { cached: false } if none exists
router.get('/friday-brief', authenticate, requireAdmin, async (_req, res) => {
  const { from, to } = getCurrentWindow();
  try {
    const cached = await prisma.fridayBrief.findUnique({
      where: { windowStart: from },
    });

    const reportCount = await prisma.diagnosticReport.count({
      where: {
        status: 'COMPLETE',
        createdAt: { gte: from, lt: to },
        candidateProfile: {
          diagnosticReport: {
            // Only first-time reports: no earlier COMPLETE report for this userId
            // We achieve this by checking createdAt equals the profile's oldest COMPLETE report
          },
        },
      },
    });

    // Count first-time reports: find reports where no earlier COMPLETE report exists for the same userId
    const allWindowReports = await prisma.diagnosticReport.findMany({
      where: { status: 'COMPLETE', createdAt: { gte: from, lt: to } },
      select: { userId: true, createdAt: true },
    });

    const firstTimeCount = await countFirstTimeReports(allWindowReports.map(r => r.userId));

    if (cached) {
      return res.json({
        window: { from, to },
        reportCount: firstTimeCount,
        cached: true,
        script: cached.script,
        generatedAt: cached.generatedAt,
      });
    }

    return res.json({
      window: { from, to },
      reportCount: firstTimeCount,
      cached: false,
      script: null,
    });
  } catch (err) {
    console.error('[admin/friday-brief GET] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

async function countFirstTimeReports(userIds: string[]): Promise<number> {
  let count = 0;
  for (const userId of userIds) {
    const earlier = await prisma.diagnosticReport.count({
      where: { userId, status: 'COMPLETE' },
    });
    // If earlier count is exactly 1, this window's report IS their first
    if (earlier === 1) count++;
  }
  return count;
}

async function getFirstTimeReportsForWindow(from: Date, to: Date) {
  const windowReports = await prisma.diagnosticReport.findMany({
    where: { status: 'COMPLETE', createdAt: { gte: from, lt: to } },
    include: {
      candidateProfile: {
        select: {
          name: true,
          targetRole: true,
          searchDuration: true,
          perceivedBlocker: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const firstTime = [];
  for (const report of windowReports) {
    const totalComplete = await prisma.diagnosticReport.count({
      where: { userId: report.userId, status: 'COMPLETE' },
    });
    if (totalComplete === 1) firstTime.push(report);
  }
  return firstTime;
}

function buildBriefPrompt(
  reports: Awaited<ReturnType<typeof getFirstTimeReportsForWindow>>,
  from: Date,
  to: Date
): string {
  const weekLabel = from.toISOString().split('T')[0];
  const people = reports.map(r => {
    const p = r.candidateProfile;
    return [
      `--- PERSON: ${p?.name ?? 'Unknown'} ---`,
      `Target Role: ${p?.targetRole ?? 'Not specified'}`,
      `Search Duration: ${p?.searchDuration ?? 'Not specified'}`,
      `Perceived Blocker: ${p?.perceivedBlocker ?? 'Not specified'}`,
      `Report:`,
      r.reportMarkdown ?? '(no report content)',
    ].join('\n');
  }).join('\n\n');

  return `You are writing a spoken Friday call script for Kiron, a career coach running a weekly live call for Australian graduate job seekers. Use first person ("I've looked at your report..."). Write in warm, direct Australian English — like a coach who has genuinely read every report. This is something Kiron will read aloud on a live call.

Week: ${weekLabel}
Number of first-time reports this week: ${reports.length}

${people}

Write a complete spoken script with exactly these four sections:

**OPENING** — Welcome the group. Mention how many reports came in this week. Tease 2-3 themes you noticed across all of them. Keep it warm and energetic (3-4 sentences).

**COMMON THEMES** — Identify 3 to 5 patterns that appear across multiple reports this week. For each theme: name it, explain what you're seeing, and give a concrete talking point Kiron can expand on. Be specific to this cohort — no generic advice.

**INDIVIDUAL CALLOUTS** — One paragraph per person. Address them by first name. State one specific insight from their report that shows you read it carefully. Give them one concrete next step. Make them feel seen and not alone.

**CLOSE** — Encourage questions in the chat. Remind them what the community is for. Hype next week's call. End with energy (2-3 sentences).

Write the full script now, ready for Kiron to read. Do not include any meta-commentary or instructions — just the script.`;
}

// POST /api/admin/friday-brief/generate
router.post('/friday-brief/generate', authenticate, requireAdmin, async (_req, res) => {
  const { from, to } = getCurrentWindow();
  try {
    const reports = await getFirstTimeReportsForWindow(from, to);

    if (reports.length === 0) {
      return res.json({ script: 'No first-time reports in this window yet.', reportCount: 0 });
    }

    const prompt = buildBriefPrompt(reports, from, to);
    const { content: script } = await callClaude(prompt, false);

    await prisma.fridayBrief.upsert({
      where: { windowStart: from },
      update: { script, reportCount: reports.length, generatedAt: new Date(), windowEnd: to },
      create: { windowStart: from, windowEnd: to, script, reportCount: reports.length },
    });

    return res.json({ script, reportCount: reports.length });
  } catch (err) {
    console.error('[admin/friday-brief POST] error:', err);
    return res.status(500).json({ error: 'Failed to generate brief' });
  }
});

export default router;
```

- [ ] **Step 2: Register route in server/src/index.ts**

Add import after `skoolRouter` import:

```typescript
import adminRouter from './routes/admin';
```

Add mount after `app.use('/api/skool', skoolRouter);`:

```typescript
app.use('/api/admin', adminRouter);
```

- [ ] **Step 3: Smoke test**

Start the server locally and run:

```bash
curl -s http://localhost:3002/api/admin/friday-brief \
  -H "Authorization: Bearer <your-token>"
```

Expected: `{ "window": {...}, "reportCount": 0, "cached": false, "script": null }`

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/admin.ts server/src/index.ts
git commit -m "feat(api): add Friday brief GET and POST generate endpoints"
```

---

## Task 4: Add createdAt to Report API Response

**Files:**
- Modify: `server/src/routes/onboarding.ts:176-179`

- [ ] **Step 1: Add `createdAt` to the GET /report response**

Find the `GET /api/onboarding/report` handler (around line 168). The response block currently reads:

```typescript
    return res.json({
      reportId: report.id,
      status: report.status,
      reportMarkdown: report.reportMarkdown ?? null,
    });
```

Change it to:

```typescript
    return res.json({
      reportId: report.id,
      status: report.status,
      reportMarkdown: report.reportMarkdown ?? null,
      createdAt: report.createdAt.toISOString(),
    });
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/onboarding.ts
git commit -m "feat(api): include createdAt in report response for Friday banner"
```

---

## Task 5: SkoolGate Component

**Files:**
- Create: `src/components/SkoolGate.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SkoolGate.tsx`:

```typescript
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface SkoolGateProps {
  onJoined: () => void;
}

type GateState = 'prompt' | 'email' | 'success';

export function SkoolGate({ onJoined }: SkoolGateProps) {
  const queryClient = useQueryClient();
  const [gateState, setGateState] = useState<GateState>('prompt');
  const [skoolEmail, setSkoolEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(true);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Already joined — render nothing (gate is transparent)
  if (profile?.skoolJoined) return null;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.post('/skool/join', { skoolEmail: skoolEmail.trim() });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setGateState('success');
      // After brief confirmation pause, dissolve gate
      setTimeout(() => {
        setVisible(false);
        setTimeout(onJoined, 500);
      }, 1200);
    } catch {
      setSubmitting(false);
    }
  }

  const name = profile?.name?.split(' ')[0] ?? 'there';
  const role = profile?.targetRole ?? 'your target role';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            background: 'rgba(6, 11, 20, 0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            style={{
              maxWidth: 520, width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 24, padding: '40px 36px',
            }}
          >
            {gateState === 'prompt' && (
              <>
                <p style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
                  textTransform: 'uppercase', color: '#4b5563', marginBottom: 16,
                }}>
                  Aussie Grad Careers — Free Community
                </p>
                <h2 style={{
                  fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 900,
                  color: '#f3f4f6', lineHeight: 1.2, marginBottom: 20,
                }}>
                  Your diagnosis is ready, {name}.
                </h2>
                <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.75, marginBottom: 28 }}>
                  We've gone through your situation and put together an honest breakdown of
                  what's actually holding back your <strong style={{ color: '#e5e7eb' }}>{role}</strong> search.
                  Before you read it — one quick step.
                </p>
                <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.75, marginBottom: 28 }}>
                  Join the free Aussie Grad Careers community on Skool. It takes 30 seconds
                  and costs nothing. Inside you'll find videos and resources built around
                  exactly the kinds of problems in your report.
                </p>
                <p style={{ fontSize: 15, color: '#e5e7eb', lineHeight: 1.75, marginBottom: 32, fontWeight: 600 }}>
                  Every Friday I run a live call where I go through that week's reports
                  personally. Yours will be in this week's batch. Come with questions — I'll
                  answer them by name.
                </p>
                <a
                  href="https://www.skool.com/aussiegradcareers"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setGateState('email')}
                  style={{
                    display: 'block', textAlign: 'center', textDecoration: 'none',
                    background: 'linear-gradient(135deg, #0F766E, #134E4A)',
                    color: 'white', borderRadius: 14, padding: '15px',
                    fontSize: 16, fontWeight: 800,
                    boxShadow: '0 6px 24px rgba(15,118,110,0.30)',
                    marginBottom: 12,
                  }}
                >
                  Join free on Skool →
                </a>
                <button
                  onClick={() => setGateState('email')}
                  style={{
                    width: '100%', background: 'none',
                    border: '1px solid rgba(255,255,255,0.07)',
                    color: '#4b5563', borderRadius: 12, padding: '11px',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Already a member? Continue →
                </button>
              </>
            )}

            {gateState === 'email' && (
              <>
                <h2 style={{
                  fontSize: 22, fontWeight: 900, color: '#f3f4f6',
                  marginBottom: 12,
                }}>
                  Almost there.
                </h2>
                <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.7, marginBottom: 24 }}>
                  Drop the email you signed up with below so I know to include your report
                  in Friday's discussion.
                </p>
                <input
                  type="email"
                  value={skoolEmail}
                  onChange={e => setSkoolEmail(e.target.value)}
                  placeholder="Email you used on Skool"
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12, color: '#f3f4f6', fontSize: 14,
                    padding: '13px 16px', outline: 'none',
                    marginBottom: 8, boxSizing: 'border-box',
                  }}
                />
                <p style={{ fontSize: 12, color: '#4b5563', marginBottom: 20 }}>
                  Leave blank if it's the same as this account.
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    background: submitting ? 'rgba(15,118,110,0.4)' : 'linear-gradient(135deg, #0F766E, #134E4A)',
                    color: 'white', border: 'none', borderRadius: 14, padding: '15px',
                    fontSize: 15, fontWeight: 800, cursor: submitting ? 'default' : 'pointer',
                  }}
                >
                  {submitting ? 'Saving...' : 'Open my report →'}
                </button>
              </>
            )}

            {gateState === 'success' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: 22, fontWeight: 900, color: '#f3f4f6', marginBottom: 8 }}>
                  You're in.
                </p>
                <p style={{ fontSize: 15, color: '#9ca3af' }}>
                  Opening your report now.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SkoolGate.tsx
git commit -m "feat(ui): SkoolGate component with join flow and blur overlay"
```

---

## Task 6: Wire SkoolGate into ReportOrDashboard

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import SkoolGate**

At the top of `src/App.tsx`, add to the existing component imports section:

```typescript
import { SkoolGate } from './components/SkoolGate';
```

- [ ] **Step 2: Add skoolJoined state and wire gate into ReportOrDashboard**

Find the `ReportOrDashboard` function. Currently the `!reportSeen` branch renders only `<ReportExperience onDone={handleDone} />`. Replace the full `ReportOrDashboard` return with:

```typescript
  const [skoolJoined, setSkoolJoined] = useState(false);

  return (
    <>
      {!reportSeen ? (
        <>
          <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>}>
            <ReportExperience onDone={handleDone} />
          </React.Suspense>
          {!skoolJoined && <SkoolGate onJoined={() => setSkoolJoined(true)} />}
        </>
      ) : (
        <DashboardGate>
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
          >
            <DashboardLayout>
              <React.Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/tracker" element={<ApplicationTracker />} />
                  <Route path="/application-workspace" element={<ApplicationWorkspace />} />
                  <Route path="/workspace" element={<Workspace />} />
                  <Route path="/documents" element={<DocumentLibrary />} />
                  <Route path="/email-templates" element={<EmailTemplatesLibrary />} />
                  <Route path="/linkedin" element={<LinkedInPage />} />
                  <Route path="/jobs" element={<JobFeedPage />} />
                  <Route path="/admin/friday-brief" element={<FridayBriefPage />} />
                  <Route path="*" element={<Dashboard />} />
                </Routes>
              </React.Suspense>
            </DashboardLayout>
          </motion.div>
        </DashboardGate>
      )}
    </>
  );
```

- [ ] **Step 3: Add FridayBriefPage lazy import**

In the lazy imports section at the top of `src/App.tsx`, add:

```typescript
const FridayBriefPage = React.lazy(() =>
  import('./pages/FridayBriefPage').then(m => ({ default: m.FridayBriefPage }))
);
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): wire SkoolGate into report flow, add friday-brief route"
```

---

## Task 7: Friday Call Banner in ReportExperience

**Files:**
- Modify: `src/components/ReportExperience.tsx`

- [ ] **Step 1: Update ReportData interface to include createdAt**

Find the `ReportData` interface near the top of `ReportExperience.tsx`:

```typescript
interface ReportData {
  reportId: string;
  status: string;
  reportMarkdown: string | null;
}
```

Replace with:

```typescript
interface ReportData {
  reportId: string;
  status: string;
  reportMarkdown: string | null;
  createdAt: string | null;
}
```

- [ ] **Step 2: Add window utility function**

After the `extractHook` function, add:

```typescript
/**
 * Returns true if the given ISO date string falls within the current
 * Thursday 19:00 AEST → Thursday 19:00 AEST window.
 * Thursday 19:00 AEST = Thursday 09:00 UTC.
 */
function isInCurrentFridayWindow(createdAtISO: string | null): boolean {
  if (!createdAtISO) return false;
  const created = new Date(createdAtISO).getTime();
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  let daysSince = (day - 4 + 7) % 7;
  if (day === 4 && hour < 9) daysSince = 7;

  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - daysSince);
  windowStart.setUTCHours(9, 0, 0, 0);
  windowStart.setUTCMilliseconds(0);

  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

  return created >= windowStart.getTime() && created < windowEnd.getTime();
}
```

- [ ] **Step 3: Add banner to report content**

Inside `ReportExperience`, after the sections are rendered and the report is in `COMPLETE` status, find the content `<div>` that wraps the sections (around the line that renders the header/eyebrow). Add the banner as the first child inside the content div, just before the header `<motion.div>`:

```typescript
          {/* Friday call banner — only shown for reports in the current weekly window */}
          {isInCurrentFridayWindow(data?.createdAt ?? null) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                background: 'rgba(252,211,77,0.06)',
                border: '1px solid rgba(252,211,77,0.20)',
                borderRadius: 14, padding: '14px 20px',
                marginBottom: 32, textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: 14, color: '#FCD34D', fontWeight: 600 }}>
                Your report is in this Friday's call batch — come with questions. I'll address it personally.
              </p>
            </motion.div>
          )}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ReportExperience.tsx
git commit -m "feat(ui): add Friday call banner to reports in current weekly window"
```

---

## Task 8: FridayBriefPage

**Files:**
- Create: `src/pages/FridayBriefPage.tsx`

- [ ] **Step 1: Create the page**

Create `src/pages/FridayBriefPage.tsx`:

```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface BriefData {
  window: { from: string; to: string };
  reportCount: number;
  cached: boolean;
  script: string | null;
  generatedAt?: string;
}

export function FridayBriefPage() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<BriefData>({
    queryKey: ['friday-brief'],
    queryFn: async () => {
      const { data } = await api.get('/admin/friday-brief');
      return data;
    },
    staleTime: 0,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/friday-brief/generate', {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friday-brief'] });
    },
  });

  function handleCopy() {
    if (!data?.script) return;
    navigator.clipboard.writeText(data.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const windowLabel = data
    ? `${new Date(data.window.from).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} → ${new Date(data.window.to).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
    : '';

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Friday Brief</h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          Weekly call script generated from first-time diagnostic reports.
          {windowLabel && ` Current window: ${windowLabel}.`}
        </p>
      </div>

      {isLoading && (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading...</div>
      )}

      {!isLoading && data && (
        <>
          {/* Stats row */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 28,
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>Reports this week</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{data.reportCount}</p>
            </div>
            {data.cached && data.generatedAt && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>Generated</p>
                <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>
                  {new Date(data.generatedAt).toLocaleString('en-AU')}
                </p>
              </div>
            )}
          </div>

          {/* Script or generate button */}
          {data.script ? (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                    color: copied ? '#34d399' : '#9ca3af', borderRadius: 10, padding: '8px 16px',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy script'}
                </button>
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  style={{
                    background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#6b7280', borderRadius: 10, padding: '8px 16px',
                    fontSize: 13, fontWeight: 600, cursor: generateMutation.isPending ? 'default' : 'pointer',
                  }}
                >
                  {generateMutation.isPending ? 'Regenerating...' : 'Regenerate'}
                </button>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16, padding: '28px 32px',
                whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                fontSize: 15, lineHeight: 1.8, color: '#d1d5db',
              }}>
                {data.script}
              </div>
            </>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: '40px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 24 }}>
                {data.reportCount === 0
                  ? 'No first-time reports in this window yet.'
                  : `${data.reportCount} report${data.reportCount === 1 ? '' : 's'} ready. Generate the call script when you're ready.`}
              </p>
              {data.reportCount > 0 && (
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    color: 'white', border: 'none', borderRadius: 12,
                    padding: '14px 32px', fontSize: 15, fontWeight: 800,
                    cursor: generateMutation.isPending ? 'default' : 'pointer',
                    opacity: generateMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {generateMutation.isPending ? 'Generating...' : 'Generate Friday brief →'}
                </button>
              )}
              {generateMutation.isError && (
                <p style={{ fontSize: 13, color: '#ef4444', marginTop: 16 }}>
                  Generation failed — check the server logs.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/FridayBriefPage.tsx
git commit -m "feat(ui): FridayBriefPage admin page with generate and copy"
```

- [ ] **Step 3: Push everything**

```bash
git push origin master
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Skool gate with blurred background — Task 5 (`backdrop-filter: blur(18px)` overlay)
- [x] Email capture flow — Task 5 (three gate states: prompt → email → success)
- [x] `skoolJoined` + `skoolCommunityEmail` on profile — Task 1
- [x] `POST /api/skool/join` — Task 2
- [x] Friday brief admin page at `/admin/friday-brief` — Tasks 3 + 8
- [x] Thursday 19:00 AEST window boundary — Tasks 3 + 7 (`getCurrentWindow` / `isInCurrentFridayWindow`)
- [x] First-time reports only — Task 3 (`getFirstTimeReportsForWindow`)
- [x] Full spoken script with four sections — Task 3 (`buildBriefPrompt`)
- [x] On-demand generation with cache (upsert on `windowStart`) — Task 3
- [x] Regenerate button — Task 8
- [x] Friday banner in report — Task 7
- [x] Dynamic name + role in gate copy — Task 5

**Type consistency:**
- `SkoolGate` props: `{ onJoined: () => void }` — used correctly in Task 6
- `ReportData.createdAt: string | null` — added in Task 7, served in Task 4
- `FridayBriefPage` uses `BriefData` interface matching Task 3 response shape exactly
- `callClaude(prompt, false)` — correct signature from `server/src/services/llm.ts`
- Window calculation is duplicated in Tasks 3 and 7 (server + client) — intentional, each side owns its own calculation

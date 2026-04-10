# LinkedIn Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth to the auth page, then build a standalone `/linkedin` page covering profile optimisation, outreach templates, AI headshot generation (fal.ai), and a canvas banner editor.

**Architecture:** Phase 1 (OAuth) is two small file changes. Phase 2 adds three new Express endpoints in `server/src/routes/linkedin.ts`, two new rules files, a `src/pages/LinkedInPage.tsx` backed by seven focused components under `src/components/linkedin/`. Nothing in `ApplicationWorkspace` is touched.

**Tech Stack:** React 18, TypeScript, Framer Motion, Tailwind, Express 5, Prisma, `@fal-ai/client`, `html2canvas`, Supabase Auth, `callClaude` via OpenRouter, `multer` (already installed), `vitest` + `supertest` (already installed)

---

## Phase 1 — Google OAuth Fix

---

### Task 1: Add Google OAuth button to AuthPage

**Files:**
- Modify: `src/pages/AuthPage.tsx`

- [ ] **Step 1: Add the Google sign-in handler** — insert this function after `handlePassword` (around line 73):

```typescript
async function handleGoogle() {
  setLoading(true);
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
  } catch (err: any) {
    toast.error(err.message || 'Google sign-in failed');
    setLoading(false);
  }
}
```

- [ ] **Step 2: Add the Google button to the JSX** — insert after the closing `</AnimatePresence>` tag (around line 226) and before the closing `</div>` of the card:

```tsx
<div style={{ marginTop: 20 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
    <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>OR</span>
    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
  </div>
  <button
    onClick={handleGoogle}
    disabled={loading}
    style={{
      width: '100%', padding: '12px 0', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 12, background: 'rgba(255,255,255,0.04)',
      color: '#f1f5f9', fontSize: 15, fontWeight: 600,
      cursor: loading ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      transition: 'background 0.15s',
    }}
  >
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
    </svg>
    Continue with Google
  </button>
</div>
```

- [ ] **Step 3: Enable Google OAuth in Supabase dashboard**

In the Supabase dashboard for this project:
1. Go to **Authentication → Providers → Google**
2. Toggle **Enable**
3. Add your Google OAuth Client ID and Secret (from Google Cloud Console → APIs & Services → Credentials)
4. Set authorised redirect URI in Google Cloud Console to: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
5. Add your Vercel domain and `localhost:5173` to **Supabase → Authentication → URL Configuration → Redirect URLs**

Expected: Google login button appears on `/auth`. Clicking it redirects to Google, then back to the app.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AuthPage.tsx
git commit -m "feat(auth): add Google OAuth sign-in button"
```

---

### Task 2: Handle post-OAuth redirect in OnboardingGate

**Files:**
- Modify: `src/components/OnboardingGate.tsx`

- [ ] **Step 1: Read the file to find where onboarding state is set**

```bash
grep -n "localStorage\|onboarding\|answers\|useEffect" src/components/OnboardingGate.tsx | head -30
```

- [ ] **Step 2: Add localStorage persistence helpers** — add these two functions before the component definition:

```typescript
const PENDING_KEY = 'jobhub_pending_onboarding';

export function savePendingOnboarding(answers: Record<string, any>) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(answers));
}

export function loadPendingOnboarding(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingOnboarding() {
  localStorage.removeItem(PENDING_KEY);
}
```

- [ ] **Step 3: In OnboardingGate's `useEffect` that checks auth/onboarding state, add resume detection** — find the effect that runs after auth loads and add this block at the start:

```typescript
// Detect post-Google-OAuth redirect and restore pending onboarding
const pending = loadPendingOnboarding();
if (pending && user && !profile?.hasCompletedOnboarding) {
  clearPendingOnboarding();
  // Restore answers — OnboardingIntake reads this key if present
  localStorage.setItem('jobhub_restored_onboarding', JSON.stringify(pending));
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/OnboardingGate.tsx
git commit -m "feat(auth): restore pending onboarding answers after Google OAuth redirect"
```

---

## Phase 2 — LinkedIn Hub Backend

---

### Task 3: Add headshot fields to Prisma schema and migrate

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add three fields to `CandidateProfile`** — after the `identityCardsUpdatedAt` line (line ~42):

```prisma
  headshotUrl               String?
  headshotGenerationsToday  Int       @default(0)
  headshotGenerationsDate   DateTime?
```

- [ ] **Step 2: Run migration**

```bash
cd server && npx prisma migrate dev --name add_headshot_fields
```

Expected output: `The following migration(s) have been created and applied`

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd server && npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): add headshot fields to CandidateProfile"
```

---

### Task 4: Install fal.ai client

**Files:**
- Modify: `server/package.json` (via npm)

- [ ] **Step 1: Install the fal.ai SDK**

```bash
cd server && npm install @fal-ai/client
```

Expected: `added 1 package` (or similar), no errors.

- [ ] **Step 2: Add `MAX_DAILY_HEADSHOTS` to server `.env`** — open `server/.env` and add:

```
MAX_DAILY_HEADSHOTS=3
```

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "feat(deps): add @fal-ai/client for headshot generation"
```

---

### Task 5: Write the rate-limit helper with tests

**Files:**
- Create: `server/src/routes/linkedin.ts` (partial — helper + test only in this task)
- Create: `server/src/routes/linkedin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/linkedin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { checkHeadshotRateLimit } from './linkedin';

describe('checkHeadshotRateLimit', () => {
  it('allows generation when no prior usage', () => {
    expect(checkHeadshotRateLimit(0, null, 3)).toEqual({ allowed: true, usedToday: 0 });
  });

  it('allows generation when under limit today', () => {
    expect(checkHeadshotRateLimit(2, new Date(), 3)).toEqual({ allowed: true, usedToday: 2 });
  });

  it('blocks when limit reached today', () => {
    expect(checkHeadshotRateLimit(3, new Date(), 3)).toEqual({ allowed: false, usedToday: 3 });
  });

  it('resets counter when last generation was on a different day', () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    expect(checkHeadshotRateLimit(3, yesterday, 3)).toEqual({ allowed: true, usedToday: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd server && npx vitest run src/routes/linkedin.test.ts
```

Expected: FAIL — `Cannot find module './linkedin'`

- [ ] **Step 3: Create `server/src/routes/linkedin.ts` with just the helper**

```typescript
import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { callClaude } from '../services/llm';
import multer from 'multer';
import * as fal from '@fal-ai/client';
import fs from 'fs';
import path from 'path';

const router = Router();

const MAX_DAILY_HEADSHOTS = parseInt(process.env.MAX_DAILY_HEADSHOTS || '3', 10);
const HEADSHOT_PROMPT =
  'A hyper-realistic headshot portrait of the uploaded image in DSLR-style realism with a soft pastel teal studio background and high quality studio lighting. The result should look clean and professional';

fal.config({ credentials: process.env.FAL_AI_KEY });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are accepted'));
    }
  },
});

function readRules(fileName: string): string {
  try {
    return fs.readFileSync(path.join(__dirname, '../../rules', fileName), 'utf-8');
  } catch {
    return '';
  }
}

/** Pure rate-limit check — exported for testing */
export function checkHeadshotRateLimit(
  storedCount: number,
  lastDate: Date | null,
  limit: number
): { allowed: boolean; usedToday: number } {
  const today = new Date().toDateString();
  const usedToday = lastDate?.toDateString() === today ? storedCount : 0;
  return { allowed: usedToday < limit, usedToday };
}

export default router;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run src/routes/linkedin.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/linkedin.ts server/src/routes/linkedin.test.ts
git commit -m "feat(linkedin): add route scaffold + tested rate-limit helper"
```

---

### Task 6: Implement the three LinkedIn endpoints

**Files:**
- Modify: `server/src/routes/linkedin.ts`

- [ ] **Step 1: Add `POST /generate` endpoint** — append before `export default router`:

```typescript
router.post('/generate', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { targetRole } = req.body as { targetRole?: string };

  try {
    const [profile, diagnostic] = await Promise.all([
      prisma.candidateProfile.findUnique({
        where: { userId },
        include: {
          experience: { orderBy: { startDate: 'desc' }, take: 3 },
          achievements: { take: 15 },
          education: true,
        },
      }),
      prisma.diagnosticReport.findUnique({
        where: { userId },
        select: { reportMarkdown: true },
      }),
    ]);

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const rules = readRules('linkedin_hub_profile_rules.md');

    const prompt = `${rules}

## Candidate Profile
Name: ${profile.name ?? 'Not provided'}
Title/Seniority: ${profile.seniority ?? ''} ${profile.targetRole ?? ''}
Location: ${profile.location ?? 'Not provided'}
Industry: ${profile.industry ?? 'Not provided'}
Skills: ${profile.skills ?? 'Not provided'}

## Work Experience
${profile.experience
  .map(e => `${e.role} at ${e.company} (${e.startDate} – ${e.endDate ?? 'Present'})\n${e.description ?? ''}`)
  .join('\n\n')}

## Top Achievements
${profile.achievements
  .slice(0, 10)
  .map(a => `• ${a.title}: ${a.description}${a.metric ? ` [${a.metric}]` : ''}`)
  .join('\n')}

## Education
${profile.education.map(e => `${e.degree} — ${e.institution}${e.year ? ` (${e.year})` : ''}`).join('\n')}

## Diagnostic Report (first 3000 chars)
${diagnostic?.reportMarkdown?.substring(0, 3000) ?? 'Not available'}

${targetRole ? `## Target Role\nThe candidate is targeting: ${targetRole}` : ''}

Return ONLY valid JSON matching the schema in the rules above.`;

    const { content } = await callClaude(prompt, true);
    return res.json(JSON.parse(content));
  } catch (err: any) {
    console.error('[LinkedIn /generate]', err.message);
    return res.status(500).json({ error: 'Generation failed' });
  }
});
```

- [ ] **Step 2: Add `POST /outreach` endpoint** — append before `export default router`:

```typescript
router.post('/outreach', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { targetFirstName, targetCompany, targetTopicOrPost, specificQuestion } =
    req.body as {
      targetFirstName: string;
      targetCompany: string;
      targetTopicOrPost: string;
      specificQuestion?: string;
    };

  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { name: true, targetRole: true, seniority: true, industry: true, location: true, skills: true },
    });

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const rules = readRules('linkedin_outreach_rules.md');

    const prompt = `${rules}

## Candidate Info (pre-fill into templates)
Name: ${profile.name ?? 'the candidate'}
Background: ${[profile.seniority, profile.industry].filter(Boolean).join(' ')} professional
Targeting: ${profile.targetRole ?? 'roles in their field'}
Location: ${profile.location ?? 'Australia'}
Key Skills: ${profile.skills ?? 'Not provided'}

## Target Person Details
First Name: ${targetFirstName}
Company: ${targetCompany}
What they work on / posted about: ${targetTopicOrPost}
${specificQuestion ? `Specific question candidate wants to ask: ${specificQuestion}` : ''}

Return ONLY valid JSON matching the schema in the rules above.`;

    const { content } = await callClaude(prompt, true);
    return res.json(JSON.parse(content));
  } catch (err: any) {
    console.error('[LinkedIn /outreach]', err.message);
    return res.status(500).json({ error: 'Generation failed' });
  }
});
```

- [ ] **Step 3: Add `POST /headshot` and `POST /headshot/save` endpoints** — append before `export default router`:

```typescript
router.post('/headshot', authenticate, upload.single('image'), async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  if (!req.file) return res.status(400).json({ error: 'No image provided' });

  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { headshotGenerationsToday: true, headshotGenerationsDate: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { allowed, usedToday } = checkHeadshotRateLimit(
      profile.headshotGenerationsToday,
      profile.headshotGenerationsDate,
      MAX_DAILY_HEADSHOTS
    );

    if (!allowed) {
      return res.status(429).json({
        error: 'Daily headshot limit reached',
        remainingToday: 0,
        limit: MAX_DAILY_HEADSHOTS,
      });
    }

    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    const result = await (fal as any).subscribe('fal-ai/photomaker', {
      input: {
        images_data_url: [dataUrl],
        prompt: HEADSHOT_PROMPT,
        style: 'Photographic',
        negative_prompt: 'cartoon, illustration, anime, unrealistic, blurry, low quality',
        num_images: 1,
      },
    });

    const imageUrl: string =
      result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url;
    if (!imageUrl) throw new Error('No image returned from fal.ai');

    const newUsed = usedToday + 1;
    await prisma.candidateProfile.update({
      where: { userId },
      data: { headshotGenerationsToday: newUsed, headshotGenerationsDate: new Date() },
    });

    return res.json({
      imageUrl,
      usedToday: newUsed,
      limit: MAX_DAILY_HEADSHOTS,
      remainingToday: MAX_DAILY_HEADSHOTS - newUsed,
    });
  } catch (err: any) {
    console.error('[LinkedIn /headshot]', err.message);
    return res.status(500).json({ error: 'Headshot generation failed' });
  }
});

router.post('/headshot/save', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { imageUrl } = req.body as { imageUrl: string };
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  try {
    await prisma.candidateProfile.update({ where: { userId }, data: { headshotUrl: imageUrl } });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save headshot' });
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/linkedin.ts
git commit -m "feat(linkedin): implement generate, outreach, and headshot endpoints"
```

---

### Task 7: Register LinkedIn router in index.ts

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Add import** — after the last router import (around line 20):

```typescript
import linkedinRouter from './routes/linkedin';
```

- [ ] **Step 2: Register the route** — after the `feedbackRouter` line (line ~113):

```typescript
app.use('/api/linkedin', linkedinRouter);
```

- [ ] **Step 3: Verify server compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(linkedin): register linkedin router"
```

---

### Task 8: Create `linkedin_hub_profile_rules.md`

**Files:**
- Create: `server/rules/linkedin_hub_profile_rules.md`

- [ ] **Step 1: Create the file**

```markdown
# LinkedIn Hub — Profile Generation Rules

## Purpose
Generate all LinkedIn profile sections plus banner copy as one cohesive output from the candidate's profile data. No job description is used. The output must read as if the same person wrote every section.

## Output JSON Schema (return ONLY this, no other text)

\`\`\`json
{
  "headline": "string — max 220 characters",
  "about": "string — 1800 to 2200 characters",
  "skills": ["skill1", "skill2", "..."], 
  "experienceBullets": ["bullet1", "bullet2", "bullet3"],
  "openToWork": "string — max 150 characters",
  "bannerCopies": [
    {
      "formula": "value-prop",
      "copy": "string — 5 to 12 words",
      "sublineSuggestion": "string — optional proof element, e.g. '3,000+ helped · Forbes'"
    },
    {
      "formula": "bold-positioning",
      "copy": "string — 5 to 12 words",
      "sublineSuggestion": "string or empty"
    },
    {
      "formula": "credibility-offer",
      "copy": "string — 5 to 12 words",
      "sublineSuggestion": "string or empty"
    }
  ]
}
\`\`\`

## Section Rules

### Headline (max 220 chars)
- Lead with current title or target role
- Add 2–3 differentiators using pipe separators: Title | Skill | Outcome
- Do NOT use: "Passionate about", "Results-driven", "Hardworking professional"
- Example: Senior Product Manager | B2B SaaS | Delivered $12M ARR pipeline turnaround

### About (1,800–2,200 chars)
- Hook (1–2 sentences): what you do and who you do it for
- Career narrative (2–3 short paragraphs): key expertise, how you work, what you are known for
- Signature achievements: 2–3 bullets with metrics (use • bullet)
- Call to action: what you are open to / what you want to connect about
- Tone: confident, conversational first person. Not a formal bio.

### Skills (exactly 10 items)
- Most role-relevant skills first
- Mix: technical skills + domain expertise + 1–2 leadership/interpersonal
- Do NOT include: "Communication", "Microsoft Office", "Teamwork"

### Experience Bullets (3–4 items)
- Most recent role only
- Start each with a strong past-tense verb
- Include at least 2 metrics or outcomes across the set
- STAR structure compressed to 1–2 sentences each

### Open to Work Signal (max 150 chars)
- "I am actively exploring [role type] opportunities in [industry/location]. [Brief value prop]."

### Banner Copies (exactly 3, one per formula)
**value-prop formula:** "I help [specific audience] [achieve specific outcome]"
**bold-positioning formula:** "Your [role] shortcut to [big result]" or direct declarative
**credibility-offer formula:** "[Achievement or credential] | Now helping [audience] do the same"

Banner rules:
- 5–12 words maximum — people scan on mobile
- No vague slogans ("Passionate entrepreneur", "Driven professional")
- sublineSuggestion should reference a proof element if the profile has one (metric, credential, publication, etc.)

## Tone and Voice
- First person, active voice
- Confident without arrogance
- Avoid: "passionate", "synergy", "leveraging", "thought leader", "guru", "ninja", "rockstar"
- Australian English spelling throughout
- Sound like a senior professional talking to a peer

## Context Sensitivity
- Government/APS: use policy/stakeholder/evidence-based language; emphasise security clearance if present
- Startup/tech: emphasise ship velocity, ownership, cross-functional collaboration
- Academic/research: include publications signal, research impact
- Senior/executive: lead with business outcomes, P&L, team scale
```

- [ ] **Step 2: Commit**

```bash
git add server/rules/linkedin_hub_profile_rules.md
git commit -m "feat(linkedin): add linkedin_hub_profile_rules.md"
```

---

### Task 9: Create `linkedin_outreach_rules.md`

**Files:**
- Create: `server/rules/linkedin_outreach_rules.md`

- [ ] **Step 1: Create the file**

```markdown
# LinkedIn Outreach Template Generation Rules

## Purpose
Generate four personalised LinkedIn outreach messages by combining the candidate's profile data with the target person's details. Every template must sound like a real person wrote it — specific, warm, never transactional.

## Core Principle
LinkedIn networking is not about asking people for jobs. It is about becoming someone people are glad they know. Every message is a deposit in a relationship account. Withdrawals (job asks) only work once the account has a balance.

## Output JSON Schema (return ONLY this, no other text)

\`\`\`json
{
  "connectionNote": "string — max 300 characters, hard limit",
  "firstMessage": "string — 80 to 120 words",
  "afterCallFollowUp": "string — 50 to 80 words",
  "directAsk": "string — 60 to 90 words",
  "questionSuggestions": ["question1", "question2", "question3"]
}
\`\`\`

## Template Rules

### connectionNote (max 300 chars — platform hard limit)
Formula: Reference something real → one sentence about who you are → reason to connect
- Reference their post, company, role, or something you genuinely noticed
- Say one sentence about who you are and what you are working on
- No ask, no pitch, no job request
- Example: "Hi [Name], I came across your post on [topic] and your point about [specific thing] resonated. I am a [background] currently [what you are doing]. I would love to connect."

### firstMessage (after connection accepted)
Formula: Research signal → low-pressure ask → easy to say no
- Show you have done research on them or their company
- Ask one specific, relevant question — not "pick your brain"
- Reference the candidate's situation briefly
- End with "No pressure at all if the timing is not right."
- A specific question about something they actually know is hard to walk away from

### afterCallFollowUp (send within 24 hours of a call)
Formula: Reference something specific they said → offer reciprocity
- Reference a specific point they made (leave [THEIR_POINT] as a placeholder the user will fill in)
- "I am going to act on it" — shows you were listening
- Plant a seed of reciprocity without being transactional
- Keep it warm, brief, genuine

### directAsk (only after meaningful exchange)
Formula: Context → specific ask for a name or direction → not a job ask
- Do NOT ask for a job
- Ask for a name or a direction — small ask, high likelihood of yes
- "Is there anyone you would suggest I speak with, or any companies worth approaching?"
- Reference that you have been building toward this conversation

### questionSuggestions (3 items)
Generate 3 specific questions the candidate could ask this person based on:
- The target person's company and what they work on
- The candidate's career goals and background
- Questions should be precise and show industry knowledge
- NOT: "What is it like working there?" — too generic
- YES: "What does your team look for when hiring graduates without Australian work experience?" — specific and useful

## Tone
- Human, warm, professional
- Never sycophantic ("Great post!" is invisible)
- Curious, not pushy
- Australian English spelling
```

- [ ] **Step 2: Commit**

```bash
git add server/rules/linkedin_outreach_rules.md
git commit -m "feat(linkedin): add linkedin_outreach_rules.md"
```

---

## Phase 2 — LinkedIn Hub Frontend

---

### Task 10: Install html2canvas and add route + nav item

**Files:**
- Modify: `package.json` (root), `src/App.tsx`, `src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Install html2canvas in the root (client) project**

```bash
cd E:/AntiGravity/JobHub && npm install html2canvas
npm install --save-dev @types/html2canvas
```

Expected: no errors.

- [ ] **Step 2: Add the `/linkedin` route to `src/App.tsx`** — add the import near the top with other page imports:

```typescript
import { LinkedInPage } from './pages/LinkedInPage';
```

Then inside `<Routes>` (after the `/email-templates` route, around line 335):

```tsx
<Route path="/linkedin" element={<LinkedInPage />} />
```

- [ ] **Step 3: Add LinkedIn nav item to `src/layouts/DashboardLayout.tsx`** — add the import at the top:

```typescript
import { LayoutDashboard, FileText, Briefcase, LogOut, User, Sun, Moon, Library, Mail, Linkedin } from 'lucide-react';
```

Then in the `navItems` array, after the `Documents` entry:

```typescript
{ to: '/linkedin', icon: Linkedin, label: 'LinkedIn' },
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/App.tsx src/layouts/DashboardLayout.tsx
git commit -m "feat(linkedin): add route, nav item, and html2canvas dependency"
```

---

### Task 11: Create shared types and SectionCard component

**Files:**
- Create: `src/components/linkedin/types.ts`
- Create: `src/components/linkedin/SectionCard.tsx`

- [ ] **Step 1: Create `src/components/linkedin/types.ts`**

```typescript
export interface BannerCopy {
  formula: 'value-prop' | 'bold-positioning' | 'credibility-offer';
  copy: string;
  sublineSuggestion?: string;
}

export interface LinkedInProfileData {
  headline: string;
  about: string;
  skills: string[];
  experienceBullets: string[];
  openToWork: string;
  bannerCopies: BannerCopy[];
}

export interface OutreachData {
  connectionNote: string;
  firstMessage: string;
  afterCallFollowUp: string;
  directAsk: string;
  questionSuggestions: string[];
}

export interface BannerConfig {
  mainMessage: string;
  subLine: string;
  bgColor: string;
  texture: 'clean' | 'gradient' | 'grid';
}
```

- [ ] **Step 2: Create `src/components/linkedin/SectionCard.tsx`**

```tsx
import React, { useState } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { useAppTheme } from '../../contexts/ThemeContext';

interface Props {
  label: string;
  charLimit?: number;
  charTarget?: string; // e.g. "1,800–2,200"
  content: string;
  onContentChange: (val: string) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  renderContent?: (content: string) => React.ReactNode; // for skills pills etc.
}

export const SectionCard: React.FC<Props> = ({
  label, charLimit, charTarget, content, onContentChange,
  onRegenerate, regenerating, renderContent,
}) => {
  const { T } = useAppTheme();
  const [copied, setCopied] = useState(false);

  const charCount = content.length;
  const overLimit = charLimit ? charCount > charLimit : false;

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.cardBorder}`,
      borderRadius: 16, padding: 24, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textFaint }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(charLimit || charTarget) && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: overLimit ? '#f87171' : T.textFaint,
            }}>
              {charTarget ? `${charCount} / target ${charTarget}` : `${charCount} / ${charLimit}`}
            </span>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={regenerating}
              title="Regenerate this section"
              style={{
                background: 'none', border: 'none', cursor: regenerating ? 'default' : 'pointer',
                color: T.textFaint, padding: 4, borderRadius: 6, display: 'flex',
              }}
            >
              <RefreshCw size={13} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${copied ? '#34d399' : T.cardBorder}`,
              background: copied ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: copied ? '#34d399' : T.textMuted, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {renderContent ? (
        renderContent(content)
      ) : (
        <textarea
          value={content}
          onChange={e => onContentChange(e.target.value)}
          rows={label === 'About' ? 10 : label === 'Experience Bullets' ? 5 : 3}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${overLimit ? '#f87171' : T.cardBorder}`,
            borderRadius: 10, padding: '10px 12px', fontSize: 14,
            color: T.text, resize: 'vertical', lineHeight: 1.6,
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/linkedin/
git commit -m "feat(linkedin): add shared types and SectionCard component"
```

---

### Task 12: ProfileStrip and ProfileSections components

**Files:**
- Create: `src/components/linkedin/ProfileStrip.tsx`
- Create: `src/components/linkedin/ProfileSections.tsx`

- [ ] **Step 1: Create `src/components/linkedin/ProfileStrip.tsx`**

```tsx
import React from 'react';
import { useAppTheme } from '../../contexts/ThemeContext';

interface Props {
  name: string;
  title: string;
  headshotUrl?: string | null;
}

export const ProfileStrip: React.FC<Props> = ({ name, title, headshotUrl }) => {
  const { T } = useAppTheme();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '20px 24px', borderRadius: 16, marginBottom: 24,
      background: T.card, border: `1px solid ${T.cardBorder}`,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: 'linear-gradient(135deg, #0A66C2, #004182)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {headshotUrl
          ? <img src={headshotUrl} alt="Headshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>{name?.[0] ?? '?'}</span>
        }
      </div>
      <div>
        <p style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: 0 }}>{name || 'Your Name'}</p>
        <p style={{ fontSize: 14, color: T.textMuted, margin: '2px 0 0' }}>{title || 'Your Title'}</p>
      </div>
      <div style={{
        marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#0A66C2',
        background: 'rgba(10,102,194,0.1)', padding: '4px 10px', borderRadius: 20,
        border: '1px solid rgba(10,102,194,0.2)',
      }}>
        LinkedIn Preview
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create `src/components/linkedin/ProfileSections.tsx`**

```tsx
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SectionCard } from './SectionCard';
import type { LinkedInProfileData } from './types';

interface Props {
  profileData: LinkedInProfileData | null;
  generating: boolean;
  regeneratingSection: string | null;
  targetRole: string;
  onTargetRoleChange: (val: string) => void;
  onGenerateAll: () => void;
  onSectionChange: (section: keyof Omit<LinkedInProfileData, 'bannerCopies'>, value: string | string[]) => void;
  onRegenerate: (section: string) => void;
}

export const ProfileSections: React.FC<Props> = ({
  profileData, generating, regeneratingSection, targetRole,
  onTargetRoleChange, onGenerateAll, onSectionChange, onRegenerate,
}) => {
  const { T } = useAppTheme();

  return (
    <div>
      {/* Target role input */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textFaint, marginBottom: 8 }}>
          Target Role (optional — sharpens output)
        </label>
        <input
          type="text"
          value={targetRole}
          onChange={e => onTargetRoleChange(e.target.value)}
          placeholder="e.g. Senior Product Manager · B2B SaaS"
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cardBorder}`,
            color: T.text, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Generate All */}
      <button
        onClick={onGenerateAll}
        disabled={generating}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
          background: generating ? 'rgba(10,102,194,0.4)' : '#0A66C2',
          color: 'white', fontSize: 15, fontWeight: 700,
          cursor: generating ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 28, transition: 'background 0.15s',
        }}
      >
        {generating && <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />}
        {generating ? 'Generating your LinkedIn profile…' : (profileData ? '↻ Regenerate All' : 'Generate LinkedIn Profile')}
      </button>

      {profileData && (
        <>
          <SectionCard
            label="Headline"
            charLimit={220}
            content={profileData.headline}
            onContentChange={v => onSectionChange('headline', v)}
            onRegenerate={() => onRegenerate('headline')}
            regenerating={regeneratingSection === 'headline'}
          />
          <SectionCard
            label="About"
            charTarget="1,800–2,200"
            content={profileData.about}
            onContentChange={v => onSectionChange('about', v)}
            onRegenerate={() => onRegenerate('about')}
            regenerating={regeneratingSection === 'about'}
          />
          <SectionCard
            label="Skills"
            content={profileData.skills.join(', ')}
            onContentChange={v => onSectionChange('skills', v.split(',').map(s => s.trim()).filter(Boolean))}
            onRegenerate={() => onRegenerate('skills')}
            regenerating={regeneratingSection === 'skills'}
            renderContent={(content) => (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                {content.split(',').map(s => s.trim()).filter(Boolean).map((skill, i) => (
                  <span key={i} style={{
                    fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                    background: 'rgba(10,102,194,0.12)', color: '#60a5fa',
                    border: '1px solid rgba(10,102,194,0.25)',
                  }}>{skill}</span>
                ))}
              </div>
            )}
          />
          <SectionCard
            label="Experience Bullets (Most Recent Role)"
            content={profileData.experienceBullets.join('\n')}
            onContentChange={v => onSectionChange('experienceBullets', v.split('\n').filter(Boolean))}
            onRegenerate={() => onRegenerate('experienceBullets')}
            regenerating={regeneratingSection === 'experienceBullets'}
          />
          <SectionCard
            label="Open to Work Signal"
            charLimit={150}
            content={profileData.openToWork}
            onContentChange={v => onSectionChange('openToWork', v)}
            onRegenerate={() => onRegenerate('openToWork')}
            regenerating={regeneratingSection === 'openToWork'}
          />
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/linkedin/
git commit -m "feat(linkedin): add ProfileStrip and ProfileSections components"
```

---

### Task 13: BannerCopyPicker and BannerCanvas components

**Files:**
- Create: `src/components/linkedin/BannerCopyPicker.tsx`
- Create: `src/components/linkedin/BannerCanvas.tsx`

- [ ] **Step 1: Create `src/components/linkedin/BannerCopyPicker.tsx`**

```tsx
import React from 'react';
import { useAppTheme } from '../../contexts/ThemeContext';
import type { BannerCopy, BannerConfig } from './types';

const FORMULA_LABELS: Record<BannerCopy['formula'], string> = {
  'value-prop': 'Value Proposition',
  'bold-positioning': 'Bold Positioning',
  'credibility-offer': 'Credibility + Offer',
};

interface Props {
  bannerCopies: BannerCopy[];
  config: BannerConfig;
  onConfigChange: (config: BannerConfig) => void;
  onOpenEditor: () => void;
}

export const BannerCopyPicker: React.FC<Props> = ({
  bannerCopies, config, onConfigChange, onOpenEditor,
}) => {
  const { T } = useAppTheme();
  const wordCount = config.mainMessage.trim().split(/\s+/).filter(Boolean).length;
  const overWords = wordCount > 15;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textFaint, marginBottom: 16 }}>
        Banner Copy
      </p>

      {/* Formula cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {bannerCopies.map((bc) => (
          <button
            key={bc.formula}
            onClick={() => onConfigChange({ ...config, mainMessage: bc.copy, subLine: bc.sublineSuggestion ?? '' })}
            style={{
              textAlign: 'left', padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${config.mainMessage === bc.copy ? '#0A66C2' : T.cardBorder}`,
              background: config.mainMessage === bc.copy ? 'rgba(10,102,194,0.1)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.15s',
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: '#0A66C2', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {FORMULA_LABELS[bc.formula]}
            </p>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>{bc.copy}</p>
            {bc.sublineSuggestion && (
              <p style={{ fontSize: 12, color: T.textMuted, margin: '4px 0 0' }}>{bc.sublineSuggestion}</p>
            )}
          </button>
        ))}
      </div>

      {/* Editable text fields */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textFaint, display: 'block', marginBottom: 6 }}>
          Main Message {overWords && <span style={{ color: '#f87171' }}>({wordCount} words — keep under 12)</span>}
        </label>
        <input
          value={config.mainMessage}
          onChange={e => onConfigChange({ ...config, mainMessage: e.target.value })}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${overWords ? '#f87171' : T.cardBorder}`,
            color: T.text, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textFaint, display: 'block', marginBottom: 6 }}>
          Sub-line (optional — proof element e.g. "Forbes · 3,000+ helped")
        </label>
        <input
          value={config.subLine}
          onChange={e => onConfigChange({ ...config, subLine: e.target.value })}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cardBorder}`,
            color: T.text, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        onClick={onOpenEditor}
        disabled={!config.mainMessage.trim()}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
          background: config.mainMessage.trim() ? '#0A66C2' : 'rgba(10,102,194,0.3)',
          color: 'white', fontWeight: 700, fontSize: 14,
          cursor: config.mainMessage.trim() ? 'pointer' : 'default',
        }}
      >
        Open Banner Editor →
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Create `src/components/linkedin/BannerCanvas.tsx`**

```tsx
import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, X } from 'lucide-react';
import type { BannerConfig } from './types';

const BANNER_W = 1584;
const BANNER_H = 396;
const SCALE = 0.5;

const TEXTURES = {
  clean: '',
  gradient: 'linear-gradient(90deg, rgba(0,0,0,0.3) 0%, transparent 60%)',
  grid: `repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(255,255,255,0.04) 30px, rgba(255,255,255,0.04) 31px),
         repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(255,255,255,0.04) 30px, rgba(255,255,255,0.04) 31px)`,
};

interface Props {
  config: BannerConfig;
  onConfigChange: (c: BannerConfig) => void;
  onClose: () => void;
}

export const BannerCanvas: React.FC<Props> = ({ config, onConfigChange, onClose }) => {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!bannerRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(bannerRef.current, {
        width: BANNER_W,
        height: BANNER_H,
        scale: 1,
        useCORS: true,
        backgroundColor: config.bgColor,
      });
      const link = document.createElement('a');
      link.download = 'linkedin-banner.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  }

  const textureStyle = TEXTURES[config.texture];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>Banner Editor</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: '#0A66C2', color: 'white', fontWeight: 700, fontSize: 13,
              cursor: exporting ? 'default' : 'pointer',
            }}
          >
            <Download size={13} />
            {exporting ? 'Exporting…' : 'Download PNG'}
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 6 }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Colour + texture controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Background
          </label>
          <input
            type="color"
            value={config.bgColor}
            onChange={e => onConfigChange({ ...config, bgColor: e.target.value })}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', padding: 0 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Texture
          </label>
          {(['clean', 'gradient', 'grid'] as const).map(t => (
            <button
              key={t}
              onClick={() => onConfigChange({ ...config, texture: t })}
              style={{
                padding: '5px 12px', borderRadius: 6, border: `1px solid ${config.texture === t ? '#0A66C2' : 'rgba(255,255,255,0.12)'}`,
                background: config.texture === t ? 'rgba(10,102,194,0.15)' : 'transparent',
                color: config.texture === t ? '#60a5fa' : '#64748b',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Preview wrapper — clips the full-size banner to half scale */}
      <div style={{
        width: BANNER_W * SCALE,
        height: BANNER_H * SCALE,
        overflow: 'hidden',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Full-size banner — captured by html2canvas at natural size */}
        <div
          ref={bannerRef}
          style={{
            width: BANNER_W,
            height: BANNER_H,
            transform: `scale(${SCALE})`,
            transformOrigin: 'top left',
            backgroundColor: config.bgColor,
            backgroundImage: textureStyle || undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 80,
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          <div style={{ textAlign: 'right', maxWidth: '60%' }}>
            <p style={{
              fontSize: 56, fontWeight: 900, color: 'white',
              margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em',
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
            }}>
              {config.mainMessage || 'Your Message Here'}
            </p>
            {config.subLine && (
              <p style={{
                fontSize: 28, fontWeight: 600, color: 'rgba(255,255,255,0.75)',
                margin: '16px 0 0', letterSpacing: '0.02em',
              }}>
                {config.subLine}
              </p>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
        Text is locked to the right half — keeps clear of your profile photo on mobile.
      </p>
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/linkedin/
git commit -m "feat(linkedin): add BannerCopyPicker and BannerCanvas components"
```

---

### Task 14: HeadshotGenerator component

**Files:**
- Create: `src/components/linkedin/HeadshotGenerator.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React, { useRef, useState } from 'react';
import { Upload, Loader2, Save, RefreshCw, Camera } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useAppTheme } from '../../contexts/ThemeContext';

interface Props {
  initialHeadshotUrl?: string | null;
  onSaved: (url: string) => void;
}

export const HeadshotGenerator: React.FC<Props> = ({ initialHeadshotUrl, onSaved }) => {
  const { T } = useAppTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<{ usedToday: number; limit: number } | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleGenerate() {
    if (!file || generating) return;
    setGenerating(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/linkedin/headshot', formData);
      setResult(data.imageUrl);
      setUsage({ usedToday: data.usedToday, limit: data.limit });
      toast.success('Headshot generated');
    } catch (err: any) {
      if (err.response?.status === 429) {
        toast.error(`Daily limit reached (${err.response.data.limit}/day). Try again tomorrow.`);
      } else {
        toast.error('Generation failed — try again.');
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!result || saving) return;
    setSaving(true);
    try {
      await api.post('/linkedin/headshot/save', { imageUrl: result });
      onSaved(result);
      toast.success('Headshot saved to profile');
    } catch {
      toast.error('Failed to save — try again.');
    } finally {
      setSaving(false);
    }
  }

  const savedHeadshot = result ?? initialHeadshotUrl;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Camera size={14} color="#0A66C2" />
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textFaint }}>
            AI Headshot
          </span>
        </div>
        {usage && (
          <span style={{ fontSize: 11, fontWeight: 600, color: usage.usedToday >= usage.limit ? '#f87171' : T.textFaint }}>
            {usage.usedToday} / {usage.limit} today
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Upload zone */}
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            width: 140, height: 140, borderRadius: 12, flexShrink: 0,
            border: `2px dashed ${preview ? T.cardBorder : 'rgba(10,102,194,0.4)'}`,
            background: preview ? 'transparent' : 'rgba(10,102,194,0.05)',
            cursor: 'pointer', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {preview
            ? <img src={preview} alt="Upload preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (
              <div style={{ textAlign: 'center', padding: 12 }}>
                <Upload size={24} color="#0A66C2" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, margin: 0 }}>Upload photo</p>
                <p style={{ fontSize: 11, color: T.textFaint, margin: '4px 0 0' }}>JPG, PNG, WebP</p>
              </div>
            )
          }
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>

        {/* Result */}
        <div style={{ flex: 1 }}>
          {savedHeadshot ? (
            <div style={{ position: 'relative', width: 140, height: 140, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <img src={savedHeadshot} alt="Generated headshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <div style={{
              width: 140, height: 140, borderRadius: 12, marginBottom: 12,
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <p style={{ fontSize: 12, color: T.textFaint, textAlign: 'center', padding: 12 }}>
                Generated headshot will appear here
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleGenerate}
              disabled={!file || generating}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 8, border: 'none',
                background: !file || generating ? 'rgba(10,102,194,0.3)' : '#0A66C2',
                color: 'white', fontWeight: 700, fontSize: 13,
                cursor: !file || generating ? 'default' : 'pointer',
              }}
            >
              {generating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
              {generating ? 'Generating…' : result ? 'Try Again' : 'Generate'}
            </button>
            {result && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 8, border: `1px solid ${T.cardBorder}`,
                  background: 'transparent', color: '#34d399', fontWeight: 700, fontSize: 13,
                  cursor: saving ? 'default' : 'pointer',
                }}
              >
                <Save size={13} />
                {saving ? 'Saving…' : 'Save to Profile'}
              </button>
            )}
          </div>
          <p style={{ fontSize: 11, color: T.textFaint, marginTop: 10, lineHeight: 1.5 }}>
            Studio background · professional lighting · DSLR realism
          </p>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/linkedin/HeadshotGenerator.tsx
git commit -m "feat(linkedin): add HeadshotGenerator component"
```

---

### Task 15: OutreachTemplates component

**Files:**
- Create: `src/components/linkedin/OutreachTemplates.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React, { useState } from 'react';
import { Loader2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import type { OutreachData } from './types';

const COACHING_TIPS: Record<keyof Omit<OutreachData, 'questionSuggestions'>, string> = {
  connectionNote: 'The specificity of the reference is what makes it work. Generic openers get ignored.',
  firstMessage: 'A precise question about something they actually know is hard to walk away from.',
  afterCallFollowUp: 'Shows you were paying attention. Plants a seed of reciprocity without being transactional.',
  directAsk: 'Ask for a name or a direction — not a job. Small ask, high likelihood of yes.',
};

const TEMPLATE_LABELS: Record<keyof Omit<OutreachData, 'questionSuggestions'>, string> = {
  connectionNote: 'Connection Request Note',
  firstMessage: 'First Message After Connecting',
  afterCallFollowUp: 'After-Call Follow-Up',
  directAsk: 'Direct Ask for Help',
};

function TemplateCard({ label, content, tip, charLimit, editableNote }: {
  label: string; content: string; tip: string; charLimit?: number; editableNote?: string;
}) {
  const { T } = useAppTheme();
  const [copied, setCopied] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [editedContent, setEditedContent] = useState(content);

  const charCount = editedContent.length;
  const overLimit = charLimit ? charCount > charLimit : false;

  async function handleCopy() {
    await navigator.clipboard.writeText(editedContent);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0A66C2' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {charLimit && (
            <span style={{ fontSize: 11, color: overLimit ? '#f87171' : T.textFaint, fontWeight: 600 }}>
              {charCount} / {charLimit}
            </span>
          )}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${copied ? '#34d399' : T.cardBorder}`,
              background: copied ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: copied ? '#34d399' : T.textMuted, cursor: 'pointer',
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {editableNote && (
        <p style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
          {editableNote}
        </p>
      )}

      <textarea
        value={editedContent}
        onChange={e => setEditedContent(e.target.value)}
        rows={5}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${overLimit ? '#f87171' : T.cardBorder}`,
          borderRadius: 8, padding: '10px 12px', fontSize: 13,
          color: T.text, resize: 'vertical', lineHeight: 1.6,
          fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
        }}
      />

      <button
        onClick={() => setShowTip(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
          color: T.textFaint, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginTop: 8, padding: 0,
        }}
      >
        {showTip ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Coaching tip
      </button>
      {showTip && (
        <p style={{ fontSize: 12, color: T.textMuted, marginTop: 8, lineHeight: 1.6, fontStyle: 'italic', borderLeft: '2px solid rgba(10,102,194,0.4)', paddingLeft: 10 }}>
          {tip}
        </p>
      )}
    </div>
  );
}

export const OutreachTemplates: React.FC = () => {
  const { T } = useAppTheme();
  const [targetFirstName, setTargetFirstName] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [targetTopicOrPost, setTargetTopicOrPost] = useState('');
  const [specificQuestion, setSpecificQuestion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [outreach, setOutreach] = useState<OutreachData | null>(null);
  const [showPlaybook, setShowPlaybook] = useState(false);

  async function handleGenerate() {
    if (!targetFirstName || !targetCompany || !targetTopicOrPost || generating) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/linkedin/outreach', {
        targetFirstName, targetCompany, targetTopicOrPost,
        specificQuestion: specificQuestion || undefined,
      });
      setOutreach(data);
    } catch {
      toast.error('Generation failed — try again.');
    } finally {
      setGenerating(false);
    }
  }

  const inputStyle = (T: any): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cardBorder}`,
    color: T.text, outline: 'none', boxSizing: 'border-box' as const,
  });

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#64748b', display: 'block', marginBottom: 6,
  };

  return (
    <div>
      {/* Playbook guide */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <button
          onClick={() => setShowPlaybook(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            color: T.text, fontWeight: 700, fontSize: 14,
          }}
        >
          Before you start — The 7-Step Networking Playbook
          {showPlaybook ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showPlaybook && (
          <div style={{ marginTop: 16, fontSize: 13, color: T.textMuted, lineHeight: 1.7 }}>
            <p style={{ fontWeight: 700, color: T.text }}>The one mindset shift that makes everything else work:</p>
            <blockquote style={{ borderLeft: '2px solid rgba(10,102,194,0.5)', paddingLeft: 12, margin: '8px 0 16px', fontStyle: 'italic' }}>
              LinkedIn networking is not about asking people for jobs. It is about becoming someone people are glad they know. Give before you ask.
            </blockquote>
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              <li><strong>Find the right people</strong> — target professionals with 400–500 connections who post regularly. Avoid mega-accounts.</li>
              <li><strong>Comment before you connect</strong> — a genuine, specific comment makes you familiar before your request arrives.</li>
              <li><strong>Send a connection note</strong> — reference something real, keep it under 300 characters.</li>
              <li><strong>First message after connecting</strong> — research their company, ask one specific question.</li>
              <li><strong>Have the conversation</strong> — prepare 3 specific questions, listen more than you talk, do not ask for a job.</li>
              <li><strong>Stay on their radar</strong> — thoughtful comments 1–2x/month, share relevant articles.</li>
              <li><strong>Convert to opportunities</strong> — only make a direct ask after at least one meaningful exchange.</li>
            </ol>
          </div>
        )}
      </div>

      {/* Input form */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 16 }}>
          About the person you want to reach
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>First Name</label>
            <input value={targetFirstName} onChange={e => setTargetFirstName(e.target.value)} placeholder="Sarah" style={inputStyle(T)} />
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <input value={targetCompany} onChange={e => setTargetCompany(e.target.value)} placeholder="Atlassian" style={inputStyle(T)} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>What they work on / posted about</label>
          <input
            value={targetTopicOrPost}
            onChange={e => setTargetTopicOrPost(e.target.value)}
            placeholder="e.g. scaling engineering teams in fast-growth startups"
            style={inputStyle(T)}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>A specific question you want to ask (optional)</label>
          <input
            value={specificQuestion}
            onChange={e => setSpecificQuestion(e.target.value)}
            placeholder="e.g. What does your team look for when hiring graduates without AU work experience?"
            style={inputStyle(T)}
          />
          {outreach?.questionSuggestions?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {outreach.questionSuggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setSpecificQuestion(q)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 16,
                    border: '1px solid rgba(10,102,194,0.3)', background: 'rgba(10,102,194,0.08)',
                    color: '#60a5fa', cursor: 'pointer',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          onClick={handleGenerate}
          disabled={!targetFirstName || !targetCompany || !targetTopicOrPost || generating}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
            background: !targetFirstName || !targetCompany || !targetTopicOrPost || generating
              ? 'rgba(10,102,194,0.3)' : '#0A66C2',
            color: 'white', fontWeight: 700, fontSize: 14,
            cursor: (!targetFirstName || !targetCompany || !targetTopicOrPost || generating) ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {generating && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          {generating ? 'Generating templates…' : 'Generate Outreach Templates'}
        </button>
      </div>

      {outreach && (
        <>
          <TemplateCard
            label={TEMPLATE_LABELS.connectionNote}
            content={outreach.connectionNote}
            tip={COACHING_TIPS.connectionNote}
            charLimit={300}
          />
          <TemplateCard
            label={TEMPLATE_LABELS.firstMessage}
            content={outreach.firstMessage}
            tip={COACHING_TIPS.firstMessage}
          />
          <TemplateCard
            label={TEMPLATE_LABELS.afterCallFollowUp}
            content={outreach.afterCallFollowUp}
            tip={COACHING_TIPS.afterCallFollowUp}
            editableNote="Fill in [THEIR_POINT] with something specific they actually said."
          />
          <TemplateCard
            label={TEMPLATE_LABELS.directAsk}
            content={outreach.directAsk}
            tip={COACHING_TIPS.directAsk}
            editableNote="Only use this after at least one meaningful exchange. Do not skip to this."
          />
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/linkedin/OutreachTemplates.tsx
git commit -m "feat(linkedin): add OutreachTemplates component with playbook guide"
```

---

### Task 16: Wire everything into LinkedInPage

**Files:**
- Create: `src/pages/LinkedInPage.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React, { useState } from 'react';
import { toast } from 'sonner';
import { useAppTheme } from '../contexts/ThemeContext';
import api from '../lib/api';
import { ProfileStrip } from '../components/linkedin/ProfileStrip';
import { ProfileSections } from '../components/linkedin/ProfileSections';
import { BannerCopyPicker } from '../components/linkedin/BannerCopyPicker';
import { BannerCanvas } from '../components/linkedin/BannerCanvas';
import { HeadshotGenerator } from '../components/linkedin/HeadshotGenerator';
import { OutreachTemplates } from '../components/linkedin/OutreachTemplates';
import type { LinkedInProfileData, BannerConfig } from '../components/linkedin/types';
import { useProfile } from '../hooks/useProfile';

type Tab = 'profile' | 'outreach';

const DEFAULT_BANNER: BannerConfig = {
  mainMessage: '',
  subLine: '',
  bgColor: '#0F172A',
  texture: 'clean',
};

export const LinkedInPage: React.FC = () => {
  const { T } = useAppTheme();
  const { profile } = useProfile();

  const [tab, setTab] = useState<Tab>('profile');
  const [targetRole, setTargetRole] = useState('');
  const [generating, setGenerating] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<LinkedInProfileData | null>(null);
  const [bannerConfig, setBannerConfig] = useState<BannerConfig>(DEFAULT_BANNER);
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(profile?.headshotUrl ?? null);

  async function handleGenerateAll() {
    if (generating) return;
    setGenerating(true);
    try {
      const { data } = await api.post<LinkedInProfileData>('/linkedin/generate', {
        targetRole: targetRole.trim() || undefined,
      });
      setProfileData(data);
      if (data.bannerCopies?.[0]) {
        setBannerConfig(c => ({
          ...c,
          mainMessage: data.bannerCopies[0].copy,
          subLine: data.bannerCopies[0].sublineSuggestion ?? '',
        }));
      }
      toast.success('LinkedIn profile generated');
    } catch {
      toast.error('Generation failed — try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate(section: string) {
    if (!profileData || regeneratingSection) return;
    setRegeneratingSection(section);
    try {
      const { data } = await api.post<LinkedInProfileData>('/linkedin/generate', {
        targetRole: targetRole.trim() || undefined,
      });
      setProfileData(prev => prev ? { ...prev, [section]: (data as any)[section] } : data);
    } catch {
      toast.error('Regeneration failed — try again.');
    } finally {
      setRegeneratingSection(null);
    }
  }

  function handleSectionChange(
    section: keyof Omit<LinkedInProfileData, 'bannerCopies'>,
    value: string | string[]
  ) {
    setProfileData(prev => prev ? { ...prev, [section]: value } : prev);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: 14,
    background: active ? '#0A66C2' : 'transparent',
    color: active ? 'white' : T.textMuted,
    transition: 'all 0.15s',
  });

  return (
    <div style={{ maxWidth: 740, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: T.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          LinkedIn Hub
        </h1>
        <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>
          Profile · Outreach · Headshot · Banner — one cohesive system
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 14, marginBottom: 28,
        background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cardBorder}`,
        width: 'fit-content',
      }}>
        <button style={tabStyle(tab === 'profile')} onClick={() => setTab('profile')}>Profile</button>
        <button style={tabStyle(tab === 'outreach')} onClick={() => setTab('outreach')}>Outreach</button>
      </div>

      {tab === 'profile' && (
        <>
          <ProfileStrip
            name={profile?.name ?? ''}
            title={profile?.targetRole ?? profile?.seniority ?? ''}
            headshotUrl={headshotUrl}
          />
          <ProfileSections
            profileData={profileData}
            generating={generating}
            regeneratingSection={regeneratingSection}
            targetRole={targetRole}
            onTargetRoleChange={setTargetRole}
            onGenerateAll={handleGenerateAll}
            onSectionChange={handleSectionChange}
            onRegenerate={handleRegenerate}
          />
          {profileData && (
            <>
              {!bannerEditorOpen ? (
                <BannerCopyPicker
                  bannerCopies={profileData.bannerCopies}
                  config={bannerConfig}
                  onConfigChange={setBannerConfig}
                  onOpenEditor={() => setBannerEditorOpen(true)}
                />
              ) : (
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 16 }}>
                  <BannerCanvas
                    config={bannerConfig}
                    onConfigChange={setBannerConfig}
                    onClose={() => setBannerEditorOpen(false)}
                  />
                </div>
              )}
              <HeadshotGenerator
                initialHeadshotUrl={headshotUrl}
                onSaved={setHeadshotUrl}
              />
            </>
          )}
        </>
      )}

      {tab === 'outreach' && <OutreachTemplates />}
    </div>
  );
};
```

- [ ] **Step 2: Check if `useProfile` hook exists and how it returns `headshotUrl`**

```bash
grep -n "useProfile\|headshotUrl" src/hooks/useProfile.ts 2>/dev/null || grep -rn "useProfile" src/ | head -10
```

If `headshotUrl` is not on the profile type yet, add it to the type wherever the profile type is defined (likely `src/types/index.ts`):

```typescript
headshotUrl?: string | null;
```

- [ ] **Step 3: Verify the app builds without errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: `built in Xs` with no TypeScript errors. Fix any type errors before committing.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LinkedInPage.tsx src/types/index.ts
git commit -m "feat(linkedin): wire all components into LinkedInPage"
```

---

### Task 17: Smoke test the full flow

- [ ] **Step 1: Start the dev server pair**

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
npm run dev
```

- [ ] **Step 2: Verify backend endpoints are reachable (with DEV_BYPASS_AUTH=true)**

```bash
curl -X POST http://localhost:3002/api/linkedin/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev" \
  -d '{"targetRole": "Product Manager"}' | head -c 200
```

Expected: JSON with `headline`, `about`, `skills`, `experienceBullets`, `openToWork`, `bannerCopies` keys.

```bash
curl -X POST http://localhost:3002/api/linkedin/outreach \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev" \
  -d '{"targetFirstName":"Sarah","targetCompany":"Atlassian","targetTopicOrPost":"scaling engineering teams"}' | head -c 200
```

Expected: JSON with `connectionNote`, `firstMessage`, `afterCallFollowUp`, `directAsk`, `questionSuggestions` keys.

- [ ] **Step 3: Verify the LinkedIn page loads in the browser**

Navigate to `http://localhost:5173/linkedin`. Confirm:
- Profile tab visible with "Generate LinkedIn Profile" button
- Outreach tab visible with input form
- LinkedIn nav item in sidebar

- [ ] **Step 4: Run the backend unit tests**

```bash
cd server && npx vitest run src/routes/linkedin.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(linkedin): LinkedIn Hub complete — profile, outreach, headshot, banner"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Google OAuth button on AuthPage — Task 1
- [x] OnboardingGate redirect handling — Task 2
- [x] Headshot DB fields — Task 3
- [x] fal.ai SDK installed — Task 4
- [x] Rate-limit helper tested — Task 5
- [x] Three backend endpoints — Task 6
- [x] Routes registered — Task 7
- [x] `linkedin_hub_profile_rules.md` (profile-based, no JD) — Task 8
- [x] `linkedin_outreach_rules.md` with 4 template schemas — Task 9
- [x] html2canvas installed + route + nav — Task 10
- [x] Shared types + SectionCard with copy + regenerate — Task 11
- [x] ProfileStrip + ProfileSections — Task 12
- [x] BannerCopyPicker (text edit before canvas) + BannerCanvas (download PNG) — Task 13
- [x] HeadshotGenerator (upload, generate, save, rate limit display) — Task 14
- [x] OutreachTemplates with 4 cards + playbook guide + question suggestions — Task 15
- [x] LinkedInPage wired — Task 16
- [x] Smoke tests — Task 17
- [x] `ApplicationWorkspace.tsx` untouched — confirmed (no task modifies it)
- [x] `linkedin_profile_rules.md` untouched — confirmed (new file created instead)

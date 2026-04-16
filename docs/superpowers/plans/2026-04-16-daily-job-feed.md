# Daily Job Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily job feed that surfaces 10 curated jobs per day from Adzuna, with skimmable AI-generated bullets, on-demand match scoring, a SerpAPI-powered cover letter addressee suggestion, and a "Generate documents" shortcut into the existing MatchEngine flow.

**Architecture:** Adzuna fetches 100 jobs/user/day stored in `JobFeedItem`. Frontend serves 10 at a time. Bullets are LLM-batched on first load. Scoring reuses existing analysis logic via a shared service. Addressee is a non-blocking SerpAPI search on card expand. Document generation writes the JD to localStorage and navigates to the Dashboard MatchEngine.

**Tech Stack:** Adzuna REST API, SerpAPI Google Search, `axios` (already installed), `node-cron` (new), existing `callLLM`/`callLLMWithRetry`, Prisma/PostgreSQL, React + TanStack Query + Framer Motion.

> **Route note:** The new routes are registered at `/api/job-feed` (not `/api/jobs`) to avoid conflicting with the existing job application tracker routes at `server/src/routes/profile/jobs.ts` which already occupy `GET/POST/PATCH/DELETE /api/jobs`.

---

## File Map

**Create:**
- `server/src/services/jobFeed.ts` — Adzuna fetch, bullet generation, `buildDailyFeed`, `findAddressee`
- `server/src/services/jobAnalysis.ts` — extracted score-a-job logic (shared between analyze route and feed)
- `server/src/routes/job-feed.ts` — 5 route handlers
- `server/src/cron/jobFeedCron.ts` — daily 7am AEST cron
- `server/prisma/migrations/20260416000001_add_job_feed_item/migration.sql` — DB migration
- `src/components/jobs/JobCard.tsx` — individual job card (collapsed + expanded)
- `src/pages/JobFeedPage.tsx` — page wrapper with state + pagination

**Modify:**
- `server/prisma/schema.prisma` — add `JobFeedItem` model + relation
- `server/src/index.ts` — register `/api/job-feed` route, start cron
- `server/package.json` — add `node-cron` + `@types/node-cron`
- `src/layouts/DashboardLayout.tsx` — add Job Feed nav item
- `src/App.tsx` — add lazy import + route + Dashboard widget query

---

## Task 1: DB Schema + Migration

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20260416000001_add_job_feed_item/migration.sql`

- [ ] **Step 1: Add `JobFeedItem` model to schema**

Open `server/prisma/schema.prisma`. Add after the `JobApplication` model (around line 176):

```prisma
model JobFeedItem {
  id                   String           @id @default(uuid())
  userId               String
  feedDate             DateTime         @db.Date
  title                String
  company              String
  location             String?
  salary               String?
  description          String
  bullets              Json?
  sourceUrl            String
  sourcePlatform       String
  postedAt             DateTime?
  suggestedAddressee   String?
  addresseeTitle       String?
  addresseeConfidence  String?
  addresseeSource      String?
  matchScore           Int?
  matchDetails         Json?
  isRead               Boolean          @default(false)
  isSaved              Boolean          @default(false)
  createdAt            DateTime         @default(now())
  candidateProfile     CandidateProfile @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([userId, feedDate])
}
```

Also add `jobFeedItems JobFeedItem[]` to the `CandidateProfile` model's relations block (after the existing `jobApplications JobApplication[]` line).

- [ ] **Step 2: Create the migration SQL file**

Create directory `server/prisma/migrations/20260416000001_add_job_feed_item/` and inside it create `migration.sql`:

```sql
CREATE TABLE "JobFeedItem" (
  "id"                  TEXT NOT NULL,
  "userId"              TEXT NOT NULL,
  "feedDate"            DATE NOT NULL,
  "title"               TEXT NOT NULL,
  "company"             TEXT NOT NULL,
  "location"            TEXT,
  "salary"              TEXT,
  "description"         TEXT NOT NULL,
  "bullets"             JSONB,
  "sourceUrl"           TEXT NOT NULL,
  "sourcePlatform"      TEXT NOT NULL,
  "postedAt"            TIMESTAMP(3),
  "suggestedAddressee"  TEXT,
  "addresseeTitle"      TEXT,
  "addresseeConfidence" TEXT,
  "addresseeSource"     TEXT,
  "matchScore"          INTEGER,
  "matchDetails"        JSONB,
  "isRead"              BOOLEAN NOT NULL DEFAULT false,
  "isSaved"             BOOLEAN NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobFeedItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobFeedItem_userId_feedDate_idx" ON "JobFeedItem"("userId", "feedDate");

ALTER TABLE "JobFeedItem"
  ADD CONSTRAINT "JobFeedItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "CandidateProfile"("userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd server && npx prisma generate
```

Expected: `Generated Prisma Client` — no errors.

- [ ] **Step 4: Install node-cron**

```bash
cd server && npm install node-cron && npm install -D @types/node-cron
```

Expected: both packages appear in `server/package.json` dependencies.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/20260416000001_add_job_feed_item/migration.sql server/package.json server/package-lock.json
git commit -m "feat(db): add JobFeedItem table for daily job feed"
```

---

## Task 2: Adzuna Fetch + Daily Feed Service

**Files:**
- Create: `server/src/services/jobFeed.ts`

- [ ] **Step 1: Create the service file**

Create `server/src/services/jobFeed.ts`:

```typescript
import axios from 'axios';
import { prisma } from '../index';
import { callLLM } from './llm';
import { parseLLMJson } from '../utils/parseLLMResponse';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RawJob {
  title: string;
  company: string;
  location: string;
  salary: string | null;
  description: string;
  sourceUrl: string;
  sourcePlatform: string;
  postedAt: Date | null;
}

export interface AddresseeSuggestion {
  name: string;
  title: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'job-listing' | 'web-search';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractPlatform(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('seek.com.au')) return 'seek';
    if (host.includes('indeed.com')) return 'indeed';
    if (host.includes('jora.com')) return 'jora';
    if (host.includes('linkedin.com')) return 'linkedin';
    if (host.includes('adzuna.com')) return 'other';
    return 'other';
  } catch {
    return 'other';
  }
}

function formatSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  if (min && max) return `$${Math.round(min / 1000)}k–$${Math.round(max / 1000)}k`;
  if (min) return `From $${Math.round(min / 1000)}k`;
  if (max) return `Up to $${Math.round(max / 1000)}k`;
  return null;
}

/** Returns today's date in AEST (UTC+10) as a JS Date at midnight UTC */
export function todayAEST(): Date {
  const s = new Date(Date.now() + 10 * 3600 * 1000).toISOString().slice(0, 10);
  return new Date(s + 'T00:00:00.000Z');
}

// ─── Adzuna fetch ─────────────────────────────────────────────────────────────

export async function fetchAdzunaJobs(role: string, city: string): Promise<RawJob[]> {
  const APP_ID = process.env.ADZUNA_APP_ID;
  const APP_KEY = process.env.ADZUNA_APP_KEY;
  if (!APP_ID || !APP_KEY) throw new Error('Adzuna credentials not configured');

  const base = 'https://api.adzuna.com/v1/api/jobs/au/search';
  const params = {
    app_id: APP_ID,
    app_key: APP_KEY,
    what: role,
    where: city,
    results_per_page: 50,
    'content-type': 'application/json',
  };

  const [page1, page2] = await Promise.all([
    axios.get(`${base}/1`, { params }).catch(() => null),
    axios.get(`${base}/2`, { params }).catch(() => null),
  ]);

  const raw: any[] = [
    ...(page1?.data?.results ?? []),
    ...(page2?.data?.results ?? []),
  ];

  const seen = new Set<string>();
  const jobs: RawJob[] = [];

  for (const r of raw) {
    const url: string = r.redirect_url ?? '';
    if (!url || seen.has(url)) continue;
    seen.add(url);

    jobs.push({
      title: r.title ?? 'Untitled',
      company: r.company?.display_name ?? 'Unknown Company',
      location: r.location?.display_name ?? city,
      salary: formatSalary(r.salary_min, r.salary_max),
      description: r.description ?? '',
      sourceUrl: url,
      sourcePlatform: extractPlatform(url),
      postedAt: r.created ? new Date(r.created) : null,
    });
  }

  return jobs;
}

// ─── Bullet generation ────────────────────────────────────────────────────────

export async function generateBullets(jobs: RawJob[]): Promise<(string[] | null)[]> {
  if (jobs.length === 0) return [];

  const input = jobs.map(j => ({
    title: j.title,
    company: j.company,
    description: j.description.slice(0, 800),
  }));

  const prompt = `For each job below, write exactly 3-5 bullet points that help a job seeker quickly assess fit.
Cover: role type, team/company context, key requirements, work arrangement/location, and anything
notable (salary, government role, selection criteria likely required, etc.).
Each bullet is one short plain-text sentence. No markdown, no dashes, no asterisks.

Return a JSON array of arrays: [[bullet, bullet, ...], ...]  — same order as input.

Jobs:
${JSON.stringify(input)}`;

  try {
    const raw = await callLLM(prompt, true);
    const parsed = parseLLMJson(raw);
    if (!Array.isArray(parsed)) return jobs.map(() => null);
    return parsed.map((b: any) => (Array.isArray(b) ? b : null));
  } catch {
    return jobs.map(() => null);
  }
}

// ─── Build daily feed ─────────────────────────────────────────────────────────

export async function buildDailyFeed(userId: string): Promise<void> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { targetRole: true, targetCity: true },
  });

  if (!profile?.targetRole || !profile?.targetCity) {
    throw new Error('Profile incomplete — set a target role and city first');
  }

  const jobs = await fetchAdzunaJobs(profile.targetRole, profile.targetCity);
  const today = todayAEST();

  // Idempotent: clear today's existing rows first
  await prisma.jobFeedItem.deleteMany({ where: { userId, feedDate: today } });

  if (jobs.length === 0) return;

  await prisma.jobFeedItem.createMany({
    data: jobs.map(j => ({
      userId,
      feedDate: today,
      title: j.title,
      company: j.company,
      location: j.location,
      salary: j.salary,
      description: j.description,
      sourceUrl: j.sourceUrl,
      sourcePlatform: j.sourcePlatform,
      postedAt: j.postedAt,
    })),
  });
}

// ─── SerpAPI addressee search ─────────────────────────────────────────────────

export async function findAddressee(
  company: string,
  role: string,
  description: string
): Promise<AddresseeSuggestion | null> {

  // Step 1: Scan description for explicit contact
  const patterns = [
    /contact\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
    /address\s+(?:your\s+)?(?:application|enquiries)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /enquiries\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /queries\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /speak\s+(?:to|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match?.[1]) {
      // Try to grab a title near the name
      const titleMatch = description.match(
        new RegExp(`${match[1].replace(/\s/g, '\\s+')}[,\\s]+([A-Za-z ]+?(?:Manager|Director|Head|Officer|Lead|Coordinator))`, 'i')
      );
      return {
        name: match[1],
        title: titleMatch?.[1]?.trim() ?? '',
        confidence: 'high',
        source: 'job-listing',
      };
    }
  }

  // Step 2: SerpAPI search
  const SERPAPI_KEY = process.env.SERPAPI_KEY;
  if (!SERPAPI_KEY) return null;

  try {
    const query = `"${company}" hiring manager OR "head of" OR founder site:linkedin.com`;
    const resp = await axios.get('https://serpapi.com/search', {
      params: { engine: 'google', q: query, api_key: SERPAPI_KEY, num: 5 },
      timeout: 8000,
    });

    const results: any[] = resp.data?.organic_results ?? [];

    // Small company signals in description
    const smallSignals = /startup|small team|our team of [1-9]\b|family business|directly with the founder/i.test(description);

    const titlePatterns = [
      /\b(CEO|Founder|Co-Founder|Managing Director)\b/i,
      /\b(Head of [A-Za-z ]+|[A-Za-z]+ Manager|HR Manager|Talent Acquisition|Recruiter)\b/i,
    ];

    for (const result of results) {
      const text = `${result.title ?? ''} ${result.snippet ?? ''}`;

      // Extract person name (two capitalised words)
      const nameMatch = text.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
      if (!nameMatch?.[1]) continue;

      // Extract title
      let foundTitle = '';
      let confidence: 'medium' | 'low' = 'low';

      for (let i = 0; i < titlePatterns.length; i++) {
        const tm = text.match(titlePatterns[i]);
        if (tm?.[1]) {
          foundTitle = tm[1];
          confidence = i === 0 && smallSignals ? 'medium' : 'medium';
          break;
        }
      }

      if (!foundTitle) continue; // Skip results with no recognisable title

      return {
        name: nameMatch[1],
        title: foundTitle,
        confidence,
        source: 'web-search',
      };
    }
  } catch {
    // SerpAPI failure is always silent
  }

  return null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors referencing `jobFeed.ts`. Fix any type errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/jobFeed.ts
git commit -m "feat(service): Adzuna fetch, bullet generation, buildDailyFeed, findAddressee"
```

---

## Task 3: Job Analysis Service (Shared Scorer)

**Files:**
- Create: `server/src/services/jobAnalysis.ts`

This extracts the core scoring logic from `server/src/routes/analyze.ts` into a reusable function, used by both the existing analyze route (future) and the new job-feed score route.

- [ ] **Step 1: Create `server/src/services/jobAnalysis.ts`**

```typescript
import { prisma } from '../index';
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { JOB_ANALYSIS_PROMPT } from './prompts';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { searchAchievements } from './vector';
import { addGrades, computeComposite } from './compositeScoring';

export interface FeedScoreResult {
  matchScore: number;
  matchDetails: {
    overallGrade?: string;
    dimensions?: Record<string, any>;
    keywords?: string[];
    gaps?: string[];
    summary?: string;
  };
}

export async function scoreJobForFeed(
  userId: string,
  jobDescription: string
): Promise<FeedScoreResult> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId } as any,
    include: { achievements: true },
  }) as any;

  if (!profile) throw new Error('Profile not found');

  let parsedSkills = { technical: [], industryKnowledge: [], softSkills: [] };
  try {
    parsedSkills =
      typeof profile.skills === 'string'
        ? JSON.parse(profile.skills)
        : profile.skills || parsedSkills;
  } catch {
    /* use defaults */
  }

  let matches: any[] = [];
  try {
    matches = await searchAchievements(userId, jobDescription, 12);
  } catch {
    /* Pinecone optional */
  }

  const achievementsText =
    matches.length > 0
      ? matches
          .map((m: any) => {
            const meta = m.metadata || {};
            return `ID: ${m.id} | Title: ${meta.title || ''} | Text: ${meta.text || ''} | Metric: ${meta.metric || 'N/A'}`;
          })
          .join('\n---\n')
      : 'No achievements found in the bank.';

  const identityCards: Array<{ label: string; summary: string }> = Array.isArray(
    profile.identityCards
  )
    ? profile.identityCards
    : [];

  const prompt = JOB_ANALYSIS_PROMPT(
    jobDescription,
    { ...profile, skills: parsedSkills },
    achievementsText,
    identityCards
  );

  const raw = await callLLMWithRetry(prompt, true);
  const analysis = parseLLMJson(raw);

  let matchScore: number = analysis.matchScore ?? 50;
  let overallGrade: string | undefined;
  let dimensions: Record<string, any> | undefined;

  if (analysis.dimensions && typeof analysis.dimensions === 'object') {
    try {
      dimensions = addGrades(analysis.dimensions);
      const composite = computeComposite(dimensions as any);
      overallGrade = composite.overallGrade;
      matchScore = composite.matchScore;
    } catch {
      /* use raw score */
    }
  }

  return {
    matchScore,
    matchDetails: {
      overallGrade,
      dimensions,
      keywords: analysis.keywords ?? [],
      gaps: analysis.gaps ?? [],
      summary: analysis.summary ?? '',
    },
  };
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd server && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/jobAnalysis.ts
git commit -m "feat(service): extract scoreJobForFeed for shared job scoring"
```

---

## Task 4: Backend Routes

**Files:**
- Create: `server/src/routes/job-feed.ts`

- [ ] **Step 1: Create `server/src/routes/job-feed.ts`**

```typescript
import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { analyzeRateLimit } from '../middleware/analyzeRateLimit';
import {
  buildDailyFeed,
  generateBullets,
  findAddressee,
  todayAEST,
  type RawJob,
} from '../services/jobFeed';
import { scoreJobForFeed } from '../services/jobAnalysis';

const router = Router();

// All routes require auth
router.use(authenticate);

// Helper: check dashboardAccess
async function requirePremium(userId: string, res: any): Promise<boolean> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { dashboardAccess: true },
  });
  if (!profile?.dashboardAccess) {
    res.status(403).json({ error: 'Premium access required' });
    return false;
  }
  return true;
}

// GET /api/job-feed/feed?offset=0
router.get('/feed', async (req: any, res: any) => {
  const userId = req.user.id;
  if (!(await requirePremium(userId, res))) return;

  const offset = parseInt((req.query.offset as string) || '0', 10);
  const today = todayAEST();

  try {
    // Lazy fetch if no jobs for today
    const count = await prisma.jobFeedItem.count({ where: { userId, feedDate: today } });
    if (count === 0) {
      try {
        await buildDailyFeed(userId);
      } catch (err: any) {
        // Profile incomplete — surface message but don't 500
        if (err.message?.includes('Profile incomplete')) {
          return res.json({ jobs: [], total: 0, hasMore: false, feedDate: today.toISOString().slice(0, 10), profileIncomplete: true });
        }
        throw err;
      }
    }

    const total = await prisma.jobFeedItem.count({ where: { userId, feedDate: today } });
    const items = await prisma.jobFeedItem.findMany({
      where: { userId, feedDate: today },
      orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
      skip: offset,
      take: 10,
    });

    // Generate bullets for any items that don't have them
    const nullBulletItems = items.filter(i => i.bullets === null);
    if (nullBulletItems.length > 0) {
      const rawJobs = nullBulletItems.map(i => ({
        title: i.title,
        company: i.company,
        location: i.location ?? '',
        salary: i.salary,
        description: i.description,
        sourceUrl: i.sourceUrl,
        sourcePlatform: i.sourcePlatform,
        postedAt: i.postedAt,
      })) as RawJob[];

      const bulletArrays = await generateBullets(rawJobs);

      await Promise.all(
        nullBulletItems.map((item, idx) =>
          bulletArrays[idx]
            ? prisma.jobFeedItem.update({
                where: { id: item.id },
                data: { bullets: bulletArrays[idx] },
              })
            : Promise.resolve()
        )
      );

      // Merge generated bullets into response
      for (const item of items) {
        const idx = nullBulletItems.findIndex(n => n.id === item.id);
        if (idx !== -1 && bulletArrays[idx]) {
          (item as any).bullets = bulletArrays[idx];
        }
      }
    }

    // Mark as read (fire and forget)
    prisma.jobFeedItem
      .updateMany({
        where: { id: { in: items.map(i => i.id) } },
        data: { isRead: true },
      })
      .catch(() => {/* silent */});

    return res.json({
      jobs: items,
      total,
      hasMore: offset + items.length < total,
      feedDate: today.toISOString().slice(0, 10),
    });
  } catch (err: any) {
    console.error('[job-feed/feed]', err);
    return res.status(500).json({ error: 'Failed to load job feed' });
  }
});

// POST /api/job-feed/refresh
router.post('/refresh', async (req: any, res: any) => {
  const userId = req.user.id;
  if (!(await requirePremium(userId, res))) return;

  const today = todayAEST();

  try {
    const newest = await prisma.jobFeedItem.findFirst({
      where: { userId, feedDate: today },
      orderBy: { createdAt: 'desc' },
    });

    if (newest) {
      const ageSeconds = Math.floor((Date.now() - newest.createdAt.getTime()) / 1000);
      if (ageSeconds < 3600) {
        return res.status(400).json({
          error: 'Feed refreshed recently. Try again later.',
          retryAfter: 3600 - ageSeconds,
        });
      }
    }

    await buildDailyFeed(userId);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[job-feed/refresh]', err);
    return res.status(500).json({ error: 'Failed to refresh feed' });
  }
});

// POST /api/job-feed/:id/score
router.post('/:id/score', analyzeRateLimit, async (req: any, res: any) => {
  const userId = req.user.id;
  if (!(await requirePremium(userId, res))) return;

  const { id } = req.params;

  try {
    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    if (item.matchScore !== null) {
      return res.json({ matchScore: item.matchScore, matchDetails: item.matchDetails });
    }

    const result = await scoreJobForFeed(userId, item.description);

    await prisma.jobFeedItem.update({
      where: { id },
      data: { matchScore: result.matchScore, matchDetails: result.matchDetails as any },
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[job-feed/score]', err);
    return res.status(500).json({ error: 'Scoring failed — try again shortly.' });
  }
});

// POST /api/job-feed/:id/find-addressee
router.post('/:id/find-addressee', async (req: any, res: any) => {
  const userId = req.user.id;
  if (!(await requirePremium(userId, res))) return;

  const { id } = req.params;

  try {
    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    // Return cached if already searched (addresseeSource is set even when no name found)
    if (item.addresseeSource !== null) {
      return res.json({
        suggestedAddressee: item.suggestedAddressee,
        addresseeTitle: item.addresseeTitle,
        addresseeConfidence: item.addresseeConfidence,
        addresseeSource: item.addresseeSource,
      });
    }

    const suggestion = await findAddressee(item.company, item.title, item.description);

    const update = suggestion
      ? {
          suggestedAddressee: suggestion.name,
          addresseeTitle: suggestion.title,
          addresseeConfidence: suggestion.confidence,
          addresseeSource: suggestion.source,
        }
      : {
          // Store empty string as sentinel so we don't re-search next time
          suggestedAddressee: '',
          addresseeTitle: '',
          addresseeConfidence: 'low' as const,
          addresseeSource: 'web-search' as const,
        };

    await prisma.jobFeedItem.update({ where: { id }, data: update });

    return res.json({
      suggestedAddressee: suggestion?.name ?? null,
      addresseeTitle: suggestion?.title ?? null,
      addresseeConfidence: suggestion?.confidence ?? null,
      addresseeSource: suggestion?.source ?? null,
    });
  } catch (err: any) {
    console.error('[job-feed/find-addressee]', err);
    return res.json({
      suggestedAddressee: null,
      addresseeTitle: null,
      addresseeConfidence: null,
      addresseeSource: null,
    });
  }
});

// POST /api/job-feed/:id/save
router.post('/:id/save', async (req: any, res: any) => {
  const userId = req.user.id;
  if (!(await requirePremium(userId, res))) return;

  const { id } = req.params;

  try {
    const item = await prisma.jobFeedItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) return res.status(404).json({ error: 'Not found' });

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const jobApp = await prisma.jobApplication.create({
      data: {
        userId,
        candidateProfileId: profile.id,
        title: item.title,
        company: item.company,
        description: item.description,
        notes: `Source: ${item.sourceUrl}`,
        status: 'SAVED',
      },
    });

    await prisma.jobFeedItem.update({ where: { id }, data: { isSaved: true } });

    return res.json({ jobApplicationId: jobApp.id });
  } catch (err: any) {
    console.error('[job-feed/save]', err);
    return res.status(500).json({ error: 'Failed to save job' });
  }
});

export default router;
```

- [ ] **Step 2: Verify compilation**

```bash
cd server && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/job-feed.ts
git commit -m "feat(routes): add /api/job-feed routes (feed, refresh, score, find-addressee, save)"
```

---

## Task 5: Cron Job + Server Wiring

**Files:**
- Create: `server/src/cron/jobFeedCron.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create the cron file**

Create `server/src/cron/jobFeedCron.ts`:

```typescript
import cron from 'node-cron';
import { prisma } from '../index';
import { buildDailyFeed } from '../services/jobFeed';

// 21:00 UTC daily = 7:00 AEST
export function startJobFeedCron(): void {
  cron.schedule('0 21 * * *', async () => {
    console.log('[jobFeedCron] Starting daily feed pre-fetch');

    let users: { userId: string }[] = [];
    try {
      users = await prisma.candidateProfile.findMany({
        where: { dashboardAccess: true, hasCompletedOnboarding: true },
        select: { userId: true },
      });
    } catch (err) {
      console.error('[jobFeedCron] Failed to load users:', err);
      return;
    }

    console.log(`[jobFeedCron] Pre-fetching for ${users.length} users`);

    for (const { userId } of users) {
      try {
        await buildDailyFeed(userId);
        console.log(`[jobFeedCron] ✓ ${userId}`);
      } catch (err: any) {
        console.error(`[jobFeedCron] ✗ ${userId}:`, err.message);
      }
    }

    console.log('[jobFeedCron] Complete');
  });
}
```

- [ ] **Step 2: Register route and start cron in `server/src/index.ts`**

In `server/src/index.ts`:

After line 22 (`import webhooksRouter from './routes/webhooks';`), add:
```typescript
import jobFeedRouter from './routes/job-feed';
import { startJobFeedCron } from './cron/jobFeedCron';
```

After line 123 (`app.use('/api/webhooks', webhooksRouter);`), add:
```typescript
app.use('/api/job-feed', jobFeedRouter);
```

After line 138 (`app.listen(PORT, () => {`), before the closing `});`, add:
```typescript
    startJobFeedCron();
    console.log('[cron] Job feed cron scheduled (21:00 UTC daily)');
```

The `app.listen` block should now look like:
```typescript
app.listen(PORT, () => {
    console.log(`Job Ready Backend running on http://localhost:${PORT}`);
    startJobFeedCron();
    console.log('[cron] Job feed cron scheduled (21:00 UTC daily)');
});
```

- [ ] **Step 3: Verify full compilation**

```bash
cd server && npx tsc --noEmit
```

Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/cron/jobFeedCron.ts server/src/index.ts
git commit -m "feat(server): register /api/job-feed routes and start daily cron"
```

---

## Task 6: JobCard Component

**Files:**
- Create: `src/components/jobs/JobCard.tsx`

- [ ] **Step 1: Create the component**

Create directory `src/components/jobs/` and file `JobCard.tsx`:

```tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, ChevronDown, ChevronUp, Loader2, BookmarkPlus, BookmarkCheck, Zap, AlertTriangle, User } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

export interface JobFeedItem {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  description: string;
  bullets: string[] | null;
  sourceUrl: string;
  sourcePlatform: string;
  postedAt: string | null;
  suggestedAddressee: string | null;
  addresseeTitle: string | null;
  addresseeConfidence: 'high' | 'medium' | 'low' | null;
  addresseeSource: 'job-listing' | 'web-search' | null;
  matchScore: number | null;
  matchDetails: { overallGrade?: string; gaps?: string[]; keywords?: string[] } | null;
  isRead: boolean;
  isSaved: boolean;
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  seek:     { label: 'Seek',     color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
  indeed:   { label: 'Indeed',   color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  jora:     { label: 'Jora',     color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  linkedin: { label: 'LinkedIn', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  other:    { label: 'Job Board', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};

function daysAgo(iso: string | null): string {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

function scoreColor(score: number): string {
  if (score >= 75) return '#4ade80';
  if (score >= 50) return '#fbbf24';
  return '#f87171';
}

const CRITERIA_KEYWORDS = ['selection criteria', 'key criteria', 'essential criteria', 'desirable criteria', 'address the criteria'];

interface Props {
  item: JobFeedItem;
  onUpdate: (updated: Partial<JobFeedItem> & { id: string }) => void;
}

export const JobCard: React.FC<Props> = ({ item, onUpdate }) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addresseeLoading, setAddresseeLoading] = useState(false);
  const [addresseeOverride, setAddresseeOverride] = useState<string | null>(null);
  const [editingAddressee, setEditingAddressee] = useState(false);

  const platform = PLATFORM_CONFIG[item.sourcePlatform] ?? PLATFORM_CONFIG.other;
  const hasCriteriaHint = CRITERIA_KEYWORDS.some(k => item.description.toLowerCase().includes(k));
  const addresseeFetched = item.addresseeSource !== null;

  const handleExpand = async () => {
    const nowExpanded = !expanded;
    setExpanded(nowExpanded);

    if (nowExpanded && !addresseeFetched && !addresseeLoading) {
      setAddresseeLoading(true);
      try {
        const { data } = await api.post(`/job-feed/${item.id}/find-addressee`);
        onUpdate({
          id: item.id,
          suggestedAddressee: data.suggestedAddressee,
          addresseeTitle: data.addresseeTitle,
          addresseeConfidence: data.addresseeConfidence,
          addresseeSource: data.addresseeSource,
        });
      } catch {
        /* silent */
      } finally {
        setAddresseeLoading(false);
      }
    }
  };

  const handleScore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scoring || item.matchScore !== null) return;
    setScoring(true);
    try {
      const { data } = await api.post(`/job-feed/${item.id}/score`);
      onUpdate({ id: item.id, matchScore: data.matchScore, matchDetails: data.matchDetails });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Scoring failed — try again.');
    } finally {
      setScoring(false);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving || item.isSaved) return;
    setSaving(true);
    try {
      await api.post(`/job-feed/${item.id}/save`);
      onUpdate({ id: item.id, isSaved: true });
      toast.success('Saved to tracker');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDocs = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem('jobhub_current_jd', item.description);
    navigate('/');
    toast.success('Job description loaded — click Analyse to start');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      {/* ── Collapsed header (always visible) ── */}
      <div
        className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={handleExpand}
      >
        {/* Row 1: platform + date + score action */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ color: platform.color, background: platform.bg }}
            >
              {platform.label}
            </span>
            {item.postedAt && (
              <span className="text-[10px] text-slate-500">{daysAgo(item.postedAt)}</span>
            )}
          </div>

          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {item.matchScore !== null ? (
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ color: scoreColor(item.matchScore), background: `${scoreColor(item.matchScore)}18` }}
              >
                {item.matchScore}/100 match
              </span>
            ) : (
              <button
                onClick={handleScore}
                disabled={scoring}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-brand-400 transition-colors disabled:opacity-40"
              >
                {scoring ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                {scoring ? 'Analysing…' : 'Analyse match'}
              </button>
            )}
            {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
          </div>
        </div>

        {/* Row 2: title + external link */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-sm font-bold text-slate-100 leading-snug">{item.title}</p>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ExternalLink size={11} />
            Open
          </a>
        </div>

        {/* Row 3: meta */}
        <p className="text-xs text-slate-500 mb-3">
          {item.company}
          {item.location && ` · ${item.location}`}
          {item.salary && ` · ${item.salary}`}
        </p>

        {/* Bullets */}
        {item.bullets ? (
          <ul className="space-y-1">
            {(item.bullets as string[]).map((b, i) => (
              <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-brand-500 mt-0.5 flex-shrink-0">·</span>
                {b}
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-1.5">
            {[70, 55, 85].map(w => (
              <div key={w} className="h-2.5 rounded bg-slate-800 animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {/* Match gaps (shown after scoring) */}
        {item.matchDetails?.gaps && item.matchDetails.gaps.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.matchDetails.gaps.slice(0, 4).map((gap, i) => (
              <span key={i} className="text-[9px] font-bold text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50">
                gap: {gap}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Expanded section ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-800"
          >
            <div className="p-4 space-y-4">
              {/* Selection criteria warning */}
              {hasCriteriaHint && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
                  <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">This role may require a selection criteria response — check the full listing for details.</p>
                </div>
              )}

              {/* Full description */}
              <div
                className="text-xs text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar"
                style={{ maxHeight: 360, whiteSpace: 'pre-wrap' }}
              >
                {item.description}
              </div>

              {/* Addressee section */}
              <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <User size={12} className="text-slate-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cover letter — who to address</span>
                </div>

                {addresseeLoading && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" />
                    Finding the right person to address your cover letter to…
                  </p>
                )}

                {!addresseeLoading && addresseeFetched && (
                  item.suggestedAddressee ? (
                    editingAddressee ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                          defaultValue={addresseeOverride ?? item.suggestedAddressee}
                          onBlur={e => { setAddresseeOverride(e.target.value); setEditingAddressee(false); }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-slate-200">
                            {addresseeOverride || item.suggestedAddressee}
                            {(item.addresseeTitle) && (
                              <span className="font-normal text-slate-400">, {item.addresseeTitle}</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {item.addresseeSource === 'job-listing' ? 'Found in job listing' : 'Found via web search'} · verify before sending
                          </p>
                        </div>
                        <button
                          onClick={() => setEditingAddressee(true)}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-slate-500">No specific contact found — we'll use "Hiring Manager"</p>
                  )
                )}

                {!addresseeLoading && !addresseeFetched && (
                  <p className="text-xs text-slate-500 italic">Searching…</p>
                )}
              </div>

              {/* Apply section */}
              <div className="rounded-xl bg-slate-800/30 border border-slate-700/40 p-3 space-y-2">
                <p className="text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-200">We build the documents. You make the move.</span>{' '}
                  Applying directly signals genuine intent — hiring managers notice candidates who submit personally.
                  Your application gets individual attention, not a filtered queue.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-white transition-colors"
                    style={{ background: platform.color }}
                  >
                    <ExternalLink size={11} />
                    Apply on {platform.label}
                  </a>
                  <button
                    onClick={handleGenerateDocs}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border border-brand-500/40 text-brand-400 hover:bg-brand-500/10 transition-colors"
                  >
                    Generate documents
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || item.isSaved}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors disabled:opacity-40"
                  >
                    {saving ? <Loader2 size={11} className="animate-spin" /> : item.isSaved ? <BookmarkCheck size={11} className="text-emerald-400" /> : <BookmarkPlus size={11} />}
                    {item.isSaved ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/AntiGravity/JobHub && npx tsc --noEmit
```

Expected: no errors in `JobCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/jobs/JobCard.tsx
git commit -m "feat(ui): JobCard component with expand, score, addressee, apply section"
```

---

## Task 7: JobFeedPage

**Files:**
- Create: `src/pages/JobFeedPage.tsx`

- [ ] **Step 1: Create the page**

Create `src/pages/JobFeedPage.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, RefreshCw, AlertCircle, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { NavLink } from 'react-router-dom';
import api from '../lib/api';
import { JobCard, type JobFeedItem } from '../components/jobs/JobCard';

export const JobFeedPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [feedDate, setFeedDate] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data; },
    staleTime: 5 * 60 * 1000,
  });

  const { isLoading, isError } = useQuery({
    queryKey: ['job-feed', 0],
    queryFn: async () => {
      const { data } = await api.get('/job-feed/feed?offset=0');
      setJobs(data.jobs);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setFeedDate(data.feedDate);
      setProfileIncomplete(data.profileIncomplete ?? false);
      setOffset(0);
      return data;
    },
    refetchOnMount: true,
    staleTime: 2 * 60 * 1000,
  });

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const next = offset + 10;
      const { data } = await api.get(`/job-feed/feed?offset=${next}`);
      setJobs(prev => [...prev, ...data.jobs]);
      setHasMore(data.hasMore);
      setOffset(next);
    } catch {
      toast.error('Failed to load more jobs');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post('/job-feed/refresh');
      queryClient.invalidateQueries({ queryKey: ['job-feed'] });
      toast.success('Feed refreshed');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not refresh';
      const retry = err?.response?.data?.retryAfter;
      toast.error(retry ? `${msg} Try again in ${Math.ceil(retry / 60)} min.` : msg);
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdate = useCallback((updated: Partial<JobFeedItem> & { id: string }) => {
    setJobs(prev => prev.map(j => (j.id === updated.id ? { ...j, ...updated } : j)));
  }, []);

  // ─── Loading state ───
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-4xl font-extrabold tracking-tight text-white">Job Feed</h2>
          {feedDate && !profileIncomplete && (
            <p className="text-base text-slate-400 font-medium">
              {total} jobs for{' '}
              <span className="text-slate-200">{profile?.targetRole ?? 'your role'}</span>{' '}
              in{' '}
              <span className="text-slate-200">{profile?.targetCity ?? 'your city'}</span>
              {' · '}Updated {feedDate === new Date().toISOString().slice(0, 10) ? 'today' : feedDate}
            </p>
          )}
        </div>
        {!profileIncomplete && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-all disabled:opacity-40"
          >
            {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh
          </button>
        )}
      </header>

      {/* Profile incomplete */}
      {profileIncomplete && (
        <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
          <AlertCircle size={32} className="text-amber-400" />
          <div>
            <p className="text-base font-bold text-slate-200 mb-1">Target role and city required</p>
            <p className="text-sm text-slate-500 mb-4">
              Set your target role and city in Profile &amp; Achievements to enable your job feed.
            </p>
            <NavLink
              to="/workspace"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600/20 border border-brand-600/30 text-brand-400 text-sm font-bold hover:bg-brand-600/30 transition-colors"
            >
              Go to Profile &amp; Achievements →
            </NavLink>
          </div>
        </div>
      )}

      {/* Error */}
      {isError && !profileIncomplete && (
        <div className="glass-card p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-red-400" />
          <p className="text-base font-bold text-slate-200">Couldn't load today's jobs</p>
          <p className="text-sm text-slate-500">Try refreshing in a few minutes.</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && !profileIncomplete && jobs.length === 0 && (
        <div className="glass-card p-12 flex flex-col items-center gap-4 text-center">
          <Briefcase size={36} className="text-slate-700" />
          <div>
            <p className="text-base font-bold text-slate-400">No jobs found today</p>
            <p className="text-sm text-slate-600 mt-1">
              No listings for {profile?.targetRole} in {profile?.targetCity} today.
              Try broadening your target role in your profile.
            </p>
          </div>
        </div>
      )}

      {/* Job cards */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence>
            {jobs.map(job => (
              <JobCard key={job.id} item={job} onUpdate={handleUpdate} />
            ))}
          </AnimatePresence>

          {/* Load more */}
          {hasMore && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">Showing {jobs.length} of {total} jobs</p>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-all disabled:opacity-40"
              >
                {loadingMore ? <Loader2 size={12} className="animate-spin" /> : null}
                {loadingMore ? 'Loading…' : 'Load 10 more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify compilation**

```bash
cd E:/AntiGravity/JobHub && npx tsc --noEmit
```

Expected: no errors in `JobFeedPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/JobFeedPage.tsx
git commit -m "feat(ui): JobFeedPage with pagination, refresh, empty/error states"
```

---

## Task 8: Navigation, Routing, and Dashboard Widget

**Files:**
- Modify: `src/layouts/DashboardLayout.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Job Feed nav item to `DashboardLayout.tsx`**

In `src/layouts/DashboardLayout.tsx`, locate the `navItems` array (around line 12). Change it from:

```typescript
const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/tracker', icon: Briefcase, label: 'Applications' },
    ...
];
```

To:

```typescript
import { LayoutDashboard, FileText, Briefcase, LogOut, User, Sun, Moon, Library, Mail, Linkedin, Sparkles } from 'lucide-react';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/jobs', icon: Sparkles, label: 'Job Feed' },
    { to: '/tracker', icon: Briefcase, label: 'Applications' },
    { to: '/documents', icon: Library, label: 'Documents' },
    { to: '/linkedin', icon: Linkedin, label: 'LinkedIn' },
    { to: '/email-templates', icon: Mail, label: 'Email Templates' },
    { to: '/workspace', icon: FileText, label: 'Profile & Achievements' },
];
```

(Remove the `Linkedin` duplicate from the nav items array if it exists as a separate "coming soon" block — there is one around line 66–84, which can stay as-is since it renders a disabled "LinkedIn" entry. The nav item above with `to: '/linkedin'` routes to the actual LinkedIn page.)

- [ ] **Step 2: Add lazy import and route in `App.tsx`**

In `src/App.tsx`, after the existing `ReportExperience` lazy import (around line 20), add:

```typescript
const JobFeedPage = React.lazy(() =>
  import('./pages/JobFeedPage').then(m => ({ default: m.JobFeedPage }))
);
```

In the `Routes` block (around line 534–543), add the new route:

```tsx
<Route path="/jobs" element={<JobFeedPage />} />
```

Full Routes block after change:
```tsx
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/tracker" element={<ApplicationTracker />} />
  <Route path="/application-workspace" element={<ApplicationWorkspace />} />
  <Route path="/workspace" element={<Workspace />} />
  <Route path="/documents" element={<DocumentLibrary />} />
  <Route path="/email-templates" element={<EmailTemplatesLibrary />} />
  <Route path="/linkedin" element={<LinkedInPage />} />
  <Route path="/jobs" element={<JobFeedPage />} />
  <Route path="*" element={<Dashboard />} />
</Routes>
```

- [ ] **Step 3: Add Dashboard widget**

In `src/App.tsx`, inside the `Dashboard` component function (around line 35), add a new query after the existing `jobs` query:

```typescript
const { data: feedData } = useQuery({
  queryKey: ['job-feed', 0],
  queryFn: async () => {
    const { data } = await api.get('/job-feed/feed?offset=0');
    return data;
  },
  staleTime: 5 * 60 * 1000,
  enabled: !!profile?.dashboardAccess,
});
```

Then in the JSX return of the Dashboard component, add the widget after the `{/* Collapsed report summary card */}` block and before `{/* First-visit tips */}` (around line 128). Add:

```tsx
{/* Job Feed widget */}
{feedData?.total > 0 && (
  <NavLink
    to="/jobs"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'rgba(99,102,241,0.06)',
      border: '1px solid rgba(99,102,241,0.15)',
      borderRadius: 16,
      padding: '18px 24px',
      textDecoration: 'none',
      marginBottom: 0,
    }}
  >
    <div>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', margin: 0 }}>
        ✦ {feedData.total} new jobs today
      </p>
      <p style={{ fontSize: 12, color: '#6366f1', margin: '2px 0 0', opacity: 0.8 }}>
        {profile?.targetRole} · {profile?.targetCity}
      </p>
    </div>
    <p style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}>View feed →</p>
  </NavLink>
)}
```

- [ ] **Step 4: Verify full build**

```bash
cd E:/AntiGravity/JobHub && npm run build
```

Expected: build succeeds with no TypeScript errors. If there are import or type errors, fix them before proceeding.

- [ ] **Step 5: Commit and push**

```bash
git add src/layouts/DashboardLayout.tsx src/App.tsx src/pages/JobFeedPage.tsx src/components/jobs/JobCard.tsx
git commit -m "feat(ui): Job Feed nav, route, Dashboard widget, JobFeedPage + JobCard"
git push
```

---

## Post-deployment checklist

- [ ] Add env vars to Railway: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `SERPAPI_KEY`
- [ ] Run database migration on Railway (the `migrate-safe.js` script picks up the new SQL file automatically on deploy)
- [ ] Test as a premium user: open `/jobs`, verify feed loads within ~5s
- [ ] Test "Analyse match" on a card — score should appear inline
- [ ] Test "Generate documents" — verify JD appears pre-filled in MatchEngine on Dashboard
- [ ] Test "Save" — verify card updates to "Saved ✓" and entry appears in `/tracker`
- [ ] Test "Refresh" twice in quick succession — second should return rate-limit message
- [ ] Test as a non-premium user — route should still render but all API calls return 403

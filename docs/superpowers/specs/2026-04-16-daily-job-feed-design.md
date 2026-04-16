# Daily Job Feed — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface up to 10 curated, relevant job listings per day to each premium user, with on-demand match scoring and on-demand full-page enrichment (Firecrawl) for selection criteria detection.

**Architecture:** Adzuna API fetches 100 jobs per user per day (2 queries × 50 results). All 100 are stored in a new `JobFeedItem` table. The UI serves them 10 at a time. Bullet-point summaries are LLM-generated in a single batched call per 10-card load. Scoring uses the existing `/api/analyze/job` logic. Firecrawl is on-demand only, triggered explicitly by the user to check for selection criteria.

**Tech Stack:** Adzuna REST API, Firecrawl SDK (`@mendable/firecrawl-js`), existing LLM service, Prisma/PostgreSQL, React, existing `/api/analyze/job` endpoint.

---

## 1. Environment Variables Required

Add to Railway (server):

```
ADZUNA_APP_ID=<from developer.adzuna.com>
ADZUNA_APP_KEY=<from developer.adzuna.com>
FIRECRAWL_API_KEY=fc-aac8ea8cb550404eb5e3ab497d4808ce
```

Adzuna registration: https://developer.adzuna.com — free tier covers 500 queries/month (sufficient for ~8 active users/day).

---

## 2. Data Model

### New model: `JobFeedItem`

Add to `server/prisma/schema.prisma`:

```prisma
model JobFeedItem {
  id                  String           @id @default(uuid())
  userId              String
  feedDate            DateTime         @db.Date
  title               String
  company             String
  location            String?
  salary              String?
  description         String
  bullets             Json?
  sourceUrl           String
  sourcePlatform      String
  postedAt            DateTime?
  fullContent         String?
  hasSelectionCriteria Boolean?
  matchScore          Int?
  matchDetails        Json?
  isRead              Boolean          @default(false)
  isSaved             Boolean          @default(false)
  createdAt           DateTime         @default(now())
  candidateProfile    CandidateProfile @relation(fields: [userId], references: [userId])

  @@index([userId, feedDate])
}
```

Add relation to `CandidateProfile`:
```prisma
jobFeedItems  JobFeedItem[]
```

### Migration

```sql
CREATE TABLE "JobFeedItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feedDate" DATE NOT NULL,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "location" TEXT,
  "salary" TEXT,
  "description" TEXT NOT NULL,
  "bullets" JSONB,
  "sourceUrl" TEXT NOT NULL,
  "sourcePlatform" TEXT NOT NULL,
  "postedAt" TIMESTAMP(3),
  "fullContent" TEXT,
  "hasSelectionCriteria" BOOLEAN,
  "matchScore" INTEGER,
  "matchDetails" JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "isSaved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobFeedItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "JobFeedItem_userId_feedDate_idx" ON "JobFeedItem"("userId", "feedDate");
ALTER TABLE "JobFeedItem" ADD CONSTRAINT "JobFeedItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "CandidateProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## 3. Backend Service: `server/src/services/jobFeed.ts`

Responsible for:

### 3a. `fetchAdzunaJobs(role: string, city: string): Promise<RawJob[]>`

Calls Adzuna's search endpoint twice (page 1 and page 2) to retrieve up to 100 jobs.

Adzuna endpoint:
```
GET https://api.adzuna.com/v1/api/jobs/au/search/{page}
  ?app_id=ADZUNA_APP_ID
  &app_key=ADZUNA_APP_KEY
  &what={role}           // e.g. "graduate engineer"
  &where={city}          // e.g. "Melbourne"
  &results_per_page=50
  &content-type=application/json
```

Returns array of `RawJob`:
```ts
interface RawJob {
  title: string;
  company: string;        // result.company.display_name
  location: string;       // result.location.display_name
  salary: string | null;  // derived from salary_min/salary_max if present
  description: string;    // result.description (full text)
  sourceUrl: string;      // result.redirect_url
  sourcePlatform: string; // extracted from redirect_url hostname
  postedAt: Date | null;  // result.created
}
```

`sourcePlatform` is extracted from the redirect URL hostname:
- `seek.com.au` → `"seek"`
- `au.indeed.com` → `"indeed"`
- `jora.com` → `"jora"`
- `linkedin.com` → `"linkedin"`
- anything else → `"other"`

Deduplicate by `sourceUrl` before returning.

### 3b. `generateBullets(jobs: RawJob[]): Promise<string[][]>`

Single LLM call for a batch of up to 10 jobs. Returns an array of bullet arrays.

Prompt structure:
```
For each job below, write exactly 3-5 bullet points that help a job seeker quickly assess fit.
Focus on: role type, team/company context, key requirements, location/work arrangement, and anything
notable (salary, selection criteria required, government role, etc.).
Each bullet should be one short sentence. No markdown formatting in bullets — plain text only.

Return a JSON array of arrays: [[bullet, bullet, ...], [bullet, bullet, ...], ...]
Maintain the same order as the input jobs.

Jobs:
[{ "title": "...", "company": "...", "description": "...(first 800 chars)..." }, ...]
```

If LLM fails or returns malformed JSON, fall back to `null` (bullets stay null, card renders without them).

### 3c. `buildDailyFeed(userId: string): Promise<void>`

Orchestrates the full daily fetch:
1. Load `CandidateProfile` for `userId` — read `targetRole`, `targetCity`
2. If either is blank, throw `"Profile incomplete — set a target role and city first"`
3. Call `fetchAdzunaJobs(targetRole, targetCity)`
4. Delete any existing `JobFeedItem` rows for this user with today's `feedDate` (idempotent re-run)
5. Insert all jobs into `JobFeedItem` (bullets = null at this stage)
6. Return — bullets are generated lazily on first GET request

### 3d. `enrichWithFirecrawl(jobId: string): Promise<{ fullContent: string; hasSelectionCriteria: boolean }>`

Called only when user clicks "Check for selection criteria":
1. Load `JobFeedItem` by id, get `sourceUrl`
2. Call Firecrawl scrape: `await firecrawl.scrapeUrl(sourceUrl, { formats: ['markdown'] })`
3. Detect selection criteria: search the returned markdown for any of these phrases (case-insensitive): `"selection criteria"`, `"key criteria"`, `"essential criteria"`, `"desirable criteria"`, `"address the criteria"`, `"respond to the criteria"`
4. Store `fullContent` and `hasSelectionCriteria` on the `JobFeedItem` row
5. Return both values

If Firecrawl throws (login-gated page, timeout, etc.), return `{ fullContent: null, hasSelectionCriteria: null }` and the route layer returns a 200 with `{ error: "Could not retrieve full page — open the original listing to check for selection criteria." }`

---

## 4. Backend Routes: `server/src/routes/jobs.ts`

All routes require `authenticate` middleware. All require `profile.dashboardAccess === true` — return 403 with `{ error: "Premium access required" }` otherwise.

### `GET /api/jobs/feed?offset=0`

1. Check `dashboardAccess`
2. Get today's date in AEST (UTC+10): `const todayAEST = new Date(Date.now() + 10 * 3600 * 1000).toISOString().slice(0, 10)`
3. Count `JobFeedItem` rows for `(userId, feedDate = todayAEST)`
4. If count === 0: call `buildDailyFeed(userId)` inline (lazy fetch)
5. Load 10 rows with `offset`, ordered by `postedAt DESC NULLS LAST, createdAt DESC`
6. For any rows in the returned 10 where `bullets === null`: call `generateBullets` for all null-bullet rows in that batch, then update the rows in DB and return updated rows
7. Mark returned rows `isRead = true`
8. Return: `{ jobs: JobFeedItem[], total: number, hasMore: boolean, feedDate: string }`

### `POST /api/jobs/refresh`

Rate-limited: if a `JobFeedItem` row exists for today AND `createdAt` of the newest row is within the last 60 minutes, return `{ error: "Feed was refreshed recently. Try again later.", retryAfter: <seconds> }`.

Otherwise: delete today's rows for this user, call `buildDailyFeed(userId)`, return `{ ok: true }`.

### `POST /api/jobs/:id/score`

1. Load `JobFeedItem` — verify it belongs to `req.user.id`
2. If `matchScore` already set, return cached: `{ matchScore, matchDetails }`
3. Call existing job analysis logic (same as `/api/analyze/job`) with `item.description`
4. Store `matchScore` and `matchDetails` on the row
5. Return `{ matchScore, matchDetails }`

The score endpoint applies the same per-user daily limit as the analyze route. Import and apply `analyzeRateLimit` from `../middleware/analyzeRateLimit` directly on this route handler — do not apply it at router level (to avoid conflicts with the other jobs routes that don't need it).

### `POST /api/jobs/:id/enrich`

Calls `enrichWithFirecrawl(id)`. Returns `{ fullContent, hasSelectionCriteria, error? }`.

### `POST /api/jobs/:id/save`

Creates a `JobApplication` record from the feed item (title, company, description, sourceUrl as notes). Sets status to `SAVED`. Updates `isSaved = true` on the `JobFeedItem`. Returns the new `JobApplication` id so the frontend can navigate to it in the tracker.

---

## 5. Cron Job: `server/src/cron/jobFeedCron.ts`

Runs daily at 7am AEST (21:00 UTC previous day):

```ts
import cron from 'node-cron';
import { prisma } from '../index';
import { buildDailyFeed } from '../services/jobFeed';

// '0 21 * * *' = 21:00 UTC = 7:00 AEST
export function startJobFeedCron() {
  cron.schedule('0 21 * * *', async () => {
    console.log('[jobFeedCron] Starting daily job feed fetch');
    const users = await prisma.candidateProfile.findMany({
      where: { dashboardAccess: true, hasCompletedOnboarding: true },
      select: { userId: true },
    });
    for (const { userId } of users) {
      try {
        await buildDailyFeed(userId);
        console.log(`[jobFeedCron] Feed built for ${userId}`);
      } catch (err) {
        console.error(`[jobFeedCron] Failed for ${userId}:`, err);
      }
    }
  });
}
```

Install: `npm install node-cron` and `npm install -D @types/node-cron` in server.

Call `startJobFeedCron()` from `server/src/index.ts` after DB connects.

---

## 6. Register Route

In `server/src/index.ts`:
```ts
import jobsRouter from './routes/jobs';
app.use('/api/jobs', jobsRouter);
```

---

## 7. Frontend: `src/pages/JobFeedPage.tsx`

### State
```ts
const [jobs, setJobs] = useState<JobFeedItem[]>([]);
const [total, setTotal] = useState(0);
const [offset, setOffset] = useState(0);
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [refreshing, setRefreshing] = useState(false);
const [expandedId, setExpandedId] = useState<string | null>(null);
const [scoringId, setScoringId] = useState<string | null>(null);
const [enrichingId, setEnrichingId] = useState<string | null>(null);
```

### Layout

**Page header**:
- Title: "Job Feed"
- Subtitle: "X jobs found for [targetRole] in [targetCity] · Updated [date]"
- "Refresh" button (top right) — disabled with countdown if rate-limited

**Job cards** (10, then "Load more" button):

Each card is a `motion.div` with expand/collapse on click.

**Collapsed state:**
```
[Platform badge: SEEK / INDEED / JORA]  [Posted X days ago]
Job Title                                           [Analyse match →]
Company · Location · Salary (if present)           [Open original ↗]
• Bullet 1
• Bullet 2
• Bullet 3
(skeleton loaders if bullets still null)
```

**Expanded state** (appended below collapsed content):
```
─────────────────────────────────────────
Full job description (max-height 400px, scroll)
─────────────────────────────────────────
[Check for selection criteria]  [Generate documents]  [Save to tracker]

(After enrichment — one of:)
  ✓ Selection criteria found — included in description above
  ✗ No selection criteria found on this page
  ⚠ Could not retrieve full page — open the original listing to check
```

**After scoring** (inline on card, below bullets):
```
Match score: 78/100  ●●●●●●●○○○
Key gaps: Python (intermediate), Project management certification
```

### Navigation integration

Add to `DashboardLayout.tsx` nav items:
```ts
{ to: '/jobs', icon: Sparkles, label: 'Job Feed', premium: true },
```

Position it second, after Dashboard. The `premium` flag renders a small green "Premium" badge next to the label.

Add route in `App.tsx`:
```tsx
const JobFeedPage = React.lazy(() => import('./pages/JobFeedPage').then(m => ({ default: m.JobFeedPage })));
// ...
<Route path="/jobs" element={<JobFeedPage />} />
```

### Dashboard widget

In the existing Dashboard component, add a small "Today's picks" widget above the MatchEngine section:
```
┌─────────────────────────────────────────┐
│ 10 new jobs for Graduate Engineer       │
│ in Melbourne — updated today            │
│                        [View feed →]    │
└─────────────────────────────────────────┘
```
Query: `GET /api/jobs/feed?offset=0` with `staleTime: 5 * 60 * 1000`. If total > 0, show widget. If loading/no jobs, hide widget entirely (don't show empty state on Dashboard — user checks the tab for that).

---

## 8. Error States (UI)

| Scenario | Message shown |
|---|---|
| `targetRole` or `targetCity` blank on profile | "Set your target role and city in Profile & Achievements to enable your job feed." with link |
| Adzuna returns 0 results | "No jobs found for [role] in [city] today. Try broadening your target role in your profile." |
| Adzuna API error | "Couldn't fetch today's jobs — try refreshing in a few minutes." |
| Firecrawl fails / page gated | "Could not retrieve full page — open the original listing to check for selection criteria." |
| Rate limit on refresh | "Feed refreshed recently. Try again in X minutes." |
| Premium gate | "This feature is available to Premium members." |

---

## 9. Selection Criteria Warning Logic

When a job card is expanded, before the user clicks "Check for selection criteria", scan `item.description` client-side for keywords: `selection criteria`, `key criteria`, `essential criteria`, `desirable criteria`. If found → show a yellow banner: *"This role may require a selection criteria response — check the full listing."* This is a fast client-side hint requiring no API call. The full enrichment via Firecrawl gives a definitive answer.

---

## 10. Out of Scope (This Version)

- SerpAPI / LinkedIn-specific discovery — add once user base > 20 active users
- PDF extraction (Firecrawl does not natively parse linked PDFs — future enhancement)
- Email digest of daily feed
- Filtering/sorting the feed by score, salary, platform
- Saved jobs list (isSaved is tracked in DB, UI for this is a future tab)

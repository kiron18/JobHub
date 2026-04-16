# Daily Job Feed — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface up to 10 curated, relevant job listings per day to each premium user. Each card shows skimmable bullet summaries, a suggested cover letter addressee (via SerpAPI), a direct link to apply, and on-demand match scoring. Firecrawl is not used in this version — reserved as a future enrichment layer.

**Architecture:** Adzuna API fetches 100 jobs per user per day (2 queries × 50 results), stored in a `JobFeedItem` table, served 10 at a time. Bullet summaries are LLM-generated in a single batched call per 10-card load. Addressee suggestion is a non-blocking SerpAPI search triggered lazily when a card is expanded. Scoring uses the existing `/api/analyze/job` logic, triggered by a button.

**Tech Stack:** Adzuna REST API, SerpAPI (Google Search), existing LLM service (`callLLM`), Prisma/PostgreSQL, React + Framer Motion, existing `/api/analyze/job` logic.

---

## 1. Environment Variables

Add to Railway (server):

```
ADZUNA_APP_ID=09f81d70
ADZUNA_APP_KEY=223e280387fda86c10be5b9db9d9520f
SERPAPI_KEY=a2c1987787cbc77860ffef12c605af2690ca76ad
```

**Not used in this version (reserved):**
```
FIRECRAWL_API_KEY=fc-aac8ea8cb550404eb5e3ab497d4808ce
```

---

## 2. Data Model

### New model: `JobFeedItem`

Add to `server/prisma/schema.prisma`:

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
  candidateProfile     CandidateProfile @relation(fields: [userId], references: [userId])

  @@index([userId, feedDate])
}
```

Add relation to `CandidateProfile`:
```prisma
jobFeedItems  JobFeedItem[]
```

### Migration SQL

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

---

## 3. Backend Service: `server/src/services/jobFeed.ts`

### 3a. `fetchAdzunaJobs(role: string, city: string): Promise<RawJob[]>`

Calls Adzuna's search endpoint twice (pages 1 and 2) for up to 100 results.

```
GET https://api.adzuna.com/v1/api/jobs/au/search/{page}
  ?app_id={ADZUNA_APP_ID}
  &app_key={ADZUNA_APP_KEY}
  &what={encodeURIComponent(role)}
  &where={encodeURIComponent(city)}
  &results_per_page=50
  &content-type=application/json
```

```ts
interface RawJob {
  title: string;
  company: string;        // result.company.display_name
  location: string;       // result.location.display_name
  salary: string | null;  // "${salary_min}–${salary_max}" if both present, else null
  description: string;    // result.description
  sourceUrl: string;      // result.redirect_url
  sourcePlatform: string; // extracted from redirect_url hostname (see below)
  postedAt: Date | null;  // result.created
}
```

`sourcePlatform` mapping (check hostname of `redirect_url`):
- `seek.com.au` → `"seek"`
- `au.indeed.com` or `indeed.com` → `"indeed"`
- `jora.com` → `"jora"`
- `linkedin.com` → `"linkedin"`
- anything else → `"other"`

Deduplicate by `sourceUrl` before returning. Make both page requests in parallel with `Promise.all`.

### 3b. `generateBullets(jobs: RawJob[]): Promise<string[][]>`

Single LLM call for a batch of up to 10 jobs. Returns an array of bullet arrays in the same order as input.

Prompt:
```
For each job below, write exactly 3-5 bullet points that help a job seeker quickly assess fit.
Cover: role type, team/company context, key requirements, work arrangement/location, and anything
notable (salary, government role, selection criteria likely required, etc.).
Each bullet is one short plain-text sentence. No markdown, no dashes, no asterisks.

Return a JSON array of arrays: [[bullet, bullet, ...], ...]  — same order as input.

Jobs:
[{ "title": "...", "company": "...", "description": "...(first 800 chars)..." }, ...]
```

If LLM returns malformed JSON or throws, return `null` for that batch — bullets stay null and cards render without them (no crash).

### 3c. `buildDailyFeed(userId: string): Promise<void>`

1. Load `CandidateProfile` for `userId` — read `targetRole`, `targetCity`
2. If either is blank, throw `new Error("Profile incomplete — set a target role and city first")`
3. Call `fetchAdzunaJobs(targetRole, targetCity)`
4. Delete existing `JobFeedItem` rows for `(userId, feedDate = today)` (makes re-runs idempotent)
5. Bulk-insert all fetched jobs — `bullets`, `suggestedAddressee`, and all score fields are null at this point
6. Return

### 3d. `findAddressee(company: string, role: string, description: string): Promise<AddresseeSuggestion | null>`

```ts
interface AddresseeSuggestion {
  name: string;
  title: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'job-listing' | 'web-search';
}
```

**Priority order:**

**Step 1 — Scan job description (highest confidence)**

Search `description` (case-insensitive) for these patterns:
- `contact\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)`
- `address\s+(?:your\s+)?(?:application|enquiries)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)`
- `enquiries\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)`
- `queries\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)`
- `speak\s+(?:to|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)`

If a name is matched: extract any nearby title if present (e.g., "contact Jane Smith, Head of Engineering"), return `{ name, title, confidence: 'high', source: 'job-listing' }`.

**Step 2 — SerpAPI search**

If step 1 found nothing, call SerpAPI:

```
GET https://serpapi.com/search
  ?engine=google
  &q={encodeURIComponent(`"${company}" hiring manager OR "head of" OR founder site:linkedin.com`)}
  &api_key={SERPAPI_KEY}
  &num=5
```

Parse the `organic_results` array. For each result:
- Extract `title` and `snippet`
- Look for a person name pattern in the snippet (capitalized first + last name)
- Look for a title pattern: CEO, Founder, Managing Director, Head of [X], [X] Manager, HR Manager, Talent Acquisition

**Step 3 — Interpret company size signal**

Small company signals (from description + search results):
- Description contains: `"startup"`, `"small team"`, `"our team of \d+"` (where \d+ < 20), `"family business"`, `"directly with the founder"`
- Search result shows: Founder / CEO with visible name, company has no Wikipedia or Crunchbase entry

If small company signal → prefer Founder/CEO.
If large company signal → prefer department head or HR Manager.

**Step 4 — Confidence rules**

| Scenario | Confidence |
|---|---|
| Name found in job description | `high` |
| Name found in top LinkedIn result, title matches role's department | `medium` |
| Name found but title is generic (e.g., just "Manager") | `low` |
| No name found anywhere | return `null` |

Return `null` (not an empty object) if no suggestion can be made with at least `low` confidence. "Hiring Manager" is a better fallback than a wrong name.

**Step 5 — Error handling**

If SerpAPI call throws or returns non-200, catch silently and return `null`. Addressee is a nice-to-have, never a blocking dependency.

---

## 4. Backend Routes: `server/src/routes/jobs.ts`

All routes:
- Require `authenticate` middleware
- Check `profile.dashboardAccess === true` — return `403 { error: "Premium access required" }` if not

### `GET /api/jobs/feed?offset=0`

1. Verify `dashboardAccess`
2. Compute today's date in AEST: `const todayAEST = new Date(Date.now() + 10 * 3600 * 1000).toISOString().slice(0, 10)`
3. Count `JobFeedItem` rows for `(userId, feedDate = todayAEST)`
4. If count === 0: call `buildDailyFeed(userId)` before continuing (lazy fetch on first open)
5. Load 10 rows at `offset`, ordered by `postedAt DESC NULLS LAST, createdAt DESC`
6. For rows where `bullets === null`: call `generateBullets(nullBulletRows)`, update those rows in DB, merge updated data into response
7. Mark all returned rows `isRead = true` (fire-and-forget update, don't await)
8. Return: `{ jobs: JobFeedItem[], total: number, hasMore: boolean, feedDate: string }`

### `POST /api/jobs/refresh`

Rate limit: load the most recently `createdAt` `JobFeedItem` for today. If it was created < 3600 seconds ago, return `400 { error: "Feed refreshed recently.", retryAfter: <seconds remaining> }`.

Otherwise: delete today's rows for this user, call `buildDailyFeed(userId)`, return `{ ok: true }`.

### `POST /api/jobs/:id/score`

1. Load `JobFeedItem` — verify `userId` matches `req.user.id`, return 404 if not found/wrong user
2. If `matchScore !== null`: return cached `{ matchScore, matchDetails }`
3. Apply `analyzeRateLimit` middleware logic — import from `../middleware/analyzeRateLimit` and apply as middleware on this handler (not at router level)
4. Replicate the core analysis logic from `/api/analyze/job`: load profile + achievements, call LLM with `JOB_ANALYSIS_PROMPT`, parse result, compute composite score
5. Update `JobFeedItem` row: set `matchScore` and `matchDetails`
6. Return `{ matchScore, matchDetails }`

### `POST /api/jobs/:id/find-addressee`

1. Load `JobFeedItem` — verify ownership
2. If `suggestedAddressee !== null`: return cached `{ suggestedAddressee, addresseeTitle, addresseeConfidence, addresseeSource }`
3. Call `findAddressee(item.company, item.title, item.description)`
4. If result is non-null: update row with `suggestedAddressee`, `addresseeTitle`, `addresseeConfidence`, `addresseeSource`
5. Return `{ suggestedAddressee, addresseeTitle, addresseeConfidence, addresseeSource }` — all fields null if not found

### `POST /api/jobs/:id/save`

1. Load `JobFeedItem`, verify ownership
2. Create `JobApplication` record:
   - `title`: item.title
   - `company`: item.company
   - `description`: item.description
   - `notes`: `"Source: ${item.sourceUrl}"`
   - `status`: `SAVED`
   - `userId` and `candidateProfileId` from the authenticated user's profile
3. Update `JobFeedItem`: set `isSaved = true`
4. Return `{ jobApplicationId: newRecord.id }`

---

## 5. Cron Job: `server/src/cron/jobFeedCron.ts`

Runs daily at 7am AEST (21:00 UTC):

```ts
import cron from 'node-cron';
import { prisma } from '../index';
import { buildDailyFeed } from '../services/jobFeed';

export function startJobFeedCron() {
  cron.schedule('0 21 * * *', async () => {
    console.log('[jobFeedCron] Starting daily feed pre-fetch');
    const users = await prisma.candidateProfile.findMany({
      where: { dashboardAccess: true, hasCompletedOnboarding: true },
      select: { userId: true },
    });
    for (const { userId } of users) {
      try {
        await buildDailyFeed(userId);
      } catch (err) {
        console.error(`[jobFeedCron] Failed for ${userId}:`, err);
      }
    }
  });
}
```

Install: `npm install node-cron && npm install -D @types/node-cron` in the server directory.

Call `startJobFeedCron()` from `server/src/index.ts` after the Prisma client connects.

---

## 6. Route Registration

`server/src/index.ts`:
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
const [scoringIds, setScoringIds] = useState<Set<string>>(new Set());
const [addresseeLoadingIds, setAddresseeLoadingIds] = useState<Set<string>>(new Set());
```

### `JobFeedItem` TypeScript interface (frontend)
```ts
interface JobFeedItem {
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
  matchDetails: any | null;
  isRead: boolean;
  isSaved: boolean;
}
```

### Page layout

**Header:**
```
Job Feed                              [Refresh ↺]
10 jobs for Graduate Engineer in Melbourne · Updated today
```

**Cards:** `AnimatePresence` + `motion.div` per card.

---

### Collapsed card state

```
┌─────────────────────────────────────────────────────────┐
│ [SEEK]  [INDEED]  [JORA]               2 days ago       │
│ Senior Data Analyst                  [Analyse match →]  │
│ Acme Corp · Melbourne · $90k–$110k   [Open listing ↗]  │
│                                                         │
│ • 3-month contract, potential to extend                 │
│ • Reports to Head of Analytics, team of 6               │
│ • Strong SQL and Tableau required                       │
│ • Hybrid — 2 days in office, South Melbourne            │
│ • Government client work, selection criteria likely     │
│                                                         │
│ [skeleton lines if bullets null]                        │
└─────────────────────────────────────────────────────────┘
```

Platform badge colours: Seek = teal, Indeed = blue, Jora = orange, LinkedIn = brand-blue, Other = slate.

---

### Expanded card state (click anywhere on collapsed card to toggle)

Appended below the collapsed content:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Full description — max-height 360px, overflow-y scroll]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─── Cover letter addressee ──────────────────────────────┐
│  Suggested: Sarah Chen, Head of Engineering             │
│  (found via LinkedIn search — verify before sending)    │
│  [Edit]                                                 │
│                                                         │
│  (loading state: "Finding the right person to address   │
│   your cover letter to…")                              │
│                                                         │
│  (not found: "No specific contact found — we'll use     │
│   'Hiring Manager'")                                    │
└─────────────────────────────────────────────────────────┘

┌─── Ready to apply? ─────────────────────────────────────┐
│  We build the documents. You make the move.             │
│  Applying directly signals genuine intent — hiring      │
│  managers notice candidates who submit personally.      │
│  Your application gets individual attention.            │
│                                                         │
│  [Apply on Seek ↗]  [Generate documents]  [Save]       │
└─────────────────────────────────────────────────────────┘
```

**"Apply on [Platform] ↗"** — opens `sourceUrl` in new tab. Button label reflects platform: "Apply on Seek ↗", "Apply on Indeed ↗", "Apply on LinkedIn ↗", or "View listing ↗" for unknown platforms.

**"Generate documents"** — navigates to `/application-workspace` with the job pre-populated. Pass state via React Router: `navigate('/application-workspace', { state: { jobFeedItem: item } })`. The ApplicationWorkspace / MatchEngine component should detect this and pre-fill the job description field and skip the paste step.

**"Save"** — calls `POST /api/jobs/:id/save`, shows toast "Saved to tracker", button becomes "Saved ✓".

---

### Addressee loading behaviour

When a card is expanded and `suggestedAddressee === null` (not yet fetched):
- Immediately call `POST /api/jobs/:id/find-addressee` (non-blocking — don't await before showing expanded card)
- Show a small loading indicator in the addressee section: *"Finding who to address your cover letter to…"*
- On response: update that job in local state
- On null response: show *"No specific contact found — we'll use 'Hiring Manager'"*

The `[Edit]` button on the addressee suggestion opens an inline text input so users can override the name before generating documents. Store the override in local component state only (not persisted to DB — the DB value remains the original suggestion).

---

### Match score display (inline on card, below bullets)

After scoring (matchScore is set):
```
Match  78 / 100  ████████░░  [Analysed ✓]
Key gaps: Advanced SQL · PMP Certification
```

Score colour: green if ≥ 75, amber if 50–74, red if < 50.

Before scoring:
```
[Analyse match →]  (button, right-aligned)
```

While scoring:
```
[Analysing…  ⟳]
```

---

### "Load more" button

Below the 10 cards:
```
Showing 10 of 87 jobs     [Load 10 more]
```

On click: fetch `GET /api/jobs/feed?offset=10`, append to `jobs` array, increment offset.

---

## 8. Navigation Integration

### `DashboardLayout.tsx` — add nav item

```ts
import { Sparkles } from 'lucide-react';

// Add to navItems array, position 2 (after Dashboard):
{ to: '/jobs', icon: Sparkles, label: 'Job Feed' },
```

No `premium` prop needed on the nav item itself — the route is already behind `dashboardAccess` on the server. The nav item always renders for premium users.

### `App.tsx` — add route

```tsx
const JobFeedPage = React.lazy(() =>
  import('./pages/JobFeedPage').then(m => ({ default: m.JobFeedPage }))
);

// Inside the Routes block:
<Route path="/jobs" element={<JobFeedPage />} />
```

### Dashboard homepage widget

In the existing `Dashboard` component, query `GET /api/jobs/feed?offset=0` with `staleTime: 5 * 60 * 1000`. If `total > 0`, render a widget above the MatchEngine section:

```
┌─────────────────────────────────────────────────────────┐
│ ✦ 10 new jobs for Graduate Engineer in Melbourne        │
│   Updated today                    [View feed →]        │
└─────────────────────────────────────────────────────────┘
```

If `total === 0` or still loading: render nothing (don't show an empty widget on the Dashboard).

---

## 9. Error States

| Scenario | Display |
|---|---|
| `targetRole` or `targetCity` not set | "Set your target role and city in Profile & Achievements to enable your job feed." + link to `/workspace` |
| Adzuna returns 0 results | "No jobs found for [role] in [city] today — try broadening your target role." |
| Adzuna API error | "Couldn't load today's jobs. Try refreshing in a few minutes." |
| Rate limit on refresh | "Feed refreshed recently. Try again in X minutes." with countdown |
| Premium gate (shouldn't be reachable via UI but handle server 403) | "This feature is available to Premium members." |
| Addressee search fails | Silently falls back to null — show "No specific contact found — we'll use 'Hiring Manager'" |

---

## 10. Selection Criteria Detection (client-side only)

When a card is expanded, scan `item.description` for (case-insensitive): `"selection criteria"`, `"key criteria"`, `"essential criteria"`, `"desirable criteria"`, `"address the criteria"`.

If found: show a yellow info strip inside the expanded card above the description:
> *"This role appears to require a selection criteria response — check the full listing for details."*

No API call needed. This is purely a string match on data already in the client.

---

## 11. MatchEngine Integration (pre-fill from feed)

`ApplicationWorkspace` / `MatchEngine` should check React Router location state on mount:

```ts
const location = useLocation();
const prefill = location.state?.jobFeedItem as JobFeedItem | undefined;

useEffect(() => {
  if (prefill) {
    setJobDescription(prefill.description);
    setJobTitle(prefill.title);
    setCompany(prefill.company);
    // Trigger analysis automatically if description is present
  }
}, []);
```

If `prefill` is present, skip the "paste job description" step and go straight to analysis.

---

## 12. Out of Scope (This Version)

- Firecrawl page enrichment (reserved — env var is set, implementation deferred)
- SerpAPI Google Jobs for LinkedIn-specific discovery (add at ~20 active users)
- PDF selection criteria extraction
- Email digest of daily feed
- Feed filtering/sorting by score, salary, or platform
- Saved jobs library UI (isSaved is tracked in DB, UI tab is a future addition)

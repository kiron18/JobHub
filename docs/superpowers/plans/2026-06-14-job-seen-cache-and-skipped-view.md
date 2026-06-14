# Hide Applied & Skipped Jobs + Skipped View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user never sees a job they have already applied to, and never sees a job they have skipped. A "Skipped" tab lets them review skipped jobs, with an Undo that returns the job to the feed.

**Architecture:** Skips are the only missing piece, and they fail today because `JobFeedItem.skipped` lives on rows that `buildDailyFeed` deletes and re-scrapes every day, so the flag evaporates. We move the skip decision into a small durable `SkippedJob` table keyed by `(userId, sourceUrl)` (URL is stable across rebuilds). The feed read then excludes two URL sets at the database level: URLs in `SkippedJob` and URLs in `JobApplication` (applied). No "seen" tracking is needed.

**Tech Stack:** Prisma (schema + migration), TypeScript (Express routes), React (ApplicationTracker UI).

**Existing context (verified):**
- `JobFeedItem` has `skipped: Boolean`, `skippedAt: DateTime?`, plus `title`, `company`, `location`, `sourceUrl`, `postedAt`.
- `JobApplication` has `sourceUrl: String?` (set by the save/mark-applied flows).
- Feed GET handler: `routes/job-feed.ts:117-201`. It builds the feed on demand when no feed exists for today, then reads `where: { userId, feedDate: today, skipped: false }` with `skip/take` paging.
- Skip handler: `routes/job-feed.ts:591-602` (PATCH `/:id/skip`).
- Tracker UI: `src/components/ApplicationTracker.tsx`.
- **No `SkippedJob` model exists yet. The earlier `UserSeenJob` idea is dropped — do not add it.**

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `server/prisma/schema.prisma` | ADD `SkippedJob` model | Durable per-user skip record keyed by sourceUrl |
| `server/src/routes/job-feed.ts` | MODIFY skip handler + feed query; ADD `/skipped` + `/skipped/restore` | Persist skips, exclude applied+skipped, serve + undo skips |
| `src/components/ApplicationTracker.tsx` | MODIFY | Add "Skipped" sub-tab with Undo |

---

### Task 1: Add the `SkippedJob` model

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add the model**

After the `JobFeedItem` model, add:
```prisma
model SkippedJob {
  id        String    @id @default(uuid())
  userId    String
  sourceUrl String
  title     String
  company   String
  location  String
  postedAt  DateTime?
  skippedAt DateTime  @default(now())

  @@unique([userId, sourceUrl])
  @@index([userId, skippedAt])
}
```

- [ ] **Step 2: Create and apply the migration**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx prisma migrate dev --name add_skipped_job && npx prisma generate
```
Expected: migration created and applied; client regenerated with `prisma.skippedJob`.

**STOP-AND-REPORT:** if the migration fails or asks to reset the database, stop and report. Do not reset.

- [ ] **Step 3: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): add SkippedJob model for durable per-user skips

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Persist skips in the skip handler

**Files:**
- Modify: `server/src/routes/job-feed.ts` (PATCH `/:id/skip`, lines 591-602)

- [ ] **Step 1: Replace the skip handler body**

Find:
```ts
router.patch('/:id/skip', async (req: any, res: any) => {
  const userId = req.user.id as string;
  const { id } = req.params;
  const { skipped } = req.body;
  const item = await prisma.jobFeedItem.findFirst({ where: { id, userId } });
  if (!item) return res.status(404).json({ error: 'Job not found' });
  await prisma.jobFeedItem.update({
    where: { id },
    data: { skipped: !!skipped, skippedAt: skipped ? new Date() : null },
  });
  res.json({ ok: true, skipped: !!skipped });
});
```
Replace with:
```ts
router.patch('/:id/skip', async (req: any, res: any) => {
  const userId = req.user.id as string;
  const { id } = req.params;
  const { skipped } = req.body;
  const item = await prisma.jobFeedItem.findFirst({ where: { id, userId } });
  if (!item) return res.status(404).json({ error: 'Job not found' });

  await prisma.jobFeedItem.update({
    where: { id },
    data: { skipped: !!skipped, skippedAt: skipped ? new Date() : null },
  });

  if (skipped) {
    // Durable skip keyed by sourceUrl so it survives daily feed rebuilds.
    await prisma.skippedJob.upsert({
      where: { userId_sourceUrl: { userId, sourceUrl: item.sourceUrl } },
      update: {
        skippedAt: new Date(),
        title: item.title,
        company: item.company,
        location: item.location,
        postedAt: item.postedAt,
      },
      create: {
        userId,
        sourceUrl: item.sourceUrl,
        title: item.title,
        company: item.company,
        location: item.location,
        postedAt: item.postedAt,
      },
    });
  } else {
    // Undo — drop the durable record so the job can return to the feed.
    await prisma.skippedJob.deleteMany({ where: { userId, sourceUrl: item.sourceUrl } });
  }

  res.json({ ok: true, skipped: !!skipped });
});
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx tsc --noEmit
```
Expected: no errors. (If `prisma.skippedJob` is unknown, Task 1 Step 2 `prisma generate` was not run.)

- [ ] **Step 3: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/routes/job-feed.ts
git commit -m "feat(feed): persist skips to SkippedJob on skip/undo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Exclude applied + skipped jobs from the feed

**Files:**
- Modify: `server/src/routes/job-feed.ts` (feed GET handler, lines 136-167)

This replaces the on-demand build trigger and the read query. Key correctness point: the build trigger must depend on whether *any* feed was built today, **not** on the post-exclusion count — otherwise a user who has acted on everything would loop-rebuild forever.

- [ ] **Step 1: Replace the count/build/read block**

Find (lines 136-167, from the `const count = ...` line through the `findMany` `take: 10 })`):
```ts
    const count = await prisma.jobFeedItem.count({ where: { userId, feedDate: today, skipped: false } });

    if (count === 0) {
      // Gate the BUILD (not the read) — free tier gets 1 lifetime feed build
      const access = await checkAccess(userId, 'job_search', userEmail);
      if (!access.allowed) {
        return res.status(402).json({ error: 'Job search limit reached', upgradeRequired: true, remaining: 0 });
      }
      if (!buildingNow.has(userId)) {
        buildingNow.add(userId);
        buildDailyFeed(userId)
          .catch((err: any) => {
            console.error(`[job-feed] Background build failed for ${userId}:`, err.message);
          })
          .finally(() => buildingNow.delete(userId));
      }
      return res.json({
        jobs: [],
        total: 0,
        hasMore: false,
        feedDate: today.toISOString().slice(0, 10),
        building: true,
      });
    }

    const total = await prisma.jobFeedItem.count({ where: { userId, feedDate: today, skipped: false } });
    const items = await prisma.jobFeedItem.findMany({
      where: { userId, feedDate: today, skipped: false },
      orderBy: [{ matchScore: 'desc' }, { postedAt: 'desc' }, { createdAt: 'desc' }],
      skip: offset,
      take: 10,
    });
```
Replace with:
```ts
    // Has ANY feed been built for today? Gates the build trigger independently of
    // exclusions, so a user who acted on everything does not loop-rebuild.
    const builtToday = await prisma.jobFeedItem.count({ where: { userId, feedDate: today } });

    if (builtToday === 0) {
      // Gate the BUILD (not the read) — free tier gets 1 lifetime feed build
      const access = await checkAccess(userId, 'job_search', userEmail);
      if (!access.allowed) {
        return res.status(402).json({ error: 'Job search limit reached', upgradeRequired: true, remaining: 0 });
      }
      if (!buildingNow.has(userId)) {
        buildingNow.add(userId);
        buildDailyFeed(userId)
          .catch((err: any) => {
            console.error(`[job-feed] Background build failed for ${userId}:`, err.message);
          })
          .finally(() => buildingNow.delete(userId));
      }
      return res.json({
        jobs: [],
        total: 0,
        hasMore: false,
        feedDate: today.toISOString().slice(0, 10),
        building: true,
      });
    }

    // Never show jobs the user applied to or skipped.
    const [appliedRows, skippedRows] = await Promise.all([
      prisma.jobApplication.findMany({ where: { userId, sourceUrl: { not: null } }, select: { sourceUrl: true } }),
      prisma.skippedJob.findMany({ where: { userId }, select: { sourceUrl: true } }),
    ]);
    const excludedUrls = Array.from(new Set<string>([
      ...appliedRows.map(r => r.sourceUrl as string),
      ...skippedRows.map(r => r.sourceUrl),
    ]));

    const where: any = { userId, feedDate: today, skipped: false };
    if (excludedUrls.length > 0) where.sourceUrl = { notIn: excludedUrls };

    const total = await prisma.jobFeedItem.count({ where });
    const items = await prisma.jobFeedItem.findMany({
      where,
      orderBy: [{ matchScore: 'desc' }, { postedAt: 'desc' }, { createdAt: 'desc' }],
      skip: offset,
      take: 10,
    });
```

The existing code below this (enrich with application status, bullet kickoff, mark-as-read, and the final `res.json` using `items` and `total`) stays unchanged.

- [ ] **Step 2: Type-check**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Run the unit suite**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services src/utils
```
Expected: same pass count as before; no new failures.

**STOP-AND-REPORT:** if a previously passing test now fails, report it — do not edit tests to pass.

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/routes/job-feed.ts
git commit -m "feat(feed): exclude applied and skipped jobs from the feed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Skipped list + restore endpoints

**Files:**
- Modify: `server/src/routes/job-feed.ts` (add two routes before `export default router;`)

- [ ] **Step 1: Add the endpoints**

Immediately before `export default router;` (line ~604), add:
```ts
// GET /api/job-feed/skipped — durable list of jobs the user skipped
router.get('/skipped', async (req: any, res: any) => {
  const userId = req.user.id as string;
  try {
    const items = await prisma.skippedJob.findMany({
      where: { userId },
      orderBy: { skippedAt: 'desc' },
      take: 100,
    });
    return res.json({ jobs: items });
  } catch (err: any) {
    console.error('[job-feed/skipped]', err.message);
    return res.status(500).json({ error: 'Failed to load skipped jobs' });
  }
});

// POST /api/job-feed/skipped/restore  body: { sourceUrl } — undo a skip
router.post('/skipped/restore', async (req: any, res: any) => {
  const userId = req.user.id as string;
  const { sourceUrl } = req.body;
  if (!sourceUrl) return res.status(400).json({ error: 'sourceUrl required' });
  try {
    await prisma.skippedJob.deleteMany({ where: { userId, sourceUrl } });
    // If today's feed still has this row, un-skip it so it reappears immediately.
    await prisma.jobFeedItem.updateMany({
      where: { userId, sourceUrl },
      data: { skipped: false, skippedAt: null },
    });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[job-feed/skipped/restore]', err.message);
    return res.status(500).json({ error: 'Failed to restore job' });
  }
});
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/routes/job-feed.ts
git commit -m "feat(api): add GET /skipped and POST /skipped/restore

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: "Skipped" sub-tab in the Application Tracker

**Files:**
- Modify: `src/components/ApplicationTracker.tsx`

- [ ] **Step 1: Read the existing component first**

Read `src/components/ApplicationTracker.tsx` in full to learn its tab system, data-fetching pattern (react-query vs fetch), card/list markup, and toast usage. Match those patterns. Do not introduce a new styling or data-fetching convention.

**STOP-AND-REPORT:** if the component has no tab system to extend, stop and report what structure it actually has before writing UI.

- [ ] **Step 2: Add a read-only "Skipped" tab**

Add a "Skipped" tab alongside the existing tabs. When active, it fetches `GET /api/job-feed/skipped` and renders each `job` as a compact, read-only row showing:
- Title (linked to `job.sourceUrl`, opens in a new tab)
- `company` and `location`
- "Skipped {relative date from job.skippedAt}"
- A "View on Seek" link (use `job.sourceUrl`)
- An "Undo" button

The "Undo" button calls `POST /api/job-feed/skipped/restore` with `{ sourceUrl: job.sourceUrl }`, then removes the row from the list (optimistic) or refetches, and shows the existing toast for confirmation. There is intentionally **no** "Prepare & Apply" or save action here — the user already passed on these.

Use the same auth/header helper the component already uses for its other API calls. Do not hardcode the base URL if the component uses an api client.

- [ ] **Step 3: Build to verify**

Run:
```bash
cd E:/AntiGravity/JobHub && npm run build 2>&1 | tail -20
```
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/components/ApplicationTracker.tsx
git commit -m "feat(ui): add Skipped tab to the application tracker with undo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Done criteria

- Applying to a job (existing save/mark-applied flow sets `JobApplication.sourceUrl`) removes it from the feed and it never returns.
- Skipping a job removes it from the feed and it stays gone across daily rebuilds (durable `SkippedJob`).
- The Skipped tab lists skipped jobs; Undo returns a job to the feed.
- Feed paging and the `total`/`hasMore` numbers remain correct (exclusion is a single DB-level `notIn`, not post-fetch filtering).
- No `UserSeenJob` model exists; no per-build seen recording was added.

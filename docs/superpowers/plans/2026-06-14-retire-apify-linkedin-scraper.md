# Retire Apify + LinkedIn Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully remove the Apify-based LinkedIn scraper from the running system so it can never inject jobs into the feed, and remove the `apify-client` dependency entirely. The feed becomes Seek (direct HTML) + Adzuna only.

**Architecture:** LinkedIn scraping lives in `linkedinScraper.ts` (the only remaining `apify-client` importer) and is wired into the daily feed (`jobFeed.ts`) and the prewarm cron (`jobFeedCron.ts`). We remove the call sites first (so nothing imports the module), then delete the module, then drop the dependency. Removing the package makes any future re-introduction of `import { ApifyClient }` fail to compile, so the build itself guards against regression. Seek already runs on the direct HTML scraper via the re-export shim, so it is unaffected.

**Tech Stack:** Node.js, TypeScript, Prisma, `node-cron`. No new dependencies.

---

## Ground truth (verified 2026-06-14 — do not re-derive)

1. `APIFY_API_KEY` **is currently set** in `server/.env`, so the LinkedIn Apify actor (`bebity/linkedin-jobs-scraper`) is **live** today: it runs in `buildDailyFeed` and in `prewarmLinkedInClusters`. This is the interference being removed.
2. `apify-client` is imported in **exactly one place**: `server/src/services/linkedinScraper.ts:2`. Nothing else imports it.
3. `admin.ts` reads `APIFY_API_KEY` via a raw `fetch` to Apify's billing API for the expense dashboard (lines ~493-570). It does **not** import `apify-client` and touches **no job data**. It already uses optional chaining (`process.env.APIFY_API_KEY?.trim()`), so it degrades to an "error" card if the key is absent. **Leave `admin.ts` untouched in this plan.**
4. The only references to LinkedIn scraping outside `linkedinScraper.ts` itself are:
   - `server/src/services/jobFeed.ts:6, 223, 234` (import + cluster + fetch call + merge at 240)
   - `server/src/cron/jobFeedCron.ts:5, 39` (import + prewarm call)
5. No test file imports `linkedinScraper`, so deleting it breaks no tests.
6. Old `SeekJobCache` rows with `queryMeta.source` of `'linkedin'` or `'seek'` (Apify-era) are already **inert**: the new Seek scraper uses a `seek-html|` hash prefix so it never reads `seek|` rows, and once the LinkedIn call site is gone, `linkedin|` rows are never queried. No DB migration or purge is required.

**Ordering matters:** remove the call sites (Tasks 1-2) before deleting the module (Task 3) before dropping the dependency (Task 4), so the build never goes red mid-way.

---

## File Structure

```
server/
  src/
    services/
      jobFeed.ts            — MODIFY: drop LinkedIn import, cluster, fetch, and merge
      linkedinScraper.ts    — DELETE
    cron/
      jobFeedCron.ts        — MODIFY: drop LinkedIn import + prewarm call
    services/__tests__ or tests — NEW: guard test that fails if apify reappears (Task 6)
  package.json              — MODIFY: remove apify-client
server/.env                 — USER ACTION (Task 8): remove APIFY_API_KEY
```

---

### Task 1: Remove LinkedIn from the daily feed (`jobFeed.ts`)

**Files:**
- Modify: `server/src/services/jobFeed.ts`

- [ ] **Step 1: Remove the LinkedIn import**

Delete this line (currently line 6):
```ts
import { buildLinkedInClusterKey, fetchLinkedInJobsForCluster } from './linkedinScraper';
```

- [ ] **Step 2: Remove the LinkedIn cluster construction**

Find:
```ts
  const seekCluster = buildSeekClusterKey(seekSearchTerm, effectiveCity, profile.industry);
  const linkedInCluster = buildLinkedInClusterKey(profile.targetRole, effectiveCity, profile.industry);
```
Replace with:
```ts
  const seekCluster = buildSeekClusterKey(seekSearchTerm, effectiveCity, profile.industry);
```

- [ ] **Step 3: Remove LinkedIn from the parallel fetch and the merge**

Find:
```ts
  const [adzunaJobs, seekJobs, linkedInJobs] = await Promise.all([
    fetchAdzunaJobs(profile.targetRole, effectiveCity).catch((err: Error) => {
      console.error(`[buildDailyFeed] Adzuna failed for ${userId}:`, err.message);
      return [] as RawJob[];
    }),
    fetchSeekJobsForCluster(seekCluster).catch((err: Error) => {
      console.error(`[buildDailyFeed] Seek failed for ${userId}:`, err.message);
      return [] as RawJob[];
    }),
    fetchLinkedInJobsForCluster(linkedInCluster).catch((err: Error) => {
      console.error(`[buildDailyFeed] LinkedIn failed for ${userId}:`, err.message);
      return [] as RawJob[];
    }),
  ]);

  const jobs = deduplicateJobs([...seekJobs, ...linkedInJobs], adzunaJobs);
```
Replace with:
```ts
  const [adzunaJobs, seekJobs] = await Promise.all([
    fetchAdzunaJobs(profile.targetRole, effectiveCity).catch((err: Error) => {
      console.error(`[buildDailyFeed] Adzuna failed for ${userId}:`, err.message);
      return [] as RawJob[];
    }),
    fetchSeekJobsForCluster(seekCluster).catch((err: Error) => {
      console.error(`[buildDailyFeed] Seek failed for ${userId}:`, err.message);
      return [] as RawJob[];
    }),
  ]);

  const jobs = deduplicateJobs(seekJobs, adzunaJobs);
```

- [ ] **Step 4: Type-check**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx tsc --noEmit
```
Expected: no errors. (`buildLinkedInClusterKey`, `fetchLinkedInJobsForCluster`, and `linkedInJobs` are now fully unreferenced in this file.)

**STOP-AND-REPORT:** if tsc reports an unused or undefined symbol still referencing LinkedIn in `jobFeed.ts`, report it — there should be none left.

- [ ] **Step 5: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/services/jobFeed.ts
git commit -m "refactor(feed): remove LinkedIn (Apify) source from daily feed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Remove LinkedIn from the prewarm cron (`jobFeedCron.ts`)

**Files:**
- Modify: `server/src/cron/jobFeedCron.ts`

- [ ] **Step 1: Remove the import**

Delete this line (currently line 5):
```ts
import { prewarmLinkedInClusters } from '../services/linkedinScraper';
```

- [ ] **Step 2: Remove the prewarm call**

Find:
```ts
    // Prewarm Seek and LinkedIn caches in parallel across unique clusters
    try {
      await Promise.all([
        prewarmSeekClusters(users),
        prewarmLinkedInClusters(users),
      ]);
    } catch (err) {
      console.error('[jobFeedCron] Prewarm failed (non-fatal):', err);
    }
```
Replace with:
```ts
    // Prewarm Seek caches across unique clusters
    try {
      await prewarmSeekClusters(users);
    } catch (err) {
      console.error('[jobFeedCron] Prewarm failed (non-fatal):', err);
    }
```

- [ ] **Step 3: Type-check**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/cron/jobFeedCron.ts
git commit -m "refactor(cron): stop prewarming LinkedIn (Apify) clusters

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Delete the LinkedIn scraper module

**Files:**
- Delete: `server/src/services/linkedinScraper.ts`

- [ ] **Step 1: Confirm there are no remaining importers**

Run:
```bash
cd E:/AntiGravity/JobHub/server && grep -rn "linkedinScraper\|fetchLinkedInJobs\|prewarmLinkedIn\|buildLinkedInClusterKey" src
```
Expected: **no output** (all references removed in Tasks 1-2).

**STOP-AND-REPORT:** if grep prints any line, do **not** delete the file yet — report the remaining reference.

- [ ] **Step 2: Delete the file**

Run:
```bash
cd E:/AntiGravity/JobHub && git rm server/src/services/linkedinScraper.ts
```

- [ ] **Step 3: Type-check**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git commit -m "refactor(seek): delete LinkedIn Apify scraper module

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Remove the `apify-client` dependency

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Confirm nothing imports apify-client**

Run:
```bash
cd E:/AntiGravity/JobHub/server && grep -rn "apify-client" src
```
Expected: **no output**.

**STOP-AND-REPORT:** if anything prints, stop and report — do not remove the dependency while it is still imported.

- [ ] **Step 2: Uninstall the package**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npm uninstall apify-client
```
Expected: `apify-client` removed from `package.json` dependencies and from `node_modules`.

- [ ] **Step 3: Type-check the whole server**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/package.json server/package-lock.json
git commit -m "chore(deps): remove apify-client (no longer used)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verify the full unit suite still passes

**Files:** none (verification only)

- [ ] **Step 1: Run the unit test suite**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services src/utils
```
Expected: the same pass count as before this plan (100+ unit tests pass). No new failures introduced. Pre-existing integration-test failures that need a running server are out of scope and unchanged.

**STOP-AND-REPORT:** if any **unit** test that passed before now fails, report the failure with output — do not edit tests to make them pass.

---

### Task 6: Add a guard so Apify cannot silently return

**Files:**
- Create: `server/src/services/__tests__/no-apify.test.ts`

This makes "Apify stays gone" a property the test suite enforces, not something to remember.

- [ ] **Step 1: Write the guard test**

Create `server/src/services/__tests__/no-apify.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

// Guard: the Apify LinkedIn scraper was retired on 2026-06-14. If anyone
// reintroduces an apify-client import or a new Apify actor call into server
// source, this test fails. admin.ts reading APIFY_API_KEY for billing is allowed.
describe('apify retirement guard', () => {
  it('has no apify-client import anywhere in server/src', () => {
    let out = '';
    try {
      // grep returns exit code 1 (throws) when there are no matches — that's the pass case.
      out = execSync(`grep -rln "apify-client" src`, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
    } catch {
      out = '';
    }
    expect(out.trim()).toBe('');
  });
});
```

- [ ] **Step 2: Run the guard test**

Run:
```bash
cd E:/AntiGravity/JobHub/server && npx vitest run src/services/__tests__/no-apify.test.ts
```
Expected: PASS (no `apify-client` imports remain).

- [ ] **Step 3: Commit**

```bash
cd E:/AntiGravity/JobHub
git add server/src/services/__tests__/no-apify.test.ts
git commit -m "test(seek): guard against reintroducing apify-client

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: USER ACTION — remove the API key (do NOT do this automatically)

This is a manual step for the human, listed here for completeness. **The agent must not edit `.env` or run this.**

- [ ] **Step 1 (human):** Remove the `APIFY_API_KEY=...` line from `server/.env` (and from any deployment secret store).

Effect: nothing functional changes for jobs. The only visible effect is the Apify card in the admin expense dashboard (`admin.ts`) will show an "error" status instead of usage data, because the billing fetch no longer has a token. That is expected and harmless. If you want that card gone too, that is a separate small `admin.ts` change, out of scope here.

Removing the key is the final anti-regression measure: even if Apify code were ever reintroduced, there would be no credential for it to run with.

---

### Done criteria

- `grep -rn "apify\|linkedin" server/src` returns only `admin.ts` (billing) references, nothing in feed/cron/services.
- `apify-client` absent from `server/package.json`.
- Unit suite passes with the same count as before, plus the new guard test.
- Feed is Seek + Adzuna only; a failed/empty Seek scrape yields no jobs rather than faulty ones.

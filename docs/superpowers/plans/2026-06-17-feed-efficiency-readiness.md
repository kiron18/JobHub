# Feed: 3-Role Persistence + Scrape Cache + Readiness — Implementation Plan

> **For Kimi:** Execute top to bottom. TDD the pure logic (vitest, `cd server && npx vitest run <file>`). Verify route/component edits with `npx tsc --noEmit` + the manual check shown. **Obey every STOP-and-report guard.** Commit after each task.

**Goal:** Make the feed use all 3 scan-suggested roles, stop re-scraping identical (role, city, day) searches, and never render the focused view blank.

**Reference spec:** `docs/superpowers/specs/2026-06-17-feed-efficiency-readiness-design.md`

---

### Task 1: Persist the 3 scan titles to `targetRoles`

**Files:** Modify `server/src/routes/cv-scan.ts`

- [ ] **Step 1:** In the claim handler (~line 338), after `const targetRole = cleanTitles[0] || entry.result.inferredRole || null;`, add:
```ts
const targetRoles = cleanTitles.length > 0 ? cleanTitles : (targetRole ? [targetRole] : []);
```
- [ ] **Step 2:** In `profileData` (~line 341), add `targetRoles,` next to `targetRole,`.

**STOP-and-report guard B:** confirm the `targetRoles` Prisma column type accepts `string[]`. Run `grep -n "targetRoles" server/prisma/schema.prisma`. If it is `Json`, the array assignment is still fine; if it has a stricter type, adapt and report.

**STOP-and-report guard A:** check `server/src/routes/onboarding.ts:110,132` — it sets `targetRoles: [answers.targetRole]`. If onboarding is a live path, either carry the suggested titles there too or report it's legacy/dead. Do not leave two write paths that disagree.

- [ ] **Step 3:** `cd server && npx tsc --noEmit` → no new errors. Manual: complete a CV-scan claim, then check the DB row — `targetRoles` has 3 entries.

- [ ] **Step 4:** Commit
```bash
git add server/src/routes/cv-scan.ts
git commit -m "fix(feed): persist all 3 scan titles to targetRoles"
```

---

### Task 2: Schema — `Job.locationKey` + index

**Files:** Modify `server/prisma/schema.prisma`

- [ ] **Step 1:** In `model Job`, add `locationKey String?` and, in the index block, `@@index([searchRole, locationKey, feedDate])`.
- [ ] **Step 2:** `cd server && npx prisma migrate dev --name add_job_location_key` (STOP-and-report if `migrate dev` isn't the convention).
- [ ] **Step 3:** Commit
```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(feed): add Job.locationKey for cache lookups"
```

---

### Task 3: Populate `locationKey` + `jobRowToMergedJob` (TDD)

**Files:**
- Modify: `server/src/services/ingestion/mergeSources.ts` (set `locationKey` on each MergedJob) and `server/src/services/ingestion/persist.ts` (write `locationKey` on upsert)
- Create: `server/src/services/ingestion/cache.ts`
- Test: `server/src/services/ingestion/cache.test.ts`

- [ ] **Step 1: Write the failing test** `cache.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { jobRowToMergedJob } from './cache';

describe('jobRowToMergedJob', () => {
  it('reconstructs a MergedJob from a Job row + sources', () => {
    const row = {
      dedupKey: 'k', title: 'Registered Nurse', company: 'Health Co', normalizedCompany: 'health co',
      location: 'Sydney NSW', salary: null, description: 'd', descriptionHydrated: false, postedAt: null,
      relevanceScore: 0.9, lowRelevance: false, searchRole: 'Registered Nurse',
      sources: [
        { source: 'seek', sourceUrl: 'https://au.seek.com/job/1', sourceJobId: '1' },
        { source: 'adzuna', sourceUrl: 'https://adzuna/2', sourceJobId: null },
      ],
    };
    const m = jobRowToMergedJob(row as any);
    expect(m.title).toBe('Registered Nurse');
    expect(m.sources.map(s => s.source).sort()).toEqual(['adzuna', 'seek']);
    expect(m.descriptionHydrated).toBe(false);
  });
});
```
- [ ] **Step 2: Run, verify fail.** `cd server && npx vitest run src/services/ingestion/cache.test.ts` → FAIL.
- [ ] **Step 3: Implement** `server/src/services/ingestion/cache.ts`:
```ts
import type { MergedJob, MergedJobSource } from './mergeSources';

export function jobRowToMergedJob(row: any): MergedJob {
  return {
    dedupKey: row.dedupKey, title: row.title, company: row.company, normalizedCompany: row.normalizedCompany,
    location: row.location ?? null, salary: row.salary ?? null, description: row.description,
    descriptionHydrated: row.descriptionHydrated, postedAt: row.postedAt ?? null,
    relevanceScore: row.relevanceScore, lowRelevance: row.lowRelevance, searchRole: row.searchRole,
    sources: (row.sources ?? []).map((s: any): MergedJobSource => ({
      source: s.source, sourceUrl: s.sourceUrl, sourceJobId: s.sourceJobId ?? null,
    })),
  };
}
```
- [ ] **Step 4: Run, verify pass.** Same command → PASS.
- [ ] **Step 5:** In `mergeSources.ts`, add `locationKey: locationKey(job.location)` to each `MergedJob` it builds (the `locationKey` helper is already imported there via dedupKey; if not, import from `./locationKey`). Add `locationKey: string | null` to the `MergedJob` interface. In `persist.ts` `prisma.job.upsert`, add `locationKey: m.locationKey` to both `create` and `update`.
- [ ] **Step 6: Verify compile.** `cd server && npx tsc --noEmit` → clean.
- [ ] **Step 7: Commit**
```bash
git add server/src/services/ingestion/cache.ts server/src/services/ingestion/cache.test.ts server/src/services/ingestion/mergeSources.ts server/src/services/ingestion/persist.ts
git commit -m "feat(feed): locationKey on Job + jobRowToMergedJob reconstruction"
```

---

### Task 4: Cache read in the orchestrator

**Files:** Modify `server/src/services/ingestion/runIngestion.ts`; modify `server/src/config/ingestion.ts`

- [ ] **Step 1:** Add to `config/ingestion.ts`: `export const CACHE_MIN_HITS = 3;`
- [ ] **Step 2:** In `runIngestionForTitle`, before the adapter fan-out, add a cache read (use the same `prisma`, `todayStr`/`feedDate` source that `persistMergedJobs` uses, and `locationKey` from `./locationKey`):
```ts
const cached = await prisma.job.findMany({
  where: { searchRole: role, locationKey: locationKey(location), feedDate: todayStr() },
  include: { sources: true },
});
if (cached.length >= CACHE_MIN_HITS) {
  const jobs = cached.map(jobRowToMergedJob);
  await persistRunMeta({ role, location, trigger, source: 'cache', count: jobs.length }); // write a SourceResult status:'cache', creditsUsed:0
  return { jobs, reports: [{ source: 'cache' as any, rawCount: jobs.length, blocked: false, errorMessage: null, latencyMs: 0, creditsUsed: 0 }] };
}
```
Import `jobRowToMergedJob` from `./cache`, `CACHE_MIN_HITS` from config, `locationKey` from `./locationKey`. For the SourceResult write, reuse the existing `persistMergedJobs` path or a minimal run/result writer — match how `persistMergedJobs` records a run (do not invent a new table).

**STOP-and-report guard C:** confirm `todayStr()`/`feedDate` format matches `persistMergedJobs`. `grep -n "feedDate" server/src/services/ingestion/persist.ts`. If formats differ, reconcile and report (a mismatch = cache always misses).

- [ ] **Step 3: Verify compile.** `cd server && npx tsc --noEmit` → clean.

**STOP-and-report guard D (round-trip):** run `npx tsx src/scripts/run_ingestion.ts "Registered Nurse" "Sydney NSW"` twice same-day. Report both summaries: first should scrape (credits > 0), second should report a `cache` source with 0 credits. Do not proceed to wider use until shown.

- [ ] **Step 4: Commit**
```bash
git add server/src/services/ingestion/runIngestion.ts server/src/config/ingestion.ts
git commit -m "feat(feed): read Job table as a (role,city,day) scrape cache"
```

---

### Task 5: `FeedStateNotice` shared component

**Files:** Create `src/components/jobs/FeedStateNotice.tsx`

- [ ] **Step 1: Implement** (uses `warm` tokens; mirror the copy already in `JobFeedPage.tsx`'s building/profileIncomplete/empty blocks):
```tsx
import { warm } from '../../lib/theme/warmTokens';
import { NavLink } from 'react-router-dom';

export function FeedStateNotice({ state }: { state: 'building' | 'profileIncomplete' | 'empty' }) {
  const box: React.CSSProperties = { background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
    borderRadius: 16, padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 };
  if (state === 'building') return (
    <div style={box}>
      <div style={{ width: 32, height: 32, border: `2px solid ${warm.colors.accentPetrol}30`, borderTopColor: warm.colors.accentPetrol, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ margin: 0, fontWeight: 700, color: warm.colors.textPrimary }}>Finding roles that fit you…</p>
    </div>
  );
  if (state === 'profileIncomplete') return (
    <div style={box}>
      <p style={{ margin: 0, fontWeight: 700, color: warm.colors.textPrimary }}>Set your targets to start your feed</p>
      <p style={{ margin: 0, fontSize: 14, color: warm.colors.textSecondary }}>Add your target role and city so we can line up matches.</p>
      <NavLink to="/workspace" style={{ padding: '8px 16px', borderRadius: 12, background: `${warm.colors.accentPetrol}20`,
        border: `1px solid ${warm.colors.accentPetrol}30`, color: warm.colors.accentPetrol, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
        Complete your profile →
      </NavLink>
    </div>
  );
  return (
    <div style={box}>
      <p style={{ margin: 0, fontWeight: 700, color: warm.colors.textSecondary }}>No strong matches today</p>
      <p style={{ margin: 0, fontSize: 14, color: warm.colors.textMuted }}>Try broadening your target role, or check back tomorrow.</p>
    </div>
  );
}
```
- [ ] **Step 2: Verify compile.** `npx tsc --noEmit` (root) → clean.
- [ ] **Step 3: Commit**
```bash
git add src/components/jobs/FeedStateNotice.tsx
git commit -m "feat(feed): shared FeedStateNotice component"
```

---

### Task 6: Wire readiness states into StrategyHub (and JobFeedPage)

**Files:** Modify `src/pages/StrategyHub.tsx`; optionally `src/pages/JobFeedPage.tsx` (swap its inline blocks for `FeedStateNotice` to DRY)

- [ ] **Step 1:** Import `FeedStateNotice` in `StrategyHub.tsx`. Replace the bare gate at ~line 848:
```tsx
{feedData?.building ? <FeedStateNotice state="building" />
 : feedData?.profileIncomplete ? <FeedStateNotice state="profileIncomplete" />
 : feedJobs.length > 0 ? (
     <DimPeer style={{ marginBottom: 32 }}>
       <p style={{/* existing "Curated roles for you" heading */}}>Curated roles for you</p>
       <FocusedApplyView jobs={feedJobs} />
     </DimPeer>
   )
 : <FeedStateNotice state="empty" />}
```

**STOP-and-report guard E:** confirm `feedData` in StrategyHub exposes `building` / `profileIncomplete` (same shape as JobFeedPage's `feedData`). If StrategyHub fetches the feed differently, adapt to its real fields and report — do not invent flags.

- [ ] **Step 2: Verify compile + manual.** `npx tsc --noEmit` → clean. Manual: with an empty/incomplete profile, the home page shows the CTA notice (not blank); with jobs, the focused card shows.
- [ ] **Step 3:** (DRY, optional) Replace JobFeedPage's inline building/profileIncomplete/empty markup with `FeedStateNotice` so the two surfaces share one source.
- [ ] **Step 4: Commit**
```bash
git add src/pages/StrategyHub.tsx src/pages/JobFeedPage.tsx
git commit -m "feat(feed): readiness states on home, never blank"
```

---

## Self-Review (by author)
- **Spec coverage:** Part 1 persistence (T1), Part 2 cache (T2–4), Part 3 readiness (T5–6). All mapped.
- **Guards:** targetRoles column type + onboarding double-write (T1); migrate convention (T2); feedDate format match + cache round-trip (T4); StrategyHub feed-flag shape (T6).
- **Type consistency:** `jobRowToMergedJob(row)→MergedJob`, `MergedJob.locationKey` added in interface + set in merge + written in persist + queried in cache; `CACHE_MIN_HITS` from config used in orchestrator.

## The one to watch
Task 1 is the actual user-visible fix — without it the feed scrapes 1 role forever. Tasks 2–4 only save money; Task 6 only fixes the blank screen. If time is short, Task 1 alone restores the 3-role feed.

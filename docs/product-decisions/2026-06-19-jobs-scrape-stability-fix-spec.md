# Jobs Scrape — Stability & Latency Fix Spec (PART 2)

Date: 2026-06-19
Author: Claude (diagnosis + spec). Executor: DeepSeek + human (for DB commands).
Status: READY FOR EXECUTION.
Supersedes the doc-correction item (FIX 3) of Part 1 — see FIX E below.

> **EXECUTION RULES (read first, non-negotiable)**
> 1. ZERO-LATITUDE. Do exactly what each step says. No extra refactors, renames, or features.
> 2. **[STOP]** = stop, paste the requested output/diff into chat, wait for human approval.
> 3. DeepSeek runs NO database mutation (`migrate deploy/resolve/dev`, `db push`, raw SQL) on
>    ANY environment. DB mutations are HUMAN (kiron) steps; the spec gives exact commands.
> 4. If anything on disk differs from what this spec expects, **[STOP]** and report. Do not adapt.
> 5. All user-facing copy + LLM prompts are Claude-owned. This spec changes NONE. (The SEEK
>    parse prompt text is NOT touched — only the model id.)

---

## 0. Context — what is already true (ground truth, do not re-investigate)

- **Part 1 (fan-out) is DONE and verified working.** Latest logs: `POST /claim 200 1974ms`
  (was 47s), a single `[job-feed] FAST build`, one location, no `Gosford,` / `, Australia`
  variants. Do not touch the Part 1 changes.
- **Indeed + Jora adapters now EXIST and are enabled** (`src/config/ingestion.ts` has
  `indeed: true, jora: true`, and both returned jobs in the logs). This is good (more sources).
  **Do NOT remove them.** (This reverses Part 1's FIX 3 doc claim — see FIX E.)
- The frontend feed page is already patient: `src/pages/JobFeedPage.tsx:63` polls every 60s up
  to 8 times (~8 min) while `building`. So a slow build is tolerated **as long as the server
  stays up**. Do not change the polling.

### The two remaining blockers (root causes of "still nothing")

1. **PRIMARY — server crash-loop from a failed migration.**
   `20250616000002_add_sponsor_job_model` runs `CREATE TABLE "SponsorJob"` with NO
   `IF NOT EXISTS`; the table already exists → `42P07` → `P3018` → the migration is recorded
   as failed → subsequent deploys hit `P3009`. The Railway `preDeployCommand`
   (`scripts/migrate-safe.js`) exits non-zero on the first `P3018` (it only skips `P3009` and
   DB-unreachable), so the deploy fails and Railway restarts (`ON_FAILURE`) → `SIGTERM`.
   **Interaction that produces "nothing":** the feed build is a ~99s in-process async job; each
   restart kills it mid-flight before `jobFeedItem` is written, so `builtToday` stays 0 and the
   next load starts another doomed build. Jobs never persist.

2. **SECONDARY — the build takes ~99s.** Dominated by the SEEK parse: `parseSeekMarkdown.ts`
   sends the markdown to `meta-llama/llama-3.3-70b-instruct` (the constant is misleadingly named
   `HAIKU_MODEL` but it is Llama). That call runs ~40-50s per role under concurrency. Plus
   per-row persist (~13s). Slow, and a wide window for a restart to interrupt.

---

## FIX A — Stop the migration crash-loop (CRITICAL; do this first)

### A1. Make the SponsorJob migration idempotent
File: `server/prisma/migrations/20250616000002_add_sponsor_job_model/migration.sql`

Replace `CREATE TABLE "SponsorJob" (` with `CREATE TABLE IF NOT EXISTS "SponsorJob" (`.
Replace each index line so all four use `IF NOT EXISTS`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS "SponsorJob_externalId_key" ON "SponsorJob"("externalId");
CREATE INDEX IF NOT EXISTS "SponsorJob_active_idx" ON "SponsorJob"("active");
CREATE INDEX IF NOT EXISTS "SponsorJob_visaSponsorship_idx" ON "SponsorJob"("visaSponsorship");
CREATE INDEX IF NOT EXISTS "SponsorJob_publishedAt_idx" ON "SponsorJob"("publishedAt");
```
Leave the column definitions and the `CONSTRAINT ... PRIMARY KEY` line unchanged.

### A2. Harden `migrate-safe.js` so a single bad migration can never take the app down
File: `server/scripts/migrate-safe.js`

Find:
```js
  if (out.includes('P3009')) {
    console.log('\n[migrate-safe] P3009 detected — schema already in sync, skipping.');
    process.exit(0);
  }
```
Replace with:
```js
  if (out.includes('P3009')) {
    console.log('\n[migrate-safe] P3009 detected — failed migration already in DB; starting app anyway.');
    process.exit(0);
  }
  if (out.includes('P3018')) {
    console.error('\n[migrate-safe] P3018 — a migration failed to apply. Starting app anyway so the service stays up; this migration MUST be resolved (see prisma migrate resolve).');
    process.exit(0);
  }
```
Rationale: availability over crash-loop. A failed migration is logged loudly but never blocks
startup. The actual failed migration is still fixed by A1 + A3.

**[STOP] after A1+A2.** Paste:
`git diff server/prisma/migrations/20250616000002_add_sponsor_job_model/migration.sql server/scripts/migrate-safe.js`

### A3. [HUMAN DB STEP] Clear the failed migration, then redeploy
Do NOT have DeepSeek run these. Give them to kiron to run after A1+A2 are merged/deployed.

Against the affected database(s) — **staging first, then production**:
```bash
cd server
# 1. Confirm current state (read-only):
npx prisma migrate status
# 2. Mark the failed migration as rolled-back so the now-idempotent version can re-run:
npx prisma migrate resolve --rolled-back 20250616000002_add_sponsor_job_model
# 3. Re-run migrations (the idempotent CREATE TABLE IF NOT EXISTS skips the existing table,
#    and adds the four indexes if they are missing):
npx prisma migrate deploy
# 4. Confirm clean:
npx prisma migrate status   # should show all migrations applied, none failed
```
If `migrate status` shows OTHER failed migrations (e.g. the earlier
`20250616000001_add_crm_email_system`), apply the same idempotent-then-resolve pattern to each,
oldest first. **[STOP]** and report status output before/after.

### A4. Systemic note (no code) — record in the doc
The same failure has now hit three migrations (`add_followup_columns` era, `add_crm_email_system`,
`add_sponsor_job_model`): non-idempotent `CREATE TABLE` against a schema previously changed via
`db push`. Going forward: never `db push` to staging/prod, and write `CREATE TABLE IF NOT EXISTS`
/ `ADD COLUMN IF NOT EXISTS` in every migration. Capture this in FIX E.

---

## FIX B — SEEK parse latency (Llama → fast Claude)

File: `server/src/services/ingestion/parseSeekMarkdown.ts`

**B1.** Replace line 5:
```ts
const HAIKU_MODEL = 'meta-llama/llama-3.3-70b-instruct';
```
with:
```ts
// Fast structured-extraction model for SEEK card parsing. Env-overridable.
const PARSE_MODEL = process.env.SEEK_PARSE_MODEL || 'anthropic/claude-haiku-4-5';
```
And update the call site (line 21) from `..., HAIKU_MODEL)` to `..., PARSE_MODEL)`. Change
nothing else in this file (the prompt and JSON handling stay exactly as-is).

**B2. [STOP — verify the model slug before relying on it].** The codebase calls models through
the OpenRouter-style slug used by `callClaude` (default `anthropic/claude-sonnet-4-5`). Confirm
`anthropic/claude-haiku-4-5` is accepted by the configured provider:
- Run a one-off scrape that exercises `parseSeekMarkdown` on staging, and confirm the logs show
  `[SEEK Parse] Parsed N cards` (N > 0) and that the parse step is now seconds, not ~50s.
- If the slug errors (logs show `[SEEK Parse] Error`), set the env var
  `SEEK_PARSE_MODEL=` empty / unset and instead pass the existing working default by changing
  the fallback to `'anthropic/claude-sonnet-4-5'`, then re-test.
Paste the relevant `[SEEK Parse]` log lines. Do not proceed until N > 0 is confirmed.

---

## FIX C — Build resilience (small, defense-in-depth)

No code change required. Rationale, recorded here so it is a conscious decision: once FIX A keeps
the server up, the existing per-role `prisma.job` cache (written by `persistMergedJobs` as each
role completes) plus the patient frontend poll (8×60s) are sufficient — an interrupted build
re-runs and hits cache for already-scraped roles. **Do not restructure `buildDailyFeedMultiSource`.**

---

## FIX D — Fix the double-comma location bug

File: `server/src/services/ingestion/locationNormalize.ts`, line 57.

The current regex inserts a comma before the state even when one already exists, producing
`Cannington,, WA` (seen in logs as `where=Cannington%2C%2C%20WA`).

Replace:
```ts
  normalized = normalized.replace(/\s+([A-Z]{2,3})$/, ', $1');
```
with:
```ts
  // Normalize whatever separator precedes the state (space, comma, or both) to exactly ", ".
  normalized = normalized.replace(/[,\s]+([A-Z]{2,3})$/, ', $1');
```

**[STOP] after D.** Paste `git diff server/src/services/ingestion/locationNormalize.ts` and add a
one-line test result: in a node REPL or quick test, `normalizeLocation('Cannington, WA')` →
`'Cannington, WA'` (no double comma) and `normalizeLocation('Melbourne VIC')` → `'Melbourne, VIC'`.

---

## FIX E — Correct the doc (replaces Part 1 FIX 3)

Edit `docs/product-decisions/Jobs Scrape.txt`:
- Adapter table: Indeed (`indeed.ts`) and Jora (`jora.ts`) **DO exist and are active** (Firecrawl-
  based). Active sources: adzuna (API), seek (Firecrawl + LLM parse), indeed (Firecrawl), jora
  (Firecrawl). jsearch disabled. Update `INGESTION_SOURCES` block to match
  `server/src/config/ingestion.ts` (`adzuna, jsearch:false, seek, indeed, jora, cache`).
- Triggers: the ONLY scrape trigger is the job-feed builder (`GET /api/job-feed/feed` +
  `/refresh`). Add: "cv-scan.ts no longer triggers scraping (head-start removed 2026-06-19)."
- Add a "Migration hygiene" note capturing FIX A4 (idempotent migrations; no `db push` on
  staging/prod).

**[STOP] after E.** Paste `git diff "docs/product-decisions/Jobs Scrape.txt"`.

---

## Final verification checklist (all must pass before declaring done)

- [ ] `npx tsc --noEmit` clean in `server/`; frontend build clean.
- [ ] `cd server && npm test` passes (no test referenced the removed/renamed symbols; if one does,
      **[STOP]** and report — do not edit tests without approval).
- [ ] FIX A3 done by human: `npx prisma migrate status` shows NO failed migrations on staging
      AND production; the deploy completes without `SIGTERM` / `P3009` / `P3018` in logs.
- [ ] After a fresh scan→claim on staging: server does NOT restart during the build; exactly one
      `[job-feed] FAST build` runs; jobs are inserted; the feed page shows jobs within the poll window.
- [ ] `[SEEK Parse]` step is seconds, not ~50s (FIX B verified, N > 0 cards).
- [ ] No `Cannington,, WA`-style double commas in `[job-feed/feed]` logs (FIX D).
- [ ] Doc corrected (FIX E).

## Out of scope (separate spec; do NOT implement here)
- SEEK Firecrawl bot-challenge mitigation (`isBotChallenge=true` still appeared).
- Per-row persist speed (~13s) optimization / batching.
- Empty-state UX redesign / geographic fallback / "notify me".

# Analysis Determinism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Re-analysing the same job + unchanged profile returns the identical result (surviving restarts); fresh result when the profile changes. Also steadies résumé/cover-letter generation via temperature 0.

**Architecture:** Two layers. (1) Default `callLLM` temperature to 0 (threaded through `callLLMWithRetry`). (2) Cache the parsed `/analyze/dual` LLM output in a new `CandidateProfile.analysisCache` JSON column, keyed by a SHA-256 of the prompt (a complete fingerprint of all inputs). Cache logic lives in a small pure module with unit tests. No destructive migration (uses the existing `ensureColumns` `ADD COLUMN IF NOT EXISTS` pattern).

**Spec:** `docs/superpowers/specs/2026-05-31-analysis-determinism-design.md`

---

## ⚠️ Execution guardrails (READ FIRST)

- Server uses **vitest** (`cd server && npx vitest run <file>`). Verify typecheck with
  `cd server && npx tsc --noEmit`.
- Do tasks in order (1 → 5). Task 4 imports the module from Task 2 and the column from Task 3.
- Edit only the blocks shown. No global find/replace. If a quoted block isn't found verbatim,
  STOP and report.
- Do NOT reorder or remove the `checkAccess` call in `/analyze/dual` — leave it exactly where
  it is. Touching the access gate is out of scope.
- Commit after each task.

---

## Task 1: Default `callLLM` temperature to 0 (Layer 1)

**Files:** `server/src/services/llm.ts`, `server/src/utils/callLLMWithRetry.ts`

- [ ] **Step 1: Add the `temperature` param to `callLLM` and the request body**

In `server/src/services/llm.ts`, change the signature:

```ts
export async function callLLM(prompt: string, jsonMode: boolean = true) {
```
to:
```ts
export async function callLLM(prompt: string, jsonMode: boolean = true, temperature: number = 0) {
```

Then in the axios request body, find:

```ts
                model: 'meta-llama/llama-3.3-70b-instruct',
                max_tokens: 8192,
```
and insert a `temperature` line:
```ts
                model: 'meta-llama/llama-3.3-70b-instruct',
                temperature,
                max_tokens: 8192,
```

- [ ] **Step 2: Thread `temperature` through `callLLMWithRetry`**

In `server/src/utils/callLLMWithRetry.ts`, change:

```ts
export async function callLLMWithRetry(
  prompt: string,
  isJson: boolean,
  maxRetries = 3
): Promise<string> {
```
to:
```ts
export async function callLLMWithRetry(
  prompt: string,
  isJson: boolean,
  maxRetries = 3,
  temperature = 0
): Promise<string> {
```

And change the call `return await callLLM(prompt, isJson);` to:

```ts
      return await callLLM(prompt, isJson, temperature);
```

- [ ] **Step 3: Typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: exit 0. (No call-site changes needed — all callers inherit temperature 0.)

- [ ] **Step 4: Commit**

```bash
git add server/src/services/llm.ts server/src/utils/callLLMWithRetry.ts
git commit -m "fix(llm): default callLLM temperature to 0 for deterministic output"
```

---

## Task 2: Pure cache module + unit tests (TDD)

**Files:** Create `server/src/lib/analysisCache.ts`, `server/src/lib/analysisCache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/lib/analysisCache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readAnalysisCache, writeAnalysisCache } from './analysisCache';

const TTL = 1000;

describe('readAnalysisCache', () => {
  it('returns the analysis on a fresh hit', () => {
    const cache = { h1: { analysis: { pct: 60 }, at: 100 } };
    expect(readAnalysisCache(cache, 'h1', 200, TTL)).toEqual({ pct: 60 });
  });
  it('returns null on miss', () => {
    expect(readAnalysisCache({ h1: { analysis: {}, at: 100 } }, 'nope', 200, TTL)).toBeNull();
  });
  it('returns null when expired', () => {
    expect(readAnalysisCache({ h1: { analysis: {}, at: 100 } }, 'h1', 100 + TTL + 1, TTL)).toBeNull();
  });
  it('returns null for non-object cache', () => {
    expect(readAnalysisCache(null, 'h1', 0, TTL)).toBeNull();
    expect(readAnalysisCache(undefined, 'h1', 0, TTL)).toBeNull();
  });
});

describe('writeAnalysisCache', () => {
  it('adds an entry', () => {
    const next = writeAnalysisCache({}, 'h1', { pct: 40 }, 100);
    expect(next.h1).toEqual({ analysis: { pct: 40 }, at: 100 });
  });
  it('bounds to the most recent N entries', () => {
    let cache: any = {};
    for (let i = 0; i < 15; i++) cache = writeAnalysisCache(cache, `h${i}`, { i }, i);
    expect(Object.keys(cache).length).toBe(10);
    // newest kept, oldest evicted
    expect(cache['h14']).toBeDefined();
    expect(cache['h0']).toBeUndefined();
  });
  it('does not mutate the input object', () => {
    const input = { h1: { analysis: {}, at: 1 } };
    writeAnalysisCache(input, 'h2', {}, 2);
    expect(Object.keys(input)).toEqual(['h1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/lib/analysisCache.test.ts`
Expected: FAIL — cannot resolve `./analysisCache`.

- [ ] **Step 3: Implement the module**

Create `server/src/lib/analysisCache.ts`:

```ts
export interface CacheEntry {
  analysis: any;
  at: number;
}
export type AnalysisCache = Record<string, CacheEntry>;

const MAX_ENTRIES = 10;

/** Returns the cached analysis for `hash` if present and within `ttlMs`, else null. */
export function readAnalysisCache(cache: unknown, hash: string, now: number, ttlMs: number): any | null {
  if (!cache || typeof cache !== 'object') return null;
  const entry = (cache as AnalysisCache)[hash];
  if (!entry || typeof entry.at !== 'number') return null;
  if (now - entry.at >= ttlMs) return null;
  return entry.analysis ?? null;
}

/** Returns a NEW cache object with `hash` written and bounded to the newest MAX_ENTRIES. */
export function writeAnalysisCache(cache: unknown, hash: string, analysis: any, now: number): AnalysisCache {
  const base: AnalysisCache = (cache && typeof cache === 'object') ? { ...(cache as AnalysisCache) } : {};
  base[hash] = { analysis, at: now };
  const trimmed = Object.entries(base).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
  return Object.fromEntries(trimmed);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/lib/analysisCache.test.ts`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/analysisCache.ts server/src/lib/analysisCache.test.ts
git commit -m "feat(analyze): pure analysis-cache read/write helpers with tests"
```

---

## Task 3: Add the `analysisCache` column (no migration)

**Files:** `server/prisma/schema.prisma`, `server/src/index.ts`

- [ ] **Step 1: Add the field to the Prisma schema**

In `server/prisma/schema.prisma`, find the `model CandidateProfile {` block. Add a field
alongside the other optional JSON fields (e.g. near `positioningStatement Json?` if present,
otherwise anywhere inside the model before its closing `}`):

```prisma
  analysisCache Json?
```

If you cannot find `model CandidateProfile {`, STOP and report.

- [ ] **Step 2: Add the column to `ensureColumns`**

In `server/src/index.ts`, find (lines ~219–220):

```ts
        ADD COLUMN IF NOT EXISTS "coverLetterFilename2" TEXT,
        ADD COLUMN IF NOT EXISTS "documentsUpdatedAt" TIMESTAMP(3);
```
Replace with (change the `;` to `,` and add the new column):
```ts
        ADD COLUMN IF NOT EXISTS "coverLetterFilename2" TEXT,
        ADD COLUMN IF NOT EXISTS "documentsUpdatedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "analysisCache" JSONB;
```

- [ ] **Step 3: Regenerate the Prisma client + typecheck**

Run: `cd server && npx prisma generate`
Expected: "Generated Prisma Client" success.
Run: `cd server && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/src/index.ts
git commit -m "feat(db): add CandidateProfile.analysisCache column via ensureColumns"
```

---

## Task 4: Wire the cache into `/analyze/dual`

**File:** `server/src/routes/analyze.ts`

- [ ] **Step 1: Add imports**

At the top of `server/src/routes/analyze.ts`, after the existing import lines (after
`import { callLLMWithRetry } from '../utils/callLLMWithRetry';`), add:

```ts
import crypto from 'crypto';
import { readAnalysisCache, writeAnalysisCache } from '../lib/analysisCache';
```

- [ ] **Step 2: Replace the LLM-call block with a cache-wrapped version**

In the `/dual` handler, find this exact block (the prompt build through the parse, ~lines
462–478):

```ts
        const prompt = DUAL_SIGNAL_PROMPT({ jobDescription, positioningStatement, achievements: achievementBank, hardGapHints });

        let raw;
        try {
            raw = await callLLMWithRetry(prompt, true);
        } catch (err: any) {
            console.error('[analyze/dual] LLM call failed:', err.message);
            return res.status(503).json({ error: 'Analysis is temporarily unavailable. Please try again in 30 seconds.' });
        }

        let analysis: any;
        try {
            analysis = parseLLMJson(raw);
        } catch (err: any) {
            console.error('[analyze/dual] failed to parse LLM JSON:', err?.message);
            return res.status(500).json({ error: 'Failed to process analysis. Please retry.' });
        }
```

Replace it with:

```ts
        const prompt = DUAL_SIGNAL_PROMPT({ jobDescription, positioningStatement, achievements: achievementBank, hardGapHints });

        // ── Determinism cache — keyed by a fingerprint of the whole prompt ──
        // Same JD + unchanged profile => identical prompt => identical result,
        // surviving restarts. Any profile/JD change alters the prompt and misses.
        const ANALYSIS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
        const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');

        let analysis: any = readAnalysisCache(
            (profile as any).analysisCache, promptHash, Date.now(), ANALYSIS_CACHE_TTL_MS,
        );

        if (!analysis) {
            let raw;
            try {
                raw = await callLLMWithRetry(prompt, true);
            } catch (err: any) {
                console.error('[analyze/dual] LLM call failed:', err.message);
                return res.status(503).json({ error: 'Analysis is temporarily unavailable. Please try again in 30 seconds.' });
            }
            try {
                analysis = parseLLMJson(raw);
            } catch (err: any) {
                console.error('[analyze/dual] failed to parse LLM JSON:', err?.message);
                return res.status(500).json({ error: 'Failed to process analysis. Please retry.' });
            }
            const nextCache = writeAnalysisCache((profile as any).analysisCache, promptHash, analysis, Date.now());
            prisma.candidateProfile.update({
                where: { userId } as any,
                data: ({ analysisCache: nextCache } as any),
            }).catch((e: any) => console.warn('[analyze/dual] cache persist failed:', e?.message));
        }
```

Everything after this (normalise/clamp at line ~480 onward) is unchanged and uses `analysis`.

- [ ] **Step 3: Typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: exit 0. If it errors on `analysisCache` not existing on the Prisma type, Task 3
Step 3 (`prisma generate`) was not run — STOP and report.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/analyze.ts
git commit -m "feat(analyze): cache dual-signal result by prompt hash for determinism"
```

---

## Task 5: Verify + smoke

- [ ] **Step 1: Server checks**

Run: `cd server && npx vitest run src/lib/analysisCache.test.ts` → PASS
Run: `cd server && npx tsc --noEmit` → exit 0
Run (repo root): `npx tsc --noEmit -p tsconfig.json` → exit 0 (no client change, sanity only)

- [ ] **Step 2: Full server suite (no new regressions)**

Run: `cd server && npx vitest run`
Expected: no test that passed before now fails. Pre-existing failures (Resend key, seekScraper,
dist/ CommonJS) may remain — if a NEW failure appears, STOP and report.

- [ ] **Step 3: Manual smoke (record pass/fail; needs running app)**

1. Analyse a job → note the % and the gaps.
2. Analyse the **same** job again (or re-paste) → **identical %** and **identical gaps**.
3. Add/bridge an achievement (changes the profile) → analyse again → result **changes**
   (cache correctly invalidated by the new prompt).
4. Generate a résumé twice for the same job → materially consistent wording (temperature 0).

Any fail → STOP and report.

---

## Self-review notes (author)

- **Spec coverage:** Layer 1 (temperature) → Task 1; cache helpers → Task 2; column → Task 3;
  wiring → Task 4.
- **No destructive migration** — `ADD COLUMN IF NOT EXISTS` only; `prisma generate` regenerates
  the client.
- **checkAccess untouched** — guardrail repeated; not reordered.
- **Type safety:** `(profile as any).analysisCache` and `data: ({ ... } as any)` guard against
  stale Prisma types if `prisma generate` is skipped, but Task 3 Step 3 runs it regardless.
- **Cache key = prompt hash** → self-invalidating on any input change; 30-day TTL ages out
  entries after a prompt-template edit.

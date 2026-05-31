# Analysis Determinism (QA #4)

**Date:** 2026-05-31
**Status:** Approved (design)

## Problem

Re-running the same job through `/analyze/dual` produces different results — different match
% and different gaps each run (QA 3: same job gave 60% then 40%; QA notes: "the gaps are
totally new" after a server restart). This erodes trust ("it looks random").

## Root cause (verified in code)

`/analyze/dual` → `callLLMWithRetry` → `callLLM` (`server/src/services/llm.ts:32`). **`callLLM`
sets no `temperature`**, so OpenRouter uses Llama 3.3 70B's default (~0.7–1.0) → high variance.
Two compounding factors:
1. **Non-zero temperature** → same input, different output every call. (Note: `callClaude` and
   `callPerplexity` both already set `temperature: 0`; only `callLLM` was missed — and `callLLM`
   also executes résumé + cover-letter Stage 2, so this drives generation variance too.)
2. **No caching** → a restart or re-paste recomputes from scratch; nothing survives.

## Goal

Make re-analysing the same job + unchanged profile return the **identical** result, surviving
restarts — while a genuine profile change still yields a fresh (improved) analysis. Also steady
résumé/cover-letter generation as a side benefit.

Out of scope: Pinecone null-metric bug; Llama→Claude prose upgrade (pricing decision).

## Layer 1 — pin determinism at the source

`server/src/services/llm.ts` + `server/src/utils/callLLMWithRetry.ts`.

- Add an optional `temperature` to `callLLM(prompt, jsonMode, temperature = 0)` and include
  `temperature` in the axios request body. **Default 0** — matching `callClaude`/`callPerplexity`.
- Thread an optional `temperature` through `callLLMWithRetry(prompt, isJson, maxRetries, temperature)`.
- No call-site changes required: every existing `callLLM`/`callLLMWithRetry` caller (analysis,
  résumé Stage 2, cover-letter Stage 2, parsing, extraction) inherits `temperature: 0`. This is
  the intended behaviour — all of these are structured/factual tasks that want determinism.

**Behavioural note (flag for smoke test):** this changes the default temperature for ALL Llama
calls from ~0.7 to 0. Expected effect: more consistent, slightly less "creative" output —
desirable for résumés/analysis. Smoke must confirm generation quality didn't regress.

Temperature 0 is not a *hard* guarantee (providers have minor float nondeterminism; a model
version bump shifts output), which is why Layer 2 exists.

## Layer 2 — persistent result cache (the guarantee)

Cache the parsed LLM analysis object keyed by a **hash of the prompt string**. Because the
prompt already encodes the positioning statement, achievement bank, hard-gap hints, and the JD,
the hash is a complete fingerprint of the inputs — it self-invalidates whenever the profile or
JD changes (no separate profile-signature needed).

**Storage — reuse the `ensureColumns` pattern (no migration):**
- `schema.prisma`: add `analysisCache Json?` to `CandidateProfile`.
- `server/src/index.ts` `ensureColumns()`: add
  `ADD COLUMN IF NOT EXISTS "analysisCache" JSONB` to the `CandidateProfile` ALTER block.
- Shape: `{ [promptHash: string]: { analysis: <parsed LLM object>, at: number } }`.
- Bounded: keep the most recent 10 entries (evict oldest by `at`); ignore entries older than
  30 days on read.

**Flow change in `/analyze/dual`** (after `const prompt = DUAL_SIGNAL_PROMPT(...)` is built,
~line 462):
1. `promptHash = sha256(prompt)`.
2. Look up `profile.analysisCache?.[promptHash]`. If present and `at` within 30 days →
   `analysis = entry.analysis`, **skip the LLM call** entirely.
3. On miss → existing LLM call + `parseLLMJson` → `analysis`; then write the entry back into
   `analysisCache` (bounded to 10) via `prisma.candidateProfile.update`.
4. Everything after (normalise/clamp, duplicate detection, enrichment candidates, response
   assembly) runs **unchanged** on `analysis`.

**Deliberately NOT changed:** `checkAccess` (the analysis quota gate, ~line 427) stays exactly
where it is and is NOT reordered. Cache hits still pass through it. Rationale: reordering an
access-control gate is a security risk not worth taking for a quota optimisation; determinism
is achieved regardless. (A cache hit consuming quota is acceptable.)

**Volatile bits stay fresh:** `duplicate` detection and `enrichmentCandidates` are recomputed
live on every request (they're cheap, non-LLM, and depend on other state) — only the
LLM-derived `analysis` is cached. This keeps duplicate warnings current while fixing the gap/%
churn.

## Files touched

| File | Change |
|---|---|
| `server/src/services/llm.ts` | `callLLM` gains `temperature = 0` param, added to request body |
| `server/src/utils/callLLMWithRetry.ts` | thread optional `temperature` through to `callLLM` |
| `server/prisma/schema.prisma` | `analysisCache Json?` on `CandidateProfile` |
| `server/src/index.ts` | `ensureColumns`: `ADD COLUMN IF NOT EXISTS "analysisCache" JSONB` |
| `server/src/routes/analyze.ts` | prompt-hash cache lookup/store around the `/dual` LLM call |

No destructive migration. No client changes.

## Testing

- **Unit (vitest):** a small pure hash helper if extracted; otherwise covered by integration.
- **Integration (vitest, mocked LLM):** POST `/analyze/dual` twice with the same body + same
  mocked profile → assert the LLM mock is called **once** (second served from cache) and both
  responses' `fitBands` are identical. Change the JD → assert the LLM mock is called again.
- **Manual smoke:** analyse a job twice → identical % and identical gaps. Add an achievement →
  re-analyse → result changes (cache correctly invalidated). Regenerate a résumé twice →
  materially consistent (temperature 0 holds).

## Risks

- **Global temperature change** is the main behavioural risk — mitigated by: temp 0 is already
  the norm for the other two LLM helpers, all `callLLM` consumers are structured tasks, and the
  smoke step explicitly checks generation quality.
- **Cache staleness vs. correctness:** keyed on the full prompt, so any real input change misses
  the cache — staleness is not possible for changed inputs. The 30-day TTL guards against an
  unbounded stale entry after a prompt-template edit (a template change also changes the hash,
  so old entries simply never match and age out).

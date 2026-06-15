# SPEC — CV Gap Scan (resume-only, no-auth, fast)

**Date:** 2026-06-02
**Status:** Ready to build
**Execution note:** This is a ZERO-LATITUDE spec. Do exactly what is written. Where you see **🛑 STOP**, halt and report to the requester instead of improvising. Do not refactor, rename, or "improve" anything outside the files listed. Do not touch `diagnosticReport.ts`, `onboarding.ts`, or any auth middleware.

---

## 0. Goal

A public endpoint + UI that takes **only a resume file** (no email, no auth, no other questions) and returns a fast, specific, accurate "CV Gap Report": a 0–100 score and 4–6 gap items with severity. Render it in the existing `GapReportPreview` visual on `/mock-landing`.

**Keyword strategy decision:** PATH (a) — LLM-inferred target role + expected keywords. PATH (b) is Appendix B, not built in v1.

---

## 0.5 THE GOVERNING CONSTRAINT — the 6-second read

This report is a **gut-punch, not a document**. The user has no time and no emotional bandwidth. The entire report must be readable in **under 6 seconds** and must make them feel "this knows *exactly* what's wrong with *my* resume, and these fixes are obvious wins."

Everything below serves this. Concretely:
- **4–5 items, never more.** (The reference screenshot has 4.)
- Each item is a **tight verdict**, ≤ **64 characters**, one line, **no trailing period**, phrased as a fact about *their* resume — not advice. Match this register exactly:
  - ✅ `Opening bullet leads with a duty, not an outcome`
  - ✅ `Missing 4 of 7 keywords the ATS filters on`
  - ✅ `No quantified result in your last 2 roles`
  - ✅ `Strong, specific job titles — keep these`
  - ❌ `You should consider adding more quantifiable achievements to strengthen impact` (advice, generic, too long)
- The displayed line does NOT quote resume text verbatim (that makes it long). Grounding/accuracy is carried by a **separate hidden `evidence` field** (§1), used for the accuracy eval and a future "show me the line" expansion — never shown in the card.

If an item can't be both (a) ≤64 chars as a verdict and (b) grounded in a real, locatable element of their resume, drop it.

## 1. Response contract (FROZEN — do not change shape)

```ts
// server/src/services/cvGapScan.ts → exported type
export interface CvGapItem {
  severity: 'critical' | 'warning' | 'good';
  text: string;     // DISPLAYED. Tight verdict, ≤64 chars, one line, no trailing period.
  evidence: string; // HIDDEN. The real resume snippet/element this verdict is based on.
                    // Used for accuracy eval + future expansion. Never rendered in the card.
}
export interface CvGapResult {
  score: number;          // integer 0–100
  inferredRole: string;   // e.g. "Data Analyst (mid-level)" — shown for transparency
  items: CvGapItem[];     // 4–5 items, at least 1 'good', ordered most→least severe
}
```

Endpoint returns exactly `CvGapResult` as JSON on success. No extra fields.

---

## 2. Backend

### 2.1 New file: `server/src/middleware/ipRateLimit.ts`
- Copy the structure of `server/src/middleware/analyzeRateLimit.ts` EXACTLY, with these changes only:
  - Key the bucket on the client IP, not `req.user.id`. IP source, in order: `req.headers['x-forwarded-for']` (first comma-split value, trimmed) → `req.socket.remoteAddress` → the string `'unknown'`.
  - `WINDOW_MS = 15 * 60 * 1000`, `MAX_REQUESTS = 8`.
  - Export `export function ipRateLimit(req, res, next)`.
  - Same 429 JSON + `Retry-After` behaviour.
- 🛑 STOP if `analyzeRateLimit.ts` no longer matches the structure assumed here — report and wait.

### 2.2 New file: `server/src/services/cvGapScan.ts`

Exports: the two interfaces above + `export async function runCvGapScan(resumeText: string): Promise<CvGapResult>`.

**Step 1 — deterministic signals (no LLM).** Implement these pure helpers in the same file. Operate on `resumeText`.
- `splitBulletLines(text)`: lines starting with `-`, `•`, `*`, `·`, or `•`, trimmed, non-empty.
- `quantificationRatio(bullets)`: fraction of bullets containing a digit OR `%` OR `$` OR one of `['reduced','increased','grew','cut','saved','doubled','tripled']` (case-insensitive). Range 0–1.
- `dutyOpeningCount(bullets)`: count of bullets whose lowercased start matches any of: `responsible for`, `worked on`, `helped`, `assisted`, `duties included`, `tasked with`, `participated in`.
- Return `{ bulletCount, quantificationRatio, dutyOpeningCount }`.

**Step 2 — one LLM call.** Use `callClaude(prompt, true)` from `server/src/services/llm.ts` (already temperature 0 / JSON system prompt). Build the prompt per §3. Parse `content` as JSON. Expect:
```ts
{ inferredRole: string;
  expectedKeywords: string[];   // 6–10
  presentKeywords: string[];    // subset present in resume
  items: { severity: 'critical'|'warning'|'good'; text: string; evidence: string }[]; }
```
- `text` ≤ 64 chars, tight verdict, no trailing period (see §0.5). `evidence` = the actual resume snippet the verdict is based on (for non-'good' items, must be a literal substring of the resume).
- 🛑 STOP if `callClaude`'s signature differs from `(prompt: string, jsonMode?: boolean) => Promise<{ content: string; usage: {...} }>`.
- If JSON parse fails once, retry the call ONCE. If it fails twice, throw — the route maps this to 502 (§2.3).

**Step 3 — score (deterministic rubric, NOT from the LLM).** Start at 100, apply, then clamp to [0,100] and round to integer:
- `quantificationRatio < 0.34` → −22; else if `< 0.67` → −10.
- `dutyOpeningCount >= 3` → −18; else if `>= 1` → −8.
- missing keywords = `max(0, expectedKeywords.length − presentKeywords.length)`; subtract `min(missing, 5) * 4`.
- `bulletCount < 6` → −8 (resume too thin to scan well).
Score is fully determined by signals + keyword counts → reproducible.

**Step 4 — assemble `items`.** Take the LLM `items`. Ensure a keyword item exists: if `missing > 0`, prepend `{ severity: 'warning', text: \`Missing ${missing} of ${expectedKeywords.length} keywords the ATS filters on\`, evidence: \`Expected for ${inferredRole}: ${expectedKeywords.join(', ')}\` }` (keep `text` ≤64 chars — this phrasing is 42). **Cap to 5 items total**, keep at least one `'good'`, order critical → warning → good. Enforce the ≤64-char `text` limit on every item; if the LLM returns a longer line, **🛑 STOP is NOT required — instead truncate-by-dropping**: discard any item whose `text` exceeds 64 chars rather than cutting mid-word (a clipped verdict is worse than one fewer item). Return `{ score, inferredRole, items }`.

### 2.3 New file: `server/src/routes/cv-scan.ts`
- Express `Router`. Reuse the multer setup pattern from `onboarding.ts` (memory storage, 5MB limit, same `fileFilter`). Single field: `resume`, maxCount 1. **No `authenticate` middleware.**
- `POST /` chain: `ipRateLimit` → multer-wrapped handler.
- Handler:
  1. `const file = (req.files as any)?.resume?.[0]` — if missing → `400 { error: 'Resume file is required' }`.
  2. `const text = await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname)`.
  3. If `!text || text.trim().length < 200` → `422 { error: 'Could not read enough text from that file. Try a text-based PDF or DOCX.' }`.
  4. `hash = sha256(text)` (use `crypto`). Module-level `Map<string,{result:CvGapResult,at:number}>` cache; reuse the `readAnalysisCache`/`writeAnalysisCache` semantics from `server/src/lib/analysisCache.ts` (TTL `30 * 60 * 1000`). On hit, return cached.
  5. `const result = await runCvGapScan(text)`; write cache; `res.json(result)`.
  6. Wrap 2–5 in try/catch → on error `502 { error: 'Scan failed, please try again.' }` and `console.error('[cv-scan]', err)`.

### 2.4 Mount it: `server/src/index.ts`
- Add `import { cvScanRouter } from './routes/cv-scan';` with the other route imports.
- Add `app.use('/api/cv-scan', cvScanRouter);` in the same block as the other `app.use('/api/...')` lines.
- 🛑 STOP if there is global auth applied before route mounting that would block an unauthenticated route — report before proceeding.

---

## 3. The LLM prompt (in `cvGapScan.ts`)

Build a single template string. Requirements baked in (this is the specificity contract):

- Role: "You are a senior Australian recruiter doing a fast first-scan of a CV."
- Input given to it: the full `resumeText`, plus the computed signals from Step 1 (pass `bulletCount`, `quantificationRatio` rounded to 2dp, `dutyOpeningCount`) so its commentary aligns with the score.
- Output: ONLY the JSON object from §2.2 Step 2. No markdown, no prose.
- **THE 6-SECOND RULE (state it first and loudly in the prompt):** "Your reader has 6 seconds and no patience. Every `text` is a tight VERDICT of ≤64 characters, one line, no trailing period — a fact about THIS resume they can read at a glance. Not advice. Not a sentence with a recommendation. A verdict." Give the model these exact good/bad examples:
  - GOOD `text`: `Opening bullet leads with a duty, not an outcome` · `No quantified result in your last 2 roles` · `Strong, specific job titles — keep these`
  - BAD `text`: `You should add more quantifiable achievements to show impact` (advice + too long) · `Your resume could be improved by tailoring it` (generic)
- **`text` vs `evidence` (state explicitly):** "`text` is the short verdict shown to the user. `evidence` is the real snippet from THIS resume that proves the verdict — a literal substring of the resume for any non-good item. The user never sees `evidence`; it exists so we can prove the verdict is real."
- **Hard bans:**
  - "BANNED generic outputs — never produce as `text`: 'add quantifiable achievements', 'use strong action verbs', 'tailor your resume to the role', 'improve formatting', or anything that would apply to every resume on earth. If your verdict would be true of most resumes, delete it."
  - "Never exceed 64 characters in `text`. Count them."
- Items: produce **4–5**. At least one `severity:'good'` that names a real strength from their resume. Order by severity.
- `inferredRole`: infer the single most likely target role + level from the resume's trajectory; format like "Data Analyst (mid-level)".
- `expectedKeywords`: 6–10 keywords a typical **Australian** JD for `inferredRole` expects. `presentKeywords`: which of those literally appear in the resume text (case-insensitive).

🛑 STOP and report if the model is on a provider/model where temperature-0 JSON is unreliable — the spec assumes the existing `callClaude` config.

---

## 4. Frontend

### 4.1 `src/lib/api` usage
- The mock currently has no backend call. Add a typed call in `MockLandingPage.tsx` (local to the file, no new lib file): `POST /api/cv-scan` with `FormData` (`resume`). Use the existing `api` axios instance — import `api from '../lib/api'`. 30s timeout.
- 🛑 STOP if `src/lib/api` does not export a default axios instance — report.

### 4.2 `src/pages/MockLandingPage.tsx` — `InlineScan` + `GapReportPreview`
- Promote `GapReportPreview` to accept optional props: `{ data?: CvGapResult }`. When `data` is provided, render `data.score`, `data.items` (render ONLY `item.text`; map `severity` → colour: critical `#C2603F`, warning `#C5A059`, good `colors.success`), and a small "Scanned as: {inferredRole}" line under the title. **Never render `item.evidence`.** When no `data`, keep the current hard-coded sample (so the hero preview still looks right).
- `InlineScan` gains state: `'idle' | 'scanning' | 'done' | 'error'` + `result: CvGapResult | null`.
  - On CTA click with a file present: set `scanning`, POST, on success set `result` + `done`, on failure set `error` (+ `toast.error` using `sonner`, already a dependency).
  - `scanning`: show a spinner inside the card (reuse the petrol spinner pattern used elsewhere: a 28px bordered circle, `animation: landingSpinner` — define the keyframe inline in this file).
  - `done`: render `<GapReportPreview data={result} />` in place of the form, followed by the email-gate line already written ("add an email to save it and unlock the fixes") as a disabled-looking teaser (no real signup in the mock — a button that does nothing + the existing copy).
- Do NOT add an email field. The whole point is no ask before value.

---

## 5. Evals (accuracy gate — do this, it's the point)
- **Fixtures = the 14 real resumes in `E:\AntiGravity\JobHub\Resumes`** (PDF/DOCX). Extract each to text ONCE via a throwaway script using `extractTextFromBuffer`, into `evals/fixtures/resumes/*.txt`.
  - **🛑 PII GUARD:** these are real people's CVs. Before writing any `.txt` fixture, redact name + email + phone (replace the top contact block with `[REDACTED]`). Add `evals/fixtures/resumes/` to `.gitignore`. **Do NOT commit raw or even redacted real resumes to git** — they stay local. If `.gitignore` cannot be updated, 🛑 STOP and report.
- Add `evals/cvGapScan.yaml` (promptfoo) mirroring the existing `evals/promptfooconfig.yaml` structure, running the §3 prompt over each fixture.
- Assertions per case:
  - output is valid JSON; `items.length` in **4–5**; ≥1 `good`; `score` is an integer 0–100.
  - **Brevity gate:** every item's `text` ≤ 64 chars, single line, no trailing period.
  - **Grounding gate:** every non-good item's `evidence` contains a substring of ≥10 chars that also appears (case-insensitive) in that resume's text. (Grounding is checked on `evidence`, not `text` — the verdict is intentionally not a quote.)
  - **Anti-generic gate:** no item `text` matches the banned-phrase list from §3 (case-insensitive substring).
- 🛑 The build is NOT "done" until the eval pass rate is reported to the requester, per gate. Report the numbers; do not silently pass.

---

## 6. Out of scope for v1 (do NOT build)
- Persisting results to the DB.
- The email/account capture flow (mock shows the teaser only).
- PATH (b) curated keyword map (Appendix B).
- Any change to the live `/` landing or `LandingPage.tsx`.

---

## 7. Definition of done (report all of these)
1. `npx tsc -b` passes (root) and the server typechecks.
2. `POST /api/cv-scan` with a real PDF returns a valid `CvGapResult` in < 8s warm, < 1s on cache hit.
3. Hitting it 9× from one IP in 15 min returns 429 on the 9th.
4. `/mock-landing` scan flow works end to end: upload → spinner → real report rendered in `GapReportPreview`.
5. Eval pass rate reported with numbers.

---

## Appendix B — PATH (b), if chosen later (NOT v1)
Add `server/src/data/roleKeywords.ts`: `Record<roleFamilyId, string[]>` for the ~15 most common grad role families. In `runCvGapScan`, after `inferredRole`, map it to a family and use that keyword list instead of the LLM's `expectedKeywords` (keep LLM inference only as the fallback for unmapped roles). Everything else in the spec is unchanged.

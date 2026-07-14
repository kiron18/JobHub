# JobHub Generation V2 — Implementation Plan

**Audience:** a coding agent (Kimi or similar) executing under supervision. Every step names exact files, exact changes, and a mechanical pass/fail gate. Do not improvise beyond what a step says. When a step's gate fails or an instruction conflicts with what you find in the code, STOP and report — do not "fix it while you're there."

**Goal:** resume + cover letter generation reads the candidate's raw resume text and the job description, makes one Claude call per document, and returns clean markdown. The Profile Bank (structured DB rows) is demoted to a display/coaching surface — generation never depends on it for content. Llama is removed from the stack entirely. Company research is disabled behind a flag.

**What this plan deliberately does NOT do** (out of scope, do not touch):

- No deletion of now-unused code (`buildTemplateResume`, `applyPolish`, quality gate, scrubbers, blueprint). Strand it, don't delete it. Cleanup is a separate later pass.
- No changes to the selection-criteria route (`/generate/selection-criteria-structured`) — it keeps working as-is.
- No changes to auth, payments/Stripe, accountability, welcome flow logic (welcome.ts is touched ONLY by the Phase 1 model swap, which changes no logic).
- No Prisma schema changes, no migrations.
- No new npm dependencies.
- No changes to `src/lib/exportPdf.ts` or `src/lib/exportDocx.ts`.

**Global conventions:**

- Australian English in all user-facing prose. Never use em dashes (U+2014) in any prompt text or generated-output rules.
- After every phase: `cd server && npx tsc --noEmit` must pass, and the server must boot (`npm run dev` starts without crash).
- Commit at the end of every phase with the message given in that phase. Never batch phases into one commit.

---

## Phase 0 — Lock in the baseline

There is uncommitted work in the tree: a fix that matches LLM polish output to experience entries by `id` instead of array index (files: `server/src/lib/buildTemplateResume.ts`, `server/src/lib/resumeData.ts`, `src/lib/applyPolish.ts`, `src/lib/profileToResumeData.ts`, `src/lib/resumeData.ts`, plus two test files). This is a real bug fix for the currently-live path and must be locked in before anything else.

1. Run the affected checks:
   - `cd server && npx vitest run src/lib/__tests__/buildTemplateResume.test.ts src/tests/resumeTemplate.test.ts`
   - Frontend: `npx tsc -b` from the repo root. The frontend has NO test runner configured; do not install one and do not attempt `npx vitest` at the root.
2. **Gate:** server tests pass and `npx tsc -b` exits 0. If either fails, STOP and report the failure verbatim. Do not modify the WIP code to make tests pass.
   (Note: one stale assertion at `server/src/tests/resumeTemplate.test.ts` — a leftover `expect(...id).toBeUndefined()` contradicting the updated `toEqual` above it — was already resolved by the plan author on 2026-07-14. Both suites pass 25/25.)
3. Commit everything currently modified: `fix(resume): match polish to experience by id, not array position`
4. Also commit the untracked stray files if the user approves, or leave them untracked. Do not delete them.

---

## Phase 1 — Remove Llama completely

`callLLM` in `server/src/services/llm.ts` (line ~41) is hardcoded to `meta-llama/llama-3.3-70b-instruct`. It is used by many routes (extract, analyze, research, ai-tools, document-qa, enrichment, onboarding, welcome, the old wildcard generate path). Do NOT rewire the callers. Change only the model inside `callLLM`:

1. In `server/src/services/llm.ts`, replace the hardcoded model string in `callLLM` with:
   ```ts
   model: process.env.FAST_MODEL || 'anthropic/claude-sonnet-4-5',
   ```
   Keep the function signature, temperature parameter, retry logic, and system message exactly as they are.
2. Search the entire repo for `llama` (case-insensitive). The only remaining hits allowed are: comments/variable names about pricing in `generate.ts` (leave them), and anything in `docs/` or fixtures. No live model slug may remain.
3. **Gate:** `grep -ri "meta-llama" server/src --include="*.ts"` returns zero hits. `npx tsc --noEmit` passes. Boot the server, upload a resume through the ResumeImporter flow (POST `/extract/resume` with resume text), and confirm the response JSON contains a non-empty `education` array for a resume that has an education section.
4. Commit: `feat(llm): retire Llama, all callLLM traffic now runs on Claude Sonnet`

---

## Phase 2 — Disable company research behind a flag

The research produced confidently wrong company intel (researched "LLL Agency" when the employer was LLL Australia). Disable it until a grounded version exists.

1. Add to `server/.env`: `COMPANY_RESEARCH_ENABLED=false`
2. In `server/src/services/companyIntel.ts`, at the top of `fetchCompanyIntel`, add:
   ```ts
   if (process.env.COMPANY_RESEARCH_ENABLED === 'false') {
     throw new Error('COMPANY_RESEARCH_DISABLED');
   }
   ```
3. Find every caller of `fetchCompanyIntel` (it is imported in `server/src/routes/research.ts`). Ensure each caller catches the error and returns a response the frontend already tolerates as "no insight available" (inspect how the frontend handles a failed/absent intel response before choosing the shape — most likely `res.json({ available: false })` or reusing the existing error path). Do not invent a new response shape the frontend has never seen.
4. **Gate:** with the flag false, load the app, open a job that would normally trigger company insight, and confirm: no crash, no spinner stuck forever, cover letter generation still completes (Phase 3 makes it independent of research anyway). With the flag flipped to true, insight works as before.
5. Commit: `feat(research): company intel behind COMPANY_RESEARCH_ENABLED flag, default off`

---

## Phase 3 — Generation V2 (the core)

### 3.1 Contract

- The route URLs do not change: `POST /generate/resume-structured` and `POST /generate/cover-letter-structured` (frontend `src/pages/StepperWorkspace.tsx` calls these at lines ~328/330 and ~748/750 — it must not need edits beyond what 3.6 specifies).
- The response must keep the keys the frontend reads. Before coding, read the response handling in `StepperWorkspace.tsx` around those call sites and list every field consumed. At minimum return: `content` (the markdown string), `id` (document id), plus the previously returned keys with neutral values (`tips: []`, `polishAccepted: true`, `pageBudgetWarning: false`, `estimatedPages` computed as before, `costBreakdown` as before, `blueprint: null`).
- Generation reads `profile.resumeRawText` as the ONLY content source. If `resumeRawText` is missing or shorter than 200 characters, return HTTP 400 with `{ error: 'No resume on file. Upload your resume in the Profile section first.' }`. Do not fall back to the bank.
- The Profile Bank relations (`experience`, `education`, `achievements`, etc.) are NOT queried by these two routes anymore. Remove those `include`s from the Prisma call. Keep the scalar profile fields (name, showReferees if used elsewhere) only if actually referenced.

### 3.2 New prompt file — `server/src/services/prompts/generationV2.ts`

Create this file with the two exported functions below. The prompt text is final — reproduce it exactly, including the honesty rules and the output skeleton. The skeleton must match what the exporters already parse (`# name`, `## Section`, `### Role | Company`, italic date lines, `- ` bullets), because `exportPdf.ts` / `exportDocx.ts` consume this markdown directly.

```ts
export const RESUME_V2_PROMPT = (resumeText: string, jobDescription: string) => `
You are an expert Australian resume writer. You write the way a top human career coach writes: specific, honest, outcome-first, and tailored to one job.

You will receive:
1. THE CANDIDATE'S RESUME. This is the single source of truth. Every fact in your output must come from here.
2. THE JOB DESCRIPTION for the role they are applying to.

== HONESTY RULES (these override everything else) ==
- Every employer name, job title, date, qualification, institution, certification, and number in your output must appear in the candidate's resume. Copy them exactly.
- Never invent, estimate, round, or extrapolate a number. If a bullet has no metric, write it without one. A strong unmetriced bullet beats an invented metric every time.
- Never state a years-of-experience figure unless the resume's own dates clearly support it. When unsure, describe experience without a number of years.
- Never import facts from the job description into the candidate's history, and never use your own outside knowledge about any company (locations, offices, reputation). If it is not in the resume, it does not exist.
- Include EVERY education entry from the resume. Never drop education.

== TAILORING RULES ==
- Lead with what this specific job asks for. Reorder and reweight the candidate's real experience so the most relevant work is most prominent.
- Mirror the job description's genuine vocabulary where the resume honestly supports it (e.g. if the JD says "multi-channel campaigns" and the candidate ran campaigns across several channels, use that phrase). Never mirror vocabulary the resume cannot support.
- 3 to 5 bullets for the most recent or most relevant roles, 2 to 3 for older ones. Every bullet starts with a strong verb and states an outcome or concrete scope.
- Professional summary: first person, 3 to 4 sentences, no name, no "he/she/they", anchored by one real proof point from the resume, ending with what they are targeting (aligned to this job). Plain prose.
- Skills section: group the resume's real skills into 2 or 3 labelled lines relevant to this job. Do not pad with skills the resume does not evidence.
- Total length must fit 2 A4 pages of a standard resume layout.
- Australian English. No em dashes anywhere. No clichés: never write "results-driven", "passionate", "dynamic", "proven track record", "leverage", "spearheaded", "synergy".

== OUTPUT FORMAT ==
Return ONLY the finished resume as markdown in EXACTLY this structure. No preamble, no code fences, no commentary, no trailing notes.

# {Candidate full name exactly as in the resume}

*{The job title from the job description}*

{email} | {phone} | {linkedin} | {location}   <- only items that appear in the resume, in this order, separated by " | "

## Professional Summary

{summary}

## Work Experience

### {Role} | {Company}
*{Mmm YYYY - Mmm YYYY or Present}*

- {bullet}
- {bullet}

{...repeat for each role, most relevant/recent first...}

## Education

**{Degree}**  ·  {Year}
{Institution}

{...repeat for each education entry...}

## Skills & Competencies

**{Group label}:** {comma-separated skills}

**{Group label}:** {comma-separated skills}

## Certifications & Professional Development   <- include this section ONLY if the resume lists certifications

- **{Name}** - {Issuer}

## Languages   <- include ONLY if the resume lists languages

{Language (Proficiency) • Language (Proficiency)}

## Referees

Available upon request.

== THE CANDIDATE'S RESUME ==
"""
${resumeText}
"""

== THE JOB DESCRIPTION ==
"""
${jobDescription}
"""
`;

export const COVER_LETTER_V2_PROMPT = (
  resumeText: string,
  jobDescription: string,
  generatedResume?: string,
) => `
You are an expert Australian cover letter writer. Direct, warm, specific, zero fluff. The letter must read like a sharp human wrote it, not a template.

You will receive the candidate's resume (single source of truth for all facts about the candidate), the job description, and optionally the tailored resume already generated for this application (keep the letter consistent with it).

== HONESTY RULES (override everything else) ==
- Facts about the CANDIDATE come only from the resume. Never invent employers, titles, numbers, locations, or qualifications.
- Facts about the COMPANY come only from the job description itself. Use what the JD says about the organisation, its mission, and the role. Never use outside knowledge about the company, its offices, or its locations. If the JD says little about the company, focus on the role instead.
- Never state years of experience unless the resume's dates clearly support it.

== LETTER RULES ==
- Salutation: "Dear Hiring Manager," unless the job description itself names a specific person or title to address.
- 4 paragraphs, 250 to 350 words total:
  1. Why this role, connecting one real strength to the job's core need. No "I am writing to apply for".
  2. Strongest relevant proof from the resume (real outcomes, real numbers if the resume has them).
  3. Second angle: breadth, collaboration, or the JD's stated values, again grounded in the resume.
  4. Brief, confident close inviting a conversation.
- Australian English. No em dashes. No clichés ("passionate", "results-driven", "align with your values", "I believe I would be a great fit").
- Sign off:

Yours sincerely,
{Candidate full name exactly as in the resume}

Return ONLY the letter text. No preamble, no code fences, no commentary.

== THE CANDIDATE'S RESUME ==
"""
${resumeText}
"""

== THE JOB DESCRIPTION ==
"""
${jobDescription}
"""
${generatedResume ? `\n== THE TAILORED RESUME ALREADY GENERATED FOR THIS APPLICATION ==\n"""\n${generatedResume}\n"""\n` : ''}
`;
```

### 3.3 New grounding gate — `server/src/lib/groundingGate.ts`

Create this file. It reuses `normalizeForMatch` and `isGroundedInSource` from `server/src/lib/fidelityGuard.ts` (import them, do not copy them).

```
Exports: checkGrounding(output: string, resumeText: string, jobDescription: string): { violations: string[] }
```

Checks, all deterministic string work, no LLM calls:

1. **Numbers.** Extract every number-bearing token from `output` matching `/(\$[\d,.]+[kKmM]?\+?|\d+(?:\.\d+)?%|\b\d{2,}(?:,\d{3})*\+?\b)/g`. Normalise each (strip `$ , % +`, lowercase k/m). Each must appear (same normalisation) in `resumeText` OR `jobDescription`. Exempt: bare 4-digit years 1950-2035, and date-line numbers (lines matching the `*Mmm YYYY - Mmm YYYY*` pattern).
2. **Employers.** Every `### Role | Company` heading in the output: the Company part must pass `isGroundedInSource(company, normalizeForMatch(resumeText))`.
3. **Institutions.** Every line directly following a `**Degree**` line in the Education section must pass `isGroundedInSource` against the resume text.
4. **Contact.** Any email or phone-shaped string in the first 5 lines of the output must appear verbatim (email) or digit-for-digit (phone, after stripping spaces) in the resume text.

Each failure pushes a human-readable string into `violations`, e.g. `Number "90%" does not appear in the resume or job description`.

Write a unit test `server/src/lib/groundingGate.test.ts` with at least: a passing case, an invented-percentage case, an invented-employer case, and a year-exemption case. **Gate:** tests pass.

### 3.4 Rewire `POST /generate/resume-structured` in `server/src/routes/generate.ts`

Replace the route's internals (keep auth, `checkAccess`, daily-limit, and document persistence exactly as they are):

1. Load profile: `prisma.candidateProfile.findUnique({ where: { userId } })` — scalars only, no `include`.
2. Enforce the `resumeRawText` guard from 3.1.
3. Build the prompt: `RESUME_V2_PROMPT(profile.resumeRawText, jobDescription)`.
4. Call: `callClaude(prompt, false, undefined, PREMIUM_MODEL)` — note `jsonMode: false`; the output is markdown, not JSON. (`PREMIUM_MODEL` still resolves to Sonnet unless the env overrides it; leave that mechanism alone.)
5. Strip accidental code fences: if the content starts with ``` remove the first and last fence lines. Trim.
6. **Shape check:** the output must contain, in order: one line starting `# `, `## Professional Summary`, `## Work Experience`, at least one `### `, `## Education`, `## Skills & Competencies`. If the shape check fails, retry ONCE by re-sending the same prompt with this appended: `\n\nYour previous attempt did not follow the required output structure. Return ONLY the markdown document in exactly the specified structure.` If it fails twice, return HTTP 502 `{ error: 'Generation failed format validation, please try again.' }` and log the raw output.
7. **Grounding gate:** run `checkGrounding`. If violations exist, retry ONCE with the violations appended to the prompt under a heading `== YOUR PREVIOUS ATTEMPT VIOLATED THESE HONESTY RULES, FIX THEM ==`. If violations remain after the retry, still return the document but include `groundingWarnings: string[]` in the JSON response and log a `console.warn` per violation. Never silently strip content.
8. Remove from this route: the `blueprint` stub, `buildAchievementContext`, `parsePolishJson`, `buildTemplateResume`, `detectYearsClaim`/regeneration loop, `extractContactEmail`. (Leave the imports/files themselves alone if other routes use them; strand what nothing else uses.)
9. Persist the document and return the response shape from 3.1.

### 3.5 Rewire `POST /generate/cover-letter-structured`

Same pattern: raw-text guard, `COVER_LETTER_V2_PROMPT(resumeRawText, jobDescription, mostRecentResumeContent)` where `mostRecentResumeContent` is the newest `Document` of type `RESUME` for this `jobApplicationId` if one exists (single Prisma query; pass `undefined` if none). `jsonMode: false`. Shape check: output contains a line starting `Dear ` and a line `Yours sincerely,`. Grounding gate: run the numbers check and contact check only (no `###` headings in letters). Same retry/warn policy. Ignore any `companyResearch`/`companyIntel` fields still arriving in the request body.

### 3.6 Frontend compatibility check

Read the two generation call sites in `src/pages/StepperWorkspace.tsx`. If the UI renders `tips`, page warnings, or polish state, confirm the neutral values from 3.1 render harmlessly (empty tips list, no warning banner). If the UI surfaces `groundingWarnings`, nothing extra is needed; if not, add a single toast when `groundingWarnings?.length > 0`: `Heads up: N claims could not be verified against your resume. Review before sending.` No other UI changes.

**Phase 3 gates (all must pass):**

- `npx tsc --noEmit` clean, server boots.
- Unit tests for the grounding gate pass.
- With a real profile that has `resumeRawText`, generating a resume via the UI produces markdown whose headings match the skeleton, renders in the workspace, and downloads as both PDF and DOCX without error.
- Generating with a profile whose `resumeRawText` is empty returns the 400 message.
- Selection criteria generation still works (untouched path).

Commit: `feat(generate): V2 single-pass generation from raw resume text with grounding gate`

---

## Phase 4 — Make re-upload loud

The current flow (`server/src/routes/profile/source-documents.ts`) saves the raw text, then fires `forceAutoExtract` fire-and-forget; failures vanish. Since Phase 3 makes generation depend only on the raw text, the bank refresh is now non-critical, but it must stop lying to the user.

1. In `source-documents.ts`, change the resume branch to `await forceAutoExtract(userId, resumeText)` inside its own try/catch. On success respond `{ status: 'extracted' }`; on failure respond `{ status: 'raw_saved_extract_failed' }` with HTTP 200 (raw text DID save, generation WILL work; only the bank view is stale). Log the underlying error with full detail.
2. In `forceAutoExtract` (`server/src/services/autoExtract.ts`), re-throw the caught error instead of swallowing it (keep the "old bank left intact" behaviour on failure).
3. Frontend (`src/components/ProfileBank.tsx`, upload handler ~line 283): raise the axios timeout for this one request to 180000 ms. On `status === 'extracted'`: success toast `Profile re-extracted from your new resume.` and refetch the profile query. On `raw_saved_extract_failed`: warning toast `Your resume was saved and will be used for generation, but the profile view failed to refresh. Try re-uploading.` Remove the "refresh in ~30 seconds" copy.
4. **Gate:** upload a real resume PDF from the Profile section. The education section of the Profile Bank shows the resume's education entries after the request completes, without a manual page refresh. Force a failure (temporarily set `OPENROUTER_API_KEY` to junk in a dev run) and confirm the warning toast appears instead of silent success.

Commit: `fix(profile): re-upload awaits extraction and surfaces failure instead of silently keeping stale data`

---

## Phase 5 — Acceptance run (do not skip, do not self-certify partial passes)

Use the operator's real test assets: the resume PDF `Kiron Kurian John Resume.pdf` and the "Marketing Officer, LLL Australia via Robert Walters" job description (the operator has both; ask for them if missing).

Run every check; report each as PASS/FAIL with evidence (paste the relevant output snippet). ALL must pass.

1. **Re-upload:** upload the PDF via Profile. Bank shows both education entries ("Master of Communication" / University of Canberra AND "B.A." / Christ University). Experience shows the "80%" B2B bullet. No "ORLA" role remains.
2. **Resume generation vs the LLL JD:**
   - `## Education` section present with both entries.
   - Every number in the output exists in the resume PDF text (spot-check "80%", "150+", "$200K"; the words "90%" and "$50,000" must NOT appear — they are from the old resume).
   - No em dash character (U+2014) anywhere in the output.
   - Headings match the skeleton exactly; PDF and DOCX download and open.
3. **Cover letter vs the LLL JD:**
   - No mention of "Toowoomba" or any location not present in the resume or JD.
   - Company facts only from the JD (e.g. "established in 1921" is allowed; "LLL Agency" style content is an automatic FAIL).
   - Salutation is "Dear Hiring Manager," (the JD names no one). Word count 250-350.
4. **Consistency:** generate the resume 3 times with identical inputs. All 3 have identical section structure and role ordering (temperature is 0; minor wording drift is acceptable, structural drift is a FAIL).
5. **New-user scan route:** with a fresh test account, run the landing-page CV scan flow end to end (upload the same PDF, complete the scan, sign up / claim). Then generate a resume against any JD without ever visiting the Profile upload. It must succeed with the same quality checks as test 2 — this proves `resumeRawText` saved at scan time feeds generation directly. Also confirm a text-free scanned-image PDF produces the explicit 400 "No resume on file" message at generation rather than empty output.
6. **Regression:** full server test suite (`cd server && npx vitest run`) — pre-existing failures unrelated to touched files are reportable, new failures are a FAIL. Boot the app and click through: login, job list, profile page, one generation, one download.

Commit (docs only if needed) and report the full PASS/FAIL table.

---

## Appendix — known risks and what to do

- **Long upload request (Phase 4):** extraction is 1 Stage-1 call + 1 Stage-2 call per role (~30-90 s total). Local Express has no timeout issue. If the production host enforces a request cap under 120 s, STOP and report; the fallback design (await Stage 1 only, run achievements async) needs a human decision.
- **`callClaude` system prompt says "You are a strategic analyst":** harmless; the V2 prompts fully define the task. Do not refactor `callClaude`.
- **Anything in `StepperWorkspace.tsx` beyond 3.6:** it is a large file with unrelated flows. Touch only what 3.6 names.
- **If you find code that already partially does what a step asks:** report it and follow the step anyway unless it conflicts, in which case STOP and ask.

# Plan: Profile Bank as the single source of truth

## Context (read first, do not skip)

The app currently extracts an uploaded resume into a structured "bank" (Prisma models `Experience`, `Education`, `Volunteering`, `Certification`, `Language`, `Achievement`, all hanging off `CandidateProfile`). Document generation reads from this bank. The bank is **already** user-editable on the Profile Bank page.

Two defects make generated documents fabricate facts:

1. The extraction is done by **Llama 3.3 70B** (`callLLM`), which invents companies, splits one role's bullet into a fake standalone project, and drops detail. Those errors are baked into the bank and rendered faithfully downstream.
2. The generation prompt treats the **raw resume text** as "the single source of truth" while *also* feeding the bank. Once a user edits the bank, the raw text goes stale and fights their edits.

The target model: **upload once -> Claude extracts a clean bank -> user edits/adds on the Profile page -> the bank is the durable source of truth -> every application generates from the bank.**

Most of this already exists. This plan makes five focused changes. Do them in order. After each numbered task, STOP and report what you changed and the result of the stated check before moving on.

---

## Task 1 — Extract with Claude instead of Llama

**File:** `server/src/services/autoExtract.ts`

This file calls `callLLM` (Llama) in two places inside `parseResumeToStructure`: the Stage 1 profile parse (line ~21) and the per-entry Stage 2 achievement parse (line ~48).

**Change both to `callClaude`.** Note the signature difference, this is the critical part:

- `callLLM(prompt)` returns a **string**.
- `callClaude(prompt, jsonMode)` returns **`{ content, usage }`**.

So you must destructure `.content`.

1. At the top of the file, change the import:
   ```ts
   import { callClaude } from './llm';
   ```
   (remove the `callLLM` import from this file only).

2. Stage 1 call, change:
   ```ts
   const stage1Raw = await callLLM(STAGE_1_PROMPT(resumeText));
   ```
   to:
   ```ts
   const { content: stage1Raw } = await callClaude(STAGE_1_PROMPT(resumeText), true);
   ```

3. Stage 2 call, change:
   ```ts
   const stage2Raw = await callLLM(STAGE_2_PROMPT(entry.role, entry.company, entry.bullets));
   ```
   to:
   ```ts
   const { content: stage2Raw } = await callClaude(STAGE_2_PROMPT(entry.role, entry.company, entry.bullets), true);
   ```

**Do not change anything else in this file in Task 1.** Do not touch `persistExtracted`, the dedup logic, or the transaction.

**CHECK and STOP:** Run `npx tsc --noEmit` inside `server/`. It must pass with no new errors. Report the result. Do not proceed to Task 2 until it passes.

---

## Task 2 — Harden the Stage 1 extraction prompt against fabrication

**File:** `server/src/services/prompts/extraction.ts`

The `STAGE_1_PROMPT` has no rule forbidding invention, and it instructs the model to split projects out aggressively, which is what created the fake "Personal Project" entry. Replace the **"Specific Instructions"** block (the numbered list 1 through 6, lines ~5 to ~14) with the exact text below. Do not change the JSON schema beneath it, and do not change `STAGE_2_PROMPT`.

Replace from the line `Specific Instructions:` down to and including the COACHING ALERTS lines, with exactly this:

```
FIDELITY (most important rule): Extract only what is explicitly written in the resume. Never invent, infer, or guess a company name, employer, job title, date, qualification, institution, certification, or metric. If a field is not present in the resume, return null or omit it. In particular, if a role lists no employer, set "company" to null. Do not fill it with a plausible-sounding company name. Copy names, employers, and dates verbatim from the resume.

STRUCTURE: Keep each role intact. Do not split one role's bullets into separate entries. A task, assignment, or sub-project performed inside a job stays as a bullet under that job. Only create a PROJECTS entry when the resume itself presents the item under a distinct projects or portfolio heading, or as a clearly standalone project with its own title. When in doubt, keep it as a bullet under the role it belongs to.

Specific Instructions:
1. EXPERIENCE: Paid or unpaid work roles only. Do NOT include academic projects here.
2. PROJECTS: Extract a project only when the resume presents it as a distinct, separately headed project (academic, personal, freelance, open source, capstone). Do not promote a single bullet from a job into a project. Use the institution or organisation name as "org". If genuinely none is stated, use "Personal Project".
3. VOLUNTEERING: Community work, student societies, extracurriculars.
4. CERTIFICATIONS: Professional credentials and short courses only, not degrees.
5. LANGUAGES: All languages and proficiency levels.
6. COACHING ALERTS:
   - RED: Missing mandatory info (e.g., contact email, degree year).
   - ORANGE: Weak content (e.g., bullet without a metric, vague descriptions like "assisted with tasks").
```

**File:** `server/src/services/autoExtract.ts`

Because `company` may now legitimately be null, change the fallback so we never render an invented label. Find this line in `persistExtracted` (work experience mapping, line ~145):
```ts
company: exp.company || 'Unknown Company',
```
change to:
```ts
company: exp.company || '',
```
Leave the `role: exp.role || 'Unknown Role'` line as is.

**CHECK and STOP:** Run `npx tsc --noEmit` inside `server/`. Report the result. Do not proceed until it passes.

---

## Task 3 — Make the bank authoritative in the generation prompt

**File:** `server/src/services/prompts/resumeStructuredPrompt.ts`

Today the prompt header labels the raw resume text as "the single source of truth" while also passing the structured work history. After a user edits their bank, the raw text is stale and contradicts their edits. Flip the authority to the bank.

Find this block (lines ~56 to ~64):
```
==============================================================
THE CANDIDATE'S RESUME (the single source of truth)
==============================================================
${rawResume || '(raw resume text unavailable — work only from the structured work history below)'}

==============================================================
THEIR WORK HISTORY (return one object for EACH entry; keep the same order and ids)
==============================================================
${experienceBlock}
```

Replace it with exactly:
```
==============================================================
THEIR WORK HISTORY (the single source of truth — return one object for EACH entry; keep the same order and ids)
==============================================================
${experienceBlock}

==============================================================
ORIGINAL RESUME TEXT (reference only — the structured work history above is authoritative and supersedes this wherever they differ, because the candidate may have edited their profile since uploading)
==============================================================
${rawResume || '(raw resume text unavailable)'}
```

Then, in the numbered rule list, find rule 1 ("SOURCE OF TRUTH...") and change its first sentence from:
```
1. SOURCE OF TRUTH. Use only facts that appear in the resume.
```
to:
```
1. SOURCE OF TRUTH. Use only facts that appear in the structured work history above, which the candidate has reviewed and edited. The original resume text is reference only. Where they differ, the structured work history wins.
```
Leave the rest of rule 1 and all other rules unchanged.

**CHECK and STOP:** Run `npx tsc --noEmit` inside `server/`. Report the result. Do not proceed until it passes.

---

## Task 4 — Surface the scan-uploaded CV in the Profile, and store its filename

When a user first uploads a resume in the CV scan, the claim flow stores `resumeRawText` but not `resumeFilename`, so the Profile "Source Documents" panel shows "Not on file" even though we have their resume. Carry the original filename from scan to claim.

**File:** `server/src/routes/cv-scan.ts`

1. The `ScanStoreEntry` interface (line ~63) currently is:
   ```ts
   interface ScanStoreEntry {
     resumeText: string;
     result: CvGapResult;
     at: number;
   }
   ```
   Add a filename field:
   ```ts
   interface ScanStoreEntry {
     resumeText: string;
     result: CvGapResult;
     filename: string | null;
     at: number;
   }
   ```

2. In the main `POST /` handler, the file is available as `file.originalname` (the multer file at line ~162: `const file = (req.files as any)?.resume?.[0];`). There are **two** places that write to `scanStore` in that handler (the cache-hit path around line ~187 and the fresh-scan path around line ~210). Both currently look like:
   ```ts
   scanStore.set(scanId, { resumeText: text, result, at: Date.now() });
   ```
   Change **both** to:
   ```ts
   scanStore.set(scanId, { resumeText: text, result, filename: file.originalname ?? null, at: Date.now() });
   ```

3. In the `POST /claim` handler, the `profileData` object (line ~340) is spread into the upsert. Add `resumeFilename` and `documentsUpdatedAt` to it. Find:
   ```ts
   const profileData = {
     trialEndDate,
     email,
     name: entry.result.fullName || null,
     resumeRawText: entry.resumeText,
     targetRole,
     targetCity: loc,
     location: loc,
     hasCompletedOnboarding: true,
     marketingConsent: true,
     marketingEmail: email,
   };
   ```
   Add two lines so it reads:
   ```ts
   const profileData = {
     trialEndDate,
     email,
     name: entry.result.fullName || null,
     resumeRawText: entry.resumeText,
     resumeFilename: entry.filename,
     documentsUpdatedAt: new Date(),
     targetRole,
     targetCity: loc,
     location: loc,
     hasCompletedOnboarding: true,
     marketingConsent: true,
     marketingEmail: email,
   };
   ```

**CHECK and STOP:** Run `npx tsc --noEmit` inside `server/`. Report the result. Confirm `resumeFilename` and `documentsUpdatedAt` are valid fields on `CandidateProfile` in `schema.prisma` (they are, lines ~64 and ~67). Do not proceed until tsc passes.

---

## Task 5 — Remove the profile scorer and the cover-letter uploads from the Profile page

**File:** `src/components/ProfileBank.tsx`

### 5a — Remove the completion scorer (the score ring sidebar)

The page uses a two-column grid with `<CompletionSidebar>` on the right. Remove the sidebar and collapse to a single column.

1. Find the two-column grid container (line ~1668):
   ```tsx
   <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
   ```
   Change `gridTemplateColumns: '1fr 320px'` to `gridTemplateColumns: '1fr'`.

2. Delete the entire `<CompletionSidebar ... />` JSX block (lines ~1782 to ~1788, including the `{/* Sidebar */}` comment).

3. The `CompletionSidebar` component definition (starts ~line 1428, `const CompletionSidebar: React.FC<...>`) is now unused. Delete the whole component definition. If `ProfileCompletion` or any score helper is imported only for it, remove that import too. Do NOT remove the `completion` field from the `ProfileData` interface or any backend code, leave the data flowing, just stop rendering it.

### 5b — Remove the two Cover Letter upload rows

In `SourceDocumentsIsland` (starts ~line 281):

1. Remove the two cover-letter entries from the `docs` array (lines ~333 to ~348), keeping only the Resume entry. The array should contain only the `Resume` object.

2. Remove the now-unused cover-letter refs and state: `cl1Ref`, `cl2Ref` (lines ~284 to ~285), and `pendingCl1`, `pendingCl2` (lines ~288 to ~289).

3. In `hasAny` (line ~292), drop the cover-letter terms:
   ```ts
   const hasAny = !!pendingResume;
   ```

4. In `handleUpdate`, remove the `coverLetter1` / `coverLetter2` FormData appends (lines ~300 to ~301) and the `else { toast.success('Cover letters updated.'); }` branch, keeping only the resume success toast. After removal the success handling is just the resume case.

5. In the cancel handlers (lines ~311 and ~442), remove `setPendingCl1(null); setPendingCl2(null);`, keeping `setPendingResume(null);`.

6. Replace the descriptive paragraph (line ~367 to ~369) text with exactly:
   ```
   Your resume is the source of truth. Everything on this page is extracted from it, and you can edit any of it below. Upload a new resume any time to replace what is stored.
   ```

7. Update the section title prop if desired: change `title="Source Documents"` to `title="Your Resume"` (line ~359).

**Do not** remove the backend `/profile/source-documents` route or its cover-letter handling in this task. UI removal only.

**CHECK and STOP:** Run `npm run build` from the repo root (this runs `tsc -b && vite build`). It must complete with no errors. Report the result.

---

## Out of scope (do NOT touch)

- Do not change the renderer `buildTemplateResume`.
- Do not change `persistExtracted`'s replace/dedup logic beyond the one `company` fallback line in Task 2.
- Do not alter the re-upload "replace" behaviour. It is already replace-with-warning, which is what we want.
- Do not modify the cover-letter backend storage. Leave it dormant.
- Do not edit education/certification add-edit UI. It already exists and works the same way as work experience. If during Task 5 you notice it is missing, STOP and report rather than building it.

## Final report

After all five tasks, report: the result of the final `npm run build`, and a one-line confirmation for each task that its STOP-check passed.

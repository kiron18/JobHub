# QA Pending Fixes Implementation Plan

> **For DeepSeek (executing agent):** Execute task-by-task, top to bottom. These are ZERO-LATITUDE instructions. Do EXACTLY what each step says. Do not refactor, rename, "improve", or touch any file or line not named here. All prompt and user-facing copy in this plan is authored by Claude and must be transcribed VERBATIM, including punctuation and the absence of em/en dashes. If anything is ambiguous, or a file/line does not match what this plan shows, STOP and report back rather than guessing.

**Goal:** Close four verified output-quality gaps found in QA18/QA19: retarget the resume skills block to the job, persist education dates, stop the extractor inventing an education field, and stop Company Insight claiming candidate experience that does not exist.

**Architecture:** Three of four are localized edits (one persist mapping, two prompt strings). One (skills retargeting) adds a `skills` field through the existing structured-resume pipeline: prompt output to Zod schema to `applyPolish` to the already-existing renderer skills path. No DB migration: the `Education` table already has `startDate`/`endDate`/`year`.

**Tech Stack:** TypeScript, Express, Prisma, Vitest. LLM calls go through `callClaude` (Sonnet) for these paths.

**Global verification commands (run from `server/`):**
- Type-check: `npx tsc --noEmit` — expected exit 0.
- Tests: `npx vitest run` — expected all pass.

---

## Task A: Retarget the resume skills block to the job

**Problem:** `RESUME_STRUCTURED_PROMPT` outputs no skills, so `profile.skills` renders verbatim. A chemistry candidate applying for an inventory role gets an all-chemistry skills block with no Excel. We add a `skills` field to the structured output, grounded in the candidate's real skills, reordered and trimmed for the job.

**Files:**
- Modify: `server/src/services/prompts/resumeStructuredPrompt.ts`
- Modify: `server/src/lib/buildTemplateResume.ts` (the `PolishPayload` interface and `applyPolish`)
- Modify: `server/src/lib/validatePolish.ts` (the Zod schema)
- Modify: `src/lib/applyPolish.ts` (frontend mirror of `PolishPayload`, keep in sync)
- Test: `server/src/lib/__tests__/buildTemplateResume.test.ts`

- [ ] **Step A1: Confirm the Zod schema shape before editing.**

Open `server/src/lib/validatePolish.ts`. Find the object schema that validates the polish payload (it has keys like `summary`, `targetRoleTitle`, `experienceOrder`, `experience`). If the field names differ from what this task assumes, STOP and report the actual schema. Otherwise continue.

- [ ] **Step A2: Add `skills` to the Zod schema.**

In `server/src/lib/validatePolish.ts`, in the same object schema as `summary`, add this optional field next to the existing `summary` line:

```ts
  skills: z.string().optional(),
```

- [ ] **Step A3: Add `skills` to the `PolishPayload` interface (server).**

In `server/src/lib/buildTemplateResume.ts`, in the `PolishPayload` interface, add below the `summary?: string;` line:

```ts
  skills?: string;
```

- [ ] **Step A4: Add `skills` to the frontend `PolishPayload` mirror.**

In `src/lib/applyPolish.ts`, find the `PolishPayload` interface (it mirrors the server one). Add the same line below its `summary?: string;`:

```ts
  skills?: string;
```

If `src/lib/applyPolish.ts` has no `PolishPayload` interface, STOP and report what type it uses.

- [ ] **Step A5: Apply `skills` in `applyPolish` (server).**

In `server/src/lib/buildTemplateResume.ts`, in the `applyPolish` function, the returned object currently overrides `professionalSummary`. Add a `skills` override directly after the `professionalSummary` line:

```ts
    professionalSummary: polish.summary ?? data.professionalSummary,
    skills: polish.skills ?? data.skills,
```

- [ ] **Step A6: Apply `skills` in the frontend `applyPolish` mirror.**

In `src/lib/applyPolish.ts`, make the identical change: where it sets `professionalSummary` from `polish.summary`, add immediately after it `skills: polish.skills ?? data.skills,`. If the frontend function does not set `professionalSummary` the same way, STOP and report its actual body.

- [ ] **Step A7: Add a "THEIR SKILLS" block to the resume prompt.**

In `server/src/services/prompts/resumeStructuredPrompt.ts`, directly after the line `const rawResume = (profile?.resumeRawText ?? '').trim();` insert this block builder VERBATIM:

```ts
    // Normalised skills the model may reorder/trim (never add to). Handles the
    // JSON-object skills shape ({technical, industryKnowledge, softSkills}) and a
    // plain string. Falls back to whatever string is stored.
    const skillsBlock = (() => {
        const s = profile?.skills;
        if (!s) return '(no skills listed)';
        if (typeof s === 'string') {
            const t = s.trim();
            if (!t.startsWith('{') && !t.startsWith('[')) return t || '(no skills listed)';
            try {
                const parsed = JSON.parse(t);
                if (Array.isArray(parsed)) return parsed.join(', ');
                return Object.entries(parsed)
                    .map(([k, v]) => {
                        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
                        return `${label}: ${Array.isArray(v) ? v.join(', ') : String(v)}`;
                    })
                    .join('\n');
            } catch {
                return t;
            }
        }
        return '(no skills listed)';
    })();
```

- [ ] **Step A8: Show the skills block in the prompt body.**

In the same file, find the `THE JOB THEY ARE APPLYING FOR` section in the returned template string. Directly BEFORE that section's `==============================================================` opening line, insert this block VERBATIM:

```
==============================================================
THEIR SKILLS (reorder and trim for this job — never add a skill not listed here)
==============================================================
${skillsBlock}

```

- [ ] **Step A9: Add the skills rule to "HOW TO WRITE IT".**

In the same file, in the numbered `HOW TO WRITE IT` list, find rule `8. AUSTRALIAN ENGLISH.` Insert this new rule VERBATIM immediately BEFORE it (renumber nothing else; it is fine for two rules to discuss skills):

```
8. SKILLS, RETARGETED. Output a skills block tailored to this job. Start from THEIR SKILLS above and use only those, never add a skill the candidate does not have. Put the skills this job names first, drop skills with no relevance to this job, and keep the candidate's category labels (for example Technical, Industry Knowledge, Soft Skills). Format as one line per category in the form "Label: item, item, item". If the candidate clearly has a skill the job names under different wording, you may use the job's wording for that same skill, but never introduce a capability the resume does not show.
```

Then change the existing `8. AUSTRALIAN ENGLISH.` to `9. AUSTRALIAN ENGLISH.`, `9. NO GAPS...` to `10. NO GAPS...`, and the conditional block currently numbered `10.` to `11.`. If the numbers already differ from this plan, STOP and report the actual list.

- [ ] **Step A10: Add `skills` to the output JSON contract.**

In the same file, in the `OUTPUT` JSON object, add a `"skills"` line directly after the `"summary"` line:

```
  "summary": "first-person professional summary, 3-4 sentences, no name, no he/she/they",
  "skills": "one line per category, e.g. 'Technical: SAP, Microsoft Excel, inventory reconciliation\\nIndustry Knowledge: stock control, cycle counting'",
```

- [ ] **Step A11: Test that `applyPolish` overrides skills when present and keeps them otherwise.**

In `server/src/lib/__tests__/buildTemplateResume.test.ts`, add this test inside the existing top-level `describe` (or in a new `describe('applyPolish skills', ...)`), importing `applyPolish` and a minimal `ResumeData` exactly as other tests in this file construct it:

```ts
import { applyPolish } from '../buildTemplateResume';

describe('applyPolish skills override', () => {
  const base: any = { name: 'X', experience: [], education: [], skills: 'Technical: Chemistry' };

  it('overrides skills when polish provides them', () => {
    const out = applyPolish(base, { skills: 'Technical: SAP, Excel' } as any);
    expect(out.skills).toBe('Technical: SAP, Excel');
  });

  it('keeps existing skills when polish omits them', () => {
    const out = applyPolish(base, { summary: 'hi' } as any);
    expect(out.skills).toBe('Technical: Chemistry');
  });
});
```

If `applyPolish` is not exported, add it to that file's exports (it is defined with `export function applyPolish`, so it already is). If `ResumeData` requires more fields to satisfy the type, mirror how the nearest existing test builds its object.

- [ ] **Step A12: Run the new test.**

Run: `npx vitest run src/lib/__tests__/buildTemplateResume.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step A13: Type-check and full suite.**

Run: `npx tsc --noEmit` (expect exit 0) then `npx vitest run` (expect all pass). If either fails, STOP and report the exact error.

- [ ] **Step A14: Commit.**

```bash
git add server/src/services/prompts/resumeStructuredPrompt.ts server/src/lib/buildTemplateResume.ts server/src/lib/validatePolish.ts src/lib/applyPolish.ts server/src/lib/__tests__/buildTemplateResume.test.ts
git commit -m "feat(resume): retarget skills block to the job in structured generation"
```

---

## Task B: Persist education dates

**Problem:** `STAGE_1_PROMPT` emits education `startDate`/`endDate`, but `persistExtracted` maps only `year` (which the extractor does not emit), so all education dates are lost. The renderer already shows `ed.year || dateRange(ed.startDate, ed.endDate)`.

**Files:**
- Modify: `server/src/services/autoExtract.ts` (the `educationToCreate` mapping, around lines 193-204)

- [ ] **Step B1: Add `startDate` and `endDate` to the education mapping.**

In `server/src/services/autoExtract.ts`, find the `educationToCreate` mapping. It currently maps `candidateProfileId, institution, degree, field, year, coachingTips`. Add `startDate` and `endDate` so the object reads exactly:

```ts
        .map((edu: any) => ({
          candidateProfileId: profileId,
          institution: edu.institution || 'Unknown Institution',
          degree: edu.degree || 'Unknown Degree',
          field: edu.field ?? null,
          startDate: edu.startDate ?? null,
          endDate: edu.endDate ?? null,
          year: edu.year ?? null,
          coachingTips: Array.isArray(edu.coachingTips)
            ? edu.coachingTips.join(' | ')
            : (edu.coachingTips || null),
        }));
```

- [ ] **Step B2: Type-check.**

Run: `npx tsc --noEmit` — expected exit 0. (Prisma's `Education` model already has `startDate String?` and `endDate String?`, so this compiles.) If it fails, STOP and report.

- [ ] **Step B3: Run the extract test suite.**

Run: `npx vitest run src/tests/extract.test.ts` — expected PASS. If it fails, STOP and report.

- [ ] **Step B4: Commit.**

```bash
git add server/src/services/autoExtract.ts
git commit -m "fix(extract): persist education startDate and endDate so dates render on resumes"
```

---

## Task C: Stop the extractor inventing an education field

**Problem:** For "Edexcel IGCSE & AS & A2 Level" the extractor returned `field: "General Education"`, an inference. The fidelity rule exists but is not enforced on the `field` key specifically.

**Files:**
- Modify: `server/src/services/prompts/extraction.ts` (the education schema, line ~59)

- [ ] **Step C1: Tighten the `field` instruction in the education schema.**

In `server/src/services/prompts/extraction.ts`, in the `education` schema object, replace this exact line:

```
      "field": "Field of Study",
```

with this line VERBATIM:

```
      "field": "Field of Study — copy only if a field of study is explicitly named. If none is stated, return null. Never infer a field from the qualification name (for example, do NOT label 'IGCSE & A Levels' as 'General Education').",
```

- [ ] **Step C2: Type-check.**

Run: `npx tsc --noEmit` — expected exit 0. If it fails, STOP and report.

- [ ] **Step C3: Commit.**

```bash
git add server/src/services/prompts/extraction.ts
git commit -m "fix(extract): do not infer an education field when none is stated"
```

---

## Task D: Stop Company Insight claiming experience the candidate lacks

**Problem:** `companyIntel.ts` tells Perplexity to "find connections the candidate can reference," so on a mismatched role it confabulates fit ("mirrors the candidate's experience implementing quality systems") when the candidate has none. We ground it strictly in the supplied strengths.

**Files:**
- Modify: `server/src/services/companyIntel.ts` (the `prompt` array, around lines 31-49)

- [ ] **Step D1: Replace the instruction and summary-field lines.**

In `server/src/services/companyIntel.ts`, in the `prompt` array, replace these exact two lines:

```ts
    'Research the intersection of this candidate, this job, and this company.',
    'Find specific, concrete connections the candidate can reference in a cover letter.',
```

with these lines VERBATIM:

```ts
    'Research this company and this role, then connect them to the candidate using ONLY the strengths listed above.',
    'Hard rule: never state or imply the candidate has experience, qualifications, or seniority that is not in the strengths list. Do not say their background "mirrors", "aligns with", or "matches" the role unless the listed strengths genuinely support it. If the overlap is thin, say so plainly and point to the closest real strength instead of inventing fit.',
    'Find specific, concrete, factual details about the company (tools, projects, initiatives, culture signals) the candidate can reference honestly in a cover letter.',
```

- [ ] **Step D2: Tighten the summary field description.**

In the same array, replace this exact line:

```ts
    '  "summary": "Max 3 sentences — specific tools, projects, initiatives, or culture signals that connect the candidate to this company",',
```

with this line VERBATIM (note: no em or en dashes):

```ts
    '  "summary": "Max 3 sentences. Specific, factual company signals (tools, projects, initiatives, culture). Reference the candidate only where a listed strength genuinely connects, and never assert experience the candidate does not have.",',
```

- [ ] **Step D3: Type-check and run the company intel test.**

Run: `npx tsc --noEmit` (expect exit 0), then `npx vitest run src/services/companyIntel.test.ts` (expect PASS). If the test asserts the old prompt wording and now fails, STOP and report the failing assertion rather than editing the test.

- [ ] **Step D4: Commit.**

```bash
git add server/src/services/companyIntel.ts
git commit -m "fix(intel): ground company insight in real strengths, stop fabricated candidate fit"
```

---

## Final verification (run after all tasks)

- [ ] Run `npx tsc --noEmit` from `server/` — expected exit 0.
- [ ] Run `npx vitest run` from `server/` — expected all pass.
- [ ] Report back the test summary line and confirm all four commits are present (`git log --oneline -6`).

## Notes for the reviewer (Claude/Kiron, not DeepSeek)
- Tasks B, C, D are LLM-output behaviour fixes; the only deterministic proof is re-running a real generation. After merge, regenerate one stretch-role application and confirm: education shows dates, no invented field, company insight makes no false fit claim, and the skills block reflects the job.
- Model tier (`CLAUDE_MODEL`) is intentionally NOT touched here; that is a separate config decision.

# Resume Experience Relevance & Local-Experience Curation — Implementation Plan

> **For agentic workers (DeepSeek):** ZERO-LATITUDE plan. Implement task-by-task, in order. Do NOT improvise, rename, restructure, or "improve" beyond each step. All user-facing copy and the LLM classifier prompt are pre-written here and are OWNED by the plan author — transcribe them verbatim, never reword. If any file/line/symbol does not match what the plan describes, **STOP and report** instead of guessing. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stop dumping every past job onto the resume. Feature only roles relevant to the target job in full; collapse irrelevant-but-Australian casual roles into a single "Additional Australian experience" line (to preserve the local-work signal that matters for migrant candidates); drop irrelevant non-local roles.

**Architecture:** One LLM classifier call decides, per experience, `relevant` and `australianLocal` (it owns the fuzzy geography + relevance judgment). A pure, unit-tested selection function then turns those flags into `{ featured: Experience[], additionalExperienceLine: string | null }`. The deterministic markdown renderer prints featured roles normally and the condensed line once. If classification is unavailable, ALL experience is kept (today's behaviour) — the change can never produce a worse-than-current resume.

**Tech Stack:** Express + Prisma + TypeScript backend; vitest tests; existing LLM helper `callLLM` in `server/src/services/llm.ts`.

---

## Background facts (verified — use, do not re-investigate)

- The resume is rendered by `buildTemplateResume(profile, polish, options)` in `server/src/lib/buildTemplateResume.ts`. It (1) maps the Prisma profile to `ResumeData` via `profileToResumeData`, (2) merges LLM bullets via `applyPolish` (which maps `polish.experience[i]` to `data.experience[i]` BY INDEX — order/length must be preserved until after this step), (3) runs `enforceResumeQuality`, (4) merges bridged skills, (5) renders via `profileToMarkdown`.
- `ResumeData` is defined in `server/src/lib/resumeData.ts`. Its `experience` items have at least: `role`, `company`, `location?`, `startDate`, `endDate?`, `isCurrent?`, `description?`.
- `profileToMarkdown` in `buildTemplateResume.ts` renders the Work Experience section by iterating `d.experience` and printing `### {role} | {company}`, a meta line, and bullets.
- The MAIN structured resume route is in `server/src/routes/generate.ts`. The relevant `buildTemplateResume(...)` call is the one that passes `bridgedGaps` in its options (currently around line 708-715). The `jobDescription` variable and the full `profile` (with `experience` including `location`) are in scope there.
- The LLM helper is `import { callLLM } from '../services/llm';` (returns a `Promise<string>`). JSON from LLMs is parsed elsewhere with `parseLLMJson` from `server/src/utils/parseLLMResponse.ts` (throws on bad JSON).
- Server tests: `cd server && npx vitest run`. Server typecheck: `cd server && npx tsc --noEmit`.

---

## File Structure

**Create:**
- `server/src/lib/experienceSelection.ts` — pure functions: `selectFeaturedExperience` (apply flags → featured + condensed line) and the condensed-line builder. No LLM, no DB.
- `server/src/lib/experienceSelection.test.ts` — vitest unit tests.
- `server/src/services/experienceRelevance.ts` — the LLM classifier `classifyExperiences` (owns the prompt) + strict parse + safe fallback.

**Modify:**
- `server/src/lib/resumeData.ts` — add one optional field `additionalExperienceLine?` to `ResumeData`.
- `server/src/lib/buildTemplateResume.ts` — accept `experienceFlags` in options; apply selection AFTER `applyPolish`; render the condensed line in `profileToMarkdown`.
- `server/src/routes/generate.ts` — call `classifyExperiences` before the main `buildTemplateResume` call and pass the flags in.

---

## OWNED CONTENT (transcribe verbatim — do not reword)

**Condensed line format** (built deterministically in Task 1):
```
**Additional Australian experience:** {roles} ({yearRange})
```
- `{roles}` = the irrelevant-local role titles, de-duplicated case-insensitively, in original order, joined by `, `. If more than 5, keep the first 5 and append `, and more`.
- `{yearRange}` = `"{minYear}–{maxYear}"` (en dash U+2013) using 4-digit years parsed from the start/end dates of those roles. If min === max, just `"{minYear}"`. If no year is parseable, omit the trailing ` ({yearRange})` entirely (no empty parentheses).

**LLM classifier prompt** (Task 3) — see the exact string literal inside Task 3 Step 3.

---

## Task 1: Pure experience selection + condensed line (TDD)

**Files:**
- Create: `server/src/lib/experienceSelection.ts`
- Test: `server/src/lib/experienceSelection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/lib/experienceSelection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectFeaturedExperience, type ExperienceLike, type ExperienceFlag } from './experienceSelection';

const exp = (role: string, startDate: string, endDate: string | null): ExperienceLike => ({
  role, company: 'X', startDate, endDate, location: null, isCurrent: false, description: '',
});

describe('selectFeaturedExperience', () => {
  it('keeps relevant roles as featured and drops nothing when all relevant', () => {
    const experience = [exp('Lab Tech', '2021-01', '2023-01'), exp('Analyst', '2019-01', '2020-01')];
    const flags: ExperienceFlag[] = [
      { index: 0, relevant: true, australianLocal: false },
      { index: 1, relevant: true, australianLocal: false },
    ];
    const out = selectFeaturedExperience(experience, flags);
    expect(out.featured).toHaveLength(2);
    expect(out.additionalExperienceLine).toBeNull();
  });

  it('condenses irrelevant Australian-local roles into one line and drops irrelevant non-local', () => {
    const experience = [
      exp('Lab Tech', '2021-01', '2023-01'),       // relevant
      exp('Food Handler', '2024-02', '2024-06'),    // irrelevant, local
      exp('Kitchen Hand', '2024-06', '2025-06'),    // irrelevant, local
      exp('Street Vendor', '2017-01', '2018-01'),   // irrelevant, non-local
    ];
    const flags: ExperienceFlag[] = [
      { index: 0, relevant: true, australianLocal: false },
      { index: 1, relevant: false, australianLocal: true },
      { index: 2, relevant: false, australianLocal: true },
      { index: 3, relevant: false, australianLocal: false },
    ];
    const out = selectFeaturedExperience(experience, flags);
    expect(out.featured.map(f => f.role)).toEqual(['Lab Tech']);
    expect(out.additionalExperienceLine).toBe('**Additional Australian experience:** Food Handler, Kitchen Hand (2024–2025)');
  });

  it('de-duplicates role titles and caps at 5 with "and more"', () => {
    const experience = [
      exp('Cleaner', '2024-01', '2024-02'), exp('Cleaner', '2024-03', '2024-04'),
      exp('Cashier', '2024-01', '2024-02'), exp('Waiter', '2024-01', '2024-02'),
      exp('Driver', '2024-01', '2024-02'), exp('Packer', '2024-01', '2024-02'),
      exp('Usher', '2024-01', '2024-02'),
    ];
    const flags: ExperienceFlag[] = experience.map((_, index) => ({ index, relevant: false, australianLocal: true }));
    const out = selectFeaturedExperience(experience, flags);
    expect(out.additionalExperienceLine).toBe('**Additional Australian experience:** Cleaner, Cashier, Waiter, Driver, Packer, and more (2024)');
  });

  it('falls back to keeping ALL experience when flags are missing or length-mismatched', () => {
    const experience = [exp('A', '2021-01', '2022-01'), exp('B', '2020-01', '2021-01')];
    const out = selectFeaturedExperience(experience, null);
    expect(out.featured).toHaveLength(2);
    expect(out.additionalExperienceLine).toBeNull();
  });

  it('omits the year range when no year is parseable', () => {
    const experience = [exp('Volunteer', 'Unknown', null)];
    const flags: ExperienceFlag[] = [{ index: 0, relevant: false, australianLocal: true }];
    const out = selectFeaturedExperience(experience, flags);
    expect(out.additionalExperienceLine).toBe('**Additional Australian experience:** Volunteer');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd E:/AntiGravity/JobHub/server && npx vitest run src/lib/experienceSelection.test.ts`
Expected: FAIL — "Cannot find module './experienceSelection'".

- [ ] **Step 3: Implement the pure module**

Create `server/src/lib/experienceSelection.ts`:

```ts
export interface ExperienceLike {
  role: string;
  company: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string;
}

export interface ExperienceFlag {
  index: number;        // index into the experience array this flag describes
  relevant: boolean;    // relevant to the target job → feature it in full
  australianLocal: boolean; // performed in Australia → worth a one-line mention if irrelevant
}

export interface SelectionResult<T extends ExperienceLike> {
  featured: T[];
  additionalExperienceLine: string | null;
}

// Pull a 4-digit year from a loose date string ("2024-06", "Feb 2024", "2024").
function yearOf(s: string | null | undefined): number | null {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/(19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * Apply per-experience relevance/locality flags to a candidate's experience list.
 *  - relevant            → featured (rendered in full)
 *  - irrelevant + local  → folded into a single "Additional Australian experience" line
 *  - irrelevant + !local → dropped
 * Fallback: if flags are null or do not align 1:1 with the experience list, keep ALL
 * experience as featured (today's behaviour) so this can never produce a worse resume.
 */
export function selectFeaturedExperience<T extends ExperienceLike>(
  experience: T[],
  flags: ExperienceFlag[] | null | undefined,
): SelectionResult<T> {
  const valid = Array.isArray(flags) && flags.length === experience.length;
  if (!valid) {
    return { featured: [...experience], additionalExperienceLine: null };
  }

  const flagByIndex = new Map(flags!.map(f => [f.index, f]));
  const featured: T[] = [];
  const localIrrelevant: T[] = [];

  experience.forEach((e, i) => {
    const f = flagByIndex.get(i);
    if (!f || f.relevant) { featured.push(e); return; }     // unflagged → keep (safe)
    if (f.australianLocal) { localIrrelevant.push(e); return; }
    // irrelevant + non-local → drop (do nothing)
  });

  let additionalExperienceLine: string | null = null;
  if (localIrrelevant.length > 0) {
    const seen = new Set<string>();
    const roles: string[] = [];
    for (const e of localIrrelevant) {
      const role = (e.role || '').trim();
      const key = role.toLowerCase();
      if (!role || seen.has(key)) continue;
      seen.add(key);
      roles.push(role);
    }
    const shownRoles = roles.length > 5 ? [...roles.slice(0, 5), 'and more'] : roles;

    const years: number[] = [];
    for (const e of localIrrelevant) {
      const y1 = yearOf(e.startDate);
      const y2 = yearOf(e.endDate);
      if (y1 !== null) years.push(y1);
      if (y2 !== null) years.push(y2);
    }
    let range = '';
    if (years.length > 0) {
      const min = Math.min(...years);
      const max = Math.max(...years);
      range = min === max ? ` (${min})` : ` (${min}–${max})`;
    }

    additionalExperienceLine = `**Additional Australian experience:** ${shownRoles.join(', ')}${range}`;
  }

  return { featured, additionalExperienceLine };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd E:/AntiGravity/JobHub/server && npx vitest run src/lib/experienceSelection.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/experienceSelection.ts server/src/lib/experienceSelection.test.ts
git commit -m "feat(resume): pure experience selection + condensed local line"
```

---

## Task 2: Render the condensed line (ResumeData field + profileToMarkdown)

**Files:**
- Modify: `server/src/lib/resumeData.ts`
- Modify: `server/src/lib/buildTemplateResume.ts`

- [ ] **Step 1: Add the field to ResumeData**

Open `server/src/lib/resumeData.ts`. Find the `ResumeData` interface. Add this line inside it, directly after the `skills?` field (or, if there is no `skills?` field, directly after the `professionalSummary?` field):

```ts
  /** Optional one-line summary of irrelevant Australian-local roles, rendered under Work Experience. */
  additionalExperienceLine?: string;
```

If the `ResumeData` interface is not found in this file, STOP and report.

- [ ] **Step 2: Render it in profileToMarkdown**

In `server/src/lib/buildTemplateResume.ts`, find the Work Experience render block in `profileToMarkdown`:

```ts
  if (d.experience.length) {
    section('Work Experience');
    d.experience.forEach((exp, i) => {
      push(`### ${exp.role} | ${exp.company}`);
      const meta = [dateRange(exp.startDate, exp.endDate, exp.isCurrent), exp.location].filter(Boolean).join(' · ');
      if (meta) push(`*${meta}*`);
      const bullets = cleanBullets(exp.description);
      if (bullets.length) {
        push('');
        bullets.forEach(b => push(`- ${b}`));
      }
      if (i < d.experience.length - 1) push('');
    });
  }
```

Replace it with (adds the condensed line after the entries):

```ts
  if (d.experience.length || d.additionalExperienceLine) {
    section('Work Experience');
    d.experience.forEach((exp, i) => {
      push(`### ${exp.role} | ${exp.company}`);
      const meta = [dateRange(exp.startDate, exp.endDate, exp.isCurrent), exp.location].filter(Boolean).join(' · ');
      if (meta) push(`*${meta}*`);
      const bullets = cleanBullets(exp.description);
      if (bullets.length) {
        push('');
        bullets.forEach(b => push(`- ${b}`));
      }
      if (i < d.experience.length - 1) push('');
    });
    if (d.additionalExperienceLine) {
      if (d.experience.length) push('');
      push(d.additionalExperienceLine);
    }
  }
```

- [ ] **Step 3: Verify the server typechecks**

Run: `cd E:/AntiGravity/JobHub/server && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add server/src/lib/resumeData.ts server/src/lib/buildTemplateResume.ts
git commit -m "feat(resume): render additional-experience line under Work Experience"
```

---

## Task 3: LLM relevance + locality classifier (with safe fallback)

**Files:**
- Create: `server/src/services/experienceRelevance.ts`

- [ ] **Step 1: Create the classifier**

Create `server/src/services/experienceRelevance.ts` with EXACTLY this content (the prompt string is OWNED — do not reword):

```ts
import { callLLM } from './llm';
import { parseLLMJson } from '../utils/parseLLMResponse';
import type { ExperienceFlag } from '../lib/experienceSelection';

interface ClassifierInput {
  role: string;
  company: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

const CLASSIFIER_PROMPT = (jobDescription: string, rows: string): string => `You are screening a candidate's past roles for ONE specific job application.

For EACH role, decide two booleans:
- "relevant": true if the role's field, skills, or responsibilities are meaningfully relevant to the TARGET JOB below. Professional/technical roles in the same or an adjacent field are relevant. Unrelated casual/hospitality/retail/event/manual jobs are NOT relevant to a professional role.
- "australianLocal": true if the role was performed in Australia. Use the location (Australian states/cities/suburbs such as NSW, VIC, Sydney, Melbourne, Glen Waverley, Box Hill count as Australian; Colombo, Sri Lanka, India, UK, USA do NOT). If location is empty/unknown, set false.

TARGET JOB:
${jobDescription}

ROLES (0-indexed):
${rows}

Output ONLY a JSON array, one object per role, no prose, no markdown fences:
[{"index":0,"relevant":true,"australianLocal":false}, ...]
Return exactly one object for every role index listed above.`;

/**
 * Classify each experience as relevant / australianLocal for this job. Returns null
 * on any failure (bad JSON, wrong length) so the caller falls back to keeping all
 * experience — never worse than today.
 */
export async function classifyExperiences(
  jobDescription: string,
  experiences: ClassifierInput[],
): Promise<ExperienceFlag[] | null> {
  if (!experiences.length) return null;
  const rows = experiences
    .map((e, i) => `${i}. ${e.role || 'Role'} at ${e.company || 'Unknown'} — location: ${e.location || 'unknown'} — dates: ${e.startDate || '?'} to ${e.endDate || 'present'}`)
    .join('\n');

  try {
    const raw = await callLLM(CLASSIFIER_PROMPT(jobDescription, rows));
    const parsed = parseLLMJson(raw);
    if (!Array.isArray(parsed) || parsed.length !== experiences.length) return null;
    const flags: ExperienceFlag[] = parsed.map((p: any, i: number) => ({
      index: typeof p?.index === 'number' ? p.index : i,
      relevant: p?.relevant === true,
      australianLocal: p?.australianLocal === true,
    }));
    return flags;
  } catch (err) {
    console.warn('[experienceRelevance] classification failed, keeping all experience:', (err as Error)?.message);
    return null;
  }
}
```

- [ ] **Step 2: Verify the server typechecks**

Run: `cd E:/AntiGravity/JobHub/server && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/experienceRelevance.ts
git commit -m "feat(resume): LLM experience relevance + locality classifier"
```

---

## Task 4: Wire selection into buildTemplateResume + the structured route

**Files:**
- Modify: `server/src/lib/buildTemplateResume.ts`
- Modify: `server/src/routes/generate.ts`

- [ ] **Step 1: Add the option + apply selection in buildTemplateResume**

In `server/src/lib/buildTemplateResume.ts`:

(a) Add the import at the top, after the existing `import { displayName } from './nameUtils';` line:

```ts
import { selectFeaturedExperience, type ExperienceFlag } from './experienceSelection';
```

(b) Add a field to `BuildTemplateOptions`. Find:

```ts
export interface BuildTemplateOptions {
  candidateName?: string | null;
  yearsOfExperience?: number | null;
  /** Resume-derived contact email; overrides the account email on the profile. */
  contactEmail?: string | null;
  achievementSources?: string[];
  bridgedGaps?: BridgedGap[];
}
```

Replace with:

```ts
export interface BuildTemplateOptions {
  candidateName?: string | null;
  yearsOfExperience?: number | null;
  /** Resume-derived contact email; overrides the account email on the profile. */
  contactEmail?: string | null;
  /** Per-experience relevance/locality flags; when present, curates the experience list. */
  experienceFlags?: ExperienceFlag[] | null;
  achievementSources?: string[];
  bridgedGaps?: BridgedGap[];
}
```

(c) Apply the selection AFTER `applyPolish` (so bullet indices already mapped) and BEFORE `enforceResumeQuality`. Find:

```ts
  // Step 2: Merge polish (if valid)
  if (polish) {
    data = applyPolish(data, polish);
  }

  // Step 3: Quality enforcers
```

Replace with:

```ts
  // Step 2: Merge polish (if valid)
  if (polish) {
    data = applyPolish(data, polish);
  }

  // Step 2.5: Curate experience — feature relevant roles in full, fold irrelevant
  // Australian-local roles into one line, drop irrelevant non-local roles. Runs after
  // applyPolish so the bullet-to-experience index mapping is already resolved.
  {
    const selection = selectFeaturedExperience(data.experience, options?.experienceFlags ?? null);
    data = {
      ...data,
      experience: selection.featured,
      additionalExperienceLine: selection.additionalExperienceLine ?? undefined,
    };
  }

  // Step 3: Quality enforcers
```

- [ ] **Step 2: Verify the server typechecks (buildTemplateResume only)**

Run: `cd E:/AntiGravity/JobHub/server && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Call the classifier in the structured resume route and pass flags**

In `server/src/routes/generate.ts`:

(a) Add the import next to the other `../services` imports near the top of the file (e.g. after an existing `import { ... } from '../services/...'` line):

```ts
import { classifyExperiences } from '../services/experienceRelevance';
```

(b) Find the MAIN structured resume `buildTemplateResume` call — it is the one whose options object contains `bridgedGaps,`. It currently looks like:

```ts
        const finalContent = buildTemplateResume(profile, polish, {
            candidateName: profile?.name,
            yearsOfExperience: resolveYearsOfExperience([profile?.professionalSummary, profile?.resumeRawText], profile?.experience),
            contactEmail: extractContactEmail(profile?.resumeRawText),
            achievementSources: selectedAchievements
                .map((a: any) => a?.description ?? '')
                .filter((s: string) => s && s.length > 0),
            bridgedGaps,
        });
```

Directly ABOVE that statement, insert:

```ts
        // Curate which past roles appear on the resume for THIS job (irrelevant
        // casual roles bloat Australian resumes). Non-fatal: on any failure the
        // classifier returns null and buildTemplateResume keeps all experience.
        const experienceFlags = await classifyExperiences(
            jobDescription,
            (profile?.experience ?? []).map((e: any) => ({
                role: e.role, company: e.company, location: e.location,
                startDate: e.startDate, endDate: e.endDate,
            })),
        );
```

Then add `experienceFlags,` to that `buildTemplateResume` options object so it becomes:

```ts
        const finalContent = buildTemplateResume(profile, polish, {
            candidateName: profile?.name,
            yearsOfExperience: resolveYearsOfExperience([profile?.professionalSummary, profile?.resumeRawText], profile?.experience),
            contactEmail: extractContactEmail(profile?.resumeRawText),
            experienceFlags,
            achievementSources: selectedAchievements
                .map((a: any) => a?.description ?? '')
                .filter((s: string) => s && s.length > 0),
            bridgedGaps,
        });
```

If `jobDescription` is NOT in scope at this location, STOP and report (do not substitute another variable).

- [ ] **Step 4: Verify the whole server typechecks**

Run: `cd E:/AntiGravity/JobHub/server && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Run the full server test suite**

Run: `cd E:/AntiGravity/JobHub/server && npx vitest run`
Expected: all tests PASS (including `experienceSelection.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/buildTemplateResume.ts server/src/routes/generate.ts
git commit -m "feat(resume): curate experience by JD relevance + local condensation"
```

---

## Task 5: STOP — manual verification

- [ ] **Step 1: Restart the server and regenerate a resume for a candidate with mixed experience**

Use a candidate like Pawan (relevant overseas lab roles + irrelevant Australian casual jobs) against a clinical/lab JD. Confirm in the generated resume:
1. The relevant professional roles appear in full with bullets.
2. The casual roles (food handler, grocery, event staff) are GONE as full entries and instead appear as ONE line: `Additional Australian experience: ...` with a year range.
3. The resume is materially shorter (closer to 1-2 pages).
4. `server/server.log` shows no `[experienceRelevance] classification failed` warning (if it does, the classifier failed and all experience was kept — report it).

- [ ] **Step 2: If the classifier marks everything relevant (no condensation) or marks relevant roles as irrelevant, STOP and report the JD used, the experience list, and the raw classifier output. Do not tune the prompt yourself — report for the plan author to adjust.**

---

## Self-Review (completed by plan author)

- **Spec coverage:** relevant → full (Task 1 featured + Task 4 wiring); irrelevant-local → one line (Task 1 condensed line + Task 2 render); irrelevant-non-local → dropped (Task 1); fuzzy judgment via LLM (Task 3); safe fallback to "keep all" (Task 1 invalid-flags branch + Task 3 null returns). Covered.
- **Placeholders:** none — full code in every step.
- **Type consistency:** `ExperienceFlag` (`index`/`relevant`/`australianLocal`) defined once in Task 1 and imported unchanged by Task 3 and Task 4; `selectFeaturedExperience` signature `(experience, flags)` matches its call in buildTemplateResume; `experienceFlags` option name matches between the interface (Task 4 Step 1b) and the route call (Task 4 Step 3); `additionalExperienceLine` matches between `ResumeData` (Task 2), `SelectionResult` (Task 1), and `profileToMarkdown` (Task 2).
- **Scope guard:** only the MAIN structured `buildTemplateResume` call (the one with `bridgedGaps`) is wired — the legacy/recovery call elsewhere in generate.ts is intentionally left untouched to limit blast radius. The en dash in the condensed line is U+2013 (matches the test assertions exactly).
- **Assumption (flagged to user):** irrelevant non-local roles are dropped entirely; only irrelevant Australian-local roles get the one-line mention.

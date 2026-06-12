# Resume Optimisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the structured resume generator produce relevance-ordered, 2-page-or-under resumes with a JD-derived headline, smart metric tips, and a frontend page-overflow warning — with zero hallucination.

**Architecture:** Extend the `PolishPayload` Zod schema so Claude can output `experienceOrder` (IDs ranked by JD-relevance), `display` per role (`full`/`fold`/`omit`), `targetRoleTitle`, `tips` per bullet, and `pageBudgetWarning`. `buildTemplateResume` owns all ordering/curation logic internally. The route extracts flattened tips and estimated page count, passing them to the frontend. The frontend adds a warning banner (when `estimatedPages > 2`) and an inline tips toggle that renders `ⓘ` icons on specific bullets via a custom ReactMarkdown `li` component.

**Tech Stack:** TypeScript, Zod v4, Vitest, React, ReactMarkdown, Express

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Modify | `server/src/lib/validatePolish.ts` | Add `targetRoleTitle`, `experienceOrder`, `pageBudgetWarning`, `display`, `tips` to Zod schema |
| Create | `server/src/lib/__tests__/validatePolish.test.ts` | Schema unit tests |
| Modify | `server/src/services/prompts/resumeStructuredPrompt.ts` | Add new fields to output JSON schema and instructions |
| Modify | `server/src/lib/buildTemplateResume.ts` | Add `reorderExperience`, `enforceSummaryWordCount`; update `PolishPayload` interface; update `buildTemplateResume` orchestrator |
| Create | `server/src/lib/__tests__/buildTemplateResume.test.ts` | Unit tests for pure helper functions |
| Modify | `server/src/routes/generate.ts` | Simplify `/resume-structured` route: remove redundant flag pre-computation, add `tips` extraction + `estimatedPages`, update response shape |
| Create | `src/lib/extractReactText.ts` | Pure utility to extract plain text from React children (needed for tip matching) |
| Create | `src/lib/__tests__/extractReactText.test.ts` | Unit test for the utility |
| Modify | `src/pages/StepperWorkspace.tsx` | Add `ResumeTip` type, extend `PersistedDraft`, add tips state + `estimatedPages` state, page warning banner, tips toggle, custom `li` renderer |

---

## Task 1 — Extend PolishPayload Zod schema

**Files:**
- Modify: `server/src/lib/validatePolish.ts`
- Create: `server/src/lib/__tests__/validatePolish.test.ts`

- [ ] **Step 1.1 — Write failing tests**

Create `server/src/lib/__tests__/validatePolish.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PolishPayloadSchema, parsePolishJson } from '../validatePolish';

describe('PolishPayloadSchema — new fields', () => {
  it('accepts targetRoleTitle', () => {
    const result = PolishPayloadSchema.parse({ targetRoleTitle: 'Seed Plant Operator' });
    expect(result.targetRoleTitle).toBe('Seed Plant Operator');
  });

  it('accepts experienceOrder array of strings', () => {
    const result = PolishPayloadSchema.parse({ experienceOrder: ['id1', 'id2'] });
    expect(result.experienceOrder).toEqual(['id1', 'id2']);
  });

  it('accepts pageBudgetWarning boolean', () => {
    const result = PolishPayloadSchema.parse({ pageBudgetWarning: true });
    expect(result.pageBudgetWarning).toBe(true);
  });

  it('accepts display enum on an experience entry', () => {
    const result = PolishPayloadSchema.parse({
      experience: [{ id: 'x', bullets: [], display: 'fold' }],
    });
    expect(result.experience![0].display).toBe('fold');
  });

  it('rejects invalid display value', () => {
    expect(() =>
      PolishPayloadSchema.parse({
        experience: [{ id: 'x', bullets: [], display: 'invisible' }],
      })
    ).toThrow();
  });

  it('accepts tips array on an experience entry', () => {
    const result = PolishPayloadSchema.parse({
      experience: [
        {
          id: 'x',
          bullets: ['Maintained water quality across aquaponics systems'],
          tips: [{ bulletIndex: 0, suggestion: 'Add what % yield improved' }],
        },
      ],
    });
    expect(result.experience![0].tips![0].suggestion).toBe('Add what % yield improved');
  });

  it('strips truly unknown fields (strip() still active)', () => {
    const result = PolishPayloadSchema.parse({ summary: 'ok', unknownField: 'gone' });
    expect((result as any).unknownField).toBeUndefined();
  });

  it('old callers without display or tips still parse', () => {
    const legacy = {
      experience: [{ id: 'x', bullets: ['b'], casual: false, australianLocal: true }],
    };
    expect(() => PolishPayloadSchema.parse(legacy)).not.toThrow();
  });
});

describe('parsePolishJson — backward compatibility', () => {
  it('parses legacy JSON format without new fields', () => {
    const raw = JSON.stringify({
      summary: 'ok',
      experience: [{ id: 'x', bullets: ['b'], casual: false, australianLocal: true }],
    });
    const result = parsePolishJson(raw);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('ok');
  });

  it('returns null for invalid JSON', () => {
    expect(parsePolishJson('not json')).toBeNull();
  });
});
```

- [ ] **Step 1.2 — Run tests to verify they fail**

```bash
cd server && npx vitest run src/lib/__tests__/validatePolish.test.ts
```

Expected: multiple failures including `targetRoleTitle`, `experienceOrder`, `display`, `tips`, `pageBudgetWarning`.

- [ ] **Step 1.3 — Update the schema**

Replace the entire content of `server/src/lib/validatePolish.ts` with:

```typescript
import { z } from 'zod';

// NOTE: PolishPayload in server/src/lib/buildTemplateResume.ts mirrors this shape.
// Keep both in sync — this Zod schema is the single source of truth.

export const PolishPayloadSchema = z.object({
  summary: z.string().optional(),
  /** JD-derived role title to use as the candidate's header headline. */
  targetRoleTitle: z.string().optional(),
  /** true when Claude estimates content still exceeds 2 pages after curation. */
  pageBudgetWarning: z.boolean().optional(),
  /** All experience IDs sorted from most to least relevant to this JD. */
  experienceOrder: z.array(z.string()).optional(),
  experience: z
    .array(
      z.object({
        id: z.string(),
        bullets: z.array(z.string()),
        casual: z.boolean().optional(),
        australianLocal: z.boolean().optional(),
        /** Render decision: full bullets | one-line fold | excluded entirely. */
        display: z.enum(['full', 'fold', 'omit']).optional(),
        /** Per-bullet tips for missing metrics. Max 2 per role, 5 total. */
        tips: z
          .array(
            z.object({
              bulletIndex: z.number().int().nonnegative(),
              suggestion: z.string(),
            })
          )
          .optional(),
      })
    )
    .optional(),
}).strip();

export type ValidatedPolish = z.infer<typeof PolishPayloadSchema>;

/**
 * Safely validates and parses raw LLM JSON string into a polish payload.
 * Returns null on any failure (invalid JSON, schema mismatch).
 */
export function parsePolishJson(raw: string): ValidatedPolish | null {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    return PolishPayloadSchema.parse(JSON.parse(raw.slice(start, end + 1)));
  } catch (err) {
    console.warn('[validatePolish] Failed to validate LLM polish JSON:', err instanceof Error ? err.message : err);
    return null;
  }
}
```

- [ ] **Step 1.4 — Run tests to verify they pass**

```bash
cd server && npx vitest run src/lib/__tests__/validatePolish.test.ts
```

Expected: all tests pass.

- [ ] **Step 1.5 — Commit**

```bash
git add server/src/lib/validatePolish.ts server/src/lib/__tests__/validatePolish.test.ts
git commit -m "feat(resume): extend PolishPayload schema — experienceOrder, display, tips, targetRoleTitle"
```

---

## Task 2 — Update RESUME_STRUCTURED_PROMPT

**Files:**
- Modify: `server/src/services/prompts/resumeStructuredPrompt.ts`

- [ ] **Step 2.1 — Replace the OUTPUT section of the prompt**

In `server/src/services/prompts/resumeStructuredPrompt.ts`, locate the exact line:

```
==============================================================
OUTPUT
==============================================================
```

Delete from that line to the very end of the file (including the closing backtick, semicolon, and `};` that close the template literal and the function). Replace with the following — the closing `` `; `` and `};` are included at the bottom:

```
==============================================================
OUTPUT
==============================================================
Return ONLY this JSON object. No preamble, no explanation, no markdown fences.

{
  "summary": "first-person professional summary, 3-4 sentences, no name, no he/she/they",
  "targetRoleTitle": "exact job title from the job ad — copy it word for word",
  "pageBudgetWarning": false,
  "experienceOrder": ["id of most relevant role", "id of 2nd most relevant", "...continue for ALL ids"],
  "experience": [
    {
      "id": "the exact id from the work history above",
      "casual": false,
      "australianLocal": true,
      "display": "full",
      "bullets": ["tailored bullet", "tailored bullet"],
      "tips": [
        {
          "bulletIndex": 0,
          "suggestion": "Adding what % or volume figure here would make this achievement significantly stronger — for example, how many tonnes of seed were processed per season, or what yield improvement was achieved."
        }
      ]
    }
  ]
}

FIELD RULES:

targetRoleTitle: Copy the job title exactly from the job ad. This becomes the candidate's resume headline. Do not invent a title not in the ad.

experienceOrder: List ALL experience IDs from the work history, sorted from most to least relevant to this specific job. Every id must appear exactly once. This is the order they will appear on the resume.

display: Set one value per experience entry.
- "full" — any substantive professional, technical, managerial, academic, or research role. This is the default for almost every role.
- "fold" — a casual or survival job only: retail assistant, kitchen hand, delivery driver, warehouse picker, cleaning staff, or similar work with no professional skill relevance to any career. A restaurant MANAGER is NOT casual — set "full". When in doubt, set "full".
- "omit" — only for a role that is both irrelevant to this job AND was performed entirely outside Australia. Never omit Australian roles.

pageBudgetWarning: Set true only if you estimate the resume content you have written will still exceed 2 pages after all your curation decisions. Be honest — a false alarm is better than silently producing a 3-page resume.

tips (optional, per experience): Add a tip ONLY when a bullet would be significantly stronger with a specific metric that you cannot invent from the resume. Each tip must be one concrete, specific sentence spelling out exactly what the candidate should add — name the type of number (%, $, volume, timeframe, headcount). Do not add a tip for a bullet that is already quantified. Maximum 2 tips per experience entry, 5 tips total across the entire resume. If no bullet needs a tip, omit the tips array entirely.

Return one experience object for EVERY entry in the work history. Every object must carry its exact id. Output nothing except the JSON.`;
};
```

The file must end with exactly those two lines: the closing backtick + semicolon on one line, then `};` on the next.

> **STOP AND REPORT:** Open a terminal and run the server in dev mode (`cd server && npm run dev`), then call the `/generate/resume-structured` endpoint with a test payload. Confirm the response parses without errors and includes the new fields (`targetRoleTitle`, `experienceOrder`, `display`, `tips`, `pageBudgetWarning`) in the raw LLM output. Do not proceed until this is confirmed.

- [ ] **Step 2.2 — Commit**

```bash
git add server/src/services/prompts/resumeStructuredPrompt.ts
git commit -m "feat(resume): prompt outputs experienceOrder, display, tips, targetRoleTitle, pageBudgetWarning"
```

---

## Task 3 — Add pure helpers to buildTemplateResume + update PolishPayload interface

**Files:**
- Modify: `server/src/lib/buildTemplateResume.ts`
- Create: `server/src/lib/__tests__/buildTemplateResume.test.ts`

- [ ] **Step 3.1 — Write failing tests**

Create `server/src/lib/__tests__/buildTemplateResume.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reorderExperience, enforceSummaryWordCount } from '../buildTemplateResume';

describe('reorderExperience', () => {
  const exps = [
    { id: 'a', role: 'Manager' },
    { id: 'b', role: 'Intern' },
    { id: 'c', role: 'Operator' },
  ];

  it('reorders by provided ID sequence', () => {
    const result = reorderExperience(exps, ['c', 'b', 'a']);
    expect(result.map(e => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('appends experiences not in the order array at the end', () => {
    const result = reorderExperience(exps, ['c']);
    expect(result[0].id).toBe('c');
    expect(result).toHaveLength(3);
  });

  it('returns original order when orderIds is empty', () => {
    const result = reorderExperience(exps, []);
    expect(result.map(e => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('skips IDs not found in experiences', () => {
    const result = reorderExperience(exps, ['UNKNOWN', 'b']);
    expect(result[0].id).toBe('b');
    expect(result).toHaveLength(3);
  });

  it('does not mutate the original array', () => {
    const original = [...exps];
    reorderExperience(exps, ['c', 'a', 'b']);
    expect(exps.map(e => e.id)).toEqual(original.map(e => e.id));
  });
});

describe('enforceSummaryWordCount', () => {
  it('returns summary unchanged when at or under 80 words', () => {
    const s = 'word '.repeat(80).trim();
    expect(enforceSummaryWordCount(s)).toBe(s);
  });

  it('trims to exactly 80 words when over', () => {
    const s = 'word '.repeat(90).trim();
    const result = enforceSummaryWordCount(s);
    expect(result.split(/\s+/).length).toBe(80);
  });

  it('returns empty string unchanged', () => {
    expect(enforceSummaryWordCount('')).toBe('');
  });

  it('respects a custom maxWords argument', () => {
    const s = 'word '.repeat(10).trim();
    expect(enforceSummaryWordCount(s, 5).split(/\s+/).length).toBe(5);
  });
});
```

- [ ] **Step 3.2 — Run tests to verify they fail**

```bash
cd server && npx vitest run src/lib/__tests__/buildTemplateResume.test.ts
```

Expected: `reorderExperience is not a function`, `enforceSummaryWordCount is not a function`.

- [ ] **Step 3.3 — Add the two exported pure helper functions**

Open `server/src/lib/buildTemplateResume.ts`. Immediately AFTER the existing `mergeBridgedSkills` function (around line 142) and BEFORE the `profileToResumeData` function, insert:

```typescript
// =============================================================================
// reorderExperience — pure, testable
// =============================================================================

/**
 * Returns a new array with experiences sorted by the provided ID sequence.
 * Experiences whose IDs are not in orderIds are appended at the end in their
 * original relative order. The input array is never mutated.
 */
export function reorderExperience<T extends { id: string }>(
  experiences: T[],
  orderIds: string[],
): T[] {
  if (orderIds.length === 0) return [...experiences];
  const byId = new Map(experiences.map(e => [e.id, e]));
  const ordered: T[] = orderIds
    .map(id => byId.get(id))
    .filter((e): e is T => e !== undefined);
  const orderedIdSet = new Set(orderIds);
  const remaining = experiences.filter(e => !orderedIdSet.has(e.id));
  return [...ordered, ...remaining];
}

// =============================================================================
// enforceSummaryWordCount — pure, testable
// =============================================================================

/**
 * Hard-trims a professional summary to maxWords words.
 * The LLM is instructed to stay within bounds, but this is the backstop.
 */
export function enforceSummaryWordCount(summary: string, maxWords = 80): string {
  if (!summary) return summary;
  const words = summary.trim().split(/\s+/);
  if (words.length <= maxWords) return summary;
  return words.slice(0, maxWords).join(' ');
}
```

- [ ] **Step 3.4 — Run tests to verify they pass**

```bash
cd server && npx vitest run src/lib/__tests__/buildTemplateResume.test.ts
```

Expected: all tests pass.

- [ ] **Step 3.5 — Update the PolishPayload interface**

In `server/src/lib/buildTemplateResume.ts`, locate the `PolishPayload` interface (around line 28) and replace it entirely with:

```typescript
export interface PolishPayload {
  summary?: string;
  targetRoleTitle?: string;
  pageBudgetWarning?: boolean;
  experienceOrder?: string[];
  experience?: Array<{
    id: string;
    bullets: string[];
    casual?: boolean;
    australianLocal?: boolean;
    display?: 'full' | 'fold' | 'omit';
    tips?: Array<{ bulletIndex: number; suggestion: string }>;
  }>;
}
```

- [ ] **Step 3.6 — Commit**

```bash
git add server/src/lib/buildTemplateResume.ts server/src/lib/__tests__/buildTemplateResume.test.ts
git commit -m "feat(resume): add reorderExperience and enforceSummaryWordCount helpers"
```

---

## Task 4 — Update buildTemplateResume orchestrator

**Files:**
- Modify: `server/src/lib/buildTemplateResume.ts`

This task modifies the `buildTemplateResume` function body only. No new tests needed — the pure helpers are already tested.

- [ ] **Step 4.1 — Replace the buildTemplateResume function body**

Locate the `buildTemplateResume` function in `server/src/lib/buildTemplateResume.ts` (starts around line 373). Replace the entire function body with the following. The function signature and JSDoc comment stay the same — only the body changes.

```typescript
export function buildTemplateResume(
  profile: ProfileWithRelations,
  polish: PolishPayload | null,
  options?: BuildTemplateOptions
): string {
  // ── Step 0: Reorder profile.experience + align polish.experience ────────────
  // Both arrays must be in the same order before index-based applyPolish runs.
  let orderedProfile = profile;
  let orderedPolish = polish;

  if (polish?.experienceOrder && polish.experienceOrder.length > 0) {
    const reorderedProfileExps = reorderExperience(profile.experience, polish.experienceOrder);
    orderedProfile = { ...profile, experience: reorderedProfileExps };

    if (polish.experience && polish.experience.length > 0) {
      const reorderedPolishExps = reorderExperience(
        polish.experience as Array<{ id: string } & (typeof polish.experience)[number]>,
        polish.experienceOrder,
      );
      orderedPolish = { ...polish, experience: reorderedPolishExps };
    }
  }

  // ── Step 1: Profile → ResumeData ────────────────────────────────────────────
  let data = profileToResumeData(orderedProfile);

  // Contact email comes from the resume raw text, not the account/login email.
  if (options?.contactEmail) {
    data = { ...data, email: options.contactEmail };
  }

  // JD-derived role headline overrides the stored profileRole when provided.
  if (orderedPolish?.targetRoleTitle) {
    data = { ...data, targetRole: orderedPolish.targetRoleTitle };
  }

  // Preferred display name (first + last) so long legal names read cleanly.
  const headerName = displayName(profile.name);
  if (headerName) {
    data = { ...data, name: headerName };
  }

  // ── Step 2: Merge polish (bullets, summary) ─────────────────────────────────
  if (orderedPolish) {
    data = applyPolish(data, orderedPolish);
  }

  // ── Step 2.1: Enforce summary word count (hard backstop: 80 words max) ──────
  if (data.professionalSummary) {
    data = { ...data, professionalSummary: enforceSummaryWordCount(data.professionalSummary) };
  }

  // ── Step 2.5: Feature/fold/omit curation ────────────────────────────────────
  // Prefer display flags from polish (new path) over options.experienceFlags
  // (old wildcard path). Build flags from display when any entry has one set.
  const polishExps = orderedPolish?.experience ?? [];
  const hasDisplayFlags = polishExps.some(e => e.display !== undefined);

  let experienceFlagsToUse = options?.experienceFlags ?? null;

  if (hasDisplayFlags && polishExps.length === orderedProfile.experience.length) {
    const rawFlags = polishExps.map((e, i) => {
      if (e.display === 'omit') return { index: i, relevant: false, australianLocal: false };
      if (e.display === 'fold') return { index: i, relevant: false, australianLocal: true };
      // 'full' or undefined — treat as relevant; fall back to casual flag if present
      return {
        index: i,
        relevant: e.casual !== true,
        australianLocal: e.australianLocal === true,
      };
    });
    // Hard guard: never empty the work history section
    const featured = data.experience.filter((_, i) => rawFlags[i]?.relevant !== false);
    experienceFlagsToUse = featured.length > 0 ? rawFlags : null;
  }

  {
    const selection = selectFeaturedExperience(data.experience, experienceFlagsToUse);
    data = {
      ...data,
      experience: selection.featured,
      additionalExperienceLine: selection.additionalExperienceLine ?? undefined,
    };
  }

  // ── Step 2.6: Two-page curation (education + volunteering) ─────────────────
  data = curateEducationAndVolunteering(data);

  // ── Step 3: Quality enforcers ───────────────────────────────────────────────
  data = enforceResumeQuality(data, {
    candidateName: options?.candidateName,
    yearsOfExperience: options?.yearsOfExperience,
    achievementSources: options?.achievementSources,
  });

  // ── Step 4: Merge bridged-gap skills ────────────────────────────────────────
  data = { ...data, skills: mergeBridgedSkills(data.skills, options?.bridgedGaps) };

  // ── Step 5: Render to markdown ──────────────────────────────────────────────
  return profileToMarkdown(data);
}
```

- [ ] **Step 4.2 — Verify existing tests still pass**

```bash
cd server && npx vitest run
```

Expected: all tests pass (including the new ones from Task 3).

- [ ] **Step 4.3 — Commit**

```bash
git add server/src/lib/buildTemplateResume.ts
git commit -m "feat(resume): buildTemplateResume applies relevance ordering, display flags, targetRoleTitle, summary word count"
```

---

## Task 5 — Update /resume-structured route

**Files:**
- Modify: `server/src/routes/generate.ts` (the `router.post('/resume-structured', ...)` handler only — do NOT touch the wildcard `/:type` handler)

- [ ] **Step 5.1 — Locate the block to remove in the route**

In `server/src/routes/generate.ts`, inside the `/resume-structured` handler, find and DELETE the following block (lines ~684–699). This logic now lives inside `buildTemplateResume`:

```typescript
const allExperience = (profile?.experience ?? []) as any[];
const rawFlags = (polish?.experience ?? []).map((e: any, i: number) => ({
    index: i,
    relevant: e?.casual !== true,
    australianLocal: e?.australianLocal === true,
}));
const alignedFlags = rawFlags.length === allExperience.length ? rawFlags : null;
const featured = alignedFlags
    ? allExperience.filter((_, i) => alignedFlags[i].relevant)
    : allExperience;
// Hard guard: curation must never empty the work history. If every role was
// marked casual, ignore the flags and show them all.
const experienceFlags = (alignedFlags && featured.length > 0) ? alignedFlags : null;
const resumeYears = resolveYearsOfExperience(
    [profile?.professionalSummary, profile?.resumeRawText],
    featured.length > 0 ? featured : allExperience,
);
```

Replace it with:

```typescript
const resumeYears = resolveYearsOfExperience(
    [profile?.professionalSummary, profile?.resumeRawText],
    profile?.experience ?? [],
);
```

- [ ] **Step 5.2 — Update the buildTemplateResume call to remove experienceFlags**

Find the `buildTemplateResume` call in the `/resume-structured` handler:

```typescript
const finalContent = buildTemplateResume(profile, polish, {
    candidateName: profile?.name,
    yearsOfExperience: resumeYears,
    contactEmail: extractContactEmail(profile?.resumeRawText),
    achievementSources: selectedAchievements
        .map((a: any) => a?.description ?? '')
        .filter((s: string) => s && s.length > 0),
    experienceFlags: experienceFlags ?? undefined,
});
```

Replace with:

```typescript
const finalContent = buildTemplateResume(profile, polish, {
    candidateName: profile?.name,
    yearsOfExperience: resumeYears,
    contactEmail: extractContactEmail(profile?.resumeRawText),
    achievementSources: selectedAchievements
        .map((a: any) => a?.description ?? '')
        .filter((s: string) => s && s.length > 0),
});
```

- [ ] **Step 5.3 — Add estimatedPages and tips extraction after the buildTemplateResume call**

Immediately after the `buildTemplateResume(...)` call, insert:

```typescript
// Estimate pages: ~45 non-empty lines per A4 page at standard margins.
const nonEmptyLines = finalContent.split('\n').filter(l => l.trim().length > 0).length;
const estimatedPages = Math.ceil(nonEmptyLines / 45);

// Flatten per-bullet tips from polish into { bulletKey, suggestion } pairs.
// bulletKey = first 40 chars of the bullet text (used for matching in the editor).
const resumeTips: Array<{ bulletKey: string; suggestion: string }> = [];
if (polish?.experience) {
    for (const exp of polish.experience) {
        for (const tip of (exp.tips ?? [])) {
            const bullet = exp.bullets?.[tip.bulletIndex];
            if (bullet && bullet.trim().length > 0) {
                resumeTips.push({
                    bulletKey: bullet.trim().slice(0, 40),
                    suggestion: tip.suggestion,
                });
            }
        }
    }
}
```

- [ ] **Step 5.4 — Update the res.json response to include the new fields**

Find:

```typescript
res.json({
    content: finalContent,
    id: doc.id,
    costBreakdown,
    blueprint: null,
    polishAccepted: polish !== null,
});
```

Replace with:

```typescript
res.json({
    content: finalContent,
    id: doc.id,
    costBreakdown,
    blueprint: null,
    polishAccepted: polish !== null,
    estimatedPages,
    tips: resumeTips,
    pageBudgetWarning: polish?.pageBudgetWarning ?? false,
});
```

- [ ] **Step 5.5 — Verify server compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5.6 — Commit**

```bash
git add server/src/routes/generate.ts
git commit -m "feat(resume): route returns estimatedPages and tips; removes redundant flag pre-computation"
```

> **STOP AND REPORT:** Generate a resume end-to-end via `/generate/resume-structured`. Log the full API response. Confirm:
> 1. `estimatedPages` is present and is a number (1, 2, or 3).
> 2. `tips` is an array (may be empty if Claude found no missing metrics).
> 3. `pageBudgetWarning` is a boolean.
> 4. The resume content renders correctly — no blank Work Experience section, no missing sections.
> Do not proceed until all four are confirmed.

---

## Task 6 — extractReactText utility

**Files:**
- Create: `src/lib/extractReactText.ts`
- Create: `src/lib/__tests__/extractReactText.test.ts`

This utility extracts plain text from React children nodes. It is needed by the custom ReactMarkdown `li` renderer to match bullet text against tip keys.

- [ ] **Step 6.1 — Write failing test**

Create `src/lib/__tests__/extractReactText.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractReactText } from '../extractReactText';

describe('extractReactText', () => {
  it('returns a plain string unchanged', () => {
    expect(extractReactText('hello world')).toBe('hello world');
  });

  it('converts a number to string', () => {
    expect(extractReactText(42)).toBe('42');
  });

  it('returns empty string for null', () => {
    expect(extractReactText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(extractReactText(undefined)).toBe('');
  });

  it('joins an array of strings', () => {
    expect(extractReactText(['foo', ' ', 'bar'])).toBe('foo bar');
  });

  it('joins a nested array', () => {
    expect(extractReactText(['foo', ['bar', 'baz']])).toBe('foobarbaz');
  });
});
```

- [ ] **Step 6.2 — Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/extractReactText.test.ts
```

Expected: `Cannot find module '../extractReactText'`.

> **Note:** If the frontend package does not have a `vitest.config.ts`, check if Vitest is listed in `package.json` devDependencies. If not, install it: `npm install -D vitest`. If it is present, just run the test.

- [ ] **Step 6.3 — Create the utility**

Create `src/lib/extractReactText.ts`:

```typescript
import React from 'react';

/**
 * Recursively extracts plain text content from React children.
 * Used by the custom ReactMarkdown `li` renderer to match bullet text
 * against tip bullet keys.
 */
export function extractReactText(children: React.ReactNode): string {
  if (children === null || children === undefined) return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number' || typeof children === 'boolean') return String(children);
  if (Array.isArray(children)) return children.map(extractReactText).join('');
  if (React.isValidElement(children)) {
    return extractReactText((children.props as { children?: React.ReactNode }).children);
  }
  return '';
}
```

- [ ] **Step 6.4 — Run test to verify it passes**

```bash
npx vitest run src/lib/__tests__/extractReactText.test.ts
```

Expected: all tests pass.

- [ ] **Step 6.5 — Commit**

```bash
git add src/lib/extractReactText.ts src/lib/__tests__/extractReactText.test.ts
git commit -m "feat(resume): add extractReactText utility for tip-icon bullet matching"
```

---

## Task 7 — Update StepperWorkspace

**Files:**
- Modify: `src/pages/StepperWorkspace.tsx`

Make changes in the exact order specified. Each numbered sub-step targets a specific location in the file.

- [ ] **Step 7.1 — Add ResumeTip type and import extractReactText**

At the top of the file, after the existing imports, add:

```typescript
import { extractReactText } from '../lib/extractReactText';
```

After the `CompanyIntel` interface definition (around line 57), add:

```typescript
interface ResumeTip {
  bulletKey: string;
  suggestion: string;
}
```

- [ ] **Step 7.2 — Extend PersistedDraft to include tips**

Locate the `PersistedDraft` interface (line 99):

```typescript
interface PersistedDraft {
    content: string;
    generatedAt: string;
    edited: boolean;
}
```

Replace with:

```typescript
interface PersistedDraft {
    content: string;
    generatedAt: string;
    edited: boolean;
    tips?: ResumeTip[];
    estimatedPages?: number;
}
```

- [ ] **Step 7.3 — Replace the MARKDOWN_COMPONENTS const with a builder function**

Locate the `MARKDOWN_COMPONENTS` const (line 78):

```typescript
const MARKDOWN_COMPONENTS = {
    strong: ({ children }: { children?: React.ReactNode }) => <strong style={STRONG_COLOR}>{children}</strong>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 style={HEADING_COLOR}>{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 style={HEADING_COLOR}>{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 style={HEADING_COLOR}>{children}</h3>,
    h4: ({ children }: { children?: React.ReactNode }) => <h4 style={HEADING_COLOR}>{children}</h4>,
};
```

Replace it entirely with:

```typescript
/** Inline tip icon rendered next to bullets that need a metric. */
function TipIcon({ suggestion }: { suggestion: string }) {
    const [open, setOpen] = React.useState(false);
    return (
        <span style={{ position: 'relative', display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }}>
            <span
                role="button"
                aria-label="Tip: strengthen this bullet"
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#d97706',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    userSelect: 'none',
                    lineHeight: 1,
                }}
            >
                i
            </span>
            {open && (
                <span
                    style={{
                        position: 'absolute',
                        bottom: 22,
                        left: 0,
                        zIndex: 50,
                        background: '#1c1917',
                        border: '1px solid #44403c',
                        borderRadius: 6,
                        padding: '8px 12px',
                        width: 260,
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: '#e7e5e4',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        whiteSpace: 'normal',
                    }}
                >
                    {suggestion}
                </span>
            )}
        </span>
    );
}

function buildMarkdownComponents(tips: ResumeTip[], showTips: boolean) {
    return {
        strong: ({ children }: { children?: React.ReactNode }) => (
            <strong style={STRONG_COLOR}>{children}</strong>
        ),
        h1: ({ children }: { children?: React.ReactNode }) => (
            <h1 style={HEADING_COLOR}>{children}</h1>
        ),
        h2: ({ children }: { children?: React.ReactNode }) => (
            <h2 style={HEADING_COLOR}>{children}</h2>
        ),
        h3: ({ children }: { children?: React.ReactNode }) => (
            <h3 style={HEADING_COLOR}>{children}</h3>
        ),
        h4: ({ children }: { children?: React.ReactNode }) => (
            <h4 style={HEADING_COLOR}>{children}</h4>
        ),
        li: ({ children }: { children?: React.ReactNode }) => {
            if (showTips && tips.length > 0) {
                const text = extractReactText(children).trim();
                const tip = tips.find(t => text.startsWith(t.bulletKey.slice(0, 35)));
                return (
                    <li>
                        {children}
                        {tip && <TipIcon suggestion={tip.suggestion} />}
                    </li>
                );
            }
            return <li>{children}</li>;
        },
    };
}
```

- [ ] **Step 7.4 — Add component-level state for tips, estimatedPages, showTips**

Inside the `StepPanel` component function (the component that contains `const [content, setContent] = useState<string>('')` around line 526), add these three state declarations immediately after the existing `const [editing, setEditing] = useState(false)` line:

```typescript
const [resumeTips, setResumeTips] = useState<ResumeTip[]>([]);
const [estimatedPages, setEstimatedPages] = useState<number | null>(null);
const [showTips, setShowTips] = useState(false);
```

- [ ] **Step 7.5 — Load tips from persisted draft on mount**

Locate the `useEffect` that calls `loadDraft` (around line 613). It currently does:

```typescript
useEffect(() => {
    const draft = loadDraft(workspaceKey, stepId);
    if (draft) {
        setContent(draft.content);
        setHasDraft(true);
    } else {
        setContent('');
        setHasDraft(false);
    }
    setEditing(false);
```

Add the following lines inside the `if (draft)` block, after `setHasDraft(true)`:

```typescript
        if (draft.tips) setResumeTips(draft.tips);
        if (draft.estimatedPages) setEstimatedPages(draft.estimatedPages);
```

- [ ] **Step 7.6 — Update runGeneration to capture tips and estimatedPages**

Locate `const { data } = await api.post<{ content: string }>(endpoint, payload)` (around line 661). Replace it with:

```typescript
const { data } = await api.post<{
    content: string;
    tips?: ResumeTip[];
    estimatedPages?: number;
}>(endpoint, payload);
```

Then locate the `saveDraft` call in `runGeneration` (the one immediately after `setContent(text)`):

```typescript
saveDraft(workspaceKey, stepId, {
    content: text,
    generatedAt: new Date().toISOString(),
    edited: false,
});
```

Replace with:

```typescript
const tips = stepId === 'resume' ? (data?.tips ?? []) : [];
const pages = stepId === 'resume' ? (data?.estimatedPages ?? null) : null;
setResumeTips(tips);
setEstimatedPages(pages);
saveDraft(workspaceKey, stepId, {
    content: text,
    generatedAt: new Date().toISOString(),
    edited: false,
    tips,
    estimatedPages: pages ?? undefined,
});
```

- [ ] **Step 7.7 — Add page warning banner**

Locate the ReactMarkdown render block (around line 988–992). It currently looks like:

```tsx
) : content ? (
    <>
        <div className="prose prose-invert max-w-none" style={{ color: warm.colors.textPrimary, fontSize: 13.5, lineHeight: 1.7 }}>
            <ReactMarkdown components={MARKDOWN_COMPONENTS as any}>{content}</ReactMarkdown>
        </div>
```

Replace with:

```tsx
) : content ? (
    <>
        {stepId === 'resume' && estimatedPages !== null && estimatedPages > 2 && (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                marginBottom: 12,
                background: 'rgba(217, 119, 6, 0.12)',
                border: '1px solid rgba(217, 119, 6, 0.35)',
                borderRadius: 6,
                fontSize: 12,
                color: '#d97706',
                fontWeight: 500,
            }}>
                <span>Your resume is estimated at {estimatedPages} pages. Most roles shortlist resumes under 2 pages. Consider trimming less relevant roles or bullets before downloading.</span>
            </div>
        )}
        <div className="prose prose-invert max-w-none" style={{ color: warm.colors.textPrimary, fontSize: 13.5, lineHeight: 1.7 }}>
            <ReactMarkdown components={buildMarkdownComponents(resumeTips, showTips) as any}>{content}</ReactMarkdown>
        </div>
```

- [ ] **Step 7.8 — Add tips toggle button**

Locate the Edit/Done button in the StepPanel UI (around line 958–961):

```tsx
<button
    ...
    title={editing ? 'Save edits' : 'Edit inline'}
>
    {editing ? 'Done' : 'Edit'}
</button>
```

Immediately BEFORE that button, add the tips toggle (only shown for the resume step when tips exist):

```tsx
{stepId === 'resume' && resumeTips.length > 0 && !editing && (
    <button
        onClick={() => setShowTips(t => !t)}
        style={{
            background: showTips ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
            border: `1px solid ${showTips ? '#d97706' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 6,
            color: showTips ? '#d97706' : warm.colors.textMuted,
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            cursor: 'pointer',
            letterSpacing: '0.03em',
        }}
        title={showTips ? 'Hide metric tips' : 'Show metric tips'}
    >
        {showTips ? 'Tips on' : 'Tips'}
    </button>
)}
```

- [ ] **Step 7.9 — Memoize buildMarkdownComponents to avoid unnecessary re-renders**

`buildMarkdownComponents` returns a new object every render. Memoize it so ReactMarkdown does not re-render on every keystroke. Immediately BEFORE the `return (` of the `StepPanel` component, add:

```typescript
const markdownComponents = React.useMemo(
    () => buildMarkdownComponents(resumeTips, showTips),
    [resumeTips, showTips],
);
```

Then in Step 7.7's JSX, replace `buildMarkdownComponents(resumeTips, showTips) as any` with `markdownComponents as any`.

- [ ] **Step 7.10 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors. If there are errors, fix them before committing — do not suppress with `any` casts unless the existing code already uses them in the same location.

- [ ] **Step 7.11 — Commit**

```bash
git add src/pages/StepperWorkspace.tsx src/lib/extractReactText.ts src/lib/__tests__/extractReactText.test.ts
git commit -m "feat(resume): tips overlay, page warning banner, tips toggle in StepperWorkspace"
```

---

## Task 8 — End-to-end verification

> **STOP AND REPORT:** Do not skip this task. Perform the following checks manually and report the result of each one before marking this task complete.

- [ ] **Step 8.1 — Start the dev server**

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
npm run dev
```

- [ ] **Step 8.2 — Generate a resume for a role where the most relevant experience is NOT the most recent**

Use a profile with at least 3 work experiences where the most relevant role to the JD is older (e.g., a seed/agriculture role from 2022 applied to a seed operator JD). Confirm in the rendered resume:

1. The most relevant role appears FIRST in Work Experience.
2. The header title matches the JD role, not the stored profile target role.
3. The professional summary is under 80 words (count manually or with a word counter).

- [ ] **Step 8.3 — Verify tips toggle**

If the API returned any tips (check the browser Network tab for the `/generate/resume-structured` response body under `tips`):

1. A "Tips" button appears in the resume panel header.
2. Clicking it turns orange and shows `ⓘ` icons next to the relevant bullets.
3. Clicking the `ⓘ` shows the tip tooltip with the specific suggestion text.
4. Clicking "Tips" again hides the icons.

If `tips` is an empty array, confirm the "Tips" button is NOT shown (the button only renders when `resumeTips.length > 0`).

- [ ] **Step 8.4 — Verify page warning**

Generate a resume for a candidate with many experiences (5+). If `estimatedPages > 2` in the API response, confirm the amber warning banner appears at the top of the resume panel with the correct page count. If `estimatedPages <= 2`, confirm no banner is shown.

- [ ] **Step 8.5 — Run full test suite**

```bash
cd server && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 8.6 — Final commit**

```bash
git add -A
git commit -m "feat(resume): end-to-end verification complete — relevance ordering, tips, page warning"
```

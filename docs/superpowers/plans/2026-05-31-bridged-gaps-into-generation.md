# Bridged Gaps → Generation (Faithfulness Bundle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the résumé and cover-letter generators faithfully use bridged gaps (and stop the cover letter contradicting claimed skills), with bridged gaps surviving a page refresh and no fabricated metric ever reaching a document.

**Architecture:** Bridged gaps are captured in `AnalysisResult`, lifted to `StrategyHub`, carried in `/apply` navigation state (and mirrored to `sessionStorage` so a refresh rehydrates), then added to both `/generate/*-structured` payloads. The server runs an integrity guard over them, injects them into the Stage-2 prompts (résumé bullets + cover-letter prose + contradiction guard + salutation/`[VERIFY:]` cleanups), and merges concise gap skill-labels into the résumé Skills section deterministically in `buildTemplateResume`. The Stage-1 blueprint and the Zod/render layers are untouched.

**Tech Stack:** React + TypeScript (Vite, no client test runner), Express + TypeScript, vitest (server only), Prisma (untouched — no schema change).

**Spec:** `docs/superpowers/specs/2026-05-31-bridged-gaps-into-generation-design.md`

---

## ⚠️ Execution guardrails (READ FIRST)

- **Do exactly what each task says. If reality diverges from the plan — a file's contents
  don't match the snippet, a signature differs, a test fails for a reason not described —
  STOP and report. Do not improvise a fix or expand scope.**
- The client (`src/`) has **no test runner**. Client tasks are verified by `npx tsc` +
  `npm run build`, never by writing client unit tests. Do NOT add a client test runner.
- Server tasks use vitest. Run only the named test file, not the whole suite, unless told.
- Commit after every task. Never bundle two tasks into one commit.
- No schema/migration changes anywhere in this plan. If you think you need one, STOP.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/bridgedGaps.ts` (new) | `BridgedGap` type + client `capabilityStatement()` (display/default) |
| `src/components/strategy/AnalysisResult.tsx` (modify) | Lift bridged gaps via callback; inline-editable statement + metric nudge |
| `src/pages/StrategyHub.tsx` (modify) | Hold `bridgedGaps`; include in `/apply` nav state |
| `src/pages/StepperWorkspace.tsx` (modify) | Read `bridgedGaps`; sessionStorage persist/rehydrate; add to both payloads |
| `server/src/lib/bridgedGaps.ts` (new) | `BridgedGap` type + `normalizeBridgedGaps()` integrity guard |
| `server/src/lib/bridgedGaps.test.ts` (new) | vitest for the guard |
| `server/src/services/companyIntel.ts` (modify) | `salutationTitle()` helper |
| `server/src/services/companyIntel.test.ts` (new) | vitest for `salutationTitle()` |
| `server/src/lib/buildTemplateResume.ts` (modify) | Merge concise gap labels into Skills |
| `server/src/lib/buildTemplateResume.bridged.test.ts` (new) | vitest for the skills merge |
| `server/src/services/prompts/coverLetterSlotsPrompt.ts` (modify) | Bridged section, contradiction guard, salutation cleanup, `[VERIFY:]`/proofread |
| `server/src/services/prompts/resumeStructuredPrompt.ts` (modify) | Bridged confirmed-capability bullets, `[VERIFY:]`/proofread |
| `server/src/routes/generate.ts` (modify) | Accept `bridgedGaps` on both endpoints; thread to prompts + skills merge |

---

## Task 1: Server integrity guard `normalizeBridgedGaps` (TDD)

**Files:**
- Create: `server/src/lib/bridgedGaps.ts`
- Test: `server/src/lib/bridgedGaps.test.ts`

This is the integrity-critical unit: whatever the client sends, no `[…]` placeholder may survive into a prompt. Build it first, test-first.

- [ ] **Step 1: Write the failing test**

Create `server/src/lib/bridgedGaps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeBridgedGaps } from './bridgedGaps';

describe('normalizeBridgedGaps', () => {
  it('strips every bracketed placeholder', () => {
    const out = normalizeBridgedGaps([
      { skill: 'A', statement: 'Increased engagement by [X]%' },
      { skill: 'B', statement: 'Managed content for [X] clients using tools' },
    ]);
    for (const g of out) expect(g.statement).not.toMatch(/\[/);
  });

  it('keeps a clean statement unchanged', () => {
    const out = normalizeBridgedGaps([
      { skill: 'A', statement: 'Coordinated a team of 5 marketers' },
    ]);
    expect(out[0].statement).toBe('Coordinated a team of 5 marketers');
  });

  it('drops empty / whitespace-only statements and missing skills', () => {
    const out = normalizeBridgedGaps([
      { skill: '', statement: 'x' },
      { skill: 'A', statement: '   ' },
      { skill: 'B', statement: 'Real capability' },
    ]);
    expect(out).toEqual([{ skill: 'B', statement: 'Real capability' }]);
  });

  it('dedupes by statement (case-insensitive) and caps at 8', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ skill: `S${i}`, statement: `Cap ${i}` }));
    many.push({ skill: 'dup', statement: 'cap 0' }); // dup of "Cap 0"
    const out = normalizeBridgedGaps(many);
    expect(out.length).toBe(8);
  });

  it('returns [] for non-array input', () => {
    expect(normalizeBridgedGaps(undefined as any)).toEqual([]);
    expect(normalizeBridgedGaps(null as any)).toEqual([]);
  });

  it('collapses whitespace left by placeholder removal and trims trailing punctuation', () => {
    const out = normalizeBridgedGaps([
      { skill: 'A', statement: 'Reached [X] new followers,' },
    ]);
    expect(out[0].statement).toBe('Reached new followers');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/lib/bridgedGaps.test.ts`
Expected: FAIL — "Failed to resolve import './bridgedGaps'" / `normalizeBridgedGaps is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `server/src/lib/bridgedGaps.ts`:

```ts
export interface BridgedGap {
  skill: string;
  statement: string;
}

const MAX_GAPS = 8;

/**
 * Removes every bracketed placeholder (e.g. "[X]", "[X]%") and tidies the
 * surrounding prose. This is the integrity guarantee: no placeholder may reach
 * a prompt. Heuristic but bounded — worst case it leaves a slightly terse
 * sentence; it never fabricates a number and never leaves a bracket.
 */
export function stripPlaceholders(input: string): string {
  let s = (input || '').trim();
  if (!s) return '';
  // Remove the bracket token plus a single adjacent quantity word if present
  // ("[X] clients" -> "clients", "[X]%" -> "").
  s = s.replace(/\[[^\]]*\]%?/g, ' ');
  // Collapse whitespace, fix orphaned spaces before punctuation.
  s = s.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim();
  // Trim a trailing dangling connective/punctuation left by the removal.
  s = s.replace(/[\s,]+$/g, '').trim();
  s = s.replace(/\s+(?:by|to|for|in|of|and|a|an)$/i, '').trim();
  return s;
}

/**
 * Normalises an untrusted bridgedGaps payload from the client: strips
 * placeholders, drops empties, dedupes by statement, caps the count.
 */
export function normalizeBridgedGaps(raw: unknown): BridgedGap[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: BridgedGap[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const skill = typeof (item as any).skill === 'string' ? (item as any).skill.trim() : '';
    const statement = stripPlaceholders(typeof (item as any).statement === 'string' ? (item as any).statement : '');
    if (!skill || !statement) continue;
    const key = statement.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ skill, statement });
    if (out.length >= MAX_GAPS) break;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/lib/bridgedGaps.test.ts`
Expected: PASS (6 passed). If the "collapses whitespace" case fails on exact string, STOP and report the actual vs expected — do not weaken the assertion silently.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/bridgedGaps.ts server/src/lib/bridgedGaps.test.ts
git commit -m "feat(generate): add bridgedGaps integrity guard (strip placeholders)"
```

---

## Task 2: Server `salutationTitle()` helper (TDD)

**Files:**
- Modify: `server/src/services/companyIntel.ts`
- Test: `server/src/services/companyIntel.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `server/src/services/companyIntel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { salutationTitle } from './companyIntel';

describe('salutationTitle', () => {
  it('strips a trailing parenthetical', () => {
    expect(salutationTitle('Head of Marketing (National Partnership Office, Surry Hills)'))
      .toBe('Head of Marketing');
  });
  it('collapses "X or Y" to the first option', () => {
    expect(salutationTitle('Head of Marketing or Marketing Manager')).toBe('Head of Marketing');
  });
  it('handles both together', () => {
    expect(salutationTitle('Marketing Manager or Head of Marketing ANZ (Sydney)'))
      .toBe('Marketing Manager');
  });
  it('returns null for empty/undefined', () => {
    expect(salutationTitle('')).toBeNull();
    expect(salutationTitle(undefined)).toBeNull();
    expect(salutationTitle(null)).toBeNull();
  });
  it('passes a clean title through', () => {
    expect(salutationTitle('Hiring Manager')).toBe('Hiring Manager');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/services/companyIntel.test.ts`
Expected: FAIL — `salutationTitle is not a function` / no export.

- [ ] **Step 3: Add the helper**

In `server/src/services/companyIntel.ts`, add this exported function (place it directly above `export function buildSkillsPreview`):

```ts
/**
 * Cleans a suggestedContact.title for use as a salutation: drops a trailing
 * parenthetical and collapses an "X or Y" title to the first option, so the
 * greeting reads "Dear Head of Marketing," not the full descriptor.
 * Returns null for empty input so callers can fall back to "Hiring Manager".
 */
export function salutationTitle(title: string | null | undefined): string | null {
  let t = (title || '').trim();
  if (!t) return null;
  t = t.replace(/\s*\([^)]*\)\s*$/g, '').trim();   // trailing parenthetical
  t = t.split(/\s+or\s+/i)[0].trim();              // "X or Y" -> "X"
  return t || null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/services/companyIntel.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/companyIntel.ts server/src/services/companyIntel.test.ts
git commit -m "feat(company-intel): add salutationTitle() helper for clean greetings"
```

---

## Task 3: Résumé Skills merge in `buildTemplateResume` (TDD)

**Files:**
- Modify: `server/src/lib/buildTemplateResume.ts`
- Test: `server/src/lib/buildTemplateResume.bridged.test.ts` (new)

The Skills block renders from `profile.skills` verbatim. This task appends concise bridged-gap skill labels (≤ 5 words) to the skills string, de-duplicated, under a "Role-specific:" line. First read the current `buildTemplateResume` signature and body.

- [ ] **Step 0: Read the current orchestrator**

Run: `Read server/src/lib/buildTemplateResume.ts` lines 290–360 (the `buildTemplateResume` function and its options type). Confirm the options object shape and where `profileToResumeData` / `applyPolish` / `profileToMarkdown` are called. If the function does not match the assumptions in Step 3 (an options object with `candidateName`, `yearsOfExperience`, `achievementSources`), STOP and report.

- [ ] **Step 1: Write the failing test**

Create `server/src/lib/buildTemplateResume.bridged.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mergeBridgedSkills } from './buildTemplateResume';

describe('mergeBridgedSkills', () => {
  it('appends a concise label not already present', () => {
    const out = mergeBridgedSkills('Technical: Excel, Word', [
      { skill: 'Adobe Creative Suite', statement: 'Used Adobe to design collateral' },
    ]);
    expect(out).toContain('Adobe Creative Suite');
    expect(out).toMatch(/Role-specific:/);
  });

  it('skips sentence-like labels (> 5 words)', () => {
    const out = mergeBridgedSkills('Technical: Excel', [
      { skill: 'Experience using website CMS platforms and tools', statement: 's' },
    ]);
    expect(out).not.toMatch(/Role-specific:/);
    expect(out).toBe('Technical: Excel');
  });

  it('dedupes case-insensitively against existing skills', () => {
    const out = mergeBridgedSkills('Technical: Adobe Creative Suite', [
      { skill: 'adobe creative suite', statement: 's' },
    ]);
    expect(out).toBe('Technical: Adobe Creative Suite');
  });

  it('returns the original string when no gaps qualify', () => {
    expect(mergeBridgedSkills('Technical: Excel', [])).toBe('Technical: Excel');
  });

  it('handles undefined skills string', () => {
    const out = mergeBridgedSkills(undefined, [{ skill: 'Trade Shows', statement: 's' }]);
    expect(out).toMatch(/Role-specific: Trade Shows/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/lib/buildTemplateResume.bridged.test.ts`
Expected: FAIL — `mergeBridgedSkills is not a function`.

- [ ] **Step 3: Implement `mergeBridgedSkills` and wire it in**

In `server/src/lib/buildTemplateResume.ts`, add this exported function near `normalizeSkillsString` (and import the type at the top: `import type { BridgedGap } from './bridgedGaps';`):

```ts
/**
 * Appends concise bridged-gap skill labels to a normalised skills string under
 * a "Role-specific:" line, de-duplicated against existing skills. Labels longer
 * than 5 words are skipped (they reach the résumé as experience bullets instead).
 */
export function mergeBridgedSkills(
  skills: string | undefined,
  bridgedGaps: BridgedGap[] | undefined,
): string {
  const base = (skills || '').trim();
  if (!bridgedGaps || bridgedGaps.length === 0) return base;
  const existing = base.toLowerCase();
  const concise = bridgedGaps
    .map(g => g.skill.trim())
    .filter(label => label.length > 0 && label.split(/\s+/).length <= 5)
    .filter(label => !existing.includes(label.toLowerCase()));
  // De-dup within the new labels themselves (case-insensitive).
  const seen = new Set<string>();
  const unique = concise.filter(l => {
    const k = l.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length === 0) return base;
  const line = `Role-specific: ${unique.join(', ')}`;
  return base ? `${base}\n${line}` : line;
}
```

Then wire it into the orchestrator. In `buildTemplateResume(...)`, add `bridgedGaps` to the options type and apply the merge to the `ResumeData.skills` after `applyPolish`. Locate the block that builds the final `ResumeData` (it calls `profileToResumeData`, then `applyPolish` if polish exists). Immediately before rendering with `profileToMarkdown`, insert:

```ts
data = { ...data, skills: mergeBridgedSkills(data.skills, opts?.bridgedGaps) };
```

and extend the options parameter type with:

```ts
bridgedGaps?: BridgedGap[];
```

If the orchestrator uses `const data` (not reassignable) or a differently-named variable, adapt the variable name only — do NOT restructure the function. If the rendering call is not `profileToMarkdown(data)`, STOP and report.

- [ ] **Step 4: Run test + typecheck**

Run: `cd server && npx vitest run src/lib/buildTemplateResume.bridged.test.ts`
Expected: PASS (5 passed).
Run: `cd server && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/buildTemplateResume.ts server/src/lib/buildTemplateResume.bridged.test.ts
git commit -m "feat(resume): merge concise bridged-gap skills into Skills section"
```

---

## Task 4: Cover-letter prompt — bridged section, contradiction guard, salutation, `[VERIFY:]`/proofread

**Files:**
- Modify: `server/src/services/prompts/coverLetterSlotsPrompt.ts`

No unit test (prompt-string change); verified by `tsc` and the integration test in Task 8.

- [ ] **Step 1: Extend the signature + build the bridged block + clean salutation**

In `coverLetterSlotsPrompt.ts`, add a `bridgedGaps` parameter and import the type and helper. At the top:

```ts
import { StrategyBlueprint } from './strategy';
import type { BridgedGap } from '../../lib/bridgedGaps';
import { salutationTitle } from '../companyIntel';
```

Change the signature to add a final parameter:

```ts
    companyIntel?: { summary?: string | null; suggestedContact?: { title?: string | null } | null } | null,
    bridgedGaps?: BridgedGap[],
): string => {
```

Replace the existing `contactTitle` derivation:

```ts
    const contactTitle = companyIntel?.suggestedContact?.title
        || companyResearch?.salutation
        || 'Hiring Manager';
```

with (applies #5 — clean the suggested-contact title and always prefer it when present):

```ts
    const contactTitle = salutationTitle(companyIntel?.suggestedContact?.title)
        || companyResearch?.salutation
        || 'Hiring Manager';
```

Directly after the `companySummary` declaration, add:

```ts
    const bridgedBlock = (bridgedGaps && bridgedGaps.length > 0)
        ? bridgedGaps.map(g => `- ${g.statement}`).join('\n')
        : '';
```

- [ ] **Step 2: Inject the bridged section + contradiction guard into the prompt body**

In the returned template string, immediately AFTER the `ACHIEVEMENTS WITH STRATEGIC FRAMING INSTRUCTIONS:` block (the line `${achievementBlock}`) and before the `BLOCK THESE PHRASES` divider, insert:

```ts
${bridgedBlock ? `
==============================================================
CONFIRMED CAPABILITIES (the candidate possesses these — weave in as genuine experience)
==============================================================
${bridgedBlock}
` : ''}
==============================================================
CONTRADICTION GUARD — NON-NEGOTIABLE
==============================================================
NEVER state, imply, or hedge that the candidate lacks, has not used, is unfamiliar with,
or is "eager/looking forward to learn" any skill listed above (CONFIRMED CAPABILITIES) or
any skill in the candidate's Skills data. Banned phrasings include: "although I have not",
"while I don't have direct experience", "I lack", "I am eager to learn", "I have yet to".
If the candidate genuinely lacks a requirement, OMIT it — never narrate the absence.
NEVER invent a number or metric; use only metrics already present in the text.
```

- [ ] **Step 3: Add `[VERIFY:]`-only-when-missing + proofread rule**

In the `CONSTRAINTS:` list near the end (the block beginning `- Do NOT include any meta-talk`), add these two bullets:

```ts
- Only use a [VERIFY: ...] token when a needed fact is genuinely absent from CANDIDATE DATA. If a value already exists in the data (e.g. an achievement metric), use it — never replace a known value with a placeholder.
- Before finalising, re-read every paragraph: each sentence must be grammatically complete. Do not output sentence fragments.
```

- [ ] **Step 4: Typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: exit 0. (The call site in `generate.ts` does not yet pass `bridgedGaps`; the new parameter is optional, so this compiles. The call site is updated in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/prompts/coverLetterSlotsPrompt.ts
git commit -m "feat(cover-letter): inject bridged capabilities, contradiction guard, clean salutation"
```

---

## Task 5: Résumé prompt — bridged confirmed-capability bullets + `[VERIFY:]`/proofread

**Files:**
- Modify: `server/src/services/prompts/resumeStructuredPrompt.ts`

- [ ] **Step 1: Extend the signature + build the bridged block**

At the top of `resumeStructuredPrompt.ts` add:

```ts
import type { BridgedGap } from '../../lib/bridgedGaps';
```

Change the signature to add a final parameter after `employerQuestions`:

```ts
    employerQuestions?: string[],
    bridgedGaps?: BridgedGap[],
): string => {
```

After the `achievementBlock` declaration, add:

```ts
    const bridgedBlock = (bridgedGaps && bridgedGaps.length > 0)
        ? bridgedGaps.map(g => `- ${g.statement}`).join('\n')
        : '';
```

- [ ] **Step 2: Inject the bridged section into the prompt body**

Immediately AFTER the `ACHIEVEMENTS WITH STRATEGIC FRAMING INSTRUCTIONS:` block (`${achievementBlock}`) and before the `BLOCK THESE PHRASES` divider, insert:

```ts
${bridgedBlock ? `
==============================================================
CONFIRMED CAPABILITIES (the candidate possesses these — integrate as real experience)
==============================================================
Turn each into a tailored work-experience bullet under the most relevant role. These are
genuine capabilities, not aspirations. NEVER invent a number or metric — use only metrics
already present in the statement text. NEVER write that the candidate lacks any of these.
${bridgedBlock}
` : ''}
```

- [ ] **Step 3: Add `[VERIFY:]`-only-when-missing + proofread rule**

In the `CONSTRAINTS:` list near the end (the block starting `- Do NOT include any meta-talk`), add:

```ts
- Only use a [VERIFY: ...] token when a needed fact is genuinely absent from CANDIDATE DATA. If a value already exists (e.g. an achievement metric like "150+ assets"), use it verbatim — never replace a known value with a placeholder.
- Before finalising, re-read each bullet and the summary: every sentence must be grammatically complete. No fragments.
```

- [ ] **Step 4: Typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: exit 0 (new param optional; call site updated in Task 6).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/prompts/resumeStructuredPrompt.ts
git commit -m "feat(resume): inject bridged capabilities as confirmed-experience bullets"
```

---

## Task 6: Wire `bridgedGaps` through both endpoints in `generate.ts`

**Files:**
- Modify: `server/src/routes/generate.ts`

- [ ] **Step 1: Résumé endpoint — accept + normalize + pass to prompt and skills merge**

In `router.post('/resume-structured', ...)`:

(a) Add `bridgedGaps` to the destructure (the `const { ... } = req.body;` near line 560):

```ts
        companyResearch,  // { salutation, highlights, companySize, hiringManager }
        bridgedGaps: bridgedGapsRaw,
    } = req.body;
```

(b) Near the top of the `try` block (after `if (!profile) ...`), normalize:

```ts
        const { normalizeBridgedGaps } = await import('../lib/bridgedGaps');
        const bridgedGaps = normalizeBridgedGaps(bridgedGapsRaw);
```

(c) Pass `bridgedGaps` as the final argument to `RESUME_STRUCTURED_PROMPT(...)` (the call near line 674):

```ts
            parsedJD.employerQuestions.length > 0 ? parsedJD.employerQuestions : undefined,
            bridgedGaps,
        );
```

(d) Pass `bridgedGaps` into the `buildTemplateResume` options (the call near line 703):

```ts
        const finalContent = buildTemplateResume(profile, polish, {
            candidateName: profile?.name,
            yearsOfExperience: computeYearsOfExperience(profile?.experience),
            achievementSources: selectedAchievements
                .map((a: any) => a?.description ?? '')
                .filter((s: string) => s && s.length > 0),
            bridgedGaps,
        });
```

- [ ] **Step 2: Cover-letter endpoint — accept + normalize + pass to prompt**

In `router.post('/cover-letter-structured', ...)`:

(a) Add to the destructure (near line 752):

```ts
        companyIntel: companyIntelFromBody,
        bridgedGaps: bridgedGapsRaw,
    } = req.body;
```

(b) After `if (!profile) ...`, normalize:

```ts
        const { normalizeBridgedGaps } = await import('../lib/bridgedGaps');
        const bridgedGaps = normalizeBridgedGaps(bridgedGapsRaw);
```

(c) Pass `bridgedGaps` as the final argument to `COVER_LETTER_SLOTS_PROMPT(...)` (the call near line 884):

```ts
            companyIntel,
            bridgedGaps,
        );
```

- [ ] **Step 3: Typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: exit 0. If `buildTemplateResume`'s options type rejects `bridgedGaps`, Task 3 Step 3's type extension was not applied — STOP and report.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/generate.ts
git commit -m "feat(generate): thread bridgedGaps into resume + cover-letter generation"
```

---

## Task 7: Client shared module `bridgedGaps.ts`

**Files:**
- Create: `src/lib/bridgedGaps.ts`

No client test runner — verified by `tsc`. The integrity guarantee is already tested server-side (Task 1).

- [ ] **Step 1: Create the module**

Create `src/lib/bridgedGaps.ts`:

```ts
export interface BridgedGap {
  skill: string;
  statement: string;
}

/**
 * Derives the default committed statement for a ticked gap: removes a metric
 * clause that contains a "[…]" placeholder so the default reads as a clean
 * capability ("Developed and implemented a content strategy"). If there is no
 * placeholder, the suggestion is returned trimmed. The server applies its own
 * authoritative guard (normalizeBridgedGaps) on top of this.
 */
export function capabilityStatement(suggestion: string): string {
  let s = (suggestion || '').trim();
  if (!s) return '';
  if (!/\[[^\]]*\]/.test(s)) return s;
  s = s.replace(/\[[^\]]*\]%?/g, ' ');
  s = s.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim();
  s = s.replace(/[\s,]+$/g, '').trim();
  s = s.replace(/\s+(?:by|to|for|in|of|and|a|an)$/i, '').trim();
  return s;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bridgedGaps.ts
git commit -m "feat(strategy): add client BridgedGap type + capabilityStatement helper"
```

---

## Task 8: `AnalysisResult` — lift bridged gaps with inline-editable statement + nudge

**Files:**
- Modify: `src/components/strategy/AnalysisResult.tsx`

The component currently tracks `bridgedIndices: Set<number>` (local). Add per-index edited text, a callback to the parent, and a metric nudge. When a gap is ticked, its statement defaults to `capabilityStatement(item.suggestion)` and is shown in an editable field.

- [ ] **Step 1: Add imports, prop, and edited-text state**

At the top of the file, add to the existing imports:

```ts
import { capabilityStatement, type BridgedGap } from '../../lib/bridgedGaps';
import { useEffect } from 'react';
```

(If `useState` is imported as `import { useState } from 'react';`, change it to `import { useState, useEffect } from 'react';` instead of adding a second import line.)

Add `onBridgedGapsChange` to the `Props` interface:

```ts
interface Props {
    result: DualSignalResult;
    jobDescription: string;
    onContinue: () => void;
    onSkip?: () => void;
    onBridgedGapsChange?: (gaps: BridgedGap[]) => void;
}
```

Destructure it in the component signature:

```ts
export function AnalysisResult({ result, jobDescription, onContinue, onSkip: _onSkip, onBridgedGapsChange }: Props) {
```

Add edited-text state next to `bridgedIndices` (near line 60):

```ts
    const [bridgedText, setBridgedText] = useState<Map<number, string>>(new Map());
```

- [ ] **Step 2: Emit bridged gaps to the parent whenever the selection/text changes**

Add this effect after the state declarations (after `enrichmentCandidates`):

```ts
    useEffect(() => {
        if (!onBridgedGapsChange) return;
        const gaps: BridgedGap[] = [...bridgedIndices].map(i => {
            const item = bridgeableGap.items[i];
            const edited = bridgedText.get(i);
            const statement = (edited && edited.trim()) || capabilityStatement(item?.suggestion ?? '');
            return { skill: item?.skill ?? '', statement };
        }).filter(g => g.skill && g.statement);
        onBridgedGapsChange(gaps);
    }, [bridgedIndices, bridgedText, bridgeableGap.items, onBridgedGapsChange]);
```

- [ ] **Step 3: Replace the read-only suggestion display with an editable field + nudge**

In the `isBridged ?` branch (the `<div>` block around lines 275–311), replace the read-only `<p style={{ margin: 0 }}>{item.suggestion}</p>` with an editable textarea defaulting to the capability statement, plus the nudge:

```tsx
                                                        <textarea
                                                            value={bridgedText.get(i) ?? capabilityStatement(item.suggestion)}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setBridgedText(prev => {
                                                                    const next = new Map(prev);
                                                                    next.set(i, v);
                                                                    return next;
                                                                });
                                                            }}
                                                            rows={2}
                                                            style={{
                                                                width: '100%', margin: 0, fontSize: 12,
                                                                color: warm.colors.textSecondary, lineHeight: 1.55,
                                                                background: 'transparent', border: 'none',
                                                                resize: 'vertical', fontStyle: 'italic', fontFamily: 'inherit',
                                                            }}
                                                        />
                                                        <p style={{ margin: '2px 0 0', fontSize: 10.5, color: warm.colors.textMuted, fontStyle: 'normal' }}>
                                                            Tip: edit in a real metric to stand out.
                                                        </p>
```

Leave the existing "× Undo" button block exactly as-is.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.
Run: `npm run build`
Expected: build succeeds (Vite bundle written). If build fails for any reason other than a typo you introduced, STOP and report.

- [ ] **Step 5: Commit**

```bash
git add src/components/strategy/AnalysisResult.tsx
git commit -m "feat(strategy): lift bridged gaps with editable statement + metric nudge"
```

---

## Task 9: `StrategyHub` — hold bridged gaps, pass in `/apply` state

**Files:**
- Modify: `src/pages/StrategyHub.tsx`

- [ ] **Step 1: Read the AnalysisResult usage site**

Run: `Grep "AnalysisResult"` in `src/pages/StrategyHub.tsx` to find where `<AnalysisResult ... />` is rendered. Confirm it receives `result`, `jobDescription`, `onContinue`. If it is not rendered directly in `StrategyHub.tsx` (e.g. nested in another component), STOP and report which file renders it — the callback must be wired there instead.

- [ ] **Step 2: Add state + import**

Add the type import at the top:

```ts
import type { BridgedGap } from '../lib/bridgedGaps';
```

Add state near the other `useState` hooks in the component (e.g. beside `result`):

```ts
    const [bridgedGaps, setBridgedGaps] = useState<BridgedGap[]>([]);
```

- [ ] **Step 3: Pass the callback to AnalysisResult**

On the `<AnalysisResult ... />` element, add the prop:

```tsx
                    onBridgedGapsChange={setBridgedGaps}
```

- [ ] **Step 4: Include bridgedGaps in the `/apply` navigation state**

In `handleContinue` (near line 469), add `bridgedGaps` to the `state` object:

```ts
                feedItemId: pickedFeedItem?.id,
                sourceUrl: pickedFeedItem?.sourceUrl,
                sourcePlatform: pickedFeedItem?.sourcePlatform,
                bridgedGaps,
            },
        });
```

Also reset it in `handleSkip` (near line 483), alongside the other resets:

```ts
        setBridgedGaps([]);
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.
Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/pages/StrategyHub.tsx
git commit -m "feat(strategy-hub): carry bridged gaps into the apply flow"
```

---

## Task 10: `StepperWorkspace` — refresh persistence + payloads

**Files:**
- Modify: `src/pages/StepperWorkspace.tsx`

- [ ] **Step 1: Extend the location.state type**

In the `const state = (location.state ?? {}) as { ... }` block (line 346), add `bridgedGaps`:

```ts
        sourcePlatform?: string;
        bridgedGaps?: import('../lib/bridgedGaps').BridgedGap[];
    };
```

- [ ] **Step 2: sessionStorage persist/rehydrate of the entry context**

Replace the line `const state = (location.state ?? {}) as { ... };` mechanism so that an empty `location.state` (a refresh) rehydrates from sessionStorage. Directly AFTER the `state` type block, add:

```ts
    const APPLY_CTX_KEY = 'apply:context';
    const resolvedState = useMemo(() => {
        const hasState = location.state && Object.keys(location.state as object).length > 0;
        if (hasState) {
            try { sessionStorage.setItem(APPLY_CTX_KEY, JSON.stringify(location.state)); } catch { /* noop */ }
            return location.state as typeof state;
        }
        try {
            const cached = sessionStorage.getItem(APPLY_CTX_KEY);
            if (cached) return JSON.parse(cached) as typeof state;
        } catch { /* noop */ }
        return {} as typeof state;
    }, [location.state]);
```

Then change every downstream reference from `state.` to `resolvedState.`. Specifically update:
- `const jobDescription = state.jobDescription ?? '';` → `resolvedState.jobDescription`
- `const wantsSC = state.sc === true;` → `resolvedState.sc`
- the company-intel prewarm effect: `state.company`, `state.role` → `resolvedState.company`, `resolvedState.role`
- the apply/track payloads that read `state.company`, `state.role`, `state.feedItemId`, `state.sourceUrl`, `state.sourcePlatform`.

Run `Grep "state\." src/pages/StepperWorkspace.tsx` first and update each occurrence that refers to THIS `state` object (do not touch unrelated `setState`/`useState` calls). If any reference is ambiguous, STOP and report it rather than guessing.

- [ ] **Step 3: Read bridgedGaps and add to both generate payloads**

In the `generate` function, after `const payload: Record<string, unknown> = { jobDescription };`, add bridgedGaps to both structured branches. Modify the `stepId === 'resume'` and `cover-letter` handling so both include it:

```ts
            let endpoint = `/generate/${stepId}`;
            if (stepId === 'resume') {
                endpoint = '/generate/resume-structured';
                payload.bridgedGaps = resolvedState.bridgedGaps ?? [];
            } else if (stepId === 'cover-letter') {
                endpoint = '/generate/cover-letter-structured';
                payload.analysisContext = {
                    tone: 'Professional, polished, direct.',
                    company: company ?? '',
                    title: role ?? '',
                };
                payload.companyIntel = companyIntel ?? null;
                payload.bridgedGaps = resolvedState.bridgedGaps ?? [];
            }
```

Note: `company` and `role` are props of the inner step component. Confirm they derive from `resolvedState` upstream (they are passed from the parent — verify the parent passes `resolvedState.company`/`resolvedState.role`). If the inner component receives `company`/`role` as props already, no change needed there beyond Step 2's parent-level rename.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.
Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/StepperWorkspace.tsx
git commit -m "feat(apply): rehydrate apply context on refresh; send bridgedGaps to generators"
```

---

## Task 11: Integration test — endpoints accept and use bridgedGaps

**Files:**
- Create: `server/src/tests/bridgedGapsGeneration.test.ts`

Mirror an existing route test for setup. First read one to copy the auth/supertest harness exactly.

- [ ] **Step 1: Read an existing route test for the harness**

Run: `Read server/src/tests/analyze.test.ts`. Note how it builds the app, authenticates, and mocks the LLM (`callLLM`/`callLLMWithRetry`). If these tests require a live DB or real LLM and cannot run offline, STOP and report — we will instead rely on the manual verification in Task 12 and skip this task.

- [ ] **Step 2: Write the test (adapt to the harness from Step 1)**

Create `server/src/tests/bridgedGapsGeneration.test.ts` following the exact mocking pattern observed. The test must:
- POST `/generate/cover-letter-structured` with a body including `bridgedGaps: [{ skill: 'Adobe Creative Suite', statement: 'Used Adobe to build collateral' }]`.
- Capture the prompt passed to the mocked `callLLMWithRetry` and assert it contains `CONFIRMED CAPABILITIES` and `Adobe`.
- Assert the prompt contains `CONTRADICTION GUARD`.

Write the assertions concretely against the captured prompt argument. If the harness mocks at a different boundary (e.g. `callClaude` for the blueprint), mock both the blueprint and the Llama call so the request reaches Stage 2.

- [ ] **Step 3: Run**

Run: `cd server && npx vitest run src/tests/bridgedGapsGeneration.test.ts`
Expected: PASS. If it cannot pass due to harness limitations after one honest attempt, STOP and report — do not loosen assertions to force green.

- [ ] **Step 4: Commit**

```bash
git add server/src/tests/bridgedGapsGeneration.test.ts
git commit -m "test(generate): assert bridgedGaps + contradiction guard reach the prompt"
```

---

## Task 12: Full verification + manual smoke

- [ ] **Step 1: Server test suite**

Run: `cd server && npx vitest run`
Expected: all tests pass (or only pre-existing unrelated failures — if any test that passed before now fails, STOP and report).

- [ ] **Step 2: Typecheck both projects**

Run: `cd server && npx tsc --noEmit` → exit 0
Run (repo root): `npx tsc --noEmit -p tsconfig.json` → exit 0

- [ ] **Step 3: Production build**

Run (repo root): `npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual smoke (document outcome, do not skip)**

With the app running locally:
1. Analyse a job (e.g. the Temperzone JD from QA), tick the "Adobe Creative Suite" gap, edit one gap to add a real metric.
2. Continue to `/apply`. Hard-refresh the page → confirm you are NOT bounced home and the flow persists.
3. Generate résumé → confirm Skills shows a "Role-specific:" line including "Adobe Creative Suite"; confirm the edited metric appears in a bullet.
4. Generate cover letter → confirm NO "I have not had experience with Adobe" style denial; confirm salutation uses the cleaned suggested-contact title (no parenthetical).
5. Confirm no literal "[X]" appears anywhere in either document.

Record pass/fail for each in the final report. Any fail → STOP and report; do not attempt blind fixes.

- [ ] **Step 5: Final commit (if any doc/notes changed)**

Only if uncommitted changes remain:

```bash
git add -A && git commit -m "chore: bridged-gaps verification notes"
```

---

## Self-review notes (author)

- **Spec coverage:** #1 bridged gaps → Tasks 7–10 (client pipe) + 6 (payload) + 4/5 (prompts). #2 contradiction guard → Task 4. #3 résumé Skills → Task 3 + bullets via Task 5. #5 salutation → Tasks 2 + 4. #6 `[VERIFY:]`/proofread → Tasks 4 + 5. Refresh survival → Task 10. Integrity guard → Task 1.
- **No blueprint change** (per stable-build decision) — confirmed no task touches `generateBlueprint`.
- **Type consistency:** `BridgedGap { skill, statement }` identical client (`src/lib/bridgedGaps.ts`) and server (`server/src/lib/bridgedGaps.ts`); `normalizeBridgedGaps`, `mergeBridgedSkills`, `salutationTitle`, `capabilityStatement` names used consistently across tasks.
- **Client has no test runner** — client tasks verified by tsc + build, integrity tested server-side. Stated explicitly in guardrails.

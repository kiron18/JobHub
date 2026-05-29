# Post-Audit Quality Pass — Implementation Spec

**For:** DeepSeek (or any agentic coder)
**Date authored:** 2026-05-26
**Origin documents:**
- Audit: `docs/260525 - HOW TO BE BETTER.ini`
- Live test: `c:\Users\Kiron\Desktop\qa test.txt` (Original Spin PR & Marketing Executive)

**Outcome required:** Lift output quality from "good enough" to "consistently excellent" by closing the audit gaps that most directly affect interview rate. All work lands on a single feature branch, pushed to remote. **DO NOT auto-merge to staging or master** — that is the human's decision after review.

---

## 0 — Read this first (mandatory)

### 0.1 Branch strategy

Before any code change:

```powershell
cd E:/AntiGravity/JobHub
git fetch origin
git checkout staging
git pull origin staging
git checkout -b feat/quality-pass-2026-05-26
```

All work on `feat/quality-pass-2026-05-26`. At the end you will push this branch to `origin` and stop. **You will NOT merge it into staging or master.** The human reviews the diff on GitHub, runs it locally, deploys to staging Railway if they want, then merges manually.

### 0.2 Your strengths and weaknesses on this codebase

Honest framing so you don't trip up:

**You're good at:**
- Single-file, well-scoped TypeScript changes
- Following explicit step-by-step instructions with concrete test cases
- Writing regex-based deterministic post-processors (this codebase already has the `voiceEnforcer.ts` pattern — copy it, don't reinvent)
- Adding new routes, new utility modules, new tests

**You're likely to trip up on:**
- **Prompt engineering as the fix.** This codebase has been burned five times by "the prompt should handle it." The pattern here is *deterministic regex/code post-processors* over LLM output, NOT edit the prompt and hope. See `server/src/lib/voiceEnforcer.ts` for the pattern. Use it.
- **Cross-file consistency.** When you add a new field to `ProfileSnapshot` (in `server/src/services/prompts/generation.ts`), the caller in `server/src/services/quality-gate.ts` must populate it. Always grep callers before changing an interface.
- **The prompts files are huge and load-bearing.** A small edit to `server/src/services/prompts/generation.ts` or `server/rules/resume_rules.md` can have outsized effects. When in doubt, add a NEW post-processor instead of editing an existing prompt.
- **Merge conflict resolution.** A prior session lost ~86 lines of `DiagnosticPage.tsx` work by choosing the wrong side of a merge conflict. If you hit conflicts, STOP and ask the human — do not guess.
- **Empirical testing.** When you write a regex scrubber, test it against the actual broken text from the live test file (`c:\Users\Kiron\Desktop\qa test.txt`), not against a synthetic example. Five iterations of `voiceEnforcer.ts` were lost because each iteration tested against ideal inputs, not the real broken output.
- **TypeScript strict-mode types.** Run `npx tsc --noEmit` from the `server/` directory after every meaningful change. Don't push if it doesn't pass.

### 0.3 Anti-patterns — do NOT do these

| Don't | Do instead |
|---|---|
| Edit the prompts to "tell the LLM harder" | Write a deterministic post-processor that fixes the output after the LLM runs |
| Add more LLM calls to fix LLM problems | Add code-level checks where possible. LLM calls cost real money per generation. |
| Delete or "clean up" existing rules in `server/rules/*.md` | Rules are intentional. Add new ones if needed, but don't remove without explicit approval |
| Refactor while you're here | Stay scoped to the spec. No tangent cleanups. |
| Add comments explaining what the code does | Default to no comments. Only add a comment when the WHY is non-obvious (a hidden constraint, a subtle invariant) |
| `git push --force` or `git rebase` on shared branches | Always use a fresh feature branch and let humans handle merges |
| Skip the type check | Always `npx tsc --noEmit` in both `server/` and root before committing |

### 0.4 Repository orientation

Key files you will touch or read:

```
server/
├── src/
│   ├── lib/
│   │   ├── voiceEnforcer.ts          ← REFERENCE PATTERN — copy this style
│   │   └── profileMath.ts            ← reference: how to do server-side derived facts
│   ├── routes/
│   │   ├── generate.ts               ← main generation pipeline; post-processors plug in here
│   │   └── analyze.ts                ← JD analysis flow; bridged-gap creation lives near here
│   ├── services/
│   │   ├── generation.ts             ← buildAchievementContext — bridged-gap plumbing
│   │   ├── quality-gate.ts           ← Claude review pass + ProfileSnapshot extraction
│   │   ├── prompts/
│   │   │   └── generation.ts         ← prompts; mostly READ-ONLY for you
│   │   └── vector.ts                 ← Pinecone semantic search
├── rules/                            ← markdown rules files — READ-ONLY unless explicitly told
│   ├── resume_rules.md
│   ├── cover_letter_rules.md
│   └── selection_criteria_rules.md
└── prisma/
    └── schema.prisma                 ← DB schema; touch only if a task requires a migration
```

Frontend:
```
src/
├── components/
│   ├── strategy/
│   │   ├── AnalysisResult.tsx        ← shows direct/bridgeable/hard gap UI
│   │   └── AchievementDraftModal.tsx ← user types in bridged achievement here
│   └── ApplicationWorkspace.tsx      ← where generation is triggered
```

---

## 1 — Tasks, in priority order

Each task has: Goal, Files, NOT-files, Implementation, Test cases, Verification. Complete each task fully (including verification) before starting the next.

---

### TASK 1 — Fix the bridged-gap → output plumbing bug (NEW from live test, highest priority)

**Symptom from live test:** User bridged two achievements in `AnalysisResult.tsx` ("25% impression increase for PR", "21 events / 100K attendees combined"). Neither appears in the generated resume or cover letter. The user-facing promise ("draft this, save it, future analyses pick it up") silently failed.

**Goal:** When a user saves a bridged-gap achievement via `AchievementDraftModal.tsx`, that achievement MUST:
1. Persist to the `Achievement` table (probably already happens — verify)
2. Be indexed in Pinecone (likely the broken step)
3. Be picked up by `buildAchievementContext` on the NEXT generation

**Investigate first (no code changes yet):**

```powershell
# Find the save endpoint for bridged achievements
git grep -n "AchievementDraftModal" src/
git grep -n "POST.*achievement\|createAchievement\|saveAchievement" server/src/
git grep -n "upsertVector\|upsertAchievement\|pinecone" server/src/
```

You're looking for the data flow from "user clicks Save in modal" → "achievement in DB" → "achievement in Pinecone index". One of those three steps is the bug. Likely Pinecone — but verify before assuming.

**Files to touch (probably):**
- `server/src/routes/[whatever handles achievement creation]` — ensure it calls `indexAchievementInPinecone` (or whatever the function is named)
- `server/src/services/generation.ts:buildAchievementContext` — verify it picks up newly-created achievements
- Possibly `src/components/strategy/AchievementDraftModal.tsx` — ensure the save call is awaited and reports success

**Files NOT to touch:**
- The prompts files
- `voiceEnforcer.ts`
- Anything in `server/rules/`

**Test case (empirical, MUST run):**

1. On staging (or locally), create a new bridged achievement via the UI:
   - Run an analysis on the Original Spin JD (the one in `c:\Users\Kiron\Desktop\qa test.txt`)
   - Click "Draft this" on the "public relations" bridgeable gap
   - Save the text: *"I led PR for a community festival, securing 12 media placements and growing impressions 25% month-over-month"*
2. Immediately regenerate the resume.
3. **Expected:** The new achievement appears verbatim or paraphrased in either the resume work experience or the cover letter body.
4. **Actually broken if:** The achievement is silently absent from output.

**Verification commands:**

```powershell
cd E:/AntiGravity/JobHub/server
npx tsc --noEmit
# After fix, manual test above must pass
```

**Definition of done:**
- The bridged achievement appears in the next generation
- The fix has a corresponding test in `server/src/tests/` if a test directory exists; otherwise document it as a manual test in this spec
- `npx tsc --noEmit` clean

---

### TASK 2 — ATS keyword check as code (audit priority #1)

**Symptom from live test:** Resume for "Public Relations & Marketing Executive" mentioned "Public Relations" or "PR" exactly ZERO times in the body. An ATS scoring for PR experience filters this out before a human sees it.

**Goal:** After Stage 2 generation (Llama output) and before Stage 3 (quality gate), run a code-level ATS keyword check. Extract the top JD keywords. Verify they appear in the generated document. If keywords are missing AND there is supporting evidence in the candidate's achievements, either inject them or warn.

**Files to create:**
- `server/src/lib/atsKeywords.ts` — new module

**Files to modify:**
- `server/src/routes/generate.ts` — call the new check after Stage 2

**Files NOT to touch:**
- `server/src/services/prompts/generation.ts`
- `server/rules/*.md`

**Implementation pattern (copy the `voiceEnforcer.ts` style):**

```typescript
// server/src/lib/atsKeywords.ts

interface AtsCheckOptions {
  jobDescription: string;
  generatedDocument: string;
  docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE';
}

interface AtsCheckResult {
  topKeywords: string[];      // top 10-15 JD keywords
  missingFromOutput: string[]; // keywords missing from generated doc
  coverage: number;            // 0..1, fraction present
  warnings: string[];          // human-readable warnings
}

export function checkAtsKeywords(opts: AtsCheckOptions): AtsCheckResult {
  // 1. Extract top keywords from JD using a deterministic approach:
  //    - tokenize JD
  //    - remove stopwords (use a small built-in list, don't add a npm dep)
  //    - identify high-signal n-grams: role title words, software names (capitalised),
  //      JD-section headers ("requirements", "responsibilities" — exclude these)
  //    - boost: words/phrases in role title, requirements section
  //    - return top 10-15 unique terms (case-normalised)
  //
  // 2. For each keyword, check presence in generatedDocument (case-insensitive,
  //    word-boundary match). Phrases match if all words present within a small
  //    window or as a literal substring.
  //
  // 3. Compute coverage = found / total
  //
  // 4. Generate warnings for missing keywords, especially those in the role title
  //    (those are critical — see TASK 4 silent-failure visibility)
  //
  // Do NOT use an LLM for this. Pure code. Deterministic. Fast.
}
```

**Test cases (empirical, MUST run):**

Test against the live test output:

```typescript
const jd = `Public Relations & Marketing Executive
The Opportunity
Original Spin is looking for a Public Relations & Marketing Executive to join our Sydney team...
What You Will Be Doing
Supporting senior staff in the delivery of integrated publicity and marketing campaigns across earned, owned and paid channels.
Drafting media materials including media releases, pitches, briefing notes and media alerts.
Building and maintaining media lists and coordinating outreach to journalists, producers and influencers.
...`;  // paste the full JD from c:\Users\Kiron\Desktop\qa test.txt

const generatedResume = `Kiron Kurian John
Public Relations & Marketing Executive | Marketing & Communications
Professional Summary
I bring 5 years of experience in marketing and communications...
[paste the full generated resume]`;

const result = checkAtsKeywords({ jobDescription: jd, generatedDocument: generatedResume, docType: 'RESUME' });

// Expected:
// - topKeywords includes: "public relations", "media releases", "media outreach",
//   "journalists", "press events", "EDM", "campaign", "integrated campaigns"
// - missingFromOutput should INCLUDE: "public relations" (resume has it in title only,
//   not body), "media releases", "journalists", "press events", "EDM"
// - coverage should be < 0.5
// - warnings should highlight "public relations" missing from body as CRITICAL
//   because it appears in the role title
```

Write this test in `server/src/tests/atsKeywords.test.ts` or run as a one-off `node -e` script if the test framework is friction.

**Integration in `generate.ts`:**

After Stage 3 (or after Stage 2 if QG is skipped), call `checkAtsKeywords`. Attach the result to the document metadata (`atsKeywordCoverage` field on the document, or returned in the response JSON). DO NOT block generation — surface the result so it can drive UI badges (TASK 4).

**Definition of done:**
- `atsKeywords.ts` exists with a working `checkAtsKeywords` function
- Test against the live broken resume returns `coverage < 0.5` and flags "public relations" missing
- Integrated into `generate.ts` after the quality gate
- Result attached to the response so frontend can use it (TASK 4 will surface)
- `npx tsc --noEmit` clean

---

### TASK 3 — Voice + AI-tell scrubber for cover letters and SC (audit priority #2)

**Symptom from live test:** Cover letter contains 5+ AI-tell phrases ("I am confident in my ability", "Notably, I have demonstrated", "positions me to contribute effectively", etc.) that a recruiter pattern-matches as AI in under 10 seconds.

**Goal:** Extend the existing `voiceEnforcer` pattern to (a) run on cover letters and selection criteria, not just resumes, and (b) add an AI-tell phrase scrubber that runs alongside the voice fixer.

**Files to modify:**
- `server/src/lib/voiceEnforcer.ts` — extend, do not rewrite
- `server/src/routes/generate.ts` — wire scrubber to cover letters and SC, not just resumes

**Files NOT to touch:**
- The prompts. The current `voiceEnforcer.ts` shows the pattern: post-process the LLM output, don't argue with the prompt.

**Implementation:**

In `voiceEnforcer.ts`:

1. Generalise section detection. Resumes have `## Professional Summary`. Cover letters have NO sections — the whole document IS the body. STAR responses have `**Situation**`, `**Task**`, etc. labels. Detect document type via a parameter and scrub the appropriate scope.

2. Add an AI-tell phrase scrubber. New function `scrubAITells(text: string): { scrubbed: string; removed: string[] }`. Known phrases (case-insensitive, regex-anchored):

```
"I am confident in my ability to"           → strip / soften
"I am writing to express my (strong )?interest in"  → strip
"Notably, I have demonstrated"              → "I"
"positions me to contribute effectively"    → "lets me contribute"
"aligns well with my professional background" → "fits my background"
"directly aligns with .* need(s)? for"      → simplify
"I believe I would be a great fit"          → strip
"I am excited about the opportunity to"     → strip
"With my (\d+|[a-z]+) years of experience"  → "Across (\d+|[a-z]+) years"
"proven track record of"                    → "track record of"
"leveraging"                                → "using"
"spearheading"                              → "leading"
"synergies"                                 → "alignment"
"results-driven"                            → strip (only when not followed by a metric)
"detail-oriented"                           → strip
"team player"                               → strip
"passionate about"                          → "focused on"
"thrives in (a |an )?fast-paced environment" → "works well under deadline pressure"
```

This list is non-exhaustive. Add more as you find them in the live test output. **Test against the cover letter from `qa test.txt`** — your scrubber should catch at least 5 of the AI-tells flagged in the audit.

3. Wire in `generate.ts`:

```typescript
// After Stage 3 quality gate, before document save:
if (docType === 'RESUME') {
    finalContent = enforceFirstPersonSummary(finalContent, { /* existing args */ });
}
if (docType === 'COVER_LETTER' || docType === 'RESUME') {
    finalContent = scrubAITells(finalContent);
}
if (docType === 'COVER_LETTER') {
    finalContent = enforceFirstPersonCoverLetter(finalContent, { candidateName: profile?.name });
}
if (docType === 'STAR_RESPONSE') {
    finalContent = scrubAITells(finalContent);
    // STAR responses are typically first-person already; light voice check only
}
```

4. **Voice in cover letters:** Same regexes as the existing summary scrubber, but applied to the WHOLE cover letter body (not section-scoped). Scope: text between the salutation (`Dear ...`) and the sign-off (`Yours sincerely,` / `Yours faithfully,`).

**Test cases (empirical, MUST run):**

Use the cover letter from `qa test.txt`:

```typescript
const liveCoverLetter = `Dear Hiring Manager,

Original Spin's work amplifying major cultural events through integrated campaigns mirrors the approach I've used to drive $200K+ quarterly revenue through coordinated earned, owned, and paid channel strategies. With five years of integrated marketing and communications experience spanning content creation, social media management, and campaign coordination across multiple channels, I am confident in my ability to support the delivery of high-profile campaigns.

[...full text from qa test.txt cover letter...]

Yours sincerely,

Kiron Kurian John`;

const { scrubbed, removed } = scrubAITells(liveCoverLetter);
console.log('Removed:', removed);
// Expected: at least 4 of these caught:
// "I am confident in my ability to"
// "Notably, I have demonstrated"
// "positions me to contribute effectively"
// "directly aligns with Original Spin's need for"
// "aligns well with my professional background"
```

**Definition of done:**
- Cover letter scrubber catches ≥ 4 AI-tells in the live test cover letter
- Resume scrubber still works (regression test against the original Kiron resume case)
- Wired into `generate.ts` for all three doc types
- `npx tsc --noEmit` clean

---

### TASK 4 — Make silent failures visible (audit priority #3)

**Symptom:** The quality gate, the blueprint fallback, the achievement-match-quality threshold, and now the ATS keyword coverage all currently fail silently. The user can't tell when they got A-tier output vs C-tier output.

**Goal:** When any of these conditions are degraded, surface it to the user as a "review carefully" badge on the document, with a list of what specifically is weak.

**Files to create:**
- `server/src/lib/qualitySignals.ts` — collects signals from each stage into a single struct returned to the frontend

**Files to modify:**
- `server/src/routes/generate.ts` — populate the quality signals and include in response
- `src/components/DocumentLibrary.tsx` or wherever generated docs are displayed — show a badge when signals are non-empty
- Possibly `prisma/schema.prisma` — add a `qualitySignals` JSON field on the Document table (Prisma migration required)

**Implementation pattern:**

```typescript
// server/src/lib/qualitySignals.ts

export type QualitySignal = {
  severity: 'info' | 'warning' | 'critical';
  category: 'ats_keywords' | 'voice' | 'achievement_match' | 'quality_gate' | 'blueprint' | 'bridged_gap';
  message: string;          // human-readable, one sentence
  evidence?: string[];      // specific missing keywords, etc.
};

export function collectSignals(opts: {
  qualityGateOutcome?: { passed: boolean; flags: string[] } | null;
  blueprintFallback: boolean;
  atsCoverage?: { coverage: number; missingFromOutput: string[]; criticalMissing: string[] };
  achievementMatch?: { topScore: number; matchCount: number };
  voiceScrubberFired?: { count: number; categories: string[] };
}): QualitySignal[] {
  const signals: QualitySignal[] = [];

  if (opts.blueprintFallback) {
    signals.push({
      severity: 'warning',
      category: 'blueprint',
      message: 'Strategic blueprint failed — used generic prompt instead. Quality may be lower than usual.',
    });
  }

  if (opts.qualityGateOutcome === null) {
    signals.push({
      severity: 'warning',
      category: 'quality_gate',
      message: 'Quality review pass was skipped.',
    });
  } else if (opts.qualityGateOutcome && !opts.qualityGateOutcome.passed) {
    signals.push({
      severity: 'warning',
      category: 'quality_gate',
      message: 'Quality review flagged issues — review the document before sending.',
      evidence: opts.qualityGateOutcome.flags,
    });
  }

  if (opts.atsCoverage && opts.atsCoverage.coverage < 0.5) {
    signals.push({
      severity: 'critical',
      category: 'ats_keywords',
      message: `ATS keyword coverage low (${Math.round(opts.atsCoverage.coverage * 100)}%). Resume may be filtered before reaching a human reader.`,
      evidence: opts.atsCoverage.criticalMissing,
    });
  }

  if (opts.achievementMatch && opts.achievementMatch.topScore < 0.4) {
    signals.push({
      severity: 'critical',
      category: 'achievement_match',
      message: 'Your achievement bank weakly matches this role. The output may read as generic — consider adding more role-relevant achievements before regenerating.',
    });
  }

  if (opts.voiceScrubberFired && opts.voiceScrubberFired.count > 0) {
    signals.push({
      severity: 'info',
      category: 'voice',
      message: `Voice scrubber corrected ${opts.voiceScrubberFired.count} third-person violations automatically.`,
    });
  }

  return signals;
}
```

**Wire in `generate.ts`:** collect signals during the pipeline, attach to response. Return:

```typescript
return res.json({
  document: { id, content, title, type },
  qualitySignals,  // the array from collectSignals
  // ... existing fields
});
```

**Frontend (light touch):**

In `DocumentLibrary.tsx` (or wherever a generated doc is displayed), if the doc has any `qualitySignals` with severity `warning` or `critical`, render a small badge:

```tsx
{doc.qualitySignals?.some(s => s.severity === 'critical') && (
  <Badge variant="critical" tooltip={signals.map(s => s.message).join(' • ')}>
    Review carefully
  </Badge>
)}
```

Keep the UI tiny — one badge, hover for details. Don't overhaul the component.

**Schema migration (only if you store signals on Document):**

```prisma
model Document {
  // ... existing fields
  qualitySignals  Json?
}
```

Run `npx prisma migrate dev --name add_quality_signals_to_document` locally. **Verify migration is added to the migrations folder and committed.**

**Definition of done:**
- Live test re-run shows a "Review carefully" badge for the Original Spin resume (because ATS coverage is low and PR is missing)
- Hovering the badge shows specific missing keywords
- `npx tsc --noEmit` clean both server and frontend
- Migration committed if you added one

---

### TASK 5 — Banned-phrases scrubber as code (audit priority #6)

**Symptom from live test:** Intern bullet *"Helped set up paid search and social campaigns"* — "helped" is on the banned list in `resume_rules.md:144`. Slipped through. The LLM saw the rule, ignored it.

**Goal:** Lift the banned-phrases list from `resume_rules.md:354-366` into a code-level scrubber that runs after the LLM. Same pattern as voice + AI-tells.

**Files to modify:**
- `server/src/lib/voiceEnforcer.ts` — add a `scrubBannedPhrases()` function alongside the existing scrubbers
- `server/src/routes/generate.ts` — call it for resumes

**Implementation:**

Bank of phrases (read from `server/rules/resume_rules.md` Section 11A):

```typescript
const BANNED_RESUME_PHRASES: Array<{ pattern: RegExp; replacement: string | null; severity: 'replace' | 'flag' }> = [
  { pattern: /\bdemonstrating my ability to\b/gi, replacement: null, severity: 'flag' },
  { pattern: /\bhighlighting my\b/gi, replacement: null, severity: 'flag' },
  { pattern: /\bshowcasing my\b/gi, replacement: null, severity: 'flag' },
  { pattern: /\bresults-driven\b(?!\s+\d)/gi, replacement: '', severity: 'replace' }, // unless followed by number
  { pattern: /\bteam player\b/gi, replacement: '', severity: 'replace' },
  { pattern: /\bexcellent communication skills\b/gi, replacement: '', severity: 'replace' },
  { pattern: /\bresponsible for managing\b/gi, replacement: 'managed', severity: 'replace' },
  { pattern: /\bassisted with\b/gi, replacement: '', severity: 'flag' },
  { pattern: /\bhelped (to )?develop\b/gi, replacement: 'developed', severity: 'replace' },
  { pattern: /\b(I )?helped (set up|build|create|launch)\b/gi, replacement: '$2', severity: 'replace' }, // capture verb
  { pattern: /\bworked closely with the team to\b/gi, replacement: '', severity: 'replace' },
  { pattern: /\bensuring alignment with\b/gi, replacement: 'aligned with', severity: 'replace' },
];
```

Function:

```typescript
export function scrubBannedPhrases(text: string, doctype: 'RESUME' | 'COVER_LETTER'): { scrubbed: string; flagged: string[] } {
  let scrubbed = text;
  const flagged: string[] = [];
  for (const { pattern, replacement, severity } of BANNED_RESUME_PHRASES) {
    if (severity === 'replace' && replacement !== null) {
      scrubbed = scrubbed.replace(pattern, replacement);
    } else {
      const matches = scrubbed.match(pattern);
      if (matches) flagged.push(...matches);
    }
  }
  return { scrubbed, flagged };
}
```

**Wire in `generate.ts`** after the voice enforcer:

```typescript
if (docType === 'RESUME') {
  finalContent = enforceFirstPersonSummary(finalContent, { /* ... */ });
  const banned = scrubBannedPhrases(finalContent, 'RESUME');
  finalContent = banned.scrubbed;
  if (banned.flagged.length > 0) {
    // Feed into qualitySignals (TASK 4)
  }
}
```

**Test against live output:** "Helped set up paid search and social campaigns" should become "set up paid search and social campaigns" (or similar — verb extracted).

**Definition of done:**
- Live test resume regenerate produces no banned phrases
- The "Helped set up..." case is fixed
- `npx tsc --noEmit` clean

---

### TASK 6 — Detect Seek-style employer questions in JD (NEW from live test)

**Symptom from live test:** User pasted JD body but skipped the appended Seek employer questions block. The cover letter didn't proactively address any of the questions (English skills, years as PR Exec, qualification, salary, notice period). Many Seek users skip the questions block.

**Goal:** Detect when a JD likely has employer questions (either present in the paste or implied by Seek-style formatting). If present, parse them and feed to the cover letter generator. If absent but the JD looks Seek-shaped, surface a warning prompting the user to include the question block.

**Files to create:**
- `server/src/lib/jdParser.ts` — initial structured JD parsing (start simple, expand later)

**Files to modify:**
- `server/src/routes/generate.ts` — call the parser, attach output to the prompt context
- `server/src/services/prompts/generation.ts` — accept an optional `employerQuestions` field and incorporate when building cover letter prompt (allowed exception — small additive change, not a full prompt edit)

**Implementation:**

```typescript
// server/src/lib/jdParser.ts

export interface ParsedJD {
  hasEmployerQuestions: boolean;
  employerQuestions: string[];   // empty if not present
  warning?: string;              // e.g. "JD looks like Seek but employer questions missing — paste them for stronger cover letter"
}

const SEEK_QUESTION_BLOCK_PATTERNS = [
  /your application will include the following questions/i,
  /employer questions?[:\s]/i,
  /which of the following statements best describes your right to work/i,
];

const QUESTION_LINE = /^[\s•\-\*]*(?:\d+[.\)]\s*)?(.+\?)\s*$/gm;

const SEEK_SHAPE_HINTS = [
  /posted \d+d ago/i,
  /^\s*Full time\s*$/m,
  /^\s*\$\d+/m,
  /view all jobs/i,
];

export function parseJD(jd: string): ParsedJD {
  const hasQuestionBlock = SEEK_QUESTION_BLOCK_PATTERNS.some(p => p.test(jd));
  let employerQuestions: string[] = [];
  if (hasQuestionBlock) {
    // Find the block and extract questions
    const blockIndex = jd.search(SEEK_QUESTION_BLOCK_PATTERNS[0]) || jd.search(SEEK_QUESTION_BLOCK_PATTERNS[1]);
    if (blockIndex >= 0) {
      const block = jd.slice(blockIndex);
      const matches = [...block.matchAll(QUESTION_LINE)];
      employerQuestions = matches.map(m => m[1].trim()).filter(q => q.length > 10);
    }
  }

  const looksLikeSeek = SEEK_SHAPE_HINTS.filter(p => p.test(jd)).length >= 2;
  const warning = (looksLikeSeek && !hasQuestionBlock)
    ? 'JD appears to be from Seek but the employer-question block is missing. Scroll to the bottom of the Seek posting and paste the question block — your cover letter will pre-empt qualifying questions.'
    : undefined;

  return { hasEmployerQuestions: hasQuestionBlock, employerQuestions, warning };
}
```

**Wire in `generate.ts`:**

```typescript
const parsedJD = parseJD(jobDescription);
if (parsedJD.warning) {
  // surface to qualitySignals (TASK 4)
}
// Pass parsedJD.employerQuestions to the prompt builder if non-empty
```

In `generation.ts` prompt builder (small additive edit — only for cover letters):

```typescript
${parsedJD?.employerQuestions?.length > 0 ? `
EMPLOYER QUESTIONS — the JD asks the candidate to answer these. Address each
proactively in the cover letter body where relevant. Do not include verbatim
questions; weave the answers into the narrative.

${parsedJD.employerQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
` : ''}
```

**Test cases:**

```typescript
const seekJDWithQuestions = `
[full JD body from qa test.txt]

Missed questions from Seek - Not included in the pasted description
Employer questions
Your application will include the following questions:
Which of the following statements best describes your right to work in Australia?
How many years' experience do you have as a Marketing and Public Relations Executive?
...
`;

const result1 = parseJD(seekJDWithQuestions);
// expect hasEmployerQuestions === true, employerQuestions.length === 7

const seekJDWithoutQuestions = `
[just the body, no question block]
Posted 14d ago
Full time
$50 – $70 per year
`;

const result2 = parseJD(seekJDWithoutQuestions);
// expect hasEmployerQuestions === false, warning !== undefined
```

**Definition of done:**
- Parser catches Seek question block when present
- Parser warns when JD looks like Seek but block is missing
- Cover letter generation uses the questions when available
- `npx tsc --noEmit` clean

---

## 2 — Final checklist before push

After all 6 tasks are complete:

```powershell
# 1. Type check
cd E:/AntiGravity/JobHub/server
npx tsc --noEmit
# expect: no output, exit 0

cd E:/AntiGravity/JobHub
npx tsc --noEmit
# expect: no output, exit 0

# 2. Confirm no unrelated files modified
git status --short
# Only files explicitly named in this spec should appear

# 3. Confirm test cases pass (manual scripts written for empirical tests)
# Each task has a "Test case" section — re-run the node -e or test command

# 4. Commit per task (NOT one giant commit)
# Each task gets its own commit so the human can review individually
git add server/src/lib/atsKeywords.ts server/src/routes/generate.ts
git commit -m "feat(quality): ATS keyword check as code (audit priority #1)

Extracts top JD keywords deterministically, verifies presence in generated
output, attaches result to response. Pure code, no LLM call.

Verified against live test (Original Spin PR role): correctly flags zero
mentions of 'public relations' in body of generated resume.
"

# ... one commit per task

# 5. Push the feature branch
git push -u origin feat/quality-pass-2026-05-26

# 6. STOP. Do not merge. Tell the human:
# - "Branch pushed: feat/quality-pass-2026-05-26"
# - "6 commits, one per task"
# - "All type checks pass"
# - "Live-test empirical tests pass for each task"
# - "Ready for human review and merge to staging"
```

## 3 — What success looks like

A human reviewer pulls the branch, runs locally, regenerates the Original Spin resume, and sees:

1. The bridged achievement (21 events / 100K attendees) appears in the resume — **TASK 1 verified**
2. "Public Relations" appears 3-5 times in body of resume, naturally woven into experience — **TASK 2 verified (via warning + LLM re-roll once user adds PR-relevant achievement)**
3. Cover letter no longer contains "I am confident in my ability to", "Notably, I have demonstrated", "positions me to contribute effectively" — **TASK 3 verified**
4. A "Review carefully" badge appears next to the document with hover-text listing the specific issues — **TASK 4 verified**
5. Intern bullet no longer starts with "Helped" — **TASK 5 verified**
6. If the JD is missing Seek's employer-question block, the user sees a warning prompting them to paste it — **TASK 6 verified**

The Railway staging deploy is unchanged until the human chooses to merge.

## 4 — If you get stuck

- **TypeScript errors you don't understand:** Don't `// @ts-ignore`. Stop and write a comment in the spec describing what you hit. The human will resolve.
- **Merge conflicts:** Stop and ask the human. A prior session lost work by guessing wrong on a conflict resolution. Do not guess.
- **A test case fails after your fix:** Stop. Re-read the task. Re-run the test on the actual broken input. If the regex doesn't catch what you expected, the regex is wrong — fix the regex, don't lower the test threshold.
- **You think the prompt is the right place to fix something:** It almost certainly isn't. The pattern in this codebase is "LLM advisory + deterministic post-process enforcement." If a task seems to require editing a prompt to fix it, escalate to the human before editing — explain why and propose the post-processor alternative first.

---

## 5 — Out of scope (do not attempt)

These were in the audit but explicitly out of scope for THIS pass:

- JD parser as a full structured extraction (#6 in audit) — only Seek-question detection is in scope (TASK 6)
- Quality gate hard cap (#8) — leave alone, the new code-level scrubbers reduce reliance on the gate
- Em-dash strip review (#9) — separate task
- Provenance tagging tunability (#10) — separate task
- Years-of-experience computation refinement (#11) — separate task
- Profile extraction verification UX (#12) — separate task
- Eval suite / promptfoo (#13) — separate task
- A/B testing on outputs (#14) — separate task
- Tone quantification (#15) — separate task
- Cost aggregation (#17) — separate task

Stay focused. Six tasks, six commits, one feature branch. Push and stop.

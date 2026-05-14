# Section 5 Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the diagnostic page into a Q&A-framed report whose final section converts each diagnosed problem into a personalised, AI-led solution that lands the user directly in the wizard with no welcome modal.

**Architecture:** Section 5 body is fully LLM-generated using a structured `MOVE_TARGETING / MOVE_RESUME / MOVE_APPLICATIONS` emission spec, parsed client-side and rendered as three sub-cards inside one outer card with an always-visible CTA. All five section cards get a static user-voice question above them. Baseline-resume generation moves from a modal trigger to a server-side hook on diagnostic completion; the diagnostic CTA navigates straight to `/setup`.

**Tech Stack:** React 19 + TypeScript + Framer Motion (client), Express + TypeScript + Vitest + Claude SDK (server), Tailwind CSS, React Router 7.

**Source spec:** `docs/superpowers/specs/2026-05-14-section-5-revamp-design.md`

---

## File map

| File | Responsibility | Action |
|---|---|---|
| `server/src/services/diagnosticReport.ts` | Diagnostic LLM prompt | Replace `## The 3-Step Fix` block with platform capability brief + `MOVE_*` emission spec |
| `server/src/services/diagnosticReport.test.ts` | New test file | Verify prompt assembly contains capability brief + emission spec |
| `server/src/routes/onboarding.ts` | Diagnostic completion path | Fire baseline-resume generation in background when report COMPLETE |
| `src/lib/parseReport.ts` | Markdown → structured sections | Add `parseFixMoves` helper with tolerant fallback |
| `src/components/ReportExperience.tsx` | Diagnostic UI | Add Q&A wrapper, replace Section 5 layout, remove old CTA + referral, relocate dashboard-skip + feedback widget, restyle sticky bar |
| `src/App.tsx` | Top-level routing | Diagnostic CTA navigates to `/setup` instead of `/workspace` |
| `src/pages/SetupWizard.tsx` | Wizard chrome | Add baseline-resume download link with Generating / Download / Retry states |
| `src/lib/analytics.ts` | Telemetry | Add `section_5_cta_clicked`, `baseline_resume_downloaded_from_wizard` events |

---

## Verification approach

- **Server-side TDD** for the prompt extension and parser-shape contract (server has Vitest set up: `npm test`).
- **Client-side parser** verified by running the dev server with a captured fixture pasted into a tiny one-off test page. No client test framework is being added in this iteration.
- **UI changes** verified by `npm run dev` walkthrough after each task: load the diagnostic, click through to the wizard, check both light and dark themes.
- **Final gate:** `npm run build` (root client) + `cd server && npm run build && npm test` + `npm run lint` all pass.

---

## Resolved open question

The spec flagged a wizard route question. Resolved: `/setup` already mounts `SetupWizard` (see `src/App.tsx:352`). Diagnostic CTA navigates directly to `/setup`. ProfileBank is no longer in the post-diagnostic path, so no modal-suppression logic is needed.

---

## Task 1: Server prompt: replace `## The 3-Step Fix` with structured `MOVE_*` emission

**Files:**
- Modify: `server/src/services/diagnosticReport.ts:114-128`
- Create: `server/src/services/diagnosticReport.test.ts`

- [ ] **Step 1: Read the existing prompt to confirm exact replacement boundaries**

Open `server/src/services/diagnosticReport.ts`. The block to replace is:

```ts
## The 3-Step Fix

Write exactly 3 numbered items. Each item must have a bold action title on the first line, followed by 2-3 sentences of specific advice. Fold the likely impact into the body of each item — do not add a separate section for impact. Number them 1, 2, 3. For any before/after example within an item, use blockquote format:
> Before: [their actual text]
> After: [the improved version]

The third item must end with this closing sentence, adapted to reflect the biggest gap you identified (resume, cover letter, or interview): "The fastest way to do this is inside the platform — it has been built around your specific profile and this exact role type. Your first 7 days are free. Use them."

---

[Leave this zone empty — the three steps above are the complete plan.]
```

Note: this block is followed by `## What JobHub Will Do For You` which **stays as-is**.

- [ ] **Step 2: Write the failing test for prompt content**

Create `server/src/services/diagnosticReport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildDiagnosticPromptForTest } from './diagnosticReport';

const baseInput = {
  targetRole: 'Marketing Analyst',
  targetCity: 'Sydney',
  seniority: 'mid',
  industry: 'finance',
  responsePattern: 'mostly_silence',
  resumeText: 'Sample resume',
};

describe('diagnostic prompt: Section 5 MOVE_* emission', () => {
  it('includes the JobHub platform capability brief', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toContain('JobHub platform capabilities');
    expect(p).toContain('TARGETING:');
    expect(p).toContain('RESUME:');
    expect(p).toContain('APPLICATIONS:');
  });

  it('emits MOVE_TARGETING / MOVE_RESUME / MOVE_APPLICATIONS subsections in spec', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toContain('### MOVE_TARGETING');
    expect(p).toContain('### MOVE_RESUME');
    expect(p).toContain('### MOVE_APPLICATIONS');
  });

  it('lists the four labelled keys per move', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toContain('HEADLINE:');
    expect(p).toContain('SITUATION:');
    expect(p).toContain('JOBHUB:');
    expect(p).toContain('OUTCOME:');
  });

  it('forbids em dashes and avoid-list words in the voice rules', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).toMatch(/no em dashes/i);
    expect(p).toMatch(/avoid.*(brutal|killing|crushing)/i);
  });

  it('does not contain the old "first 7 days are free" sentence', () => {
    const p = buildDiagnosticPromptForTest(baseInput);
    expect(p).not.toContain('first 7 days are free');
  });
});
```

- [ ] **Step 3: Export `buildDiagnosticPromptForTest` from `diagnosticReport.ts`**

At the bottom of `server/src/services/diagnosticReport.ts`, add:

```ts
// Test-only export. Allows the prompt assembler to be exercised directly
// without an LLM call.
export const buildDiagnosticPromptForTest = buildDiagnosticPrompt;
```

- [ ] **Step 4: Run the test, expect failure**

```bash
cd server && npm test -- diagnosticReport
```

Expected: 5 failing tests (no capability brief, no MOVE_*, no labelled keys, no voice rules, old sentence still present).

- [ ] **Step 5: Replace the `## The 3-Step Fix` block in the prompt**

In `server/src/services/diagnosticReport.ts`, replace the block identified in Step 1 with:

```ts
## The 3-Step Fix

JobHub platform capabilities (use these as the only true source for what the platform can do; do not invent capabilities):

- TARGETING: A Job Match Engine that scores live job descriptions against the candidate's specific profile. It identifies which roles align with the candidate's strengths, surfaces the points in their background that fit each role, and flags the gap between requirement and fit so the candidate can decide where to invest effort. Lives in the JobFeed and Match Engine.

- RESUME: A Resume Tailoring engine that rebuilds the candidate's resume against the language of a specific role, drawing on a library of resumes that have landed interviews in Australia. The candidate's Achievement Bank supplies the substance; the engine handles framing, structure, and language.

- APPLICATIONS: A Document Generation engine that produces tailored cover letters and selection-criteria responses in roughly three minutes per application, drawing from the candidate's Achievement Bank. The candidate reviews and adjusts before sending.

Voice rules for this section: calm, plain language, calm-ally tone. Use "you" not "the candidate" in the rendered text. No em dashes anywhere. No exclamations. Avoid the words: brutal, killing, crushing, rocket, fire, "stop guessing", "stop getting rejected". Each paragraph short and independent. The pattern is: acknowledge what the candidate is already doing or attempting, pivot to how the relevant JobHub capability addresses their specific situation, then state the concrete outcome.

Emit three moves in this EXACT format. Use plain text labels exactly as shown. Do not add any other prose between or around the moves.

### MOVE_TARGETING
HEADLINE: <4 to 7 word action-led headline grounded in this candidate's targeting situation>
SITUATION: <1 to 2 sentences naming this candidate's specific situation in role targeting. Acknowledge what they are already doing or attempting.>
JOBHUB: <1 to 2 sentences explaining how the TARGETING capability helps THIS candidate with THIS situation. Frame against their specific need, not generic AI claims.>
OUTCOME: <1 sentence describing the concrete change for them.>

### MOVE_RESUME
HEADLINE: <4 to 7 word action-led headline grounded in this candidate's resume situation>
SITUATION: <1 to 2 sentences naming this candidate's specific resume framing or format situation. Acknowledge what they are already doing or attempting.>
JOBHUB: <1 to 2 sentences explaining how the RESUME capability helps THIS candidate with THIS situation. Frame against their specific need.>
OUTCOME: <1 sentence describing the concrete change for them.>

### MOVE_APPLICATIONS
HEADLINE: <4 to 7 word action-led headline grounded in this candidate's volume vs quality situation>
SITUATION: <1 to 2 sentences naming this candidate's specific application-volume situation. Acknowledge their effort.>
JOBHUB: <1 to 2 sentences explaining how the APPLICATIONS capability helps THIS candidate with THIS situation.>
OUTCOME: <1 sentence describing the concrete change for them.>
```

- [ ] **Step 6: Run the test, expect pass**

```bash
cd server && npm test -- diagnosticReport
```

Expected: 5 passing tests.

- [ ] **Step 7: Type-check the server**

```bash
cd server && npm run build
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add server/src/services/diagnosticReport.ts server/src/services/diagnosticReport.test.ts
git commit -m "feat(diagnostic): emit Section 5 as structured MOVE_* subsections with calm-ally voice"
```

---

## Task 2: Client parser: `parseFixMoves`

**Files:**
- Modify: `src/lib/parseReport.ts`

- [ ] **Step 1: Add the `Move` and `FixMoves` types and the parser**

Append to `src/lib/parseReport.ts`:

```ts
export interface Move {
  headline: string;
  situation: string;
  jobhub: string;
  outcome: string;
}

export interface FixMoves {
  targeting: Move;
  resume: Move;
  applications: Move;
}

const MOVE_FALLBACK: Move = {
  headline: 'A move tailored to your situation',
  situation: 'Here is how we would approach this part for your situation.',
  jobhub: 'JobHub guides you through this step using your profile.',
  outcome: 'You move forward with a clear next action.',
};

const MOVE_KEYS: Array<{ marker: string; field: keyof FixMoves }> = [
  { marker: 'MOVE_TARGETING',    field: 'targeting' },
  { marker: 'MOVE_RESUME',       field: 'resume' },
  { marker: 'MOVE_APPLICATIONS', field: 'applications' },
];

/**
 * Extract one labelled value (e.g. "HEADLINE: foo") from a block of MOVE text.
 * Tolerant: returns undefined if missing. Stops at the next ALL-CAPS label
 * line so multi-line values are captured up to the next field.
 */
function extractField(block: string, label: 'HEADLINE' | 'SITUATION' | 'JOBHUB' | 'OUTCOME'): string | undefined {
  const re = new RegExp(`^${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z]{4,}:|$)`, 'm');
  const m = block.match(re);
  if (!m) return undefined;
  return m[1].replace(/\s+/g, ' ').trim() || undefined;
}

/**
 * Split the Section 5 markdown ("## The 3-Step Fix" content) into three
 * structured Move objects. Tolerant: any missing or malformed block falls
 * back to a generic placeholder and a warning is logged. The diagnostic
 * still renders.
 */
export function parseFixMoves(fixSectionContent: string): FixMoves {
  const result: FixMoves = {
    targeting: { ...MOVE_FALLBACK },
    resume: { ...MOVE_FALLBACK },
    applications: { ...MOVE_FALLBACK },
  };

  for (const { marker, field } of MOVE_KEYS) {
    // Each move block starts at "### MOVE_X" and ends at the next "###" or end-of-string.
    const blockRe = new RegExp(`###\\s*${marker}\\s*\\n([\\s\\S]*?)(?=\\n###\\s*MOVE_|$)`, 'i');
    const blockMatch = fixSectionContent.match(blockRe);
    if (!blockMatch) {
      console.warn(`[parseFixMoves] Missing block: ${marker}. Using fallback.`);
      continue;
    }
    const block = blockMatch[1];

    const headline = extractField(block, 'HEADLINE');
    const situation = extractField(block, 'SITUATION');
    const jobhub = extractField(block, 'JOBHUB');
    const outcome = extractField(block, 'OUTCOME');

    if (!headline || !situation || !jobhub || !outcome) {
      console.warn(`[parseFixMoves] Incomplete block ${marker}. Falling back where missing.`, {
        headline: !!headline, situation: !!situation, jobhub: !!jobhub, outcome: !!outcome,
      });
    }

    result[field] = {
      headline: headline ?? MOVE_FALLBACK.headline,
      situation: situation ?? MOVE_FALLBACK.situation,
      jobhub: jobhub ?? MOVE_FALLBACK.jobhub,
      outcome: outcome ?? MOVE_FALLBACK.outcome,
    };
  }

  return result;
}
```

- [ ] **Step 2: Add a one-off verification call inside `ReportExperience.tsx`**

To verify the parser without adding a test framework, temporarily wire a `console.log(parseFixMoves(...))` call into `ReportExperience.tsx`. Inside the main component (e.g. just below the `parseReportSections` call around line 678), add for one dev-server run:

```ts
  // TEMPORARY parser verification. Remove before commit.
  if (data?.reportMarkdown) {
    const fixSection = sections.find(s => s.key === 'fix');
    if (fixSection) {
      // eslint-disable-next-line no-console
      console.log('[parseFixMoves]', parseFixMoves(fixSection.content));
    }
  }
```

Start the dev server with both client and server running, sign in as a test user, and either trigger a fresh diagnostic or load an existing one whose markdown was generated AFTER Task 1 shipped (older reports use the legacy format and will fall back).

In the browser console, expect to see a structured object with `targeting`, `resume`, `applications` keys, each populated from the LLM emission. If a key falls back to placeholders, inspect the markdown to see if the LLM emitted the right shape; if not, refine the prompt in Task 1 before continuing.

Remove the temporary `console.log` block before the next step.

- [ ] **Step 3: Type-check the client**

```bash
npm run build
```

Expected: no errors. (`build` runs `tsc -b && vite build`.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/parseReport.ts
git commit -m "feat(diagnostic): add parseFixMoves helper for structured Section 5 emission"
```

---

## Task 3: Q&A wrapper: render user-voice question above each section card

**Files:**
- Modify: `src/components/ReportExperience.tsx`

- [ ] **Step 1: Add the `SECTION_QUESTIONS` constant**

In `src/components/ReportExperience.tsx`, just below the existing `SECTION_TEASERS` constant (around line 38), add:

```ts
const SECTION_QUESTIONS: Record<string, string> = {
  targeting:      'Am I going after the right jobs?',
  document_audit: 'Is my resume actually doing its job?',
  pipeline:       'Where am I getting stuck?',
  honest:         "What's really holding me back?",
  fix:            'So how do I actually fix this?',
};
```

- [ ] **Step 2: Render the question above each card**

In `src/components/ReportExperience.tsx`, the section-cards loop starts at `{cardSections.map((section, idx) => {` (around line 938). Inside the map callback, after all the local `const` declarations (the last one is `const isDimmed = activeKey !== null && activeKey !== section.key;` near line 958), declare the question variable:

```tsx
              const question = SECTION_QUESTIONS[section.key];
```

Then in the existing `return (...)` block, insert the question heading as a sibling above the existing `<motion.div className="print-card" ...>`. Find the block (around line 960):

```tsx
              return (
                <div
                  key={section.key}
                  id={`section-${section.key}`}
                  ref={(el) => { sectionRefs.current.set(section.key, el); }}
                >
                  <motion.div
                    className="print-card"
```

Insert the question heading as the first child of the outer `<div>`, immediately before `<motion.div className="print-card"`:

```tsx
                  {question && (
                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: isDimmed ? 0.4 : 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                      animate={{ opacity: isDimmed ? 0.4 : 1 }}
                      style={{
                        fontSize: 'clamp(22px, 4vw, 30px)',
                        fontWeight: 600,
                        color: theme.heading,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.25,
                        margin: '36px 0 12px',
                      }}
                    >
                      {question}
                    </motion.h2>
                  )}
```

The remainder of the JSX (the `<motion.div className="print-card">` and everything inside) stays as-is.

- [ ] **Step 3: Verify visually**

```bash
npm run dev
```

Open the diagnostic page (sign in as a user with a completed report). Confirm:

- A large question heading appears above each of the five cards in both light and dark themes.
- Question text matches the constant exactly.
- When a card is dimmed (focus mode), its question dims with it.
- No layout regression on mobile widths (resize to 375px).

- [ ] **Step 4: Commit**

```bash
git add src/components/ReportExperience.tsx
git commit -m "feat(diagnostic): add user-voice Q&A heading above each section card"
```

---

## Task 4: New Section 5: outer card + 3 sub-cards + always-visible CTA

**Files:**
- Modify: `src/components/ReportExperience.tsx`

This task replaces the rendering for `section.key === 'fix'` with a custom outer card that holds the personalised intro, three Move sub-cards parsed from the LLM output, and the always-visible CTA + caveat line. The feedback widget is moved inside this outer card too (after the CTA).

- [ ] **Step 1: Import `parseFixMoves` and the new types**

In `src/components/ReportExperience.tsx`, update the import from `'../lib/parseReport'`:

```ts
import { parseReportSections, splitProblemFix, parseFixMoves, type Move } from '../lib/parseReport';
```

- [ ] **Step 2: Add a `MoveSubCard` component above the main `ReportExperience` export**

Before `export function ReportExperience(...)` (near line 627), add:

```tsx
function MoveSubCard({
  index,
  move,
  theme,
}: {
  index: number;
  move: Move;
  theme: ReturnType<typeof makeTheme>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1], delay: index * 0.05 }}
      style={{
        background: theme.fixBand,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: 14,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h3 style={{
        margin: 0,
        fontSize: 'clamp(16px, 2.6vw, 18px)',
        fontWeight: 700,
        color: theme.heading,
        letterSpacing: '-0.015em',
        lineHeight: 1.35,
      }}>
        {index + 1}. {move.headline}
      </h3>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: theme.body, fontWeight: 450 }}>
        {move.situation}
      </p>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: theme.body, fontWeight: 450 }}>
        {move.jobhub}
      </p>
      <p style={{
        margin: 0,
        fontSize: 14,
        lineHeight: 1.6,
        color: theme.heading,
        fontWeight: 600,
        fontStyle: 'italic',
        opacity: 0.92,
      }}>
        {move.outcome}
      </p>
    </motion.div>
  );
}
```

- [ ] **Step 3: Add a `Section5Card` component below `MoveSubCard`**

```tsx
function Section5Card({
  fixSectionContent,
  firstName,
  meta,
  question,
  theme,
  isDark,
  isDimmed,
  onCta,
  ctaRef,
  registerRef,
}: {
  fixSectionContent: string;
  firstName: string | null;
  meta: { label: string; color: string; bg: string };
  question?: string;
  theme: ReturnType<typeof makeTheme>;
  isDark: boolean;
  isDimmed: boolean;
  onCta: () => void;
  ctaRef: React.RefObject<HTMLDivElement | null>;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const moves = parseFixMoves(fixSectionContent);
  const greetingName = firstName ?? 'there';

  return (
    <div ref={registerRef} id="section-fix">
      {question && (
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: isDimmed ? 0.4 : 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
          animate={{ opacity: isDimmed ? 0.4 : 1 }}
          style={{
            fontSize: 'clamp(22px, 4vw, 30px)',
            fontWeight: 600,
            color: theme.heading,
            letterSpacing: '-0.02em',
            lineHeight: 1.25,
            margin: '36px 0 12px',
          }}
        >
          {question}
        </motion.h2>
      )}

      <motion.div
        className="print-card"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
        animate={{ opacity: isDimmed ? 0.4 : 1 }}
        style={{
          background: theme.card,
          borderRadius: 18,
          border: `1px solid ${theme.cardBorder}`,
          borderLeft: `4px solid ${meta.color}`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          transition: 'opacity 0.25s, border-color 0.25s, box-shadow 0.25s',
          padding: '24px 26px',
        }}
      >
        {/* Header: 05 / label / dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <span style={{
            fontSize: 10, fontWeight: 900, color: meta.color, opacity: 0.5,
            letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
            flexShrink: 0, minWidth: 18,
          }}>
            05
          </span>
          <p style={{
            margin: 0, flex: 1, fontSize: 11, fontWeight: 800,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: theme.sub,
          }}>
            {meta.label}
          </p>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0, opacity: 0.7 }} />
        </div>

        {/* Personalised intro */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: theme.heading, letterSpacing: '-0.015em' }}>
            Hey {greetingName},
          </p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: theme.body, fontWeight: 450 }}>
            Here is the path forward. Three moves, each tied to something the platform handles for you.
          </p>
        </div>

        {/* Three sub-cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          <MoveSubCard index={0} move={moves.targeting}    theme={theme} />
          <MoveSubCard index={1} move={moves.resume}       theme={theme} />
          <MoveSubCard index={2} move={moves.applications} theme={theme} />
        </div>

        {/* Always-visible CTA */}
        <div ref={ctaRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <motion.button
            onClick={onCta}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            style={{
              width: '100%',
              background: '#2D5A6E', // PETROL
              color: '#E0E0E0',
              borderRadius: 14,
              padding: '16px 24px',
              fontSize: 16,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '-0.01em',
              boxShadow: '0 6px 24px rgba(45,90,110,0.4)',
            }}
          >
            Start with your professional summary →
          </motion.button>
          <p style={{ margin: 0, fontSize: 12, color: theme.sub, textAlign: 'center' }}>
            First five tailored applications free. No card needed.
          </p>
        </div>

        {/* Feedback widget moved inside the new Section 5, after the CTA */}
        <div style={{ marginTop: 28 }}>
          <SocialProofWidget isDark={isDark} theme={theme} />
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 4: Branch the cards-loop render on `section.key === 'fix'`**

In `src/components/ReportExperience.tsx`, inside the `cardSections.map` callback, immediately AFTER the `const isDimmed = ...` line (~line 958, which is the last `const` declaration before the existing `return`), and BEFORE the standard `return (...)` block, add an early return for the `fix` key:

```tsx
              if (section.key === 'fix') {
                return (
                  <Section5Card
                    key={section.key}
                    fixSectionContent={section.content}
                    firstName={firstName}
                    meta={meta}
                    question={SECTION_QUESTIONS.fix}
                    theme={theme}
                    isDark={isDark}
                    isDimmed={isDimmed}
                    onCta={() => {
                      onDone();
                    }}
                    ctaRef={ctaRef}
                    registerRef={(el) => { sectionRefs.current.set('fix', el); }}
                  />
                );
              }
```

This early return short-circuits before the standard heading + card render from Task 3, so Section 5's question heading is rendered exclusively inside `Section5Card` (no duplication).

- [ ] **Step 5: Verify visually with the dev server**

```bash
npm run dev
```

- Sign in and open the diagnostic page. (If you do not have a fresh diagnostic, use the regenerate button on the diagnostic page, or admin-trigger a new report.)
- Confirm Section 5 renders the new layout:
  - Question above the card: `So how do I actually fix this?`
  - Outer card with `05 YOUR NEXT THREE MOVES` header
  - "Hey {firstName}," intro
  - Three sub-cards, each with a numbered headline + three paragraphs (situation, JobHub, outcome italic)
  - Petrol-coloured CTA button "Start with your professional summary →"
  - Caveat text "First five tailored applications free. No card needed."
  - Feedback widget appears below the CTA (it will also still appear at the page bottom for now; we remove the bottom one in Task 6)
- Toggle dark/light theme: both readable.
- Resize to 375px: sub-cards remain readable, CTA button remains tappable.
- If parser falls back (e.g. on an old cached report), the fallback strings render.

- [ ] **Step 6: Type-check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ReportExperience.tsx
git commit -m "feat(diagnostic): new Section 5 with personalised intro, 3 move sub-cards, always-visible CTA"
```

---

## Task 5: Remove the old generic CTA block, referral block, bottom feedback widget, and bottom dashboard-skip link

**Files:**
- Modify: `src/components/ReportExperience.tsx`

The new Section 5 (Task 4) absorbs the CTA and the feedback widget. The referral block and the bottom dashboard-skip link go away (the dashboard-skip relocates to the header in Task 6).

- [ ] **Step 1: Remove the old CTA section JSX**

In `src/components/ReportExperience.tsx`, find the block that begins (around line 1099):

```tsx
          {/* ── CTA section ── */}
          {sections.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
```

…and ends at the closing `</motion.div>` of that block (around line 1217, the `</motion.div>)` that closes the CTA section, after the bottom `<SocialProofWidget />`).

Delete the entire block, including the bottom `<SocialProofWidget />` (which now lives inside `Section5Card`). Also delete the comment `{/* ── CTA section ── */}` line.

The cards loop ends with its closing `</div>` at line ~1096; the next significant block after deletion should be `{/* ── Sticky bar ── */}` (line ~1223).

- [ ] **Step 2: Remove now-unused imports and state declarations**

`ctaRef` is now passed into `Section5Card`. Confirm it is still declared at the top of `ReportExperience` (line ~637). It is. Keep it.

The following state and constants are only used in the deleted CTA + referral blocks. Remove their declarations from inside `ReportExperience`:

- `const [linkCopied, setLinkCopied] = useState(false);`
- `const [msgCopied, setMsgCopied] = useState(false);`
- `const refSlug = ...;`
- `const referralLink = ...;`
- `const shareMsg = ...;`

Then run TypeScript to surface any remaining unused imports:

```bash
npm run build
```

If `tsc` reports `'Copy' is declared but its value is never read.` or the same for `Check`, remove those identifiers from the lucide-react import on line 4. Keep `Sun, Moon, X, Star, ChevronDown` (still used elsewhere in the file).

- [ ] **Step 3: Verify the file still compiles**

```bash
npm run build
```

Expected: no errors. If TypeScript complains about an unused import, remove it.

- [ ] **Step 4: Verify visually**

```bash
npm run dev
```

- Open the diagnostic page.
- Scroll to the bottom of the report. Confirm: no second feedback widget, no referral block, no second "Build your interview-ready resume" CTA, no "Already have an account? Go to the dashboard →" link.
- The page now ends cleanly after the new Section 5 outer card (which contains the CTA and feedback widget).

- [ ] **Step 5: Commit**

```bash
git add src/components/ReportExperience.tsx
git commit -m "refactor(diagnostic): remove old CTA, referral block, bottom feedback widget; absorbed into new Section 5"
```

---

## Task 6: Relocate dashboard-skip link to the diagnostic header chrome

**Files:**
- Modify: `src/components/ReportExperience.tsx`

A small text link sits next to the existing fixed theme toggle so returning users can escape to the dashboard without scrolling.

- [ ] **Step 1: Add the link next to the theme toggle**

In `src/components/ReportExperience.tsx`, find the theme toggle button (around line 796):

```tsx
        <button
          onClick={() => setIsDark(d => !d)}
          aria-label="Toggle theme"
          className="no-print"
          style={{
            position: 'fixed', top: 20, right: 20, zIndex: 20,
```

Just before the theme toggle's opening `<button` tag, add a fixed-position skip link:

```tsx
        <button
          onClick={onDone}
          className="no-print"
          style={{
            position: 'fixed', top: 24, right: 70, zIndex: 20,
            background: 'none', border: 'none',
            color: theme.sub, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', padding: '6px 8px',
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}
        >
          Go to the dashboard →
        </button>
```

This sits to the left of the theme toggle (which is at `right: 20` width 40, so `right: 70` clears it).

- [ ] **Step 2: Verify visually**

```bash
npm run dev
```

- Open the diagnostic page.
- Top-right corner: theme toggle (round) on the right, "Go to the dashboard →" text link to its left.
- Click the link: navigates to the dashboard (calls `onDone`, which already navigates to `/setup` once Task 7 lands; for now it goes to `/workspace` via the existing `onDone`).
- Confirm both light and dark themes look right.

- [ ] **Step 3: Commit**

```bash
git add src/components/ReportExperience.tsx
git commit -m "feat(diagnostic): relocate dashboard-skip link to header chrome"
```

---

## Task 7: Diagnostic CTA navigates to `/setup` (skip ProfileBank welcome modal)

**Files:**
- Modify: `src/App.tsx:281-287`

- [ ] **Step 1: Change the navigation target in `handleDone`**

In `src/App.tsx`, find `handleDone` inside `ReportOrDashboard` (line 281):

```tsx
  function handleDone() {
    console.log('[ReportOrDashboard] handleDone, marking report seen, navigating to /workspace');
    localStorage.setItem('jobhub_report_seen', 'true');
    localStorage.setItem('jobhub_tips_seen', 'false');
    setReportSeen(true);
    navigate('/workspace', { replace: true });
  }
```

Replace with:

```tsx
  function handleDone() {
    console.log('[ReportOrDashboard] handleDone, marking report seen, navigating to /setup');
    localStorage.setItem('jobhub_report_seen', 'true');
    localStorage.setItem('jobhub_tips_seen', 'false');
    setReportSeen(true);
    navigate('/setup', { replace: true });
  }
```

- [ ] **Step 2: Verify the route exists**

```bash
grep -n "path=\"/setup\"" src/App.tsx
```

Expected: matches `<Route path="/setup" element={...}>` (line ~352).

- [ ] **Step 3: Verify visually with the full flow**

```bash
npm run dev
```

- Sign in with a fresh user, complete intake, view the diagnostic.
- Click `Start with your professional summary →` in the new Section 5.
- Expected: lands directly on the wizard step 1 (Professional Summary). No ProfileBank welcome modal anywhere.
- Refresh the page on `/setup`: still on the wizard, no modal pops up.
- Click `Go to the dashboard →` in the diagnostic header: lands on the wizard. (This is correct: `onDone` is the only handler we have; users who genuinely have an account and want StrategyHub can navigate from the dashboard nav once on the wizard. If you want the dashboard-skip link to bypass `/setup` and go straight to `/`, that is a follow-up, not in this iteration.)

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(diagnostic): CTA navigates straight to /setup, skipping ProfileBank welcome modal"
```

---

## Task 8: Server: trigger baseline-resume on the diagnostic retry path

**Status:** the primary `/api/onboarding/submit` path already fires `generateBaselineResume` on diagnostic completion (`server/src/routes/onboarding.ts:196`). The `/api/onboarding/retry` path does not. Add the same trigger there so users who regenerate their diagnostic also get a fresh baseline.

**Function signature:** `generateBaselineResume(userId: string, resumeRawText: string, reportMarkdown: string): Promise<void>` (`server/src/services/baselineResume.ts:11`). It already short-circuits if a baseline document already exists for that user, so duplicate calls are safe.

**Files:**
- Modify: `server/src/routes/onboarding.ts` (retry handler, around line 264-289)

- [ ] **Step 1: Add the import (if not already present)**

In `server/src/routes/onboarding.ts`, near the top with the other service imports, ensure `generateBaselineResume` is imported. (It almost certainly already is, since the primary submit path calls it. Confirm with `grep -n "generateBaselineResume" server/src/routes/onboarding.ts`. If no import line is present, add one matching the existing `import { generateDiagnosticReport, ... }` pattern.)

- [ ] **Step 2: Add the retry-path trigger**

In `server/src/routes/onboarding.ts`, find the retry handler's `.then(async (markdown) => { ... })` block (around line 265). It currently sets `status: 'COMPLETE'`, updates `hasCompletedOnboarding`, and conditionally sends the welcome email. After the welcome-email block (around line 281, just before the closing `}` of the `.then` callback), add:

```ts
        generateBaselineResume(userId, reportInput.resumeText, markdown).catch(err =>
          console.error('[Onboarding] Retry baseline resume failed:', err)
        );
```

This mirrors line 196 in the primary path. The variable `userId` is already in scope from the outer handler. `reportInput.resumeText` is already populated from the loaded profile.

- [ ] **Step 3: Type-check the server**

```bash
cd server && npm run build
```

Expected: no errors.

- [ ] **Step 4: Verify with a regenerated diagnostic**

```bash
cd server && npm run dev
```

In another terminal start the client:

```bash
npm run dev
```

- Sign in with a user who already has a completed diagnostic + an existing baseline resume.
- Manually delete the baseline document via the database or via a Prisma Studio session: `prisma.document.delete({ where: { userId_type: { userId, type: 'BASELINE_RESUME' } } })`. (Or pick a fresh user, run intake, then click `Regenerate report` to exercise the retry path on the resulting empty-baseline state.)
- Trigger the regenerate path (e.g. via the existing `Regenerate report` button on the diagnostic page when status is FAILED).
- Watch server logs. When `[Onboarding] Diagnostic complete for userId: ...` fires, confirm a follow-up `[BaselineResume]` log appears.
- After ~60s, `GET /api/profile/baseline-resume` returns `{ status: 'ready', documentId: ... }`.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/onboarding.ts
git commit -m "feat(onboarding): also trigger baseline resume generation on diagnostic retry"
```

---

## Task 9: Wizard chrome: baseline-resume download link with Generating / Download / Retry states

**Files:**
- Modify: `src/pages/SetupWizard.tsx`

- [ ] **Step 1: Add the download-state types and a hook to poll status**

Inside `src/pages/SetupWizard.tsx`, near the other top-level helpers (around line 56), add:

```ts
type BaselineResumeState =
  | { status: 'unknown' }
  | { status: 'generating' }
  | { status: 'ready'; documentId: string }
  | { status: 'error' };

async function fetchBaselineState(): Promise<BaselineResumeState> {
  try {
    const { data } = await api.get('/profile/baseline-resume');
    if (data?.status === 'ready' && data?.documentId) {
      return { status: 'ready', documentId: data.documentId };
    }
    if (data?.status === 'generating') return { status: 'generating' };
    if (data?.status === 'error') return { status: 'error' };
    return { status: 'unknown' };
  } catch {
    return { status: 'error' };
  }
}
```

- [ ] **Step 2: Wire the state into the `SetupWizard` component**

Inside `export function SetupWizard()` (near the other useState declarations, around line 829), add:

```tsx
  const [baselineState, setBaselineState] = useState<BaselineResumeState>({ status: 'unknown' });
  const [downloadingBaseline, setDownloadingBaseline] = useState(false);

  // Poll for the baseline resume becoming ready. The server kicks off
  // generation when the diagnostic completes; here we just check status
  // until it settles.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled) return;
      const next = await fetchBaselineState();
      if (cancelled) return;
      setBaselineState(next);
      if (next.status === 'generating' || next.status === 'unknown') {
        attempts += 1;
        if (attempts < 30) {
          // Cap at ~3 minutes of polling.
          setTimeout(tick, 6000);
        }
      }
    };
    tick();
    return () => { cancelled = true; };
  }, []);

  const handleDownloadBaseline = async () => {
    if (downloadingBaseline) return;
    if (baselineState.status === 'error' || baselineState.status === 'unknown') {
      // Retry: ask the server to (re)generate.
      setDownloadingBaseline(true);
      try {
        await api.post('/profile/baseline-resume/generate');
        setBaselineState({ status: 'generating' });
        // The polling effect will pick up the eventual ready state if the
        // component is still mounted. For an immediate UX cue, fire one more
        // status check after a short delay.
        setTimeout(async () => setBaselineState(await fetchBaselineState()), 4000);
      } catch (err) {
        console.error('[SetupWizard] retry baseline failed:', err);
        setBaselineState({ status: 'error' });
      } finally {
        setDownloadingBaseline(false);
      }
      return;
    }
    if (baselineState.status === 'ready') {
      setDownloadingBaseline(true);
      try {
        const { data: doc } = await api.get(`/documents/${baselineState.documentId}`);
        const { exportDocx } = await import('../lib/exportDocx');
        await exportDocx(doc.content, 'resume', '');
      } catch (err) {
        console.error('[SetupWizard] download baseline failed:', err);
      } finally {
        setDownloadingBaseline(false);
      }
    }
  };
```

- [ ] **Step 3: Render the link in the wizard chrome**

The wizard root is at line 1074: `<div style={{ height: '100vh', overflowY: 'auto', background: '#080b12', paddingBottom: 80 }}>`. Insert a fixed-position link in the top-right, just inside the root `<div>`:

```tsx
      {/* Baseline resume download link, fixed top-right */}
      <button
        onClick={handleDownloadBaseline}
        disabled={downloadingBaseline}
        style={{
          position: 'fixed', top: 16, right: 20, zIndex: 30,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 999, padding: '8px 14px',
          fontSize: 12, fontWeight: 600,
          color: baselineState.status === 'ready' ? '#a5b4fc' : '#9ca3af',
          cursor: downloadingBaseline ? 'wait' : 'pointer',
          letterSpacing: '0.01em',
          backdropFilter: 'blur(8px)',
        }}
      >
        {(() => {
          if (downloadingBaseline) return 'Downloading…';
          if (baselineState.status === 'generating') return 'Generating baseline resume…';
          if (baselineState.status === 'ready')      return 'Download my baseline resume';
          if (baselineState.status === 'error')      return 'Retry baseline resume';
          return 'Generating baseline resume…';
        })()}
      </button>
```

Place this just below the opening `<div>` and above the `<RewardOverlay />` block.

- [ ] **Step 4: Type-check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: Verify visually**

```bash
npm run dev
```

- Run a fresh end-to-end intake.
- On the wizard, top-right shows "Generating baseline resume…" initially.
- After ~30-90 seconds, the link flips to "Download my baseline resume".
- Click it: a `.docx` file downloads.
- If you simulate failure (temporarily hardcode `setBaselineState({ status: 'error' })`), the link reads "Retry baseline resume" and clicking it calls `/profile/baseline-resume/generate`.
- Revert any test-only hardcode before commit.

- [ ] **Step 6: Commit**

```bash
git add src/pages/SetupWizard.tsx
git commit -m "feat(wizard): baseline-resume download link in chrome with generating/ready/retry states"
```

---

## Task 10: Sticky bar: calm-ally restyle and copy update

**Files:**
- Modify: `src/components/ReportExperience.tsx:1224-1282` (the AnimatePresence + sticky bar block)

The current sticky bar uses a gradient `f97316 → ec4899 → 7c3aed` button that violates the calm-ally palette. Replace with a petrol-style button matching the new Section 5 CTA.

- [ ] **Step 1: Replace the sticky bar's primary button**

In `src/components/ReportExperience.tsx`, find the gradient button inside the sticky bar (around line 1257):

```tsx
              <button
                onClick={onDone}
                style={{
                  background: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)', color: 'white',
                  borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 800,
                  border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(236, 72, 153, 0.3)',
                  whiteSpace: 'nowrap', minHeight: 44,
                }}
              >
                Build your interview-ready resume, Free →
              </button>
```

Replace with:

```tsx
              <button
                onClick={onDone}
                style={{
                  background: '#2D5A6E', color: '#E0E0E0',
                  borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(45,90,110,0.30)',
                  whiteSpace: 'nowrap', minHeight: 44, letterSpacing: '-0.01em',
                }}
              >
                Start with your professional summary →
              </button>
```

- [ ] **Step 2: Verify visually**

```bash
npm run dev
```

- Open the diagnostic page.
- Scroll past the new Section 5 CTA so the sticky bar appears at the bottom.
- Confirm the sticky CTA is petrol-coloured (no gradient), copy reads "Start with your professional summary →", and click navigates to `/setup`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ReportExperience.tsx
git commit -m "style(diagnostic): sticky bar uses calm-ally petrol button + matching CTA copy"
```

---

## Task 11: Analytics: `section_5_cta_clicked` and `baseline_resume_downloaded_from_wizard`

**Files:**
- Modify: `src/lib/analytics.ts`
- Modify: `src/components/ReportExperience.tsx` (Section5Card onCta, sticky bar onClick)
- Modify: `src/pages/SetupWizard.tsx` (handleDownloadBaseline ready branch)

- [ ] **Step 1: Add the event helpers**

The file uses named exported functions that wrap `posthog.capture` (e.g. `trackDiagnosticReportViewed` at line 69). Match that pattern. In `src/lib/analytics.ts`, just below `trackDiagnosticReportViewed` (around line 71), add:

```ts
export function trackSection5CtaClicked() {
  posthog.capture('section_5_cta_clicked');
}

export function trackBaselineResumeDownloadedFromWizard() {
  posthog.capture('baseline_resume_downloaded_from_wizard');
}
```

The existing helpers do not guard against `posthog` being undefined (init runs at app start), so we follow that pattern.

- [ ] **Step 2: Wire `section_5_cta_clicked` into the new CTA and the sticky bar**

In `src/components/ReportExperience.tsx`:

- Import the helper at the top: `import { trackSection5CtaClicked } from '../lib/analytics';` (or inline posthog import per the file convention).
- In the `Section5Card` `onCta` prop wiring (Task 4 step 4), change:

```tsx
                    onCta={() => {
                      onDone();
                    }}
```

to:

```tsx
                    onCta={() => {
                      trackSection5CtaClicked();
                      onDone();
                    }}
```

- In the sticky bar's main button `onClick` (the one updated in Task 10), change `onClick={onDone}` to:

```tsx
                onClick={() => { trackSection5CtaClicked(); onDone(); }}
```

- [ ] **Step 3: Wire `baseline_resume_downloaded_from_wizard` into the wizard download**

In `src/pages/SetupWizard.tsx`, add the import and wire the event into the `ready` branch of `handleDownloadBaseline` (right before the `await exportDocx(...)` call):

```tsx
import { trackBaselineResumeDownloadedFromWizard } from '../lib/analytics';
```

Then in `handleDownloadBaseline`, just before `await exportDocx(...)`:

```tsx
        trackBaselineResumeDownloadedFromWizard();
        await exportDocx(doc.content, 'resume', '');
```

- [ ] **Step 4: Verify with the network tab**

```bash
npm run dev
```

- Open the diagnostic. Open DevTools Network tab, filter for "posthog" or "capture".
- Click the Section 5 CTA: confirm a `posthog/capture` request fires with event `section_5_cta_clicked`.
- On the wizard, wait for baseline ready, click Download: confirm a request fires with event `baseline_resume_downloaded_from_wizard`.

- [ ] **Step 5: Type-check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics.ts src/components/ReportExperience.tsx src/pages/SetupWizard.tsx
git commit -m "feat(analytics): section_5_cta_clicked + baseline_resume_downloaded_from_wizard events"
```

---

## Task 12: End-to-end smoke + final type-check + lint

- [ ] **Step 1: Type-check both client and server**

```bash
npm run build
cd server && npm run build && cd ..
```

Expected: no errors in either.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no new errors. (Pre-existing warnings unrelated to this work are out of scope.)

- [ ] **Step 3: Run server tests**

```bash
cd server && npm test
```

Expected: all tests pass, including the new `diagnosticReport.test.ts`.

- [ ] **Step 4: Manual end-to-end smoke**

```bash
# In one terminal:
cd server && npm run dev
# In another:
npm run dev
```

- Sign in with a fresh test account.
- Complete the intake. Watch the diagnostic generate.
- Confirm the report shows:
  - User-voice question heading above each of the five cards
  - Section 5 with personalised "Hey {firstName}", three sub-cards with situation/jobhub/outcome paragraphs, petrol CTA "Start with your professional summary →", caveat text, feedback widget below the CTA
  - No second feedback widget at the bottom
  - No referral block, no second CTA, no bottom dashboard-skip link
  - Header chrome top-right: "Go to the dashboard →" link + theme toggle
  - Sticky bar (when scrolled past CTA): petrol button, "Start with your professional summary →"
- Click the CTA. Lands directly on the wizard step 1 (Professional Summary). No ProfileBank welcome modal anywhere.
- Wizard chrome top-right: "Generating baseline resume…" → "Download my baseline resume" within ~60-90s.
- Click download: `.docx` downloads.
- DevTools Network: confirm both PostHog events fire.
- Repeat in dark + light theme.
- Repeat at 375px width: layout holds.

- [ ] **Step 5: No-op commit if nothing changed**

If smoke testing surfaced bugs, fix them with focused additional commits. If everything passes, this task ends without a commit.

---

## Self-review notes

- **Spec coverage check:** Q&A wrapper (Task 3), Section 5 layout + LLM emission + parser (Tasks 1, 2, 4), removals (Task 5), dashboard-skip relocation (Task 6), CTA → /setup (Task 7), server-side baseline trigger (Task 8), wizard chrome download (Task 9), sticky bar restyle (Task 10), analytics (Task 11). Open question on wizard route is resolved inline (use existing `/setup`). Validator pass deferred per spec out-of-scope. Wizard combine deferred per latest user direction.
- **Em dash check:** none in the plan body or in any code or copy block.
- **Type consistency:** `Move`, `FixMoves`, `BaselineResumeState` defined once and used consistently across tasks.
- **Voice rules in code/copy:** "Start with your professional summary →" used identically in Section 5 CTA and sticky bar. "First five tailored applications free. No card needed." reused.

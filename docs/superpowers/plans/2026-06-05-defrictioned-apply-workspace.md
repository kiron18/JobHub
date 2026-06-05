# De-frictioned Apply Workspace (Slice C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` (or `superpowers:subagent-driven-development`). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn `/apply` into a zero-work experience: on entry, analysis runs, a quick modal double-checks 2–3 strengths, then resume + cover letter generate **in parallel** and reveal **pristine** — no analysis screen, no "Generate" button, no `[VERIFY]` placeholder tokens.

**Architecture:** Frontend orchestration lives in `StepperWorkspace.tsx` (entry-driven analyze → gap-confirm modal → parallel generation, writing each draft to the existing localStorage slots). A new `GapConfirmModal` collects confirmed strengths. The two server prompts are rewritten to forbid bracketed placeholders (omit/soften, never fabricate). No new endpoints, no schema changes.

**Tech Stack:** React/Vite/TypeScript/framer-motion (frontend, strict mode + `noUnusedLocals`), Express/TypeScript + Vitest (backend), reuses `/analyze/dual` + `/generate/*` routes.

**Spec:** `docs/superpowers/specs/2026-06-05-defrictioned-apply-workspace-design.md`

---

## ⚠️ INSTRUCTIONS FOR THE EXECUTOR — READ BEFORE STARTING

Zero-latitude plan. You are a careful executor.

1. **You do NOT write or alter any user-facing copy.** Every user-facing string already lives in `src/pages/applyWorkspaceCopy.ts` (pre-authored, committed). Import and render verbatim. The new **prompt text** in Tasks 1–2 is also fixed — paste it exactly.
2. **Copy every code block verbatim.** Do not rename, refactor, restyle, add features, or change design tokens.
3. **Do tasks in order.** Each ends with a passing build/test + a commit. Don't start the next until the current is committed green.
4. **STOP-and-report (do not improvise) if:** a test fails unexpectedly, a command errors, a "Modify" step's `old_string` does not match the file exactly, an import path doesn't resolve, or a type error appears you can't fix by following the step literally. Report and wait.
5. Backend commands run from `server/`. Frontend type-check runs from repo root: `npx tsc -p tsconfig.app.json --noEmit`.
6. **Task 4 is delicate** (large strict-compile refactor of a 1692-line file). After Task 4 completes, **STOP and report the full `git diff` of `StepperWorkspace.tsx` for review before continuing.**

Repo root: `E:\AntiGravity\JobHub`. Backend package: `server/`. Frontend is the root Vite app.

---

## File Structure

**Pre-authored (DO NOT EDIT):** `src/pages/applyWorkspaceCopy.ts`

**New:**
- `src/components/GapConfirmModal.tsx`
- `server/src/services/prompts/resumeStructuredPrompt.test.ts`
- `server/src/services/prompts/coverLetterSlotsPrompt.test.ts`

**Modified:**
- `server/src/services/prompts/resumeStructuredPrompt.ts` — no-placeholder rule.
- `server/src/services/prompts/coverLetterSlotsPrompt.ts` — no-placeholder rule.
- `src/pages/StepperWorkspace.tsx` — entry orchestration, parallel gen, remove Generate button + VERIFY UI, extend `sanitizeContent`.

---

## Task 1: Resume prompt — forbid placeholders (TDD)

**Files:**
- Create: `server/src/services/prompts/resumeStructuredPrompt.test.ts`
- Modify: `server/src/services/prompts/resumeStructuredPrompt.ts`

- [ ] **Step 1: Write the failing test** — create `server/src/services/prompts/resumeStructuredPrompt.test.ts` with EXACTLY this content:

```ts
import { describe, it, expect } from 'vitest';
import { RESUME_STRUCTURED_PROMPT } from './resumeStructuredPrompt';

const blueprint = {
  positioningStatement: 'Seasoned operator.',
  messagingAngles: [] as string[],
  pitfallFlags: [] as string[],
  proofPoints: [] as Array<{ achievementId: string }>,
  sector: 'TECH_STARTUP',
  toneBlueprint: 'Professional, direct Australian English.',
  structureNotes: 'Standard.',
  employerInsight: 'MISSING',
} as any;

const profile = { name: 'Jane Doe', email: 'jane@example.com', experience: [], education: [] } as any;

describe('RESUME_STRUCTURED_PROMPT', () => {
  it('does not instruct the model to emit [VERIFY] tokens', () => {
    const out = RESUME_STRUCTURED_PROMPT('Some JD text', profile, [], blueprint);
    expect(out).not.toContain('[VERIFY');
  });

  it('carries the no-placeholder rule', () => {
    const out = RESUME_STRUCTURED_PROMPT('Some JD text', profile, [], blueprint);
    expect(out).toContain('NEVER emit a bracketed placeholder');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `server/`): `npx vitest run src/services/prompts/resumeStructuredPrompt.test.ts`
Expected: FAIL — the first test fails because the current prompt contains `[VERIFY: ...]`.

- [ ] **Step 3: Implement** — in `server/src/services/prompts/resumeStructuredPrompt.ts`, replace this exact line (in the CONSTRAINTS block):

```
- Only use a [VERIFY: ...] token when a needed fact is genuinely absent from CANDIDATE DATA. If a value already exists (e.g. an achievement metric like "150+ assets"), use it verbatim — never replace a known value with a placeholder.
```

with:

```
- NEVER emit a bracketed placeholder of any kind — not [VERIFY: ...], [ADD: ...], [INSERT: ...], [TBD], [PLACEHOLDER], or anything similar. The finished resume must read as complete, signable work with no gaps for the candidate to fill in. When a specific detail (a metric, a date, a certification) is genuinely absent from CANDIDATE DATA, either omit it or rephrase the sentence around it so it stays true and complete — e.g. "grew the audience substantially" rather than "grew the audience by [X]%". NEVER fabricate a number, metric, credential, or fact to fill a gap. If a value already exists in CANDIDATE DATA (e.g. an achievement metric like "150+ assets"), use it verbatim.
```

- [ ] **Step 4: Run to verify all pass**

Run (from `server/`): `npx vitest run src/services/prompts/resumeStructuredPrompt.test.ts`
Expected: PASS (both tests green).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/prompts/resumeStructuredPrompt.ts server/src/services/prompts/resumeStructuredPrompt.test.ts
git commit -m "feat(apply): resume prompt forbids placeholder tokens (omit/soften, never fabricate)"
```

---

## Task 2: Cover-letter prompt — forbid placeholders (TDD)

**Files:**
- Create: `server/src/services/prompts/coverLetterSlotsPrompt.test.ts`
- Modify: `server/src/services/prompts/coverLetterSlotsPrompt.ts`

- [ ] **Step 1: Write the failing test** — create `server/src/services/prompts/coverLetterSlotsPrompt.test.ts` with EXACTLY this content:

```ts
import { describe, it, expect } from 'vitest';
import { COVER_LETTER_SLOTS_PROMPT } from './coverLetterSlotsPrompt';

const blueprint = {
  positioningStatement: 'Seasoned operator.',
  messagingAngles: [] as string[],
  pitfallFlags: [] as string[],
  proofPoints: [] as Array<{ achievementId: string }>,
  sector: 'TECH_STARTUP',
  toneBlueprint: 'Professional, direct Australian English.',
  structureNotes: 'Standard.',
  employerInsight: 'MISSING',
} as any;

const profile = { name: 'Jane Doe', email: 'jane@example.com', experience: [], education: [] } as any;

describe('COVER_LETTER_SLOTS_PROMPT', () => {
  it('does not instruct the model to emit [VERIFY] tokens', () => {
    const out = COVER_LETTER_SLOTS_PROMPT('Some JD text', profile, [], blueprint);
    expect(out).not.toContain('[VERIFY');
  });

  it('carries the no-placeholder rule', () => {
    const out = COVER_LETTER_SLOTS_PROMPT('Some JD text', profile, [], blueprint);
    expect(out).toContain('NEVER emit a bracketed placeholder');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `server/`): `npx vitest run src/services/prompts/coverLetterSlotsPrompt.test.ts`
Expected: FAIL — first test fails (current prompt contains `[VERIFY: ...]`).

- [ ] **Step 3: Implement** — in `server/src/services/prompts/coverLetterSlotsPrompt.ts`, replace this exact line (in the CONSTRAINTS block):

```
- Only use a [VERIFY: ...] token when a needed fact is genuinely absent from CANDIDATE DATA. If a value already exists in the data (e.g. an achievement metric), use it — never replace a known value with a placeholder.
```

with:

```
- NEVER emit a bracketed placeholder of any kind — not [VERIFY: ...], [ADD: ...], [INSERT: ...], [TBD], [PLACEHOLDER], or anything similar. The finished letter must read as complete, signable work with no gaps for the candidate to fill in. When a specific detail is genuinely absent from CANDIDATE DATA, either omit it or rephrase the sentence around it so it stays true and complete. NEVER fabricate a number, metric, credential, or fact to fill a gap. If a value already exists in the data (e.g. an achievement metric), use it verbatim.
```

- [ ] **Step 4: Run to verify all pass**

Run (from `server/`): `npx vitest run src/services/prompts/coverLetterSlotsPrompt.test.ts`
Expected: PASS (both tests green).

- [ ] **Step 5: Confirm the existing generation test still passes**

Run (from `server/`): `npx vitest run src/tests/bridgedGapsGeneration.test.ts`
Expected: PASS (the CONFIRMED CAPABILITIES block was not touched). If it FAILS, STOP and report.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/prompts/coverLetterSlotsPrompt.ts server/src/services/prompts/coverLetterSlotsPrompt.test.ts
git commit -m "feat(apply): cover-letter prompt forbids placeholder tokens (omit/soften, never fabricate)"
```

---

## Task 3: GapConfirmModal component (new file)

**Files:**
- Create: `src/components/GapConfirmModal.tsx`

- [ ] **Step 1: Create `src/components/GapConfirmModal.tsx`** with EXACTLY this content:

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { warm } from '../lib/theme/warmTokens';
import type { BridgedGap } from '../lib/bridgedGaps';
import { applyWorkspaceCopy as C } from '../pages/applyWorkspaceCopy';

interface Props {
  gaps: BridgedGap[];
  onConfirm: (confirmed: BridgedGap[]) => void;
}

/**
 * GapConfirmModal — opens over the apply workspace the instant analysis
 * finishes, before generation. Up to 3 strengths, pre-checked, one-line
 * editable. The user confirms in a single tap; unticked rows are dropped.
 * Copy is sourced verbatim from applyWorkspaceCopy.ts.
 */
export function GapConfirmModal({ gaps, onConfirm }: Props) {
  const [checked, setChecked] = useState<boolean[]>(() => gaps.map(() => true));
  const [statements, setStatements] = useState<string[]>(() => gaps.map(g => g.statement));

  const toggle = (i: number) =>
    setChecked(prev => prev.map((v, idx) => (idx === i ? !v : v)));

  const edit = (i: number, value: string) =>
    setStatements(prev => prev.map((s, idx) => (idx === i ? value : s)));

  const handleConfirm = () => {
    const confirmed: BridgedGap[] = gaps
      .map((g, i) => ({ skill: g.skill, statement: statements[i].trim() }))
      .filter((g, i) => checked[i] && g.statement.length > 0);
    onConfirm(confirmed);
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(26,24,20,0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          style={{
            width: '100%',
            maxWidth: 460,
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 18,
            padding: 26,
            boxShadow: '0 24px 60px rgba(26,24,20,0.28)',
          }}
        >
          <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: warm.colors.textPrimary, letterSpacing: '-0.01em' }}>
            {C.gapModal.header}
          </h3>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: warm.colors.textMuted, lineHeight: 1.5 }}>
            {C.gapModal.sub}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {gaps.map((g, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '12px 14px',
                  background: checked[i] ? 'rgba(125,166,125,0.10)' : warm.colors.bgAlt,
                  border: `1px solid ${checked[i] ? 'rgba(45,90,110,0.30)' : warm.colors.borderWhisper}`,
                  borderRadius: 12,
                  opacity: checked[i] ? 1 : 0.6,
                  transition: 'background 0.2s, border-color 0.2s, opacity 0.2s',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggle(i)}
                  aria-label={g.skill}
                  style={{ accentColor: warm.colors.accentPetrol, cursor: 'pointer', width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: warm.colors.textPrimary }}>
                    {g.skill}
                  </p>
                  <input
                    value={statements[i]}
                    onChange={e => edit(i, e.target.value)}
                    disabled={!checked[i]}
                    title={C.gapModal.editHint}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: 13,
                      color: warm.colors.textSecondary,
                      fontStyle: 'italic',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleConfirm}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '13px 0',
              fontSize: 14,
              fontWeight: 700,
              color: warm.colors.textOnDeep,
              background: warm.colors.accentPetrol,
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              boxShadow: warm.shadow.soft,
            }}
          >
            <Check size={15} />
            {C.gapModal.cta}
            <ArrowRight size={15} />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
```

- [ ] **Step 2: Type-check the frontend**

Run (from repo root): `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors referencing `GapConfirmModal.tsx`. (`warm.shadow.soft`, `warm.colors.*`, `BridgedGap`, and the `applyWorkspaceCopy` keys all exist — confirm imports resolve. If `warm.shadow.soft` does not exist, STOP and report the available `warm.shadow` keys.)

- [ ] **Step 3: Commit**

```bash
git add src/components/GapConfirmModal.tsx
git commit -m "feat(apply): GapConfirmModal — pre-checked strengths, one-tap confirm"
```

---

## Task 4: StepperWorkspace — entry orchestration + remove Generate/VERIFY ⚠️ DELICATE

**Files:**
- Modify: `src/pages/StepperWorkspace.tsx`

> This file is 1692 lines and compiles under `strict` + `noUnusedLocals`. Apply each step exactly. After the LAST step, STOP and report the full `git diff` of this file before committing.

### 4.1 — Imports

- [ ] **Step 1:** In the named lucide-react import block near the top (the one containing `ArrowLeft`, `ArrowRight`, `Check`, …), the icons `ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, Copy, Download, FileText, Loader2, Mail, PenLine, RefreshCw, ListChecks, Briefcase, Building2, ShieldCheck` are already imported and remain in use. **Do not change this block.**

- [ ] **Step 2:** Immediately after the line `import { CoverLetterPersonalisationPanel } from '../components/CoverLetterPersonalisationPanel';` add these three imports:

```tsx
import { GapConfirmModal } from '../components/GapConfirmModal';
import { applyWorkspaceCopy } from './applyWorkspaceCopy';
import { capabilityStatement, type BridgedGap } from '../lib/bridgedGaps';
```

### 4.2 — Extend `sanitizeContent`

- [ ] **Step 3:** Replace this exact function:

```tsx
/** Strip common AI-generation artifacts before rendering or storage. */
function sanitizeContent(raw: string): string {
    return raw
        // "NFP?" hallucination — the LLM sometimes leaks the sector abbreviation
        // before contact lines (e.g. "NFP?\n📞 +61...").
        .replace(/^NFP\?\s*/gm, '')
        .replace(/\bNFP\?\s*/g, '')
        .trim();
}
```

with:

```tsx
/** Strip common AI-generation artifacts before rendering or storage. */
function sanitizeContent(raw: string): string {
    return raw
        // "NFP?" hallucination — the LLM sometimes leaks the sector abbreviation
        // before contact lines (e.g. "NFP?\n📞 +61...").
        .replace(/^NFP\?\s*/gm, '')
        .replace(/\bNFP\?\s*/g, '')
        // Strip any stray bracketed placeholder the generator should no longer
        // emit (belt-and-suspenders so nothing bracketed can ever render).
        .replace(/\s*\[(?:VERIFY|ADD|INSERT|TBD|PLACEHOLDER)\b[^\]]*\]/gi, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}
```

### 4.3 — Remove the VERIFY marker UI (required: it would be dead code and fail `noUnusedLocals`)

- [ ] **Step 4:** Delete the entire contiguous block that starts with this line:

```tsx
const VERIFY_MARKER_RE = /\[(?:VERIFY|Verify|verify|ADD|Add|INSERT|Insert|TBD|PLACEHOLDER)(?:[:\s]\s*([^\]]*))?\]/g;
```

and ends with the closing brace of the `processMarkers` function — i.e. through and including:

```tsx
function processMarkers(children: React.ReactNode): React.ReactNode {
    return React.Children.map(children, (child) => {
        if (typeof child === 'string') return replaceVerifyMarkersInString(child);
        return child;
    });
}
```

Also delete the explanatory comment block immediately above `VERIFY_MARKER_RE` (the lines beginning `// ── Placeholder marker rendering` down to the line ending `// exporters must strip ... `, i.e. every comment line directly preceding `const VERIFY_MARKER_RE`).

This removes: `VERIFY_MARKER_RE`, `VERIFY_TOKEN_RE`, `VerifyMarker`, `replaceVerifyMarkersInString`, `processMarkers`. Keep `const HEADING_COLOR` and everything from there down.

**STOP-and-report** if the start or end anchor text above is not found verbatim.

- [ ] **Step 5:** Replace this exact block:

```tsx
const MARKDOWN_COMPONENTS = {
    p: ({ children }: { children?: React.ReactNode }) => <p>{processMarkers(children)}</p>,
    li: ({ children }: { children?: React.ReactNode }) => <li>{processMarkers(children)}</li>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong style={STRONG_COLOR}>{processMarkers(children)}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em>{processMarkers(children)}</em>,
    td: ({ children }: { children?: React.ReactNode }) => <td>{processMarkers(children)}</td>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 style={HEADING_COLOR}>{processMarkers(children)}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 style={HEADING_COLOR}>{processMarkers(children)}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 style={HEADING_COLOR}>{processMarkers(children)}</h3>,
    h4: ({ children }: { children?: React.ReactNode }) => <h4 style={HEADING_COLOR}>{processMarkers(children)}</h4>,
};
```

with:

```tsx
const MARKDOWN_COMPONENTS = {
    strong: ({ children }: { children?: React.ReactNode }) => <strong style={STRONG_COLOR}>{children}</strong>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 style={HEADING_COLOR}>{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 style={HEADING_COLOR}>{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 style={HEADING_COLOR}>{children}</h3>,
    h4: ({ children }: { children?: React.ReactNode }) => <h4 style={HEADING_COLOR}>{children}</h4>,
};
```

### 4.4 — Workspace-level orchestration state + effects

- [ ] **Step 6:** In the `StepperWorkspace` function, find this exact block:

```tsx
    const [currentIndex, setCurrentIndex] = useState(0);
    const [jdExpanded, setJdExpanded] = useState(false);
    const [companyIntel, setCompanyIntel] = useState<CompanyIntel | null>(null);
```

Replace it with:

```tsx
    const [currentIndex, setCurrentIndex] = useState(0);
    const [jdExpanded, setJdExpanded] = useState(false);
    const [companyIntel, setCompanyIntel] = useState<CompanyIntel | null>(null);

    // ── De-frictioned generation orchestration ───────────────────────────────
    // Live path: on entry we derive bridgeable gaps from /analyze/dual (the
    // perceived "already working"), confirm 2–3 strengths in a modal, then
    // generate resume + cover letter in parallel. Legacy path (gaps passed in
    // from the old analysis screen) skips straight to generation.
    const legacyGaps = state.bridgedGaps;
    const [gaps, setGaps] = useState<BridgedGap[]>(legacyGaps ?? []);
    const [gapPhase, setGapPhase] = useState<'deriving' | 'confirming' | 'ready'>(
        legacyGaps !== undefined ? 'ready' : 'deriving',
    );
    const [intelSettled, setIntelSettled] = useState(false);
    const [genStatus, setGenStatus] = useState<Record<'resume' | 'cover-letter', 'idle' | 'generating' | 'done' | 'error'>>({
        resume: 'idle',
        'cover-letter': 'idle',
    });
```

- [ ] **Step 7:** Find the company-intel prewarm effect:

```tsx
    // Pre-warm Perplexity company intel in the background on entry, so it's ready
    // by the cover-letter step (runs while the user works on the resume). Fully
    // non-fatal — the letter still generates without it.
    useEffect(() => {
        const company = state.company?.trim();
        if (jdEmpty || !company || company === 'Unknown Company') return;
        let cancelled = false;
        api.post('/research/company-intel', { company, title: state.role ?? '', jobDescription })
            .then(({ data }) => { if (!cancelled) setCompanyIntel(data); })
            .catch((err) => { console.warn('[company-intel] prewarm failed (non-fatal):', err?.response?.status, err?.message); });
        return () => { cancelled = true; };
    }, [state.company, state.role, jobDescription, jdEmpty]);
```

Replace it with (adds `intelSettled` so cover-letter generation waits for intel, then proceeds regardless):

```tsx
    // Pre-warm Perplexity company intel in the background on entry, so it's woven
    // into the cover letter. `intelSettled` flips true once intel resolves, errors,
    // or there's no company to fetch — cover-letter generation waits on it. Fully
    // non-fatal — the letter still generates without intel.
    useEffect(() => {
        const company = state.company?.trim();
        if (jdEmpty) return;
        if (!company || company === 'Unknown Company') { setIntelSettled(true); return; }
        let cancelled = false;
        api.post('/research/company-intel', { company, title: state.role ?? '', jobDescription })
            .then(({ data }) => { if (!cancelled) setCompanyIntel(data); })
            .catch((err) => { console.warn('[company-intel] prewarm failed (non-fatal):', err?.response?.status, err?.message); })
            .finally(() => { if (!cancelled) setIntelSettled(true); });
        return () => { cancelled = true; };
    }, [state.company, state.role, jobDescription, jdEmpty]);

    // Derive bridgeable gaps on entry (live path only). This is the instant-on
    // "already working" — generation waits until the user confirms.
    useEffect(() => {
        if (jdEmpty || legacyGaps !== undefined) return;
        let cancelled = false;
        setGapPhase('deriving');
        api.post('/analyze/dual', { jobDescription })
            .then(({ data }) => {
                if (cancelled) return;
                const items: Array<{ skill?: string; suggestion?: string }> = data?.fitBands?.bridgeableGap?.items ?? [];
                const derived: BridgedGap[] = items
                    .slice(0, 3)
                    .map((it) => ({ skill: (it?.skill ?? '').trim(), statement: capabilityStatement(it?.suggestion ?? '') }))
                    .filter((g) => g.skill.length > 0 && g.statement.length > 0);
                if (derived.length > 0) { setGaps(derived); setGapPhase('confirming'); }
                else { setGaps([]); setGapPhase('ready'); }
            })
            .catch(() => { if (!cancelled) { setGaps([]); setGapPhase('ready'); } });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobDescription, jdEmpty]);

    // Once gaps are confirmed (or skipped), generate resume + cover letter in
    // parallel, writing each draft to localStorage as it lands. Never regenerates
    // a step that already has a draft (Back-never-regenerates / revisit).
    useEffect(() => {
        if (gapPhase !== 'ready' || jdEmpty) return;

        const kickOff = (step: 'resume' | 'cover-letter') => {
            if (loadDraft(workspaceKey, step) || genStatus[step] !== 'idle') return;
            setGenStatus((s) => ({ ...s, [step]: 'generating' }));
            const payload: Record<string, unknown> = { jobDescription };
            let endpoint: string;
            if (step === 'resume') {
                endpoint = '/generate/resume-structured';
                payload.bridgedGaps = gaps;
            } else {
                endpoint = '/generate/cover-letter-structured';
                payload.analysisContext = { tone: 'Professional, polished, direct.', company: state.company ?? '', title: state.role ?? '' };
                payload.companyIntel = companyIntel ?? null;
                payload.bridgedGaps = gaps;
            }
            api.post<{ content: string }>(endpoint, payload)
                .then(({ data }) => {
                    const text = typeof data?.content === 'string' ? sanitizeContent(data.content) : '';
                    saveDraft(workspaceKey, step, { content: text, generatedAt: new Date().toISOString(), edited: false });
                    setGenStatus((s) => ({ ...s, [step]: 'done' }));
                })
                .catch(() => { setGenStatus((s) => ({ ...s, [step]: 'error' })); });
        };

        kickOff('resume');
        if (intelSettled) kickOff('cover-letter');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gapPhase, intelSettled, jdEmpty, workspaceKey]);
```

### 4.5 — Render the modal + pass props to `DocumentStep`

- [ ] **Step 8:** Find this exact block (the `DocumentStep` render branch):

```tsx
                ) : (
                    <DocumentStep
                        key={currentStep.id}
                        stepId={currentStep.id as GenerateType}
                        workspaceKey={workspaceKey}
                        jobDescription={jobDescription}
                        company={state.company}
                        role={state.role}
                        companyIntel={companyIntel}
                        bridgedGaps={state.bridgedGaps ?? []}
                        onBack={currentIndex > 0 ? () => setCurrentIndex(currentIndex - 1) : null}
                        onContinue={() => setCurrentIndex(currentIndex + 1)}
                        isLast={currentIndex === steps.length - 1}
                    />
                )}
```

Replace it with:

```tsx
                ) : (
                    <DocumentStep
                        key={currentStep.id}
                        stepId={currentStep.id as GenerateType}
                        workspaceKey={workspaceKey}
                        jobDescription={jobDescription}
                        company={state.company}
                        role={state.role}
                        companyIntel={companyIntel}
                        bridgedGaps={gaps}
                        generationStatus={
                            currentStep.id === 'resume' || currentStep.id === 'cover-letter'
                                ? genStatus[currentStep.id]
                                : 'idle'
                        }
                        onBack={currentIndex > 0 ? () => setCurrentIndex(currentIndex - 1) : null}
                        onContinue={() => setCurrentIndex(currentIndex + 1)}
                        isLast={currentIndex === steps.length - 1}
                    />
                )}
            </div>

            {gapPhase === 'confirming' && (
                <GapConfirmModal
                    gaps={gaps}
                    onConfirm={(confirmed) => { setGaps(confirmed); setGapPhase('ready'); }}
                />
            )}
```

> NOTE: this adds a `</div>` + modal AFTER the main column div. The existing block already ended the main column `</div>` — so you are MOVING the modal inside the page root. Confirm the JSX still balances: the outer return is `<div style={{ display: 'flex', ... }}>` (the page root). The modal must sit before that root's closing `</div>`. If after this edit the closing tags don't balance, STOP and report the surrounding JSX.

### 4.6 — `DocumentStep`: accept `generationStatus`, drive the assembling state, drop the Generate button + VERIFY gate

- [ ] **Step 9:** Find the `DocumentStep` parameter list + its TypeScript prop type. Replace this exact block:

```tsx
function DocumentStep({
    stepId,
    workspaceKey,
    jobDescription,
    company,
    role,
    companyIntel,
    bridgedGaps,
    onBack,
    onContinue,
    isLast,
}: {
    stepId: GenerateType;
    workspaceKey: string;
    jobDescription: string;
    company?: string;
    role?: string;
    companyIntel?: CompanyIntel | null;
    bridgedGaps?: import('../lib/bridgedGaps').BridgedGap[];
    onBack: (() => void) | null;
    onContinue: () => void;
    isLast: boolean;
}) {
```

with:

```tsx
function DocumentStep({
    stepId,
    workspaceKey,
    jobDescription,
    company,
    role,
    companyIntel,
    bridgedGaps,
    generationStatus,
    onBack,
    onContinue,
    isLast,
}: {
    stepId: GenerateType;
    workspaceKey: string;
    jobDescription: string;
    company?: string;
    role?: string;
    companyIntel?: CompanyIntel | null;
    bridgedGaps?: import('../lib/bridgedGaps').BridgedGap[];
    generationStatus: 'idle' | 'generating' | 'done' | 'error';
    onBack: (() => void) | null;
    onContinue: () => void;
    isLast: boolean;
}) {
```

- [ ] **Step 10:** The draft-load effect must re-read localStorage when the parent finishes generating. Find this exact block:

```tsx
        setEditing(false);
        if (isSC) {
            try {
                const stored = localStorage.getItem(criteriaStorageKey) ?? '';
                setCriteriaText(stored);
                // Open the panel automatically if no criteria yet AND no draft.
                setCriteriaPanelOpen(stored.trim().length === 0 && !draft);
            } catch { /* noop */ }
        }
    }, [workspaceKey, stepId, isSC, criteriaStorageKey]);
```

Replace it with (adds `generationStatus` to the dependency array):

```tsx
        setEditing(false);
        if (isSC) {
            try {
                const stored = localStorage.getItem(criteriaStorageKey) ?? '';
                setCriteriaText(stored);
                // Open the panel automatically if no criteria yet AND no draft.
                setCriteriaPanelOpen(stored.trim().length === 0 && !draft);
            } catch { /* noop */ }
        }
    }, [workspaceKey, stepId, isSC, criteriaStorageKey, generationStatus]);
```

- [ ] **Step 11:** Replace the VERIFY continue-gate. Find this exact function:

```tsx
    const handleContinueWithVerifyCheck = () => {
        // Flush any pending inline edit FIRST — the big "Save & continue" button
        // must honour its label even when the user never clicked "Done".
        const effective = commitEdit();
        setEditing(false);
        if (VERIFY_TOKEN_RE.test(effective)) {
            const ok = confirm(
                'This draft still contains [VERIFY: ...] notes — spots where the AI flagged details for you to confirm or fill in before sending. Continue anyway?'
            );
            if (!ok) return;
        }
        onContinue();
    };
```

with:

```tsx
    const handleContinue = () => {
        // Flush any pending inline edit FIRST — the "Save & continue" button must
        // honour its label even when the user never clicked "Done".
        commitEdit();
        setEditing(false);
        onContinue();
    };
```

- [ ] **Step 12:** Remove the now-unused `hasVerifyTokens` memo (it would fail `noUnusedLocals`). Find and delete this exact block:

```tsx
    // Placeholder tokens — inserted by the generator wherever the AI lacks
    // confidence (job title gaps, fabricated metrics, etc.) and needs human
    // review. The regex catches the full set of variants the generator emits
    // across resume / cover letter / SC: VERIFY/Verify/verify, ADD/Add,
    // INSERT/Insert, TBD, PLACEHOLDER. Resume drafts use these interchangeably,
    // which is why the previous narrow `[VERIFY:` check missed them.
    // We warn on continue rather than block — calm-ally, not gatekeeper.
    const hasVerifyTokens = useMemo(() => VERIFY_TOKEN_RE.test(content), [content]);
```

- [ ] **Step 13:** The "assembling" state. Find this exact block (the body renderer):

```tsx
                {generating ? (
                    <GenerationProgress docType={stepId === 'cover-letter' ? 'cover-letter' : stepId === 'selection-criteria' ? 'selection-criteria' : 'resume'} />
                ) : editing ? (
```

Replace it with (also show progress while the parent is generating this step and no draft has landed yet):

```tsx
                {generating || (generationStatus === 'generating' && !content) ? (
                    <GenerationProgress docType={stepId === 'cover-letter' ? 'cover-letter' : stepId === 'selection-criteria' ? 'selection-criteria' : 'resume'} />
                ) : editing ? (
```

- [ ] **Step 14:** The empty-state copy must no longer say "Click Generate" for resume/cover (those auto-generate). Find this exact block:

```tsx
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '40px 0', color: warm.colors.textMuted, textAlign: 'center' }}>
                        <PenLine size={28} />
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, maxWidth: 380 }}>
                            {isSC
                                ? 'Paste the selection criteria above, then Generate. We will write a STAR response per criterion, drawing on your achievement bank.'
                                : 'Click Generate to draft this from your profile and the job description.'}
                        </p>
                    </div>
                )}
```

Replace it with:

```tsx
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '40px 0', color: warm.colors.textMuted, textAlign: 'center' }}>
                        <PenLine size={28} />
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, maxWidth: 380 }}>
                            {isSC
                                ? 'Paste the selection criteria above, then Generate. We will write a STAR response per criterion, drawing on your achievement bank.'
                                : generationStatus === 'error'
                                    ? 'That draft didn’t come through. Use Regenerate to try again.'
                                    : 'Preparing this document…'}
                        </p>
                    </div>
                )}
```

- [ ] **Step 15:** Add the review-framing line for resume/cover, and remove the Generate button for non-SC. Find this exact block:

```tsx
            {/* Cover letter educational note */}
            {stepId === 'cover-letter' && (
                <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.6, fontStyle: 'italic' }}>
                    {coverLetterNote}
                </p>
            )}
```

Replace it with:

```tsx
            {/* Review framing — the documents are already done; read & trim. */}
            {hasDraft && !generating && generationStatus !== 'generating' && (stepId === 'resume' || stepId === 'cover-letter') && (
                <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                    {stepId === 'resume' ? applyWorkspaceCopy.reviewFraming.resume : applyWorkspaceCopy.reviewFraming.coverLetter}
                </p>
            )}

            {/* Cover letter educational note */}
            {stepId === 'cover-letter' && (
                <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.6, fontStyle: 'italic' }}>
                    {coverLetterNote}
                </p>
            )}
```

- [ ] **Step 16:** Replace the CTA cluster so the primary Generate button only renders for Selection Criteria, and Continue uses the new handler. Find this exact block:

```tsx
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {hasDraft && (
                        <button
                            onClick={() => generate(true)}
                            disabled={generating}
                            style={ghostButtonStyle(generating)}
                            title="Regenerate this document"
                        >
                            <RefreshCw size={13} />
                            Regenerate
                        </button>
                    )}
                    {!hasDraft && (
                        <button
                            onClick={() => generate(false)}
                            disabled={generating || (isSC && !hasCriteria)}
                            style={primaryButtonStyle(generating || (isSC && !hasCriteria))}
                            title={isSC && !hasCriteria ? 'Paste the selection criteria first' : undefined}
                        >
                            {generating ? (<><Loader2 size={14} className="animate-spin" /> Generating…</>) : (<>Generate<ArrowRight size={14} /></>)}
                        </button>
                    )}
                    {hasDraft && (
                        <button
                            onClick={handleContinueWithVerifyCheck}
                            disabled={generating}
                            style={primaryButtonStyle(generating)}
                            title={hasVerifyTokens ? 'This draft has unverified placeholders' : undefined}
                        >
                            {isLast ? 'Finish' : 'Save & continue'}
                            <ArrowRight size={14} />
                        </button>
                    )}
                </div>
```

Replace it with:

```tsx
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {hasDraft && (
                        <button
                            onClick={() => generate(true)}
                            disabled={generating}
                            style={ghostButtonStyle(generating)}
                            title="Regenerate this document"
                        >
                            <RefreshCw size={13} />
                            Regenerate
                        </button>
                    )}
                    {!hasDraft && isSC && (
                        <button
                            onClick={() => generate(false)}
                            disabled={generating || !hasCriteria}
                            style={primaryButtonStyle(generating || !hasCriteria)}
                            title={!hasCriteria ? 'Paste the selection criteria first' : undefined}
                        >
                            {generating ? (<><Loader2 size={14} className="animate-spin" /> Generating…</>) : (<>Generate<ArrowRight size={14} /></>)}
                        </button>
                    )}
                    {hasDraft && (
                        <button
                            onClick={handleContinue}
                            disabled={generating}
                            style={primaryButtonStyle(generating)}
                        >
                            {isLast ? 'Finish' : 'Save & continue'}
                            <ArrowRight size={14} />
                        </button>
                    )}
                </div>
```

### 4.7 — Verify + report

- [ ] **Step 17:** Type-check the frontend.

Run (from repo root): `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors. Common causes if it fails: a leftover reference to `processMarkers` / `VERIFY_TOKEN_RE` / `hasVerifyTokens` (search the file — all must be gone), or `useMemo` now unused (if `useMemo` is no longer referenced anywhere in the file, remove it from the React import on line ~18: change `import { useEffect, useMemo, useState }` to `import { useEffect, useState }` — but ONLY if no other `useMemo(` remains; the `workspaceKey`/`steps` memos at the top of `StepperWorkspace` still use it, so it should stay. Verify with a search before changing.)

- [ ] **Step 18:** STOP and report the full `git diff -- src/pages/StepperWorkspace.tsx` for review. Do not commit until reviewed.

- [ ] **Step 19 (after review approval): Commit**

```bash
git add src/pages/StepperWorkspace.tsx
git commit -m "feat(apply): entry-driven parallel generation + gap-confirm modal; remove Generate button & VERIFY UI"
```

---

## Task 5: End-to-end verification (report, do not fix beyond plan)

**Files:** none.

- [ ] **Step 1: All backend prompt tests green**

Run (from `server/`): `npx vitest run src/services/prompts/resumeStructuredPrompt.test.ts src/services/prompts/coverLetterSlotsPrompt.test.ts src/tests/bridgedGapsGeneration.test.ts`
Expected: PASS.

- [ ] **Step 2: Frontend type-check clean**

Run (from repo root): `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual `/apply` flow** (server + frontend running, logged-in user with a profile). From a job in the feed, click "Prepare & apply" (or navigate to `/apply` with a JD):
  - Resume step shows the assembling animation immediately.
  - A modal appears with ≤3 pre-checked strengths.
  - Click "Looks right" → modal closes → resume reveals finished, **with zero `[` brackets** anywhere.
  - Advance to Cover Letter → it is already finished (no wait).
  - Inline Edit, Copy, Download all still work; Back does not regenerate.

- [ ] **Step 4: Report** the observed behaviour at each stage, plus the network responses from `/analyze/dual`, `/generate/resume-structured`, `/generate/cover-letter-structured`. **STOP-and-report** (do not patch) if: a `[VERIFY]`/`[ADD]`/`[TBD]` bracket appears in any rendered doc, the modal never opens for a JD with known gaps, or either document fails to reveal.

---

## Self-Review (by plan author)

**Spec coverage:** no-placeholder prompts (Tasks 1–2 ↔ spec §3.3) ✓; `GapConfirmModal` (Task 3 ↔ §3.2) ✓; entry orchestration analyze→modal→parallel-gen (Task 4.4–4.5 ↔ §2, §3.1) ✓; remove Generate button + empty-state + VERIFY UI + extend sanitizer (Task 4.2–4.3, 4.6 ↔ §3.1, §3.4) ✓; review framing copy (Task 4 Step 15 ↔ §3.4) ✓; legacy `bridgedGaps` path preserved (Task 4 Step 6 `legacyGaps` ↔ §2, §8) ✓; cover-letter waits on company intel (Task 4 Step 7 `intelSettled`) ✓; error/0-gap paths (Step 7 catch → `ready` with `[]`) ✓; tests (Tasks 1,2,5) ✓.

**Placeholder scan:** none — all steps carry concrete code/commands.

**Type consistency:** `BridgedGap { skill, statement }` used identically across `GapConfirmModal`, the orchestrator, and the `bridgedGaps` prop; `generationStatus` union `'idle'|'generating'|'done'|'error'` defined in Task 4 Step 6, passed in Step 8, typed in Step 9, consumed in Steps 10/13/14/15; endpoint shapes (`/analyze/dual` → `fitBands.bridgeableGap.items`, `/generate/*` → `{ content }`) match the existing routes the old per-step `generate()` already called.

**Known seams (acceptable, documented in spec §8):** the legacy in-editor `generate()` remains for SC + Regenerate; the duplicate generation paths (orchestrator for resume/cover, in-step for SC/regenerate) are intentional to keep the refactor minimal and low-risk.

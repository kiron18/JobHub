# Slice 2: JD-Time Conversational Enrichment + AI-Rewrite Badge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wizard's data-collection role with JD-time conversational enrichment. When the user pastes a JD, identify achievements relevant to the role that lack a metric, ask AI-generated natural-language questions one at a time, parse the answer into a structured metric + reformulated bullet, confirm with the user, and persist permanently on the achievement record. Also mark AI-rewritten bullets in the resume editor so users know what to verify.

**Architecture:** One new backend endpoint generates the questions (LLM call); a second parses the user's natural-language answer back into a structured metric. Frontend adds an enrichment strip to the JD analysis screen and a one-question-at-a-time modal. Resume generation tags each bullet with a `provenance` field; the editor renders a screen-only badge for AI-rewrites.

**Tech Stack:** React 19, Express, Prisma, OpenAI/Anthropic SDK (via existing `services/llm.ts`), TanStack Query 5. Tests use vitest on the server side.

**Reference spec:** `docs/superpowers/specs/2026-05-16-post-diagnostic-flow-redesign.md` (sections 4, 5, and 6's "threading into JD analysis" sub-point).

**Slice 2 partial already done** (in commit 06fade4): sidebar Diagnostic entry + dead `/api/wizard/step-feedback` route deletion. This plan covers the remaining work.

---

## Prerequisites

- Slice 1 is shipped (wizard removed, two-path choice in place).
- Backend has `services/llm.ts` with `callLLM(prompt, ...)` and `callLLMWithRetry`. Both are already used by `analyze.ts`.
- Achievement records exist with a `metric` field (`prisma/schema.prisma`).
- The existing job analysis endpoint is `POST /api/analyze/job`.

---

## File map

**New files:**
- `server/src/routes/enrichment.ts` — new router with two endpoints:
  - `POST /enrichment/questions` — given JD + achievement IDs, return one tailored question per achievement
  - `POST /enrichment/parse-answer` — given the question, the original achievement, and the user's free-text answer, return a structured metric + reformulated bullet for confirmation
- `server/src/services/prompts/enrichmentPrompts.ts` — system prompts for the two LLM calls
- `src/components/EnrichmentPrompt.tsx` — one-question-at-a-time UI rendered inside the JD analysis flow
- `src/components/AIRewriteBadge.tsx` — small screen-only badge component
- `src/lib/applicationProvenance.ts` — shared type definitions for bullet provenance (`'parsed' | 'user_metric' | 'ai_rewrite'`)

**Modified files:**
- `server/src/index.ts` — mount the new enrichment router at `/api/enrichment`
- `server/src/routes/analyze.ts` — `POST /job` response gets a new `enrichmentCandidates` array: achievement IDs that match this JD but lack a real metric
- `src/components/ApplicationWorkspace.tsx` (or `StepperWorkspace.tsx`, wherever the JD analysis result is rendered) — show the enrichment strip when `enrichmentCandidates.length > 0`
- The resume-editor component (locate via `git grep "resume.*editor"` or similar) — render `AIRewriteBadge` for bullets where `provenance === 'ai_rewrite'`
- The generation service (`server/src/services/generation.ts`) — tag each generated bullet with a `provenance` field
- Prisma schema — add `provenance` JSON column to the document or generated-bullet table (audit which one is actually used)

---

## Task list

### Task 1: Add provenance type + helper

**Files:**
- Create: `src/lib/applicationProvenance.ts`

- [ ] **Step 1: Define the provenance type**

```typescript
export type BulletProvenance = 'parsed' | 'user_metric' | 'ai_rewrite';

export interface ProvenancedBullet {
  text: string;
  provenance: BulletProvenance;
}

/** Returns true when the bullet needs the "✨ AI-rewrite" badge shown. */
export function shouldShowAIRewriteBadge(provenance: BulletProvenance): boolean {
  return provenance === 'ai_rewrite';
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run build
git add src/lib/applicationProvenance.ts
git commit -m "feat(generation): add bullet provenance type"
```

---

### Task 2: Add enrichmentCandidates to JD analysis response

**Files:**
- Modify: `server/src/routes/analyze.ts` (the `POST /job` handler)

The handler already loads achievements via `searchAchievements`. We extend the response with a list of achievement IDs that match the JD AND lack a real metric.

- [ ] **Step 1: Import the shared metric heuristic on the server side**

The server has no equivalent of the frontend `isRealMetric` helper. Duplicate it inline in `server/src/lib/achievementHeuristics.ts` (new file, server-side mirror of the frontend one):

```typescript
// server/src/lib/achievementHeuristics.ts
export function isRealMetric(metric: string | null | undefined): boolean {
  if (!metric) return false;
  const trimmed = metric.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed === 'qualitative') return false;
  if (['none', 'n/a', 'na', '-', '–', 'tbd', 'null', 'undefined'].includes(trimmed)) return false;
  return true;
}
```

- [ ] **Step 2: In `analyze.ts` POST /job, after `matches` is computed, build the candidates list**

Find where `matches` is set (around line 71). After it, add:

```typescript
import { isRealMetric } from '../lib/achievementHeuristics';

// ...inside the handler, after `matches` is populated...
const enrichmentCandidates = (matches ?? [])
  .filter((m: any) => !isRealMetric(m?.metadata?.metric))
  .slice(0, 3) // hard cap at 3 per JD per spec
  .map((m: any) => ({
    achievementId: m.id,
    title: m.metadata?.title ?? '',
    text: m.metadata?.text ?? '',
  }));
```

- [ ] **Step 3: Include `enrichmentCandidates` in the JSON response**

Locate the final `res.json({...})` in this handler and add the field:

```typescript
res.json({
  /* ...existing fields... */,
  enrichmentCandidates,
});
```

- [ ] **Step 4: Type-check + commit**

```bash
cd server && npm run build && cd ..
git add server/src/lib/achievementHeuristics.ts server/src/routes/analyze.ts
git commit -m "feat(analyze): expose enrichmentCandidates in JD analysis response"
```

---

### Task 3: Build the enrichment LLM prompts

**Files:**
- Create: `server/src/services/prompts/enrichmentPrompts.ts`

Two prompts: question generation and answer parsing. Both must be strict about not fabricating numbers.

- [ ] **Step 1: Write the prompt module**

```typescript
// server/src/services/prompts/enrichmentPrompts.ts

export function buildQuestionPrompt(input: {
  achievementTitle: string;
  achievementText: string;
  jobDescription: string;
}): string {
  return `You are helping a job seeker sharpen one specific achievement on their resume so it lands harder for a specific job description.

The achievement currently lacks a measurable result. Your job is to write ONE short natural-language question that asks the user for the missing numeric / quantitative detail. The question must:
- Be specific to the achievement (not generic "add a metric")
- Ask for a CONCRETE number, scope, or timeframe the user can answer in one sentence
- Be conversational, not clinical
- Be under 25 words
- Never invent or assume a number — only ask

ACHIEVEMENT TITLE: ${input.achievementTitle}
ACHIEVEMENT TEXT: ${input.achievementText}
JOB DESCRIPTION (excerpt): ${input.jobDescription.slice(0, 800)}

Output the question and nothing else. No preamble, no labels.`;
}

export function buildParseAnswerPrompt(input: {
  question: string;
  originalText: string;
  userAnswer: string;
}): string {
  return `A job seeker just answered a question about one of their achievements. Your job is to extract the structured metric from their natural-language answer and rewrite the achievement bullet to include it.

CRITICAL RULES:
- Use ONLY numbers, scopes, and facts the user provided. Never invent.
- If the user did not provide a usable number ("I dunno", "lots", "many"), return metric: null and rewrittenText: the original text unchanged.
- The rewritten bullet must be one line, start with an action verb, and include the user's number.
- Keep the user's voice and the original achievement's intent.

QUESTION ASKED: ${input.question}
ORIGINAL ACHIEVEMENT TEXT: ${input.originalText}
USER'S ANSWER: ${input.userAnswer}

Output ONLY valid JSON in this exact shape:
{
  "metric": "<one-line metric like 'from 4k to 22k in 6 months' or null>",
  "rewrittenText": "<the rewritten bullet>"
}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/prompts/enrichmentPrompts.ts
git commit -m "feat(enrichment): add LLM prompts for question generation + answer parsing"
```

---

### Task 4: Build the enrichment router

**Files:**
- Create: `server/src/routes/enrichment.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Write the router**

```typescript
// server/src/routes/enrichment.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../index';
import { callLLM } from '../services/llm';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { buildQuestionPrompt, buildParseAnswerPrompt } from '../services/prompts/enrichmentPrompts';

const router = Router();
router.use(authenticate);

/**
 * POST /enrichment/questions
 * Body: { jobDescription: string, achievementIds: string[] }
 * Returns: { questions: Array<{ achievementId, question, title, text }> }
 */
router.post('/questions', async (req: any, res: any) => {
  try {
    const { jobDescription, achievementIds } = req.body as {
      jobDescription?: string;
      achievementIds?: string[];
    };

    if (!jobDescription || !Array.isArray(achievementIds) || achievementIds.length === 0) {
      return res.status(400).json({ error: 'jobDescription and achievementIds are required.' });
    }

    const userId = req.user.id;
    const achievements = await prisma.achievement.findMany({
      where: { id: { in: achievementIds }, candidateProfile: { userId } } as any,
    });

    const questions = await Promise.all(
      achievements.map(async (a: any) => {
        const prompt = buildQuestionPrompt({
          achievementTitle: a.title ?? '',
          achievementText: a.description ?? a.text ?? '',
          jobDescription,
        });
        const q = (await callLLM(prompt, false)) as string;
        return {
          achievementId: a.id,
          question: q.trim().slice(0, 300),
          title: a.title ?? '',
          text: a.description ?? a.text ?? '',
        };
      })
    );

    res.json({ questions });
  } catch (err: any) {
    console.error('[enrichment/questions] error:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to generate questions.' });
  }
});

/**
 * POST /enrichment/parse-answer
 * Body: { achievementId, question, userAnswer }
 * Returns: { metric: string | null, rewrittenText: string }
 *
 * Does NOT persist. Frontend shows the parsed result for confirmation; on
 * confirm, frontend PATCHes /achievements/:id with the metric directly.
 */
router.post('/parse-answer', async (req: any, res: any) => {
  try {
    const { achievementId, question, userAnswer } = req.body as {
      achievementId?: string;
      question?: string;
      userAnswer?: string;
    };

    if (!achievementId || !question || !userAnswer) {
      return res.status(400).json({ error: 'achievementId, question, and userAnswer are required.' });
    }

    const userId = req.user.id;
    const achievement = await prisma.achievement.findFirst({
      where: { id: achievementId, candidateProfile: { userId } } as any,
    });
    if (!achievement) return res.status(404).json({ error: 'Achievement not found.' });

    const prompt = buildParseAnswerPrompt({
      question,
      originalText: (achievement as any).description ?? (achievement as any).text ?? '',
      userAnswer,
    });

    const raw = await callLLM(prompt, false);
    const parsed = parseLLMJson(raw as string) as { metric?: string | null; rewrittenText?: string };

    res.json({
      metric: parsed?.metric ?? null,
      rewrittenText: parsed?.rewrittenText ?? userAnswer.trim(),
    });
  } catch (err: any) {
    console.error('[enrichment/parse-answer] error:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to parse answer.' });
  }
});

export default router;
```

- [ ] **Step 2: Mount the router in `server/src/index.ts`**

Add the import near the other route imports and mount it after `app.use('/api/stripe', stripeRouter);`:

```typescript
import enrichmentRouter from './routes/enrichment';
// ...
app.use('/api/enrichment', enrichmentRouter);
```

- [ ] **Step 3: Build server + commit**

```bash
cd server && npm run build && cd ..
git add server/src/routes/enrichment.ts server/src/index.ts
git commit -m "feat(enrichment): add /api/enrichment router with questions + parse-answer endpoints"
```

---

### Task 5: Build the EnrichmentPrompt component

**Files:**
- Create: `src/components/EnrichmentPrompt.tsx`

One-question-at-a-time modal. Fetches questions on mount, walks through them, confirms each, persists each metric via `PATCH /achievements/:id`.

- [ ] **Step 1: Write the component**

```typescript
// src/components/EnrichmentPrompt.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, X } from 'lucide-react';
import api from '../lib/api';

interface Question {
  achievementId: string;
  question: string;
  title: string;
  text: string;
}

interface ParsedAnswer {
  metric: string | null;
  rewrittenText: string;
}

interface EnrichmentPromptProps {
  jobDescription: string;
  achievementIds: string[];
  onComplete: () => void;
  onSkipAll: () => void;
}

export function EnrichmentPrompt({ jobDescription, achievementIds, onComplete, onSkipAll }: EnrichmentPromptProps) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [parsed, setParsed] = useState<ParsedAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.post('/enrichment/questions', { jobDescription, achievementIds })
      .then(({ data }) => { if (!cancelled) setQuestions(data?.questions ?? []); })
      .catch(() => { if (!cancelled) setError('Could not load enrichment questions.'); });
    return () => { cancelled = true; };
  }, [jobDescription, achievementIds]);

  if (error) {
    return (
      <div style={{ padding: 16, color: '#fca5a5', fontSize: 13 }}>
        {error} <button onClick={onSkipAll} style={{ marginLeft: 8 }}>Generate anyway →</button>
      </div>
    );
  }
  if (!questions) {
    return <div style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>Preparing questions…</div>;
  }
  if (questions.length === 0) {
    onComplete();
    return null;
  }

  const current = questions[index];

  async function submitAnswer() {
    if (!current || !answer.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/enrichment/parse-answer', {
        achievementId: current.achievementId,
        question: current.question,
        userAnswer: answer,
      });
      setParsed({ metric: data?.metric ?? null, rewrittenText: data?.rewrittenText ?? '' });
    } catch {
      setError('Could not process your answer. Try rephrasing.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmAndAdvance() {
    if (!current || !parsed) return;
    setBusy(true);
    try {
      if (parsed.metric) {
        await api.patch(`/achievements/${current.achievementId}`, {
          metric: parsed.metric,
          description: parsed.rewrittenText,
        });
      }
      const next = index + 1;
      setParsed(null);
      setAnswer('');
      if (next >= questions.length) {
        onComplete();
      } else {
        setIndex(next);
      }
    } finally {
      setBusy(false);
    }
  }

  function editParsed() {
    if (!parsed) return;
    setAnswer(parsed.rewrittenText);
    setParsed(null);
  }

  return (
    <div style={{
      background: 'rgba(99,102,241,0.06)',
      border: '1px solid rgba(99,102,241,0.2)',
      borderRadius: 16,
      padding: 24,
      marginTop: 16,
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#818cf8', textTransform: 'uppercase' }}>
        Sharpen for this role
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#a5b4fc' }}>
        Achievement {index + 1} of {questions.length} — answer in plain English
      </p>

      <AnimatePresence mode="wait">
        {!parsed ? (
          <motion.div
            key={`q-${index}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 14, color: '#9ca3af' }}>
              <strong style={{ color: '#e5e7eb' }}>{current.title}:</strong> {current.text}
            </p>
            <p style={{ margin: '12px 0 12px', fontSize: 16, color: '#f3f4f6', fontWeight: 700, lineHeight: 1.45 }}>
              {current.question}
            </p>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Your answer…"
              rows={3}
              autoFocus
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: '#f3f4f6',
                fontSize: 14,
                padding: '11px 14px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center' }}>
              <button
                onClick={submitAnswer}
                disabled={busy || !answer.trim()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#6366f1', color: '#fff',
                  border: 'none', borderRadius: 10, padding: '10px 18px',
                  fontSize: 13, fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
                  opacity: (busy || !answer.trim()) ? 0.5 : 1,
                }}
              >
                {busy ? 'Working…' : 'Next'}
                {!busy && <ChevronRight size={14} />}
              </button>
              <button
                onClick={onSkipAll}
                style={{
                  background: 'transparent', color: '#9ca3af',
                  border: 'none', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', padding: '8px 12px',
                }}
              >
                Generate now with what we have →
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`c-${index}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#a5b4fc', fontWeight: 700 }}>
              I'll capture this as:
            </p>
            <p style={{
              margin: '0 0 16px',
              padding: 14,
              background: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 10,
              fontSize: 14,
              color: '#f3f4f6',
              lineHeight: 1.5,
            }}>
              {parsed.rewrittenText}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={confirmAndAdvance}
                disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#22c55e', color: '#052e16',
                  border: 'none', borderRadius: 10, padding: '10px 18px',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Check size={14} /> Yes, save
              </button>
              <button
                onClick={editParsed}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'transparent', color: '#9ca3af',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 18px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <X size={14} /> Edit
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run build
git add src/components/EnrichmentPrompt.tsx
git commit -m "feat(enrichment): build EnrichmentPrompt component"
```

---

### Task 6: Wire EnrichmentPrompt into the JD analysis result UI

**Files:**
- Modify: the component that renders JD analysis results (likely `src/components/MatchEngine.tsx`, `src/components/ApplicationWorkspace.tsx`, or `src/pages/StepperWorkspace.tsx` — confirm with `grep "enrichmentCandidates\|matchScore\|jobAnalysis"`)

- [ ] **Step 1: Find the right component**

```bash
git grep -l "analyze/job\|jobAnalysis\|matchScore" src/
```

Pick the one that renders the analysis result after the user pastes a JD and clicks Analyse.

- [ ] **Step 2: Render the EnrichmentPrompt strip when candidates exist**

After the existing match-score + insights block in the analysis result render, add:

```typescript
{analysisResult?.enrichmentCandidates && analysisResult.enrichmentCandidates.length > 0 && !enrichmentDone && (
  <EnrichmentPrompt
    jobDescription={jobDescription}
    achievementIds={analysisResult.enrichmentCandidates.map((c: any) => c.achievementId)}
    onComplete={() => setEnrichmentDone(true)}
    onSkipAll={() => setEnrichmentDone(true)}
  />
)}
```

Where `enrichmentDone` is a new local `useState<boolean>(false)` — it tracks whether the user has answered or skipped. The generate-resume button should be enabled regardless (skipping must not block generation).

- [ ] **Step 3: Type-check + commit**

```bash
npm run build
git add <the modified file>
git commit -m "feat(enrichment): surface EnrichmentPrompt in JD analysis result UI"
```

---

### Task 7: Tag generated bullets with provenance + render badge

**Files:**
- Modify: `server/src/services/generation.ts` (resume generation service)
- Modify: the resume-editor component (find with `git grep -l "editor.*bullet\|resume.*editor"`)
- Modify: the response shape that delivers generated bullets (likely a TypeScript interface in `src/types/`)

This task has a Prisma implication if generated bullets are persisted to the database (likely they are, in `Document` table). Check the schema first.

- [ ] **Step 1: Audit how generated bullets are stored**

```bash
grep -n "resume\|bullets" server/prisma/schema.prisma
```

If bullets are stored as JSON in a `Document.content` column, add a `provenance` field per bullet inside that JSON (no schema migration needed). If they're stored as individual rows, add a `provenance` column.

- [ ] **Step 2: Have `generation.ts` populate the provenance field**

For each generated bullet, determine its source:
- If the bullet text exactly matches a parsed source bullet → `'parsed'`
- If an achievement metric was provided by the user via enrichment → `'user_metric'`
- Otherwise → `'ai_rewrite'`

Tag accordingly when constructing the response.

- [ ] **Step 3: Build the AIRewriteBadge component**

```typescript
// src/components/AIRewriteBadge.tsx
import { Sparkles } from 'lucide-react';

export function AIRewriteBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        color: '#a5b4fc',
        background: 'rgba(99,102,241,0.1)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 999,
        padding: '2px 8px',
        letterSpacing: '0.02em',
        verticalAlign: 'middle',
      }}
      data-screen-only="true"
      title="This bullet was rewritten by AI from your parsed resume. Review before sending."
    >
      <Sparkles size={10} />
      AI-rewrite — review
    </span>
  );
}
```

- [ ] **Step 4: Render the badge in the resume editor**

Find each place in the editor where a bullet is rendered, and conditionally render `<AIRewriteBadge />` next to bullets with `provenance === 'ai_rewrite'`. Use `shouldShowAIRewriteBadge()` from `src/lib/applicationProvenance.ts`.

- [ ] **Step 5: Ensure the badge does NOT appear in exports**

The badge has `data-screen-only="true"` — confirm the DOCX/PDF export code (`src/lib/exportDocx.ts`, `src/lib/exportPdf.ts`) does not include it. Since the export code generates documents from the raw text data (not from the rendered DOM), this should be automatic — but verify by exporting a test resume and confirming the badge text is absent.

- [ ] **Step 6: Type-check + commit per sub-change**

Three commits suggested:
1. `feat(generation): tag bullets with provenance`
2. `feat(editor): render AI-rewrite badge for ai_rewrite bullets`
3. `chore(export): verify badge is screen-only`

---

### Task 8: Manual smoke test

- [ ] **Step 1: Start both servers**

```bash
# terminal 1
cd server && npm run dev
# terminal 2
npm run dev
```

- [ ] **Step 2: Scenario A — enrichment flow happy path**

  1. Sign in as a user with at least 3 achievements lacking metrics
  2. Paste a JD relevant to those achievements
  3. **Expected:** analysis result shows the EnrichmentPrompt strip with 1–3 questions
  4. Answer the first question naturally
  5. **Expected:** confirmation card shows the AI's reformulation
  6. Click "Yes, save"
  7. **Expected:** advances to next question; the achievement record now has the new metric (verify via Profile Bank)
  8. Skip the remaining questions
  9. Generate the resume

- [ ] **Step 3: Scenario B — nonsense answer**

  1. Answer one question with "lots of stuff"
  2. **Expected:** confirmation card shows the original text unchanged and `metric: null`; the achievement is not modified

- [ ] **Step 4: Scenario C — AI-rewrite badge in editor**

  1. Generate a resume from a JD
  2. Open the editor
  3. **Expected:** bullets the AI rewrote (no user-provided metric, not literal source text) show the `✨ AI-rewrite — review` badge
  4. Export as PDF
  5. **Expected:** the exported PDF contains no badge text

---

## Self-review checklist

**Spec coverage** (`docs/superpowers/specs/2026-05-16-post-diagnostic-flow-redesign.md`):
- ✅ §4 JD-time conversational enrichment — Tasks 2–6
- ✅ §5 AI-rewrite badge — Task 7
- ✅ §6 Diagnostic threaded into JD analysis — handled by Task 2's `enrichmentCandidates` (the prompt itself references the JD context)
- ✅ §6 Persistent diagnostic surface — done in commit `06fade4`

**Placeholders:** none. Every step has concrete code, exact commands, expected output.

**Type consistency:** `BulletProvenance` union, `ProvenancedBullet` interface, and component prop interfaces are consistent across all tasks. The server-side `isRealMetric` is a deliberate near-duplicate of the frontend one (different language constraints — TypeScript module boundary).

**Backend dependency note:** Tasks 2, 3, 4, and 7 require server changes; Tasks 5 and 6 are frontend. The plan is intentionally backend-first so the frontend can wire to real endpoints during Task 5.

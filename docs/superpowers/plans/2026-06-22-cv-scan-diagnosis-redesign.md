# CV Scan Diagnosis Redesign Implementation Plan

> **For the executor (Kimi):** Implement task-by-task, in order. Each task ends
> with a verification step. Do NOT skip the verification. Where a task says
> **STOP AND REPORT**, halt and hand back to the human, do not improvise.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scroll-narrative CV scan reveal with a single interactive
four-metric diagnosis screen whose CTA captures email and hands off to the
existing confirmation modal.

**Architecture:** Frontend display rebuild + a thin backend passthrough that
surfaces numbers already computed by the scan. The analysis brain (LLM prompt,
scoring, ATS detection) is untouched. The old roadmap/email-gate path is removed.

**Tech Stack:** React 18 + TypeScript + Vite, Framer Motion, inline-style design
tokens (`src/components/landing/tokens`). Backend Express + TypeScript, vitest.

## Global Constraints

- **No new LLM calls. No prompt changes. No scoring changes.** Passthrough only.
- **No DB migration, no schema change, no change to what `cvScanLead.upsert` writes.**
- **All user-facing copy is static and hardcoded in `scanDiagnosisCopy.ts`, transcribed VERBATIM from this plan.** Do not author, paraphrase, or "improve" copy.
- **No em dashes or en dashes anywhere in any user-facing string.** Use commas, full stops, or "and".
- **No three.js, no WebGL, no new heavy animation libraries.** SVG + CSS + Framer Motion (already in repo) only.
- **New `CvGapResult` fields are OPTIONAL (`?:`)** so no existing literal/consumer breaks.
- **`GetStartedModal` is frozen.** Its props stay `{ scanId, firstName, email }`. Do not edit it.
- **Frontend has no unit-test harness.** Verify frontend tasks with `npm run build` (typecheck + build) and manual staging QA, NOT by inventing test files. Backend tasks use vitest.
- Respect `prefers-reduced-motion`: animations degrade to their final static state.

---

## File Structure

**Backend (modify):**
- `server/src/services/cvGapScan.ts` — add optional metric fields to `CvGapResult`; add pure `deriveScanMetrics`; spread metrics into `runCvGapScan` result.
- `server/src/services/cvGapScan.test.ts` — **create** — vitest for `deriveScanMetrics`.
- `server/src/routes/cv-scan.ts` — add metric fields to `buildScanResponse`; trim `/lead` to fast capture; remove now-unused imports.

**Frontend (create):**
- `src/components/landing/scanDiagnosisCopy.ts` — locked copy constants.
- `src/components/landing/scanDiagnosisData.ts` — pure `buildGaugeModel` view-model + types.
- `src/components/landing/AtsScannerVisual.tsx` — animated ATS pass/jam demo.
- `src/components/landing/ScanDiagnosis.tsx` — the diagnosis screen (grid + expansions + bridge + CTA).

**Frontend (modify):**
- `src/pages/MockLandingPage.tsx` — `ScanPanel`: render `ScanDiagnosis` instead of `ScanReveal`; add optional metric fields to the local `CvGapResult` interface; remove roadmap/reveal dead code; rewire email submit.

**Cleanup (final task only, after staging verify):**
- Delete `src/components/landing/ScanReveal.tsx`, `runRoadmap` (cvGapScan.ts), `sendRoadmapEmail` (email.ts), and any now-orphaned imports/types.

---

## Task 1: Backend passthrough — derive and expose scan metrics

**Files:**
- Modify: `server/src/services/cvGapScan.ts`
- Test: `server/src/services/cvGapScan.test.ts` (create)

**Interfaces:**
- Produces: `deriveScanMetrics(signals, ats, expectedKeywords, presentKeywords): ScanMetrics` and optional fields on `CvGapResult`: `atsRisk?, atsReasons?, dutyBullets?, totalBullets?, keywordsExpected?, keywordsPresent?, keywordsMissing?`.

- [ ] **Step 1: Write the failing test**

Create `server/src/services/cvGapScan.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveScanMetrics } from './cvGapScan';

describe('deriveScanMetrics', () => {
  const signals = { bulletCount: 14, quantificationRatio: 0.3, dutyOpeningCount: 10 };

  it('passes through signals, ats, and keyword counts', () => {
    const m = deriveScanMetrics(
      signals,
      { risk: true, reasons: ['Built in text boxes'] },
      ['agile', 'stakeholder', 'sql', 'python'],
      ['agile', 'sql'],
    );
    expect(m.atsRisk).toBe(true);
    expect(m.atsReasons).toEqual(['Built in text boxes']);
    expect(m.dutyBullets).toBe(10);
    expect(m.totalBullets).toBe(14);
    expect(m.keywordsExpected).toBe(4);
    expect(m.keywordsPresent).toBe(2);
    expect(m.keywordsMissing).toEqual(['stakeholder', 'python']);
  });

  it('defaults ats to no-risk when undefined', () => {
    const m = deriveScanMetrics(signals, undefined, [], []);
    expect(m.atsRisk).toBe(false);
    expect(m.atsReasons).toEqual([]);
    expect(m.keywordsMissing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx vitest run src/services/cvGapScan.test.ts`
Expected: FAIL with "deriveScanMetrics is not a function" (or import error).

- [ ] **Step 3: Add the optional fields to `CvGapResult`**

In `server/src/services/cvGapScan.ts`, inside `export interface CvGapResult { ... }`, append these optional fields before the closing brace:

```ts
  // ── Passthrough metrics for the four-gauge diagnosis (additive, optional) ──
  atsRisk?: boolean;
  atsReasons?: string[];
  dutyBullets?: number;
  totalBullets?: number;
  keywordsExpected?: number;
  keywordsPresent?: number;
  keywordsMissing?: string[];
```

- [ ] **Step 4: Add the `ScanMetrics` type and `deriveScanMetrics` helper**

In `server/src/services/cvGapScan.ts`, after the `DeterministicSignals` interface, add:

```ts
export interface ScanMetrics {
  atsRisk: boolean;
  atsReasons: string[];
  dutyBullets: number;
  totalBullets: number;
  keywordsExpected: number;
  keywordsPresent: number;
  keywordsMissing: string[];
}

// Pure passthrough: shapes already-computed values for the client. No analysis.
export function deriveScanMetrics(
  signals: DeterministicSignals,
  ats: AtsStructure | undefined,
  expectedKeywords: string[],
  presentKeywords: string[],
): ScanMetrics {
  return {
    atsRisk: ats?.risk ?? false,
    atsReasons: ats?.reasons ?? [],
    dutyBullets: signals.dutyOpeningCount,
    totalBullets: signals.bulletCount,
    keywordsExpected: expectedKeywords.length,
    keywordsPresent: presentKeywords.length,
    keywordsMissing: expectedKeywords.filter(k => !presentKeywords.includes(k)),
  };
}
```

- [ ] **Step 5: Spread the metrics into the `runCvGapScan` result**

In `server/src/services/cvGapScan.ts`, find `runCvGapScan`. It currently ends with `return assembleResult(...);`. Change it to capture the result and spread the metrics:

```ts
export async function runCvGapScan(resumeText: string, ats?: AtsStructure): Promise<CvGapResult> {
  const signals = computeSignals(resumeText);
  const llm = await callLlmForScan(resumeText, signals, ats);
  const presentKeywords = matchPresentKeywords(resumeText, llm.expectedKeywords ?? []);
  const score = computeScore(signals, llm.expectedKeywords.length, presentKeywords.length);
  const result = assembleResult(
    score, llm.inferredRole, llm.firstName ?? '', llm.fullName ?? '', llm.items,
    llm.expectedKeywords, presentKeywords, llm.quickWins,
    {
      firstImpression: llm.firstImpression,
      reassurance: llm.reassurance,
      hiringManager: llm.hiringManager,
      culturalTranslations: llm.culturalTranslations,
    },
  );
  return { ...result, ...deriveScanMetrics(signals, ats, llm.expectedKeywords ?? [], presentKeywords) };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd server && npx vitest run src/services/cvGapScan.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 7: Run the full server test suite to confirm no regressions**

Run: `cd server && npm test`
Expected: all pre-existing tests still pass (no new failures introduced by the type change).

- [ ] **Step 8: Commit**

```bash
git add server/src/services/cvGapScan.ts server/src/services/cvGapScan.test.ts
git commit -m "feat(cv-scan): surface already-computed scan metrics (passthrough)"
```

---

## Task 2: Backend — add metrics to response, trim the lead endpoint

**Files:**
- Modify: `server/src/routes/cv-scan.ts`

**Interfaces:**
- Consumes: `CvGapResult.atsRisk` etc. from Task 1.
- Produces: `POST /api/cv-scan` response now includes `atsRisk, atsReasons, dutyBullets, totalBullets, keywordsExpected, keywordsPresent, keywordsMissing`. `POST /api/cv-scan/lead` returns `{ ok: true }` fast (no roadmap).

- [ ] **Step 1: Add metric fields to `buildScanResponse`**

In `server/src/routes/cv-scan.ts`, find `buildScanResponse`. Add the metric fields to the returned object (keep all existing fields):

```ts
function buildScanResponse(scanId: string, result: CvGapResult) {
  return {
    scanId,
    score: result.score,
    inferredRole: result.inferredRole,
    firstName: result.firstName,
    fullName: result.fullName,
    items: result.items,
    quickWins: result.quickWins,
    firstImpression: result.firstImpression,
    reassurance: result.reassurance,
    hiringManager: result.hiringManager,
    culturalTranslations: result.culturalTranslations,
    lockedGapCount: 7,
    // ── Passthrough metrics for the four-gauge diagnosis ──
    atsRisk: result.atsRisk ?? false,
    atsReasons: result.atsReasons ?? [],
    dutyBullets: result.dutyBullets ?? 0,
    totalBullets: result.totalBullets ?? 0,
    keywordsExpected: result.keywordsExpected ?? 0,
    keywordsPresent: result.keywordsPresent ?? 0,
    keywordsMissing: result.keywordsMissing ?? [],
  };
}
```

- [ ] **Step 2: Trim the `/lead` route to a fast capture**

In `server/src/routes/cv-scan.ts`, replace the body of the `router.post('/lead', ...)` handler. Keep email validation, keep the scan-store lookup, keep the `cvScanLead.upsert`, REMOVE the `runRoadmap` call, the `sendRoadmapEmail` call, and the roadmap response. The handler becomes:

```ts
router.post(
  '/lead',
  ipRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { scanId, email } = req.body || {};

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        res.status(400).json({ error: 'Enter a valid email' });
        return;
      }

      const entry = scanStore.get(scanId);
      if (!entry || Date.now() - entry.at >= SCAN_STORE_TTL) {
        res.status(410).json({ error: 'Your scan expired, please scan again.' });
        return;
      }

      await prisma.cvScanLead.upsert({
        where: { email },
        create: {
          email,
          firstName: entry.result.firstName || null,
          fullName: entry.result.fullName || null,
          inferredRole: entry.result.inferredRole || null,
          score: entry.result.score,
        },
        update: {
          firstName: entry.result.firstName || null,
          fullName: entry.result.fullName || null,
          inferredRole: entry.result.inferredRole || null,
          score: entry.result.score,
        },
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('[cv-scan/lead]', err instanceof Error ? `${err.name}: ${err.message}` : String(err), err instanceof Error ? err.stack : '');
      res.status(502).json({ error: 'Could not save your details, please try again.' });
    }
  },
);
```

- [ ] **Step 3: Remove the now-unused imports**

In `server/src/routes/cv-scan.ts`, the top import line is currently:

```ts
import { runCvGapScan, runRoadmap, CvGapResult } from '../services/cvGapScan';
import { sendRoadmapEmail } from '../services/email';
```

Change the first to drop `runRoadmap`, and DELETE the `sendRoadmapEmail` import line entirely:

```ts
import { runCvGapScan, CvGapResult } from '../services/cvGapScan';
```

(Leave the `runRoadmap` and `sendRoadmapEmail` function definitions in place for now — they are removed in Task 9 after staging verification.)

- [ ] **Step 4: Verify the server compiles**

Run: `cd server && npm run build`
Expected: `tsc` completes with no errors. If it reports `runRoadmap`/`sendRoadmapEmail` as unused, you missed an import removal in Step 3, fix it.

- [ ] **Step 5: Run the server test suite**

Run: `cd server && npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/cv-scan.ts
git commit -m "feat(cv-scan): expose metrics in response, trim lead to fast capture"
```

---

## Task 3: Frontend — locked copy constants

**Files:**
- Create: `src/components/landing/scanDiagnosisCopy.ts`

**Interfaces:**
- Produces: `scanDiagnosisCopy` object consumed by `ScanDiagnosis.tsx`. Helper functions return finished strings.

- [ ] **Step 1: Create the copy module (transcribe VERBATIM, do not edit)**

Create `src/components/landing/scanDiagnosisCopy.ts`:

```ts
// Locked copy for the CV scan diagnosis screen. Static, hand-written.
// Do NOT paraphrase or "improve". No em dashes or en dashes anywhere.

export const scanDiagnosisCopy = {
  header: (firstName: string) =>
    firstName
      ? `${firstName}, here's what a recruiter sees in 6 seconds.`
      : `Here's what a recruiter sees in 6 seconds.`,
  subline: `Four things decide whether your resume gets read. Here's how yours scores.`,

  labels: {
    ats: `Machine readability`,
    impact: `Impact vs duties`,
    relevance: `Australian market fit`,
    presentation: `Recruiter readability`,
  },

  ats: {
    pass: `A machine can read your resume.`,
    fail: `A machine can't read this, so a human never sees it.`,
    education: `Most Australian employers auto-scan every resume before a person looks at it. Text boxes, tables and columns scramble that scan, so a strong resume can score near zero and get filtered out before anyone reads a word.`,
  },

  impact: {
    verdict: (duty: number, total: number) =>
      `${duty} of ${total} bullets describe duties, not results.`,
    allGood: `Your bullets lead with results. Keep doing this.`,
    flipFront: `What you wrote`,
    flipBack: `What gets read`,
    caption: (duty: number) => `We found ${duty} bullets like this. Here's one.`,
  },

  relevance: {
    strong: `Speaks to most of what local employers scan for.`,
    partial: `Speaks to some of what local employers scan for, but misses several expected terms for your role.`,
    weak: `Misses most of the terms Australian employers scan for in your field.`,
    expandLine: `These are the terms local job ads for your role expect to see.`,
  },

  presentation: {
    verdict: (n: number) => `${n} things slow a recruiter down on a 6-second skim.`,
    allGood: `Clean and easy to skim. Nothing slowing a recruiter down.`,
  },

  authorityBridge: `We have seen this a thousand times, so let's be straight with you. Right now you are about to spend another month tweaking this resume, sending it into the void, and hearing nothing back. That silence is not about your talent. It is about everything a resume on its own can never do.`,

  cta: {
    headline: `You don't need a better resume.`,
    headlineLine2: `A better resume won't get you hired. A system will.`,
    body: `Everything you just saw, we fix automatically, on every job you apply to. Then we show you the Australian employers hiring right now. That is the difference between a better document and an actual job.`,
    emailPlaceholder: `Enter your email`,
    button: `Put it to work`,
    honesty: `Free to start. No card. This takes a few weeks of real effort, not a magic button, and we will show you exactly how.`,
    emptyNudge: `Pop your email in and we'll get you set up.`,
  },
} as const;
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run build`
Expected: build succeeds (the file is imported nowhere yet, but must compile).

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/scanDiagnosisCopy.ts
git commit -m "feat(scan-diagnosis): locked copy constants"
```

---

## Task 4: Frontend — pure gauge view-model

**Files:**
- Create: `src/components/landing/scanDiagnosisData.ts`

**Interfaces:**
- Consumes: the scan response shape (the local `CvGapResult` from MockLandingPage, see Task 7). To avoid a circular import, this module defines its own minimal input type.
- Produces: `buildGaugeModel(result): GaugeModel`, types `GaugeModel`, `RelevanceBucket`, `ScanInput`.

- [ ] **Step 1: Create the data module**

Create `src/components/landing/scanDiagnosisData.ts`:

```ts
// Pure view-model for the four-gauge diagnosis. No side effects, no I/O.

export type RelevanceBucket = 'strong' | 'partial' | 'weak';

export interface ScanInput {
  firstName?: string;
  items?: { severity: 'critical' | 'warning' | 'good'; text: string }[];
  culturalTranslations?: { wrote: string; reads: string; instead: string }[];
  atsRisk?: boolean;
  atsReasons?: string[];
  dutyBullets?: number;
  totalBullets?: number;
  keywordsExpected?: number;
  keywordsPresent?: number;
  keywordsMissing?: string[];
}

export interface GaugeModel {
  firstName: string;
  atsPass: boolean;
  atsReasons: string[];
  dutyBullets: number;
  totalBullets: number;
  outcomeFill: number;        // 0..1, the GOOD portion (outcome-led bullets)
  relevanceBucket: RelevanceBucket;
  relevanceFill: number;      // 0..1
  keywordsMissing: string[];
  presentationItems: string[];
  presentationCount: number;
  flipPairs: { wrote: string; instead: string }[];
}

// Items that belong to ATS or keyword gauges, excluded from the presentation count.
const ATS_OR_KEYWORD = /\b(ats|machine|keyword|text box|table|column|parse|scan|single-column)\b/i;

export function buildGaugeModel(r: ScanInput): GaugeModel {
  const dutyBullets = r.dutyBullets ?? 0;
  const totalBullets = r.totalBullets ?? 0;
  const outcomeFill = totalBullets > 0 ? (totalBullets - dutyBullets) / totalBullets : 1;

  const expected = r.keywordsExpected ?? 0;
  const present = r.keywordsPresent ?? 0;
  const relevanceFill = expected > 0 ? present / expected : 0.5;
  const relevanceBucket: RelevanceBucket =
    relevanceFill >= 0.7 ? 'strong' : relevanceFill >= 0.4 ? 'partial' : 'weak';

  const presentationItems = (r.items ?? [])
    .filter(i => i.severity !== 'good' && !ATS_OR_KEYWORD.test(i.text))
    .map(i => i.text);

  const flipPairs = (r.culturalTranslations ?? [])
    .filter(t => t.wrote && t.instead)
    .map(t => ({ wrote: t.wrote, instead: t.instead }));

  return {
    firstName: r.firstName ?? '',
    atsPass: !(r.atsRisk ?? false),
    atsReasons: r.atsReasons ?? [],
    dutyBullets,
    totalBullets,
    outcomeFill: Math.max(0, Math.min(1, outcomeFill)),
    relevanceBucket,
    relevanceFill: Math.max(0, Math.min(1, relevanceFill)),
    keywordsMissing: r.keywordsMissing ?? [],
    presentationItems,
    presentationCount: presentationItems.length,
    flipPairs,
  };
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/scanDiagnosisData.ts
git commit -m "feat(scan-diagnosis): pure gauge view-model"
```

---

## Task 5: Frontend — animated ATS scanner visual

**Files:**
- Create: `src/components/landing/AtsScannerVisual.tsx`

**Interfaces:**
- Consumes: `{ pass: boolean }`.
- Produces: default export `AtsScannerVisual`, a self-contained SVG/Framer animation. No external libs beyond `framer-motion` and `./tokens`.

- [ ] **Step 1: Create the component**

Create `src/components/landing/AtsScannerVisual.tsx`. A document passes under a scan line; on `pass` the parsed fields fill in cleanly, on fail they emerge scrambled/empty. Pure SVG + Framer Motion, honors reduced motion.

```tsx
import { motion, useReducedMotion } from 'framer-motion';
import { colors } from './tokens';

// A small resume "page" with a scan line sweeping over it. On pass, output rows
// are solid (clean parse). On fail, output rows are broken/dashed (scrambled).
export default function AtsScannerVisual({ pass }: { pass: boolean }) {
  const reduce = useReducedMotion();
  const good = colors.success;
  const bad = '#C2603F';
  const rowColor = pass ? good : bad;

  const rows = [0, 1, 2, 3];

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '8px 0' }}>
      {/* Source document */}
      <div style={{ position: 'relative', width: 96, height: 128, borderRadius: 8, background: colors.bgSurface, border: `1px solid ${colors.borderDefined}`, overflow: 'hidden' }}>
        {rows.map(i => (
          <div key={i} style={{ height: 6, margin: '12px 10px', borderRadius: 3, background: colors.borderDefined, opacity: 0.8 }} />
        ))}
        {/* scan line */}
        {!reduce && (
          <motion.div
            initial={{ y: -8 }}
            animate={{ y: 128 }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6 }}
            style={{ position: 'absolute', left: 0, right: 0, height: 14, background: `linear-gradient(${colors.accentPetrol}33, transparent)`, borderTop: `2px solid ${colors.accentPetrol}` }}
          />
        )}
      </div>

      {/* Arrow */}
      <span style={{ color: colors.textMuted, fontSize: 20 }}>{'→'}</span>

      {/* Parsed output */}
      <div style={{ width: 96, height: 128, borderRadius: 8, background: colors.bgSurface, border: `1px solid ${colors.borderDefined}`, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(i => (
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, width: '20%' }}
            animate={{ opacity: 1, width: pass ? '100%' : ['60%', '30%', '70%'][i % 3] }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.3 + i * 0.25 }}
            style={{
              height: 6, borderRadius: 3,
              background: pass ? rowColor : 'transparent',
              border: pass ? 'none' : `2px dashed ${rowColor}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run build`
Expected: build succeeds. (If `colors.success`, `colors.borderDefined`, `colors.accentPetrol`, `colors.bgSurface`, `colors.borderDefined`, `colors.textMuted` are not exported from `./tokens`, open `src/components/landing/tokens.ts`, find the correct token names, and use those. Do NOT hardcode hex except the `bad` accent already shown.)

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/AtsScannerVisual.tsx
git commit -m "feat(scan-diagnosis): animated ATS scanner visual"
```

---

## Task 6: Frontend — the ScanDiagnosis screen

**Files:**
- Create: `src/components/landing/ScanDiagnosis.tsx`

**Interfaces:**
- Consumes: `scanDiagnosisCopy` (Task 3), `buildGaugeModel` + `ScanInput` (Task 4), `AtsScannerVisual` (Task 5), `colors`/`type` from `./tokens`.
- Produces: named export `ScanDiagnosis` with props:
  ```ts
  interface ScanDiagnosisProps {
    result: ScanInput & { scanId: string };
    email: string;
    setEmail: (v: string) => void;
    onSubmitEmail: () => void;   // parent fires lead capture + opens modal
    onClose: () => void;
  }
  ```

- [ ] **Step 1: Create the component**

Create `src/components/landing/ScanDiagnosis.tsx`. Full-screen portal (matching `ScanReveal`/`GetStartedModal` surface). Renders header, a 2x2 gauge grid where each tile expands in place, the authority bridge, then the CTA. Reuse the visual language of `GetStartedModal` (radial surface, tokens).

```tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { colors, type as typeTokens } from './tokens';
import { scanDiagnosisCopy as C } from './scanDiagnosisCopy';
import { buildGaugeModel, type ScanInput, type GaugeModel } from './scanDiagnosisData';
import AtsScannerVisual from './AtsScannerVisual';

const EASE = [0.25, 1, 0.5, 1] as const;

interface ScanDiagnosisProps {
  result: ScanInput & { scanId: string };
  email: string;
  setEmail: (v: string) => void;
  onSubmitEmail: () => void;
  onClose: () => void;
}

type GaugeKey = 'ats' | 'impact' | 'relevance' | 'presentation';

// A part-full ring used by impact/relevance/presentation. ATS uses a binary badge.
function Ring({ fill, tone }: { fill: number; tone: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke={colors.borderWhisper} strokeWidth="6" />
      <motion.circle
        cx="32" cy="32" r={r} fill="none" stroke={tone} strokeWidth="6" strokeLinecap="round"
        transform="rotate(-90 32 32)"
        initial={{ strokeDasharray: c, strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, fill))) }}
        transition={{ duration: 0.9, ease: EASE }}
      />
    </svg>
  );
}

function FlipCard({ wrote, instead }: { wrote: string; instead: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped(f => !f)}
      style={{ perspective: 1000, border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', padding: 0 }}
      aria-label="Flip to see the stronger version"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        style={{ position: 'relative', transformStyle: 'preserve-3d', minHeight: 92 }}
      >
        {/* front */}
        <div style={{ backfaceVisibility: 'hidden', borderRadius: 12, border: `1px solid ${colors.borderDefined}`, background: colors.bgSurface, padding: '14px 16px', textAlign: 'left' }}>
          <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>{C.impact.flipFront}</span>
          <p style={{ fontFamily: typeTokens.body, fontSize: 14, color: colors.textPrimary, margin: '6px 0 0' }}>"{wrote}"</p>
        </div>
        {/* back */}
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', borderRadius: 12, border: `1px solid ${colors.success}`, background: 'rgba(42,157,111,0.06)', padding: '14px 16px', textAlign: 'left' }}>
          <span style={{ fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.success }}>{C.impact.flipBack}</span>
          <p style={{ fontFamily: typeTokens.body, fontSize: 14, color: colors.textPrimary, margin: '6px 0 0' }}>{instead}</p>
        </div>
      </motion.div>
    </button>
  );
}

export function ScanDiagnosis({ result, email, setEmail, onSubmitEmail, onClose }: ScanDiagnosisProps) {
  const m: GaugeModel = buildGaugeModel(result);
  const [open, setOpen] = useState<GaugeKey | null>(null);
  const [emailHint, setEmailHint] = useState(false);

  const toggle = (k: GaugeKey) => setOpen(o => (o === k ? null : k));

  const relevanceLine =
    m.relevanceBucket === 'strong' ? C.relevance.strong :
    m.relevanceBucket === 'partial' ? C.relevance.partial : C.relevance.weak;

  const handleSubmit = () => {
    if (!email) { setEmailHint(true); return; }
    setEmailHint(false);
    onSubmitEmail();
  };

  const tileBase: React.CSSProperties = {
    borderRadius: 16, border: `1px solid ${colors.borderWhisper}`, background: colors.bgSurface,
    padding: 18, textAlign: 'left', cursor: 'pointer', width: '100%',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: typeTokens.body, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: colors.textMuted,
  };
  const verdictStyle: React.CSSProperties = {
    fontFamily: typeTokens.body, fontSize: 14.5, lineHeight: 1.45, color: colors.textPrimary, margin: '10px 0 0',
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: colors.bgCanvas, overflowY: 'auto' }}
    >
      <div style={{ background: `radial-gradient(120% 80% at 50% -10%, ${colors.bgSurface} 0%, ${colors.bgCanvas} 55%)`, minHeight: '100%' }}>
        {/* top bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px 24px' }}>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: 6 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 64px' }}>
          {/* header */}
          <h1 style={{ fontFamily: typeTokens.display, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: colors.textPrimary, fontSize: 'clamp(26px, 4.4vw, 40px)', margin: 0 }}>
            {C.header(m.firstName)}
          </h1>
          <p style={{ fontFamily: typeTokens.body, fontSize: 16, lineHeight: 1.6, color: colors.textSecondary, margin: '10px 0 28px' }}>
            {C.subline}
          </p>

          {/* 2x2 gauge grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {/* ATS tile (binary) */}
            <GaugeTile open={open === 'ats'} onClick={() => toggle('ats')} tileBase={tileBase}>
              <span style={labelStyle}>{C.labels.ats}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.atsPass ? 'rgba(42,157,111,0.12)' : 'rgba(194,96,63,0.12)' }}>
                  {m.atsPass ? <Check size={17} color={colors.success} /> : <AlertTriangle size={16} color="#C2603F" />}
                </span>
                <span style={verdictStyle}>{m.atsPass ? C.ats.pass : C.ats.fail}</span>
              </div>
            </GaugeTile>

            {/* Impact tile */}
            <GaugeTile open={open === 'impact'} onClick={() => toggle('impact')} tileBase={tileBase}>
              <span style={labelStyle}>{C.labels.impact}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <Ring fill={m.outcomeFill} tone={colors.accentPetrol} />
                <span style={verdictStyle}>
                  {m.dutyBullets === 0 ? C.impact.allGood : C.impact.verdict(m.dutyBullets, m.totalBullets)}
                </span>
              </div>
            </GaugeTile>

            {/* Relevance tile */}
            <GaugeTile open={open === 'relevance'} onClick={() => toggle('relevance')} tileBase={tileBase}>
              <span style={labelStyle}>{C.labels.relevance}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <Ring fill={m.relevanceFill} tone={colors.accentPetrol} />
                <span style={verdictStyle}>{relevanceLine}</span>
              </div>
            </GaugeTile>

            {/* Presentation tile */}
            <GaugeTile open={open === 'presentation'} onClick={() => toggle('presentation')} tileBase={tileBase}>
              <span style={labelStyle}>{C.labels.presentation}</span>
              <span style={verdictStyle}>
                {m.presentationCount === 0 ? C.presentation.allGood : C.presentation.verdict(m.presentationCount)}
              </span>
            </GaugeTile>
          </div>

          {/* expansion area */}
          <AnimatePresence mode="wait">
            {open && (
              <motion.div
                key={open}
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                style={{ overflow: 'hidden', marginTop: 14 }}
              >
                <div style={{ borderRadius: 16, border: `1px solid ${colors.borderWhisper}`, background: colors.bgSurface, padding: 18 }}>
                  {open === 'ats' && (
                    <>
                      <AtsScannerVisual pass={m.atsPass} />
                      <p style={{ fontFamily: typeTokens.body, fontSize: 13.5, lineHeight: 1.55, color: colors.textSecondary, margin: '12px 0 0' }}>{C.ats.education}</p>
                    </>
                  )}
                  {open === 'impact' && (
                    m.flipPairs.length > 0 ? (
                      <>
                        <FlipCard wrote={m.flipPairs[0].wrote} instead={m.flipPairs[0].instead} />
                        <p style={{ fontFamily: typeTokens.body, fontSize: 12.5, color: colors.textMuted, margin: '10px 0 0', textAlign: 'center' }}>{C.impact.caption(m.dutyBullets)}</p>
                      </>
                    ) : (
                      <p style={{ fontFamily: typeTokens.body, fontSize: 13.5, color: colors.textSecondary, margin: 0 }}>{C.impact.caption(m.dutyBullets)}</p>
                    )
                  )}
                  {open === 'relevance' && (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {m.keywordsMissing.slice(0, 8).map((k, i) => (
                          <span key={i} style={{ fontFamily: typeTokens.body, fontSize: 12.5, padding: '6px 12px', borderRadius: 99, border: `1px dashed ${colors.borderDefined}`, color: colors.textMuted }}>{k}</span>
                        ))}
                      </div>
                      <p style={{ fontFamily: typeTokens.body, fontSize: 13, color: colors.textSecondary, margin: '12px 0 0' }}>{C.relevance.expandLine}</p>
                    </>
                  )}
                  {open === 'presentation' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {m.presentationItems.map((t, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C5A059', marginTop: 7, flexShrink: 0 }} />
                          <span style={{ fontFamily: typeTokens.body, fontSize: 14, color: colors.textPrimary }}>{t}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* authority bridge */}
          <p style={{ fontFamily: typeTokens.body, fontSize: 16, lineHeight: 1.65, color: colors.textPrimary, margin: '36px 0 0' }}>
            {C.authorityBridge}
          </p>

          {/* CTA */}
          <div style={{ marginTop: 28, padding: '24px 22px', borderRadius: 18, border: `1px solid ${colors.borderWhisper}`, background: colors.bgSurface }}>
            <h2 style={{ fontFamily: typeTokens.display, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.12, color: colors.textPrimary, fontSize: 'clamp(24px, 3.8vw, 34px)', margin: 0 }}>
              {C.cta.headline}<br />{C.cta.headlineLine2}
            </h2>
            <p style={{ fontFamily: typeTokens.body, fontSize: 15.5, lineHeight: 1.6, color: colors.textSecondary, margin: '14px 0 18px' }}>
              {C.cta.body}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="email" value={email}
                onChange={e => { setEmail(e.target.value); if (e.target.value) setEmailHint(false); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder={C.cta.emailPlaceholder}
                style={{ flex: '1 1 240px', fontFamily: typeTokens.body, fontSize: 15, padding: '15px 18px', borderRadius: 14, border: `1px solid ${colors.borderDefined}`, background: colors.bgSurface, color: colors.textPrimary, outline: 'none' }}
              />
              <motion.button
                onClick={handleSubmit}
                animate={{ boxShadow: ['0 0 0 0 rgba(45,90,110,0)', '0 0 0 8px rgba(45,90,110,0.14)', '0 0 0 0 rgba(45,90,110,0)'] }}
                transition={{ duration: 1.8, ease: EASE, repeat: Infinity, repeatDelay: 0.8 }}
                style={{ fontFamily: typeTokens.body, fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '15px 26px', borderRadius: 14, border: 'none', whiteSpace: 'nowrap', background: colors.accentPetrol, color: colors.textOnDeep, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {C.cta.button} <ArrowRight size={18} />
              </motion.button>
            </div>
            {emailHint && !email && (
              <p style={{ fontFamily: typeTokens.body, fontSize: 12.5, color: colors.accentPetrol, fontWeight: 600, margin: '10px 0 0' }}>{C.cta.emptyNudge}</p>
            )}
            <p style={{ fontFamily: typeTokens.body, fontSize: 11.5, lineHeight: 1.5, color: colors.textMuted, margin: '14px 0 0' }}>{C.cta.honesty}</p>
          </div>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}

// Tile wrapper: a focusable button that visually lifts when open.
function GaugeTile({ open, onClick, tileBase, children }: { open: boolean; onClick: () => void; tileBase: React.CSSProperties; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      style={{ ...tileBase, boxShadow: open ? '0 8px 24px rgba(26,24,20,0.10)' : 'none', borderColor: open ? colors.accentPetrol : colors.borderWhisper, outline: 'none' }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Verify it typechecks and builds**

Run: `npm run build`
Expected: build succeeds. If any `colors.*` or `typeTokens.*` token name does not exist, open `src/components/landing/tokens.ts`, find the nearest correct token, and use it (do NOT introduce raw hex beyond the warm/gold/petrol accents already present in `ScanReveal.tsx`, copy from there if unsure). Do NOT change any string from `scanDiagnosisCopy`.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/ScanDiagnosis.tsx
git commit -m "feat(scan-diagnosis): four-metric interactive diagnosis screen"
```

---

## Task 7: Frontend — wire ScanDiagnosis into ScanPanel, remove in-file dead code

**Files:**
- Modify: `src/pages/MockLandingPage.tsx`

**Interfaces:**
- Consumes: `ScanDiagnosis` (Task 6).
- Produces: `ScanPanel` renders `ScanDiagnosis` after a successful scan; its CTA fires a fire-and-forget lead capture then opens the unchanged `GetStartedModal`.

> **Why the dead-code removal is in this task:** the frontend tsconfig sets
> `noUnusedLocals: true`, so the build fails if `roadmap`, `revealStep`, the
> legacy reveal block, or the `ScanReveal` import are left unused. They must go
> together with the swap. The `ScanReveal.tsx` FILE and backend functions stay on
> disk until Task 9.

- [ ] **Step 1: Add the optional metric fields to the local `CvGapResult` interface**

In `src/pages/MockLandingPage.tsx`, find `interface CvGapResult {` (around line 59). Add these optional fields before its closing brace:

```ts
  atsRisk?: boolean;
  atsReasons?: string[];
  dutyBullets?: number;
  totalBullets?: number;
  keywordsExpected?: number;
  keywordsPresent?: number;
  keywordsMissing?: string[];
```

- [ ] **Step 2: Swap the import**

In `src/pages/MockLandingPage.tsx`, change the `ScanReveal` import line:

```ts
import { ScanReveal } from '../components/landing/ScanReveal';
```

to:

```ts
import { ScanDiagnosis } from '../components/landing/ScanDiagnosis';
```

- [ ] **Step 3: Replace the email submit handler and remove roadmap state**

In `ScanPanel`, remove these state declarations and handlers (they belong to the old roadmap flow): `roadmap`, `setRoadmap`, `roadmapError`, `setRoadmapError`, `revealStep`, `setRevealStep`, `emailLoading`, `setEmailLoading`, the `handleEmailSubmit` function, both reveal-step `useEffect` timers, and the `SHOW_LEGACY_REVEAL` constant.

Add a single new handler in their place:

```ts
// Capture the lead (fire-and-forget, never block the modal) then open the
// confirmation modal. Mirrors the old funnel handoff minus the roadmap.
const handleDiagnosisSubmit = () => {
  if (!result?.scanId || !email) return;
  api.post('/cv-scan/lead', { scanId: result.scanId, email }).catch(() => {});
  setShowGetStarted(true);
};
```

Also remove `setRoadmap(null)` and `setRoadmapError(null)` from `handleRetry` (keep the rest of `handleRetry`).

- [ ] **Step 4: Replace the render block**

Replace the `<ScanReveal ... />` JSX block and the entire `{SHOW_LEGACY_REVEAL && ...}` block with:

```tsx
{status === 'done' && result && (
  <ScanDiagnosis
    result={result}
    email={email}
    setEmail={setEmail}
    onSubmitEmail={handleDiagnosisSubmit}
    onClose={handleRetry}
  />
)}
```

Leave the `{showGetStarted && result && (<GetStartedModal .../>)}` block exactly as it is.

- [ ] **Step 5: Remove the now-orphaned `RoadmapStep` interface if unused**

Search `src/pages/MockLandingPage.tsx` for `RoadmapStep`. If the only remaining references were the ones you just deleted, delete the `interface RoadmapStep { ... }` declaration too. If anything still references it, leave it.

- [ ] **Step 6: Verify the build passes**

Run: `npm run build`
Expected: `tsc -b && vite build` both succeed with no unused-variable errors. If you see `'X' is declared but its value is never read`, you left a roadmap/reveal local behind, remove it.

- [ ] **Step 7: Commit**

```bash
git add src/pages/MockLandingPage.tsx
git commit -m "feat(scan-diagnosis): wire diagnosis screen into landing funnel"
```

---

## Task 8: Staging verification checkpoint

**No code.** This task is a manual gate. Per the project deploy topology, **staging
deploys to the Vercel PREVIEW url, not the production domain.**

- [ ] **Step 1: Push the branch and let it deploy to the staging preview**

```bash
git push
```

- [ ] **Step 2: Manually walk the full funnel on the staging PREVIEW url**

Verify, in order:
1. Upload a real CV (use one with duty-led bullets and, separately, one with a clean single-column layout to see both ATS states).
2. The diagnosis screen renders four gauges with REAL numbers (the impact count matches the resume; ATS shows pass for clean, fail for a text-box/table layout).
3. Each tile expands: ATS animation plays, impact flip-card flips, relevance shows missing-keyword chips, presentation lists issues.
4. Enter an email, click "Put it to work" -> the `GetStartedModal` opens with that email pre-filled (read-only).
5. Set a password, confirm roles + location, submit -> lands on the dashboard with the feed building.
6. Confirm reduced-motion: with OS "reduce motion" on, animations settle to static, nothing breaks.

- [ ] **Step 3: STOP AND REPORT**

**Do not proceed to Task 9.** Report the results of the walk-through to the human.
If anything failed, the fix is a revert of the Task 7 commit (`git revert`), which
restores the old `ScanReveal` flow while the issue is investigated. Only continue
to cleanup once the human confirms the new flow works on staging.

---

## Task 9: Cleanup orphaned code (ONLY after Task 8 is confirmed)

**Files:**
- Delete: `src/components/landing/ScanReveal.tsx`
- Modify: `server/src/services/cvGapScan.ts` (remove `runRoadmap` + `buildRoadmapPrompt` + `RoadmapStep`), `server/src/services/email.ts` (remove `sendRoadmapEmail`).

- [ ] **Step 1: Confirm nothing imports the targets**

Run each and confirm ZERO matches (other than the definitions themselves):

```bash
grep -rn "ScanReveal" src server
grep -rn "runRoadmap\|buildRoadmapPrompt" server/src
grep -rn "sendRoadmapEmail" server/src
grep -rn "RoadmapStep" src server
```

If any usage remains beyond the definitions, **STOP AND REPORT** rather than deleting.

- [ ] **Step 2: Delete the orphaned frontend component**

```bash
git rm src/components/landing/ScanReveal.tsx
```

- [ ] **Step 3: Remove the dead backend functions**

In `server/src/services/cvGapScan.ts`, delete `buildRoadmapPrompt`, `runRoadmap`, and the `RoadmapStep` interface (the `§D – Roadmap generation` section). In `server/src/services/email.ts`, delete `sendRoadmapEmail` and remove any now-unused imports it leaves behind (e.g. the `RoadmapStep` type import).

- [ ] **Step 4: Verify both builds pass**

Run: `npm run build`
Expected: frontend build succeeds.
Run: `cd server && npm run build && npm test`
Expected: server compiles and all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(scan-diagnosis): remove dead roadmap + ScanReveal code"
```

- [ ] **Step 6: STOP AND REPORT** — redesign complete, dead code removed, ready for the human to merge staging to master when satisfied.

---

## Self-Review (author's check against the spec)

- **Spec coverage:** Section 2 scope -> Tasks 1,2,7,9. Section 3 gauges -> Tasks 4,6. Section 4 interaction/visuals -> Tasks 5,6. Section 5 copy -> Task 3 (verbatim). Section 6 passthrough -> Tasks 1,2. Section 7 wiring -> Task 7. Section 8 lead trim -> Task 2. Section 8b guardrails -> optional fields (Task 1), defer deletion (Tasks 7/8/9), frozen modal (Task 7 leaves it untouched), no migration (none present), staging preview (Task 8). All covered.
- **Placeholder scan:** no TBD/TODO; all code blocks are concrete.
- **Type consistency:** `deriveScanMetrics` signature identical in Tasks 1 and its test. `ScanInput`/`GaugeModel`/`buildGaugeModel` names consistent across Tasks 4 and 6. `ScanDiagnosis` prop names (`onSubmitEmail`, `onClose`, `setEmail`) match between Task 6 definition and Task 7 usage. Passthrough field names identical across cvGapScan.ts, cv-scan.ts, and the frontend interface.

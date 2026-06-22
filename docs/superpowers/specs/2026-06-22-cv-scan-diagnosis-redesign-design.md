# CV Scan Diagnosis Redesign — Design Spec

Date: 2026-06-22
Status: Approved for planning
Owner: Claude (copy + spec) / Kimi (implementation)

## 1. Goal

Replace the current scroll-driven CV scan reveal with a single, highly visual,
interactive **diagnosis** screen scored over four fixed metrics. It must read in
one grasp (not homework), build trust through interactive education, and drive
the user to one decision: stop perfecting a resume, start using a system.

The flow tightens from three report stages to one:

- **Before:** upload -> basic report -> (email gate) -> full report + 7-step roadmap -> click -> confirmation modal -> dashboard
- **After:** upload -> **four-metric interactive diagnosis** -> reframe CTA captures email -> confirmation modal (unchanged) -> dashboard

The email-gate, the full report, the 7-step roadmap, and the roadmap email are
**removed entirely**.

## 2. Scope boundary (read this first)

This is a display redesign plus a thin data passthrough. It is NOT a change to
the analysis brain.

**Unchanged (do not touch):**
- The scan analysis itself: `runCvGapScan`, the LLM prompt, the scoring rubric,
  `detectAtsStructure`, `computeSignals`. No new LLM calls. No new model fields.
- `GetStartedModal.tsx` (the confirmation modal: password + role chips +
  location). Its contract stays `{ scanId, firstName, email }`.
- The dashboard and its real-time feed build.

**Changed:**
- Backend: `buildScanResponse` (cv-scan.ts) surfaces already-computed values
  (passthrough only, see Section 6).
- Frontend: a new `ScanDiagnosis` component replaces `ScanReveal` in `ScanPanel`
  (MockLandingPage.tsx). The roadmap/email-gate state and UI are deleted.
- Backend cleanup: the `/cv-scan/lead` endpoint is trimmed to a fast lead-capture
  (no roadmap generation, no roadmap email). `runRoadmap` and `sendRoadmapEmail`
  become dead and are removed.

**Copy source rule:** all persuasive and educational copy on this screen is
**static, hand-written, hardcoded** (no LLM). Only numbers and the user's own
resume snippets are dynamic, and those come from data already computed today.
The old narrative prose (`firstImpression`, `reassurance`, `hiringManager`) is
NOT reused as display copy. The screen feels personal because the data is
personal, not because a model wrote sentences.

## 3. The four gauges (data -> display)

Each gauge is anchored to a real, provable number. No arbitrary scores.
Collapsed state shows only: icon + label + verdict + the real number. Lean.

### Gauge 1 — Machine readability (ATS), binary pass/fail
- **Source:** `atsRisk` (passthrough of `ats.risk`). `atsReasons` for detail.
- **Collapsed:** PASS -> green check, "A machine can read your resume." FAIL ->
  red, "A machine can't read this, so a human never sees it."
- **Not a fill.** It is a hard binary state, visually distinct from the other
  three gauges (which use ring fills).

### Gauge 2 — Impact vs duties, real count
- **Source:** `dutyBullets` of `totalBullets` (passthrough of
  `dutyOpeningCount` / `bulletCount`).
- **Collapsed:** "{dutyBullets} of {totalBullets} bullets describe duties, not
  results." Ring fill = the GOOD portion (outcome-led bullets / total).

### Gauge 3 — Australian market fit, gauge fill + reasoning, NO number
- **Source:** `keywordsPresent` / `keywordsExpected` (passthrough), plus
  `keywordsMissing` (the actual missing terms) for the expanded chips.
- **Collapsed:** part-full ring (felt, never labelled with a percentage) + a
  reasoning line selected by bucket (see Section 5 copy).

### Gauge 4 — Recruiter readability (presentation), count
- **Source:** the presentation-flavoured entries already in `items`. No new
  analysis. `presentationIssues` is derived on the frontend by filtering the
  existing `items` array (see Section 6 note). N = count of those items.
- **Collapsed:** "{N} things slow a recruiter down on a 6-second skim."

**Gauge-fill semantics (consistency rule):** for the three ring gauges, a FULLER
ring is always better (fill = the good portion). The ATS gauge is the deliberate
exception: a single binary state, not a fill.

## 4. Screen structure & interaction

Layout: **2x2 gauge grid that expands in place.**

- All four gauges visible in one viewport = the one-grasp gut-punch.
- Tapping a tile expands THAT tile inline to reveal its interactive proof; the
  others quietly collapse. Driven by user curiosity (purposeful interaction, not
  decoration). Every expansion teaches one thing and nudges back to the CTA.
- The reframe CTA is pinned/always reachable below the grid.

**Expanded states (full interactive visuals, SVG + CSS + Framer Motion ONLY —
no three.js, no WebGL, must load light):**

- **ATS expand:** an animated mini-demo. A clean single-column resume slides
  through a scanner and emerges as neat, filled fields. Then the user's layout
  type slides through and emerges scrambled / half-empty. The user watches *why*
  a machine drops it. One static caption explains what an ATS is and why it runs
  before any human. If `atsRisk` is false, show the clean pass animation only,
  framed as a win.
- **Impact expand:** the **flip-card**. The user's real bullet on the front
  (from `culturalTranslations[].wrote`, falling back to a duty-opening bullet),
  tap to flip to the stronger outcome-led rewrite
  (`culturalTranslations[].instead`). Caption: "Found {dutyBullets} like this."
- **Relevance expand:** the missing terms (`keywordsMissing`) animate in as
  greyed-out chips settling around the ring; one static line on what local JDs
  scan for.
- **Presentation expand:** the issue items listed, each a tight one-liner, with a
  small marker animating onto a mini resume thumbnail.

**Accessibility:** honor `prefers-reduced-motion` — all animations degrade to
their final static state. Tiles are keyboard-focusable and expand on Enter/Space.

## 5. Locked copy (constants — Claude owns; Kimi transcribes verbatim)

No em dashes or en dashes anywhere. No visa mentions.

### Screen header (frames the diagnosis)
- With name: `{firstName}, here's what a recruiter sees in 6 seconds.`
- No name: `Here's what a recruiter sees in 6 seconds.`
- Subline: `Four things decide whether your resume gets read. Here's how yours scores.`

### Gauge labels
- ATS: `Machine readability`
- Impact: `Impact vs duties`
- Relevance: `Australian market fit`
- Presentation: `Recruiter readability`

### Gauge 1 (ATS) copy
- Pass verdict: `A machine can read your resume.`
- Fail verdict: `A machine can't read this, so a human never sees it.`
- Education (static, shown on expand): `Most Australian employers auto-scan every
  resume before a person looks at it. Text boxes, tables and columns scramble that
  scan, so a strong resume can score near zero and get filtered out before anyone
  reads a word.`

### Gauge 2 (Impact) copy
- Verdict template: `{dutyBullets} of {totalBullets} bullets describe duties, not results.`
- If dutyBullets is 0: `Your bullets lead with results. Keep doing this.`
- Flip-card front label: `What you wrote`
- Flip-card back label: `What gets read`
- Caption: `We found {dutyBullets} bullets like this. Here's one.`

### Gauge 3 (Relevance) reasoning lines (bucket by keywordsPresent/keywordsExpected ratio)
- Strong (ratio >= 0.7): `Speaks to most of what local employers scan for.`
- Partial (0.4 to 0.7): `Speaks to some of what local employers scan for, but misses several expected terms for your role.`
- Weak (< 0.4): `Misses most of the terms Australian employers scan for in your field.`
- Expand line: `These are the terms local job ads for your role expect to see.`

### Gauge 4 (Presentation) copy
- Verdict template: `{N} things slow a recruiter down on a 6-second skim.`
- If N is 0: `Clean and easy to skim. Nothing slowing a recruiter down.`

### Authority bridge (2 to 3 lines, sits between the grid and the CTA)
`We have seen this a thousand times, so let's be straight with you. Right now you
are about to spend another month tweaking this resume, sending it into the void,
and hearing nothing back. That silence is not about your talent. It is about
everything a resume on its own can never do.`

### CTA hero
- Headline: `You don't need a better resume.`
- Headline line 2: `A better resume won't get you hired. A system will.`
- Body: `Everything you just saw, we fix automatically, on every job you apply to.
  Then we show you the Australian employers hiring right now. That is the
  difference between a better document and an actual job.`
- Email placeholder: `Enter your email`
- Button: `Put it to work`
- Honesty line (retention spine, small, under the button): `Free to start. No
  card. This takes a few weeks of real effort, not a magic button, and we will
  show you exactly how.`
- Empty-email nudge: `Pop your email in and we'll get you set up.`

## 6. Backend passthrough (cv-scan.ts)

Add already-computed values to the response. No new computation, no LLM change.

`runCvGapScan` already computes `signals` (in `computeSignals`) and the keyword
match. Thread these out of the service so the route can include them:

- Extend `CvGapResult` with the fields below. **They MUST be optional (`?:`)** so
  existing `CvGapResult` literals do not break at compile time (notably
  `server/src/tests/jobTitleSuggest.test.ts` constructs a full literal, and
  `assembleResult` constructs the object). Optional = purely additive, no caller
  breaks.
  - `atsRisk?: boolean`, `atsReasons?: string[]` (from the `ats` arg already passed in)
  - `dutyBullets?: number` (= `signals.dutyOpeningCount`)
  - `totalBullets?: number` (= `signals.bulletCount`)
  - `keywordsExpected?: number`, `keywordsPresent?: number`
  - `keywordsMissing?: string[]` (expectedKeywords minus presentKeywords)

- `buildScanResponse` adds those fields to the JSON it returns. It keeps `score`,
  `inferredRole`, `firstName`, `fullName`, `items`, `quickWins`, `scanId`. The
  narrative fields (`firstImpression`, `reassurance`, `hiringManager`,
  `culturalTranslations`) are still returned because the impact flip-card uses
  `culturalTranslations`; the rest go unused by the new UI (harmless).

**Presentation count note:** `presentationIssues` is NOT a new backend field. The
frontend filters the existing `items` array for presentation/readability-flavoured
entries (everything that is not the ATS-format item and not a keyword item). This
keeps the promise of zero new analysis. If this proves too fuzzy in QA, that is a
follow-up decision, not part of this slice.

## 7. Frontend wiring (MockLandingPage.tsx / ScanPanel)

- Build `src/components/landing/ScanDiagnosis.tsx` (new), replacing `<ScanReveal>`.
  Props: `{ result, email, setEmail, onSubmitEmail, onClose }`. It renders the
  grid + expansions + authority bridge + CTA.
- On CTA submit (valid email): fire-and-forget the lightweight lead capture
  (Section 8), then open the existing `GetStartedModal` with
  `{ scanId, firstName, email }`. Snappy: do not block the modal on the capture.
- Delete from `ScanPanel`: `roadmap`, `roadmapError`, `revealStep`,
  `handleEmailSubmit` (roadmap version), the auto-advance reveal timers, the
  `SHOW_LEGACY_REVEAL` dead block, and the `ScanReveal` import/usage.
- `handleEnterDashboard` -> opening `GetStartedModal` stays.
- Lock all copy in a constants module (e.g. `scanDiagnosisCopy.ts`) so Kimi
  transcribes, not authors.

## 8. Backend cleanup (lead capture)

- Trim `POST /api/cv-scan/lead`: keep the email validation and the
  `prisma.cvScanLead.upsert`; REMOVE the `runRoadmap` call, the
  `sendRoadmapEmail` call, and the roadmap response. Return `{ ok: true }` fast.
- Remove now-dead `runRoadmap` (cvGapScan.ts) and `sendRoadmapEmail` (email.ts)
  and their imports. Confirm no other caller first.

## 8b. Guardrails (risk containment — non-negotiable)

These keep the moderate frontend-swap risk contained. The plan must enforce them.

1. **Passthrough fields are optional.** See Section 6. Adding them must not break
   any existing `CvGapResult` consumer or test literal.
2. **Do NOT delete `ScanReveal.tsx`, the roadmap UI, `runRoadmap`, or
   `sendRoadmapEmail` in the same step as building the new screen.** Build and wire
   `ScanDiagnosis` first, verify the full funnel on the staging preview URL, and
   only then remove the old code in a final cleanup step. This keeps a working
   fallback until the new flow is proven live.
3. **The `GetStartedModal` contract is frozen:** `{ scanId, firstName, email }`.
   The new screen must hand off exactly these. Do not modify `GetStartedModal`.
4. **No DB migration, no schema change, no change to what `cvScanLead.upsert`
   writes.** If a step seems to require any of these, STOP and report.
5. **Verify on the staging preview (Vercel preview URL), not the prod domain**, per
   the project deploy topology. Master is production.

## 9. Non-goals / explicitly out of scope

- No change to the confirmation modal, the dashboard, the feed build, or the
  trial model.
- No new LLM calls or prompt changes.
- No three.js / WebGL / heavy animation libraries.
- The dashboard "jobs sourcing in real time" wait UX is not part of this slice.

## 10. Success criteria

- Stranger uploads a CV and within one screen understands their four scores at a
  glance, with at least one interactive expansion that teaches something true
  about their own resume.
- Every number shown is real (matches the deterministic counts), never arbitrary.
- The CTA hands a captured email to the unchanged confirmation modal and reaches
  the dashboard, identical to today's downstream flow.
- No new LLM cost per scan versus today.

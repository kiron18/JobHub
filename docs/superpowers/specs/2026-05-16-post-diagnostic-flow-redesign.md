# Post-Diagnostic Flow Redesign — Wizard Removal, JD-Time Enrichment, Progressive Intelligence

*Spec — 2026-05-16*

## Problem

Today's path from "resume uploaded" to "first application sent" is:

```
Upload → Processing → Diagnostic (forced) → Setup Wizard 7 steps (forced)
       → Dashboard → Paste JD → Generate → Apply
```

The Setup Wizard sits between the diagnostic and the first real act of applying. It asks the user to confirm, edit, or write content the AI either already has (parsed resume) or will regenerate per-JD anyway (summary, skills, polished bullets). The only field the wizard collects that the AI genuinely *cannot* generate without hallucinating is **metrics on achievements** — concrete numbers only the user knows.

Three compounding problems:

1. **Wizard friction.** Seven steps of editing pre-populated forms is the highest-effort moment in the product and produces the lowest user-perceived value. Users haven't yet experienced the AI's core capability (generating a tailored application) when we ask them to do this work.
2. **Diagnostic is treated as a one-time gate.** Users read it once and never return. It does the job of trust-building well but generates no compounding value over the user's lifetime.
3. **No reinforcement loop on applying.** Applying — the only behaviour that produces interviews — has no escalating reward attached to it. The user gets the same dashboard whether it's their first application or their fiftieth.

## Goals

- Reduce time from upload to first generated resume from ~10 minutes of form-filling to one paste + one click for users who want to move fast.
- Collect the irreducible data (metrics, gap-fills) at the moment of highest motivation — when the user is staring at a real job they want.
- Make the resume genuinely improve with use, via permanent enrichment of the user's achievement records every time they apply.
- Turn applying into a reinforcement loop by progressively unlocking insights that are only generable from their actual application behaviour.
- Preserve the diagnostic's role as a trust-building artefact, without forcing every user to read it linearly before they can act.

## Non-goals

- Removing or weakening the diagnostic itself. The May 13 diagnostic revamp and the May 14 Section 5 revamp are preserved as-is.
- Replacing the existing JD analysis or resume generation engines. Those stay; we add a thin enrichment layer in front of generation.
- Building a full gamification system. The Strategic Intelligence track adds *real* insights driven by behaviour data, not points or badges.
- Backwards-compatibility hacks. The `/setup` route, `SetupWizard.tsx`, and `jobhub_setup_complete` localStorage flag are deleted outright.

## New flow

```
Upload
   ↓
Parse + Quality Gate
   ↓
   ├─ Parse OK ──────────────────────────────┐
   │                                          │
   └─ Parse essentially empty ─→ "From-scratch" minimal capture
                                  (4 prompts: name, last role, one achievement, target role)
                                  ↓
                                  Synthesised profile ──────────┐
                                                                 │
                                                                 ↓
                                                          Diagnostic generated
                                                                 ↓
                                                  ┌──────────────────────────────┐
                                                  │  Two-path screen:              │
                                                  │  ── Primary: Apply now →       │
                                                  │  ── Secondary: See diagnostic  │
                                                  └──────────────────────────────┘
                                                                 ↓
                                                          Dashboard
                                                                 ↓
                                                          User pastes JD
                                                                 ↓
                                                          JD analysis runs (existing)
                                                                 ↓
                                                  ┌──────────────────────────────┐
                                                  │  Match score + 3 insights      │
                                                  │  + NEW conversational           │
                                                  │     enrichment prompts          │
                                                  │     (impact-ordered, skippable) │
                                                  └──────────────────────────────┘
                                                                 ↓
                                                          Resume + cover letter generated
                                                                 ↓
                                                          Apply / track (existing)
                                                                 ↓
                                                          Strategic Intelligence
                                                          unlock card progresses
```

---

## Component design

### 1. Parse-quality gate (handles the "non-resume" upload)

The existing parser already returns a structured profile. After parsing, evaluate completeness:

- Did we extract a name? (string non-empty)
- Did we extract any experience entries? (≥1)
- Did we extract any education entries? (≥1)

If **all three are empty** (i.e., parser found essentially nothing usable), do not proceed to the diagnostic. Show a modal:

> **"We couldn't read this as a resume."**
>
> This usually happens when the file is the wrong type, scanned as an image, or just doesn't contain the right info.
>
> [ Try a different file ]   ← primary
> [ Build from scratch in 5 mins → ] ← secondary

The "try again" path simply re-opens the upload picker. The "from scratch" path enters the minimal capture flow below.

### 2. From-scratch minimal capture (the genuine new-user case)

For users who legitimately don't have a resume to upload, replace the old 7-step wizard with **four sequential prompts**:

1. **Name** — single field
2. **Last (or current) role** — company / title / start date / end date or "still here"
3. **One achievement from that role** — free text only, no follow-up prompt. Take it as-is; JD-time enrichment will sharpen it when relevant
4. **Target role + city** — single screen, two fields

After step 4, the system synthesises a minimal profile and generates a diagnostic. The flow re-joins the main path at the diagnostic stage.

The diagnostic generated from this thin synthesised profile is necessarily lighter than one generated from a real resume — it leans on benchmarks ("candidates landing roles at your target level typically have 6+ quantified achievements; you have 1") rather than gap analysis of existing content. The two-path screen that follows still offers "Start applying" as the primary action, and the conversational JD-time enrichment fills the data gaps from there.

This is the *only* place where structured upfront capture survives, and it exists only for the edge case of users with no resume at all. Most users (those who upload a real resume) will never see it.

### 3. Post-diagnostic two-path screen (Apply now vs. See diagnostic)

Replace the current "Done → /setup" navigation with a two-path screen rendered immediately after the diagnostic is computed. Visual hierarchy is asymmetric: applying is the primary action, the diagnostic is the secondary path.

Layout:

```
   Your resume is parsed. We found 3 things
   that are quietly killing your applications.

   ┌─────────────────────────────────────────┐
   │  →  Start applying with your             │
   │     improved resume                       │
   └─────────────────────────────────────────┘
            ← large, bold, primary CTA

   or see what we found  →
            ← secondary text link
```

Both paths terminate at the dashboard. The primary CTA navigates directly to `/` with the JD-paste field focused. The secondary link routes through the full diagnostic page and concludes with the existing Section 5 CTA (which also lands them on the dashboard).

### 4. JD-time conversational enrichment

This replaces the wizard's data-collection role entirely.

When a user pastes a JD and the existing analyser runs, it produces (in addition to the current match score + insights):

- A list of the user's achievements ranked by **relevance to this JD**
- Among those, a sublist of achievements that currently have **no real metric** (using the existing `isRealMetric` helper)

If that sublist is non-empty, the analysis result includes a prompt:

> **"We can sharpen N of your achievements for this role. 30 seconds and your resume hits harder."**
>
> [ Sharpen → ]   [ Skip and generate ]

Choosing "Sharpen" enters a one-question-at-a-time micro-flow. For each gap, the AI generates a **tailored natural-language question** rather than asking for a "metric." Examples:

| Parsed achievement | AI-generated question |
|---|---|
| "Helped grow Instagram at Canva" | "Roughly what did the follower count grow from and to — and over how long?" |
| "Managed projects at PwC" | "Around how many projects ran in parallel, and what was the biggest budget you owned?" |
| "Led the team" | "How many people did you lead, and what changed because you led them?" |

The user answers in natural language. The AI parses the answer into a structured metric + rewritten bullet, then displays both for one-tap confirmation:

> "I'll capture this as: *'Grew Instagram following from 4k to 22k in 6 months (5.5× growth).'* Looks right?"
>
> [ Yes, save ]   [ Edit ]

Confirmation locks the metric to the **achievement record** (not the application), so it persists across all future generations.

#### Session controls (no hard cap)

- One question at a time
- The match-score meter lifts visibly after each answer ("Match 62% → 68%") — real-time reinforcement
- A persistent **"Generate now with what we have →"** button on every screen, never disabled, never buried
- Questions are ordered by impact — highest-leverage prompt first
- After the third question, the styling of the exit button increases to equal weight with "Next question" — a gentle "you've done the heavy lifting" cue

This sidesteps the cap vs. scale tradeoff. The user always decides when to stop; we just show them what each answer is worth.

#### Compounding effect

Every answer persists on the achievement record. The next JD that touches the same achievement does not re-prompt. After 5–10 applications, prompts naturally taper off because the profile has been organically enriched at moments of high motivation.

### 5. AI-rewrite badge in the resume editor

Even if the user skips all conversational enrichment, they should still get a usable resume — with clear provenance on every line so they know what to verify.

Three line-level states in the generated resume editor:

| Source | Visual marker |
|---|---|
| Pulled verbatim from parsed resume | Unmarked |
| User provided a metric via conversational capture | Unmarked (these are theirs) |
| AI rewrote a parsed bullet without a real user-provided metric | `✨ AI-rewrite — review before sending` badge |

The badge is screen-only and never appears in printed/exported PDFs or DOCX. The existing inline editor lets the user accept, edit, or regenerate any marked bullet. Constraint: the AI is allowed to **rewrite phrasing** but never to invent numbers, names, dates, or quantitative claims absent from the source.

### 6. Diagnostic as a persistent surface, not a one-time gate

Today the diagnostic is gated behind `jobhub_report_seen` and effectively read once. After this redesign:

- A persistent **"Your diagnostic"** entry lives in the dashboard sidebar and profile menu, accessible at any time
- Skipping the diagnostic at the two-path screen does not "lose" it — it remains one click away forever
- The diagnostic findings are **threaded into the JD analysis screen** so users who skipped still encounter the relevant gaps at the moment they matter. Example: if the diagnostic flagged "your bullets lack metrics" and the user skipped reading it, the JD analyser surfaces this contextually: *"Heads up — when we read your resume we noticed your bullets are mostly duty-statements. This role is exactly where metrics would land. Want to fix these 3?"*
- After a user's first generation, if they skipped the diagnostic originally, surface a single subtle prompt: *"Want to see why your match score is what it is? View your diagnostic →"* — using the generation outcome as the hook

### 7. Progressive Strategic Intelligence (the unlock layer)

Adds a second layer of insight that genuinely cannot be computed until the user has applied. Each unlock is real analysis driven by their behaviour data, not contrived gating.

A dashboard card titled **"Strategic Intelligence"** shows the unlock track:

```
┌──────────────────────────────────────────┐
│  STRATEGIC INTELLIGENCE                    │
│                                            │
│  🔓 Diagnostic — your starting baseline    │
│  🔓 Application pattern — unlocked          │
│  🔒 Industry fit map — 2 apps to unlock    │
│  🔒 Personal playbook — 4 apps to unlock   │
│  🔒 Response-rate analysis — 9 to unlock   │
│                                            │
│  Next unlock in 2 applications →            │
└──────────────────────────────────────────┘
```

The counter on each locked row shows applications remaining *from the user's current count*, not the absolute threshold. The card example above depicts the state after one application has been sent (1/3 toward industry fit map → "2 to unlock"; 1/5 toward personal playbook → "4 to unlock"; 1/10 toward response-rate → "9 to unlock").

Unlock schedule:

| Trigger | Unlocks |
|---|---|
| Upload + parse | **Diagnostic** (immediate) |
| 1 application sent | **Application pattern** — comparison of roles applied to vs. roles the resume is actually competitive for |
| 3 applications sent | **Industry fit map** — match-score breakdown across industries the user has applied to |
| 5 applications sent | **Personal playbook** — personalised "your highest-leverage next move" based on full application history |
| 10 applications sent (and ≥30 days elapsed) | **Response-rate analysis** — patterns in which application types produce open/reply rates (requires the existing tracker data) |

Each unlock is a real analytic output. None of them could honestly be shown earlier — they all require behaviour data that doesn't exist yet. The progression is a side-effect of accuracy, not a manufactured drip.

This layer **does not replace** the original diagnostic. The diagnostic remains accessible from the moment of upload onward.

---

## Data model implications

Most of this is structural UX change. The minimal data changes:

- **Achievement records already have a `metric` field.** The conversational capture writes to this existing field — no schema change.
- **Add a per-bullet provenance flag** on generated resume bullets: `source: 'parsed' | 'user_metric' | 'ai_rewrite'`. Drives the editor badge.
- **Application tracker already records application events.** The Strategic Intelligence unlocks count off this existing data — no schema change.
- **Track which Strategic Intelligence unlocks the user has seen / dismissed in localStorage** (v1, since the product is not yet cross-device). When cross-device support lands, migrate to a `strategic_intelligence_unlocks` JSON column on the user profile. See "Tech debt followups" below.

No new external services. No new background jobs (Strategic Intelligence insights compute on-demand from existing data).

---

## What gets retired

- `src/pages/SetupWizard.tsx` — deleted entirely
- `/setup` route in `src/App.tsx`
- `jobhub_setup_complete` localStorage flag (and all references)
- `localStorage.setItem('jobhub_report_seen', 'false')` "back to diagnostic" behaviour in the wizard — replaced by the always-accessible diagnostic surface
- Wizard-specific coaching content for summary, skills, education, certifications, volunteering steps
- Wizard's competitive-progress strip (`COMPETITIVE_PROGRESS`)
- Wizard's duty-language warning modal (the same detection is repurposed for the editor's AI-rewrite badge logic)
- Wizard's reward overlay (`RewardOverlay`)
- The navigation step in `App.tsx` that currently routes `handleDone` from the diagnostic to `/setup`

---

## What gets kept

- The existing diagnostic flow, including the May 13 revamp and the May 14 Section 5 revamp
- Profile Bank as the deep-edit surface for users who want to manually polish (now genuinely optional, never blocking)
- The existing JD analysis engine, match score, and three-insight panel
- The existing resume + cover letter generation engines
- The application tracker
- The `isRealMetric` and `isDutyLikeBullet` helpers from `SetupWizard.tsx` — relocated to a shared utility module since they're still needed for analysis-time gap detection and the AI-rewrite badge logic

---

## Edge cases

- **Resume uploads but parser produces partial data** (e.g., name + experience but no education). Proceed normally. The diagnostic and JD analysis handle thin profiles fine; conversational enrichment will surface more prompts.
- **User skips conversational enrichment on every application.** The system still produces resumes from parsed data, with AI-rewrite badges on weak bullets. Match scores stay lower than they could be; the dashboard surfaces this as a soft nudge ("Your average match is 58%. Sharpening 3 achievements would lift this to ~72%.").
- **User answers a conversational prompt with nonsense or refuses to give a number** ("I dunno", "lots", "many"). The AI's confirmation step shows the parsed reformulation — if it's empty or nonsensical, fall back to leaving the metric blank and tag the bullet `ai_rewrite` for review.
- **User has only one achievement on the entire resume.** Conversational enrichment shows at most one prompt per session.
- **User uploads a second resume later** (replace flow). The new parse overrides the parsed source, but **persisted metrics on achievement records survive** because metrics are stored against achievement IDs, not against the parsed resume blob. If the new resume removes an achievement entirely, its metric record orphans — clean these up in a background sweep, not blocking the user.
- **User reaches an unlock threshold mid-session.** Show a toast: *"Unlocked: Application pattern →"* with a one-click reveal. Don't interrupt the flow with a modal.
- **User has applied 5 times via external means** (e.g., before signing up). Strategic Intelligence counts in-product applications only. Surface the threshold copy as *"5 applications through JobHub"* to set expectations.

---

## Decisions on open questions

1. **"From scratch" path — no conversational capture at step 3.** Take the free-text achievement as-is. Keep the initial path as short as possible; enrich through use at JD time.
2. **Strategic Intelligence storage — localStorage for v1.** The product is not yet cross-device, so the cleaner backend option is not yet worth the migration cost. Tracked as tech debt below.
3. **Application pattern unlock — visual side-by-side comparison.** Two-column card: left "Roles you've been applying to" (your actual JD pastes, grouped by seniority + industry), right "Roles your resume is actually competitive for" (top 5 from job-feed ranked by match score). Visual asymmetry between the two columns is the insight — a user applying to senior roles when their resume reads mid-level will see that gap at a glance.

## Tech debt followups

- **Migrate Strategic Intelligence unlock state from localStorage to a `strategic_intelligence_unlocks` JSON column on the user profile** once cross-device support is on the roadmap. Without this, a user who clears storage or signs in on a new device loses their unlock progress.

---

## Sequencing for build

This spec covers a single coherent design but is large. Suggested implementation slices for the plan phase:

- **Slice 1 (highest leverage):** Retire wizard + two-path post-diagnostic screen + parse-quality gate + from-scratch fallback. Net unlock: users can go diagnostic → dashboard → apply with no wizard in between.
- **Slice 2:** JD-time conversational enrichment + AI-rewrite badge + diagnostic threading into JD analysis. Net unlock: AI captures irreducible data at the moment of motivation; provenance is visible.
- **Slice 3:** Strategic Intelligence unlock card + first two unlocks (application pattern, industry fit map). Defer the heavier analytic unlocks (personal playbook, response-rate analysis) until after we see how the first two perform.

Each slice is shippable independently and produces measurable activation impact on its own.

---

## Out of scope (for this spec, considered for future)

- Cross-application learning beyond achievement metrics (e.g., "tone preferences" learned from edits the user makes to generated cover letters)
- A "draft another tailored version" flow for the same JD when the user wants to A/B different framings
- The notebook-LM chatbot idea mentioned in the Job Hub Revamped doc — separate exploration
- Multi-resume management (different resumes for different industries)

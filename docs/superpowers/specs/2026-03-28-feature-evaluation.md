# Feature Evaluation — March 28 2026

> **Purpose:** Honest assessment of 8 proposed changes. Rated by user impact, implementation effort, and alignment with the core goal: helping people land jobs.

---

## Guiding light

Every decision is measured against one question: **does this make it more likely a user gets the job?** Delight matters only when it serves that. Polish matters only when it removes friction on the critical path.

---

## 1. Responsiveness

**Verdict: Do it — but not yet. Schedule after core features are stable.**

**Difficulty: Medium (3–5 days of careful work)**

The app currently mixes Tailwind classes with inline `px` values throughout. The hardest components are `ProfileBank` (hardcoded two-column `320px` sidebar), `ReportExperience` (CSS columns masonry), and `MatchEngine` (fixed-width inputs).

**Approach when you're ready:**
- Replace fixed sidebar widths with `grid-template-columns: 1fr clamp(260px, 30vw, 340px)`
- Swap hardcoded font sizes for `clamp()` or Tailwind's responsive prefixes (`lg:text-2xl`)
- Make the masonry grid stack to single column on mobile: `columns: 1` below `768px`

**Why not yet:** Mobile job hunting is real (people apply from their phones), but the MVP value is in the _quality_ of what gets generated. A broken but functional tool on desktop that gets someone a job is better than a polished mobile UI that doesn't produce great documents. Come back to this in Phase 2.

---

## 2. Selection Criteria (SC) Generation

**Verdict: Build it. This is a genuine competitive moat.**

**Difficulty: Medium-High (5–8 days end to end)**

### Why this matters
Selection criteria are the dominant document format for Australian government and university jobs — two of the largest employment sectors in the country. Most candidates have no idea what they are, write them badly, or don't know one exists at all. A tool that writes strong SC responses automatically, from the achievement bank, is a significant differentiator.

### What we know about SC documents
- **Format varies by employer:** APS (federal) uses capability frameworks. State government uses competency frameworks. Universities use their own sets. Local government uses a mix.
- **APS Integrated Leadership System (ILS):** Defines criteria like "Achieves Results", "Supports Productive Working Relationships", "Displays Personal Drive and Integrity", "Communicates with Influence", "Exemplifies Personal Integrity and Self-Awareness". Bands 1–6 define seniority expectations.
- **Response format:** STAR (Situation, Task, Action, Result) is universal. Some agencies use CAR (Context, Action, Result) or SAO (Situation, Action, Outcome) — all are the same idea.
- **Word count:** APS typically 300–500 words per criterion. Universities 250–400. Some roles request "brief" responses of 100–200 words. Word count or page count is sometimes mentioned in the selection criteria document, this should mentioned in the educational tips.
- **Key quality markers:** Specific over generic. First-person active voice. Quantified outcomes. Direct evidence, not inferred claims. Written to the _level_ of the role (APS3 language vs EL2 language differs significantly).
- **Where SC documents live:** Often NOT in the position description — linked separately on the APS Jobs portal, in a separate PDF attachment, or emailed on request. This is a real pain point for candidates.

### What the feature needs to do
1. **Detection + education:** When a user pastes a JD, if `requiresSelectionCriteria` is true (already partially implemented), surface a clear explanation: _"This role requires a separate Selection Criteria response. For government and university jobs, this document lists specific capabilities you must address. You'll usually find it attached to the listing or on the agency's jobs portal."_ Also include messaging to ensure that the full selection criteria is copied which may include details like length and STAR or CA

2. **SC upload or manual entry:** Let the user paste/upload the actual SC document (separate from the PD). Each criterion becomes a separate field.

3. **Per-criterion generation:** For each criterion, retrieve the most relevant achievements from the bank (semantic search via Pinecone), structure a STAR response, calibrate word count to the target range, and match tone to the role level.

4. **Output:** Formatted DOCX/PDF based on user choice with each criterion as a headed section. APS formatting conventions (Times New Roman 12pt or Arial 11pt, single-spaced, page numbered).

### What's already in place
- `requiresSelectionCriteria` flag in JD analysis prompt
- Pinecone vector search for achievement retrieval
- Achievement bank with STAR-ready data
- DOCX export infrastructure (planned in Phase 1)

### What's missing
- SC upload / criterion parsing UI
- SC-aware generation prompt
- Per-criterion Pinecone retrieval (currently retrieves top N globally; should retrieve per criterion)
- Level calibration (APS3 vs EL1 language registers are different)
- SC-specific output template

### Recommendation
Build detection + education first (one sprint). Build full SC generation in Phase 2 alongside DOCX export since they share infrastructure.

---

## 3. Report Layout — Full-Width Horizontal Islands

**Verdict: Yes, and your instinct is correct. The masonry grid was wrong.**

**Difficulty: Medium (2–3 days)**

### Why the masonry grid fails
The current design puts 6 cards in a 3-column masonry layout. Problems:
- Users don't know which order to read
- Cards are short and truncated — not enough to grasp the insight
- The "open to expand" interaction is not obvious
- It looks like a dashboard, not a diagnosis

### What works better
The emotional arc for the report is: **recognition → relief → excitement**. That arc requires _sequence_. The user needs to read in order. Horizontal full-width islands that scroll vertically enforce sequence naturally.

### Proposed structure per island
```
┌─────────────────────────────────────────────────────────────┐
│  [Icon]  TARGETING                                           │
│                                                              │
│  What this means: 1-sentence plain-English explanation       │
│  Your situation: 1–2 sentence specific diagnosis             │
│                                                              │
│  [▼ Read your full diagnosis]   (expands to full content)   │
└─────────────────────────────────────────────────────────────┘
```

The collapsed state gives enough to hook them. The expand reveals the full analysis + fix. This respects scanning behaviour — people scan first, then commit to reading.

**Section explanations to add (what this metric means):**

| Section | One-liner explanation |
|---|---|
| Targeting | Whether you're applying to the right roles in the right places |
| Document Audit | Whether your resume and cover letters are doing their job |
| Pipeline Diagnosis | Where in the process applications are dropping off |
| The Honest Truth | What the data says vs what you think the problem is |
| Your 3-Step Fix | Concrete actions ranked by impact this week |
| What JobHub Does | How the platform closes the remaining gaps |

---

## 4. Hue Slider + Color System

**Verdict: Do it, but design it carefully. High ROI if done right.**

**Difficulty: Low (1 day)**

### Why this is good
Users spend meaningful time in this app — building their bank, reviewing documents, tracking applications. A tool they can make feel "theirs" has better retention. The implementation is genuinely simple: one CSS custom property (`--brand-hue`) drives all derived colors in OKLCH space. A small floating control near the theme toggle changes it.

### Why the realazy.com approach works
OKLCH hue rotation keeps lightness and chroma perceptually consistent as hue changes — you can't accidentally create an unreadable color combination the way you can with HSL. The hue becomes a single dial: turn it from blue-purple (default) through teal, green, warm amber, etc.

### Design constraints (important)
- **Not a big slider on the page.** A small icon (palette or circle) next to the theme toggle that opens a compact 180px popover with a thin hue strip. Dismiss on click-outside.
- **5–6 preset hues with a custom strip.** Presets are: Indigo (default) / Teal / Amber / Rose / Forest. Strip for fine-tuning.
- **Persist to localStorage.** Like dark mode — remember the user's choice.
- **Does not block content.** Fixed-position, small, top-right.

### Color system to lock in now
Currently the app mixes Tailwind `brand-*` colors, hardcoded hex values in inline styles, and `slate-*`. We need to consolidate. The right approach:

1. Define `--hue` as a CSS variable (default: `262` = indigo/purple)
2. All brand colors derived: `oklch(55% 0.18 var(--hue))` for primary, etc.
3. Replace all hardcoded `#6366f1`, `#818cf8`, `rgba(99,102,241,...)` references with derived values
4. This is the prerequisite for the hue slider to work correctly

---

## 5. Dark Mode Toggle Overlap

**Verdict: Quick fix, do it now.**

**Difficulty: Low (1–2 hours)**

The screenshot shows the theme toggle button (`position: fixed, top: 20, right: 20`) sitting over the "← Back to dashboard" button which is also `position: fixed, top: 16, right: 20`. They're literally in the same spot.

Fix: move "← Back to dashboard" to `top: 16, left: 20` (top-left, not top-right). The toggle stays top-right. No overlap.

More broadly, audit all `position: fixed` elements to ensure they don't collide:
- Theme toggle: `top: 20, right: 20` ✓
- Back button: move to `top: 16, left: 20`
- Toaster: `top-right` with `20px` offset from toggle

---

## 6. Text Legibility

**Verdict: Fix immediately. This is a trust issue, not just a UX issue.**

**Difficulty: Low (1 day)**

Poor contrast means the content doesn't reach the user. For an app whose job is to deliver insight, illegible text is a product-level failure.

**Known offenders:**
- "job Match analysis" — light gray on white background, fails WCAG AA
- "View again" button — insufficient contrast in both modes
- Dashboard card eyebrows (`text-slate-400` on `slate-900`) — borderline
- Report island body text — too light in light mode

**Fix approach:** Audit with browser devtools contrast checker. Any text below 4.5:1 ratio gets bumped. In light mode, body text should be `#111827` or `#1f2937`, muted text no lighter than `#4b5563`. In dark mode, muted text minimum `#9ca3af`.

---

## 7. "Let's Go" Beam Transition

**Verdict: Do it — but calibrate the duration ruthlessly.**

**Difficulty: Medium (2–3 days to do it right)**

This is a cherry on top, but it's the right kind of cherry. The transition from diagnosis → workspace is a meaningful emotional moment: "the hard part is over, now let's build." A moment of visual drama at exactly this point reinforces that feeling without being gratuitous.

### What works
- Duration: 500–700ms total. Any longer and it reads as lag.
- Sequence: Button click → brief flash of white/black (mode-dependent) → light streak motion (radial wipe or directional blur) → dashboard fades in from white/black
- Framer Motion `AnimatePresence` handles the exit/enter cleanly
- The "beam down" metaphor fits well — the user is being transported

### What to avoid
- Bounce or elastic easing (reads as playful, not premium)
- Particle effects that require GPU-heavy canvas rendering (causes jank on older machines)
- Any transition over 800ms (people will think it's loading)

### Technical approach
```tsx
// Exit animation on ReportExperience
exit={{ opacity: 0, filter: 'blur(8px) brightness(3)', scale: 1.04 }}
exitTransition={{ duration: 0.45, ease: [0.4, 0, 1, 1] }}

// Entry animation on Dashboard
initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.98 }}
animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
```

---

## 8. Dashboard — Paste Box + Contrast

**Verdict: Fix now. The paste box is where users spend the most time.**

**Difficulty: Low (2–3 hours)**

The MatchEngine paste area is the primary action surface of the dashboard. It should feel inviting and clear, not gray and confusing. Issues:
- Gray textarea background — should be white (light) / `slate-900` (dark)
- "job Match analysis" heading — casing is wrong (should be "Job Match Analysis" or rethink entirely), contrast fails
- "View again" button — too muted

Fix: white textarea background, `#111827` text, `1px solid #e5e7eb` border in light mode. Dark mode: `#111827` bg, `#f3f4f6` text, `1px solid rgba(255,255,255,0.1)` border.

---

## Prioritised Build Order

| # | Change | Impact | Effort | When |
|---|---|---|---|---|
| 1 | Fix overlap (#5) | Medium | Low | Now |
| 2 | Fix legibility (#6, #8) | High | Low | Now |
| 3 | Report layout redesign (#3) | Very High | Medium | Sprint 1 |
| 4 | Beam transition (#7) | Medium | Medium | Sprint 1 |
| 5 | Color system + hue slider (#4) | High | Low–Med | Sprint 1 |
| 6 | Selection Criteria foundation (#2) | Very High | High | Sprint 2 |
| 7 | SC full generation (#2) | Very High | High | Sprint 2 |
| 8 | Responsiveness (#1) | Medium | Medium | Sprint 3 |

---

## Additional Recommendations (unprompted)

These came up in review and are worth considering:

**A. Progress persistence between sessions**
Users leave and come back. Their achievement bank should feel like it's growing. A small visual indicator ("Bank score: 74% complete") on the dashboard creates a pull to improve it.

**B. Achievement quality scoring visible in the bank**
Currently coaching hints exist but are passive. A visible score per achievement (like a strength meter) creates immediate motivation to improve specific entries. This directly improves the quality of every generated document.

**C. "Why was this achievement matched?" transparency**
When a JD match score comes back, showing which achievements contributed and why (brief keyword match explanation) builds trust in the system and teaches users what the market actually values.

**D. Email notification when report is ready**
The processing screen currently requires the tab to stay open. For a 60-90 second wait, users abandon. A "We'll email you when your report is ready" option (we already collect marketing email) would recover those drop-offs.

**E. Mobile deep link for returning users**
The magic link auth already works. Pairing it with a share card ("Your JobHub report is ready — open on any device") widens reach and works well for mobile revisits.

# Site-Wide Warm Migration — Phase 2 (Spec + Implementation Plan)

**Date:** 2026-05-21
**Owner:** Kiron
**Implementing agent:** Deepseek (external)
**Status:** Awaiting user review before handoff
**Predecessor:** `2026-05-21-landing-page-redesign-b1.md` (the landing page that establishes the visual language this spec propagates)

---

## 0. How to use this document

This is the **Phase 2 spec** — bringing the rest of the JobHub site into the same B1 premium-warm visual language as the new landing page. Phase 1 (global font swap to Fraunces + Geist Sans) already shipped as part of the landing spec; this doc deals with palette, layout, component treatment, and surface-by-surface conversion of every authenticated page in the app.

The doc is structured so the implementing agent can execute it in **three independent batches** with user QA between each. Each batch is a separate deepseek run. You can also bundle them if you want speed over checkpoints.

Read top to bottom. Decisions are made; ambiguities are explicit; copy is unchanged from existing pages (this is a visual migration, not a content rewrite).

---

## 1. Context & problem

### 1.1 Where we are

- The landing page (`/` for unauthenticated users) is built in the new B1 premium-warm visual language: warm cream backgrounds (`#FAF7F2`), Fraunces serif headings, Geist Sans body, petrol CTAs (`#2D5A6E`), gold accents (`#C5A059`), whisper borders, multi-layer shadows, generous whitespace, hand-drawn illustration.
- Every authenticated page (`/strategy`, `/apply`, `/workspace`, `/jobs`, `/tracker`, `/documents`, `/email-templates`, `/linkedin`, `/admin`, etc.) is still in the **legacy dark theme**: backgrounds in the `#141517`–`#1E1F22` range, light text on dark surfaces, defined in `src/index.css` `:root` tokens.
- Phase 1 global font swap means every authenticated page already renders Fraunces in headings and Geist Sans in body — so type is unified across landing + app. Palette, layout, and component treatment are not.

### 1.2 Why this matters

A user signs up via the warm, editorial landing page, completes onboarding (which itself is half-converted), and lands on a dark dashboard. The visual whiplash undermines the brand promise within 5 seconds of converting. The point of this spec is to remove that whiplash — the user should feel like they crossed the threshold into a workshop that *belongs* to the same brand as the landing they trusted.

### 1.3 Decision recap (from the prior session)

The user picked **Option X — full warm-cream across the entire app**, not the safer "shared tokens, app stays dark" variant. The argument: this product's audience and density don't justify a dark productivity UI; the unified warm treatment serves brand cohesion better than dark serves functional density. We're committing to X. Phase 2 is the execution of that decision.

---

## 2. Goals & non-goals

### 2.1 Goals

- Every authenticated page in JobHub adopts the B1 premium-warm visual language: cream backgrounds, warm near-black text, petrol/gold accents, Fraunces/Geist typography (already in place), whisper borders and multi-layer shadows.
- The transition from landing → onboarding → diagnostic → dashboard reads as one continuous visual surface — same fonts, same palette, same component vocabulary.
- Functional surfaces (dashboards, workspaces, tables, forms) retain their density and information layout — we're changing *how they look*, not *what they do*.
- The migration happens in shippable batches so we can QA in chunks instead of a single high-risk drop.

### 2.2 Non-goals

- Not changing functionality. No new features, no removed features, no behaviour changes.
- Not changing routes, navigation structure, or page composition.
- Not changing analytics events, PostHog tracking, or backend API contracts.
- Not changing the landing page (it's the source of truth; this spec brings everything else to it).
- Not introducing a dark-mode toggle. The decision is full warm-cream across the app.
- Not rewriting page copy. Text content stays as-is.

---

## 3. Out of scope (do not touch)

- `src/pages/LandingPage.tsx` and `src/components/landing/**` — the landing is the source of truth. Do not modify.
- `src/App.tsx` routing structure — do not add, remove, or reorder routes.
- Backend, server, Prisma schema, API contracts — none of this is touched.
- PostHog event names or payload shapes — wired-in correctly already.
- Authentication flow logic (Supabase client, auth callback handling) — visual only.
- LLM prompts, document generation logic, parsing utilities — visual only.
- Test files, eval files, CI config — visual only.

If the agent finds itself about to change a function body, API call, or non-visual logic, stop. That's out of scope. Surface as an open question in §12 instead.

---

## 4. Strategy: per-page conversion using landing tokens

There are two coherent ways to migrate:

- **Token flip (fast, risky):** Change `:root` CSS variables in `src/index.css` from dark to warm-cream globally. Every component that uses `var(--color-bg)` etc. updates automatically. Components with hardcoded inline colors break loudly.
- **Per-page conversion (slower, safer):** Each page is converted in isolation. The page imports the landing token object directly (or uses the same hex values), replaces hardcoded inline dark colors with warm-cream equivalents, and is verified visually before moving to the next page.

**This spec uses per-page conversion.** The global token flip happens *last*, as the final consolidation step after all pages have been migrated. Until then, the dark tokens in `:root` stay in place — they become unused as pages migrate off them, then get deleted at the end.

Why this matters: many pages have inline `style={{ background: '#080b12' }}` or similar hardcoded colors that would break under a global flip. Per-page conversion lets us catch and fix each one deliberately.

---

## 5. Token foundation (the new shared visual language)

### 5.1 Where the tokens live

The landing page already exports its token object at `src/components/landing/tokens.ts`. **Phase 2 promotes this to a site-wide shared module** so authenticated pages can import the same values.

**Action:** Move/copy the token object to a new shared location: `src/lib/theme/warmTokens.ts`. The landing tokens.ts re-exports from this new location so the landing isn't disturbed.

```typescript
// src/lib/theme/warmTokens.ts
export const warm = {
  colors: {
    bgCanvas:    '#FAF7F2',
    bgSurface:   '#FFFFFF',
    bgAlt:       '#F4EFE8',
    bgDeep:      '#2A2520',
    textPrimary: '#1A1814',
    textSecondary: '#5C5750',
    textMuted:   '#8B847B',
    textOnDeep:  '#FAF7F2',
    borderWhisper:  'rgba(26, 24, 20, 0.08)',
    borderDefined:  'rgba(26, 24, 20, 0.16)',
    accentPetrol:        '#2D5A6E',
    accentPetrolHover:   '#1F4253',
    accentPetrolPressed: '#15323F',
    accentGold:          '#C5A059',
    accentGoldSoft:      '#E8D7B0',
    success:    '#2A9D6F',
    ringFocus:  'rgba(45, 90, 110, 0.40)',
  },
  type: {
    fontDisplay: 'Fraunces, Georgia, serif',
    fontBody:    'Geist Sans, -apple-system, system-ui, sans-serif',
  },
  spacing: {
    // 8px base
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
    // Section padding tokens for in-app surfaces (TIGHTER than landing's marketing-spaced 120px)
    sectionPadDesktop: 56,  // vs landing's 120
    sectionPadMobile:  40,  // vs landing's 72
  },
  radius: {
    input: 10, button: 10, card: 16, pill: 9999,
  },
  shadow: {
    soft:    '0 1px 2px rgba(26,24,20,0.04), 0 4px 16px rgba(26,24,20,0.04)',
    lifted:  '0 1px 3px rgba(26,24,20,0.04), 0 6px 20px rgba(26,24,20,0.06), 0 18px 48px rgba(26,24,20,0.04)',
  },
} as const;
```

### 5.2 What stays the same as landing

- Palette hex values (identical to landing)
- Typography family + weight stack (identical)
- Shadow definitions (identical)
- Border radius values (identical)

### 5.3 What's adjusted for in-app surfaces

In-app pages are *functional surfaces*, not marketing pages. The landing's 120px section padding and ~88vh hero areas would feel absurd on a dashboard. The adjustments:

| Token | Landing value | In-app value | Reason |
|---|---|---|---|
| Section vertical padding | 120px desktop / 72px mobile | **56px desktop / 40px mobile** | Dashboards need density, not whitespace excess |
| Page max-width | 1100px (text/section content) | Same — but dashboards may extend to 1280px for data tables | More horizontal real estate when needed |
| H1 size | clamp(2.5rem, 6vw, 4.5rem) | clamp(1.75rem, 3vw, 2.5rem) | In-app page titles are working titles, not marketing headlines |
| Card padding | 32px / 24px mobile | 24px / 20px mobile | Density |

Everything else stays identical to landing tokens.

### 5.4 What does NOT carry over from landing

- The hero illustration mask-reveal animation (landing-only — never in-app)
- Section-to-section background alternation (landing-only — in-app pages stay on `bgCanvas` consistently)
- Grain texture on section bands (in-app surfaces *can* use grain on CTAs and selected accent surfaces, but not as full-section bands)
- Decorative serif-italic asides (in-app surfaces stay declarative; no editorial flourishes mid-page)

---

## 6. Functional UI considerations

This is the hard part. Warm-cream marketing aesthetics need careful handling on dense functional surfaces. The rules:

### 6.1 Surface hierarchy

| Layer | Token | Use |
|---|---|---|
| Page canvas | `bgCanvas` (#FAF7F2) | The page background everywhere — including dashboards |
| Card / module surface | `bgSurface` (#FFFFFF) | Cards, panels, modules sitting on the canvas |
| Inset / nested surface | `bgAlt` (#F4EFE8) | Inputs, nested cards, alternating table rows, code blocks |
| Modal overlay scrim | `rgba(26, 24, 20, 0.36)` | Warm-dim modal backdrop (NOT pure black/dark) |
| Modal card | `bgSurface` (#FFFFFF) on the scrim above |

### 6.2 Text contrast

- Primary text: `textPrimary` (`#1A1814`) — passes WCAG AAA on cream and white
- Secondary text: `textSecondary` (`#5C5750`) — passes WCAG AA (~5.5:1 on cream)
- Muted text: `textMuted` (`#8B847B`) — for captions, timestamps, helper text only. Do NOT use for primary content (~3.5:1 contrast).
- **Critical:** never use `#FFFFFF` text on any background in this palette. Always `bgCanvas` or `textOnDeep` for "white" — they're warm-tinted to match the rest of the system.

### 6.3 Tables and dense data

Tables are unavoidable on dashboards. Apply:

- Background: `bgSurface` (white) — tables sit as cards on the cream canvas
- Border: `borderWhisper` (1px hairline)
- Header row background: `bgAlt` (slightly warmer than the table body)
- Zebra striping (if used): alternate `bgSurface` ↔ `bgAlt`
- Row hover: `rgba(45, 90, 110, 0.04)` (a whisper of petrol)
- Row dividers: `borderWhisper` between rows; no vertical column dividers (whitespace separates columns instead)
- Compact padding: `12px 16px` per cell (not the generous landing padding)

### 6.4 Forms and inputs

- Input background: `bgSurface` (white) on cream canvas
- Input border: `1px solid borderDefined` (slightly stronger than whisper — forms need to be findable)
- Input radius: 10px
- Input padding: `12px 14px`
- Focus state: `box-shadow: 0 0 0 3px ringFocus, 0 0 0 1px accentPetrol`; border becomes `accentPetrol`
- Label: Geist Sans 0.875rem weight 500 color `textPrimary`, 6px bottom margin
- Helper text: Geist Sans 0.8125rem color `textMuted`
- Error state: border + ring become `#B85C5C` (the existing danger token); error message in same colour below the input

### 6.5 Buttons (reuse landing's `PrimaryCTA` where possible)

Three button variants for in-app use:

- **Primary** — petrol bg, cream text. Use for the single most important action on a screen. (Same as landing `PrimaryCTA`.)
- **Secondary** — transparent bg, `borderDefined` border, `textPrimary` text. Hover: `bgAlt` background.
- **Ghost** — no bg, no border, `textSecondary` text. Hover: `textPrimary`. Use for tertiary actions, dismiss buttons, "Cancel" actions.

### 6.6 Modals and dialogs

- Backdrop: `rgba(26, 24, 20, 0.36)` (warm-dim — never `#000` overlay)
- Backdrop has `backdrop-filter: blur(4px)` for premium feel
- Modal card: `bgSurface`, radius 16px, padding 28px
- Modal max-width 480px for confirmations, 640px for forms, 800px for content-heavy modals
- Modal shadow: lifted shadow per §5

### 6.7 Charts and data visualisation

Where charts exist (Admin dashboard sparklines, funnel charts, etc.), apply this palette mapping:

| Chart element | Token |
|---|---|
| Primary line / bar | `accentPetrol` |
| Secondary line / bar | `accentGold` |
| Tertiary (third series) | `#6B8E96` (lighter petrol — invent if needed) |
| Grid lines | `borderWhisper` |
| Axis labels | `textSecondary` Geist Sans 0.75rem |
| Tooltip background | `bgDeep` (warm dark) with `textOnDeep` text |
| Positive trend / success | `success` (#2A9D6F) |
| Negative trend / error | `#B85C5C` |

If a chart was using legacy bright colours (cyan, neon green, etc.), replace with the above mapping — do not invent new hues.

### 6.8 The grain texture (carry over selectively)

The `.has-grain` utility from the landing spec is global. In-app:

- ✅ Apply to all `PrimaryCTA` buttons (consistency with landing)
- ✅ Apply to deep accent panels (e.g., gold-bordered featured cards)
- ❌ Do NOT apply to white card surfaces (defeats the clean-document feel)
- ❌ Do NOT apply to table cells or data viz (visual noise on dense data hurts readability)

---

## 7. Special cases & gotchas

### 7.1 The DiagnosticPage scroll-frame pattern

`DiagnosticPage.tsx` line 183 already uses `height: 100vh; overflowY: auto` to manage its own scroll inside the app shell (per the fix landed on master). This pattern is **correct** and must be preserved. Every page in this migration that's currently a scroll container keeps that structure; we're changing colours and components, not page architecture.

### 7.2 OnboardingIntake's question steps

The auth + question steps in `OnboardingIntake.tsx` are particularly important because they sit between the landing (warm-cream) and the diagnostic (also being migrated). They must shift to warm-cream as part of Batch A — otherwise the user flows landing-warm → auth-dark → questions-dark → diagnostic-warm, which is the exact whiplash we're trying to remove.

### 7.3 Animated decorative blobs

`OnboardingIntake.tsx`'s `Scene()` function (lines ~59–86) renders animated decorative blobs with `T.blobGrad` and `T.blobShadow`. On the new warm-cream palette, these blobs need:

- Either: muted to `accentGoldSoft` + `accentPetrol` low-opacity gradients
- Or: removed entirely (the new design language relies on illustration + typography, not abstract gradient blobs)

**Recommendation:** Remove them. They're a holdover from the previous dark aesthetic and don't fit the editorial-warm direction. The Scene function should be deleted or stubbed to return null.

### 7.4 The existing `ThemeContext`

`src/contexts/ThemeContext.tsx` powers a dark/light toggle within the current dark theme. With the move to warm-cream, this toggle becomes obsolete — there's no longer a "dark mode" to toggle into.

**Action for the final consolidation phase:** Strip the ThemeContext down to expose a single static token object (the warm tokens), keeping the `useAppTheme` hook signature stable so consuming components don't break. Remove the toggle UI from any page that exposes it.

For Batches A–C: do not remove or modify ThemeContext. Just stop using `T.*` for new colour decisions; reference warm tokens directly. The consolidation phase cleans up ThemeContext last.

### 7.5 Sentry, Vercel analytics scripts

Don't touch.

### 7.6 The admin/test exclusion email list

`server/src/routes/admin.ts` has hardcoded admin emails. Don't touch.

---

## 8. Batch breakdown

Three sequential batches plus a final consolidation step. Each batch is shippable as its own deepseek run.

### Batch A — Core user-facing surfaces

These are the surfaces every user touches every session. They must match the landing aesthetic for the brand promise to land.

**Files to convert:**

1. `src/pages/AuthPage.tsx` — login / signup page
2. `src/components/OnboardingIntake.tsx` — auth step + question steps (welcome step is already removed by landing spec)
3. `src/components/DiagnosticPage.tsx` — the diagnostic report
4. `src/components/DashboardLayout.tsx` (or wherever the authenticated shell lives) — the surrounding chrome
5. `src/pages/StrategyHub.tsx` — the dashboard at `/`

**Per-file conversion checklist (apply to each):**

- [ ] Identify and remove all hardcoded inline dark colours (`#080b12`, `#141517`, `#1A1C1E`, `#1E1F22`, `#25272B`, `rgba(255,255,255,*)`, etc.)
- [ ] Replace with corresponding warm tokens from `src/lib/theme/warmTokens.ts`
- [ ] Backgrounds: dark → `bgCanvas` (page) or `bgSurface` (cards)
- [ ] Light text → `textPrimary` for headings, `textSecondary` for body, `textMuted` for captions
- [ ] Borders: dark `rgba(255,255,255,*)` → `borderWhisper` or `borderDefined`
- [ ] Shadows: existing dark shadows → the soft/lifted multi-layer shadows from warmTokens
- [ ] Animated decorative gradient blobs (if any) → removed
- [ ] Custom inline button styles → replace with shared `PrimaryCTA` / `SecondaryButton` / `GhostButton` from a new `src/components/shared/` module
- [ ] Page-level scroll containers using `height: 100vh; overflow-y: auto` — preserve the pattern, just update colours
- [ ] Tables (if any) — apply §6.3 treatment
- [ ] Forms (if any) — apply §6.4 treatment
- [ ] Modals (if any) — apply §6.6 treatment
- [ ] Verify all interactive elements have visible focus rings using `ringFocus`
- [ ] Test viewport at 375px, 768px, 1280px — confirm responsive layout still works
- [ ] Confirm all existing PostHog events still fire (do not remove `trackXxx()` calls)
- [ ] Confirm routing still works (page mounts at the same path, navigates to the same places)

**New shared component module to create as part of Batch A:**

Create `src/components/shared/` with:
- `PrimaryButton.tsx` — same visual treatment as landing `PrimaryCTA.tsx`, but renamed for in-app use (the landing keeps its own copy unchanged)
- `SecondaryButton.tsx` — per §6.5
- `GhostButton.tsx` — per §6.5
- `Card.tsx` — `bgSurface`, whisper border, 16px radius, soft shadow
- `Input.tsx` — per §6.4
- `Modal.tsx` — per §6.6 (or update existing modal component if one exists)
- `Eyebrow.tsx` — small uppercase tracking label; reuse same as landing if importable, otherwise duplicate

These components let Batches B and C migrate faster — they don't need to reinvent buttons / cards / inputs per page.

**Acceptance criteria for Batch A:**

1. User signs out, visits `/auth`, signs in: every screen they pass through (login form, then onboarding question steps if not onboarded, then diagnostic, then StrategyHub) is on the cream canvas with warm tokens. No flash of dark theme.
2. The DiagnosticPage scroll fix (master commit 07553d0) is preserved — internal scroll still works.
3. No existing PostHog event has been removed or renamed.
4. No route has been added or changed.
5. `npm run build` passes with no new TypeScript errors. `npm run lint` passes.
6. At 375px viewport, every Batch A page renders without horizontal scroll and remains usable.
7. The dark theme tokens in `:root` are NOT modified yet (the global flip happens in the consolidation phase).
8. New shared components live in `src/components/shared/` and are imported by at least one Batch A page each (proves the module is wired).

### Batch B — Functional workspaces

These are the surfaces where users do work after onboarding. Density matters more here than in Batch A; apply the dashboard/table/form rules from §6.

**Files to convert:**

1. `src/pages/StepperWorkspace.tsx` (`/apply`)
2. `src/components/ApplicationWorkspace.tsx` (`/application-workspace`)
3. `src/components/Workspace.tsx` (`/workspace`)
4. `src/components/ApplicationTracker.tsx` (`/tracker`)
5. `src/components/DocumentLibrary.tsx` (`/documents`)
6. `src/components/EmailTemplatesLibrary.tsx` (`/email-templates`)

**Conversion checklist:** Same as Batch A per-file checklist. Reuse the shared components created in Batch A.

**Specific notes:**

- `ApplicationTracker.tsx` is likely table-heavy. Apply §6.3 carefully.
- `DocumentLibrary.tsx` and `EmailTemplatesLibrary.tsx` are grid layouts; preserve the grid structure, just reskin cards.
- `StepperWorkspace.tsx` (the apply flow) has multi-step navigation. Verify step indicators and progress UI translate cleanly to warm tokens.
- `Workspace.tsx` and `ApplicationWorkspace.tsx` may share components. Look for duplicate code; reuse rather than divergence.

**Acceptance criteria for Batch B:**

Same as Batch A acceptance, plus:

- A user completing an apply-flow journey (from `/strategy` → click "Start application" → through `/apply` steps → to `/tracker`) sees one continuous visual language.
- All existing table interactions (sort, filter, row click, pagination) still work.
- All form submissions still work (don't accidentally break a JSX prop while reskinning).

### Batch C — Edge surfaces

Pages most users never see, but they exist and they must match.

**Files to convert:**

1. `src/pages/AdminDashboard.tsx` (`/admin`)
2. `src/pages/AdminFunnel.tsx` (`/admin/funnel`)
3. `src/pages/FridayBriefPage.tsx` (`/admin/friday-brief`)
4. `src/pages/JobFeedPage.tsx` (`/jobs`)
5. `src/pages/LinkedInPage.tsx` (`/linkedin`)
6. `src/pages/MindsetPage.tsx` (`/mindset`)
7. `src/pages/PricingPage.tsx` (`/pricing`)
8. `src/pages/LegalPage.tsx` (`/legal`, `/legal/:policy`)

**Conversion checklist:** Same as Batch A.

**Specific notes:**

- `AdminDashboard.tsx` is the heaviest page in the codebase (multiple tabs, charts, AI insights section). The chart palette mapping in §6.7 is mandatory here.
- `PricingPage.tsx` is a hybrid marketing / functional surface — apply warm tokens but keep the marketing-style generous whitespace (closer to landing's `sectionPadDesktop: 120` than dashboard's 56). This is the one Batch C exception.
- `LegalPage.tsx` is content-heavy; treat as long-form readable document — `max-width: 720px`, generous line-height, comfortable reading rhythm.
- `MindsetPage.tsx` may have its own visual identity (motivation-heavy content); preserve any unique editorial flourishes if they fit the warm-cream direction. If they conflict (e.g., neon accents), neutralise them to warm tokens.

**Acceptance criteria for Batch C:**

Same as Batch A acceptance. Plus: every route in `src/App.tsx`'s `<Routes>` block, when visited by an authenticated user, renders on the warm-cream palette. No remaining dark surfaces.

### Final consolidation — Global token cleanup

After Batches A–C all ship and QA passes, one final step removes the dark scaffolding.

**Tasks:**

1. In `src/index.css`, replace the `:root` palette tokens with the warm-cream values (so the global vars finally match what every page is using inline):
   ```css
   :root {
     --color-bg: #FAF7F2;
     --color-surface: #FFFFFF;
     --color-surface-elevated: #FFFFFF;
     --color-fg: #1A1814;
     --color-fg-muted: #5C5750;
     --color-fg-faint: #8B847B;
     --color-border: rgba(26, 24, 20, 0.08);
     --color-border-strong: rgba(26, 24, 20, 0.16);
     /* etc. */
   }
   ```
2. Update the body background and `color-scheme` declaration in `src/index.css`:
   ```css
   body { background-color: #FAF7F2; }
   :root { color-scheme: light; color: #1A1814; }
   ```
3. Strip `src/contexts/ThemeContext.tsx` down to a single static warm theme. Remove the dark-mode toggle. Preserve the `useAppTheme` hook signature.
4. Search the codebase for remaining references to old token values (`#141517`, `#1E1F22`, `#080b12`, `slate-950`, `slate-900`, etc.) and replace with warm equivalents or remove if unused.
5. Remove any unused dark-theme CSS classes (`.btn-primary` etc. in `src/index.css` — verify they're not referenced before deleting).
6. Remove ThemeToggle component(s) and any UI that exposes the toggle.

**Acceptance criteria for consolidation:**

- `grep -r "#141517\|#1E1F22\|#080b12" src/` returns zero results
- `grep -r "slate-950\|slate-900" src/` returns zero results (or only intentional uses in landing spec)
- `npm run build` passes
- Every page in the app still renders correctly after the global token flip
- ThemeContext exports a single warm theme; consumers don't break

---

## 9. Implementation plan (ordered steps for the deepseek agent)

Each batch is its own deepseek run. Within a batch, steps execute in order.

### Batch A steps

**Step A1 — Create shared theme module + components**
- Create `src/lib/theme/warmTokens.ts` with the token export per §5.1
- Create `src/components/shared/` directory and the components listed in §8 Batch A "New shared component module"
- Each component compiles and passes lint
- No imports of these new components anywhere yet — just create them

**Step A2 — Convert AuthPage.tsx**
- Apply per-file conversion checklist from §8 Batch A
- Import shared components from Step A1
- Test login + signup flows still work

**Step A3 — Convert OnboardingIntake.tsx (auth + question steps only)**
- Same per-file checklist
- Remove the `Scene()` animated blobs per §7.3
- Verify the flow from auth → questions → processing still completes

**Step A4 — Convert DiagnosticPage.tsx**
- Same checklist
- **PRESERVE** the `height: 100vh; overflow-y: auto` scroll-frame pattern at line 183
- Verify scroll still reaches the bottom of the report

**Step A5 — Convert DashboardLayout.tsx**
- Same checklist
- This is the chrome around StrategyHub and other authenticated pages

**Step A6 — Convert StrategyHub.tsx**
- Same checklist
- Apply table / card treatment per §6 where dense data lives

**Step A7 — Batch A acceptance pass**
- Run `npm run build` and `npm run lint`
- Manually navigate sign-out → sign-in → onboarding → diagnostic → strategy
- Confirm all 8 Batch A acceptance criteria pass
- Report back to architect

### Batch B steps

Same pattern: one step per file, ending with an acceptance pass step. Reuse shared components from Batch A; do not recreate.

### Batch C steps

Same pattern.

### Consolidation steps

**Step F1** — Flip `:root` palette tokens in `src/index.css`
**Step F2** — Update body / color-scheme declarations
**Step F3** — Strip ThemeContext to single warm theme
**Step F4** — Sweep codebase for remaining legacy colour references
**Step F5** — Remove ThemeToggle UI
**Step F6** — Final acceptance pass (every route renders correctly post-flip)

---

## 10. PostHog tracking (no changes)

This spec **does not modify any PostHog tracking**. All existing `trackXxx()` calls in `src/lib/analytics.ts` stay exactly as they are, and all call sites in components stay exactly as they are. The migration is visual only.

If the implementing agent finds itself about to delete or modify a `posthog.capture()` or `trackXxx()` call, stop. That's out of scope.

---

## 11. Overall acceptance criteria (Phase 2 complete)

When all three batches plus consolidation have shipped, the following must be true:

1. Every route in `src/App.tsx` (public and protected) renders on the warm-cream palette with Fraunces + Geist Sans typography.
2. Navigating from the landing page → through signup → through onboarding → through diagnostic → into the dashboard → through any other authenticated page shows **no visual whiplash**. One continuous visual surface.
3. All existing functionality works: forms submit, tables sort, modals open and close, charts render, applications save, documents generate.
4. All PostHog events still fire with the same event names and payload shapes.
5. `npm run build` passes with no new TypeScript errors.
6. `npm run lint` passes with no new errors.
7. Mobile (375px), tablet (768px), and desktop (1280px) viewports all render correctly on every migrated page.
8. The dark theme tokens have been removed from `src/index.css` (consolidation complete).
9. ThemeContext exposes a single warm theme; the toggle UI is gone.
10. `grep -r "#141517\|#1E1F22\|#080b12\|slate-950\|slate-900" src/` returns zero or only intentional results.

---

## 12. Open questions

These need user input. Implementing agent should NOT guess — surface back.

1. **Chart library palette.** If admin pages use a chart library (recharts, chart.js, etc.) with default palette assumptions, do we override the library's defaults globally, or pass explicit palette props per chart? Both are valid; pick based on whichever causes fewer surprises.
2. **MindsetPage editorial flourishes.** If MindsetPage has unique visual identity (custom typography, colour accents, illustrations), do we preserve them within the warm-cream palette or normalise everything to the standard token vocabulary? Default to normalising unless user flags otherwise.
3. **PricingPage marketing-vs-functional balance.** PricingPage is a hybrid surface (sells the product but also lives inside the app shell). Use marketing-spaced whitespace (closer to landing's 120px section padding) or in-app spacing (56px)? Default to marketing-spaced — pricing pages feel right with more breathing room.
4. **Pre-existing dark-mode dependencies in tests.** If component tests assume specific dark colour values, those tests will break after this migration. Surface as an open question if encountered.
5. **Email templates HTML.** If the email-templates feature renders previewable HTML email content, that content is its own visual surface and may not follow this palette. Leave email HTML untouched unless the user explicitly extends scope.

---

## 13. Notes for future you

- This spec is the umbrella. Each batch may eventually get its own tighter child spec if the user wants to bundle differently or pull a batch forward.
- If the per-page conversion proves slow because too many components have hardcoded colours, consider scripting the search-and-replace for the most common dark hex values as a first pass. Then manual cleanup of edge cases. Faster than purely manual.
- The grain texture (`.has-grain` class) is a small lever for visual richness on otherwise-flat warm surfaces. Used judiciously, it differentiates JobHub from generic warm-cream SaaS landing pages. Don't go overboard.

---

**End of spec.**

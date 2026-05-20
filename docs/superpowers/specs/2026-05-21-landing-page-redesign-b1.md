# Landing Page Redesign — B1 Premium-Warm (Spec + Implementation Plan)

**Date:** 2026-05-21
**Owner:** Kiron
**Implementing agent:** Deepseek (external)
**Status:** Awaiting user review before handoff

---

## 0. How to use this document

This is a **self-contained handoff doc**. The implementing agent should be able to ship the entire landing page from this spec without asking the architect (me) follow-up questions. Where I anticipated ambiguity, I've made the decision and noted it. Where a decision is genuinely outside scope, I've called it out under **Open Questions** at the end.

The doc is two parts: (1) the **design spec** — what we're building and why, with all copy verbatim and visual rules concrete; (2) the **implementation plan** — the ordered build steps with file paths and gotchas. Read top to bottom.

---

## 1. Context & problem

### 1.1 What we measured

Between 20 Apr – 20 May 2026, Vercel Analytics recorded **149 unique visitors to `/`** and only **23 reached `/auth`** — an **84% bounce at the landing-page stage**, before any signup attempt. LinkedIn was the dominant referrer (43 unique visitors); Instagram delivered 2. The in-product funnel below `/auth` is healthier (`/workspace` retention ~100%, `/application-workspace` 83%) — so the biggest leak in the entire JobHub funnel is at the first surface a visitor sees.

### 1.2 What the current landing does wrong

The current "landing" is `StepWelcome` inside `src/components/OnboardingIntake.tsx` (lines 283–365). It runs at `/` for unauthenticated visitors. As of 2026-05-20 it shows:

- One-screen above-the-fold layout, no second section, no scroll affordance.
- Provocative-negative headline ("Are you really unemployable in Australia?") that gambles on defiance vs. resignation.
- CTA labelled **"Check My Eligibility →"** — semantically mismatched with the product (there's no eligibility gate; it's a free diagnostic).
- Zero social proof. Zero outcome preview. Zero visible second section.
- Dark moody aesthetic that visually conflicts with the warmer treatment planned for the rest of the site.

### 1.3 Why we're redesigning

A skeptical ICP (Australian graduate job seekers, many on graduate or skilled visas, often with prior bad experiences from coaching programs) needs to **see value before being asked for anything**. We're applying a **premium-warm visual register (B1)** consistent with the broader site redesign already in motion, and a **friend-voice copy register** that treats the visitor as a peer who's been in the same chair.

The redesign is explicitly **not** trying to maximise raw click-through at the cost of brand. It's trying to attract serious, qualified visitors who scroll, read, and convert because they trust what they're seeing.

---

## 2. Goals & non-goals

### 2.1 Goals

- Reduce the landing → `/auth` bounce rate (currently 84%) by giving visitors reason to scroll and trust before being asked to sign up.
- Build the first surface of the site in the new **premium-warm** visual language so it sets the brand tone for the redesigned site.
- Ship with **A/B testing across 3 hero variants** so we measure which copy register performs best, not just whether the redesign works overall.
- Produce a clean, reusable component structure that makes future iteration cheap.

### 2.2 Non-goals

- **Not redesigning the rest of OnboardingIntake** (auth step, question steps) — that's a follow-up spec. We're only replacing `StepWelcome`.
- **Not redesigning the dashboard, workspace, or any in-app surface.**
- Not building marketing automation, email sequences, or ad pages.
- Not changing the diagnostic content/structure (separate downstream problem).

---

## 3. Out of scope (do not touch)

- `src/App.tsx` routing structure — only **add** the new public route described in §6.
- `src/components/OnboardingIntake.tsx` — only **remove** the `StepWelcome` function and its render, leaving the rest of the flow intact.
- Any in-product surfaces (StrategyHub, DashboardLayout, ApplicationWorkspace, etc.) — visual changes to those surfaces beyond what propagates automatically from the global font swap (Step 1) are a follow-up spec.
- Existing palette tokens in `src/index.css` (`--color-bg`, `--color-surface`, `--color-fg`, `--color-accent`, etc.) — do **not** flip these from dark to warm-cream. That's Phase 2.
- Tailwind config or `ThemeContext` — the landing introduces its own scoped tokens and does **not** mutate global theme beyond the explicit font-token update in Step 1.
- Tracking events not listed in §10.

**Scope boundary check before you touch any file in /src outside the landing/ directory:** the only change permitted to global stylesheets is the font-token update in Step 1 and adding the `.has-grain` utility class. If you find yourself about to change palette variables, dark-mode behaviour, dashboard layouts, or any non-landing component's visual treatment — stop. That's Phase 2. Surface it in §13 instead.

---

## 4. Design system tokens

The landing page is the **first surface in the new B1 premium-warm direction**. Tokens here are scoped to landing — they do not replace `ThemeContext`. Define them in `src/components/landing/tokens.ts` as a typed object.

### 4.1 Color palette (warm-neutral, brand-continuous)

```
// Backgrounds
--bg-canvas      : #FAF7F2  // warm cream — primary page background
--bg-surface     : #FFFFFF  // pure white — cards on cream
--bg-alt         : #F4EFE8  // warmer cream — alternating section bg
--bg-deep        : #2A2520  // warm dark — used sparingly (e.g. testimonial card variant)

// Text
--text-primary   : #1A1814  // warm near-black, NOT pure black
--text-secondary : #5C5750  // warm gray
--text-muted     : #8B847B  // warmer muted gray
--text-on-deep   : #FAF7F2  // cream on dark surfaces

// Borders & dividers
--border-whisper : rgba(26, 24, 20, 0.08)  // hairline divisions
--border-defined : rgba(26, 24, 20, 0.16)  // clearer divider where needed

// Brand accents (carry over from existing site for continuity)
--accent-petrol         : #2D5A6E   // primary CTA bg
--accent-petrol-hover   : #1F4253   // CTA hover
--accent-petrol-pressed : #15323F   // CTA active
--accent-gold           : #C5A059   // secondary accent (links, micro-highlights)
--accent-gold-soft      : #E8D7B0   // soft gold for badges / underlines

// Semantic
--success        : #2A9D6F  // checkmarks in risk reversal
--ring-focus     : rgba(45, 90, 110, 0.40)  // 2px focus ring offset
```

**Rule:** Never use `#000` or pure white as text. Always the warm variants above.
**Rule:** The single saturated colour is **petrol (#2D5A6E)**. Gold is supportive only. Do not introduce blues, purples, greens beyond what's above.

### 4.2 Typography

Two fonts to add to the project (free, via Google Fonts CSS link in `index.html`):

- **Display / Headings:** `Fraunces` — variable serif, weight 400–900, opsz 9–144, with `SOFT` and `WONK` axes. Use for all h1/h2/h3. Adds editorial warmth that pure-sans cannot.
- **Body / UI:** `Geist Sans` — modern sans-serif (Vercel's free font). Use for body, buttons, nav, microcopy.

Mono fallback (only if used at all): system monospace stack.

**Why these specifically:** Fraunces is the warmest premium serif in the free tier — it has soft and wonky variants that prevent it from feeling corporate. Geist Sans pairs cleanly without being yet another Inter clone (the frontend-design skill explicitly counsels against Inter as a default body).

**Type scale (rem-based, root = 16px):**

| Role | Font | Size | Weight | Line height | Tracking |
|---|---|---|---|---|---|
| Display hero | Fraunces | clamp(2.5rem, 6vw, 4.5rem) | 500 | 1.05 | -0.02em |
| Section heading | Fraunces | clamp(2rem, 4vw, 3rem) | 500 | 1.1 | -0.015em |
| Sub-section heading | Fraunces | 1.5rem (24px) | 500 | 1.25 | -0.01em |
| Eyebrow | Geist Sans | 0.75rem (12px) | 600 | 1.2 | 0.18em uppercase |
| Body large (hero sub, intro) | Geist Sans | 1.125rem (18px) | 400 | 1.6 | 0 |
| Body | Geist Sans | 1rem (16px) | 400 | 1.65 | 0 |
| Body small | Geist Sans | 0.875rem (14px) | 400 | 1.55 | 0 |
| Microcopy / caption | Geist Sans | 0.8125rem (13px) | 400 | 1.4 | 0 |
| Button label | Geist Sans | 0.9375rem (15px) | 600 | 1 | -0.005em |

**Letter spacing rule:** Tight negative tracking at display sizes (-0.02em), relaxed to zero at body. Fraunces' SOFT axis: set to `50` (mid-soft) for headings — softens hard serifs without losing crispness.

### 4.3 Spatial scale

8px base. Section vertical padding:

| Where | Desktop | Mobile (≤640px) |
|---|---|---|
| Hero top → first content | 96px | 56px |
| Between major sections | 120px | 72px |
| Card internal padding | 32px | 24px |
| Inline group spacing | 16–24px | 12–16px |

**Container widths:**
- Hero text content: `max-width: 640px`, centered (the headline does NOT span full width — premium-warm rule).
- Body sections: `max-width: 1100px`, centered, with 24px gutter on mobile.
- Single-column readable blocks (3 truths, objection handler body): `max-width: 720px`, centered.

### 4.4 Borders, radius, shadows

- **Whisper border** for cards: `1px solid var(--border-whisper)`
- **Radii:** Buttons `10px`. Cards `16px`. Pills (badges) `9999px`. Inputs `10px`.
- **Shadows (multi-layer, Notion-derived):**
  - **Soft card:** `0 1px 2px rgba(26,24,20,0.04), 0 4px 16px rgba(26,24,20,0.04)`
  - **Lifted card:** `0 1px 3px rgba(26,24,20,0.04), 0 6px 20px rgba(26,24,20,0.06), 0 18px 48px rgba(26,24,20,0.04)`
  - Do not use single-shadow drop shadows. They look generic.

### 4.5 Motion

- Default easing for entrance: `cubic-bezier(0.25, 1, 0.5, 1)` (frontend-design skill default). Never bounce/elastic.
- Section reveal on scroll: opacity 0 → 1, y +12px → 0, duration 0.5s, threshold 0.2 (Framer Motion `whileInView` with `viewport={{ once: true, amount: 0.2 }}`).
- Hover transitions: 180ms.
- CTA hover: subtle `translateY(-1px)` + shadow depth increase. NEVER scale.

### 4.6 Iconography

Use `lucide-react` (already installed). Stroke weight 1.5. Size 16px in body, 20px in buckets, 24px in section eyebrows.

### 4.7 Texture treatment

Coloured solids in the design (the petrol CTA, cream alt-section bands, deep dark surfaces if used) get a subtle organic grain to lift them from flat-SaaS aesthetics into a tactile, paper-like premium feel. The technique is restrained — texture should register as atmosphere, not pattern.

**Implementation:** Inline SVG noise as a data-URI background, layered with `mix-blend-mode: overlay` at 4–10% opacity. No extra HTTP request, ~1KB CSS, per-surface tunable.

Add this CSS once in the landing's scoped stylesheet:

```css
.has-grain {
  position: relative;
}
.has-grain::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.35'/></svg>");
  mix-blend-mode: overlay;
  opacity: 0.08;
  border-radius: inherit;
}
```

**Where to apply:**

| Surface | Apply? | Texture opacity |
|---|---|---|
| Petrol CTA button (`PrimaryCTA`) | ✅ | 0.06–0.08 |
| Cream alt-section backgrounds (`--bg-alt`) | ✅ | 0.04 |
| Deep dark surface (`--bg-deep`, if any section uses) | ✅ | 0.10 |
| Pure white surfaces (`--bg-surface`) | ❌ | (leave clean — premium *white*, not noisy white) |
| Hero image area | ❌ | (illustration carries its own texture) |

**Verification:** Texture should be invisible at first glance. If you can clearly see grain without leaning in, it's too strong — reduce opacity by half and re-check.

---

## 5. Component / file structure (new)

All new files. Do not modify existing components except as noted in §6.

```
src/
├── pages/
│   └── LandingPage.tsx                  ← NEW. Top-level page mounted at /
├── components/
│   └── landing/                         ← NEW directory
│       ├── tokens.ts                    ← Exported token object (palette + type)
│       ├── LandingNav.tsx               ← Top nav (wordmark + Log in)
│       ├── Hero.tsx                     ← Three-variant hero
│       ├── ScrollCue.tsx                ← Subtle "↓ See how it works" cue
│       ├── ThreeTruths.tsx              ← The three-truths section
│       ├── SocialProof.tsx              ← Testimonial cards
│       ├── ObjectionHandler.tsx         ← "Why not ChatGPT/Claude/Gemini..."
│       ├── ValuePreview.tsx             ← The 3 outcome buckets
│       ├── RiskReversal.tsx             ← Free / no card / 3 mins
│       ├── FinalCTA.tsx                 ← Repeat CTA + micro-FAQ
│       ├── LandingFooter.tsx            ← Light footer (legal links, copyright)
│       └── shared/
│           ├── PrimaryCTA.tsx           ← Reused CTA button component
│           └── Eyebrow.tsx              ← Reused small-uppercase label component
└── lib/
    └── landingVariant.ts                ← NEW. A/B variant assignment + tracking
```

---

## 6. Routing change

### 6.1 What changes

Currently `/` for unauthenticated users renders `OnboardingIntake.tsx`'s `StepWelcome` step. After this change, `/` for unauthenticated users renders the new `LandingPage`. The CTA on `LandingPage` navigates to `/auth?intent=signup` (signup mode pre-selected).

### 6.2 Where to edit `App.tsx`

`App.tsx` line ~365 currently has a `<Routes>` block with public routes:

```tsx
<Route path="/auth" element={<AuthPage />} />
<Route path="/auth/callback" element={<AuthCallback />} />
<Route path="/pricing" element={<PricingPage />} />
<Route path="/legal/:policy" element={<LegalPage />} />
<Route path="/legal" element={<LegalPage />} />

<Route path="/*" element={ <ProtectedRoute>... </ProtectedRoute> } />
```

**Change:** Add a new public route for `/` BEFORE the catch-all `/*`. The new route renders `LandingPage` ONLY when `user` from `useAuth()` is null. When authenticated, fall through to the existing protected route (which will continue to render `OnboardingIntake` or `StrategyHub` as today).

The cleanest pattern is a small inline wrapper:

```tsx
function PublicLandingOrFallthrough() {
  const { user, loading } = useAuth();
  if (loading) return null;  // or existing loading shell
  if (!user) return <LandingPage />;
  return <Navigate to="/strategy" replace />;  // or wherever authed users go from /
}
```

Wait — `/` for authed users routes to `StrategyHub` per the existing protected route. So instead of a wrapper that handles both, **add a sibling public route**:

```tsx
{/* Public landing for unauthenticated users — must come before protected catch-all */}
<Route path="/" element={
  <UnauthedOnly fallback={<ProtectedRoute><OnboardingGate><ReportOrDashboard /></OnboardingGate></ProtectedRoute>}>
    <LandingPage />
  </UnauthedOnly>
} />
```

The implementing agent should pick whichever pattern is least invasive. The contract is:
- Unauthenticated visitor at `/` → sees `LandingPage`.
- Authenticated visitor at `/` → existing behaviour (StrategyHub for onboarded, OnboardingIntake for not-yet-onboarded).

### 6.3 What to remove from `OnboardingIntake.tsx`

- The `StepWelcome` function (lines 283–365 as of 2026-05-21).
- The state branch that renders `StepWelcome` as step 0. The flow now starts at the auth step.
- Any `StepWelcome` references in step labels / progress logic.

Do not remove anything else from OnboardingIntake. The auth + question steps stay exactly as they are for now (Phase 2 will redesign them).

### 6.4 Critical CSS context — body overflow override

**Read this before writing a single section component.** The app shell in `src/index.css` (lines ~87–99) declares:

```css
body { overflow: hidden; min-height: 100vh; width: 100vw; }
#root { height: 100vh; width: 100vw; }
```

This is an **app-shell pattern**: every routed page is expected to manage its own internal scroll because the document itself cannot scroll. If `LandingPage` renders normally inside this shell without accounting for it, the page will be clipped at viewport height and **every section below the hero (Three Truths, Social Proof, Objection Handler, Value Preview, Risk Reversal, Final CTA, Footer) will be invisible and unreachable**.

The landing page is long-form by design and *must* scroll end-to-end. Pick one of:

**Option A — wrap `LandingPage` in a scroll container (recommended).**
Simplest solution. The top-level `LandingPage` return wraps everything in a single root div with `height: 100vh; overflow-y: auto`. The page content scrolls inside this div; global CSS stays untouched; other in-app pages continue to work as today.

```tsx
// src/pages/LandingPage.tsx
return (
  <div style={{
    height: '100vh',
    overflowY: 'auto',
    background: tokens.colors.bgCanvas,
  }}>
    <LandingNav />
    <Hero variant={variant} />
    <ThreeTruths />
    <SocialProof />
    <ObjectionHandler />
    <ValuePreview />
    <RiskReversal />
    <FinalCTA />
    <LandingFooter />
  </div>
);
```

This is **the same pattern** the existing `DiagnosticPage` uses (line 183, after the 2026-05-21 fix: `<div style={{ ..., height: '100vh', overflowY: 'auto' }}>`). Follow that convention exactly.

**Option B — flip body overflow per-route.**
Add a `useEffect` on `LandingPage` mount that sets `document.body.style.overflow = 'auto'` and cleans up on unmount. Reverts the app-shell constraint only when landing is active. More flexible if you ever want pure document scroll (e.g. native scrollbar styling, native scroll restoration), but mutates global state which can leak if cleanup is bypassed (e.g. on hard refresh during a route change, or if the component unmounts in error).

**Recommendation: Option A.** Localised, predictable, doesn't fight the rest of the app. The visual behaviour is indistinguishable from document scroll for the user. Also: the sticky-on-scroll behaviour of `LandingNav` (§8.0) works correctly with Option A because the scroll context is the wrapper div — use `position: sticky; top: 0` on the nav and it pins to the top of the scroll container.

**Verification step:** After Step 11 of the implementation plan, scroll all 7+ sections on `/` end to end. Footer must be reachable. If the page clips at the fold and you can't scroll past the hero, this section was missed.

---

## 7. A/B testing infrastructure

Three hero variants will ship simultaneously. Assignment is sticky per visitor.

### 7.1 Approach

Use **localStorage + PostHog event tagging**, NOT PostHog feature flags (simpler, no remote config dependency for v1).

### 7.2 `src/lib/landingVariant.ts` contract

```typescript
export type HeroVariant = 'v1_founder' | 'v2_reframe' | 'v3_plain';

const STORAGE_KEY = 'jobhub_hero_variant';

/**
 * Returns the visitor's assigned hero variant. Stable across visits
 * within the same browser. Random assignment on first visit.
 */
export function getHeroVariant(): HeroVariant {
  if (typeof window === 'undefined') return 'v2_reframe';

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'v1_founder' || stored === 'v2_reframe' || stored === 'v3_plain') {
    return stored;
  }

  // Roughly even random assignment
  const variants: HeroVariant[] = ['v1_founder', 'v2_reframe', 'v3_plain'];
  const chosen = variants[Math.floor(Math.random() * variants.length)];
  localStorage.setItem(STORAGE_KEY, chosen);
  return chosen;
}

/**
 * Reads the assigned variant without writing one — for analytics.
 * Returns null if none assigned yet.
 */
export function readHeroVariant(): HeroVariant | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return (stored === 'v1_founder' || stored === 'v2_reframe' || stored === 'v3_plain') ? stored : null;
}
```

### 7.3 Hero component contract

`Hero.tsx` reads the variant from `getHeroVariant()` on mount, then renders the matched variant content. The variant is passed as a prop to internal sub-components for easy testing.

### 7.4 PostHog tagging

Every PostHog event emitted from the landing page (see §10) MUST include the `hero_variant` property. This lets us segment funnel by variant in PostHog.

Add the variant as a person property too (so all subsequent in-product events for this user inherit it):

```typescript
// On first landing visit, after variant assigned:
posthog.register({ hero_variant: variant });  // session-wide super-property
posthog.people.set({ hero_variant_first_seen: variant });
```

---

## 8. Section-by-section spec with verbatim copy

Each section below has: **purpose** · **layout** · **copy** · **visuals** · **interaction**. Implement them in this order down the page.

---

### 8.0 Nav bar (`LandingNav.tsx`)

**Purpose:** Lightweight wayfinding. No marketing nav items — this is a focused conversion page, not a website.

**Layout:** Sticky at top, transparent background. After 80px scroll, gains `var(--bg-canvas)` background with a 1px whisper bottom border. Padding: 20px 24px desktop, 16px 20px mobile.

**Contents (left-to-right):**
- **Left:** JobHub wordmark (text-based, Fraunces 1.25rem weight 600, color `--text-primary`. Letter `J` can be set in `--accent-gold` for a subtle brand touch).
- **Right:** "Log in" text link (Geist Sans 0.9375rem weight 500, color `--text-secondary`, hover color `--accent-petrol`, no underline default, underline on hover with `text-underline-offset: 4px`).

**No CTA in the nav.** Keep the nav clean — the page's job is to drive scroll-then-CTA, not nav-CTA.

**Interaction:**
- Scroll → background fade in over 200ms.
- Log in click → `navigate('/auth?intent=signin')`.

---

### 8.1 Hero (`Hero.tsx`)

**Purpose:** Hook them in one read. Make them want to scroll.

**Layout:**
- Background: `--bg-canvas`.
- Centered content, `max-width: 640px` for text block.
- Vertical centering in a min-height viewport area (`min-height: 88vh`, with 96px top padding desktop / 56px mobile).
- Below the CTA, the **ScrollCue** component peeks (~16px visible of the next section's `--bg-alt` warm-cream at the page bottom).

**Components stacked vertically (centered):**
1. Eyebrow (small caps label)
2. Headline (Fraunces display)
3. Sub (Geist body large)
4. Primary CTA button
5. Microcopy under CTA (small, muted)
6. Log-in fallback line (smaller, muted)
7. Subtle scroll cue text

**A/B variant content:**

#### Variant V1 — Founder confession (`v1_founder`)

```
Eyebrow:    FOR AUSTRALIAN GRADUATES

Headline:   I sent 100 applications.
            I got no replies.
            There's a reason — and a fix.

Sub:        Most Aussie grads aren't unhireable. They're applying
            without knowing how Australian hiring actually works.
            JobHub is the system that gets you in front of the
            right people, with applications that don't get
            auto-filtered.

CTA label:  Show me what's broken in my approach →

Microcopy:  Free · No card needed · 3-minute diagnosis

Login line: Already have an account?  Log in
```

**Headline rendering:** 3 lines, each on its own visual line. Use `<br>` or block elements — do not let it wrap arbitrarily.

#### Variant V2 — The reframe (`v2_reframe`)

```
Eyebrow:    THE AUSTRALIAN APPLICATION ENGINE

Headline:   You're not unemployable.
            You're invisible to the system.

Sub:        Most rejections in Australia aren't about your
            qualifications. They're about applications that
            never reach a human, profiles that never get
            found, and a hiring system most people never
            learn. JobHub is the layer between you and that
            system.

CTA label:  Run my 3-minute diagnosis →

Microcopy:  Free · No card · Built for Aussie grads

Login line: Already have an account?  Log in
```

**Headline rendering:** 2 lines. The phrase "invisible to the system" should be set in `--accent-petrol` (not gold) to visually anchor the reframe — the user is being told the problem isn't them, it's their system-level visibility.

#### Variant V3 — Plain conversation (`v3_plain`)

```
Eyebrow:    (none — omit this element entirely for v3)

Headline:   Job hunting in Australia is brutal.
            Here's the system uni didn't teach you.

Sub:        You don't need to apply harder. You need to apply
            with a system that knows what Australian recruiters
            actually filter for, who they listen to, and how to
            get heard. That's the whole product.

CTA label:  Start my 3-minute diagnosis →

Microcopy:  Free · No card · Cancel anytime

Login line: Already have an account?  Log in
```

**Headline rendering:** 2 lines. Hard line break between sentences (do not auto-wrap). Optionally emphasise "system" with `--accent-gold` or italic Fraunces — it's the brand thesis word.

**CTA component (`PrimaryCTA.tsx`):**
- Background: `--accent-petrol`
- Text: `--text-on-deep` (cream, not pure white)
- Padding: `14px 28px` desktop, `14px 24px` mobile
- Radius: `10px`
- Font: Geist Sans 0.9375rem weight 600, letter-spacing -0.005em
- Shadow (default): `0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)`
- Shadow (hover): same + `0 8px 24px rgba(45,90,110,0.22)`
- Hover transform: `translateY(-1px)`
- Active: background `--accent-petrol-pressed`, transform `translateY(0)`
- Focus ring: `0 0 0 3px var(--ring-focus)` offset, plus visible focus outline
- Full-width on mobile, intrinsic width on desktop (the button hugs its label + 28px h-padding)

**On CTA click:**
- Emit PostHog event `landing_cta_clicked` with `{ position: 'hero', variant: heroVariant }`
- Navigate to `/auth?intent=signup`

**Eyebrow component (`Eyebrow.tsx`):**
- `<span>` styled: Geist Sans 0.75rem, weight 600, uppercase, letter-spacing 0.18em, color `--text-muted`.
- Optional left accent: a 24px-wide gold underline directly below the text (1px solid `--accent-gold-soft`, 4px gap).

**Scroll cue (`ScrollCue.tsx`):**
- Text only (no graphic arrow). Geist Sans 0.8125rem weight 500, color `--text-muted`, letter-spacing 0.04em.
- Above the text: a tiny chevron-down lucide icon, 14px, color `--text-muted`, with a 4px gap.
- Subtle gentle vertical bob: y oscillates 0 → 4px over 1.6s ease-in-out, repeat infinite.
- Variant-specific text:
  - V1: `↓ See why this works`
  - V2: `↓ See how it works`
  - V3: `↓ Real graduates, real outcomes`

**Hero responsive notes:**
- Desktop: ~88vh hero. Mobile: ~100vh hero (let the CTA sit lower-third).
- On phones, the headline must remain readable — `clamp(2.5rem, 6vw, 4.5rem)` already handles this; no further mobile overrides needed.

**Hero illustration band (all variants — important):**

Below the variant-specific hero block (after the login-line and scroll cue), all three variants render the hand-drawn journey illustration. This is the brand-defining visual moment of the page.

- Image source: `/hero-image.webp` (rename the file from `hero image.webp` to remove the space — see §12 Step 0a)
- Full container width (1100px max), no card chrome, no border, no shadow
- Sits directly on `--bg-canvas` — must look drawn ON the page, not pasted onto it
- Top margin: 48px desktop, 32px mobile (separates from CTA microcopy and scroll cue)
- Aspect ratio preserved; image scales proportionally with viewport
- Below the image: 48px bottom margin before the section ends

**Mask-reveal animation (on first viewport intersection):**

The illustration looks like it's being sketched across the page as the user scrolls into view. Implementation:

```css
.hero-illustration {
  mask-image: linear-gradient(to right, black 0%, black 50%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, black 0%, black 50%, transparent 100%);
  mask-size: 200% 100%;
  -webkit-mask-size: 200% 100%;
  mask-position: 100% 0;
  -webkit-mask-position: 100% 0;
  transition: mask-position 1.4s cubic-bezier(0.25, 1, 0.5, 1);
}
.hero-illustration.revealed {
  mask-position: 0 0;
  -webkit-mask-position: 0 0;
}
```

Trigger `.revealed` via Framer Motion's `whileInView` with `viewport={{ once: true, amount: 0.3 }}`.

**Reduced motion:** If `prefers-reduced-motion: reduce` is set, render the image with full mask-position (visible immediately) and skip the transition entirely. The animation is delight, not signal — never use it to gate content visibility.

---

### 8.2 Three Truths (`ThreeTruths.tsx`)

**Purpose:** Build the emotional case BEFORE features. Visitor reads three statements, nods three times, then is primed for proof and product.

**Layout:**
- Background: `--bg-alt` (warmer cream) — the first alternation away from canvas, creating visual rhythm.
- Section vertical padding: 120px / 72px.
- Outer container `max-width: 1100px`, centered, horizontal padding 24px.
- Eyebrow + section heading at top inside an inner container `max-width: 720px`, centered (so the intro text doesn't span full 1100px).
- Below the heading, 3 truth rows stacked vertically. Each truth row is a **2-column CSS grid** with explicit columns — sketch and text get their own columns and never overlap. Vertical gap between truth rows: 96px desktop, 64px mobile.

**Eyebrow:** `THE TRUTH NOBODY TELLS YOU`

**Section heading (Fraunces):**
```
Here's what's actually
happening in your job search.
```

**Truth row structure (desktop, ≥768px) — REPLACES the old marginalia approach:**

Each truth is a `display: grid` row with two explicit columns and an alternating arrangement for visual rhythm. The sketch and text occupy independent columns with a 64px gap between — guaranteeing they never overlap or fight for space.

```
Truth 01:  [ SKETCH 320px ] [ 64px gap ] [ TEXT flex (max ~640px) ]   ← sketch left
Truth 02:  [ TEXT flex ]     [ 64px gap ] [ SKETCH 320px ]            ← sketch right (mirror)
Truth 03:  [ SKETCH 320px ] [ 64px gap ] [ TEXT flex ]                ← sketch left again
```

**Grid spec per truth row:**
- `display: grid`
- `grid-template-columns:` either `320px 1fr` (sketch-left rows) OR `1fr 320px` (sketch-right rows)
- `gap: 64px`
- `align-items: center` (sketch is vertically centred against the text block — not pinned to the top)
- Max grid width: 1052px (fits inside 1100px container with 24px padding each side)

**Text column contents** (in this exact order, top to bottom):
1. **Large numeral** (Fraunces 4.5rem weight 400, color `--accent-gold`, line-height 1, no top margin) — visually anchors the top of the text column. Renders as `01`, `02`, `03`.
2. **Truth headline** (Fraunces 1.75rem weight 500, color `--text-primary`, line-height 1.25, 16px top margin from numeral).
3. **Truth body** (Geist Sans 1.125rem, color `--text-secondary`, line-height 1.65, 20px top margin from headline, max-width 600px so very wide screens don't produce overly long lines).

**Sketch column contents:**
- A single `<img>` referencing the cropped sketch file (`/sketches/truth-1.webp` etc.)
- Width: 320px (column width), height auto (aspect ratio preserved)
- `opacity: 0.92` (slightly less aggressive than the prior 0.85 — at this size and placement, fuller opacity reads better)
- `mix-blend-mode: multiply` (optional — only apply if the sketches still look "pasted on" without it; test both)
- No border, no shadow, no card chrome
- `border-radius: 4px` if the cropped edges feel too sharp; otherwise zero

**Mobile (≤767px):**
- Truth row becomes a single column stack.
- Sketch column collapses to `display: none` — the text needs full mobile attention; sketches become decoration competing for limited space. This is deliberate.
- Alternative if you want sketches on mobile: render them ABOVE the numeral at 200px width centred, 16px bottom margin. Default to hidden unless you've tested and it reads cleanly.

**Why this works (and the previous marginalia spec did not):**
The previous spec asked for sketches positioned absolutely in the section margin outside the text container. At a 1100px section with 720px text container, that margin is only 190px wide per side — too narrow for 200px+ sketches. The sketches had to bleed into the text column and created the overlap you saw. The 2-column grid eliminates the problem by giving sketch and text their own dedicated horizontal real estate, with `align-items: center` keeping them visually anchored against each other.

**Verbatim copy:**

#### Truth 01
**Headline:** The hardest part isn't the work. It's the weight.
**Body:** Most graduates we talk to aren't lazy. They're exhausted. Sending the 80th application that gets ignored isn't a "skills issue" — it's an emotional one. The job search punishes consistency exactly when consistency matters most.

#### Truth 02
**Headline:** Volume is the lever. Not luck. Not vibes.
**Body:** Landing a job in Australia is a numbers game played by people who understand the rules. Every application is a lottery ticket — but the winning ones aren't random. They're consistent, tailored, and sent into the right rooms. The fastest path to an offer is more high-quality applications going out, faster.

#### Truth 03
**Headline:** The trick isn't applying more. It's applying *right*, consistently.
**Body:** Anyone can send 50 generic applications in a weekend and feel productive. Two months later they've burned out and have nothing to show for it. The grads who actually land roles send fewer, better, more consistent applications — every week, without it eating their life. That's a system. Not motivation.

**Closing line under Truth 03 (small, centered, italic):**
> *That system is what we built.*

Set in Fraunces 1.125rem italic weight 400, color `--text-secondary`, 32px top margin.

**Interaction:** Each truth row fades in on scroll (Framer `whileInView`, threshold 0.3, stagger 0.15s between truths). Both the sketch and text within a row animate together as a single unit so they enter the viewport in lockstep.

**Sketch crop specifications:**

**Source images (use these and ONLY these — do NOT crop from `hero-image.webp` or any other file):**

Crops come from the two character-sketch source files:
- `public/sketches/girl-source.webp` — a **2×2 grid** of 4 sketch panels (Girl in Aus). Panels arranged: top-left, top-right, bottom-left, bottom-right. Each panel ≈ 50% × 50% of the source.
- `public/sketches/guy-source.webp` — a **3-column × 2-row grid** of 6 sketch panels (Guy in aus). Panels arranged: (top-left, top-middle, top-right), (bottom-left, bottom-middle, bottom-right). Each panel ≈ 33.3% × 50% of the source.

**Final filenames + EXACT crop specifications:**

These are mechanical instructions a build-time image tool (e.g. `sharp`, `cwebp`, ImageMagick) can execute without ever rendering the image. Each crop is specified as a fraction of the source image's full width/height.

#### `public/sketches/truth-1.webp` — Truth 01 ("the weight")

- **Source:** `public/sketches/girl-source.webp`
- **Panel:** bottom-right (girl drinking tea by a window with a small "maybe one day this will all be worth it" note)
- **Crop coordinates (as % of source dimensions):**
  - `left: 50%`
  - `top: 50%`
  - `width: 50%`
  - `height: 50%`
- **Why this panel:** quiet emotional exhaustion — matches Truth 01's "it's the weight" theme without text-fighting.

#### `public/sketches/truth-2.webp` — Truth 02 ("volume is the lever")

- **Source:** `public/sketches/guy-source.webp`
- **Panel:** top-middle (guy at a desk, focused, working through papers/applications — no figures behind him, no text on the wall, just focus)
- **Crop coordinates (as % of source dimensions):**
  - `left: 33.3%`
  - `top: 0%`
  - `width: 33.3%`
  - `height: 50%`
- **Why this panel:** depicts the mechanical, head-down work of volume — matches "volume is the lever" theme.

#### `public/sketches/truth-3.webp` — Truth 03 ("applying right, consistently")

- **Source:** `public/sketches/guy-source.webp`
- **Panel:** bottom-right (guy walking past a small group at a meeting room table; small handwritten note "NOT THE EASIEST PATH, BUT IT'S MINE." visible in the panel)
- **Crop coordinates (as % of source dimensions):**
  - `left: 66.7%`
  - `top: 50%`
  - `width: 33.3%`
  - `height: 50%`
- **Why this panel:** the handwritten note IS the message of Truth 03 — wisdom from doing it the right way over time. The text being visible is a feature, not a bug.

**Reference command (sharp / Node.js) for the implementing agent:**

If using `sharp` in a one-off Node script during Step 0a, the crops look like this (after reading source metadata for actual pixel dimensions):

```js
const sharp = require('sharp');

async function cropPanel(src, dst, leftPct, topPct, widthPct, heightPct) {
  const { width, height } = await sharp(src).metadata();
  return sharp(src)
    .extract({
      left:   Math.round(width  * leftPct   / 100),
      top:    Math.round(height * topPct    / 100),
      width:  Math.round(width  * widthPct  / 100),
      height: Math.round(height * heightPct / 100),
    })
    .webp({ quality: 82 })
    .toFile(dst);
}

await cropPanel('public/sketches/girl-source.webp', 'public/sketches/truth-1.webp', 50,   50, 50,   50);
await cropPanel('public/sketches/guy-source.webp',  'public/sketches/truth-2.webp', 33.3,  0, 33.3, 50);
await cropPanel('public/sketches/guy-source.webp',  'public/sketches/truth-3.webp', 66.7, 50, 33.3, 50);
```

**Verification after cropping:**

Open each output file at human scale and confirm:
- `truth-1.webp` shows a girl/woman seated, likely with a cup, by a window. Single figure. NO multi-panel layout visible (if you see multiple sketches/panels, the crop is wrong).
- `truth-2.webp` shows a single guy at a desk, focused on work. Single figure. NO grouped panels visible.
- `truth-3.webp` shows a guy walking past a meeting and the words "NOT THE EASIEST PATH, BUT IT'S MINE." should appear in the crop.

If any output shows the "From New Beginnings to New Opportunities" header text or multiple journey-style panels, you cropped from `hero-image.webp` instead of the sketch sources — recrop from the correct source file.

**Animation:** Each sketch image fades in on viewport intersection, 150ms AFTER its corresponding truth row's text (so the text appears first and the sketch joins quietly without stealing focus). Both sketch and text animate within the same grid row.

**Note:** Placement, sizing, and responsive behaviour for the sketches are now governed by the **Truth row structure** subsection above (2-column grid, 320px sketch column, alternating left/right, hidden on mobile). The earlier "marginalia" approach has been removed — it produced overlap because the sketch column was wider than the available outer margin.

---

### 8.3 Social Proof (`SocialProof.tsx`)

**Purpose:** Show others like them winning. Pre-empts the loneliness and skepticism the truths surfaced.

**Layout:**
- Background: `--bg-canvas` (back to canvas, alternation rhythm)
- Section padding 120px / 72px
- Container `max-width: 1100px`, centered
- Vertical structure: eyebrow → heading → sub → job-offers image (anchor) → 2-up quote cards below

**Eyebrow:** `WHAT GRADUATES ARE WALKING AWAY WITH`

**Section heading (Fraunces):**
```
Real Aussie grads.
Real offers.
```

**Sub-heading (Geist Sans 1.125rem, color `--text-secondary`, max-width 640px, centered):**

> Not testimonials we wrote. Actual offer messages — landed, dated, names redacted for privacy.

#### Anchor: the job-offers image

This is the proof. It carries most of the section's persuasive weight, with the two quote cards below adding voice/personality.

- Source: `/job-offers.webp` (rename from `Job offers.webp` to remove space — see §12 Step 0a)
- Render at full container width (1100px max)
- **Edge-faded** via `mask-image: radial-gradient(ellipse at center, black 60%, transparent 100%)` and the `-webkit-mask-image` equivalent. No hard rectangular border, no card shadow — the image dissolves into the cream background as if drawn there.
- 48px top margin from sub-heading, 64px bottom margin before quote cards

**Reveal animation (optional but recommended):** As the section enters viewport, the image fades in over 600ms (`opacity: 0 → 1`). Optionally layer a soft downward gradient wipe to imply "messages arriving over time" — but ship without this if it's not a clean implementation. The static image is strong enough alone.

If `prefers-reduced-motion: reduce`, show the image fully visible immediately with no fade.

#### Below the image: 2 quote cards (2-up grid on desktop, stacked on mobile)

These add complementary voice the image can't carry. **Clean-quote treatment** (no DM-style cards in this version):

- Background: `--bg-alt`
- No border, no shadow
- Radius: 16px
- Padding: 36px / 28px mobile
- Top: small `"` glyph in Fraunces 3rem weight 500, color `--accent-gold`, line-height 0.4 (sits visually above the quote)
- Pull-quote: Fraunces 1.25rem weight 500 italic, color `--text-primary`, line-height 1.45
- Attribution at bottom: Geist Sans 0.8125rem weight 600 color `--text-primary` + role/city Geist Sans 0.8125rem color `--text-muted` on the same line, separated by `·`

**Copy (placeholders — user will swap for real testimonials):**

##### Card 1
> *"The most useful career tool I've ever paid for. And honestly the free diagnostic alone is worth more than half the courses I've taken."*
>
> *Daniel K. · Software Engineer · Sydney*

##### Card 2
> *"It's like having a friend who happens to be a career coach. No fluff. No upsells. Just stuff that actually works in the Australian market."*
>
> *Tomás V. · Skilled Visa Holder · Perth*

**Interaction:** Quote cards fade in on viewport intersection with 0.15s stagger, after the image has revealed.

**Removed from prior spec version:** The 4-card 2x2 grid with DM-style cards (avatar initials + quotes) is replaced by this image-anchored layout. The job-offers image carries the "real proof" function more effectively; the two clean-quote cards provide complementary voice without competing for visual attention.

---

### 8.4 Objection Handler (`ObjectionHandler.tsx`)

**Purpose:** Pre-empt the "but couldn't I just use ChatGPT?" doubt that emerges right after the visitor sees other people winning.

**Layout:**
- Background: `--bg-alt`
- Section padding 120px / 72px.
- Container `max-width: 720px`, centered, single-column.

**Eyebrow:** `THE OBVIOUS QUESTION`

**Section heading (Fraunces):**
```
Why not just use ChatGPT,
Claude, Gemini, or your
favourite LLM?
```

**Lead paragraph (Geist Sans 1.125rem, color `--text-secondary`):**

> Fair question. You can absolutely use a general-purpose AI to write cover letters and edit resumes. Most of our users tried it first. Here's what we learned from sitting next to them while they did:

**Three reasons** — render as a stacked list with small lucide icons at left:

Icon: `Database` (lucide), size 20px, color `--accent-petrol`
**a) Trained on data ChatGPT and other LLMs don't have.**
Gathered from real people, having real conversations, making real hiring decisions across Australia. Direct interviews with recruiters and hiring managers — the kind of context a general-purpose AI never sees.

Icon: `ShieldCheck`, size 20px, color `--accent-petrol`
**b) Tight guardrails. No drift.**
Left alone, LLMs drift, hallucinate, and quietly reformat your documents in ways that hurt you. JobHub is powered by LLMs — but they're harnessed inside strict guardrails tuned for resume writing, cover letters, and Australian hiring patterns. You get an accurate, on-brief result every time, not a creative interpretation.

Icon: `Pencil`, size 20px, color `--accent-petrol`
**c) Send it as is. Or make it yours.**
Every document arrives ready to send — tailored to the role, calibrated for the Australian market, audited inside our guardrails. If you want to add a personal story, sharpen a line, or reorder bullets, every word is fully editable. The strong draft is the default; the personal touches are optional.

**Closing line (set apart, centered, max-width 580px):**

> *Think of it as your personal career advisor — one who knows the details of your career, has the language skills to frame it effectively, and knows exactly how Australian employers think.*

Render in Fraunces 1.25rem italic weight 500, color `--text-primary`, with 48px top margin.

**Interaction:** Same fade-in on scroll, no stagger needed.

---

### 8.5 Value Preview (`ValuePreview.tsx`)

**Purpose:** Now that doubts are cleared, show what they get — organized as outcomes (3 buckets), not features.

**Layout:**
- Background: `--bg-canvas`
- Section padding 120px / 72px.
- Container `max-width: 1100px`, centered.
- Section heading at top.
- Below: **3 outcome bucket cards** in a 3-column grid on desktop (≥1024px), 2-column on tablet (768–1023px), 1-column on mobile (<768px).

**Eyebrow:** `WHAT'S INSIDE`

**Section heading (Fraunces):**
```
Everything you need
to actually land the job.
```

**Sub-heading (Geist Sans 1.125rem, color `--text-secondary`, max-width 640px, centered, 16px below heading):**

> Three engines. One system. Built for the way Australian hiring actually works.

---

#### 8.5.0 Spotlight: The Free Diagnostic (above the 3-bucket grid)

**Purpose:** Spotlight the diagnostic as the lead gift before the visitor sees the rest of the value. The diagnostic is what they get for signing up — it's the door, not the room. This card sits ABOVE the 3-bucket grid inside the Value Preview section. It is visually distinct from the buckets: wider, more prominent, with an accent treatment.

**Layout (desktop):**
- Full container width (1100px max), single card spanning the row above the 3-bucket grid.
- Two-column layout INSIDE the card: left 60% is copy, right 40% is the report preview placeholder. Collapses to single-column stacked on mobile (placeholder on top, copy below).
- Card padding: 40px / 28px mobile.
- Card background: `--bg-surface` (white on canvas).
- Card border: 1px solid `--accent-gold-soft` (the soft gold underlines the "this is the featured one" cue without screaming).
- Card radius: 20px (slightly larger than the 16px buckets — visual hierarchy).
- Card shadow: lifted card shadow per §4.4.
- 48px bottom margin to separate from the 3-bucket grid below.

**Card content (left column):**

1. **Free badge** at top (pill, `9999px` radius, padding `4px 12px`, background `--accent-gold-soft`, text color a darker gold like `#8B6E32`, Geist Sans 0.75rem weight 700 uppercase letter-spacing 0.12em):
   ```
   START HERE · IT'S FREE
   ```

2. **Heading** (Fraunces 2rem weight 500, color `--text-primary`, line-height 1.15, letter-spacing -0.015em, 16px top margin):
   ```
   The diagnostic, on us.
   ```

3. **Body** (Geist Sans 1.0625rem, color `--text-secondary`, line-height 1.65, max-width 480px, 16px top margin):

   > Run a 3-minute review and walk away with a personalised report — what's broken in your search, why it's happening, and the next move for each problem. Yours to keep. No card. No upsell wall.

4. **Quiet value line** (Geist Sans 0.875rem italic, color `--text-muted`, 20px top margin, max-width 480px):

   > *Career coaches charge $300–$500 for the equivalent in a one-hour Zoom call. We give it to you free because we want you to see what we've built before you decide anything.*

5. **Inline CTA** (smaller variant of `PrimaryCTA` — same petrol bg, but `12px 24px` padding and 0.875rem font; 28px top margin):

   ```
   Run the diagnostic →
   ```

   On click: emit `landing_cta_clicked` with `{ position: 'spotlight', variant }`, navigate to `/auth?intent=signup`.

**Card content (right column — the visual):**

A placeholder block representing the diagnostic report preview:
- Aspect ratio 4/5 (portrait — looks like a document page).
- Background `--bg-alt`, whisper border, 12px radius.
- Inside, a layered mock representation: a small `FileText` lucide icon (size 32px, color `--accent-petrol`) at top-left, then several horizontal "text lines" rendered as thin (4px tall) rectangles in `--text-muted` at 20% opacity, varying widths (90%, 75%, 85%, 60%, 70%, 80%, 50%) — visually suggesting paragraphs of analysis without showing real content.
- Bottom-right corner: a small `--accent-gold` dot with a tiny "Section 3 of 8" caption in Geist Sans 0.6875rem color `--text-muted` (implies the report has substance and structure).
- A subtle hint overlay near the top: small badge "Your personalised diagnosis" Geist Sans 0.75rem weight 600 color `--text-primary`, background `--bg-canvas`, whisper border, 9999px radius, 4px 10px padding.

**Why this design:** A real cropped report screenshot is the goal long-term (placeholder for v1). The layered abstract preview implies "this is a real document with real structure" without faking specific content. When real screenshots arrive, swap the placeholder right column for a cropped image with the same dimensions.

**Interaction:** Fades in on scroll like other sections. The CTA hovers/focuses identically to other primary CTAs.

**Tracking:** The spotlight CTA fires `landing_cta_clicked` with `position: 'spotlight'`. This means we can compare conversion from spotlight vs hero vs final CTA in PostHog Funnels.

---

**Bucket card structure:**
- Background: `--bg-surface`
- Whisper border, 16px radius, lifted shadow on hover (`0 1px 2px rgba(...,0.04), 0 6px 20px rgba(...,0.06)`)
- Padding: 32px / 24px mobile
- Vertical layout inside the card:
  1. **Visual placeholder** at top — 16:9 aspect ratio, background `--bg-alt`, whisper border, 12px radius. Inside: a centered "Screenshot placeholder" text in Geist Sans 0.8125rem color `--text-muted` (just for v1; real screenshots come later).
  2. **Bucket name** — Fraunces 1.5rem weight 500, color `--text-primary`, 24px top margin.
  3. **Outcome line** — Geist Sans 1rem weight 500, color `--accent-petrol`, 8px top margin. This is the bold promise.
  4. **What's inside** — Geist Sans 0.875rem, color `--text-secondary`, 16px top margin. Use a `·`-separated inline list, not a bulleted list (more premium).

**Verbatim copy:**

#### Bucket 1
- Name: **End-to-End Application System**
- Outcome line: *High-quality, tailored applications in under 3 minutes.*
- What's inside: JD analysis · Resume generator · Cover letter generator · Application tracker · Follow-up templates · Interview prep
- Visual placeholder caption: *"Sample: tailored cover letter generated in 47 seconds"*

#### Bucket 2
- Name: **Hidden Job Market Access**
- Outcome line: *Get noticed before jobs are posted publicly.*
- What's inside: LinkedIn optimiser · LinkedIn profile generator · Outreach templates
- Visual placeholder caption: *"Sample: before/after LinkedIn profile rewrite"*

#### Bucket 3
- Name: **Smart Job Matching**
- Outcome line: *Apply to jobs you can actually get.*
- What's inside: Matching scores · Gap analysis · Job recommendations
- Visual placeholder caption: *"Sample: match-score card with reasons"*

**Interaction:**
- Cards fade in on scroll with 0.1s stagger.
- Hover: subtle lift (`translateY(-2px)`) and shadow depth.
- No card is individually clickable — the entire page funnels to ONE CTA (final section).

---

### 8.6 Risk Reversal (`RiskReversal.tsx`)

**Purpose:** Remove the last objection — "but what if it doesn't work?" — by making the ask as small as possible.

**Layout:**
- Background: `--bg-alt`
- Section padding 96px / 64px (smaller than full-section because this is a transition).
- Container `max-width: 720px`, centered.

**Eyebrow:** `BEFORE YOU DECIDE`

**Section heading (Fraunces, but smaller — this is a transition):** `1.75rem weight 500`
```
Costs you nothing to find out.
```

**Below the heading, a horizontal row of 3 reassurances on desktop (vertical stack on mobile):**

Each reassurance has:
- A lucide `Check` icon, size 18px, color `--success`
- Reassurance label: Geist Sans 1rem weight 600, color `--text-primary`
- Reassurance sub: Geist Sans 0.875rem, color `--text-secondary`

Items (label / sub):
1. **Free to try.** No payment required to run the diagnostic.
2. **No credit card.** Sign up with email. Nothing charged, ever, unless you choose a paid plan.
3. **3 minutes.** That's it. Less time than a coffee order.

**Below the reassurances** (32px top margin), a small italic line, centered (Fraunces 1rem italic, color `--text-secondary`):

> *Built for Aussie grads by someone who was one.*

---

### 8.7 Final CTA (`FinalCTA.tsx`)

**Purpose:** Repeat the ask after the visitor has been warmed up by truths, proof, objection handling, value, and risk removal. This is the bottom-of-funnel close.

**Layout:**
- Background: `--bg-canvas`
- Section padding 120px / 72px.
- Container `max-width: 640px`, centered.

**Section heading (Fraunces, large):** `clamp(2rem, 4vw, 3rem) weight 500`
```
You've read this far.
Let's see what's actually
going on with your search.
```

**Sub (Geist Sans 1.125rem, color `--text-secondary`, 16px top margin):**

> The diagnostic takes 3 minutes and shows you, specifically, what's broken in your current approach — and what to do about it. No card, no commitment. Just an honest read.

**Primary CTA** (reuse `PrimaryCTA.tsx`):
- Label: **Run my 3-minute diagnosis →**
- On click: emit `landing_cta_clicked` with `{ position: 'final', variant }`, then navigate to `/auth?intent=signup`.
- 32px top margin.

**Microcopy below CTA (Geist Sans 0.8125rem, color `--text-muted`):**
> Free · No card needed · Built for Aussie grads

**Below the CTA, a tiny micro-FAQ pair (one Q+A, centered, 64px top margin):**

Layout: A small chevron-right lucide icon (`ChevronRight`, 14px, color `--text-muted`) followed by the question in Geist Sans 0.9375rem weight 600 color `--text-primary`. Below the question, the answer in Geist Sans 0.875rem color `--text-secondary`.

**Q:** Is this just for fresh grads?
**A:** No — built with grads in mind, but works for anyone job-hunting in the Australian market. Most of what makes Australian hiring weird affects everyone in it.

---

### 8.8 Footer (`LandingFooter.tsx`)

**Purpose:** Legal compliance + light closure. Not a place to nav around.

**Layout:**
- Background: `--bg-canvas` (matches FinalCTA — no visual break)
- Top divider: 1px solid `--border-whisper`, full width
- Padding: 48px 24px desktop, 32px 20px mobile.
- Container max-width 1100px, centered.

**Contents:**
- Left: JobHub wordmark (matching nav)
- Center / spread: Legal links in a horizontal row (Geist Sans 0.8125rem, color `--text-muted`, hover color `--text-secondary`, 24px gap between):
  - Terms · Privacy · Refunds · Cancellation · Contact
- Right: Copyright line: `© 2026 JobHub · Made in Australia` (Geist Sans 0.8125rem, color `--text-muted`)

On mobile: stack vertically with 16px gaps; copyright at the bottom.

All legal links navigate to existing routes (`/legal/terms`, `/legal/privacy`, `/legal/refunds`, `/legal/cancellation`, `/contact`).

---

## 9. Page-level details

### 9.1 Background continuity

The page uses three background colors in alternating sections to create rhythm:

```
NAV (transparent until scroll)
HERO         — bg-canvas (cream)
THREE TRUTHS — bg-alt    (warmer cream)
SOCIAL PROOF — bg-canvas
OBJECTION    — bg-alt
VALUE PREV   — bg-canvas
RISK REV     — bg-alt
FINAL CTA    — bg-canvas
FOOTER       — bg-canvas (no break from final CTA)
```

No hard divider lines between sections — the bg-color shift IS the separation.

### 9.2 Section anchor IDs

Each section's root element should have an `id`:
- `#hero`, `#truths`, `#proof`, `#objection`, `#value`, `#risk`, `#cta`

(Useful for future deep-linking or scroll-into-view from external campaigns. Not used in v1 navigation.)

### 9.3 Page metadata

In `LandingPage.tsx`, use `document.title = 'JobHub · The Australian Application Engine'` on mount. (No need for react-helmet; this is a simple SPA.) Set `<meta name="description">` via standard React effect to:

> Find the exact gaps in your job application process and what to do about them. Free 3-minute diagnostic. Built for Australian graduates.

### 9.4 Accessibility checklist

- All interactive elements receive visible focus ring (`0 0 0 3px var(--ring-focus)`).
- CTAs are `<button>` (or `<a>` for nav links) — not divs with onClick.
- Headings follow correct order: one `<h1>` (hero headline), then `<h2>` for each section, `<h3>` for sub-elements.
- Color contrast: all text combinations pass WCAG AA. Primary text on canvas: ~17:1. Petrol CTA bg on cream: ~6.5:1. Verify with a contrast checker on the implementation.
- Touch targets: 44px minimum height for all interactive elements (CTAs are 48px, links use comfortable padding).
- Motion respects `prefers-reduced-motion`: when set, disable scroll-reveal animations and the scroll-cue bob.

### 9.5 Images & asset placeholders

All images in v1 are **placeholders**. Real assets will be supplied later. For each placeholder location, use a styled `<div>` with:

- Background `--bg-alt` (lighter than card bg if card is on `--bg-canvas`; vice versa)
- Whisper border
- 12px radius
- Aspect ratio enforced via `aspect-ratio: 16/9` (or `1/1` for testimonial avatars)
- Centered placeholder text: Geist Sans 0.8125rem color `--text-muted` describing what goes there (e.g. *"Sample: tailored cover letter generated in 47 seconds"*)

Do not embed any random stock images. The minimal placeholder is more premium than mismatched stock photography.

---

## 10. PostHog tracking events

Add the following functions to `src/lib/analytics.ts`:

```typescript
// ── Landing page funnel ───────────────────────────────────────────────────────

export function trackLandingViewed(variant: string) {
  posthog.capture('landing_viewed', { hero_variant: variant });
}

export function trackLandingSectionViewed(section: string, variant: string) {
  posthog.capture('landing_section_viewed', { section, hero_variant: variant });
}

export function trackLandingCtaClicked(position: 'hero' | 'spotlight' | 'final', variant: string) {
  posthog.capture('landing_cta_clicked', { position, hero_variant: variant });
}

export function trackLandingLogInClicked(variant: string) {
  posthog.capture('landing_login_clicked', { hero_variant: variant });
}
```

Wire them up:

- `LandingPage.tsx` on mount: call `trackLandingViewed(variant)` and `posthog.register({ hero_variant: variant })`.
- Each section component on first intersection: call `trackLandingSectionViewed('hero' | 'truths' | 'proof' | 'objection' | 'value' | 'risk' | 'cta', variant)`. Use `IntersectionObserver` with `threshold: 0.5` and a `useRef` flag to fire once.
- All three CTAs (hero, spotlight, final): call `trackLandingCtaClicked(position, variant)` then navigate. The three `position` values are distinguishable in PostHog so we can compare close rates.
- Log in link: call `trackLandingLogInClicked(variant)` then navigate.

This gives us per-variant funnel: viewed → which sections seen → which CTA clicked. We can build the PostHog Funnels using `hero_variant` as a breakdown.

---

## 11. Acceptance criteria

Before this is considered shipped, the following must be true:

1. **Routing:** Unauthenticated visit to `/` shows `LandingPage`. Authenticated visit to `/` retains existing behaviour (StrategyHub for onboarded, OnboardingIntake auth/questions for not-yet-onboarded — minus the now-removed `StepWelcome`).
2. **A/B variants:** Visiting in three separate fresh browsers (or three private windows) shows three different hero variants over enough trials (chi-square reasonable distribution). Variant is sticky on refresh in the same browser.
3. **All 7 sections render** in the order specified, with the verbatim copy in §8.
4. **PostHog events fire** as specified in §10: `landing_viewed` on mount, `landing_section_viewed` on each section's first intersection, `landing_cta_clicked` on either CTA, `landing_login_clicked` on the nav link.
5. **Fonts load:** Fraunces and Geist Sans both render correctly; no FOIT/FOUT lasting >500ms.
6. **Mobile responsive:** All sections render correctly at 375px, 768px, and 1280px viewport widths. CTA is full-width on mobile, intrinsic on desktop. No horizontal scroll at any size.
7. **Accessibility:** All interactive elements have visible focus state. Heading order correct. Reduced-motion respected.
8. **Lighthouse:** Performance ≥85, Accessibility ≥95, Best Practices ≥95 on mobile.
9. **Build clean:** `npm run build` passes with no new TypeScript errors. `npm run lint` passes.
10. **OnboardingIntake.tsx still works:** Removing `StepWelcome` does not break the auth/questions/processing flow that follows it.
11. **Global font propagation visible:** Loading `/strategy`, `/admin`, `/jobs`, or any other authenticated in-app page (after logging in via existing test account) shows Fraunces in headings and Geist Sans in body text — proof that the Step 1 global font-token update propagated correctly. Existing palettes and layouts on those pages should be **unchanged** otherwise; only the typeface should have shifted.

---

## 12. Implementation plan (ordered steps for the deepseek agent)

Execute in this order. Each step should compile and lint clean before moving to the next.

### Step 0a — Image optimisation & cropping

Before any component work, optimise the source images already in `/public/` and produce the cropped panels we need. Original assets:

| Source file | Current size | Status |
|---|---|---|
| `hero image.webp` | ~2.7MB | Needs rename + compress |
| `Girl in Aus.webp` | ~5.2MB | Needs split into 2–3 cropped panels |
| `Guy in aus.webp` | ~3.5MB | Needs split into 2–3 cropped panels |
| `Job offers.webp` | ~400KB | Acceptable; rename only |

**Tasks:**

1. **Rename to web-safe paths** (no spaces, lowercase-hyphen):
   - `public/hero image.webp` → `public/hero-image.webp`
   - `public/Girl in Aus.webp` → `public/sketches/girl-source.webp` (working file; do not reference directly in code)
   - `public/Guy in aus.webp` → `public/sketches/guy-source.webp` (working file; do not reference directly in code)
   - `public/Job offers.webp` → `public/job-offers.webp`

2. **Compress hero image:** Resize `hero-image.webp` to max-width 1400px, re-encode at WebP quality 82. Target ~300–400KB. Tool: Squoosh (squoosh.app) or any equivalent — `cwebp`, `sharp`, ImageMagick all fine.

3. **Crop sketch panels** from `Girl in Aus.webp` and `Guy in aus.webp`. The source images are multi-panel layouts (4-panel grid and 6-panel grid respectively). Pre-crop them so each landing-page placement loads only one panel — not the full source image.

   Final outputs (each ~80–120KB at WebP quality 82):
   - `public/sketches/truth-1.webp` — single-character vignette (recommendation: contemplative figure looking at Sydney Opera House panel from `Girl in Aus.webp` top-left)
   - `public/sketches/truth-2.webp` — focused-at-laptop vignette (recommendation: middle-row panel from `Guy in aus.webp`)
   - `public/sketches/truth-3.webp` — "Not the easiest path, but it's mine" panel from `Guy in aus.webp` OR the window-with-tea panel from `Girl in Aus.webp`

4. **Compress job offers:** Re-encode `job-offers.webp` if a noticeable size reduction is possible at quality 82; otherwise leave at ~400KB.

5. **Keep the original source files** in `public/sketches/` (girl-source.webp, guy-source.webp) — do not reference them in code, but keep them for future re-cropping. Add them to `.gitignore` only if storage is a concern; otherwise commit them too (~9MB combined — acceptable).

**Verification:** After this step, `du -sh public/` should show roughly 1.5–2MB total imagery (hero + 3 sketches + job-offers + og + vite). All landing-page component imports should reference the optimised, properly-named paths from §8.

### Step 1 — Fonts & global setup (includes app-wide font propagation)
- In `index.html`, add Google Fonts CSS links for `Fraunces` (weights 400, 500, 600, opsz axes) and `Geist Sans` (weights 400, 500, 600, 700).
- In `src/index.css`, add CSS custom properties for the design tokens listed in §4 under a `.landing-page` scope (so the *palette* and *spacing* tokens don't leak into in-app surfaces).
- **App-wide font propagation (Phase 1 of the broader site redesign):** Inside `src/index.css`, also update the existing global `--font-display` and `--font-body` variables in `:root` so the *entire app* uses the new typeface stack:

  ```css
  :root {
    --font-display: 'Fraunces', Georgia, 'Times New Roman', serif;
    --font-body: 'Geist Sans', -apple-system, 'Segoe UI', system-ui, sans-serif;
    /* ... existing tokens ... */
  }
  ```

  Do NOT touch the palette tokens (`--color-bg`, `--color-surface`, `--color-fg`, etc.) in this step. Palette migration is out of scope for this spec — see §3.

  This propagates the typographic shift across every page that uses `var(--font-display)` and `var(--font-body)` (which is the majority of the in-app surface). The Source Serif 4 / Source Sans 3 imports can be left in place (won't be referenced anymore) — do not remove them in this step to avoid breaking anything we haven't checked.

- Add `.has-grain` CSS class globally (per §4.7) so it's available app-wide for future iterations, even though it's only applied on landing for v1.

### Step 2 — Tokens module
- Create `src/components/landing/tokens.ts` exporting typed objects for colors, type, spacing. This lets components import named tokens rather than hardcoding hex.

### Step 3 — Variant logic
- Create `src/lib/landingVariant.ts` per §7.2.

### Step 4 — Shared components
- Create `src/components/landing/shared/PrimaryCTA.tsx` per §8.1 CTA spec.
- Create `src/components/landing/shared/Eyebrow.tsx` per §8.1 eyebrow spec.

### Step 5 — Section components
Implement each section component in order: `LandingNav.tsx`, `Hero.tsx`, `ThreeTruths.tsx`, `SocialProof.tsx`, `ObjectionHandler.tsx`, `ValuePreview.tsx`, `RiskReversal.tsx`, `FinalCTA.tsx`, `LandingFooter.tsx`. Each should be importable and visually correct in isolation.

### Step 6 — Page composition
- Create `src/pages/LandingPage.tsx` that:
  - Reads the variant via `getHeroVariant()`.
  - On mount: registers the variant as a PostHog super-property, calls `trackLandingViewed(variant)`, sets `document.title` + meta description.
  - Renders the sections in order, wrapping each in an `<section id="...">` with an `IntersectionObserver` ref that fires `trackLandingSectionViewed` once.

### Step 7 — Analytics additions
- Add the four new tracking functions to `src/lib/analytics.ts` per §10.

### Step 8 — Routing wire-up
- In `src/App.tsx`, add the new public route for `/` per §6.2.

### Step 9 — Remove StepWelcome
- In `src/components/OnboardingIntake.tsx`, remove `StepWelcome` and its step-0 render path. The flow now starts at the auth step. Update any step-index logic that assumed welcome was step 0.

### Step 10 — Mobile + accessibility audit
- Test at 375px, 768px, 1280px.
- Verify keyboard navigation reaches every interactive element with a visible focus ring.
- Verify reduced-motion behaviour by toggling OS-level `prefers-reduced-motion`.
- Verify color contrast.

### Step 11 — Build + lint
- `npm run build` and `npm run lint` must both pass.
- Open `/` in dev and confirm three reloads with cleared localStorage show three different variants.

---

## 13. Open questions for the user

These are the things I can't decide without the user. The implementing agent should NOT guess these — surface them back to the user via the spec author.

1. **Real quote-card text** — the 2 quote cards in Social Proof (§8.3) use placeholder text. Real testimonials to be supplied by user; swap in when delivered. The job-offers image is real and ships in v1 — that's the proof anchor.
2. **Wordmark treatment** — the spec assumes a text-based "JobHub" wordmark in Fraunces. If a logo SVG exists or is planned, swap it in.
3. **Real outcome-bucket visuals** — the spec uses styled placeholder boxes with captions for the 3 outcome buckets and the diagnostic spotlight in v1. When real product screenshots are available, replace the placeholders.
4. **Pricing CTA copy in nav** — explicitly omitted from this spec; the page funnels to a single signup CTA. If user later wants a "Pricing" nav link added, that's a small follow-up.
5. **Sketch panel cropping** — Step 0a recommends specific panels from `Girl in Aus.webp` and `Guy in aus.webp` for the 3 Truths marginalia. The implementing agent has discretion to pick adjacent panels if a recommended one doesn't crop cleanly. Flag back if uncertain.

---

## 14. Glossary (for the implementing agent)

- **ICP** — Ideal Customer Profile. Here: Australian graduate job seekers, often on graduate or skilled visas, often migrants, often coming from LinkedIn.
- **Diagnostic** — the existing JobHub feature where a user uploads a CV + answers a few questions and receives a personalised report on what's broken in their job search.
- **OnboardingIntake** — the existing 4-step flow at `/` for unauthenticated users that includes welcome (being removed) → auth → questions → processing.
- **The "84% bounce"** — Vercel-measured drop from `/` to `/auth` between Apr 20 – May 20 2026.
- **B1 premium-warm** — the chosen visual register, inspired by Notion/Linear/Vercel landing pages: warm neutrals, sophisticated typography, restrained palette, generous whitespace.

---

**End of spec.**

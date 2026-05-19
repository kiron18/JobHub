# JobHub Design System

> **Category:** Product-first, human-centered
> **Tagline:** *You already have everything it takes. The right system just gets you there faster.*
> **Design dates:** 2026-05-19
> **Source of truth:** This file. The design guide at `docs/product-decisions/2026-05-19 Design guide.md` is the philosophical companion.

---

## 1. Visual Theme & Atmosphere

Calm precision with earned warmth. The platform is the most organised, thoughtful person the user has ever worked with — it knows where they are, what they need next, and never makes them feel like a problem to be solved.

The user is educated, capable, and exhausted. They have crossed an ocean. They are sitting in a sharehouse at 11pm filling out their 180th application. The design must make them feel two things simultaneously: *someone built this for me specifically* and *I am in capable hands.* Not excited. Not inspired. Safe and capable. There is a difference.

Two voices, one surface:
- **Warmth** comes from proportion, spacing, and typography — not from colour or decoration. Generous white space. Rounded corners that never feel playful. A serif heading that reads like a considered person speaking directly to you.
- **Precision** comes from restraint. Every element has a reason to exist. Nothing decorative. The layout is the opposite of the ATS systems and government portals they've been fighting — those are cluttered, confusing, hostile. This is clear, deliberate, unhurried.

**The emotional register:** Considered. Optimistic but not naive. Professional but not sterile. When the diagnostic names a gap, it does so with clinical precision — never with judgment. The urgency exists to push action, not to shame.

---

## 2. Color Palette & Roles

### Token architecture (four-layer model per Open Design)

| Layer | Who decides | Tokens |
|---|---|---|
| **A1-identity** | Brand author | `--bg`, `--fg`, `--accent`, `--font-display`, `--font-body` |
| **A1-structure** | Brand author | Type scale, leading, container max, section-y |
| **A2-shared** | Brand with defaults | `--space-*`, `--radius-*`, `--motion-*`, `--elev-*`, `--accent-on`, semantic colours |
| **B-slot** | Brand or alias | Component-level aliases (`--surface-warm`, `--meta`) |
| **C-extension** | Brand only | One-off tokens for specific surfaces |

### Core palette

| Token | Dark value | Light value | Usage |
|---|---|---|---|
| `--bg` | `#141517` | `#F4F5F7` | Page background. Warm dark, not `#000`. Light is off-white, not `#fff`. |
| `--surface` | `#1E1F22` | `#FFFFFF` | Cards, modals, dropdowns |
| `--surface-elevated` | `#25272B` | `#FFFFFF` | Elevated cards with shadow |
| `--fg` | `#E4E5E7` | `#1A1B1E` | Primary body text |
| `--fg-muted` | `#A0A2A8` | `#6B6E76` | Secondary text, captions, labels |
| `--fg-faint` | `#5C5F66` | `#9CA0A8` | Placeholders, metadata |
| `--border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.10)` | Default borders — semi-transparent |
| `--border-strong` | `rgba(255,255,255,0.14)` | `rgba(0,0,0,0.18)` | Hover states, active borders |

### Accent (single — at most 2 uses per screen)

| Token | Value | Usage |
|---|---|---|
| `--accent` | `#2D5A6E` | Primary CTAs, active nav, key signals. The colour of capability. |
| `--accent-hover` | `#386F86` | CTA hover state |
| `--accent-soft` | `rgba(45,90,110,0.12)` | Ghost buttons, tab active backgrounds |
| `--accent-on` | `#E4E5E7` | Text on accent background |

**Accent discipline:** Exactly one accent per screen. Max 2 visible uses. Typical pair: one navigation indicator + one primary CTA. Links count as accent — if you have a CTA, demote links to `--fg` with underline.

### Semantic palette

| Token | Value | Usage |
|---|---|---|
| `--signal` | `#C5A059` | Diagnostic urgency, key metrics, "pay attention" moments. A signal colour, not a second accent. |
| `--signal-soft` | `rgba(197,160,89,0.10)` | Signal backgrounds |
| `--success` | `#7DA67D` | Positive states, completion indicators |
| `--success-soft` | `rgba(125,166,125,0.10)` | Success backgrounds |
| `--danger` | `#B85C5C` | Errors, destructive actions |
| `--danger-soft` | `rgba(184,92,92,0.10)` | Error backgrounds |

### Forbidden colours
- **Indigo `#6366f1`** (Tailwind indigo-500) — the universal AI-slop tell. Never use as accent or primary.
- **Pure black `#000000`** — causes eye strain on dark surfaces.
- **Pure white `#FFFFFF`** as background — use `--bg` light value instead.
- **Generic SaaS blue** (electric blue, `#0066FF`, etc.) — the platform is not LinkedIn.

---

## 3. Typography Rules

### Font stack

| Role | Font | Fallback |
|---|---|---|
| **Display / Headings** | `'Source Serif 4'` | `Georgia, 'Times New Roman', serif` |
| **Body / UI** | `'Source Sans 3'` | `-apple-system, 'Segoe UI', system-ui, sans-serif` |
| **Monospace** | `'JetBrains Mono'` | `'Fira Code', 'Cascadia Code', monospace` |

**Why this pair:** Source Serif 4 and Source Sans 3 are designed by the same type designer (Frank Grießhammer) as part of the Adobe Source superfamily. Their matching x-heights, proportions, and weight language guarantee they harmonise. Source Serif 4 carries genuine warmth and authority without feeling old-fashioned. Source Sans 3 is proven for dense information — CVs, job ads, cover letters, selection criteria.

### Type scale (multiplicative 1.25)

| Role | Size | Weight | Line height | Letter-spacing |
|---|---|---|---|---|
| **Display** | 48px | 600 (Semibold) | 1.05 | `-0.025em` |
| **H1** | 36px | 600 | 1.1 | `-0.02em` |
| **H2** | 28px | 600 | 1.15 | `-0.015em` |
| **H3** | 22px | 600 | 1.2 | `-0.01em` |
| **Body** | 15–16px | 400 (Regular) | 1.6 | `0` |
| **Body small** | 13–14px | 400 | 1.5 | `0.01em` |
| **Caption / label** | 11–12px | 600 | 1.3 | `0.06em` (uppercase) |
| **Button** | 15px | 600 | 1 | `0.02em` |
| **Micro** | 10px | 700 | 1.2 | `0.12em` (uppercase) |

### Weight system (three-weight model)

| Weight | Usage |
|---|---|
| **400 (Regular)** | Body copy, paragraphs |
| **500 (Medium)** | Emphasised UI text, navigation, active labels |
| **600 (Semibold)** | Headlines, buttons, strong emphasis |

Weight 700+ is rarely used. Reserve it for the diagnostic page and key metrics only.

### Critical letter-spacing rules

- **ALL CAPS at any size:** minimum `0.06em` tracking. The `0.06em` floor is empirical — anything tighter and counters collapse on screen.
- **Display 32px+:** `-0.02em` to `-0.025em`. Display without negative tracking looks loose and weak.
- **Body text (14–18px):** `0` (default).
- **Small text (11–13px):** `0.01em` to `0.02em` (positive).
- **UI labels and buttons:** `0.02em`.

These two failures are the most reliable tells of AI-generated design: ALL CAPS without tracking, and display text without negative tracking.

### Line length

Body copy: **50–75 characters per line.** In CSS: `max-width: 65ch`.
Narrow surfaces (sidebar, cards): `max-width: 45ch`.

### Typography hierarchy principles

1. **One dominant entry point per screen** — the first thing the eye lands on is the most important information.
2. **Intentional rhythm** — size gaps between levels should feel deliberate, not accidental. Use the scale above; don't interpolate.
3. **Recoverable information flow** — the user should be able to scan from largest to smallest and understand the page structure without reading everything.

---

## 4. Component Stylings

### Buttons

| Property | Primary | Secondary | Ghost |
|---|---|---|---|
| Background | `--accent` | Transparent | Transparent |
| Border | None | `1px solid --border` | None |
| Text | `--accent-on` | `--fg` | `--fg-muted` |
| Hover bg | `--accent-hover` | `--accent-soft` | `rgba(255,255,255,0.04)` |
| Radius | 14px | 14px | 10px |
| Padding | 15px 30px | 14px 28px | 8px 16px |
| Weight | 600 | 600 | 500 |
| Shadow | `0 6px 24px --accent at 25%` | None | None |

Motion: micro-movement on hover (translateY -1px), scale(0.99) on tap. Duration: 150ms ease-out.

### Cards

- Background: `--surface`
- Border: `1px solid --border`
- Radius: 18px (outer), 14px (inner cards)
- Padding: 24px (card), 18px (inner)
- Shadow (elevated only): `0 8px 60px rgba(0,0,0,0.35)`
- No glassmorphism in dark mode. Light mode may use low-opacity surfaces.
- **Never** use a coloured left-border accent on a rounded card — that is the canonical "AI dashboard tile" shape. Drop either the radius or the left border.

### Inputs

- Background: `rgba(255,255,255,0.04)` (dark), `rgba(0,0,0,0.04)` (light)
- Border: `1px solid --border`
- Radius: 12px
- Focus: `1px solid --accent`, subtle `--accent-soft` glow
- Padding: 12px 16px
- Text: `--fg`
- Placeholder: `--fg-faint`
- Label: 11px uppercase, 0.06em tracking, `--fg-muted`

### Navigation (sidebar)

- Collapsed: 72px, icons only
- Expanded: 240px, labels visible
- Active item: `--accent-soft` background, `--accent` border
- Hover: `rgba(255,255,255,0.04)` (dark)
- No dropdown arrows. No nested menus.

---

## 5. Layout Principles

### Grid
- Containers: 720px (diagnostic), 1080px (dashboard), 560px (onboarding)
- Not a strict column grid — use natural content flow with max-width constraints
- Whitespace is the primary separator. Dividers only between unrelated sections.

### Spacing scale

| Token | Pixels |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 24px |
| `--space-6` | 32px |
| `--space-7` | 48px |
| `--space-8` | 64px |

### Section rhythm
- Section gap desktop: 48px
- Section gap mobile: 32px
- Card internal padding: 24px (use `--space-5`)
- Content top-bias: never centre-vertically. Top-align content within sections.

---

## 6. Depth & Elevation

Two levels only:

| Level | Usage | Shadow |
|---|---|---|
| **Flat (0)** | Default surfaces, cards, inputs | None |
| **Raised (1)** | Modals, dropdowns, sticky bars | `0 8px 60px rgba(0,0,0,0.45)` (dark), `0 8px 40px rgba(0,0,0,0.12)` (light) |

- No neumorphism.
- No glassmorphism (backdrop blur is reserved for the sticky bar only).
- No inner shadows on cards or inputs.

---

## 7. Do's and Don'ts

### Do
- ✅ Let whitespace do the work. Remove chrome before adding it.
- ✅ One accent element per screen. Pick a pair (nav + CTA, or chip + button), not a flood.
- ✅ Sentence-case headings. Title-case only for proper nouns and brand names.
- ✅ Use the signal colour (`--signal`) precisely — it's for diagnostic urgency metrics, not decoration.
- ✅ Clinical naming of gaps: "Your resume opens without context" not "You're not writing a good summary."
- ✅ Push urgency through specificity and precision, not through volume or exclamation.
- ✅ Use micro-motion purposefully — a 2px button press, a subtle progress transition. No gratuitous animation.

### Don't
- ❌ No indigo `#6366f1` anywhere. Never.
- ❌ No "trust" gradients (purple→blue, blue→cyan, indigo→pink).
- ❌ No emoji as feature icons (`✨🚀🎯⚡🔥💡`). Use Lucide monoline SVG with `currentColor`.
- ❌ No "AI-powered" badges or labels. The AI is the infrastructure, not the identity.
- ❌ No lorem ipsum or filler copy. Empty states should be intentional compositions.
- ❌ No stock photography of graduates shaking hands. If imagery exists, it must be authentic.
- ❌ No left-border accent on rounded cards (the AI-dashboard-tile shape).
- ❌ No decorative gradients — gradients only serve hierarchy separation.
- ❌ No pure black or pure white backgrounds.
- ❌ No drop shadows on inputs.
- ❌ No generic "Get started" or "Learn more" buttons. Use specific, action-oriented labels.

---

## 8. Responsive Behavior

| Breakpoint | Behaviour |
|---|---|
| **Desktop ≥ 1024px** | Full layout. Sidebar visible (collapsed by default, expand on hover). |
| **Tablet 640–1023px** | Sidebar becomes hamburger drawer. Diagnostic sections stack. Containers scale down proportionally. |
| **Phone < 640px** | Full-width containers with 16px gutters. Cards lose internal padding reduction to 16px. Stepper goes single-column. All font sizes use clamp() values. |

**Touch targets:** Minimum 44px for all interactive elements on touch devices.

---

## 9. Agent Prompt Guide

### Quick colour reference
```css
--bg:          #141517 (dark) / #F4F5F7 (light)
--surface:     #1E1F22 (dark) / #FFFFFF (light)
--fg:          #E4E5E7 (dark) / #1A1B1E (light)
--accent:      #2D5A6E
--signal:      #C5A059
--success:     #7DA67D
--font-display: 'Source Serif 4', Georgia, serif
--font-body:    'Source Sans 3', system-ui, sans-serif
```

### When designing new surfaces
1. Lead with the type hierarchy — size + weight + spacing before colour.
2. Use `--accent` at most twice per screen. Three times is a bug.
3. Never invent hex values outside this palette. If a new use case needs colour, find the nearest token and flag the gap.
4. The generated application documents (resume, cover letter, selection criteria) are exempt from the visual redesign. They follow the markdown rendering rules in `server/rules/`.
5. Every new component must match the spacing scale. No ad-hoc pixel values — use `--space-*` tokens.
6. Before adding a motion effect, ask: does this help the user understand what happened? If the answer is "it looks nice," skip it.
7. Empty states are not afterthoughts. They are design compositions — use the type system to explain what's missing and what to do next.

### Iteration guide
- **~80% proven patterns + ~20% distinctive choice.** The 20% lives in typography, microcopy, and one micro-interaction per flow.
- When unsure, **subtract.** Fewer boxes, less chrome, more space.
- The difference between "clinical precision" and "cold" is one extra unit of spacing. When something feels harsh, add breathing room before changing a colour.

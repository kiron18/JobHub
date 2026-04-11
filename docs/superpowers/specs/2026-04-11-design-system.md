# Design System — JobHub

**Date:** 2026-04-11
**Status:** Approved
**Scope:** Foundation-level visual redesign — typography, colour palettes, glassmorphism tokens, palette picker migration. All other features build on top of this.

---

## Overview

The current design uses Inter, OKLCH-derived `--brand-hue` CSS variables, and a dark-first aesthetic. This spec defines a new cohesive light-first design system with Plus Jakarta Sans, named palette presets, consistent glass card tokens, and a semantic CSS custom property layer — while leaving dark mode untouched.

Every subsequent feature (diagnostic overhaul, achievement coach, landing page) inherits from this system. Nothing is built before this lands.

---

## What Changes

| Area | Before | After |
|---|---|---|
| Font | Inter | Plus Jakarta Sans |
| Light bg | `#eceef4` | `#F8FAFC` |
| Palette system | Single `--brand-hue` OKLCH number | 6 named presets with hex accent/light/muted tokens |
| Palette picker UI | Chips + fine-tune slider | 6 chips only (no slider) |
| Glass card token | Ad-hoc inline styles | `src/styles/tokens.ts` shared object |
| Semantic tokens | Not present | CSS custom properties on `:root` |

## What Does Not Change

- Dark mode (`DARK` theme object in `ThemeContext`) — values unchanged
- Dark mode toggle logic
- Tailwind OKLCH brand scale (`--color-brand-*`) — kept, still drives Tailwind utilities
- Any existing page layout, component structure, or logic

---

## Typography

**Font:** Plus Jakarta Sans — loaded via Google Fonts `<link>` in `index.html`.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

**Scale:**

| Token | Size | Weight | Usage |
|---|---|---|---|
| Display | 36px | 800 | Hero / onboarding headline |
| H1 | 26px | 800 | Page titles |
| H2 | 20px | 700 | Section headings |
| H3 | 16px | 700 | Card headings |
| Body | 14px | 400 | Default text |
| Label | 11px | 700 / uppercase / 0.08em tracking | Overline labels |

**CSS rule (`:root`):**
```css
font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
```

---

## Colour Palettes

Six named presets replace the OKLCH hue number. Each preset defines three tokens:

| Name | Accent | Light | Muted |
|---|---|---|---|
| Ocean | `#3B82F6` | `#EFF6FF` | `#BFDBFE` |
| Sage | `#10B981` | `#ECFDF5` | `#A7F3D0` |
| Ember | `#F97316` | `#FFF7ED` | `#FED7AA` |
| Rose | `#EC4899` | `#FDF2F8` | `#FBCFE8` |
| Violet | `#7C3AED` | `#F5F3FF` | `#DDD6FE` |
| Steel | `#64748B` | `#F8FAFC` | `#CBD5E1` |

**CSS custom properties written to `:root` when a palette is selected:**

```css
--palette-accent: <hex>;
--palette-light:  <hex>;
--palette-muted:  <hex>;
```

These drive all accent usage in components. The existing `--brand-hue` is also kept in sync: the nearest OKLCH hue for each palette is written alongside the hex tokens so Tailwind utilities (`bg-brand-500`, etc.) continue to work.

**Hue mapping (for `--brand-hue` compatibility):**

| Palette | Hue |
|---|---|
| Ocean | 220 |
| Sage | 158 |
| Ember | 24 |
| Rose | 322 |
| Violet | 262 |
| Steel | 220 |

**Default:** Ocean (hue 220).

**Storage key:** `jobhub_palette` (replaces `jobhub_brand_hue`). On first load, if no `jobhub_palette` key exists, fall back to reading `jobhub_brand_hue` and mapping to nearest palette, then migrate.

---

## Light Mode Background

The `LIGHT.bg` value in `ThemeContext.tsx` changes from `#eceef4` to `#F8FAFC`.

---

## Glass Card Tokens

All glass cards across the app use the same values. Defined in `src/styles/tokens.ts`:

```ts
export const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.85)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  borderRadius: 20,
};

export const elevatedCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.85)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
  borderRadius: 20,
};
```

These are **light mode values only**. Dark mode cards continue to use values from `ThemeContext.DARK`.

**Adoption:** Existing components are NOT migrated in this task. `tokens.ts` is created; new components from here on import from it. Existing components are migrated opportunistically when touched for other work.

---

## Semantic CSS Tokens

Written to `:root` by `ThemeContext` on each theme change:

```css
--text:       #0F172A;   /* dark */   or #F1F5F9  /* dark mode */
--text-muted: #64748B;                or #94A3B8
--text-faint: #94A3B8;                or #475569
--radius-card:  20px;
--radius-input: 12px;
--space-card:   24px;
```

These are additive — they don't replace the existing `ThemeContext` object used in inline styles. New components can use either.

---

## Palette Picker Component Changes

`HuePicker.tsx` — renamed or updated in-place to `PalettePicker.tsx`.

**UI changes:**
- Remove the "Fine-tune" section and the range input slider entirely
- Replace with 6 named palette chips in a 3×2 grid
- Each chip shows: a colour swatch circle + label below
- Selected state: `2px solid <accent>` outline, slight scale-up
- Label: palette name, 10px, grey when unselected, accent colour when selected
- Popover title: "Accent colour" (same as before)
- Popover width: 220px

**Component props:** `{ isDark: boolean }` — unchanged.

**Storage:** Saves palette name to `jobhub_palette`. On mount, reads `jobhub_palette`; if absent, reads legacy `jobhub_brand_hue` and picks nearest palette.

**`applyPalette(name)` function:**
- Sets `--palette-accent`, `--palette-light`, `--palette-muted` on `document.documentElement`
- Sets `--brand-hue` on `document.documentElement` (for Tailwind compatibility)

---

## Files Created / Modified

| File | Action | Responsibility |
|---|---|---|
| `index.html` | Modify | Add Plus Jakarta Sans Google Fonts `<link>` |
| `src/index.css` | Modify | Update `:root` font-family |
| `src/contexts/ThemeContext.tsx` | Modify | Change `LIGHT.bg` to `#F8FAFC`; write semantic tokens to `:root` on mount/toggle |
| `src/components/HuePicker.tsx` | Modify | Remove slider; replace with 6 named palette chips; switch storage key; write palette hex tokens |
| `src/styles/tokens.ts` | Create | `glassCard` and `elevatedCard` style objects |

---

## Migration Strategy

1. Land this spec's five file changes as a single commit
2. All subsequent feature work imports from `src/styles/tokens.ts` for card styles
3. Existing component glass values are left as-is until those components are touched for other reasons — no big-bang migration
4. The Tailwind `--brand-hue` scale continues working unchanged; `--palette-accent` is additive for components that want the direct hex value

---

## Out of Scope

- Migrating existing components to use `tokens.ts` (opportunistic, not batched)
- Dark mode palette variants (dark mode unchanged)
- Landing page, diagnostic overhaul, mobile — all later sub-projects
- Removing the old `jobhub_brand_hue` localStorage key (just ignore it after migration)

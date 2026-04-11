# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Inter with Plus Jakarta Sans, introduce 6 named colour palettes with hex tokens, and create shared glassmorphism constants — without touching dark mode or any page layout.

**Architecture:** All palette logic lives in a new `src/styles/tokens.ts` file; `HuePicker.tsx` imports from there to avoid duplication. `ThemeContext` writes semantic CSS custom properties to `:root` so new components can use CSS vars instead of the `T` object. Changes are additive — no existing inline styles on other components are touched.

**Tech Stack:** React, TypeScript, CSS custom properties, Google Fonts (Plus Jakarta Sans), Vite

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/styles/tokens.ts` | Create | Palette definitions, `applyPalette()`, `glassCard` / `elevatedCard` style objects |
| `index.html` | Modify | Google Fonts `<link>` tags for Plus Jakarta Sans |
| `src/index.css` | Modify | Update `:root` font-family |
| `src/contexts/ThemeContext.tsx` | Modify | Change `LIGHT.bg` to `#F8FAFC`; write semantic CSS tokens on mount/toggle |
| `src/components/HuePicker.tsx` | Modify | Remove fine-tune slider; show 6 named palette chips; migrate storage key |

---

### Task 1: Create `src/styles/tokens.ts`

**Files:**
- Create: `src/styles/tokens.ts`

- [ ] **Step 1: Create the file**

```ts
import type React from 'react';

// ── Palette definitions ───────────────────────────────────────────────────────

export const PALETTES = {
  Ocean:  { accent: '#3B82F6', light: '#EFF6FF', muted: '#BFDBFE', hue: 220 },
  Sage:   { accent: '#10B981', light: '#ECFDF5', muted: '#A7F3D0', hue: 158 },
  Ember:  { accent: '#F97316', light: '#FFF7ED', muted: '#FED7AA', hue: 24  },
  Rose:   { accent: '#EC4899', light: '#FDF2F8', muted: '#FBCFE8', hue: 322 },
  Violet: { accent: '#7C3AED', light: '#F5F3FF', muted: '#DDD6FE', hue: 262 },
  Steel:  { accent: '#64748B', light: '#F8FAFC', muted: '#CBD5E1', hue: 220 },
} as const;

export type PaletteName = keyof typeof PALETTES;

/**
 * Write palette hex tokens and keep --brand-hue in sync for Tailwind utilities.
 * Called by HuePicker whenever the user switches palette.
 */
export function applyPalette(name: PaletteName): void {
  const p = PALETTES[name];
  const root = document.documentElement;
  root.style.setProperty('--palette-accent', p.accent);
  root.style.setProperty('--palette-light', p.light);
  root.style.setProperty('--palette-muted', p.muted);
  root.style.setProperty('--brand-hue', String(p.hue));
}

// ── Shared glass card styles ──────────────────────────────────────────────────
// Light-mode only. Dark mode continues to use ThemeContext.DARK values.

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

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd E:/AntiGravity/JobHub && npm run build 2>&1 | tail -5`
Expected: no TypeScript errors (build may still warn about other things — that's fine as long as there are no new TS errors from this file)

- [ ] **Step 3: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/styles/tokens.ts
git commit -m "feat(design-system): add palette definitions and glass card tokens"
```

---

### Task 2: Load Plus Jakarta Sans

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Add Google Fonts links to `index.html`**

Replace:
```html
    <title>job-ready-app</title>
```
With:
```html
    <title>job-ready-app</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Update `:root` font-family in `src/index.css`**

In the `:root` block, replace:
```css
  font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif;
```
With:
```css
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
```

- [ ] **Step 3: Verify build**

Run: `cd E:/AntiGravity/JobHub && npm run build 2>&1 | tail -5`
Expected: clean (or same warnings as before — no new errors)

- [ ] **Step 4: Commit**

```bash
cd E:/AntiGravity/JobHub
git add index.html src/index.css
git commit -m "feat(design-system): load Plus Jakarta Sans, replace Inter"
```

---

### Task 3: Update ThemeContext — light bg and semantic tokens

**Files:**
- Modify: `src/contexts/ThemeContext.tsx`

Current `LIGHT.bg` value: `'#eceef4'`
New value: `'#F8FAFC'`

Semantic tokens to write: `--text`, `--text-muted`, `--text-faint`, `--radius-card`, `--radius-input`, `--space-card`.

- [ ] **Step 1: Change `LIGHT.bg` and add `applySemanticTokens` helper**

Open `src/contexts/ThemeContext.tsx`. After the `DARK` object (around line 58), add this helper function before the `// ── Context` section:

```ts
// ── Semantic token injection ──────────────────────────────────────────────────

function applySemanticTokens(isDark: boolean): void {
  const root = document.documentElement;
  root.style.setProperty('--text',       isDark ? '#F1F5F9' : '#0F172A');
  root.style.setProperty('--text-muted', isDark ? '#94A3B8' : '#64748B');
  root.style.setProperty('--text-faint', isDark ? '#475569' : '#94A3B8');
  root.style.setProperty('--radius-card',  '20px');
  root.style.setProperty('--radius-input', '12px');
  root.style.setProperty('--space-card',   '24px');
}
```

- [ ] **Step 2: Change `LIGHT.bg`**

In the `LIGHT` object, change:
```ts
  bg: '#eceef4', dotColor: '#bfc4d1',
```
To:
```ts
  bg: '#F8FAFC', dotColor: '#bfc4d1',
```

- [ ] **Step 3: Call `applySemanticTokens` inside `ThemeProvider`**

In `ThemeProvider`, the existing `useEffect` persists dark mode to localStorage:
```ts
  useEffect(() => {
    localStorage.setItem('jobhub_dark_mode', String(isDark));
  }, [isDark]);
```

Add a second `useEffect` directly after it:
```ts
  useEffect(() => {
    applySemanticTokens(isDark);
  }, [isDark]);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd E:/AntiGravity/JobHub && npm run build 2>&1 | tail -5`
Expected: no new errors

- [ ] **Step 5: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/contexts/ThemeContext.tsx
git commit -m "feat(design-system): lighten page bg to #F8FAFC, inject semantic CSS tokens"
```

---

### Task 4: Update HuePicker — replace slider with palette chips

**Files:**
- Modify: `src/components/HuePicker.tsx`

The current `HuePicker.tsx` has a fine-tune slider and uses `jobhub_brand_hue` (stores a hue number). We replace the slider with 6 named palette chips, change the storage key to `jobhub_palette`, and add legacy migration.

The export name `HuePicker` stays the same — `DashboardLayout.tsx` imports it by that name and must not change.

- [ ] **Step 1: Replace the entire file content**

```tsx
import { useState, useEffect, useRef } from 'react';
import { Palette } from 'lucide-react';
import { PALETTES, PaletteName, applyPalette } from '../styles/tokens';

const STORAGE_KEY = 'jobhub_palette';
const LEGACY_KEY  = 'jobhub_brand_hue';

// Best-effort mapping from old hue integers to named palette
const LEGACY_HUE_TO_PALETTE: Partial<Record<number, PaletteName>> = {
  220: 'Ocean',
  158: 'Sage',
  24:  'Ember',
  322: 'Rose',
  262: 'Violet',
};

function getInitialPalette(): PaletteName {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in PALETTES) return stored as PaletteName;

  // Migrate from legacy hue key
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  if (legacyRaw) {
    const hue = parseInt(legacyRaw, 10);
    const migrated = LEGACY_HUE_TO_PALETTE[hue] ?? 'Ocean';
    localStorage.setItem(STORAGE_KEY, migrated);
    return migrated;
  }

  return 'Ocean';
}

export function HuePicker({ isDark }: { isDark: boolean }) {
  const [open, setOpen]       = useState(false);
  const [palette, setPalette] = useState<PaletteName>(getInitialPalette);
  const ref = useRef<HTMLDivElement>(null);

  // Apply on mount
  useEffect(() => { applyPalette(palette); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function setAndPersist(name: PaletteName) {
    setPalette(name);
    applyPalette(name);
    localStorage.setItem(STORAGE_KEY, name);
    setOpen(false);
  }

  const bgColor     = isDark ? 'rgba(15,20,30,0.92)' : 'rgba(255,255,255,0.95)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const labelColor  = isDark ? '#6b7280' : '#9ca3af';
  const iconColor   = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Change accent colour"
        title="Accent colour"
        style={{
          width: 40, height: 40, borderRadius: 99,
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'background 0.2s',
        }}
      >
        <Palette size={15} color={iconColor} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 48, right: -100,
          width: 220, borderRadius: 16, padding: '16px',
          background: bgColor, border: `1px solid ${borderColor}`,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          zIndex: 100,
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: labelColor, marginBottom: 12,
          }}>
            Accent colour
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(Object.entries(PALETTES) as [PaletteName, typeof PALETTES[PaletteName]][]).map(([name, p]) => {
              const isSelected = palette === name;
              return (
                <button
                  key={name}
                  onClick={() => setAndPersist(name)}
                  title={name}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px 4px', borderRadius: 8,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: p.accent,
                    outline: isSelected ? `2px solid ${p.accent}` : 'none',
                    outlineOffset: 2,
                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.15s',
                  }} />
                  <span style={{
                    fontSize: 9, fontWeight: 600,
                    color: isSelected ? p.accent : labelColor,
                    letterSpacing: '0.03em',
                  }}>
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd E:/AntiGravity/JobHub && npm run build 2>&1 | tail -10`
Expected: clean build, no new TypeScript errors

- [ ] **Step 3: Commit**

```bash
cd E:/AntiGravity/JobHub
git add src/components/HuePicker.tsx
git commit -m "feat(design-system): replace hue slider with 6 named palette chips"
```

---

### Task 5: Smoke test and sign-off

**Files:** none (read-only verification)

- [ ] **Step 1: Full clean build**

Run: `cd E:/AntiGravity/JobHub && npm run build`
Expected: `✓ built in` with no TypeScript errors and no new warnings compared to before these tasks

- [ ] **Step 2: Run server tests to confirm nothing server-side broke**

Run: `cd E:/AntiGravity/JobHub/server && npm test 2>&1 | tail -10`
Expected: all tests passing (server tests are unaffected by frontend changes)

- [ ] **Step 3: Confirm `src/styles/tokens.ts` exports are importable**

Verify that the following import will work in any future component by checking the file exists:

```bash
ls E:/AntiGravity/JobHub/src/styles/tokens.ts
```
Expected: file exists

- [ ] **Step 4: Final commit if any loose files**

```bash
cd E:/AntiGravity/JobHub && git status
```

If clean: no action needed. If there are untracked or modified files from these tasks: add and commit them with `git commit -m "chore(design-system): smoke test cleanup"`.

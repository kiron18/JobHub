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

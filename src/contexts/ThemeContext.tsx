import React, { createContext, useContext, useEffect } from 'react';
import { warm } from '../lib/theme/warmTokens';

// ── Theme types & objects ─────────────────────────────────────────────────────

export interface Theme {
  bg: string; dotColor: string;
  card: string; cardBorder: string; cardShadow: string;
  text: string; textMuted: string; textFaint: string;
  inputBg: string; inputBorder: string; inputText: string;
  btnBg: string; btnText: string; btnShadow: string;
  progressBg: string; progressFill: string;
  chipBg: string; chipText: string;
  optBg: string; optBorder: string; optText: string;
  optActiveBg: string; optActiveBorder: string; optActiveText: string;
  pillBg: string; pillBorder: string; pillText: string;
  pillActiveBg: string; pillActiveBorder: string; pillActiveText: string;
  blobGrad: string; blobShadow: string;
  toggleBg: string; toggleIcon: string;
  fileBg: string; fileBorder: string;
  accentSuccess: string;
  accentSecondary: string;
  errorMuted: string;
}

// Single warm theme. The previous LIGHT/DARK pair is collapsed into one
// canonical surface that matches src/lib/theme/warmTokens.ts. The old exports
// (LIGHT, DARK) are preserved as aliases so any straggling imports still
// resolve to a sensible value while we hunt them down.
export const WARM: Theme = {
  bg: warm.colors.bgCanvas,                                   // #FAF7F2
  dotColor: warm.colors.borderWhisper,
  card: warm.colors.bgSurface,                                // #FFFFFF
  cardBorder: warm.colors.borderWhisper,
  cardShadow: warm.shadow.soft,
  text: warm.colors.textPrimary,                              // #1A1814
  textMuted: warm.colors.textSecondary,                       // #5C5750
  textFaint: warm.colors.textMuted,                           // #8B847B
  inputBg: warm.colors.bgAlt,                                 // #F4EFE8
  inputBorder: warm.colors.borderDefined,
  inputText: warm.colors.textPrimary,
  btnBg: warm.colors.accentPetrol,                            // #2D5A6E
  btnText: '#FFFFFF',
  btnShadow: '0 6px 24px rgba(45,90,110,0.25)',
  progressBg: warm.colors.borderWhisper,
  progressFill: warm.colors.accentPetrol,
  chipBg: warm.colors.bgAlt,
  chipText: warm.colors.textSecondary,
  optBg: warm.colors.bgSurface,
  optBorder: warm.colors.borderWhisper,
  optText: warm.colors.textSecondary,
  optActiveBg: warm.colors.accentPetrol,
  optActiveBorder: warm.colors.accentPetrol,
  optActiveText: '#FFFFFF',
  pillBg: warm.colors.bgSurface,
  pillBorder: warm.colors.borderWhisper,
  pillText: warm.colors.textSecondary,
  pillActiveBg: warm.colors.accentPetrol,
  pillActiveBorder: warm.colors.accentPetrol,
  pillActiveText: '#FFFFFF',
  blobGrad: 'radial-gradient(circle at 33% 28%, #F4EFE8 0%, #E8D7B0 55%, #C5A059 100%)',
  blobShadow:
    'inset -10px -10px 28px rgba(26,24,20,0.05), inset 5px 5px 18px rgba(255,255,255,0.85), 20px 32px 80px rgba(26,24,20,0.08)',
  toggleBg: warm.colors.bgAlt,
  toggleIcon: warm.colors.textSecondary,
  fileBg: warm.colors.bgAlt,
  fileBorder: warm.colors.borderWhisper,
  accentSuccess: warm.colors.accentGold,                      // gold (preserves prior visual identity)
  accentSecondary: '#7DA67D',
  errorMuted: '#B85C5C',
};

export const LIGHT: Theme = WARM;
export const DARK: Theme = WARM;

// ── Semantic token injection ──────────────────────────────────────────────────

function applyWarmTokens(): void {
  const root = document.documentElement;
  root.style.setProperty('--text',             warm.colors.textPrimary);
  root.style.setProperty('--text-muted',       warm.colors.textSecondary);
  root.style.setProperty('--text-faint',       warm.colors.textMuted);
  root.style.setProperty('--bg-app',           warm.colors.bgCanvas);
  root.style.setProperty('--bg-surface',       warm.colors.bgSurface);
  root.style.setProperty('--accent-primary',   warm.colors.accentPetrol);
  root.style.setProperty('--accent-success',   warm.colors.accentGold);
  root.style.setProperty('--accent-secondary', '#7DA67D');
  root.style.setProperty('--error-muted',      '#B85C5C');
  root.style.setProperty('--radius-card',  '18px');
  root.style.setProperty('--radius-input', '12px');
  root.style.setProperty('--space-card',   '24px');
}

// ── Context ───────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  T: Theme;
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  T: WARM,
  isDark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyWarmTokens();
  }, []);

  // Toggle is preserved as a no-op so any straggling caller doesn't crash.
  // The dark/light split is gone; everything is warm.
  const value: ThemeContextValue = {
    T: WARM,
    isDark: false,
    toggle: () => {},
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

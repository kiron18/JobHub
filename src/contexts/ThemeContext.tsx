import React, { createContext, useContext, useState, useEffect } from 'react';

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
  // New palette (Strategy Hub redesign — 2026-05-12).
  // accentSuccess  → gold (match scores, value indicators, "achievement" tone)
  // accentSecondary → sage (highlights, calm progress)
  // errorMuted     → muted red, reserved for genuine errors and destructive confirms only
  accentSuccess: string;
  accentSecondary: string;
  errorMuted: string;
}

export const LIGHT: Theme = {
  bg: '#F8FAFC', dotColor: '#bfc4d1',
  card: 'rgba(255,255,255,0.62)', cardBorder: 'rgba(255,255,255,0.9)',
  cardShadow: '0 8px 80px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95)',
  text: '#111827', textMuted: '#6b7280', textFaint: '#9ca3af',
  inputBg: 'rgba(255,255,255,0.78)', inputBorder: 'rgba(0,0,0,0.1)', inputText: '#111827',
  btnBg: '#2D5A6E', btnText: '#FFFFFF', btnShadow: '0 4px 24px rgba(45,90,110,0.25)',
  progressBg: 'rgba(0,0,0,0.08)', progressFill: '#2D5A6E',
  chipBg: 'rgba(17,24,39,0.07)', chipText: '#374151',
  optBg: 'rgba(255,255,255,0.55)', optBorder: 'rgba(0,0,0,0.1)', optText: '#374151',
  optActiveBg: '#2D5A6E', optActiveBorder: '#2D5A6E', optActiveText: '#FFFFFF',
  pillBg: 'rgba(255,255,255,0.6)', pillBorder: 'rgba(0,0,0,0.12)', pillText: '#6b7280',
  pillActiveBg: '#2D5A6E', pillActiveBorder: '#2D5A6E', pillActiveText: '#FFFFFF',
  blobGrad: 'radial-gradient(circle at 33% 28%, #ffffff 0%, #dde1ec 55%, #c4c9d9 100%)',
  blobShadow: 'inset -10px -10px 28px rgba(0,0,0,0.07), inset 5px 5px 18px rgba(255,255,255,0.95), 20px 32px 80px rgba(0,0,0,0.14)',
  toggleBg: 'rgba(0,0,0,0.08)', toggleIcon: '#6b7280',
  fileBg: 'rgba(255,255,255,0.5)', fileBorder: 'rgba(0,0,0,0.12)',
  accentSuccess: '#C5A059', accentSecondary: '#7DA67D', errorMuted: '#B85C5C',
};

export const DARK: Theme = {
  bg: '#1A1C1E', dotColor: '#22262a',
  card: '#25282B', cardBorder: 'rgba(255,255,255,0.06)',
  cardShadow: '0 8px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
  text: '#E0E0E0', textMuted: '#A0A4A8', textFaint: '#6B6F73',
  inputBg: 'rgba(255,255,255,0.04)', inputBorder: 'rgba(255,255,255,0.08)', inputText: '#E0E0E0',
  btnBg: '#2D5A6E', btnText: '#E0E0E0', btnShadow: '0 4px 24px rgba(45,90,110,0.35)',
  progressBg: 'rgba(255,255,255,0.06)', progressFill: '#2D5A6E',
  chipBg: 'rgba(255,255,255,0.05)', chipText: '#C8CCD0',
  optBg: 'rgba(255,255,255,0.03)', optBorder: 'rgba(255,255,255,0.08)', optText: '#C8CCD0',
  optActiveBg: '#2D5A6E', optActiveBorder: '#2D5A6E', optActiveText: '#E0E0E0',
  pillBg: 'rgba(255,255,255,0.04)', pillBorder: 'rgba(255,255,255,0.08)', pillText: '#A0A4A8',
  pillActiveBg: '#2D5A6E', pillActiveBorder: '#2D5A6E', pillActiveText: '#E0E0E0',
  blobGrad: 'radial-gradient(circle at 33% 28%, #2a2e32 0%, #1f2326 55%, #1A1C1E 100%)',
  blobShadow: 'inset -10px -10px 28px rgba(0,0,0,0.6), inset 5px 5px 18px rgba(255,255,255,0.03), 20px 32px 80px rgba(0,0,0,0.5)',
  toggleBg: 'rgba(255,255,255,0.06)', toggleIcon: '#A0A4A8',
  fileBg: 'rgba(255,255,255,0.04)', fileBorder: 'rgba(255,255,255,0.08)',
  accentSuccess: '#C5A059', accentSecondary: '#7DA67D', errorMuted: '#B85C5C',
};

// ── Semantic token injection ──────────────────────────────────────────────────

function applySemanticTokens(isDark: boolean): void {
  const root = document.documentElement;
  root.style.setProperty('--text',       isDark ? '#E0E0E0' : '#0F172A');
  root.style.setProperty('--text-muted', isDark ? '#A0A4A8' : '#64748B');
  root.style.setProperty('--text-faint', isDark ? '#6B6F73' : '#94A3B8');
  // Strategy Hub palette — exposed as CSS vars for Tailwind-side and pure-CSS use.
  root.style.setProperty('--bg-app',           isDark ? '#1A1C1E' : '#F8FAFC');
  root.style.setProperty('--bg-surface',       isDark ? '#25282B' : 'rgba(255,255,255,0.62)');
  root.style.setProperty('--accent-primary',   '#2D5A6E');
  root.style.setProperty('--accent-success',   '#C5A059');
  root.style.setProperty('--accent-secondary', '#7DA67D');
  root.style.setProperty('--error-muted',      '#B85C5C');
  root.style.setProperty('--radius-card',  '20px');
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
  T: LIGHT,
  isDark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    // v2: default dark to match onboarding. One-time migration for existing users.
    const migrated = localStorage.getItem('jobhub_theme_v2');
    if (!migrated) {
      localStorage.setItem('jobhub_theme_v2', '1');
      localStorage.setItem('jobhub_dark_mode', 'true');
      return true;
    }
    const stored = localStorage.getItem('jobhub_dark_mode');
    if (stored === null) return true; // new users default dark
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('jobhub_dark_mode', String(isDark));
  }, [isDark]);

  useEffect(() => {
    applySemanticTokens(isDark);
  }, [isDark]);

  const toggle = () => setIsDark(prev => !prev);

  const T = isDark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ T, isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

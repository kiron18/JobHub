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
}

export const LIGHT: Theme = {
  bg: '#F8FAFC', dotColor: '#bfc4d1',
  card: 'rgba(255,255,255,0.62)', cardBorder: 'rgba(255,255,255,0.9)',
  cardShadow: '0 8px 80px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95)',
  text: '#111827', textMuted: '#6b7280', textFaint: '#9ca3af',
  inputBg: 'rgba(255,255,255,0.78)', inputBorder: 'rgba(0,0,0,0.1)', inputText: '#111827',
  btnBg: '#111827', btnText: '#ffffff', btnShadow: '0 4px 24px rgba(0,0,0,0.2)',
  progressBg: 'rgba(0,0,0,0.08)', progressFill: '#111827',
  chipBg: 'rgba(17,24,39,0.07)', chipText: '#374151',
  optBg: 'rgba(255,255,255,0.55)', optBorder: 'rgba(0,0,0,0.1)', optText: '#374151',
  optActiveBg: '#111827', optActiveBorder: '#111827', optActiveText: '#ffffff',
  pillBg: 'rgba(255,255,255,0.6)', pillBorder: 'rgba(0,0,0,0.12)', pillText: '#6b7280',
  pillActiveBg: '#111827', pillActiveBorder: '#111827', pillActiveText: '#ffffff',
  blobGrad: 'radial-gradient(circle at 33% 28%, #ffffff 0%, #dde1ec 55%, #c4c9d9 100%)',
  blobShadow: 'inset -10px -10px 28px rgba(0,0,0,0.07), inset 5px 5px 18px rgba(255,255,255,0.95), 20px 32px 80px rgba(0,0,0,0.14)',
  toggleBg: 'rgba(0,0,0,0.08)', toggleIcon: '#6b7280',
  fileBg: 'rgba(255,255,255,0.5)', fileBorder: 'rgba(0,0,0,0.12)',
};

export const DARK: Theme = {
  bg: '#0d1117', dotColor: '#1b2030',
  card: 'rgba(255,255,255,0.05)', cardBorder: 'rgba(255,255,255,0.1)',
  cardShadow: '0 8px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
  text: '#f3f4f6', textMuted: '#9ca3af', textFaint: '#4b5563',
  inputBg: 'rgba(255,255,255,0.07)', inputBorder: 'rgba(255,255,255,0.11)', inputText: '#f3f4f6',
  btnBg: '#f3f4f6', btnText: '#111827', btnShadow: '0 4px 24px rgba(0,0,0,0.4)',
  progressBg: 'rgba(255,255,255,0.1)', progressFill: '#f3f4f6',
  chipBg: 'rgba(255,255,255,0.08)', chipText: '#d1d5db',
  optBg: 'rgba(255,255,255,0.04)', optBorder: 'rgba(255,255,255,0.1)', optText: '#d1d5db',
  optActiveBg: '#f3f4f6', optActiveBorder: '#f3f4f6', optActiveText: '#111827',
  pillBg: 'rgba(255,255,255,0.06)', pillBorder: 'rgba(255,255,255,0.12)', pillText: '#9ca3af',
  pillActiveBg: '#f3f4f6', pillActiveBorder: '#f3f4f6', pillActiveText: '#111827',
  blobGrad: 'radial-gradient(circle at 33% 28%, #1e2535 0%, #131924 55%, #0d1117 100%)',
  blobShadow: 'inset -10px -10px 28px rgba(0,0,0,0.6), inset 5px 5px 18px rgba(255,255,255,0.03), 20px 32px 80px rgba(0,0,0,0.5)',
  toggleBg: 'rgba(255,255,255,0.1)', toggleIcon: '#9ca3af',
  fileBg: 'rgba(255,255,255,0.05)', fileBorder: 'rgba(255,255,255,0.12)',
};

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
    const stored = localStorage.getItem('jobhub_dark_mode');
    if (stored === null) return false; // default: light
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

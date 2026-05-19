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
  accentSuccess: string;
  accentSecondary: string;
  errorMuted: string;
}

export const LIGHT: Theme = {
  bg: '#F4F5F7', dotColor: '#d0d3db',
  card: '#FFFFFF', cardBorder: 'rgba(0,0,0,0.10)',
  cardShadow: '0 8px 40px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95)',
  text: '#1A1B1E', textMuted: '#6B6E76', textFaint: '#9CA0A8',
  inputBg: 'rgba(0,0,0,0.04)', inputBorder: 'rgba(0,0,0,0.10)', inputText: '#1A1B1E',
  btnBg: '#2D5A6E', btnText: '#FFFFFF', btnShadow: '0 6px 24px rgba(45,90,110,0.25)',
  progressBg: 'rgba(0,0,0,0.06)', progressFill: '#2D5A6E',
  chipBg: 'rgba(0,0,0,0.05)', chipText: '#4A4D55',
  optBg: 'rgba(255,255,255,0.75)', optBorder: 'rgba(0,0,0,0.10)', optText: '#4A4D55',
  optActiveBg: '#2D5A6E', optActiveBorder: '#2D5A6E', optActiveText: '#FFFFFF',
  pillBg: 'rgba(255,255,255,0.7)', pillBorder: 'rgba(0,0,0,0.12)', pillText: '#6B6E76',
  pillActiveBg: '#2D5A6E', pillActiveBorder: '#2D5A6E', pillActiveText: '#FFFFFF',
  blobGrad: 'radial-gradient(circle at 33% 28%, #e8eaee 0%, #d4d8e0 55%, #c8ccd4 100%)',
  blobShadow: 'inset -10px -10px 28px rgba(0,0,0,0.05), inset 5px 5px 18px rgba(255,255,255,0.90), 20px 32px 80px rgba(0,0,0,0.10)',
  toggleBg: 'rgba(0,0,0,0.06)', toggleIcon: '#6B6E76',
  fileBg: 'rgba(255,255,255,0.7)', fileBorder: 'rgba(0,0,0,0.12)',
  accentSuccess: '#C5A059', accentSecondary: '#7DA67D', errorMuted: '#B85C5C',
};

export const DARK: Theme = {
  bg: '#141517', dotColor: '#202226',
  card: '#1E1F22', cardBorder: 'rgba(255,255,255,0.08)',
  cardShadow: '0 8px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.03)',
  text: '#E4E5E7', textMuted: '#A0A2A8', textFaint: '#5C5F66',
  inputBg: 'rgba(255,255,255,0.04)', inputBorder: 'rgba(255,255,255,0.08)', inputText: '#E4E5E7',
  btnBg: '#2D5A6E', btnText: '#E4E5E7', btnShadow: '0 6px 24px rgba(45,90,110,0.35)',
  progressBg: 'rgba(255,255,255,0.05)', progressFill: '#2D5A6E',
  chipBg: 'rgba(255,255,255,0.04)', chipText: '#C8C9CC',
  optBg: 'rgba(255,255,255,0.03)', optBorder: 'rgba(255,255,255,0.08)', optText: '#C8C9CC',
  optActiveBg: '#2D5A6E', optActiveBorder: '#2D5A6E', optActiveText: '#E4E5E7',
  pillBg: 'rgba(255,255,255,0.04)', pillBorder: 'rgba(255,255,255,0.08)', pillText: '#A0A2A8',
  pillActiveBg: '#2D5A6E', pillActiveBorder: '#2D5A6E', pillActiveText: '#E4E5E7',
  blobGrad: 'radial-gradient(circle at 33% 28%, #26282c 0%, #1C1D20 55%, #141517 100%)',
  blobShadow: 'inset -10px -10px 28px rgba(0,0,0,0.5), inset 5px 5px 18px rgba(255,255,255,0.02), 20px 32px 80px rgba(0,0,0,0.5)',
  toggleBg: 'rgba(255,255,255,0.05)', toggleIcon: '#A0A2A8',
  fileBg: 'rgba(255,255,255,0.03)', fileBorder: 'rgba(255,255,255,0.08)',
  accentSuccess: '#C5A059', accentSecondary: '#7DA67D', errorMuted: '#B85C5C',
};

// ── Semantic token injection ──────────────────────────────────────────────────

function applySemanticTokens(isDark: boolean): void {
  const root = document.documentElement;
  root.style.setProperty('--text',       isDark ? '#E4E5E7' : '#1A1B1E');
  root.style.setProperty('--text-muted', isDark ? '#A0A2A8' : '#6B6E76');
  root.style.setProperty('--text-faint', isDark ? '#5C5F66' : '#9CA0A8');
  root.style.setProperty('--bg-app',           isDark ? '#141517' : '#F4F5F7');
  root.style.setProperty('--bg-surface',       isDark ? '#1E1F22' : '#FFFFFF');
  root.style.setProperty('--accent-primary',   '#2D5A6E');
  root.style.setProperty('--accent-success',   '#C5A059');
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
  T: LIGHT,
  isDark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const migrated = localStorage.getItem('jobhub_theme_v2');
    if (!migrated) {
      localStorage.setItem('jobhub_theme_v2', '1');
      localStorage.setItem('jobhub_dark_mode', 'true');
      return true;
    }
    const stored = localStorage.getItem('jobhub_dark_mode');
    if (stored === null) return true;
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

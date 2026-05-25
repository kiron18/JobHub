/* ── Site-wide warm-cream tokens (promoted from landing) ────────────
   Landing's src/components/landing/tokens.ts should re-export from here.
   Do not import landing tokens directly from authenticated surfaces.    */

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
    // Semantic
    danger:     '#B85C5C',
    dangerSoft: 'rgba(184, 92, 92, 0.10)',
  },
  type: {
    fontDisplay: "'Fraunces', Georgia, 'Times New Roman', serif",
    fontBody:    "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",
  },
  spacing: {
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
    sectionPadDesktop: 56,
    sectionPadMobile:  40,
  },
  radius: {
    input: 10, button: 10, card: 16, pill: 9999,
  },
  shadow: {
    soft:    '0 1px 2px rgba(26,24,20,0.04), 0 4px 16px rgba(26,24,20,0.04)',
    lifted:  '0 1px 3px rgba(26,24,20,0.04), 0 6px 20px rgba(26,24,20,0.06), 0 18px 48px rgba(26,24,20,0.04)',
  },
} as const;

export type WarmTokens = typeof warm;

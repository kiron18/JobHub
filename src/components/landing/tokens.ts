/* ── Landing page design tokens (B1 premium-warm) ────────────────
   Scoped to landing. Do not import into in-app surfaces.        */

export const colors = {
  bgCanvas: '#FAF7F2' as const,
  bgSurface: '#FFFFFF' as const,
  bgAlt: '#F4EFE8' as const,
  bgDeep: '#2A2520' as const,

  textPrimary: '#1A1814' as const,
  textSecondary: '#5C5750' as const,
  textMuted: '#8B847B' as const,
  textOnDeep: '#FAF7F2' as const,

  borderWhisper: 'rgba(26, 24, 20, 0.08)' as const,
  borderDefined: 'rgba(26, 24, 20, 0.16)' as const,

  accentPetrol: '#2D5A6E' as const,
  accentPetrolHover: '#1F4253' as const,
  accentPetrolPressed: '#15323F' as const,
  accentGold: '#C5A059' as const,
  accentGoldSoft: '#E8D7B0' as const,

  success: '#2A9D6F' as const,
  ringFocus: 'rgba(45, 90, 110, 0.40)' as const,
} as const;

export const type = {
  display: "'Fraunces', Georgia, 'Times New Roman', serif",
  body: "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",
} as const;

export const spacing = {
  sectionDesktop: '120px',
  sectionMobile: '72px',
  cardPaddingDesktop: '32px',
  cardPaddingMobile: '24px',
  inlineGroup: '20px',
  inlineGroupMobile: '14px',
  containerMax: '1100px',
  containerReadable: '720px',
  containerHero: '640px',
} as const;

export const motion = {
  easingDefault: 'cubic-bezier(0.25, 1, 0.5, 1)',
  hoverDuration: '180ms',
  revealDuration: 0.5,
  revealThreshold: 0.2,
} as const;

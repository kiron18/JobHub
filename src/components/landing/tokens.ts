/* ── Landing page design tokens (B1 premium-warm) ────────────────
   Scoped to landing. Do not import into in-app surfaces.        */

export const colors = {
  /* Repointed at the app palette (warmTokens) on 30 Oct 2026, so the front
     door, the diagnosis, the questions, the claim step and pricing read as the
     same product as the app behind them. The names stay so nothing else has to
     change; the old cream, brown and petrol values are gone. Gold is the next
     step only (warmTokens ACTION), so the gold here is the dark warning gold. */
  bgCanvas: '#EDF1F6' as const,
  bgSurface: '#FFFFFF' as const,
  bgAlt: '#F5F7FA' as const,
  bgDeep: '#0F2038' as const,

  textPrimary: '#111827' as const,
  /* Long-form reading ink. A shade off textPrimary, because a paragraph of
     serif set at near-black hits the eye harder than a heading does. */
  textInk: '#1F2937' as const,
  textSecondary: '#48566B' as const,
  textMuted: '#6D7A8C' as const,
  textOnDeep: '#FFFFFF' as const,

  borderWhisper: '#E6EAF0' as const,
  borderDefined: '#CFD6E0' as const,

  /* The app's blue: links, selection, outline buttons. Never a fill for the
     next step; that is gold. */
  accentPetrol: '#1257C4' as const,
  accentPetrolHover: '#0E47A1' as const,
  accentPetrolPressed: '#0B3A85' as const,
  accentGold: '#A9760D' as const,
  accentGoldSoft: '#FBF1DC' as const,

  /* Highlighter pen, for the one line in a block that carries the cost. */
  highlight: '#FDF0C4' as const,

  success: '#12805C' as const,
  ringFocus: 'rgba(18, 87, 196, 0.32)' as const,
} as const;

export const type = {
  display: "'Fraunces', Georgia, 'Times New Roman', serif",
  body: "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",
  /*
    The reading face, and it is not the display face.

    Fraunces is a high-contrast display serif with a WONK axis — it is drawn to
    be set large, short and once. Put a hundred-word diagnosis in it and the
    thin joins, the tight default fitting and the wedge serifs all work against
    the reader: it looks busy rather than crisp, which is exactly the complaint.

    Source Serif 4 is a text serif in the Tiempos/Charter family — even colour,
    open counters, a fitting drawn for paragraphs. It is already on the page
    (index.html loads it), so this costs no extra request.

    Fraunces keeps every heading, chip and pull quote. This is only for prose
    that is genuinely read through.
  */
  reading: "'Source Serif 4', 'Iowan Old Style', Charter, Georgia, serif",
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

/* ── Landing page design tokens (B1 premium-warm) ────────────────
   Scoped to landing. Do not import into in-app surfaces.        */

export const colors = {
  bgCanvas: '#FAF7F2' as const,
  bgSurface: '#FFFFFF' as const,
  bgAlt: '#F4EFE8' as const,
  bgDeep: '#2A2520' as const,

  textPrimary: '#1A1814' as const,
  /* Long-form reading ink. A shade off textPrimary, because a paragraph of
     serif set at near-black hits the eye harder than a heading does — the
     stems are thinner and there are far more of them. Headings stay on
     textPrimary; only prose someone actually reads through uses this. */
  textInk: '#26221C' as const,
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

  /* Highlighter pen, for the one line in a block that carries the cost. */
  highlight: '#F7EBBF' as const,

  success: '#2A9D6F' as const,
  ringFocus: 'rgba(45, 90, 110, 0.40)' as const,
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

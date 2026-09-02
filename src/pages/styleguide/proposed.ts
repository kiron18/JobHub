/* ── Proposed design tokens ────────────────────────────────────────────
   NOTHING IN THE APP IMPORTS THIS FILE YET. It exists so the style guide
   at /styleguide can show a proposed system beside the one in use, and so
   that approving items in that guide has somewhere concrete to land.

   The palette direction is unchanged: white, blue, gold. What changes is
   form. The inventory of the 163 client-facing files found 53 distinct
   font sizes, 36 border radii, 19 font weights and 301 distinct button
   shapes. The scales below are the collapse of those.

   Once you have signed off the guide, this file gets promoted into
   src/lib/theme/ and the sweep begins.
*/

export const proposed = {
  colors: {
    /* Surfaces. Separation comes from hairlines and space, not tint. */
    canvas:   '#FFFFFF',
    surface:  '#FFFFFF',
    /** The one tint. Table headers, quiet rows, hover fills. */
    subtle:   '#F6F8FB',
    /** Deep navy. For the one block per page that must stop the eye. */
    deep:     '#0F2038',

    /* Ink. Three steps, not the current fourteen. */
    ink:      '#111827',
    body:     '#48566B',
    muted:    '#6D7A8C',
    onDeep:   '#FFFFFF',

    /* Lines. Hairline for dividers inside a surface, line for edges. */
    hairline: '#E6EAF0',
    line:     '#CFD6E0',

    /* The accent. One blue, three states. */
    accent:        '#1257C4',
    accentHover:   '#0E47A1',
    accentPressed: '#0B3A85',
    accentSoft:    '#EEF3FD',
    ring:          'rgba(18, 87, 196, 0.32)',

    /* Gold is for things that cost you the interview. Nothing else. */
    gold:     '#A9760D',
    goldSoft: '#FBF1DC',

    success:     '#12805C',
    successSoft: '#E8F5F0',
    danger:      '#B3261E',
    dangerSoft:  '#FDECEA',
  },

  /* ── Type: seven steps, replacing 53 ──────────────────────────────
     Base body moves 13 -> 15. Everything else is anchored to that. */
  text: {
    display: { fontSize: 34, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.021em' },
    h1:      { fontSize: 26, lineHeight: 1.22, fontWeight: 700, letterSpacing: '-0.018em' },
    h2:      { fontSize: 20, lineHeight: 1.30, fontWeight: 700, letterSpacing: '-0.012em' },
    h3:      { fontSize: 16, lineHeight: 1.40, fontWeight: 600, letterSpacing: '-0.006em' },
    body:    { fontSize: 15, lineHeight: 1.55, fontWeight: 400, letterSpacing: '0' },
    small:   { fontSize: 13, lineHeight: 1.50, fontWeight: 400, letterSpacing: '0' },
    micro:   { fontSize: 11, lineHeight: 1.40, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' as const },
  },

  /** One family, as today. */
  font: "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",

  /* ── Space: a 4pt grid, seven steps ───────────────────────────── */
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },

  /* ── Radius: four, replacing 36 ───────────────────────────────── */
  radius: { sm: 6, md: 10, lg: 14, pill: 999 },

  /* ── Weight: four, replacing 19. No 450, no 650, no 900. ──────── */
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },

  /* ── Elevation: two, replacing 15. Plus flat. ─────────────────── */
  shadow: {
    none:   'none',
    soft:   '0 1px 2px rgba(16,24,40,0.05)',
    lifted: '0 1px 3px rgba(16,24,40,0.06), 0 8px 24px rgba(16,24,40,0.07)',
  },

  /* ── Motion: three durations, one curve ───────────────────────── */
  motion: {
    fast: '120ms',
    base: '180ms',
    slow: '280ms',
    ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
} as const;

export type Proposed = typeof proposed;

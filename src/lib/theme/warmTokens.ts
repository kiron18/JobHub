/* ── Site-wide palette ──────────────────────────────────────────────
   White, blue, gold. Nothing else.

   This file used to hold a warm cream-and-brown palette, which is why the
   export is still called `warm` and the token names still say things like
   bgCanvas and accentPetrol: those names are imported in dozens of files and
   renaming them would be a large diff for no visual gain. The VALUES are the
   palette. Change them here and every screen follows.

   How to use the three colours:
     white  - the page, and every surface on it. Separation comes from hairline
              borders and space, not from tinted panels.
     blue   - one accent. Anything interactive, and anything the reader must
              act on. If two things on screen are blue, they are the same kind
              of thing.
     gold   - used sparingly, for warnings and the things that cost you the
              call if you get them wrong. Gold everywhere is gold nowhere.

   Some older components still hardcode the retired browns (#1A1814, #F4EFE8,
   rgba(26,24,20,...)). Those do not pick this up and need sweeping separately.
*/

export const warm = {
  colors: {
    bgCanvas:    '#FFFFFF',
    bgSurface:   '#FFFFFF',
    /** The only tint on the page. A cool grey, for table headers and quiet rows. */
    bgAlt:       '#F5F7FA',
    /** Deep navy, for the one or two blocks that need to stop the eye. */
    bgDeep:      '#0F2038',
    textPrimary: '#111827',
    textSecondary: '#48566B',
    textMuted:   '#6D7A8C',
    textOnDeep:  '#FFFFFF',
    borderWhisper:  '#E6EAF0',
    borderDefined:  '#CFD6E0',
    /** The accent. Passes AA on white at normal text size. */
    accentPetrol:        '#1257C4',
    accentPetrolHover:   '#0E47A1',
    accentPetrolPressed: '#0B3A85',
    /** The accent as a fill. Selected rows, active nav, soft badges. */
    accentPetrolSoft:    '#EEF3FD',
    /** Warnings and cannot-fumble items only. */
    accentGold:          '#A9760D',
    accentGoldSoft:      '#FBF1DC',
    /** Gold as a live signal: where you are right now in a sequence. */
    accentGoldBright:    '#C9901A',
    success:    '#12805C',
    successSoft:'#E8F5F0',
    ringFocus:  'rgba(18, 87, 196, 0.32)',
    // Semantic
    danger:     '#B3261E',
    dangerSoft: '#FDECEA',
  },

  /* ── The type scale ──────────────────────────────────────────────────
     Seven steps. Before this existed the app used 53 distinct font sizes,
     mixing px numbers and rem strings, and the most common size in the
     product was 13px, which made everything read as small print.

     Spread one of these into a style object:
       style={{ ...warm.text.body, color: warm.colors.textSecondary }}
  */
  text: {
    display: { fontSize: 34, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.021em' },
    h1:      { fontSize: 26, lineHeight: 1.22, fontWeight: 700, letterSpacing: '-0.018em' },
    h2:      { fontSize: 20, lineHeight: 1.30, fontWeight: 700, letterSpacing: '-0.012em' },
    h3:      { fontSize: 16, lineHeight: 1.40, fontWeight: 600, letterSpacing: '-0.006em' },
    body:    { fontSize: 15, lineHeight: 1.55, fontWeight: 400 },
    small:   { fontSize: 13, lineHeight: 1.50, fontWeight: 400 },
    micro:   { fontSize: 11, lineHeight: 1.40, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' as const },
  },

  /** Four weights. No 450, no 650, no 900. */
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  type: {
    /** One family. A second one was doing nothing but adding weight. */
    fontDisplay: "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",
    fontBody:    "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",
  },
  spacing: {
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
    sectionPadDesktop: 56,
    sectionPadMobile:  40,
  },
  radius: {
    input: 10, button: 10, card: 14, pill: 9999,
  },
  shadow: {
    soft:    '0 1px 2px rgba(16,24,40,0.04)',
    lifted:  '0 1px 3px rgba(16,24,40,0.06), 0 8px 24px rgba(16,24,40,0.06)',
  },
} as const;

export type WarmTokens = typeof warm;

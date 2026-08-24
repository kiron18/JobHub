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
    textSecondary: '#4B5563',
    textMuted:   '#6B7280',
    textOnDeep:  '#FFFFFF',
    borderWhisper:  '#E5E9F0',
    borderDefined:  '#CBD3DF',
    /** The accent. Passes AA on white at normal text size. */
    accentPetrol:        '#1257C4',
    accentPetrolHover:   '#0E47A1',
    accentPetrolPressed: '#0B3A85',
    /** Warnings and cannot-fumble items only. */
    accentGold:          '#A9760D',
    accentGoldSoft:      '#FBF1DC',
    success:    '#12805C',
    ringFocus:  'rgba(18, 87, 196, 0.35)',
    // Semantic
    danger:     '#B3261E',
    dangerSoft: '#FDECEA',
  },
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

/* ── Site-wide palette ──────────────────────────────────────────────
   White, blue, gold. Nothing else.

   This file used to hold a warm cream-and-brown palette, which is why the
   export is still called `warm` and the token names still say things like
   bgCanvas and accentPetrol: those names are imported in dozens of files and
   renaming them would be a large diff for no visual gain. The VALUES are the
   palette. Change them here and every screen follows.

   How to use the three colours (Kiron, 30 Oct 2026: "the most prominent
   elements should pop out ... we control where people take their next step"):
     gold   - THE NEXT STEP, and nothing else. A bright gold fill with dark ink
              is the one button on a screen that moves them forward: check this
              job, write my resume, next, I've sent it. One per screen. If a
              screen has two gold buttons, one of them is wrong. Spread
              `warm.action` onto it rather than picking the colours by hand.
     blue   - everything else that is interactive: links, navigation, selected
              rows, secondary buttons (as an outline, never a fill).
     white  - cards. They sit on the pale `bgPage` canvas with a real shadow,
              so the card is what the eye lands on, not the page around it.
   Warnings keep the dark gold as TEXT on a soft tint, never as a fill, so a
   warning can never be mistaken for the button.

   Some older components still hardcode the retired browns (#1A1814, #F4EFE8,
   rgba(26,24,20,...)). Those do not pick this up and need sweeping separately.
*/

export const warm = {
  colors: {
    bgCanvas:    '#FFFFFF',
    /** The app's page canvas, under the cards. A step darker than white so a
     *  white card reads as an object on it rather than a line drawn on paper. */
    bgPage:      '#EDF1F6',
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
    /** The next step. A fill, with `actionInk` on it (white on this gold fails
     *  contrast; the near-black passes AAA). Use `warm.action`, not these. */
    action:         '#F5B731',
    actionHover:    '#EDA912',
    actionPressed:  '#D9970A',
    actionInk:      '#1C1504',
    actionSoft:     '#FFF5DA',
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
  /* ── Pop-up text ─────────────────────────────────────────────────────
     A step up from the page scale (Kiron, 2026-09-29: "make the text just
     a bit larger, it's really small"). A modal is read in one sitting at
     arm's length, often on a phone, so it gets its own, larger steps.
  */
  popup: {
    title: { fontSize: 20, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-0.01em' },
    body:  { fontSize: 16, lineHeight: 1.6, fontWeight: 400 },
    small: { fontSize: 14.5, lineHeight: 1.5, fontWeight: 400 },
  },

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
    /** The one exception, and it earns it: scores. Rounded and friendly,
     *  the way a game writes a number you are meant to want to grow. Used
     *  for the streak count and nothing else — the moment it turns up in
     *  body copy the app stops looking like a tool. Same family the growth
     *  tree was designed in. */
    fontGame:    "'Fredoka', 'Geist', -apple-system, system-ui, sans-serif",
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
    /** A card on the bgPage canvas: a crisp contact shadow and a soft drop. */
    card:    '0 1px 2px rgba(16,24,40,0.07), 0 12px 32px -14px rgba(16,24,40,0.22)',
    /** The one card on a screen the eye must land on first. */
    focus:   '0 2px 4px rgba(16,24,40,0.08), 0 24px 56px -18px rgba(16,24,40,0.38)',
    /** Under the gold button: a warm glow so it lifts off anything. */
    action:  '0 1px 0 rgba(255,255,255,0.45) inset, 0 10px 22px -8px rgba(217,151,10,0.65), 0 2px 4px rgba(16,24,40,0.12)',
  },

  /* ── Measure ─────────────────────────────────────────────────────────
     How wide a line of text is allowed to end up, which on a phone is a
     LAYOUT number and not a typography one.

     The product reads badly at 390px because of nesting, not font size.
     A page gutter of 24 either side, a card at 24, and a panel inside the
     card at 16 spends 128px of the 390 on whitespace before a single word
     is set. What is left runs 28 characters, which is three or four words
     a line, and that is what makes a perfectly ordinary paragraph look
     like a column in a newspaper.

     So the rule is about DEPTH:

       - At most two padded containers deep on a phone. A card inside a
         panel inside a page picks one of the three to hold the padding,
         and the other two go to zero.
       - The innermost container that holds running text takes `nested`,
         which is zero horizontally: it inherits its parent's inset.
       - Anything under `minChars` per line is a layout bug to fix by
         removing an inset, not a copy problem to fix by cutting words.

     scripts/mobile-sweep.mjs measures the result per paragraph, so this
     is checkable rather than a matter of taste.
  */
  measure: {
    /** Side inset of the page itself, on a phone. */
    gutterMobile: 16,
    /** Side inset of a card sitting directly on the page, on a phone. */
    cardMobile: 14,
    /** A card inside a card. Vertical padding only — it inherits the sides. */
    nestedMobile: 0,
    /** Fewer characters a line than this and the layout is too deep. */
    minChars: 38,
  },
} as const;

/**
 * The next-step button, as a style to spread. Hover, press and focus come from
 * the `agc-action` class in index.css, so put that on the element too:
 *
 *   <button className="agc-action" style={{ ...ACTION, padding: '12px 20px' }}>
 *
 * Spread it, set `border: 'none'` and a bold weight beside it, and never set
 * `color` or `background` after it: white text on this gold is unreadable.
 */
export const ACTION = {
  background: warm.colors.action,
  color: warm.colors.actionInk,
  boxShadow: warm.shadow.action,
} as const;

/** A secondary button: blue outline, no fill. Never competes with ACTION. */
export const SECONDARY = {
  background: '#FFFFFF',
  color: warm.colors.accentPetrol,
  border: `1.5px solid ${warm.colors.borderDefined}`,
  fontWeight: 600,
} as const;

export type WarmTokens = typeof warm;

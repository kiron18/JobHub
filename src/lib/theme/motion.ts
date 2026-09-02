import type { Transition, Variants } from 'framer-motion';

/* ── The motion system ─────────────────────────────────────────────────
   One vocabulary for every moving thing in JobHub.

   The rules it encodes:

   1. Motion carries meaning or it does not happen. Every animation here
      answers one of three questions: where did this come from, what did
      I just do, or how did that go.

   2. Things enter decisively and settle slowly. That is the single
      characteristic that separates expensive-feeling software from the
      rest, and it is why `EASE.out` is used for almost every entrance:
      it moves most of the distance in the first third of its duration
      and then eases into place instead of arriving flat.

   3. Things leave quickly. An exit that takes as long as an entrance
      makes the whole product feel slow, because the user has already
      decided and is waiting on you.

   4. Good news overshoots. Bad news does not. A success springs past its
      resting point and settles back, which reads as physical and warm.
      An error is damped and lateral, which reads as a wall.

   5. Nothing bounces more than once. Two bounces is a toy.
*/

/* ── Easing ──────────────────────────────────────────────────────────── */

export const EASE = {
  /** Entrances, reveals, anything arriving. Fast out of the gate, long settle. */
  out: [0.16, 1, 0.3, 1],
  /** Moves that start and end on screen: a panel sliding, a value counting. */
  inOut: [0.65, 0, 0.35, 1],
  /** Exits. Committed and quick, because the user has already moved on. */
  in: [0.55, 0, 1, 0.45],
  /** A gentler out, for large surfaces where the sharp one reads as a snap. */
  soft: [0.33, 1, 0.68, 1],
} as const;

/** The same curves as CSS strings, for components that are not Framer driven. */
export const CSS_EASE = {
  out: 'cubic-bezier(0.16, 1, 0.30, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  in: 'cubic-bezier(0.55, 0, 1, 0.45)',
  soft: 'cubic-bezier(0.33, 1, 0.68, 1)',
} as const;

/* ── Duration ────────────────────────────────────────────────────────── */

export const DUR = {
  /** A state flip that must not be perceived as motion: hover, focus ring. */
  instant: 0.12,
  /** Colour and border changes on a control. */
  fast: 0.18,
  /** The default. Panels, tabs, list items, toasts. */
  base: 0.28,
  /** Modals, route changes, anything covering the page. */
  slow: 0.44,
  /** A moment that is meant to be watched. Use sparingly. */
  story: 0.72,
} as const;

/* ── Springs ─────────────────────────────────────────────────────────── */

export const SPRING = {
  /** Press feedback. Stiff and heavily damped so it feels like a click, not a wobble. */
  tap: { type: 'spring', stiffness: 520, damping: 32, mass: 0.55 } as Transition,
  /** Something settling into place with no overshoot worth noticing. */
  settle: { type: 'spring', stiffness: 280, damping: 28 } as Transition,
  /** Something arriving that should feel physical. One small overshoot. */
  arrive: { type: 'spring', stiffness: 340, damping: 24 } as Transition,
  /** Good news. A visible overshoot, then a settle. Reserved for real wins. */
  celebrate: { type: 'spring', stiffness: 320, damping: 16, mass: 0.9 } as Transition,
} as const;

/* ── CSS transition helper ───────────────────────────────────────────── */

/**
 * Builds a transition string that names its properties. `transition: all` is
 * banned across the codebase: it animates layout properties by accident and is
 * the usual cause of a hover that stutters.
 *
 *   transition: t('background', 'color')          -> 180ms, fast curve
 *   transition: t(['transform'], DUR.base)        -> 280ms
 */
export function t(props: string | string[], duration: number = DUR.fast, ease: keyof typeof CSS_EASE = 'out'): string {
  const list = Array.isArray(props) ? props : [props];
  return list.map(p => `${p} ${Math.round(duration * 1000)}ms ${CSS_EASE[ease]}`).join(', ');
}

/* ── Variants ────────────────────────────────────────────────────────── */

/** Content arriving from below. The default entrance for anything in a column. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE.out } },
  exit: { opacity: 0, y: -6, transition: { duration: DUR.fast, ease: EASE.in } },
};

/** A quieter entrance, for things that should not appear to move. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.base, ease: EASE.out } },
  exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE.in } },
};

/** Something appearing in place: a badge, a checkmark, a count. */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: SPRING.arrive },
  exit: { opacity: 0, scale: 0.96, transition: { duration: DUR.fast, ease: EASE.in } },
};

/** Overlay surfaces: modals, popovers, sheets. */
export const overlay: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.slow, ease: EASE.out } },
  exit: { opacity: 0, y: 8, scale: 0.99, transition: { duration: DUR.fast, ease: EASE.in } },
};

/**
 * Wrap a list so its children arrive one after another. 40ms is the sweet spot:
 * enough to read as a sequence, not enough to feel like waiting.
 */
export function stagger(gap = 0.04, delay = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } },
  };
}

/** Bad news. Lateral, damped, over before you can be annoyed by it. */
export const shake: Variants = {
  still: { x: 0 },
  shake: {
    x: [0, -7, 6, -4, 2, 0],
    transition: { duration: 0.42, ease: EASE.inOut },
  },
};

/* ── Press and hover ─────────────────────────────────────────────────── */

/** The standard tactile response. Every pressable surface gets this. */
export const press = {
  whileTap: { scale: 0.97 },
  transition: SPRING.tap,
} as const;

/** For large targets, where 0.97 is too much travel. */
export const pressSubtle = {
  whileTap: { scale: 0.99 },
  transition: SPRING.tap,
} as const;

/* ── Reduced motion ──────────────────────────────────────────────────── */

/**
 * True when the viewer has asked their system for less motion. Every
 * celebration and every non-essential transition checks this: the feedback
 * still happens, it just stops moving. Colour and copy carry it instead.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Is this a phone-sized viewport?
 *
 * Most of this app styles with inline style objects rather than classes, and a
 * CSS media query cannot reach an inline style. So the breakpoint has to be
 * readable from JS, and it has to be readable from ONE place or the app ends up
 * with four different opinions about where a phone stops.
 *
 * 768px is the same number DashboardLayout was already using to swap the
 * sidebar for a drawer, so the shell and the pages inside it now agree.
 *
 * `useIsNarrow` is the same hook at 1024px, for the two-column screens that are
 * fine on a tablet and cramped on anything smaller.
 */
import { useEffect, useState } from 'react';

export const MOBILE_BREAKPOINT_PX = 768;
export const NARROW_BREAKPOINT_PX = 1024;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    // Re-read on mount: the first paint may have happened before hydration and
    // the viewport can change between the two (rotation, or a resized window).
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** True on phones. The breakpoint the whole app agrees on. */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
}

/** True on phones AND small tablets. For layouts that need more than 1024px. */
export function useIsNarrow(): boolean {
  return useMediaQuery(`(max-width: ${NARROW_BREAKPOINT_PX}px)`);
}

/**
 * True when the primary input is touch, regardless of width.
 *
 * Width is the right question for layout and the wrong question for
 * interaction: a hover-to-reveal control is dead on an iPad in landscape at
 * 1180px wide. Anything gated on hover should ask this, not useIsMobile.
 */
export function useIsTouchDevice(): boolean {
  return useMediaQuery('(hover: none), (pointer: coarse)');
}

/* ── Feedback bus ──────────────────────────────────────────────────────
   One place to fire the big moments from, so a component deep inside the
   apply flow can trigger a full-screen celebration without threading a
   prop or a context through six lazy routes.

   Mount <CelebrationHost /> once, near the Toaster, and call celebrate()
   from anywhere.
*/

export interface CelebrationPayload {
  /** The headline. Short. This is read in about a second. */
  title: string;
  /** One line of what actually happened, in the user's terms. */
  subtitle?: string;
  /**
   * The chip that flies out of the celebration toward wherever the thing
   * landed. Give it the label to show, and the target's
   * data-celebration-target value.
   */
  land?: { label: string; target: string };
}

type Listener = (p: CelebrationPayload) => void;
const listeners = new Set<Listener>();

/** Fire a celebration. No-op if no host is mounted. */
export function celebrate(payload: CelebrationPayload): void {
  listeners.forEach(l => l(payload));
}

export function onCelebrate(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/* ── Haptics ───────────────────────────────────────────────────────────
   Android and some desktop Chrome builds support the Vibration API; iOS
   Safari does not, and there is no way to fake it. So this is strictly a
   bonus layer: everything it says is also said in colour and motion, and
   nothing depends on it firing.

   The patterns are shaped like their meaning. Success is one soft pulse
   with a longer tail. Error is two short taps, which reads as "no".
*/

export type Impact = 'tap' | 'success' | 'error' | 'warning';

const PATTERNS: Record<Impact, number | number[]> = {
  tap: 8,
  success: [14, 40, 26],
  error: [18, 60, 18],
  warning: [12, 50, 12],
};

export function haptic(kind: Impact = 'tap'): void {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // A browser that refuses to vibrate is not an error worth surfacing.
  }
}

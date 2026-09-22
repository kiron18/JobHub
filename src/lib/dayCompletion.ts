/* ── Day completion tiers ─────────────────────────────────────────────
   Fabulous-style: a day isn't pass/fail. Four levels instead of a binary
   goal-hit flag, so a day with SOME work still reads as progress instead
   of as a miss. Display logic only — the real streak-counting rule (which
   tiers actually keep a streak alive) is Kiron's call, not decided here.
*/

export type DayCompletionTier = 'none' | 'started' | 'goal' | 'exceeded';

export function dayCompletionTier(done: number, goal: number): DayCompletionTier {
  if (done <= 0) return 'none';
  if (goal <= 0) return done > 0 ? 'goal' : 'none';
  if (done < goal) return 'started';
  if (done === goal) return 'goal';
  return 'exceeded';
}

export const TIER_LABEL: Record<DayCompletionTier, string> = {
  none: 'Nothing logged',
  started: 'Started',
  goal: 'Goal met',
  exceeded: 'Exceeded',
};

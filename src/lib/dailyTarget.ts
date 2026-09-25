/* ── Today's target ───────────────────────────────────────────────────
   The rules for how many applications today is for, in one place so the
   ritual line, the squares and the popup can never disagree about it.

   Floor is the program's own floor — 5/day, from
   server/src/services/tracker/goals.ts. Ceiling is 10, and the reason is
   in PostApplicationPopup: past ten in a sitting the tailoring thins out,
   and the tiredness is what turns tomorrow into a day off.

   These are currently client-side only. When this is wired to the server
   it becomes a DailyTarget row per user per AEST day, and the committed
   value plus these rules move behind /tracker/daily-target. The program
   goal in goals.ts stays exactly as it is — its 14-day cooldown and
   next-Monday effectiveness exist to stop people lowering a goal to dodge
   a miss, and nothing here may weaken that. Today's target can only ever
   sit at or above the program goal, so it cannot be used to dodge.
*/

export const TARGET_MIN = 5;
export const TARGET_MAX = 10;

/**
 * Today's target after auto-raising.
 *
 * The committed number is a floor, not a cap: do more than you planned
 * and the target rises to meet what you have actually done, up to the
 * ceiling. There is no version of this product that tells someone who has
 * done more than they promised that they have overshot.
 *
 * @param committed what they set this morning
 * @param filed     applications actually sent today
 */
export function effectiveTarget(committed: number, filed: number): number {
  return Math.min(TARGET_MAX, Math.max(committed, filed));
}

/** How many applications are past the ceiling — 0 for everyone sane. */
export function pastCeiling(filed: number): number {
  return Math.max(0, filed - TARGET_MAX);
}

/* ── The one-time commit explainer ────────────────────────────────────
   Shown on the very first Set, ever, and never again: a dialog that
   appears every morning stops being a commitment and becomes a doorway
   you shove through without reading.

   Browser-local for now. Server-backed this belongs on the profile, so
   it survives a new device — seeing the explainer again two months in
   would be a small insult.
*/
const COMMIT_SEEN_KEY = 'jobhub_target_commit_explained_v1';

export function hasSeenCommitExplainer(): boolean {
  try { return localStorage.getItem(COMMIT_SEEN_KEY) === 'true'; } catch { return false; }
}

export function markCommitExplainerSeen(): void {
  try { localStorage.setItem(COMMIT_SEEN_KEY, 'true'); } catch { /* private mode, no harm */ }
}

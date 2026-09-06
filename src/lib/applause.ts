/* ── Applause ──────────────────────────────────────────────────────────
   The line that fires when an application is filed.

   Five a day is the program floor (server/src/services/tracker/goals.ts),
   so the tone has three jobs and they are not the same job:

     1 to 4   push. Say almost nothing and point at the next one.
     5        mark it. The standard was met, and that deserves naming.
     6 to 9   bonus. They are past their own minimum, on their own steam.
     10 to 12 stop. Ten is a real day's work and the twelfth application
              of an afternoon is worse than the second, so the product
              should say so rather than keep cheering.
     13+      stop, plainly. Past here we are watching someone grind, and
              a tool that applauds that is doing harm.

   Written rather than generated. A Haiku call per toast is about $0.0006,
   which is nothing, but it puts a network round trip and a failure mode in
   front of a 2.4 second animation, and a toast that arrives late or not at
   all is worse than one that occasionally repeats. Sixty lines with a
   no-repeat window gets the variety without any of that. If these ever do
   feel stale, the fix is more lines here, not a model call.

   No line shames a low number and no line invents a fact about the user.
*/

export type ApplauseTier = 'push' | 'standard' | 'bonus' | 'enough' | 'stop';

const LINES: Record<ApplauseTier, string[]> = {
  push: [
    "That's one in. Keep rolling.",
    'Filed. The next one is faster.',
    'In the pile. Go again.',
    'Momentum starts exactly like this.',
    "Done. Line up the next one.",
    'Another one gone. Keep moving.',
    "Good. Don't stop to admire it.",
    "That's the hard part done.",
    'Stacking up nicely. Keep going.',
    'One more in the ledger.',
    'Solid. Straight into the next.',
    'Sent. Who is next?',
  ],
  standard: [
    "Five done. That's the day's minimum, met.",
    'You hit five. The standard is honoured.',
    'Five in. Everything from here is upside.',
    "Minimum cleared. That's the promise kept.",
    'Target hit. Anything more is bonus.',
    "Five filed. That's a real day on the board.",
  ],
  bonus: [
    'Past the line. This is where it compounds.',
    'Above your own minimum now. Good.',
    'Extra reps. These are the ones that count.',
    "Still going. That's the whole difference.",
    'Bonus territory. Nicely done.',
    "You're ahead of your own standard.",
    'This is what a strong day looks like.',
    'Over the line and still moving.',
  ],
  enough: [
    "That's a full day's work. You can stop.",
    'Ten in. Rest is earned, not skived.',
    'Plenty. Quality beats volume from here.',
    'Big day. Nothing left to prove today.',
    'Close the laptop guilt free.',
    "Ten done. That's the day, properly.",
  ],
  stop: [
    'Genuinely, stop. Tomorrow needs you sharp.',
    "More than enough. Go do something else.",
    'Past the point of useful. Rest.',
    'Enough for today. Come back fresh.',
    'Stop here. The next one will be worse.',
  ],
};

export function tierFor(count: number): ApplauseTier {
  if (count >= 13) return 'stop';
  if (count >= 10) return 'enough';
  if (count >= 6) return 'bonus';
  if (count === 5) return 'standard';
  return 'push';
}

/**
 * Recently used lines, per tier, so the same words don't land twice in an
 * afternoon. Holds half the tier, which keeps it varied without ever
 * exhausting the pool. Browser storage is a nicety here: if it throws, the
 * pick is simply random and nothing else changes.
 */
const SEEN_KEY = 'jobhub_applause_seen_v1';

function readSeen(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function writeSeen(next: Record<string, string[]>): void {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* noop */ }
}

function pick(tier: ApplauseTier): string {
  const pool = LINES[tier];
  const seen = readSeen();
  const recent = Array.isArray(seen[tier]) ? seen[tier] : [];
  const fresh = pool.filter(l => !recent.includes(l));
  const from = fresh.length > 0 ? fresh : pool;
  const chosen = from[Math.floor(Math.random() * from.length)];

  const keep = Math.max(1, Math.floor(pool.length / 2));
  writeSeen({ ...seen, [tier]: [chosen, ...recent].slice(0, keep) });
  return chosen;
}

export interface Applause {
  tier: ApplauseTier;
  /** The varying line. Read in about a second. */
  title: string;
  /** Where they now stand. Always the true count, never a guess. */
  subtitle: string;
}

/**
 * @param count applications filed today, this one included
 * @param goal  the program goal for the window, normally 5
 */
export function applauseFor(count: number, goal: number): Applause {
  const tier = tierFor(count);
  const left = Math.max(0, goal - count);
  const subtitle =
    tier === 'push'
      ? `${count} of ${goal} today. ${left} to go.`
      : `${count} today.`;
  return { tier, title: pick(tier), subtitle };
}

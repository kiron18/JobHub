/* ── Close-out lines ──────────────────────────────────────────────────
   The line for the one-per-day moment when the day's applications are
   already done (server/src/services/tracker/closeout.ts decides when —
   this only ever fires once the goal for the day is met).

   Same honesty rule as applause.ts: real numbers only, nothing invented,
   nothing to soften — there's no low count to be gentle about here.
   Written, not generated, for the same cost/latency reasons as applause.ts.
*/

const LINES = [
  "That's the day. Well spent.",
  'Done for today. Come back fresh tomorrow.',
  "Today's work is in. Close the laptop.",
  "That's a real day, filed and done.",
  'Solid day. Nothing left to prove.',
  "Today's target, met. Rest is earned.",
];

const SEEN_KEY = 'jobhub_closeout_seen_v1';

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeSeen(next: string[]): void {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* noop */ }
}

/** @param streak the daily streak including today, from GET /tracker/closeout */
export function closeoutLineFor(streak: number): string {
  const seen = readSeen();
  const fresh = LINES.filter(l => !seen.includes(l));
  const from = fresh.length > 0 ? fresh : LINES;
  const chosen = from[Math.floor(Math.random() * from.length)];
  writeSeen([chosen, ...seen].slice(0, Math.max(1, Math.floor(LINES.length / 2))));
  return streak > 0 ? `${chosen} Streak intact.` : chosen;
}

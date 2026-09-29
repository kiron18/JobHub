/** Master switch. Nothing goes out on a schedule, and nothing inbound is
 *  answered or logged, unless this is exactly 'true'. Its own module so the
 *  WhatsApp socket can read it without importing run.ts, which imports it. */
export function coachCheckinsEnabled(): boolean {
  return process.env.COACH_CHECKINS_ENABLED === 'true';
}

/**
 * How long a paid pass runs, in one place.
 *
 * This number was written out three times: the Stripe webhook, the manual
 * onboarding service and the grant_access script. Three copies of a business
 * decision is three chances to sell one thing and deliver another, which is
 * exactly what happened when the offer moved from 90 days to 30 and the webhook
 * kept opening a 90-day window.
 *
 * The plan key in the database is still `three_month`. It is not renamed because
 * live rows carry that string and every access check reads it; the key is now
 * historical, and this file is what says how long the pass actually lasts.
 *
 * Coaching clients are the reason this is a default and not a constant. The
 * 90-day program is a different sale at a different price, onboarded by hand,
 * and it must keep its own window: pass `days` explicitly for those rather than
 * changing the number here.
 */

/** The self-serve pass: $197 once, 30 days. */
export const PAID_ACCESS_DAYS = 30;

/** The coaching program's window, for hand-onboarded clients. */
export const PROGRAM_ACCESS_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** When a pass bought right now should expire. */
export function accessExpiryFromNow(days: number = PAID_ACCESS_DAYS): Date {
  return new Date(Date.now() + days * MS_PER_DAY);
}

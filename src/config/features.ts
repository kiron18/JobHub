/**
 * Switches for parts of the app that exist and work but are off for now.
 * Flip one here; nothing else needs to change.
 */

/**
 * The leaderboard. Off from 29 Oct 2026: with a handful of active members a
 * new one lands at the bottom of a four-row table, half of it benchmark rows,
 * which reads as an empty room rather than a race. The page and its route stay,
 * so turning this back on is the whole job.
 */
export const SHOW_LEADERBOARD = false;

/** The one-time "new and improved Resources section" toast. Off: it landed on brand-new accounts in their first minute. */
export const SHOW_RESOURCES_NUDGE = false;

/**
 * Whether the last apply step waits for "I've sent it" before a job counts as
 * Applied. On from 29 Oct 2026: reaching the step used to mark it Applied on
 * the spot, so the tracker, goals, streak, follow-up reminders and the
 * first-application email were counting downloaded drafts as sent applications.
 */
export const CONFIRM_BEFORE_APPLIED = true;

/**
 * Whether the job box takes a Seek link and reads the ad off Seek for them.
 * Off from 29 Oct 2026: fetching Seek pages from our server risks the server
 * being blocked. The code path stays; a pasted link now asks for the text.
 */
export const ACCEPT_SEEK_LINKS = false;

/**
 * Whether /pricing's button opens the Stripe payment link (true) or the in-app
 * checkout with its card trial (false). The link, from 29 Oct 2026, on Kiron's
 * call. Note the link has no free trial; the in-app trial still exists for the
 * day-3 card and the upgrade modal.
 */
export const PRICING_PAYMENT_LINK = true;

/**
 * "Continue with Google" on the claim step and /auth. Shown only when this is
 * on AND the Supabase project has the Google provider enabled (production does,
 * staging does not), so flipping either one off hides it.
 */
export const SHOW_GOOGLE_SIGN_IN = true;

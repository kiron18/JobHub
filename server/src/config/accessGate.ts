/**
 * Whether free accounts are being limited, and the one variable that decides.
 *
 * This lives in its own module with no imports on purpose. The obvious home for
 * it is accessControl.ts, but that file reaches into routes/stripe.ts for the
 * complimentary-address list, and stripe.ts builds a Stripe client and a Resend
 * client at module load. Importing the gate's state from anywhere lightweight —
 * the health endpoint, a script — would drag both of those in and need their
 * keys. A boolean should not cost two API clients.
 *
 * ── The switch ──────────────────────────────────────────────────────────────
 * The gate was turned off during the Sep 2026 pricing rework by hardcoding
 * `return { allowed: true }` into the middle of checkAccess and commenting the
 * real body out beneath it. That is the worst possible home for a business
 * decision: turning payments back on meant an edit, a review and a deploy, and
 * so did turning them off again in a hurry — at the exact moment you would
 * least want to be waiting on a build.
 *
 * It is an environment variable now, read per call so a change in Railway takes
 * effect on the very next request, with no deploy and no restart:
 *
 *   FREE_TIER_GATE=on    limits enforced — free accounts get FREE_LIMITS
 *   anything else        paused — every signed-in account is unlimited
 *
 * THE DEFAULT IS PAUSED, WHICH IS TODAY'S BEHAVIOUR, ON PURPOSE. Shipping this
 * changes nothing by itself, so the deploy and the change in what customers
 * experience are two separate events that can be undone independently. Turning
 * the gate on is one variable; turning it back off if something looks wrong is
 * the same variable, and neither needs a release.
 *
 * Once it has run enforced in production for a while, flip this default so an
 * unset variable means enforced rather than free-for-all. /api/health reports
 * which mode is live, so there is never a need to guess.
 */
export function isGateEnforced(): boolean {
  return (process.env.FREE_TIER_GATE ?? '').trim().toLowerCase() === 'on';
}

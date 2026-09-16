/**
 * Whether the 3-day trial challenge is live, and the one variable that decides.
 *
 * Same shape as accessGate.ts's FREE_TIER_GATE, and deliberately its own
 * module for the same reason: a boolean should not drag in Prisma/Stripe
 * clients. Orthogonal to FREE_TIER_GATE — that governs generation/analysis/
 * job-search/match-score counters; this governs only the post-resume "Apply"
 * fork, replacing ApplyPreviewGate.
 *
 *   TRIAL_CHALLENGE_ENABLED=on   the new 3-day flow runs
 *   anything else                today's ApplyPreviewGate behaviour, unchanged
 *
 * Default is OFF on purpose, so shipping this code changes nothing by itself.
 */
export function isTrialChallengeEnabled(): boolean {
  return (process.env.TRIAL_CHALLENGE_ENABLED ?? '').trim().toLowerCase() === 'on';
}

/**
 * QA-only speed-up: every day's window runs in SECONDS instead of minutes,
 * and the "must wait for the next AEST day" forfeiture gate is skipped
 * entirely, so a tester can play through all 3 days in a couple of minutes
 * instead of real days. Never set this in production — it is guarded by
 * NODE_ENV as well as the env var itself, same double-guard DEV_BYPASS_AUTH
 * uses, so a stray env var can never accidentally activate it on a real
 * client's traffic.
 *
 *   TRIAL_CHALLENGE_TEST_MODE=on   (staging/dev only)
 */
export function isTrialChallengeTestMode(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return (process.env.TRIAL_CHALLENGE_TEST_MODE ?? '').trim().toLowerCase() === 'on';
}

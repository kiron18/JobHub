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

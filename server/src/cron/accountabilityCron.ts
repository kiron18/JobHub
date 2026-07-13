import cron from 'node-cron';
import { runPaceNudges, runWeeklyWraps, runCoachDigest, accountabilityEmailsEnabled } from '../services/accountability/nudges';

let cronStarted = false;

/**
 * Accountability emails. Every job is fully guarded:
 * - master switch: nothing sends unless ACCOUNTABILITY_EMAILS=true
 * - NudgeLog unique constraint: restarts can never double-send
 * - all failures are caught and logged; a bad run never affects the app
 */
export function startAccountabilityCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // 07:00 UTC Mon–Fri = 17:00 AEST — behind-pace nudges
  cron.schedule('0 7 * * 1-5', async () => {
    try {
      if (!accountabilityEmailsEnabled()) {
        console.log('[accountability] pace nudges skipped — ACCOUNTABILITY_EMAILS not enabled');
        return;
      }
      const r = await runPaceNudges();
      console.log(`[accountability] pace nudges: sent ${r.sent.length}, skipped ${r.skipped.length}`);
    } catch (err) {
      console.error('[accountability] pace nudge cron error:', err);
    }
  });

  // 23:00 UTC Sunday = 09:00 AEST Monday — weekly wraps + coach digest
  cron.schedule('0 23 * * 0', async () => {
    try {
      if (!accountabilityEmailsEnabled()) {
        console.log('[accountability] weekly wrap skipped — ACCOUNTABILITY_EMAILS not enabled');
        return;
      }
      const wraps = await runWeeklyWraps();
      console.log(`[accountability] weekly wraps: sent ${wraps.sent.length}, skipped ${wraps.skipped.length}`);
      const digest = await runCoachDigest();
      console.log(`[accountability] coach digest: sent ${digest.sent.length}, skipped ${digest.skipped.length}`);
    } catch (err) {
      console.error('[accountability] weekly cron error:', err);
    }
  });
}

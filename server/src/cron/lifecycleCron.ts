import cron from 'node-cron';
import { lifecycleEmailsEnabled, runSignupEmails, runPreChargeEmails, runWeeklyCheckins, type RunResult } from '../services/lifecycle/send';

let cronStarted = false;

function log(r: RunResult): void {
  const sent = r.outcomes.filter((o) => o.result === 'sent').length;
  const failed = r.outcomes.filter((o) => o.result === 'failed').length;
  console.log(`[lifecycle] ${r.job}: sent ${sent}, failed ${failed}, skipped ${r.skipped + r.outcomes.length - sent - failed}`);
}

/**
 * Client lifecycle emails (services/lifecycle). Nothing sends unless
 * LIFECYCLE_EMAILS=on, read on every run so it can be flipped in Railway
 * without a deploy.
 */
export function startLifecycleCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // 23:00 UTC = 09:00 AEST / 10:00 AEDT. Emails 2, 3 and the pre-charge reminders 5, 8, 9.
  cron.schedule('0 23 * * *', async () => {
    if (!lifecycleEmailsEnabled()) return;
    try { log(await runSignupEmails()); } catch (err) { console.error('[lifecycle] signup run failed:', err); }
    try { log(await runPreChargeEmails()); } catch (err) { console.error('[lifecycle] pre-charge run failed:', err); }
  });

  // 00:00 UTC Monday = 10:00 AEST Monday, an hour after the accountability wrap. Email 7.
  cron.schedule('0 0 * * 1', async () => {
    if (!lifecycleEmailsEnabled()) return;
    try { log(await runWeeklyCheckins()); } catch (err) { console.error('[lifecycle] weekly run failed:', err); }
  });
}

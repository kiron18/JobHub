import cron from 'node-cron';
import { runSponsorScan } from '../services/sponsorScan';

let started = false;

/**
 * Weekly visa-sponsor jobs scan. GATED and intentionally NOT wired into the app
 * boot sequence (see spec guard D). To activate, an operator must BOTH:
 *   1. set env SPONSOR_SCAN_ENABLED=true
 *   2. call startSponsorJobScanCron() from index.ts app.listen callback
 * Until then this is dormant.
 */
export function startSponsorJobScanCron(): void {
  if (started) return;
  if (process.env.SPONSOR_SCAN_ENABLED !== 'true') {
    console.log('[sponsorJobScanCron] SPONSOR_SCAN_ENABLED != true — not scheduling.');
    return;
  }
  started = true;

  // Mondays 20:00 UTC (~Tue 06:00–07:00 AEST)
  cron.schedule('0 20 * * 1', async () => {
    console.log('[sponsorJobScanCron] Starting weekly sponsor jobs scan');
    try {
      const summary = await runSponsorScan();
      console.log('[sponsorJobScanCron] Done:', JSON.stringify(summary));
    } catch (err) {
      console.error('[sponsorJobScanCron] Scan failed:', err);
    }
  });
  console.log('[sponsorJobScanCron] Weekly sponsor scan scheduled (20:00 UTC Mondays)');
}

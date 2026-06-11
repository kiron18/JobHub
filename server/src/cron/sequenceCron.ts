import cron from 'node-cron';
import { processSequenceEmails } from '../email/engine/sequenceEngine';

let cronStarted = false;

export function startSequenceCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // Every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[sequenceCron] Starting email sequence processing');
    try {
      await processSequenceEmails();
    } catch (err) {
      console.error('[sequenceCron] Error:', err);
    }
  });

  console.log('[sequenceCron] Scheduled (hourly)');
}

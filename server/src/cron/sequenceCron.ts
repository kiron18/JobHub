import cron from 'node-cron';

let cronStarted = false;

/**
 * Sequence cron driver — processes ContactSequence enrollments daily.
 * Stub: will be implemented in Task 4.
 */
export function startSequenceCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // 08:00 UTC daily = 18:00 AEST
  cron.schedule('0 8 * * *', async () => {
    console.log('[sequenceCron] daily sequence processing tick (stub — not yet implemented)');
  });

  console.log('[cron] Sequence processing cron scheduled (08:00 UTC daily)');
}

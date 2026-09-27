import cron from 'node-cron';
import { runCoachCheckin, coachCheckinsEnabled } from '../services/coachCheckin/run';

let cronStarted = false;

// AEST, fixed for every paid member for now, no per-user override yet.
const AM_HOUR = Number(process.env.COACH_CHECKIN_AM_HOUR ?? 8);
const PM_HOUR = Number(process.env.COACH_CHECKIN_PM_HOUR ?? 18);

function currentAESTHour(): number {
  const s = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', hour: '2-digit', hour12: false,
  }).format(new Date());
  return parseInt(s, 10) % 24; // Intl can return "24" for midnight
}

/**
 * Hourly, like the trial-challenge reminder cron. Morning and evening are
 * fixed hours. Idempotent per (user, day, slot) through NudgeLog, so a
 * restart or an overlapping tick can never double-send, and a tick that
 * finds the bot offline hands the claim back so the next hour retries.
 *
 * Off until COACH_CHECKINS_ENABLED=true. Set COACH_CHECKINS_ONLY_EMAILS to
 * limit it to named members while testing.
 */
export function startCoachCheckinCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  cron.schedule('0 * * * *', async () => {
    if (!coachCheckinsEnabled()) return;
    const hour = currentAESTHour();
    if (hour !== AM_HOUR && hour !== PM_HOUR) return;
    const slot = hour === AM_HOUR ? 'morning' : 'evening';

    try {
      const r = await runCoachCheckin(slot);
      console.log(`[coachCheckin] ${slot}: sent ${r.sent.length}, skipped ${r.skipped.length}`);
    } catch (err) {
      console.error('[coachCheckin] cron error:', err);
    }
  });
}

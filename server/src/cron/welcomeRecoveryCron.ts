import cron from 'node-cron';
import { prisma } from '../index';
import { sendWelcomeClaimReminderEmail } from '../services/email';

let cronStarted = false;

/** How long after they gave the address before we nudge. Long enough to not be the same sitting. */
const REMIND_AFTER_MS = 60 * 60 * 1000;
/** Sessions are swept at 24h; a link that dies minutes after it lands is worse than no email. */
const LATEST_SESSION_AGE_MS = 22 * 60 * 60 * 1000;

/** On unless WELCOME_RECOVERY_EMAILS=off, read on every run so Railway can flip it without a deploy. */
export function welcomeRecoveryEnabled(): boolean {
  return (process.env.WELCOME_RECOVERY_EMAILS ?? '').trim().toLowerCase() !== 'off';
}

/**
 * One reminder to anyone who saw their rebuilt resume, gave an address on the
 * claim step, and never ended up with an account. Of the 12 people who reached
 * that step in the 30 days to 29 Oct 2026, 7 left without one.
 */
export async function runWelcomeRecovery(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const due = await prisma.welcomeSession.findMany({
    where: {
      email: { not: null },
      claimedByUserId: null,
      claimReminderSentAt: null,
      resumeCleanText: { not: null },
      emailCapturedAt: { lte: new Date(now.getTime() - REMIND_AFTER_MS) },
      createdAt: { gte: new Date(now.getTime() - LATEST_SESSION_AGE_MS) },
    },
    select: { id: true, token: true, email: true, firstName: true },
    take: 50,
  });

  let sent = 0;
  let skipped = 0;
  for (const s of due) {
    // Mark first: a crash between send and mark must cost a reminder, never send two.
    await prisma.welcomeSession.update({ where: { id: s.id }, data: { claimReminderSentAt: now } });
    // They may have finished another way (a second upload, the login page).
    const member = await prisma.candidateProfile.findFirst({
      where: { email: { equals: s.email!, mode: 'insensitive' }, hasCompletedOnboarding: true },
      select: { id: true },
    });
    if (member) { skipped++; continue; }
    try {
      if (await sendWelcomeClaimReminderEmail({ to: s.email!, firstName: s.firstName, token: s.token })) sent++;
    } catch (err) {
      console.warn('[welcome-recovery] send failed:', (err as Error).message);
    }
  }
  return { sent, skipped };
}

export function startWelcomeRecoveryCron(): void {
  if (cronStarted) return;
  cronStarted = true;
  cron.schedule('*/15 * * * *', async () => {
    if (!welcomeRecoveryEnabled()) return;
    try {
      const r = await runWelcomeRecovery();
      if (r.sent || r.skipped) console.log(`[welcome-recovery] sent ${r.sent}, skipped ${r.skipped}`);
    } catch (err) {
      console.error('[welcome-recovery] run failed:', err);
    }
  });
}

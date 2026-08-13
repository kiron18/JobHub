/**
 * Generates and sends the diagnostic to everyone who claimed the link in the
 * room.
 *
 * A cron rather than work fired inline from the claim request, for two reasons.
 * Generation is two LLM calls and takes tens of seconds, which is far too long
 * to hold a request open on someone tapping a link on their phone mid-session.
 * And a claim that arrives during a Railway redeploy would simply vanish if the
 * work lived in that request; here the row keeps its `attendedAt` and the next
 * tick picks it up.
 *
 * Claiming records attendance and nothing else. This does the rest.
 */
import cron from 'node-cron';
import { randomUUID } from 'crypto';
import { prisma } from '../index';
import { buildGapReport } from '../services/gapReport';
import { sendGapReportEmail } from '../services/email';
import { PUBLIC_APP_URL } from '../lib/appUrl';

let cronStarted = false;

/** Generated per tick, so one slow report cannot delay a whole room's worth. */
const BATCH = 3;

export async function runGapReportSweep(): Promise<void> {
  const due = await prisma.sessionRegistration.findMany({
    where: {
      attendedAt: { not: null },
      reportGeneratedAt: null,
      // No resume, no report. They are not stuck, there is simply nothing to
      // diagnose, and repeatedly failing them would mask real failures.
      resumeText: { not: null },
      // One retry cycle only. A row that has already failed keeps its error for
      // inspection rather than burning LLM budget on the same broken input.
      reportError: null,
    },
    orderBy: { attendedAt: 'asc' },
    take: BATCH,
    select: {
      id: true, email: true, name: true,
      resumeText: true, resumeFile: true, resumeMimetype: true, resumeFilename: true,
    },
  });

  if (!due.length) return;
  console.log(`[gapReport] generating ${due.length} report(s)`);

  for (const person of due) {
    // Claim the row before doing the expensive work. Two overlapping ticks, or
    // two Railway instances, must never both spend two LLM calls on the same
    // person and email them twice.
    const token = randomUUID();
    const claimed = await prisma.sessionRegistration.updateMany({
      where: { id: person.id, reportGeneratedAt: null },
      data: { reportGeneratedAt: new Date(), reportToken: token },
    });
    if (claimed.count === 0) continue;

    try {
      const report = await buildGapReport({
        resumeText: person.resumeText!,
        resumeFile: person.resumeFile ? Buffer.from(person.resumeFile) : null,
        resumeMimetype: person.resumeMimetype,
        resumeFilename: person.resumeFilename,
        registeredName: person.name,
      });

      await prisma.sessionRegistration.update({
        where: { id: person.id },
        data: { report: report as object },
      });

      await sendGapReportEmail({
        to: person.email,
        name: person.name,
        reportUrl: `${PUBLIC_APP_URL}/report/${token}`,
        dutyBullets: report.metrics.dutyBullets,
        totalBullets: report.metrics.totalBullets,
        atsRisk: report.metrics.atsRisk,
      });

      await prisma.sessionRegistration.update({
        where: { id: person.id },
        data: { reportSentAt: new Date() },
      });
      console.log('[gapReport] sent to', person.email);
    } catch (err) {
      // Hand the row back so the next tick retries once, and record why. The
      // stored error is what makes a stuck attendee visible on the roster
      // instead of just never receiving anything.
      const message = err instanceof Error ? err.message : String(err);
      await prisma.sessionRegistration.update({
        where: { id: person.id },
        data: { reportGeneratedAt: null, reportToken: null, reportError: message.slice(0, 500) },
      });
      console.error('[gapReport] failed for', person.email, message);
    }
  }
}

export function startGapReportCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // Every minute. The promise made in the room is "within the hour", and the
  // query is trivial when there is nothing to do.
  cron.schedule('* * * * *', async () => {
    try {
      await runGapReportSweep();
    } catch (err) {
      console.error('[gapReport] tick failed', err);
    }
  });

  console.log('[gapReport] cron started');
}

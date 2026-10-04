// ATS-scan launch email — sends/schedules through the same Contact/Broadcast/
// EmailSend tables /admin/email-analytics reads, split 50/50 into two
// Broadcast rows (Subject A / Subject B) for the subject-line test. Edit
// recipients.csv to add/remove people; nothing here decides who gets mailed.
//
// Dry run (default): prints the split and a sample, sends nothing.
//   npx tsx scripts/campaigns/ats-scan-launch/send.ts
//
// Real send/schedule, after you've reviewed the dry run:
//   npx tsx scripts/campaigns/ats-scan-launch/send.ts --send
//   npx tsx scripts/campaigns/ats-scan-launch/send.ts --send --at "2026-10-06T16:00:00+11:00"
//
// --at is an ISO timestamp passed straight to Resend's scheduled_at. Omit it
// to send immediately on --send.
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../../../src/email/send/sendEmail';

const SERVER_ROOT = path.resolve(__dirname, '..', '..', '..'); // server/ (this file: server/scripts/campaigns/ats-scan-launch/)

// Belt-and-suspenders: @prisma/client auto-loads server/.env on import, but
// that is undocumented behaviour to lean on for RESEND_API_KEY — load it
// explicitly too, same as the rest of this repo's standalone scripts do.
function readEnv(f: string): Record<string, string> {
  return Object.fromEntries(
    fs.readFileSync(f, 'utf8').split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
  );
}
for (const [k, v] of Object.entries(readEnv(path.join(SERVER_ROOT, '.env')))) {
  if (!(k in process.env)) process.env[k] = v;
}

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const LIVE = args.includes('--send');
const atIdx = args.indexOf('--at');
const SCHEDULED_AT = atIdx >= 0 ? args[atIdx + 1] : undefined;

const CTA_URL = 'https://aussiegradcareers.com.au';
const SUBJECT_A = 'Claim your free improved resume today';
const SUBJECT_B = "99 problems but the ATS ain't one";

function bodyText(firstName: string): string {
  const hi = firstName ? `${firstName},` : 'Hey,';
  return `${hi}

I've set a goal for myself: help 100 international grads walk into 2027 with their dream role. People in your exact situation did this with me recently, using systems and goal setting instead of guesswork, in 90 days.

I'm going to give you every free resource I have. All I need from you is to commit. If getting a job is as important to you as you say it is, that shouldn't be a problem.

Your first free gift: Scan your resume free
${CTA_URL}

Most resumes never get rejected by a person. They get filtered by a scanner before anyone reads a word, because of something as small as a table, a column, or a text box.

That is not about your talent. It is a formatting problem, and it is fixable in minutes if you know where to look.

The next biggest gap: most resumes read like a boring book report and tell the hiring manager nothing about what you actually bring to the table.

Fix both in under 5 minutes, free. Upload yours and you'll see straight away whether it clears the ATS, whether your bullets show outcomes or just duties, how it matches what employers here scan for, and how it reads in a 6 second skim. You see the result before anything else is asked of you.

Scan your resume free: ${CTA_URL}

Kiron`;
}

// HTML with a real <a href>, not a bare URL in text — opens/clicks only track
// on the HTML part, and a click needs an actual link to redirect through.
function bodyHtml(firstName: string): string {
  const hi = firstName ? `${firstName},` : 'Hey,';
  const p = (t: string) => `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;color:#5c5750;margin:0 0 16px;line-height:1.65;">${t}</p>`;
  const link = (label: string) => `<a href="${CTA_URL}" style="color:#2d5a6e;font-weight:700;">${label}</a>`;
  return [
    `<div style="background:#faf7f2;padding:28px 12px;">`,
    `<table cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:0 auto;"><tr><td>`,
    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;color:#1a1814;margin:0 0 14px;line-height:1.6;">${hi}</p>`,
    p(`I've set a goal for myself: help 100 international grads walk into 2027 with their dream role. People in your exact situation did this with me recently, using systems and goal setting instead of guesswork, in 90 days.`),
    p(`I'm going to give you every free resource I have. All I need from you is to commit. If getting a job is as important to you as you say it is, that shouldn't be a problem.`),
    p(`Your first free gift: ${link('Scan your resume free')}`),
    p(`Most resumes never get rejected by a person. They get filtered by a scanner before anyone reads a word, because of something as small as a table, a column, or a text box.`),
    p(`That is not about your talent. It is a formatting problem, and it is fixable in minutes if you know where to look.`),
    p(`The next biggest gap: most resumes read like a boring book report and tell the hiring manager nothing about what you actually bring to the table.`),
    p(`Fix both in under 5 minutes, free. Upload yours and you'll see straight away whether it clears the ATS, whether your bullets show outcomes or just duties, how it matches what employers here scan for, and how it reads in a 6 second skim. You see the result before anything else is asked of you.`),
    `<p style="margin:0 0 24px;"><a href="${CTA_URL}" style="display:inline-block;background:#2d5a6e;color:#faf7f2;text-decoration:none;font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;font-weight:700;padding:13px 26px;border-radius:8px;">Scan your resume free</a></p>`,
    `<p style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;color:#1a1814;margin:0;line-height:1.65;">Kiron</p>`,
    `</td></tr></table></div>`,
  ].join('');
}

interface Row { Name: string; FirstName: string; Email: string; 'Stage/status': string }

function parseCsv(text: string): Row[] {
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const cols = header.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ''])) as unknown as Row;
  });
}

async function main() {
  const rows = parseCsv(fs.readFileSync(path.join(__dirname, 'recipients.csv'), 'utf8'))
    .filter((r) => r.Email && r.Email.includes('@'));

  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const e = r.Email.trim().toLowerCase();
    if (seen.has(e)) return false;
    seen.add(e);
    return true;
  });

  // Deterministic split (alternating), not random — reruns always show the
  // same groups, and re-running --send after a partial failure never
  // reshuffles who already got which subject.
  const groupA = deduped.filter((_, i) => i % 2 === 0);
  const groupB = deduped.filter((_, i) => i % 2 === 1);

  console.log(`Recipients: ${deduped.length} (from ${rows.length} rows in recipients.csv)`);
  console.log(`  Subject A (${groupA.length}): "${SUBJECT_A}"`);
  console.log(`  Subject B (${groupB.length}): "${SUBJECT_B}"`);
  console.log(`Mode: ${LIVE ? (SCHEDULED_AT ? `SCHEDULE for ${SCHEDULED_AT}` : 'SEND NOW') : 'DRY RUN — nothing will be sent'}`);
  console.log();
  console.log('Sample A:', groupA.slice(0, 3).map((r) => `${r.FirstName} <${r.Email}>`).join(', '));
  console.log('Sample B:', groupB.slice(0, 3).map((r) => `${r.FirstName} <${r.Email}>`).join(', '));

  if (!LIVE) {
    console.log('\nDry run only. Re-run with --send to actually mail (and --at "<ISO time>" to schedule).');
    return;
  }
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not found in server/.env or the environment.');

  for (const [group, subject, label] of [
    [groupA, SUBJECT_A, 'ATS scan launch — A'],
    [groupB, SUBJECT_B, 'ATS scan launch — B'],
  ] as const) {
    const broadcast = await prisma.broadcast.create({
      data: {
        name: label, subject, bodyText: bodyText(''), bodyHtml: bodyHtml(''),
        targetCriteria: { source: 'recipients.csv', recipients: group.length },
        status: 'sending',
      },
    });

    let sent = 0;
    let failed = 0;
    for (const r of group) {
      const email = r.Email.trim();
      const firstName = r.FirstName.trim();
      try {
        const contact = await prisma.contact.upsert({
          where: { email },
          update: { firstName: firstName || undefined, lastActivityAt: new Date() },
          create: { email, firstName: firstName || undefined, source: 'ats_scan_launch_campaign' },
        });
        const emailSend = await prisma.emailSend.create({
          data: {
            contactId: contact.id, broadcastId: broadcast.id, subject,
            fromEmail: process.env.EMAIL_FROM ?? 'Aussie Grad Careers <kiron@aussiegradcareers.com.au>',
            toEmail: email,
          },
        });
        const { resendEmailId, error } = await sendEmail({
          to: email, subject, bodyText: bodyText(firstName), bodyHtml: bodyHtml(firstName),
          trackingId: emailSend.id, scheduledAt: SCHEDULED_AT,
        });
        if (resendEmailId) await prisma.emailSend.update({ where: { id: emailSend.id }, data: { resendEmailId } });
        if (error) { failed++; console.error(`FAILED ${email}: ${error}`); } else { sent++; console.log(`sent  ${email} -> ${resendEmailId}`); }
      } catch (err: any) {
        failed++;
        console.error(`FAILED ${email}: ${err.message}`);
      }
      // Resend's default rate limit is a few requests/sec on most plans.
      await new Promise((res) => setTimeout(res, 350));
    }

    await prisma.broadcast.update({ where: { id: broadcast.id }, data: { status: 'sent', sentAt: new Date() } });
    console.log(`"${label}": ${sent} sent, ${failed} failed.`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });

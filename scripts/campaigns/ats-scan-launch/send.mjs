// ATS-scan launch email — sends/schedules via Resend, split 50/50 for a subject
// line A/B test. Reads recipients.csv (edit that file to add/remove people);
// nothing here decides who gets mailed.
//
// Dry run (default): prints the split and a sample, sends nothing.
//   node scripts/campaigns/ats-scan-launch/send.mjs
//
// Real send/schedule, after you've reviewed the dry run:
//   node scripts/campaigns/ats-scan-launch/send.mjs --send
//   node scripts/campaigns/ats-scan-launch/send.mjs --send --at "2026-10-03T16:00:00+11:00"
//
// --at is an ISO timestamp passed straight to Resend's scheduled_at. Omit it
// to send immediately on --send.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..'); // JobHub/

const args = process.argv.slice(2);
const LIVE = args.includes('--send');
const atIdx = args.indexOf('--at');
const SCHEDULED_AT = atIdx >= 0 ? args[atIdx + 1] : null;

const FROM = 'Kiron <kiron@aussiegradcareers.com.au>';
const SUBJECT_A = 'Claim your free improved resume today';
const SUBJECT_B = "99 problems but the ATS ain't one";

// Same body for both variants — only the subject is under test.
function body(firstName) {
  const hi = firstName ? `${firstName},` : 'Hey,';
  return `${hi}

I've set a goal for myself: help 100 international grads walk into 2027 with their dream role. People in your exact situation did this with me recently, using systems and goal setting instead of guesswork, in 90 days.

I'm going to give you every free resource I have. All I need from you is to commit. If getting a job is as important to you as you say it is, that shouldn't be a problem.

Your first free gift: Scan your resume free
https://aussiegradcareers.com.au

Most resumes never get rejected by a person. They get filtered by a scanner before anyone reads a word, because of something as small as a table, a column, or a text box.

That is not about your talent. It is a formatting problem, and it is fixable in minutes if you know where to look.

The next biggest gap: most resumes read like a boring book report and tell the hiring manager nothing about what you actually bring to the table.

Fix both in under 5 minutes, free. Upload yours and you'll see straight away whether it clears the ATS, whether your bullets show outcomes or just duties, how it matches what employers here scan for, and how it reads in a 6 second skim. You see the result before anything else is asked of you.

Scan your resume free: https://aussiegradcareers.com.au

Kiron`;
}

function readEnv(f) {
  return Object.fromEntries(
    fs.readFileSync(f, 'utf8').split(/\r?\n/)
      .filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
  );
}

function parseCsv(text) {
  // Recipients file has no quoted commas (names/emails/plain stage strings),
  // so a plain split is fine and keeps this script dependency-free.
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const cols = header.split(',');
  return lines.map(line => {
    const cells = line.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
  });
}

const RECIPIENTS_PATH = path.join(__dirname, 'recipients.csv');
const rows = parseCsv(fs.readFileSync(RECIPIENTS_PATH, 'utf8'))
  .filter(r => r.Email && r.Email.includes('@'));

const seen = new Set();
const deduped = rows.filter(r => {
  const e = r.Email.trim().toLowerCase();
  if (seen.has(e)) return false;
  seen.add(e);
  return true;
});

// Deterministic split (alternating), not random — reruns of a dry run always
// show the same groups, and re-running --send after a partial failure would
// not reshuffle who already got which subject.
const groupA = deduped.filter((_, i) => i % 2 === 0);
const groupB = deduped.filter((_, i) => i % 2 === 1);

console.log(`Recipients: ${deduped.length} (from ${rows.length} rows in recipients.csv)`);
console.log(`  Subject A (${groupA.length}): "${SUBJECT_A}"`);
console.log(`  Subject B (${groupB.length}): "${SUBJECT_B}"`);
console.log(`Mode: ${LIVE ? (SCHEDULED_AT ? `SCHEDULE for ${SCHEDULED_AT}` : 'SEND NOW') : 'DRY RUN — nothing will be sent'}`);
console.log();
console.log('Sample A:', groupA.slice(0, 3).map(r => `${r.FirstName} <${r.Email}>`).join(', '));
console.log('Sample B:', groupB.slice(0, 3).map(r => `${r.FirstName} <${r.Email}>`).join(', '));

if (!LIVE) {
  console.log('\nDry run only. Re-run with --send to actually mail (and --at "<ISO time>" to schedule).');
  process.exit(0);
}

const env = readEnv(path.join(ROOT, 'server', '.env'));
const RESEND_API_KEY = process.env.RESEND_API_KEY || env.RESEND_API_KEY;
if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not found in server/.env or the environment.');

async function sendOne(to, firstName, subject) {
  const payload = { from: FROM, to: [to], subject, text: body(firstName) };
  if (SCHEDULED_AT) payload.scheduled_at = SCHEDULED_AT;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${to}: ${res.status} ${JSON.stringify(data)}`);
  return data.id;
}

const results = { ok: 0, failed: [] };
for (const [group, subject] of [[groupA, SUBJECT_A], [groupB, SUBJECT_B]]) {
  for (const r of group) {
    try {
      const id = await sendOne(r.Email.trim(), r.FirstName, subject);
      results.ok++;
      console.log(`sent  ${r.Email} -> ${id}`);
    } catch (err) {
      results.failed.push(r.Email);
      console.error(`FAILED ${r.Email}: ${err.message}`);
    }
    // Resend's default rate limit is a few requests/sec on most plans.
    await new Promise(res => setTimeout(res, 350));
  }
}
console.log(`\nDone. ${results.ok} sent, ${results.failed.length} failed.`);
if (results.failed.length) console.log('Failed:', results.failed.join(', '));

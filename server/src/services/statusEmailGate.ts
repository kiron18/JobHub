/**
 * Whether marking a job Applied or Rejected should email the person.
 *
 * Until 19 Oct 2026 it emailed every time: 106 "Following up on your <role>
 * application" emails went to 8 people in two weeks (about 13 each) and none
 * were opened, and 21 "It happens" emails went to 3. Mail like that teaches
 * people to ignore the sender, which costs every email that matters. Now:
 *
 *   - Applied: once, for the first application. The follow-up digest
 *     (followUpReminderCron) already covers every application after it.
 *   - Rejected: at most once a week. The rest are seen in the weekly wrap.
 *   - Neither within a day of the other.
 */
export type PriorStatusSend = { subject: string; sentAt: Date };

export const APPLIED_SUBJECT = 'Nice work: your first application is in';
export const REJECTED_SUBJECT = "It happens. Here's what to do next";

const DAY_MS = 24 * 60 * 60 * 1000;
const REJECTED_GAP_DAYS = 7;

// The applied email's subject named the role until the change above, so both
// spellings count as "already had it".
const isApplied = (s: string) => s === APPLIED_SUBJECT || s.startsWith('Following up on your ');
const isRejected = (s: string) => s === REJECTED_SUBJECT;

export function statusEmailDue(
  status: 'APPLIED' | 'REJECTED',
  prior: PriorStatusSend[],
  now: Date = new Date(),
): boolean {
  const ago = (d: Date) => now.getTime() - d.getTime();
  if (prior.some(p => ago(p.sentAt) < DAY_MS)) return false;
  if (status === 'APPLIED') return !prior.some(p => isApplied(p.subject));
  return !prior.some(p => isRejected(p.subject) && ago(p.sentAt) < REJECTED_GAP_DAYS * DAY_MS);
}

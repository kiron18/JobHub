/* ────────────────────────────────────────────────────────────────────────────
   The task list behind /admin/daily. Edit the words and the list here; the
   server stores whatever ids it is given, so a new task needs no migration.

   Source: Daekwon/90-DAY-CAMPAIGN-PLAN.md (Posting and Distribution).
   ──────────────────────────────────────────────────────────────────────────── */

export interface DailyTask {
  id: string;
  label: string;
  hint?: string;
  /** 'tick' is done when ticked. 'count' is done when the count reaches target. */
  kind: 'tick' | 'count';
  target?: number;
  /** A tick task that also asks "how many", stored under `${id}_n`. */
  ask?: string;
  /** 0 = Sunday. Left out means every day. */
  days?: number[];
}

/** What goes out each day, Sunday first to match Date#getDay. */
export const POST_OF_THE_DAY: { name: string; what: string }[] = [
  { name: 'Scoreboard', what: 'This week’s challenge numbers, plus the newsletter.' },
  { name: 'Pain or contrarian insight', what: 'One thing about the Australian job search nobody teaches.' },
  { name: 'Application demo', what: '5 applications in 25 minutes. Show the screen, not the pitch.' },
  { name: 'One client, one problem', what: 'What they thought was wrong, what it really was, what changed.' },
  { name: 'Outreach demo', what: '5 people in 25 minutes. Find, message, send, track.' },
  { name: 'Recruiter insight or data', what: 'Something you heard or measured this week.' },
  { name: 'Personal story', what: 'Your own migrant experience.' },
];

export const DAILY_TASKS: DailyTask[] = [
  { id: 'post_out', kind: 'tick', label: 'Today’s post is out' },
  {
    id: 'reply_comments', kind: 'tick', label: 'Reply to every comment',
    hint: 'In the first hour after the post goes out.',
  },
  {
    id: 'dm_90', kind: 'tick', label: 'DM everyone who commented 90', ask: 'DMs sent',
    hint: 'Each one gets their link within 24 hours. Tick it even if nobody commented.',
  },
  {
    id: 'connect', kind: 'count', target: 20, label: 'Send 20 connection requests',
    hint: 'International grads in Melbourne, Sydney, Adelaide and Perth.',
  },
  { id: 'newsletter_topic', kind: 'tick', days: [5], label: 'Pick next week’s newsletter topic' },
  {
    id: 'record_demos', kind: 'tick', days: [0], label: 'Record the two demo videos',
    hint: 'Tuesday’s application demo and Thursday’s outreach demo, in one sitting.',
  },
  { id: 'approve_drafts', kind: 'tick', days: [0], label: 'Edit and approve next week’s posts in Buffer' },
  { id: 'newsletter', kind: 'tick', days: [0], label: 'Send the newsletter' },
];

/** Day of the week for a YYYY-MM-DD string, with no timezone drift. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function tasksFor(date: string): DailyTask[] {
  const day = weekdayOf(date);
  return DAILY_TASKS.filter((t) => !t.days || t.days.includes(day));
}

export type DoneMap = Record<string, boolean | number>;

export function isDone(task: DailyTask, done: DoneMap): boolean {
  const v = done[task.id];
  if (task.kind === 'count') return typeof v === 'number' && v >= (task.target ?? 1);
  return v === true;
}

export function doneCount(date: string, done: DoneMap): { done: number; total: number } {
  const tasks = tasksFor(date);
  return { done: tasks.filter((t) => isDone(t, done)).length, total: tasks.length };
}

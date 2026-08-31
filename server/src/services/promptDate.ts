/**
 * The one place a prompt is told what day it is.
 *
 * On 25 Aug 2026 the /welcome intake opened its read of Emmanuel Fasan's CV
 * with "your C9 Group internship is listed as starting in March 2026, which is
 * in the future ... that reads as careless, and recruiters will assume the rest
 * of the document is equally unreliable". March 2026 was five months in the
 * past. It was his current job.
 *
 * The cause is structural, not a bad prompt: no prompt in this codebase had
 * ever been given the current date, so every model reasoning about one fell
 * back on its own training cutoff. That is silent, it gets worse every month
 * the model ages, and it fires hardest on the most credible thing on the page,
 * the candidate's current role, because that is the latest date in the
 * document. The same blind spot is behind every years-of-experience figure a
 * prompt derives from a date range.
 *
 * Import this into any prompt that reads, judges, or writes a date. Do not
 * inline a paraphrase, and do not evaluate it at module load: a Railway process
 * runs for weeks and would then serve the day it booted.
 */

/** en-CA renders ISO order (YYYY-MM-DD); en-AU renders the way a person reads it. */
const ISO_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Sydney',
  year: 'numeric', month: '2-digit', day: '2-digit',
});
const LONG_FMT = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney',
  day: 'numeric', month: 'long', year: 'numeric',
});

/**
 * Today in Australia/Sydney, which is the timezone every candidate and employer
 * in this business is in. `now` is injectable for tests only.
 */
export function sydneyToday(now: Date = new Date()): { iso: string; long: string } {
  return { iso: ISO_FMT.format(now), long: LONG_FMT.format(now) };
}

/**
 * The block to paste into a prompt.
 *
 * One sentence. A fact, and nothing else.
 *
 * This is here because a model has no clock. It has a training cutoff, and
 * nothing in a request tells it what today is, so it guesses from that cutoff
 * and guesses low. On 25 Aug 2026 that put a client's current job five months
 * in the future and led their report with an accusation of carelessness.
 *
 * Everything that used to follow the date was scar tissue. It told the model
 * that a date before today is in the past and that "Present" means still
 * running, both of which any reader knows, and the second of those is what
 * produced the 28 Aug 2026 report claiming a Present role had already ended.
 * Stating the obvious did not make the model more careful; it made it hunt for
 * date faults and invent one.
 *
 * Do not add a rule here. If a prompt needs the date it gets the date.
 */
export function todayBlock(now: Date = new Date()): string {
  const { iso, long } = sydneyToday(now);
  return `Today's date is ${long} (${iso}), Australia/Sydney time.`;
}


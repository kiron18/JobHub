/**
 * The run sheet, generated rather than hand written.
 *
 * Modelled on the 6 Aug sheet, which is the proven shape: the room table, the
 * timings, the rules, the hard cap on the demo. That one was typed out by hand
 * the afternoon of the call, which is exactly the work this file removes.
 *
 * ⚠️ The timings are OFFSETS IN MINUTES from the real start, never wall-clock
 * strings. The workshop is a recurring weekly slot whose start is re-derived
 * from the clock on every request (see `server/src/config/workshop.ts`), so a
 * sheet with "5:06" written into it would be quietly wrong the first week the
 * slot moved, on the one afternoon nobody has time to notice.
 */

/** One row of the timings table. */
export interface RunSheetBeat {
  /** Minutes from the session start. Negative for the pre-roll. */
  offset: number;
  slide: string;
  beat: string;
  /** Rendered heavier: the beats that going soft on costs the whole call. */
  hard?: boolean;
}

export interface RunSheetPerson {
  name: string;
  question: string | null;
  gap: number | null;
  temperature: string | null;
}

/**
 * The running order.
 *
 * Total span is T-10 to T+118, which is longer than the 90 minutes the calendar
 * invite promises. That is deliberate and it is what actually happened on 6 Aug:
 * the demo and the offer land after the ninety minute mark and the people still
 * in the room at that point are the people who buy. The overrun is flagged on
 * the sheet rather than hidden by compressing the teaching.
 */
export const BEATS: RunSheetBeat[] = [
  { offset: -10, slide: 'S0', beat: 'Holding slide up, mic tested, JobHub tab already open and logged in' },
  { offset: 0, slide: 'S1', beat: 'Chat check-in' },
  { offset: 6, slide: 'S2', beat: 'Who I am, and flag the pitch' },
  { offset: 10, slide: 'S3', beat: 'Their questions, by name', hard: true },
  { offset: 14, slide: 'S4 to S5', beat: 'Diagnosis, then the four gaps' },
  { offset: 24, slide: 'S6 to S8', beat: 'Gap 1: Targeting' },
  { offset: 40, slide: 'S9 to S12', beat: 'Gap 2: Outcomes, plus the live rewrite' },
  { offset: 60, slide: 'S13', beat: 'Q break, 2 questions only', hard: true },
  { offset: 66, slide: 'S14 to S17', beat: 'Gap 3: Outreach' },
  { offset: 82, slide: 'S18 to S19', beat: 'Gap 4: System' },
  { offset: 88, slide: 'S20', beat: 'Demo, 10 minute hard cap', hard: true },
  { offset: 98, slide: 'S21', beat: 'Main Q&A' },
  { offset: 110, slide: 'S22', beat: 'Recap' },
  { offset: 112, slide: 'S23', beat: 'The offer, read verbatim', hard: true },
  { offset: 118, slide: 'S24', beat: 'Close, then stay on' },
];

/** The one instruction that saves the running order when it slips. */
export const CUT_RULE =
  'If you are not at the demo by T+88, cut. Do not compress. Drop S8 and S11 first, they are the padding.';

/**
 * The rules, in the order they get broken.
 *
 * Rule 1 is first because it is the one that decides whether the room talks at
 * all, and a silent room cannot be sold to.
 */
export const RULES: string[] = [
  'Never say "any questions?". Say "Rafey, what is your situation with this?". Nobody unmutes voluntarily. Almost everyone answers to their own name.',
  'Name everyone in the first 10 minutes. Tick them off below. Aim for everyone twice by the end.',
  'Silence longer than 3 seconds, name someone. Do not fill it yourself.',
  'Callback twice. Reference something from minute 12 at minute 60. It proves you were listening rather than performing.',
  'Do not apologise. Not for tech, not for numbers, not for the group being small. Small is intimate, so sell it that way.',
  'Answer to the person, then generalise. "Darshika, for you it is X, and this applies to anyone who..."',
  'Do not teach past the demo. After S20 you are closing, not adding value.',
  'After you say the price, stop talking. Count to five. Whoever speaks first loses.',
  'The pitch is a service. They asked for it in writing. Delivering it is keeping a promise.',
  'Ask for questions in chat from minute one, continuously. You should never face live silence, you are reading from a queue.',
  'Close in the room if the buying state is there. Do not park a ready buyer into a follow-up email.',
];

export interface QuestionWindow {
  window: string;
  howMany: string;
  why: string;
}

export const QUESTION_BUDGET: QuestionWindow[] = [
  { window: 'S13 (T+60)', howMany: '2, hard', why: 'Releases pressure, keeps pace' },
  { window: 'S21 (T+98)', howMany: 'One each, by name, then open', why: 'About one question per person present, inside 12 minutes' },
  { window: 'After S24', howMany: 'Unlimited', why: 'The ones who stay are the ones who buy' },
];

export const SILENT_WINDOW_LINE =
  'If the first Q window is silent: "The question I get most here is..." and answer your own. The second one always comes.';

// ── The offer ────────────────────────────────────────────────────────────────

export interface OfferParams {
  /** Total price, in dollars. */
  price: number;
  /** What that works out to per month across the program. */
  perMonth: number;
  months: number;
  /** When the current pricing closes, or null if there is no deadline running. */
  deadline: Date | null;
  timeZone: string;
}

/**
 * The offer script, verbatim, as paragraphs.
 *
 * Read out loud, so it is written to be spoken rather than skimmed.
 *
 * ⚠️ One paragraph from the 6 Aug script is deliberately NOT here: the "the
 * group isn't built yet, it opens next week" line, and the founding-member
 * justification that hung off it. That was a true statement about one specific
 * week in August and it is the reason the price was what it was. Saying it now
 * would be a false claim, and quietly rewriting it into something vaguer would
 * throw away the strongest part of the script without anyone noticing. So it is
 * removed and flagged: if founding pricing is still running, the reason for it
 * has to be a current one, and it goes in `offerNotes` on screen until it is.
 */
export function offerScript(p: OfferParams): string[] {
  const deadlineLine = p.deadline
    ? `Pricing closes ${formatDeadline(p.deadline, p.timeZone)}.`
    : 'Pricing closes at the end of the week.';

  return [
    'Alright. Last few minutes, this is the part I flagged at the start.',
    'Here is how I work with people.',
    `I run a group program. ${p.months} months. $${p.price}, which is $${p.perMonth} a month.`,
    'You get a private community, so you are not doing this alone at 11pm wondering whether you are the only one. You get the platform I just showed you, so the applications and the outreach actually go out. You get weekly live calls with me, like tonight, except you bring your own situation. And you get every template, every script, every resource I use.',
    deadlineLine,
    'If you want in, message me and I will send you the link.',
    'And if you are not sure, that is completely fine, and I mean that. Book a call with me this week. Twenty minutes, no pitch. We look at your actual situation and I tell you honestly whether this is right for you. That is open to everyone in this room.',
  ];
}

export const OFFER_NOTES: string[] = [
  'Then stop. Say nothing until someone else does.',
  'Confirm the deadline date out loud against a calendar before you say it. Tight deadline on the price, loose on delivery: you cannot be late on a promise you did not make.',
  'The founding-member paragraph from the 6 Aug script is not in here. It was true about that one week only. If founding pricing is still running, write the current reason for it before you read this out.',
];

// ── Before and after ─────────────────────────────────────────────────────────

export const BEFORE_THE_CALL: string[] = [
  'Read every fact sheet on this page. You promised them in writing that you would.',
  'Pre-arrange the live rewrite. Message one person now: "Can I use one of your CV bullets as the live example tonight?". Pre-cleared means no dead air.',
  'Names on paper in front of you.',
  'Test the screen share of JobHub once, with the tab already open and logged in.',
  'Decide whether you are recording. If the room is more than a handful, yes: it is the asset you reuse for the next one.',
];

export const AFTER_THE_CALL: string[] = [
  'Anyone who showed buying state in the room and did not close, message them tonight while it is warm.',
  'Everyone else gets one email within a few hours: one line specific to them off their fact sheet, the resource, the price, the deadline, the booking link.',
];

// ── Derived values ───────────────────────────────────────────────────────────

/**
 * When the current pricing closes.
 *
 * Six days after the session, which is the gap that was actually used on 6 Aug
 * (session Thursday, deadline the following Wednesday). Derived rather than
 * typed so it can never be last week's date, and shown on the sheet with an
 * instruction to confirm it, because a deadline said wrong out loud is a
 * deadline you cannot then enforce.
 */
export function deadlineFor(start: Date): Date {
  return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
}

export function beatTime(start: Date, offset: number): Date {
  return new Date(start.getTime() + offset * 60_000);
}

/** Wall-clock time in the workshop's own zone, which is the only one that matters. */
export function formatClock(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d).replace(/\s?(am|pm)/i, (m) => m.trim().toLowerCase());
}

export function formatDeadline(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone, weekday: 'long', day: 'numeric', month: 'long',
  }).format(d);
}

export function formatSessionDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);
}

/** The gap names, matching the four the workshop is built around. */
export const GAP_NAMES: Record<number, string> = {
  1: 'Targeting',
  2: 'Outcomes',
  3: 'Outreach',
  4: 'System',
};

export function gapLabel(gap: number | null): string {
  if (!gap) return 'Not asked';
  return `Gap ${gap}: ${GAP_NAMES[gap] ?? '?'}`;
}

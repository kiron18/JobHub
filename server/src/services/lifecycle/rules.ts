/**
 * When each lifecycle email and login popup is due. Pure functions only, so
 * every timing decision is covered by rules.test.ts without a database.
 *
 * The journey (Kiron, 2026-10-15):
 *   signup        email 1, resume ready (sent by /welcome itself)
 *   ~day 1        email 2, first application (only if none recorded yet)
 *   day 3         email 3 + popup, no card yet: "you will not be charged"
 *   card added    email 4 + popup, 7 more days, first charge date stated
 *   48h out       email 5 + popup, first charge reminder
 *   paid #1       email 6 + popup, the next 90 days
 *   weekly        email 7, check-in (paid clients only)
 *   48h out       email 8 + popup, before payment #2
 *   48h out       email 9 + popup, before payment #3
 *   paid #3       email 10 + popup, 12 months of included access
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** How long the plan runs in monthly payments. Same env var the webhook uses to set cancel_at. */
export function planMonths(): number {
  return Number(process.env.SUBSCRIPTION_MONTHS || 3);
}

/** Months of access included after the last payment. */
export const INCLUDED_ACCESS_MONTHS = 12;

/** The price quoted before a card exists (email 3, day-3 popup). Once a subscription exists, its own price is used. */
export const DEFAULT_PLAN_AMOUNT = '$250';

// The crons run once a day, so every window is 24 hours wide: each person
// falls inside exactly one run. NudgeLog dedupe covers restarts and overlaps.
export const FIRST_APPLICATION_WINDOW = { fromHours: 18, toHours: 42 };
export const DAY3_WINDOW = { fromHours: 54, toHours: 78 };
export const PRE_CHARGE_WINDOW = { fromHours: 36, toHours: 60 };

export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / HOUR;
}

export function inWindow(hours: number, w: { fromHours: number; toHours: number }): boolean {
  return hours >= w.fromHours && hours < w.toHours;
}

/** The pre-charge email for the charge that is coming up, by how many payments have already gone through. */
export function preChargeEmailFor(paidCount: number): 'pre_first_charge' | 'pre_second_charge' | 'pre_third_charge' | null {
  if (paidCount === 0) return 'pre_first_charge';
  if (paidCount === 1) return 'pre_second_charge';
  if (paidCount === 2 && planMonths() === 3) return 'pre_third_charge';
  return null;
}

/** The after-payment email for a payment that just went through. */
export function paidEmailFor(paidCount: number): 'first_payment' | 'plan_completed' | null {
  if (paidCount === 1) return 'first_payment';
  if (paidCount === planMonths()) return 'plan_completed';
  return null;
}

/**
 * When the included 12 months run out. Counted from the end of the third paid
 * month, not from the day of the third payment, so the month they just paid for
 * is not swallowed by the "included" year.
 */
export function includedAccessExpiry(termEnd: Date): Date {
  const d = new Date(termEnd);
  d.setMonth(d.getMonth() + INCLUDED_ACCESS_MONTHS);
  return d;
}

/**
 * True when a subscription will actually charge at `chargeAt`. A client who
 * cancelled, or whose term ends first, must not be told a payment is coming.
 */
export function willCharge(sub: { status: string; cancel_at?: number | null; cancel_at_period_end?: boolean | null }, chargeAt: Date): boolean {
  if (!['trialing', 'active', 'past_due'].includes(sub.status)) return false;
  if (sub.cancel_at_period_end) return false;
  if (sub.cancel_at && sub.cancel_at * 1000 <= chargeAt.getTime() + HOUR) return false;
  return true;
}

/** The "focus for the coming week" line in email 7. Cadence is 25 applications a week. */
export function recommendedNextAction(c: { applications: number; outreach: number; followupsDue: number }): string {
  if (c.followupsDue > 0) {
    const n = c.followupsDue;
    return `send your ${n} follow-up${n === 1 ? '' : 's'} first. They are the quickest wins sitting in your pipeline.`;
  }
  if (c.applications === 0) {
    return 'complete one application from start to finish, then plan the outreach that goes with it.';
  }
  if (c.outreach < Math.ceil(c.applications / 2)) {
    return 'match your applications with outreach. For each application, identify one relevant person and contact them.';
  }
  if (c.applications < 25) {
    return 'build toward 25 applications this week, with outreach for each one.';
  }
  return 'keep the same pace, and look at which applications got a response so you can do more of what works.';
}

// ── Login popups ─────────────────────────────────────────────────────────────

export type NoticeKey =
  | 'day3_commit'
  | 'card_added'
  | 'pre_first_charge'
  | 'first_payment'
  | 'pre_second_charge'
  | 'pre_third_charge'
  | 'plan_completed';

export interface NoticeState {
  now: Date;
  signedUpAt: Date;
  /** Paying, trialing, comped or inside a paid window: no day-3 ask. */
  hasPaidAccess: boolean;
  hasSubscription: boolean;
  planStatus: string | null;
  trialEndDate: Date | null;
  /** Lifecycle emails already sent to them, key -> when. */
  emailsSent: Partial<Record<string, Date>>;
  /** Popups already acknowledged (periodKey strings). */
  acked: Set<string>;
}

export interface NoticeDecision {
  key: NoticeKey;
  /** What gets acknowledged. Day 3 is per AEST day so it comes back daily until they commit. */
  ackKey: string;
}

/** How long after its email a popup still makes sense. */
const POPUP_SHELF_LIFE: Record<string, number> = {
  card_added: 7 * DAY,
  pre_first_charge: 3 * DAY,
  first_payment: 14 * DAY,
  pre_second_charge: 3 * DAY,
  pre_third_charge: 3 * DAY,
  plan_completed: 30 * DAY,
};

/**
 * The one popup to show at login, or null. Most urgent first, at most one at a
 * time: a money reminder outranks a celebration.
 */
export function noticeFor(s: NoticeState, aestDayKey: string): NoticeDecision | null {
  // Day 3 onwards with no card: ask every day until they commit, never before day 3.
  const ageHours = hoursBetween(s.signedUpAt, s.now);
  if (!s.hasPaidAccess && !s.hasSubscription && ageHours >= DAY3_WINDOW.fromHours) {
    const ackKey = `day3_commit:${aestDayKey}`;
    return s.acked.has(ackKey) ? null : { key: 'day3_commit', ackKey };
  }

  // The first-charge reminder is computed from the trial date, so it works
  // even on a day the email cron did not run.
  if (s.planStatus === 'trialing' && s.trialEndDate) {
    const hoursLeft = hoursBetween(s.now, s.trialEndDate);
    if (hoursLeft > 0 && hoursLeft <= 60 && !s.acked.has('pre_first_charge')) {
      return { key: 'pre_first_charge', ackKey: 'pre_first_charge' };
    }
  }

  // Everything else mirrors an email that has gone out.
  const order: NoticeKey[] = ['pre_third_charge', 'pre_second_charge', 'plan_completed', 'first_payment', 'card_added'];
  for (const key of order) {
    const sentAt = s.emailsSent[key];
    if (!sentAt || s.acked.has(key)) continue;
    if (s.now.getTime() - sentAt.getTime() > POPUP_SHELF_LIFE[key]) continue;
    if (key === 'card_added' && s.planStatus !== 'trialing') continue;
    return { key, ackKey: key };
  }
  return null;
}

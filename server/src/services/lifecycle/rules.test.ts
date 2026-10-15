import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  noticeFor, paidEmailFor, preChargeEmailFor, includedAccessExpiry, willCharge,
  recommendedNextAction, inWindow, DAY3_WINDOW, type NoticeState,
} from './rules';
import { lifecycleEmail, renderHtml, renderText, type LifecycleEmailKey } from './copy';

const H = 60 * 60 * 1000;
const now = new Date('2026-10-15T00:00:00Z');

function state(over: Partial<NoticeState> = {}): NoticeState {
  return {
    now,
    signedUpAt: new Date(now.getTime() - 60 * H),
    hasPaidAccess: false,
    hasSubscription: false,
    planStatus: 'active',
    trialEndDate: null,
    emailsSent: {},
    acked: new Set(),
    ...over,
  };
}

describe('day 3 popup', () => {
  it('does not show before day 3', () => {
    expect(noticeFor(state({ signedUpAt: new Date(now.getTime() - 30 * H) }), '2026-10-15')).toBeNull();
  });
  it('shows on day 3 with no card, and once per day', () => {
    expect(noticeFor(state(), '2026-10-15')).toEqual({ key: 'day3_commit', ackKey: 'day3_commit:2026-10-15' });
    expect(noticeFor(state({ acked: new Set(['day3_commit:2026-10-15']) }), '2026-10-15')).toBeNull();
    expect(noticeFor(state({ acked: new Set(['day3_commit:2026-10-15']) }), '2026-10-16')?.key).toBe('day3_commit');
  });
  it('never asks someone who already has a card or paid access', () => {
    expect(noticeFor(state({ hasSubscription: true, planStatus: 'trialing' }), 'd')?.key).not.toBe('day3_commit');
    expect(noticeFor(state({ hasPaidAccess: true }), 'd')).toBeNull();
  });
});

describe('trial and payment popups', () => {
  const trialing = { hasPaidAccess: true, hasSubscription: true, planStatus: 'trialing' };
  it('reminds 48 hours before the first charge, from the trial date alone', () => {
    const n = noticeFor(state({ ...trialing, trialEndDate: new Date(now.getTime() + 40 * H) }), 'd');
    expect(n?.key).toBe('pre_first_charge');
  });
  it('confirms the card straight after it is added', () => {
    const n = noticeFor(state({ ...trialing, trialEndDate: new Date(now.getTime() + 6 * 24 * H), emailsSent: { card_added: now } }), 'd');
    expect(n?.key).toBe('card_added');
  });
  it('mirrors the payment emails, and lets old ones expire', () => {
    const paid = { hasPaidAccess: true, hasSubscription: true, planStatus: 'active' };
    expect(noticeFor(state({ ...paid, emailsSent: { first_payment: now } }), 'd')?.key).toBe('first_payment');
    expect(noticeFor(state({ ...paid, emailsSent: { first_payment: new Date(now.getTime() - 20 * 24 * H) } }), 'd')).toBeNull();
    expect(noticeFor(state({ ...paid, emailsSent: { pre_second_charge: now, first_payment: now } }), 'd')?.key).toBe('pre_second_charge');
  });
});

describe('which payment email', () => {
  it('maps payment counts to emails on a three-payment plan', () => {
    expect(preChargeEmailFor(0)).toBe('pre_first_charge');
    expect(preChargeEmailFor(1)).toBe('pre_second_charge');
    expect(preChargeEmailFor(2)).toBe('pre_third_charge');
    expect(preChargeEmailFor(3)).toBeNull();
    expect(paidEmailFor(1)).toBe('first_payment');
    expect(paidEmailFor(2)).toBeNull();
    expect(paidEmailFor(3)).toBe('plan_completed');
  });
  it('counts the 12 included months from the end of the third paid month', () => {
    expect(includedAccessExpiry(new Date('2027-01-08T00:00:00Z')).toISOString().slice(0, 10)).toBe('2028-01-08');
  });
  it('never announces a charge that will not happen', () => {
    const at = new Date('2026-11-01T00:00:00Z');
    expect(willCharge({ status: 'active' }, at)).toBe(true);
    expect(willCharge({ status: 'active', cancel_at_period_end: true }, at)).toBe(false);
    expect(willCharge({ status: 'active', cancel_at: at.getTime() / 1000 }, at)).toBe(false);
    expect(willCharge({ status: 'canceled' }, at)).toBe(false);
  });
});

describe('windows and next action', () => {
  it('day 3 window is 24 hours wide so a daily run hits each person once', () => {
    expect(DAY3_WINDOW.toHours - DAY3_WINDOW.fromHours).toBe(24);
    expect(inWindow(54, DAY3_WINDOW)).toBe(true);
    expect(inWindow(78, DAY3_WINDOW)).toBe(false);
  });
  it('puts follow-ups first', () => {
    expect(recommendedNextAction({ applications: 10, outreach: 10, followupsDue: 1 })).toMatch(/^send your 1 follow-up first/);
    expect(recommendedNextAction({ applications: 0, outreach: 0, followupsDue: 0 })).toMatch(/one application/);
  });
});

describe('copy', () => {
  const keys: LifecycleEmailKey[] = [
    'resume_ready', 'first_application', 'day3_no_card', 'card_added', 'pre_first_charge',
    'first_payment', 'weekly_checkin', 'pre_second_charge', 'pre_third_charge', 'plan_completed',
  ];
  const vars = {
    firstName: 'Priya', appUrl: 'https://x.test/', billingUrl: 'https://x.test/b', amount: '$250',
    chargeDate: 'Friday 23 October 2026', applicationsThisWeek: 3, outreachThisWeek: 2, followupsDue: 1,
    recommendedNextAction: recommendedNextAction({ applications: 3, outreach: 2, followupsDue: 1 }),
  };

  it('fills every placeholder', () => {
    for (const k of keys) {
      const e = lifecycleEmail(k, vars);
      const text = renderText(e);
      expect(text).not.toMatch(/\{\{|undefined|null/);
      expect(text.startsWith('Hi Priya,')).toBe(true);
    }
  });

  it('has no em or en dashes in any email or popup', () => {
    for (const k of keys) {
      const e = lifecycleEmail(k, vars);
      expect(e.subject + renderText(e) + renderHtml(e)).not.toMatch(/[–—]/);
    }
    const popup = readFileSync(join(__dirname, '../../../../src/components/lifecycle/LifecycleNotice.tsx'), 'utf8');
    expect(popup).not.toMatch(/[–—]/);
  });

  it('day 3 email states plainly that adding a card is not a charge', () => {
    expect(renderText(lifecycleEmail('day3_no_card', vars))).toContain("You won't be charged when you add your card.");
  });
});

import { describe, it, expect, vi } from 'vitest';

// A fixed today, the day after measuring started, so the windows hold forever.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-16T00:00:00Z'));
const NOW = Date.now();
/** Minutes after measuring started (15 Oct 2026, 05:00 UTC), so the test does not depend on today's date. */
const ago = (m: number) => new Date(Date.parse('2026-10-15T05:00:00Z') + (10 - m) * 60_000);
const BEFORE = new Date('2026-10-01T00:00:00Z'); // before measuring started

const sends = [
  // Measured, HTML with a link: delivered, opened, clicked.
  { id: 's1', templateId: 't_follow', broadcastId: null, sentAt: ago(2), subject: 'Time to follow up', toEmail: 'a@x.co', deliveredAt: ago(2), bouncedAt: null, bounceReason: null, complainedAt: null },
  // Measured, same email: delivered only.
  { id: 's2', templateId: 't_follow', broadcastId: null, sentAt: ago(3), subject: 'Time to follow up', toEmail: 'b@x.co', deliveredAt: ago(3), bouncedAt: null, bounceReason: null, complainedAt: null },
  // Measured, plain text call reminder: bounced.
  { id: 's3', templateId: 't_call', broadcastId: null, sentAt: ago(4), subject: 'Our call starts in an hour', toEmail: 'c@x.co', deliveredAt: null, bouncedAt: ago(4), bounceReason: 'Permanent: General', complainedAt: null },
  // Before measuring: must not count against any rate.
  { id: 's4', templateId: 't_follow', broadcastId: null, sentAt: BEFORE, subject: 'Time to follow up', toEmail: 'd@x.co', deliveredAt: null, bouncedAt: null, bounceReason: null, complainedAt: null },
  // Our own inbox: dropped entirely.
  { id: 's5', templateId: 't_follow', broadcastId: null, sentAt: ago(1), subject: 'Time to follow up', toEmail: 'kiron@agc.com', deliveredAt: ago(1), bouncedAt: null, bounceReason: null, complainedAt: null },
];

vi.mock('../../index', () => ({
  prisma: {
    emailSend: { findMany: async () => sends.filter((s) => s.sentAt >= new Date(NOW - 90 * 86_400_000)) },
    emailTemplate: {
      findMany: async () => [
        { id: 't_follow', name: 'follow_up_reminder', bodyHtml: '<a href="https://www.aussiegradcareers.com.au/">x</a>', bodyText: null },
        { id: 't_call', name: 'sales_meeting_reminder_hour', bodyHtml: null, bodyText: 'Kiron\naussiegradcareers.com.au' },
      ],
    },
    broadcast: { findMany: async () => [] },
    contact: { count: async () => 0 },
    emailOpen: { groupBy: async () => [{ emailSendId: 's1' }] },
    emailClick: { groupBy: async () => [{ emailSendId: 's1' }] },
  },
}));
vi.mock('../../middleware/auth', () => ({ authenticate: (_q: any, _s: any, n: any) => n() }));
vi.mock('../../middleware/requireAdmin', () => ({ requireAdmin: (_q: any, _s: any, n: any) => n() }));

import router, { TRACKING_SINCE } from './analyticsRoutes';

async function call(days: number): Promise<any> {
  const layer = (router as any).stack.find((l: any) => l.route?.path === '/admin/email-analytics');
  let body: any;
  await layer.route.stack[0].handle({ query: { days: String(days) } }, { json: (b: any) => { body = b; return b; }, status: () => ({ json: (b: any) => { body = b; } }) });
  return body;
}

describe('GET /admin/email-analytics', () => {
  it('measuring starts on 15 October 2026', () => {
    expect(TRACKING_SINCE.toISOString()).toBe('2026-10-15T05:00:00.000Z');
  });

  it('works rates out only on sends since measuring started', async () => {
    const r = await call(30);
    expect(r.summary.sent).toBe(4);          // our own inbox dropped
    expect(r.summary.measured).toBe(3);      // the 1 October send is not measured
    expect(r.summary.deliveryRate).toBe(67); // 2 of 3
    expect(r.summary.openRate).toBe(50);     // 1 of the 2 HTML sends
    expect(r.summary.bounced).toBe(1);
  });

  it('says a plain-text email cannot show opens, rather than 0%', async () => {
    const r = await call(30);
    const call_ = r.emails.find((e: any) => e.label === 'Call reminder, hour before');
    expect(call_.canOpen).toBe(false);
    expect(call_.canClick).toBe(false);
    expect(call_.stage).toBe('Calls and workshops');
  });

  it('lists the bounce and labels each recent send', async () => {
    const r = await call(30);
    expect(r.bounces).toEqual([expect.objectContaining({ toEmail: 'c@x.co', reason: 'Permanent: General' })]);
    const status = Object.fromEntries(r.recent.map((x: any) => [x.id, x.status]));
    expect(status).toEqual({ s1: 'Clicked', s2: 'Delivered', s3: 'Bounced', s4: 'Sent, not measured' });
  });

  it('a 7 day window leaves out the older send', async () => {
    const r = await call(7);
    expect(r.days).toBe(7);
  });
});

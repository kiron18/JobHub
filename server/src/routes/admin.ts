import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { callClaude } from '../services/llm';
import { sendFridayBriefEmail } from '../services/email';
import { TRIAL_PERIOD_DAYS } from './stripe';
import { requireAdmin } from '../middleware/requireAdmin';
import { supabase } from '../lib/supabase';

const router = Router();

// Admin/test accounts excluded from all platform stats
const EXCLUDED_EMAILS = new Set([
  'kiron182@gmail.com',
  'yornorik281@gmail.com',
  'yornorik281@hotmail.com',
  'kamiproject2021@gmail.com',
  'kironorik182@gmail.com',
  'kironorik@gmail.com',
  'kironoriktest@gmail.com',
]);

const ANALYTICS_START_DATE = new Date('2026-04-27T00:00:00Z');

/**
 * Returns the userIds of real, currently-active Supabase auth users,
 * excluding internal test/admin accounts.
 * Cross-referencing with Supabase ensures deleted accounts are never counted —
 * even if their candidateProfile row was not cleaned up in Postgres.
 */
export async function getRealUserIds(): Promise<string[]> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error || !data?.users) {
    // Fall back to profile-level exclusion if Supabase admin call fails
    console.warn('[admin] supabase.auth.admin.listUsers failed, falling back to email exclusion:', error?.message);
    // `email NOT IN (...)` is NULL for a profile with no email, so a bare
    // notIn silently drops those rows. They are real users, so keep them.
    const profiles = await prisma.candidateProfile.findMany({
      where: { OR: [{ email: null }, { email: { notIn: [...EXCLUDED_EMAILS] } }] },
      select: { userId: true },
    });
    return profiles.map(p => p.userId);
  }
  return data.users
    .filter(u => !u.email || !EXCLUDED_EMAILS.has(u.email.toLowerCase()))
    .map(u => u.id);
}

/**
 * Returns the start and end of the current weekly window.
 * Window: Thursday 19:00 AEST (09:00 UTC) → next Thursday 09:00 UTC
 */
function getCurrentWindow(): { from: Date; to: Date } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun,1=Mon,...,4=Thu,...,6=Sat
  const hour = now.getUTCHours();

  // How many days ago was the last Thursday 09:00 UTC?
  let daysSince = (day - 4 + 7) % 7;
  // If today is Thursday but before 09:00 UTC, use last Thursday
  if (day === 4 && hour < 9) daysSince = 7;

  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - daysSince);
  from.setUTCHours(9, 0, 0, 0);
  from.setUTCMilliseconds(0);

  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);

  return { from, to };
}

async function getFirstTimeReportsForWindow(from: Date, to: Date, realUserIds: string[]) {
  const actualFrom = from.getTime() < ANALYTICS_START_DATE.getTime() ? ANALYTICS_START_DATE : from;
  if (actualFrom >= to) return [];

  return prisma.diagnosticReport.findMany({
    where: {
      status: 'COMPLETE',
      createdAt: { gte: actualFrom, lt: to },
      ...(realUserIds.length ? { userId: { in: realUserIds } } : {}),
    },
    include: {
      candidateProfile: {
        select: {
          name: true,
          targetRole: true,
          searchDuration: true,
          perceivedBlocker: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

function buildBriefPrompt(
  reports: Awaited<ReturnType<typeof getFirstTimeReportsForWindow>>,
  from: Date,
): string {
  const weekLabel = from.toISOString().split('T')[0];
  const people = reports.map(r => {
    const p = r.candidateProfile;
    return [
      `--- PERSON: ${p?.name ?? 'Unknown'} ---`,
      `Target Role: ${p?.targetRole ?? 'Not specified'}`,
      `Search Duration: ${p?.searchDuration ?? 'Not specified'}`,
      `Perceived Blocker: ${p?.perceivedBlocker ?? 'Not specified'}`,
      `Report:`,
      (r.reportMarkdown ?? '(no report content)').substring(0, 4000),
    ].join('\n');
  }).join('\n\n');

  return `You are writing a spoken Friday call script for Kiron, a career coach running a weekly live call for Australian graduate job seekers. Use first person ("I've looked at your report..."). Write in warm, direct Australian English — like a coach who has genuinely read every report. This is something Kiron will read aloud on a live call.

Week: ${weekLabel}
Number of first-time reports this week: ${reports.length}

${people}

Write a complete spoken script with exactly these four sections:

**OPENING** — Welcome the group. Mention how many reports came in this week. Tease 2-3 themes you noticed across all of them. Keep it warm and energetic (3-4 sentences).

**COMMON THEMES** — Identify 3 to 5 patterns that appear across multiple reports this week. For each theme: name it, explain what you're seeing, and give a concrete talking point Kiron can expand on. Be specific to this cohort — no generic advice.

**INDIVIDUAL CALLOUTS** — One paragraph per person. Address them by first name. State one specific insight from their report that shows you read it carefully. Give them one concrete next step. Make them feel seen and not alone.

**CLOSE** — Encourage questions in the chat. Remind them what the community is for. Hype next week's call. End with energy (2-3 sentences).

Write the full script now, ready for Kiron to read. Do not include any meta-commentary or instructions — just the script.`;
}

// GET /api/admin/friday-brief
router.get('/friday-brief', authenticate, requireAdmin, async (_req, res) => {
  const { from, to } = getCurrentWindow();
  try {
    const realUserIds = await getRealUserIds();
    const cached = await prisma.fridayBrief.findUnique({
      where: { windowStart: from },
    });

    const actualFrom = from.getTime() < ANALYTICS_START_DATE.getTime() ? ANALYTICS_START_DATE : from;
    const firstTimeCount = actualFrom >= to ? 0 : await prisma.diagnosticReport.count({
      where: {
        status: 'COMPLETE',
        createdAt: { gte: actualFrom, lt: to },
        ...(realUserIds.length ? { userId: { in: realUserIds } } : {}),
      },
    });

    if (cached) {
      return res.json({
        window: { from, to },
        reportCount: firstTimeCount,
        cached: true,
        script: cached.script,
        generatedAt: cached.generatedAt,
      });
    }

    return res.json({
      window: { from, to },
      reportCount: firstTimeCount,
      cached: false,
      script: null,
      generatedAt: null,
    });
  } catch (err) {
    console.error('[admin/friday-brief GET] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/admin/friday-brief/generate
router.post('/friday-brief/generate', authenticate, requireAdmin, async (_req, res) => {
  const { from, to } = getCurrentWindow();
  try {
    const realUserIds = await getRealUserIds();
    const reports = await getFirstTimeReportsForWindow(from, to, realUserIds);

    if (reports.length === 0) {
      return res.json({ script: 'No first-time reports in this window yet.', reportCount: 0 });
    }

    const prompt = buildBriefPrompt(reports, from);
    const { content: script } = await callClaude(prompt, false);

    await prisma.fridayBrief.upsert({
      where: { windowStart: from },
      update: { script, reportCount: reports.length, generatedAt: new Date(), windowEnd: to },
      create: { windowStart: from, windowEnd: to, script, reportCount: reports.length },
    });

    return res.json({ script, reportCount: reports.length });
  } catch (err) {
    console.error('[admin/friday-brief POST] error:', err);
    return res.status(500).json({ error: 'Failed to generate brief' });
  }
});

// POST /api/admin/friday-brief/email — send generated brief to admin email via Resend
router.post('/friday-brief/email', authenticate, requireAdmin, async (_req, res) => {
  const { from } = getCurrentWindow();
  const weekLabel = from.toISOString().split('T')[0];
  try {
    const cached = await prisma.fridayBrief.findUnique({ where: { windowStart: from } });
    if (!cached?.script) {
      return res.status(400).json({ error: 'No brief generated for this week yet. Generate it first.' });
    }
    await sendFridayBriefEmail(cached.script, cached.reportCount, weekLabel);
    return res.json({ ok: true, sentTo: process.env.ADMIN_EMAIL ?? 'kiron@aussiegradcareers.com.au', weekLabel });
  } catch (err: any) {
    console.error('[admin/friday-brief/email] error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

// GET /api/admin/traffic?from=YYYY-MM-DD&to=YYYY-MM-DD&interval=day|week|month
// Visitors per bucket for the bar chart on /admin/traffic, plus the funnel
// totals for the whole range: visited -> uploaded -> saw resume -> signed up
// -> trial -> paid.
//
// Two sources, on purpose. Visits, uploads and "saw resume" exist only in
// PostHog (live host, test accounts out, a pageview needs a browser so headless
// crawlers drop). From 2026-10-03 every front-door step is recorded on our
// own server (resume_uploaded/built in routes/welcome.ts, the rest relayed by
// routes/track.ts), which ad blockers cannot drop; the browser-only events
// still count for older dates.
// Signups and trials come from the database, because PostHog
// misses them: ad blockers hide whole people, and welcome_completed only fires
// in the /welcome flow, not for someone who signs up at /auth. Checked on
// 2026-10-03: PostHog had 4 signups and 0 trials for a month the database had
// 8 and 9. All buckets are UTC, which is the PostHog project's timezone.
const TRAFFIC_HOST = 'www.aussiegradcareers.com.au';
const TEST_EMAIL = /kiron|norik|kamiproject/i;
const TRAFFIC_NOT_TEST = `not (ifNull(person.properties.email, '') ilike '%kiron%'
  or ifNull(person.properties.email, '') ilike '%norik%'
  or ifNull(person.properties.email, '') ilike 'kamiproject%')`;
const TRAFFIC_COLUMNS = `
  count(distinct if((event = '$pageview' and properties.$browser is not null) or (event = 'welcome_step_viewed' and properties.step_index = 0), person_id, null)) as visitors,
  count(distinct if((event = 'welcome_step_viewed' and properties.step_index = 1) or event = 'resume_uploaded', person_id, null)) as uploaded,
  count(distinct if((event = 'welcome_step_viewed' and properties.step_index = 6) or event = 'resume_built', person_id, null)) as resume,
  count(distinct if(event = 'email_submitted', person_id, null)) as entered_email,
  count(distinct if(event = 'payment_completed', person_id, null)) as paid`;
const POSTHOG_METRICS = ['visitors', 'uploaded', 'resume', 'enteredEmail', 'paid'] as const;

/**
 * Where a visitor came from, in plain words. Keyed on the first pageview's
 * utm_source, else its referring domain, so one person is one source even if
 * they came back later another way. Returns null for our own test hosts.
 */
function trafficSourceOf(raw: string | null): string | null {
  const s = (raw ?? '').toLowerCase();
  if (!s || s === '$direct' || s.includes('aussiegradcareers')) return 'Direct';
  if (s.includes('test') || s.includes('deploycheck')) return null;
  if (s.includes('linkedin') || s === 'lnkd.in') return 'LinkedIn';
  if (s.includes('google') || s.includes('bing') || s.includes('duckduckgo') || s.includes('yahoo')) return 'Search';
  if (s.includes('instagram') || s === 'ig' || s.includes('facebook') || s === 'fb') return 'Instagram / Facebook';
  if (s.includes('tiktok')) return 'TikTok';
  if (s.includes('skool')) return 'Skool';
  if (s.includes('chatgpt') || s.includes('openai') || s.includes('perplexity') || s.includes('claude')) return 'AI chat';
  return 'Other';
}

/** The front-door funnel per visitor, split by first source and device. Only
 * the steps PostHog sees: signups and trials are counted from the database and
 * cannot be joined to a pageview reliably. */
async function trafficSegments(
  hogql: (q: string) => Promise<any[][]>,
  from: string,
  to: string,
): Promise<{ source: SegmentRow[]; device: SegmentRow[] }> {
  const rows = await hogql(`select device, src, count() as visitors, sum(u), sum(r), sum(e) from (
    select person_id,
      max(if((event = '$pageview' and properties.$browser is not null) or (event = 'welcome_step_viewed' and properties.step_index = 0), 1, 0)) as v,
      max(if((event = 'welcome_step_viewed' and properties.step_index = 1) or event = 'resume_uploaded', 1, 0)) as u,
      max(if((event = 'welcome_step_viewed' and properties.step_index = 6) or event = 'resume_built', 1, 0)) as r,
      max(if(event = 'email_submitted', 1, 0)) as e,
      argMinIf(properties.$device_type, timestamp, event = '$pageview') as device,
      argMinIf(coalesce(nullIf(properties.utm_source, ''), properties.$referring_domain), timestamp, event = '$pageview') as src
    from events
    where timestamp >= toDateTime('${from} 00:00:00') and timestamp < toDateTime('${to} 00:00:00') + interval 1 day
      and event in ('$pageview', 'welcome_step_viewed', 'resume_uploaded', 'resume_built', 'email_submitted')
      and properties.$host = '${TRAFFIC_HOST}'
      and ${TRAFFIC_NOT_TEST}
    group by person_id
  ) where v = 1 group by device, src`);

  const source = new Map<string, SegmentRow>();
  const device = new Map<string, SegmentRow>();
  const add = (m: Map<string, SegmentRow>, key: string, r: any[]) => {
    const row = m.get(key) ?? { key, visitors: 0, uploaded: 0, resume: 0, enteredEmail: 0 };
    row.visitors += Number(r[2]); row.uploaded += Number(r[3]); row.resume += Number(r[4]); row.enteredEmail += Number(r[5]);
    m.set(key, row);
  };
  for (const r of rows) {
    const src = trafficSourceOf(r[1] == null ? null : String(r[1]));
    if (!src) continue;
    add(source, src, r);
    add(device, r[0] ? String(r[0]) : 'Unknown', r);
  }
  const sorted = (m: Map<string, SegmentRow>) => [...m.values()].sort((a, b) => b.visitors - a.visitors);
  return { source: sorted(source), device: sorted(device) };
}
interface SegmentRow { key: string; visitors: number; uploaded: number; resume: number; enteredEmail: number }
type TrafficInterval = 'day' | 'week' | 'month';

/** The bucket a moment falls in, matching HogQL's toStartOfDay/Week(Sunday)/Month in UTC. */
function trafficBucketOf(d: Date, interval: TrafficInterval): string {
  const b = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (interval === 'week') b.setUTCDate(b.getUTCDate() - b.getUTCDay());
  if (interval === 'month') b.setUTCDate(1);
  return b.toISOString().slice(0, 10);
}

/** Every bucket between two YYYY-MM-DD dates, so empty days still get a bar. */
function trafficBuckets(from: string, to: string, interval: TrafficInterval): string[] {
  const out: string[] = [];
  const d = new Date(trafficBucketOf(new Date(`${from}T00:00:00Z`), interval) + 'T00:00:00Z');
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    if (interval === 'day') d.setUTCDate(d.getUTCDate() + 1);
    else if (interval === 'week') d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

/** Every Supabase auth user, paged. getRealUserIds stops at 1000 and only
 * knows the bare test addresses, not the +tag ones. */
async function allAuthUsers(): Promise<{ id: string; email?: string; created_at: string }[]> {
  const users: { id: string; email?: string; created_at: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

router.get('/traffic', authenticate, requireAdmin, async (req, res) => {
  const key = process.env.POSTHOG_PERSONAL_API_KEY || process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID?.match(/\d+/)?.[0];
  if (!key || !projectId) return res.status(503).json({ error: 'PostHog not configured' });

  // Strict shapes only: these values are interpolated into the query.
  const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const { from, to } = req.query;
  const interval = req.query.interval;
  if (!isDate(from) || !isDate(to) || from > to) return res.status(400).json({ error: 'from and to must be YYYY-MM-DD, from <= to' });
  if (interval !== 'day' && interval !== 'week' && interval !== 'month') return res.status(400).json({ error: 'interval must be day, week or month' });

  const rangeStart = new Date(`${from}T00:00:00Z`);
  const rangeEnd = new Date(`${to}T00:00:00Z`);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
  const inRange = (d: Date) => d >= rangeStart && d < rangeEnd;

  const bucketFn = { day: 'toStartOfDay', week: 'toStartOfWeek', month: 'toStartOfMonth' }[interval];
  const where = `timestamp >= toDateTime('${from} 00:00:00') and timestamp < toDateTime('${to} 00:00:00') + interval 1 day
    and event in ('$pageview', 'welcome_step_viewed', 'resume_uploaded', 'resume_built', 'email_submitted', 'payment_completed')
    and (properties.$host = '${TRAFFIC_HOST}' or event = 'payment_completed')
    and ${TRAFFIC_NOT_TEST}`;

  async function hogql(query: string): Promise<any[][]> {
    const r = await fetch(`https://us.posthog.com/api/projects/${projectId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    });
    if (!r.ok) throw new Error(`PostHog ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    return ((await r.json()) as { results?: any[][] }).results ?? [];
  }
  const toMetrics = (row: any[] | undefined, offset: number) =>
    Object.fromEntries(POSTHOG_METRICS.map((m, i) => [m, Number(row?.[offset + i] ?? 0)]));

  try {
    const [byBucket, totals, segments, users, challenges, stripeTrials] = await Promise.all([
      hogql(`select toString(toDate(${bucketFn}(timestamp))) as bucket, ${TRAFFIC_COLUMNS} from events where ${where} group by bucket order by bucket`),
      hogql(`select ${TRAFFIC_COLUMNS} from events where ${where}`),
      // A failed breakdown should cost the page its tables, not the whole funnel.
      trafficSegments(hogql, from, to).catch((err) => {
        console.warn('[admin/traffic] segments failed:', err.message);
        return null;
      }),
      allAuthUsers(),
      prisma.trialChallenge.findMany({ where: { currentDay: { gte: 1 } }, select: { userId: true, createdAt: true } }),
      // A card-on-file trial stores only its end; the start is TRIAL_PERIOD_DAYS before it.
      prisma.candidateProfile.findMany({ where: { trialEndDate: { not: null } }, select: { userId: true, trialEndDate: true } }),
    ]);

    const realIds = new Set(users.filter(u => !TEST_EMAIL.test(u.email ?? '')).map(u => u.id));
    const signups = users.filter(u => realIds.has(u.id)).map(u => new Date(u.created_at)).filter(inRange);
    // One trial per person: the earliest start across both kinds.
    const trialStart = new Map<string, Date>();
    const addTrial = (userId: string, at: Date) => {
      if (!realIds.has(userId)) return;
      const prev = trialStart.get(userId);
      if (!prev || at < prev) trialStart.set(userId, at);
    };
    for (const c of challenges) addTrial(c.userId, c.createdAt);
    for (const p of stripeTrials) addTrial(p.userId, new Date(p.trialEndDate!.getTime() - TRIAL_PERIOD_DAYS * 86_400_000));
    const trials = [...trialStart.values()].filter(inRange);

    const countBy = (dates: Date[]) => {
      const m = new Map<string, number>();
      for (const d of dates) { const b = trafficBucketOf(d, interval); m.set(b, (m.get(b) ?? 0) + 1); }
      return m;
    };
    const signupsBy = countBy(signups);
    const trialsBy = countBy(trials);
    const found = new Map(byBucket.map(row => [String(row[0]), row]));

    return res.json({
      from, to, interval,
      buckets: trafficBuckets(from, to, interval).map(bucket => ({
        bucket,
        ...toMetrics(found.get(bucket), 1),
        signedUp: signupsBy.get(bucket) ?? 0,
        trials: trialsBy.get(bucket) ?? 0,
      })),
      totals: { ...toMetrics(totals[0], 0), signedUp: signups.length, trials: trials.length },
      segments,
    });
  } catch (err) {
    console.error('[admin/traffic] error:', err);
    return res.status(500).json({ error: 'Failed to fetch traffic data' });
  }
});

export default router;

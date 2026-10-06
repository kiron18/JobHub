/**
 * AdminTraffic, shown as "Growth": where visitors drop off on the way to paying.
 *
 * Read top to bottom: the biggest leak in the funnel, the funnel itself with
 * raw counts, visitors over time (hover a bar for that bucket's funnel), then
 * the same funnel split by where people came from and what device they used.
 * visited -> uploaded -> saw resume -> entered email -> signed up -> trial -> paid.
 *
 * Data via GET /api/admin/traffic: visits and uploads from PostHog, signups
 * and trials from the database (PostHog undercounts both). Test accounts,
 * staging/localhost runs and headless crawler hits are dropped server-side.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { AdminShell } from '../components/admin/AdminShell';

type Interval = 'day' | 'week' | 'month';

interface Metrics {
  visitors: number;
  uploaded: number;
  resume: number;
  enteredEmail: number;
  signedUp: number;
  trials: number;
  paid: number;
}

interface SegmentRow {
  key: string;
  visitors: number;
  uploaded: number;
  resume: number;
  enteredEmail: number;
}

interface TrafficResponse {
  from: string;
  to: string;
  interval: Interval;
  buckets: (Metrics & { bucket: string })[];
  totals: Metrics;
  /** Null when the breakdown query failed; the rest of the page still loads. */
  segments: { source: SegmentRow[]; device: SegmentRow[] } | null;
}

/** Below this many people at a step, a percentage is a hint, not a result. */
const SMALL_SAMPLE = 30;

const C = warm.colors;

const STEPS: { key: keyof Metrics; label: string }[] = [
  { key: 'visitors', label: 'Visited' },
  { key: 'uploaded', label: 'Uploaded a resume' },
  { key: 'resume', label: 'Saw their resume' },
  { key: 'enteredEmail', label: 'Entered email' },
  { key: 'signedUp', label: 'New accounts' },
  { key: 'trials', label: 'Started a trial' },
  { key: 'paid', label: 'Paid' },
];

const PRESETS: { label: string; days: number; interval: Interval }[] = [
  { label: '7 days', days: 7, interval: 'day' },
  { label: '30 days', days: 30, interval: 'day' },
  { label: '90 days', days: 90, interval: 'week' },
  { label: '12 months', days: 365, interval: 'month' },
];

/** Local calendar date as YYYY-MM-DD (not toISOString, which is UTC). */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  return ymd(d);
}

function bucketLabel(bucket: string, interval: Interval): string {
  const d = new Date(`${bucket}T00:00:00`);
  if (interval === 'month') return d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function pct(n: number, of: number): string | null {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : null;
}

/**
 * The step that loses the biggest share of the people who reached the step
 * before it. Steps with fewer than 10 people coming in are skipped when
 * anything else qualifies, so a 1-of-2 can't outshout a 15-of-112.
 */
function biggestLeak(t: Metrics | undefined): { from: number; to: number } | null {
  if (!t) return null;
  const candidates = STEPS.slice(1)
    .map((s, i) => ({ i: i + 1, prev: t[STEPS[i].key], value: t[s.key] }))
    .filter(c => c.prev > 0 && c.value <= c.prev);
  const pool = candidates.some(c => c.prev >= 10) ? candidates.filter(c => c.prev >= 10) : candidates;
  if (!pool.length) return null;
  const worst = pool.reduce((a, b) => (b.value / b.prev < a.value / a.prev ? b : a));
  return { from: worst.i - 1, to: worst.i };
}

export function AdminTraffic() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(ymd(new Date()));
  const [interval, setGroupBy] = useState<Interval>('day');
  const [hover, setHover] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-traffic', from, to, interval],
    queryFn: async () => (await api.get('/admin/traffic', { params: { from, to, interval } })).data as TrafficResponse,
    enabled: from <= to,
  });

  const max = useMemo(() => Math.max(1, ...(data?.buckets ?? []).map(b => b.visitors)), [data]);
  // Round the axis top up to a clean number so gridlines land on whole values.
  const axisTop = useMemo(() => {
    const step = max <= 10 ? 2 : max <= 50 ? 10 : max <= 200 ? 25 : 100;
    return Math.ceil(max / step) * step;
  }, [max]);
  const gridlines = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(axisTop * f));

  const buckets = data?.buckets ?? [];
  // Thin the x labels so they never collide: at most ~10 across.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 10));

  const applyPreset = (p: typeof PRESETS[number]) => {
    setFrom(daysAgo(p.days));
    setTo(ymd(new Date()));
    setGroupBy(p.interval);
  };
  const activePreset = PRESETS.find(p => from === daysAgo(p.days) && to === ymd(new Date()) && interval === p.interval);

  const forbidden = (error as any)?.response?.status === 403;

  const leak = biggestLeak(data?.totals);

  return (
    <AdminShell
      title="Growth"
      subtitle="Where visitors drop off on the way to paying. Accounts and trials are exact, from the database. Visits, uploads and emails come through our own server, so ad blockers don't hide them (from 3 Oct 2026; earlier days undercount). Test accounts, staging and crawlers removed. Days are UTC."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Filters: one row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {PRESETS.map(p => {
            const on = activePreset === p;
            return (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                style={{
                  ...warm.text.small, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${on ? C.accentPetrol : C.borderDefined}`,
                  background: on ? C.accentPetrolSoft : C.bgSurface,
                  color: on ? C.accentPetrol : C.textSecondary,
                  fontWeight: on ? 600 : 400,
                }}
              >
                {p.label}
              </button>
            );
          })}
          <span style={{ width: 8 }} />
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={inputStyle} aria-label="From" />
          <span style={{ ...warm.text.small, color: C.textMuted }}>to</span>
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={inputStyle} aria-label="To" />
          <select value={interval} onChange={e => setGroupBy(e.target.value as Interval)} style={inputStyle} aria-label="Group by">
            <option value="day">By day</option>
            <option value="week">By week</option>
            <option value="month">By month</option>
          </select>
        </div>

        {forbidden && <p style={{ ...warm.text.body, color: C.danger }}>Admin only.</p>}
        {error && !forbidden && <p style={{ ...warm.text.body, color: C.danger }}>Could not load PostHog data.</p>}

        {/* The one thing to fix */}
        {data && leak && <LeakCallout totals={data.totals} leak={leak} />}

        {/* Funnel for the whole range */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {STEPS.map((s, i) => {
            const value = data?.totals[s.key];
            const prev = i > 0 ? data?.totals[STEPS[i - 1].key] : undefined;
            const conv = value != null && prev != null ? pct(value, prev) : null;
            const isLeak = leak?.to === i;
            return (
              <div key={s.key} style={{
                padding: '14px 16px', borderRadius: 12,
                border: `1px solid ${isLeak ? C.accentGold : C.borderWhisper}`,
                background: isLeak ? C.accentGoldSoft : 'transparent',
              }}>
                <p style={{ ...warm.text.micro, margin: 0, color: C.textMuted }}>{s.label}</p>
                <p style={{ ...warm.text.h1, margin: '4px 0 0', color: i === 0 ? C.accentPetrol : C.textPrimary }}>
                  {isLoading ? '…' : value ?? '–'}
                </p>
                <p style={{ ...warm.text.small, margin: 0, color: C.textMuted, minHeight: 20 }}>
                  {conv ? `${conv} of ${prev}` : ''}
                </p>
              </div>
            );
          })}
        </div>

        {/* Visitors bar chart */}
        <div style={{ border: `1px solid ${C.borderWhisper}`, borderRadius: 12, padding: '16px 16px 12px' }}>
          <p style={{ ...warm.text.h3, margin: '0 0 12px' }}>Visitors per {interval}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Y axis */}
            <div style={{ position: 'relative', width: 28, height: 260, flexShrink: 0 }}>
              {gridlines.map((g, gi) => (
                <span key={gi} style={{ position: 'absolute', right: 0, bottom: `${(g / axisTop) * 100}%`, transform: 'translateY(50%)', fontSize: 11, color: C.textMuted }}>
                  {g}
                </span>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ position: 'relative', height: 260 }} onMouseLeave={() => setHover(null)}>
                {gridlines.map((g, gi) => (
                  <div key={gi} style={{ position: 'absolute', left: 0, right: 0, bottom: `${(g / axisTop) * 100}%`, borderTop: `1px solid ${g === 0 ? C.borderDefined : C.borderWhisper}` }} />
                ))}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                  {buckets.map((b, i) => (
                    <div
                      key={b.bucket}
                      onMouseEnter={() => setHover(i)}
                      onClick={() => setHover(i)}
                      style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', cursor: 'default' }}
                    >
                      <div style={{
                        width: '100%', maxWidth: 40,
                        height: `${(b.visitors / axisTop) * 100}%`,
                        minHeight: b.visitors > 0 ? 2 : 0,
                        background: C.accentPetrol,
                        opacity: hover === null || hover === i ? 1 : 0.45,
                        borderRadius: '4px 4px 0 0',
                        transition: 'opacity 0.12s',
                      }} />
                    </div>
                  ))}
                </div>
                {hover !== null && buckets[hover] && (
                  <Tooltip
                    b={buckets[hover]}
                    interval={interval}
                    leftPct={((hover + 0.5) / buckets.length) * 100}
                  />
                )}
              </div>
              {/* X axis */}
              <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                {buckets.map((b, i) => (
                  <span key={b.bucket} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'visible' }}>
                    {i % labelEvery === 0 ? bucketLabel(b.bucket, interval) : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {!isLoading && buckets.length > 0 && buckets.every(b => b.visitors === 0) && (
            <p style={{ ...warm.text.small, color: C.textMuted, margin: '8px 0 0' }}>No visitors in this range.</p>
          )}
        </div>

        {/* The same funnel, split */}
        {data?.segments && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 16 }}>
            <SegmentTable title="By source" rows={data.segments.source} />
            <SegmentTable title="By device" rows={data.segments.device} />
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function LeakCallout({ totals, leak }: { totals: Metrics; leak: { from: number; to: number } }) {
  const a = STEPS[leak.from];
  const b = STEPS[leak.to];
  const prev = totals[a.key];
  const value = totals[b.key];
  return (
    <div style={{ padding: '16px 18px', borderRadius: 12, background: C.accentGoldSoft, border: `1px solid ${C.accentGold}` }}>
      <p style={{ ...warm.text.micro, margin: 0, color: C.accentGold }}>Biggest leak</p>
      <p style={{ ...warm.text.h3, margin: '4px 0 2px' }}>
        {a.label} → {b.label}: {pct(value, prev)} get through
      </p>
      <p style={{ ...warm.text.small, margin: 0, color: C.textSecondary }}>
        {prev} got to "{a.label.toLowerCase()}" and {value} went on, so {prev - value} stopped here.
        {prev < SMALL_SAMPLE && ' That is under 30 people, so read it as a hint, not a result.'}
      </p>
    </div>
  );
}

const SEGMENT_STEPS: { key: 'uploaded' | 'resume' | 'enteredEmail'; label: string }[] = [
  { key: 'uploaded', label: 'Uploaded' },
  { key: 'resume', label: 'Saw resume' },
  { key: 'enteredEmail', label: 'Gave email' },
];

function SegmentTable({ title, rows }: { title: string; rows: SegmentRow[] }) {
  return (
    <div style={{ border: `1px solid ${C.borderWhisper}`, borderRadius: 12, overflowX: 'auto' }}>
      <p style={{ ...warm.text.h3, margin: 0, padding: '14px 16px 8px' }}>{title}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            {['', 'Visitors', ...SEGMENT_STEPS.map(s => s.label)].map((h, i) => (
              <th key={i} style={{ ...warm.text.micro, color: C.textMuted, padding: '6px 16px', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} style={{ borderTop: `1px solid ${C.borderWhisper}` }}>
              <td style={{ ...warm.text.small, padding: '8px 16px', fontWeight: 600 }}>{r.key}</td>
              <td style={{ ...warm.text.small, padding: '8px 16px' }}>{r.visitors}</td>
              {SEGMENT_STEPS.map(s => (
                <td key={s.key} style={{ ...warm.text.small, padding: '8px 16px', whiteSpace: 'nowrap', color: C.textSecondary }}>
                  {r[s.key]} <span style={{ color: C.textMuted }}>({pct(r[s.key], r.visitors) ?? '0%'})</span>
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} style={{ ...warm.text.small, padding: 16, color: C.textMuted }}>No visitors in this range.</td></tr>
          )}
        </tbody>
      </table>
      <p style={{ ...warm.text.small, color: C.textMuted, margin: 0, padding: '8px 16px 12px' }}>
        Percent of that row's visitors. Accounts, trials and payments can't be split this way.
      </p>
    </div>
  );
}

function Tooltip({ b, interval, leftPct }: { b: Metrics & { bucket: string }; interval: Interval; leftPct: number }) {
  const title = interval === 'week' ? `Week of ${bucketLabel(b.bucket, 'day')}` : bucketLabel(b.bucket, interval);
  // Flip to the left half of the bar once past the middle so it never clips.
  const side = leftPct > 60 ? { right: `${100 - leftPct}%` } : { left: `${leftPct}%` };
  return (
    <div style={{
      position: 'absolute', top: 0, ...side, margin: '0 8px', pointerEvents: 'none', zIndex: 2,
      background: C.bgSurface, border: `1px solid ${C.borderDefined}`, borderRadius: 8,
      padding: '8px 12px', boxShadow: '0 4px 16px rgba(15,32,56,0.10)', minWidth: 170,
    }}>
      <p style={{ ...warm.text.small, fontWeight: 600, margin: '0 0 4px', color: C.textPrimary }}>{title}</p>
      {STEPS.map(s => (
        <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, ...warm.text.small, color: C.textSecondary }}>
          <span>{s.label}</span>
          <span style={{ fontWeight: 600, color: C.textPrimary }}>{b[s.key]}</span>
        </div>
      ))}
    </div>
  );
}

const inputStyle: CSSProperties = {
  ...warm.text.small,
  // 16px, not the 13px small() gives everywhere else: under 16px, iOS Safari
  // zooms the whole page in on focus for any real form control.
  fontSize: 16,
  padding: '5px 8px',
  borderRadius: 8,
  border: `1px solid ${C.borderDefined}`,
  background: C.bgSurface,
  color: C.textPrimary,
};
